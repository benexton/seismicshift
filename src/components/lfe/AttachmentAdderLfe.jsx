import { useEffect, useState } from 'react';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { uploadImage, uploadFile, downloadFile } from '../../lib/mediaLfe.js';
import Zoomable from '../Zoomable.jsx';

/**
 * View a record's attachments and add more: images, files (PDF etc.), a link, or
 * a note. Staged-but-not-added selections are reported to the parent via
 * onPendingChange so it can warn before the record is closed. Existing
 * attachments can be deleted with a confirmation step.
 */
export default function AttachmentAdderLfe({
  recordId, reviewer, onPendingChange, primaryMediaUrl, primarySourceUrl, onPrimaryChanged,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState([]);
  const [imgSourceUrl, setImgSourceUrl] = useState('');
  const [imgSourceNa, setImgSourceNa] = useState(false);
  const [files, setFiles] = useState([]);
  const [fileSourceUrl, setFileSourceUrl] = useState('');
  const [fileSourceNa, setFileSourceNa] = useState(false);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [imgKey, setImgKey] = useState(0);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [confirmPrimary, setConfirmPrimary] = useState(null);
  // Set when "Make primary" is clicked on an older attachment that has
  // neither a source_url nor source_na - added/imported before this was
  // required, so the same choice gets asked retroactively before it can
  // become the record's primary photo.
  const [needsSourceFor, setNeedsSourceFor] = useState(null);
  const [needsSourceUrl, setNeedsSourceUrl] = useState('');
  const [needsSourceNa, setNeedsSourceNa] = useState(false);

  // report staged (unsaved) selections to the parent
  useEffect(() => { onPendingChange?.(images.length > 0 || files.length > 0); }, [images, files]); // eslint-disable-line

  async function load() {
    setLoading(true);
    const { data, error } = await supabaseLfe
      .from('record_attachments')
      .select('id, media_url, source_url, source_na, file_url, file_name, note, added_by, created_at')
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
      const { error } = await supabaseLfe.from('record_attachments').insert(rows);
      if (error) throw error;
      await load();
      return true;
    } catch (ex) { setErr(`Add failed: ${ex.message ?? ex}`); return false; }
    finally { setBusy(false); }
  }

  async function addImages() {
    if (!images.length || (!imgSourceNa && !imgSourceUrl.trim())) return;
    setBusy(true); setErr('');
    try {
      const urls = [];
      for (const f of images) urls.push(await uploadImage(f, `${recordId}/`));
      await insertRows(urls.map((u) => ({
        record_id: recordId, media_url: u, added_by: reviewer,
        source_url: imgSourceNa ? null : imgSourceUrl.trim(), source_na: imgSourceNa,
      })));
      setImages([]); setImgKey((k) => k + 1); setImgSourceUrl(''); setImgSourceNa(false);
    } catch (ex) { setErr(`Upload failed: ${ex.message ?? ex}`); } finally { setBusy(false); }
  }
  function discardImages() { setImages([]); setImgKey((k) => k + 1); setImgSourceUrl(''); setImgSourceNa(false); }

  async function addFiles() {
    if (!files.length || (!fileSourceNa && !fileSourceUrl.trim())) return;
    setBusy(true); setErr('');
    try {
      const rows = [];
      for (const f of files) {
        const url = await uploadFile(f, `${recordId}/`);
        rows.push({
          record_id: recordId, file_url: url, file_name: f.name, added_by: reviewer,
          source_url: fileSourceNa ? null : fileSourceUrl.trim(), source_na: fileSourceNa,
        });
      }
      await insertRows(rows);
      setFiles([]); setFileKey((k) => k + 1); setFileSourceUrl(''); setFileSourceNa(false);
    } catch (ex) { setErr(`Upload failed: ${ex.message ?? ex}`); } finally { setBusy(false); }
  }
  function discardFiles() { setFiles([]); setFileKey((k) => k + 1); setFileSourceUrl(''); setFileSourceNa(false); }

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
    const { error } = await supabaseLfe.from('record_attachments').delete().eq('id', id);
    setBusy(false); setConfirmDel(null);
    if (error) return setErr(`Could not delete this attachment. (${error.message})`);
    load();
  }

  // Swapping in an attachment's photo as the record's primary. If that
  // attachment also carries its own source link (different from the current
  // primary one), the caller decides whether to bring that along too, rather
  // than silently mismatching a new photo against the old source - hence the
  // confirm step below instead of a plain toggle. Older attachments with
  // neither a source_url nor source_na (added before either was required)
  // get asked for one now, before they can become the primary photo.
  function requestPrimary(a) {
    if (!a.media_url || a.media_url === primaryMediaUrl) return;
    if (!a.source_url && !a.source_na) { setNeedsSourceFor(a); return; }
    if (a.source_url && a.source_url !== primarySourceUrl) setConfirmPrimary(a);
    else setPrimary(a, false);
  }

  async function resolveMissingSourceAndContinue() {
    if (!needsSourceFor || (!needsSourceNa && !needsSourceUrl.trim())) return;
    setBusy(true); setErr('');
    try {
      const patch = { source_url: needsSourceNa ? null : needsSourceUrl.trim(), source_na: needsSourceNa };
      const { error } = await supabaseLfe.from('record_attachments').update(patch).eq('id', needsSourceFor.id);
      if (error) throw error;
      const updated = { ...needsSourceFor, ...patch };
      setItems((its) => its.map((it) => (it.id === updated.id ? updated : it)));
      setNeedsSourceFor(null); setNeedsSourceUrl(''); setNeedsSourceNa(false);
      if (updated.source_url && updated.source_url !== primarySourceUrl) setConfirmPrimary(updated);
      else setPrimary(updated, false);
    } catch (ex) { setErr(`Could not save source. (${ex.message ?? ex})`); }
    finally { setBusy(false); }
  }

  async function setPrimary(a, alsoSwapSource) {
    setBusy(true); setErr(''); setConfirmPrimary(null);
    try {
      const patch = { media_url: a.media_url };
      if (alsoSwapSource) patch.source_url = a.source_url;
      const { error: e1 } = await supabaseLfe.from('triage_records').update(patch).eq('id', recordId);
      if (e1) throw e1;

      // The outgoing primary photo/link moves into this attachment's slot
      // instead of being discarded - if nothing is left on the row after
      // that (it only ever held this one photo), delete it rather than
      // leaving an empty husk.
      const leftoverMedia = primaryMediaUrl ?? null;
      const leftoverSource = alsoSwapSource ? (primarySourceUrl ?? null) : a.source_url;
      if (!leftoverMedia && !leftoverSource && !a.file_url && !a.note) {
        const { error: e2 } = await supabaseLfe.from('record_attachments').delete().eq('id', a.id);
        if (e2) throw e2;
      } else {
        const attPatch = { media_url: leftoverMedia, ...(alsoSwapSource ? { source_url: leftoverSource } : {}) };
        const { error: e2 } = await supabaseLfe.from('record_attachments').update(attPatch).eq('id', a.id);
        if (e2) throw e2;
      }
      await load();
      onPrimaryChanged?.(patch);
    } catch (ex) { setErr(`Could not set as primary. (${ex.message ?? ex})`); }
    finally { setBusy(false); }
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
                {!a.source_url && a.source_na && <span className="muted small">No source (N/A)</span>}
                {a.note && <p className="note">{a.note}</p>}
              </div>
              <div className="attach-meta">
                <span className="by">added by {a.added_by ?? 'unknown'}</span>
                {needsSourceFor?.id === a.id || confirmPrimary?.id === a.id ? null : confirmDel === a.id ? (
                  <span className="del-confirm">
                    Delete?
                    <button className="mini danger" onClick={() => doDelete(a.id)} disabled={busy}>Yes</button>
                    <button className="mini" onClick={() => setConfirmDel(null)} disabled={busy}>No</button>
                  </span>
                ) : (
                  <>
                    {a.media_url && a.media_url !== primaryMediaUrl && (
                      <button className="mini" onClick={() => requestPrimary(a)} disabled={busy}>Make primary</button>
                    )}
                    <button className="mini danger" onClick={() => setConfirmDel(a.id)}>Delete</button>
                  </>
                )}
              </div>
              {/* Full-width blocks rather than squeezed into .attach-meta's
                  narrow row - that column is only wide enough for a couple
                  of short buttons, not a whole form. */}
              {needsSourceFor?.id === a.id && (
                <div className="source-prompt">
                  <p>No source on file for this photo.</p>
                  <div className="link-add">
                    <input type="text" value={needsSourceUrl} onChange={(e) => setNeedsSourceUrl(e.target.value)}
                      placeholder="Source URL..." disabled={needsSourceNa} />
                    <label className="check-label small">
                      <input type="checkbox" checked={needsSourceNa}
                        onChange={(e) => { setNeedsSourceNa(e.target.checked); if (e.target.checked) setNeedsSourceUrl(''); }} />
                      N/A
                    </label>
                  </div>
                  <div className="source-prompt-actions">
                    <button className="mini" onClick={() => { setNeedsSourceFor(null); setNeedsSourceUrl(''); setNeedsSourceNa(false); }} disabled={busy}>Cancel</button>
                    <button className="mini" onClick={resolveMissingSourceAndContinue}
                      disabled={busy || (!needsSourceNa && !needsSourceUrl.trim())}>Continue</button>
                  </div>
                </div>
              )}
              {confirmPrimary?.id === a.id && (
                <div className="source-prompt">
                  <p>Also make this the primary source link?</p>
                  <div className="source-prompt-actions">
                    <button className="mini" onClick={() => setConfirmPrimary(null)} disabled={busy}>Cancel</button>
                    <button className="mini" onClick={() => setPrimary(a, false)} disabled={busy}>Just the photo</button>
                    <button className="mini" onClick={() => setPrimary(a, true)} disabled={busy}>Yes, both</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="field">
        <label>Add images</label>
        <div className="link-add">
          <input key={imgKey} type="file" accept="image/*" multiple onChange={(e) => setImages(Array.from(e.target.files ?? []))} />
          <button type="button" className="mini" onClick={addImages} disabled={busy || !images.length || (!imgSourceNa && !imgSourceUrl.trim())}>
            Add {images.length > 1 ? `${images.length} images` : 'image'}
          </button>
          {images.length > 0 && <button type="button" className="mini" onClick={discardImages} disabled={busy}>Discard</button>}
        </div>
        {images.length > 0 && (
          <div className="link-add" style={{ marginTop: 6 }}>
            <input type="text" value={imgSourceUrl} onChange={(e) => setImgSourceUrl(e.target.value)}
              placeholder="Source URL for these image(s)..." disabled={imgSourceNa} />
            <label className="check-label small">
              <input type="checkbox" checked={imgSourceNa}
                onChange={(e) => { setImgSourceNa(e.target.checked); if (e.target.checked) setImgSourceUrl(''); }} />
              N/A
            </label>
          </div>
        )}
        {images.length > 0 && <span className="unsaved-hint">{images.length} image(s) selected but not added yet.</span>}
      </div>

      <div className="field">
        <label>Add files (PDF, docs, etc.)</label>
        <div className="link-add">
          <input key={fileKey} type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          <button type="button" className="mini" onClick={addFiles} disabled={busy || !files.length || (!fileSourceNa && !fileSourceUrl.trim())}>
            Add {files.length > 1 ? `${files.length} files` : 'file'}
          </button>
          {files.length > 0 && <button type="button" className="mini" onClick={discardFiles} disabled={busy}>Discard</button>}
        </div>
        {files.length > 0 && (
          <div className="link-add" style={{ marginTop: 6 }}>
            <input type="text" value={fileSourceUrl} onChange={(e) => setFileSourceUrl(e.target.value)}
              placeholder="Source URL for these file(s)..." disabled={fileSourceNa} />
            <label className="check-label small">
              <input type="checkbox" checked={fileSourceNa}
                onChange={(e) => { setFileSourceNa(e.target.checked); if (e.target.checked) setFileSourceUrl(''); }} />
              N/A
            </label>
          </div>
        )}
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
