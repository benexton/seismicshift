import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import {
  supabase, RECORD_COLUMNS, EVENT_META_ID, EVENT_META_MAP,
  metaRowToCamel, camelToMetaRow,
} from '../lib/supabase.js';
import { DAMAGE_SCORES, DAMAGE_LABEL, OBSERVATION_LABEL, fmtDate } from '../lib/constants.js';
import { buildReportDocxBlob } from '../lib/reportDocx.js';
import { parseReportSections } from '../lib/reportSections.js';

const EMPTY = Object.fromEntries(EVENT_META_MAP.map(([, key]) => [key, '']));

export default function ReportGenerator({ reviewer }) {
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState(EMPTY);
  const [conclusions, setConclusions] = useState('');
  const [genAt, setGenAt] = useState(null);
  const [genBy, setGenBy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    const [recs, ev] = await Promise.all([
      supabase.from('triage_records').select(RECORD_COLUMNS).eq('status', 'Approved').is('merged_into', null).order('region', { ascending: true }),
      supabase.from('event_meta').select('*').eq('id', EVENT_META_ID).maybeSingle(),
    ]);
    setLoading(false);
    if (recs.error) return setErr(recs.error.message);
    setRecords(recs.data ?? []);
    if (ev.data) {
      setMeta(metaRowToCamel(ev.data));
      setConclusions(ev.data.conclusions_md ?? '');
      setGenAt(ev.data.report_generated_at ?? null);
      setGenBy(ev.data.report_generated_by ?? null);
    }
  }
  useEffect(() => { load(); }, []);

  const set = (key) => (e) => setMeta((m) => ({ ...m, [key]: e.target.value }));

  async function saveMeta(e) {
    e.preventDefault();
    setSaving(true); setStatus(null);
    const row = { ...camelToMetaRow(meta), updated_by: reviewer, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('event_meta').upsert(row, { onConflict: 'id' });
    setSaving(false);
    setStatus(error ? { kind: 'err', msg: `Save failed: ${error.message}` } : { kind: 'ok', msg: 'Event details saved.' });
  }

  async function downloadDocx() {
    setBusy(true); setStatus(null);
    try {
      const blob = await buildReportDocxBlob(records, meta, conclusions);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `VERT_${(meta.eventName || 'event').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Word export failed: ${ex.message ?? ex}` });
    } finally { setBusy(false); }
  }

  const approved = records;
  const buildings = useMemo(() => approved.filter((r) => r.observation_type === 'building'), [approved]);
  const damageCounts = useMemo(() => {
    const c = {}; for (const s of DAMAGE_SCORES) c[s] = 0;
    for (const r of buildings) if (DAMAGE_SCORES.includes(Number(r.damage_score))) c[Number(r.damage_score)] += 1;
    return c;
  }, [buildings]);
  const totalDmg = Object.values(damageCounts).reduce((a, b) => a + b, 0);
  const obsCounts = useMemo(() => { const c = {}; for (const r of approved) { const k = OBSERVATION_LABEL[r.observation_type] || 'Other'; c[k] = (c[k] || 0) + 1; } return c; }, [approved]);
  const nsCount = useMemo(() => approved.filter((r) => r.nonstructural_damage).length, [approved]);
  const regions = useMemo(() => [...new Set(approved.map((r) => r.region).filter(Boolean))], [approved]);
  const parsed = useMemo(() => parseReportSections(conclusions), [conclusions]);
  const sec = parsed?.structured ? parsed.sections : null;
  const mdHtml = (t) => marked.parse(String(t || ''));
  const plainConcl = sec ? sec.conclusions : (parsed && !parsed.structured ? parsed.markdown : '');

  let figNo = 0;

  return (
    <div className="report-wrap">
      <h1>Report generator</h1>
      <p className="muted">
        {loading ? 'Loading verified observations...' : `${approved.length} verified observation(s) feed this report.`}
        {err && <span style={{ color: '#b42318' }}> · {err}</span>}
      </p>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 17 }}>Event details</h2>
        <form onSubmit={saveMeta}>
          <div className="report-meta-form">
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
        <button className="btn" onClick={downloadDocx} disabled={loading || busy}>{busy ? 'Building Word file...' : 'Download as Word (.docx)'}</button>
        <button className="btn secondary" onClick={load} disabled={loading}>Refresh</button>
        <span className="muted">Generated in your browser from the verified sites.</span>
      </div>

      {/* styled preview */}
      <div className="report-doc">
        <div className="report-eyebrow">LEARNING FROM EARTHQUAKES</div>
        <div className="report-title">Significant Event Report</div>
        <div className="report-sub">VERT {meta.eventName || 'Event'} - Version {meta.version || '1.0'}</div>

        <table className="report-metatable">
          <tbody>
            {[
              ['Magnitude (Mw)', meta.magnitude], ['Depth (km)', meta.depth],
              ['Location (geographical)', meta.locationName], ['Location (lat/long)', meta.locationLatLong],
              ['Time and date', meta.eventDatetime], ['Faulting mechanism', meta.faulting],
              ['Maximum Modified Mercalli Intensity', meta.maxMMI], ['Tsunami alert issued', meta.tsunami],
            ].map(([k, v]) => (<tr key={k}><th>{k}</th><td>{v || '-'}</td></tr>))}
          </tbody>
        </table>

        {conclusions && (
          <p className="report-note">
            AI-assisted commentary throughout, drafted from the verified observations only{genBy ? `, by ${genBy}` : ''}
            {genAt ? ` on ${fmtDate(genAt)}` : ''}. Review before use.
          </p>
        )}

        <h2 className="report-h2">Introduction {sec?.introduction && <span className="ai-tag">AI</span>}</h2>
        {sec?.introduction && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(sec.introduction) }} />}
        <div className="report-ph">AUTHOR TO ADD: event background, seismotectonic setting, and any regional or shakemap figures.</div>

        <h2 className="report-h2">Summary Statistics</h2>
        <p>{approved.length} verified observation(s), including {buildings.length} building observation(s).</p>
        {sec?.overview && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(sec.overview) }} />}
        <table className="report-table">
          <thead><tr><th>Damage score</th><th>Count</th><th>Share</th></tr></thead>
          <tbody>
            {DAMAGE_SCORES.map((s) => (
              <tr key={s}>
                <td>{DAMAGE_LABEL[s]}</td>
                <td>{damageCounts[s]}</td>
                <td>{totalDmg ? `${((damageCounts[s] / totalDmg) * 100).toFixed(1)}%` : '0%'}</td>
              </tr>
            ))}
            <tr className="total"><td>Total</td><td>{totalDmg}</td><td>{totalDmg ? '100%' : '0%'}</td></tr>
          </tbody>
        </table>

        <h3 className="report-h3">Observation types</h3>
        <table className="report-table">
          <thead><tr><th>Observation type</th><th>Count</th></tr></thead>
          <tbody>{Object.entries(obsCounts).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
        </table>
        <p>Non-structural damage was flagged on {nsCount} of {approved.length} verified observation(s).</p>
        <div className="report-ph">AUTHOR TO ADD: commentary on the overall damage distribution and any notable concentrations.</div>

        <h2 className="report-h2">Observations by Region</h2>
        {regions.length === 0 && <p className="muted">No verified observations yet.</p>}
        {regions.map((region) => {
          const inRegion = approved.filter((r) => r.region === region);
          const heavy = inRegion.filter((r) => r.damage_score === 3 || r.damage_score === 4).length;
          const photo = inRegion.find((r) => r.media_url);
          if (photo) figNo += 1;
          return (
            <div key={region}>
              <h3 className="report-h3">{region}</h3>
              <p>{inRegion.length} verified observation(s), of which {heavy} were heavy-to-severe (D3-D4).</p>
              {sec?.regions && sec.regions[region] && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(sec.regions[region]) }} />}
              {photo && (
                <figure className="report-fig">
                  <img src={photo.media_url} alt="" />
                  <figcaption>Figure {figNo}. Site #{photo.site_id ?? '-'}, {region}: {DAMAGE_LABEL[photo.damage_score]?.split(' - ')[0] ?? ''}{photo.failure_mechanism ? ` - ${photo.failure_mechanism}` : ''}.</figcaption>
                </figure>
              )}
              <div className="report-ph">AUTHOR TO ADD: additional detail, photographs, and references for {region}.</div>
            </div>
          );
        })}

        <h2 className="report-h2">Observed Failure Mechanisms {sec?.mechanisms && <span className="ai-tag">AI</span>}</h2>
        {sec?.mechanisms && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(sec.mechanisms) }} />}
        <div className="report-ph">AUTHOR TO ADD: discussion of dominant failure mechanisms with supporting photographs and references.</div>

        <h2 className="report-h2">Non-structural Damage {sec?.nonstructural && <span className="ai-tag">AI</span>}</h2>
        {sec?.nonstructural && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(sec.nonstructural) }} />}
        <div className="report-ph">AUTHOR TO ADD: notes on non-structural damage (partitions, ceilings, facades, services).</div>

        <h2 className="report-h2">Notable Good Performance {sec?.goodPerformance && <span className="ai-tag">AI</span>}</h2>
        {sec?.goodPerformance && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(sec.goodPerformance) }} />}
        <div className="report-ph">AUTHOR TO ADD: examples of good performance, retrofits, or modern code compliance.</div>

        <h2 className="report-h2">Preliminary Conclusions {plainConcl && <span className="ai-tag">AI</span>}</h2>
        {plainConcl && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(plainConcl) }} />}
        <div className="report-ph">AUTHOR TO ADD: confirm conclusions and add limitations, next steps, and acknowledgements.</div>

        <h2 className="report-h2">References</h2>
        <div className="report-ph">AUTHOR TO ADD: references, e.g. USGS event page, GeoNet, JMA, NZSEE guidance, cited literature.</div>
      </div>

    </div>
  );
}
