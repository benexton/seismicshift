import React, { useCallback, useEffect, useRef, useState } from 'react'

const BRAND = '#17638f'
const NUDGE_STEP = 2
const NUDGE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

/**
 * Draggable before/after image comparison slider.
 *
 * Props:
 * - beforeSrc, afterSrc: string
 * - beforeAlt, afterAlt: string
 * - beforeLabel, afterLabel: string (corner pills)
 * - aspectRatio: string, e.g. "16 / 9" (default)
 * - initialPosition: number 0-100 (default 50)
 * - caption: string, optional
 */
export default function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeLabel,
  afterLabel,
  aspectRatio = '16 / 9',
  initialPosition = 50,
  caption,
}) {
  const [position, setPosition] = useState(initialPosition)
  const [dragging, setDragging] = useState(false)
  const [hinting, setHinting] = useState(false)
  const containerRef = useRef(null)
  const handleRef = useRef(null)

  const clamp = (value) => Math.min(100, Math.max(0, value))

  const setPositionFromClientX = useCallback((clientX) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ratio = ((clientX - rect.left) / rect.width) * 100
    setPosition(clamp(ratio))
  }, [])

  const stopHint = () => setHinting(false)

  const onPointerDown = (e) => {
    stopHint()
    setDragging(true)
    setPositionFromClientX(e.clientX)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    if (!dragging) return
    setPositionFromClientX(e.clientX)
  }

  const endDrag = () => setDragging(false)

  const onTrackClick = (e) => {
    stopHint()
    setPositionFromClientX(e.clientX)
  }

  const onKeyDown = (e) => {
    if (!NUDGE_KEYS.includes(e.key) && e.key !== 'Home' && e.key !== 'End') return
    stopHint()
    e.preventDefault()
    if (e.key === 'Home') return setPosition(0)
    if (e.key === 'End') return setPosition(100)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return setPosition((p) => clamp(p - NUDGE_STEP))
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return setPosition((p) => clamp(p + NUDGE_STEP))
  }

  // First-mount discoverability nudge: only when the user hasn't asked for
  // reduced motion, and cancelled the moment they touch the slider.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return
    setHinting(true)
    const timer = setTimeout(stopHint, 1600)
    return () => clearTimeout(timer)
  }, [])

  const roundedPosition = Math.round(position)

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-3xl border border-slate-200 shadow-sm select-none"
        style={{
          aspectRatio,
          touchAction: dragging ? 'none' : 'pan-y',
          cursor: dragging ? 'grabbing' : 'pointer',
        }}
        onPointerDown={onTrackClick}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        {/* Before image: base layer, full width */}
        <img
          src={beforeSrc}
          alt={beforeAlt}
          draggable={false}
          loading="lazy"
          decoding="async"
          // TODO: add srcset/sizes here once resized image variants exist
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

        {/* After image: clipped to reveal only right of the handle */}
        <img
          src={afterSrc}
          alt={afterAlt}
          draggable={false}
          loading="lazy"
          decoding="async"
          // TODO: add srcset/sizes here once resized image variants exist
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        />

        {/* Corner label pills - DOM overlays, never baked into the images */}
        <span className="absolute bottom-3 left-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {beforeLabel}
        </span>
        <span className="absolute bottom-3 right-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {afterLabel}
        </span>

        {/* Divider + handle */}
        <div
          className="absolute inset-y-0 z-10 w-0.5 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.15)] pointer-events-none"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />
        <div
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label="Before/after comparison position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roundedPosition}
          aria-valuetext={`${roundedPosition}% ${afterLabel}, ${100 - roundedPosition}% ${beforeLabel}`}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          className={`absolute top-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-white shadow-lg transition-transform motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            dragging ? 'scale-105 cursor-grabbing' : 'cursor-grab hover:scale-105'
          } ${hinting ? 'animate-[baHandlePulse_1.6s_ease-in-out_1]' : ''}`}
          style={{
            left: `${position}%`,
            transform: 'translate(-50%, -50%)',
            '--tw-ring-color': `${BRAND}4d`,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M5 3L1 8L5 13" stroke={BRAND} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 3L15 8L11 13" stroke={BRAND} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {caption && (
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">{caption}</p>
      )}

      <style>{`
        @keyframes baHandlePulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          30% { transform: translate(-65%, -50%) scale(1.08); }
          60% { transform: translate(-35%, -50%) scale(1.08); }
        }
      `}</style>
    </div>
  )
}
