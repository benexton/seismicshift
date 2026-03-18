import React, { useState, useRef, useEffect } from 'react'

const BRAND = '#17638f'

/**
 * Props: title, vimeo (full URL), translate (CSS transform string)
 */
export default function VideoCard({ title, vimeo, translate }) {
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const cardRef = useRef(null)
  const iframeRef = useRef(null)
  const vimeoId = vimeo ? vimeo.split('/').pop() : null
  const videoTransform = translate || 'translate(-50%, -50%)'

  useEffect(() => {
    const handleMessage = (e) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.event === 'finish') { setPlaying(false); setActive(false) }
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
      className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative h-[220px] lg:h-[280px]"
      onMouseEnter={() => setActive(true)}
    >
      {playing && vimeoId ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe
            ref={iframeRef}
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0&api=1`}
            className="absolute top-1/2 left-1/2"
            style={{ border: 0, width: '158%', height: '158%', transform: videoTransform }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>
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
            className="absolute inset-0 flex items-center justify-center transition-all duration-500"
            style={{ opacity: active ? 1 : 0 }}
          >
            <button
              onClick={e => { e.stopPropagation(); setPlaying(true) }}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-white font-bold text-sm tracking-wide shadow-xl transition-all"
              style={{ color: BRAND }}
            >
              <svg className="w-4 h-4 ml-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
              Watch Video
            </button>
          </div>
        </>
      )}
    </div>
  )
}
