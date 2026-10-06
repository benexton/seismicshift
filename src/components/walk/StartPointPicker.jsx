import { useState } from 'react'

import { WALK } from './theme'

export default function StartPointPicker({ buildings, startId, onStartChange, loop, onLoopChange, userLocation, onUseMyLocation }) {
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState(null)

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not available on this device.')
      return
    }
    setLocating(true)
    setLocationError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onUseMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        setLocating(false)
        setLocationError("Couldn't get your location - pick a building to start from instead.")
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: WALK.line }}>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          type="button"
          onClick={requestLocation}
          className="px-3 py-2 sm:py-1.5 rounded-lg border font-semibold text-xs transition-colors"
          style={
            userLocation
              ? { borderColor: WALK.maroon, backgroundColor: WALK.maroon, color: 'white' }
              : { borderColor: WALK.line, backgroundColor: 'white', color: '#475569' }
          }
        >
          {locating ? 'Locating…' : userLocation ? 'Using my location' : 'Use my location'}
        </button>

        <select
          value={userLocation ? '' : startId ?? ''}
          onChange={(e) => onStartChange(e.target.value || null)}
          className="px-3 py-2 sm:py-1.5 rounded-lg border border-[#e7dfe0] font-semibold text-base sm:text-xs text-slate-700 bg-white max-w-full"
        >
          <option value="">No fixed start</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {locationError && <p className="text-xs text-red-500 mb-2">{locationError}</p>}

      <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 mt-2">
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => onLoopChange(e.target.checked)}
          className="w-4 h-4 rounded accent-[#652431]"
        />
        Return to start (loop)
      </label>
    </div>
  )
}
