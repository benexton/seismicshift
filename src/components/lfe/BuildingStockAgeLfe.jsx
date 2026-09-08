import { useState } from 'react';
import LoginGateLfe from './LoginGateLfe.jsx';
import LfeNavGroup from './LfeNavGroup.jsx';
import AccountMenu from './AccountMenu.jsx';
import BuildingStockMapLfe from './BuildingStockMapLfe.jsx';
import { COUNTRIES } from '../../lib/buildingStockAge.js';

function Workspace({ reviewer, signOut, updateName }) {
  const [countryCode, setCountryCode] = useState('');
  const country = COUNTRIES.find((c) => c.code === countryCode) ?? null;

  return (
    <div className="triage-shell">
      <div className="tabs">
        <LfeNavGroup />
        <span style={{ fontWeight: 600, alignSelf: 'center', marginRight: 6, color: '#cdd6e4' }}>
          Building stock age
        </span>
        <span className="tab-spacer" />
        <AccountMenu reviewer={reviewer} signOut={signOut} updateName={updateName} />
      </div>
      <div className="tab-body">
        {country ? (
          // A national map needs full width, not the 900px reading-width cap
          // .panel-inner uses elsewhere - same full-bleed pattern the Triage
          // queue's own map view uses (.triage-wrap / .map-area).
          <div className="triage-wrap">
            <div className="bsa-country-bar">
              <label htmlFor="bsa-country">Country</label>
              <select id="bsa-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                <option value="">Select a country...</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div className="map-area">
              <BuildingStockMapLfe key={country.code} country={country} />
            </div>
          </div>
        ) : (
          <div className="panel-scroll">
            <div className="panel-inner">
              <h1>Building stock age</h1>
              <p className="muted">
                National coverage of property titles, colour-coded by seismic design era.
              </p>

              <div className="field" style={{ maxWidth: 280 }}>
                <label htmlFor="bsa-country">Country</label>
                <select id="bsa-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                  <option value="">Select a country...</option>
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BuildingStockAgeLfe() {
  return (
    <LoginGateLfe>
      {({ signOut, reviewer, updateName }) => <Workspace reviewer={reviewer} signOut={signOut} updateName={updateName} />}
    </LoginGateLfe>
  );
}
