/* app_account.js — minimal Account card (sign in by email, forgot/reset password, status, register device, sign out). UI only; talks to the backend
 * exclusively through window.KSb (sb_sync.js). Signing in never changes answers: the reasoning core does not read the backend. */
(function () {
  if (!window.KSb || !window.KUI || !window.forge) return; const { $, esc } = window.KUI; const forge = window.forge; const SB = window.KSb; const SB_MIN = (window.KSbSync && window.KSbSync.PW_MIN) || 8;
  const H = (t, b) => '<div class="card"><div class="cardhead">' + t + '</div>' + b + '</div>';
  let note = '', recovering = false;
  function render() { let host = $('#acctBody'); const x = $('#xBody'); if (!host) { if (!x) return; x.insertAdjacentHTML('beforebegin', '<div id="acctBody"></div>'); host = $('#acctBody'); }
    const s = SB.status();
    host.innerHTML = H('Account <span class="pill">optional · storage and sync only · never used for answers</span>',
      (recovering && s.signedIn
        ? '<div class="small">Set a new password for <b>' + esc(s.email || '') + '</b>.</div>' +
          '<form id="acNewPw" class="row"><input id="acPw1" type="password" autocomplete="new-password" aria-label="new password" placeholder="new password (' + SB_MIN + '+ characters)"><input id="acPw2" type="password" autocomplete="new-password" aria-label="repeat new password" placeholder="repeat"><button>Set new password</button></form>'
        : s.signedIn
        ? '<div class="small">Signed in as <b>' + esc(s.email || '') + '</b>. Device key: ' + (s.device ? '<code>' + esc(s.device) + '</code> registered' : 'not registered') + '.</div>' +
          (s.deviceRedo && !s.device ? '<div class="small"><b>The vault was reset:</b> register this device again (unlock the new vault first).</div>' : '') + '<div class="row">' + (s.device ? '' : '<button id="acRegister">' + (s.deviceRedo ? 'Register this device again' : 'Register this device') + '</button>') + '<button id="acOut">Sign out</button></div>'
        : '<div class="small">Sign in with a one-time email link. Your vault, keys and private notes stay on this phone.</div>' +
          '<form id="acForm" class="row"><input id="acEmail" type="email" autocomplete="email" aria-label="email address" placeholder="email address"><button>Email me a sign-in link</button><button type="button" id="acForgot">Forgot password</button></form>') +
      '<div class="small" id="acMsg" role="status">' + esc(note) + '</div>');
    const f = $('#acForm'); if (f) f.onsubmit = async e => { e.preventDefault(); const r = await SB.signIn($('#acEmail').value); note = r.ok ? 'Check ' + r.sent_to + ' for the sign-in link.' : 'Could not send: ' + (r.error || r.rule); render(); };
    const fg = $('#acForgot'); if (fg) fg.onclick = async () => { const r = await SB.resetPassword($('#acEmail').value); note = r.ok ? 'Check ' + r.sent_to + ' for the password reset link; open it on this phone.' : 'Could not send: ' + (r.error || r.rule); render(); };
    const np = $('#acNewPw'); if (np) np.onsubmit = async e => { e.preventDefault(); const a = $('#acPw1').value, b = $('#acPw2').value; $('#acPw1').value = $('#acPw2').value = '';
      if (a !== b) { note = 'The two entries differ.'; return render(); } const r = await SB.updatePassword(a); if (r.ok) recovering = false; note = r.ok ? 'Password updated.' : 'Not updated: ' + (r.error || r.rule); render(); };
    const o = $('#acOut'); if (o) o.onclick = async () => { await SB.signOut(); note = 'Signed out.'; render(); };
    const g = $('#acRegister'); if (g) g.onclick = async () => { const r = await SB.registerDevice((uid, nonce) => forge.signer.deviceProof(uid, nonce)); note = r.ok ? 'Device registered.' : 'Not registered: ' + r.rule; render(); };
  }
  SB.handleCallback().then(r => { if (r.callback) { recovering = !!(r.ok && r.recovery); note = r.ok ? (recovering ? 'Password reset link accepted for ' + r.email + '.' : 'Signed in as ' + r.email + '.') : 'Sign-in failed: ' + (r.error || r.rule); } render(); }).catch(() => render());
  window.renderAccount = render; const prev = window.renderExtra; window.renderExtra = function () { if (prev) prev(); render(); }; render();
})();
