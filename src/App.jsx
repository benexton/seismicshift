import React, { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF, Stage } from '@react-three/drei'
import logo from './assets/Transparent Logo.png'

function Model({ src = '/QD155.glb', rotation = [Math.PI / 2, 0, 0], scale = [1.5, 1.5, 1.5] }) {
  const { scene } = useGLTF(src)
  return (
    <group rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  )
}

const rollingWords = {
  infrastructure: ["warehouse.", "factory.", "power plant."],
  residential:    ["home.", "nest egg.", "sanctuary."],
  assets:         ["data centre.", "medical equipment.", "emergency systems."],
}

function RollingWord({ category }) {
  const words = rollingWords[category]
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => { setIndex(0); setVisible(true) }, [category])
  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIndex(i => (i + 1) % words.length); setVisible(true) }, 350)
    }, 3300)
    return () => clearInterval(interval)
  }, [category, words.length])

  return (
    <span className="text-blue-800 inline-block" style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      {words[index]}
    </span>
  )
}

function HeroPills({ category }) {
  const installFile = category === "infrastructure" ? "./qdinstallweb.pdf" : "./ffinstallweb.pdf"
  
  return (
    <div className="flex gap-3 mt-10 mb-2 flex-wrap">
      <a href="./makita.png" download="makita.png"
        className="px-5 py-2 rounded-full border-2 border-blue-800 text-blue-800 bg-white font-bold text-xs tracking-wide hover:bg-blue-50 transition-all duration-200">
        Technical Datasheet
      </a>
      <a href={installFile} download={installFile.split('/').pop()}
        className="px-5 py-2 rounded-full border-2 border-blue-800 text-blue-800 bg-white font-bold text-xs tracking-wide hover:bg-blue-50 transition-all duration-200">
        Install Instructions
      </a>
    </div>
  )
}

const categoryStats = {
  infrastructure: { label: "Case study: Canterbury",    devices: 4,  budget: "1–3%", strength: "3× NBS", drift: "±200mm" },
  residential:    { label: "Case study: Central Otago", devices: 23, budget: "2–4%", strength: "2× NBS", drift: "±150mm" },
  assets:         { label: "Case study: Canterbury",    devices: 4,  budget: "3–5%", strength: "2× NBS", drift: "±180mm" },
}

const categoryImages = {
  infrastructure: "./api/placeholder/1200/675",
  residential:    "./pisa1website.jpg",
  assets:         "./api/placeholder/1200/675",
}

const howItWorksCards = {
  infrastructure: [
    { step: "01", title: "Engineered to your building",         img: "./testingflag.png",         body: "Our engineers analyse your structure's seismic demands and design a custom solution sized precisely for the loads involved." },
    { step: "02", title: "Connected to seismic bracing",        img: "./clean5.png",              body: "Devices connect directly into the building's bracing system, adding energy dissipation capacity at the points where it matters most." },
    { step: "03", title: "Retrofit example",                    img: null, vimeo: "https://vimeo.com/1167209639", body: "When the ground shakes, the devices absorb and dissipate seismic energy before it reaches the structure, dramatically reducing damage.", translate: "translate(-45%, -50%)" },
  ],
  residential: [
    { step: "01", title: "Engineered to your building",         img: "./testingflag.png",         body: "Our engineers analyse your home's seismic demands and design a custom solution sized precisely for the loads involved." },
    { step: "02", title: "Installed at foundation level",       img: "./pisa2website.jpg",        body: "Devices are installed between the foundation and the structure so the building moves independently from the ground during an earthquake." },
    { step: "03", title: "Home application",                    img: null, vimeo: "https://vimeo.com/1165542787", body: "When the ground shakes, the devices absorb and dissipate seismic energy before it reaches your home, dramatically reducing damage.", translate: "translate(-50%, -50%)" },
  ],
  assets: [
    { step: "01", title: "Engineered to your building",         img: "./testingflag.png",         body: "Our engineers analyse your facility's seismic demands and design a custom solution sized precisely for the loads involved." },
    { step: "02", title: "Installed in an isolating plinth",    img: "./api/placeholder/800/600", body: "Devices are installed within a precision-engineered plinth that isolates critical equipment from ground motion during a seismic event." },
    { step: "03", title: "Absorbs energy. Protects structure.", img: "./api/placeholder/800/600", body: "When the ground shakes, the devices absorb and dissipate seismic energy before it reaches the facility, keeping critical operations running." },
  ],
}

