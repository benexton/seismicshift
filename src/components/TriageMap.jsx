import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import { DAMAGE_COLOR, DAMAGE_LABEL, DAMAGE_SCORES } from '../lib/report.js';
import ReviewModal from './ReviewModal.jsx';

// --- Basemaps ---------------------------------------------------------------
// GSI (Geospatial Information Authority of Japan) raster tiles. Attribution to
// 「地理院タイル」is required by GSI's terms of use. For a specific disaster,
// GSI publishes dedicated post-event aerial layers under /xyz/<layer-id>/ —
// add them here once the event layer ID is known.
const BASEMAPS = {
  std: {
    label: 'GSI Standard',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
  },
  pale: {
    label: 'GSI Pale',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
  },
  photo: {
    label: 'GSI Aerial (seamless photo)',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
  },
};
const GSI_ATTRIBUTION =
  '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル (GSI Japan)</a>';

// Kumamoto City / Mashiki area.
const CENTER = [32.79, 130.74];
const ZOOM = 11;

/** Fit the map to the loaded records once, so the queue is always in view. */
function FitToData({ records }) {
  const map = useMap();
  useEffect(() => {
    if (!records.length) return;
    const bounds = records.map((r) => [r.latitude, r.longitude]);
    try {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch {
      /* single point / invalid bounds — ignore */
    }
  }, [records.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Interactive triage map. Loads 'Unverified' records, renders them as damage-
 * coloured markers, and opens a ReviewModal on click. Approving/rejecting a
 * record removes it from the active queue.
 *
 * @param {object} props
 * @param {string} props.reviewer  Signed-in engineer identifier (email).
 */
export default function TriageMap({ reviewer }) {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [basemap, setBasemap] = useState('photo');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('triage_records')
      .select(RECORD_COLUMNS)
      .eq('status', 'Unverified')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setRecords((data ?? []).filter((r) => r.latitude != null && r.longitude != null));
  }

  useEffect(() => {
    load();
  }, []);

  // Remove a resolved record from the active queue (optimistic).
  function handleResolved(id) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
  }

  const base = BASEMAPS[basemap];
  const legend = useMemo(() => DAMAGE_SCORES, []);

  return (
    <div className="triage-wrap">
      <MapContainer center={CENTER} zoom={ZOOM} className="triage-map" scrollWheelZoom>
        <TileLayer url={base.url} attribution={GSI_ATTRIBUTION} maxZoom={18} />
        <FitToData records={records} />
        {records.map((r) => (
          <CircleMarker
            key={r.id}
            center={[r.latitude, r.longitude]}
            radius={9}
            pathOptions={{
              color: '#ffffff',
              weight: 1.5,
              fillColor: DAMAGE_COLOR[r.damage_score] ?? '#9e9e9e',
              fillOpacity: 0.9,
            }}
            eventHandlers={{ click: () => setSelected(r) }}
          >
            <Tooltip direction="top">
              D{r.damage_score ?? '—'} · {r.region ?? 'Unspecified'}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Basemap switcher + queue counter */}
      <div className="map-controls">
        <label htmlFor="bm">Basemap (GSI)</label>
        <select id="bm" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
          {Object.entries(BASEMAPS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <div className="count">
          {loading ? 'Loading queue…' : `${records.length} unverified in queue`}
          {err && <span style={{ color: '#b42318' }}> · {err}</span>}
        </div>
      </div>

      {/* Damage legend */}
      <div className="map-legend">
        {legend.map((s) => (
          <div className="row" key={s}>
            <span className="dot" style={{ background: DAMAGE_COLOR[s] }} />
            {DAMAGE_LABEL[s]}
          </div>
        ))}
      </div>

      {selected && (
        <ReviewModal
          record={selected}
          reviewer={reviewer}
          onClose={() => setSelected(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
