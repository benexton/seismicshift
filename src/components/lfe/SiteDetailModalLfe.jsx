import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import {
  DAMAGE_LABEL, DAMAGE_COLOR, SOURCE_LABEL, observationTypesLabel, provenanceLabel, cap,
} from '../../lib/constantsLfe.js';
import RecordFieldsLfe, { fieldsPatch } from './RecordFieldsLfe.jsx';
import Zoomable from '../Zoomable.jsx';
import AttachmentAdderLfe from './AttachmentAdderLfe.jsx';
import StreetviewFieldLfe from './StreetviewFieldLfe.jsx';
import { uploadImage } from '../../lib/mediaLfe.js';
import { coordError } from '../../lib/coordsLfe.js';

/**
 * Detail view for a triaged (Approved) site. Same editing as the review panel:
 * all attribute fields, coordinates, notes, and attachments (add multiple
 * images, links, notes). Changes save in place.
 */
export default function SiteDetailModalLfe({ record, reviewer, others = [], onClose, onSaved }) {
  const [v, setV] = useState({ ...record });
  const [notes, setNotes] = useState(record.engineer_notes ?? '');
  const [lat, setLat] = useState(record.latitude ?? '');
  const [lng, setLng] = useState(record.longitude ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState(null);
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

  async function save() {
    if (blockedByPending()) return;
    const cErr = coordError(lat, lng);
    if (cErr) { setErr(cErr); return; }
    setBusy(true); setErr(''); setStatus(null);
    try {
      if (movedLocation && lat !== '' && lng !== '') {
        const geo = await supabaseLfe.rpc('move_observation', { p_id: record.id, p_lng: Number(lng), p_lat: Number(lat) });
        if (geo.error) throw geo.error;
      }
      const streetviewUrl = streetviewFile ? await uploadImage(streetviewFile) : null;
      const p = {
        ...fieldsPatch(v), engineer_notes: notes || null, location_precision: movedLocation ? 'exact' : record.location_precision,
        ...(streetviewUrl ? { streetview_url: streetviewUrl } : {}),
        ...(record.source_type === 'human' ? { source_url: v.source_url?.trim() || null } : {}),
      };
      const { error } = await supabaseLfe.from('triage_records').update(p).eq('id', record.id);
      if (error) throw error;
      setBusy(false);
      setStreetviewFile(null);
      setStatus({ kind: 'ok', msg: 'Saved.' });
      onSaved?.(record.id, { ...p, ...(movedLocation ? { latitude: Number(lat), longitude: Number(lng) } : {}) });
    } catch (ex) { setBusy(false); setErr(`Save failed: ${ex.message ?? ex}`); }
  }

  const aiColor = DAMAGE_COLOR[record.damage_score] ?? '#9e9e9e';

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

        <div className="body">
          <div>
            <span className="ai-badge" style={{ background: aiColor }}>{DAMAGE_LABEL[record.damage_score]?.split(' - ')[0] ?? '-'}</span>{' '}
            <span className="obs-badge">{observationTypesLabel(record.observation_types)}</span>{' '}
            <span className="obs-badge">{SOURCE_LABEL[record.source_type] ?? 'Other'}</span>

            {v.media_url && <Zoomable className="media" src={v.media_url} alt="Primary" />}
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
            <p className="kv"><b>Provenance:</b> {provenanceLabel(record)}</p>
            <p className="kv"><b>Verified by:</b> {record.reviewed_by ?? '-'}</p>
            {record.source_type === 'human' ? (
              <div className="field">
                <label>Primary source link</label>
                <input type="text" value={v.source_url ?? ''} onChange={set('source_url')} placeholder="https://..." />
              </div>
            ) : (
              v.source_url && <p className="kv"><b>Source:</b> <a href={v.source_url} target="_blank" rel="noreferrer">link</a></p>
            )}

            <AttachmentAdderLfe
              recordId={record.id} reviewer={reviewer} onPendingChange={setAttachPending}
              primaryMediaUrl={v.media_url} primarySourceUrl={v.source_url}
              onPrimaryChanged={(patch) => setV((m) => ({ ...m, ...patch }))}
            />
          </div>

          <div>
            <RecordFieldsLfe v={v} set={set} />
            <div className="field latlng">
              <div><label>Latitude</label><input type="number" step="0.00001" value={lat} onChange={(e) => setLat(e.target.value)} /></div>
              <div><label>Longitude</label><input type="number" step="0.00001" value={lng} onChange={(e) => setLng(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Engineer notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {err && <p className="status-line err">{err}</p>}
        {pendingWarn && <p className="pending-warn">You have unsaved images or files. Click Add to save them, or Discard, before leaving this record.</p>}

        <div className="foot">
          <button className="btn secondary" onClick={guardedClose} disabled={busy}>Close</button>
          <span className="grow" />
          {status && <span className={`status-line ${status.kind}`} style={{ alignSelf: 'center' }}>{status.msg}</span>}
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}
