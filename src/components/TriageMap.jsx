import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase, RECORD_COLUMNS } from '../lib/supabase.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, CLASSIFICATION_SCORES,
  SOURCE_COLOR, SOURCE_LABEL, OBSERVATION_LABEL,
} from '../lib/constants.js';
import { findDuplicates } from '../lib/dedupe.js';
import ClusterGroup from './ClusterGroup.jsx';
import ReviewModal from './ReviewModal.jsx';

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
 * Triage map. Loads 'Unverified' records (the queue) plus 'Approved' sites (for
 * duplicate matching). Dots are classification-coloured (D0-D4 damage, or the
 * distinct great-performance colour) with a provenance ring; likely duplicates
 * get a dashed red halo. Records sharing a coordinate cluster into a count
 * badge that fans out on click. Approving/rejecting/merging clears the dot.
 */
export default function TriageMap({ reviewer, othersByRecord, setActiveRecord }) {
  const [queue, setQueue] = useState([]);
  const [approved, setApproved] = useState([]);
  const [selected, setSelected] = useState(null);
  const [basemap, setBasemap] = useState('photo');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    setLoading(true);
    const [q, a] = await Promise.all([
      supabase.from('triage_records').select(RECORD_COLUMNS).eq('status', 'Unverified').order('created_at', { ascending: false }),
      supabase.from('triage_records').select(RECORD_COLUMNS).eq('status', 'Approved'),
    ]);
    setLoading(false);
    if (q.error) return setErr(q.error.message);
    setQueue((q.data ?? []).filter((r) => r.latitude != null && r.longitude != null));
    setApproved((a.data ?? []).filter((r) => r.latitude != null && r.longitude != null));
  }
  useEffect(() => { load(); }, []);

  const records = useMemo(
    () => queue.map((r) => ({ ...r, _dupes: findDuplicates(r, approved) })),
    [queue, approved]
  );

  function openRecord(r) { setSelected(r); setActiveRecord?.(r.id); }
  function closeRecord() { setSelected(null); setActiveRecord?.(null); }

  function handleResolved(id) {
    setQueue((prev) => prev.filter((r) => r.id !== id));
    closeRecord();
  }

  function handleSavedDraft(id, patch) {
    setQueue((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    closeRecord();
  }

  function renderMarker(r, pos, key) {
    const others = othersByRecord?.get(r.id) ?? [];
    return (
      <Fragment key={key}>
        {r._dupes?.length > 0 && (
          <CircleMarker center={pos} radius={15}
            pathOptions={{ color: '#e11d48', weight: 2, dashArray: '4 4', fill: false }}
            interactive={false} />
        )}
        {others.length > 0 && (
          <CircleMarker center={pos} radius={13}
            pathOptions={{ color: '#7c3aed', weight: 3, fill: false }}
            interactive={false} />
        )}
        <CircleMarker center={pos} radius={9}
          pathOptions={{
            color: SOURCE_COLOR[r.source_type] ?? '#ffffff',
            weight: 3,
            fillColor: DAMAGE_COLOR[r.damage_score] ?? '#9e9e9e',
            fillOpacity: 0.9,
          }}
          eventHandlers={{ click: () => openRecord(r) }}>
          <Tooltip direction="top">
              {r.site_id != null && `#${r.site_id} · `}
            {DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '?'} · {OBSERVATION_LABEL[r.observation_type] ?? 'building'} · {SOURCE_LABEL[r.source_type] ?? 'other'}
            {r._dupes?.length > 0 && ' · possible duplicate'}
            {others.length > 0 && ` · in use by ${others.join(', ')}`}
          </Tooltip>
        </CircleMarker>
      </Fragment>
    );
  }

  const base = BASEMAPS[basemap];
  const dupCount = records.filter((r) => r._dupes.length).length;

  return (
    <div className="triage-wrap">
      <MapContainer center={CENTER} zoom={ZOOM} className="triage-map" scrollWheelZoom>
        <TileLayer url={base.url} attribution={GSI_ATTRIBUTION} maxZoom={18} />
        <FitToData records={records} />
        <ClusterGroup records={records} renderMarker={renderMarker} />
      </MapContainer>

      <div className="map-controls">
        <label htmlFor="bm">Basemap (GSI)</label>
        <select id="bm" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
          {Object.entries(BASEMAPS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="count">
          {loading ? 'Loading queue...' : `${records.length} unverified in queue`}
          {dupCount > 0 && <span style={{ color: '#e11d48' }}> · {dupCount} possible duplicate(s)</span>}
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
        <div className="legend-title" style={{ marginTop: 6 }}>Source (ring)</div>
        {Object.entries(SOURCE_LABEL).map(([k, label]) => (
          <div className="row" key={k}>
            <span className="dot ring" style={{ borderColor: SOURCE_COLOR[k] }} />
            {label}
          </div>
        ))}
        <div className="row" style={{ marginTop: 4 }}>
          <span className="dot ring" style={{ borderColor: '#e11d48', borderStyle: 'dashed' }} />
          Possible duplicate
        </div>
        <div className="row">
          <span className="dot ring" style={{ borderColor: '#7c3aed' }} />
          In use by someone
        </div>
      </div>

      {selected && (
        <ReviewModal
          record={selected}
          reviewer={reviewer}
          others={othersByRecord?.get(selected.id) ?? []}
          onClose={closeRecord}
          onResolved={handleResolved}
          onSavedDraft={handleSavedDraft}
        />
      )}
    </div>
  );
}
