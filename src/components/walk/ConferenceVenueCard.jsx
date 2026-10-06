import { WALK } from './theme'

// Te Pae isn't a tour stop - it's the PCEE 2027 venue and the tour's default
// start point, so it's surfaced here as a one-off info card up front rather
// than as a selectable building tile.
export default function ConferenceVenueCard({ building, onViewDetail }) {
  if (!building) return null

  return (
    <div className="rounded-xl overflow-hidden border bg-white flex flex-col sm:flex-row" style={{ borderColor: WALK.line }}>
      <div className="sm:w-48 h-36 sm:h-auto flex-shrink-0 bg-slate-100">
        {building.image && <img src={building.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
      </div>

      <div className="min-w-0 p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: WALK.red }}>Conference venue · tour start</p>
        <h3 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 leading-tight">{building.name}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{building.address}</p>
        <p className="text-sm text-slate-600 leading-snug mt-2">{building.summary}</p>
        {onViewDetail && (
          <button
            type="button"
            onClick={() => onViewDetail(building)}
            className="mt-2 text-sm font-semibold underline underline-offset-2"
            style={{ color: WALK.maroon }}
          >
            About the building
          </button>
        )}
      </div>
    </div>
  )
}
