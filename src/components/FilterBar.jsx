import {
  CLASSIFICATION_SCORES, DAMAGE_LABEL, OBSERVATION_TYPES, OBSERVATION_LABEL, SOURCE_LABEL,
} from '../lib/constants.js';
import { emptyFilter, filterActive } from '../lib/filter.js';

/**
 * Search + metadata filter controls for a map tab. Controlled by the parent:
 * `filter` holds the state, `setFilter` updates it. Filtering happens in the
 * parent over that tab's own records only.
 */
export default function FilterBar({ filter, setFilter, shown, total, view, setView }) {
  const set = (key) => (e) => setFilter((f) => ({ ...f, [key]: e.target.value }));
  const active = filterActive(filter);

  return (
    <div className="filter-bar">
      <input className="filter-q" type="text" placeholder="Search region, building, address, notes..."
        value={filter.q} onChange={set('q')} />

      <select value={filter.damage} onChange={set('damage')} title="Classification">
        <option value="">Any damage</option>
        {CLASSIFICATION_SCORES.map((s) => <option key={s} value={s}>{DAMAGE_LABEL[s]?.split(' - ')[0]}</option>)}
      </select>

      <select value={filter.obs} onChange={set('obs')} title="Observation type">
        <option value="">Any type</option>
        {OBSERVATION_TYPES.map((t) => <option key={t} value={t}>{OBSERVATION_LABEL[t]}</option>)}
      </select>

      <select value={filter.source} onChange={set('source')} title="Source">
        <option value="">Any source</option>
        {Object.entries(SOURCE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      </select>

      <select value={filter.nonstructural} onChange={set('nonstructural')} title="Non-structural damage">
        <option value="">Non-structural: any</option>
        <option value="yes">Non-structural: yes</option>
        <option value="no">Non-structural: no</option>
      </select>

      {active && <button className="mini" onClick={() => setFilter(emptyFilter)}>Clear</button>}
      <span className="filter-count">{active ? `${shown} of ${total}` : `${total}`}</span>
      {setView && (
        <span className="view-toggle">
          <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map</button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
        </span>
      )}
    </div>
  );
}
