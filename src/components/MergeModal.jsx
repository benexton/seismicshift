import { useEffect, useMemo, useState } from 'react';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import {
  DAMAGE_LABEL, OBSERVATION_LABEL, HEIGHT_CLASSES, provenanceLabel, cap,
} from '../lib/constants.js';
import Zoomable from './Zoomable.jsx';

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

function RecordLine({ prefix, rec }) {
  return (
    <div className="merge-summary">
      <b>{prefix} Site #{rec.site_id}</b>
      {rec.region ? ` · ${rec.region}` : ''} · {DAMAGE_LABEL[rec.damage_score]?.split(' - ')[0] ?? '-'}
      {' '}<span className="obs-badge">{statusLabel(rec.status)}</span>
      {' '}<span className="src-badge2">from {provenanceLabel(rec)}</span>
      {rec.status === 'Approved' && rec.reviewed_by ? <span className="muted"> · verified by {rec.reviewed_by}</span> : null}
    </div>
  );
}

// One selectable media/link/note row.
function ItemRow({ item, checked, onToggle }) {
  return (
    <label className="ex-item">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {(item.kind === 'image' || item.kind === 'streetview') && item.url && (
        <Zoomable className="ex-thumb" src={item.url} alt={item.label} />
      )}
      <span className="ex-label">
        <b>{item.label}</b>
        {item.kind === 'link' && <> · <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{item.url}</a></>}
        {item.kind === 'file' && <> · {item.fileName || 'file'}</>}
        {item.kind === 'note' && <> · {item.note}</>}
        {item.note && item.kind !== 'note' ? <span className="muted"> · {item.note}</span> : null}
      </span>
    </label>
  );
}

/**
 * Merge the source record into a chosen target (queue item or triaged site).
 * Metadata clashes are one-or-the-other; media, screenshots, links, and notes
 * are individually selectable on BOTH sides: tick source items to carry them
 * across, un-tick target items to remove them from the kept record. Runs
 * client-side; the source is marked merged_into (hidden but preserved).
 */
