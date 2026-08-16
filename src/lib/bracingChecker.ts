/**
 * Residential Seismic Bracing Checker: calculation engine
 * -------------------------------------------------------
 * Framework-agnostic. No dependencies. Drops into Astro / React / vanilla.
 *
 * Implements the governance-aware logic from the v2 concept brief:
 *   hazard-only target            = H * EQ_3604   (NSHM-2022 shift alone, no SR337 margin)
 *   seismic damage-control target = F_SR337 * hazard-only target   (adds the SR337 margin)
 *   recommended target            = max(seismic target, WIND_3604)   (wind hasn't moved)
 *   code minimum you'd build       = max(EQ_3604, WIND_3604)
 *   indicative uplift             = recommended target / code minimum
 * The same recommended-target/code-minimum shape is also applied to the
 * hazard-only target alone, giving a second, smaller uplift figure that
 * isolates just the hazard-model change from the added SR337 margin.
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
  /** H * eqBu: target from the NSHM-2022 hazard shift alone, before the SR337 damage-control margin. Not floored - can sit below eqBu or code minimum. */
  hazardOnlyTarget: number;
  /** F_SR337 * max(hazardOnlyTarget, eqBu): the SR337 margin applied to the earthquake-only track (never wind), floored at NZS 3604's own EQ demand first. Can still sit below the overall code minimum when wind governs - see recommendedTarget, which floors that in. */
  seismicTarget: number;
  /** hazardOnlyTarget floored at the overall code minimum (not just eqBu): the pre-SR337 "what you'd build regardless" baseline shown in the UI, so it never sits below the wind bar even when wind governs. */
  recommendedHazardOnlyTarget: number;
  /** max(seismicTarget, codeMinimum): the SR337-inclusive earthquake track, floored at the overall code minimum so it never implies less than wind demands regardless of what the earthquake track alone works out to. */
  recommendedTarget: number;
  codeMinimum: number;
  /** recommendedHazardOnlyTarget / codeMinimum - always >= 1, the pre-SR337 uplift over whatever you'd build regardless (wind included). */
  hazardOnlyUpliftFactor: number;
  hazardOnlyUpliftPct: number;
  /** recommendedTarget / codeMinimum - always >= 1. e.g. 1.06 = 106% of what you'd build to code. Multiply by 100 for display. */
  indicativeUpliftFactor: number;
  indicativeUpliftPct: number;
  governingAction: "earthquake" | "wind";
  /** Which resilience pathway(s) the result points to. */
  pathway: "either" | "demand-reduction-recommended";
}

