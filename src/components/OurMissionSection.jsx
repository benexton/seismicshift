import React, { useState, useRef, useEffect } from 'react'

const BRAND = '#17638f'
const VIMEO_ID = '1121378324'

const PlayIcon = ({ className }) => (
  <svg className={className} fill={BRAND} viewBox="0 0 20 20">
    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
  </svg>
)

function VideoPlayer({ mobile = false }) {
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [scrubbing, setScrubbing] = useState(false)
  const iframeRef = useRef(null)
  const seekBarRef = useRef(null)

  const postToPlayer = (method, value) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), '*')
  }

  useEffect(() => {
    if (!playing) { setPaused(false); setProgress(0); setDuration(0) }
  }, [playing])

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.event === 'ready') {
          ;['play', 'pause', 'finish', 'timeupdate'].forEach(event => postToPlayer('addEventListener', event))
        } else if (data.event === 'finish') {
          setPlaying(false)
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

  const playerBody = playing ? (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <iframe
        ref={iframeRef}
        src={`https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&autopause=0&api=1&controls=0`}
        className="absolute top-1/2 left-1/2 pointer-events-none"
        style={{ border: 0, width: '158%', height: '158%', transform: 'translate(-45%, -50%)' }}
        allow="autoplay; fullscreen; picture-in-picture"
        title="Seismic Shift Story"
      />
      <button
        type="button"
        aria-label={paused ? 'Play video' : 'Pause video'}
        onClick={togglePlayPause}
        className="absolute inset-0 w-full h-full cursor-pointer bg-transparent border-0 p-0 appearance-none"
      >
        {paused && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className={`${mobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full bg-white/90 flex items-center justify-center shadow-xl`}>
              <PlayIcon className={mobile ? 'w-5 h-5 ml-0.5' : 'w-7 h-7 ml-1'} />
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
      <div className="w-full mb-4 rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 relative" style={{ aspectRatio: '16/9' }}>
        {playerBody}
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 w-[90%] h-72 bg-slate-900 rounded-3xl border border-slate-200 overflow-hidden shadow-md z-10 group">
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
