import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import {
  CLASSIFICATION_SCORES, DAMAGE_LABEL, CODE_ERAS, RETROFIT_OPTIONS,
  OBSERVATION_TYPES, OBSERVATION_LABEL, LOCATION_CONFIDENCE,
  BUILDING_TYPES, PRIMARY_MATERIALS, HEIGHT_CLASSES, TYPE_DETAIL_FIELDS,
  withCurrentOption, cap,
} from '../../lib/constantsLfe.js';

/**
 * The full set of editable attribute fields for a record, shared by the triage
 * review panel and the triaged-site detail panel so both offer the same
 * editing (and the same field order). `v` is the values object; `set(key)`
 * returns an onChange handler. `country` is the record's event's country (see
 * country_code_entries), used to derive the code-era bucket from `year_built`.
 * `lat`/`lng`/`onLatChange`/`onLngChange`/`movedLocation` are lifted from the
 * parent modal (which owns that state, since saving it triggers a separate
 * move_observation RPC) but rendered here so the coordinates and the
 * historical-imagery link sit in the right place in the field order.
 * `isManual` suppresses hints that only apply to AI-triaged records (e.g. the
 * region field's "AI's first guess" note - a manual entry has no AI guess).
 *
 * Observation type is multi-select (a record can tick more than one
 * category), so it renders as a checkbox group instead of a single dropdown,
 * and each ticked type (other than building/other) gets its own small detail
 * fields from TYPE_DETAIL_FIELDS, stored in the type_details jsonb column.
 */
