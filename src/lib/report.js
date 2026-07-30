// -----------------------------------------------------------------------------
// Report synthesis. Aggregates Approved triage_records into a Markdown draft
// modelled on the NZSEE "Learning from Earthquakes" (LFE) report format:
// metadata header, introduction, context, event characteristics, then damage
// grouped by observation type (buildings by region, plus ground failure,
// landslides, and lifelines), aggregate statistics, and a data-provenance note.
//
// Style: short dashes only, no em dashes.
// -----------------------------------------------------------------------------

import {
  DAMAGE_SCORES,
  DAMAGE_LABEL,
  OBSERVATION_LABEL,
  SOURCE_LABEL,
} from './constants.js';

// Re-export so existing imports from './report.js' keep working.
export {
  DAMAGE_SCORES,
  CLASSIFICATION_SCORES,
  GREAT_PERFORMANCE,
  isDamageScore,
  DAMAGE_LABEL,
  DAMAGE_COLOR,
  CODE_ERAS,
  RETROFIT_OPTIONS,
  SOURCE_TYPES,
  SOURCE_LABEL,
  SOURCE_COLOR,
  OBSERVATION_TYPES,
  OBSERVATION_LABEL,
  PRECISION_OPTIONS,
} from './constants.js';

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
  const share = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0');
  let out = `| ${header} | Count | Share |\n| --- | ---: | ---: |\n`;
  for (const [k, n] of entries) out += `| ${k} | ${n} | ${share(n)}% |\n`;
  out += `| **Total** | **${total}** | **${total > 0 ? '100' : '0'}%** |\n`;
  return out;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function damageScoreTable(records) {
  const counts = {};
  for (const s of DAMAGE_SCORES) counts[DAMAGE_LABEL[s]] = 0;
  for (const r of records) {
    if (DAMAGE_SCORES.includes(Number(r.damage_score))) {
      counts[DAMAGE_LABEL[Number(r.damage_score)]] += 1;
    }
  }
  return mdCountTable('Damage score', counts);
}

function regionNarrative(name, records) {
  const n = records.length;
  const heavy = records.filter((r) => r.damage_score === 3 || r.damage_score === 4).length;
  const heavyPct = n ? Math.round((heavy / n) * 100) : 0;
  const eras = tally(records.map((r) => r.code_era));
  const mechs = tally(records.map((r) => r.failure_mechanism));
  const retros = records.filter(
    (r) => r.observed_retrofits && r.observed_retrofits.toLowerCase() !== 'none'
  );
  const topMech = Object.entries(mechs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);
  const dominantEra = Object.entries(eras).sort((a, b) => b[1] - a[1])[0];

  let out = `#### ${name}\n\n`;
  out += `A total of ${n} structures were inspected and approved in ${name}. `;
  out += `Of these, ${heavy} (${heavyPct}%) sustained heavy-to-severe damage (score D3-D4). `;
  if (dominantEra) {
    out += `The affected stock was predominantly of the ${dominantEra[0]} seismic-code era (${dominantEra[1]} structures). `;
  }
  if (topMech.length) out += `Recurring failure mechanisms: ${topMech.join('; ')}. `;
  if (retros.length) {
    const rt = tally(retros.map((r) => r.observed_retrofits));
    const rtStr = Object.entries(rt).map(([k, v]) => `${k} (${v})`).join(', ');
    out += `Seismic retrofits were noted on ${retros.length} structure(s): ${rtStr}. `;
  } else {
    out += `No seismic retrofits were observed in this area. `;
  }
  out += `\n\n_[Reviewer: expand with representative case studies and figures.]_\n\n`;
  out += `![Figure - representative damage in ${name}](media/${slug(name)}_01.jpg)\n`;
  out += `*Figure. Representative building damage in ${name}. [Insert caption and source.]*\n`;
  return out;
}

function categoryNarrative(records) {
  const n = records.length;
  const byRegion = tally(records.map((r) => r.region));
  const mechs = tally(records.map((r) => r.failure_mechanism));
  const topMech = Object.entries(mechs).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m]) => m);
  let out = `${n} observation(s) approved. `;
  const regions = Object.keys(byRegion);
  if (regions.length) out += `Affected areas: ${regions.join(', ')}. `;
  if (topMech.length) out += `Reported mechanisms / features: ${topMech.join('; ')}. `;
  out += `\n\n_[Reviewer: expand with detail and figures.]_\n`;
  return out;
}

function inventoryTable(records) {
  let out =
    '| Site | Source | Type | Region | Score | Mechanism | Reviewer |\n' +
    '| --- | --- | --- | --- | :---: | --- | --- |\n';
  for (const r of records) {
    out += `| ${r.site_id ?? '-'} | ${SOURCE_LABEL[r.source_type] ?? r.source_type ?? '-'} `;
    out += `| ${OBSERVATION_LABEL[r.observation_type] ?? r.observation_type ?? '-'} `;
    out += `| ${r.region ?? '-'} | D${r.damage_score ?? '-'} | ${r.failure_mechanism ?? '-'} | ${r.reviewed_by ?? '-'} |\n`;
  }
  return out;
}

