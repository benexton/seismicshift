import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { fmtDate } from '../../lib/constants.js';
import LoginGateLfe from './LoginGateLfe.jsx';
import LfeNavGroup from './LfeNavGroup.jsx';
import AccountMenu from './AccountMenu.jsx';

function EventList({ reviewer, signOut, updateName }) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabaseLfe.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) { setLoading(false); return; }
      // Explicit user_id filter: RLS also lets an event admin see every
      // other member's row for events they administer (needed for the
      // admin roster UI), so without this filter an admin of N events
      // would see each event listed once per admin on it, not once.
      const { data, error } = await supabaseLfe
        .from('event_members')
        .select('role, events(id, slug, name, country, event_datetime, status)')
        .eq('user_id', uid);
      setLoading(false);
      if (error) return setErr(error.message);
      const sorted = (data ?? []).filter((m) => m.events).sort((a, b) => {
        const da = a.events.event_datetime ? new Date(a.events.event_datetime).getTime() : -Infinity;
        const db = b.events.event_datetime ? new Date(b.events.event_datetime).getTime() : -Infinity;
        return db - da;
      });
      setMemberships(sorted);
    })();
  }, []);

  return (
    <div className="triage-shell">
      <div className="tabs">
        <LfeNavGroup />
        <span style={{ fontWeight: 600, alignSelf: 'center', marginRight: 6, color: '#cdd6e4' }}>ERP</span>
        <span className="tab-spacer" />
        <AccountMenu reviewer={reviewer} signOut={signOut} updateName={updateName} />
      </div>
      <div className="tab-body">
        <div className="panel-scroll">
          <div className="panel-inner">
            <h1>Your events</h1>
            {loading && <p className="muted">Loading...</p>}
            {err && <p className="err">{err}</p>}
            {!loading && memberships.length === 0 && !err && (
              <p className="muted">You are not assigned to any events yet. Contact your ERP admin.</p>
            )}
            {memberships.length > 0 && (
              <ul className="event-list">
                {memberships.map((m) => (
                  <li key={m.events.id}>
                    <a href={`/erp/triage/?event=${encodeURIComponent(m.events.slug)}`}><b>{m.events.name}</b></a>
                    {m.events.country ? ` - ${m.events.country}` : ''}
                    {m.events.event_datetime ? ` - ${fmtDate(m.events.event_datetime)}` : ''}
                    {' '}<span className="muted small">({m.role})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LfeLanding() {
  return (
    <LoginGateLfe>
      {({ reviewer, signOut, updateName }) => <EventList reviewer={reviewer} signOut={signOut} updateName={updateName} />}
    </LoginGateLfe>
  );
}
