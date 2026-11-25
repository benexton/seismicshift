// Draws the QD sizing calculator's summary PDF in the browser. The calculator
// component decides the content (headings, paragraphs, tables, all as text);
// this file only lays it out on A4 pages, styled like the site: DM Sans, the
// Seismic Shift logo top right, slate text, rounded cards and brand-blue table
// heads. pdf-lib and the fonts load only when someone asks for the PDF, so the
// inputs never leave the browser.
//
// DM Sans has no Greek, so any character it lacks (μ, φ, Δ, δ, θ, ξ, λ) is drawn
// in Noto Sans, the fallback font the component passes in. Neither font is
// needed for ≤ or ≥: content says "max" / "min".
import { loadFont, wrap } from './pdfText'
import dmRegularUrl from '../assets/fonts/DMSans-Regular.ttf?url'
import dmBoldUrl from '../assets/fonts/DMSans-Bold.ttf?url'
import dmBlackUrl from '../assets/fonts/DMSans-Black.ttf?url'

const LOGO_URL = '/logo.png'

const PAGE = [595.28, 841.89] // A4 in points
const M = 42 // page margin
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const BRAND = hex('#17638f')
const INK = hex('#0f172a') // slate-900
const BODY = hex('#334155') // slate-700
const MUTED = hex('#64748b') // slate-500
const FAINT = hex('#94a3b8') // slate-400
const RULE = hex('#e2e8f0') // slate-200
const RULE_SOFT = hex('#f1f5f9') // slate-100
const CARD = hex('#f8fafc') // slate-50
const TINT = hex('#eef1f3') // brand tint
const OK = hex('#16a34a')
const OK_BG = hex('#f0fdf4') // green-50
const OK_RULE = hex('#bbf7d0') // green-200
const BAD = hex('#dc2626') // red-600
const BAD_TEXT = hex('#b91c1c') // red-700
const BAD_BG = hex('#fef2f2') // red-50
const BAD_RULE = hex('#fecaca') // red-200
const EQ = hex('#c07c1c')
const WARN = hex('#7a4a10')
const WARN_BG = hex('#fdf6ec')
const WARN_RULE = hex('#e5cba4') // #c07c1c at 40% on white

const TONE = { ok: OK, bad: BAD, warn: WARN }

/**
 * doc = { title, kicker, subject, meta: [string], footer, blocks: [block] }
 * block types:
 *   { type: 'banner', ok, big, sub }            pass / fail headline
 *   { type: 'callout', title, text }            amber note
 *   { type: 'h', text, eyebrow }                section heading
 *   { type: 'p', text, small }                  paragraph
 *   { type: 'stats', items: [{ k, v, unit }] }  tiles, three to a row
 *   { type: 'table', head, rows, widths, tint } cells are strings or { text, sub, tone, bold }
 *   { type: 'messages', items: [{ level, text }] }
 *   { type: 'figure', url, width, caption: [{ text, bold, small, tone }] }  PNG in a card, caption to its right
 * A 'stats' block straight after a 'banner' shares its card, as on the page.
 */
