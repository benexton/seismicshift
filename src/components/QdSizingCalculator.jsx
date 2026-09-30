import React, { useId, useState } from 'react'
import {
  runQdSizing,
  WORKED_EXAMPLE,
  QD,
  QD_SIZES,
  D_SLIP,
  D_STOP,
  D_ULS,
  ch,
  eta,
  sd,
} from '../lib/qdSizing'

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
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

// Numeric fields, with the same bounds as the reference prototype. pShare is
// entered as a percentage and divided by 100 before it reaches the engine.
const NUMERIC = {
  angle: { label: 'Brace angle to the direction of loading, θ (°)', min: 5, max: 85, help: 'Wall bracing: angle to the horizontal. Roof bracing: angle in plan to the earthquake direction.' },
  Te: { label: 'Elastic period T,e (s)', min: 0.02, help: 'From your model, in this direction.' },
  Fe: { label: 'Critical brace force (kN)', min: 0.1 },
  ee: { label: 'Critical brace elongation (mm)', min: 0.01 },
  De: { label: 'Roof displacement (mm)', min: 0.01, help: 'At the deformation-control point.' },
  pShare: { label: 'Storey shear taken by other elements (%)', min: 0, max: 90, help: 'Portal frames, out-of-plane walls or other elements acting in parallel with the braces in this direction. Usually 0.' },
  h: { label: 'Storey height h (m)', min: 0.5, help: 'For drift and P-delta.' },
  Z: { label: 'Hazard factor Z', min: 0.05 },
  R: { label: 'Return period factor R,u', min: 0.1 },
  N: { label: 'Near-fault factor N', min: 1, help: '1.0 if not near-fault.' },
  wind: { label: 'ULS wind force in the critical brace (kN)', min: 0 },
  Sp: { label: 'S,p at ULS', min: 0.5, max: 1, help: 'NZS 3404 Cl 12.2.2.1' },
  Rs: { label: 'SLS return period factor R,s', min: 0.1 },
  lamC: { label: 'CALS hazard factor λ', min: 1 },
  kdm: { label: 'Drift modification k,dm', min: 1 },
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
    const err = fieldError(key, form[key])
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

function Table({ head, children, className = '' }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-200 ${className}`}>
      <table className="w-full text-sm text-left border-collapse">
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
      <legend className="float-left w-full text-sm font-black uppercase tracking-widest text-slate-900 mb-1">{title}</legend>
      {intro && <p className="clear-left text-sm text-slate-400 leading-relaxed mb-3">{intro}</p>}
      <div className="clear-left grid gap-4 pt-2">{children}</div>
    </fieldset>
  )
}

function Inputs({ form, errors, onChange, onSize }) {
  const numberField = (name) => <NumberField name={name} value={form[name]} error={errors[name]} onChange={onChange} />
  return (
    <div className="space-y-6">
      <Group
        title="Your initial DonoBrace model"
        intro="A model of the building with DonoBrace only (no QD), DonoBrace stiffness reduction factor applied."
      >
        <SelectField
          name="braceModel"
          text="DonoBrace size used in the model"
          value={form.braceModel}
          options={[['DB15', 'DB15'], ['DB20', 'DB20'], ['DB25', 'DB25']]}
          onChange={onChange}
        />
        {numberField('angle')}
        {numberField('Te')}
      </Group>

      <Group
        title="One lateral earthquake load case"
        intro="All three from the same load case. Any linear case works; the elastic ULS case at T,e is simplest."
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
        {numberField('N')}
        {numberField('wind')}
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
          {numberField('Sp')}
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
  const loop = (d) => [[0, 0], [D_SLIP, d.Fslip], [D_STOP, d.Fult], [d.dRest, d.Frest], [d.dres, d.Fres], [0, 0]]
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('') + 'Z'
  const yTicks = []
  for (let y = 0; y <= ymax + 1e-9; y += ys) yTicks.push(y)

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${s.size} force against QD deformation: nominal loop with lower and upper bound loops, and the ULS and CALS performance points`}
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
        <text x={X(D_STOP) - 5} y={T + 30} textAnchor="end" {...TICK} fill="#475569">δ,stop 50</text>

        <path d={path(loop(s.dev))} fill={BRAND} fillOpacity="0.08" stroke="none" />
        <path d={path(loop(s.dL))} fill="none" stroke="#64748b" strokeWidth="1.4" strokeDasharray="7 3" />
        <path d={path(loop(s.dU))} fill="none" stroke="#64748b" strokeWidth="1.4" strokeDasharray="2 3" />
        <path d={path(loop(s.dev))} fill="none" stroke={BRAND} strokeWidth="2.6" strokeLinejoin="round" />

        {u && !u.elastic && <circle cx={X(u.dqd)} cy={Y(u.F)} r="6" fill={BRAND} stroke="#fff" strokeWidth="2" />}
        {c && !c.elastic && <circle cx={X(c.dqd)} cy={Y(c.F)} r="6" fill="#fff" stroke={EQ} strokeWidth="2.4" />}
      </svg>
      <Legend
        items={[
          { label: 'Nominal', color: BRAND },
          { label: 'LBH', color: '#64748b', dash: '7 3' },
          { label: 'UBH', color: '#64748b', dash: '2 3' },
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
  const C = (t) => ch(t, input.soil) * input.Z * input.R * input.N
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
  const ulsDamped = u && !u.elastic
  const calsDamped = c && !c.elastic

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mt-6">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Acceleration-displacement response spectrum with the estimated capacity curve for ${label(s.size)} and the ULS and CALS performance points`}
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
          <path d={path(spec(1, 0.05))} fill="none" stroke="#94a3b8" strokeWidth="1.4" />
          {ulsDamped && <path d={path(spec(1, u.xi))} fill="none" stroke="#334155" strokeWidth="1.8" strokeDasharray="6 3" />}
          {calsDamped && <path d={path(spec(input.lamC, c.xi))} fill="none" stroke={EQ} strokeWidth="1.8" strokeDasharray="9 3 2 3" />}
          {limLine(s.Dlim, `Δ,lim ${f(s.Dlim, 0)}`, 0)}
          {limLine(s.Dstop, `Δ,stop ${f(s.Dstop, 0)}`, 16)}
          <path d={path(cap)} fill="none" stroke={BRAND} strokeWidth="2.6" strokeLinejoin="round" />
          {u && <circle cx={X(u.D)} cy={Y(u.Sa)} r="6" fill={BRAND} stroke="#fff" strokeWidth="2" />}
          {c && <circle cx={X(c.D)} cy={Y(c.Sa)} r="6" fill="#fff" stroke={EQ} strokeWidth="2.4" />}
        </g>
      </svg>
      <Legend
        items={[
          { label: `Capacity, ${label(s.size)} (estimated)`, color: BRAND },
          { label: 'ULS spectrum, 5%, × S,p,DDBD', color: '#94a3b8' },
          ...(ulsDamped ? [{ label: `ULS damped, ξ = ${pct(u.xi)}`, color: '#334155', dash: '6 3' }] : []),
          ...(calsDamped ? [{ label: `CALS damped, ξ = ${pct(c.xi)}`, color: EQ, dash: '9 3 2 3' }] : []),
          { label: 'ULS point', color: BRAND, dot: true },
          { label: 'CALS point', color: EQ, dot: true, open: true },
        ]}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Calc sheet (plain text, ported from the reference prototype)
// ─────────────────────────────────────────────────────────────────────────────

function calcSheet(r) {
  const { selected: R, input: inp, basis: B, donoBrace: db } = r
  const u = R.uls
  const c = R.cals
  const L = []
  L.push('QUAKE DEFENDER SIZING CALCULATOR - STEP 4 SIZING ONLY')
  L.push('seismicshift.nz/quake-defender/sizing-calculator/')
  L.push('Methodology draft V26.10; proposed 50 mm product table; NZS 1170.5:2004')
  L.push('Re-run your model with the selected size and complete the full design in your own calculations.')
  L.push('')
  L.push('INITIAL MODEL (DonoBrace only)')
  L.push(`Brace ${inp.braceModel}; angle to direction of loading ${f(inp.angle, 1)} deg; elastic period T,e = ${f(inp.Te, 3)} s`)
  L.push(`Load case: critical brace force ${f(inp.Fe)} kN; elongation ${f(inp.ee, 2)} mm; roof displacement ${f(inp.De, 2)} mm`)
  L.push(`Storey shear taken by other elements ${pct(inp.pShare, 0)}; h = ${f(inp.h, 2)} m`)
  L.push(`Hazard Z = ${inp.Z}; soil ${inp.soil === 'AB' ? 'A/B' : inp.soil}; R,u = ${inp.R}; N = ${inp.N}; wind brace force ${f(inp.wind)} kN; S,p = ${inp.Sp}; R,s = ${inp.Rs}; lambda = ${inp.lamC}; k,dm = ${inp.kdm}`)
  L.push(`Model check: load case S,a = ${f(B.SaM, 3)} g vs C(T,e) = ${f(B.Ce, 3)} g (ratio ${f(B.loadRatio, 2)}); brace share of roof displacement ${pct(B.phi, 0)}`)
  L.push('')
  L.push('SIZE COMPARISON (locking, ULS, CALS as demand / limit; mu actual)')
  for (const s of QD_SIZES) {
    const x = r.all[s]
    L.push(`${label(s)}${s === r.modelSize ? ' (model)' : ' (estimated)'}: T,e ${f(x.Te, 3)} s; locking ${f(Math.max(x.lockSLS.ratio, x.lockWind.ratio), 2)}; ULS ${f(x.op.uls.ratio, 2)}; CALS ${f(x.op.cals.ratio, 2)}; mu ${x.uls ? f(x.uls.mu, 2) : '> ' + f(x.muStop, 2)}; ${x.pass ? 'PASS' : 'FAIL'}`)
  }
  L.push('')
  L.push(`SELECTED: ${label(R.size)}`)
  const oc = (n, op, cmp) => `${n}: Delta = ${f(op.D)} mm, T = ${f(op.T, 3)} s, xi = ${pct(op.xi)}, S,d = ${f(op.Sd)} mm ${cmp} ${f(op.D)} mm -> ${op.pass ? 'PASS' : 'FAIL'}`
  L.push(`Locking: SLS ${f(R.lockSLS.F)} kN, wind 1.3 x ${f(R.windF)} kN vs F,slip,LBH ${f(R.dL.Fslip)} kN`)
  L.push(`Delta,y = ${f(R.Dy)} mm; Delta,stop = ${f(R.Dstop)} mm; Delta,lim = ${f(R.Dlim)} mm (${R.limGov.label})`)
  L.push(oc('ULS at Delta,lim', R.op.uls, '<='))
  L.push(oc('ULS device 33 mm', R.op.dev33, '<='))
  L.push(oc('CALS at stop', R.op.cals, '<='))
  L.push(oc('Ductility (mu > 1.25) at 1.25 Delta,y', R.op.duct, '>='))
  if (u) L.push(`ULS point: Delta ${f(u.D)} mm; delta ${f(u.dqd)} mm; brace ${f(u.F)} kN; V/W ${f(u.Sa, 3)}; mu ${f(u.mu, 2)}; drift x k,dm ${pct(u.driftKdm / 100, 2)}`)
  if (c) L.push(`CALS point: Delta ${f(c.D)} mm; delta ${f(c.dqd)} mm; brace ${f(c.F)} kN`)
  L.push(`F,max = ${f(R.cap.Fmax)} kN (optional DonoBrace overstrength ${f(R.cap.os)} kN)`)
  L.push('')
  L.push(`DONOBRACE ALONE: ${db.brace}; brace force ${f(db.Nstar)} kN; V/W ${f(db.V, 3)}; connection ${f(db.Nconn)} kN; drift x k,dm ${pct(db.driftKdm / 100, 2)}`)
  if (r.messages.length) {
    L.push('')
    L.push('MESSAGES')
    for (const m of r.messages) L.push('- ' + m.text)
  }
  return L.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

const MESSAGE_CLASS = {
  bad: 'bg-red-50 border-red-200 text-red-700',
  warn: 'bg-[#fdf6ec] border-[#c07c1c]/40 text-[#7a4a10]',
  info: 'bg-[#eef1f3] border-slate-200 text-slate-700',
}

function Summary({ r }) {
  const s = r.selected
  const u = s.uls
  const c = s.cals
  const db = r.donoBrace
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
  const pass = auto ? !!r.recommended : s.pass

  const stats = [
    { k: 'QD travel at ULS', v: u ? f(u.dqd) : '-', unit: 'of 33 mm' },
    { k: 'QD travel at CALS', v: c ? f(c.dqd) : 'past stop', unit: c ? 'of 50 mm' : '' },
    { k: 'Ductility μ at ULS', v: u ? f(u.mu, 2) : '-', unit: '' },
    { k: 'Brace force at ULS', v: u ? f(u.F) : '-', unit: 'kN' },
    { k: 'DonoBrace alone', v: db.brace, unit: `${f(db.Nstar)} kN` },
  ]

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 md:p-6">
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

      <Table
        className="mt-5"
        head={['Size', 'T,e s', 'Locking', 'ULS', 'CALS', 'μ at ULS', 'δ ULS mm', 'δ CALS mm', 'Result']}
      >
        {QD_SIZES.map((size) => {
          const x = r.all[size]
          const selected = size === s.size
          return (
            <tr key={size} className={selected ? 'bg-[#eef1f3]' : undefined}>
              <Td className="whitespace-nowrap">
                <span className={selected ? 'font-black text-slate-900' : 'font-semibold'}>{label(size)}</span>
                {size === r.modelSize ? (
                  <span className="ml-2 text-[0.68rem] font-black uppercase tracking-wider" style={{ color: BRAND }}>your model</span>
                ) : (
                  <span className="ml-2 text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">estimated</span>
                )}
              </Td>
              <Num>{f(x.Te, 3)}</Num>
              <Num>{f(Math.max(x.lockSLS.ratio, x.lockWind.ratio), 2)}</Num>
              <Num>{f(x.op.uls.ratio, 2)}</Num>
              <Num>{f(x.op.cals.ratio, 2)}</Num>
              <Num>{x.uls ? f(x.uls.mu, 2) : `> ${f(x.muStop, 2)}`}</Num>
              <Num>{x.uls ? f(x.uls.dqd) : '-'}</Num>
              <Num>{x.cals ? f(x.cals.dqd) : 'past stop'}</Num>
              <Td className="text-right"><Chip ok={x.pass} /></Td>
            </tr>
          )
        })}
      </Table>
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
        <tr><Td>Load case base shear coefficient, from T,e and the roof displacement</Td><Num>{f(B.SaM, 3)} g</Num></tr>
        <tr><Td>Elastic ULS spectrum at T,e from the hazard entered, C(T,e)</Td><Num>{f(B.Ce, 3)} g</Num></tr>
        <tr><Td>Load case ÷ elastic ULS spectrum</Td><Num>{f(B.loadRatio, 2)}</Num></tr>
        <tr><Td>Share of roof displacement from brace elongation, (elongation ÷ cos θ) ÷ roof displacement</Td><Num>{pct(B.phi, 0)}</Num></tr>
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
        The dots show where the ULS and CALS performance points sit on the loop. ULS travel is limited to 33 mm; at CALS the QD may travel to its hard stop at 50 mm.
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
    <section>
      <StepHead eyebrow="Steps 3 and 4" title={`Locking and one-point checks for ${label(s.size)}`} />
      <Table head={[`Locking (LBH F,slip = ${f(s.dL.Fslip)} kN)`, 'Brace force kN', 'Ratio', '']}>
        <tr>
          <Td>SLS earthquake, Fb,SLS</Td>
          <Num>{f(s.lockSLS.F)}</Num>
          <Num>{f(s.lockSLS.ratio, 2)}</Num>
          <Td className="text-right"><Chip ok={s.lockSLS.ratio <= 1} /></Td>
        </tr>
        <tr>
          <Td>ULS wind, 1.3 Fb,wind</Td>
          <Num>{f(s.lockWind.F)}</Num>
          <Num>{f(s.lockWind.ratio, 2)}</Num>
          <Td className="text-right"><Chip ok={s.lockWind.ratio <= 1} /></Td>
        </tr>
      </Table>
      <p className="text-base text-slate-500 leading-relaxed my-4">
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
  )
}

function ComparisonSection({ s, db }) {
  const u = s.uls
  const c = s.cals
  return (
    <section>
      <StepHead eyebrow="Comparison" title="The same line with DonoBrace alone" />
      <p className="text-base text-slate-500 leading-relaxed mb-4">
        DonoBrace method: Category 4, S,p = 0.9, elastic, period from the full bar area, displacements from the SRF stiffness.{db.ok ? '' : ' Even DB25 is overstressed.'}
      </p>
      <Table head={['', label(s.size), `${db.brace} alone`]}>
        <tr><Td>ULS brace force</Td><Num>{u ? `${f(u.F)} kN` : '-'}</Num><Num>{f(db.Nstar)} kN</Num></tr>
        <tr><Td>ULS base shear coefficient V/W</Td><Num>{u ? f(u.Sa, 3) : '-'}</Num><Num>{f(db.V, 3)}</Num></tr>
        <tr><Td>Connection force, method basis</Td><Num>{f(s.cap.Fmax)} kN (F,max)</Num><Num>{f(db.Nconn)} kN (S,p = 1.0)</Num></tr>
        <tr><Td>Connection force, overstrength basis</Td><Num>{f(s.cap.os)} kN</Num><Num>{f(db.os)} kN</Num></tr>
        <tr><Td>ULS drift with k,dm</Td><Num>{u ? pct(u.driftKdm / 100, 2) : '-'}</Num><Num>{pct(db.driftKdm / 100, 2)}</Num></tr>
        <tr>
          <Td>CALS</Td>
          <Num>{c ? `${f(c.D)} mm, δ ${f(c.dqd)} of 50` : 'past stop'}</Num>
          <Num>{f(db.Dcals)} mm, {pct(db.calsYield, 0)} of yield</Num>
        </tr>
      </Table>
    </section>
  )
}

const EQUATIONS = `K/W = (2π/T,e)² / g            load case S,a = K/W × Δ,e
F(δ) from the QD loop           brace flexibility f = elongation ÷ force, scaled by (SRF·A) for other bars
Δ(δ) = F (f/cos θ + other) + δ/cos θ,  other = (Δ,e − e/cos θ) ÷ F,e
V/W = F ÷ F-per-g of the braced line + (other elements' stiffness) × Δ
T = 2π √(Δ / (g V/W))      ξ = 0.05 + A(δ) / (π F cos θ Δ) × braced-line share of V
S,d = λ × S,p,DDBD × η(ξ) × C(T) × g (T/2π)²`

function Working({ s, input }) {
  const u = s.uls
  const c = s.cals
  const bb = (name, st) => (
    <tr key={name}>
      <Td>{name}</Td>
      <Num>{f(st.dqd)}</Num>
      <Num>{f(st.F)}</Num>
      <Num>{f(st.D)}</Num>
      <Num>{f(st.Sa, 3)}</Num>
    </tr>
  )
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
    <details className="pt-8 border-t border-slate-100 group">
      <summary className={`inline-flex items-center gap-2 cursor-pointer select-none text-sm font-black tracking-wide uppercase text-[#17638f] hover:text-[#0f4c6e] transition motion-reduce:transition-none list-none [&::-webkit-details-marker]:hidden rounded ${BUTTON_FOCUS}`}>
        <span>Show working</span>
        <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="mt-4 pl-4 md:pl-5 border-l-2 border-slate-200 space-y-5">
        <p className="text-base text-slate-500 leading-relaxed">
          Estimated backbone and performance points for {label(s.size)}. The capacity curve is built from your model: its elastic part scales with brace force, QD travel adds δ ÷ cos θ, and the base shear coefficient follows the brace force.
        </p>
        <Table head={['Backbone point', 'δ mm', 'F kN', 'Δ mm', 'V/W']}>
          {bb('Activation, Δ,y', s.pts.y)}
          {bb('1.25 Δ,y', s.pts.y125)}
          {bb('Governing ULS limit, Δ,lim', s.pts.lim)}
          {bb('Device limit, δ = 33 mm', s.pts.d33)}
          {bb('Hard stop, Δ,stop', s.pts.stop)}
        </Table>
        <Table head={['Performance point', 'Δ mm', 'δ mm', 'Brace kN', 'V/W', 'T,eff s', 'ξ,eff']}>
          {pp(u, 'ULS')}
          {pp(c, `CALS (λ = ${f(input.lamC, 2)})`)}
        </Table>
        {u && (
          <p className="text-sm text-slate-500 leading-relaxed">
            ULS drift × k,dm = {pct(u.driftKdm / 100, 2)}; stability coefficient θ = {f(u.theta, 3)}; {s.brace} utilisation {f(u.util, 2)}.
          </p>
        )}
        <AdrsChart s={s} input={input} />
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
  const [copyStatus, setCopyStatus] = useState('')
  const [fallbackText, setFallbackText] = useState(null)

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

  function loadExample() {
    recalc(exampleForm())
    setFallbackText(null)
    setCopyStatus('Worked example loaded.')
    track('qd_sizing_load_example')
  }

  function copySheet() {
    const text = calcSheet(result)
    track('qd_sizing_copy_calc_sheet')
    const showFallback = () => {
      setFallbackText(text)
      setCopyStatus('Select all and copy the text below.')
    }
    try {
      navigator.clipboard.writeText(text).then(() => {
        setFallbackText(null)
        setCopyStatus('Calc sheet copied.')
      }, showFallback)
    } catch {
      showFallback()
    }
  }

  const stale = Object.keys(errors).length > 0 || evalFailed
  const s = result.selected

  return (
    <div className="rounded-3xl border border-slate-100 shadow-sm bg-white overflow-hidden p-6 md:p-9">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <form onSubmit={(e) => e.preventDefault()} noValidate aria-label="Inputs">
          <Inputs form={form} errors={errors} onChange={onChange} onSize={onSize} />

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              type="button"
              onClick={copySheet}
              className={`font-bold text-sm px-5 py-2.5 rounded-full text-white bg-[#17638f] hover:bg-[#0f4c6e] transition motion-reduce:transition-none ${BUTTON_FOCUS}`}
            >
              Copy calc sheet
            </button>
            <button
              type="button"
              onClick={loadExample}
              className={`font-bold text-sm px-5 py-2.5 rounded-full border-2 border-slate-300 text-slate-600 bg-white hover:border-slate-400 transition motion-reduce:transition-none ${BUTTON_FOCUS}`}
            >
              Load worked example
            </button>
          </div>
          <p role="status" className="text-sm font-bold mt-3 min-h-[1.25rem]" style={{ color: BRAND }}>{copyStatus}</p>
          {fallbackText !== null && (
            <textarea
              readOnly
              value={fallbackText}
              aria-label="Calc sheet text"
              onFocus={(e) => e.target.select()}
              className={`${FIELD_CLASS} h-48 text-xs font-mono mt-2`}
            />
          )}
          <p className="text-xs text-slate-400 leading-relaxed mt-3">
            Opens with the methodology worked example: a DB20 model of one 7.5 × 6.0 m bay, Z = 0.3, soil D.
          </p>
        </form>

        <div className="min-w-0 space-y-10" aria-live="polite">
          <div className="space-y-4">
            <div className="border border-[#c07c1c]/40 bg-[#fdf6ec] rounded-2xl p-5 text-sm text-slate-700 leading-relaxed">
              <strong style={{ color: EQ }}>For sizing only.</strong> These checks select a QD and DonoBrace size from your initial model. Re-run your model with the selected size and complete the full design (Steps 5 to 9 of the methodology) in your own calculations.
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
          <ComparisonSection s={s} db={result.donoBrace} />
          <Working s={s} input={result.input} />
        </div>
      </div>
    </div>
  )
}
