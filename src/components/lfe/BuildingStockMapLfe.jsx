import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import {
  ERA_BUCKETS, ALL_BUCKETS, BUCKET_COLOR, COVERAGE_COLOR, TITLE_MIN_ZOOM,
  EPB_GEOJSON_URL, EPB_SOURCE_ID, EPB_COLOR, EPB_APPROXIMATE_STROKE,
  LIQUEFACTION_BUCKETS, LIQUEFACTION_COLOR, LIQUEFACTION_GEOJSON_URL, LIQUEFACTION_SOURCE_ID,
  FLOOD_BUCKETS, FLOOD_COLOR, FLOOD_GEOJSON_URL, FLOOD_SOURCE_ID,
} from '../../lib/buildingStockAge.js';

const MAPTILER_KEY = import.meta.env.PUBLIC_MAPTILER_KEY;
const SOURCE_ID = 'building-stock';
const EPB_UNREMEDIATED_LAYER = 'epb-unremediated';
const EPB_REMEDIATED_LAYER = 'epb-remediated';
const LIQUEFACTION_FILL_LAYER = 'liquefaction-fill';
const LIQUEFACTION_OUTLINE_LAYER = 'liquefaction-outline';
// One fill+outline layer pair per FLOOD_BUCKETS key, e.g. 'flood-fill-200yr'.
const floodFillLayer = (key) => `flood-fill-${key}`;
const floodOutlineLayer = (key) => `flood-outline-${key}`;

const LIQUEFACTION_COLOR_EXPR = [
  'match', ['get', 'liq_bucket'],
  ...LIQUEFACTION_BUCKETS.flatMap((b) => [b.key, LIQUEFACTION_COLOR[b.key]]),
  '#cccccc',
];

