import { useEffect, useRef } from 'react'

// Keyboard and focus behaviour for the walk's modal sheets: moves focus into
// the dialog when it opens, keeps Tab inside it, closes on Escape (when
// onEscape is given), and puts focus back where it was on close. Attach the
// returned ref to the dialog panel, which should carry role="dialog",
// aria-modal and tabIndex={-1}.
export function useDialog(open, onEscape) {
  const ref = useRef(null)
  const escapeRef = useRef(onEscape)
  useEffect(() => {
    escapeRef.current = onEscape
  })

  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement
    ref.current?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && escapeRef.current) {
        e.stopPropagation()
        escapeRef.current()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return
      const focusable = ref.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open])

  return ref
}