export function buildReport(records, meta) {
  const approved = records.filter((r) => r.status === 'Approved');
  const now = new Date().toISOString().slice(0, 10);

  const buildings = approved.filter((r) => (r.observation_type ?? 'building') === 'building');
  const geotech = approved.filter((r) => r.observation_type === 'geotechnical');
  const landslides = approved.filter((r) => r.observation_type === 'landslide');
  const lifelines = approved.filter((r) => r.observation_type === 'lifeline');
  const tsunami = approved.filter((r) => r.observation_type === 'tsunami');
  const greatPerformers = approved.filter((r) => r.damage_score === 5);

  const byRegion = groupBy(buildings, (r) => r.region);
  const buildingRegionSections = [...byRegion.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, recs]) => regionNarrative(name, recs))
    .join('\n');

  const totalHeavy = buildings.filter((r) => r.damage_score === 3 || r.damage_score === 4).length;

  const groundSection =
    geotech.length || landslides.length
      ? `### Ground Damage\n\n` +
        (geotech.length ? `#### Geotechnical / ground failure\n\n${categoryNarrative(geotech)}\n` : '') +
        (landslides.length ? `#### Landslides / slope failures\n\n${categoryNarrative(landslides)}\n` : '')
      : `### Ground Damage\n\n_[Reviewer: no geotechnical or landslide observations approved yet. Summarise liquefaction, lateral spreading, settlement, and slope failures here.]_\n`;

  const lifelineSection = lifelines.length
    ? `### Lifelines and Infrastructure\n\n${categoryNarrative(lifelines)}\n`
    : `### Lifelines and Infrastructure\n\n_[Reviewer: no lifeline observations approved yet. Summarise impacts to roads, bridges, water, power, and telecommunications here.]_\n`;

  const tsunamiSection = tsunami.length ? `### Tsunami Effects\n\n${categoryNarrative(tsunami)}\n` : '';

  const performanceSection = greatPerformers.length
    ? `## Notable Good Performance\n\n${greatPerformers.length} structure(s) or asset(s) were noted for performing notably well. ` +
      `This includes cases where modern design, base isolation, or retrofit measures appear to have limited damage. ` +
      `Documenting good performance is as valuable as documenting failure.\n\n` +
      mdCountTable('Type', tally(greatPerformers.map((r) => OBSERVATION_LABEL[r.observation_type] ?? r.observation_type))) +
      `\n_[Reviewer: describe the design or retrofit features credited with the good performance.]_\n`
    : '';

  return `# Learning from Earthquakes - Significant Event Report
## ${meta.eventName} - Version ${meta.version}

**Report issued:** ${now}  
**Magnitude (Mw):** ${meta.magnitude}  
**Depth (km):** ${meta.depth}  
**Location (geographical):** ${meta.locationName}  
**Location (lat/long):** ${meta.locationLatLong}  
**Time and date:** ${meta.eventDatetime}  
**Faulting mechanism:** ${meta.faulting}  
**Maximum Modified Mercalli Intensity:** ${meta.maxMMI}  
**Tsunami alert issued:** ${meta.tsunami}

![Figure 1 - epicentre location and shaking intensity](media/figure1_shakemap.png)
*Figure 1. Epicentre location and shaking intensity. [Insert ShakeMap source.]*

---

## Virtual Earthquake Reconnaissance Team (VERT)

This report was prepared through the voluntary contribution of: ${meta.contributors}

## Introduction

This report presents the findings of a virtual reconnaissance conducted by the
Learning from Earthquakes (LfE) group of NZSEE following the ${meta.eventName}.
The assessment draws on publicly available sources (social media via Bluesky,
news and RSS feeds) together with observations entered directly by volunteer
engineers. Each record was given a preliminary AI triage, then reviewed,
corrected, and approved by a second volunteer before inclusion. Findings are
preliminary and may be revised as further information becomes available.

**${approved.length}** engineer-approved observations inform this draft:
${buildings.length} building, ${geotech.length} geotechnical, ${landslides.length} landslide, ${lifelines.length} lifeline, and ${tsunami.length} tsunami. Of the building observations, ${totalHeavy} sustained heavy-to-severe damage.

## Data Sources and Provenance

${mdCountTable('Source', tally(approved.map((r) => SOURCE_LABEL[r.source_type] ?? r.source_type)))}

Location precision (exact pin vs geocoded approximation):

${mdCountTable('Precision', tally(approved.map((r) => r.location_precision)))}

## Seismotectonic Setting and Recent Earthquake History

_[Reviewer: summarise the regional tectonic setting, causative fault, and recent seismicity relevant to ${meta.eventName}.]_

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

## Structural Performance - Summary Statistics

Total building observations approved: ${buildings.length}.

### Damage-score distribution (buildings)

${damageScoreTable(buildings)}

### Building observations by region

${mdCountTable('Region', tally(buildings.map((r) => r.region)))}

### Seismic-code era (buildings)

${mdCountTable('Code era', tally(buildings.map((r) => r.code_era)))}

### Retrofit performance (buildings)

${mdCountTable('Observed retrofit', tally(buildings.map((r) => r.observed_retrofits)))}

_[Reviewer: comment on the performance of retrofitted structures, in particular any tension-only bracing or supplementary friction dampers, relative to comparable un-retrofitted stock.]_

## Building Damage by Region

${buildingRegionSections || '_[Reviewer: no building observations approved yet.]_'}

## Observed Failure Mechanisms (buildings)

${mdCountTable('Failure mechanism', tally(buildings.map((r) => r.failure_mechanism)))}

_[Reviewer: discuss the most significant mechanisms, e.g. soft-story mechanisms, masonry infill in-plane vs out-of-plane response, beam-column joint failure.]_

${groundSection}

${lifelineSection}
${tsunamiSection}
${performanceSection}
## Data Provenance and Acknowledgements

Observations were sourced from crowdsourced media (Bluesky, news/RSS) and direct volunteer entry, triaged by an automated pipeline (perceptual-hash deduplication, multimodal LLM assessment, and geocoding of place names), then verified by named VERT volunteers. Per-record source links are retained in the underlying database.

---

## Appendix A - Approved Observation Inventory

${inventoryTable(approved)}

---

_Generated by the VERT Kumamoto Triage Hub on ${now}. This is an automated draft: all bracketed placeholders and figure references require reviewer completion before publication._
`;
}
