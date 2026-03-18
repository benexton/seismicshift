import React, { useState, useEffect } from 'react'

const BRAND = '#17638f'
const BRAND_TINT = '#eef1f3'

export default function ContactForm() {
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (window.turnstile) {
      window.turnstile.render('.cf-turnstile')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    const form = e.target
    const data = new FormData(form)
    try {
      const response = await fetch('https://seismicshift-contact.benexton.workers.dev', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      })
      if (response.ok) {
        setStatus('success')
        form.reset()
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 5000)
      }
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 5000)
    }
  }

  const inputClass = "w-full px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-900 text-base transition outline-none"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Name</label>
        <input
          type="text" name="name" required
          className={inputClass}
          onFocus={e => e.target.style.borderColor = BRAND}
          onBlur={e => e.target.style.borderColor = ''}
          placeholder="Your full name"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Phone</label>
        <input
          type="tel" name="phone"
          className={inputClass}
          onFocus={e => e.target.style.borderColor = BRAND}
          onBlur={e => e.target.style.borderColor = ''}
          placeholder="+64 21 000 0000"
        />
      </div>
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Email</label>
        <input
          type="email" name="email" required
          className={inputClass}
          onFocus={e => e.target.style.borderColor = BRAND}
          onBlur={e => e.target.style.borderColor = ''}
          placeholder="you@example.com"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Message</label>
        <textarea
          rows={6} name="message" required
          className={`${inputClass} resize-none`}
          onFocus={e => e.target.style.borderColor = BRAND}
          onBlur={e => e.target.style.borderColor = ''}
          placeholder="Tell us about your project..."
        />
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
          <div
            className="cf-turnstile"
            data-sitekey="0x4AAAAAACrdGjPLLCYwIrRD"
            data-theme="light"
            style={{ marginBottom: '16px' }}
          />
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="px-8 py-3 rounded-full border-2 bg-white font-bold text-xs tracking-wide transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: BRAND, color: BRAND }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = BRAND_TINT}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'white'}
          >
            {status === 'submitting' ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </form>
  )
}
