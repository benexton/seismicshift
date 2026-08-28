import { useMemo, useState } from 'react'
import BuildingCard from './BuildingCard'
import { tagLabel } from '../../lib/structuralTags'

const ACCESS_FILTERS = [
  { value: 'interior_public', label: 'Interior open' },
  { value: 'foyer_only', label: 'Foyer only' },
  { value: 'exterior_only', label: 'Exterior only' },
  { value: 'by_arrangement', label: 'By arrangement' },
]

const BRAND = '#17638f'

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full border-2 font-bold text-xs tracking-wide transition-colors"
      style={
        active
          ? { borderColor: BRAND, backgroundColor: '#eef1f3', color: BRAND }
          : { borderColor: '#cbd5e1', backgroundColor: 'white', color: '#475569' }
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
      <div className="flex flex-wrap gap-2 mb-3">
        {ACCESS_FILTERS.map((f) => (
          <FilterChip key={f.value} active={accessFilter === f.value} onClick={() => setAccessFilter(accessFilter === f.value ? null : f.value)}>
            {f.label}
          </FilterChip>
        ))}
        <FilterChip active={stepFreeOnly} onClick={() => setStepFreeOnly((v) => !v)}>
          ♿ Step-free only
        </FilterChip>
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {allTags.map((tag) => (
            <FilterChip key={tag} active={tagFilter === tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>
              {tagLabel(tag)}
            </FilterChip>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 font-bold mb-3">{filtered.length} of {buildings.length} buildings</p>

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
          <p className="text-sm text-slate-400 text-center py-8">No buildings match these filters.</p>
        )}
      </div>
    </div>
  )
}
