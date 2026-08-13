import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabaseLfe, LFE_RECORD_COLUMNS } from '../../lib/supabaseLfe.js';
import { useEvent, basemapEntries, mapCenterOf } from '../../lib/useEvent.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, CLASSIFICATION_SCORES,
  SOURCE_COLOR, SOURCE_LABEL, observationTypesLabel,
} from '../../lib/constantsLfe.js';
import { findDuplicates } from '../../lib/dedupe.js';
import ClusterGroup from '../ClusterGroup.jsx';
import FilterBarLfe from './FilterBarLfe.jsx';
import RecordTableLfe from './RecordTableLfe.jsx';
import { emptyFilter, matchesFilter } from '../../lib/filterLfe.js';
import ReviewModalLfe from './ReviewModalLfe.jsx';

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
 * Triage map, event-scoped. Loads 'Unverified' records (the queue) plus
 * 'Approved' sites (for duplicate matching) for the current event only. Dots
 * are classification-coloured (D0-D4 damage, or the distinct great-performance
 * colour) with a provenance ring; likely duplicates get a dashed red halo.
 * Records sharing a coordinate cluster into a count badge that fans out on
 * click. Approving/rejecting/merging clears the dot.
 */
export default function TriageMapLfe({ reviewer, othersByRecord, setActiveRecord }) {
  const { event } = useEvent();
  const eventId = event?.id;
  const options = useMemo(() => basemapEntries(event), [event]);
  const { center, zoom } = mapCenterOf(event);

  const [queue, setQueue] = useState([]);
  const [approved, setApproved] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(emptyFilter);
  const [view, setView] = useState('map');
  const [basemap, setBasemap] = useState(options[0]?.[0] ?? '');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  async function load() {
    if (!eventId) return;
    setLoading(true);
    const [q, a] = await Promise.all([
      supabaseLfe.from('triage_records').select(LFE_RECORD_COLUMNS)
        .eq('event_id', eventId).eq('status', 'Unverified').is('merged_into', null)
        .order('created_at', { ascending: false }),
      supabaseLfe.from('triage_records').select(LFE_RECORD_COLUMNS)
        .eq('event_id', eventId).eq('status', 'Approved').is('merged_into', null),
    ]);
    setLoading(false);
    if (q.error) return setErr(q.error.message);
    setQueue((q.data ?? []).filter((r) => r.latitude != null && r.longitude != null));
    setApproved((a.data ?? []).filter((r) => r.latitude != null && r.longitude != null));
  }
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const records = useMemo(
    () => queue.map((r) => ({ ...r, _dupes: findDuplicates(r, approved) })),
    [queue, approved]
  );
  const filtered = useMemo(() => records.filter((r) => matchesFilter(r, filter)), [records, filter]);

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

  function renderMarker(r, pos, key, solo) {
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
        {r.location_precision === 'ai_estimated' && (
          <CircleMarker center={pos} radius={11}
            pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '2 3', fill: false }}
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
              {solo && r.media_url && <img className="tip-thumb" src={r.media_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
              {r.site_id != null && `#${r.site_id} · `}
            {DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '?'} · {observationTypesLabel(r.observation_types)} · {SOURCE_LABEL[r.source_type] ?? 'other'}
            {r._dupes?.length > 0 && ' · possible duplicate'}
            {others.length > 0 && ` · in use by ${others.join(', ')}`}
            {r.location_precision === 'ai_estimated' && ' · AI-estimated location'}
          </Tooltip>
        </CircleMarker>
      </Fragment>
    );
  }

  const base = options.find(([k]) => k === basemap)?.[1];
  const dupCount = records.filter((r) => r._dupes.length).length;

  return (
    <div className="triage-wrap">
      <FilterBarLfe filter={filter} setFilter={setFilter} shown={filtered.length} total={records.length} view={view} setView={setView} />
      {view === 'map' ? (
      <div className="map-area">
      <MapContainer center={center} zoom={zoom} className="triage-map" scrollWheelZoom zoomAnimation={false}>
        {base && <TileLayer url={base.url} attribution={base.attribution ?? ''} maxZoom={18} />}
        <FitToData records={filtered} />
        <ClusterGroup records={filtered} renderMarker={renderMarker} />
      </MapContainer>

      <div className="map-controls">
        <label htmlFor="bm">Basemap</label>
        <select id="bm" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
          {options.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="count">
          {loading ? 'Loading queue...' : `${filtered.length} shown`}
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
        <div className="row">
          <span className="dot ring" style={{ borderColor: '#f59e0b', borderStyle: 'dashed' }} />
          AI-estimated location - needs confirmation
        </div>
      </div>
      </div>
      ) : (
        <RecordTableLfe records={filtered} mode="queue" othersByRecord={othersByRecord} onOpen={openRecord} />
      )}

      {selected && (
        <ReviewModalLfe
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
