import { useState } from 'react'
import { mapsRouteUrls } from '../../lib/mapsRoute'
import { WALK } from './theme'
import regularFontUrl from '../../assets/fonts/NotoSans-Regular.ttf?url'
import boldFontUrl from '../../assets/fonts/NotoSans-Bold.ttf?url'

const primary = 'px-4 py-2.5 rounded-lg font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60'

// The two outputs of a planned route: the whole walk in Google Maps for
// directions (and automatic rerouting if people wander), and a PDF of every
// stop's story to read while walking, so nobody has to juggle the website and
// a map app at once.
export default function RouteActions({ orderedPoints, stops, legs, startName, loop, totalMeters }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const urls = mapsRouteUrls(orderedPoints, loop)

  const makePack = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const { downloadInfoPack } = await import('../../lib/infoPackPdf')
      await downloadInfoPack({
        stops,
        legs,
        startName,
        loop,
        totalMeters,
        fontUrls: { regular: regularFontUrl, bold: boldFontUrl },
      })
      window.gtag?.('event', 'info_pack_downloaded', { count: stops.length })
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5 print:hidden">
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={primary}
            style={{ backgroundColor: WALK.maroon }}
            onClick={() => window.gtag?.('event', 'full_route_opened')}
          >
            {urls.length > 1 ? `Google Maps route, part ${i + 1} of ${urls.length}` : 'Google Maps route'}
          </a>
        ))}
        <button type="button" onClick={makePack} disabled={busy} className={primary} style={{ backgroundColor: WALK.ink }}>
          {busy ? 'Making your PDF...' : 'Info pack (PDF)'}
        </button>
      </div>
      {urls.length > 1 && (
        <p className="text-xs text-slate-500 mt-2">Google Maps takes about 10 stops at a time, so a long walk opens in parts. Start with part 1.</p>
      )}
      {failed && <p className="text-xs mt-2" style={{ color: WALK.red }}>Sorry, the PDF could not be made. Check your connection and try again.</p>}
    </div>
  )
}
