import AccessBadge from './AccessBadge'

const BRAND = '#17638f'

// Te Pae isn't a tour stop - it's the PCEE 2027 venue and the tour's default
// start point, so it's surfaced here as a one-off info card up front rather
// than as a selectable building tile.
export default function ConferenceVenueCard({ building }) {
  if (!building) return null

  return (
    <div className="rounded-3xl border-2 border-slate-100 bg-white p-4 flex gap-4 mb-6">
      <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex items-center justify-center">
        {building.image ? (
          <img src={building.image} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-black text-slate-300">{building.name.charAt(0)}</span>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: BRAND }}>Conference venue</p>
        <h3 className="font-black text-slate-900 leading-tight">{building.name}</h3>
        {building.name_mi && <p className="text-xs text-slate-400 italic">{building.name_mi}</p>}
        <p className="text-xs text-slate-400 mt-0.5">{building.address}</p>
        <div className="mt-1.5"><AccessBadge level={building.access_level} /></div>
        <p className="text-sm text-slate-500 leading-snug mt-1.5">{building.summary}</p>
      </div>
    </div>
  )
}
