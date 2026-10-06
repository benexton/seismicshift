import { acknowledgeDisclaimer } from '../../lib/disclaimerStorage'
import { useBodyScrollLock } from '../../lib/useBodyScrollLock'

import { WALK } from './theme'

const POINTS = [
  'Watch for traffic, cyclists, e-scooters, and the heritage tram - central Christchurch has shared and separated cycle lanes and a tram loop through the tour area; look both ways and cross at signals.',
  'Uneven surfaces, roadworks, and temporary fencing are common; watch your footing.',
  'February is NZ summer - expect strong UV and heat; wear sunscreen and a hat, and carry water.',
  'This is a self-guided tour undertaken at your own risk.',
  'Only enter buildings marked as publicly accessible, and respect private property, tenants, and staff. Interior access and opening hours are not guaranteed - check ahead.',
  'Some earthquake-damaged and heritage sites (e.g. the Cathedral) may be fenced or under construction - exterior viewing only.',
  'Seismic Shift and NZSEE are not affiliated with the building owners and provide this information as-is, without warranty or liability.',
  'In an emergency, call 111.',
]

// Controlled by the parent: `open` decides visibility, `dismissable` shows a
// plain close button (used when the user reopens it voluntarily from the
// footer link, having already agreed once this session).
export default function DisclaimerGate({ open, dismissable = false, onAcknowledge, onDismiss }) {
  useBodyScrollLock(open)
  if (!open) return null

  const acknowledge = () => {
    acknowledgeDisclaimer()
    onAcknowledge?.()
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') window.gtag('event', 'disclaimer_ack')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-[#1c1517]/70 backdrop-blur-sm">
      <div className="relative bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-7 pt-7 pb-4 border-b border-slate-100 flex-shrink-0 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-1.5" style={{ color: WALK.red }}>Before you set off</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Seismic Walk safety notice</h2>
          </div>
          {dismissable && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="2" y1="2" x2="12" y2="12" />
                <line x1="12" y1="2" x2="2" y2="12" />
              </svg>
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-7 py-5">
          <ul className="space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                <span aria-hidden="true" className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: WALK.maroon }} />
                {point}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 leading-relaxed mt-5">
            Your location, if you choose to share it, stays on your device - nothing about your position is sent to a server.
          </p>
        </div>
        <div className="px-7 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-slate-100 flex-shrink-0">
          <button
            onClick={acknowledge}
            className="w-full text-white px-5 py-3 text-sm font-bold rounded-lg transition hover:brightness-110"
            style={{ backgroundColor: WALK.maroon }}
          >
            I understand and agree
          </button>
        </div>
      </div>
    </div>
  )
}
