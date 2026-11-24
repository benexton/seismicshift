// Draws the QD sizing calculator's summary PDF in the browser. The calculator
// component decides the content (headings, paragraphs, tables, all as text);
// this file only lays it out on A4 pages. pdf-lib and the Noto Sans fonts load
// only when someone asks for the PDF, so the inputs never leave the browser.
//
// Noto Sans has the Greek letters the notation needs (μ, φ, Δ, δ, θ, ξ, λ) but
// not ≤ or ≥, so content should say "max" / "min" instead.
import { loadFont, wrap } from './pdfText'

const PAGE = [595.28, 841.89] // A4 in points
const M = 42 // page margin
const BRAND = [0.09, 0.388, 0.561] // #17638f
const BRAND_DARK = [0.059, 0.298, 0.431] // #0f4c6e
const INK = [0.059, 0.09, 0.165] // slate-900
const BODY = [0.2, 0.255, 0.333] // slate-700
const GREY = [0.392, 0.455, 0.545] // slate-500
const RULE = [0.886, 0.91, 0.941] // slate-200
const TINT = [0.933, 0.945, 0.953] // #eef1f3
const OK = [0.086, 0.639, 0.29] // #16a34a
const OK_BG = [0.941, 0.992, 0.957]
const BAD = [0.863, 0.149, 0.149] // red-600
const BAD_BG = [0.996, 0.949, 0.949]
const WARN = [0.478, 0.29, 0.063] // #7a4a10
const WARN_BG = [0.992, 0.965, 0.925] // #fdf6ec
const WARN_RULE = [0.753, 0.486, 0.11] // #c07c1c

const TONE = { ok: OK, bad: BAD, warn: WARN }

/**
 * doc = { title, kicker, meta: [string], footer, filenameTitle, blocks: [block] }
 * block types:
 *   { type: 'banner', ok, big, sub }            pass / fail headline
 *   { type: 'callout', title, text }            amber note
 *   { type: 'h', text, eyebrow }                section heading
 *   { type: 'p', text, small }                  paragraph
 *   { type: 'stats', items: [{ k, v, unit }] }  tiles, three to a row
 *   { type: 'table', head, rows, widths, tint } cells are strings or { text, sub, tone, bold }
 *   { type: 'messages', items: [{ level, text }] }
 */
