import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { fmtDate } from '../../lib/constantsLfe.js';

// Populates public.invited_emails - the allowlist self-service registration
// (RegisterLfe.jsx, at /erp/register/) checks against. This is deliberately
// separate from ProvisionUsersPanel: this tab is about who is ALLOWED to
// create an account at all, ProvisionUsersPanel is about what an account
// that already exists can access. A freshly-registered user still has to be
// added to an event (or granted platform admin) there afterward, same as
// today.
export default function InviteUsersPanel() {
  const [invited, setInvited] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [emails, setEmails] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function loadInvited() {
    setLoading(true); setErr('');
    const { data, error } = await supabaseLfe.rpc('list_invited_emails');
    setLoading(false);
    if (error) return setErr(error.message);
    setInvited(data ?? []);
  }

  useEffect(() => { loadInvited(); }, []);

  async function addEmails() {
    const list = [...new Set(emails.split(',').map((e) => e.trim()).filter(Boolean))];
    if (!list.length) return;
    setBusy(true); setResult(null); setErr('');
    const { data, error } = await supabaseLfe.rpc('add_invited_emails', { p_emails: list });
    setBusy(false);
    if (error) return setErr(error.message);
    const added = (data ?? []).filter((r) => r.status === 'added').map((r) => r.email);
    const alreadyInvited = (data ?? []).filter((r) => r.status === 'already_invited').map((r) => r.email);
    const alreadyRegistered = (data ?? []).filter((r) => r.status === 'already_registered').map((r) => r.email);
    setResult({ added, alreadyInvited, alreadyRegistered });
    setEmails('');
    loadInvited();
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Add new users</h2>
      <p className="muted small">
        Invited emails can self-register at <code>/erp/register/</code> to create their own account
        (email, display name, password). They still need adding to an event - or granted platform
        admin - via Provision users afterward; being invited by itself grants no access.
      </p>

      <div className="field">
        <label>Emails to invite (comma-separated)</label>
        <div className="link-add">
          <input type="text" value={emails} onChange={(e) => setEmails(e.target.value)}
            placeholder="a@example.com, b@example.com, c@example.com" style={{ flex: 1 }} />
          <button type="button" className="mini" onClick={addEmails} disabled={busy || !emails.trim()}>
            {busy ? 'Adding...' : 'Add invites'}
          </button>
        </div>
        <span className="muted small">
          Matched case-insensitively and stored lowercased, so "Jane@Example.com" and
          "jane@example.com" are treated as the same address.
        </span>
        {result && (
          <p className="status-line small" style={{ marginTop: 6 }}>
            {result.added.length > 0 && <>Invited: {result.added.join(', ')}. </>}
            {result.alreadyInvited.length > 0 && <>Already invited, unchanged: {result.alreadyInvited.join(', ')}. </>}
            {result.alreadyRegistered.length > 0 && <>Already has an account: {result.alreadyRegistered.join(', ')}.</>}
          </p>
        )}
      </div>
      {err && <p className="status-line err">{err}</p>}

      <h3 style={{ fontSize: 14 }}>Current invites</h3>
      {loading ? <p className="muted">Loading...</p> : (
        <table className="record-table">
          <thead><tr><th>Email</th><th>Invited</th><th>Status</th></tr></thead>
          <tbody>
            {invited.map((row) => (
              <tr key={row.email}>
                <td>{row.email}</td>
                <td>{fmtDate(row.invited_at)}</td>
                <td>{row.registered_at ? `Registered ${fmtDate(row.registered_at)}` : 'Pending'}</td>
              </tr>
            ))}
            {invited.length === 0 && <tr><td colSpan={3} className="muted">No invites yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
