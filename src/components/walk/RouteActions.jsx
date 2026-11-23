import { useState } from 'react'
import { mapsRouteUrls, openMapsLink, isIosStandalone } from '../../lib/mapsRoute'
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
  // A finished PDF waiting for a second tap (installed iPhone app only - see below).
  const [ready, setReady] = useState(null)
  const urls = mapsRouteUrls(orderedPoints, loop)

  /* The PDF opens in a new tab, so the walk stays where it was. The tab has to
     be opened during the tap itself (browsers block pop-ups opened later), so
     it shows "Making your info pack..." until the PDF is ready. Two exceptions:
     - Android browsers don't show PDFs in a tab, so it downloads there, which
       doesn't replace the page either.
     - In the installed iPhone app a new tab can't reach the PDF, so the button
       becomes "Open your info pack", which brings up the share sheet (Books,
       Files, Save to Files...). The share sheet needs its own tap. */
  const makePack = async () => {
    setBusy(true)
    setFailed(false)
    setReady(null)
    const iosApp = isIosStandalone()
    const android = /Android/i.test(navigator.userAgent)
    const tab = !iosApp && !android ? window.open('', '_blank') : null
    if (tab) {
      try {
        tab.document.title = 'Seismic Walk info pack'
        tab.document.body.innerHTML = '<p style="font:16px/1.5 system-ui,sans-serif;padding:24px;color:#1c1517">Making your info pack...</p>'
      } catch { /* the tab still works without the message */ }
    }
    try {
      const { buildInfoPackPdf, downloadPdf } = await import('../../lib/infoPackPdf')
      const bytes = await buildInfoPackPdf({
        stops,
        legs,
        startName,
        loop,
        totalMeters,
        fontUrls: { regular: regularFontUrl, bold: boldFontUrl },
      })
      const blob = new Blob([bytes], { type: 'application/pdf' })
      if (tab && !tab.closed) {
        const url = URL.createObjectURL(blob)
        tab.location.href = url
        setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000)
      } else if (iosApp) {
        setReady(new File([blob], 'seismic-walk-info-pack.pdf', { type: 'application/pdf' }))
      } else {
        downloadPdf(blob)
      }
      window.gtag?.('event', 'info_pack_downloaded', { count: stops.length })
    } catch {
      if (tab && !tab.closed) tab.close()
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const openReady = async () => {
    if (navigator.canShare?.({ files: [ready] })) {
      try { await navigator.share({ files: [ready], title: 'Seismic Walk info pack' }) } catch { /* closed the sheet */ }
    } else {
      window.open(URL.createObjectURL(ready), '_blank')
    }
  }

  return (
    <div className="mb-5 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {urls.length === 1 ? (
          <a
            href={urls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className={primary}
            style={{ backgroundColor: WALK.maroon }}
            onClick={(e) => { window.gtag?.('event', 'full_route_opened', { parts: 1 }); openMapsLink(e, urls[0]) }}
          >
            Google Maps route
          </a>
        ) : (
          <div className="inline-flex items-center gap-1.5">
            <span className="text-sm font-bold text-slate-800 mr-1">Google Maps:</span>
            {urls.map((url, i) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={primary}
                style={{ backgroundColor: WALK.maroon }}
                aria-label={`Google Maps route, part ${i + 1} of ${urls.length}`}
                onClick={(e) => { window.gtag?.('event', 'full_route_opened', { parts: urls.length, part: i + 1 }); openMapsLink(e, url) }}
              >
                Part {i + 1}
              </a>
            ))}
          </div>
        )}
        {ready ? (
          <button type="button" onClick={openReady} className={primary} style={{ backgroundColor: WALK.ink }}>
            Open your info pack
          </button>
        ) : (
          <button type="button" onClick={makePack} disabled={busy} className={primary} style={{ backgroundColor: WALK.ink }}>
            {busy ? 'Making your PDF...' : 'Info pack (PDF)'}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">
        <span className="font-semibold text-slate-700">On a phone, install the Google Maps app first.</span>{' '}
        Opened in a phone browser instead, Google Maps may not show every stop.
        {urls.length > 1 && ` Google takes about 10 stops per link, so this walk is split into ${urls.length} parts: open part 1, then the next part when you reach its last stop.`}
      </p>
      {failed && <p className="text-xs mt-2" style={{ color: WALK.red }}>Sorry, the PDF could not be made. Check your connection and try again.</p>}
    </div>
  )
}
