import { formatDistance, formatDuration, walkMinutes } from '../../lib/geo'

const BRAND = '#17638f'

export default function SelectionBar({ count, estimatedMeters, optimised, onOptimise, onClear }) {
  if (count === 0) return null

  return (
    <div className="sticky bottom-0 left-0 right-0 z-30 bg-white border-t-2 border-slate-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-4 py-3 md:rounded-t-3xl">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-900 text-sm">{count} building{count === 1 ? '' : 's'} selected</p>
          {estimatedMeters != null && (
            <p className="text-xs text-slate-500">
              {optimised ? 'Optimised route: ' : 'Rough estimate: '}
              {formatDistance(estimatedMeters)} · {formatDuration(walkMinutes(estimatedMeters))} walking
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onOptimise}
            disabled={count < 2}
            className="px-5 py-2.5 text-xs font-bold tracking-widest rounded-full text-white shadow-md transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: BRAND }}
          >
            {optimised ? 'Re-optimise route' : 'Optimise route'}
          </button>
        </div>
      </div>
    </div>
  )
}
