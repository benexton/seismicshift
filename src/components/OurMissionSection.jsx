import React, { useState } from 'react'

const BRAND = '#17638f'
const VIMEO_ID = '1121378324'

function VideoPlayer({ mobile = false }) {
  const [playing, setPlaying] = useState(false)

  if (mobile) {
    return (
      <div className="w-full mb-4 rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 relative" style={{ aspectRatio: '16/9' }}>
        {playing ? (
          <div className="absolute inset-0 w-full h-full overflow-hidden">
            <iframe
              src={`https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&autopause=0`}
              className="absolute top-1/2 left-1/2"
              style={{ border: 0, width: '158%', height: '158%', transform: 'translate(-45%, -50%)' }}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen title="Seismic Shift Story"
            />
          </div>
        ) : (
          <>
            <img src={`https://vumbnail.com/${VIMEO_ID}.jpg`} alt="Seismic Shift Story"
              className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 flex items-center justify-center">
              <button onClick={() => setPlaying(true)}
                className="w-12 h-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-xl transition-all"
                aria-label="Play video">
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: BRAND }}>
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 w-[90%] h-72 bg-slate-900 rounded-3xl border border-slate-200 overflow-hidden shadow-md z-10 group">
      {playing ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe
            src={`https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&autopause=0`}
            className="absolute top-1/2 left-1/2"
            style={{ border: 0, width: '158%', height: '158%', transform: 'translate(-45%, -50%)' }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen title="Seismic Shift Story"
          />
        </div>
      ) : (
        <>
          <img src={`https://vumbnail.com/${VIMEO_ID}.jpg`} alt="Seismic Shift Story"
            className="absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:brightness-75" loading="lazy" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={() => setPlaying(true)}
              className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-2xl transition-all hover:scale-105"
              aria-label="Play video">
              <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 20 20" style={{ color: BRAND }}>
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
            </button>
          </div>
        </>
      )}
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
