import { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { supabaseLfe, LFE_RECORD_COLUMNS } from '../../lib/supabaseLfe.js';
import { useEvent } from '../../lib/useEvent.js';
import { DAMAGE_SCORES, DAMAGE_LABEL, observationTypesLabel, fmtDate, phOr } from '../../lib/constantsLfe.js';
import { buildReportDocxBlob } from '../../lib/reportDocxLfe.js';
import { parseReportSections } from '../../lib/reportSections.js';
import { fetchUsgsHazardFigures } from '../../lib/usgsHazardLfe.js';
import { safeHref } from '../../lib/url.js';

// Fields that live in event_meta (editable here). Name, epicentre, and
// event_datetime live on the events row itself (set at creation / on the
// admin Manage events tab) and are shown read-only below.
const META_FIELDS = [
  ['version', 'Version'],
  ['location_name', 'Location (geographical)'],
  ['magnitude', 'Magnitude (Mw)'],
  ['depth', 'Depth (km)'],
  ['faulting', 'Faulting mechanism'],
  ['max_mmi', 'Maximum MMI'],
  ['tsunami', 'Tsunami alert'],
  ['vert_deployment', 'ERP deployment'],
  ['physical_mission_deployment', 'Physical mission deployment'],
];

const EMPTY_META = Object.fromEntries([...META_FIELDS.map(([k]) => k), 'contributors'].map((k) => [k, '']));

export default function ReportGeneratorLfe() {
  const { event } = useEvent();
  const eventId = event?.id;
  const [records, setRecords] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [meta, setMeta] = useState(EMPTY_META);
  const [countrySections, setCountrySections] = useState([]);
  const [countryEntries, setCountryEntries] = useState([]);
  const [conclusions, setConclusions] = useState('');
  const [hazard, setHazard] = useState(null);
  const [genAt, setGenAt] = useState(null);
  const [genBy, setGenBy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    if (!eventId) return;
    const country = event?.country?.trim();
    const [recs, ev, cs, ce] = await Promise.all([
      supabaseLfe.from('triage_records').select(LFE_RECORD_COLUMNS).eq('event_id', eventId).eq('status', 'Approved').is('merged_into', null).order('region', { ascending: true }),
      supabaseLfe.from('event_meta').select('*').eq('event_id', eventId).maybeSingle(),
      // Case-insensitive match: events.country is free text set at creation
      // (from USGS place text or typed by hand), so it may not match a
      // country_codes row's casing exactly even when it's the same country.
      country
        ? supabaseLfe.from('country_code_sections').select('*').ilike('country', country).order('created_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      country
        ? supabaseLfe.from('country_code_entries').select('*').ilike('country', country).order('year_start', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    setLoading(false);
    if (recs.error) return setErr(recs.error.message);
    setRecords(recs.data ?? []);
    setCountrySections(cs.data ?? []);
    setCountryEntries(ce.data ?? []);
    const recordIds = (recs.data ?? []).map((r) => r.id);
    if (recordIds.length) {
      const att = await supabaseLfe.from('record_attachments').select('source_url, created_at')
        .in('record_id', recordIds).not('source_url', 'is', null);
      setAttachments(att.data ?? []);
    } else {
      setAttachments([]);
    }
    if (ev.data) {
      const m = { ...EMPTY_META };
      for (const key of Object.keys(EMPTY_META)) m[key] = ev.data[key] ?? '';
      setMeta(m);
      setConclusions(ev.data.conclusions_md ?? '');
      setGenAt(ev.data.report_generated_at ?? null);
      setGenBy(ev.data.report_generated_by ?? null);
    }
  }
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Best-effort: an event with no usgs_event_id, or a USGS outage, just
  // means this section falls back to its "AUTHOR TO ADD" placeholder.
  useEffect(() => {
    const id = event?.usgs_event_id;
    if (!id) { setHazard(null); return; }
    let cancelled = false;
    fetchUsgsHazardFigures(id)
      .then((h) => { if (!cancelled) setHazard(h); })
      .catch(() => { if (!cancelled) setHazard(null); });
    return () => { cancelled = true; };
  }, [event?.usgs_event_id]);

  const set = (key) => (e) => setMeta((m) => ({ ...m, [key]: e.target.value }));

  async function saveMeta(e) {
    e.preventDefault();
    setSaving(true); setStatus(null);
    const { error } = await supabaseLfe.from('event_meta').update({ ...meta }).eq('event_id', eventId);
    setSaving(false);
    setStatus(error ? { kind: 'err', msg: `Save failed: ${error.message}` } : { kind: 'ok', msg: 'Event details saved.' });
  }

  async function downloadDocx() {
    setBusy(true); setStatus(null);
    try {
      const fullMeta = {
        eventName: event?.name,
        country: event?.country,
        version: meta.version,
        magnitude: meta.magnitude,
        depth: meta.depth,
        locationName: meta.location_name,
        locationLatLong: event?.epicentre_lat != null && event?.epicentre_lng != null ? `${event.epicentre_lat}, ${event.epicentre_lng}` : '',
        eventDatetime: event?.event_datetime ? fmtDate(event.event_datetime) : '',
        faulting: meta.faulting,
        maxMMI: meta.max_mmi,
        tsunami: meta.tsunami,
        vertDeployment: meta.vert_deployment,
        physicalMissionDeployment: meta.physical_mission_deployment,
        contributors: meta.contributors,
      };
      const blob = await buildReportDocxBlob(records, fullMeta, conclusions, {
        sections: countrySections, entries: countryEntries,
        attachments, usgsEventId: event?.usgs_event_id, hazard,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ERP_${(event?.name || 'event').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (ex) {
      setStatus({ kind: 'err', msg: `Word export failed: ${ex.message ?? ex}` });
    } finally { setBusy(false); }
  }

  const approved = records;
  const buildings = useMemo(() => approved.filter((r) => (r.observation_types || []).includes('building')), [approved]);
  const damageCounts = useMemo(() => {
    const c = {}; for (const s of DAMAGE_SCORES) c[s] = 0;
    for (const r of buildings) if (DAMAGE_SCORES.includes(Number(r.damage_score))) c[Number(r.damage_score)] += 1;
    return c;
  }, [buildings]);
  const totalDmg = Object.values(damageCounts).reduce((a, b) => a + b, 0);
  const typeCounts = useMemo(() => {
    const c = {};
    for (const r of approved) {
      for (const t of (r.observation_types?.length ? r.observation_types : ['other'])) c[t] = (c[t] || 0) + 1;
    }
    return c;
  }, [approved]);
  const nsCount = useMemo(() => approved.filter((r) => r.nonstructural_damage).length, [approved]);
  const regions = useMemo(() => [...new Set(approved.map((r) => r.region).filter(Boolean))], [approved]);
  // Every observation and attachment already carries a source URL - compile
  // a de-duplicated, dated list rather than leaving this to the author.
  const references = useMemo(() => {
    const earliest = new Map();
    const note = (url, date) => {
      if (!url) return;
      const prev = earliest.get(url);
      if (!prev || (date && new Date(date) < new Date(prev))) earliest.set(url, date);
    };
    for (const r of approved) note(r.source_url, r.created_at);
    for (const a of attachments) note(a.source_url, a.created_at);
    const list = [...earliest.entries()].sort((a, b) => new Date(a[1]) - new Date(b[1]))
      .map(([url, date]) => ({ url, date }));
    if (event?.usgs_event_id) {
      list.unshift({ url: `https://earthquake.usgs.gov/earthquakes/eventpage/${event.usgs_event_id}`, date: null, label: 'USGS event page' });
    }
    return list;
  }, [approved, attachments, event?.usgs_event_id]);
  // url -> its fixed position (1-based) in the references list above, so an
  // inline superscript always points at the right entry - since it's a
  // lookup rather than a typed-in number, adding more references anywhere
  // else in the report can never throw the existing citations out of sync.
  const refIndex = useMemo(() => new Map(references.map((r, i) => [r.url, i + 1])), [references]);
  const usgsEventPageUrl = event?.usgs_event_id ? `https://earthquake.usgs.gov/earthquakes/eventpage/${event.usgs_event_id}` : null;
  const Cite = ({ url }) => {
    const n = url ? refIndex.get(url) : undefined;
    if (!n) return null;
    return <sup className="report-cite"><a href={`#ref-${n}`}>{n}</a></sup>;
  };
  const parsed = useMemo(() => parseReportSections(conclusions), [conclusions]);
  const sec = parsed?.structured ? parsed.sections : null;
  // conclusions_md is meant to be pipeline-written only, but the base RLS
  // policy can't express "everyone can edit this row except these three
  // columns" - a trigger closes that gap server-side (see
  // 0022_protect_event_meta_report_fields.sql). Sanitizing here too is
  // defence in depth against any HTML/script that ends up in the AI-drafted
  // sections before being rendered via dangerouslySetInnerHTML.
  const mdHtml = (t) => DOMPurify.sanitize(marked.parse(String(t || '')));
  const plainConcl = sec ? sec.conclusions : (parsed && !parsed.structured ? parsed.markdown : '');
  const hazardFigList = useMemo(() => {
    if (!hazard) return [];
    return [
      [hazard.intensityUrl, 'USGS ShakeMap - macroseismic intensity (MMI).'],
      [hazard.pgaUrl, 'USGS ShakeMap - peak ground acceleration (PGA).'],
      [hazard.pgvUrl, 'USGS ShakeMap - peak ground velocity (PGV).'],
      [hazard.liquefactionUrl, 'USGS Ground Failure - liquefaction probability.'],
      [hazard.landslideUrl, 'USGS Ground Failure - landslide probability.'],
    ].filter(([url]) => url);
  }, [hazard]);

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
            {META_FIELDS.map(([key, label]) => (
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

      <div className="report-doc">
        <div className="report-eyebrow">EARTHQUAKE RECONNAISSANCE PROGRAMME</div>
        <div className="report-title">Significant Event Report</div>
        <div className="report-sub">ERP {event?.name || 'Event'} - Version {meta.version || '1.0'}</div>

        <table className="report-metatable">
          <tbody>
            {[
              ['Magnitude (Mw)', meta.magnitude], ['Depth (km)', meta.depth],
              ['Location (geographical)', meta.location_name],
              ['Location (lat/long)', event?.epicentre_lat != null ? `${event.epicentre_lat}, ${event.epicentre_lng}` : ''],
              ['Time and date', event?.event_datetime ? fmtDate(event.event_datetime) : ''], ['Faulting mechanism', meta.faulting],
              ['Maximum Modified Mercalli Intensity', meta.max_mmi], ['Tsunami alert issued', meta.tsunami],
              ['ERP deployment', meta.vert_deployment], ['Physical mission deployment', meta.physical_mission_deployment],
            ].map(([k, v]) => (<tr key={k}><th>{k}</th><td>{phOr(v)}</td></tr>))}
          </tbody>
        </table>

        <h2 className="report-h2">Contributors to this report</h2>
        {meta.contributors ? (
          <p>This report was written with the voluntary contributions of the following people: {meta.contributors}</p>
        ) : (
          <div className="report-ph">AUTHOR TO ADD: names and affiliations of contributors (set on Event details above).</div>
        )}

        {conclusions && (
          <p className="report-note">
            AI-assisted commentary throughout, drafted from the verified observations only{genBy ? `, by ${genBy}` : ''}
            {genAt ? ` on ${fmtDate(genAt)}` : ''}. Review before use.
          </p>
        )}

        <h2 className="report-h2">Introduction {sec?.introduction && <span className="ai-tag">AI</span>}</h2>
        {sec?.introduction && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(sec.introduction) }} />}
        <div className="report-ph">
          AUTHOR TO ADD: event background and seismotectonic setting.
          {!event?.usgs_event_id && " Set the event's USGS event id (Manage events -> Edit) to auto-pull ShakeMap and ground-failure figures here."}
        </div>

        {hazardFigList.length > 0 && (
          <>
            <h3 className="report-h3">Key Event Graphics</h3>
            {hazardFigList.map(([url, label]) => {
              figNo += 1;
              return (
                <figure className="report-fig" key={url}>
                  <img src={url} alt="" />
                  <figcaption>Figure {figNo}. {label} <Cite url={usgsEventPageUrl} /></figcaption>
                </figure>
              );
            })}
          </>
        )}

        <h2 className="report-h2">Seismic Code and Retrofit History{event?.country ? ` - ${event.country}` : ''}</h2>
        {countrySections.length > 0 ? (
          countrySections.map((s) => (
            <div key={s.id}>
              <h3 className="report-h3">{s.title}</h3>
              {s.body_md && <div className="report-body" dangerouslySetInnerHTML={{ __html: mdHtml(s.body_md) }} />}
            </div>
          ))
        ) : (
          <div className="report-ph">
            {event?.country
              ? `AUTHOR TO ADD: no Codes & standards entry found yet for ${event.country} - add it in the Codes & standards tab so this and future events for that country benefit.`
              : "AUTHOR TO ADD: seismic code and retrofit history for this event's country. Set the event's country (Manage events -> Edit) and add an entry in the Codes & standards tab to have this pulled in automatically."}
          </div>
        )}
        {countryEntries.length > 0 && (
          <table className="report-table">
            <thead><tr><th>Year(s)</th><th>Code</th><th>Description</th></tr></thead>
            <tbody>
              {countryEntries.map((en) => (
                <tr key={en.id}>
                  <td>{en.year_start}{en.year_end ? `–${en.year_end}` : ''}</td>
                  <td>{en.title}</td>
                  <td>{en.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

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
        <p className="muted small">A record can carry more than one type, so counts may sum to more than the total.</p>
        <table className="report-table">
          <thead><tr><th>Observation type</th><th>Count</th></tr></thead>
          <tbody>{Object.entries(typeCounts).map(([k, v]) => <tr key={k}><td>{observationTypesLabel([k])}</td><td>{v}</td></tr>)}</tbody>
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
                  <figcaption>Figure {figNo}. Site #{photo.site_id ?? '-'}, {region}: {DAMAGE_LABEL[photo.damage_score]?.split(' - ')[0] ?? ''}{photo.failure_mechanism ? ` - ${photo.failure_mechanism}` : ''}. <Cite url={photo.source_url} /></figcaption>
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
        {references.length > 0 ? (
          <ol className="report-refs">
            {references.map((ref, i) => (
              <li key={ref.url} id={`ref-${i + 1}`}>
                {ref.label ? `${ref.label}: ` : ''}
                {safeHref(ref.url) ? <a href={ref.url} target="_blank" rel="noreferrer">{ref.url}</a> : ref.url}
                {ref.date ? ` (retrieved ${fmtDate(ref.date)})` : ''}
              </li>
            ))}
          </ol>
        ) : (
          <div className="report-ph">AUTHOR TO ADD: references, e.g. GeoNet, JMA, NZSEE guidance, cited literature.</div>
        )}
      </div>
    </div>
  );
}
