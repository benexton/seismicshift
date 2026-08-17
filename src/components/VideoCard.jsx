import React, { useState, useRef, useEffect } from 'react'

const BRAND = '#17638f'

const PlayIcon = ({ className }) => (
  <svg className={className} fill={BRAND} viewBox="0 0 20 20">
    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
  </svg>
)

/**
 * Props: title, vimeo (full URL), videoRatio (the video's real width/height,
 * e.g. 1920/1080 - confirmed per-video via Vimeo's api/v2/video/{id}.json,
 * NOT the oEmbed endpoint, which returned inaccurate values for these clips)
 */
// Reserve this much height at the card's bottom for Vimeo's native control
// bar strip - the click-to-toggle overlay stops above it so the seek bar,
// volume, and fullscreen buttons (whichever survive the horizontal crop)
// stay reachable, instead of one full-card overlay swallowing every click.
const CONTROL_STRIP_PX = 40

export default function VideoCard({ title, vimeo, videoRatio = 16 / 9 }) {
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(true)
  const [coverSize, setCoverSize] = useState(null)
  const cardRef = useRef(null)
  const iframeRef = useRef(null)
  const vimeoId = vimeo ? vimeo.split('/').pop() : null

  const postToPlayer = (method, value) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), '*')
  }

  // The card's own shape doesn't match any of these videos' real aspect
  // ratio, and it changes across breakpoints (sometimes narrower than the
  // video, sometimes wider), so a fixed CSS zoom can't reliably cover it.
  // This computes the correct cover-crop size in JS instead, same idea as
  // object-fit: cover but for an iframe (which has no such CSS property).
  // The crop is centered horizontally, so it also crops the control bar's
  // play/pause button (at its far left) along with the fullscreen/volume
  // buttons (far right) - only the middle scrubber reliably survives. The
  // click-to-toggle overlay below exists to cover for that.
  useEffect(() => {
    if (!playing) return
    const update = () => {
      const card = cardRef.current
      if (!card) return
      const cw = card.clientWidth
      const ch = card.clientHeight
      const cardRatio = cw / ch
      const size = videoRatio > cardRatio
        ? { width: ch * videoRatio, height: ch }
        : { width: cw, height: cw / videoRatio }
      setCoverSize(size)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [playing, videoRatio])

  useEffect(() => {
    if (!playing) { setCoverSize(null); setPaused(true) }
  }, [playing])

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.event === 'ready') {
          ;['play', 'pause'].forEach(event => postToPlayer('addEventListener', event))
        } else if (data.event === 'play') {
          setPaused(false)
        } else if (data.event === 'pause') {
          setPaused(true)
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
        <div className="absolute inset-0">
          {coverSize && (
            <iframe
              ref={iframeRef}
              src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0&api=1`}
              className="absolute top-1/2 left-1/2"
              style={{
                border: 0,
                width: `${coverSize.width}px`,
                height: `${coverSize.height}px`,
                transform: 'translate(-50%, -50%)',
              }}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={title}
            />
          )}
          <button
            type="button"
            aria-label={paused ? 'Play video' : 'Pause video'}
            onClick={e => { e.stopPropagation(); postToPlayer(paused ? 'play' : 'pause') }}
            className="absolute inset-x-0 top-0 cursor-pointer bg-transparent border-0 p-0 appearance-none"
            style={{ bottom: `${CONTROL_STRIP_PX}px` }}
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
