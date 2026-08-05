import { useState } from 'react';
import { usePresenceLfe } from '../../lib/usePresenceLfe.js';
import { EventProvider, useEvent } from '../../lib/useEvent.js';
import LoginGateLfe from './LoginGateLfe.jsx';
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(reviewer);

  async function saveName() {
    await updateName(nameDraft);
    setEditingName(false);
  }

  if (loading) return <div className="container">Loading event...</div>;
  if (error || !event) {
    return (
      <div className="container">
        <p className="err">{error || 'Event not found.'}</p>
        <p><a href="/lfe/">Back to your events</a></p>
      </div>
    );
  }

  return (
    <div className="triage-shell">
      <div className="tabs">
        <span className="navgroup">
          <a className="navlink" href="/lfe/">← All events</a>
          <a className="navlink" href="/lfe/public/">Public view</a>
        </span>
        <span style={{ fontWeight: 600, alignSelf: 'center', margin: '0 6px' }}>{event.name}</span>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
        <span className="tab-spacer" />
        {editingName ? (
          <span className="name-edit">
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }} autoFocus />
            <button className="mini" onClick={saveName}>Save</button>
          </span>
        ) : (
          <button className="signout" onClick={() => { setNameDraft(reviewer); setEditingName(true); }} title="Edit display name">
            {reviewer} (edit)
          </button>
        )}
        <button className="signout" onClick={signOut}>Sign out</button>
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