export function computeDesignerResult(input: DesignerInput): DesignerResult {
  const { eqBu, windBu, H } = input;

  const codeMinimum = Math.max(eqBu, windBu);
  const hazardOnlyTarget = H * eqBu;
  // SR337's damage-control margin is an earthquake-specific finding (seismic
  // drift control), so it's applied to an earthquake-only figure - the
  // larger of NZS 3604's own EQ demand (eqBu) and the hazard-shifted EQ
  // demand (hazardOnlyTarget) - never to a wind-governed number. Wind isn't
  // subject to the SR337 margin at all.
  const eqTrackFloor = Math.max(hazardOnlyTarget, eqBu);
  const seismicTarget = F_SR337 * eqTrackFloor;
  // recommendedHazardOnlyTarget floors at the overall code minimum (not just
  // eqBu): this is the pre-SR337 "what would you build regardless" baseline
  // shown in the UI, so if wind already exceeds the hazard-shifted EQ
  // figure, the baseline is wind's code minimum, not the (lower) EQ-only
  // figure - otherwise the chart would draw the pre-SR337 baseline below the
  // wind bar it's meant to sit at or above.
  const recommendedHazardOnlyTarget = Math.max(hazardOnlyTarget, codeMinimum);
  // Final whole-house target: the SR337-inclusive EQ track, floored again at
  // code minimum so it never implies less than wind (or 3604 EQ) demands
  // regardless of what the EQ track alone works out to.
  const recommendedTarget = Math.max(seismicTarget, codeMinimum);
  const hazardOnlyUpliftFactor = recommendedHazardOnlyTarget / codeMinimum;
  const indicativeUpliftFactor = recommendedTarget / codeMinimum;
  // Governance reflects which 3604 load case drives the code-minimum design
  // (eqBu vs windBu), not which post-scaling target is numerically larger.
  const governingAction = eqBu >= windBu ? "earthquake" : "wind";

  const pathway: DesignerResult["pathway"] =
    indicativeUpliftFactor <= 1.001
      ? "either" // wind (or the floor) already covers it; nothing extra needed
      : "demand-reduction-recommended"; // add capacity across the house, or reduce demand at the base

  return {
    hazardOnlyTarget,
    seismicTarget,
    recommendedHazardOnlyTarget,
    recommendedTarget,
    codeMinimum,
    hazardOnlyUpliftFactor,
    hazardOnlyUpliftPct: Math.round(hazardOnlyUpliftFactor * 100),
    indicativeUpliftFactor,
    indicativeUpliftPct: Math.round(indicativeUpliftFactor * 100),
    governingAction,
    pathway,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODE B: Homeowner (awareness). Band, not number. Nests under Mode A.
// ─────────────────────────────────────────────────────────────────────────────

export type ShiftBand = "none" | "moderate" | "high" | "extreme";

export const HAZARD_BAND_LABELS: Record<ShiftBand, string> = {
  none: "No hazard increase",
  moderate: "Moderate shift",
  high: "High shift",
  extreme: "Extreme shift",
};

/**
 * Buckets a real hazard-shift ratio H into a band for homeowner-facing
 * messaging. Calibrated against the full locationHazard.ts dataset (133
 * towns, H = ts1170 / nzs3604 straight from locations_final.tsv): at site
 * class C, 105/133 towns sit at H <= 1 (the updated hazard model implies no
 * increase over NZS 3604 at all), so that group gets its own "none" band
 * rather than being folded into "moderate". At site class D/E every single
 * town sits at H <= 1 (max across the dataset is 0.85) - the updated hazard
 * model shows no increase anywhere at D/E, so "high" and "extreme" are
 * unreachable there entirely, not just rare; this reflects real physics
 * (D/E soils were already conservatively coded) rather than a calibration
 * gap. At site class AB, max H is 1.83, so "extreme" (H >= 1.8) is reachable
 * only there and only barely.
 */
export function classifyShiftBand(H: number): ShiftBand {
  if (H <= 1) return "none";
  if (H < 1.3) return "moderate";
  if (H < 1.8) return "high";
  return "extreme";
}

export interface HomeownerInput {
  /** Real hazard-shift ratio H for this location and site class. */
  H: number;
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
  const { H } = input;
  const pct = Math.round((H - 1) * 100);
  const band = classifyShiftBand(H);

  const hazardComparison = pct > 0
    ? `roughly ${pct}% higher than what NZS 3604 already requires, just to achieve minimum performance`
    : `no higher than what NZS 3604 already requires to achieve minimum performance`;

  const windGovernance =
    "Consider speaking with your designer about what a low damage outcome might look like for your project. " +
    "They can input the design numbers into the designer tab of this tool for a more detailed consideration.";

  return {
    hazardShiftStatement:
      `Knowledge of seismic hazard across Aotearoa has changed since the current house design rules (NZS 3604) were written. ` +
      `In your area, the latest models suggest a hazard that is ${hazardComparison}.`,
    band,
    bandLabel: HAZARD_BAND_LABELS[band],
    governanceFlavour:
      band === "none"
        ? "The updated hazard model itself points to no increase here - any extra bracing shown above comes entirely from the SR337 damage-control margin, not a change in seismic hazard. " +
          windGovernance
        : windGovernance,
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
