import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import {
  DAMAGE_LABEL, DAMAGE_COLOR, observationTypesLabel, SOURCE_LABEL, SOURCE_COLOR, provenanceLabel, cap,
} from '../../lib/constantsLfe.js';
import RecordFieldsLfe, { fieldsPatch } from './RecordFieldsLfe.jsx';
import Zoomable from '../Zoomable.jsx';
import AttachmentAdderLfe from './AttachmentAdderLfe.jsx';
import MergeModalLfe from './MergeModalLfe.jsx';
import StreetviewFieldLfe from './StreetviewFieldLfe.jsx';
import { uploadImage } from '../../lib/mediaLfe.js';
import { coordError } from '../../lib/coordsLfe.js';

/**
 * Review a queue record: imagery, provenance, all editable attributes, and
 * attachments. Actions: Cancel, Save draft (keep in queue), Reject (confirmed),
 * Approve, and Merge (reconcile into an existing site).
 */
export default function ReviewModalLfe({ record, reviewer, others = [], onClose, onResolved, onSavedDraft }) {
  const [v, setV] = useState({ ...record });
  const [notes, setNotes] = useState(record.engineer_notes ?? '');
  const [lat, setLat] = useState(record.latitude ?? '');
  const [lng, setLng] = useState(record.longitude ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);
  const [merging, setMerging] = useState(false);
  const [attachPending, setAttachPending] = useState(false);
  const [pendingWarn, setPendingWarn] = useState(false);
  const [streetviewFile, setStreetviewFile] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && guardedClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { if (!attachPending) setPendingWarn(false); }, [attachPending]);

  function blockedByPending() { if (attachPending) { setPendingWarn(true); return true; } return false; }
  function guardedClose() { if (!blockedByPending()) onClose(); }

  const set = (key) => (e) => setV((m) => ({ ...m, [key]: e.target.value }));
  const movedLocation = Number(lat) !== record.latitude || Number(lng) !== record.longitude;

  function coordGuard() {
    const e = coordError(lat, lng);
    if (e) { setErr(e); return false; }
    return true;
  }

  async function persistLocationIfMoved() {
    if (movedLocation && lat !== '' && lng !== '') {
      const geo = await supabaseLfe.rpc('move_observation', { p_id: record.id, p_lng: Number(lng), p_lat: Number(lat) });
      if (geo.error) throw geo.error;
    }
  }

  function patch(streetviewUrl) {
    return {
      ...fieldsPatch(v),
      engineer_notes: notes || null,
      location_precision: movedLocation ? 'exact' : record.location_precision,
      ...(streetviewUrl ? { streetview_url: streetviewUrl } : {}),
    };
  }

  async function saveDraft() {
    if (blockedByPending()) return;
    if (!coordGuard()) return;
    setBusy(true); setErr('');
    try {
      await persistLocationIfMoved();
      const streetviewUrl = streetviewFile ? await uploadImage(streetviewFile) : null;
      const p = patch(streetviewUrl);
      const { error } = await supabaseLfe.from('triage_records').update(p).eq('id', record.id);
      if (error) throw error;
      setBusy(false);
      setStreetviewFile(null);
      onSavedDraft?.(record.id, { ...p, ...(movedLocation ? { latitude: Number(lat), longitude: Number(lng) } : {}) });
      onClose();
    } catch (ex) { setBusy(false); setErr(`Save failed: ${ex.message ?? ex}`); }
  }

  async function resolve(newStatus) {
    if (blockedByPending()) return;
    if (newStatus === 'Approved' && !coordGuard()) return;
    setBusy(true); setErr('');
    try {
      await persistLocationIfMoved();
      const streetviewUrl = streetviewFile ? await uploadImage(streetviewFile) : null;
      const { error } = await supabaseLfe.from('triage_records').update({
        ...patch(streetviewUrl), status: newStatus, reviewed_by: reviewer, reviewed_at: new Date().toISOString(),
      }).eq('id', record.id);
      if (error) throw error;
      setBusy(false);
      onResolved(record.id, newStatus);
    } catch (ex) { setBusy(false); setErr(`Update failed: ${ex.message ?? ex}`); }
  }

  const aiColor = DAMAGE_COLOR[record.damage_score] ?? '#9e9e9e';
  const srcColor = SOURCE_COLOR[record.source_type] ?? '#9e9e9e';

  const attrs = [
    ['Building', record.building_name],
    ['Address', record.address],
    ['Type', cap(record.building_type)],
    ['Material', cap(record.primary_material)],
    ['Height', record.height_class],
    ['Location confidence', cap(record.location_confidence)],
  ].filter(([, x]) => x);

  if (merging) {
    return (
      <MergeModalLfe
        source={{ ...record, ...v }}
        reviewer={reviewer}
        candidates={record._dupes ?? []}
        onClose={() => setMerging(false)}
        onMerged={(id) => onResolved(id, 'Merged')}
      />
    );
  }

  return (
    <div className="modal-backdrop" onClick={guardedClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>{record.site_id != null ? `#${record.site_id} · ` : ''}{record.region ?? 'Unspecified region'}</h2>
          <button className="x" onClick={guardedClose} aria-label="Close">×</button>
        </div>

        {others.length > 0 && (
          <div className="presence-banner">Heads up: also being viewed by {others.join(', ')}. Coordinate to avoid double-handling.</div>
        )}

        {record._dupes?.length > 0 && (
          <div className="dup-banner">
            <b>Possible match to {record._dupes.length} triaged site(s).</b>{' '}
            Use Merge to fold this into an existing site instead of keeping a duplicate.
            <div className="dup-row">
              <span>{record._dupes.slice(0, 3).map((d) => `#${d.site_id} (${d._reasons.join(', ')})`).join('   ')}</span>
              <button className="mini" onClick={() => { if (!blockedByPending()) setMerging(true); }}>Merge...</button>
            </div>
          </div>
        )}

        <div className="reminder-banner">
          Before proceeding, check the <b>Triaged sites</b> tab for a match to this record. If it's
          already been verified there, use <b>Merge</b> below to fold this information into the
          existing site instead of approving it as a new one.
        </div>

        <div className="body">
          <div>
            <span className="src-badge" style={{ borderColor: srcColor, color: srcColor }}>
              {SOURCE_LABEL[record.source_type] ?? 'Other'}
            </span>
            <span className="obs-badge">{observationTypesLabel(record.observation_types)}</span>
            {record.location_precision === 'ai_estimated' && (
              <span className="ai-loc-badge">
                AI-estimated location{record.location_confidence ? ` (${record.location_confidence} confidence)` : ''} - confirm or adjust below
              </span>
            )}
            {record.location_precision === 'approximate' && <span className="approx-badge">approx. location</span>}

            {record.media_url ? (
              <Zoomable className="media" src={record.media_url} alt="Source media" />
            ) : <p className="muted">No primary media.</p>}

            <StreetviewFieldLfe url={record.streetview_url} file={streetviewFile} onFile={setStreetviewFile} />

            {record.source_text_en && (
              <div className="caption-block">
                <p className="kv"><b>Post text{record.source_text_en !== record.source_text ? ' (translated)' : ''}:</b> {record.source_text_en}</p>
                {record.source_text && record.source_text !== record.source_text_en && (
                  <details className="muted small">
                    <summary>Show original</summary>
                    {record.source_text}
                  </details>
                )}
              </div>
            )}
            {attrs.length > 0 && (
              <div className="attr-block">
                {attrs.map(([k, x]) => <p key={k} className="kv"><b>{k}:</b> {x}</p>)}
              </div>
            )}
            <p className="kv">
              <b>AI:</b>{' '}
              <span className="ai-badge" style={{ background: aiColor }}>{DAMAGE_LABEL[record.damage_score]?.split(' - ')[0] ?? '-'}</span>{' '}
              {record.ai_confidence != null && `(${Math.round(record.ai_confidence * 100)}%)`} · {record.ai_model ?? '-'}
            </p>
            <p className="kv"><b>Provenance:</b> {provenanceLabel(record)}</p>
            {record.source_url && <p className="kv"><b>Source:</b> <a href={record.source_url} target="_blank" rel="noreferrer">link</a></p>}

            <AttachmentAdderLfe recordId={record.id} reviewer={reviewer} onPendingChange={setAttachPending} />
          </div>

          <div>
            <RecordFieldsLfe v={v} set={set} />
            <div className="field latlng">
              <div><label>Latitude</label><input type="number" step="0.00001" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
              <div><label>Longitude</label><input type="number" step="0.00001" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
            </div>
            {movedLocation && <p className="muted small">Coordinates edited; will be saved as exact.</p>}
            <div className="field">
              <label>Engineer notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="RC frame behaviour, joints, caveats..." />
            </div>
          </div>
        </div>

        {err && <p className="status-line err">{err}</p>}
        {pendingWarn && <p className="pending-warn">You have unsaved images or files. Click Add to save them, or Discard, before leaving this record.</p>}

        {confirmReject ? (
          <div className="foot confirm">
            <span className="confirm-text">Reject this record? Rejected records are hard to recover.</span>
            <span className="grow" />
            <button className="btn secondary" onClick={() => setConfirmReject(false)} disabled={busy}>Keep it</button>
            <button className="btn-reject" onClick={() => resolve('Rejected')} disabled={busy}>{busy ? 'Rejecting...' : 'Yes, reject'}</button>
          </div>
        ) : (
          <div className="foot">
            <button className="btn secondary" onClick={guardedClose} disabled={busy}>Cancel</button>
            <button className="btn secondary" onClick={() => { if (!blockedByPending()) setMerging(true); }} disabled={busy}>Merge...</button>
            <span className="grow" />
            <button className="btn secondary" onClick={saveDraft} disabled={busy}>Save draft</button>
            <button className="btn-reject" onClick={() => { if (!blockedByPending()) setConfirmReject(true); }} disabled={busy}>Reject</button>
            <button className="btn-approve" onClick={() => resolve('Approved')} disabled={busy}>{busy ? 'Saving...' : 'Approve'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
