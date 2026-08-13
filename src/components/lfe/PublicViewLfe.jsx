import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import ClusterGroup from '../ClusterGroup.jsx';
import FilterBarLfe from './FilterBarLfe.jsx';
import RecordTableLfe from './RecordTableLfe.jsx';
import Zoomable from '../Zoomable.jsx';
import { downloadFile } from '../../lib/mediaLfe.js';
import { emptyFilter, matchesFilter } from '../../lib/filterLfe.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, observationTypesLabel, HEIGHT_CLASSES, cap, fmtDate, BASEMAP_PRESETS,
} from '../../lib/constantsLfe.js';

// Fully anonymous, zero-auth, zero-DB-query - same pattern as Kumamoto's
// PublicView.jsx. First fetches the events-index manifest (every is_public
// event), then the selected event's own snapshot. Both are static files
// written by scripts/lfe/export_public.py.
const SUPA = import.meta.env.PUBLIC_LFE_SUPABASE_URL || '';
const BUCKET_BASE = `${SUPA}/storage/v1/object/public/lfe-observation-media`;
const INDEX_URL = `${BUCKET_BASE}/public/events-index.json`;

// Used for the combined "all events" view, which has no single event to take
// a basemap preset from - esri_world_imagery and osm, not gsi_photo, since
// GSI's aerial tiles only cover Japan and would render blank everywhere else.
const DEFAULT_BASEMAP_OPTIONS = [
  ['esri_world_imagery', BASEMAP_PRESETS.esri_world_imagery],
  ['osm', BASEMAP_PRESETS.osm],
];

const DISCLAIMERS = [
  {
    title: 'Before you continue - please read',
    body: (
      <>
        <p><b>This is a Beta tool.</b> This Virtual Earthquake Reconnaissance Team (VERT) triage tool is under active development and is intended to eventually be hosted on the NZSEE website.</p>
        <p>Observations were captured within a short time frame following each event. NZSEE volunteers have made every effort to triage the information accurately, and copyright has been attributed where possible. Please contact NZSEE for any corrections or amendments.</p>
        <p>This work does <b>not</b> represent the work of Seismic Shift or the views of the company. The Seismic Shift website is being used only to host this beta version of the tool during development.</p>
        <p>All information is preliminary and provided as-is, without warranty. It should not be relied upon for engineering, insurance, safety, or commercial decisions.</p>
      </>
    ),
    button: 'I understand',
  },
  {
    title: 'About the triaged sites',
    body: (
      <>
        <p>The triaged sites shown here have been <b>verified</b> by NZSEE volunteers.</p>
        <p>Some markers appear <b>over water</b>. For these sites, all of the observation information has been verified, but the exact location could not be determined - so placeholder coordinates over water have been used. The site information itself is still valid; only the mapped position is a placeholder. Please contact NZSEE if you can help locate these sites.</p>
        <p>If you have further information, corrections, or amendments for any site, please contact NZSEE.</p>
      </>
    ),
    button: 'View the sites',
  },
];

function heightLabel(v) { return HEIGHT_CLASSES.find((h) => h.value === v)?.label ?? v; }

function KV({ label, children }) {
  if (children === null || children === undefined || children === '' || children === false) return null;
  return (<div className="pub-kv"><span className="pub-k">{label}</span><span className="pub-v">{children}</span></div>);
}

