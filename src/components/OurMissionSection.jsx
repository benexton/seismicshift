import React, { useState, useRef, useEffect } from 'react'

const BRAND = '#17638f'
const VIMEO_ID = '1218774206'
const VIDEO_RATIO = 1280 / 720 // confirmed via Vimeo's api/v2/video/{id}.json

const PlayIcon = ({ className }) => (
  <svg className={className} fill={BRAND} viewBox="0 0 20 20">
    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
  </svg>
)

// Reserve this much height at the card's bottom for Vimeo's native control
// bar strip - the click-to-toggle overlay stops above it so the seek bar
// stays reachable instead of one full-card overlay swallowing every click.
const CONTROL_STRIP_PX = 40

function VideoPlayer({ mobile = false }) {
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(true)
  const [coverSize, setCoverSize] = useState(null)
  const cardRef = useRef(null)
  const iframeRef = useRef(null)

  const postToPlayer = (method, value) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), '*')
  }

  // The card's own width is fluid (a percentage of the grid column on
  // desktop, the full column on mobile), so even though it's set up close
  // to the video's real 16:9 ratio, it rarely matches exactly - Vimeo then
  // letterboxes internally by whatever the gap is. This computes the actual
  // cover-crop size in JS instead, same idea as object-fit: cover but for
  // an iframe (which has no such CSS property), so the video always fills
  // the card completely with zero letterboxing.
  useEffect(() => {
    if (!playing) return
    const update = () => {
      const card = cardRef.current
      if (!card) return
      const cw = card.clientWidth
      const ch = card.clientHeight
      const cardRatio = cw / ch
      const size = VIDEO_RATIO > cardRatio
        ? { width: ch * VIDEO_RATIO, height: ch }
        : { width: cw, height: cw / VIDEO_RATIO }
      setCoverSize(size)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [playing])

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

  const togglePlayPause = (e) => {
    e.stopPropagation()
    postToPlayer(paused ? 'play' : 'pause')
  }

  const playerBody = playing ? (
    <>
      {coverSize && (
        <iframe
          ref={iframeRef}
          src={`https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&autopause=0&api=1`}
          className="absolute top-1/2 left-1/2"
          style={{
            border: 0,
            width: `${coverSize.width}px`,
            height: `${coverSize.height}px`,
            transform: 'translate(-50%, -50%)',
          }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Seismic Shift Story"
        />
      )}
      <button
        type="button"
        aria-label={paused ? 'Play video' : 'Pause video'}
        onClick={togglePlayPause}
        className="absolute inset-x-0 top-0 cursor-pointer bg-transparent border-0 p-0 appearance-none"
        style={{ bottom: `${CONTROL_STRIP_PX}px` }}
      />
    </>
  ) : (
    <>
      <img src={`https://vumbnail.com/${VIMEO_ID}.jpg`} alt="Seismic Shift Story"
        className={`absolute inset-0 w-full h-full object-cover${mobile ? '' : ' transition-all duration-300 group-hover:brightness-75'}`} loading="lazy" />
      <div className="absolute inset-0 flex items-center justify-center">
        <button onClick={() => setPlaying(true)}
          className={`${mobile ? 'w-12 h-12' : 'w-16 h-16 hover:scale-105'} rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-2xl transition-all`}
          aria-label="Play video">
          <PlayIcon className={mobile ? 'w-5 h-5 ml-0.5' : 'w-7 h-7 ml-1'} />
        </button>
      </div>
    </>
  )

  if (mobile) {
    return (
      <div ref={cardRef} className="w-full mb-4 rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 relative" style={{ aspectRatio: '16/9' }}>
        {playerBody}
      </div>
    )
  }

  return (
    <div ref={cardRef} className="absolute top-0 left-0 w-[90%] h-72 bg-slate-900 rounded-3xl border border-slate-200 overflow-hidden shadow-md z-10 group">
      {playerBody}
    </div>
  )
}

export default function OurMissionSection() {
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
        <div className="relative h-[640px] w-full">
          <VideoPlayer />
          <div className="absolute bottom-0 right-0 w-[72%] rounded-3xl border border-slate-200 overflow-hidden shadow-lg z-20" style={{ height: '295px' }}>
            <img src="/founderswebsite.webp" className="w-full h-full object-cover" alt="Founders" loading="lazy" />
          </div>
        </div>
        <div className="text-slate-600 leading-relaxed text-base space-y-5">
          <MissionText />
        </div>
      </div>

      {/* Mobile */}
      <div className="lg:hidden text-slate-600 leading-relaxed text-sm md:text-base space-y-4">
        <VideoPlayer mobile />
        <MissionText mobile />
      </div>
    </>
  )
}

function MissionText({ mobile = false }) {
  return (
    <>
      <p>When a devastating series of earthquakes struck Christchurch, New Zealand in 2011, Ben Exton was a student and Geoff Banks was a practicing structural engineer. Ben was one of thousands of students who volunteered to help shovel liquefaction and support the affected residents{mobile ? '' : ' of Christchurch'} - an experience which {mobile ? 'inspired him into structural engineering' : 'helped inspire him into the structural engineering field'}. Geoff found himself inspecting homes {mobile ? 'and supporting families through protracted insurance claims.' : 'for safety and then supporting families and insurers in resolving protracted insurance claims.'}</p>
      <p>Through these personal experiences, the founders of Seismic Shift have witnessed first-hand the human cost of earthquake damaged buildings. They have seen how damage to these important structures impacts people's financial, physical and mental wellbeing and creates enormous waste and climate emissions.</p>
      <p className={`text-slate-900 font-black ${mobile ? 'text-base' : 'text-lg'} tracking-tight leading-snug pl-${mobile ? '4' : '5'} py-1`} style={{ borderLeft: `4px solid ${BRAND}` }}>
        Engineering standards are primarily designed to save lives. But what if we could do better than that?
      </p>
      <p>What if we could build more resilient buildings that would suffer less damage and protect people from the trauma and financial costs of rebuilding - and would spare the planet the waste and carbon emissions?</p>
      <p><strong className="text-slate-900 font-bold">This is our mission at Seismic Shift</strong> - to deliver affordable resilience to earthquake-prone communities around the world.</p>
      {mobile && (
        <div style={{ float: 'right', width: '42%', marginLeft: '12px', marginBottom: '4px' }}
          className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
          <img src="/founderswebsite.webp" className="w-full object-cover" style={{ display: 'block', aspectRatio: '1/1' }} alt="Founders" loading="lazy" />
        </div>
      )}
      <p>Ben, Geoff &amp; team are supported by a group of expert advisors, researchers and specialists.</p>
      {mobile && <div style={{ clear: 'both' }} />}
    </>
  )
}
