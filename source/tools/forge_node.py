#!/usr/bin/env python3
"""Forge home node — reference implementation of HOME_NODE_PROTOCOL v1 (kernel-papers/HOME_NODE_PROTOCOL.md).

A tiny self-hosted helper the phone pairs with (Termux on Android, or a home PC). It has NO model and NO shell:
the only operations are ping, tracker-free fetch, and a small offline-tolerant job queue (fetch jobs).
Every request is AES-256-GCM encrypted and authenticated with a key derived (HKDF-SHA256) from a 32-byte pairing
secret shown once as a QR code / URI. Replays are rejected with a strictly increasing counter and a ±300 s clock window.

N5 (2026-10-11): one key PER IDENTITY-VAULT USER. Each vault user pairs once with their own URI/QR (`--add-user NAME`);
counters, jobs and sync bundles are kept per user. A pre-N5 shared key is migrated automatically and flagged legacy;
revoke it with `--revoke <id>` once everyone has re-paired. `--list-users` shows who is paired.

Requirements: Python 3.9+, `cryptography` (Termux: `pkg install python-cryptography`). Optional: `qrcode` for a terminal QR.
Usage:  python3 forge_node.py --host 0.0.0.0 --port 8787 --origin https://your-app-host [--tls] [--state ~/.forge_node.json]
"""
import argparse, base64, hashlib, ipaddress, json, os, secrets, socket, ssl, sys, threading, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

VERSION = "forge-node/1.0"
MAX_BODY = 1024 * 1024  # sync bundles; fetch results are capped separately
MAX_FETCH = 2 * 1024 * 1024
OPS = ("ping", "fetch", "job.submit", "job.status", "job.list", "sync.put", "sync.get", "shared.put", "shared.get")
SHARED_OPS = ("ping", "shared.put", "shared.get")  # what a shared-layer key may do
SECRETISH = __import__("re").compile(r"\b(?:\d{4}[ -]?){3}\d{4}\b|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|-----BEGIN|password\s*(?:is|=)\s*\S", 2)
b64 = lambda b: base64.urlsafe_b64encode(b).decode().rstrip("=")
unb64 = lambda s: base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))

def derive_key(secret: bytes, node_id: str) -> bytes:
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=node_id.encode(), info=b"forge-node v1 enc").derive(secret)

def aad(kind: str, node_id: str, ctr: int) -> bytes:
    return f"forge-node-v1{'-resp' if kind == 'resp' else ''}|{node_id}|{ctr}".encode()

class State:
    """Node state. N5 (2026-10-11): one key PER IDENTITY-VAULT USER. users = {uid: {secret, label, last_ctr, created, legacy}}.
    A pre-N5 shared key is migrated to users[node_id] with legacy=True (old pairing URIs keep working until revoked)."""
    def __init__(self, path):
        self.path = path; self.lock = threading.Lock(); self.created = []
        d = json.load(open(path)) if os.path.exists(path) else {"node_id": secrets.token_hex(8), "users": {}, "jobs": []}
        if "secret" in d and "users" not in d:  # migrate the shared key (MIG-N5-SHARED-KEY)
            d["users"] = {d["node_id"]: {"secret": d.pop("secret"), "label": "legacy-shared", "last_ctr": d.pop("last_ctr", 0), "created": int(time.time()), "legacy": True}}
            d["migrations"] = d.get("migrations", []) + [{"id": "MIG-N5-SHARED-KEY", "at": int(time.time())}]
        d.setdefault("users", {}); d.setdefault("jobs", []); d.setdefault("sync", {})
        self.d = d; self._keys = {}
        if not d["users"]: self.add_user("vault-user-1")
        self.save()
    def add_user(self, label):
        uid = secrets.token_hex(8)
        self.d["users"][uid] = {"secret": b64(secrets.token_bytes(32)), "label": str(label)[:40], "last_ctr": 0, "created": int(time.time()), "legacy": False}
        self.created.append(uid); return uid
    def revoke(self, uid):
        u = self.d["users"].pop(uid, None); self._keys.pop(uid, None)
        self.d["jobs"] = [j for j in self.d["jobs"] if j.get("user") != uid]; self.d["sync"].pop(uid, None); return bool(u)
    def key(self, uid):
        u = self.d["users"].get(uid)
        if not u: return None
        if uid not in self._keys: self._keys[uid] = derive_key(unb64(u["secret"]), uid)
        return self._keys[uid]
    def save(self):
        tmp = self.path + ".tmp"; json.dump(self.d, open(tmp, "w")); os.replace(tmp, self.path)
        try: os.chmod(self.path, 0o600)
        except OSError: pass

