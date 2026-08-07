/**
 * Residential Seismic Bracing Checker: calculation engine
 * -------------------------------------------------------
 * Framework-agnostic. No dependencies. Drops into Astro / React / vanilla.
 *
 * Implements the governance-aware logic from the v2 concept brief:
 *   seismic damage-control target = F_SR337 * H * EQ_3604   (scales earthquake only)
 *   recommended target            = max(seismic target, WIND_3604)   (wind hasn't moved)
 *   code minimum you'd build       = max(EQ_3604, WIND_3604)
 *   indicative uplift             = recommended target / code minimum
 *
 * H (the hazard-shift ratio) now comes from real per-town, per-site-class data
 * in locationHazard.ts, not a placeholder. The one remaining placeholder is the
 * moderate/high/extreme banding cutoffs in classifyShiftBand below, which bucket
 * that real H into a qualitative band for homeowner-facing messaging.
 *
 * F_SR337 is company-set: state the basis in the published methodology statement.
 *
 * No practical ceiling is modelled. At a whole-house total, added seismic demand
 * can generally be met by adding bracing capacity elsewhere in the building
 * (more bracing walls, or converting non-bracing walls into bracing walls), so
 * there is no fixed multiple of code minimum beyond which timber bracing stops
 * being viable the way there would be for a single wall line's connections.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Calibration parameters. COMPANY-SET. Document the basis publicly.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SR337 damage-control factor at 2004 hazard (before NSHM-2022).
 * BRANZ SR337 concluded minimum NZS 3604 seismic bracing must rise ~50% to hold
 * ~1% damage-control drift. This is the single most-scrutinised number in the
 * engine. How much reserve/system capacity you credit sits here. State it.
 */
export const F_SR337 = 1.5;

// ─────────────────────────────────────────────────────────────────────────────
// MODE A: Designer (exact). Two inputs, totalled across the whole house.
// ─────────────────────────────────────────────────────────────────────────────

export interface DesignerInput {
  /** NZS 3604:2011 EARTHQUAKE bracing demand (BUs), summed across the whole house. */
  eqBu: number;
  /** NZS 3604:2011 WIND bracing demand (BUs), summed across the whole house. */
  windBu: number;
  /** Site hazard shift H = NSHM-2022 demand ÷ 3604 basis at this location. */
  H: number;
}

export interface DesignerResult {
  seismicTarget: number;
  recommendedTarget: number;
  codeMinimum: number;
  /** e.g. 1.06 = 106% of what you'd build to code. Multiply by 100 for display. */
  indicativeUpliftFactor: number;
  indicativeUpliftPct: number;
  governingAction: "earthquake" | "wind";
  /** Which resilience pathway(s) the result points to. */
  pathway: "either" | "demand-reduction-recommended";
}

export function computeDesignerResult(input: DesignerInput): DesignerResult {
  const { eqBu, windBu, H } = input;

  const seismicTarget = F_SR337 * H * eqBu;
  const recommendedTarget = Math.max(seismicTarget, windBu);
  const codeMinimum = Math.max(eqBu, windBu);
  const indicativeUpliftFactor = recommendedTarget / codeMinimum;
  // Governance reflects which 3604 load case drives the code-minimum design
  // (eqBu vs windBu), not which post-scaling target is numerically larger.
  const governingAction = eqBu >= windBu ? "earthquake" : "wind";

  const pathway: DesignerResult["pathway"] =
    indicativeUpliftFactor <= 1.001
      ? "either" // wind already covered it; nothing extra needed
      : "demand-reduction-recommended"; // add capacity across the house, or reduce demand at the base

  return {
    seismicTarget,
    recommendedTarget,
    codeMinimum,
    indicativeUpliftFactor,
    indicativeUpliftPct: Math.round(indicativeUpliftFactor * 100),
    governingAction,
    pathway,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE B: Homeowner (awareness). Band, not number. Nests under Mode A.
// ─────────────────────────────────────────────────────────────────────────────

export type ShiftBand = "moderate" | "high" | "extreme";

export const HAZARD_BAND_LABELS: Record<ShiftBand, string> = {
  moderate: "Moderate shift",
  high: "High shift",
  extreme: "Extreme shift",
};

/**
 * PLACEHOLDER thresholds. Buckets a real hazard-shift ratio H into a band for
 * homeowner-facing messaging. The banding cutoffs themselves are a judgment
 * call, not derived from the data; replace with real thresholds once defined.
 */
export function classifyShiftBand(H: number): ShiftBand {
  if (H < 1.3) return "moderate";
  if (H < 1.8) return "high";
  return "extreme";
}

export interface HomeownerInput {
  /** Real hazard-shift ratio H for this location and site class. */
  H: number;
  /** Location-linked governance hint: is wind the likely governing action for a typical house here? Omit when not known for this location. */
  windLikelyGoverns?: boolean;
}

export interface HomeownerResult {
  /** Exact, geometry-free lead fact, safe to state precisely. */
  hazardShiftStatement: string;
  band: ShiftBand;
  bandLabel: string;
  /** Qualitative, never a bracing-unit number. */
  governanceFlavour: string;
  callToAction: string;
  /** Flag for UI: this is provisional pending real design numbers. */
  provisional: true;
}

export function getHomeownerResult(input: HomeownerInput): HomeownerResult {
  const { H, windLikelyGoverns } = input;
  const pct = Math.round((H - 1) * 100);
  const band = classifyShiftBand(H);

  return {
    hazardShiftStatement:
      `Estimated earthquake hazard for your area is roughly ${pct}% higher than ` +
      `the NZS 3604:2011 code baseline assumed.`,
    band,
    bandLabel: HAZARD_BAND_LABELS[band],
    governanceFlavour:
      windLikelyGoverns === undefined
        ? "Whether wind or earthquake demand governs on this site depends on your specific design. Your actual design numbers will confirm which load case is critical."
        : windLikelyGoverns
          ? "For a typical house here, wind loads likely already cover much of this, " +
            "so the practical increase may be small. Your actual design numbers will confirm."
          : "For a typical house here, earthquake demand likely governs, so this is " +
            "worth taking seriously. Your actual design numbers will confirm.",
    callToAction:
      "Once you have a concept design with bracing numbers, run the designer tool " +
      "or talk to us to see the specific picture for your home.",
    provisional: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail copy: use these strings in the UI so language stays consistent.
// ─────────────────────────────────────────────────────────────────────────────

export const COPY = {
  outputLabel: "Indicative resilience multiplier",
  goal: "Damage-control performance",
  mathBasis:
    "Derived from BRANZ SR337 structural principles and the NSHM-2022 hazard shift for your area.",
  warning:
    "This indicates relative demand, not a design specification. Any build requires specific engineering design. Preliminary information only, not professional engineering, legal, or insurance advice.",
} as const;
