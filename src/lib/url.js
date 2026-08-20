// Guards <a href> against javascript:/data:/vbscript: URLs from free-text or
// scraper-supplied source_url fields - render only real, navigable links.
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

export function safeHref(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    // A base is required to parse protocol-relative/relative strings; any
    // resulting absolute URL still has its own resolved protocol checked
    // below, so this base never leaks into what's returned.
    const parsed = new URL(url, 'https://example.com');
    return SAFE_PROTOCOLS.has(parsed.protocol) ? url : null;
  } catch {
    return null;
  }
}
