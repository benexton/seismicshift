import React, { useState, useRef, useEffect } from 'react'

/**
 * Props: title, img, body, containImage (bool)
 * Hover reveals body text; on mobile activates when card is centred in viewport.
 */
export default function ImageCard({ title, img, body, containImage = false }) {
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
    requestAnimationFrame(check)
    window.addEventListener('scroll', check, { passive: true })
    return () => window.removeEventListener('scroll', check)
  }, [])

  return (
    <div
      ref={cardRef}
      className={`rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative h-[220px] lg:h-[280px]${containImage ? ' bg-[#b0b4b8]' : ''}`}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {containImage ? (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <img
            src={img} alt={title}
            className="max-w-full max-h-full object-contain transition-all duration-500"
            style={{
              filter: active ? 'blur(3px) brightness(0.4)' : 'brightness(1)',
              transform: active ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        </div>
      ) : (
        <img
          src={img} alt={title}
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
          style={{
            objectPosition: 'center',
            filter: active ? 'blur(3px) brightness(0.4)' : 'brightness(1)',
            transform: active ? 'scale(1.05)' : 'scale(1)',
          }}
        />
      )}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-500"
        style={{
          background: active
            ? 'rgba(23, 99, 143, 0.85)'
            : containImage ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.45)',
        }}
      />
      <div className="absolute inset-0 flex flex-col justify-start p-6 z-10">
        <h3 className="text-white font-black text-sm lg:text-lg tracking-tight leading-snug drop-shadow-md">{title}</h3>
        <p
          className="text-white/95 text-[13px] lg:text-base leading-relaxed mt-2 transition-all duration-500 drop-shadow-sm"
          style={{ opacity: active ? 1 : 0, transform: active ? 'translateY(0)' : 'translateY(-6px)' }}
        >
          {body}
        </p>
      </div>
    </div>
  )
}
