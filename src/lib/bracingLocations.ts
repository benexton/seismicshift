// TODO: replace with real data
// Illustrative worked-example bracing units for a handful of towns. These
// are the only numbers left that are still placeholders: hazard-shift H now
// comes from real per-town, per-site-class data in locationHazard.ts.
//
// Across-direction figures are placeholder estimates only, not derived from
// real per-direction NZS 3604 calcs. Replace both directions with real
// whole-house bracing unit totals once available.
//
// Keyed by exact town name to match locationHazard.ts, so the location search
// can tell which towns have curated worked-example BUs and which don't.

export interface DirectionalBu {
  /** Sample NZS 3604:2011 earthquake bracing demand (BUs), whole house total. */
  eq: number;
  /** Sample NZS 3604:2011 wind bracing demand (BUs), whole house total. */
  wind: number;
}

export interface BracingLocation {
  name: string;
  /** Is wind the likely governing action for a typical house here? */
  windLikelyGoverns: boolean;
  /** Bracing demand along the ridge direction. */
  along: DirectionalBu;
  /** Bracing demand across the ridge direction (gable end). */
  across: DirectionalBu;
}

import { LOCATION_HAZARDS_BY_NAME } from './locationHazard';
import { getBaselineBracing } from './bracingBaseline';

export const BRACING_LOCATIONS: Record<string, BracingLocation> = {
  Christchurch: {
    name: "Christchurch", windLikelyGoverns: false,
    along: { eq: 1000, wind: 550 }, across: { eq: 1000, wind: 410 },
  },
  Wellington: {
    name: "Wellington", windLikelyGoverns: false,
    along: { eq: 1200, wind: 700 }, across: { eq: 1200, wind: 530 },
  },
  Auckland: {
    name: "Auckland", windLikelyGoverns: true,
    along: { eq: 300, wind: 850 }, across: { eq: 300, wind: 640 },
  },
  Queenstown: {
    name: "Queenstown", windLikelyGoverns: false,
    along: { eq: 700, wind: 450 }, across: { eq: 700, wind: 340 },
  },
  Dunedin: {
    name: "Dunedin", windLikelyGoverns: false,
    along: { eq: 450, wind: 500 }, across: { eq: 450, wind: 380 },
  },
};

/** Is this town one of the hand-curated worked examples above? */
export function isCuratedLocation(name: string): boolean {
  return Boolean(BRACING_LOCATIONS[name]);
}

/**
 * The curated worked example for this town if we have one, otherwise a
 * zone/region-scaled baseline estimate (see bracingBaseline.ts). Undefined
 * only if the town isn't in locationHazard.ts at all.
 */
export function getBracingLocation(name: string): BracingLocation | undefined {
  if (BRACING_LOCATIONS[name]) return BRACING_LOCATIONS[name];
  const hazard = LOCATION_HAZARDS_BY_NAME[name];
  return hazard ? getBaselineBracing(hazard) : undefined;
}
