import { useState } from 'react';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import {
  DAMAGE_LABEL, OBSERVATION_LABEL, HEIGHT_CLASSES, cap,
} from '../lib/constants.js';

// Fields compared when reconciling two records.
const FIELDS = [
  ['Classification', 'damage_score'],
  ['Observation type', 'observation_type'],
  ['Region', 'region'],
  ['Failure mechanism', 'failure_mechanism'],
  ['Code era', 'code_era'],
  ['Retrofits', 'observed_retrofits'],
  ['Building name', 'building_name'],
  ['Building type', 'building_type'],
  ['Primary material', 'primary_material'],
  ['Height class', 'height_class'],
  ['Address', 'address'],
  ['Location confidence', 'location_confidence'],
];

function display(key, value) {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (key === 'damage_score') return DAMAGE_LABEL[value] ?? value;
  if (key === 'observation_type') return OBSERVATION_LABEL[value] ?? value;
  if (key === 'height_class') return HEIGHT_CLASSES.find((h) => h.value === value)?.label ?? value;
  if (['building_type', 'primary_material', 'location_confidence', 'observed_retrofits', 'code_era'].includes(key)) return cap(value);
  return String(value);
}

const norm = (x) => (x === null || x === undefined ? '' : String(x));

/**
 * Merge the source record into a chosen target site. Pick the target from the
 * auto-detected candidates or by typing its Site number. Any fields that clash
 * are shown side by side so the reviewer chooses which value the surviving site
 * keeps. On confirm, the target is updated with the choices, the source's photo
 * and links fold into the target, and the source is marked Merged.
 */
export default function MergeModal({ source, reviewer, candidates = [], onClose, onMerged }) {
  const [siteInput, setSiteInput] = useState('');
  const [target, setTarget] = useState(null);
  const [choices, setChoices] = useState({}); // key -> 'source' | 'target'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function loadTarget(siteId) {
    setErr('');
    const { data, error } = await supabase
      .from('triage_records').select(RECORD_COLUMNS)
      .eq('site_id', Number(siteId)).neq('status', 'Merged').maybeSingle();
    if (error) return setErr(error.message);
    if (!data) return setErr(`No record found with Site #${siteId}.`);
    if (data.id === source.id) return setErr('That is the same record.');
    setTarget(data);
    // default every clash to the target's value
    const init = {};
    for (const [, key] of FIELDS) if (norm(source[key]) !== norm(data[key])) init[key] = 'target';
    setChoices(init);
  }

  const clashes = target ? FIELDS.filter(([, key]) => norm(source[key]) !== norm(target[key])) : [];

  async function confirmMerge() {
    setBusy(true); setErr('');
    try {
      const patch = {};
      for (const [, key] of clashes) {
        if (choices[key] === 'source') patch[key] = source[key];
      }
      if ('damage_score' in patch) patch.damage_score = Number(patch.damage_score);
      if (Object.keys(patch).length) {
        const up = await supabase.from('triage_records').update(patch).eq('id', target.id);
        if (up.error) throw up.error;
      }
      const { error } = await supabase.rpc('merge_records', {
        p_source: source.id, p_target: target.id, p_reviewer: reviewer,
      });
      if (error) throw error;
      onMerged(source.id, target.site_id);
    } catch (ex) {
      setErr(`Merge failed: ${ex.message ?? ex}`);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>Merge Site #{source.site_id} into another record</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="merge-body">
          <p className="muted small">
            Choose the record to keep. The source (Site #{source.site_id}) folds into
            it: its photo and links carry across, and it is marked Merged.
          </p>

          <div className="merge-pick">
            {candidates.length > 0 && (
              <div className="cand-row">
                <span className="muted small">Likely matches:</span>
                {candidates.slice(0, 5).map((c) => (
                  <button key={c.id} type="button" className="mini"
                    onClick={() => loadTarget(c.site_id)}>
                    #{c.site_id} ({c._reasons?.join(', ')})
                  </button>
                ))}
              </div>
            )}
            <div className="link-add">
              <input type="number" value={siteInput} onChange={(e) => setSiteInput(e.target.value)}
                placeholder="Merge to Site #" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadTarget(siteInput); } }} />
              <button type="button" className="mini" onClick={() => loadTarget(siteInput)} disabled={!siteInput}>Load</button>
            </div>
          </div>

          {target && (
            <div className="merge-compare">
              <p className="kv"><b>Keeping Site #{target.site_id}</b> {target.region ? `· ${target.region}` : ''}</p>
              {clashes.length === 0 ? (
                <p className="muted small">No clashing fields. The photo and links will fold in on merge.</p>
              ) : (
                <table className="merge-table">
                  <thead>
                    <tr><th>Field</th><th>Source #{source.site_id}</th><th>Keep #{target.site_id}</th></tr>
                  </thead>
                  <tbody>
                    {clashes.map(([label, key]) => (
                      <tr key={key}>
                        <td>{label}</td>
                        <td className={choices[key] === 'source' ? 'chosen' : ''}>
                          <label>
                            <input type="radio" name={key} checked={choices[key] === 'source'}
                              onChange={() => setChoices((c) => ({ ...c, [key]: 'source' }))} />
                            {' '}{display(key, source[key])}
                          </label>
                        </td>
                        <td className={choices[key] === 'target' ? 'chosen' : ''}>
                          <label>
                            <input type="radio" name={key} checked={choices[key] === 'target'}
                              onChange={() => setChoices((c) => ({ ...c, [key]: 'target' }))} />
                            {' '}{display(key, target[key])}
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {err && <p className="status-line err">{err}</p>}
        </div>

        <div className="foot">
          <button className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <span className="grow" />
          <button className="btn" onClick={confirmMerge} disabled={busy || !target}>
            {busy ? 'Merging...' : `Merge into #${target?.site_id ?? '?'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