function PublicDetail({ site, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>Site #{site.site_id}{site.region ? ` - ${site.region}` : ''}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="body pub-detail">
          {site.media_url && <Zoomable className="pub-media" src={site.media_url} alt="Site photo" />}

          <div className="pub-grid">
            <KV label="Classification">{DAMAGE_LABEL[site.damage_score] ?? '-'}</KV>
            <KV label="Observation type">{observationTypesLabel(site.observation_types)}</KV>
            <KV label="Building">{site.building_name}</KV>
            <KV label="Building type">{site.building_type ? cap(site.building_type) : ''}</KV>
            <KV label="Primary material">{site.primary_material ? cap(site.primary_material) : ''}</KV>
            <KV label="Height">{site.height_class ? heightLabel(site.height_class) : ''}</KV>
            <KV label="Code era">{site.code_era ? cap(site.code_era) : ''}</KV>
            <KV label="Failure mechanism">{site.failure_mechanism}</KV>
            <KV label="Non-structural damage">{site.nonstructural_damage ? 'Yes' : 'No'}</KV>
            <KV label="Location confidence">{site.location_confidence ? cap(site.location_confidence) : ''}</KV>
            <KV label="Address">{site.address}</KV>
            <KV label="Coordinates">{(site.lat != null && site.lng != null) ? `${site.lat}, ${site.lng}` : ''}</KV>
          </div>

          {site.engineer_notes && <div className="pub-notes"><span className="pub-k">Notes</span><p>{site.engineer_notes}</p></div>}

          <div className="pub-links">
            {site.source_url && <a href={site.source_url} target="_blank" rel="noreferrer">Source link</a>}
            {site.streetview_url && <a href={site.streetview_url} target="_blank" rel="noreferrer">Street View</a>}
          </div>

          {site.attachments?.length > 0 && (
            <>
              <h3 className="pub-sub">Attachments</h3>
              <div className="attach-list">
                {site.attachments.map((a, i) => (
                  <div key={i} className="attach">
                    <div className="attach-main">
                      {a.media_url && <Zoomable src={a.media_url} alt="Attachment" />}
                      {a.file_url && <button type="button" className="file-chip" onClick={() => downloadFile(a.file_url, a.file_name)}><span className="file-ic">FILE</span> {a.file_name || 'download'}</button>}
                      {a.source_url && <a className="src-link" href={a.source_url} target="_blank" rel="noreferrer">source link</a>}
                      {a.note && <p className="note">{a.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Imperatively fits the map to whatever's actually being shown, the same
// way TriageMapLfe/TriagedSitesLfe do - MapContainer's own center/zoom props
// only apply on its first mount, so relying on them alone leaves the map
// stuck at its initial framing (e.g. the world view) when the underlying
// records change after that, such as switching from the combined "all
// events" view into a single event, or between two different events.
function FitToData({ records }) {
  const map = useMap();
  useEffect(() => {
    if (!records.length) return;
    try {
      map.fitBounds(records.map((r) => [r.latitude, r.longitude]), { padding: [40, 40], maxZoom: 14 });
    } catch { /* ignore */ }
  }, [records.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function getInitialSlug() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('event') ?? '';
}

export default function PublicViewLfe() {
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsErr, setEventsErr] = useState('');
  const [slug, setSlug] = useState(getInitialSlug);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [allSites, setAllSites] = useState(null);
  const [allSitesLoading, setAllSitesLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(emptyFilter);
  const [view, setView] = useState('map');
  const [basemap, setBasemap] = useState('');

  useEffect(() => {
    // Deliberately does not auto-select the first event when no ?event= is
    // in the URL - with more than one public event, silently dropping a
    // visitor into an arbitrary "first" one hides that others exist. Direct
    // links (?event=slug) still go straight to that event as before.
    fetch(INDEX_URL)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((idx) => setEvents(idx?.events ?? []))
      .catch(() => setEventsErr('The list of public events could not be loaded yet. Please check back shortly.'))
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    if (!slug) return;
    setData(null); setErr('');
    fetch(`${BUCKET_BASE}/public/${slug}.json`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => setErr('The public data for this event could not be loaded yet. Please check back shortly.'));
  }, [slug]);

  useEffect(() => {
    // Combined world view: only fetched once, the first time no specific
    // event is selected and the index has finished loading, then cached in
    // allSites for the rest of the session (switching back and forth
    // between "all events" and a specific event shouldn't keep re-fetching).
    if (slug || eventsLoading || events.length === 0 || allSites !== null) return;
    let cancelled = false;
    setAllSitesLoading(true);
    Promise.all(events.map((ev) => fetch(`${BUCKET_BASE}/public/${ev.slug}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d?.sites ?? []).map((s) => ({ ...s, eventSlug: ev.slug, eventName: ev.name })))
      .catch(() => [])))
      .then((lists) => { if (!cancelled) setAllSites(lists.flat()); })
      .finally(() => { if (!cancelled) setAllSitesLoading(false); });
    return () => { cancelled = true; };
  }, [slug, eventsLoading, events, allSites]);

  function selectEvent(newSlug) {
    setSlug(newSlug);
    if (!newSlug) { setData(null); setErr(''); }
    const url = new URL(window.location.href);
    if (newSlug) url.searchParams.set('event', newSlug); else url.searchParams.delete('event');
    window.history.replaceState(null, '', url);
  }

  const activeSites = slug ? (data?.sites ?? []) : (allSites ?? []);
  const sites = useMemo(() => activeSites.filter((s) => s.lat != null && s.lng != null), [activeSites]);
  const filtered = useMemo(() => sites.filter((s) => matchesFilter(s, filter)), [sites, filter]);
  const mapRecords = useMemo(() => filtered.map((s) => ({ ...s, id: s.site_id, latitude: s.lat, longitude: s.lng })), [filtered]);

  const basemapOptions = useMemo(() => {
    if (!slug) return DEFAULT_BASEMAP_OPTIONS;
    // The admin panel only ever saves one preset onto event.basemap, so it's
    // listed first (keeping it the default selection) with the rest of
    // BASEMAP_PRESETS appended - otherwise there'd only ever be one map type
    // to switch between.
    const chosen = Object.entries(data?.event?.basemap ?? {});
    const chosenKeys = new Set(chosen.map(([k]) => k));
    const rest = Object.entries(BASEMAP_PRESETS).filter(([k]) => !chosenKeys.has(k));
    return [...chosen, ...rest];
  }, [slug, data]);
  useEffect(() => {
    setBasemap(basemapOptions[0]?.[0] ?? '');
  }, [basemapOptions]);
  const base = basemapOptions.find(([k]) => k === basemap)?.[1] ?? basemapOptions[0]?.[1];

  function renderMarker(s, pos, key, solo) {
    return (
      <CircleMarker key={key} center={pos} radius={9}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: DAMAGE_COLOR[s.damage_score] ?? '#9e9e9e', fillOpacity: 0.9 }}
        eventHandlers={{ click: () => setSelected(s) }}>
        <Tooltip direction="top">
          {solo && s.media_url && <img className="tip-thumb" src={s.media_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          {s.eventName && `${s.eventName} · `}
          {s.site_id != null && `#${s.site_id} · `}
          {DAMAGE_LABEL[s.damage_score]?.split(' - ')[0] ?? '?'} · {observationTypesLabel(s.observation_types)}
        </Tooltip>
      </CircleMarker>
    );
  }

  return (
    <div className="public-wrap">
      <header className="public-head">
        <img className="public-logo" src="/NZSEELogo.png" alt="NZSEE" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div>
          <h1>Virtual Earthquake Reconnaissance Team</h1>
          <p>
            <select value={slug} onChange={(e) => selectEvent(e.target.value)} disabled={eventsLoading || events.length === 0}>
              <option value="">Select an event...</option>
              {events.map((ev) => <option key={ev.slug} value={ev.slug}>{ev.name}</option>)}
            </select>
            {' '}· Verified sites · <span className="beta-tag">Beta</span>
          </p>
        </div>
      </header>

      {!slug && eventsLoading ? (
        <p className="muted" style={{ padding: 20 }}>Loading all events. This may take some time.</p>
      ) : (
        <>
          <FilterBarLfe filter={filter} setFilter={setFilter} shown={filtered.length} total={sites.length} view={view} setView={setView} hideSource />

          {view === 'map' ? (
            <div className="public-map-area">
              {!slug && (
                <div className="public-banner">
                  {eventsErr
                    ? eventsErr
                    : events.length === 0
                      ? 'No public events yet. Please check back shortly.'
                      : allSitesLoading
                        ? 'Loading the full dataset of all events and verified sites. This may take some time.'
                        : 'Showing every verified site across all events - select a specific event from the dropdown above to focus on just that one.'}
                </div>
              )}
              <MapContainer center={[0, 0]} zoom={2} className="triage-map" scrollWheelZoom>
                {base && <TileLayer url={base.url} attribution={base.attribution ?? ''} maxZoom={18} />}
                <FitToData records={mapRecords} />
                <ClusterGroup records={mapRecords} renderMarker={renderMarker} />
              </MapContainer>
              <div className="map-controls">
                <label htmlFor="pub-bm">Basemap</label>
                <select id="pub-bm" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
                  {basemapOptions.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="map-legend">
                <div className="legend-title">Classification</div>
                {[0, 1, 2, 3, 4, 5].map((s) => (
                  <div className="row" key={s}><span className="dot" style={{ background: DAMAGE_COLOR[s] }} />{DAMAGE_LABEL[s]}</div>
                ))}
                <div className="count">{err ? err : `${filtered.length} verified site(s)`}{slug && data?.generatedAt && !err ? ` · updated ${fmtDate(data.generatedAt)}` : ''}</div>
              </div>
            </div>
          ) : (
            <RecordTableLfe records={filtered} mode="public" onOpen={setSelected} />
          )}
        </>
      )}

      {step < DISCLAIMERS.length && (
        <div className="disclaimer-backdrop">
          <div className="disclaimer">
            <img className="disclaimer-logo" src="/NZSEELogo.png" alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <h2>{DISCLAIMERS[step].title}</h2>
            <div className="disclaimer-body">{DISCLAIMERS[step].body}</div>
            <div className="disclaimer-actions">
              <span className="muted small">Step {step + 1} of {DISCLAIMERS.length}</span>
              <button className="btn" onClick={() => setStep((n) => n + 1)}>{DISCLAIMERS[step].button}</button>
            </div>
          </div>
        </div>
      )}

      {selected && <PublicDetail site={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
