import React, { useId, useRef, useState } from 'react'
import {
  runQdSizing,
  WORKED_EXAMPLE,
  QD,
  QD_SIZES,
  D_SLIP,
  D_STOP,
  D_ULS,
  eta,
  sd,
  spFactor,
  SP_SLS,
  DB_FU,
  DRIFT_LIMIT,
  hazardC,
  hazardCs,
} from '../lib/qdSizing'
// Noto Sans for the summary PDF: the built-in PDF fonts can't draw μ, φ, Δ or θ.
import regularFontUrl from '../assets/fonts/NotoSans-Regular.ttf?url'
import boldFontUrl from '../assets/fonts/NotoSans-Bold.ttf?url'

const BRAND = '#17638f'
const EQ = '#c07c1c'
const MARGIN = '#16a34a'

const FIELD_CLASS =
  'w-full text-[0.98rem] font-medium text-slate-900 px-3.5 py-2.5 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#17638f] focus:ring-2 focus:ring-[#17638f]/20 transition motion-reduce:transition-none'
const FIELD_INVALID_CLASS =
  'w-full text-[0.98rem] font-medium text-slate-900 px-3.5 py-2.5 border-2 border-red-600 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-600/20 transition motion-reduce:transition-none'
// Not uppercase like the site's other field labels: text-transform would turn
// δ into Δ, μ into Μ and T,e into T,E, which changes what the symbols mean.
const LABEL_CLASS = 'block text-sm font-black tracking-tight text-slate-700 mb-1.5'
const BUTTON_FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17638f]/40 focus-visible:ring-offset-2'

// ─────────────────────────────────────────────────────────────────────────────
// Terms
// ─────────────────────────────────────────────────────────────────────────────

// The methodology's notation, trimmed to the terms this page uses.
const TERMS = [
  ['Limit states and hazard', [
    ['SLS', 'Serviceability limit state, NZS 1170.5 (R,s = 0.25 here).'],
    ['ULS', 'Ultimate limit state, NZS 1170.5.'],
    ['CALS', 'Collapse avoidance limit state: 1.5 × the ULS hazard (λ = 1.5).'],
    ['Z, R,u, R,s', 'NZS 1170.5 hazard factor and the ULS and SLS return period factors.'],
    ['λ', 'Hazard scale: 1.0 at ULS and 1.5 at CALS.'],
    ['S,p', 'Structural performance factor, NZS 3404 Cl 12.2.2.1.'],
    ['S,p,DDBD', 'Factor on the demand spectrum for the displacement-based checks, (1 + S,p) / 2 (Marriott 2018).'],
    ['k,dm', 'NZS 1170.5 Cl 7.3 drift modification factor.'],
    ['ADRS', 'Acceleration-displacement response spectrum: V/W against Δ, with the demand spectra and the capacity curve on the same axes.'],
  ]],
  ['DonoBrace', [
    ['SRF', "DonoBrace stiffness reduction factor, from DonoBrace's design guidance. It reduces the bar's axial stiffness in the model: k,rod = SRF × A × E/L. This page uses DB15 0.8, DB20 0.6 and DB25 0.5. Displacements use the SRF stiffness; the DonoBrace-alone comparison takes its period from the full bar area."],
    ['k,rod', 'DonoBrace axial stiffness, SRF × A × E/L.'],
    ['N,t, φN,t', 'DonoBrace nominal section capacity in tension, A × f,y (NZS 3404 Cl 7.2), and design capacity, φ = 0.9.'],
  ]],
  ['Quake Defender (QD)', [
    ['F,slip', 'Nominal activation (slip) force, reached at δ,slip = 1 mm.'],
    ['F,ult', 'Nominal loading force at the hard stop, δ,stop.'],
    ['F,restoring', 'Nominal force at the start of the return curve from δ,stop.'],
    ['F,residual', 'Nominal force at the end of the return curve, where the QD relocks.'],
    ['F,max', 'Upper-bound QD force (UBH at δ,stop), for capacity design of the load path.'],
    ['Nominal, LBH, UBH', 'The nominal loop, and the upper- and lower-bound loops with the friction increased or reduced by 0.1 F,slip.'],
    ['δ', 'QD axial deformation.'],
    ['δ,ULS', 'Maximum QD deformation at ULS: 33 mm = δ,stop / 1.5.'],
    ['δ,stop', 'QD deformation at the hard stop (50 mm); may be reached at CALS, not at ULS.'],
    ['k,0', 'QD activation stiffness, F,slip / δ,slip.'],
  ]],
  ['Forces, displacements and periods', [
    ['θ', 'Brace angle to the direction of loading.'],
    ['F,b,E, F,b,SLS, F,b,wind', 'Critical brace forces: elastic ULS, SLS and ULS wind.'],
    ['Δ', 'Displacement of the deformation-control coordinate (the roof).'],
    ['Δ,y', 'Δ at QD activation on the nominal backbone.'],
    ['Δ,stop', 'Δ at which the governing QD reaches δ,stop.'],
    ['Δ,lim', 'Governing ULS displacement limit (Step 2).'],
    ['μ', 'Displacement ductility, Δ at the performance point ÷ Δ,y.'],
    ['T,e', 'Elastic period of the DonoBrace-only model (no QD).'],
    ['T,eff, ξ,eff', 'Effective (secant) period and equivalent viscous damping at a performance point: 5% inherent plus hysteretic.'],
    ['V/W', 'Base shear coefficient: storey shear ÷ seismic weight.'],
  ]],
]

function TermsButton({ onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`font-bold underline decoration-dotted underline-offset-2 hover:decoration-solid ${BUTTON_FOCUS}`}
      style={{ color: BRAND }}
    >
      Terms and abbreviations
    </button>
  )
}

