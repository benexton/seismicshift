import AccessBadge from './AccessBadge'
import { tagLabel } from '../../lib/structuralTags'

const BRAND = '#17638f'

export default function BuildingCard({ building, selected, onToggle, onViewDetail }) {
  // The whole card toggles selection on tap - much easier to hit on a phone
  // than the checkbox alone. The thumbnail and title stay dedicated "view
  // details" targets by stopping the click from bubbling to this handler.
  const stop = (e) => e.stopPropagation()

  return (
    <div
      onClick={() => onToggle(building.id)}
      className={`rounded-3xl border-2 bg-white p-4 flex gap-4 transition-colors cursor-pointer active:bg-slate-50 ${
        selected ? 'border-[#17638f]/50' : 'border-slate-100'
      }`}
    >
      <button
        type="button"
        onClick={(e) => { stop(e); onViewDetail(building) }}
        className="group flex-shrink-0 w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center"
        aria-label={`View details for ${building.name}`}
      >
        {building.image ? (
          <img
            src={building.image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-125 group-active:scale-125"
          />
        ) : (
          <span className="text-2xl font-black text-slate-300">{building.name.charAt(0)}</span>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={(e) => { stop(e); onViewDetail(building) }} className="text-left min-w-0">
            <h3 className="font-black text-slate-900 leading-tight truncate">{building.name}</h3>
            {building.name_mi && <p className="text-xs text-slate-400 italic">{building.name_mi}</p>}
          </button>
          <label className="flex-shrink-0 inline-flex items-center p-2 -m-2" onClick={stop}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(building.id)}
              className="w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-slate-300 accent-[#17638f]"
              aria-label={`Select ${building.name} for your route`}
            />
          </label>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <AccessBadge level={building.access_level} />
          {building.step_free && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-bold">
              ♿ Step-free
            </span>
          )}
        </div>

        <p className="text-sm text-slate-500 leading-snug mt-2 line-clamp-2">{building.summary}</p>

        {building.structural_tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {building.structural_tags.map((tag) => (
              <span key={tag} className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: BRAND, backgroundColor: '#eef1f3' }}>
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
