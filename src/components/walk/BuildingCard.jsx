import AccessBadge from './AccessBadge'
import TagChip from './TagChip'
import { WALK } from './theme'

function metaLine(building) {
  const parts = []
  if (building.year_built) parts.push(building.year_retrofit ? `${building.year_built} · retrofit ${building.year_retrofit}` : String(building.year_built))
  if (building.engineer) parts.push(building.engineer)
  return parts.join(' · ')
}

export default function BuildingCard({ building, selected, onToggle, onViewDetail }) {
  // The whole card toggles selection on tap - much easier to hit on a phone
  // than the checkbox alone. The thumbnail and title stay dedicated "view
  // details" targets by stopping the click from bubbling to this handler.
  const stop = (e) => e.stopPropagation()

  return (
    <div
      onClick={() => onToggle(building.id)}
      className="relative overflow-hidden rounded-xl border bg-white p-3 sm:p-4 flex gap-4 cursor-pointer transition-shadow hover:shadow-md active:bg-slate-50"
      style={{ borderColor: selected ? WALK.maroon : WALK.line }}
    >
      {selected && <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1" style={{ backgroundColor: WALK.maroon }} />}
      <button
        type="button"
        onClick={(e) => { stop(e); onViewDetail(building) }}
        className="group flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-slate-100 overflow-hidden"
        aria-label={`View details for ${building.name}`}
      >
        {building.image && (
          <img
            src={building.image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-110"
          />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <button type="button" onClick={(e) => { stop(e); onViewDetail(building) }} className="text-left min-w-0">
            <h3 className="font-bold text-[15px] sm:text-base text-slate-900 leading-snug hover:underline underline-offset-2">{building.name}</h3>
            {metaLine(building) && <p className="text-xs text-slate-500 mt-0.5 truncate">{metaLine(building)}</p>}
          </button>
          <label className="flex-shrink-0 inline-flex items-center p-2 -m-2" onClick={stop}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(building.id)}
              className="w-6 h-6 sm:w-5 sm:h-5 rounded accent-[#652431] cursor-pointer"
              aria-label={`Add ${building.name} to your route`}
            />
          </label>
        </div>

        <p className="text-sm text-slate-600 leading-snug mt-2 line-clamp-2">{building.summary}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <AccessBadge level={building.access_level} />
          {building.step_free && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md ring-1 ring-inset ring-slate-200 text-slate-600 text-[11px] font-semibold">
              Step-free
            </span>
          )}
          {building.structural_tags?.slice(0, 2).map((tag) => <TagChip key={tag} tag={tag} />)}
        </div>
      </div>
    </div>
  )
}
