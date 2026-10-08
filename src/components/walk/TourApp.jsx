import { useEffect, useMemo, useRef, useState } from 'react'
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
import { WALK } from './theme'

const VIRTUAL_START_ID = '__start__'
const DEFAULT_START_ID = 'te-pae'
const buildingsById = Object.fromEntries(buildingsData.map((b) => [b.id, b]))
// Te Pae is the conference venue and default start point, not a tour stop -
// it gets its own info card (ConferenceVenueCard) instead of a selectable
// tile in the building list.
const tourBuildings = buildingsData.filter((b) => b.id !== DEFAULT_START_ID)

function SectionHeading({ step, title, hint }) {
  return (
    <div className="mt-10 mb-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: WALK.red }}>Step {step}</p>
      <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h2>
      {hint && <p className="text-sm text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

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
  // Set when the page opens from a shared ?r= link, so the route is planned
  // (and shown) straight away instead of leaving the recipient with ticks and
  // no route until they find the Plan button.
  const [autoPlan, setAutoPlan] = useState(false)
  const routeRef = useRef(null)

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
      // Drop ids that no longer exist (a building renamed or removed since
      // the link was made) so the selected count matches what's shown.
      const ids = shareState.ids.filter((id) => buildingsById[id])
      setSelectedIds(new Set(ids))
      setStartId(shareState.startId && buildingsById[shareState.startId] ? shareState.startId : DEFAULT_START_ID)
      setLoop(shareState.loop)
      if (ids.length > 0) setAutoPlan(true)
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
    setStartId(DEFAULT_START_ID)
    setUserLocation(null)
    setOptimisedSnapshot(null)
  }

  // Picking a building as the start replaces a live-location start - before,
  // location silently kept priority, so the dropdown appeared to do nothing.
  const changeStart = (id) => {
    setUserLocation(null)
    setStartId(id)
    // Back to starting at Te Pae: drop it as a stop too, since its "add"
    // toggle disappears once it's the start again.
    if (id === DEFAULT_START_ID) {
      setSelectedIds((prev) => {
        if (!prev.has(DEFAULT_START_ID)) return prev
        const next = new Set(prev)
        next.delete(DEFAULT_START_ID)
        return next
      })
    }
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
    // The route renders below the whole site list - bring it into view.
    // setTimeout lets React commit the newly shown section first.
    setTimeout(() => routeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  useEffect(() => {
    if (!autoPlan || !routeResult) return
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot auto-plan for a
       shared link, run once the hydrated selection has produced a route */
    setAutoPlan(false)
    optimise()
    /* eslint-enable react-hooks/set-state-in-effect */
    // optimise() is recreated every render but reads that same render's route,
    // so it's current here; listing it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlan, routeResult])

  // Te Pae is normally the start, so it isn't a tickable stop. But someone
  // starting from their hotel or another site may want to walk to it (or
  // finish there), so it becomes addable whenever it isn't the start.
  const venueAddable = !!userLocation || startId !== DEFAULT_START_ID

  const viewDetail = (building) => {
    setDetailBuilding(building)
    trackEvent('building_detail_view', { building_id: building.id })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 md:pt-10 pb-8 print:px-0 print:py-0">
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
        <ConferenceVenueCard
          building={buildingsById[DEFAULT_START_ID]}
          onViewDetail={viewDetail}
          selected={selectedIds.has(DEFAULT_START_ID)}
          onToggle={venueAddable ? toggleSelection : null}
        />

        <SectionHeading step="1" title="Choose where you start" />
        <StartPointPicker
          buildings={buildingsData}
          startId={startId}
          onStartChange={changeStart}
          loop={loop}
          onLoopChange={setLoop}
          userLocation={userLocation}
          onUseMyLocation={setUserLocation}
        />

        <SectionHeading step="2" title="Pick the sites you want to see" hint="Tick sites or use a quick pick, then tap Plan my route." />
        <BuildingList
          buildings={tourBuildings}
          selectedIds={selectedIds}
          onToggle={toggleSelection}
          onSelectMany={(ids) => setSelectedIds(new Set(ids))}
          onViewDetail={viewDetail}
          origin={userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : buildingsById[startId] ?? null}
        />

        <p className="text-xs text-slate-500 mt-10">
          Self-guided, at your own risk.{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => setDisclaimerOpen(true)}>
            Safety information
          </button>
        </p>
      </div>

      {/* Not print:hidden - the map and itinerary are exactly what a printed
          itinerary should include. Only the buttons above it (share/print/
          install) are interactive-only and get hidden for print. */}
      {optimised && stops.length > 0 && (
        <div ref={routeRef} className="mt-10 print:mt-0 scroll-mt-20">
          <div className="hidden print:block mb-4 pb-3 border-b border-slate-300">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: WALK.red }}>PCEE 2027 · Pacific Conference on Earthquake Engineering</p>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900">Seismic Walk</p>
            <p className="text-sm text-slate-600">Self-guided engineering tour of Ōtautahi Christchurch · seismicshift.nz/walk · Powered by Seismic Shift</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-1 print:hidden" style={{ color: WALK.red }}>Step 3</p>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Your route</h2>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <ShareButton ids={[...selectedIds]} startId={startId} loop={loop} />
              <PrintButton />
              <InstallPrompt />
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-4 tabular-nums">
            <span className="font-semibold text-slate-900">
              {stops.length} stop{stops.length === 1 ? '' : 's'} · {formatDistance(routeResult.totalMeters)} · {formatDuration(walkMinutes(routeResult.totalMeters))} walking
            </span>
            {' '}- walking time only; allow time at each stop.
          </p>

          <div className="mb-6">
            <RouteMap stops={stops} geometry={geometry} startPoint={hasVirtualStart ? virtualStart : null} userLocation={userLocation} loop={loop} />
          </div>

          <RouteItinerary stops={stops} legs={legs} closingLeg={closingLeg} startPoint={hasVirtualStart ? virtualStart : null} onViewDetail={viewDetail} />
        </div>
      )}

      {/* sticky lives on this wrapper, not inside SelectionBar - a sticky
          element only sticks within its parent, and this wrapper is the
          only thing as tall as the bar itself. */}
      <div className="sticky bottom-0 z-30 print:hidden">
        <SelectionBar
          count={selectedIds.size}
          estimatedMeters={routeResult?.totalMeters ?? null}
          canPlan={!!routeResult}
          optimised={optimised}
          onOptimise={optimise}
          onClear={clearSelection}
        />
      </div>

      <BuildingDetail
        building={detailBuilding}
        selected={!!detailBuilding && selectedIds.has(detailBuilding.id)}
        onToggle={detailBuilding?.id === DEFAULT_START_ID && !venueAddable ? null : toggleSelection}
        onClose={() => setDetailBuilding(null)}
      />
    </div>
  )
}
