// Seismic Walk palette, taken from the PCEE 2027 conference branding
// (confer.eventsair.com/pcee-2027): deep maroon banner, red accent, black band.
// Kept in one place so the walk's components (and the MapLibre layers in
// RouteMap, which can't read Tailwind classes) stay in step.
export const WALK = {
  maroon: '#652431',
  maroonDeep: '#3a0f1a',
  red: '#b53232',
  ink: '#1c1517',
  tint: '#f7eff0',
  line: '#e7dfe0',
  coffee: '#7b5a3c',
}

// Sites with category 'context' (walk_buildings.category, editable in
// /walkadmin/) are memorials and exhibitions rather than engineering case
// studies: listed in their own section and drawn in charcoal instead of
// maroon on the card, map and itinerary. Category 'refreshments' (cafes and
// bars) gets a third section below that, drawn in coffee brown, with opening
// hours (kept in access_notes) in place of the access badge.
export const isContextSite = (building) => building?.category === 'context'
export const isRefreshment = (building) => building?.category === 'refreshments'
export const stopColor = (building) => {
  if (isRefreshment(building)) return WALK.coffee
  return isContextSite(building) ? WALK.ink : WALK.maroon
}
