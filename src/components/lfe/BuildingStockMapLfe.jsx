import { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import { supabaseLfe } from '../../lib/supabaseLfe.js';
import { ERA_BUCKETS, ALL_BUCKETS, BUCKET_COLOR, TITLE_MIN_ZOOM } from '../../lib/buildingStockAge.js';

const MAPTILER_KEY = import.meta.env.PUBLIC_MAPTILER_KEY;
const SOURCE_ID = 'building-stock';

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

// Continuous 0-1 -> colour interpolation for the choropleth (pct_two_oldest
// has no discrete buckets of its own - it's a proportion), anchored to the
// same newest/oldest colours as the title-level ramp so the two rendering
// modes read as one consistent scale rather than two unrelated palettes.
const CHOROPLETH_COLOR_EXPR = [
  'interpolate', ['linear'], ['coalesce', ['get', 'pct_two_oldest'], 0],
  0, BUCKET_COLOR['2004-plus'],
  1, BUCKET_COLOR['pre-1935'],
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

function Legend({ standards, activeBuckets, onToggle, viewMode, viewCounts, viewTotal }) {
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
            {viewMode === 'titles' && (
              <span className="muted small bsa-legend-count">
                {count}{pct != null ? ` (${pct}%)` : ''}
              </span>
            )}
          </button>
        );
      })}
      {viewMode === 'areas' && (
        <p className="muted small" style={{ marginTop: 6 }}>
          Zoomed out: colour shows the share of stock in the two oldest eras per area.
          Per-era counts aren't available at this zoom - zoom in for individual titles.
        </p>
      )}
    </div>
  );
}

function MethodologyNote() {
  return (
    <details className="bsa-methodology">
      <summary>About this data</summary>
      <p>
        Building ages come from the LINZ National District Valuation Roll (rating
        valuation data), which is decade-banded rather than exact, and reflects the
        property&apos;s primary improvement - a significant renovation or rebuild can
        shift the recorded date well off the original construction year. Coverage and
        data quality vary by territorial authority. Where a decade straddles a seismic-
        code boundary, it is rounded down to the earlier era, which is conservative for
        seismic risk but means bucket counts are biased toward older eras overall.
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
  const { standards, loading: standardsLoading } = useEraStandards(country.label);

  const activeBucketsArray = useMemo(() => [...activeBuckets], [activeBuckets]);

  function toggleBucket(key) {
    setActiveBuckets((prev) => {
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
      center: [172.6, -41.3], // roughly central NZ - fine as a default while country is NZ-only
      zoom: 5,
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
  // has no per-bucket breakdown to filter (see Legend's "areas" note above).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('titles-fill')) return;
    const filter = ['in', ['get', 'era_bucket'], ['literal', activeBucketsArray]];
    map.setFilter('titles-fill', filter);
    map.setFilter('titles-outline', filter);
  }, [activeBucketsArray]);

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
        {standardsLoading ? (
          <p className="muted small">Loading era standards...</p>
        ) : (
          <Legend
            standards={standards} activeBuckets={activeBuckets} onToggle={toggleBucket}
            viewMode={viewMode} viewCounts={viewCounts} viewTotal={viewTotal}
          />
        )}
        <MethodologyNote />
      </div>
      {viewMode === 'areas' && (
        <div className="bsa-zoom-hint">Zoom in to see individual titles and per-era counts</div>
      )}
      {mapError && <p className="status-line err bsa-map-error">{mapError}</p>}
    </>
  );
}
