import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, AlignmentType, HeadingLevel, ImageRun, Header, Footer,
  PageNumber, PageBreak,
} from 'docx';
import { DAMAGE_SCORES, DAMAGE_LABEL, OBSERVATION_LABEL } from './constants.js';

// NZSEE Learning from Earthquakes palette (maroon/burgundy).
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

function heading(level, text) {
  const map = {
    1: { size: 32, color: MAROON, before: 40, after: 120 },
    2: { size: 26, color: MAROON, before: 300, after: 120 },
    3: { size: 23, color: MAROON_LT, before: 220, after: 80 },
  };
  const s = map[level] || map[3];
  return new Paragraph({ heading: HeadingLevel[`HEADING_${level}`], keepNext: true, spacing: { before: s.before, after: s.after },
    children: [new TextRun({ text, bold: true, color: s.color, size: s.size, font: BODY })] });
}

function para(text, opts = {}) {
  return new Paragraph({ alignment: opts.align ?? AlignmentType.JUSTIFIED, spacing: { after: opts.after ?? 140, line: 276 }, children: inline(text, { size: 22, ...opts }) });
}

function metaTable(rows) {
  return new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: [3400, 5672], borders: allBorders,
    rows: rows.map(([k, v]) => new TableRow({ children: [
      new TableCell({ width: { size: 3400, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: LABELSHADE }, margins: { top: 40, bottom: 40, left: 90, right: 90 }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: MAROON, size: 20, font: BODY })] })] }),
      new TableCell({ width: { size: 5672, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 90, right: 90 }, children: [new Paragraph({ children: [new TextRun({ text: String(v ?? ''), size: 20, font: BODY })] })] }),
    ] })) });
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

function caption(text) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 180 },
    children: [new TextRun({ text, italics: true, color: MAROON_LT, size: 18, font: BODY })] });
}

/**
 * Build the report as a Word (.docx) Blob, styled like the NZSEE LfE report.
 * Only Approved (verified) records are used. `conclusions` is optional
 * AI-drafted markdown. Figures are pulled from verified sites that have a photo.
 */
export async function buildReportDocxBlob(records, meta, conclusions) {
  const approved = records.filter((r) => r.status === 'Approved');
  const buildings = approved.filter((r) => r.observation_type === 'building');
  const now = new Date().toISOString().slice(0, 10);

  const children = [];
  // cover
  children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'LEARNING FROM EARTHQUAKES', bold: true, color: MAROON_LT, size: 20, font: BODY, characterSpacing: 30 })] }));
  children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Significant Event Report', bold: true, color: MAROON, size: 48, font: BODY })] }));
  children.push(new Paragraph({ spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: MAROON } },
    children: [new TextRun({ text: `VERT ${meta.eventName || 'Event'} - Version ${meta.version || '1.0'}`, color: MAROON, size: 30, font: BODY })] }));
  children.push(metaTable([
    ['Report issued', now],
    ['Magnitude (Mw)', meta.magnitude], ['Depth (km)', meta.depth],
    ['Location (geographical)', meta.locationName], ['Location (lat/long)', meta.locationLatLong],
    ['Time and date', meta.eventDatetime], ['Faulting mechanism', meta.faulting],
    ['Maximum Modified Mercalli Intensity', meta.maxMMI], ['Tsunami alert issued', meta.tsunami],
  ]));
  if (meta.contributors) { children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: 'Contributors: ', bold: true, size: 20, font: BODY }), new TextRun({ text: meta.contributors, size: 20, font: BODY })] })); }
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // conclusions (AI)
  if (conclusions && conclusions.trim()) {
    children.push(heading(2, 'Preliminary Conclusions (AI-assisted draft)'));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'Drafted by AI from the verified observations only. Review before use.', italics: true, color: GREY, size: 18, font: BODY })] }));
    for (const line of conclusions.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith('# ')) children.push(heading(3, t.slice(2)));
      else if (t.startsWith('## ')) children.push(heading(3, t.slice(3)));
      else if (/^[-*]\s/.test(t)) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: inline(t.replace(/^[-*]\s/, ''), { size: 22 }) }));
      else children.push(para(t));
    }
  }

  // summary statistics
  children.push(heading(2, 'Summary Statistics'));
  children.push(para(`${approved.length} verified observation(s), including ${buildings.length} building observation(s).`));
  const dmg = {};
  for (const s of DAMAGE_SCORES) dmg[DAMAGE_LABEL[s]] = 0;
  for (const r of buildings) if (DAMAGE_SCORES.includes(Number(r.damage_score))) dmg[DAMAGE_LABEL[Number(r.damage_score)]] += 1;
  children.push(countTable('Damage score', dmg));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  // region sections with a figure each (where available)
  const regions = [...new Set(approved.map((r) => r.region).filter(Boolean))];
  children.push(heading(2, 'Observations by Region'));
  let figNo = 1;
  for (const region of regions) {
    const inRegion = approved.filter((r) => r.region === region);
    const heavy = inRegion.filter((r) => r.damage_score === 3 || r.damage_score === 4).length;
    children.push(heading(3, region));
    children.push(para(`${inRegion.length} verified observation(s) in ${region}, of which ${heavy} were heavy-to-severe (D3-D4).`));
    const withPhoto = inRegion.find((r) => r.media_url);
    if (withPhoto && figNo <= 12) {
      const img = await fetchImage(withPhoto.media_url);
      if (img) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 },
          children: [new ImageRun({ data: img.data, type: img.type, transformation: { width: 360, height: 240 } })] }));
        children.push(caption(`Figure ${figNo}. Site #${withPhoto.site_id ?? '-'}, ${region}: ${DAMAGE_LABEL[withPhoto.damage_score]?.split(' - ')[0] ?? ''}${withPhoto.failure_mechanism ? ` - ${withPhoto.failure_mechanism}` : ''}.`));
        figNo += 1;
      }
    }
  }

  // appendix inventory
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading(2, 'Appendix A - Verified Observation Inventory'));
  const invHead = new TableRow({ tableHeader: true, children: ['Site', 'Region', 'Type', 'Damage', 'Non-struct.', 'Reviewer'].map((h) => new TableCell({
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEADSHADE }, margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18, font: BODY })] })] })) });
  const invRows = approved.map((r) => new TableRow({ children: [
    `${r.site_id ?? '-'}`, r.region ?? '-', OBSERVATION_LABEL[r.observation_type] ?? '-',
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
      properties: { titlePage: true, page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1417, right: 1417 } } },
      headers: { default: runHeader, first: new Header({ children: [new Paragraph({ children: [] })] }) },
      footers: { default: runFooter, first: new Footer({ children: [new Paragraph({ children: [] })] }) },
      children,
    }],
  });
  return Packer.toBlob(doc);
}
