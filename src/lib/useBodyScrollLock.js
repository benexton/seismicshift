import { useEffect } from 'react'

// Locks background scroll while a fixed-position modal (disclaimer gate,
// building detail) is open, matching the pattern Footer.astro's legal
// modals use.
export function useBodyScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}
