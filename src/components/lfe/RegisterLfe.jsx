import { useState } from 'react';
import { supabaseLfe, edgeFunctionErrorMessage } from '../../lib/supabaseLfe.js';

// Self-service registration, gated by the invited_emails allowlist an admin
// populates via the "Add new users" admin tab. Two steps: check the email
// against that allowlist (check_invite_status, callable while signed out),
// then - only if invited - collect a display name and password and hand
// them to the register-lfe-user Edge Function, which is the only thing that
// can actually create the account (public signup is disabled in the Auth
// dashboard, so calling supabaseLfe.auth.signUp() directly would not work).
export default function RegisterLfe() {
  const [step, setStep] = useState('email'); // 'email' | 'details' | 'done'
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // 'not_invited' | 'already_registered' | null
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function checkEmail(e) {
    e.preventDefault();
    setErr(''); setStatus(null);
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    const { data, error } = await supabaseLfe.rpc('check_invite_status', { p_email: trimmed });
    setBusy(false);
    if (error) return setErr(error.message);
    if (data === 'invited') { setStep('details'); return; }
    setStatus(data);
  }

  async function register(e) {
    e.preventDefault();
    setErr('');
    if (password.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setErr('Passwords do not match.'); return; }
    if (!displayName.trim()) { setErr('Display name is required.'); return; }
    setBusy(true);
    const { data, error } = await supabaseLfe.functions.invoke('register-lfe-user', {
      body: { email: email.trim(), password, display_name: displayName.trim() },
    });
    if (error) {
      setBusy(false);
      setErr(edgeFunctionErrorMessage(error));
      return;
    }
    if (data?.error) {
      setBusy(false);
      setErr(data.error);
      return;
    }
    const { error: signInErr } = await supabaseLfe.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInErr) {
      // Account was created fine - just couldn't auto-sign-in for some
      // reason. Send them to the regular sign-in form rather than stalling.
      setStep('done');
      return;
    }
    window.location.href = '/erp/';
  }

  if (step === 'details') {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>Complete your registration</h2>
          <p className="muted">{email.trim()} is invited. Choose a display name and password to finish.</p>
          <form onSubmit={register}>
            <label htmlFor="dn">Display name</label>
            <input id="dn" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Jane Smith (NZSEE)" required />
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <label htmlFor="cpw">Confirm password</label>
            <input id="cpw" type="password" autoComplete="new-password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            <div style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
            </div>
            {err && <p className="err">{err}</p>}
          </form>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>Account created</h2>
          <p className="muted">Your account is ready.</p>
          <p><a href="/erp/">Sign in</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="card">
        <h2>Register for ERP access</h2>
        <p className="muted">Enter the email your ERP admin invited.</p>
        <form onSubmit={checkEmail}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" value={email}
            onChange={(e) => { setEmail(e.target.value); setStatus(null); }} required />
          <div style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? 'Checking...' : 'Continue'}</button>
          </div>
          {status === 'not_invited' && (
            <p className="err">This email hasn't been invited. Contact your ERP admin to be added.</p>
          )}
          {status === 'already_registered' && (
            <p className="err">This email already has an account. <a href="/erp/">Sign in instead</a>.</p>
          )}
          {err && <p className="err">{err}</p>}
        </form>
        <p className="hint">Already have an account? <a href="/erp/">Sign in</a>.</p>
      </div>
    </div>
  );
}
