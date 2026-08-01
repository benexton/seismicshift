// Client-side search + metadata filter, shared by both map tabs. Purely a
// display filter over the records a tab already loaded, so it never crosses
// tabs (the queue tab only holds Unverified, the triaged tab only Approved).

export const emptyFilter = { q: '', damage: '', obs: '', source: '', nonstructural: '' };

export const filterActive = (f) =>
  !!(f && (f.q?.trim() || f.damage !== '' || f.obs || f.source || f.nonstructural));

export function matchesFilter(rec, f) {
  if (!f) return true;
  if (f.q && f.q.trim()) {
    const hay = [
      rec.site_id, rec.region, rec.building_name, rec.address, rec.engineer_notes,
      rec.failure_mechanism, rec.building_type, rec.primary_material,
      rec.submitted_by, rec.reviewed_by,
    ].filter((x) => x !== null && x !== undefined).join(' ').toLowerCase();
    if (!hay.includes(f.q.trim().toLowerCase())) return false;
  }
  if (f.damage !== '' && f.damage != null && Number(rec.damage_score) !== Number(f.damage)) return false;
  if (f.obs && rec.observation_type !== f.obs) return false;
  if (f.source && rec.source_type !== f.source) return false;
  if (f.nonstructural === 'yes' && !rec.nonstructural_damage) return false;
  if (f.nonstructural === 'no' && rec.nonstructural_damage) return false;
  return true;
}