def public_url_ok(url: str) -> bool:
    """SSRF guard: http(s) only, no credentials, host must resolve to public addresses only."""
    try:
        u = urllib.parse.urlsplit(url)
        if u.scheme not in ("http", "https") or not u.hostname or u.username or u.password: return False
        for info in socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80)):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified: return False
        return True
    except Exception:
        return False

def tracker_free_fetch(url: str) -> dict:
    """No cookies, no referrer, minimal fixed headers, no script execution, size-capped."""
    if not public_url_ok(url): return {"ok": False, "error": "url_not_public"}
    req = urllib.request.Request(url, headers={"User-Agent": "ForgeNode/1", "Accept": "text/html,text/plain,application/json;q=0.9", "Accept-Language": "en"})
    opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler())  # no HTTPCookieProcessor => cookies never stored or sent
    try:
        with opener.open(req, timeout=20) as r:
            if not public_url_ok(r.geturl()): return {"ok": False, "error": "redirect_not_public"}
            body = r.read(MAX_FETCH + 1)
            return {"ok": True, "status": r.status, "url": r.geturl(), "content_type": r.headers.get("Content-Type", ""), "truncated": len(body) > MAX_FETCH,
                    "text": body[:MAX_FETCH].decode("utf-8", "replace"), "sha256": hashlib.sha256(body[:MAX_FETCH]).hexdigest()}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__}

