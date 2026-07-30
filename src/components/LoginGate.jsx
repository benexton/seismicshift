import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * Wraps protected content. Renders a login form until a Supabase session
 * exists, then renders `children({ session, signOut })`.
 *
 * Enable an auth provider in Supabase (Authentication → Providers). This form
 * uses email + password; swap `signInWithPassword` for `signInWithOtp` if you
 * prefer magic links.
 */
export default function LoginGate({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setErr(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (!ready) return <div className="container">Loading…</div>;

  if (!session) {
    return (
      <div className="login-wrap">
        <div className="card">
          <h2>VERT volunteer sign-in</h2>
          <p className="muted">Kumamoto 2026 triage requires an authenticated account.</p>
          <form onSubmit={signIn}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div style={{ marginTop: 14 }}>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
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

  // Authenticated — hand session + signOut down to the app.
  return children({ session, signOut });
}
