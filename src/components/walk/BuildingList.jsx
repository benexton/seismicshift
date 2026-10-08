import { useMemo, useState } from 'react'
import BuildingCard from './BuildingCard'
import { tagLabel } from '../../lib/structuralTags'
import { getWalkDistance } from '../../lib/matrixDistance'
import { WALK, isContextSite, isRefreshment } from './theme'

const ACCESS_FILTERS = [
  { value: 'interior_public', label: 'Interior open' },
  { value: 'foyer_only', label: 'Foyer only' },
  { value: 'exterior_only', label: 'Exterior only' },
  { value: 'by_arrangement', label: 'By arrangement' },
]

// Feature chips beyond this many collapse behind a "More" toggle - with ~17
// tags the full set pushed the list itself a long way down the page.
const VISIBLE_TAGS = 6

function FilterChip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex-shrink-0 px-3 py-2 sm:py-1.5 rounded-lg border font-semibold text-xs transition-colors"
      style={
        active
          ? { borderColor: WALK.maroon, backgroundColor: WALK.maroon, color: 'white' }
          : { borderColor: WALK.line, backgroundColor: 'white', color: '#475569' }
      }
    >
      {children}
      {count != null && <span className={`ml-1.5 tabular-nums ${active ? 'text-white/70' : 'text-slate-400'}`}>{count}</span>}
    </button>
  )
}

function GroupLabel({ children }) {
  return <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">{children}</p>
}

const chipRow = 'flex flex-nowrap sm:flex-wrap gap-2 mb-4 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0'

export default function BuildingList({ buildings, selectedIds, onToggle, onViewDetail, origin }) {
  const [accessFilter, setAccessFilter] = useState(null)
  const [tagFilter, setTagFilter] = useState(null)
  const [stepFreeOnly, setStepFreeOnly] = useState(false)
  const [showAllTags, setShowAllTags] = useState(false)
  const [sortNearest, setSortNearest] = useState(false)

  // Most common features first, so the collapsed row shows the useful ones.
  const tagCounts = useMemo(() => {
    const counts = new Map()
    buildings.forEach((b) => b.structural_tags?.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || tagLabel(a[0]).localeCompare(tagLabel(b[0])))
  }, [buildings])
  const visibleTags = showAllTags ? tagCounts : tagCounts.slice(0, VISIBLE_TAGS)
  // Keep an active filter visible even when the row is collapsed.
  if (!showAllTags && tagFilter && !visibleTags.some(([t]) => t === tagFilter)) {
    visibleTags.push(tagCounts.find(([t]) => t === tagFilter))
  }

  const distances = useMemo(() => {
    if (!origin) return null
    const from = { id: origin.id ?? '__origin__', lat: origin.lat, lng: origin.lng }
    return new Map(buildings.map((b) => [b.id, getWalkDistance(from, b)]))
  }, [buildings, origin])

  const filtered = useMemo(() => {
    const list = buildings.filter((b) => {
      if (accessFilter && b.access_level !== accessFilter) return false
      if (tagFilter && !b.structural_tags?.includes(tagFilter)) return false
      if (stepFreeOnly && !b.step_free) return false
      return true
    })
    if (sortNearest && distances) list.sort((a, b) => distances.get(a.id) - distances.get(b.id))
    return list
  }, [buildings, accessFilter, tagFilter, stepFreeOnly, sortNearest, distances])

  // Context stops (Quake City, memorials) sit in their own section below the
  // engineering sites - see isContextSite.
  const engineering = filtered.filter((b) => !isContextSite(b) && !isRefreshment(b))
  const context = filtered.filter(isContextSite)
  const refreshments = filtered.filter(isRefreshment)
  const filtersActive = accessFilter || tagFilter || stepFreeOnly

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
      {/* Mobile: one scrollable row per filter group, edge-to-edge, so the
          filters don't push the building list several screens down. Desktop
          (sm+): wraps into a normal grid of chips instead. */}
      <GroupLabel>Access</GroupLabel>
      <div className={chipRow}>
        {ACCESS_FILTERS.map((f) => (
          <FilterChip key={f.value} active={accessFilter === f.value} onClick={() => setAccessFilter(accessFilter === f.value ? null : f.value)}>
            {f.label}
          </FilterChip>
        ))}
        <FilterChip active={stepFreeOnly} onClick={() => setStepFreeOnly((v) => !v)}>
          Step-free only
        </FilterChip>
      </div>

      {tagCounts.length > 0 && (
        <>
          <GroupLabel>Engineering features</GroupLabel>
          <div className={chipRow}>
            {visibleTags.map(([tag, count]) => (
              <FilterChip key={tag} active={tagFilter === tag} count={count} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
                {tagLabel(tag)}
              </FilterChip>
            ))}
            {tagCounts.length > VISIBLE_TAGS && (
              <button
                type="button"
                onClick={() => setShowAllTags((v) => !v)}
                className="flex-shrink-0 px-2 py-2 sm:py-1.5 text-xs font-semibold underline underline-offset-2"
                style={{ color: WALK.maroon }}
              >
                {showAllTags ? 'Fewer' : `More (${tagCounts.length - VISIBLE_TAGS})`}
              </button>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mt-1">
        <p className="text-xs text-slate-500 font-semibold" aria-live="polite">
          Showing {filtered.length} of {buildings.length} sites
          {filtersActive && (
            <>
              {' · '}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => { setAccessFilter(null); setTagFilter(null); setStepFreeOnly(false) }}
              >
                Clear filters
              </button>
            </>
          )}
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
          <p className="text-sm text-slate-500 text-center py-8">No sites match these filters.</p>
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