export async function buildQdSummaryPdf(model, fontUrls) {
  const [{ PDFDocument, rgb }, fontkit] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit').then((m) => m.default ?? m),
  ])
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(model.title)
  doc.setAuthor('Seismic Shift')
  doc.setSubject(model.subject ?? model.title)
  const [regularBytes, boldBytes] = await Promise.all([loadFont(fontUrls.regular), loadFont(fontUrls.bold)])
  const regular = await doc.embedFont(regularBytes, { subset: true })
  const bold = await doc.embedFont(boldBytes, { subset: true })

  const color = (c) => rgb(c[0], c[1], c[2])
  const W = PAGE[0] - M * 2
  const BOTTOM = M + 18 // keep clear of the footer
  let page
  let y

  const newPage = () => {
    page = doc.addPage(PAGE)
    y = PAGE[1] - M
  }
  const room = (h) => y - h >= BOTTOM
  const ensure = (h) => { if (!room(h)) newPage() }

  const lineH = (size, lead = 1.38) => size * lead
  const textHeight = (str, { font = regular, size = 9.5, width = W, lead = 1.38 } = {}) =>
    wrap(str, font, size, width).length * lineH(size, lead)

  const text = (str, { font = regular, size = 9.5, col = BODY, width = W, lead = 1.38, x = M, gap = 0, keep = false } = {}) => {
    const lines = wrap(str, font, size, width)
    if (keep) ensure(lines.length * lineH(size, lead))
    for (const line of lines) {
      ensure(lineH(size, lead))
      y -= lineH(size, lead)
      if (line) page.drawText(line, { x, y: y + size * 0.28, size, font, color: color(col) })
    }
    y -= gap
  }

  // ── Header on page 1 ──────────────────────────────────────────────────────
  newPage()
  const headH = 78
  page.drawRectangle({ x: 0, y: PAGE[1] - headH, width: PAGE[0], height: headH, color: color(BRAND) })
  page.drawText(model.kicker, { x: M, y: PAGE[1] - 26, size: 8, font: bold, color: rgb(1, 1, 1), opacity: 0.85 })
  page.drawText(model.title, { x: M, y: PAGE[1] - 54, size: 20, font: bold, color: rgb(1, 1, 1) })
  y = PAGE[1] - headH - 10
  for (const line of model.meta) text(line, { size: 8.5, col: GREY, lead: 1.35 })
  y -= 8

  // ── Blocks ────────────────────────────────────────────────────────────────
  const drawBanner = ({ ok, big, sub }) => {
    const pad = 12
    const subH = sub ? textHeight(sub, { size: 9, width: W - pad * 2 - 62 }) : 0
    const h = pad * 2 + 22 + subH
    ensure(h + 8)
    const top = y
    page.drawRectangle({ x: M, y: top - h, width: W, height: h, color: color(ok ? OK_BG : BAD_BG), borderColor: color(ok ? OK : BAD), borderWidth: 0.8 })
    // Chip
    const chip = ok ? 'PASS' : 'FAIL'
    const chipW = bold.widthOfTextAtSize(chip, 8.5) + 16
    page.drawRectangle({ x: M + pad, y: top - pad - 17, width: chipW, height: 15, color: color(ok ? OK : BAD) })
    page.drawText(chip, { x: M + pad + 8, y: top - pad - 13, size: 8.5, font: bold, color: rgb(1, 1, 1) })
    const tx = M + pad + chipW + 10
    page.drawText(big, { x: tx, y: top - pad - 15, size: 15, font: bold, color: color(INK) })
    y = top - pad - 22
    if (sub) text(sub, { size: 9, col: BODY, width: W - (tx - M) - pad, x: tx })
    y = top - h - 10
  }

  const drawCallout = ({ title, textBody }) => {
    const pad = 10
    const body = title ? `${title} ${textBody}` : textBody
    const h = pad * 2 + textHeight(body, { size: 8.5, width: W - pad * 2 - 4 })
    ensure(h + 8)
    const top = y
    page.drawRectangle({ x: M, y: top - h, width: W, height: h, color: color(WARN_BG) })
    page.drawRectangle({ x: M, y: top - h, width: 3, height: h, color: color(WARN_RULE) })
    y = top - pad
    text(body, { size: 8.5, col: BODY, width: W - pad * 2 - 4, x: M + pad + 4 })
    y = top - h - 10
  }

  const drawHeading = ({ text: t, eyebrow }) => {
    // Keep a heading with at least a few lines of what follows it.
    ensure((eyebrow ? 12 : 0) + 22 + 60)
    y -= 8
    if (eyebrow) {
      y -= 10
      page.drawText(eyebrow.toUpperCase(), { x: M, y, size: 7, font: bold, color: color(GREY) })
    }
    text(t, { font: bold, size: 12.5, col: INK, lead: 1.3 })
    y -= 4
  }

  const drawStats = ({ items }) => {
    const cols = 3
    const gap = 6
    const w = (W - gap * (cols - 1)) / cols
    const h = 38
    for (let i = 0; i < items.length; i += cols) {
      ensure(h + gap)
      const top = y
      items.slice(i, i + cols).forEach((it, j) => {
        const x = M + j * (w + gap)
        page.drawRectangle({ x, y: top - h, width: w, height: h, color: rgb(1, 1, 1), borderColor: color(RULE), borderWidth: 0.8 })
        page.drawText(it.k, { x: x + 8, y: top - 13, size: 7, font: bold, color: color(GREY) })
        const vSize = 12
        page.drawText(it.v, { x: x + 8, y: top - 30, size: vSize, font: bold, color: color(it.tone ? TONE[it.tone] : INK) })
        if (it.unit) {
          page.drawText(it.unit, { x: x + 8 + bold.widthOfTextAtSize(it.v, vSize) + 4, y: top - 30, size: 7.5, font: bold, color: color(GREY) })
        }
      })
      y = top - h - gap
    }
    y -= 4
  }

  const drawTable = ({ head, rows, widths, tint }) => {
    const size = 8
    const subSize = 6.6
    const padX = 5
    const padY = 4
    const colW = widths.map((fr) => fr * W)
    const cell = (c) => (typeof c === 'string' || typeof c === 'number' || c == null ? { text: String(c ?? '') } : c)
    const layout = (row, font) =>
      row.map((c0, i) => {
        const c = cell(c0)
        const inner = colW[i] - padX * 2
        const lines = wrap(c.text, c.bold ? bold : font, size, inner)
        const subLines = c.sub ? wrap(c.sub, regular, subSize, inner) : []
        const h = lines.length * lineH(size, 1.3) + subLines.length * lineH(subSize, 1.3)
        return { c, lines, subLines, h }
      })
    const drawRow = (cells, { header = false, fill = null } = {}) => {
      const h = Math.max(...cells.map((x) => x.h)) + padY * 2
      const top = y
      if (fill) page.drawRectangle({ x: M, y: top - h, width: W, height: h, color: color(fill) })
      let x = M
      cells.forEach(({ c, lines, subLines }, i) => {
        const right = i > 0
        const font = header || c.bold ? bold : regular
        const col = header ? [1, 1, 1] : c.tone ? TONE[c.tone] : i === 0 ? BODY : INK
        let ty = top - padY
        for (const line of lines) {
          ty -= lineH(size, 1.3)
          const lw = font.widthOfTextAtSize(line, size)
          page.drawText(line, { x: right ? x + colW[i] - padX - lw : x + padX, y: ty + size * 0.3, size, font, color: color(col) })
        }
        for (const line of subLines) {
          ty -= lineH(subSize, 1.3)
          const lw = regular.widthOfTextAtSize(line, subSize)
          page.drawText(line, { x: right ? x + colW[i] - padX - lw : x + padX, y: ty + subSize * 0.3, size: subSize, font: regular, color: color(GREY) })
        }
        x += colW[i]
      })
      y = top - h
      if (!header) page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: color(RULE) })
      return h
    }
    const headCells = head ? layout(head, bold) : null
    const headH = headCells ? Math.max(...headCells.map((x) => x.h)) + padY * 2 : 0
    const bodyCells = rows.map((r) => layout(r, regular))
    const rowH = (cells) => Math.max(...cells.map((x) => x.h)) + padY * 2
    // Start on a new page if the header and first two rows won't fit.
    ensure(headH + bodyCells.slice(0, 2).reduce((s, c) => s + rowH(c), 0))
    if (headCells) drawRow(headCells, { header: true, fill: BRAND })
    // Widow control: if the last three rows won't all fit, move all three
    // over together rather than leaving one or two alone on the next page.
    const tail = bodyCells.slice(-3).reduce((s, c) => s + rowH(c), 0)
    bodyCells.forEach((cells, i) => {
      const atTail = bodyCells.length >= 6 && i === bodyCells.length - 3
      if (!room(rowH(cells)) || (atTail && !room(tail))) {
        newPage()
        if (headCells) drawRow(headCells, { header: true, fill: BRAND })
      }
      drawRow(cells, { fill: tint && tint(i) ? TINT : null })
    })
    y -= 8
  }

  const drawMessages = ({ items }) => {
    for (const m of items) {
      const pad = 7
      const fg = m.level === 'bad' ? BAD : m.level === 'warn' ? WARN : BODY
      const bg = m.level === 'bad' ? BAD_BG : m.level === 'warn' ? WARN_BG : TINT
      const h = pad * 2 + textHeight(m.text, { size: 8.5, width: W - pad * 2 })
      ensure(h + 5)
      const top = y
      page.drawRectangle({ x: M, y: top - h, width: W, height: h, color: color(bg) })
      y = top - pad
      text(m.text, { size: 8.5, col: fg, width: W - pad * 2, x: M + pad })
      y = top - h - 5
    }
    y -= 5
  }

  for (const b of model.blocks) {
    if (b.type === 'banner') drawBanner(b)
    else if (b.type === 'callout') drawCallout({ title: b.title, textBody: b.text })
    else if (b.type === 'h') drawHeading(b)
    else if (b.type === 'p') text(b.text, { size: b.small ? 8 : 9, col: b.small ? GREY : BODY, gap: 6 })
    else if (b.type === 'stats') drawStats(b)
    else if (b.type === 'table') drawTable(b)
    else if (b.type === 'messages') drawMessages(b)
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pages = doc.getPages()
  pages.forEach((p, n) => {
    p.drawLine({ start: { x: M, y: M - 2 }, end: { x: PAGE[0] - M, y: M - 2 }, thickness: 0.5, color: color(RULE) })
    p.drawText(model.footer, { x: M, y: M - 13, size: 7, font: regular, color: color(GREY) })
    const pn = `Page ${n + 1} of ${pages.length}`
    p.drawText(pn, { x: PAGE[0] - M - regular.widthOfTextAtSize(pn, 7), y: M - 13, size: 7, font: bold, color: color(BRAND_DARK) })
  })

  return doc.save()
}
