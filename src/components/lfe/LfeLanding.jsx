import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { fmtDate } from '../../lib/constants.js';
import LoginGateLfe from './LoginGateLfe.jsx';

function EventList({ reviewer, signOut }) {
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabaseLfe
        .from('event_members')
        .select('role, events(id, slug, name, country, event_datetime, status)');
      setLoading(false);
      if (error) return setErr(error.message);
      setMemberships((data ?? []).filter((m) => m.events));
    })();
  }, []);

  return (
    <div className="panel-scroll">
      <div className="panel-inner">
        <div className="tabs">
          <a className="signout" href="/lfe/public/">Public view</a>
          <a className="signout" href="/lfe/admin/">Admin</a>
          <span className="tab-spacer" />
          <span>{reviewer}</span>
          <button className="signout" onClick={signOut}>Sign out</button>
        </div>
        <h1>Your events</h1>
        {loading && <p className="muted">Loading...</p>}
        {err && <p className="err">{err}</p>}
        {!loading && memberships.length === 0 && !err && (
          <p className="muted">You are not assigned to any events yet. Contact your LFE admin.</p>
        )}
        <ul>
          {memberships.map((m) => (
            <li key={m.events.id}>
              <a href={`/lfe/triage/?event=${encodeURIComponent(m.events.slug)}`}><b>{m.events.name}</b></a>
              {m.events.country ? ` - ${m.events.country}` : ''}
              {m.events.event_datetime ? ` - ${fmtDate(m.events.event_datetime)}` : ''}
              {' '}<span className="muted small">({m.role})</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function LfeLanding() {
  return (
    <LoginGateLfe>
      {({ reviewer, signOut }) => <EventList reviewer={reviewer} signOut={signOut} />}
    </LoginGateLfe>
  );
}
