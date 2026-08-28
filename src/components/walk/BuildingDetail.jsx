import AccessBadge from './AccessBadge'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'
import { tagLabel } from '../../lib/structuralTags'

export default function BuildingDetail({ building, onClose }) {
  useBodyScrollLock(!!building)
  if (!building) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-white w-full md:max-w-xl md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full h-48 bg-slate-100 flex-shrink-0 md:rounded-t-3xl overflow-hidden flex items-center justify-center">
          {building.image ? (
            <img src={building.image} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl font-black text-slate-300">{building.name.charAt(0)}</span>
          )}
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-slate-500 hover:bg-white transition-colors shadow"
          aria-label="Close"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="12" y2="12" />
            <line x1="12" y1="2" x2="2" y2="12" />
          </svg>
        </button>

        <div className="overflow-y-auto px-7 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <h2 className="text-2xl font-black tracking-tighter text-slate-900">{building.name}</h2>
          {building.name_mi && <p className="text-sm text-slate-400 italic mb-1">{building.name_mi}</p>}
          <p className="text-sm text-slate-500 mb-3">{building.address}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            <AccessBadge level={building.access_level} />
            {building.step_free && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-bold">
                ♿ Step-free
              </span>
            )}
          </div>

          {building.access_notes && (
            <p className="text-sm text-slate-500 leading-relaxed mb-4 bg-slate-50 rounded-2xl p-3">{building.access_notes}</p>
          )}

          <p className="text-sm text-slate-600 leading-relaxed mb-4">{building.story || building.summary}</p>

          <dl className="grid grid-cols-2 gap-3 text-xs mb-4">
            {building.year_built && (
              <div><dt className="text-slate-400 font-bold">Built</dt><dd className="text-slate-700">{building.year_built}</dd></div>
            )}
            {building.year_retrofit && (
              <div><dt className="text-slate-400 font-bold">Retrofit</dt><dd className="text-slate-700">{building.year_retrofit}</dd></div>
            )}
            {building.engineer && (
              <div><dt className="text-slate-400 font-bold">Engineer</dt><dd className="text-slate-700">{building.engineer}</dd></div>
            )}
            {building.architect && (
              <div><dt className="text-slate-400 font-bold">Architect</dt><dd className="text-slate-700">{building.architect}</dd></div>
            )}
            {building.storeys && (
              <div><dt className="text-slate-400 font-bold">Storeys</dt><dd className="text-slate-700">{building.storeys}</dd></div>
            )}
          </dl>

          {building.structural_tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {building.structural_tags.map((tag) => (
                <span key={tag} className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: '#17638f', backgroundColor: '#eef1f3' }}>
                  {tagLabel(tag)}
                </span>
              ))}
            </div>
          )}

          {building.external_url && (
            <a
              href={building.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold underline"
              style={{ color: '#17638f' }}
            >
              Further reading →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
