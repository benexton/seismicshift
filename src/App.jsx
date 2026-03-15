import React, { Suspense, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Stage } from '@react-three/drei'
import logo from './assets/Transparent Logo.png'

const BRAND = '#17638f'
const BRAND_DARK = '#17638f'
const BRAND_TINT = '#eef1f3'

function Model({ src = './QDUntitled37_compressed_v2.glb', rotation = [Math.PI / 2, 0, 0], scale = [1.5, 1.5, 1.5], mouse }) {
  const { scene } = useGLTF(src)
  const groupRef = useRef()

  useFrame(() => {
    if (!groupRef.current) return
    const targetX = mouse?.current ? mouse.current.y * 0.25 : 0
    const targetZ = mouse?.current ? mouse.current.x * 0.25 : 0
    groupRef.current.rotation.x += (rotation[0] + targetX - groupRef.current.rotation.x) * 0.06
    groupRef.current.rotation.z += (rotation[2] + targetZ - groupRef.current.rotation.z) * 0.06
  })

  return (
    <group ref={groupRef} rotation={rotation} scale={scale}>
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
    <span className="inline-block" style={{
      color: BRAND,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(8px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
    }}>
      {words[index]}
    </span>
  )
}

function HeroPills({ category, onContact }) {
  const installFile =
    category === "infrastructure" ? "./Quake Defender Retrofit Guide.pdf" :
    category === "residential"    ? "./FrontFoot House Installation Guide.pdf" :
    "./FrontFoot Plinth Installation Guide.pdf"
  const [hover2, setHover2] = useState(false)

  return (
    <div>
      <div className="flex gap-3 mt-10 mb-2 flex-wrap">
        <a href={installFile} download={installFile.split('/').pop()}
          onMouseEnter={() => setHover2(true)} onMouseLeave={() => setHover2(false)}
          className="px-5 py-2 rounded-full border-2 font-bold text-xs tracking-wide transition-all duration-200"
          style={{ borderColor: BRAND, color: BRAND, backgroundColor: hover2 ? BRAND_TINT : 'white' }}>
          Installation Instructions
        </a>
      </div>
      <p className="mt-4 text-xs text-slate-400 leading-relaxed">
        Design Guide coming soon —{' '}
        <button onClick={onContact} className="underline hover:text-slate-600 transition-colors">contact us</button>
        {' '}for design support.
      </p>
    </div>
  )
}

const infrastructureStats = {
  label:  "Design study: Canterbury Solar Panel Installation on Existing Building",
  stat1:  "4",      label1: "Quake Defender® devices",
  stat2:  "10t",    label2: "Additional weight added to structure",
  stat3:  ">50%",   label3: "Seismic force reduction target",
  stat4:  "±50mm",  label4: "System movement",
}

const residentialStats = {
  label:  "Case study: Central Otago Home",
  stat1:  "23",         label1: "FrontFoot® devices",
  stat2:  "1.5-2.0%",  label2: "Addition to build cost",
  stat3:  "238m²",      label3: "Floor area",
  stat4:  "±20mm",      label4: "System movement",
}

const assetsStats = {
  label:  "Design study: Canterbury IT Equipment Plinth",
  stat1:  "4",      label1: "FrontFoot® devices",
  stat2:  "8m²",    label2: "Plinth footprint",
  stat3:  "140mm",  label3: "Plinth thickness",
  stat4:  "±20mm",  label4: "System movement",
}

const categoryImages = {
  infrastructure: "./rolleston.jpg",
  residential:    "./pisa1website.jpg",
  assets:         "./ffinstall.jpg",
}

const howItWorksCards = {
  infrastructure: [
    { step: "01", title: "Standardisation & affordability", img: "./testingflag.png",  body: "Seismic Shift technologies focus on performance, affordability, and buildability through the use of standardised sizes of all products. This speeds up the design process, reduces cost, and improves reliability. They are straighforward to design and install." },
    { step: "02", title: "Connected to seismic bracing",   img: "./clean5.png",        body: "Quake Defender® connects directly into a building's bracing system, adding energy absorption ability at the points where it matters most. The devices act like the shock absorbers in a car, reducing the forces acting on a building during an earthquake." },
    { step: "03", title: "Retrofit example",               img: null, vimeo: "https://vimeo.com/1167209639", body: "When the ground shakes, the devices absorb and dissipate seismic energy before it reaches the structure, dramatically reducing damage.", translate: "translate(-45%, -50%)" },
  ],
  residential: [
    { step: "01", title: "Standardisation & affordability", img: "./testingflag.png",  body: "Seismic Shift technologies focus on performance, affordability, and buildability through the use of standardised sizes of all products. This speeds up the design process, reduces cost, and improves reliability. They are straighforward to design and install." },
    { step: "02", title: "Installed at foundation level",  img: "./pisa2website.jpg", body: "Devices are installed between the foundation and the structure so the building moves independently from the ground during an earthquake. When the ground shakes, the devices absorb and dissipate seismic energy before it reaches your home, dramatically reducing damage." },
    { step: "03", title: "See it in action",               img: null, vimeo: "https://vimeo.com/1165542787", body: "When the ground shakes, the devices absorb and dissipate seismic energy before it reaches your home, dramatically reducing damage.", translate: "translate(-50%, -50%)" },
  ],
  assets: [
    { step: "01", title: "Standardisation & affordability", img: "./testingflag.png",  body: "Seismic Shift technologies focus on performance, affordability, and buildability through the use of standardised sizes of all products. This speeds up the design process, reduces cost, and improves reliability. They are straighforward to design and install." },
    { step: "02", title: "Installed in a resilient plinth", img: "./Plinth.png",       body: "Devices are installed within a shock-absorbing plinth that isolates critical equipment from ground motion during a seismic event. When the ground shakes, the devices absorb and dissipate seismic energy before it reaches the facility, keeping critical operations running." },
    { step: "03", title: "See it in action",                img: null, vimeo: "https://vimeo.com/1165542787", body: "When the ground shakes, the devices absorb and dissipate seismic energy before it reaches the facility, keeping critical operations running." },
  ],
}

const qdHelperCards = [
  { title: "Better new builds at lower cost",       img: "./qdhelp1.png", body: "Quake Defender® enables the construction of higher-performance structures at lower construction cost." },
  { title: "Adding weight to existing buildings",   img: "./qdhelp2.png", body: "Solar panels and other additions impact on the seismic performance of a structure. Quake Defender® enables these impacts to be dealt with in an affordable manner." },
  { title: "Strengthening existing buildings",      img: "./qdhelp3.png", body: "Quake Defender® can be used to strengthen certain aspects of existing buildings in an affordable manner, when compared to traditional methods." },
]

function ImageCard({ title, img, body }) {
  const [active, setActive] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    if (window.innerWidth >= 1024) return
    const check = () => {
      if (!cardRef.current) return
      const vh = window.innerHeight
      const rect = cardRef.current.getBoundingClientRect()
      const cardCenter = (rect.top + rect.bottom) / 2
      setActive(cardCenter > vh / 3 && cardCenter < (vh * 2) / 3)
    }
    const raf = requestAnimationFrame(check)
    window.addEventListener('scroll', check, { passive: true })
    document.addEventListener('scroll', check, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', check)
      document.removeEventListener('scroll', check)
    }
  }, [])

  return (
    <div ref={cardRef}
      className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative h-[220px] lg:h-[280px]"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}>
      <img src={img} alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
        style={{ filter: active ? 'blur(4px) brightness(0.25)' : 'brightness(0.55)' }} />
      <div className="absolute inset-0 flex flex-col justify-start p-6">
        <h3 className="text-white font-black text-sm lg:text-lg tracking-tight leading-snug">{title}</h3>
        <p className="text-slate-200 text-[13px] lg:text-base leading-relaxed mt-2 transition-all duration-500"
          style={{ opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(-6px)' }}>
          {body}
        </p>
      </div>
    </div>
  )
}

function VideoCard({ title, vimeo, translate }) {
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
    const raf = requestAnimationFrame(check)
    window.addEventListener('scroll', check, { passive: true })
    document.addEventListener('scroll', check, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', check)
      document.removeEventListener('scroll', check)
    }
  }, [])

  return (
    <div ref={cardRef}
      className="rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative h-[220px] lg:h-[280px]"
      onMouseEnter={() => setActive(true)}>
      {playing && vimeoId ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe ref={iframeRef}
            src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0&api=1`}
            className="absolute top-1/2 left-1/2"
            style={{ border: 0, width: '158%', height: '158%', transform: videoTransform }}
            allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title={title} />
        </div>
      ) : (
        <>
          <img src={`https://vumbnail.com/${vimeoId}.jpg`} alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
            style={{ filter: active ? 'brightness(0.15)' : 'brightness(0.55)' }} />
          <div className="absolute inset-0 flex flex-col justify-start p-6 transition-all duration-500"
            style={{ opacity: active ? 0 : 1 }}>
            <h3 className="text-white font-black text-sm lg:text-lg tracking-tight leading-snug">{title}</h3>
          </div>
          <div className="absolute inset-0 flex items-center justify-center transition-all duration-500"
            style={{ opacity: active ? 1 : 0 }}>
            <button onClick={e => { e.stopPropagation(); setPlaying(true) }}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-white font-bold text-sm tracking-wide shadow-xl transition-all"
              style={{ color: BRAND }}>
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

function HowItWorksCard(props) {
  if (props.vimeo) return <VideoCard {...props} />
  return <ImageCard {...props} />
}

function OurMissionVideo({ vimeoId }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="absolute top-0 left-0 w-[90%] h-72 bg-slate-900 rounded-3xl border border-slate-200 overflow-hidden shadow-md z-10 group">
      {playing ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0`}
            className="absolute top-1/2 left-1/2"
            style={{ border: 0, width: '158%', height: '158%', transform: 'translate(-45%, -50%)' }}
            allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Seismic Shift Story" />
        </div>
      ) : (
        <>
          <img src={`https://vumbnail.com/${vimeoId}.jpg`} alt="Seismic Shift Story"
            className="absolute inset-0 w-full h-full object-cover transition-all duration-300 group-hover:brightness-75" loading="lazy" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={() => setPlaying(true)}
              className="w-16 h-16 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105"
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

function OurMissionVideoMobile({ vimeoId }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="w-full mb-4 rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-900 relative" style={{ aspectRatio: '16/9' }}>
      {playing ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <iframe src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&autopause=0`}
            className="absolute top-1/2 left-1/2"
            style={{ border: 0, width: '158%', height: '158%', transform: 'translate(-45%, -50%)' }}
            allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Seismic Shift Story" />
        </div>
      ) : (
        <>
          <img src={`https://vumbnail.com/${vimeoId}.jpg`} alt="Seismic Shift Story"
            className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button onClick={() => setPlaying(true)}
              className="w-12 h-12 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 flex items-center justify-center shadow-xl transition-all duration-300"
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

function LegalModal({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900 bg-opacity-50 backdrop-blur-sm" />
      <div className="relative bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
            aria-label="Close">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-8 py-6 text-sm text-slate-600 leading-relaxed space-y-5">{children}</div>
      </div>
    </div>
  )
}

function FinePrintModal({ onClose }) {
  return (
    <LegalModal title="The Fine Print" onClose={onClose}>
      <p>Thank you for your business and your support. Please take time to read these Terms and Conditions ("Terms") to understand our contractual relationship relating to your use of our website. References in the Terms to "us", "we" or "our" are references to Seismic Shift Ltd, its directors and its employees.</p>
      <div>
        <h3 className="font-black text-slate-900 mb-2">Acceptance of Terms</h3>
        <p>These Terms govern your use of our website at www.seismicshift.nz. Our website is made available to you subject to these Terms and by using our website, you acknowledge that you have read, understood and accepted these Terms, and agree to be bound by and abide by the Terms. Where your access and use is on behalf of another person or company, you warrant that you are authorised to agree to these Terms on behalf of such person or company and that by agreeing to these Terms on their or its behalf, that person or company is bound by these Terms. We may amend these Terms in whole or in part from time to time at our complete discretion and without notice. Any amendments to these Terms will be effective immediately when posted on our website. Accordingly, we recommend you check these Terms periodically for any changes. You acknowledge that your continued use of our website after any of the Terms have been amended indicates your acceptance of those changes.</p>
      </div>
      <div>
        <h3 className="font-black text-slate-900 mb-2">Website Content</h3>
        <p>While we will endeavour to ensure the completeness and accuracy of the information we provide on our website, you acknowledge that all such information (including in relation to the descriptions and pricing of our goods) is provided "as is" and "as available" and without any warranties of any kind either express or implied. In addition, we accept no responsibility to you or any other person for inaccurate or incorrect information and we reserve the right to change information at any time without notice. We do not warrant that our website or the server are free of viruses or other harmful components and we shall not be responsible or liable for any error in, or omission from, the information we have provided on our website except as required by law.</p>
      </div>
      <div>
        <h3 className="font-black text-slate-900 mb-2">Use of the Website</h3>
        <p>You agree not to use our website for any unlawful purpose or any other use prohibited by these Terms. Purchases from our online shop may only be made by the person or company acquiring the goods or services for their or its own use or consumption, and you are prohibited from acquiring goods from us via our website for the purposes of resupply (whether in trade or otherwise) – for the avoidance of doubt this does not prevent the goods being incorporated into, and sold as part of, a larger design. You agree that you will not interfere with any other third party's use and enjoyment of our website, or damage the operation of our website, or our systems or those of other persons who use our website, whether such interference or damage is by way of a virus, corrupted file, any other software or program, or otherwise. We reserve the right to suspend your use of our website where we consider that you may have breached these Terms or any applicable law, or are likely to do so.</p>
      </div>
      <div>
        <h3 className="font-black text-slate-900 mb-2">Intellectual Property Rights</h3>
        <p>All right, title and interest in all intellectual property rights relating to our website and its content (including the domain name, any software code underlying the website, the design, graphical content and any trademarks) is owned by, and shall at all times remain the exclusive property of, us, our licensors and the providers of goods accessible on our website. You acknowledge that our intellectual property rights are protected by New Zealand and international law, and that you will not copy any intellectual property (other than as necessary to browse the website) or deal with any intellectual property except as permitted by these Terms. Nothing in these Terms shall constitute any licence to you of any intellectual property rights. You may download and temporarily store one or more of these pages for the sole purpose of viewing on a personal computer or mobile device via a web browser and to print pages for your own personal use. Otherwise you must not copy, display, modify, reproduce, store in a retrieval system, transmit (in any form or by any means), distribute, use for creating derivative works or use in any other way for commercial or public purposes any part of this website without our prior written consent. Please let us know if you believe there has been an infringement of our rights by reporting the use to <a href="mailto:info@seismicshift.nz" className="underline" style={{ color: BRAND }}>info@seismicshift.nz</a>.</p>
      </div>
      <div>
        <h3 className="font-black text-slate-900 mb-2">Governing Law and Jurisdiction</h3>
        <p>Unless we otherwise agree in writing, this agreement contains all the Terms of our relationship and continues to apply regardless of your country of residence or the location at the time any goods are purchased and provided to you by us. Use of our website, supply of our goods to you and any other matters arising from these Terms are governed by and are to be interpreted in accordance with New Zealand law. Accordingly, the Courts of New Zealand shall have non-exclusive jurisdiction over all claims or disputes arising in relation to, out of or in connection with these Terms, or with the use of our website. We may recover any costs incurred by us due to the supply of incorrect information by you (including but not limited to legal costs on a solicitor-client basis). Notwithstanding the above, you also agree to use our website in accordance with the applicable laws of the country or countries where your business is based. If any of these Terms are found to be invalid, unenforceable or illegal, the remaining provisions will continue in full force and effect.</p>
      </div>
    </LegalModal>
  )
}

function PrivacyModal({ onClose }) {
  return (
    <LegalModal title="Privacy Policy" onClose={onClose}>
      <p>Your privacy is important to us.</p>
      <p>This Privacy Policy outlines the online information practices we employ in relation to the information you provide when using this site. By visiting www.seismicshift.nz you are accepting and consenting to the practices outlined in this Privacy Policy.</p>
      <p>For us to be able to process and fulfil your requests, you acknowledge that we may share your contact information with our staff and professional advisors. No information relating to you will be sold or otherwise divulged to any other third parties without your prior consent, except when required by law.</p>
      <p>You may request a copy of the personal information that we hold about you, and make any corrections, at any time by emailing us at <a href="mailto:info@seismicshift.nz" className="underline" style={{ color: BRAND }}>info@seismicshift.nz</a>.</p>
      <p>Unless you opt to receive messages from us via email, we will only send you messages relating to your specific requests. If you have opted to receive ongoing communications from us, you may at any time opt out by contacting us by email or by following the unsubscribe instructions detailed at the bottom of emails sent to you.</p>
      <p>You are required to permit us to place data files ("cookies") on your computer to enable you to use some features of our website. Where you choose not to enable cookies from our website, you acknowledge that some functionalities may be unavailable to you.</p>
      <p>While we will use all reasonable endeavours to secure the website, we make no guarantees as to our website's security, and we will not be held responsible for any breach of our website security that is beyond our reasonable control.</p>
    </LegalModal>
  )
}

function ContactPage({ onBack }) {
  const [status, setStatus] = useState('idle')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    const form = e.target
    const data = new FormData(form)
    try {
      const response = await fetch('https://formspree.io/f/mjgepzqa', {
        method: 'POST', body: data, headers: { 'Accept': 'application/json' }
      })
      if (response.ok) { setStatus('success'); form.reset() }
      else { setStatus('error'); setTimeout(() => setStatus('idle'), 5000) }
    } catch { setStatus('error'); setTimeout(() => setStatus('idle'), 5000) }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900" style={{ minHeight: "100dvh" }}>
      <nav className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-8 md:px-16 w-full flex items-center justify-between py-3">
          <button onClick={onBack}><img src={logo} alt="Seismic Shift Logo" className="h-9 w-auto object-contain" /></button>
          <button onClick={onBack} className="text-sm font-bold tracking-widest text-slate-500 transition"
            onMouseEnter={e => e.target.style.color = BRAND} onMouseLeave={e => e.target.style.color = ''}>← Back</button>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-8 md:px-16 py-8 md:py-12">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">We'd love to speak with you.</h1>
        <div className="grid lg:grid-cols-2 gap-16 items-stretch">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Name</label>
              <input type="text" name="name" required
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base transition"
                onFocus={e => e.target.style.borderColor = BRAND} onBlur={e => e.target.style.borderColor = ''}
                placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Phone</label>
              <input type="tel" name="phone"
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base transition"
                onFocus={e => e.target.style.borderColor = BRAND} onBlur={e => e.target.style.borderColor = ''}
                placeholder="+64 21 000 0000" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email</label>
              <input type="email" name="email" required
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base transition"
                onFocus={e => e.target.style.borderColor = BRAND} onBlur={e => e.target.style.borderColor = ''}
                placeholder="you@example.com" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Message</label>
              <textarea rows={6} name="message" required
                className="w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base transition resize-none"
                onFocus={e => e.target.style.borderColor = BRAND} onBlur={e => e.target.style.borderColor = ''}
                placeholder="Tell us about your project..." />
            </div>
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
            {status !== 'success' && (
              <div>
                <button type="submit" disabled={status === 'submitting'}
                  className="px-8 py-3 rounded-full border-2 bg-white font-bold text-xs tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ borderColor: BRAND, color: BRAND }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = BRAND_TINT}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}>
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

function ModelHint() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fadeTimer = setTimeout(() => {
      el.style.transition = 'opacity 1s ease'
      el.style.opacity = '0'
    }, 5000)
    const hideTimer = setTimeout(() => {
      el.style.visibility = 'hidden'
    }, 6100)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])
  return (
    <div className="hidden md:block">
      <style>{`
        @keyframes hintPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
      <div ref={ref} style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        marginTop: '8px', height: '28px', pointerEvents: 'none', willChange: 'opacity',
      }}>
        <div style={{
          borderRadius: '999px', padding: '5px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          color: '#64748b', fontSize: '13px', fontWeight: 600, letterSpacing: '0.08em',
          animation: 'hintPulse 1.6s ease-in-out infinite', transformOrigin: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18"/>
          </svg>
          drag to rotate
        </div>
      </div>
    </div>
  )
}

function HeroSection({ category, modelNode, bodyText, onContact }) {
  return (
    <>
      <div className="hidden md:grid md:grid-cols-2 md:gap-8 md:items-start mb-12">
        <div className="pt-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tighter text-slate-900 mb-6">
            {category === "infrastructure" && <>A shock-absorber for your <RollingWord category="infrastructure" /></>}
            {category === "residential"    && <>A shock-absorber for your <RollingWord category="residential" /></>}
            {category === "assets"         && <>Peace of mind for your <RollingWord category="assets" /></>}
          </h1>
          <p className="text-base md:text-lg lg:text-lg text-slate-500 leading-relaxed max-w-md">{bodyText}</p>
          <HeroPills category={category} onContact={onContact} />
        </div>
        {modelNode}
      </div>
      <div className="md:hidden mb-6 pt-2">
        <h1 className="text-2xl font-black leading-tight tracking-tighter text-slate-900 mb-2">
          {category === "infrastructure" && <>An airbag for your <RollingWord category="infrastructure" /></>}
          {category === "residential"    && <>A shock-absorber for your <RollingWord category="residential" /></>}
          {category === "assets"         && <>Peace of mind for your <RollingWord category="assets" /></>}
        </h1>
        <div style={{ height: '220px', marginBottom: '20px' }}>
          <div style={{ marginTop: '-60px', height: '280px' }}>{modelNode}</div>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed mt-2">{bodyText}</p>
        <HeroPills category={category} onContact={onContact} />
      </div>
    </>
  )
}

function App() {
  const [activeCategory, setActiveCategory] = useState("infrastructure")
  const [showContact, setShowContact] = useState(false)
  const [showFinePrint, setShowFinePrint] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const qdContainerRef = useRef()
  const ffContainerRef = useRef()
  const qdMouse = useRef(null)
  const ffMouse = useRef(null)

  useEffect(() => {
    if (window.location.hash === '#our-mission') {
      setTimeout(() => {
        document.getElementById('our-mission')?.scrollIntoView({ behavior: 'smooth' })
      }, 500)
    }
  }, [])

  const image = categoryImages[activeCategory]
  const howCards = howItWorksCards[activeCategory]
  const activeStats =
    activeCategory === "infrastructure" ? infrastructureStats :
    activeCategory === "residential"    ? residentialStats :
    assetsStats

  if (showContact) return <ContactPage onBack={() => { setShowContact(false); window.scrollTo({ top: 0, behavior: 'instant' }) }} />

  const trackMouse = (mouseRef) => ({
    onMouseMove: (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      }
    },
    onMouseLeave: () => { mouseRef.current = null },
  })

  const qdModel = (
    <div>
      <div ref={qdContainerRef} className="h-72 md:h-80 lg:h-[480px] w-full"
        style={{ position: 'relative', transition: 'transform .22s ease', transformOrigin: 'center bottom' }}
        onPointerEnter={() => qdContainerRef.current && (qdContainerRef.current.style.transform = 'scale(1.06)')}
        onPointerLeave={() => qdContainerRef.current && (qdContainerRef.current.style.transform = 'scale(1)')}
        {...trackMouse(qdMouse)}>
        <Canvas shadows camera={{ position: [2, 0.5, 6], fov: 38 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.6} contactShadow={{ opacity: 0.5, blur: 2 }} center={{ disableY: false }}>
              <Model src="./QDUntitled37_compressed_v2.glb" scale={[1.4, 1.4, 1.4]} rotation={[Math.PI / 2, -0.2, 0]} mouse={qdMouse} />
            </Stage>
          </Suspense>
          <OrbitControls enableZoom={false} autoRotate />
        </Canvas>
      </div>
      <ModelHint />
    </div>
  )

  const ffModel = (
    <div>
      <div ref={ffContainerRef} className="h-72 md:h-80 lg:h-[480px] w-full"
        style={{ position: 'relative', transition: 'transform .22s ease', transformOrigin: 'center bottom' }}
        onPointerEnter={() => ffContainerRef.current && (ffContainerRef.current.style.transform = 'scale(1.06)')}
        onPointerLeave={() => ffContainerRef.current && (ffContainerRef.current.style.transform = 'scale(1)')}
        {...trackMouse(ffMouse)}>
        <Canvas shadows camera={{ position: [0, 1, 6], fov: 38 }}>
          <Suspense fallback={null}>
            <Stage environment="sunset" intensity={0.3} contactShadow={{ opacity: 0.3, blur: 2.5 }} center={{ disableY: false }}>
              <Model src="./bestFF_compressed.glb" scale={[0.8, 0.8, 0.8]} rotation={[0.3, 0, 0]} mouse={ffMouse} />
            </Stage>
          </Suspense>
          <OrbitControls enableZoom={false} autoRotate />
        </Canvas>
      </div>
      <ModelHint />
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900" style={{ minHeight: "100dvh" }}>

      {showFinePrint && <FinePrintModal onClose={() => setShowFinePrint(false)} />}
      {showPrivacy   && <PrivacyModal  onClose={() => setShowPrivacy(false)} />}

      <nav className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 md:px-16 w-full py-3">
          <div className="flex items-center justify-between lg:grid lg:grid-cols-3">
            <div className="flex items-center">
              <img src={logo} alt="Seismic Shift Logo" className="h-9 w-auto object-contain" />
            </div>
            <div className="hidden lg:flex justify-center space-x-1.5 xl:space-x-2 items-center">
              {[
                { label: "Commercial & Industrial", key: "infrastructure" },
                { label: "Homes", key: "residential" },
                { label: "Critical Equipment", key: "assets" },
              ].map(({ label, key }) => (
                <button key={key} onClick={() => { setActiveCategory(key); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="px-2.5 xl:px-3 py-1.5 rounded-full border-2 font-bold text-[11px] xl:text-xs tracking-wide transition-all duration-200 whitespace-nowrap"
                  style={activeCategory === key
                    ? { borderColor: BRAND, backgroundColor: BRAND_TINT, color: BRAND }
                    : { borderColor: '#cbd5e1', backgroundColor: 'white', color: '#475569' }}
                  onMouseEnter={e => { if (activeCategory !== key) { e.currentTarget.style.borderColor = BRAND; e.currentTarget.style.color = BRAND } }}
                  onMouseLeave={e => { if (activeCategory !== key) { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569' } }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="hidden lg:flex items-center justify-end">
              <a href="#our-mission"
                className="text-xs xl:text-sm font-bold tracking-widest text-slate-900 transition mr-3 xl:mr-5"
                onMouseEnter={e => e.target.style.color = BRAND}
                onMouseLeave={e => e.target.style.color = ''}>
                Our Mission
              </a>
              <button onClick={() => { setShowContact(true); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                className="text-white px-4 xl:px-5 py-2 text-[10px] xl:text-xs font-bold tracking-widest rounded-full transition shadow-lg whitespace-nowrap"
                style={{ backgroundColor: BRAND }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = BRAND_DARK}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = BRAND}>
                Contact Us
              </button>
            </div>
            <button className="lg:hidden ml-auto px-4 py-1.5 rounded-full border-2 font-bold text-[11px] tracking-wide transition-all duration-200"
              onClick={() => setMobileMenuOpen(o => !o)} aria-label="Menu" aria-expanded={mobileMenuOpen}
              style={mobileMenuOpen
                ? { borderColor: BRAND, backgroundColor: BRAND_TINT, color: BRAND }
                : { borderColor: '#cbd5e1', backgroundColor: 'white', color: '#475569' }}>
              {mobileMenuOpen ? '✕ Close' : '☰ Choose your solution'}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="lg:hidden pt-4 pb-3 border-t border-slate-100 mt-3 flex flex-col gap-3">
              {[
                { label: "Commercial & Industrial", key: "infrastructure" },
                { label: "Homes", key: "residential" },
                { label: "Critical Equipment", key: "assets" },
              ].map(({ label, key }) => (
                <button key={key} onClick={() => { setActiveCategory(key); setMobileMenuOpen(false) }}
                  className="w-full text-left px-4 py-2 rounded-full border-2 font-bold text-sm transition-all duration-200"
                  style={activeCategory === key
                    ? { borderColor: BRAND, backgroundColor: BRAND_TINT, color: BRAND }
                    : { borderColor: '#e2e8f0', color: '#475569' }}>
                  {label}
                </button>
              ))}
              <a href="#our-mission" onClick={() => setMobileMenuOpen(false)}
                className="text-center px-4 py-2 rounded-full border-[3px] border-slate-600 text-slate-600 font-bold text-sm">
                Our Mission
              </a>
              <button onClick={() => { setShowContact(true); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                className="w-full text-white px-5 py-2 text-sm font-bold tracking-widest rounded-full transition"
                style={{ backgroundColor: BRAND }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = BRAND_DARK}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = BRAND}>
                Contact Us
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="w-full pb-0">
        <div style={{
          background: [
            "radial-gradient(ellipse 180% 40% at 50% 42%, rgba(230,234,236,0.20) 0%, rgba(200,204,207,0.14) 16%, rgba(120,122,124,0.07) 32%, rgba(0,0,0,0) 60%)",
            "radial-gradient(circle at 50% 70%, rgba(43,43,43,0.12) 0%, rgba(23,23,23,0.08) 40%, rgba(15,15,15,0.04) 75%, rgba(15,15,15,0) 100%)"
          ].join(', ')
        }}>
          <div className="max-w-7xl mx-auto px-6 md:px-16 py-6">
            {activeCategory === "infrastructure" && (
              <HeroSection category="infrastructure" modelNode={qdModel} onContact={() => { setShowContact(true); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                bodyText="Quake Defender® delivers affordable seismic enhancement for commercial and industrial structures. Engineered in New Zealand to improve the performance of buildings during shaking anywhere in the world. Our solutions put you in control. They are the proactive choice ahead of future earthquakes - better for lives, livelihoods, and the environment." />
            )}
            {activeCategory === "residential" && (
              <HeroSection category="residential" modelNode={ffModel} onContact={() => { setShowContact(true); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                bodyText="The FrontFoot® foundation system decouples your home from ground motion, dramatically reducing seismic loads and safeguarding your family. Our solutions put you in control. They are the proactive choice ahead of future earthquakes - better for lives, livelihoods, and the environment." />
            )}
            {activeCategory === "assets" && (
              <HeroSection category="assets" modelNode={ffModel} onContact={() => { setShowContact(true); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                bodyText="The FrontFoot® plinth system provides improved performance for key facilities such as hospitals, data centres, and infrastructure that cannot afford interruption. Our solutions put you in control. They are the proactive choice ahead of future earthquakes - better for lives, livelihoods, and the environment." />
            )}
          </div>
        </div>
      </main>

      {activeCategory === "infrastructure" && (
        <section className="w-full bg-slate-50 py-12 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-6 md:px-16">
            <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">How can Quake Defender help you?</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
              {qdHelperCards.map(card => <ImageCard key={card.title} title={card.title} img={card.img} body={card.body} />)}
            </div>
          </div>
        </section>
      )}

      <section className="w-full bg-white py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">How it works.</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-10">
            {howCards.map(card => <HowItWorksCard key={`${activeCategory}-${card.step}`} {...card} />)}
          </div>
        </div>
      </section>

      <section className="w-full bg-slate-50 py-8 md:py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">The Seismic Shift.</h2>
          <div className="md:grid md:grid-cols-2 md:gap-8 lg:gap-10 space-y-4 md:space-y-0">
            <div className="bg-white px-6 py-4 md:px-8 md:py-5 lg:px-10 lg:py-6 rounded-2xl md:rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[220px] md:h-[240px] lg:h-[280px]">
              <div className="flex-1 flex items-center pb-3 md:pb-4">
                <span className="font-black text-xs md:text-xs lg:text-sm tracking-[0.12em] md:tracking-[0.15em] uppercase" style={{ color: BRAND }}>
                  {activeStats.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:gap-x-8 md:gap-y-4 lg:gap-y-6 lg:gap-x-12 pt-3 md:pt-4 lg:pt-5 border-t border-slate-100">
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{activeStats.stat1}</div>
                  <div className="font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest" style={{ color: BRAND }}>{activeStats.label1}</div>
                </div>
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{activeStats.stat2}</div>
                  <div className="font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest" style={{ color: BRAND }}>{activeStats.label2}</div>
                </div>
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{activeStats.stat3}</div>
                  <div className="font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest" style={{ color: BRAND }}>{activeStats.label3}</div>
                </div>
                <div>
                  <div className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900">{activeStats.stat4}</div>
                  <div className="font-bold text-[8px] md:text-[9px] lg:text-[10px] uppercase mt-1 tracking-widest" style={{ color: BRAND }}>{activeStats.label4}</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl md:rounded-3xl border border-slate-200 overflow-hidden shadow-sm h-[220px] md:h-[240px] lg:h-[280px]">
              <img src={image} className="w-full h-full object-cover object-center" style={{ display: 'block' }} alt="Case study" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      <section id="our-mission" className="w-full bg-white py-12 scroll-mt-20 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 mb-8 md:mb-12">Our Mission.</h2>
          <div className="hidden lg:grid lg:grid-cols-2 lg:gap-16 lg:items-start">
            <div className="relative h-[640px] w-full">
              <OurMissionVideo vimeoId="1121378324" />
              <div className="absolute bottom-0 right-0 w-[72%] rounded-3xl border border-slate-200 overflow-hidden shadow-lg z-20" style={{ height: '295px' }}>
                <img src="./founderswebsite.jpeg" className="w-full h-full object-cover" alt="Founders" loading="lazy" />
              </div>
            </div>
            <div className="text-slate-600 leading-relaxed text-base space-y-5">
              <p>When a devastating series of earthquakes struck Christchurch, New Zealand in 2011, Ben Exton was a student and Geoff Banks was a practicing structural engineer. Ben was one of thousands of students who volunteered to help shovel liquefaction and support the affected residents of Christchurch - an experience which helped inspire him into the structural engineering field. Geoff found himself inspecting homes for safety and then supporting families and insurers in resolving protracted insurance claims.</p>
              <p>Through these personal experiences, the founders of Seismic Shift have witnessed first-hand the human cost of earthquake damaged buildings. They have seen how damage to these important structures impacts people's financial, physical and mental wellbeing and creates enormous waste and climate emissions.</p>
              <p className="text-slate-900 font-black text-lg tracking-tight leading-snug pl-5 py-1" style={{ borderLeft: `4px solid ${BRAND}` }}>Engineering standards are primarily designed to save lives. But what if we could do better than that?</p>
              <p>What if we could build more resilient buildings that would suffer less damage and protect people from the trauma and financial costs of rebuilding - and would spare the planet the waste and carbon emissions?</p>
              <p><strong className="text-slate-900 font-bold">This is our mission at Seismic Shift</strong> - to deliver affordable resilience to earthquake-prone communities around the world.</p>
              <p>Ben, Geoff & team are supported by a group of expert advisors, researchers and specialists.</p>
            </div>
          </div>
          <div className="lg:hidden text-slate-600 leading-relaxed text-sm md:text-base space-y-4">
            <OurMissionVideoMobile vimeoId="1121378324" />
            <p>When a devastating series of earthquakes struck Christchurch, New Zealand in 2011, Ben Exton was a student and Geoff Banks was a practicing structural engineer. Ben was one of thousands of students who volunteered to help shovel liquefaction and support the affected residents - an experience which inspired him into structural engineering. Geoff found himself inspecting homes and supporting families through protracted insurance claims.</p>
            <p>Through these personal experiences, the founders have witnessed first-hand the human cost of earthquake damaged buildings - the financial, physical and mental toll, and the enormous waste and carbon emissions that follow.</p>
            <p className="text-slate-900 font-black text-base tracking-tight leading-snug pl-4 py-1" style={{ borderLeft: `4px solid ${BRAND}` }}>Engineering standards are primarily designed to save lives. But what if we could do better than that?</p>
            <p>What if we could build more resilient buildings that suffer less damage - protecting people from the trauma and financial costs of rebuilding, and sparing the planet the waste and carbon emissions?</p>
            <p><strong className="text-slate-900 font-bold">This is our mission at Seismic Shift</strong> - to deliver affordable resilience to earthquake-prone communities around the world.</p>
            <div style={{ float: 'right', width: '42%', marginLeft: '12px', marginBottom: '4px' }}
              className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
              <img src="./founderswebsite.jpeg" className="w-full object-cover" style={{ display: 'block', aspectRatio: '1/1' }} alt="Founders" loading="lazy" />
            </div>
            <p>Ben, Geoff & team are supported by a group of expert advisors, researchers and specialists.</p>
            <div style={{ clear: 'both' }} />
          </div>
          <div className="mt-12 pt-8 border-t border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-widest mb-4" style={{ color: BRAND }}>Intellectual Property</h3>
            <div className="text-xs text-slate-500 leading-relaxed space-y-4">
              <p>Certain Seismic Shift products are protected by one or more claims of patents in the U.S. and elsewhere. This website page is provided to satisfy the virtual patent marking provisions of various jurisdictions, including the virtual patent marking provisions of the America Invents Act (35 U.S.C § 287) in the U.S. for the listed patents that are practiced by one or more of the identified products. The following listing of Seismic Shift products may not be all inclusive and Seismic Shift products not listed here may be protected by one or more patents. In addition, Seismic Shift may be the owner or licensee of additional patents and patent applications that are not listed here. Due to the dynamic nature of the patent process, the content of this list is updated from time to time but may not be up to date at the specific time that you visit this link.</p>
              <div className="space-y-2">
                <p><span className="font-bold text-slate-700">FrontFoot™</span> May be covered by or may be for use under one or more of the following: N.Z. Pat. No. 785618, Patent Pending Application No. PCT/IB2022/051714, WO2022/185174A1.</p>
                <p><span className="font-bold text-slate-700">Quake Defender</span> May be covered by or may be for use under one or more of the following: Australian Patent Pending Application No. 2024904237.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t py-12">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center opacity-50 grayscale">
          <img src={logo} alt="Seismic Shift Logo" className="h-12 w-auto" />
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6 mt-4 md:mt-0">
            <button onClick={() => setShowFinePrint(true)} className="font-bold text-xs md:text-sm hover:opacity-70 transition-opacity">Fine Print</button>
            <span className="hidden md:inline text-slate-300">|</span>
            <button onClick={() => setShowPrivacy(true)} className="font-bold text-xs md:text-sm hover:opacity-70 transition-opacity">Privacy Policy</button>
            <span className="hidden md:inline text-slate-300">|</span>
            <p className="font-bold text-xs md:text-sm">© 2026 Seismic Shift Ltd. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App