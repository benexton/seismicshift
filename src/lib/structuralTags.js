// Display labels for structural_tags values (src/data/buildings.csv). Keeps
// capitalisation consistent everywhere a tag is shown as a chip - acronyms
// stay capitalised, everything else is sentence case.
const TAG_LABELS = {
  base_isolation: 'Base isolation',
  ground_improvement: 'Ground improvement',
  rc_shear_wall: 'RC shear wall',
  steel_moment_frame: 'Steel moment frame',
  timber_clt: 'Timber / CLT',
  urm_retrofit: 'URM retrofit',
  precast: 'Precast',
  low_damage: 'Low damage',
  long_span_roof: 'Long-span roof',
}

function titleCaseWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export function tagLabel(tag) {
  return TAG_LABELS[tag] ?? titleCaseWord(tag.replace(/_/g, ' '))
}
