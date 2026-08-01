import { useEffect, useMemo, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DAMAGE_COLOR } from '../lib/constants.js';

// Records that share (approximately) the same coordinate get stacked into one
// count badge, so a pile of geocoded-to-the-same-centroid observations is
// visible rather than hidden under a single dot. Clicking a badge fans its
// members out into a ring so each can be opened; moving the map re-collapses.

const PRECISION = 4; // ~11 m grouping resolution
const FAN_RADIUS_PX = 34;

function coordKey(r) {
  return `${r.latitude.toFixed(PRECISION)},${r.longitude.toFixed(PRECISION)}`;
}

function badgeColor(items) {
  const damages = items.map((i) => i.damage_score).filter((d) => d >= 0 && d <= 4);
  if (damages.length) return DAMAGE_COLOR[Math.max(...damages)] || '#555';
  return DAMAGE_COLOR[5] || '#2563eb'; // all great-performance
}

export default function ClusterGroup({ records, renderMarker }) {
  const map = useMap();
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const collapse = () => setExpanded(null);
    map.on('movestart zoomstart', collapse);
    return () => map.off('movestart zoomstart', collapse);
  }, [map]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const r of records) {
      if (r.latitude == null || r.longitude == null) continue;
      const k = coordKey(r);
      if (!m.has(k)) m.set(k, { key: k, items: [], center: [r.latitude, r.longitude] });
      m.get(k).items.push(r);
    }
    return [...m.values()];
  }, [records]);

  const out = [];
  for (const g of groups) {
    if (g.items.length === 1) {
      out.push(renderMarker(g.items[0], g.center, `${g.key}-solo`, true));
      continue;
    }
    if (expanded !== g.key) {
      const icon = L.divIcon({
        className: '',
        html: `<div class="cluster-badge" style="background:${badgeColor(g.items)}">${g.items.length}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      out.push(
        <Marker
          key={`${g.key}-cluster`}
          position={g.center}
          icon={icon}
          eventHandlers={{ click: () => setExpanded(g.key) }}
        />
      );
    } else {
      const c = map.latLngToLayerPoint(L.latLng(g.center[0], g.center[1]));
      g.items.forEach((it, i) => {
        const a = (2 * Math.PI * i) / g.items.length - Math.PI / 2;
        const pt = L.point(c.x + FAN_RADIUS_PX * Math.cos(a), c.y + FAN_RADIUS_PX * Math.sin(a));
        const ll = map.layerPointToLatLng(pt);
        out.push(renderMarker(it, [ll.lat, ll.lng], `${g.key}-${i}`, false));
      });
    }
  }
  return out;
}
