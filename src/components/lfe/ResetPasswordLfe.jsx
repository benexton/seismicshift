import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';

// Landed on via the link in a "Forgot password?" email (LoginGateLfe's
// sendPasswordReset -> supabaseLfe.auth.resetPasswordForEmail). The
// Supabase client already has detectSessionInUrl: true (see
// src/lib/supabaseLfe.js), so arriving here from that link auto-establishes
// a temporary recovery session - this page waits specifically for the
// PASSWORD_RECOVERY auth event (not just "is there a session"), so that
// someone who already has an ordinary signed-in session (e.g. a shared
// device, or a stale browser tab) can't reach the "set new password" form
// just by navigating to this URL directly - that would silently let them
// change the current account's password with no re-authentication.
export default function ResetPasswordLfe() {
  const [ready, setReady] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabaseLfe.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      setReady(true);
    });
    // If the URL never carried a recovery token at all, no auth event fires
    // for it - without this fallback the page would show "Loading..."
    // forever instead of the "expired or invalid" state.
    const timer = setTimeout(() => setReady(true), 3000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timer); };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (newPw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setErr('Passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabaseLfe.auth.updateUser({ password: newPw });
    if (error) { setBusy(false); setErr(error.message); return; }
    // Sign out of the temporary recovery session rather than leaving the
    // device signed in - the recovery link is single-purpose (set a new
    // password), not meant to double as a "log me in" link.
    await supabaseLfe.auth.signOut();
    setBusy(false);
    setDone(true);
  }

  if (!ready) return <div className="container">Loading...</div>;

  if (done) {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>Password updated</h2>
          <p className="muted">You can now sign in with your new password.</p>
          <p><a href="/erp/">Sign in</a></p>
        </div>
      </div>
    );
  }

  if (!isRecovery) {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>Reset link expired or invalid</h2>
          <p className="muted">
            This link may have already been used, or has expired. Go back to the
            sign-in page and click "Forgot password?" again for a fresh one.
          </p>
          <p><a href="/erp/">Back to sign in</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="card">
        <h2>Set a new password</h2>
        <form onSubmit={submit}>
          <label htmlFor="new-pw">New password</label>
          <input id="new-pw" type="password" autoComplete="new-password" value={newPw}
            onChange={(e) => setNewPw(e.target.value)} required minLength={6} />
          <label htmlFor="confirm-pw">Confirm new password</label>
          <input id="confirm-pw" type="password" autoComplete="new-password" value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)} required minLength={6} />
          <div style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save password'}</button>
          </div>
          {err && <p className="err">{err}</p>}
        </form>
      </div>
    </div>
  );
}
