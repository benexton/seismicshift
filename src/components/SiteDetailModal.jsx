import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  DAMAGE_LABEL, DAMAGE_COLOR, SOURCE_LABEL, OBSERVATION_LABEL, cap,
} from '../lib/constants.js';
import RecordFields, { fieldsPatch } from './RecordFields.jsx';
import AttachmentAdder from './AttachmentAdder.jsx';

/**
 * Detail view for a triaged (Approved) site. Same editing as the review panel:
 * all attribute fields, coordinates, notes, and attachments (add multiple
 * images, links, notes). Changes save in place.
 */
export default function SiteDetailModal({ record, reviewer, others = [], onClose, onSaved }) {
  const [v, setV] = useState({ ...record });
  const [notes, setNotes] = useState(record.engineer_notes ?? '');
  const [lat, setLat] = useState(record.latitude ?? '');
  const [lng, setLng] = useState(record.longitude ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key) => (e) => setV((m) => ({ ...m, [key]: e.target.value }));
  const movedLocation = Number(lat) !== record.latitude || Number(lng) !== record.longitude;

  async function save() {
    setBusy(true); setErr(''); setStatus(null);
    try {
      if (movedLocation && lat !== '' && lng !== '') {
        const geo = await supabase.rpc('move_observation', { p_id: record.id, p_lng: Number(lng), p_lat: Number(lat) });
        if (geo.error && !/function/i.test(geo.error.message)) throw geo.error;
      }
      const p = { ...fieldsPatch(v), engineer_notes: notes || null, location_precision: movedLocation ? 'exact' : record.location_precision };
      const { error } = await supabase.from('triage_records').update(p).eq('id', record.id);
      if (error) throw error;
      setBusy(false);
      setStatus({ kind: 'ok', msg: 'Saved.' });
      onSaved?.(record.id, { ...p, ...(movedLocation ? { latitude: Number(lat), longitude: Number(lng) } : {}) });
    } catch (ex) { setBusy(false); setErr(`Save failed: ${ex.message ?? ex}`); }
  }

  const aiColor = DAMAGE_COLOR[record.damage_score] ?? '#9e9e9e';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>{record.site_id != null ? `#${record.site_id} · ` : ''}{record.region ?? 'Unspecified region'}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {others.length > 0 && (
          <div className="presence-banner">Heads up: also being viewed by {others.join(', ')}. Coordinate to avoid double-handling.</div>
        )}

        <div className="body">
          <div>
            <span className="ai-badge" style={{ background: aiColor }}>{DAMAGE_LABEL[record.damage_score]?.split(' - ')[0] ?? '-'}</span>{' '}
            <span className="obs-badge">{OBSERVATION_LABEL[record.observation_type] ?? 'Building'}</span>{' '}
            <span className="obs-badge">{SOURCE_LABEL[record.source_type] ?? 'Other'}</span>

            {record.media_url && (
              <a href={record.source_url ?? record.media_url} target="_blank" rel="noreferrer">
                <img className="media" src={record.media_url} alt="Primary" loading="lazy" />
              </a>
            )}
            {record.streetview_url && (
              <p className="kv"><b>Street View:</b> <a href={record.streetview_url} target="_blank" rel="noreferrer">screenshot</a></p>
            )}
            <p className="kv"><b>Verified by:</b> {record.reviewed_by ?? '-'}</p>
            {record.source_url && <p className="kv"><b>Source:</b> <a href={record.source_url} target="_blank" rel="noreferrer">link</a></p>}

            <AttachmentAdder recordId={record.id} reviewer={reviewer} />
          </div>

          <div>
            <RecordFields v={v} set={set} />
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

        <div className="foot">
          <button className="btn secondary" onClick={onClose} disabled={busy}>Close</button>
          <span className="grow" />
          {status && <span className={`status-line ${status.kind}`} style={{ alignSelf: 'center' }}>{status.msg}</span>}
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}
