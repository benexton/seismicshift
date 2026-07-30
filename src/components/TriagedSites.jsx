import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, CLASSIFICATION_SCORES,
  SOURCE_COLOR, SOURCE_LABEL, OBSERVATION_LABEL,
} from '../lib/constants.js';
import ClusterGroup from './ClusterGroup.jsx';
import SiteDetailModal from './SiteDetailModal.jsx';

const BASEMAPS = {
  photo: { label: 'GSI Aerial (seamless photo)', url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg' },
  pale:  { label: 'GSI Pale', url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png' },
  std:   { label: 'GSI Standard', url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png' },
};
const GSI_ATTRIBUTION =
  '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル (GSI Japan)</a>';
const CENTER = [32.79, 130.74];
const ZOOM = 11;

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

/**
 * Map of already-triaged (Approved) sites. Click a site to review it and add
 * extra photos, sources, or notes. Same clustering and classification colours
 * as the triage queue.
 */
export default function TriagedSites({ reviewer }) {
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
      .eq('status', 'Approved')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) return setErr(error.message);
    setRecords((data ?? []).filter((r) => r.latitude != null && r.longitude != null));
  }
  useEffect(() => { load(); }, []);

  function renderMarker(r, pos, key) {
    return (
      <CircleMarker key={key} center={pos} radius={9}
        pathOptions={{
          color: SOURCE_COLOR[r.source_type] ?? '#ffffff',
          weight: 3,
          fillColor: DAMAGE_COLOR[r.damage_score] ?? '#9e9e9e',
          fillOpacity: 0.9,
        }}
        eventHandlers={{ click: () => setSelected(r) }}>
        <Tooltip direction="top">
              {r.site_id != null && `#${r.site_id} · `}
          {DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '?'} · {OBSERVATION_LABEL[r.observation_type] ?? 'building'} · {SOURCE_LABEL[r.source_type] ?? 'other'}
        </Tooltip>
      </CircleMarker>
    );
  }

  const base = BASEMAPS[basemap];

  return (
    <div className="triage-wrap">
      <MapContainer center={CENTER} zoom={ZOOM} className="triage-map" scrollWheelZoom>
        <TileLayer url={base.url} attribution={GSI_ATTRIBUTION} maxZoom={18} />
        <FitToData records={records} />
        <ClusterGroup records={records} renderMarker={renderMarker} />
      </MapContainer>

      <div className="map-controls">
        <label htmlFor="bm2">Basemap (GSI)</label>
        <select id="bm2" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
          {Object.entries(BASEMAPS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="count">
          {loading ? 'Loading sites...' : `${records.length} triaged site(s)`}
          {err && <span style={{ color: '#b42318' }}> · {err}</span>}
        </div>
      </div>

      <div className="map-legend">
        <div className="legend-title">Classification (fill)</div>
        {CLASSIFICATION_SCORES.map((s) => (
          <div className="row" key={s}>
            <span className="dot" style={{ background: DAMAGE_COLOR[s] }} />
            {DAMAGE_LABEL[s]}
          </div>
        ))}
      </div>

      {selected && (
        <SiteDetailModal record={selected} reviewer={reviewer} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