export default function MergeModal({ source, reviewer, candidates = [], onClose, onMerged }) {
  const [siteInput, setSiteInput] = useState('');
  const [target, setTarget] = useState(null);
  const [choices, setChoices] = useState({});
  const [srcAtts, setSrcAtts] = useState([]);
  const [tgtAtts, setTgtAtts] = useState([]);
  const [keep, setKeep] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('record_attachments')
        .select('id, media_url, source_url, file_url, file_name, note').eq('record_id', source.id);
      setSrcAtts(data ?? []);
    })();
  }, [source.id]);

  const items = useMemo(() => {
    const out = [];
    const add = (owner, kind, o) => out.push({ owner, kind, ...o, key: `${owner}-${o.k}` });
    if (source.media_url) add('source', 'image', { k: 'media', url: source.media_url, label: 'Primary photo' });
    if (source.streetview_url) add('source', 'streetview', { k: 'sv', url: source.streetview_url, label: 'Street View screenshot' });
    if (source.source_url) add('source', 'link', { k: 'link', url: source.source_url, label: 'Primary source link' });
    if (source.engineer_notes) add('source', 'note', { k: 'notes', note: source.engineer_notes, label: 'Engineer notes' });
    for (const a of srcAtts) {
      if (a.media_url) add('source', 'image', { k: `att${a.id}`, url: a.media_url, note: a.note, label: 'Attached image' });
      else if (a.file_url) add('source', 'file', { k: `att${a.id}`, url: a.file_url, fileName: a.file_name, note: a.note, label: 'Attached file' });
      else if (a.source_url) add('source', 'link', { k: `att${a.id}`, url: a.source_url, note: a.note, label: 'Attached link' });
      else if (a.note) add('source', 'note', { k: `att${a.id}`, note: a.note, label: 'Attached note' });
    }
    if (target) {
      if (target.media_url) add('target', 'image', { k: 'media', url: target.media_url, label: 'Primary photo', column: 'media_url' });
      if (target.streetview_url) add('target', 'streetview', { k: 'sv', url: target.streetview_url, label: 'Street View screenshot', column: 'streetview_url' });
      if (target.source_url) add('target', 'link', { k: 'link', url: target.source_url, label: 'Primary source link', column: 'source_url' });
      if (target.engineer_notes) add('target', 'note', { k: 'notes', note: target.engineer_notes, label: 'Engineer notes', column: 'engineer_notes' });
      for (const a of tgtAtts) {
        if (a.media_url) add('target', 'image', { k: `att${a.id}`, url: a.media_url, note: a.note, label: 'Attached image', attachmentId: a.id });
        else if (a.file_url) add('target', 'file', { k: `att${a.id}`, url: a.file_url, fileName: a.file_name, note: a.note, label: 'Attached file', attachmentId: a.id });
        else if (a.source_url) add('target', 'link', { k: `att${a.id}`, url: a.source_url, note: a.note, label: 'Attached link', attachmentId: a.id });
        else if (a.note) add('target', 'note', { k: `att${a.id}`, note: a.note, label: 'Attached note', attachmentId: a.id });
      }
    }
    return out;
  }, [source, srcAtts, target, tgtAtts]);

  useEffect(() => { setKeep(Object.fromEntries(items.map((i) => [i.key, true]))); }, [items]);

  const sourceItems = items.filter((i) => i.owner === 'source');
  const targetItems = items.filter((i) => i.owner === 'target');

  async function loadTarget(siteId) {
    setErr(''); setTarget(null); setTgtAtts([]);
    const n = Number(siteId);
    if (!n) return setErr('Enter a Site number to merge into.');
    const { data, error } = await supabase
      .from('triage_records').select(RECORD_COLUMNS)
      .eq('site_id', n).is('merged_into', null).maybeSingle();
    if (error) return setErr(error.message);
    if (!data) return setErr(`No active record with Site #${n}. It may not exist or may already have been merged.`);
    if (data.id === source.id) return setErr('That is the same record you are merging from.');
    setTarget(data);
    const { data: atts } = await supabase.from('record_attachments')
      .select('id, media_url, source_url, file_url, file_name, note').eq('record_id', data.id);
    setTgtAtts(atts ?? []);
    const init = {};
    for (const [, key] of FIELDS) if (norm(source[key]) !== norm(data[key])) init[key] = 'target';
    setChoices(init);
  }

  const clashes = target ? FIELDS.filter(([, key]) => norm(source[key]) !== norm(target[key])) : [];
  const toggle = (k) => setKeep((m) => ({ ...m, [k]: !m[k] }));

  async function confirmMerge() {
    if (source.status && source.status !== 'Unverified') {
      return setErr('Only an unverified queue item can be merged into another record. A verified site cannot be merged away.');
    }
    if (target && target.status !== 'Unverified' && target.status !== 'Approved') {
      return setErr('You can only merge into a queue item or a triaged site.');
    }
    setBusy(true); setErr('');
    try {
      // 1. remove any un-ticked existing attachments on the target (needs v8)
      const delIds = targetItems.filter((i) => i.attachmentId && !keep[i.key]).map((i) => i.attachmentId);
      if (delIds.length) {
        const del = await supabase.from('record_attachments').delete().in('id', delIds);
        if (del.error) {
          setBusy(false);
          return setErr('Could not remove existing attachments on the kept record. Either re-tick them, or run migration_v8.sql to allow removing attachments. Nothing has been changed.');
        }
      }

      // 2. patch the target: metadata choices + cleared (un-ticked) primary columns
      const patch = {};
      for (const [, key] of clashes) if (choices[key] === 'source') patch[key] = source[key];
      if ('damage_score' in patch) patch.damage_score = Number(patch.damage_score);
      for (const it of targetItems) if (it.column && !keep[it.key]) patch[it.column] = null;
      if (Object.keys(patch).length) {
        const up = await supabase.from('triage_records').update(patch).eq('id', target.id);
        if (up.error) throw up.error;
      }

      // 3. carry across the ticked source items as attachments on the target
      const rows = [];
      for (const it of sourceItems) {
        if (!keep[it.key]) continue;
        const base = { record_id: target.id, added_by: reviewer };
        if (it.kind === 'link') rows.push({ ...base, source_url: it.url, note: it.note ?? `Merged from Site #${source.site_id}` });
        else if (it.kind === 'file') rows.push({ ...base, file_url: it.url, file_name: it.fileName, note: it.note ?? `Merged from Site #${source.site_id}` });
        else if (it.kind === 'note') rows.push({ ...base, note: it.note });
        else rows.push({ ...base, media_url: it.url, note: it.note ?? (it.kind === 'streetview' ? `Street View (merged from #${source.site_id})` : `Merged from Site #${source.site_id}`) });
      }
      if (rows.length) {
        const ins = await supabase.from('record_attachments').insert(rows);
        if (ins.error) throw ins.error;
      }

      // 4. mark the source merged (hidden but preserved)
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
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>Merge Site #{source.site_id}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="merge-body">
          <RecordLine prefix="Merging from" rec={source} />
          <p className="muted small">
            Pick the record to <b>keep</b> (a queue item or a triaged site). Choose
            which field values win below. Media, screenshots, links, and notes are
            selectable on both sides: tick items from #{source.site_id} to carry them
            across, un-tick items already on the kept record to remove them.
            #{source.site_id} then leaves the queue but stays in the database.
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

              <div className="merge-media">
                <div className="merge-col">
                  <div className="ex-head">Carry across from #{source.site_id}</div>
                  {sourceItems.length === 0 ? <p className="muted small">Nothing to carry across.</p>
                    : sourceItems.map((it) => <ItemRow key={it.key} item={it} checked={!!keep[it.key]} onToggle={() => toggle(it.key)} />)}
                </div>
                <div className="merge-col">
                  <div className="ex-head">Already on #{target.site_id} (un-tick to remove)</div>
                  {targetItems.length === 0 ? <p className="muted small">No media, links, or notes yet.</p>
                    : targetItems.map((it) => <ItemRow key={it.key} item={it} checked={!!keep[it.key]} onToggle={() => toggle(it.key)} />)}
                </div>
              </div>
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
