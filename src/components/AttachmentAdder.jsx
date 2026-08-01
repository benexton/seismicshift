import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { uploadImage, uploadFile, downloadFile } from '../lib/media.js';
import Zoomable from './Zoomable.jsx';

/**
 * View a record's attachments and add more: images, files (PDF etc.), a link, or
 * a note. Staged-but-not-added selections are reported to the parent via
 * onPendingChange so it can warn before the record is closed. Existing
 * attachments can be deleted with a confirmation step.
 */
export default function AttachmentAdder({ recordId, reviewer, onPendingChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [imgKey, setImgKey] = useState(0);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  // report staged (unsaved) selections to the parent
  useEffect(() => { onPendingChange?.(images.length > 0 || files.length > 0); }, [images, files]); // eslint-disable-line

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('record_attachments')
      .select('id, media_url, source_url, file_url, file_name, note, added_by, created_at')
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
    } catch (ex) { setErr(`Add failed: ${ex.message ?? ex}`); return false; }
    finally { setBusy(false); }
  }

  async function addImages() {
    if (!images.length) return;
    setBusy(true); setErr('');
    try {
      const urls = [];
      for (const f of images) urls.push(await uploadImage(f, `${recordId}/`));
      await insertRows(urls.map((u) => ({ record_id: recordId, media_url: u, added_by: reviewer })));
      setImages([]); setImgKey((k) => k + 1);
    } catch (ex) { setErr(`Upload failed: ${ex.message ?? ex}`); } finally { setBusy(false); }
  }
  function discardImages() { setImages([]); setImgKey((k) => k + 1); }

  async function addFiles() {
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      const rows = [];
      for (const f of files) {
        const url = await uploadFile(f, `${recordId}/`);
        rows.push({ record_id: recordId, file_url: url, file_name: f.name, added_by: reviewer });
      }
      await insertRows(rows);
      setFiles([]); setFileKey((k) => k + 1);
    } catch (ex) { setErr(`Upload failed: ${ex.message ?? ex}`); } finally { setBusy(false); }
  }
  function discardFiles() { setFiles([]); setFileKey((k) => k + 1); }

  async function addLink() {
    const v = link.trim(); if (!v) return;
    if (await insertRows([{ record_id: recordId, source_url: v, added_by: reviewer }])) setLink('');
  }
  async function addNote() {
    const v = note.trim(); if (!v) return;
    if (await insertRows([{ record_id: recordId, note: v, added_by: reviewer }])) setNote('');
  }

  async function doDelete(id) {
    setBusy(true); setErr('');
    const { error } = await supabase.from('record_attachments').delete().eq('id', id);
    setBusy(false); setConfirmDel(null);
    if (error) return setErr(`Could not delete this attachment. If this is a permission error, run migration_v8.sql. (${error.message})`);
    load();
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
              <div className="attach-main">
                {a.media_url && <Zoomable src={a.media_url} alt="Attachment" />}
                {a.file_url && (
                  <button type="button" className="file-chip" onClick={() => downloadFile(a.file_url, a.file_name)}>
                    <span className="file-ic">FILE</span> {a.file_name || 'download'}
                  </button>
                )}
                {a.source_url && <a className="src-link" href={a.source_url} target="_blank" rel="noreferrer">source link</a>}
                {a.note && <p className="note">{a.note}</p>}
              </div>
              <div className="attach-meta">
                <span className="by">added by {a.added_by ?? 'unknown'}</span>
                {confirmDel === a.id ? (
                  <span className="del-confirm">
                    Delete?
                    <button className="mini danger" onClick={() => doDelete(a.id)} disabled={busy}>Yes</button>
                    <button className="mini" onClick={() => setConfirmDel(null)} disabled={busy}>No</button>
                  </span>
                ) : (
                  <button className="mini danger" onClick={() => setConfirmDel(a.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="field">
        <label>Add images</label>
        <div className="link-add">
          <input key={imgKey} type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files ?? []))} />
          <button type="button" className="mini" onClick={addImages} disabled={busy || !images.length}>
            Add {images.length > 1 ? `${images.length} images` : 'image'}
          </button>
          {images.length > 0 && <button type="button" className="mini" onClick={discardImages} disabled={busy}>Discard</button>}
        </div>
        {images.length > 0 && <span className="unsaved-hint">{images.length} image(s) selected but not added yet.</span>}
      </div>

      <div className="field">
        <label>Add files (PDF, docs, etc.)</label>
        <div className="link-add">
          <input key={fileKey} type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <button type="button" className="mini" onClick={addFiles} disabled={busy || !files.length}>
            Add {files.length > 1 ? `${files.length} files` : 'file'}
          </button>
          {files.length > 0 && <button type="button" className="mini" onClick={discardFiles} disabled={busy}>Discard</button>}
        </div>
        {files.length > 0 && <span className="unsaved-hint">{files.length} file(s) selected but not added yet.</span>}
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
