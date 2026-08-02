import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import ClusterGroup from './ClusterGroup.jsx';
import FilterBar from './FilterBar.jsx';
import RecordTable from './RecordTable.jsx';
import Zoomable from './Zoomable.jsx';
import { downloadFile } from '../lib/media.js';
import { emptyFilter, matchesFilter } from '../lib/filter.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, OBSERVATION_LABEL, HEIGHT_CLASSES, cap, fmtDate,
} from '../lib/constants.js';

const SUPA = import.meta.env.PUBLIC_SUPABASE_URL || '';
const DATA_URL = `${SUPA}/storage/v1/object/public/observation-media/public/kumamoto-2026-public.json`;
const CENTER = [32.79, 130.74];
const ZOOM = 10;
const GSI_URL = 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';
const GSI_ATTR = '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">地理院タイル (GSI Japan)</a>';

const DISCLAIMERS = [
  {
    title: 'Before you continue - please read',
    body: (
      <>
        <p><b>This is a Beta tool.</b> This Virtual Earthquake Reconnaissance Team (VERT) triage tool is under active development and is intended to eventually be hosted on the NZSEE website.</p>
        <p>Observations were captured within a short time frame following the event. NZSEE volunteers have made every effort to triage the information accurately, and copyright has been attributed where possible. Please contact NZSEE for any corrections or amendments.</p>
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
            <KV label="Observation type">{OBSERVATION_LABEL[site.observation_type] ?? '-'}</KV>
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

export default function PublicView() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(emptyFilter);
  const [view, setView] = useState('map');

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => setErr('The public data could not be loaded yet. Please check back shortly.'));
  }, []);

  const sites = useMemo(() => (data?.sites ?? []).filter((s) => s.lat != null && s.lng != null), [data]);
  const filtered = useMemo(() => sites.filter((s) => matchesFilter(s, filter)), [sites, filter]);
  const mapRecords = useMemo(() => filtered.map((s) => ({ ...s, id: s.site_id, latitude: s.lat, longitude: s.lng })), [filtered]);

  function renderMarker(s, pos, key, solo) {
    return (
      <CircleMarker key={key} center={pos} radius={9}
        pathOptions={{ color: '#ffffff', weight: 2, fillColor: DAMAGE_COLOR[s.damage_score] ?? '#9e9e9e', fillOpacity: 0.9 }}
        eventHandlers={{ click: () => setSelected(s) }}>
        <Tooltip direction="top">
          {solo && s.media_url && <img className="tip-thumb" src={s.media_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
          {s.site_id != null && `#${s.site_id} · `}
          {DAMAGE_LABEL[s.damage_score]?.split(' - ')[0] ?? '?'} · {OBSERVATION_LABEL[s.observation_type] ?? 'building'}
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
          <p>{data?.event?.name ?? '2026 Kumamoto Earthquake'} · Verified sites · <span className="beta-tag">Beta</span></p>
        </div>
      </header>

      <FilterBar filter={filter} setFilter={setFilter} shown={filtered.length} total={sites.length} view={view} setView={setView} hideSource />

      {view === 'map' ? (
        <div className="public-map-area">
          <MapContainer center={CENTER} zoom={ZOOM} className="triage-map" scrollWheelZoom>
            <TileLayer url={GSI_URL} attribution={GSI_ATTR} maxZoom={18} />
            <ClusterGroup records={mapRecords} renderMarker={renderMarker} />
          </MapContainer>
          <div className="map-legend">
            <div className="legend-title">Classification</div>
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <div className="row" key={s}><span className="dot" style={{ background: DAMAGE_COLOR[s] }} />{DAMAGE_LABEL[s]}</div>
            ))}
            <div className="count">{err ? err : `${filtered.length} verified site(s)`}{data?.generatedAt && !err ? ` · updated ${fmtDate(data.generatedAt)}` : ''}</div>
          </div>
        </div>
      ) : (
        <RecordTable records={filtered} mode="public" onOpen={setSelected} />
      )}

      {step < 2 && (
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
