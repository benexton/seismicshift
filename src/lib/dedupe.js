// Cross-source duplicate detection, run in the browser against the loaded set
// of approved sites. A candidate is flagged when a record is EITHER visually
// near-identical (perceptual-hash Hamming distance small) OR geographically
// very close to an existing site. The merge itself is always human-confirmed,
// so we favour recall (catch possible matches) and let the reviewer decide.

const POP4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]; // bits set per hex nibble

// Hamming distance between two equal-length hex pHash strings (0 = identical).
export function hexHamming(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    if (Number.isNaN(x)) return Infinity;
    d += POP4[x];
  }
  return d;
}

// Great-circle distance in metres.
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const DEFAULTS = { maxMeters: 50, maxHamming: 6 };

/**
 * Return the approved sites that plausibly match `rec`, each annotated with the
 * reason(s) and a distance/hash score for display. Sorted best-match first.
 */
export function findDuplicates(rec, approved, opts = {}) {
  const { maxMeters, maxHamming } = { ...DEFAULTS, ...opts };
  const out = [];
  for (const a of approved) {
    if (a.id === rec.id) continue;
    const reasons = [];
    let meters = null;
    let hamming = null;

    if (rec.phash && a.phash) {
      const h = hexHamming(rec.phash, a.phash);
      if (h <= maxHamming) {
        hamming = h;
        reasons.push(h === 0 ? 'identical image' : `similar image (${h})`);
      }
    }
    if (rec.latitude != null && a.latitude != null) {
      const m = haversineMeters(rec.latitude, rec.longitude, a.latitude, a.longitude);
      if (m <= maxMeters) {
        meters = m;
        reasons.push(`within ${Math.round(m)} m`);
      }
    }

    if (reasons.length) {
      // rank: image match beats proximity; closer/lower is better
      const score = (hamming ?? 100) + (meters ?? 1000) / 100;
      out.push({ ...a, _reasons: reasons, _meters: meters, _hamming: hamming, _score: score });
    }
  }
  return out.sort((x, y) => x._score - y._score);
}