export default function RecordFieldsLfe({ v, set, country, lat, lng, onLatChange, onLngChange, movedLocation, isManual }) {
  // Debounced: code_era_for() is a DB round-trip (it joins country_code_entries),
  // not worth firing on every keystroke. The dependency on `country` re-derives
  // if the record's event context ever changes underneath this component.
  // Auto-fills code_era with the result (still freely editable afterward -
  // this only re-fires, and re-fills, when year_built itself changes again).
  const [computedEra, setComputedEra] = useState(null);
  const [eraLoading, setEraLoading] = useState(false);
  useEffect(() => {
    const year = Number(v.year_built);
    const valid = !!v.year_built && Number.isFinite(year);
    let cancelled = false;
    // Every setState call here happens inside this setTimeout callback -
    // genuinely deferred relative to the effect's own synchronous body,
    // rather than called directly in it - including the "reset" branch, so
    // this is "subscribe to an external (debounced) result" rather than the
    // disallowed synchronous-setState-in-effect-body pattern.
    const timer = setTimeout(async () => {
      if (!valid) {
        if (!cancelled) { setComputedEra(null); setEraLoading(false); }
        return;
      }
      setEraLoading(true);
      const { data, error } = await supabaseLfe.rpc('code_era_for', { p_country: country, p_year: year });
      if (!cancelled) {
        setComputedEra(error ? null : data);
        setEraLoading(false);
        if (!error && data) set('code_era')({ target: { value: data } });
      }
    }, valid ? 400 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.year_built, country]);

  // The full set of valid era buckets for this country (not just the one
  // matching year_built) - populates a constrained dropdown below instead of
  // free text, so this column doesn't end up full of one-off variants across
  // records for the same country. Fetched once per country, independently of
  // year_built - a reviewer can pick manually even without using the
  // historical-imagery pathway.
  const [eraBuckets, setEraBuckets] = useState([]);
  useEffect(() => {
    let cancelled = false;
    supabaseLfe.rpc('code_era_buckets_for', { p_country: country }).then(({ data, error }) => {
      if (!cancelled) setEraBuckets(error ? [] : (data ?? []));
    });
    return () => { cancelled = true; };
  }, [country]);

  const types = v.observation_types ?? ['building'];
  const isBuilding = types.includes('building');
  const isLifeline = types.includes('lifeline');
  const showConstructionDate = isBuilding || isLifeline;
  const typeDetails = v.type_details ?? {};

  // Coordinates only, never anything scraper/user-supplied - no safeHref
  // guard needed. The data= suffix is Google Earth Web's opaque (protobuf)
  // flag for Historical Imagery mode - it is location-independent (verified
  // against two unrelated coordinates), so it can be appended as-is to any
  // @lat,lng,... camera position.
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const historicalImageryUrl = showConstructionDate && Number.isFinite(latNum) && Number.isFinite(lngNum)
    ? `https://earth.google.com/web/@${latNum},${lngNum},50a,300d,35y,0h,0t,0r/data=CgwqBggBEgAYAUICCAE6AwoBMEICCABKDQj___________8BEAA`
    : null;

  function toggleType(t) {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    set('observation_types')({ target: { value: next.length ? next : [t] } });
  }

  function setTypeDetail(type, key) {
    return (e) => {
      const next = { ...typeDetails, [type]: { ...(typeDetails[type] ?? {}), [key]: e.target.value } };
      set('type_details')({ target: { value: next } });
    };
  }

  return (
    <>
      <div className="field">
        <label>Observation type (tick all that apply)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OBSERVATION_TYPES.map((t) => (
            <label key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} style={{ width: 'auto', flexShrink: 0, marginTop: 3 }} />
              <span>{OBSERVATION_LABEL[t]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Damage / classification</label>
        <select value={v.damage_score ?? 0} onChange={set('damage_score')}>
          {CLASSIFICATION_SCORES.map((s) => <option key={s} value={s}>{DAMAGE_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="field">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!v.nonstructural_damage}
            onChange={(e) => set('nonstructural_damage')({ target: { value: e.target.checked } })}
            style={{ width: 'auto', flexShrink: 0 }} />
          <span>Damage to non-structural elements?</span>
        </label>
      </div>

      <div className="field latlng">
        <div><label>Latitude</label><input type="number" step="0.00001" value={lat} onChange={onLatChange} /></div>
        <div><label>Longitude</label><input type="number" step="0.00001" value={lng} onChange={onLngChange} /></div>
      </div>
      {movedLocation && <p className="muted small">Coordinates edited; will be saved as exact.</p>}

      <div className="field">
        <label>Location confidence</label>
        <select value={v.location_confidence ?? ''} onChange={set('location_confidence')}>
          <option value="">-</option>
          {LOCATION_CONFIDENCE.map((c) => <option key={c} value={c}>{cap(c)}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Address</label>
        <input type="text" value={v.address ?? ''} onChange={set('address')} />
      </div>
      <div className="field">
        <label>Region</label>
        <input type="text" value={v.region ?? ''} onChange={set('region')} />
        {!isManual && (
          <span className="muted small">
            Feeds the report's region groupings and headings - keep it in English (the
            AI's first guess occasionally comes through in the local language).
          </span>
        )}
      </div>

      {showConstructionDate && (
        <>
          {historicalImageryUrl && (
            <p className="kv">
              After confirming the latitude and longitude above, click the Google Earth link here and use
              the slider to work out when the structure was built - enter that year into the Year built box
              beneath. It's then automatically cross-referenced against this country's own timeline in the{' '}
              <b>Codes &amp; standards</b> tab to suggest a Seismic-code era in the box after that.{' '}
              <a href={historicalImageryUrl} target="_blank" rel="noreferrer">
                Check historical imagery (Google Earth)
              </a>
            </p>
          )}
          <div className="field">
            <label>Year built (approx.)</label>
            <input
              type="number" min="1800" max={new Date().getFullYear()}
              value={v.year_built ?? ''} onChange={set('year_built')} placeholder="e.g. 2005"
            />
          </div>
          <div className="field">
            <label>Seismic-code era</label>
            <select value={v.code_era ?? 'unknown'} onChange={set('code_era')}>
              {withCurrentOption(eraBuckets.length ? ['unknown', ...eraBuckets] : CODE_ERAS, v.code_era)
                .map((c) => <option key={c} value={c}>{cap(c)}</option>)}
            </select>
            {eraLoading && <span className="muted small">Calculating from year built...</span>}
            {!eraLoading && computedEra && (
              <span className="muted small">Auto-selected from year built - change it above if you disagree.</span>
            )}
            {!eraLoading && v.year_built && !eraBuckets.length && (
              <span className="muted small">No code timeline recorded for this country yet - set the era manually for now.</span>
            )}
          </div>
        </>
      )}

      {types.filter((t) => TYPE_DETAIL_FIELDS[t]).map((t) => (
        <div key={t} style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
          <div className="fld-label">{OBSERVATION_LABEL[t]} details</div>
          {TYPE_DETAIL_FIELDS[t].map(([key, label, options]) => (
            <div className="field" key={key}>
              <label>{label}</label>
              {options ? (
                <select value={typeDetails[t]?.[key] ?? ''} onChange={setTypeDetail(t, key)}>
                  <option value="">-</option>
                  {options.map((o) => <option key={o} value={o}>{cap(o)}</option>)}
                </select>
              ) : (
                <input type="text" value={typeDetails[t]?.[key] ?? ''} onChange={setTypeDetail(t, key)} />
              )}
            </div>
          ))}
        </div>
      ))}

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
    </>
  );
}

// The record columns RecordFieldsLfe edits (used when persisting).
export const EDITABLE_KEYS = [
  'observation_types', 'damage_score', 'building_name', 'building_type',
  'primary_material', 'height_class', 'code_era', 'year_built', 'observed_retrofits',
  'failure_mechanism', 'region', 'address', 'location_confidence', 'type_details',
];

// Build a DB patch from a values object, coercing types and nulling blanks.
export function fieldsPatch(v) {
  const types = v.observation_types?.length ? v.observation_types : ['building'];
  const isBuilding = types.includes('building');
  const isLifeline = types.includes('lifeline');
  const orNull = (x) => (x === '' || x === undefined ? null : x);
  const yearOrNull = (x) => (x === '' || x === undefined || x === null || !Number.isFinite(Number(x)) ? null : Number(x));
  // Only keep type_details for types still ticked, so un-ticking a type
  // drops its stale detail fields instead of leaving them orphaned.
  const typeDetails = Object.fromEntries(
    Object.entries(v.type_details ?? {}).filter(([t]) => types.includes(t))
  );
  return {
    observation_types: types,
    damage_score: Number(v.damage_score),
    failure_mechanism: orNull(v.failure_mechanism),
    region: orNull(v.region),
    address: orNull(v.address),
    location_confidence: orNull(v.location_confidence),
    building_name: isBuilding ? orNull(v.building_name) : null,
    building_type: isBuilding ? orNull(v.building_type) : null,
    primary_material: isBuilding ? orNull(v.primary_material) : null,
    height_class: isBuilding ? orNull(v.height_class) : null,
    code_era: (isBuilding || isLifeline) ? orNull(v.code_era) : null,
    year_built: (isBuilding || isLifeline) ? yearOrNull(v.year_built) : null,
    observed_retrofits: isBuilding ? orNull(v.observed_retrofits) : null,
    nonstructural_damage: !!v.nonstructural_damage,
    type_details: typeDetails,
  };
}
