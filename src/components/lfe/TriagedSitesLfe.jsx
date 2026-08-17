import { Fragment, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabaseLfe, LFE_RECORD_COLUMNS } from '../../lib/supabaseLfe.js';
import { useEvent, basemapEntries, mapCenterOf } from '../../lib/useEvent.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, CLASSIFICATION_SCORES, SOURCE_LABEL, observationTypesLabel,
} from '../../lib/constantsLfe.js';
import ClusterGroup from '../ClusterGroup.jsx';
import FilterBarLfe from './FilterBarLfe.jsx';
import RecordTableLfe from './RecordTableLfe.jsx';
import { emptyFilter, matchesFilter } from '../../lib/filterLfe.js';
import SiteDetailModalLfe from './SiteDetailModalLfe.jsx';

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
 * Map (or table) of triaged (Approved) sites for the current event. Dots are
 * coloured by classification only, with a thin neutral outline and a violet
 * ring when someone else has the record open. Click a site to review and
 * enrich it.
 */
export default function TriagedSitesLfe({ reviewer, othersByRecord, setActiveRecord }) {
  const { event } = useEvent();
  const eventId = event?.id;
  const options = useMemo(() => basemapEntries(event), [event]);
  const { center, zoom } = mapCenterOf(event);

  const [records, setRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [basemap, setBasemap] = useState(options[0]?.[0] ?? '');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState(emptyFilter);
  const [view, setView] = useState('map');

  async function load() {
    if (!eventId) return;
    setLoading(true);
    const { data, error } = await supabaseLfe
      .from('triage_records')
      .select(LFE_RECORD_COLUMNS)
      .eq('event_id', eventId)
      .eq('status', 'Approved')
      .is('merged_into', null)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) return setErr(error.message);
    setRecords((data ?? []).filter((r) => r.latitude != null && r.longitude != null));
  }
  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

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
            {DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '?'} · {observationTypesLabel(r.observation_types)} · {SOURCE_LABEL[r.source_type] ?? 'other'}
            {others.length > 0 && ` · in use by ${others.join(', ')}`}
          </Tooltip>
        </CircleMarker>
      </Fragment>
    );
  }

  const base = options.find(([k]) => k === basemap)?.[1];

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
            <label htmlFor="bm2">Basemap</label>
            <select id="bm2" value={basemap} onChange={(e) => setBasemap(e.target.value)}>
              {options.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
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
        <RecordTableLfe records={filtered} mode="triaged" othersByRecord={othersByRecord} onOpen={openRecord} />
      )}

      {selected && (
        <SiteDetailModalLfe
          record={selected}
          reviewer={reviewer}
          others={othersByRecord?.get(selected.id) ?? []}
          onClose={closeRecord}
          onSaved={(id, patch) => setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))}
          onUnverified={(id) => { setRecords((prev) => prev.filter((r) => r.id !== id)); closeRecord(); }}
        />
      )}
    </div>
  );
}
