// Generates the Seismic Walk "info pack": a PDF of every stop on the planned
// route, in walking order, with its photo, access details and full story, to
// read on the phone while Google Maps handles the directions.
//
// Built in the browser (the site is static, so there is no server to render
// it). pdf-lib and the two Noto Sans font files are loaded only when someone
// taps the button. Noto Sans is embedded because the built-in PDF fonts cannot
// draw macrons (Ōtautahi, Tūranga), which this content is full of.
import { formatDistance, formatDuration, walkMinutes } from './geo'

// A phone-shaped page (9:16), so a phone's PDF viewer shows each page at
// close to full screen width and the text reads at a normal size without
// zooming. On an A4 page the same text came out at a third of the size.
const PAGE = [300, 534]
const MARGIN = 18
const MAROON = [0.396, 0.141, 0.192]
const RED = [0.71, 0.196, 0.196]
const INK = [0.11, 0.082, 0.09]
const GREY = [0.4, 0.4, 0.43]

const ACCESS_LABELS = {
  interior_public: 'Interior open',
  foyer_only: 'Foyer only',
  exterior_only: 'Exterior only',
  by_arrangement: 'By arrangement',
}

async function loadFont(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('font fetch failed')
  return res.arrayBuffer()
}

// Photos are webp; PDF can only embed JPEG/PNG, so redraw through a canvas.
// A photo that fails to load is skipped rather than failing the whole pack.
async function loadImageJpeg(src) {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const maxW = 1000
    const scale = Math.min(1, maxW / bitmap.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob) return null
    return { bytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height }
  } catch {
    return null
  }
}

function clean(text) {
  return String(text ?? '').replace(/\r/g, '').replace(/\t/g, ' ')
}

