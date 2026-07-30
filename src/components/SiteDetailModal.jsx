import { useEffect, useState } from 'react';
import { supabase, MEDIA_BUCKET } from '../lib/supabase.js';
import { DAMAGE_COLOR, DAMAGE_LABEL, SOURCE_LABEL, OBSERVATION_LABEL } from '../lib/constants.js';

/**
 * Detail view for an already-triaged site. Shows the primary record plus every
 * attachment (extra photos, source links, notes) added by hand or folded in
 * from a merged duplicate, and lets an engineer add more.
 */
export default function SiteDetailModal({ record, reviewer, onClose }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function loadAttachments() {
    setLoading(true);
    const { data, error } = await supabase
      .from('record_attachments')
      .select('id, media_url, source_url, note, added_by, created_at')
      .eq('record_id', record.id)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) return setErr(error.message);
    setAttachments(data ?? []);
  }
  useEffect(() => { loadAttachments(); }, [record.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function add(e) {
    e.preventDefault();
    if (!file && !sourceUrl.trim() && !note.trim()) return;
    setBusy(true);
    setErr('');
    try {
      let mediaUrl = null;
      if (file) {
        const path = `${record.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
        const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
        if (up.error) throw up.error;
        mediaUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const { error } = await supabase.from('record_attachments').insert({
        record_id: record.id,
        media_url: mediaUrl,
        source_url: sourceUrl.trim() || null,
        note: note.trim() || null,
        added_by: reviewer,
      });
      if (error) throw error;
      setNote(''); setSourceUrl(''); setFile(null);
      loadAttachments();
    } catch (ex) {
      setErr(`Add failed: ${ex.message ?? ex}`);
    } finally {
      setBusy(false);
    }
  }

  const aiColor = DAMAGE_COLOR[record.damage_score] ?? '#9e9e9e';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>{record.region ?? 'Unspecified region'}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="body">
          <div>
            <span className="ai-badge" style={{ background: aiColor }}>D{record.damage_score ?? '-'}</span>{' '}
            <span className="obs-badge">{OBSERVATION_LABEL[record.observation_type] ?? 'Building'}</span>{' '}
            <span className="obs-badge">{SOURCE_LABEL[record.source_type] ?? 'Other'}</span>

            {record.media_url && (
              <a href={record.source_url ?? record.media_url} target="_blank" rel="noreferrer">
                <img className="media" src={record.media_url} alt="Primary" loading="lazy" />
              </a>
            )}
            <p className="kv"><b>Damage:</b> {DAMAGE_LABEL[record.damage_score] ?? '-'}</p>
            <p className="kv"><b>Mechanism:</b> {record.failure_mechanism ?? '-'}</p>
            {record.code_era && <p className="kv"><b>Code era:</b> {record.code_era}</p>}
            {record.engineer_notes && <p className="kv"><b>Notes:</b> {record.engineer_notes}</p>}
            <p className="kv"><b>Verified by:</b> {record.reviewed_by ?? '-'}</p>
          </div>

          <div>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>
              Additional information ({attachments.length})
            </h3>
            {loading ? (
              <p className="muted">Loading...</p>
            ) : attachments.length === 0 ? (
              <p className="muted small">Nothing added yet.</p>
            ) : (
              <div className="attach-list">
                {attachments.map((a) => (
                  <div key={a.id} className="attach">
                    {a.media_url && (
                      <a href={a.media_url} target="_blank" rel="noreferrer">
                        <img src={a.media_url} alt="Attachment" loading="lazy" />
                      </a>
                    )}
                    {a.source_url && (
                      <a className="src-link" href={a.source_url} target="_blank" rel="noreferrer">source link</a>
                    )}
                    {a.note && <p className="note">{a.note}</p>}
                    <span className="by">added by {a.added_by ?? 'unknown'}</span>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={add} className="attach-form">
              <h3 style={{ fontSize: 14, marginBottom: 6 }}>Add to this site</h3>
              <div className="field">
                <label>Photo</label>
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="field">
                <label>Source link</label>
                <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="field">
                <label>Note</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Extra observation, context, correction..." />
              </div>
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Adding...' : 'Add information'}</button>
              {err && <p className="status-line err">{err}</p>}
            </form>
          </div>
        </div>

        <div className="foot">
          <span className="grow" />
          <button className="btn secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
