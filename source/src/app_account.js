/* app_account.js — minimal Account card (sign in by email, status, register device, sign out). UI only; talks to the backend
 * exclusively through window.KSb (sb_sync.js). Signing in never changes answers: the reasoning core does not read the backend. */
(function () {
  if (!window.KSb || !window.KUI || !window.forge) return; const { $, esc } = window.KUI; const forge = window.forge; const SB = window.KSb;
  const H = (t, b) => '<div class="card"><div class="cardhead">' + t + '</div>' + b + '</div>';
  let note = '';
  function render() { let host = $('#acctBody'); const x = $('#xBody'); if (!host) { if (!x) return; x.insertAdjacentHTML('beforebegin', '<div id="acctBody"></div>'); host = $('#acctBody'); }
    const s = SB.status();
    host.innerHTML = H('Account <span class="pill">optional · storage and sync only · never used for answers</span>',
      (s.signedIn
        ? '<div class="small">Signed in as <b>' + esc(s.email || '') + '</b>. Device key: ' + (s.device ? '<code>' + esc(s.device) + '</code> registered' : 'not registered') + '.</div>' +
          '<div class="row">' + (s.device ? '' : '<button id="acRegister">Register this device</button>') + '<button id="acOut">Sign out</button></div>'
        : '<div class="small">Sign in with a one-time email link. Your vault, keys and private notes stay on this phone.</div>' +
          '<form id="acForm" class="row"><input id="acEmail" type="email" autocomplete="email" aria-label="email address" placeholder="email address"><button>Email me a sign-in link</button></form>') +
      '<div class="small" id="acMsg" role="status">' + esc(note) + '</div>');
    const f = $('#acForm'); if (f) f.onsubmit = async e => { e.preventDefault(); const r = await SB.signIn($('#acEmail').value); note = r.ok ? 'Check ' + r.sent_to + ' for the sign-in link.' : 'Could not send: ' + (r.error || r.rule); render(); };
    const o = $('#acOut'); if (o) o.onclick = async () => { await SB.signOut(); note = 'Signed out.'; render(); };
    const g = $('#acRegister'); if (g) g.onclick = async () => { const r = await SB.registerDevice((uid, nonce) => forge.signer.deviceProof(uid, nonce)); note = r.ok ? 'Device registered.' : 'Not registered: ' + r.rule; render(); };
  }
  SB.handleCallback().then(r => { if (r.callback) note = r.ok ? 'Signed in as ' + r.email + '.' : 'Sign-in failed: ' + (r.error || r.rule); render(); }).catch(() => render());
  window.renderAccount = render; const prev = window.renderExtra; window.renderExtra = function () { if (prev) prev(); render(); }; render();
})();
