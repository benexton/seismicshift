import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import {
  supabase, RECORD_COLUMNS, EVENT_META_ID, EVENT_META_MAP,
  metaRowToCamel, camelToMetaRow,
} from '../lib/supabase.js';
import { buildReport } from '../lib/report.js';

const EMPTY = Object.fromEntries(EVENT_META_MAP.map(([, key]) => [key, '']));

/**
 * Report generator, now also the single home for the event metadata. The
 * metadata form reads and writes the one event_meta row (Save), and the same
 * values feed the LFE draft below. Approved records supply the statistics.
 */
export default function ReportGenerator({ reviewer }) {
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const [recs, ev] = await Promise.all([
        supabase.from('triage_records').select(RECORD_COLUMNS).eq('status', 'Approved').order('region', { ascending: true }),
        supabase.from('event_meta').select('*').eq('id', EVENT_META_ID).maybeSingle(),
      ]);
      setLoading(false);
      if (recs.error) return setErr(recs.error.message);
      setRecords(recs.data ?? []);
      if (ev.data) setMeta(metaRowToCamel(ev.data));
    })();
  }, []);

  const markdown = useMemo(() => buildReport(records, meta), [records, meta]);
  const html = useMemo(() => marked.parse(markdown), [markdown]);

  const set = (key) => (e) => setMeta((m) => ({ ...m, [key]: e.target.value }));

  async function saveMeta(e) {
    e.preventDefault();
    setSaving(true); setStatus(null);
    const row = { ...camelToMetaRow(meta), updated_by: reviewer, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('event_meta').upsert(row, { onConflict: 'id' });
    setSaving(false);
    setStatus(error ? { kind: 'err', msg: `Save failed: ${error.message}` } : { kind: 'ok', msg: 'Event details saved.' });
  }

  function download() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `VERT_${(meta.eventName || 'event').replace(/\s+/g, '_')}_draft_${stamp}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="report-wrap">
      <h1>Report generator</h1>
      <p className="muted">
        {loading
          ? 'Loading approved records...'
          : `${records.length} approved observation(s) will be synthesised into the draft.`}
        {err && <span style={{ color: '#b42318' }}> · {err}</span>}
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Event details</h2>
        <p className="muted small">The key facts for this earthquake. Saved once here and used in the report header.</p>
        <form onSubmit={saveMeta}>
          <div className="report-meta">
            {EVENT_META_MAP.filter(([col]) => col !== 'contributors').map(([, key, label]) => (
              <div key={key}>
                <label htmlFor={key}>{label}</label>
                <input id={key} type="text" value={meta[key] ?? ''} onChange={set(key)} />
              </div>
            ))}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="contributors">Contributors</label>
              <input id="contributors" type="text" value={meta.contributors ?? ''} onChange={set('contributors')} />
            </div>
          </div>
          <div className="report-actions">
            <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save event details'}</button>
            {status && <span className={`status-line ${status.kind}`}>{status.msg}</span>}
          </div>
        </form>
      </div>

      <div className="report-actions">
        <button className="btn" onClick={download} disabled={loading}>Download draft report (.md)</button>
        <span className="muted">Rendered entirely client-side, no server processing.</span>
      </div>

      <h2 style={{ fontSize: 17 }}>Preview</h2>
      <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
