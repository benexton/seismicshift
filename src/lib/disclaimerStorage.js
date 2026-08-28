const STORAGE_KEY = 'seismic-walk-disclaimer-ack'

export function hasAcknowledgedDisclaimer() {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function acknowledgeDisclaimer() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // storage unavailable - proceed anyway, gate re-shows next load
  }
}
