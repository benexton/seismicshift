import {
  CLASSIFICATION_SCORES, DAMAGE_LABEL, CODE_ERAS, RETROFIT_OPTIONS,
  OBSERVATION_TYPES, OBSERVATION_LABEL, LOCATION_CONFIDENCE,
  BUILDING_TYPES, PRIMARY_MATERIALS, HEIGHT_CLASSES, cap,
} from '../lib/constants.js';

/**
 * The full set of editable attribute fields for a record, shared by the triage
 * review panel and the triaged-site detail panel so both offer the same
 * editing. `v` is the values object; `set(key)` returns an onChange handler.
 */
export default function RecordFields({ v, set }) {
  const isBuilding = (v.observation_type ?? 'building') === 'building';
  return (
    <>
      <div className="field">
        <label>Observation type</label>
        <select value={v.observation_type ?? 'building'} onChange={set('observation_type')}>
          {OBSERVATION_TYPES.map((t) => <option key={t} value={t}>{OBSERVATION_LABEL[t]}</option>)}
        </select>
      </div>

      <div className="field">
        <label>Damage / classification</label>
        <select value={v.damage_score ?? 0} onChange={set('damage_score')}>
          {CLASSIFICATION_SCORES.map((s) => <option key={s} value={s}>{DAMAGE_LABEL[s]}</option>)}
        </select>
      </div>

      {isBuilding && (
        <>
          <div className="field">
            <label>Building name</label>
            <input type="text" value={v.building_name ?? ''} onChange={set('building_name')} />
          </div>
          <div className="field">
            <label>Building type</label>
            <select value={v.building_type ?? ''} onChange={set('building_type')}>
              <option value="">-</option>
              {BUILDING_TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Primary material</label>
            <select value={v.primary_material ?? ''} onChange={set('primary_material')}>
              <option value="">-</option>
              {PRIMARY_MATERIALS.map((m) => <option key={m} value={m}>{cap(m)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Height class</label>
            <select value={v.height_class ?? ''} onChange={set('height_class')}>
              <option value="">-</option>
              {HEIGHT_CLASSES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Seismic-code era</label>
            <select value={v.code_era ?? 'unknown'} onChange={set('code_era')}>
              {CODE_ERAS.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Observed retrofits</label>
            <select value={v.observed_retrofits ?? 'none'} onChange={set('observed_retrofits')}>
              {RETROFIT_OPTIONS.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="field">
        <label>{isBuilding ? 'Failure mechanism' : 'Mechanism / feature'}</label>
        <input type="text" value={v.failure_mechanism ?? ''} onChange={set('failure_mechanism')} />
      </div>
      <div className="field">
        <label>Address</label>
        <input type="text" value={v.address ?? ''} onChange={set('address')} />
      </div>
      <div className="field">
        <label>Location confidence</label>
        <select value={v.location_confidence ?? ''} onChange={set('location_confidence')}>
          <option value="">-</option>
          {LOCATION_CONFIDENCE.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="check-label">
          <input type="checkbox" checked={!!v.nonstructural_damage}
            onChange={(e) => set('nonstructural_damage')({ target: { value: e.target.checked } })} />
          Damage to non-structural elements?
        </label>
      </div>
    </>
  );
}

// The record columns RecordFields edits (used when persisting).
export const EDITABLE_KEYS = [
  'observation_type', 'damage_score', 'building_name', 'building_type',
  'primary_material', 'height_class', 'code_era', 'observed_retrofits',
  'failure_mechanism', 'address', 'location_confidence',
];

// Build a DB patch from a values object, coercing types and nulling blanks.
export function fieldsPatch(v) {
  const isBuilding = (v.observation_type ?? 'building') === 'building';
  const orNull = (x) => (x === '' || x === undefined ? null : x);
  return {
    observation_type: v.observation_type ?? 'building',
    damage_score: Number(v.damage_score),
    failure_mechanism: orNull(v.failure_mechanism),
    address: orNull(v.address),
    location_confidence: orNull(v.location_confidence),
    building_name: isBuilding ? orNull(v.building_name) : null,
    building_type: isBuilding ? orNull(v.building_type) : null,
    primary_material: isBuilding ? orNull(v.primary_material) : null,
    height_class: isBuilding ? orNull(v.height_class) : null,
    code_era: isBuilding ? orNull(v.code_era) : null,
    observed_retrofits: isBuilding ? orNull(v.observed_retrofits) : null,
    nonstructural_damage: !!v.nonstructural_damage,
  };
}
