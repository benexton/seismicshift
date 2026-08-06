import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, AlignmentType, HeadingLevel, ImageRun, Header, Footer,
  PageNumber, PageBreak, ExternalHyperlink, InternalHyperlink, Bookmark, TableOfContents,
} from 'docx';
import { DAMAGE_SCORES, DAMAGE_LABEL, observationTypesLabel, fmtDate, phOr } from './constantsLfe.js';
import { parseReportSections } from './reportSections.js';

const MAROON = '8A1538';
const MAROON_LT = '9E2A3F';
const GREY = '595959';
const LIGHTGREY = '808080';
const RULE = 'C9B3BA';
const HEADSHADE = '8A1538';
const LABELSHADE = 'F3E7EA';
const BODY = 'Calibri';
const TABLE_W = 9072;

function inline(text, base = {}) {
  const parts = String(text ?? '').split('**');
  const runs = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '') continue;
    runs.push(new TextRun({ text: parts[i], bold: (i % 2 === 1) || !!base.bold, italics: base.italics, color: base.color, size: base.size ?? 22, font: BODY }));
  }
  if (!runs.length) runs.push(new TextRun({ text: '', size: base.size ?? 22, font: BODY }));
  return runs;
}

const allBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: RULE }, bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE },
  left: { style: BorderStyle.SINGLE, size: 4, color: RULE }, right: { style: BorderStyle.SINGLE, size: 4, color: RULE },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: RULE }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: RULE },
};

function heading(level, text, extraRuns = []) {
  const map = {
    1: { size: 32, color: MAROON, before: 40, after: 120 },
    2: { size: 26, color: MAROON, before: 300, after: 120 },
    3: { size: 23, color: MAROON_LT, before: 220, after: 80 },
  };
  const s = map[level] || map[3];
  return new Paragraph({ heading: HeadingLevel[`HEADING_${level}`], keepNext: true, spacing: { before: s.before, after: s.after },
    children: [new TextRun({ text, bold: true, color: s.color, size: s.size, font: BODY }), ...extraRuns] });
}

function para(text, opts = {}) {
  return new Paragraph({ alignment: opts.align ?? AlignmentType.JUSTIFIED, spacing: { after: opts.after ?? 140, line: 276 }, children: inline(text, { size: 22, ...opts }) });
}

function mdParas(text) {
  const out = [];
  for (const raw of String(text ?? '').split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    if (/^#{1,3}\s+/.test(t)) out.push(heading(3, t.replace(/^#{1,3}\s+/, '')));
    else if (/^[-*]\s+/.test(t)) out.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: inline(t.replace(/^[-*]\s+/, ''), { size: 22 }) }));
    else out.push(para(t));
  }
  return out;
}

function metaTable(rows) {
  return new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [3400, 5672], borders: allBorders,
    rows: rows.map(([k, v]) => new TableRow({ children: [
      new TableCell({ width: { size: 3400, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: LABELSHADE }, margins: { top: 40, bottom: 40, left: 90, right: 90 }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: MAROON, size: 20, font: BODY })] })] }),
      new TableCell({ width: { size: 5672, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 90, right: 90 }, children: [new Paragraph({ children: [new TextRun({ text: String(v ?? ''), size: 20, font: BODY })] })] }),
    ] })) });
}

function codeTimelineTable(entries) {
  const widths = [1400, 2800, 4872];
  const head = new TableRow({ tableHeader: true, children: ['Year(s)', 'Code', 'Description'].map((h, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEADSHADE }, margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20, font: BODY })] })] })) });
  const rows = entries.map((en) => new TableRow({ children: [
    `${en.year_start}${en.year_end ? `-${en.year_end}` : ''}`, en.title, en.description ?? '',
  ].map((c, i) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [new Paragraph({ children: inline(String(c), { size: 20 }) })] })) }));
  return new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: widths, borders: allBorders, rows: [head, ...rows] });
}