def make_handler(st: State, origin: str):
    def run_job(job):
        job["state"] = "running"; job["result"] = tracker_free_fetch(job["args"].get("url", "")); job["state"] = "done" if job["result"].get("ok") else "failed"; job["finished"] = int(time.time())
        with st.lock: st.save()
    def is_shared(uid): u = st.d["users"][uid]; return bool(u.get("legacy") or u.get("role") == "shared")
    def dispatch(op, args, uid):
        # Shared knowledge layer (user clarification 2026-10-11): the legacy shared key IS the shared-layer key. It may only read/write the
        # common pool of signed manifests; it can never reach a vault user's private jobs or sync bundles. Per-user keys stay private.
        if is_shared(uid) and op not in SHARED_OPS: return {"ok": False, "error": "shared_layer_key_private_op"}
        if not is_shared(uid) and op in ("shared.put", "shared.get"): return {"ok": False, "error": "not_shared_layer_key"}
        if op == "shared.put":
            ms = args.get("manifests") or []
            if not isinstance(ms, list) or len(ms) > 200: return {"ok": False, "error": "bad_manifests"}
            added = 0
            with st.lock:
                pool = st.d.setdefault("shared_pool", []); have = {m.get("id") for m in pool}
                for m in ms:
                    if not isinstance(m, dict) or not str(m.get("id", "")).startswith("emn:") or not m.get("sig") or m["id"] in have: continue
                    if SECRETISH.search(json.dumps(m)) or len(json.dumps(m)) > 64000: continue  # the node refuses secret shapes too
                    pool.append(m); have.add(m["id"]); added += 1
                st.d["shared_pool"] = pool[-5000:]; st.save()
            return {"ok": True, "added": added}
        if op == "shared.get":
            since = int(args.get("since", 0) or 0); pool = st.d.get("shared_pool", [])
            return {"ok": True, "manifests": pool[since:since + 200], "next": min(len(pool), since + 200)}
        if op == "ping": return {"node_id": st.d["node_id"], "user": uid, "legacy_shared_key": bool(st.d["users"][uid].get("legacy")), "shared_layer": is_shared(uid), "version": VERSION, "model": False, "shell": False, "ops": list(OPS)}
        if op == "fetch": return tracker_free_fetch(str(args.get("url", "")))
        if op == "job.submit":
            if args.get("kind") != "fetch": return {"ok": False, "error": "job_kind_not_declared"}
            job = {"id": "job-" + secrets.token_hex(6), "user": uid, "kind": "fetch", "args": {"url": str(args.get("url", ""))}, "state": "queued", "submitted": int(time.time())}
            with st.lock: st.d["jobs"] = (st.d["jobs"] + [job])[-200:]; st.save()
            threading.Thread(target=run_job, args=(job,), daemon=True).start(); return {"ok": True, "job": job["id"]}
        if op == "job.status":
            j = next((x for x in st.d["jobs"] if x["id"] == args.get("job") and x.get("user") == uid), None); return {"ok": bool(j), "job": j}
        if op == "job.list": return {"ok": True, "jobs": [{k: x[k] for k in ("id", "kind", "state")} for x in st.d["jobs"] if x.get("user") == uid][-50:]}
        if op == "sync.put":  # Doc 11: store an opaque, already-redacted bundle per device (last 20); the node never interprets records
            b = args.get("bundle") or {}; dev = str(b.get("device", ""))[:64]
            if not dev.startswith("dev-") or not isinstance(b.get("items"), list): return {"ok": False, "error": "bad_bundle"}
            with st.lock:
                sy = st.d["sync"].setdefault(uid, {}); sy[dev] = (sy.get(dev, []) + [b])[-20:]; st.save()
            return {"ok": True, "stored": len(sy[dev])}
        if op == "sync.get":
            me = str(args.get("device", "")); sy = st.d["sync"].get(uid, {})  # a vault user only ever sees its own devices
            return {"ok": True, "bundles": [v[-1] for k, v in sy.items() if k != me and v]}
        return {"ok": False, "error": "op_not_declared"}
    class H(BaseHTTPRequestHandler):
        server_version = VERSION; sys_version = ""
        def log_message(self, fmt, *a): sys.stderr.write("[forge-node] %s %s\n" % (self.command, self.path))  # never logs bodies
        def cors(self):
            self.send_header("Access-Control-Allow-Origin", origin); self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS"); self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true"); self.send_header("Cache-Control", "no-store")
        def do_OPTIONS(self): self.send_response(204); self.cors(); self.end_headers()
        def reply(self, code, obj):
            b = json.dumps(obj).encode(); self.send_response(code); self.cors(); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)
        def do_POST(self):
            if self.path != "/v1/rpc": return self.reply(404, {"error": "not_found"})
            n = int(self.headers.get("Content-Length", "0") or 0)
            if n <= 0 or n > MAX_BODY: return self.reply(413, {"error": "body_size"})
            try:
                env = json.loads(self.rfile.read(n)); ctr = int(env["ctr"])
                uid = str(env.get("id", "")); key = st.key(uid)
                if env.get("v") != 1 or key is None: return self.reply(400, {"error": "unknown_user"})
                pt = json.loads(AESGCM(key).decrypt(unb64(env["iv"]), unb64(env["ct"]), aad("req", uid, ctr)))
            except Exception:
                return self.reply(401, {"error": "unauthenticated"})
            with st.lock:
                u = st.d["users"][uid]
                if ctr <= u["last_ctr"]: return self.reply(409, {"error": "replay"})
                if abs(time.time() - float(pt.get("ts", 0))) > 300: return self.reply(408, {"error": "clock_window"})
                u["last_ctr"] = ctr; st.save()
            op = pt.get("op")
            out = dispatch(op, pt.get("args") or {}, uid) if op in OPS else {"ok": False, "error": "op_not_declared"}
            iv = secrets.token_bytes(12); ct = AESGCM(key).encrypt(iv, json.dumps(out).encode(), aad("resp", uid, ctr))
            self.reply(200, {"v": 1, "ctr": ctr, "iv": b64(iv), "ct": b64(ct)})
    return H