function wrap(text, font, size, maxWidth) {
  const lines = []
  for (const para of clean(text).split('\n')) {
    let line = ''
    for (let word of para.split(/\s+/).filter(Boolean)) {
      // A single word wider than the column (long URLs) is broken by
      // character so it can't run off the page.
      while (font.widthOfTextAtSize(word, size) > maxWidth) {
        if (line) { lines.push(line); line = '' }
        let n = word.length - 1
        while (n > 1 && font.widthOfTextAtSize(word.slice(0, n), size) > maxWidth) n -= 1
        lines.push(word.slice(0, n))
        word = word.slice(n)
      }
      const test = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test
      } else {
        if (line) lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

// stops: ordered stop objects; legs[i]: { meters } arriving at stops[i] or null.
export async function buildInfoPackPdf({ stops, legs, startName, loop, totalMeters, fontUrls }) {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit').then((m) => m.default ?? m),
  ])
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle('Seismic Walk info pack')
  doc.setAuthor('Seismic Shift')
  const [regularBytes, boldBytes] = await Promise.all([loadFont(fontUrls.regular), loadFont(fontUrls.bold)])
  const regular = await doc.embedFont(regularBytes, { subset: true })
  const bold = await doc.embedFont(boldBytes, { subset: true })
  const images = await Promise.all(stops.map((s) => (s.image ? loadImageJpeg(s.image) : null)))

  const color = (c) => rgb(c[0], c[1], c[2])
  const contentW = PAGE[0] - MARGIN * 2
  let page
  let y

  const newPage = () => {
    page = doc.addPage(PAGE)
    y = PAGE[1] - MARGIN
  }
  const ensure = (h) => {
    if (y - h < MARGIN + 12) newPage()
  }
  const text = (str, { font = regular, size = 10.5, col = INK, gap = 0, width = contentW, lead = 1.42, x = MARGIN } = {}) => {
    const lines = wrap(str, font, size, width)
    for (const line of lines) {
      ensure(size * lead)
      y -= size * lead
      if (line) page.drawText(line, { x, y, size, font, color: color(col) })
    }
    y -= gap
  }

  newPage()
  page.drawRectangle({ x: 0, y: PAGE[1] - 70, width: PAGE[0], height: 70, color: color(MAROON) })
  page.drawText('PCEE 2027', { x: MARGIN, y: PAGE[1] - 24, size: 8, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Seismic Walk info pack', { x: MARGIN, y: PAGE[1] - 50, size: 19, font: bold, color: rgb(1, 1, 1) })
  y = PAGE[1] - 70 - 8
  const summary = `${stops.length} stop${stops.length === 1 ? '' : 's'}`
    + (totalMeters ? `  |  ${formatDistance(totalMeters)}  |  ${formatDuration(walkMinutes(totalMeters))} walking` : '')
  text(summary, { font: bold, size: 11, col: MAROON })
  text(`Starting from ${startName}${loop ? ', returning to the start' : ''}. Walking time only: allow time at each stop.`, { size: 9.5, col: GREY, gap: 5 })
  text('Use Google Maps for directions and this pack to read as you walk. Self-guided, at your own risk: watch for traffic, follow road rules, and respect private property and opening hours.', { size: 9.5, col: GREY, gap: 6 })

  for (let i = 0; i < stops.length; i += 1) {
    const stop = stops[i]
    const image = images[i]
    // Size the photo up front so the heading starts a new page with it
    // rather than being stranded at the bottom of the previous one.
    let imgH = 0
    let imgW = 0
    // Every stop starts on a new page, with its photo across the full width.
    if (image) {
      imgW = contentW
      imgH = Math.min(190, (imgW * image.height) / image.width)
      imgW = (imgH * image.width) / image.height
    }
    if (i > 0) newPage()
    else { ensure(90 + imgH); y -= 6 }

    const leg = legs[i]
    if (leg?.meters != null) {
      text(`${formatDistance(leg.meters)}  |  ${formatDuration(walkMinutes(leg.meters))} walk from ${i === 0 ? startName : stops[i - 1].name}`, { size: 9, col: GREY })
    }
    text(`${i + 1}. ${stop.name}`, { font: bold, size: 16, col: MAROON, lead: 1.25 })
    if (stop.name_mi && !stop.name.includes(stop.name_mi)) text(stop.name_mi, { size: 10, col: GREY })
    if (stop.address) text(stop.address, { size: 10, col: GREY, gap: 4 })

    if (image) {
      const pdfImage = await doc.embedJpg(image.bytes)
      ensure(imgH + 14)
      y -= imgH + 2
      page.drawImage(pdfImage, { x: MARGIN, y, width: imgW, height: imgH })
      y -= 2
      if (stop.image_credit) text(`Photo: ${stop.image_credit}`, { size: 7.5, col: GREY })
      y -= 4
    }

    const badges = [ACCESS_LABELS[stop.access_level], stop.step_free ? 'Step-free' : null].filter(Boolean).join('  |  ')
    if (badges) text(badges, { font: bold, size: 9.5, col: RED })
    if (stop.access_notes) text(stop.access_notes, { size: 9.5, col: GREY, gap: 4 })

    const story = (stop.story || stop.summary || '').split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean)
    story.forEach((para) => text(para, { size: 10.5, gap: 5 }))

    const facts = [
      stop.year_built && `Built: ${stop.year_built}`,
      stop.year_retrofit && `Retrofit / restored: ${stop.year_retrofit}`,
      stop.engineer && `Engineer: ${stop.engineer}`,
      stop.architect && `Architect: ${stop.architect}`,
      stop.storeys && `Storeys: ${stop.storeys}`,
    ].filter(Boolean)
    if (facts.length) text(facts.join('  |  '), { size: 9, col: GREY, gap: 4 })
    if (stop.external_url) text(`Further reading: ${stop.external_url}`, { size: 9, col: MAROON, gap: 4 })
  }

  const pages = doc.getPages()
  pages.forEach((p, n) => {
    p.drawText(`seismicshift.nz/walk  |  Page ${n + 1} of ${pages.length}`, { x: MARGIN, y: 12, size: 7, font: regular, color: color(GREY) })
  })

  return doc.save()
}

// Saves the PDF as a download - used where a new tab can't show it (Android)
// or a pop-up was blocked. A download never replaces the walk page.
export function downloadPdf(blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'seismic-walk-info-pack.pdf'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
