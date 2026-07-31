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
const statusLabel = (s) => (s === 'Approved' ? 'Triaged site' : s === 'Unverified' ? 'In triage queue' : s || '');

/**
 * Merge the source record into a chosen target. The target can be another queue
 * item or an already-triaged site (any record, by Site number or from the
 * detected matches). Clashing fields are shown side by side to pick which value
 * the kept record keeps. The merge runs entirely client-side: the target gains
 * the source's photo, links, and attachments, and the source is marked with
 * merged_into so it leaves the queue but stays in the database (reversible).
 */
export default function MergeModal({ source, reviewer, candidates = [], onClose, onMerged }) {
  const [siteInput, setSiteInput] = useState('');
  const [target, setTarget] = useState(null);
  const [choices, setChoices] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function loadTarget(siteId) {
    setErr(''); setTarget(null);
    const n = Number(siteId);
    if (!n) return setErr('Enter a Site number to merge into.');
    const { data, error } = await supabase
      .from('triage_records').select(RECORD_COLUMNS)
      .eq('site_id', n).is('merged_into', null).maybeSingle();
    if (error) return setErr(error.message);
    if (!data) return setErr(`No active record with Site #${n}. It may not exist or may already have been merged.`);
    if (data.id === source.id) return setErr('That is the same record you are merging from.');
    setTarget(data);
    const init = {};
    for (const [, key] of FIELDS) if (norm(source[key]) !== norm(data[key])) init[key] = 'target';
    setChoices(init);
  }

  const clashes = target ? FIELDS.filter(([, key]) => norm(source[key]) !== norm(target[key])) : [];

  async function confirmMerge() {
    setBusy(true); setErr('');
    try {
      // 1. apply the chosen values to the target
      const patch = {};
      for (const [, key] of clashes) if (choices[key] === 'source') patch[key] = source[key];
      if ('damage_score' in patch) patch.damage_score = Number(patch.damage_score);
      if (Object.keys(patch).length) {
        const up = await supabase.from('triage_records').update(patch).eq('id', target.id);
        if (up.error) throw up.error;
      }
      // 2. fold the source's own photo / source link onto the target
      if (source.media_url || source.source_url) {
        const ins = await supabase.from('record_attachments').insert({
          record_id: target.id, media_url: source.media_url ?? null, source_url: source.source_url ?? null,
          note: `Merged from Site #${source.site_id}`, added_by: reviewer,
        });
        if (ins.error) throw ins.error;
      }
      // 3. copy the source's existing attachments onto the target
      const { data: atts, error: aerr } = await supabase.from('record_attachments')
        .select('media_url, source_url, note').eq('record_id', source.id);
      if (aerr) throw aerr;
      if (atts && atts.length) {
        const copies = atts.map((a) => ({ record_id: target.id, media_url: a.media_url, source_url: a.source_url, note: a.note, added_by: reviewer }));
        const cins = await supabase.from('record_attachments').insert(copies);
        if (cins.error) throw cins.error;
      }
      // 4. mark the source merged (kept in the database, hidden from views)
      const mk = await supabase.from('triage_records')
        .update({ merged_into: target.id, reviewed_by: reviewer, reviewed_at: new Date().toISOString() })
        .eq('id', source.id);
      if (mk.error) throw mk.error;

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
          <h2>Merge Site #{source.site_id}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="merge-body">
          <div className="merge-summary">
            <b>Merging from Site #{source.site_id}</b>
            {source.region ? ` · ${source.region}` : ''} · {DAMAGE_LABEL[source.damage_score]?.split(' - ')[0] ?? '-'}
          </div>
          <p className="muted small">
            Pick the record to <b>keep</b>. It can be another queue item or an
            already-triaged site. Site #{source.site_id} folds into it (photo,
            links, and attachments carry across), then leaves the queue. It stays
            in the database and can be restored, so nothing is lost.
          </p>

          <div className="merge-pick">
            {candidates.length > 0 && (
              <div className="cand-row">
                <span className="muted small">Likely matches:</span>
                {candidates.slice(0, 5).map((c) => (
                  <button key={c.id} type="button" className="mini" onClick={() => loadTarget(c.site_id)}>
                    #{c.site_id} ({c._reasons?.join(', ')})
                  </button>
                ))}
              </div>
            )}
            <div className="link-add">
              <input type="number" value={siteInput} onChange={(e) => setSiteInput(e.target.value)}
                placeholder="Keep Site #" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadTarget(siteInput); } }} />
              <button type="button" className="mini" onClick={() => loadTarget(siteInput)} disabled={!siteInput}>Load</button>
            </div>
          </div>

          {target && (
            <div className="merge-compare">
              <p className="kv">
                <b>Keeping Site #{target.site_id}</b>{target.region ? ` · ${target.region}` : ''}
                {' '}<span className="obs-badge">{statusLabel(target.status)}</span>
              </p>
              {clashes.length === 0 ? (
                <p className="muted small">No clashing fields. The photo, links, and attachments fold in on merge.</p>
              ) : (
                <table className="merge-table">
                  <thead>
                    <tr><th>Field</th><th>From #{source.site_id}</th><th>Keep #{target.site_id}</th></tr>
                  </thead>
                  <tbody>
                    {clashes.map(([label, key]) => (
                      <tr key={key}>
                        <td>{label}</td>
                        <td className={choices[key] === 'source' ? 'chosen' : ''}>
                          <label><input type="radio" name={key} checked={choices[key] === 'source'}
                            onChange={() => setChoices((c) => ({ ...c, [key]: 'source' }))} /> {display(key, source[key])}</label>
                        </td>
                        <td className={choices[key] === 'target' ? 'chosen' : ''}>
                          <label><input type="radio" name={key} checked={choices[key] === 'target'}
                            onChange={() => setChoices((c) => ({ ...c, [key]: 'target' }))} /> {display(key, target[key])}</label>
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
            {busy ? 'Merging...' : target ? `Merge into #${target.site_id}` : 'Load a record first'}
          </button>
        </div>
      </div>
    </div>
  );
}