// Native modal dialog: Escape closes it, focus is trapped and returned. A click on
// the backdrop (the dialog element itself, outside the panel) also closes it.
function TermsDialog({ dialogRef }) {
  const titleId = useId()
  const close = () => dialogRef.current?.close()
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[85vh] rounded-2xl p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="sticky top-0 bg-white border-b border-slate-100 px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-xl font-black tracking-tighter text-slate-900">Terms and abbreviations</h2>
        <button
          type="button"
          onClick={close}
          className={`font-bold text-sm px-4 py-1.5 rounded-full border-2 border-slate-300 text-slate-600 bg-white hover:border-slate-400 ${BUTTON_FOCUS}`}
        >
          Close
        </button>
      </div>
      <div className="px-5 sm:px-6 py-5 space-y-6">
        {TERMS.map(([group, rows]) => (
          <section key={group}>
            <h3 className="text-sm font-black text-slate-400 mb-2">{group}</h3>
            <dl className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm leading-relaxed">
              {rows.map(([term, def]) => (
                <React.Fragment key={term}>
                  <dt className="font-black text-slate-900">{term}</dt>
                  <dd className="text-slate-600">{def}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

// Numeric fields, with the same bounds as the reference prototype. pShare is
// entered as a percentage and divided by 100 before it reaches the engine.
const NUMERIC = {
  angle: { label: 'Brace angle to the direction of loading, θ (°)', min: 5, max: 85, help: 'Direction of loading means the horizontal loading axis parallel to the braced frame.' },
  Te: { label: 'Elastic period T,e (s)', min: 0.02, help: 'From your model, in this direction.' },
  Fe: { label: 'Critical brace force (kN)', min: 0.1 },
  ee: { label: 'Critical brace axial elongation (mm)', min: 0.01 },
  De: { label: 'Roof displacement (mm)', min: 0.01, help: 'At the deformation-control point.' },
  pShare: { label: 'Storey shear taken by other elements (%)', min: 0, max: 90, help: 'Portal frame weak-axis bending, out-of-plane walls or other elements acting in parallel with the braces in this direction. Usually taken as 0.' },
  h: { label: 'Storey height h (m)', min: 0.5, help: 'For drift and P-delta.' },
  Z: { label: 'Hazard factor Z', min: 0.05 },
  R: { label: 'Return period factor R,u', min: 0.1 },
  faultD: { label: 'Distance to nearest major fault D (km)', min: 0, help: 'Shortest distance to a fault in NZS 1170.5 Table 3.6 (Alpine, Wellington, Wairarapa and others). Over 20 km means not near-fault. Within 20 km is outside the Quake Defender methodology; contact Seismic Shift.' },
  wind: { label: 'ULS wind force in the critical brace (kN)', min: 0 },
  Sp: { label: 'S,p at ULS', min: 0.5, max: 1, help: 'NZS 3404 Cl 12.2.2.1' },
  Rs: { label: 'SLS return period factor R,s', min: 0.1 },
  lamC: { label: 'CALS hazard factor λ', min: 1 },
  kdm: { label: 'Drift modification k,dm', min: 1 },
}

// How S,p is applied to the demand spectrum. The engine's spFactor() is the one
// source of truth for the multiplier; these are only the labels.
const SP_METHOD_OPTIONS = [
  { key: 'marriott', label: 'Marriott 2018', help: 'Spectrum × S,p,DDBD = (1 + S,p) / 2 (Marriott 2018, BNZSEE 51(3)). The methodology basis (Step 2).' },
  { key: 'unity', label: 'S,p = 1.0', help: 'Comparison only, outside the methodology. No S,p reduction on the spectrum; the μ > 1.25 ductility check still applies.' },
  { key: 'c3', label: 'Assessment guidelines C3', help: 'Comparison only, outside the methodology. Spectrum × S,p in full, as for equivalent static analysis (Seismic Assessment Guidelines C3.10.2, 2025).' },
]
const SP_METHOD_LABEL = Object.fromEntries(SP_METHOD_OPTIONS.map((o) => [o.key, o.label]))

// Legend / calc-sheet text for the spectrum multiplier actually applied.
function spText(input) {
  const m = input.spMethod ?? 'marriott'
  const k = f(spFactor(input), 2)
  if (m === 'unity') return 'S,p = 1.0'
  if (m === 'c3') return `S,p = ${k}`
  return `S,p,DDBD = (1 + S,p)/2 = ${k}`
}

const SOIL_OPTIONS = [
  ['AB', 'A or B'],
  ['C', 'C'],
  ['D', 'D'],
  ['E', 'E'],
]

const SIZE_OPTIONS = [
  ['auto', 'Smallest size that passes'],
  ...QD_SIZES.map((s) => [s, `${s} + ${QD[s].brace}`]),
]

function exampleForm() {
  const form = {}
  for (const [k, v] of Object.entries(WORKED_EXAMPLE)) {
    form[k] = typeof v === 'number' ? String(k === 'pShare' ? v * 100 : v) : v
  }
  return form
}

function fieldError(key, raw) {
  const { min, max } = NUMERIC[key]
  const x = raw.trim() === '' ? NaN : Number(raw)
  if (!Number.isFinite(x)) return 'Enter a number.'
  if (max !== undefined && (x < min || x > max)) return `Enter a number from ${min} to ${max}.`
  if (x < min) return `Enter a number of at least ${min}.`
  return null
}

function parseForm(form) {
  const errors = {}
  const input = { ...form }
  for (const key of Object.keys(NUMERIC)) {
    // S,p is hidden (and unused) with the S,p = 1.0 option, so don't let a stale
    // invalid value there block the result.
    const err = key === 'Sp' && form.spMethod === 'unity' ? null : fieldError(key, form[key])
    if (err) errors[key] = err
    input[key] = Number(form[key])
  }
  input.pShare = input.pShare / 100
  return { input, errors, ok: Object.keys(errors).length === 0 }
}

function track(event, params) {
  try {
    window.gtag?.('event', event, params)
  } catch {
    // Analytics must never break the calculator.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

const f = (x, d = 1) =>
  x == null || !Number.isFinite(x)
    ? '-'
    : Number(x).toLocaleString('en-NZ', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : `${f(x * 100, d)}%`)
const label = (s) => `${s} + ${QD[s].brace}`

function niceStep(span, target) {
  const raw = span / target
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const r = raw / p
  return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p
}

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────────────────────────────────────

function Chip({ ok, pass = 'Pass', fail = 'Fail' }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-black uppercase tracking-wider whitespace-nowrap ${
        ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
      }`}
      style={ok ? { color: MARGIN } : undefined}
    >
      {ok ? pass : fail}
    </span>
  )
}

// cols: optional column widths (e.g. ['34%', '22%', ...]) for a fixed layout with even columns.
function Table({ head, children, className = '', cols, minWidth }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-200 ${className}`}>
      <table className={`w-full text-sm text-left border-collapse ${cols ? 'table-fixed' : ''}`} style={minWidth ? { minWidth } : undefined}>
        {cols && <colgroup>{cols.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>}
        {head && (
          <thead>
            <tr className="bg-[#17638f] text-white">
              {head.map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 font-black text-xs whitespace-nowrap ${i > 0 ? 'text-right' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody className="divide-y divide-slate-200 bg-white">{children}</tbody>
      </table>
    </div>
  )
}

function Td({ children, className = '' }) {
  return <td className={`px-3 py-2 text-slate-700 ${className}`}>{children}</td>
}

function Num({ children, className = '' }) {
  return (
    <td className={`px-3 py-2 text-right text-slate-900 font-semibold tabular-nums whitespace-nowrap ${className}`}>
      {children}
    </td>
  )
}

function StepHead({ eyebrow, title }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">{eyebrow}</p>
      <h2 className="text-2xl font-black tracking-tighter text-slate-900">{title}</h2>
    </div>
  )
}

function Note({ children }) {
  return <p className="text-sm text-slate-500 leading-relaxed mt-3">{children}</p>
}

function Swatch({ color, dash, dot, open }) {
  return (
    <svg width="26" height="10" className="mr-1.5 shrink-0" aria-hidden="true">
      {dot ? (
        <circle cx="13" cy="5" r="4" fill={open ? '#fff' : color} stroke={color} strokeWidth="2" />
      ) : (
        <line x1="1" y1="5" x2="25" y2="5" stroke={color} strokeWidth="2.2" strokeDasharray={dash} />
      )}
    </svg>
  )
}

function Legend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-bold text-slate-600 pt-2">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center">
          <Swatch {...it} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Input fields
// ─────────────────────────────────────────────────────────────────────────────

function NumberField({ name, value, error, onChange }) {
  const id = useId()
  const { label: text, help, min, max } = NUMERIC[name]
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{text}</label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${id}-help`}
        className={error ? FIELD_INVALID_CLASS : FIELD_CLASS}
      />
      <p id={`${id}-help`} className={`text-xs mt-1.5 ${error ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
        {error || help}
      </p>
    </div>
  )
}

function SelectField({ name, text, value, options, onChange }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{text}</label>
      <select id={id} value={value} onChange={(e) => onChange(name, e.target.value)} className={FIELD_CLASS}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  )
}

function Group({ title, intro, children }) {
  return (
    <fieldset className="pt-6 first:pt-0 border-t border-slate-100 first:border-t-0">
      <legend className="float-left w-full text-base font-black tracking-tight text-slate-900 mb-1">{title}</legend>
      {intro && <p className="clear-left text-sm text-slate-400 leading-relaxed mb-3">{intro}</p>}
      <div className="clear-left grid gap-4 pt-2">{children}</div>
    </fieldset>
  )
}

function Inputs({ form, errors, onChange, onSize, onSpMethod }) {
  const numberField = (name) => <NumberField name={name} value={form[name]} error={errors[name]} onChange={onChange} />
  return (
    <div className="space-y-6">
      <Group
        title="Your initial elastic model"
        intro="A model of the building with DonoBrace only (no QD), DonoBrace stiffness reduction factor applied."
      >
        <SelectField
          name="braceModel"
          text="DonoBrace size used in the initial elastic model"
          value={form.braceModel}
          options={[['DB15', 'DB15'], ['DB20', 'DB20'], ['DB25', 'DB25']]}
          onChange={onChange}
        />
        {numberField('angle')}
        {numberField('Te')}
      </Group>

      <Group
        title="Elastic 0.1g equivalent static case"
        intro="Apply a static lateral load of 0.1 × the seismic weight in this direction (the same seismic weight as the mass behind T,e), with the braces tension-only and the DonoBrace SRF applied. Read all three results from that case. Enter the force and axial elongation of one brace only, the critical one, however many braces are on the line: the roof displacement accounts for the rest. Where a braced line has more than one bay, QD is assumed in every bay of that line, all the same size."
      >
        {numberField('Fe')}
        {numberField('ee')}
        {numberField('De')}
      </Group>

      <Group title="Building">
        {numberField('pShare')}
        {numberField('h')}
      </Group>

      <Group title="Hazard and wind">
        {numberField('Z')}
        <SelectField name="soil" text="Site subsoil class" value={form.soil} options={SOIL_OPTIONS} onChange={onChange} />
        {numberField('R')}
        {numberField('faultD')}
        {numberField('wind')}
      </Group>

      <Group
        title="S,p on the demand spectrum"
        intro="How the structural performance factor reduces the ULS and CALS spectra. The methodology uses Marriott 2018; the other two are for comparison only."
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label="S,p on the demand spectrum">
          {SP_METHOD_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={form.spMethod === o.key}
              onClick={() => onSpMethod(o.key)}
              className={`font-bold text-xs tracking-wide px-4 py-2 rounded-full border-2 transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17638f]/40 ${
                form.spMethod === o.key
                  ? 'border-[#17638f] bg-[#eef1f3] text-[#17638f]'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 -mt-1">{SP_METHOD_OPTIONS.find((o) => o.key === form.spMethod)?.help}</p>
        {form.spMethod !== 'unity' && numberField('Sp')}
      </Group>

      <Group title="Show results for">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show results for">
          {SIZE_OPTIONS.map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={form.size === v}
              onClick={() => onSize(v)}
              className={`font-bold text-xs tracking-wide px-4 py-2 rounded-full border-2 transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#17638f]/40 ${
                form.size === v
                  ? 'border-[#17638f] bg-[#eef1f3] text-[#17638f]'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </Group>

      <details className="pt-6 border-t border-slate-100 group">
        <summary className={`inline-flex items-center gap-2 cursor-pointer select-none text-sm font-black tracking-wide uppercase text-[#17638f] hover:text-[#0f4c6e] transition motion-reduce:transition-none list-none [&::-webkit-details-marker]:hidden rounded ${BUTTON_FOCUS}`}>
          <span>Performance factors</span>
          <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="grid gap-4 mt-4">
          {numberField('Rs')}
          {numberField('lamC')}
          {numberField('kdm')}
        </div>
      </details>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────────────────────

const TICK = { fontSize: 12, fontWeight: 700, fill: '#94a3b8', fontFamily: 'DM Sans' }
const AXIS_LABEL = { fontSize: 12.5, fontWeight: 700, fill: '#64748b', fontFamily: 'DM Sans' }

function LoopChart({ s }) {
  const u = s.uls
  const c = s.cals
  const W = 520
  const H = 360
  const L = 52
  const Rt = 14
  const T = 14
  const B = 44
  const pw = W - L - Rt
  const ph = H - T - B
  const xmax = 55
  const ys = niceStep(s.dU.Fult * 1.12, 5)
  const ymax = Math.ceil((s.dU.Fult * 1.12) / ys) * ys
  const X = (d) => L + (d / xmax) * pw
  const Y = (F) => T + ph - (F / ymax) * ph
  // SLS dot: the Step 3 locking-check brace force on the nominal loading branch.
  const lockDqd = s.FbSLS <= s.dev.Fslip ? s.FbSLS / s.dev.k0 : D_SLIP + (s.FbSLS - s.dev.Fslip) / s.dev.kL
  const loop = (d) => [[0, 0], [D_SLIP, d.Fslip], [D_STOP, d.Fult], [d.dRest, d.Frest], [d.dres, d.Fres], [0, 0]]
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('') + 'Z'
  const yTicks = []
  for (let y = 0; y <= ymax + 1e-9; y += ys) yTicks.push(y)

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${s.size} force against QD deformation: nominal loop with lower and upper bound loops, and the SLS, ULS and CALS points`}
        className="w-full h-auto block"
      >
        {[0, 10, 20, 30, 40, 50].map((x) => (
          <g key={`x${x}`}>
            <line x1={X(x)} x2={X(x)} y1={T} y2={T + ph} stroke="#e2e8f0" />
            <text x={X(x)} y={T + ph + 17} textAnchor="middle" {...TICK}>{x}</text>
          </g>
        ))}
        {yTicks.map((y) => (
          <g key={`y${y}`}>
            <line x1={L} x2={L + pw} y1={Y(y)} y2={Y(y)} stroke="#e2e8f0" />
            <text x={L - 7} y={Y(y) + 4} textAnchor="end" {...TICK}>{f(y, 0)}</text>
          </g>
        ))}
        <rect x={L} y={T} width={pw} height={ph} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
        <text x={L + pw / 2} y={H - 6} textAnchor="middle" {...AXIS_LABEL}>QD deformation δ (mm)</text>
        <text transform={`translate(14 ${T + ph / 2}) rotate(-90)`} textAnchor="middle" {...AXIS_LABEL}>QD force F (kN)</text>

        <line x1={X(D_ULS)} x2={X(D_ULS)} y1={T} y2={T + ph} stroke="#475569" strokeDasharray="3 3" />
        <text x={X(D_ULS) - 5} y={T + 14} textAnchor="end" {...TICK} fill="#475569">δ,ULS 33</text>
        <line x1={X(D_STOP)} x2={X(D_STOP)} y1={T} y2={T + ph} stroke="#475569" strokeDasharray="3 3" />
        <text x={X(D_STOP) - 5} y={T + 14} textAnchor="end" {...TICK} fill="#475569">δ,stop 50</text>

        <path d={path(loop(s.dev))} fill={BRAND} fillOpacity="0.08" stroke="none" />
        <path d={path(loop(s.dL))} fill="none" stroke="#64748b" strokeWidth="1.4" strokeDasharray="7 3" />
        <path d={path(loop(s.dU))} fill="none" stroke="#64748b" strokeWidth="1.4" strokeDasharray="2 3" />
        <path d={path(loop(s.dev))} fill="none" stroke={BRAND} strokeWidth="2.6" strokeLinejoin="round" />

        <circle cx={X(lockDqd)} cy={Y(s.FbSLS)} r="6" fill={MARGIN} stroke="#fff" strokeWidth="2" />
        {u && !u.elastic && <circle cx={X(u.dqd)} cy={Y(u.F)} r="6" fill={BRAND} stroke="#fff" strokeWidth="2" />}
        {c && !c.elastic && <circle cx={X(c.dqd)} cy={Y(c.F)} r="6" fill="#fff" stroke={EQ} strokeWidth="2.4" />}
      </svg>
      <Legend
        items={[
          { label: 'Nominal', color: BRAND },
          { label: 'LBH', color: '#64748b', dash: '7 3' },
          { label: 'UBH', color: '#64748b', dash: '2 3' },
          { label: 'SLS locking-check force', color: MARGIN, dot: true },
          { label: 'ULS point', color: BRAND, dot: true },
          { label: 'CALS point', color: EQ, dot: true, open: true },
        ]}
      />
    </div>
  )
}

function AdrsChart({ s, input }) {
  const clipId = useId().replace(/:/g, '')
  const u = s.uls
  const c = s.cals
  const W = 620
  const H = 420
  const L = 56
  const Rt = 14
  const T = 14
  const B = 46
  const pw = W - L - Rt
  const ph = H - T - B

  const cap = [[0, 0]]
  for (let i = 0; i <= 80; i++) {
    const st = s.at(D_SLIP + ((D_STOP - D_SLIP) * i) / 80)
    cap.push([st.D, st.Sa])
  }
  const capMax = cap[cap.length - 1][1]
  let xmax = Math.max(s.Dstop * 1.12, c ? c.D * 1.1 : 0)
  const xs = niceStep(xmax, 6)
  xmax = Math.ceil(xmax / xs) * xs
  let ymax = Math.max(capMax * 1.45, u ? u.Sa * 1.7 : 0, c ? c.Sa * 1.3 : 0)
  const ys = niceStep(ymax, 5)
  ymax = Math.ceil(ymax / ys) * ys

  const X = (d) => L + (d / xmax) * pw
  const Y = (a) => T + ph - (a / ymax) * ph
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('')
  const C = hazardC(input)
  const spec = (lam, xi) => {
    const pts = []
    for (let i = 0; i <= 500; i++) {
      const t = 0.02 + i * 0.01
      const Sa = lam * s.spd * eta(xi) * C(t)
      const d = sd(t, Sa)
      if (d > xmax * 1.05) break
      pts.push([d, Sa])
    }
    return pts
  }
  const xTicks = []
  for (let x = 0; x <= xmax + 1e-9; x += xs) xTicks.push(x)
  const yTicks = []
  for (let y = 0; y <= ymax + 1e-9; y += ys) yTicks.push(y)
  const limLine = (D, text, dy) => (
    <g key={text}>
      <line x1={X(D)} x2={X(D)} y1={T} y2={T + ph} stroke="#475569" strokeDasharray="3 3" />
      <text x={X(D) - 5} y={T + 14 + dy} textAnchor="end" {...TICK} fill="#475569">{text}</text>
    </g>
  )
  const Cs = hazardCs(input)
  const slsSpec = []
  for (let i = 0; i <= 500; i++) {
    const t = 0.02 + i * 0.01
    const Sa = SP_SLS * Cs(t)
    const d = sd(t, Sa)
    if (d > xmax * 1.05) break
    slsSpec.push([d, Sa])
  }
  const ulsDamped = u && !u.elastic
  const calsDamped = c && !c.elastic

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mt-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Acceleration-displacement response spectrum with the estimated capacity curve for ${label(s.size)} and the SLS, ULS and CALS points`}
        className="w-full h-auto block"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={L} y={T} width={pw} height={ph} />
          </clipPath>
        </defs>
        {xTicks.map((x) => (
          <g key={`x${x}`}>
            <line x1={X(x)} x2={X(x)} y1={T} y2={T + ph} stroke="#e2e8f0" />
            <text x={X(x)} y={T + ph + 17} textAnchor="middle" {...TICK}>{f(x, 0)}</text>
          </g>
        ))}
        {yTicks.map((y) => (
          <g key={`y${y}`}>
            <line x1={L} x2={L + pw} y1={Y(y)} y2={Y(y)} stroke="#e2e8f0" />
            <text x={L - 7} y={Y(y) + 4} textAnchor="end" {...TICK}>{f(y, ys < 0.1 ? 2 : 1)}</text>
          </g>
        ))}
        <rect x={L} y={T} width={pw} height={ph} fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
        <text x={L + pw / 2} y={H - 6} textAnchor="middle" {...AXIS_LABEL}>Roof displacement Δ, spectral displacement S,d (mm)</text>
        <text transform={`translate(15 ${T + ph / 2}) rotate(-90)`} textAnchor="middle" {...AXIS_LABEL}>V/W, S,a (g)</text>
        <g clipPath={`url(#${clipId})`}>
          <path d={path(slsSpec)} fill="none" stroke={MARGIN} strokeWidth="1.4" strokeDasharray="2 3" />
          <path d={path(spec(1, 0.05))} fill="none" stroke="#94a3b8" strokeWidth="1.4" />
          {ulsDamped && <path d={path(spec(1, u.xi))} fill="none" stroke="#334155" strokeWidth="1.8" strokeDasharray="6 3" />}
          {calsDamped && <path d={path(spec(input.lamC, c.xi))} fill="none" stroke={EQ} strokeWidth="1.8" strokeDasharray="9 3 2 3" />}
          {limLine(s.Dlim, `Δ,lim ${f(s.Dlim, 0)}`, 0)}
          {/* Same height as the Δ,lim label unless the two lines are too close for both labels to fit. */}
          {limLine(s.Dstop, `Δ,stop ${f(s.Dstop, 0)}`, X(s.Dstop) - X(s.Dlim) < 80 ? 16 : 0)}
          <path d={path(cap)} fill="none" stroke={BRAND} strokeWidth="2.6" strokeLinejoin="round" />
          <circle cx={X(s.sls.D)} cy={Y(s.sls.Sa)} r="6" fill={MARGIN} stroke="#fff" strokeWidth="2" />
          {u && <circle cx={X(u.D)} cy={Y(u.Sa)} r="6" fill={BRAND} stroke="#fff" strokeWidth="2" />}
          {c && <circle cx={X(c.D)} cy={Y(c.Sa)} r="6" fill="#fff" stroke={EQ} strokeWidth="2.4" />}
        </g>
      </svg>
      <Legend
        items={[
          { label: `Capacity, ${label(s.size)} (estimated)`, color: BRAND },
          { label: `SLS spectrum, 5%, R,s = ${f(input.Rs, 2)}, × S,p = ${f(SP_SLS, 2)}`, color: MARGIN, dash: '2 3' },
          { label: `ULS spectrum, 5%, × ${spText(input)}`, color: '#94a3b8' },
          ...(ulsDamped ? [{ label: `ULS damped, ξ = ${pct(u.xi)}`, color: '#334155', dash: '6 3' }] : []),
          ...(calsDamped ? [{ label: `CALS damped, ξ = ${pct(c.xi)}`, color: EQ, dash: '9 3 2 3' }] : []),
          { label: 'SLS point', color: MARGIN, dot: true },
          { label: 'ULS point', color: BRAND, dot: true },
          { label: 'CALS point', color: EQ, dot: true, open: true },
        ]}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary PDF content. The layout lives in lib/qdSummaryPdf.js; this decides
// what goes in it, from the same result the page shows. Noto Sans has no ≤ or
// ≥, so limits are written as "max" and "min".
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_URL = 'seismicshift.nz/quake-defender/sizing-calculator/'
const BASIS_LINE = 'Quake Defender Indicative NZ Single-Storey Design Methodology V26.10; NZS 1170.5:2004'
const SOIL_LABEL = Object.fromEntries(SOIL_OPTIONS)

function inputRows(inp) {
  const num = (key, d) => [NUMERIC[key].label, f(inp[key], d)]
  return [
    ['DonoBrace size used in the initial elastic model', inp.braceModel],
    num('angle', 1),
    num('Te', 3),
    num('Fe', 2),
    num('ee', 2),
    num('De', 2),
    [NUMERIC.pShare.label, f(inp.pShare * 100, 0)],
    num('h', 2),
    [NUMERIC.Z.label, String(inp.Z)],
    ['Site subsoil class', SOIL_LABEL[inp.soil] ?? inp.soil],
    [NUMERIC.R.label, String(inp.R)],
    [NUMERIC.faultD.label, String(inp.faultD)],
    num('wind', 1),
    ['S,p on the demand spectrum', `${SP_METHOD_LABEL[inp.spMethod ?? 'marriott']}: ${spText(inp)}`],
    // The S,p field is hidden and unused with the S,p = 1.0 option.
    [NUMERIC.Sp.label, (inp.spMethod ?? 'marriott') === 'unity' ? 'not used with the S,p = 1.0 option' : String(inp.Sp)],
    [NUMERIC.Rs.label, String(inp.Rs)],
    [NUMERIC.lamC.label, String(inp.lamC)],
    [NUMERIC.kdm.label, String(inp.kdm)],
    ['Show results for', inp.size === 'auto' ? 'Smallest size that passes' : label(inp.size)],
  ]
}

const okCell = (ok, pass = 'Pass', fail = 'Fail') => ({ text: ok ? pass : fail, tone: ok ? 'ok' : 'bad', bold: true })

function summaryModel(r, { project, when }) {
  const s = r.selected
  const u = s.uls
  const c = s.cals
  const B = r.basis
  const inp = r.input
  const db4 = r.donoBrace
  const db3 = r.donoBraceCat3
  const hd = headline(r)
  const blocks = []

  blocks.push({ type: 'banner', ok: hd.pass, big: hd.big, sub: hd.sub })
  blocks.push({ type: 'stats', items: summaryStats(r).map((st) => ({ k: st.k, v: String(st.v), unit: st.unit })) })
  blocks.push({ type: 'callout', title: 'For sizing only.', text: SIZING_ONLY })
  if (r.messages.length) blocks.push({ type: 'messages', items: r.messages.map((m) => ({ level: m.level, text: m.text })) })

  blocks.push({ type: 'h', eyebrow: 'Inputs', text: 'Your initial model, hazard and factors' })
  blocks.push({ type: 'table', head: ['Input', 'Value'], widths: [0.62, 0.38], rows: inputRows(inp) })

  blocks.push({ type: 'h', eyebrow: 'Your model', text: 'What the calculator reads from it' })
  blocks.push({
    type: 'table',
    widths: [0.8, 0.2],
    rows: [
      ['Load case V/W, from T,e and the roof displacement', `${f(B.SaM, 3)} g`],
      ['÷ the 0.1 g applied, 1.00 when the period, seismic weight and displacement are consistent', f(B.loadRatio, 2)],
      ['Share of roof displacement from brace axial elongation, (axial elongation ÷ cos θ) ÷ roof displacement', pct(B.phi, 0)],
      ['Storey shear taken by the braces', pct(1 - B.p, 0)],
    ],
  })

  const sizeRows = [
    ['T,e (s)', (x) => f(x.Te, 3)],
    ['Locking', (x) => f(Math.max(x.lockSLS.ratio, x.lockWind.ratio), 2)],
    ['ULS', (x) => f(x.op.uls.ratio, 2)],
    ['CALS', (x) => f(x.op.cals.ratio, 2)],
    ['μ at ULS', (x) => (x.uls ? f(x.uls.mu, 2) : `> ${f(x.muStop, 2)}`)],
    ['δ at ULS (mm)', (x) => (x.uls ? f(x.uls.dqd) : '-')],
    ['δ at CALS (mm)', (x) => (x.cals ? f(x.cals.dqd) : 'past stop')],
  ]
  blocks.push({ type: 'h', eyebrow: 'Sizes', text: 'All sizes compared' })
  blocks.push({
    type: 'table',
    head: ['Size', ...QD_SIZES.map((z) => label(z))],
    widths: [0.36, ...QD_SIZES.map(() => 0.64 / QD_SIZES.length)],
    rows: [
      ['Basis', ...QD_SIZES.map((z) => (z === r.modelSize ? 'your model' : 'estimated'))],
      ...sizeRows.map(([n, get]) => [n, ...QD_SIZES.map((z) => get(r.all[z]))]),
      ['Result', ...QD_SIZES.map((z) => okCell(r.all[z].pass))],
    ],
  })
  blocks.push({ type: 'p', small: true, text: `Locking, ULS and CALS are demand ÷ limit, passing at 1.00 or less. μ is the actual displacement ductility at the ULS performance point; Category 2 (S,p = 0.7) needs μ above 1.25. Sizes other than your model’s are estimated by scaling the brace stiffness; re-run your model with the size you choose. The rest of this summary is for ${label(s.size)}.` })

  blocks.push({ type: 'h', eyebrow: 'Step 3', text: `Locking checks for ${label(s.size)}` })
  blocks.push({
    type: 'table',
    head: ['Locking', 'Brace force kN', 'F,slip kN', 'Ratio', ''],
    widths: [0.36, 0.17, 0.17, 0.15, 0.15],
    rows: [
      ['SLS earthquake, F,b,SLS', f(s.lockSLS.F), `${f(s.lockSLS.cap)} LBH`, f(s.lockSLS.ratio, 2), okCell(s.lockSLS.ratio <= 1)],
      ['1.3 × ULS wind, 1.3 F,b,wind', f(s.lockWind.F), `${f(s.lockWind.cap)} nominal`, f(s.lockWind.ratio, 2), okCell(s.lockWind.ratio <= 1)],
    ],
  })

  blocks.push({ type: 'h', eyebrow: 'Step 4', text: `One-point checks for ${label(s.size)}` })
  blocks.push({ type: 'p', text: `Governing ULS limit: ${s.limGov.label}, Δ,lim = ${f(s.Dlim)} mm. Activation at Δ,y = ${f(s.Dy)} mm; hard stop at Δ,stop = ${f(s.Dstop)} mm.` })
  const opRow = (name, op, lam, kind) => [name, f(lam, 2), f(op.D), f(op.T, 3), pct(op.xi), f(op.Sd), `${kind} ${f(op.D)}`, okCell(op.pass)]
  blocks.push({
    type: 'table',
    head: ['Check', 'λ', 'Δ mm', 'T s', 'ξ', 'S,d mm', 'Limit', ''],
    widths: [0.3, 0.07, 0.09, 0.09, 0.09, 0.1, 0.14, 0.12],
    rows: [
      opRow('ULS, at Δ,lim', s.op.uls, 1, 'max'),
      opRow('ULS, device at 33 mm', s.op.dev33, 1, 'max'),
      opRow('CALS, at δ,stop', s.op.cals, inp.lamC, 'max'),
      opRow('Ductility μ > 1.25, at 1.25 Δ,y', s.op.duct, 1, 'min'),
    ],
  })

  blocks.push({ type: 'h', eyebrow: 'Preliminary Step 7', text: `Performance points for ${label(s.size)}` })
  const pp = (x, name) => (x
    ? [name, f(x.D), f(x.dqd), f(x.F), f(x.Sa, 3), f(x.T, 3), pct(x.xi)]
    : [name, { text: 'Past the hard stop', tone: 'bad' }, '', '', '', '', ''])
  blocks.push({
    type: 'table',
    head: ['Performance point', 'Δ mm', 'δ mm', 'Brace kN', 'V/W', 'T,eff s', 'ξ,eff'],
    widths: [0.28, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
    rows: [
      pp(s.sls, s.sls.locked ? 'SLS (QD locked)' : 'SLS (QD slipping)'),
      pp(u, 'ULS'),
      pp(c, `CALS (λ = ${f(inp.lamC, 2)})`),
    ],
  })
  blocks.push({ type: 'p', small: true, text: `From the estimated backbone, with the spectrum reduced by ${spText(inp)} (${SP_METHOD_LABEL[inp.spMethod ?? 'marriott']}). Confirm with the cyclic pushover of your model (Steps 5 to 7).` })
  if (u) {
    blocks.push({
      type: 'p',
      text: `ULS drift × k,dm = ${pct(u.driftKdm / 100, 2)} (limit ${DRIFT_LIMIT}%); stability coefficient θ = ${f(u.theta, 3)}, so P-delta analysis is ${s.pdelta?.exempt ? `not required (NZS 1170.5 cl 6.5.2(${s.pdelta.exempt}))` : 'required (NZS 1170.5 cl 6.5.2)'}; ${s.brace} utilisation ${f(u.util, 2)}. Recentring (preliminary Step 9): restoring V/W ${f(s.recentre.restoring, 4)} against the P-delta demand Δ,y,UBH ÷ h = ${f(s.recentre.pdelta, 4)}, a ratio of ${f(s.recentre.ratio, 2)}${s.recentre.ratio >= 1 ? ', so the line recentres.' : ', so the line may not recentre.'}`,
    })
  }

  blocks.push({ type: 'h', eyebrow: 'Device', text: `${s.size} forces` })
  const bounds = [s.dL, s.dev, s.dU]
  const fr = (name, get) => [name, ...bounds.map((d) => f(get(d)))]
  blocks.push({
    type: 'table',
    head: ['kN', 'LBH', 'Nominal', 'UBH'],
    widths: [0.46, 0.18, 0.18, 0.18],
    rows: [
      fr('F,slip at 1 mm', (d) => d.Fslip),
      fr('F,ult at 50 mm', (d) => d.Fult),
      fr('F,restoring', (d) => d.Frest),
      fr('F,residual', (d) => d.Fres),
      fr('F at 33 mm', (d) => d.fLoad(D_ULS)),
    ],
  })
  blocks.push({ type: 'p', small: true, text: `F,max for capacity design is the UBH force at 50 mm: ${f(s.cap.Fmax)} kN (${f(s.cap.Fmax * B.c)} kN along the direction of loading). Optional DonoBrace overstrength for the end connections: ${f(s.cap.os)} kN.` })

  blocks.push({ type: 'h', eyebrow: 'Comparison', text: 'The same line with DonoBrace alone' })
  const capBasis = (d) => (d.cappedC ? '1.25 φN,t, (4)(c)' : d.os <= d.elasticCap ? '1.3 N,t' : `elastic cap, S,p = ${d.category === 3 ? '0.9' : '1.0'}`)
  const dbCals = (d) => ({ text: `${f(d.Dcals)} mm`, sub: `${f(d.calsStress, 0)} of ${DB_FU} MPa`, tone: d.okCals ? undefined : 'bad' })
  const pdText = (pd) => (pd.exempt ? `not required, cl 6.5.2(${pd.exempt})` : 'required, cl 6.5.2')
  blocks.push({
    type: 'table',
    head: ['', label(s.size), `${db4.brace} alone, Cat 4`, `${db3.brace} alone, Cat 3`],
    widths: [0.31, 0.23, 0.23, 0.23],
    rows: [
      ['ULS brace force', u ? `${f(u.F)} kN` : '-', { text: `${f(db4.Nstar)} kN`, sub: `of φN,t ${f(db4.phiNt)}`, tone: db4.okUls ? undefined : 'bad' }, { text: `${f(db3.Nstar)} kN`, sub: `of φN,t ${f(db3.phiNt)}`, tone: db3.okUls ? undefined : 'bad' }],
      ['ULS base shear coefficient V/W', u ? f(u.Sa, 3) : '-', { text: f(db4.Vs, 3), sub: `C,s ${f(db4.Cs, 1)} × C,d ${f(db4.V, 3)}` }, { text: f(db3.Vs, 3), sub: `C,s ${f(db3.Cs, 1)} × C,d ${f(db3.V, 3)}` }],
      ['Load path (method basis)', { text: `${f(s.cap.Fmax)} kN`, sub: 'F,max' }, { text: `${f(db4.Nconn)} kN`, sub: 'elastic, S,p = 1.0' }, { text: `${f(db3.Nconn)} kN`, sub: capBasis(db3) }],
      ['End connections (overstrength)', `${f(s.cap.os)} kN`, { text: `${f(db4.osCapped)} kN`, sub: capBasis(db4) }, { text: `${f(db3.osCapped)} kN`, sub: capBasis(db3) }],
      ['ULS drift with k,dm', { text: u ? pct(u.driftKdm / 100, 2) : '-', sub: `limit ${DRIFT_LIMIT}%` }, ...[db4, db3].map((d) => ({ text: pct(d.driftKdm / 100, 2), sub: `limit ${DRIFT_LIMIT}%`, tone: d.okDrift ? undefined : 'bad' }))],
      ['SLS drift', pct(s.sls.D / (inp.h * 1000), 2), pct(db4.driftSls / 100, 2), pct(db3.driftSls / 100, 2)],
      ['P-delta analysis (NZS 1170.5)', s.pdelta ? { text: `θ ${f(s.pdelta.theta, 3)}`, sub: pdText(s.pdelta) } : '-', ...[db4, db3].map((d) => ({ text: `θ ${f(d.pdelta.theta, 3)}`, sub: pdText(d.pdelta) }))],
      ['CALS', c ? { text: `${f(c.D)} mm`, sub: `δ ${f(c.dqd)} of 50 mm` } : 'past stop', dbCals(db4), dbCals(db3)],
      ['Result', okCell(s.pass), okCell(db4.ok), okCell(db3.ok)],
    ],
  })
  blocks.push({ type: 'p', small: true, text: `Both DonoBrace-only designs use S,p = 0.9 to NZS 3404. Category 4 is elastic (μ = 1.0, C,s = 1.0). Category 3 is nominally ductile (μ = 1.25, design action ÷ k,μ = ${f(db3.kmu, 2)}, C,s = 1.1 for a 1 to 2 storey tension-braced frame, NZS 3404 cl 12.12.6.3.2). Overstrength actions are 1.3 N,t, capped at the elastic response per NZS 3404 cl 12.9.1.2.2(4)(b) and (c).` })

  const date = when.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = when.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
  return {
    kicker: 'SEISMIC SHIFT  |  QUAKE DEFENDER',
    title: 'Quake Defender sizing summary',
    subject: BASIS_LINE,
    meta: [
      ...(project ? [`Project: ${project}`] : []),
      `Generated ${date}, ${time}, from ${PAGE_URL}`,
      `Basis: ${BASIS_LINE}. Step 4 sizing only.`,
    ],
    footer: `${PAGE_URL}  |  For sizing only, not the design`,
    blocks,
  }
}

function summaryFilename(r, project, when) {
  const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  const d = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`
  return ['qd-sizing', project ? slug(project) : null, slug(r.selected.size), d].filter(Boolean).join('-') + '.pdf'
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGE_CLASS = {
  bad: 'bg-red-50 border-red-200 text-red-700',
  warn: 'bg-[#fdf6ec] border-[#c07c1c]/40 text-[#7a4a10]',
  info: 'bg-[#eef1f3] border-slate-200 text-slate-700',
}

// One column per size (only three), so the table fits without scrolling even on
// a phone. The size shown in the rest of the results is tinted.
function SizeTable({ r }) {
  const sel = r.selected.size
  const rows = [
    ['T,e (s)', (x) => f(x.Te, 3)],
    ['Locking', (x) => f(Math.max(x.lockSLS.ratio, x.lockWind.ratio), 2)],
    ['ULS', (x) => f(x.op.uls.ratio, 2)],
    ['CALS', (x) => f(x.op.cals.ratio, 2)],
    ['μ at ULS', (x) => (x.uls ? f(x.uls.mu, 2) : `> ${f(x.muStop, 2)}`)],
    ['δ at ULS (mm)', (x) => (x.uls ? f(x.uls.dqd) : '-')],
    ['δ at CALS (mm)', (x) => (x.cals ? f(x.cals.dqd) : 'past stop')],
  ]
  const tint = (size) => (size === sel ? 'bg-[#eef1f3]' : '')
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs sm:text-sm text-left border-collapse">
        <thead>
          <tr className="bg-[#17638f] text-white">
            <th className="px-2 sm:px-3 py-2 font-black text-xs align-bottom">Size</th>
            {QD_SIZES.map((size) => (
              <th key={size} className={`px-2 sm:px-3 py-2 text-right align-bottom ${size === sel ? 'bg-[#0f4c6e]' : ''}`}>
                <span className="block font-black text-xs whitespace-nowrap">
                  {size}<span className="hidden sm:inline"> + </span><br className="sm:hidden" />{QD[size].brace}
                </span>
                <span className="block text-[0.6rem] sm:text-[0.68rem] font-bold uppercase tracking-wide opacity-80 whitespace-nowrap">
                  {size === r.modelSize ? (
                    <><span className="sm:hidden">model</span><span className="hidden sm:inline">your model</span></>
                  ) : (
                    <><span className="sm:hidden">est.</span><span className="hidden sm:inline">estimated</span></>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map(([name, get]) => (
            <tr key={name}>
              <Td className="!px-2 sm:!px-3">{name}</Td>
              {QD_SIZES.map((size) => <Num key={size} className={`!px-2 sm:!px-3 ${tint(size)}`}>{get(r.all[size])}</Num>)}
            </tr>
          ))}
          <tr>
            <Td className="!px-2 sm:!px-3">Result</Td>
            {QD_SIZES.map((size) => (
              <Td key={size} className={`!px-2 sm:!px-3 text-right ${tint(size)}`}><Chip ok={r.all[size].pass} /></Td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// The pass / fail headline, shared by the page and the summary PDF.
function headline(r) {
  const s = r.selected
  const auto = r.input.size === 'auto'
  let big
  let sub
  if (auto && r.recommended) {
    big = `${label(r.recommended)} passes`
    sub = 'Smallest size that passes the Step 3 locking checks and the Step 4 one-point checks.'
  } else if (auto) {
    big = 'No standard QD size passes'
    sub = 'Showing QD280 + DB25. See the size table and messages below.'
  } else if (s.pass) {
    big = `${label(s.size)} passes`
    sub = 'Passes the Step 3 locking checks and the Step 4 one-point checks.'
  } else {
    const failed = []
    if (!s.passLock) failed.push('locking')
    if (!s.op.uls.pass) failed.push('ULS')
    if (!s.op.cals.pass) failed.push('CALS')
    if (!s.op.duct.pass) failed.push('ductility')
    big = `${label(s.size)} fails`
    sub = `Fails the ${failed.join(', ')} check${failed.length > 1 ? 's' : ''}.${
      r.recommended ? ` ${label(r.recommended)} is the smallest size that passes.` : ' No standard QD size passes.'
    }`
  }
  return { big, sub, pass: auto ? !!r.recommended : s.pass }
}

// The stat tiles under the headline, shared by the page and the summary PDF.
function summaryStats(r) {
  const s = r.selected
  const u = s.uls
  const c = s.cals
  const db = r.donoBrace
  return [
    { k: 'QD travel at ULS', v: u ? f(u.dqd) : '-', unit: 'of 33 mm' },
    { k: 'QD travel at CALS', v: c ? f(c.dqd) : 'past stop', unit: c ? 'of 50 mm' : '' },
    { k: 'Ductility μ at ULS', v: u ? f(u.mu, 2) : '-', unit: '' },
    { k: 'Brace force at ULS', v: u ? f(u.F) : '-', unit: 'kN' },
    { k: 'DonoBrace alone, Cat 4 / Cat 3', v: `${db.brace} / ${r.donoBraceCat3.brace}`, unit: '' },
  ]
}

// The "For sizing only" note, shared by the page and the summary PDF.
const SIZING_ONLY = 'These checks select a QD and DonoBrace size from your initial model; they are not the design. The real configuration, with the selected QD and DonoBrace in every braced bay, is checked in your full structural model: re-run it with the selected size and complete the full design (Steps 5 to 9 of the methodology) in your own calculations.'

function Summary({ r }) {
  const { big, sub, pass } = headline(r)
  const stats = summaryStats(r)

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 sm:p-5 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Chip ok={pass} />
        <p className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900">{big}</p>
      </div>
      <p className="text-sm text-slate-500 mt-1.5">{sub}</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5">
        {stats.map((st) => (
          <div key={st.k} className="bg-white border border-slate-100 rounded-xl px-3.5 py-3">
            <p className="text-xs font-black text-slate-400">{st.k}</p>
            <p className="font-black text-xl tracking-tight text-slate-900 tabular-nums mt-1">
              {st.v}
              {st.unit && <small className="text-xs font-bold text-slate-400 tracking-normal ml-1">{st.unit}</small>}
            </p>
          </div>
        ))}
      </div>

      <SizeTable r={r} />
      <Note>
        Locking, ULS and CALS are demand ÷ limit, passing at 1.00 or less. μ is the actual displacement ductility at the ULS performance point, Δ,PP ÷ Δ,y; Category 2 (S,p = 0.7) needs μ above 1.25. Sizes other than your model&rsquo;s are estimated by scaling the brace stiffness; re-run your model with the size you choose.
      </Note>
    </div>
  )
}

function Messages({ messages }) {
  if (!messages.length) return null
  return (
    <ul className="space-y-2">
      {messages.map((m) => (
        <li key={m.code} className={`border rounded-xl px-4 py-2.5 text-sm leading-relaxed ${MESSAGE_CLASS[m.level]}`}>
          {m.text}
        </li>
      ))}
    </ul>
  )
}

function ModelBasis({ B }) {
  return (
    <section>
      <StepHead eyebrow="Your model" title="What the calculator reads from it" />
      <Table>
        <tr><Td>Load case V/W, from T,e and the roof displacement</Td><Num>{f(B.SaM, 3)} g</Num></tr>
        <tr><Td>÷ the 0.1 g applied, 1.00 when the period, seismic weight and displacement are consistent</Td><Num>{f(B.loadRatio, 2)}</Num></tr>
        <tr><Td>Share of roof displacement from brace axial elongation, (axial elongation ÷ cos θ) ÷ roof displacement</Td><Num>{pct(B.phi, 0)}</Num></tr>
        <tr><Td>Storey shear taken by the braces</Td><Num>{pct(1 - B.p, 0)}</Num></tr>
      </Table>
    </section>
  )
}

function DeviceSection({ s, B }) {
  const bounds = [s.dL, s.dev, s.dU]
  const row = (name, get) => (
    <tr key={name}>
      <Td>{name}</Td>
      {bounds.map((d) => <Num key={d.bound}>{f(get(d))}</Num>)}
    </tr>
  )
  return (
    <section>
      <StepHead eyebrow="Device" title={`${s.size} hysteresis, full loop to the hard stop`} />
      <p className="text-base text-slate-500 leading-relaxed mb-4">
        The dots show where the SLS, ULS and CALS points sit on the loop, the same points as on the ADRS below. The green dot is the Step 3 SLS locking-check force, {f(s.FbSLS)} kN: the larger of the SLS brace forces at T,e and at the full-bar-area period, which should stay below the LBH slip force. The SLS point on the ADRS below is the displacement demand at T,e. ULS travel is limited to 33 mm; at CALS the QD may travel to its hard stop at 50 mm.
      </p>
      <div className="grid gap-5">
        <div className="max-w-2xl"><LoopChart s={s} /></div>
        <div className="max-w-2xl">
          <Table head={['kN', 'LBH', 'Nominal', 'UBH']}>
            {row('F,slip at 1 mm', (d) => d.Fslip)}
            {row('F,ult at 50 mm', (d) => d.Fult)}
            {row('F,restoring', (d) => d.Frest)}
            {row('F,residual', (d) => d.Fres)}
            {row('F at 33 mm', (d) => d.fLoad(D_ULS))}
          </Table>
          <Note>
            F,max for capacity design is the UBH force at 50 mm: {f(s.cap.Fmax)} kN ({f(s.cap.Fmax * B.c)} kN along the direction of loading).
          </Note>
        </div>
      </div>
    </section>
  )
}

function ChecksSection({ s, input }) {
  const u = s.uls
  const opRow = (name, op, lam, cmp) => (
    <tr key={name}>
      <Td>{name}</Td>
      <Num>{f(lam, 2)}</Num>
      <Num>{f(op.D)}</Num>
      <Num>{f(op.T, 3)}</Num>
      <Num>{pct(op.xi)}</Num>
      <Num>{f(op.Sd)}</Num>
      <Num>{cmp} {f(op.D)}</Num>
      <Td className="text-right"><Chip ok={op.pass} /></Td>
    </tr>
  )
  return (
    <>
      <section>
        <StepHead eyebrow="Step 3" title={`Locking checks for ${label(s.size)}`} />
        <p className="text-base text-slate-500 leading-relaxed mb-4">
          The QD must stay locked for SLS earthquake and ULS wind: the SLS brace force is compared with the lower-bound (LBH) slip force, and 1.3 × the wind brace force with the nominal slip force.
        </p>
      <Table head={['Locking', 'Brace force kN', 'F,slip kN', 'Ratio', '']}>
        <tr>
          <Td>SLS earthquake, Fb,SLS</Td>
          <Num>{f(s.lockSLS.F)}</Num>
          <Num>{f(s.lockSLS.cap)} LBH</Num>
          <Num>{f(s.lockSLS.ratio, 2)}</Num>
          <Td className="text-right"><Chip ok={s.lockSLS.ratio <= 1} /></Td>
        </tr>
        <tr>
          <Td>1.3 × ULS wind, 1.3 Fb,wind</Td>
          <Num>{f(s.lockWind.F)}</Num>
          <Num>{f(s.lockWind.cap)} nominal</Num>
          <Num>{f(s.lockWind.ratio, 2)}</Num>
          <Td className="text-right"><Chip ok={s.lockWind.ratio <= 1} /></Td>
        </tr>
      </Table>
      </section>
      <section>
        <StepHead eyebrow="Step 4" title={`One-point checks for ${label(s.size)}`} />
      <p className="text-base text-slate-500 leading-relaxed mb-4">
        Governing ULS limit: {s.limGov.label}, Δ,lim = {f(s.Dlim)} mm. Activation at Δ,y = {f(s.Dy)} mm; hard stop at Δ,stop = {f(s.Dstop)} mm.
      </p>
      <Table head={['Check', 'λ', 'Δ mm', 'T s', 'ξ', 'S,d mm', 'Limit', '']}>
        {opRow('ULS, at Δ,lim', s.op.uls, 1, '≤')}
        {opRow('ULS, device at 33 mm', s.op.dev33, 1, '≤')}
        {opRow('CALS, at δ,stop', s.op.cals, input.lamC, '≤')}
        {opRow('Ductility μ > 1.25, at 1.25 Δ,y', s.op.duct, 1, '≥')}
      </Table>
      <Note>
        The ductility check confirms μ above 1.25 from one spectrum reading. The actual ductility at the ULS performance point is {u ? `μ = ${f(u.mu, 2)}` : 'not available'}.
      </Note>
      </section>
      <section>
        <StepHead eyebrow="Preliminary Step 7" title={`SLS, ULS and CALS performance points for ${label(s.size)}`} />
        <PerformancePoints s={s} input={input} />
      </section>
    </>
  )
}

// A number with its basis in small type underneath, so three columns stay narrow.
function Basis({ value, basis }) {
  return (
    <>
      {value}
      {basis && <span className="block text-[0.7rem] font-medium text-slate-400 whitespace-normal leading-snug mt-0.5">{basis}</span>}
    </>
  )
}

function ComparisonSection({ s, db4, db3, h }) {
  const u = s.uls
  const c = s.cals
  const dbCals = (d) => (
    <span className={d.okCals ? '' : 'text-red-600'}>
      <Basis value={`${f(d.Dcals)} mm`} basis={`${f(d.calsStress, 0)} of ${DB_FU} MPa`} />
    </span>
  )
  const fails = (d) => (d.ok ? '' : ` Even DB25 fails as Category ${d.category} (${[!d.okUls && 'ULS strength', !d.okCals && 'CALS stress', !d.okDrift && 'drift'].filter(Boolean).join(', ')}).`)
  const pdText = (pd) => (pd.exempt ? `not required, cl 6.5.2(${pd.exempt})` : 'required, cl 6.5.2')
  const capBasis = (d) =>
    d.cappedC ? '1.25 φN,t, (4)(c)' : d.os <= d.elasticCap ? '1.3 N,t' : `elastic cap, S,p = ${d.category === 3 ? '0.9' : '1.0'}`
  return (
    <section>
      <StepHead eyebrow="Comparison" title="The same line with DonoBrace alone" />
      <p className="text-base text-slate-500 leading-relaxed mb-2">Two DonoBrace-only designs of the same line to NZS 3404:</p>
      <ul className="list-disc pl-5 space-y-1.5 text-base text-slate-500 leading-relaxed mb-4">
        <li><strong className="text-slate-700">Both:</strong> S,p = 0.9, period from the full bar area, displacements from the SRF stiffness.</li>
        <li><strong className="text-slate-700">Category 4</strong> (elastic, μ = 1.0): the DonoBrace method. C,s = 1.0.</li>
        <li>
          <strong className="text-slate-700">Category 3</strong> (nominally ductile, μ = 1.25, NZS 3404 Table 12.2.4): design action ÷ k,μ = {f(db3.kmu, 2)} (NZS 1170.5 cl 5.2.1.1), elastic displacement × μ (cl 7.2.1.1), and strength × C,s = 1.1 for a 1 to 2 storey tension-braced frame (NZS 3404 cl 12.12.6.3.2).
        </li>
        <li>
          <strong className="text-slate-700">Bar size:</strong> the smallest bar with N* ≤ φN,t, drift × k,dm ≤ {DRIFT_LIMIT}% (NZS 1170.5 cl 7.5.1), and brace stress at the CALS displacement ≤ {DB_FU} MPa, the bar&rsquo;s ultimate strength.
        </li>
      </ul>
      {(!db4.ok || !db3.ok) && (
        <p className="text-sm font-bold text-red-600 mb-4">{fails(db4)}{fails(db3)}</p>
      )}
      <Table
        head={['', label(s.size), `${db4.brace} alone, Cat 4`, `${db3.brace} alone, Cat 3`]}
        cols={['31%', '23%', '23%', '23%']}
        minWidth="34rem"
      >
        <tr>
          <Td>ULS brace force</Td>
          <Num>{u ? `${f(u.F)} kN` : '-'}</Num>
          <Num><Basis value={`${f(db4.Nstar)} kN`} basis={`of φN,t ${f(db4.phiNt)}`} /></Num>
          <Num><Basis value={`${f(db3.Nstar)} kN`} basis={`of φN,t ${f(db3.phiNt)}`} /></Num>
        </tr>
        <tr>
          <Td>ULS base shear coefficient V/W</Td>
          <Num>{u ? f(u.Sa, 3) : '-'}</Num>
          <Num><Basis value={f(db4.Vs, 3)} basis={`C,s ${f(db4.Cs, 1)} × C,d ${f(db4.V, 3)}`} /></Num>
          <Num><Basis value={f(db3.Vs, 3)} basis={`C,s ${f(db3.Cs, 1)} × C,d ${f(db3.V, 3)}`} /></Num>
        </tr>
        <tr>
          <Td>Load path (method basis)</Td>
          <Num><Basis value={`${f(s.cap.Fmax)} kN`} basis="F,max" /></Num>
          <Num><Basis value={`${f(db4.Nconn)} kN`} basis="elastic, S,p = 1.0" /></Num>
          <Num><Basis value={`${f(db3.Nconn)} kN`} basis={capBasis(db3)} /></Num>
        </tr>
        <tr>
          <Td>End connections (overstrength)</Td>
          <Num>{f(s.cap.os)} kN</Num>
          <Num><Basis value={`${f(db4.osCapped)} kN`} basis={capBasis(db4)} /></Num>
          <Num><Basis value={`${f(db3.osCapped)} kN`} basis={capBasis(db3)} /></Num>
        </tr>
        <tr>
          <Td>ULS drift with k,dm</Td>
          <Num><Basis value={u ? pct(u.driftKdm / 100, 2) : '-'} basis={`limit ${DRIFT_LIMIT}%`} /></Num>
          {[db4, db3].map((d) => (
            <Num key={d.category} className={d.okDrift ? '' : 'text-red-600'}><Basis value={pct(d.driftKdm / 100, 2)} basis={`limit ${DRIFT_LIMIT}%`} /></Num>
          ))}
        </tr>
        <tr>
          <Td>SLS drift</Td>
          <Num>{pct(s.sls.D / (h * 1000), 2)}</Num>
          <Num>{pct(db4.driftSls / 100, 2)}</Num>
          <Num>{pct(db3.driftSls / 100, 2)}</Num>
        </tr>
        <tr>
          <Td>P-delta analysis (NZS 1170.5)</Td>
          <Num>{s.pdelta ? <Basis value={`θ ${f(s.pdelta.theta, 3)}`} basis={pdText(s.pdelta)} /> : '-'}</Num>
          {[db4, db3].map((d) => (
            <Num key={d.category}><Basis value={`θ ${f(d.pdelta.theta, 3)}`} basis={pdText(d.pdelta)} /></Num>
          ))}
        </tr>
        <tr>
          <Td>CALS</Td>
          <Num>{c ? <Basis value={`${f(c.D)} mm`} basis={`δ ${f(c.dqd)} of 50 mm`} /> : 'past stop'}</Num>
          <Num>{dbCals(db4)}</Num>
          <Num>{dbCals(db3)}</Num>
        </tr>
      </Table>
      <Note>
        DonoBrace overstrength actions are 1.3 N,t, capped at the elastic response (NZS 3404 cl 12.9.1.2.2(4)(b); for Category 4 the S,p = 1.0 elastic actions of cl 12.9.1.2.2(2) are the upper limit). Where the cap governs a Category 3 connection, cl 12.9.1.2.2(4)(c) then sets it at 1.25 × the brace design capacity, 1.25 φN,t, which assumes bolted, pinned or fillet-welded connections.
      </Note>
    </section>
  )
}

const EQUATIONS = `K/W = (2π/T,e)² / g            load case S,a = K/W × Δ,e
F(δ) from the QD loop           brace flexibility f = axial elongation ÷ force, scaled by (SRF·A) for other bars
Δ(δ) = F (f/cos θ + other) + δ/cos θ,  other = (Δ,e − e/cos θ) ÷ F,e
V/W = F ÷ F-per-g of the braced line + (other elements' stiffness) × Δ
T = 2π √(Δ / (g V/W))      ξ = 0.05 + A(δ) / (π F cos θ Δ) × braced-line share of V
S,d = λ × S,p factor × η(ξ) × C(T) × g (T/2π)²   (S,p factor per the S,p option chosen)`

function PerformancePoints({ s, input }) {
  const u = s.uls
  const c = s.cals
  const pp = (x, name) =>
    x ? (
      <tr key={name}>
        <Td>{name}</Td>
        <Num>{f(x.D)}</Num>
        <Num>{f(x.dqd)}</Num>
        <Num>{f(x.F)}</Num>
        <Num>{f(x.Sa, 3)}</Num>
        <Num>{f(x.T, 3)}</Num>
        <Num>{pct(x.xi)}</Num>
      </tr>
    ) : (
      <tr key={name}>
        <Td>{name}</Td>
        <td colSpan={6} className="px-3 py-2 text-red-600 font-bold">Demand exceeds capacity before the hard stop</td>
      </tr>
    )

  return (
    <div>
      <p className="text-base text-slate-500 leading-relaxed mb-4">
        A preliminary version of methodology Step 7, from the estimated backbone; confirm it with the cyclic pushover of your model (Steps 5 to 7). The estimated capacity curve against the damped demand spectra, with the spectrum reduced by {spText(input)} ({SP_METHOD_LABEL[input.spMethod ?? 'marriott']}). Each performance point is where the capacity curve meets the spectrum for its own effective damping. The SLS point is on the T,e line of your DonoBrace-only model; the capacity curve includes the small flexibility of the locked QD, so the SLS point sits slightly above it.
      </p>
      <div className="max-w-3xl">
        <AdrsChart s={s} input={input} />
      </div>
      <Table className="mt-5" head={['Performance point', 'Δ mm', 'δ mm', 'Brace kN', 'V/W', 'T,eff s', 'ξ,eff']}>
        {pp(s.sls, s.sls.locked ? 'SLS (QD locked)' : 'SLS (QD slipping)')}
        {pp(u, 'ULS')}
        {pp(c, `CALS (λ = ${f(input.lamC, 2)})`)}
      </Table>
      {u && (
        <Note>
          ULS drift × k,dm = {pct(u.driftKdm / 100, 2)} (limit {DRIFT_LIMIT}%); stability coefficient θ = {f(u.theta, 3)}, so P-delta analysis is {s.pdelta?.exempt ? `not required (NZS 1170.5 cl 6.5.2(${s.pdelta.exempt}))` : 'required (NZS 1170.5 cl 6.5.2)'}; {s.brace} utilisation {f(u.util, 2)}. Recentring (preliminary Step 9): the UBH residual force gives a restoring V/W of {f(s.recentre.restoring, 4)} against the P-delta demand Δ,y,UBH ÷ h = {f(s.recentre.pdelta, 4)}, a ratio of {f(s.recentre.ratio, 2)}{s.recentre.ratio >= 1 ? ', so the line recentres' : <strong className="text-red-600">, so the line may not recentre</strong>}.
        </Note>
      )}
    </div>
  )
}

function Working({ s }) {
  const bb = (name, st) => (
    <tr key={name}>
      <Td>{name}</Td>
      <Num>{f(st.dqd)}</Num>
      <Num>{f(st.F)}</Num>
      <Num>{f(st.D)}</Num>
      <Num>{f(st.Sa, 3)}</Num>
    </tr>
  )

  return (
    <details className="pt-8 border-t border-slate-100 group">
      <summary className={`inline-flex items-center gap-2 cursor-pointer select-none text-sm font-black tracking-wide uppercase text-[#17638f] hover:text-[#0f4c6e] transition motion-reduce:transition-none list-none [&::-webkit-details-marker]:hidden rounded ${BUTTON_FOCUS}`}>
        <span>Show working</span>
        <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="mt-4 pl-4 md:pl-5 border-l-2 border-slate-200 space-y-5">
        <p className="text-base text-slate-500 leading-relaxed">
          Estimated backbone for {label(s.size)}. The capacity curve is built from your model: its elastic part scales with brace force, QD travel adds δ ÷ cos θ, and the base shear coefficient follows the brace force.
        </p>
        <Table head={['Backbone point', 'δ mm', 'F kN', 'Δ mm', 'V/W']}>
          {bb('Activation, Δ,y', s.pts.y)}
          {bb('1.25 Δ,y', s.pts.y125)}
          {bb('Governing ULS limit, Δ,lim', s.pts.lim)}
          {bb('Device limit, δ = 33 mm', s.pts.d33)}
          {bb('Hard stop, Δ,stop', s.pts.stop)}
        </Table>
        <pre className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-4 overflow-x-auto leading-relaxed">{EQUATIONS}</pre>
      </div>
    </details>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function QdSizingCalculator() {
  const [form, setForm] = useState(exampleForm)
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(() => runQdSizing(WORKED_EXAMPLE))
  const [evalFailed, setEvalFailed] = useState(false)
  const [status, setStatus] = useState({ text: '', error: false })
  const [project, setProject] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const projectId = useId()
  const termsRef = useRef(null)
  const onTerms = () => termsRef.current?.showModal()

  // Recalculate on every change; on invalid or unevaluable input, keep showing
  // the last good result and flag the fields instead.
  function recalc(next) {
    setForm(next)
    const parsed = parseForm(next)
    setErrors(parsed.errors)
    if (!parsed.ok) return
    try {
      setResult(runQdSizing(parsed.input))
      setEvalFailed(false)
    } catch {
      setEvalFailed(true)
    }
  }

  const onChange = (key, value) => recalc({ ...form, [key]: value })

  function onSize(size) {
    if (size === form.size) return
    recalc({ ...form, size })
    track('qd_sizing_size_change', { size })
  }

  function onSpMethod(spMethod) {
    if (spMethod === form.spMethod) return
    recalc({ ...form, spMethod })
    track('qd_sizing_sp_method_change', { sp_method: spMethod })
  }

  function loadExample() {
    recalc(exampleForm())
    setStatus({ text: 'Worked example loaded.', error: false })
    track('qd_sizing_load_example')
  }

  const stale = Object.keys(errors).length > 0 || evalFailed
  const s = result.selected

  // Builds the summary PDF in the browser and downloads it. Refuses while the
  // inputs are invalid, so a PDF never shows a result that no longer matches
  // the form.
  async function downloadSummary() {
    if (pdfBusy) return
    if (stale) {
      setStatus({ text: 'Fix the highlighted inputs first: the summary must match the inputs shown.', error: true })
      return
    }
    setPdfBusy(true)
    setStatus({ text: 'Making your PDF...', error: false })
    try {
      const when = new Date()
      const name = project.trim()
      const [{ buildQdSummaryPdf }, { saveBlob }] = await Promise.all([import('../lib/qdSummaryPdf'), import('../lib/pdfText')])
      const bytes = await buildQdSummaryPdf(summaryModel(result, { project: name, when }), { regular: regularFontUrl, bold: boldFontUrl })
      saveBlob(new Blob([bytes], { type: 'application/pdf' }), summaryFilename(result, name, when))
      setStatus({ text: 'Summary PDF downloaded.', error: false })
      track('qd_sizing_download_pdf', { size: result.selected.size })
    } catch {
      setStatus({ text: 'Sorry, the PDF could not be made. Check your connection and try again.', error: true })
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-100 shadow-sm bg-white overflow-hidden p-4 sm:p-6 md:p-9">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <form onSubmit={(e) => e.preventDefault()} noValidate aria-label="Inputs">
          <p className="text-sm mb-5"><TermsButton onOpen={onTerms} /></p>
          <Inputs form={form} errors={errors} onChange={onChange} onSize={onSize} onSpMethod={onSpMethod} />

          <div className="mt-8">
            <label htmlFor={projectId} className={LABEL_CLASS}>Project or reference (optional)</label>
            <input
              id={projectId}
              type="text"
              value={project}
              maxLength={80}
              onChange={(e) => setProject(e.target.value)}
              aria-describedby={`${projectId}-help`}
              className={FIELD_CLASS}
            />
            <p id={`${projectId}-help`} className="text-xs mt-1.5 text-slate-400">Printed on the summary PDF. The PDF is made in your browser; nothing is sent anywhere.</p>
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              type="button"
              onClick={downloadSummary}
              disabled={pdfBusy}
              className={`font-bold text-sm px-5 py-2.5 rounded-full text-white bg-[#17638f] hover:bg-[#0f4c6e] disabled:opacity-60 transition motion-reduce:transition-none ${BUTTON_FOCUS}`}
            >
              {pdfBusy ? 'Making PDF...' : 'Download summary PDF'}
            </button>
            <button
              type="button"
              onClick={loadExample}
              className={`font-bold text-sm px-5 py-2.5 rounded-full border-2 border-slate-300 text-slate-600 bg-white hover:border-slate-400 transition motion-reduce:transition-none ${BUTTON_FOCUS}`}
            >
              Load worked example
            </button>
          </div>
          <p role="status" className={`text-sm font-bold mt-3 min-h-[1.25rem] ${status.error ? 'text-red-600' : ''}`} style={status.error ? undefined : { color: BRAND }}>{status.text}</p>
          <p className="text-xs text-slate-400 leading-relaxed mt-3">
            Opens with the methodology worked example: a DB20 model of one 7.5 × 6.0 m bay, Z = 0.3, soil D.
          </p>
        </form>

        <div className="min-w-0 space-y-10" aria-live="polite">
          <div className="space-y-4">
            <div className="border border-[#c07c1c]/40 bg-[#fdf6ec] rounded-2xl p-5 text-sm text-slate-700 leading-relaxed">
              <strong style={{ color: EQ }}>For sizing only.</strong> {SIZING_ONLY} <TermsButton onOpen={onTerms} />
            </div>
            {stale && (
              <p className="border border-red-200 bg-red-50 text-red-700 rounded-xl px-4 py-2.5 text-sm font-bold">
                {evalFailed
                  ? 'These inputs could not be evaluated. Showing the last valid result - check the values entered.'
                  : 'Showing the last valid result. Fix the highlighted fields to update it.'}
              </p>
            )}
            <Summary r={result} />
            <Messages messages={result.messages} />
          </div>
          <ModelBasis B={result.basis} />
          <DeviceSection s={s} B={result.basis} />
          <ChecksSection s={s} input={result.input} />
          <ComparisonSection s={s} db4={result.donoBrace} db3={result.donoBraceCat3} h={result.input.h} />
          <Working s={s} />
        </div>
      </div>
      <TermsDialog dialogRef={termsRef} />
    </div>
  )
}