function countTable(header, counts) {
  const entries = Object.entries(counts);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const head = new TableRow({ tableHeader: true, children: [header, 'Count', 'Share'].map((h, i) => new TableCell({
    width: { size: i === 0 ? 5072 : 2000, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEADSHADE }, margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20, font: BODY })] })] })) });
  const rows = entries.map(([k, n]) => new TableRow({ children: [k, String(n), total ? `${((n / total) * 100).toFixed(1)}%` : '0%'].map((c, i) => new TableCell({
    width: { size: i === 0 ? 5072 : 2000, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [new Paragraph({ alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.RIGHT, children: inline(c, { size: 20 }) })] })) }));
  return new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [5072, 2000, 2000], borders: allBorders, rows: [head, ...rows] });
}

async function fetchImage(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const type = (buf[0] === 0x89 && buf[1] === 0x50) ? 'png' : 'jpg';
    return { data: buf, type };
  } catch { return null; }
}

function caption(text, extraRuns = []) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 },
    children: [new TextRun({ text, italics: true, color: MAROON_LT, size: 18, font: BODY }), ...extraRuns] });
}

function placeholder(text) {
  return new Paragraph({
    spacing: { before: 40, after: 140 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FCF3D6' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'E0A93A' } },
    children: [new TextRun({ text: `AUTHOR TO ADD: ${text}`, italics: true, color: '8A6D1B', size: 20, font: BODY })],
  });
}

function labelCounts(records, keyFn, fallback = 'Unspecified') {
  const c = {};
  for (const r of records) { const k = keyFn(r) || fallback; c[k] = (c[k] || 0) + 1; }
  return c;
}

// Observation type is multi-select, so a record can add to more than one
// bucket (a site tagged both "building" and "emergency_management" counts
// in both) - counts can sum to more than the record total, which is expected.
function multiTypeCounts(records) {
  const c = {};
  for (const r of records) {
    const types = r.observation_types?.length ? r.observation_types : ['other'];
    for (const t of types) c[t] = (c[t] || 0) + 1;
  }
  return c;
}

/**
 * Build the report as a Word (.docx) Blob, NZSEE-styled, with AI commentary
 * (structured JSON sections or a plain markdown block) woven through the
 * data-driven sections. Verified sites only.
 */
export async function buildReportDocxBlob(records, meta, conclusions, extra = {}) {
  const countrySections = extra.sections ?? [];
  const countryEntries = extra.entries ?? [];
  const attachments = extra.attachments ?? [];
  const usgsEventId = extra.usgsEventId ?? null;
  const hazard = extra.hazard ?? null;
  const approved = records.filter((r) => r.status === 'Approved');
  const buildings = approved.filter((r) => (r.observation_types || []).includes('building'));
  const now = fmtDate(new Date());

  // Computed up front, not just where the References section renders, so
  // inline superscript citations earlier in the document can look up a
  // source's fixed position in the list - a lookup, not a typed-in number,
  // so adding more references anywhere else in the report can never throw
  // existing citations out of sync.
  const refEarliest = new Map();
  const noteRef = (url, date) => {
    if (!url) return;
    const prev = refEarliest.get(url);
    if (!prev || (date && new Date(date) < new Date(prev))) refEarliest.set(url, date);
  };
  for (const r of approved) noteRef(r.source_url, r.created_at);
  for (const a of attachments) noteRef(a.source_url, a.created_at);
  const refList = [...refEarliest.entries()].sort((a, b) => new Date(a[1]) - new Date(b[1]))
    .map(([url, date]) => ({ url, date }));
  const usgsEventPageUrl = usgsEventId ? `https://earthquake.usgs.gov/earthquakes/eventpage/${usgsEventId}` : null;
  if (usgsEventPageUrl) refList.unshift({ url: usgsEventPageUrl, date: null, label: 'USGS event page' });
  const refIndex = new Map(refList.map((r, i) => [r.url, i + 1]));
  function cite(url) {
    const n = url ? refIndex.get(url) : undefined;
    if (!n) return [];
    return [new InternalHyperlink({ anchor: `ref-${n}`,
      children: [new TextRun({ text: `${n}`, superScript: true, bold: true, color: MAROON_LT, size: 16, font: BODY })] })];
  }

  const parsed = parseReportSections(conclusions);
  const sec = parsed?.structured ? parsed.sections : null;
  const aiNote = () => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'AI-assisted draft from the verified observations only. Review before use.', italics: true, color: GREY, size: 18, font: BODY })] });

  const children = [];
  const logo = await fetchImage('/NZSEELogo.png');
  if (logo) {
    children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 40 },
      children: [new ImageRun({ data: logo.data, type: logo.type, transformation: { width: 140, height: 56 } })] }));
  }
  children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'LEARNING FROM EARTHQUAKES', bold: true, color: MAROON_LT, size: 20, font: BODY, characterSpacing: 30 })] }));
  children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Significant Event Report', bold: true, color: MAROON, size: 48, font: BODY })] }));
  children.push(new Paragraph({ spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: MAROON } },
    children: [new TextRun({ text: `VERT ${meta.eventName || 'Event'} - Version ${meta.version || '1.0'}`, color: MAROON, size: 30, font: BODY })] }));
  children.push(metaTable([
    ['Report issued', now],
    ['Magnitude (Mw)', phOr(meta.magnitude)], ['Depth (km)', phOr(meta.depth)],
    ['Location (geographical)', phOr(meta.locationName)], ['Location (lat/long)', phOr(meta.locationLatLong)],
    ['Time and date', phOr(meta.eventDatetime)], ['Faulting mechanism', phOr(meta.faulting)],
    ['Maximum Modified Mercalli Intensity', phOr(meta.maxMMI)], ['Tsunami alert issued', phOr(meta.tsunami)],
    ['VERT deployment', phOr(meta.vertDeployment)], ['Physical mission deployment', phOr(meta.physicalMissionDeployment)],
  ]));
  children.push(heading(2, 'Contributors to this report'));
  if (meta.contributors) {
    children.push(para(`This report was written with the voluntary contributions of the following people: ${meta.contributors}`));
  } else {
    children.push(placeholder('names and affiliations of contributors (set on Event details above).'));
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading(2, 'Contents'));
  children.push(new Paragraph({ spacing: { after: 120 },
    children: [new TextRun({ text: "Right-click and choose \"Update Field\" to populate this list once open in Word.", italics: true, color: GREY, size: 18, font: BODY })] }));
  children.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  let figNo = 1;

  children.push(heading(2, 'Introduction'));
  if (sec?.introduction) { children.push(aiNote()); children.push(...mdParas(sec.introduction)); }
  children.push(placeholder(`event background and seismotectonic setting.${usgsEventId ? '' : " Set the event's USGS event id to auto-pull ShakeMap and ground-failure figures here."}`));

  const hazardFigs = (hazard ? [
    [hazard.intensityUrl, 'USGS ShakeMap - macroseismic intensity (MMI).'],
    [hazard.pgaUrl, 'USGS ShakeMap - peak ground acceleration (PGA).'],
    [hazard.pgvUrl, 'USGS ShakeMap - peak ground velocity (PGV).'],
    [hazard.liquefactionUrl, 'USGS Ground Failure - liquefaction probability.'],
    [hazard.landslideUrl, 'USGS Ground Failure - landslide probability.'],
  ] : []).filter(([url]) => url);
  if (hazardFigs.length) {
    children.push(heading(3, 'Key Event Graphics'));
    for (const [url, label] of hazardFigs) {
      const img = await fetchImage(url);
      if (!img) continue;
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 },
        children: [new ImageRun({ data: img.data, type: img.type, transformation: { width: 360, height: 270 } })] }));
      children.push(caption(`Figure ${figNo}. ${label} `, cite(usgsEventPageUrl)));
      figNo += 1;
    }
  }

  children.push(heading(2, `Seismic Code and Retrofit History${meta.country ? ` - ${meta.country}` : ''}`));
  if (countrySections.length > 0) {
    for (const s of countrySections) {
      children.push(heading(3, s.title));
      if (s.body_md) children.push(...mdParas(s.body_md));
    }
  } else {
    children.push(placeholder(meta.country
      ? `no Codes & standards entry found yet for ${meta.country} - add it in the Codes & standards tab so this and future events for that country benefit.`
      : "seismic code and retrofit history for this event's country. Set the event's country and add an entry in the Codes & standards tab to have this pulled in automatically."));
  }
  if (countryEntries.length > 0) children.push(codeTimelineTable(countryEntries));

  children.push(heading(2, 'Summary Statistics'));
  children.push(para(`${approved.length} verified observation(s), including ${buildings.length} building observation(s).`));
  if (sec?.overview) children.push(...mdParas(sec.overview));
  const dmg = {};
  for (const s of DAMAGE_SCORES) dmg[DAMAGE_LABEL[s]] = 0;
  for (const r of buildings) if (DAMAGE_SCORES.includes(Number(r.damage_score))) dmg[DAMAGE_LABEL[Number(r.damage_score)]] += 1;
  children.push(countTable('Damage score', dmg));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  children.push(heading(3, 'Observation types'));
  const typeCounts = multiTypeCounts(approved);
  const typeLabelCounts = {};
  for (const [k, v] of Object.entries(typeCounts)) typeLabelCounts[observationTypesLabel([k])] = v;
  children.push(countTable('Observation type', typeLabelCounts));
  const nsCount = approved.filter((r) => r.nonstructural_damage).length;
  children.push(para(`Non-structural damage was flagged on ${nsCount} of ${approved.length} verified observation(s).`));
  children.push(placeholder('commentary on the overall damage distribution and any notable concentrations or exposure.'));

  const regions = [...new Set(approved.map((r) => r.region).filter(Boolean))];
  children.push(heading(2, 'Observations by Region'));
  children.push(countTable('Region', labelCounts(approved, (r) => r.region)));
  for (const region of regions) {
    const inRegion = approved.filter((r) => r.region === region);
    const heavy = inRegion.filter((r) => r.damage_score === 3 || r.damage_score === 4).length;
    children.push(heading(3, region));
    children.push(para(`${inRegion.length} verified observation(s) in ${region}, of which ${heavy} were heavy-to-severe (D3-D4).`));
    if (sec?.regions && sec.regions[region]) children.push(...mdParas(sec.regions[region]));
    const withPhoto = inRegion.find((r) => r.media_url);
    if (withPhoto) {
      const img = await fetchImage(withPhoto.media_url);
      if (img) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 },
          children: [new ImageRun({ data: img.data, type: img.type, transformation: { width: 360, height: 240 } })] }));
        children.push(caption(`Figure ${figNo}. Site #${withPhoto.site_id ?? '-'}, ${region}: ${DAMAGE_LABEL[withPhoto.damage_score]?.split(' - ')[0] ?? ''}${withPhoto.failure_mechanism ? ` - ${withPhoto.failure_mechanism}` : ''}. `, cite(withPhoto.source_url)));
        figNo += 1;
      }
    }
    children.push(placeholder(`additional detail, representative photographs, and any references for ${region}.`));
  }

  children.push(heading(2, 'Observed Failure Mechanisms'));
  if (sec?.mechanisms) children.push(...mdParas(sec.mechanisms));
  children.push(heading(3, 'Primary materials (buildings)'));
  children.push(countTable('Primary material', labelCounts(buildings, (r) => r.primary_material)));
  children.push(heading(3, 'Code era (buildings)'));
  children.push(countTable('Code era', labelCounts(buildings, (r) => r.code_era)));
  children.push(placeholder('discussion of dominant failure mechanisms with supporting photographs and references.'));

  children.push(heading(2, 'Non-structural Damage'));
  if (sec?.nonstructural) children.push(...mdParas(sec.nonstructural));
  children.push(placeholder('notes on non-structural damage patterns (partitions, ceilings, facades, services).'));

  children.push(heading(2, 'Notable Good Performance'));
  if (sec?.goodPerformance) children.push(...mdParas(sec.goodPerformance));
  children.push(placeholder('examples of good seismic performance, retrofits, or modern code compliance.'));

  children.push(heading(2, 'Preliminary Conclusions'));
  const conclText = sec ? sec.conclusions : (parsed && !parsed.structured ? parsed.markdown : '');
  if (!sec && conclText) children.push(aiNote());
  if (conclText) children.push(...mdParas(conclText));
  children.push(placeholder('confirm conclusions and add limitations, next steps, and acknowledgements.'));

  children.push(heading(2, 'References'));
  if (refList.length) {
    refList.forEach((ref, i) => {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [
        new Bookmark({ id: `ref-${i + 1}`, children: [new TextRun({ text: `${i + 1}. ${ref.label ? `${ref.label}: ` : ''}`, size: 20, font: BODY })] }),
        new ExternalHyperlink({ link: ref.url, children: [new TextRun({ text: ref.url, size: 20, font: BODY, color: '0563C1', underline: {} })] }),
        ...(ref.date ? [new TextRun({ text: ` (retrieved ${fmtDate(ref.date)})`, size: 18, color: GREY, font: BODY })] : []),
      ] }));
    });
  } else {
    children.push(placeholder('add references, e.g. GeoNet, JMA, NZSEE guidance, and any cited literature.'));
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading(2, 'Appendix A - Verified Observation Inventory'));
  const invHead = new TableRow({ tableHeader: true, children: ['Site', 'Region', 'Type', 'Damage', 'Non-struct.', 'Reviewer'].map((h) => new TableCell({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEADSHADE }, margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18, font: BODY })] })] })) });
  const invRows = approved.map((r) => new TableRow({ children: [
    `${r.site_id ?? '-'}`, r.region ?? '-', observationTypesLabel(r.observation_types),
    DAMAGE_LABEL[r.damage_score]?.split(' - ')[0] ?? '-', r.nonstructural_damage ? 'Yes' : '', r.reviewed_by ?? '-',
  ].map((c) => new TableCell({ margins: { top: 30, bottom: 30, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: String(c), size: 18, font: BODY })] })] })) }));
  children.push(new Table({ width: { size: TABLE_W, type: WidthType.DXA }, borders: allBorders, rows: [invHead, ...invRows] }));

  const runHeader = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE } },
    children: [new TextRun({ text: `Learning from Earthquakes - VERT ${meta.eventName || ''} (V${meta.version || '1.0'})`, color: LIGHTGREY, size: 16, font: BODY })] })] });
  const runFooter = new Footer({ children: [new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE } },
    children: [new TextRun({ text: 'In-Confidence', color: LIGHTGREY, size: 16, font: BODY }),
      new TextRun({ text: '          Page ', color: LIGHTGREY, size: 16, font: BODY }),
      new TextRun({ children: [PageNumber.CURRENT], color: LIGHTGREY, size: 16, font: BODY })] })] });

  const doc = new Document({
    creator: 'VERT Triage Hub', title: `VERT ${meta.eventName || 'Event'} Report`,
    sections: [{
      properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: { default: runHeader, first: new Header({ children: [new Paragraph({ children: [] })] }) },
      footers: { default: runFooter, first: new Footer({ children: [new Paragraph({ children: [] })] }) },
      children,
    }],
  });
  return Packer.toBlob(doc);
}
