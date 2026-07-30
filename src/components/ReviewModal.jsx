import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { DAMAGE_SCORES, DAMAGE_LABEL, DAMAGE_COLOR, CODE_ERAS, RETROFIT_OPTIONS } from '../lib/report.js';

/**
 * Modal for reviewing a single triage record. Shows the source imagery and the
 * AI's structural tags, lets the engineer override the classification and add
 * notes, then Approve or Reject — both of which set status and remove the pin
 * from the active queue via the parent's `onResolved` callback.
 *
 * @param {object}   props
 * @param {object}   props.record      The selected triage_records row.
 * @param {string}   props.reviewer    Signed-in engineer identifier (email).
 * @param {Function} props.onClose     Close without changing status.
 * @param {Function} props.onResolved  (recordId, newStatus) => void.
 */
export default function ReviewModal({ record, reviewer, onClose, onResolved }) {
  const [damageScore, setDamageScore] = useState(record.damage_score ?? 0);
  const [codeEra, setCodeEra] = useState(record.code_era ?? 'unknown');
  const [mechanism, setMechanism] = useState(record.failure_mechanism ?? '');
  const [retrofit, setRetrofit] = useState(record.observed_retrofits ?? 'none');
  const [notes, setNotes] = useState(record.engineer_notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Close on Escape.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function resolve(newStatus) {
    setBusy(true);
    setErr('');
    // Persist the engineer's (possibly overridden) classification + decision.
    const { error } = await supabase
      .from('triage_records')
      .update({
        damage_score: Number(damageScore),
        code_era: codeEra,
        failure_mechanism: mechanism || null,
        observed_retrofits: retrofit || null,
        engineer_notes: notes || null,
        status: newStatus,
        reviewed_by: reviewer,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', record.id);

    setBusy(false);
    if (error) {
      setErr(`Update failed: ${error.message}`);
      return;
    }
    onResolved(record.id, newStatus);
  }

  const aiColor = DAMAGE_COLOR[record.damage_score] ?? '#9e9e9e';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>{record.region ?? 'Unspecified region'}</h2>
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="body">
          {/* --- Left: source media + AI triage (read-only) --- */}
          <div>
            {record.media_url ? (
              <a href={record.source_url ?? record.media_url} target="_blank" rel="noreferrer">
                <img className="media" src={record.media_url} alt="Source media" loading="lazy" />
              </a>
            ) : (
              <p className="muted">No media URL.</p>
            )}
            <p className="kv">
              <b>AI damage score:</b>{' '}
              <span className="ai-badge" style={{ background: aiColor }}>
                D{record.damage_score ?? '—'}
              </span>{' '}
              {record.ai_confidence != null && `(${Math.round(record.ai_confidence * 100)}%)`}
            </p>
            <p className="kv"><b>AI code era:</b> {record.code_era ?? '—'}</p>
            <p className="kv"><b>AI failure mechanism:</b> {record.failure_mechanism ?? '—'}</p>
            <p className="kv"><b>AI retrofits:</b> {record.observed_retrofits ?? '—'}</p>
            <p className="kv"><b>Model:</b> {record.ai_model ?? '—'}</p>
            {record.source_url && (
              <p className="kv">
                <b>Source:</b>{' '}
                <a href={record.source_url} target="_blank" rel="noreferrer">
                  link
                </a>
              </p>
            )}
            <p className="kv">
              <b>Coords:</b> {record.latitude?.toFixed(5)}, {record.longitude?.toFixed(5)}
            </p>
          </div>

          {/* --- Right: engineer overrides --- */}
          <div>
            <div className="field">
              <label htmlFor="ds">Damage score (override)</label>
              <select id="ds" value={damageScore} onChange={(e) => setDamageScore(e.target.value)}>
                {DAMAGE_SCORES.map((s) => (
                  <option key={s} value={s}>
                    {DAMAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ce">Seismic-code era</label>
              <select id="ce" value={codeEra} onChange={(e) => setCodeEra(e.target.value)}>
                {CODE_ERAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="fm">Failure mechanism</label>
              <input
                id="fm"
                type="text"
                value={mechanism}
                onChange={(e) => setMechanism(e.target.value)}
                placeholder="e.g. soft-story collapse, out-of-plane infill failure"
              />
            </div>
            <div className="field">
              <label htmlFor="rt">Observed retrofits</label>
              <select id="rt" value={retrofit} onChange={(e) => setRetrofit(e.target.value)}>
                {RETROFIT_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="nt">Engineer notes</label>
              <textarea
                id="nt"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="RC frame behaviour, masonry infill, beam-column joints, assessment caveats…"
              />
            </div>
          </div>
        </div>

        {err && <p className="status-line err">{err}</p>}

        <div className="foot">
          <button className="btn secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <span className="grow" />
          <button className="btn-reject" onClick={() => resolve('Rejected')} disabled={busy}>
            Reject
          </button>
          <button className="btn-approve" onClick={() => resolve('Approved')} disabled={busy}>
            {busy ? 'Saving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}
