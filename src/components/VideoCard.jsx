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
export default function VideoCard({ title, vimeo, videoRatio = 16 / 9 }) {
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(true)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const [coverSize, setCoverSize] = useState(null)
  const cardRef = useRef(null)
  const iframeRef = useRef(null)
  const seekBarRef = useRef(null)
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
    if (!playing) { setPaused(true); setProgress(0); setDuration(0); setCoverSize(null) }
  }, [playing])

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.event === 'ready') {
          ;['play', 'pause', 'timeupdate'].forEach(event => postToPlayer('addEventListener', event))
        } else if (data.event === 'play') {
          setPaused(false)
        } else if (data.event === 'pause') {
          setPaused(true)
        } else if (data.event === 'timeupdate' && data.data) {
          setDuration(data.data.duration || 0)
          if (!scrubbing && data.data.duration) setProgress(data.data.seconds / data.data.duration)
        }
      } catch {}
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [scrubbing])

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

  const togglePlayPause = (e) => {
    e.stopPropagation()
    postToPlayer(paused ? 'play' : 'pause')
  }

  const seekFractionFromClientX = (clientX) => {
    if (!seekBarRef.current) return null
    const rect = seekBarRef.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  const handleSeekPointerDown = (e) => {
    e.stopPropagation()
    if (!duration) return
    setScrubbing(true)
    const fraction = seekFractionFromClientX(e.clientX)
    if (fraction !== null) setProgress(fraction)
  }

  useEffect(() => {
    if (!scrubbing) return
    const handleMove = (e) => {
      const fraction = seekFractionFromClientX(e.clientX)
      if (fraction !== null) setProgress(fraction)
    }
    const handleUp = (e) => {
      const fraction = seekFractionFromClientX(e.clientX)
      if (fraction !== null) postToPlayer('setCurrentTime', fraction * duration)
      setScrubbing(false)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [scrubbing, duration])

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
              className="absolute top-1/2 left-1/2 pointer-events-none"
              style={{
                border: 0,
                width: `${coverSize.width}px`,
                height: `${coverSize.height}px`,
                transform: 'translate(-50%, -50%)',
              }}
              allow="autoplay; fullscreen; picture-in-picture"
              title={title}
            />
          )}
          <button
            type="button"
            aria-label={paused ? 'Play video' : 'Pause video'}
            onClick={togglePlayPause}
            className="absolute inset-0 w-full h-full cursor-pointer bg-transparent border-0 p-0 appearance-none"
          >
            {paused && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                  <PlayIcon className="w-5 h-5 lg:w-6 lg:h-6 ml-0.5" />
                </span>
              </span>
            )}
          </button>
          <div
            ref={seekBarRef}
            onPointerDown={handleSeekPointerDown}
            className="group/seek absolute bottom-0 left-0 right-0 h-4 flex items-end cursor-pointer"
          >
            <div className="relative w-full h-1 group-hover/seek:h-1.5 bg-white/25 transition-all">
              <div
                className="absolute inset-y-0 left-0 bg-white"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          </div>
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
