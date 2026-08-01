import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, CLASSIFICATION_SCORES, SOURCE_LABEL, OBSERVATION_LABEL,
} from '../lib/constants.js';
import ClusterGroup from './ClusterGroup.jsx';
import FilterBar from './FilterBar.jsx';
import RecordTable from './RecordTable.jsx';
import { emptyFilter, matchesFilter } from '../lib/filter.js';
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
 * Map (or table) of triaged (Approved) sites. Dots are coloured by classification
 * only, with a thin neutral outline and a violet ring when someone else has the
 * record open. Click a site to review and enrich it.
 */
export default function TriagedSites({ reviewer, othersByRecord, setActiveRecord }) {
  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [basemap, setBasemap] = useState('photo');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState(emptyFilter);
  const [view, setView] = useState('map');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('triage_records')
      .select(RECORD_COLUMNS)
      .eq('status', 'Approved')
      .is('merged_into', null)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) return setErr(error.message);
    setRecords((data ?? []).filter((r) => r.latitude != null && r.longitude != null));
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => records.filter((r) => matchesFilter(r, filter)), [records, filter]);

  function openRecord(r) { setSelected(r); setActiveRecord?.(r.id); }
  function closeRecord() { setSelected(null); setActiveRecord?.(null); }

  function renderMarker(r, pos, key, solo) {
    const others = othersByRecord?.get(r.id) ?? [];
    return (
      <Fragment key={key}>
        {others.length > 0 && (
          <CircleMarker center={pos} radius={13}
            pathOptions={{ color: '#7c3aed', weight: 3, fill: false }} interactive={false} />
        )}
        <CircleMarker center={pos} radius={9}
          pathOptions={{ color: '#ffffff', weight: 2, fillColor: DAMAGE_COLOR[r.damage_score] ?? '#9e9e9e', fillOpacity: 0.9 }}
          eventHandlers={{ click: () => openRecord(r) }}>
          <Tooltip direction="top">
            {solo && r.media_url && <img className="tip-thumb" src={r.media_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
            {r.site_id != null && `#${r.site_id} · `}
            {DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '?'} · {OBSERVATION_LABEL[r.observation_type] ?? 'building'} · {SOURCE_LABEL[r.source_type] ?? 'other'}
            {others.length > 0 && ` · in use by ${others.join(', ')}`}
          </Tooltip>
        </CircleMarker>
      </Fragment>
    );
  }

  const base = BASEMAPS[basemap];

  return (
    <div className="triage-wrap">
      <FilterBar filter={filter} setFilter={setFilter} shown={filtered.length} total={records.length} view={view} setView={setView} />

      {view === 'map' ? (
        <div className="map-area">
          <MapContainer center={CENTER} zoom={ZOOM} className="triage-map" scrollWheelZoom>
            <TileLayer url={base.url} attribution={GSI_ATTRIBUTION} maxZoom={18} />
            <FitToData records={filtered} />
            <ClusterGroup records={filtered} renderMarker={renderMarker} />
          </MapContainer>

          <div className="map-controls">
            <label htmlFor="bm2">Basemap (GSI)</label>
            <select id="bm2" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
              {Object.entries(BASEMAPS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="count">
              {loading ? 'Loading sites...' : `${filtered.length} shown`}
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
            <div className="row" style={{ marginTop: 4 }}>
              <span className="dot ring" style={{ borderColor: '#7c3aed' }} />
              In use by someone
            </div>
          </div>
        </div>
      ) : (
        <RecordTable records={filtered} mode="triaged" othersByRecord={othersByRecord} onOpen={openRecord} />
      )}

      {selected && (
        <SiteDetailModal
          record={selected}
          reviewer={reviewer}
          others={othersByRecord?.get(selected.id) ?? []}
          onClose={closeRecord}
          onSaved={(id, patch) => setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
        />
      )}
    </div>
  );
}
