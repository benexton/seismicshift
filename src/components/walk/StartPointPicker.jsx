import { useState } from 'react'

const BRAND = '#17638f'

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
    <div className="rounded-3xl border-2 border-slate-100 bg-white p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Start point</p>

      <div className="flex flex-wrap gap-2 mb-2">
        <button
          type="button"
          onClick={requestLocation}
          className="px-3 py-1.5 rounded-full border-2 font-bold text-xs tracking-wide transition-colors"
          style={
            userLocation
              ? { borderColor: BRAND, backgroundColor: '#eef1f3', color: BRAND }
              : { borderColor: '#cbd5e1', backgroundColor: 'white', color: '#475569' }
          }
        >
          {locating ? 'Locating…' : userLocation ? '📍 My location' : 'Use my location'}
        </button>

        <select
          value={userLocation ? '' : startId ?? ''}
          onChange={(e) => onStartChange(e.target.value || null)}
          className="px-3 py-1.5 rounded-full border-2 border-slate-300 font-bold text-xs tracking-wide text-slate-600 bg-white"
        >
          <option value="">No fixed start</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {locationError && <p className="text-xs text-red-500 mb-2">{locationError}</p>}

      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 mt-1">
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => onLoopChange(e.target.checked)}
          className="w-4 h-4 rounded border-2 border-slate-300 accent-[#17638f]"
        />
        Return to start (loop)
      </label>
    </div>
  )
}
