import { useState } from 'react';
import { usePresenceLfe } from '../../lib/usePresenceLfe.js';
import { EventProvider, useEvent } from '../../lib/useEvent.js';
import LoginGateLfe from './LoginGateLfe.jsx';
import LfeNavGroup from './LfeNavGroup.jsx';
import AccountMenu from './AccountMenu.jsx';
import InstructionsLfe from './InstructionsLfe.jsx';
import ScraperConfigLfe from './ScraperConfigLfe.jsx';
import ManualInputLfe from './ManualInputLfe.jsx';
import TriageMapLfe from './TriageMapLfe.jsx';
import TriagedSitesLfe from './TriagedSitesLfe.jsx';
import ReportGeneratorLfe from './ReportGeneratorLfe.jsx';

const TABS = [
  ['instructions', 'Instructions'],
  ['scraper', 'Scraper keywords'],
  ['manual', 'Manual input'],
  ['triage', 'Triage queue'],
  ['triaged', 'Triaged sites'],
  ['report', 'Report generator'],
];

function getEventSlug() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('event') ?? '';
}

// The authenticated, event-scoped workspace. Mounted with a key of the user id
// so a new login always starts fresh on the Manual input tab.
function Workspace({ reviewer, userId, signOut, updateName }) {
  const { event, loading, error } = useEvent();
  const { othersByRecord, setActiveRecord } = usePresenceLfe(event?.id, userId, reviewer);
  const [tab, setTab] = useState('instructions');

  if (loading) return <div className="container">Loading event...</div>;
  if (error || !event) {
    return (
      <div className="container">
        <p className="err">{error || 'Event not found.'}</p>
        <p><a href="/erp/">Back to your events</a></p>
      </div>
    );
  }

  return (
    <div className="triage-shell">
      <div className="tabs">
        <LfeNavGroup />
        <span
          title={event.name}
          style={{
            fontWeight: 600, alignSelf: 'center', marginRight: 6, color: '#cdd6e4',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: 320, display: 'inline-block',
          }}
        >{event.name}</span>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
        <span className="tab-spacer" />
        <AccountMenu reviewer={reviewer} signOut={signOut} updateName={updateName} />
      </div>

      <div className="tab-body">
        {tab === 'instructions' && <InstructionsLfe onGoTo={setTab} />}
        {tab === 'scraper' && <ScraperConfigLfe />}
        {tab === 'manual' && <ManualInputLfe reviewer={reviewer} />}
        {tab === 'triage' && <TriageMapLfe reviewer={reviewer} othersByRecord={othersByRecord} setActiveRecord={setActiveRecord} />}
        {tab === 'triaged' && <TriagedSitesLfe reviewer={reviewer} othersByRecord={othersByRecord} setActiveRecord={setActiveRecord} />}
        {tab === 'report' && <ReportGeneratorLfe reviewer={reviewer} />}
      </div>
    </div>
  );
}

export default function TriageAppLfe() {
  const slug = getEventSlug();
  return (
    <EventProvider slug={slug}>
      <LoginGateLfe>
        {({ session, signOut, reviewer, updateName }) => (
          <Workspace key={session.user?.id} userId={session.user?.id} reviewer={reviewer} signOut={signOut} updateName={updateName} />
        )}
      </LoginGateLfe>
    </EventProvider>
  );
}
