import { useState } from 'react'
import AccessBadge from './AccessBadge'
import { formatDistance, formatDuration, walkMinutes } from '../../lib/geo'

function directionsUrl(from, to) {
  const origin = `${from.lat},${from.lng}`
  const destination = `${to.lat},${to.lng}`
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`
}

function LegLine({ fromPoint, toPoint, meters, printMode }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400 font-bold mb-1.5">
      <span>{formatDistance(meters)} · {formatDuration(walkMinutes(meters))}</span>
      {!printMode && (
        <a
          href={directionsUrl(fromPoint, toPoint)}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: '#17638f' }}
          onClick={() => window.gtag?.('event', 'directions_opened')}
        >
          Open in maps
        </a>
      )}
    </div>
  )
}

// `legs[i]` is the leg arriving at stops[i]: { fromPoint, meters } or null for
// stop 0 when there's no external start point (the walk simply begins there).
// `closingLeg` (optional) is the "return to start" leg when looped.
export default function RouteItinerary({ stops, legs, closingLeg, onViewDetail, printMode = false }) {
  const [expandedId, setExpandedId] = useState(null)
  if (stops.length === 0) return null

  return (
    <ol className="space-y-0">
      {stops.map((stop, idx) => {
        const leg = legs[idx]
        const isExpanded = expandedId === stop.id
        const isLast = idx === stops.length - 1
        return (
          <li key={stop.id} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black"
                style={{ backgroundColor: '#17638f' }}
              >
                {idx + 1}
              </div>
              {(!isLast || closingLeg) && <div className="flex-1 w-0.5 bg-slate-200 my-1" />}
            </div>

            <div className="flex-1 pb-6 min-w-0">
              {leg && <LegLine fromPoint={leg.fromPoint} toPoint={stop} meters={leg.meters} printMode={printMode} />}

              <button
                type="button"
                onClick={() => !printMode && setExpandedId(isExpanded ? null : stop.id)}
                className="text-left w-full"
              >
                <h4 className="font-black text-slate-900 leading-tight">{stop.name}</h4>
                {stop.name_mi && <p className="text-xs text-slate-400 italic">{stop.name_mi}</p>}
                <div className="mt-1"><AccessBadge level={stop.access_level} /></div>
              </button>

              {isExpanded && !printMode && (
                <div className="mt-2 text-sm text-slate-500 leading-relaxed">
                  <p>{stop.summary}</p>
                  {stop.access_notes && <p className="mt-1 text-xs text-slate-400">{stop.access_notes}</p>}
                  <button
                    type="button"
                    onClick={() => onViewDetail(stop)}
                    className="mt-2 text-xs font-bold underline"
                    style={{ color: '#17638f' }}
                  >
                    Full details →
                  </button>
                </div>
              )}
            </div>
          </li>
        )
      })}

      {closingLeg && (
        <li className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black bg-slate-400">
              ↩
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <LegLine fromPoint={closingLeg.fromPoint} toPoint={closingLeg.toPoint} meters={closingLeg.meters} printMode={printMode} />
            <p className="font-black text-slate-900 leading-tight">Return to start</p>
          </div>
        </li>
      )}
    </ol>
  )
}