// Registered once per page load, not per mount - addProtocol is a global
// registration on maplibregl itself, and re-adding it on every remount
// (e.g. switching country and back) would just redundantly overwrite the
// same handler, but guarding avoids doing that work more than once.
let pmtilesRegistered = false;
function ensurePmtilesProtocol() {
  if (pmtilesRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  pmtilesRegistered = true;
}

// Binary coverage colour, not a pct_two_oldest gradient - see
// COVERAGE_COLOR's own comment for why. total_count is null (not present)
// for a TA build_areas_layer.py found no DVR-covered properties in.
const CHOROPLETH_COLOR_EXPR = [
  'case', ['==', ['get', 'total_count'], null], COVERAGE_COLOR.uncovered, COVERAGE_COLOR.covered,
];

const TITLE_COLOR_EXPR = [
  'match', ['get', 'era_bucket'],
  ...ALL_BUCKETS.flatMap((b) => [b.key, BUCKET_COLOR[b.key]]),
  BUCKET_COLOR.unknown,
];

// The one place each era bucket's governing standard gets resolved, from
// country_code_entries rather than a duplicated string - a bucket with no
// standardStartYear (pre-1935) has no governing standard by design (NZ had
// no seismic design provisions before NZSS 95). Only the 7 ordinal
// ERA_BUCKETS are looked up here - 'mixed'/'unknown' (SPECIAL_BUCKETS)
// aren't ages at all, so they're simply absent from the result, and any
// later `standards[key]` lookup for them naturally comes back undefined.
function useEraStandards(countryLabel) {
  const [standards, setStandards] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // loading already starts true - the parent remounts this whole component
    // via a `key` on country change (see BuildingStockAgeLfe.jsx), so this
    // effect only ever runs once per mount and never needs to reset it.
    let cancelled = false;
    supabaseLfe.from('country_code_entries').select('year_start,title')
      .eq('country', countryLabel)
      .then(({ data }) => {
        if (cancelled) return;
        const byYear = Object.fromEntries((data ?? []).map((e) => [e.year_start, e.title]));
        const byBucket = Object.fromEntries(
          ERA_BUCKETS.map((b) => [b.key, b.standardStartYear != null ? byYear[b.standardStartYear] ?? null : null]),
        );
        setStandards(byBucket);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [countryLabel]);

  return { standards, loading };
}

// Zoomed out: a self-contained coverage key, independent of the era-bucket
// palette below - see COVERAGE_COLOR's comment for why. Not interactive
// (nothing to toggle - "has data"/"no data" isn't a filterable set the way
// era buckets are).
function CoverageLegend() {
  return (
    <div className="bsa-legend">
      <div className="bsa-legend-title">Data coverage</div>
      <div className="bsa-legend-row">
        <span className="bsa-swatch" style={{ background: COVERAGE_COLOR.covered }} />
        <span className="bsa-legend-label">Has building-age data</span>
      </div>
      <div className="bsa-legend-row">
        <span className="bsa-swatch" style={{ background: COVERAGE_COLOR.uncovered }} />
        <span className="bsa-legend-label">No data yet</span>
      </div>
      <p className="muted small" style={{ marginTop: 6, fontWeight: 600 }}>
        Zoom in on a coloured area to see individual buildings by seismic-design era.
      </p>
    </div>
  );
}

function EraLegend({ standards, activeBuckets, onToggle, viewCounts, viewTotal }) {
  return (
    <div className="bsa-legend">
      <div className="bsa-legend-title">Seismic design era</div>
      {ALL_BUCKETS.map((b) => {
        const count = viewCounts?.[b.key] ?? 0;
        const pct = viewTotal ? Math.round((100 * count) / viewTotal) : null;
        const on = activeBuckets.has(b.key);
        return (
          <button
            key={b.key} type="button" className={`bsa-legend-row${on ? '' : ' off'}`}
            onClick={() => onToggle(b.key)}
            title={on ? 'Click to hide' : 'Click to show'}
          >
            <span className="bsa-swatch" style={{ background: BUCKET_COLOR[b.key] }} />
            <span className="bsa-legend-label">
              {b.label}
              {standards[b.key] && <span className="muted small"> - {standards[b.key]}</span>}
            </span>
            <span className="muted small bsa-legend-count">
              {count}{pct != null ? ` (${pct}%)` : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// EPB register overlay - independent of the areas/titles zoom split above
// (national coverage, not gated to TITLE_MIN_ZOOM), so it gets its own
// always-visible legend section rather than living inside CoverageLegend or
// EraLegend. Two independent toggles (both can be on at once), matching the
// EraLegend row pattern rather than a single tri-state control.
function EpbLegend({ visible, onToggle, counts }) {
  return (
    <div className="bsa-legend">
      <div className="bsa-legend-title">Earthquake-prone buildings (MBIE register)</div>
      <button
        type="button" className={`bsa-legend-row${visible.unremediated ? '' : ' off'}`}
        onClick={() => onToggle('unremediated')}
        title={visible.unremediated ? 'Click to hide' : 'Click to show'}
      >
        <span className="bsa-swatch bsa-swatch-dot" style={{ background: EPB_COLOR.unremediated }} />
        <span className="bsa-legend-label">Show EPBs</span>
        <span className="muted small bsa-legend-count">{counts ? counts.unremediated : '...'}</span>
      </button>
      <button
        type="button" className={`bsa-legend-row${visible.remediated ? '' : ' off'}`}
        onClick={() => onToggle('remediated')}
        title={visible.remediated ? 'Click to hide' : 'Click to show'}
      >
        <span className="bsa-swatch bsa-swatch-dot" style={{ background: EPB_COLOR.remediated }} />
        <span className="bsa-legend-label">Show remediated EPBs</span>
        <span className="muted small bsa-legend-count">{counts ? counts.remediated : '...'}</span>
      </button>
      <p className="muted small" style={{ marginTop: 6 }}>
        &quot;Remediated&quot; means the address no longer appears in MBIE&apos;s current
        earthquake-prone building list - it doesn&apos;t confirm what seismic work, if any,
        was done.
      </p>
    </div>
  );
}

// Liquefaction vulnerability overlay - like EpbLegend, independent of the
// areas/titles zoom split (its own GeoJSON source, national-title-agnostic),
// so it gets its own always-visible legend section. All buckets default off
// (see the state init below) rather than mirroring EraLegend's all-on
// default - three simultaneous choropleth-style overlays (era, EPB,
// liquefaction) all visible on first load would be unreadable.
function LiquefactionLegend({ activeBuckets, onToggle, counts }) {
  return (
    <div className="bsa-legend">
      <div className="bsa-legend-title">Liquefaction vulnerability (Christchurch)</div>
      {LIQUEFACTION_BUCKETS.map((b) => {
        const on = activeBuckets.has(b.key);
        return (
          <button
            key={b.key} type="button" className={`bsa-legend-row${on ? '' : ' off'}`}
            onClick={() => onToggle(b.key)}
            title={on ? 'Click to hide' : 'Click to show'}
          >
            <span className="bsa-swatch" style={{ background: LIQUEFACTION_COLOR[b.key] }} />
            <span className="bsa-legend-label">{b.label}</span>
            <span className="muted small bsa-legend-count">{counts ? counts[b.key] ?? 0 : '...'}</span>
          </button>
        );
      })}
    </div>
  );
}

// Flood extent overlay - like EpbLegend/LiquefactionLegend, its own always-
// visible legend section. All three off by default, same reasoning as
// LiquefactionLegend: this can be on screen alongside era/EPB/liquefaction
// and three-plus simultaneous overlays on first load is unreadable.
function FloodLegend({ visible, onToggle, counts }) {
  return (
    <div className="bsa-legend">
      <div className="bsa-legend-title">Flood extent (Christchurch)</div>
      {FLOOD_BUCKETS.map((b) => {
        const on = visible.has(b.key);
        return (
          <button
            key={b.key} type="button" className={`bsa-legend-row${on ? '' : ' off'}`}
            onClick={() => onToggle(b.key)}
            title={on ? 'Click to hide' : 'Click to show'}
          >
            <span className="bsa-swatch" style={{ background: FLOOD_COLOR[b.key] }} />
            <span className="bsa-legend-label">{b.label}</span>
            <span className="muted small bsa-legend-count">{counts ? counts[b.key] ?? 0 : '...'}</span>
          </button>
        );
      })}
    </div>
  );
}

// The LINZ "National District Valuation Roll" is open-licence data only
// for Territorial Authorities that specifically opted in to public sharing
// - "National" describes the table's schema, not its geographic coverage.
// As of the 2026-09-08 build, only these 6 (of 68) TAs have any data at
// all; Christchurch City alone is ~190k of the ~274k covered properties.
// True full-country coverage exists only as the restricted-access version,
// gated to qualifying NZ Central/Local Government users. Worth deriving
// this list from the tileset itself (which areas have real data) rather
// than hand-listing it here, if/when the covered-TA set is expected to
// change - static for now since re-deriving it isn't worth the complexity
// for a snapshot that only changes when someone re-runs the ETL pipeline.
const COVERED_TAS = 'Christchurch City, Selwyn, Southland, Kaipara, Ōtorohanga, and Kawerau districts';

function MethodologyNote() {
  return (
    <details className="bsa-methodology">
      <summary>About this data</summary>
      <p>
        <strong>Coverage is partial, not national</strong>, despite the source
        dataset&apos;s name: only {COVERED_TAS} have shared their District Valuation
        Roll data under an open licence. Every other territorial authority - including
        Auckland and Wellington - has no data here at all yet.
      </p>
      <p>
        Building ages come from that Roll (rating valuation data), which is
        decade-banded rather than exact, and reflects the property&apos;s primary
        improvement - a significant renovation or rebuild can shift the recorded date
        well off the original construction year. Coverage and data quality vary by
        territorial authority even within the covered set. Where a decade straddles a
        seismic-code boundary, it is rounded down to the earlier era, which is
        conservative for seismic risk but means bucket counts are biased toward older
        eras overall.
      </p>
      <p>
        Each polygon is a building footprint, not a property boundary - a property with
        several buildings on it (e.g. a house plus a shed) shows every one of them with
        that property&apos;s single recorded age. A building shared across multiple
        legal properties (common for townhouses/apartments) shows one of those
        properties&apos; age for the whole building.
      </p>
      <p>
        <strong>EPB markers</strong> come from MBIE&apos;s national earthquake-prone
        building register (a 2026-09-14 export), one point per notified street address.
        A point is geocoded from that street address (not a legal title or footprint) -
        first via OpenStreetMap, with a second pass against LINZ&apos;s authoritative NZ
        Addresses dataset for anything OpenStreetMap could only guess at. Of 7,351
        addresses, about 92% matched an exact street number from one of the two sources;
        a plain white ring means that. Markers with an amber ring (about 7%) are
        &quot;approximate&quot; - neither source had that exact street number, so the pin
        is the nearest match on the same street and could be off by some distance (click
        a marker to check). A small remainder (under 1%) couldn&apos;t be matched at all
        and are missing from the map entirely - almost always addresses newer than both
        sources&apos; data. &quot;Remediated&quot; is inferred by diffing the full
        register against the current unremediated list - it means the address is no
        longer notified, not that specific seismic work has been verified.
      </p>
      <p>
        <strong>Liquefaction vulnerability</strong> covers Christchurch City only - the
        Tonkin &amp; Taylor study commissioned by Christchurch City Council (2019),
        following MBIE/MfE&apos;s 2017 national liquefaction guidance. &quot;Possible
        (Medium-High, undetermined)&quot; is not a stand-in for &quot;Medium&quot; - it is
        the study&apos;s own category for areas where the evidence supports damage being
        possible but wasn&apos;t sufficient to grade the severity further, and it is this
        dataset&apos;s single largest category. Polygon boundaries follow assessed land
        zones, not property or building footprints.
      </p>
      <p>
        <strong>Flood extent</strong> covers Christchurch City only - Christchurch City
        Council&apos;s Flood Hazard modelling (MIKE Powered by DHI hydraulic models, run
        per catchment). The three layers are return periods, not severity levels: a
        &quot;10-year&quot; extent is modelled to flood on average once a decade, &quot;50-year&quot;
        once in fifty years, and &quot;200-year&quot; once in two hundred - each rarer event
        typically covers a larger area than the ones more frequent than it. Extent
        polygons have been simplified from CCC&apos;s source geometry for map performance
        (see scripts/building-stock/build_flood_geojson.mjs); boundaries may be a few
        metres coarser than the source model as a result.
      </p>
    </details>
  );
}

export default function BuildingStockMapLfe({ country }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const [zoom, setZoom] = useState(0);
  const [activeBuckets, setActiveBuckets] = useState(() => new Set(ALL_BUCKETS.map((b) => b.key)));
  const [viewCounts, setViewCounts] = useState(null);
  const [mapError, setMapError] = useState(null);
  // Unremediated on by default (the headline "which buildings are still
  // earthquake-prone" question); remediated is opt-in extra context, off by
  // default to avoid ~7,300 combined points cluttering the map on first load.
  const [epbVisible, setEpbVisible] = useState({ unremediated: true, remediated: false });
  const [epbCounts, setEpbCounts] = useState(null);
  // All off by default - see LiquefactionLegend's comment.
  const [activeLiqBuckets, setActiveLiqBuckets] = useState(() => new Set());
  const [liqCounts, setLiqCounts] = useState(null);
  // All off by default - same reasoning as activeLiqBuckets above.
  const [activeFloodBuckets, setActiveFloodBuckets] = useState(() => new Set());
  const [floodCounts, setFloodCounts] = useState(null);
  const { standards, loading: standardsLoading } = useEraStandards(country.label);

  const activeBucketsArray = useMemo(() => [...activeBuckets], [activeBuckets]);
  const activeLiqBucketsArray = useMemo(() => [...activeLiqBuckets], [activeLiqBuckets]);

  function toggleBucket(key) {
    setActiveBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleEpb(key) {
    setEpbVisible((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleLiq(key) {
    setActiveLiqBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleFlood(key) {
    setActiveFloodBuckets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    if (!MAPTILER_KEY || !country.tilesetUrl || !containerRef.current || mapRef.current) return undefined;
    ensurePmtilesProtocol();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: country.defaultView?.center ?? [172.6, -41.3],
      zoom: country.defaultView?.zoom ?? 5,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('error', (e) => setMapError(e.error?.message ?? 'Map failed to load'));

    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'vector', url: `pmtiles://${country.tilesetUrl}` });

      // Below TITLE_MIN_ZOOM: aggregated choropleth (SA2/territorial-authority
      // polygons, source-layer "areas"). At/above it: individual titles
      // (source-layer "titles"). MapLibre's own minzoom/maxzoom handle the
      // switch - no manual show/hide logic needed.
      map.addLayer({
        id: 'areas-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'areas',
        maxzoom: TITLE_MIN_ZOOM,
        paint: { 'fill-color': CHOROPLETH_COLOR_EXPR, 'fill-opacity': 0.75 },
      });
      map.addLayer({
        id: 'areas-outline', type: 'line', source: SOURCE_ID, 'source-layer': 'areas',
        maxzoom: TITLE_MIN_ZOOM,
        paint: { 'line-color': '#ffffff', 'line-width': 0.5, 'line-opacity': 0.5 },
      });
      map.addLayer({
        id: 'titles-fill', type: 'fill', source: SOURCE_ID, 'source-layer': 'titles',
        minzoom: TITLE_MIN_ZOOM,
        paint: { 'fill-color': TITLE_COLOR_EXPR, 'fill-opacity': 0.85 },
      });
      map.addLayer({
        id: 'titles-outline', type: 'line', source: SOURCE_ID, 'source-layer': 'titles',
        minzoom: TITLE_MIN_ZOOM,
        paint: { 'line-color': '#374151', 'line-width': 0.5, 'line-opacity': 0.6 },
      });

      map.on('click', 'titles-fill', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const bucket = ALL_BUCKETS.find((b) => b.key === f.properties.era_bucket);
        const standard = standards[f.properties.era_bucket];
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${f.properties.address ?? 'Address unknown'}</strong><br/>
            DVR decade: ${f.properties.dvr_decade ?? 'unknown'}<br/>
            Seismic era: ${bucket?.label ?? 'Unknown'}<br/>
            ${standard ? `Governing standard: ${standard}` : 'No governing standard'}
          `)
          .addTo(map);
      });
      map.on('mouseenter', 'titles-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'titles-fill', () => { map.getCanvas().style.cursor = ''; });

      // Liquefaction vulnerability overlay - a single filtered fill layer
      // (like titles-fill's era_bucket filter), not one layer per bucket
      // like the EPB markers, since all 5 buckets share one geometry type
      // and toggling is just "which liq_bucket values pass the filter".
      // Starts fully filtered out (activeLiqBuckets starts empty) - the
      // layer exists from load, the filter effect below just never lets
      // anything through until a legend row is clicked. Added before the
      // EPB markers below (not after) so its polygon fill always renders
      // under the point layer - otherwise a semi-transparent fill on top
      // would wash out the EPB dots whenever both overlays are on.
      map.addSource(LIQUEFACTION_SOURCE_ID, { type: 'geojson', data: LIQUEFACTION_GEOJSON_URL });
      map.addLayer({
        id: LIQUEFACTION_FILL_LAYER, type: 'fill', source: LIQUEFACTION_SOURCE_ID,
        filter: ['in', ['get', 'liq_bucket'], ['literal', []]],
        paint: { 'fill-color': LIQUEFACTION_COLOR_EXPR, 'fill-opacity': 0.55 },
      });
      map.addLayer({
        id: LIQUEFACTION_OUTLINE_LAYER, type: 'line', source: LIQUEFACTION_SOURCE_ID,
        filter: ['in', ['get', 'liq_bucket'], ['literal', []]],
        paint: { 'line-color': '#4c1d95', 'line-width': 0.5, 'line-opacity': 0.4 },
      });
      map.on('click', LIQUEFACTION_FILL_LAYER, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const bucket = LIQUEFACTION_BUCKETS.find((b) => b.key === f.properties.liq_bucket);
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ offset: 8 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${bucket?.label ?? f.properties.liq_cat_raw}</strong><br/>
            Source category: ${f.properties.liq_cat_raw ?? 'unknown'}<br/>
            Assessment detail: ${f.properties.detail ?? 'unknown'}<br/>
            Study date: ${f.properties.study_date ? f.properties.study_date.slice(0, 10) : 'unknown'}
          `)
          .addTo(map);
      });
      map.on('mouseenter', LIQUEFACTION_FILL_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', LIQUEFACTION_FILL_LAYER, () => { map.getCanvas().style.cursor = ''; });

      const onLiqSourceData = (e) => {
        if (e.sourceId !== LIQUEFACTION_SOURCE_ID || !e.isSourceLoaded) return;
        const features = map.querySourceFeatures(LIQUEFACTION_SOURCE_ID);
        const counts = Object.fromEntries(LIQUEFACTION_BUCKETS.map((b) => [b.key, 0]));
        for (const f of features) {
          if (f.properties.liq_bucket in counts) counts[f.properties.liq_bucket] += 1;
        }
        setLiqCounts(counts);
        map.off('sourcedata', onLiqSourceData);
      };
      map.on('sourcedata', onLiqSourceData);

      // Flood extent overlay - one source, three fill+outline layer pairs
      // (not a single filtered layer like liquefaction) so each return
      // period's z-order is fixed and independent of toggle order: added
      // rarest/largest-extent first so it always renders underneath the
      // more-frequent/smaller extents - see FLOOD_BUCKETS' comment for why
      // that matters here. All layers start hidden (visibility 'none') -
      // activeFloodBuckets starts empty, same reasoning as the liquefaction
      // layer starting fully filtered out.
      map.addSource(FLOOD_SOURCE_ID, { type: 'geojson', data: FLOOD_GEOJSON_URL });
      for (const b of FLOOD_BUCKETS) {
        map.addLayer({
          id: floodFillLayer(b.key), type: 'fill', source: FLOOD_SOURCE_ID,
          filter: ['==', ['get', 'flood_year'], b.key],
          layout: { visibility: 'none' },
          paint: { 'fill-color': FLOOD_COLOR[b.key], 'fill-opacity': 0.55 },
        });
        map.addLayer({
          id: floodOutlineLayer(b.key), type: 'line', source: FLOOD_SOURCE_ID,
          filter: ['==', ['get', 'flood_year'], b.key],
          layout: { visibility: 'none' },
          paint: { 'line-color': '#08306b', 'line-width': 0.5, 'line-opacity': 0.4 },
        });
        map.on('click', floodFillLayer(b.key), (e) => {
          const f = e.features?.[0];
          if (!f) return;
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ offset: 8 })
            .setLngLat(e.lngLat)
            .setHTML(`
              <strong>${b.label}</strong><br/>
              Catchment: ${f.properties.catchment ?? 'unknown'}
            `)
            .addTo(map);
        });
        map.on('mouseenter', floodFillLayer(b.key), () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', floodFillLayer(b.key), () => { map.getCanvas().style.cursor = ''; });
      }

      const onFloodSourceData = (e) => {
        if (e.sourceId !== FLOOD_SOURCE_ID || !e.isSourceLoaded) return;
        const features = map.querySourceFeatures(FLOOD_SOURCE_ID);
        const counts = Object.fromEntries(FLOOD_BUCKETS.map((b) => [b.key, 0]));
        for (const f of features) {
          if (f.properties.flood_year in counts) counts[f.properties.flood_year] += 1;
        }
        setFloodCounts(counts);
        map.off('sourcedata', onFloodSourceData);
      };
      map.on('sourcedata', onFloodSourceData);

      // National MBIE EPB register overlay - a plain GeoJSON source (not
      // PMTiles) since it's a one-off static file rather than a build
      // pipeline, and small enough (~7k points) not to need vector tiling.
      // Two layers, not one filtered layer, so each can be shown/hidden
      // independently via the legend toggles below without touching the
      // other's filter.
      // 'approximate' markers get an amber ring + slightly lower opacity
      // instead of a different fill colour - see EPB_APPROXIMATE_STROKE's
      // comment. Applied identically to both layers via the same expressions.
      const epbStrokeExpr = ['case', ['get', 'approximate'], EPB_APPROXIMATE_STROKE, '#ffffff'];
      const epbStrokeWidthExpr = ['case', ['get', 'approximate'], 2, 1];
      const epbOpacityExpr = ['case', ['get', 'approximate'], 0.65, 1];

      map.addSource(EPB_SOURCE_ID, { type: 'geojson', data: EPB_GEOJSON_URL });
      map.addLayer({
        id: EPB_UNREMEDIATED_LAYER, type: 'circle', source: EPB_SOURCE_ID,
        filter: ['==', ['get', 'remediated'], false],
        layout: { visibility: epbVisible.unremediated ? 'visible' : 'none' },
        paint: {
          'circle-color': EPB_COLOR.unremediated, 'circle-radius': 5, 'circle-opacity': epbOpacityExpr,
          'circle-stroke-color': epbStrokeExpr, 'circle-stroke-width': epbStrokeWidthExpr,
        },
      });
      map.addLayer({
        id: EPB_REMEDIATED_LAYER, type: 'circle', source: EPB_SOURCE_ID,
        filter: ['==', ['get', 'remediated'], true],
        layout: { visibility: epbVisible.remediated ? 'visible' : 'none' },
        paint: {
          'circle-color': EPB_COLOR.remediated, 'circle-radius': 5, 'circle-opacity': epbOpacityExpr,
          'circle-stroke-color': epbStrokeExpr, 'circle-stroke-width': epbStrokeWidthExpr,
        },
      });

      const epbPopupHtml = (p) => `
        <strong>${p.address ?? 'Address unknown'}</strong>
        ${p.common_names ? `<br/>${p.common_names}` : ''}<br/>
        ${p.remediated ? 'Remediated - no longer on the EPB register' : 'Currently earthquake-prone'}<br/>
        Notice type: ${p.notice_type ?? 'unknown'}<br/>
        Date of issue: ${p.date_of_issue ?? 'unknown'}<br/>
        Earthquake rating: ${p.earthquake_rating ?? 'unknown'}<br/>
        Seismic work deadline: ${p.seismic_work_deadline ?? 'unknown'}<br/>
        Priority building: ${p.priority_building ? 'Yes' : 'No'}<br/>
        Notice issued by: ${p.notice_issued_by ?? 'unknown'}
        ${p.heritage_status ? `<br/>Heritage status: ${p.heritage_status}` : ''}
        ${p.area_of_seismic_risk ? `<br/>Area of seismic risk: ${p.area_of_seismic_risk}` : ''}
        ${p.approximate ? '<br/><strong>Approximate location</strong> - the exact street number wasn\'t found, this pin is the nearest match on the street and may be off by some distance.' : ''}
      `;
      for (const layerId of [EPB_UNREMEDIATED_LAYER, EPB_REMEDIATED_LAYER]) {
        map.on('click', layerId, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ offset: 8 })
            .setLngLat(e.lngLat)
            .setHTML(epbPopupHtml(f.properties))
            .addTo(map);
        });
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      }

      // GeoJSON sources load in one shot (unlike vector tiles), so the first
      // 'sourcedata' event where isSourceLoaded is true has every feature -
      // querySourceFeatures then gives a real national total, not a
      // viewport-dependent count the way EraLegend's counts are.
      const onEpbSourceData = (e) => {
        if (e.sourceId !== EPB_SOURCE_ID || !e.isSourceLoaded) return;
        const features = map.querySourceFeatures(EPB_SOURCE_ID);
        let remediated = 0;
        let unremediated = 0;
        for (const f of features) {
          if (f.properties.remediated) remediated++; else unremediated++;
        }
        setEpbCounts({ remediated, unremediated });
        map.off('sourcedata', onEpbSourceData);
      };
      map.on('sourcedata', onEpbSourceData);

      const updateStats = () => {
        setZoom(map.getZoom());
        const layerId = map.getZoom() >= TITLE_MIN_ZOOM ? 'titles-fill' : 'areas-fill';
        let features = [];
        try {
          features = map.queryRenderedFeatures({ layers: [layerId] });
        } catch { /* layer not ready yet on the very first idle */ }
        if (layerId === 'titles-fill') {
          const counts = Object.fromEntries(ALL_BUCKETS.map((b) => [b.key, 0]));
          for (const f of features) {
            const key = f.properties.era_bucket;
            if (key in counts) counts[key] += 1;
          }
          setViewCounts(counts);
        } else {
          setViewCounts(null);
        }
      };
      map.on('idle', updateStats);
      updateStats();
    });

    return () => {
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [country.tilesetUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bucket-visibility toggles only affect the titles layer - the choropleth
  // is now a binary coverage colour (CoverageLegend), not an era breakdown,
  // so there's nothing there for these toggles to apply to.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('titles-fill')) return;
    const filter = ['in', ['get', 'era_bucket'], ['literal', activeBucketsArray]];
    map.setFilter('titles-fill', filter);
    map.setFilter('titles-outline', filter);
  }, [activeBucketsArray]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(EPB_UNREMEDIATED_LAYER)) return;
    map.setLayoutProperty(EPB_UNREMEDIATED_LAYER, 'visibility', epbVisible.unremediated ? 'visible' : 'none');
    map.setLayoutProperty(EPB_REMEDIATED_LAYER, 'visibility', epbVisible.remediated ? 'visible' : 'none');
  }, [epbVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LIQUEFACTION_FILL_LAYER)) return;
    const filter = ['in', ['get', 'liq_bucket'], ['literal', activeLiqBucketsArray]];
    map.setFilter(LIQUEFACTION_FILL_LAYER, filter);
    map.setFilter(LIQUEFACTION_OUTLINE_LAYER, filter);
  }, [activeLiqBucketsArray]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(floodFillLayer(FLOOD_BUCKETS[0].key))) return;
    for (const b of FLOOD_BUCKETS) {
      const visibility = activeFloodBuckets.has(b.key) ? 'visible' : 'none';
      map.setLayoutProperty(floodFillLayer(b.key), 'visibility', visibility);
      map.setLayoutProperty(floodOutlineLayer(b.key), 'visibility', visibility);
    }
  }, [activeFloodBuckets]);

  if (!country.tilesetUrl) {
    return (
      <div className="bsa-pending">
        <p className="muted">
          The building-stock tileset for {country.label} hasn&apos;t been built yet - this
          tab is scaffolded and ready, but the LINZ data pipeline (download, join, era
          bucketing, tippecanoe build) hasn&apos;t run. Once that tileset is published,
          this view will render automatically - no further UI changes needed.
        </p>
      </div>
    );
  }

  if (!MAPTILER_KEY) {
    return (
      <div className="bsa-pending">
        <p className="muted">
          Set a <code>PUBLIC_MAPTILER_KEY</code> env var to show the building-stock map.
        </p>
      </div>
    );
  }

  const viewMode = zoom >= TITLE_MIN_ZOOM ? 'titles' : 'areas';
  const viewTotal = viewCounts ? Object.values(viewCounts).reduce((a, b) => a + b, 0) : null;

  return (
    <>
      <div ref={containerRef} className="triage-map" />
      <div className="map-controls bsa-controls">
        {viewMode === 'areas' ? (
          <CoverageLegend />
        ) : standardsLoading ? (
          <p className="muted small">Loading era standards...</p>
        ) : (
          <EraLegend
            standards={standards} activeBuckets={activeBuckets} onToggle={toggleBucket}
            viewCounts={viewCounts} viewTotal={viewTotal}
          />
        )}
        <EpbLegend visible={epbVisible} onToggle={toggleEpb} counts={epbCounts} />
        <LiquefactionLegend activeBuckets={activeLiqBuckets} onToggle={toggleLiq} counts={liqCounts} />
        <FloodLegend visible={activeFloodBuckets} onToggle={toggleFlood} counts={floodCounts} />
        <MethodologyNote />
      </div>
      {viewMode === 'areas' && (
        <div className="bsa-zoom-hint">Zoom in for individual buildings and seismic-era detail</div>
      )}
      {mapError && <p className="status-line err bsa-map-error">{mapError}</p>}
    </>
  );
}
