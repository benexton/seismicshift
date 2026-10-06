import { useMemo, useState } from 'react'
import BuildingCard from './BuildingCard'
import { tagLabel } from '../../lib/structuralTags'

const ACCESS_FILTERS = [
  { value: 'interior_public', label: 'Interior open' },
  { value: 'foyer_only', label: 'Foyer only' },
  { value: 'exterior_only', label: 'Exterior only' },
  { value: 'by_arrangement', label: 'By arrangement' },
]

import { WALK } from './theme'

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 px-3 py-2 sm:py-1.5 rounded-lg border font-semibold text-xs transition-colors"
      style={
        active
          ? { borderColor: WALK.maroon, backgroundColor: WALK.maroon, color: 'white' }
          : { borderColor: WALK.line, backgroundColor: 'white', color: '#475569' }
      }
    >
      {children}
    </button>
  )
}

export default function BuildingList({ buildings, selectedIds, onToggle, onViewDetail }) {
  const [accessFilter, setAccessFilter] = useState(null)
  const [tagFilter, setTagFilter] = useState(null)
  const [stepFreeOnly, setStepFreeOnly] = useState(false)

  const allTags = useMemo(() => {
    const set = new Set()
    buildings.forEach((b) => b.structural_tags?.forEach((t) => set.add(t)))
    return [...set].sort()
  }, [buildings])

  const filtered = useMemo(() => {
    return buildings.filter((b) => {
      if (accessFilter && b.access_level !== accessFilter) return false
      if (tagFilter && !b.structural_tags?.includes(tagFilter)) return false
      if (stepFreeOnly && !b.step_free) return false
      return true
    })
  }, [buildings, accessFilter, tagFilter, stepFreeOnly])

  return (
    <div>
      {/* Mobile: one scrollable row per filter group, edge-to-edge, so the
          filters don't push the building list several screens down. Desktop
          (sm+): wraps into a normal grid of chips instead. */}
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Access</p>
      <div className="flex flex-nowrap sm:flex-wrap gap-2 mb-4 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
        {ACCESS_FILTERS.map((f) => (
          <FilterChip key={f.value} active={accessFilter === f.value} onClick={() => setAccessFilter(accessFilter === f.value ? null : f.value)}>
            {f.label}
          </FilterChip>
        ))}
        <FilterChip active={stepFreeOnly} onClick={() => setStepFreeOnly((v) => !v)}>
          Step-free only
        </FilterChip>
      </div>

      {allTags.length > 0 && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Engineering features</p>
          <div className="flex flex-nowrap sm:flex-wrap gap-2 mb-4 overflow-x-auto sm:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            {allTags.map((tag) => (
              <FilterChip key={tag} active={tagFilter === tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
                {tagLabel(tag)}
              </FilterChip>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-slate-500 font-semibold mb-3 mt-1">Showing {filtered.length} of {buildings.length} sites</p>

      <div className="space-y-3">
        {filtered.map((b) => (
          <BuildingCard
            key={b.id}
            building={b}
            selected={selectedIds.has(b.id)}
            onToggle={onToggle}
            onViewDetail={onViewDetail}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-8">No sites match these filters.</p>
        )}
      </div>
    </div>
  )
}
