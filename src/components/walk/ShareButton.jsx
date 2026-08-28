import { useState } from 'react'
import { shareUrl } from '../../lib/share'

export default function ShareButton({ ids, startId, loop }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = shareUrl({ ids, startId, loop })
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Seismic Walk route', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // user cancelled the share sheet, or clipboard write failed - no-op
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="px-4 py-2 rounded-full border-2 border-slate-300 font-bold text-xs tracking-wide text-slate-600 hover:border-slate-400 transition-colors"
    >
      {copied ? 'Link copied!' : 'Share route'}
    </button>
  )
}
