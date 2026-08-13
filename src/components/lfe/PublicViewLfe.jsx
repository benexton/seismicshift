import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import ClusterGroup from '../ClusterGroup.jsx';
import FilterBarLfe from './FilterBarLfe.jsx';
import RecordTableLfe from './RecordTableLfe.jsx';
import Zoomable from '../Zoomable.jsx';
import { downloadFile } from '../../lib/mediaLfe.js';
import { emptyFilter, matchesFilter, filterActive } from '../../lib/filterLfe.js';
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
        <p><b>This is a Beta tool.</b> This NZ Earthquake Reconnaissance Programme (ERP) triage tool is under active development and is intended to eventually be hosted on the NZSEE website.</p>
        <p>Observations were captured within a short time frame following each event. NZSEE volunteers have made every effort to triage the information accurately, and copyright has been attributed where possible. Please contact NZSEE for any corrections or amendments.</p>
        <p>This work does <b>not</b> represent the work of NZSEE or Seismic Shift or the views of either organisation. The Seismic Shift website is being used only to host this beta version of the tool during development.</p>
        <p>All information is preliminary and provided as-is, without warranty. It should not be relied upon for anything including but not limited to engineering, insurance, safety, or commercial decisions.</p>
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
        <p>This work is being carried out by volunteers, and therefore <b>it may take us some time to respond to any contact.</b></p>
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
          {site.country === 'Venezuela' && (
            <div className="report-ph" style={{ fontStyle: 'normal', margin: '0 0 14px', gridColumn: '1 / -1' }}>
              This record is from before NZSEE ERP started using this platform - some information may still be
              held in other locations. Please speak to NZSEE ERP if you are seeking more information on this location.
            </div>
          )}
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
  // A plain records.length dependency misses a refit whenever two different
  // filtered sets happen to share the same count (e.g. switching between two
  // events with an equal number of sites, or a filter swap that trades one
  // matching record for another) - the map would silently keep the previous
  // framing. Keying off the actual set of ids catches every real change;
  // site_id is only unique within one event, so it's paired with the event
  // slug for the combined "all events" view.
  const key = records.map((r) => `${r.eventSlug ?? ''}:${r.id}`).join(',');
  useEffect(() => {
    if (!records.length) return;
    try {
      // Leaflet caches its container's pixel size and only re-measures it on
      // an explicit invalidateSize() call (or a window resize event) - a
      // one-off re-measure here before fitBounds keeps the size it works
      // from as current as possible for this single pass.
      map.invalidateSize();

      // records' longitudes are already normalised for the antimeridian
      // (see mapRecords in PublicViewLfe) - markers and this fit need to
      // agree on the same shifted-or-not values, so that normalisation
      // happens once, upstream, rather than separately in here.
      const PAD = 40;
      map.fitBounds(records.map((r) => [r.latitude, r.longitude]), { padding: [PAD, PAD], maxZoom: 14 });

      // fitBounds picks the zoom driven by whichever axis needs more
      // zoom-out - for a Pacific-rim dataset that's almost always the wide
      // longitude spread (e.g. Japan to Venezuela is ~165deg). On a
      // landscape screen that's still a sensible view of the whole dataset,
      // but on a portrait/mobile screen it leaves the much narrower latitude
      // spread using only a sliver of the available height (or pushes past
      // Web Mercator's +-85deg limit into visibly empty grey) - so this only
      // applies when the map is taller than it is wide.
      const size = map.getSize();
      if (size.y <= size.x) return;

      // Re-fit using latitude as the primary constraint instead, stepping
      // in one zoom level at a time until the data's own latitude range
      // would no longer fit 85% of the available height (short of 100% as
      // slack for getSize() being an imperfect reading, not a guaranteed-
      // accurate one). Some markers may then need a horizontal pan to reach,
      // which beats a mostly-grey map on load.
      const lats = records.map((r) => r.latitude);
      const latMin = Math.min(...lats);
      const latMax = Math.max(...lats);
      const centerLng = map.getCenter().lng;
      const availablePxHeight = (size.y - PAD * 2) * 0.85;
      const baseZoom = map.getZoom();
      // Capped a few levels above fitBounds' own zoom - a real fix for the
      // grey space, but not so unbounded that a bad container-size read
      // could run this all the way to maxZoom on a single point with no
      // markers on screen.
      let zoom = baseZoom;
      while (zoom < Math.min(baseZoom + 4, 14)) {
        const nextHeight = Math.abs(
          map.project([latMax, centerLng], zoom + 1).y - map.project([latMin, centerLng], zoom + 1).y
        );
        if (nextHeight > availablePxHeight) break;
        zoom += 1;
      }
      map.setView([(latMin + latMax) / 2, centerLng], zoom);
    } catch { /* ignore */ }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// Leaflet sizes its map to whatever its container's pixel height was at
// mount and never re-checks on its own - it has no way to know the CSS
// layout changed. On mobile the container often grows after mount (the
// browser's address bar retracting as the page settles, or the on-screen
// keyboard/orientation changing), and Leaflet doesn't repaint into that new
// space - it's left as the container's plain grey background, above or
// below the tiles. invalidateSize() forces Leaflet to re-measure and redraw.
// A ResizeObserver on the actual container catches every real size change
// directly, rather than window/visualViewport resize events, which mobile
// browsers don't fire consistently for an address-bar-driven resize - the
// container's own box is the one thing guaranteed to reflect what actually
// happened, whatever the cause.
function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const t = setTimeout(invalidate, 250);
    const ro = new ResizeObserver(invalidate);
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

function getInitialSlug() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('event') ?? '';
}

function getInitialView() {
  if (typeof window === 'undefined') return 'map';
  return new URLSearchParams(window.location.search).get('view') === 'table' ? 'table' : 'map';
}

// Reproduces exactly what someone was looking at from a shared link - which
// event, map or table, and the search/damage/type/etc. filters all read back
// out of the same params they're written to below.
function getInitialFilter() {
  if (typeof window === 'undefined') return emptyFilter;
  const p = new URLSearchParams(window.location.search);
  return {
    q: p.get('q') ?? '', damage: p.get('damage') ?? '', obs: p.get('obs') ?? '',
    source: p.get('source') ?? '', nonstructural: p.get('nonstructural') ?? '', height: p.get('height') ?? '',
  };
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
  const [filter, setFilter] = useState(getInitialFilter);
  const [view, setView] = useState(getInitialView);
  const [basemap, setBasemap] = useState('');
  // Below the filters-toggle breakpoint (see triage.css) the filter bar
  // starts collapsed - opening it is a deliberate tap, not something that
  // should eat half the screen on load.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Basemap + classification panel starts collapsed on narrow screens too
  // (see triage.css) - on a phone it would otherwise sit over a big chunk of
  // the map.
  const [mapPanelOpen, setMapPanelOpen] = useState(false);
  // A one-time dismiss for the "showing every site" banner - read once,
  // then out of the way, rather than sitting over the map every visit.
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Keeps the URL reproducing exactly what's on screen - event, map/table,
  // and every filter - so a shared link (or the back button) lands the
  // visitor on the same view instead of just the selected event. replaceState
  // rather than pushState: filter keystrokes shouldn't spam browser history.
  useEffect(() => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;
    const setOrDelete = (key, val) => { if (val) sp.set(key, val); else sp.delete(key); };
    setOrDelete('event', slug);
    setOrDelete('view', view !== 'map' ? view : '');
    setOrDelete('q', filter.q?.trim());
    setOrDelete('damage', filter.damage);
    setOrDelete('obs', filter.obs);
    setOrDelete('source', filter.source);
    setOrDelete('nonstructural', filter.nonstructural);
    setOrDelete('height', filter.height);
    window.history.replaceState(null, '', url);
  }, [slug, view, filter]);

  useEffect(() => {
    // Deliberately does not auto-select the first event when no ?event= is
    // in the URL - with more than one public event, silently dropping a
    // visitor into an arbitrary "first" one hides that others exist. Direct
    // links (?event=slug) still go straight to that event as before.
    fetch(INDEX_URL)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((idx) => setEvents([...(idx?.events ?? [])].sort((a, b) => new Date(b.event_datetime ?? 0) - new Date(a.event_datetime ?? 0))))
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
      .then((d) => (d?.sites ?? []).map((s) => ({ ...s, eventSlug: ev.slug, eventName: ev.name, country: ev.country })))
      .catch(() => [])))
      .then((lists) => { if (!cancelled) setAllSites(lists.flat()); })
      .finally(() => { if (!cancelled) setAllSitesLoading(false); });
    return () => { cancelled = true; };
  }, [slug, eventsLoading, events, allSites]);

  function selectEvent(newSlug) {
    setSlug(newSlug);
    if (!newSlug) { setData(null); setErr(''); }
  }

  const activeSites = slug
    ? (data?.sites ?? []).map((s) => ({ ...s, country: data?.event?.country }))
    : (allSites ?? []);
  const sites = useMemo(() => activeSites.filter((s) => s.lat != null && s.lng != null), [activeSites]);
  const filtered = useMemo(() => sites.filter((s) => matchesFilter(s, filter)), [sites, filter]);
  // Sites split across the antimeridian (e.g. Japan at ~140 and Venezuela at
  // ~-67) need their longitude shifted the same way for the markers as for
  // the map's fitted view - Leaflet's coordinate space is continuous and
  // unwrapped, so a marker plotted at the raw -67 while the viewport is
  // centred near the shifted +216 sits nearly a full world width from centre
  // (only visible in a repeated copy of the map way off to the side). Both
  // have to agree on the same shifted-or-not longitude for every record.
  const mapRecords = useMemo(() => {
    const raw = filtered.map((s) => ({ ...s, id: s.site_id, latitude: s.lat, longitude: s.lng }));
    if (raw.length < 2) return raw;
    const lngs = raw.map((r) => r.longitude);
    const spread = (arr) => Math.max(...arr) - Math.min(...arr);
    const shifted = lngs.map((lng) => (lng < 0 ? lng + 360 : lng));
    if (spread(shifted) >= spread(lngs)) return raw;
    return raw.map((r, i) => ({ ...r, longitude: shifted[i] }));
  }, [filtered]);

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
        <div className="public-head-title">
          <h1>NZ Earthquake Reconnaissance Programme</h1>
          <p>Verified sites · <span className="beta-tag">Beta</span></p>
        </div>
        <div className="public-head-controls">
          <select className="public-event-select" value={slug} onChange={(e) => selectEvent(e.target.value)} disabled={eventsLoading || events.length === 0}>
            <option value="">All events</option>
            {events.map((ev) => <option key={ev.slug} value={ev.slug}>{ev.name}</option>)}
          </select>
          {/* Mobile/narrower-desktop only (see triage.css) - filters are
              collapsed behind the Filters toggle there, so Map/Table needs
              its own always-visible spot. On wide desktop this is hidden;
              FilterBarLfe renders the same toggle at the end of its own row,
              next to the site count, instead. */}
          <span className="view-toggle mobile-view-toggle">
            <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map</button>
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
          </span>
          {!(!slug && eventsLoading) && (
            <button type="button" className={`filters-toggle${filterActive(filter) ? ' active' : ''}`} onClick={() => setFiltersOpen((o) => !o)}>
              Filters{filterActive(filter) ? ' •' : ''}
            </button>
          )}
        </div>
        {!(!slug && eventsLoading) && (
          <FilterBarLfe
            className={filtersOpen ? 'open' : ''}
            filter={filter} setFilter={setFilter} shown={filtered.length} total={sites.length} view={view} setView={setView} hideSource
          />
        )}
      </header>

      {!slug && eventsLoading ? (
        <p className="muted" style={{ padding: 20 }}>Loading all events. This may take some time.</p>
      ) : view === 'map' ? (
        <div className="public-map-area">
          {!slug && !bannerDismissed && !mapPanelOpen && (
            <div className="public-banner">
              <button type="button" className="public-banner-close" onClick={() => setBannerDismissed(true)} aria-label="Dismiss">×</button>
              {eventsErr
                ? eventsErr
                : events.length === 0
                  ? 'No public events yet. Please check back shortly.'
                  : allSitesLoading
                    ? 'Loading the full dataset of all events and verified sites. This may take some time.'
                    : 'Showing every verified site across all events - select a specific event from the dropdown above to focus on just that one.'}
            </div>
          )}
          {/* zoomAnimation off: on Chrome/Windows, Leaflet's CSS-transform
              zoom transition can leave each tile's translate3d() position a
              fraction of a pixel off after it settles, showing as a
              persistent hairline grid between tiles (worst over uniform
              tiles like ocean) - not a CSS fix on top of the symptom, this
              removes the animation that introduces the rounding error in
              the first place. Trade-off: zoom now snaps instead of
              animating smoothly. */}
          <MapContainer center={[0, 180]} zoom={2} className="triage-map" scrollWheelZoom zoomAnimation={false}>
            {base && <TileLayer url={base.url} attribution={base.attribution ?? ''} maxZoom={18} />}
            <FitToData records={mapRecords} />
            <InvalidateOnResize />
            <ClusterGroup records={mapRecords} renderMarker={renderMarker} />
          </MapContainer>
          <button type="button" className="map-panel-toggle" onClick={() => setMapPanelOpen((o) => !o)}>
            {mapPanelOpen ? 'Hide map settings' : 'Basemap & legend'}
          </button>
          <div className={`map-controls${mapPanelOpen ? ' open' : ''}`}>
            <label htmlFor="pub-bm">Basemap</label>
            <select id="pub-bm" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
              {basemapOptions.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="map-legend">
              <div className="legend-title">Classification</div>
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <div className="row" key={s}><span className="dot" style={{ background: DAMAGE_COLOR[s] }} />{DAMAGE_LABEL[s]}</div>
              ))}
            </div>
            <div className="count">{err ? err : `${filtered.length} verified site(s)`}{slug && data?.generatedAt && !err ? ` · updated ${fmtDate(data.generatedAt)}` : ''}</div>
          </div>
        </div>
      ) : (
        <RecordTableLfe records={filtered} mode="public" onOpen={setSelected} />
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
