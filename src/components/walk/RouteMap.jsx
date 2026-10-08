import { useEffect, useRef } from 'react'
// Namespace import, not named imports: maplibre-gl ships a CJS build whose
// named exports Node's static analysis (used during Astro's SSR pass) can't
// always resolve reliably - destructuring off the namespace object works
// either way.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { boundsOf } from '../../lib/geo'
import { WALK, stopColor } from './theme'

const MAPTILER_KEY = import.meta.env.PUBLIC_MAPTILER_KEY

function numberMarkerEl(n, color = WALK.maroon) {
  const el = document.createElement('div')
  el.style.width = '28px'
  el.style.height = '28px'
  el.style.borderRadius = '50%'
  el.style.backgroundColor = color
  el.style.color = 'white'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontWeight = '800'
  el.style.fontSize = '12px'
  el.style.border = '2px solid white'
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
  el.textContent = String(n)
  return el
}

function startMarkerEl() {
  const el = document.createElement('div')
  el.style.padding = '3px 8px'
  el.style.borderRadius = '999px'
  el.style.backgroundColor = WALK.red
  el.style.color = 'white'
  el.style.fontWeight = '800'
  el.style.fontSize = '11px'
  el.style.letterSpacing = '0.08em'
  el.style.border = '2px solid white'
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
  el.textContent = 'START'
  return el
}

// Renders numbered stop markers + street-following polyline legs when a
// MapTiler key is configured (PUBLIC_MAPTILER_KEY). Without a key the
// itinerary list remains the primary, fully-usable interface - see
// docs/seismic-walk-tour-scope.md section 5/7 (map is not a hard dependency).
export default function RouteMap({ stops, geometry, startPoint, userLocation, loop }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const geolocateRef = useRef(null)
  const autoLocatedRef = useRef(false)

  useEffect(() => {
    if (!MAPTILER_KEY || !containerRef.current || mapRef.current) return
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [172.6367, -43.5309],
      zoom: 14,
      // Without this, a WebGL canvas can come out blank when the page is
      // printed - and the printed itinerary is one of the main outputs.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    // Live "you are here" dot that follows the phone as people walk the
    // route. Tapping the control turns it on; it's switched on automatically
    // below when the walker has already shared their location.
    geolocateRef.current = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
    })
    mapRef.current.addControl(geolocateRef.current, 'top-right')
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false

    // Markers, the route line, and fitBounds all touch the style/source
    // pipeline - calling them before the style has actually finished loading
    // races MapLibre's own async style/tile fetch and can leave the map
    // showing only its background fill with no vector tiles ever requested.
    // Deferring the whole update to the 'load' event (or running immediately
    // if it already fired) avoids that race entirely.
    const runUpdate = () => {
      if (cancelled) return

      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      const points = startPoint ? [startPoint, ...stops] : stops
      if (points.length === 0) return

      stops.forEach((stop, idx) => {
        const marker = new maplibregl.Marker({ element: numberMarkerEl(idx + 1, stopColor(stop)) })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(stop.name))
          .addTo(map)
        markersRef.current.push(marker)
      })

      // The start (Te Pae, another chosen building, or where the walker was
      // when they shared their location) isn't a numbered stop, but without a
      // marker the route line just begins from nowhere. Their live position
      // is the separate blue dot from the GeolocateControl.
      if (startPoint) {
        const marker = new maplibregl.Marker({ element: startMarkerEl() })
          .setLngLat([startPoint.lng, startPoint.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(`Start: ${startPoint.name}`))
          .addTo(map)
        markersRef.current.push(marker)
      }

      // Location already shared (they started from "my location"): start
      // tracking straight away rather than making them find the control.
      // Only once - after that the control's own on/off state is theirs.
      if (userLocation && !autoLocatedRef.current && geolocateRef.current) {
        autoLocatedRef.current = true
        geolocateRef.current.trigger()
      }

      // The fetched geometry already includes the closing leg when looped
      // (see optimise() in TourApp.jsx), but the straight-line fallback
      // needs its own last point re-added to actually close the loop.
      const fallbackPoints = loop && points.length > 1 ? [...points, points[0]] : points
      const lineCoords = geometry && geometry.length > 0
        ? geometry.map((p) => [p.lng, p.lat])
        : fallbackPoints.map((p) => [p.lng, p.lat])

      const source = map.getSource('route-line')
      const data = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: lineCoords },
        properties: {},
      }
      // Solid once the street-following geometry has arrived, dotted for the
      // straight-line placeholder. Set on every update, not just when the
      // layer is first added - the layer is always created before the
      // directions fetch resolves, so a create-time-only style stayed dotted
      // for good.
      const dash = geometry ? [1, 0] : [0.5, 1.5]
      if (source) {
        source.setData(data)
        map.setPaintProperty('route-line', 'line-dasharray', dash)
      } else {
        map.addSource('route-line', { type: 'geojson', data })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-line',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': WALK.red, 'line-width': 4, 'line-dasharray': dash },
        })
      }

      const bounds = boundsOf(points)
      if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 500 })
    }

    if (map.isStyleLoaded()) runUpdate()
    else map.once('load', runUpdate)

    return () => {
      cancelled = true
    }
  }, [stops, geometry, startPoint, userLocation, loop])

  if (!MAPTILER_KEY) {
    return (
      <div className="print:hidden rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-500 font-bold mb-1">Map preview not configured</p>
        <p className="text-xs text-slate-400">
          Set a <code className="bg-slate-100 px-1 rounded">PUBLIC_MAPTILER_KEY</code> env var to show the route map. The itinerary below works fully without it.
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-72 sm:h-96 md:h-[420px] print:h-64 rounded-xl overflow-hidden border border-[#e7dfe0]" />
}