export async function buildQdSummaryPdf(model, fontUrls) {
  const [{ PDFDocument, rgb, pushGraphicsState, popGraphicsState, setCharacterSpacing }, fontkit] = await Promise.all([
    import('pdf-lib'),
    import('@pdf-lib/fontkit').then((m) => m.default ?? m),
  ])
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(model.title)
  doc.setAuthor('Seismic Shift')
  doc.setSubject(model.subject ?? model.title)

  const [dmReg, dmBold, dmBlack, notoReg, notoBold, logoBytes] = await Promise.all([
    loadFont(dmRegularUrl),
    loadFont(dmBoldUrl),
    loadFont(dmBlackUrl),
    loadFont(fontUrls.regular),
    loadFont(fontUrls.bold),
    fetch(LOGO_URL).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
  ])
  const embed = (bytes) => doc.embedFont(bytes, { subset: true })
  const [fReg, fBold, fBlack, fbReg, fbBold] = await Promise.all([embed(dmReg), embed(dmBold), embed(dmBlack), embed(notoReg), embed(notoBold)])
  // The logo is a nice-to-have: the PDF still builds without it.
  let logo = null
  try { if (logoBytes) logo = await doc.embedPng(logoBytes) } catch { logo = null }

  // A face is DM Sans with Noto Sans filling in the characters DM Sans lacks.
  // It measures like a pdf-lib font, so wrap() in pdfText works with it.
  const face = (primary, fallback) => {
    const has = new Set(primary.getCharacterSet())
    const runs = (str) => {
      const out = []
      for (const ch of String(str)) {
        const font = has.has(ch.codePointAt(0)) ? primary : fallback
        const last = out[out.length - 1]
        if (last && last.font === font) last.text += ch
        else out.push({ font, text: ch })
      }
      return out
    }
    return {
      runs,
      widthOfTextAtSize: (str, size) => runs(str).reduce((s, r) => s + r.font.widthOfTextAtSize(r.text, size), 0),
    }
  }
  const REG = face(fReg, fbReg)
  const BOLD = face(fBold, fbBold)
  const BLACK = face(fBlack, fbBold)

  const color = (c) => rgb(c[0], c[1], c[2])
  const W = PAGE[0] - M * 2
  const BOTTOM = M + 18 // keep clear of the footer
  let page
  let y

  // Draws one line of text in a face, with optional letter spacing (em).
  const draw = (str, { x, y: by, size, font = REG, col = BODY, tracking = 0 }) => {
    const tc = tracking * size
    if (tc) page.pushOperators(pushGraphicsState(), setCharacterSpacing(tc))
    let cx = x
    for (const r of font.runs(str)) {
      page.drawText(r.text, { x: cx, y: by, size, font: r.font, color: color(col) })
      cx += r.font.widthOfTextAtSize(r.text, size) + tc * [...r.text].length
    }
    if (tc) page.pushOperators(popGraphicsState())
    return cx - x
  }
  const widthOf = (str, size, font = REG, tracking = 0) => font.widthOfTextAtSize(str, size) + tracking * size * [...String(str)].length

  // Rounded rectangle from its top-left corner. corners = [tl, tr, br, bl].
  const roundRect = (x, top, w, h, r, { fill, border, borderWidth = 0.75, corners = [1, 1, 1, 1] } = {}) => {
    const [tl, tr, br, bl] = corners.map((c) => (c ? Math.min(r, w / 2, h / 2) : 0))
    const path = [
      `M ${tl} 0`, `H ${w - tr}`, tr ? `A ${tr} ${tr} 0 0 1 ${w} ${tr}` : '',
      `V ${h - br}`, br ? `A ${br} ${br} 0 0 1 ${w - br} ${h}` : '',
      `H ${bl}`, bl ? `A ${bl} ${bl} 0 0 1 0 ${h - bl}` : '',
      `V ${tl}`, tl ? `A ${tl} ${tl} 0 0 1 ${tl} 0` : '', 'Z',
    ].join(' ')
    const opts = { x, y: top }
    if (fill) opts.color = color(fill)
    if (border) { opts.borderColor = color(border); opts.borderWidth = borderWidth }
    page.drawSvgPath(path, opts)
  }

  // Logo, top right, at a given height. Returns its width (0 without a logo).
  const drawLogo = (top, h) => {
    if (!logo) return 0
    const w = (logo.width / logo.height) * h
    page.drawImage(logo, { x: PAGE[0] - M - w, y: top - h, width: w, height: h })
    return w
  }

  const newPage = () => {
    page = doc.addPage(PAGE)
    // Running head on continuation pages: title left, small logo right.
    const top = PAGE[1] - M + 14
    const lw = drawLogo(top, 20)
    draw(model.title, { x: M, y: top - 13, size: 8, font: BLACK, col: FAINT, tracking: -0.01 })
    if (!lw) draw('Seismic Shift', { x: PAGE[0] - M - widthOf('Seismic Shift', 8, BLACK), y: top - 13, size: 8, font: BLACK, col: INK })
    page.drawLine({ start: { x: M, y: top - 28 }, end: { x: M + W, y: top - 28 }, thickness: 0.5, color: color(RULE) })
    y = top - 28 - 14
  }
  const room = (h) => y - h >= BOTTOM
  const ensure = (h) => { if (!room(h)) newPage() }

  const lineH = (size, lead = 1.4) => size * lead
  const textHeight = (str, { font = REG, size = 9.5, width = W, lead = 1.4 } = {}) =>
    wrap(str, font, size, width).length * lineH(size, lead)

  const text = (str, { font = REG, size = 9.5, col = BODY, width = W, lead = 1.4, x = M, gap = 0, keep = false, tracking = 0 } = {}) => {
    const lines = wrap(str, font, size, width)
    const lh = lineH(size, lead)
    // Keep short paragraphs whole, and never leave a single line of a longer
    // one alone at the foot or head of a page.
    let breakAt = -1
    if (keep || lines.length <= 4) ensure(lines.length * lh)
    else {
      const fit = Math.floor((y - BOTTOM) / lh)
      if (fit < 2) newPage()
      else if (fit < lines.length) breakAt = lines.length - fit === 1 ? fit - 1 : fit
    }
    for (const [i, line] of lines.entries()) {
      if (i === breakAt) newPage()
      ensure(lh)
      y -= lineH(size, lead)
      if (line) draw(line, { x, y: y + size * 0.3, size, font, col, tracking })
    }
    y -= gap
  }

  // Word-wraps runs of differently styled text together (a bold lead-in
  // followed by body text). segs = [{ text, font, col }]. Returns lines of
  // pieces [{ text, font, col, x }].
  const richLines = (segs, size, width) => {
    const words = []
    for (const s of segs) for (const w of String(s.text).split(/\s+/).filter(Boolean)) words.push({ ...s, text: w })
    const space = (f) => f.widthOfTextAtSize(' ', size)
    const lines = []
    let line = []
    let lx = 0
    for (const w of words) {
      const ww = w.font.widthOfTextAtSize(w.text, size)
      const sp = line.length ? space(w.font) : 0
      if (line.length && lx + sp + ww > width) {
        lines.push(line)
        line = []
        lx = 0
      }
      const gap = line.length ? space(w.font) : 0
      line.push({ ...w, x: lx + gap })
      lx += gap + ww
    }
    if (line.length) lines.push(line)
    return lines
  }

  // ── Header on page 1 ──────────────────────────────────────────────────────
  page = doc.addPage(PAGE)
  {
    const top = PAGE[1] - M + 6
    const logoH = 40
    const lw = drawLogo(top, logoH)
    const textW = W - (lw ? lw + 20 : 0)
    y = top
    // Eyebrow, as on the site: small, black weight, uppercase, wide tracking.
    y -= 9
    draw(model.kicker.toUpperCase(), { x: M, y, size: 7.5, font: BLACK, col: FAINT, tracking: 0.1 })
    y -= 6
    text(model.title, { font: BLACK, size: 23, col: INK, lead: 1.15, width: textW, tracking: -0.03 })
    y = Math.min(y, top - logoH) - 12
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: color(RULE) })
    y -= 6
    for (const line of model.meta) text(line, { size: 8.5, col: MUTED, lead: 1.4 })
    y -= 12
  }

  // ── Blocks ────────────────────────────────────────────────────────────────
  const paraStyle = (b) => ({ size: b.small ? 8 : 9, col: b.small ? MUTED : BODY, lead: 1.4 })

  const TABLE = { size: 8.2, subSize: 6.7, padX: 7, padY: 3.6, R: 7 }
  // Wraps every cell of a table to its column. Used to draw it and to measure it.
  const tableCells = ({ head, rows, widths }) => {
    const { size, subSize, padX } = TABLE
    const colW = widths.map((fr) => fr * W)
    const cell = (c) => (typeof c === 'string' || typeof c === 'number' || c == null ? { text: String(c ?? '') } : c)
    const layout = (row, header) =>
      row.map((c0, i) => {
        const c = cell(c0)
        const font = header ? BLACK : c.bold ? BOLD : i === 0 ? REG : BOLD
        const inner = colW[i] - padX * 2
        const lines = wrap(c.text, font, size, inner)
        const subLines = c.sub ? wrap(c.sub, REG, subSize, inner) : []
        const h = lines.length * lineH(size, 1.3) + subLines.length * lineH(subSize, 1.3)
        return { c, font, lines, subLines, h }
      })
    return { colW, headCells: head ? layout(head, true) : null, bodyCells: rows.map((r) => layout(r, false)) }
  }
  const rowH = (cells) => Math.max(...cells.map((x) => x.h)) + TABLE.padY * 2

  const messageHeight = (m) => 8 * 2 + textHeight(m.text, { size: 8.8, width: W - 11 * 2 })

  const statLayout = (items) => {
    const cols = 3
    const gap = 7
    const w = (W - 28 - gap * (cols - 1)) / cols
    const h = 36
    const rows = Math.ceil(items.length / cols)
    return { cols, gap, w, h, rows, height: rows * h + (rows - 1) * gap }
  }

  const drawStatTiles = (items, x0, L) => {
    for (let i = 0; i < items.length; i += L.cols) {
      const top = y
      items.slice(i, i + L.cols).forEach((it, j) => {
        const x = x0 + j * (L.w + L.gap)
        roundRect(x, top, L.w, L.h, 7, { fill: [1, 1, 1], border: RULE_SOFT })
        draw(it.k, { x: x + 9, y: top - 12, size: 7, font: BLACK, col: FAINT })
        const vSize = 13
        const vw = draw(it.v, { x: x + 9, y: top - 28, size: vSize, font: BLACK, col: it.tone ? TONE[it.tone] : INK, tracking: -0.02 })
        if (it.unit) draw(it.unit, { x: x + 9 + vw + 3, y: top - 28, size: 7.5, font: BOLD, col: FAINT })
      })
      y = top - L.h - L.gap
    }
    y += L.gap
  }

  // The headline card: pass / fail chip, the result, the reason, then the stat
  // tiles, on a slate-50 card like the page's summary.
  const drawSummaryCard = ({ ok, big, sub }, stats) => {
    const pad = 14
    const inner = W - pad * 2
    const bigSize = 17
    const chip = ok ? 'PASS' : 'FAIL'
    const chipSize = 7.5
    const chipW = widthOf(chip, chipSize, BLACK, 0.08) + 14
    const chipH = 15
    const bigLines = wrap(big, BLACK, bigSize, inner - chipW - 10)
    const subLines = sub ? wrap(sub, REG, 9.5, inner) : []
    const L = stats ? statLayout(stats.items) : null
    const h = pad + bigLines.length * lineH(bigSize, 1.2) + (subLines.length ? 4 + subLines.length * lineH(9.5) : 0) + (L ? 12 + L.height : 0) + pad
    ensure(h + 10)
    const top = y
    roundRect(M, top, W, h, 12, { fill: CARD, border: RULE_SOFT })
    // Chip, vertically centred on the first line of the headline.
    const firstMid = top - pad - lineH(bigSize, 1.2) / 2
    roundRect(M + pad, firstMid + chipH / 2, chipW, chipH, chipH / 2, { fill: ok ? OK_BG : BAD_BG, border: ok ? OK_RULE : BAD_RULE })
    draw(chip, { x: M + pad + 7, y: firstMid - chipSize * 0.35, size: chipSize, font: BLACK, col: ok ? OK : BAD, tracking: 0.08 })
    y = top - pad
    bigLines.forEach((line) => {
      y -= lineH(bigSize, 1.2)
      draw(line, { x: M + pad + chipW + 10, y: y + bigSize * 0.28, size: bigSize, font: BLACK, col: INK, tracking: -0.03 })
    })
    if (subLines.length) {
      y -= 4
      text(sub, { size: 9.5, col: MUTED, width: inner, x: M + pad })
    }
    if (L) {
      y -= 12
      drawStatTiles(stats.items, M + pad, L)
    }
    y = top - h - 12
  }

  const drawStatsAlone = ({ items }) => {
    const L = statLayout(items)
    ensure(L.height + 8)
    drawStatTiles(items, M + 14, L)
    y -= 12
  }

  const drawCallout = ({ title, textBody }) => {
    const pad = 11
    const size = 9
    const segs = [...(title ? [{ text: title, font: BLACK, col: EQ }] : []), { text: textBody, font: REG, col: BODY }]
    const lines = richLines(segs, size, W - pad * 2)
    const h = pad * 2 + lines.length * lineH(size, 1.5) - 2
    ensure(h + 10)
    const top = y
    roundRect(M, top, W, h, 12, { fill: WARN_BG, border: WARN_RULE })
    y = top - pad + 1
    for (const line of lines) {
      y -= lineH(size, 1.5)
      for (const piece of line) draw(piece.text, { x: M + pad + piece.x, y: y + size * 0.35, size, font: piece.font, col: piece.col })
    }
    y = top - h - 12
  }

  // Height a heading needs below it so it isn't stranded at the foot of a page:
  // a short paragraph whole (and the start of what follows it), a table's
  // header and first two rows, or the first message.
  const startHeight = (i) => {
    const b = model.blocks[i]
    if (!b) return 0
    if (b.type === 'p') {
      const { size, lead } = paraStyle(b)
      const lines = wrap(b.text, REG, size, W).length
      return lines <= 4 ? lines * lineH(size, lead) + 7 + startHeight(i + 1) : 2 * lineH(size, lead)
    }
    if (b.type === 'table') {
      const { headCells, bodyCells } = tableCells(b)
      return (headCells ? rowH(headCells) : 0) + bodyCells.slice(0, 2).reduce((s, c) => s + rowH(c), 0)
    }
    if (b.type === 'messages' && b.items.length) return messageHeight(b.items[0])
    if (b.type === 'figure') return 120
    return 40
  }

  const drawHeading = ({ text: t, eyebrow }, i) => {
    ensure((eyebrow ? 9 : 0) + 8 + lineH(14, 1.25) + 6 + startHeight(i + 1))
    y -= 8
    if (eyebrow) {
      y -= 8
      draw(eyebrow.toUpperCase(), { x: M, y, size: 7, font: BLACK, col: FAINT, tracking: 0.1 })
      y -= 1
    }
    text(t, { font: BLACK, size: 14, col: INK, lead: 1.25, tracking: -0.03 })
    y -= 6
  }

  const drawTable = (b) => {
    const { tint } = b
    const { colW, headCells, bodyCells } = tableCells(b)
    const { size, subSize, padX, padY, R } = TABLE
    const drawRow = (cells, { header = false, fill = null, last = false } = {}) => {
      const h = rowH(cells)
      const top = y
      if (fill) roundRect(M, top, W, h, R, { fill, corners: header ? [1, 1, 0, 0] : last ? [0, 0, 1, 1] : [0, 0, 0, 0] })
      let x = M
      cells.forEach(({ c, font, lines, subLines }, i) => {
        const right = i > 0
        // First column reads as a label (slate-700), values as figures (slate-900).
        const col = header ? [1, 1, 1] : c.tone ? TONE[c.tone] : i === 0 ? BODY : INK
        let ty = top - padY
        for (const line of lines) {
          ty -= lineH(size, 1.3)
          const lw = font.widthOfTextAtSize(line, size)
          draw(line, { x: right ? x + colW[i] - padX - lw : x + padX, y: ty + size * 0.3, size, font, col })
        }
        for (const line of subLines) {
          ty -= lineH(subSize, 1.3)
          const lw = REG.widthOfTextAtSize(line, subSize)
          draw(line, { x: right ? x + colW[i] - padX - lw : x + padX, y: ty + subSize * 0.32, size: subSize, font: REG, col: header ? [0.85, 0.9, 0.94] : MUTED })
        }
        x += colW[i]
      })
      y = top - h
      if (!header && !last) page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.5, color: color(RULE) })
    }
    const headH = headCells ? rowH(headCells) : 0
    const n = bodyCells.length
    const tail = bodyCells.slice(-3).reduce((s, c) => s + rowH(c), 0)
    // Would row i start a new page if the page's y were yAt?
    const breaksAt = (i, yAt) => {
      if (i >= n) return false
      const fits = (h) => yAt - h >= BOTTOM
      // Widow control: if the last three rows won't all fit, move all three
      // over together rather than leaving one or two alone on the next page.
      const atTail = n >= 6 && i === n - 3
      return !fits(rowH(bodyCells[i])) || (atTail && !fits(tail))
    }
    // Each page's part of the table gets its own rounded frame.
    let segTop
    const startSegment = () => {
      segTop = y
      if (headCells) drawRow(headCells, { header: true, fill: BRAND })
    }
    const endSegment = () => roundRect(M, segTop, W, segTop - y, R, { border: RULE })

    // Start on a new page if the header and first two rows won't fit.
    ensure(headH + bodyCells.slice(0, 2).reduce((s, c) => s + rowH(c), 0))
    startSegment()
    bodyCells.forEach((cells, i) => {
      if (breaksAt(i, y)) {
        endSegment()
        newPage()
        startSegment()
      }
      const lastHere = i === n - 1 || breaksAt(i + 1, y - rowH(cells))
      drawRow(cells, { fill: tint && tint(i) ? TINT : null, last: lastHere })
    })
    endSegment()
    y -= 12
  }

  const MSG = {
    bad: { fg: BAD_TEXT, bg: BAD_BG, rule: BAD_RULE },
    warn: { fg: WARN, bg: WARN_BG, rule: WARN_RULE },
    info: { fg: BODY, bg: TINT, rule: RULE },
  }
  const drawMessages = ({ items }) => {
    for (const m of items) {
      const st = MSG[m.level] ?? MSG.info
      const padX = 11
      const padY = 8
      const h = messageHeight(m)
      ensure(h + 6)
      const top = y
      roundRect(M, top, W, h, 9, { fill: st.bg, border: st.rule })
      y = top - padY
      text(m.text, { size: 8.8, col: st.fg, width: W - padX * 2, x: M + padX })
      y = top - h - 6
    }
    y -= 6
  }

  // Figures (the typology sketch): fetched and embedded up front. Like the logo they are a nice-to-have, so one
  // that fails to load is left out rather than stopping the PDF.
  const figures = new Map()
  await Promise.all(model.blocks.filter((b) => b.type === 'figure').map(async (b) => {
    try {
      const bytes = await fetch(b.url).then((r) => (r.ok ? r.arrayBuffer() : null))
      if (bytes) figures.set(b.url, await doc.embedPng(bytes))
    } catch { /* leave it out */ }
  }))
  const drawFigure = (b) => {
    const img = figures.get(b.url)
    if (!img) return
    const pad = 6, gapX = 14
    const boxW = b.width ?? 190
    const imgW = boxW - pad * 2, imgH = (imgW * img.height) / img.width, boxH = imgH + pad * 2
    const capX = M + boxW + gapX, capW = W - boxW - gapX
    const caps = (b.caption ?? []).map((c) => ({
      text: c.text,
      size: c.small ? 7.6 : 9,
      font: c.bold ? BOLD : REG,
      col: c.tone === 'bad' ? BAD_TEXT : c.small ? MUTED : c.bold ? INK : BODY,
    }))
    const capH = caps.reduce((s, c) => s + textHeight(c.text, { font: c.font, size: c.size, width: capW }) + 3, 0)
    const h = Math.max(boxH, capH)
    ensure(h + 12)
    const top = y
    roundRect(M, top, boxW, boxH, 9, { fill: [1, 1, 1], border: RULE })
    page.drawImage(img, { x: M + pad, y: top - pad - imgH, width: imgW, height: imgH })
    y = top
    for (const c of caps) text(c.text, { x: capX, width: capW, size: c.size, font: c.font, col: c.col, gap: 3, keep: true })
    y = top - h - 12
  }

  const blocks = model.blocks
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i]
    if (b.type === 'banner') {
      const next = blocks[i + 1]
      if (next && next.type === 'stats') {
        drawSummaryCard(b, next)
        i += 1
      } else drawSummaryCard(b, null)
    } else if (b.type === 'callout') drawCallout({ title: b.title, textBody: b.text })
    else if (b.type === 'h') drawHeading(b, i)
    else if (b.type === 'p') text(b.text, { ...paraStyle(b), gap: 7 })
    else if (b.type === 'stats') drawStatsAlone(b)
    else if (b.type === 'table') drawTable(b)
    else if (b.type === 'messages') drawMessages(b)
    else if (b.type === 'figure') drawFigure(b)
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const pages = doc.getPages()
  pages.forEach((p, n) => {
    page = p
    p.drawLine({ start: { x: M, y: M - 2 }, end: { x: PAGE[0] - M, y: M - 2 }, thickness: 0.5, color: color(RULE) })
    draw(model.footer, { x: M, y: M - 14, size: 7, font: REG, col: FAINT })
    const pn = `Page ${n + 1} of ${pages.length}`
    draw(pn, { x: PAGE[0] - M - widthOf(pn, 7, BLACK), y: M - 14, size: 7, font: BLACK, col: BRAND })
  })

  return doc.save()
}
