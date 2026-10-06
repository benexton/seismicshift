import { formatDistance, formatDuration, walkMinutes } from '../../lib/geo'
import { WALK } from './theme'

// canPlan: there's a route to plan - two or more points in total, so a single
// site counts when there's a start point to walk from.
export default function SelectionBar({ count, estimatedMeters, canPlan, optimised, onOptimise, onClear }) {
  if (count === 0) return null

  return (
    <div className="mt-8 -mx-4 md:mx-0 md:mb-4">
      <div
        className="text-white md:rounded-xl shadow-[0_-8px_24px_rgba(28,21,23,0.18)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3"
        style={{ backgroundColor: WALK.ink }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-sm">{count} site{count === 1 ? '' : 's'} selected</p>
            {estimatedMeters != null ? (
              <p className="text-xs text-white/60 tabular-nums">
                {optimised ? 'Optimised: ' : 'Approx. '}
                {formatDistance(estimatedMeters)} · {formatDuration(walkMinutes(estimatedMeters))} walking
              </p>
            ) : (
              <p className="text-xs text-white/60">Pick another site, or set a start point, to plan a route</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button type="button" onClick={onClear} className="px-3 py-2 text-xs font-semibold text-white/60 hover:text-white">
              Clear
            </button>
            <button
              type="button"
              onClick={onOptimise}
              disabled={!canPlan}
              className="px-4 py-2.5 text-sm font-bold rounded-lg text-white transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: WALK.red }}
            >
              {optimised ? 'Re-optimise' : 'Plan my route'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
