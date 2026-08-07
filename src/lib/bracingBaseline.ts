// Baseline (non-curated) worked-example bracing units: a fallback for every
// town in locationHazard.ts that doesn't have a hand-curated worked example
// in bracingLocations.ts.
//
// EARTHQUAKE: NZS 3604's seismic bracing demand for a given house is driven
// by the code's own EQ zone factor (zone 1 = 0.2, zone 2 = 0.3, zone 3 =
// 0.45) and is otherwise identical for any two towns in the same zone. So
// the baseline EQ figure is a single reference-house number per zone, scaled
// proportionally from Christchurch's curated zone-2 example (1000 BU,
// whole-house) via the town's eqZoneFactor. Like the curated data, it does
// not vary along vs across.
//
// WIND: there's no equivalent single code-driven scalar available here (wind
// BU also depends on site exposure/terrain, not just windRegion), so this
// uses an illustrative relative-severity multiplier by windRegion, anchored
// to Christchurch's curated A7 example (550 BU along). The across/along ratio
// (0.75) matches the ~0.75 ratio already present across all 5 curated towns.
//
// Both figures are illustrative placeholders, like the rest of this
// prototype's numbers: replace with real per-town NZS 3604 calcs once
// available.

import type { BracingLocation } from './bracingLocations';
import type { LocationHazard } from './locationHazard';

const EQ_ANCHOR_BU = 1000; // Christchurch curated eq BU, zone 2 (factor 0.3)
const EQ_ANCHOR_ZONE_FACTOR = 0.3;

const WIND_ANCHOR_ALONG_BU = 550; // Christchurch curated wind BU, region A7
const WIND_REGION_MULTIPLIER: Record<string, number> = {
  'A6': 0.9,
  'A7': 1.0,
  'W (NZ3)': 1.3,
  'W (NZ4)': 1.45,
};
const WIND_ACROSS_RATIO = 0.75;

export function getBaselineBracing(hazard: LocationHazard): BracingLocation {
  const eq = Math.round(EQ_ANCHOR_BU * (hazard.eqZoneFactor / EQ_ANCHOR_ZONE_FACTOR));
  const windMultiplier = WIND_REGION_MULTIPLIER[hazard.windRegion] ?? 1.0;
  const windAlong = Math.round(WIND_ANCHOR_ALONG_BU * windMultiplier);
  const windAcross = Math.round(windAlong * WIND_ACROSS_RATIO);

  return {
    name: hazard.name,
    windLikelyGoverns: windAlong > eq,
    along: { eq, wind: windAlong },
    across: { eq, wind: windAcross },
  };
}
