import { useEffect, useRef } from 'react'
// Namespace import, not named imports: maplibre-gl ships a CJS build whose
// named exports Node's static analysis (used during Astro's SSR pass) can't
// always resolve reliably - destructuring off the namespace object works
// either way.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { boundsOf } from '../../lib/geo'

const MAPTILER_KEY = import.meta.env.PUBLIC_MAPTILER_KEY

function numberMarkerEl(n) {
  const el = document.createElement('div')
  el.style.width = '28px'
  el.style.height = '28px'
  el.style.borderRadius = '50%'
  el.style.backgroundColor = '#17638f'
  el.style.color = 'white'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.fontWeight = '900'
  el.style.fontSize = '12px'
  el.style.border = '2px solid white'
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'
  el.textContent = String(n)
  return el
}

// Renders numbered stop markers + street-following polyline legs when a
// MapTiler key is configured (PUBLIC_MAPTILER_KEY). Without a key the
// itinerary list remains the primary, fully-usable interface - see
// docs/seismic-walk-tour-scope.md section 5/7 (map is not a hard dependency).
export default function RouteMap({ stops, geometry, startPoint, userLocation }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

  useEffect(() => {
    if (!MAPTILER_KEY || !containerRef.current || mapRef.current) return
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [172.6367, -43.5309],
      zoom: 14,
    })
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
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
        const marker = new maplibregl.Marker({ element: numberMarkerEl(idx + 1) })
          .setLngLat([stop.lng, stop.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(stop.name))
          .addTo(map)
        markersRef.current.push(marker)
      })

      if (userLocation) {
        const el = document.createElement('div')
        el.style.width = '16px'
        el.style.height = '16px'
        el.style.borderRadius = '50%'
        el.style.backgroundColor = '#2563eb'
        el.style.border = '3px solid white'
        el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)'
        const marker = new maplibregl.Marker({ element: el }).setLngLat([userLocation.lng, userLocation.lat]).addTo(map)
        markersRef.current.push(marker)
      }

      const lineCoords = geometry && geometry.length > 0
        ? geometry.map((p) => [p.lng, p.lat])
        : points.map((p) => [p.lng, p.lat])

      const source = map.getSource('route-line')
      const data = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: lineCoords },
        properties: {},
      }
      if (source) {
        source.setData(data)
      } else {
        map.addSource('route-line', { type: 'geojson', data })
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-line',
          paint: { 'line-color': '#17638f', 'line-width': 4, 'line-dasharray': geometry ? [1, 0] : [0.5, 1.5] },
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
  }, [stops, geometry, startPoint, userLocation])

  if (!MAPTILER_KEY) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-500 font-bold mb-1">Map preview not configured</p>
        <p className="text-xs text-slate-400">
          Set a <code className="bg-slate-100 px-1 rounded">PUBLIC_MAPTILER_KEY</code> env var to show the route map. The itinerary below works fully without it.
        </p>
      </div>
    )
  }

  return <div ref={containerRef} className="w-full h-[420px] rounded-3xl overflow-hidden border-2 border-slate-100" />
}
