import { useEffect, useMemo, useState } from 'react';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import {
  DAMAGE_LABEL, OBSERVATION_LABEL, HEIGHT_CLASSES, SOURCE_LABEL, cap,
} from '../lib/constants.js';

// Metadata fields reconciled one-or-the-other.
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

// One-line provenance / status / approver summary for a record.
function RecordLine({ prefix, rec }) {
  return (
    <div className="merge-summary">
      <b>{prefix} Site #{rec.site_id}</b>
      {rec.region ? ` · ${rec.region}` : ''} · {DAMAGE_LABEL[rec.damage_score]?.split(' - ')[0] ?? '-'}
      {' '}<span className="obs-badge">{statusLabel(rec.status)}</span>
      {' '}<span className="src-badge2">from {SOURCE_LABEL[rec.source_type] ?? 'Other'}</span>
      {rec.status === 'Approved' && rec.reviewed_by ? <span className="muted"> · approved by {rec.reviewed_by}</span> : null}
    </div>
  );
}

/**
 * Merge the source record into a chosen target (another queue item or a triaged
 * site). Metadata clashes are picked one-or-the-other; media, screenshots, and
 * links are multi-keep (tick as many as you want). Runs client-side; the source
 * is marked merged_into (hidden but preserved, reversible).
 */
export default function MergeModal({ source, reviewer, candidates = [], onClose, onMerged }) {
  const [siteInput, setSiteInput] = useState('');
  const [target, setTarget] = useState(null);
  const [choices, setChoices] = useState({});
  const [srcAtts, setSrcAtts] = useState([]);
  const [keepExtra, setKeepExtra] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // the source's own attachments (extra images/links/notes to optionally carry)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('record_attachments')
        .select('id, media_url, source_url, note').eq('record_id', source.id);
      setSrcAtts(data ?? []);
    })();
  }, [source.id]);

  const extras = useMemo(() => {
    const list = [];
    if (source.media_url) list.push({ key: 'm', type: 'image', url: source.media_url, label: 'Primary photo' });
    if (source.streetview_url) list.push({ key: 'sv', type: 'streetview', url: source.streetview_url, label: 'Street View screenshot' });
    if (source.source_url) list.push({ key: 'l', type: 'link', url: source.source_url, label: 'Primary source link' });
    for (const a of srcAtts) {
      if (a.media_url) list.push({ key: `a${a.id}m`, type: 'image', url: a.media_url, note: a.note, label: 'Attached image' });
      if (a.source_url) list.push({ key: `a${a.id}l`, type: 'link', url: a.source_url, note: a.note, label: 'Attached link' });
      if (!a.media_url && !a.source_url && a.note) list.push({ key: `a${a.id}n`, type: 'note', note: a.note, label: 'Attached note' });
    }
    return list;
  }, [source, srcAtts]);

  useEffect(() => {
    setKeepExtra(Object.fromEntries(extras.map((e) => [e.key, true])));
  }, [extras]);

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
      // 1. metadata choices onto the target
      const patch = {};
      for (const [, key] of clashes) if (choices[key] === 'source') patch[key] = source[key];
      if ('damage_score' in patch) patch.damage_score = Number(patch.damage_score);
      if (Object.keys(patch).length) {
        const up = await supabase.from('triage_records').update(patch).eq('id', target.id);
        if (up.error) throw up.error;
      }
      // 2. carry across the ticked media / screenshots / links as attachments
      const rows = [];
      for (const ex of extras) {
        if (!keepExtra[ex.key]) continue;
        const base = { record_id: target.id, added_by: reviewer, note: ex.note ?? null };
        if (ex.type === 'link') rows.push({ ...base, source_url: ex.url, note: ex.note ?? `Merged from Site #${source.site_id}` });
        else if (ex.type === 'note') rows.push({ ...base, note: ex.note });
        else rows.push({ ...base, media_url: ex.url, note: ex.note ?? (ex.type === 'streetview' ? `Street View (merged from #${source.site_id})` : `Merged from Site #${source.site_id}`) });
      }
      if (rows.length) {
        const ins = await supabase.from('record_attachments').insert(rows);
        if (ins.error) throw ins.error;
      }
      // 3. mark the source merged (kept in the database, hidden from views)
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

  const toggleExtra = (k) => setKeepExtra((m) => ({ ...m, [k]: !m[k] }));
  const keptCount = extras.filter((e) => keepExtra[e.key]).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>Merge Site #{source.site_id}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="merge-body">
          <RecordLine prefix="Merging from" rec={source} />
          <p className="muted small">
            Pick the record to <b>keep</b>. It can be another queue item or an
            already-triaged site. Choose which values win below; media, screenshots,
            and links are kept individually (tick as many as you like). The kept
            record retains everything it already has. Site #{source.site_id} then
            leaves the queue but stays in the database and can be restored.
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
            <>
              <RecordLine prefix="Keeping" rec={target} />

              {clashes.length > 0 && (
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

              {extras.length > 0 && (
                <div className="merge-extras">
                  <div className="ex-head">Media, screenshots and links to carry across from #{source.site_id} ({keptCount} of {extras.length})</div>
                  {extras.map((ex) => (
                    <label key={ex.key} className="ex-item">
                      <input type="checkbox" checked={!!keepExtra[ex.key]} onChange={() => toggleExtra(ex.key)} />
                      {(ex.type === 'image' || ex.type === 'streetview') && ex.url && (
                        <img className="ex-thumb" src={ex.url} alt="" loading="lazy" />
                      )}
                      <span className="ex-label">
                        <b>{ex.label}</b>
                        {ex.type === 'link' && <> · <a href={ex.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{ex.url}</a></>}
                        {ex.note && ex.type !== 'note' ? <span className="muted"> · {ex.note}</span> : null}
                        {ex.type === 'note' && <span> · {ex.note}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {extras.length === 0 && <p className="muted small">Site #{source.site_id} has no media or links to carry across.</p>}
            </>
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
