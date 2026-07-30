import { useState } from 'react';
import LoginGate from './LoginGate.jsx';
import Instructions from './Instructions.jsx';
import ScraperConfig from './ScraperConfig.jsx';
import ManualInput from './ManualInput.jsx';
import TriageMap from './TriageMap.jsx';
import TriagedSites from './TriagedSites.jsx';
import ReportGenerator from './ReportGenerator.jsx';

const TABS = [
  ['instructions', 'Instructions'],
  ['scraper', 'Scraper keywords'],
  ['manual', 'Manual input'],
  ['triage', 'Triage queue'],
  ['triaged', 'Triaged sites'],
  ['report', 'Report generator'],
];

// The authenticated workspace. Mounted with a key of the user id so a new login
// always starts fresh on the Instructions tab.
function Workspace({ reviewer, signOut, updateName }) {
  const [tab, setTab] = useState('instructions');
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(reviewer);

  async function saveName() {
    await updateName(nameDraft);
    setEditingName(false);
  }

  return (
    <div className="triage-shell">
      <div className="tabs">
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
        {tab === 'instructions' && <Instructions onGoTo={setTab} />}
        {tab === 'scraper' && <ScraperConfig />}
        {tab === 'manual' && <ManualInput reviewer={reviewer} />}
        {tab === 'triage' && <TriageMap reviewer={reviewer} />}
        {tab === 'triaged' && <TriagedSites reviewer={reviewer} />}
        {tab === 'report' && <ReportGenerator reviewer={reviewer} />}
      </div>
    </div>
  );
}

export default function TriageApp() {
  return (
    <LoginGate>
      {({ session, signOut, reviewer, updateName }) => (
        <Workspace key={session.user?.id} reviewer={reviewer} signOut={signOut} updateName={updateName} />
      )}
    </LoginGate>
  );
}
