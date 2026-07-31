// Coordinate validation. The hard check rejects impossible values (the usual
// cause is a dropped decimal point, e.g. a longitude entered as 1306234654
// instead of 130.6234654). The soft check flags points far from the event area
// so a transposed-but-valid coordinate can be confirmed rather than silently
// accepted.

export const EVENT_CENTER = { lat: 32.79, lng: 130.74 }; // Kumamoto

// Generous box around Kyushu / the Kumamoto region for the soft warning.
const NEAR_BOX = { latMin: 31.0, latMax: 34.0, lngMin: 129.0, lngMax: 132.5 };

// Returns an error string if the coordinates are missing or out of valid range,
// otherwise null.
export function coordError(lat, lng) {
  if (lat === '' || lng === '' || lat === null || lng === undefined || lat === undefined || lng === null) {
    return 'Set a location: click the map or enter both latitude and longitude.';
  }
  const la = Number(lat);
  const lo = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(lo)) return 'Latitude and longitude must be numbers.';
  if (la < -90 || la > 90) {
    return `Latitude ${la} is out of range (it must be between -90 and 90). Check for a missing decimal point.`;
  }
  if (lo < -180 || lo > 180) {
    return `Longitude ${lo} is out of range (it must be between -180 and 180). Check for a missing decimal point.`;
  }
  return null;
}

// True if the (valid) point is well outside the event region.
export function isFarFromEvent(lat, lng) {
  const la = Number(lat);
  const lo = Number(lng);
  return la < NEAR_BOX.latMin || la > NEAR_BOX.latMax || lo < NEAR_BOX.lngMin || lo > NEAR_BOX.lngMax;
}
