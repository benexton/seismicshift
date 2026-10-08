import { WALK } from './theme'

// Te Pae isn't a tour stop - it's the PCEE 2027 venue and the tour's default
// start point, so it's surfaced here as a one-off info card up front rather
// than as a selectable building tile.
// onToggle is only passed when the walk starts somewhere other than Te Pae,
// so it can then be added as a stop.
export default function ConferenceVenueCard({ building, onViewDetail, selected = false, onToggle = null }) {
  if (!building) return null

  return (
    // Thumbnail beside the text at every width: a full-width banner on phones
    // cropped the image plate's year off.
    <div className="rounded-xl overflow-hidden border bg-white flex gap-4 p-3 sm:p-0 sm:gap-0" style={{ borderColor: WALK.line }}>
      <div className="w-20 h-20 rounded-lg sm:rounded-none sm:w-48 sm:h-auto flex-shrink-0 bg-slate-100 overflow-hidden">
        {building.image && <img src={building.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
      </div>

      <div className="min-w-0 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: WALK.red }}>Conference venue · tour start</p>
        <h3 className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 leading-tight">{building.name}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{building.address}</p>
        <p className="text-sm text-slate-600 leading-snug mt-2">{building.summary}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {onViewDetail && (
            <button
              type="button"
              onClick={() => onViewDetail(building)}
              className="px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors hover:bg-slate-50"
              style={{ borderColor: WALK.line, color: WALK.maroon }}
            >
              More info
            </button>
          )}
          {onToggle && (
            <button
              type="button"
              onClick={() => onToggle(building.id)}
              aria-pressed={selected}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={selected ? { color: WALK.maroon, backgroundColor: WALK.tint } : { color: 'white', backgroundColor: WALK.maroon }}
            >
              {selected ? '✓ Te Pae is on your route' : 'Add Te Pae to my route'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
