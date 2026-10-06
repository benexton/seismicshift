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
      className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-xs text-slate-700 hover:border-slate-500 transition-colors"
    >
      {copied ? 'Link copied!' : 'Share route'}
    </button>
  )
}
