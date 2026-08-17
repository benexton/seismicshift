import { useState } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

/**
 * Marks an event's epicentre on a map, deliberately unlike a site dot: a
 * red/black star (the standard seismological convention for an epicentre,
 * as opposed to a circular observation) with a pulsing "shockwave" ring so
 * it reads as the origin point rather than one more record. Hover shows a
 * quick summary (magnitude, depth, origin time); clicking opens the same
 * detail in a small modal, so it's reachable on touch devices too.
 *
 * `info` is the shape returned by epicentreMetaOf() in useEvent.js - pass
 * null/undefined to render nothing (e.g. event has no epicentre set yet).
 */

const ICON = L.divIcon({
  className: 'epicentre-icon',
  html: `
    <div class="epicentre-pulse"></div>
    <svg class="epicentre-star" viewBox="0 0 24 24" width="28" height="28">
      <path d="M12 1.2 L14.7 8.9 L22.8 9.5 L16.5 14.6 L18.6 22.5 L12 18 L5.4 22.5 L7.5 14.6 L1.2 9.5 L9.3 8.9 Z"
        fill="#b42318" stroke="#fff" stroke-width="1.3" stroke-linejoin="round" />
    </svg>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 15],
});

function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function summaryLine(info) {
  const parts = [];
  if (info.magnitude != null) parts.push(`M${info.magnitude}`);
  if (info.depth != null) parts.push(`${info.depth} km deep`);
  const dt = fmtDateTime(info.datetime);
  if (dt) parts.push(dt);
  return parts.join(' · ');
}

// Same star, static and un-pulsed, for the map legend.
export function LegendStar() {
  return (
    <svg className="legend-star" viewBox="0 0 24 24" width="14" height="14">
      <path d="M12 1.2 L14.7 8.9 L22.8 9.5 L16.5 14.6 L18.6 22.5 L12 18 L5.4 22.5 L7.5 14.6 L1.2 9.5 L9.3 8.9 Z"
        fill="#b42318" stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export default function EpicentreMarker({ info }) {
  const [open, setOpen] = useState(false);
  if (!info) return null;

  const summary = summaryLine(info);

  return (
    <>
      <Marker position={[info.lat, info.lng]} icon={ICON} zIndexOffset={1000}
        eventHandlers={{ click: () => setOpen(true) }}>
        <Tooltip direction="top" offset={[0, -12]}>
          <div className="epicentre-tip">
            <b>Mainshock epicentre{info.name ? ` · ${info.name}` : ''}</b>
            {summary && <div>{summary}</div>}
          </div>
        </Tooltip>
      </Marker>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="head">
              <h2>Mainshock epicentre{info.name ? ` · ${info.name}` : ''}</h2>
              <button className="x" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
            <div className="body epicentre-detail">
              {info.locationName && <p className="kv"><b>Location:</b> {info.locationName}</p>}
              {info.datetime && <p className="kv"><b>Origin time:</b> {fmtDateTime(info.datetime)}</p>}
              {info.magnitude != null && <p className="kv"><b>Magnitude:</b> M{info.magnitude}</p>}
              {info.depth != null && <p className="kv"><b>Depth:</b> {info.depth} km</p>}
              {info.maxMmi && <p className="kv"><b>Max MMI:</b> {info.maxMmi}</p>}
              {info.faulting && <p className="kv"><b>Faulting:</b> {info.faulting}</p>}
              {info.tsunami && <p className="kv"><b>Tsunami:</b> {info.tsunami}</p>}
              <p className="kv"><b>Coordinates:</b> {info.lat.toFixed(4)}, {info.lng.toFixed(4)}</p>
              {info.usgsEventId && (
                <p className="kv">
                  <b>USGS:</b>{' '}
                  <a href={`https://earthquake.usgs.gov/earthquakes/eventpage/${info.usgsEventId}`} target="_blank" rel="noreferrer">
                    {info.usgsEventId}
                  </a>
                </p>
              )}
            </div>
            <div className="foot">
              <span className="grow" />
              <button className="btn secondary" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
