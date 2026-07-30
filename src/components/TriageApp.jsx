import { useState } from 'react';
import LoginGate from './LoginGate.jsx';
import TriageMap from './TriageMap.jsx';
import ReportGenerator from './ReportGenerator.jsx';

/**
 * Composition root for the Kumamoto triage hub. Because an authenticated
 * session must gate sibling functionality, everything lives inside a single
 * `client:only="react"` island rather than several independent islands.
 *
 * Tabs: "Triage" (the map queue) and "Report" (team-lead draft generator).
 */
export default function TriageApp() {
  const [tab, setTab] = useState('triage');

  return (
    <LoginGate>
      {({ session, signOut }) => {
        const reviewer = session.user?.email ?? session.user?.id ?? 'unknown';
        return (
          <>
            <div className="tabs">
              <button
                className={tab === 'triage' ? 'active' : ''}
                onClick={() => setTab('triage')}
              >
                Triage queue
              </button>
              <button
                className={tab === 'report' ? 'active' : ''}
                onClick={() => setTab('report')}
              >
                Report generator
              </button>
              <span style={{ flex: 1 }} />
              <button
                onClick={signOut}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#cdd6e4',
                  cursor: 'pointer',
                  padding: '9px 12px',
                }}
                title={reviewer}
              >
                Sign out ({reviewer})
              </button>
            </div>

            {tab === 'triage' ? <TriageMap reviewer={reviewer} /> : <ReportGenerator />}
          </>
        );
      }}
    </LoginGate>
  );
}
