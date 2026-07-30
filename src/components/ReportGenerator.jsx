import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { supabase, RECORD_COLUMNS, EVENT_META_ID, EVENT_META_MAP, metaRowToCamel } from '../lib/supabase.js';
import { buildReport } from '../lib/report.js';

// Fallback used only if the event_meta row has not been created yet.
const DEFAULT_META = {
  eventName: '2026 Kumamoto Earthquake', version: '1.0', magnitude: 'Mw 7.0',
  depth: '10', locationName: 'Kumamoto Prefecture, Kyushu, Japan',
  locationLatLong: '32.79N, 130.74E', eventDatetime: '[to confirm]',
  faulting: '[to confirm]', maxMMI: '[to confirm]', tsunami: 'No',
  contributors: '[VERT volunteer names and affiliations]',
};

/**
 * Team-lead view: pulls all 'Approved' records plus the shared event metadata,
 * synthesises statistics, injects them into the NZSEE LFE Markdown template,
 * previews the result, and offers a client-side .md download. Event facts are
 * edited in the Event details tab, not here.
 */
export default function ReportGenerator() {
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [loading, setLoading] = useState(true);
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

  function download() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `VERT_${(meta.eventName || 'event').replace(/\s+/g, '_')}_draft_${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
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
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Event metadata</h2>
        <p className="muted small">Edit these in the Event details tab. Shown here for reference.</p>
        <div className="report-meta readonly">
          {EVENT_META_MAP.map(([, key, label]) => (
            <div key={key}>
              <label>{label}</label>
              <div className="ro-value">{meta[key] || '-'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="report-actions">
        <button className="btn" onClick={download} disabled={loading}>
          Download draft report (.md)
        </button>
        <span className="muted">Rendered entirely client-side, no server processing.</span>
      </div>

      <h2 style={{ fontSize: 17 }}>Preview</h2>
      <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
