// -----------------------------------------------------------------------------
// Domain constants + report synthesis.
//
// Aggregates Approved triage_records and injects them into a Markdown template
// modelled on the NZSEE "Learning from Earthquakes" (LFE) VERT significant-event
// report format: metadata header, introduction, seismotectonic/code context,
// event characteristics, building damage BY REGION with structural narratives,
// aggregate statistics, observed failure mechanisms, and geotechnical notes.
// -----------------------------------------------------------------------------

// ---- Constants --------------------------------------------------------------

export const DAMAGE_SCORES = [0, 1, 2, 3, 4];

export const DAMAGE_LABEL = {
  0: 'D0 — None / negligible',
  1: 'D1 — Slight',
  2: 'D2 — Moderate',
  3: 'D3 — Heavy',
  4: 'D4 — Collapse / destruction',
};

// green -> dark red ramp
export const DAMAGE_COLOR = {
  0: '#2e7d32',
  1: '#9acd32',
  2: '#f9a825',
  3: '#e53935',
  4: '#7b1414',
};

// Japanese seismic-code era buckets (key thresholds: 1981 shin-taishin, 2000 rev.)
export const CODE_ERAS = ['pre-1981', '1981-2000', 'post-2000', 'unknown'];

export const RETROFIT_OPTIONS = [
  'none',
  'tension-only bracing',
  'supplementary friction dampers',
  'other (see notes)',
];

// ---- Aggregation helpers ----------------------------------------------------

