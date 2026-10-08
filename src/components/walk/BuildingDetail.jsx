import AccessBadge from './AccessBadge'
import TagChip from './TagChip'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { useDialog } from '../../lib/useDialog'
import { WALK, isContextSite, isRefreshment } from './theme'

function Fact({ label, value }) {
  if (!value) return null
  return (
    <div className="py-2.5 border-t" style={{ borderColor: WALK.line }}>
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-800 mt-0.5">{value}</dd>
    </div>
  )
}

export default function BuildingDetail({ building, selected = false, onToggle, onClose }) {
  useBodyScrollLock(!!building)
  const dialogRef = useDialog(!!building, onClose)
  if (!building) return null

  // story is free text from /walkadmin/; blank lines separate paragraphs.
  const paragraphs = (building.story || building.summary).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-[#1c1517]/70 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-detail-title"
        tabIndex={-1}
        className="relative bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-44 md:h-56 flex-shrink-0 bg-slate-200">
          {building.image && <img src={building.image} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1517]/90 via-[#1c1517]/30 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 px-6 md:px-8 pb-5">
            {isContextSite(building) && (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 mb-1">Context and remembrance</p>
            )}
            {isRefreshment(building) && (
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/70 mb-1">Coffee, drinks and nibbles</p>
            )}
            {building.name_mi && !building.name.includes(building.name_mi) && (
              <p className="text-xs font-semibold text-white/75 mb-1">{building.name_mi}</p>
            )}
            <h2 id="walk-detail-title" className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">{building.name}</h2>
            <p className="text-sm text-white/75 mt-1">{building.address}</p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
            aria-label="Close"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-6 md:px-8 pt-5 pb-6">
          <div className={`flex flex-wrap items-center gap-1.5 ${isRefreshment(building) ? 'hidden' : ''}`}>
            <AccessBadge level={building.access_level} />
            {building.step_free && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md ring-1 ring-inset ring-slate-200 text-slate-600 text-[11px] font-semibold">
                Step-free
              </span>
            )}
          </div>
          {building.access_notes && (
            isRefreshment(building) ? (
              <p className="text-sm font-semibold text-slate-800">
                Opening hours: <span className="font-normal text-slate-600">{building.access_notes}</span>
              </p>
            ) : (
              <p className="text-sm text-slate-500 mt-2">{building.access_notes}</p>
            )
          )}

          <div className="md:grid md:grid-cols-[1fr_190px] md:gap-8 mt-5">
            <div className="space-y-3.5 text-[15px] text-slate-700 leading-relaxed">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>

            <aside className="mt-6 md:mt-0">
              <dl>
                <Fact label="Built" value={building.year_built} />
                <Fact label="Retrofit / restored" value={building.year_retrofit} />
                <Fact label="Structural engineer" value={building.engineer} />
                <Fact label="Architect" value={building.architect} />
                <Fact label="Storeys" value={building.storeys} />
              </dl>
              {building.structural_tags?.length > 0 && (
                <div className="pt-3 border-t flex flex-wrap gap-1.5" style={{ borderColor: WALK.line }}>
                  {building.structural_tags.map((tag) => <TagChip key={tag} tag={tag} />)}
                </div>
              )}
            </aside>
          </div>
        </div>

        <div className="flex-shrink-0 border-t px-6 md:px-8 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-3" style={{ borderColor: WALK.line }}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
            {/* Walking directions from wherever the phone is - handy when
                someone opens a single site rather than planning a route. */}
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${building.lat},${building.lng}&travelmode=walking`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
              style={{ color: WALK.maroon }}
            >
              Directions ↗
            </a>
            {building.external_url && (
              <a
                href={building.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: WALK.maroon }}
              >
                Further reading ↗
              </a>
            )}
          </div>
          {onToggle && (
            <button
              type="button"
              onClick={() => onToggle(building.id)}
              className="px-5 py-2.5 rounded-lg text-sm font-bold transition-colors"
              style={selected
                ? { color: WALK.maroon, backgroundColor: WALK.tint }
                : { color: 'white', backgroundColor: WALK.maroon }}
            >
              {selected ? '✓ On your route' : 'Add to route'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
