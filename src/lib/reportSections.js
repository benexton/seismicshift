// The AI report content is stored in event_meta.conclusions_md. Newer runs store
// a JSON object of named sections (introduction, overview, regions, mechanisms,
// nonstructural, goodPerformance, conclusions). Older/plain content is treated as
// a single markdown conclusions block. This parser normalises both.

export function parseReportSections(raw) {
  if (!raw || !String(raw).trim()) return null;
  let text = String(raw).trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  if (text.startsWith('{')) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return { structured: true, sections: obj };
      }
    } catch { /* fall through to markdown */ }
  }
  return { structured: false, markdown: String(raw) };
}