function tally(values) {
  const out = {};
  for (const v of values) {
    if (v === null || v === undefined || v === '') continue;
    const k = String(v);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function groupBy(records, keyFn) {
  const map = new Map();
  for (const r of records) {
    const k = keyFn(r) || 'Unspecified';
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function mdCountTable(header, counts) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '_No data._\n';
  const total = entries.reduce((s, [, n]) => s + n, 0);
  let out = `| ${header} | Count | Share |\n| --- | ---: | ---: |\n`;
  for (const [k, n] of entries) out += `| ${k} | ${n} | ${((n / total) * 100).toFixed(1)}% |\n`;
  out += `| **Total** | **${total}** | **100%** |\n`;
  return out;
}

function damageScoreTable(records) {
  const counts = {};
  for (const s of DAMAGE_SCORES) counts[DAMAGE_LABEL[s]] = 0;
  for (const r of records) {
    if (r.damage_score !== null && r.damage_score !== undefined)
      counts[DAMAGE_LABEL[r.damage_score]] += 1;
  }
  return mdCountTable('Damage score', counts);
}

// Per-region structural performance narrative (auto-drafted; reviewer expands).
function regionNarrative(name, records) {
  const n = records.length;
  const heavy = records.filter((r) => r.damage_score >= 3).length;
  const heavyPct = n ? Math.round((heavy / n) * 100) : 0;
  const eras = tally(records.map((r) => r.code_era));
  const mechs = tally(records.map((r) => r.failure_mechanism));
  const retros = records.filter(
    (r) => r.observed_retrofits && r.observed_retrofits.toLowerCase() !== 'none'
  );

  const topMech = Object.entries(mechs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);
  const dominantEra = Object.entries(eras).sort((a, b) => b[1] - a[1])[0];

  let out = `### ${name}\n\n`;
  out += `A total of **${n}** structures were inspected and approved in ${name}. `;
  out += `Of these, **${heavy} (${heavyPct}%)** sustained heavy-to-severe damage (score D3–D4). `;
  if (dominantEra) {
    out += `The affected building stock was predominantly of the **${dominantEra[0]}** seismic-code era (${dominantEra[1]} structures). `;
  }
  if (topMech.length) {
    out += `Recurring failure mechanisms observed: ${topMech.join('; ')}. `;
  }
  if (retros.length) {
    const rt = tally(retros.map((r) => r.observed_retrofits));
    const rtStr = Object.entries(rt)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ');
    out += `Seismic retrofits were noted on ${retros.length} structure(s): ${rtStr}. `;
  } else {
    out += `No seismic retrofits (e.g. tension-only bracing, supplementary friction dampers) were observed in this area. `;
  }
  out += `\n\n_[Reviewer: expand with representative case studies and figures.]_\n\n`;
  out += `![Figure — representative damage in ${name}](media/${slug(name)}_01.jpg)\n`;
  out += `*Figure. Representative building damage in ${name}. [Insert caption and source.]*\n`;
  return out;
}

function inventoryTable(records) {
  let out =
    '| ID | Region | Score | Code era | Failure mechanism | Retrofit | Reviewer |\n' +
    '| --- | --- | :---: | --- | --- | --- | --- |\n';
  for (const r of records) {
    out += `| ${String(r.id).slice(0, 8)} | ${r.region ?? '—'} | D${r.damage_score ?? '—'} | ${r.code_era ?? '—'} | ${r.failure_mechanism ?? '—'} | ${r.observed_retrofits ?? '—'} | ${r.reviewed_by ?? '—'} |\n`;
  }
  return out;
}

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---- Master template --------------------------------------------------------

/**
 * @param {Array<object>} records  Approved triage_records rows.
 * @param {object} meta            Event metadata (see ReportGenerator defaults).
 * @returns {string} Markdown draft report.
 */
export function buildReport(records, meta) {
  const approved = records.filter((r) => r.status === 'Approved');
  const now = new Date().toISOString().slice(0, 10);

  const byRegion = groupBy(approved, (r) => r.region);
  const totalHeavy = approved.filter((r) => r.damage_score >= 3).length;

  const regionSections = [...byRegion.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, recs]) => regionNarrative(name, recs))
    .join('\n');

  return `# Learning from Earthquakes — Significant Event Report
## ${meta.eventName} — Version ${meta.version}

**Report issued:** ${now}
**Magnitude (Mw):** ${meta.magnitude}
**Depth (km):** ${meta.depth}
**Location (geographical):** ${meta.locationName}
**Location (lat/long):** ${meta.locationLatLong}
**Time and date:** ${meta.eventDatetime}
**Faulting mechanism:** ${meta.faulting}
**Maximum Modified Mercalli Intensity:** ${meta.maxMMI}
**LFE programme interest:** ${meta.lfeInterest}
**Virtual Earthquake Reconnaissance Team (VERT) deployment:** ${meta.vertDeployment}
**Physical mission deployment:** ${meta.physicalDeployment}
**Tsunami alert issued:** ${meta.tsunami}

![Figure 1 — epicentre location and shaking intensity](media/figure1_shakemap.png)
*Figure 1. Epicentre location and shaking intensity. [Insert ShakeMap source.]*

---

## Virtual Earthquake Reconnaissance Team (VERT)

This report was prepared through the voluntary contribution of: ${meta.contributors}

## Introduction

This report presents the findings of a virtual reconnaissance conducted by the
Learning from Earthquakes (LfE) group of the New Zealand Society for Earthquake
Engineering (NZSEE) following the ${meta.eventName}. The initial assessment is
based on information gathered from publicly available sources — including social
media, news feeds, and satellite imagery — used to geolocate buildings and
assess observed damage. Findings are preliminary and may be revised as
additional information becomes available.

Crowdsourced media were ingested and given a preliminary AI triage (damage
score, seismic-code era, failure mechanism, and observed retrofits), then
reviewed, corrected, and approved by volunteer structural engineers before
inclusion below. **${approved.length}** engineer-approved building observations
inform this draft, of which **${totalHeavy}** sustained heavy-to-severe damage.

## Seismotectonic Setting and Recent Earthquake History

_[Reviewer: summarise the regional tectonic setting, causative fault, and recent
seismicity relevant to ${meta.eventName}.]_

## Seismic Codes and Building Code Eras

Observations are grouped by seismic-code era. For Japan the key thresholds are
the 1981 revision (*shin-taishin*) and the 2000 revision. The distribution of
inspected structures by code era is:

${mdCountTable('Code era', tally(approved.map((r) => r.code_era)))}

## Event Characteristics

| Parameter | Value |
| --- | --- |
| Magnitude (Mw) | ${meta.magnitude} |
| Depth (km) | ${meta.depth} |
| Location | ${meta.locationName} (${meta.locationLatLong}) |
| Time and date | ${meta.eventDatetime} |
| Focal mechanism | ${meta.faulting} |
| Maximum MMI | ${meta.maxMMI} |
| Tsunami | ${meta.tsunami} |

## Structural Performance — Summary Statistics

Total structures inspected and approved: **${approved.length}**.

### Damage-score distribution

${damageScoreTable(approved)}

### Observations by region

${mdCountTable('Region', tally(approved.map((r) => r.region)))}

### Retrofit performance

${mdCountTable('Observed retrofit', tally(approved.map((r) => r.observed_retrofits)))}

_[Reviewer: comment on the performance of retrofitted structures — in particular
any tension-only bracing or supplementary friction dampers — relative to
comparable un-retrofitted stock.]_

## Building Damage by Region

${regionSections}

## Observed Failure Mechanisms

${mdCountTable('Failure mechanism', tally(approved.map((r) => r.failure_mechanism)))}

_[Reviewer: discuss the most significant mechanisms — e.g. reinforced-concrete
soft-story mechanisms, masonry infill in-plane vs out-of-plane response,
beam-column joint failure — with reference to representative structures in the
appendix.]_

## Geotechnical Observations

_[Reviewer: summarise ground damage — liquefaction, lateral spreading, slope
failures, foundation settlement, and any effects on lifelines and
infrastructure. Note imagery resolution limits on geotechnical interpretation.]_

## Data Provenance and Acknowledgements

Observations were sourced from crowdsourced media, triaged by an automated
pipeline (perceptual-hash deduplication followed by multimodal LLM structural
assessment), and verified by named VERT volunteer engineers. Per-record source
links are retained in the underlying database.

---

## Appendix A — Approved Observation Inventory

${inventoryTable(approved)}

---

_Generated by the VERT Kumamoto Triage Hub on ${now}. This is an automated
draft: all bracketed placeholders and figure references require reviewer
completion before publication._
`;
}
