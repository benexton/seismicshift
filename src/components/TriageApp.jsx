import { useState } from 'react';
import LoginGate from './LoginGate.jsx';
import Instructions from './Instructions.jsx';
import ScraperConfig from './ScraperConfig.jsx';
import ManualInput from './ManualInput.jsx';
import TriageMap from './TriageMap.jsx';
import TriagedSites from './TriagedSites.jsx';
import ReportGenerator from './ReportGenerator.jsx';

// Composition root. One client:only island: the Supabase Auth session gates all
// tabs and Leaflet needs window. Full-height flex shell so the layout fills the
// viewport. Opens on Instructions so a new volunteer is oriented first.
const TABS = [
  ['instructions', 'Instructions'],
  ['scraper', 'Scraper keywords'],
  ['manual', 'Manual input'],
  ['triage', 'Triage queue'],
  ['triaged', 'Triaged sites'],
  ['report', 'Report generator'],
];

export default function TriageApp() {
  const [tab, setTab] = useState('instructions');

  return (
    <LoginGate>
      {({ session, signOut }) => {
        const reviewer = session.user?.email ?? session.user?.id ?? 'unknown';
        return (
          <div className="triage-shell">
            <div className="tabs">
              {TABS.map(([id, label]) => (
                <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
              <span className="tab-spacer" />
              <button className="signout" onClick={signOut} title={reviewer}>
                Sign out ({reviewer})
              </button>
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
      }}
    </LoginGate>
  );
}
