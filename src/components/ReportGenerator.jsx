import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import { buildReport } from '../lib/report.js';

// Event metadata defaults for the 2026 Kumamoto earthquake. These populate the
// report header and are fully editable before generating the draft.
const DEFAULT_META = {
  eventName: '2026 Kumamoto Earthquake',
  version: '1.0',
  magnitude: 'Mw 7.0',
  depth: '10',
  locationName: 'Kumamoto Prefecture, Kyushu, Japan',
  locationLatLong: '32.79°N, 130.74°E',
  eventDatetime: '[UTC / JST to confirm]',
  faulting: 'Strike-slip (to confirm)',
  maxMMI: '[to confirm]',
  lfeInterest: 'High',
  vertDeployment: 'Active',
  physicalDeployment: 'Being evaluated',
  tsunami: 'No',
  contributors: '[VERT volunteer names and affiliations]',
};

const META_FIELDS = [
  ['eventName', 'Event name'],
  ['version', 'Version'],
  ['magnitude', 'Magnitude (Mw)'],
  ['depth', 'Depth (km)'],
  ['locationName', 'Location (geographical)'],
  ['locationLatLong', 'Location (lat/long)'],
  ['eventDatetime', 'Time and date'],
  ['faulting', 'Faulting mechanism'],
  ['maxMMI', 'Maximum MMI'],
  ['tsunami', 'Tsunami alert'],
];

/**
 * Team-lead view: pulls all 'Approved' records, synthesises statistics, injects
 * them into the NZSEE LFE Markdown template, previews the result, and offers a
 * fully client-side .md download (no server round-trip).
 */
export default function ReportGenerator() {
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(DEFAULT_META);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('triage_records')
        .select(RECORD_COLUMNS)
        .eq('status', 'Approved')
        .order('region', { ascending: true });
      setLoading(false);
      if (error) {
        setErr(error.message);
        return;
      }
      setRecords(data ?? []);
    })();
  }, []);

  // Recompute the Markdown whenever data or metadata changes.
  const markdown = useMemo(() => buildReport(records, meta), [records, meta]);
  const html = useMemo(() => marked.parse(markdown), [markdown]);

  function download() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `VERT_${meta.eventName.replace(/\s+/g, '_')}_draft_${stamp}.md`;
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
          ? 'Loading approved records…'
          : `${records.length} approved observation(s) will be synthesised into the draft.`}
        {err && <span style={{ color: '#b42318' }}> · {err}</span>}
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Event metadata</h2>
        <div className="report-meta">
          {META_FIELDS.map(([key, label]) => (
            <div key={key}>
              <label htmlFor={key}>{label}</label>
              <input
                id={key}
                type="text"
                value={meta[key]}
                onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="contributors">Contributors</label>
            <input
              id="contributors"
              type="text"
              value={meta.contributors}
              onChange={(e) => setMeta((m) => ({ ...m, contributors: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="report-actions">
        <button className="btn" onClick={download} disabled={loading}>
          Download draft report (.md)
        </button>
        <span className="muted">Rendered entirely client-side — no server processing.</span>
      </div>

      <h2 style={{ fontSize: 17 }}>Preview</h2>
      <div className="preview" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
