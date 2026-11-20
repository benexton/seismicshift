import { useMemo, useState } from 'react'
import BuildingCard from './BuildingCard'
import { getWalkDistance } from '../../lib/matrixDistance'
import { WALK, isContextSite, isRefreshment } from './theme'

export default function BuildingList({ buildings, selectedIds, onToggle, onViewDetail, origin }) {
  const [sortNearest, setSortNearest] = useState(false)

  const distances = useMemo(() => {
    if (!origin) return null
    const from = { id: origin.id ?? '__origin__', lat: origin.lat, lng: origin.lng }
    return new Map(buildings.map((b) => [b.id, getWalkDistance(from, b)]))
  }, [buildings, origin])

  const filtered = useMemo(() => {
    const list = [...buildings]
    if (sortNearest && distances) list.sort((a, b) => distances.get(a.id) - distances.get(b.id))
    return list
  }, [buildings, sortNearest, distances])

  // Context stops (Quake City, memorials) sit in their own section below the
  // engineering sites - see isContextSite.
  const engineering = filtered.filter((b) => !isContextSite(b) && !isRefreshment(b))
  const context = filtered.filter(isContextSite)
  const refreshments = filtered.filter(isRefreshment)

  const card = (b) => (
    <BuildingCard
      key={b.id}
      building={b}
      selected={selectedIds.has(b.id)}
      onToggle={onToggle}
      onViewDetail={onViewDetail}
      distanceMeters={sortNearest ? distances?.get(b.id) : null}
    />
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mt-1">
        <p className="text-xs text-slate-500 font-semibold" aria-live="polite">
          {filtered.length} sites
        </p>
        {origin && (
          <div className="inline-flex rounded-lg border bg-white p-0.5 text-xs font-semibold" style={{ borderColor: WALK.line }} role="group" aria-label="Sort sites">
            {[[false, 'Suggested'], [true, 'Nearest first']].map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={sortNearest === value}
                onClick={() => setSortNearest(value)}
                className="px-2.5 py-1.5 sm:py-1 rounded-md transition-colors"
                style={sortNearest === value ? { backgroundColor: WALK.tint, color: WALK.maroon } : { color: '#64748b' }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {engineering.map(card)}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No sites to show.</p>
        )}
      </div>

      {context.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="h-px flex-1" style={{ backgroundColor: WALK.line }} />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Context and remembrance</h3>
            <span className="h-px flex-1" style={{ backgroundColor: WALK.line }} />
          </div>
          <p className="text-sm text-slate-500 text-center mb-4">
            Not engineering case studies - places that explain what happened and who it happened to.
          </p>
          <div className="space-y-3">{context.map(card)}</div>
        </div>
      )}

      {refreshments.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="h-px flex-1" style={{ backgroundColor: WALK.line }} />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: WALK.coffee }}>Coffee, drinks and nibbles</h3>
            <span className="h-px flex-1" style={{ backgroundColor: WALK.line }} />
          </div>
          <p className="text-sm text-slate-500 text-center mb-4">
            Places to refuel along the way. Tick one to add it to your route. Hours can change, so check before you go.
          </p>
          <div className="space-y-3">{refreshments.map(card)}</div>
        </div>
      )}
    </div>
  )
}
