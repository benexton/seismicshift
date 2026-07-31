import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { uploadImage } from '../lib/media.js';
import Zoomable from './Zoomable.jsx';

/**
 * View a record's attachments and add more: multiple images at once, a source
 * link, or a note. Used by both the triage review panel and the triaged-site
 * detail panel so editing capability is identical in both places.
 */
export default function AttachmentAdder({ recordId, reviewer }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('record_attachments')
      .select('id, media_url, source_url, note, added_by, created_at')
      .eq('record_id', recordId)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (error) return setErr(error.message);
    setItems(data ?? []);
  }
  useEffect(() => { load(); }, [recordId]);

  async function insertRows(rows) {
    setBusy(true); setErr('');
    try {
      const { error } = await supabase.from('record_attachments').insert(rows);
      if (error) throw error;
      await load();
      return true;
    } catch (ex) {
      setErr(`Add failed: ${ex.message ?? ex}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addImages() {
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      const urls = [];
      for (const f of files) urls.push(await uploadImage(f, `${recordId}/`));
      await insertRows(urls.map((u) => ({ record_id: recordId, media_url: u, added_by: reviewer })));
      setFiles([]);
    } catch (ex) {
      setErr(`Upload failed: ${ex.message ?? ex}`);
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    const v = link.trim();
    if (!v) return;
    if (await insertRows([{ record_id: recordId, source_url: v, added_by: reviewer }])) setLink('');
  }

  async function addNote() {
    const v = note.trim();
    if (!v) return;
    if (await insertRows([{ record_id: recordId, note: v, added_by: reviewer }])) setNote('');
  }

  return (
    <div className="attach-block-wrap">
      <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>Attachments ({items.length})</h3>
      {loading ? (
        <p className="muted small">Loading...</p>
      ) : items.length === 0 ? (
        <p className="muted small">None yet.</p>
      ) : (
        <div className="attach-list">
          {items.map((a) => (
            <div key={a.id} className="attach">
              {a.media_url && (
                <a href={a.media_url} target="_blank" rel="noreferrer">
                  <img src={a.media_url} alt="Attachment" loading="lazy" />
                </a>
              )}
              {a.source_url && <a className="src-link" href={a.source_url} target="_blank" rel="noreferrer">source link</a>}
              {a.note && <p className="note">{a.note}</p>}
              <span className="by">added by {a.added_by ?? 'unknown'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="field">
        <label>Add images</label>
        <div className="link-add">
          <input type="file" accept="image/*" multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <button type="button" className="mini" onClick={addImages} disabled={busy || !files.length}>
            Add {files.length > 1 ? `${files.length} images` : 'image'}
          </button>
        </div>
      </div>

      <div className="field">
        <label>Add link</label>
        <div className="link-add">
          <input type="text" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} />
          <button type="button" className="mini" onClick={addLink} disabled={busy}>Add</button>
        </div>
      </div>

      <div className="field">
        <label>Add note</label>
        <div className="link-add">
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Extra observation..."
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }} />
          <button type="button" className="mini" onClick={addNote} disabled={busy}>Add</button>
        </div>
      </div>
      {err && <p className="status-line err">{err}</p>}
    </div>
  );
}
