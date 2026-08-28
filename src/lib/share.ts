// Encodes/decodes the current tour selection into a compact URL query string
// so a route can be shared with someone else and restore the same state.
export interface ShareState {
  ids: string[]
  startId: string | null
  loop: boolean
}

const PARAM = 'r'

export function encodeShareState(state: ShareState): string {
  const parts = [state.ids.join('.'), state.startId ?? '', state.loop ? '1' : '0']
  return encodeURIComponent(parts.join('~'))
}

export function decodeShareState(encoded: string): ShareState | null {
  try {
    const [idsPart, startPart, loopPart] = decodeURIComponent(encoded).split('~')
    const ids = idsPart ? idsPart.split('.').filter(Boolean) : []
    if (ids.length === 0) return null
    return {
      ids,
      startId: startPart || null,
      loop: loopPart === '1',
    }
  } catch {
    return null
  }
}

export function shareUrl(state: ShareState): string {
  const url = new URL(window.location.href)
  url.searchParams.set(PARAM, encodeShareState(state))
  return url.toString()
}

export function readShareStateFromUrl(): ShareState | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get(PARAM)
  if (!raw) return null
  return decodeShareState(raw)
}
