import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  CLASSIFICATION_SCORES, DAMAGE_LABEL, DAMAGE_COLOR, CODE_ERAS, RETROFIT_OPTIONS,
  OBSERVATION_TYPES, OBSERVATION_LABEL, SOURCE_LABEL, SOURCE_COLOR,
} from '../lib/constants.js';

/**
 * Review a single queue record: imagery, provenance, AI tags and manual
 * attributes; lets the engineer override classification and coordinates, then
 * Save draft (keep in queue), Reject (with confirmation), or Approve.
 */
export default function ReviewModal({ record, reviewer, onClose, onResolved, onSavedDraft }) {
  const [obsType, setObsType] = useState(record.observation_type ?? 'building');
  const [damageScore, setDamageScore] = useState(record.damage_score ?? 0);
  const [codeEra, setCodeEra] = useState(record.code_era ?? 'unknown');
  const [mechanism, setMechanism] = useState(record.failure_mechanism ?? '');
  const [retrofit, setRetrofit] = useState(record.observed_retrofits ?? 'none');
  const [notes, setNotes] = useState(record.engineer_notes ?? '');
  const [lat, setLat] = useState(record.latitude ?? '');
  const [lng, setLng] = useState(record.longitude ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isBuilding = obsType === 'building';
  const movedLocation = Number(lat) !== record.latitude || Number(lng) !== record.longitude;

  function edits() {
    return {
      observation_type: obsType,
      damage_score: Number(damageScore),
      code_era: isBuilding ? codeEra : null,
      failure_mechanism: mechanism || null,
      observed_retrofits: isBuilding ? retrofit : null,
      engineer_notes: notes || null,
    };
  }

  async function persistLocationIfMoved() {
    if (movedLocation && lat !== '' && lng !== '') {
      const geo = await supabase.rpc('move_observation', { p_id: record.id, p_lng: Number(lng), p_lat: Number(lat) });
      if (geo.error && !/function/i.test(geo.error.message)) throw geo.error;
    }
  }

  async function merge(targetId) {
    setBusy(true); setErr('');
    const { error } = await supabase.rpc('merge_records', { p_source: record.id, p_target: targetId, p_reviewer: reviewer });
    setBusy(false);
    if (error) return setErr(`Merge failed: ${error.message}`);
    onResolved(record.id, 'Merged');
  }

  async function saveDraft() {
    setBusy(true); setErr('');
    try {
      await persistLocationIfMoved();
      const patch = { ...edits(), location_precision: movedLocation ? 'exact' : record.location_precision };
      const { error } = await supabase.from('triage_records').update(patch).eq('id', record.id);
      if (error) throw error;
      setBusy(false);
      onSavedDraft?.(record.id, {
        ...patch,
        ...(movedLocation ? { latitude: Number(lat), longitude: Number(lng) } : {}),
      });
      onClose();
    } catch (ex) {
      setBusy(false);
      setErr(`Save failed: ${ex.message ?? ex}`);
    }
  }

  async function resolve(newStatus) {
    setBusy(true); setErr('');
    try {
      await persistLocationIfMoved();
      const { error } = await supabase
        .from('triage_records')
        .update({
          ...edits(),
          location_precision: movedLocation ? 'exact' : record.location_precision,
          status: newStatus,
          reviewed_by: reviewer,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', record.id);
      if (error) throw error;
      setBusy(false);
      onResolved(record.id, newStatus);
    } catch (ex) {
      setBusy(false);
      setErr(`Update failed: ${ex.message ?? ex}`);
    }
  }

  const aiColor = DAMAGE_COLOR[record.damage_score] ?? '#9e9e9e';
  const srcColor = SOURCE_COLOR[record.source_type] ?? '#9e9e9e';

  const attrs = [
    ['Building', record.building_name],
    ['Address', record.address],
    ['Type', record.building_type],
    ['Material', record.primary_material],
    ['Height', record.height_class],
    ['Location confidence', record.location_confidence],
  ].filter(([, v]) => v);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>{record.site_id != null ? `#${record.site_id} · ` : ''}{record.region ?? 'Unspecified region'}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {record._dupes?.length > 0 && (
          <div className="dup-banner">
            <b>Possible match to {record._dupes.length} triaged site(s).</b>{' '}
            Merging adds this photo and source to the existing site instead of creating a second dot.
            {record._dupes.slice(0, 3).map((d) => (
              <div key={d.id} className="dup-row">
                <span>{d.region ?? 'site'} · D{d.damage_score ?? '-'} · {d._reasons.join(', ')}</span>
                <button className="mini" onClick={() => merge(d.id)} disabled={busy}>Merge into this</button>
              </div>
            ))}
          </div>
        )}

        <div className="body">
          <div>
            <span className="src-badge" style={{ borderColor: srcColor, color: srcColor }}>
              {SOURCE_LABEL[record.source_type] ?? 'Other'}
            </span>
            <span className="obs-badge">{OBSERVATION_LABEL[record.observation_type] ?? 'Building'}</span>
            {record.location_precision === 'approximate' && <span className="approx-badge">approx. location</span>}

            {record.media_url ? (
              <a href={record.source_url ?? record.media_url} target="_blank" rel="noreferrer">
                <img className="media" src={record.media_url} alt="Source media" loading="lazy" />
              </a>
            ) : (
              <p className="muted">No media.</p>
            )}

            {record.streetview_url && (
              <p className="kv">
                <b>Street View:</b>{' '}
                <a href={record.streetview_url} target="_blank" rel="noreferrer">screenshot</a>
              </p>
            )}

            {attrs.length > 0 && (
              <div className="attr-block">
                {attrs.map(([k, v]) => <p key={k} className="kv"><b>{k}:</b> {v}</p>)}
              </div>
            )}

            <p className="kv">
              <b>AI damage:</b>{' '}
              <span className="ai-badge" style={{ background: aiColor }}>
                {DAMAGE_LABEL[record.damage_score]?.split(' - ')[0] ?? '-'}
              </span>{' '}
              {record.ai_confidence != null && `(${Math.round(record.ai_confidence * 100)}%)`}
            </p>
            <p className="kv"><b>AI mechanism:</b> {record.failure_mechanism ?? '-'}</p>
            <p className="kv"><b>Model:</b> {record.ai_model ?? '-'}</p>
            {record.submitted_by && <p className="kv"><b>Submitted by:</b> {record.submitted_by}</p>}
            {record.source_url && (
              <p className="kv"><b>Source:</b> <a href={record.source_url} target="_blank" rel="noreferrer">link</a></p>
            )}
          </div>

          <div>
            <div className="field">
              <label>Observation type</label>
              <select value={obsType} onChange={(e) => setObsType(e.target.value)}>
                {OBSERVATION_TYPES.map((t) => <option key={t} value={t}>{OBSERVATION_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Damage / classification (override)</label>
              <select value={damageScore} onChange={(e) => setDamageScore(e.target.value)}>
                {CLASSIFICATION_SCORES.map((s) => <option key={s} value={s}>{DAMAGE_LABEL[s]}</option>)}
              </select>
            </div>
            {isBuilding && (
              <div className="field">
                <label>Seismic-code era</label>
                <select value={codeEra} onChange={(e) => setCodeEra(e.target.value)}>
                  {CODE_ERAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <label>{isBuilding ? 'Failure mechanism' : 'Mechanism / feature'}</label>
              <input type="text" value={mechanism} onChange={(e) => setMechanism(e.target.value)} />
            </div>
            {isBuilding && (
              <div className="field">
                <label>Observed retrofits</label>
                <select value={retrofit} onChange={(e) => setRetrofit(e.target.value)}>
                  {RETROFIT_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            <div className="field latlng">
              <div>
                <label>Latitude</label>
                <input type="number" step="0.00001" value={lat} onChange={(e) => setLat(e.target.value)} />
              </div>
              <div>
                <label>Longitude</label>
                <input type="number" step="0.00001" value={lng} onChange={(e) => setLng(e.target.value)} />
              </div>
            </div>
            {movedLocation && <p className="muted small">Coordinates edited; will be saved as exact.</p>}
            <div className="field">
              <label>Engineer notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="RC frame behaviour, masonry infill, joints, caveats..." />
            </div>
          </div>
        </div>

        {err && <p className="status-line err">{err}</p>}

        {confirmReject ? (
          <div className="foot confirm">
            <span className="confirm-text">Reject this record? Rejected records are hard to recover.</span>
            <span className="grow" />
            <button className="btn secondary" onClick={() => setConfirmReject(false)} disabled={busy}>Keep it</button>
            <button className="btn-reject" onClick={() => resolve('Rejected')} disabled={busy}>
              {busy ? 'Rejecting...' : 'Yes, reject'}
            </button>
          </div>
        ) : (
          <div className="foot">
            <button className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
            <span className="grow" />
            <button className="btn secondary" onClick={saveDraft} disabled={busy}>Save draft</button>
            <button className="btn-reject" onClick={() => setConfirmReject(true)} disabled={busy}>Reject</button>
            <button className="btn-approve" onClick={() => resolve('Approved')} disabled={busy}>
              {busy ? 'Saving...' : 'Approve'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
