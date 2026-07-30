import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import {
  DAMAGE_SCORES, DAMAGE_LABEL, DAMAGE_COLOR, CODE_ERAS, RETROFIT_OPTIONS,
  OBSERVATION_TYPES, OBSERVATION_LABEL, SOURCE_LABEL, SOURCE_COLOR,
} from '../lib/constants.js';

/**
 * Review a single record: shows imagery, provenance (where the data came from),
 * and the AI tags; lets the engineer override classification, correct the
 * coordinates (useful for coarse geocoded items), then Approve or Reject. Both
 * set status and remove the pin from the queue.
 */
export default function ReviewModal({ record, reviewer, onClose, onResolved }) {
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

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isBuilding = obsType === 'building';
  const movedLocation =
    Number(lat) !== record.latitude || Number(lng) !== record.longitude;

  async function merge(targetId) {
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('merge_records', {
      p_source: record.id, p_target: targetId, p_reviewer: reviewer,
    });
    setBusy(false);
    if (error) return setErr(`Merge failed: ${error.message}`);
    onResolved(record.id, 'Merged');
  }

  async function resolve(newStatus) {
    setBusy(true);
    setErr('');
    // If the verifier corrected the coordinates, update geometry too.
    if (movedLocation && lat !== '' && lng !== '') {
      const geo = await supabase.rpc('move_observation', {
        p_id: record.id, p_lng: Number(lng), p_lat: Number(lat),
      });
      // move_observation is optional; ignore "function not found" gracefully
      if (geo.error && !/function/i.test(geo.error.message)) {
        setBusy(false);
        return setErr(`Location update failed: ${geo.error.message}`);
      }
    }
    const { error } = await supabase
      .from('triage_records')
      .update({
        observation_type: obsType,
        damage_score: Number(damageScore),
        code_era: isBuilding ? codeEra : null,
        failure_mechanism: mechanism || null,
        observed_retrofits: isBuilding ? retrofit : null,
        engineer_notes: notes || null,
        location_precision: movedLocation ? 'exact' : record.location_precision,
        status: newStatus,
        reviewed_by: reviewer,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', record.id);
    setBusy(false);
    if (error) return setErr(`Update failed: ${error.message}`);
    onResolved(record.id, newStatus);
  }

  const aiColor = DAMAGE_COLOR[record.damage_score] ?? '#9e9e9e';
  const srcColor = SOURCE_COLOR[record.source_type] ?? '#9e9e9e';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>{record.region ?? 'Unspecified region'}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {record._dupes?.length > 0 && (
          <div className="dup-banner">
            <b>Possible match to {record._dupes.length} triaged site(s).</b>{' '}
            Merging adds this photo and source to the existing site instead of
            creating a second dot for the same place.
            {record._dupes.slice(0, 3).map((d) => (
              <div key={d.id} className="dup-row">
                <span>
                  {d.region ?? 'site'} · D{d.damage_score ?? '-'} · {d._reasons.join(', ')}
                </span>
                <button className="mini" onClick={() => merge(d.id)} disabled={busy}>
                  Merge into this
                </button>
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
            {record.location_precision === 'approximate' && (
              <span className="approx-badge">approx. location</span>
            )}

            {record.media_url ? (
              <a href={record.source_url ?? record.media_url} target="_blank" rel="noreferrer">
                <img className="media" src={record.media_url} alt="Source media" loading="lazy" />
              </a>
            ) : (
              <p className="muted">No media.</p>
            )}

            <p className="kv">
              <b>AI damage:</b>{' '}
              <span className="ai-badge" style={{ background: aiColor }}>D{record.damage_score ?? '-'}</span>{' '}
              {record.ai_confidence != null && `(${Math.round(record.ai_confidence * 100)}%)`}
            </p>
            <p className="kv"><b>AI code era:</b> {record.code_era ?? '-'}</p>
            <p className="kv"><b>AI mechanism:</b> {record.failure_mechanism ?? '-'}</p>
            <p className="kv"><b>AI retrofits:</b> {record.observed_retrofits ?? '-'}</p>
            <p className="kv"><b>Model:</b> {record.ai_model ?? '-'}</p>
            {record.submitted_by && <p className="kv"><b>Submitted by:</b> {record.submitted_by}</p>}
            {record.source_url && (
              <p className="kv"><b>Source:</b>{' '}
                <a href={record.source_url} target="_blank" rel="noreferrer">link</a></p>
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
              <label>Damage / severity (override)</label>
              <select value={damageScore} onChange={(e) => setDamageScore(e.target.value)}>
                {DAMAGE_SCORES.map((s) => <option key={s} value={s}>{DAMAGE_LABEL[s]}</option>)}
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

        <div className="foot">
          <button className="btn secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <span className="grow" />
          <button className="btn-reject" onClick={() => resolve('Rejected')} disabled={busy}>Reject</button>
          <button className="btn-approve" onClick={() => resolve('Approved')} disabled={busy}>
            {busy ? 'Saving...' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