function HowItWorksCard({ step, title, img, body, vimeo, translate }) {
  const [active, setActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const cardRef = useRef(null)

  const vimeoId = vimeo ? vimeo.split('/').pop() : null
  const videoTransform = translate || 'translate(-50%, -50%)' // Default centered if not specified

  useEffect(() => {
    const isMobile = window.innerWidth < 1024
    if (!isMobile || !cardRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const viewportHeight = window.innerHeight
        const centerStart = viewportHeight * (1/3)
        const centerEnd = viewportHeight * (2/3)
        const rect = entry.boundingClientRect
        const isInCenterZone = (rect.bottom >= centerStart && rect.top <= centerEnd) && entry.isIntersecting
        setActive(isInCenterZone)
        if (!isInCenterZone) setPlaying(false)
      },
      { threshold: Array.from({length: 101}, (_, i) => i / 100) }
    )

    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={cardRef}
      className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative h-[220px] lg:h-[280px]"
      onMouseEnter={() => setActive(true)}
      onClick={() => window.innerWidth < 1024 && setActive(a => !a)}
    >
      {/* If playing: full iframe */}
      {playing && vimeoId ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0`}
            className="absolute top-1/2 left-1/2"
            style={{ 
              border: 0,
              width: '158%',
              height: '158%',
              transform: videoTransform
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={title}
          />
        </div>
      ) : (
        <>
          {/* Thumbnail / image background */}
          <img
            src={vimeoId ? `https://vumbnail.com/${vimeoId}.jpg` : img}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            style={{ filter: active ? (vimeoId ? 'brightness(0.15)' : 'blur(4px) brightness(0.25)') : 'brightness(0.55)' }}
          />

          {/* Text overlay — fades out when active on vimeo card */}
          <div className="absolute inset-0 flex flex-col justify-start p-8 transition-all duration-500"
            style={{ opacity: (vimeoId && active) ? 0 : 1, pointerEvents: (vimeoId && active) ? 'none' : 'auto' }}>
            <h3 className="text-white font-black text-lg tracking-tight leading-snug">{title}</h3>
            <p className="text-slate-200 text-sm leading-relaxed mt-4 transition-all duration-500"
              style={{ opacity: (!vimeoId && active) ? 1 : 0, transform: (!vimeoId && active) ? 'translateY(0)' : 'translateY(-6px)' }}>
              {body}
            </p>
          </div>

          {/* Vimeo: play button centered when active */}
          {vimeoId && (
            <div className="absolute inset-0 flex items-center justify-center transition-all duration-500"
              style={{ opacity: active ? 1 : 0 }}>
              <button
                onClick={e => { e.stopPropagation(); setPlaying(true) }}
                className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-white text-blue-800 font-bold text-sm tracking-wide hover:bg-blue-50 shadow-xl transition-all"
              >
                <svg className="w-4 h-4 ml-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                </svg>
                Watch Video
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Our Mission Video — Desktop (absolute positioned, top-left slot) ─────────
function OurMissionVideo({ vimeoId }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="absolute top-0 left-0 w-[90%] h-72 bg-slate-900 rounded-3xl border border-slate-200 overflow-hidden shadow-md z-10 group">
      {playing ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0`}
            className="absolute top-1/2 left-1/2"
            style={{ 
              border: 0,
              width: '158%',
              height: '158%',
              transform: 'translate(-45%, -50%)'
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Seismic Shift Story"
          />
        </div>
      ) : (
        <>
          <img
            src={`https://vumbnail.com/${vimeoId}.jpg`}
            alt="Seismic Shift Story"
            className="absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:brightness-75"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setPlaying(true)}
              className="w-16 h-16 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105"
              aria-label="Play video"
            >
              <svg className="w-7 h-7 text-blue-800 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Our Mission Video — Mobile (full-width, aspect-ratio container) ──────────
function OurMissionVideoMobile({ vimeoId }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="w-full mb-4 rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 relative" style={{ aspectRatio: '16/9' }}>
      {playing ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0`}
            className="absolute top-1/2 left-1/2"
            style={{ 
              border: 0,
              width: '158%',
              height: '158%',
              transform: 'translate(-45%, -50%)'
            }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Seismic Shift Story"
          />
        </div>
      ) : (
        <>
          <img
            src={`https://vumbnail.com/${vimeoId}.jpg`}
            alt="Seismic Shift Story"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setPlaying(true)}
              className="w-12 h-12 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center shadow-xl transition-all duration-300"
              aria-label="Play video"
            >
              <svg className="w-5 h-5 text-blue-800 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Contact Page ─────────────────────────────────────────────────────────────
function ContactPage({ onBack }) {
  const [status, setStatus] = useState('idle') // idle, submitting, success, error

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    
    const form = e.target
    const data = new FormData(form)
    
    try {
      const response = await fetch('https://formspree.io/f/mjgepzqa', {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      })
      
      if (response.ok) {
        setStatus('success')
        form.reset()
        // Don't reset status - keep success message permanently
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 5000)
      }
    } catch (error) {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-8 md:px-16 w-full flex items-center justify-between py-3">
          <button onClick={onBack}><img src={logo} alt="Seismic Shift Logo" className="h-9 w-auto object-contain" /></button>
          <button onClick={onBack} className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-blue-800 transition">← Back</button>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-8 md:px-16 py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">We'd love to speak with you.</h1>
        <div className="grid lg:grid-cols-2 gap-16 items-stretch">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Name</label>
              <input 
                type="text" 
                name="name"
                required
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base focus:outline-none focus:border-blue-800 transition" 
                placeholder="Your full name" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Phone</label>
              <input 
                type="tel" 
                name="phone"
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base focus:outline-none focus:border-blue-800 transition" 
                placeholder="+64 21 000 0000" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email</label>
              <input 
                type="email" 
                name="email"
                required
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base focus:outline-none focus:border-blue-800 transition" 
                placeholder="you@example.com" 
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Message</label>
              <textarea 
                rows={6} 
                name="message"
                required
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base focus:outline-none focus:border-blue-800 transition resize-none" 
                placeholder="Tell us about your project..." 
              />
            </div>
            
            {/* Success/Error Messages */}
            {status === 'success' && (
              <div className="px-5 py-3 rounded-2xl bg-green-50 border-2 border-green-200 text-green-800 text-sm font-medium">
                ✓ Message sent successfully! We'll be in touch soon.
              </div>
            )}
            {status === 'error' && (
              <div className="px-5 py-3 rounded-2xl bg-red-50 border-2 border-red-200 text-red-800 text-sm font-medium">
                ✗ Something went wrong. Please try again or email us at ben@seismicshift.nz
              </div>
            )}
            
            {/* Only show Send button if not successfully sent */}
            {status !== 'success' && (
              <div>
                <button 
                  type="submit"
                  disabled={status === 'submitting'}
                  className="px-8 py-3 rounded-full border-2 border-blue-800 text-blue-800 bg-white font-bold text-xs tracking-wide hover:bg-blue-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'submitting' ? 'Sending...' : 'Send'}
                </button>
              </div>
            )}
          </form>
          <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm min-h-[480px]">
            <iframe title="Seismic Shift Location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2887.4!2d172.6419!3d-43.5271!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6d318b52c0a5414d%3A0x4e3e6a8e1f2b3c4d!2s120%20Madras%20St%2C%20Christchurch%20Central%20City%2C%20Christchurch%208011!5e0!3m2!1sen!2snz!4v1708000000000"
              width="100%" height="100%" style={{ border: 0, minHeight: '480px' }}
              allowFullScreen="" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hero section — renders differently on mobile vs desktop ──────────────────
// Desktop: original two-column grid (text left, model right, body+pills inside left col)
// Mobile: badge → headline → model → body → pills stacked vertically
function HeroSection({ category, modelNode, bodyText }) {
  return (
    <>
      {/* ── DESKTOP layout (md+): unchanged original ── */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-8 md:items-start mb-12">
        {/* Left col: badge, headline, body, pills */}
        <div className="pt-12">
          <div className="px-4 py-1.5 text-sm font-bold tracking-widest text-white uppercase bg-blue-800 rounded-full inline-block mb-8">New Zealand Engineered</div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tighter text-slate-900 mb-6">
            {category === "infrastructure" && <>An airbag for your <RollingWord category="infrastructure" /></>}
            {category === "residential"    && <>A shock-absorber for your <RollingWord category="residential" /></>}
            {category === "assets"         && <>Peace of mind for your <RollingWord category="assets" /></>}
          </h1>
          <p className="text-base md:text-lg lg:text-lg text-slate-500 leading-relaxed max-w-md">{bodyText}</p>
          <HeroPills category={category} />
        </div>
        {/* Right col: 3D model */}
        {modelNode}
      </div>

      {/* ── MOBILE layout (<md): badge → headline → model → body → pills ── */}
      <div className="md:hidden mb-10 pt-8">
        <div className="px-4 py-1.5 text-sm font-bold tracking-widest text-white uppercase bg-blue-800 rounded-full inline-block mb-6">New Zealand Engineered</div>
        <h1 className="text-2xl font-black leading-tight tracking-tighter text-slate-900 mb-4">
          {category === "infrastructure" && <>An airbag for your <RollingWord category="infrastructure" /></>}
          {category === "residential"    && <>A shock-absorber for your <RollingWord category="residential" /></>}
          {category === "assets"         && <>Peace of mind for your <RollingWord category="assets" /></>}
        </h1>
        {/* Model — shorter on mobile */}
        <div style={{ height: '220px' }}>
          {modelNode}
        </div>
        <p className="text-sm text-slate-500 leading-relaxed mt-4">{bodyText}</p>
        <HeroPills category={category} />
      </div>
    </>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function App() {
  const [activeCategory, setActiveCategory] = useState("infrastructure")
  const [showContact, setShowContact] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const qdContainerRef = useRef()
  const ffContainerRef = useRef()

  const stats = categoryStats[activeCategory]
  const image = categoryImages[activeCategory]
  const howCards = howItWorksCards[activeCategory]

  if (showContact) return <ContactPage onBack={() => { setShowContact(false); window.scrollTo({ top: 0, behavior: 'instant' }) }} />

  const qdModel = (
    <div ref={qdContainerRef} className="h-72 md:h-80 lg:h-[480px] w-full h-full"
      style={{ transition: 'transform .22s ease', transformOrigin: 'center bottom' }}
      onPointerEnter={() => qdContainerRef.current && (qdContainerRef.current.style.transform = 'scale(1.06)')}
      onPointerLeave={() => qdContainerRef.current && (qdContainerRef.current.style.transform = 'scale(1)')}>
      <Canvas shadows camera={{ position: [2, 2, 6], fov: 45 }}>
        <Suspense fallback={null}><Stage environment="city" intensity={0.6} contactShadow={{ opacity: 0.5, blur: 2 }} center={{ disableY: false }}><Model src="./QDUntitled37.glb" scale={[1.4, 1.4, 1.4]} rotation={[Math.PI / 2, -0.2, 0]} /></Stage></Suspense>
        <OrbitControls enableZoom={false} autoRotate />
      </Canvas>
    </div>
  )

  const ffModel = (
    <div ref={ffContainerRef} className="h-72 md:h-80 lg:h-[480px] w-full h-full"
      style={{ transition: 'transform .22s ease', transformOrigin: 'center bottom' }}
      onPointerEnter={() => ffContainerRef.current && (ffContainerRef.current.style.transform = 'scale(1.06)')}
      onPointerLeave={() => ffContainerRef.current && (ffContainerRef.current.style.transform = 'scale(1)')}>
      <Canvas shadows camera={{ position: [2, 2, 6], fov: 45 }}>
        <Suspense fallback={null}><Stage environment="sunset" intensity={0.3} contactShadow={{ opacity: 0.3, blur: 2.5 }} center={{ disableY: false }}><Model src="./bestFF.glb" scale={[0.8, 0.8, 0.8]} rotation={[0.3, 0, 0]} /></Stage></Suspense>
        <OrbitControls enableZoom={false} autoRotate />
      </Canvas>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">

      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-16 w-full py-3">
          <div className="flex items-center justify-between lg:grid lg:grid-cols-3">

            <div className="flex items-center">
              <img src={logo} alt="Seismic Shift Logo" className="h-9 w-auto object-contain" />
            </div>

            {/* Desktop pills — hide below 1024px to avoid cramping */}
            <div className="hidden lg:flex justify-center space-x-1.5 xl:space-x-2 items-center">
              {[
                { label: "Commercial & Industrial", key: "infrastructure" },
                { label: "Homes", key: "residential" },
                { label: "Critical Equipment", key: "assets" },
              ].map(({ label, key }) => (
                <button key={key} onClick={() => setActiveCategory(key)}
                  className={`px-2.5 xl:px-3 py-1.5 rounded-full border-2 font-bold text-[11px] xl:text-xs tracking-wide transition-all duration-200 whitespace-nowrap
                    ${activeCategory === key ? "border-blue-800 bg-blue-50 text-blue-800 shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:border-blue-800 hover:text-blue-800"}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Desktop right links */}
            <div className="hidden lg:flex items-center justify-end">
              <a href="#our-mission" className="text-xs xl:text-sm font-bold uppercase tracking-widest text-slate-900 hover:text-blue-800 transition mr-3 xl:mr-5">Our Mission</a>
              <button onClick={() => { setShowContact(true); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                className="bg-blue-800 text-white px-4 xl:px-5 py-2 text-[10px] xl:text-xs font-bold uppercase tracking-widest rounded-full hover:bg-blue-900 transition shadow-lg whitespace-nowrap">
                Contact Us
              </button>
            </div>

            {/* Mobile/tablet hamburger — show below 1024px */}
            <button className="lg:hidden ml-auto p-2 text-slate-700" onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu" aria-expanded={mobileMenuOpen}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                {mobileMenuOpen
                  ? <><line x1="4" y1="4" x2="18" y2="18"/><line x1="18" y1="4" x2="4" y2="18"/></>
                  : <><line x1="3" y1="6" x2="19" y2="6"/><line x1="3" y1="12" x2="19" y2="12"/><line x1="3" y1="18" x2="19" y2="18"/></>
                }
              </svg>
            </button>
          </div>

          {/* Mobile/tablet dropdown — show below 1024px */}
          {mobileMenuOpen && (
            <div className="lg:hidden pt-4 pb-3 border-t border-slate-100 mt-3 flex flex-col gap-3">
              {[
                { label: "Commercial & Industrial", key: "infrastructure" },
                { label: "Homes", key: "residential" },
                { label: "Critical Equipment", key: "assets" },
              ].map(({ label, key }) => (
                <button key={key} onClick={() => { setActiveCategory(key); setMobileMenuOpen(false) }}
                  className={`w-full text-left px-4 py-2 rounded-full border-2 font-bold text-sm transition-all duration-200
                    ${activeCategory === key ? "border-blue-800 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600"}`}>
                  {label}
                </button>
              ))}
              {/* Our Mission — centred, thicker grey border */}
              <a href="#our-mission" onClick={() => setMobileMenuOpen(false)}
                className="text-center px-4 py-2 rounded-full border-[3px] border-slate-600 text-slate-600 font-bold text-sm">
                Our Mission
              </a>
              <button onClick={() => { setShowContact(true); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                className="w-full bg-blue-800 text-white px-5 py-2 text-sm font-bold uppercase tracking-widest rounded-full hover:bg-blue-900 transition">
                Contact Us
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="w-full pb-0">
        <div style={{
          background: [
            "radial-gradient(ellipse 180% 40% at 50% 42%, rgba(230,234,236,0.20) 0%, rgba(200,204,207,0.14) 16%, rgba(120,122,124,0.07) 32%, rgba(0,0,0,0) 60%)",
            "radial-gradient(circle at 50% 70%, rgba(43,43,43,0.12) 0%, rgba(23,23,23,0.08) 40%, rgba(15,15,15,0.04) 75%, rgba(15,15,15,0) 100%)"
          ].join(', ')
        }}>
          <div className="max-w-7xl mx-auto px-6 md:px-16 py-6">
            {activeCategory === "infrastructure" && (
              <HeroSection category="infrastructure" modelNode={qdModel}
                bodyText="The Quake Defender™ delivers high-capacity seismic energy dissipation for commercial and industrial structures. Engineered in New Zealand for the world's most demanding environments." />
            )}
            {activeCategory === "residential" && (
              <HeroSection category="residential" modelNode={ffModel}
                bodyText="The FrontFoot™ foundation system decouples your home from ground motion, dramatically reducing seismic loads and protecting your family for generations." />
            )}
            {activeCategory === "assets" && (
              <HeroSection category="assets" modelNode={ffModel}
                bodyText="Hospitals, data centres, and infrastructure that cannot afford interruption. Our isolation systems keep critical operations running through any seismic event." />
            )}
          </div>
        </div>
      </main>

      {/* ── Seismic Shift ── */}
      <section className="w-full bg-slate-50 py-8 md:py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">The Seismic Shift.</h2>
          <div className="md:grid md:grid-cols-2 md:gap-8 lg:gap-10 space-y-4 md:space-y-0">

            {/* Stats card with fixed responsive heights */}
            <div className="bg-white px-6 py-4 md:px-8 md:py-5 lg:px-10 lg:py-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[220px] md:h-[240px] lg:h-[280px]">
              {/* Case study label - vertically centered */}
              <div className="flex-1 flex items-center pb-3 md:pb-4">
                <span className="text-blue-800 font-black text-xs md:text-xs lg:text-sm tracking-[0.12em] md:tracking-[0.15em] uppercase">{stats.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:gap-x-8 md:gap-y-4 lg:gap-y-6 lg:gap-x-12 pt-3 md:pt-4 lg:pt-5 border-t border-slate-100">
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{stats.devices}</div>
                  <div className="text-slate-400 font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest">Devices</div>
                </div>
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{stats.budget}</div>
                  <div className="text-blue-800 font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest">% of Building Budget</div>
                </div>
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{stats.strength}</div>
                  <div className="text-slate-400 font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest">Design Strength</div>
                </div>
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{stats.drift}</div>
                  <div className="text-blue-800 font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest">Drift Tolerance</div>
                </div>
              </div>
            </div>

            {/* Image with matching fixed heights */}
            <div className="rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-sm h-[220px] md:h-[240px] lg:h-[280px]">
              <img src={image} className="w-full h-full object-cover" style={{ display: 'block' }} alt="Case study" loading="lazy" />
            </div>

          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{
        background: [
          "radial-gradient(ellipse 180% 40% at 50% 42%, rgba(230,234,236,0.20) 0%, rgba(200,204,207,0.14) 16%, rgba(120,122,124,0.07) 32%, rgba(0,0,0,0) 60%)",
          "radial-gradient(circle at 50% 70%, rgba(43,43,43,0.12) 0%, rgba(23,23,23,0.08) 40%, rgba(15,15,15,0.04) 75%, rgba(15,15,15,0) 100%)",
          "linear-gradient(to bottom, #f8fafc, #f1f5f9)"
        ].join(', ')
      }} className="w-full py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">How it works.</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
            {howCards.map(card => <HowItWorksCard key={card.step} {...card} />)}
          </div>
        </div>
      </section>

      {/* ── Our Mission ── */}
      <section id="our-mission" className="w-full bg-slate-50 py-12 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">Our Mission.</h2>

          {/* Desktop layout */}
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
            <div className="relative h-[640px] w-full">
              {/* Vimeo video — top left, inline playing */}
              <OurMissionVideo vimeoId="1121378324" />
              {/* Founders photo — bottom right, +15% height (h-64=256px → ~295px) */}
              <div className="absolute bottom-0 right-0 w-[72%] rounded-3xl border border-slate-200 overflow-hidden shadow-lg z-20" style={{ height: '295px' }}>
                <img src="./founderswebsite.jpeg" className="w-full h-full object-cover" alt="Founders" loading="lazy" />
              </div>
            </div>
            <div className="text-slate-600 leading-relaxed text-base space-y-5">
              <p>When a devastating series of earthquakes struck Christchurch, New Zealand in 2011, Ben Exton was a student and Geoff Banks was a practicing structural engineer. Ben was one of thousands of students who volunteered to help shovel liquefaction and support the affected residents of Christchurch — an experience which helped inspire him into the structural engineering field. Geoff found himself inspecting homes for safety and then supporting families and insurers in resolving protracted insurance claims.</p>
              <p>Through these personal experiences, the founders of Seismic Shift have witnessed first-hand the human cost of earthquake damaged buildings. They have seen how damage to these important structures impacts people's financial, physical and mental wellbeing and creates enormous waste and climate emissions.</p>
              <p className="text-slate-900 font-black text-lg tracking-tight leading-snug border-l-4 border-blue-800 pl-5 py-1">Engineering standards are primarily designed to save lives. But what if we could do even better?</p>
              <p>What if we could build more resilient buildings that would suffer less damage and protect people from the trauma and financial costs of rebuilding — and would spare the planet the waste and carbon emissions?</p>
              <p><strong className="text-slate-900 font-bold">This is our mission at Seismic Shift</strong> — to deliver affordable resilience to earthquake-prone communities around the world.</p>
              <p className="text-slate-400 text-sm italic pt-2">Ben, Geoff & team are supported by a group of expert advisors, researchers and specialists.</p>
            </div>
          </div>

          {/* Mobile/tablet layout — earthquake top, founders float bottom-right within text */}
          <div className="lg:hidden text-slate-600 leading-relaxed text-sm md:text-base space-y-4">
            {/* Vimeo video — full width at top */}
            <OurMissionVideoMobile vimeoId="1121378324" />
            <p>When a devastating series of earthquakes struck Christchurch, New Zealand in 2011, Ben Exton was a student and Geoff Banks was a practicing structural engineer. Ben was one of thousands of students who volunteered to help shovel liquefaction and support the affected residents — an experience which inspired him into structural engineering. Geoff found himself inspecting homes and supporting families through protracted insurance claims.</p>
            <p>Through these personal experiences, the founders have witnessed first-hand the human cost of earthquake damaged buildings — the financial, physical and mental toll, and the enormous waste and carbon emissions that follow.</p>
            <p className="text-slate-900 font-black text-base tracking-tight leading-snug border-l-4 border-blue-800 pl-4 py-1">Engineering standards are primarily designed to save lives. But what if we could do even better?</p>
            <p>What if we could build more resilient buildings that suffer less damage — protecting people from the trauma and financial costs of rebuilding, and sparing the planet the waste and carbon emissions?</p>
            <p><strong className="text-slate-900 font-bold">This is our mission at Seismic Shift</strong> — to deliver affordable resilience to earthquake-prone communities around the world.</p>
            {/* Founders photo — floated right, flush with right margin, below the last paragraph */}
            <div style={{ float: 'right', width: '42%', marginLeft: '12px', marginBottom: '4px' }}
              className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
              <img src="./founderswebsite.jpeg" className="w-full object-cover" style={{ display: 'block', aspectRatio: '1/1' }} alt="Founders" loading="lazy" />
            </div>
            <p className="text-slate-400 text-xs italic pt-1">Ben, Geoff & team are supported by a group of expert advisors, researchers and specialists.</p>
            <div style={{ clear: 'both' }} />
          </div>

        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center opacity-50 grayscale">
          <img src={logo} alt="Seismic Shift Logo" className="h-12 w-auto" />
          <p className="font-bold text-xs md:text-base mt-4 md:mt-0">© 2026 SEISMIC SHIFT LTD. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  )
}

export default App