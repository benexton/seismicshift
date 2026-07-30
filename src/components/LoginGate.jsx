import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

function displayNameOf(session) {
  const m = session?.user?.user_metadata ?? {};
  return (m.display_name || m.full_name || m.name || '').trim();
}

/**
 * Wraps protected content. Shows a login form until a Supabase session exists,
 * then ensures the volunteer has a display name (used for all tracking, not
 * their email), then renders children({ session, signOut, reviewer, updateName }).
 */
export default function LoginGate({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  }

  async function signOut() { await supabase.auth.signOut(); }

  async function updateName(name) {
    const clean = (name ?? '').trim();
    if (!clean) return;
    const { error } = await supabase.auth.updateUser({ data: { display_name: clean } });
    if (error) setErr(error.message);
  }

  if (!ready) return <div className="container">Loading...</div>;

  if (!session) {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>VERT volunteer sign-in</h2>
          <p className="muted">Kumamoto 2026 triage requires an authenticated account.</p>
          <form onSubmit={signIn}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email}
              onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
            <div style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
            </div>
            {err && <p className="err">{err}</p>}
          </form>
          <p className="hint">
            Accounts are provisioned by the VERT coordinator in Supabase. Contact
            your team lead if you need access.
          </p>
        </div>
      </div>
    );
  }

  const displayName = displayNameOf(session);

  if (!displayName) {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>Set your display name</h2>
          <p className="muted">
            This name is recorded against everything you review or submit, instead
            of your email. You can change it later.
          </p>
          <label htmlFor="dn">Display name</label>
          <input id="dn" type="text" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
            placeholder="e.g. Jane Smith (NZSEE)" />
          <div style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => updateName(nameDraft)} disabled={!nameDraft.trim()}>Save and continue</button>
          </div>
          {err && <p className="err">{err}</p>}
        </div>
      </div>
    );
  }

  return children({ session, signOut, reviewer: displayName, updateName });
}