def self_signed(certfile, keyfile, host):
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    import datetime
    k = ec.generate_private_key(ec.SECP256R1()); name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "forge-node")])
    san = [x509.DNSName("localhost")]
    try: san.append(x509.IPAddress(ipaddress.ip_address(host)))
    except ValueError: san.append(x509.DNSName(host))
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(k.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now).not_valid_after(now + datetime.timedelta(days=825)).add_extension(x509.SubjectAlternativeName(san), False).sign(k, hashes.SHA256()))
    open(keyfile, "wb").write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())); os.chmod(keyfile, 0o600)
    open(certfile, "wb").write(cert.public_bytes(serialization.Encoding.PEM))
    return hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest()

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--host", default="0.0.0.0"); ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--origin", required=True, help="exact origin of the Forge Mobile app, e.g. https://forge.example")
    ap.add_argument("--state", default=os.path.expanduser("~/.forge_node.json")); ap.add_argument("--tls", action="store_true", help="serve HTTPS with a generated self-signed certificate")
    ap.add_argument("--advertise", default=None, help="host name/IP the phone should use (default: auto-detected LAN IP)")
    ap.add_argument("--print-pairing", action="store_true", help="print pairing URIs created now and exit")
    ap.add_argument("--add-user", metavar="LABEL", help="create a key for one more Identity-Vault user (shown once as URI/QR)")
    ap.add_argument("--revoke", metavar="UID", help="revoke a vault user's key (also deletes its jobs and sync bundles)")
    ap.add_argument("--list-users", action="store_true")
    ap.add_argument("--add-shared-layer", metavar="LABEL", help="create a SHARED knowledge-layer key (pool of signed manifests only; no private ops)")
    a = ap.parse_args()
    st = State(a.state)
    if a.revoke: print("revoked" if st.revoke(a.revoke) else "no such user"); st.save(); return
    if a.list_users:
        for k, v in st.d["users"].items(): print(k, v["label"], "shared-layer" if (v.get("legacy") or v.get("role") == "shared") else "private")
        return
    if a.add_user: st.add_user(a.add_user); st.save()
    if a.add_shared_layer: u = st.add_user(a.add_shared_layer); st.d["users"][u]["role"] = "shared"; st.save()
    adv = a.advertise or (lambda: (lambda s: (s.connect(("10.255.255.255", 1)), s.getsockname()[0])[1])(socket.socket(socket.AF_INET, socket.SOCK_DGRAM)))()
    scheme = "https" if a.tls else "http"; url = f"{scheme}://{adv}:{a.port}"
    for uid in st.created:  # pairing material is shown only when a user key is created (once per Identity-Vault user)
        uri = f"forge-node:v1?u={urllib.parse.quote(url, safe='')}&id={uid}&k={st.d['users'][uid]['secret']}"
        print("Pairing URI for " + st.d["users"][uid]["label"] + " (show once; treat as a password):\n" + uri)
        try:
            import qrcode; q = qrcode.QRCode(border=1); q.add_data(uri); q.print_ascii(invert=True)
        except ImportError:
            print("(install `qrcode` for a terminal QR code)")
    if not st.created: print(f"{len(st.d['users'])} vault user(s) paired; use --add-user LABEL to pair another Identity-Vault user")
    if a.print_pairing: return
    srv = ThreadingHTTPServer((a.host, a.port), make_handler(st, a.origin))
    if a.tls:
        d = os.path.dirname(a.state) or "."; cf, kf = os.path.join(d, "forge_node_cert.pem"), os.path.join(d, "forge_node_key.pem")
        if not os.path.exists(cf): print("certificate SHA-256:", self_signed(cf, kf, adv))
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(cf, kf); srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    print(f"{VERSION} listening on {url} (origin {a.origin}); no model, no shell. Ctrl-C to stop.")
    srv.serve_forever()

if __name__ == "__main__":
    main()
