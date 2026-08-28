import { useEffect, useMemo, useState } from 'react'
import buildingsData from '../../data/buildings.json'
import { solveRoute } from '../../lib/tsp'
import { getWalkDistance } from '../../lib/matrixDistance'
import { formatDistance, formatDuration, walkMinutes } from '../../lib/geo'
import { fetchRouteGeometry } from '../../lib/route'
import { readShareStateFromUrl } from '../../lib/share'
import { hasAcknowledgedDisclaimer } from '../../lib/disclaimerStorage'
import DisclaimerGate from './DisclaimerGate'
import BuildingList from './BuildingList'
import SelectionBar from './SelectionBar'
import StartPointPicker from './StartPointPicker'
import RouteItinerary from './RouteItinerary'
import RouteMap from './RouteMap'
import BuildingDetail from './BuildingDetail'
import ShareButton from './ShareButton'
import PrintButton from './PrintButton'
import InstallPrompt from './InstallPrompt'
import ConferenceVenueCard from './ConferenceVenueCard'

const VIRTUAL_START_ID = '__start__'
const DEFAULT_START_ID = 'te-pae'
const buildingsById = Object.fromEntries(buildingsData.map((b) => [b.id, b]))
// Te Pae is the conference venue and default start point, not a tour stop -
// it gets its own info card (ConferenceVenueCard) instead of a selectable
// tile in the building list.
const tourBuildings = buildingsData.filter((b) => b.id !== DEFAULT_START_ID)

function trackEvent(name, params) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', name, params)
}

