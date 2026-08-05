// Coordinate validation, event-scoped. The hard check rejects impossible
// values (the usual cause is a dropped decimal point, e.g. a longitude
// entered as 1306234654 instead of 130.6234654). The soft check flags points
// far from the event's epicentre so a transposed-but-valid coordinate can be
// confirmed rather than silently accepted.

const DEFAULT_NEAR_DEGREES = 2.5;

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

// True if the (valid) point is well outside the event area. epicentre is
// {lat, lng} from the event row; nearDegrees is a generous box half-width.
export function isFarFromEvent(lat, lng, epicentre, nearDegrees = DEFAULT_NEAR_DEGREES) {
  if (!epicentre || epicentre.lat == null || epicentre.lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  return (
    la < epicentre.lat - nearDegrees || la > epicentre.lat + nearDegrees ||
    lo < epicentre.lng - nearDegrees || lo > epicentre.lng + nearDegrees
  );
}
