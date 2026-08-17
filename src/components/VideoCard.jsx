import React, { useState, useRef, useEffect } from 'react'

const BRAND = '#17638f'

const PlayIcon = ({ className }) => (
  <svg className={className} fill={BRAND} viewBox="0 0 20 20">
    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
  </svg>
)

/**
 * Props: title, vimeo (full URL)
 */
export default function VideoCard({ title, vimeo }) {
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const cardRef = useRef(null)
  const iframeRef = useRef(null)
  const vimeoId = vimeo ? vimeo.split('/').pop() : null

  // Hiding Vimeo's own controls (and cropping the video to zoom past them) is
  // a paid-plan feature Vimeo can silently ignore, and we have no way to tell
  // from here whether that's the case - so instead of fighting that, the
  // iframe is sized to exactly match this card. Vimeo's native control bar
  // (play/pause/seek/volume/fullscreen) then renders in full, uncropped, and
  // is the only thing that needs to work reliably.
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.event === 'ready') {
          iframeRef.current.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value: 'finish' }), '*')
        } else if (data.event === 'finish') {
          setPlaying(false); setActive(false)
        }
      } catch {}
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  useEffect(() => {
    if (window.innerWidth >= 1024) return
    const check = () => {
      if (!cardRef.current) return
      const vh = window.innerHeight
      const rect = cardRef.current.getBoundingClientRect()
      const cardCenter = (rect.top + rect.bottom) / 2
      const visible = cardCenter > vh / 3 && cardCenter < (vh * 2) / 3
      setActive(visible)
      if (!visible) setPlaying(false)
    }
    requestAnimationFrame(check)
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])

  return (
    <div
      ref={cardRef}
      className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative h-[220px] lg:h-[280px] bg-slate-900"
      onMouseEnter={() => setActive(true)}
    >
      {playing && vimeoId ? (
        <iframe
          ref={iframeRef}
          src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0&api=1`}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={title}
        />
      ) : (
        <>
          <img
            src={`https://vumbnail.com/${vimeoId}.jpg`}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            style={{ filter: active ? 'brightness(0.15)' : 'brightness(0.75)' }}
          />
          <div
            className="absolute inset-0 flex flex-col justify-start p-6 transition-all duration-500"
            style={{ opacity: active ? 0 : 1 }}
          >
            <h3 className="text-white font-black text-sm lg:text-lg tracking-tight leading-snug">{title}</h3>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-500"
            style={{ opacity: active ? 0 : 1 }}
          >
            <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
              <PlayIcon className="w-5 h-5 lg:w-6 lg:h-6 ml-0.5" />
            </div>
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center transition-all duration-500"
            style={{ opacity: active ? 1 : 0 }}
          >
            <button
              onClick={e => { e.stopPropagation(); setPlaying(true) }}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-white font-bold text-sm tracking-wide shadow-xl transition-all"
              style={{ color: BRAND }}
            >
              <PlayIcon className="w-4 h-4 ml-0.5 flex-shrink-0" />
              Watch Video
            </button>
          </div>
        </>
      )}
    </div>
  )
}
