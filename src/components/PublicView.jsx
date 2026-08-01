import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import ClusterGroup from './ClusterGroup.jsx';
import Zoomable from './Zoomable.jsx';
import { downloadFile } from '../lib/media.js';
import {
  DAMAGE_COLOR, DAMAGE_LABEL, OBSERVATION_LABEL, HEIGHT_CLASSES, cap,
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
        <p>If you have further information, corrections, or amendments for any of these sites, please contact NZSEE.</p>
      </>
    ),
    button: 'View the sites',
  },
];

function heightLabel(v) { return HEIGHT_CLASSES.find((h) => h.value === v)?.label ?? v; }

function PublicDetail({ site, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="head">
          <h2>Site #{site.site_id}{site.region ? ` - ${site.region}` : ''}</h2>
          <button className="x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="body">
          {site.media_url && <Zoomable className="media" src={site.media_url} alt="Site photo" />}
          <p className="kv"><b>Classification:</b> {DAMAGE_LABEL[site.damage_score] ?? '-'}</p>
          <p className="kv"><b>Observation type:</b> {OBSERVATION_LABEL[site.observation_type] ?? '-'}</p>
          {site.building_name && <p className="kv"><b>Building:</b> {site.building_name}</p>}
          {site.building_type && <p className="kv"><b>Building type:</b> {cap(site.building_type)}</p>}
          {site.primary_material && <p className="kv"><b>Primary material:</b> {cap(site.primary_material)}</p>}
          {site.height_class && <p className="kv"><b>Height:</b> {heightLabel(site.height_class)}</p>}
          {site.code_era && <p className="kv"><b>Code era:</b> {cap(site.code_era)}</p>}
          {site.failure_mechanism && <p className="kv"><b>Failure mechanism:</b> {site.failure_mechanism}</p>}
          <p className="kv"><b>Non-structural damage:</b> {site.nonstructural_damage ? 'Yes' : 'No'}</p>
          {site.engineer_notes && <p className="kv"><b>Notes:</b> {site.engineer_notes}</p>}
          {site.source_url && <p className="kv"><b>Source:</b> <a href={site.source_url} target="_blank" rel="noreferrer">link</a></p>}
          {site.streetview_url && <p className="kv"><b>Street View:</b> <a href={site.streetview_url} target="_blank" rel="noreferrer">image</a></p>}
          {(site.lat != null && site.lng != null) && <p className="kv"><b>Coordinates:</b> {site.lat}, {site.lng}</p>}

          {site.attachments?.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, margin: '10px 0 6px' }}>Attachments</h3>
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
  const [step, setStep] = useState(0); // 0,1 = disclaimers; 2 = viewer
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(DATA_URL)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => setErr('The public data could not be loaded yet. Please check back shortly.'));
  }, []);

  const sites = useMemo(() => (data?.sites ?? []).filter((s) => s.lat != null && s.lng != null), [data]);

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

      <div className="public-map-area">
        <MapContainer center={CENTER} zoom={ZOOM} className="triage-map" scrollWheelZoom>
          <TileLayer url={GSI_URL} attribution={GSI_ATTR} maxZoom={18} />
          <ClusterGroup records={sites.map((s) => ({ ...s, id: s.site_id, latitude: s.lat, longitude: s.lng }))} renderMarker={renderMarker} />
        </MapContainer>
        <div className="map-legend">
          <div className="legend-title">Classification</div>
          {[0, 1, 2, 3, 4, 5].map((s) => (
            <div className="row" key={s}><span className="dot" style={{ background: DAMAGE_COLOR[s] }} />{DAMAGE_LABEL[s]}</div>
          ))}
          <div className="count">{err ? err : `${sites.length} verified site(s)`}{data?.generatedAt && !err ? ` · updated ${new Date(data.generatedAt).toLocaleDateString()}` : ''}</div>
        </div>
      </div>

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
