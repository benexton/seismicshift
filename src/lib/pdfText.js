// Small helpers shared by the PDFs the site builds in the browser (the Walk
// info pack and the QD sizing summary). Both use pdf-lib with embedded Noto
// Sans, loaded only when someone asks for a PDF.

export async function loadFont(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('font fetch failed')
  return res.arrayBuffer()
}

function clean(text) {
  return String(text ?? '').replace(/\r/g, '').replace(/\t/g, ' ')
}

// Word-wraps text to a column width. Explicit newlines start new lines.
export function wrap(text, font, size, maxWidth) {
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

// Saves a blob as a file download.
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