export default function TourApp() {
  // Astro server-renders this component before hydrating it. sessionStorage
  // and the URL's ?r= share param are both browser-only, so reading them
  // straight into the initial useState (as this used to) makes the client's
  // first render disagree with the server-rendered HTML - React then throws
  // a hydration-mismatch error and discards + rebuilds the whole tree, which
  // is what made the disclaimer gate appear to "vanish on its own". Instead,
  // state starts at the same SSR-safe defaults on both sides, and a
  // mount-only effect (client-only by definition) applies the real values
  // right after hydration completes.
  const [disclaimerOpen, setDisclaimerOpen] = useState(true)
  const [acknowledged, setAcknowledged] = useState(false)

  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [startId, setStartId] = useState(DEFAULT_START_ID)
  const [loop, setLoop] = useState(true)
  const [userLocation, setUserLocation] = useState(null)
  const [detailBuilding, setDetailBuilding] = useState(null)
  // Snapshot of the route inputs at the moment "Optimise" was last clicked,
  // plus the (possibly still-loading) fetched polyline for it. Comparing its
  // key against the live routeKey - rather than resetting state from an
  // effect - is what makes a later selection/start/loop change fall back to
  // "rough estimate" framing automatically.
  const [optimisedSnapshot, setOptimisedSnapshot] = useState(null)

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration sync
       from sessionStorage/the URL, both browser-only; there's no way to derive
       this without an effect (see the comment above the state declarations) */
    if (hasAcknowledgedDisclaimer()) {
      setDisclaimerOpen(false)
      setAcknowledged(true)
    }
    const shareState = readShareStateFromUrl()
    if (shareState) {
      setSelectedIds(new Set(shareState.ids))
      setStartId(shareState.startId)
      setLoop(shareState.loop)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  const selectedBuildings = useMemo(
    () => buildingsData.filter((b) => selectedIds.has(b.id)),
    [selectedIds]
  )

  // The start point (Te Pae by default, or wherever the picker is set to) is
  // a walking origin, not necessarily somewhere on the tour - most people
  // will start from the conference venue or their live location without
  // wanting it as a stop in its own right. If it isn't one of the ticked
  // buildings, it's injected as an extra "virtual" node so the route begins
  // there without appearing as a numbered stop in the itinerary. When it's a
  // real building (not live geolocation), it keeps that building's own id
  // rather than a synthetic one, so matrixDistance.ts can still look up its
  // precomputed real distances instead of silently falling back to haversine.
  const virtualStart = useMemo(() => {
    if (userLocation) return { id: VIRTUAL_START_ID, lat: userLocation.lat, lng: userLocation.lng, name: 'Your location' }
    if (startId && !selectedIds.has(startId)) {
      const building = buildingsById[startId]
      if (building) return { id: building.id, lat: building.lat, lng: building.lng, name: building.name }
    }
    return null
  }, [userLocation, startId, selectedIds])

  const nodes = useMemo(() => {
    const base = selectedBuildings.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng }))
    if (virtualStart) return [{ id: virtualStart.id, lat: virtualStart.lat, lng: virtualStart.lng }, ...base]
    return base
  }, [selectedBuildings, virtualStart])

  const effectiveStartId = virtualStart ? virtualStart.id : (startId && selectedIds.has(startId) ? startId : null)

  const routeResult = useMemo(() => {
    if (nodes.length < 2) return null
    return solveRoute(nodes, { startId: effectiveStartId, loop, getDistance: getWalkDistance })
  }, [nodes, effectiveStartId, loop])

  const routeKey = useMemo(() => {
    const loc = userLocation ? `${userLocation.lat.toFixed(5)},${userLocation.lng.toFixed(5)}` : ''
    return `${[...selectedIds].sort().join('.')}|${startId ?? ''}|${loc}|${loop ? 1 : 0}`
  }, [selectedIds, startId, userLocation, loop])

  const optimised = optimisedSnapshot?.key === routeKey
  const geometry = optimised ? optimisedSnapshot.geometry : null

  const orderedPoints = useMemo(() => {
    if (!routeResult) return []
    return routeResult.order.map((id) => (virtualStart && id === virtualStart.id ? virtualStart : buildingsById[id]))
  }, [routeResult, virtualStart])

  // solveRoute always keeps a fixed start at position 0, so whenever a
  // virtual start was fed in it's necessarily the first ordered point.
  const hasVirtualStart = !!virtualStart
  const stops = hasVirtualStart ? orderedPoints.slice(1) : orderedPoints

  const legs = useMemo(() => {
    if (!routeResult) return []
    const offset = hasVirtualStart ? 1 : 0
    return stops.map((stop, j) => {
      if (j === 0 && offset === 0) return null
      const fromPoint = orderedPoints[j - 1 + offset]
      const meters = routeResult.legMeters[j - 1 + offset]
      return { fromPoint, meters }
    })
  }, [routeResult, stops, orderedPoints, hasVirtualStart])

  const closingLeg = useMemo(() => {
    if (!routeResult || !loop || stops.length < 2) return null
    const meters = routeResult.legMeters[routeResult.legMeters.length - 1]
    return { fromPoint: stops[stops.length - 1], toPoint: orderedPoints[0], meters }
  }, [routeResult, loop, stops, orderedPoints])

  const toggleSelection = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      trackEvent('buildings_selected', { count: next.size })
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setStartId(null)
    setUserLocation(null)
    setOptimisedSnapshot(null)
  }

  const optimise = () => {
    const key = routeKey
    setOptimisedSnapshot({ key, geometry: null })
    trackEvent('route_optimized', { count: selectedBuildings.length, estimated_meters: Math.round(routeResult?.totalMeters ?? 0) })
    const points = orderedPoints.map((p) => ({ lat: p.lat, lng: p.lng }))
    // Close the loop for the routing request too, or the fetched polyline
    // stops at the last stop and never draws the leg back to the start.
    const routePoints = loop && points.length > 1 ? [...points, points[0]] : points
    fetchRouteGeometry(routePoints).then((geo) => {
      setOptimisedSnapshot((prev) => (prev?.key === key ? { key, geometry: geo } : prev))
    })
  }

  const viewDetail = (building) => {
    setDetailBuilding(building)
    trackEvent('building_detail_view', { building_id: building.id })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 print:px-0 print:py-0">
      <DisclaimerGate
        open={disclaimerOpen}
        dismissable={acknowledged}
        onAcknowledge={() => {
          setAcknowledged(true)
          setDisclaimerOpen(false)
        }}
        onDismiss={() => setDisclaimerOpen(false)}
      />

      <div className="print:hidden">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-slate-900 mb-2">
          Ōtautahi Christchurch: self-guided engineering walking tour
        </h1>
        <p className="text-slate-500 leading-relaxed mb-6">
          Curated for PCEE 2027. Tick the buildings you want to see, set a start point, and get an optimised
          walking route with per-stop engineering detail.
        </p>

        <ConferenceVenueCard building={buildingsById[DEFAULT_START_ID]} />

        <StartPointPicker
          buildings={buildingsData}
          startId={startId}
          onStartChange={setStartId}
          loop={loop}
          onLoopChange={setLoop}
          userLocation={userLocation}
          onUseMyLocation={setUserLocation}
        />

        <div className="mt-6">
          <BuildingList
            buildings={tourBuildings}
            selectedIds={selectedIds}
            onToggle={toggleSelection}
            onViewDetail={viewDetail}
          />
        </div>

        {optimised && stops.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black tracking-tighter text-slate-900">Your route</h2>
              <div className="flex flex-wrap gap-2">
                <ShareButton ids={[...selectedIds]} startId={startId} loop={loop} />
                <PrintButton />
                <InstallPrompt />
              </div>
            </div>

            <div className="mb-6">
              <RouteMap stops={stops} geometry={geometry} startPoint={hasVirtualStart ? virtualStart : null} userLocation={userLocation} loop={loop} />
            </div>

            <RouteItinerary stops={stops} legs={legs} closingLeg={closingLeg} onViewDetail={viewDetail} />
          </div>
        )}

        <p className="text-xs text-slate-400 mt-10">
          <button type="button" className="underline" onClick={() => setDisclaimerOpen(true)}>
            Safety information
          </button>
        </p>
      </div>

      {/* Print-only itinerary: a clean one-page listing, no interactive chrome. */}
      {optimised && stops.length > 0 && (
        <div className="hidden print:block">
          <h1 className="text-2xl font-black mb-1">Seismic Walk itinerary</h1>
          <p className="text-sm mb-4">
            {stops.length} stops · {formatDistance(routeResult.totalMeters)} · {formatDuration(walkMinutes(routeResult.totalMeters))} walking
          </p>
          <RouteItinerary stops={stops} legs={legs} closingLeg={closingLeg} onViewDetail={() => {}} printMode />
        </div>
      )}

      <div className="print:hidden">
        <SelectionBar
          count={selectedIds.size}
          estimatedMeters={routeResult?.totalMeters ?? null}
          optimised={optimised}
          onOptimise={optimise}
          onClear={clearSelection}
        />
      </div>

      <BuildingDetail building={detailBuilding} onClose={() => setDetailBuilding(null)} />
    </div>
  )
}
