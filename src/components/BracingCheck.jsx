import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  computeDesignerResult,
  getHomeownerResult,
} from '../lib/bracingChecker'
import { LOCATION_HAZARDS, LOCATION_HAZARDS_BY_NAME, SITE_CLASS_LABELS, DEFAULT_SITE_CLASS } from '../lib/locationHazard'
import { getTownChartStats } from '../lib/townDemand'

const BRAND = '#17638f'
const EQ = '#c07c1c'
const INK = '#0f172a'
const MARGIN = '#16a34a'

// Town-comparison chart only: a self-contained blue gradient (dark to
// light), deliberately distinct from the black/blue/green key used in the
// designer plots above it, so the two legends can't be read as the same
// scheme - while staying in the brand's own blue family rather than
// introducing an unrelated colour.
const TOWN_BASE = '#0b3550'
const TOWN_EXCESS = '#1c7fae'
const TOWN_MARGIN = '#8ecae6'

// Highlight colours for whichever town is currently selected in the
// calculator above the chart - the brand's amber (EQ) family, so the
// highlighted bar reads as "picked out" rather than as a fifth colour
// competing with the blue town-comparison scale.
const SELECTED_BASE = '#7a4a10'
const SELECTED_EXCESS = '#c07c1c'
const SELECTED_MARGIN = '#f2c879'

// The searchable location list: every town locationHazard.ts knows about.
const ALL_LOCATIONS = LOCATION_HAZARDS.map((l) => ({
  key: l.name,
  name: l.name,
}))

const DEFAULT_LOCATION = 'Christchurch'

const FIELD_CLASS =
  'w-full text-[0.98rem] font-medium text-slate-900 px-3.5 py-2.5 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#17638f] focus:ring-2 focus:ring-[#17638f]/20 transition motion-reduce:transition-none'

function LocationField({ label, valueKey, onSelect }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  const selected = ALL_LOCATIONS.find((l) => l.key === valueKey)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return ALL_LOCATIONS
    return ALL_LOCATIONS.filter((l) => l.name.toLowerCase().includes(q))
  }, [query])

  const visible = filtered.slice(0, 8)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectLocation(loc) {
    onSelect(loc.key)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleKeyDown(e) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((i) => Math.min(i + 1, visible.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (visible[highlightIndex]) selectLocation(visible[highlightIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <label className="block">
        <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</span>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-label={label}
            value={isOpen ? query : (selected ? selected.name : '')}
            placeholder="Start typing a location"
            onFocus={() => { setIsOpen(true); setQuery(''); setHighlightIndex(0) }}
            onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setHighlightIndex(0) }}
            onKeyDown={handleKeyDown}
            className={`${FIELD_CLASS} pr-9`}
          />
          <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" viewBox="0 0 20 20" fill="none">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </label>

      {isOpen && (
        <ul role="listbox" className="absolute z-20 mt-1.5 w-full max-h-64 overflow-auto rounded-xl border-2 border-slate-200 bg-white shadow-lg py-1">
          {visible.length === 0 && (
            <li className="px-3.5 py-2 text-sm text-slate-400">No locations match &quot;{query}&quot;</li>
          )}
          {visible.map((loc, i) => (
            <li
              key={loc.key}
              role="option"
              aria-selected={loc.key === valueKey}
              onMouseDown={(e) => { e.preventDefault(); selectLocation(loc) }}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`px-3.5 py-2 text-sm cursor-pointer flex items-center justify-between gap-3 ${
                i === highlightIndex ? 'bg-[#eef1f3] text-[#17638f]' : 'text-slate-700'
              }`}
            >
              <span className="font-medium">{loc.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SiteClassField({ value, onChange, label = 'Site subsoil class' }) {
  return (
    <div>
      <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">{label}</span>
      <div className="inline-flex flex-wrap gap-2">
        {Object.entries(SITE_CLASS_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={`font-bold text-xs tracking-wide px-4 py-2 rounded-full border-2 transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#17638f]/30 ${
              value === key
                ? 'border-[#17638f] bg-[#eef1f3] text-[#17638f]'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-1.5">Defaults to site class C.</p>
    </div>
  )
}

function niceMax(v) {
  const step = v <= 120 ? 20 : v <= 300 ? 50 : 100
  return Math.ceil(v / step) * step
}

function Gauge({ eq, wind, hazardOnlyTarget, totalTarget, codeMin }) {
  const L = 44
  const R = 328
  const T = 26
  const B = 244
  const scaleMax = niceMax(Math.max(eq, wind, totalTarget, 1) * 1.15)
  const y = (val) => B - (val / scaleMax) * (B - T)
  const cols = [
    { x: 70, v: eq, c: EQ, label: 'EQ' },
    { x: 158, v: wind, c: BRAND, label: 'Wind' },
  ]
  const bw = 52
  const ticks = 4
  const cmY = y(codeMin)
  const targetX = 246

  // Black always runs up to the baseline target (hazard shift only, already
  // floored at code minimum by the caller); green covers whatever's left on
  // top of that to reach the low damage target - present whenever that's
  // more than the baseline alone.
  const hasExcess = totalTarget > hazardOnlyTarget + 0.01
  const totalY = y(totalTarget)
  const baseY = y(hazardOnlyTarget)
  const baseH = Math.max(0, B - baseY)
  const marginH = Math.max(0, baseY - totalY)
  const totalH = Math.max(0, B - totalY)

  return (
    <svg viewBox="0 0 340 280" role="img" aria-label="Bracing unit comparison" className="w-full h-auto block">
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const tv = (scaleMax / ticks) * i
        const ty = y(tv)
        return (
          <g key={i}>
            <line x1={L} y1={ty} x2={R} y2={ty} stroke="#e2e8f0" strokeWidth="1" />
            <text x={L - 8} y={ty + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#94a3b8" fontFamily="DM Sans">
              {Math.round(tv)}
            </text>
          </g>
        )
      })}

      <line x1={L} y1={cmY} x2={R} y2={cmY} stroke="#334155" strokeWidth="1.5" strokeDasharray="5 4" />

      {cols.map((col) => {
        const by = y(col.v)
        const h = Math.max(0, B - by)
        return (
          <g key={col.label}>
            <rect x={col.x - bw / 2} y={by} width={bw} height={h} rx="6" fill={col.c} />
            <text x={col.x} y={by - 8} textAnchor="middle" fontSize="14" fontWeight="900" fill={col.c} fontFamily="DM Sans">
              {Math.round(col.v)}
            </text>
            <text x={col.x} y={B + 18} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#64748b" fontFamily="DM Sans">
              {col.label}
            </text>
          </g>
        )
      })}

      <g>
        {hasExcess ? (
          <>
            <rect x={targetX - bw / 2} y={baseY} width={bw} height={baseH} rx="6" fill={INK} />
            <rect x={targetX - bw / 2} y={totalY} width={bw} height={marginH} rx="6" fill={MARGIN} />
            <text x={targetX} y={totalY - 8} textAnchor="middle" fontSize="14" fontWeight="900" fill={MARGIN} fontFamily="DM Sans">
              {Math.round(totalTarget)}
            </text>
            {marginH > 14 && (
              <text x={targetX} y={baseY - 6} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#fff" fontFamily="DM Sans">
                {Math.round(hazardOnlyTarget)}
              </text>
            )}
          </>
        ) : (
          <>
            <rect x={targetX - bw / 2} y={totalY} width={bw} height={totalH} rx="6" fill={INK} />
            <text x={targetX} y={totalY - 8} textAnchor="middle" fontSize="14" fontWeight="900" fill={INK} fontFamily="DM Sans">
              {Math.round(totalTarget)}
            </text>
          </>
        )}
        <text x={targetX} y={B + 18} textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#64748b" fontFamily="DM Sans">
          Target
        </text>
      </g>

      <line x1={L} y1={B} x2={R} y2={B} stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  )
}

function BuField({ label, value, onChange, ariaLabel }) {
  return (
    <label className="block">
      <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
        {label} <span className="font-medium normal-case tracking-normal text-slate-400">BUs</span>
      </span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        placeholder="0"
        onChange={(e) => {
          const raw = e.target.value
          onChange(raw !== '' && Number(raw) < 0 ? '0' : raw)
        }}
        aria-label={ariaLabel}
        className={FIELD_CLASS}
      />
    </label>
  )
}

function DirectionPlot({ eq, wind, result, ready = true }) {
  const hasExcess = ready && result.recommendedTarget > result.recommendedHazardOnlyTarget + 0.01

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 pb-2 min-h-[220px] flex flex-col">
      {ready ? (
        <>
          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Bracing units, whole house</p>
          <Gauge
            eq={eq}
            wind={wind}
            hazardOnlyTarget={result.recommendedHazardOnlyTarget}
            totalTarget={result.recommendedTarget}
            codeMin={result.codeMinimum}
          />
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 pt-1 pb-0.5">
            <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: EQ }} />Earthquake (3604)</span>
            <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: BRAND }} />Wind (3604)</span>
            <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: INK }} />Baseline target</span>
            {hasExcess && (
              <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: MARGIN }} />Low damage target</span>
            )}
            <span className="inline-flex items-center">
              <svg width="14" height="10" className="mr-1.5 shrink-0" aria-hidden="true">
                <line x1="0" y1="5" x2="14" y2="5" stroke="#334155" strokeWidth="2" strokeDasharray="3 2" />
              </svg>
              Code minimum
            </span>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center py-10 px-4">
          <p className="text-sm font-bold text-slate-400 max-w-[240px]">Please enter all bracing unit figures above to see this plot.</p>
        </div>
      )}
    </div>
  )
}

function DirectionNumber({ title, result, ready = true }) {
  const numberColor = result.indicativeUpliftPct <= 101 ? '#475569' : BRAND

  return (
    <div>
      <p className="text-sm font-black uppercase tracking-widest text-slate-500">{title}</p>
      {ready ? (
        <>
          <div className="flex items-baseline gap-1.5 mt-2 tabular-nums">
            <span className="font-black text-lg text-slate-500">{result.hazardOnlyUpliftPct}%</span>
            <span className="text-xs font-bold text-slate-400">baseline target</span>
          </div>
          <div
            className="font-black tracking-tight leading-none text-4xl md:text-5xl mt-1 mb-2 tabular-nums"
            style={{ color: numberColor }}
          >
            {result.indicativeUpliftPct}
            <small className="text-base font-black text-slate-400 tracking-normal ml-1.5">% low damage target</small>
          </div>
        </>
      ) : (
        <p className="text-sm font-bold text-slate-400 mt-3 mb-2 max-w-[220px]">Please enter all bracing unit figures above.</p>
      )}
    </div>
  )
}

const FRONTFOOT_LINK = (
  <a
    href="/frontfoot/"
    className="font-bold text-slate-900 underline decoration-2 decoration-[#17638f]/40 underline-offset-2 hover:decoration-[#17638f] transition"
  >
    reduce the demand at the base
  </a>
)

function GapOptions() {
  return (
    <ul className="mt-3 space-y-1.5 text-base text-slate-700 leading-relaxed list-disc pl-5">
      <li>Add bracing capacity: more bracing walls, converting non-bracing walls into bracing walls, upgrading to a higher-capacity bracing type, or any combination of these.</li>
      <li>Or {FRONTFOOT_LINK}, so standard bracing achieves it.</li>
    </ul>
  )
}

function CombinedPathway({ alongResult, acrossResult }) {
  const alongNeedsMore = alongResult.pathway !== 'either'
  const acrossNeedsMore = acrossResult.pathway !== 'either'

  if (!alongNeedsMore && !acrossNeedsMore) {
    return (
      <p className="text-base text-slate-700 leading-relaxed">
        Wind bracing units already cover the increased earthquake bracing in both directions here. <strong className="text-slate-900">A code-minimum design should be sufficient</strong> for damage control on this site.
      </p>
    )
  }

  if (alongNeedsMore && acrossNeedsMore) {
    return (
      <div>
        <p className="text-base text-slate-700 leading-relaxed">
          Both directions need more than the code minimum to limit damage here. There are two ways to close the gap:
        </p>
        <GapOptions />
      </div>
    )
  }

  const shortDirection = alongNeedsMore ? 'along' : 'across'
  const coveredDirection = alongNeedsMore ? 'across' : 'along'

  return (
    <div>
      <p className="text-base text-slate-700 leading-relaxed">
        Wind bracing units already cover the {coveredDirection} direction, but the {shortDirection} direction needs more than the code minimum to limit damage. There are two ways to close the gap:
      </p>
      <GapOptions />
    </div>
  )
}

function DesignerTechnicalBasis() {
  return (
    <details className="mt-8 pt-8 border-t border-slate-100 group">
      <summary className="inline-flex items-center gap-2 cursor-pointer select-none text-sm font-black tracking-wide uppercase text-[#17638f] hover:text-[#0f4c6e] transition motion-reduce:transition-none list-none [&::-webkit-details-marker]:hidden">
        <span>Want the technical basis?</span>
        <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="mt-4 pl-4 md:pl-5 border-l-2 border-slate-200">
        <p className="text-base text-slate-500 leading-relaxed">
          The extra bracing shown here draws on two separate sources: BRANZ Study Report SR337 (2015), which found that NZS 3604 homes may need around 50% more seismic bracing to limit damage in a design-level earthquake rather than only meet the life-safety standard, and the 2022 National Seismic Hazard Model, which has since raised our understanding of earthquake hazard across much of New Zealand (as documented in TS 1170.5:2025).
        </p>

        <div className="mt-6 bg-slate-50 border border-slate-100 rounded-2xl p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Worked example: Wellington, site class C</p>
          <ol className="space-y-3 text-sm text-slate-600 leading-relaxed list-decimal pl-5">
            <li>
              NZS 3604:2011 groups every site into one of four earthquake zones, based on the NZS 1170.5 Z factor at that site: zone 1 is based on a Z factor of 0.2, zone 2 on a Z factor of 0.3, zone 3 on a Z factor of 0.46, and zone 4 on a Z factor of 0.6. These are combined with site subsoil class categories to give the following table of demand values - the background of these can be found in the BRANZ Basis of NZS 3604 document:
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-[#17638f] text-white">
                      <th className="px-4 py-2 font-black text-xs uppercase tracking-wide" rowSpan={2}>Soil class</th>
                      <th className="px-4 py-2 font-black text-xs uppercase tracking-wide text-center" colSpan={3}>EQ zone</th>
                    </tr>
                    <tr className="bg-[#17638f] text-white">
                      <th className="px-4 py-1.5 text-center font-bold text-xs">1 <span className="font-normal opacity-80">(Z = 0.2)</span></th>
                      <th className="px-4 py-1.5 text-center font-bold text-xs">2 <span className="font-normal opacity-80">(Z = 0.3)</span></th>
                      <th className="px-4 py-1.5 text-center font-bold text-xs">3 <span className="font-normal opacity-80">(Z = 0.46)</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    <tr>
                      <td className="px-4 py-2 text-slate-700">A &amp; B <span className="text-slate-400">&mdash; Rock</span></td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.12</td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.2</td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.24</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-slate-700">C <span className="text-slate-400">&mdash; Shallow</span></td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.16</td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.24</td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.28</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-slate-700">D &amp; E <span className="text-slate-400">&mdash; Deep to very soft</span></td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.2</td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.32</td>
                      <td className="px-4 py-2 text-center text-slate-900 font-semibold tabular-nums">0.4</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </li>
            <li>Wellington&rsquo;s real NZS 1170.5 Z factor is 0.40, which falls in zone 3, so its NZS 3604 earthquake bracing demand is calculated at the zone&rsquo;s Z = 0.46 ceiling, not its actual Z = 0.40, which means that there is a degree of conservatism built into NZS 3604 for some sites. For the purposes of the comparison with TS 1170.5:2025, the actual values for each town/city were used in order to make use of any excess already allowed for in the NZS 3604 approach.</li>
            <li>For this example, say that zone-3 earthquake bracing demand comes out to <strong className="text-slate-900">2,400 BU</strong> (whole house, along direction) - an illustrative figure for this walkthrough. Say in this example, wind demand doesn&rsquo;t exceed this, so 2,400 BU is also the code minimum bracing for that direction of the building (earthquake governs).</li>
            <li>Calculating the TS 1170.5:2025 demand for Wellington using assumptions consistent with the basis of NZS 3604, results in a demand value of 0.37. Comparing this to 0.28 from the table above gives a raw hazard shift of <strong className="text-slate-900">&times;1.32</strong> (132%).</li>
            <li>
              Baseline target: 2,400 &times; 1.32 = <strong className="text-slate-900">3,168 BU</strong>. Against the 2,400 BU code minimum, that&rsquo;s
              <strong style={{ color: BRAND }}> 132% of code minimum</strong> - what this site needs to keep pace with the latest seismic hazard modelling alone, before SR337.
            </li>
            <li>Apply the SR337 low-damage margin: <strong className="text-slate-900">&times;1.5</strong>.</li>
            <li>
              Low damage target: 3,168 &times; 1.5 = <strong className="text-slate-900">4,752 BU</strong>. Against the same 2,400 BU code minimum, that&rsquo;s
              <strong style={{ color: BRAND }}> 198% of code minimum</strong>, meaning this site would need about 1.98 times as much bracing as a code-minimum design to work towards a low damage outcome.
            </li>
          </ol>
          <p className="text-sm text-slate-400 leading-relaxed mt-4 pt-4 border-t border-slate-200">
            Both percentages are floored at 100% of code minimum: if the hazard shift or low damage figures work out lower than what NZS 3604 already requires, the tool shows 100% rather than a number below it, since that&rsquo;s the current legal minimum regardless of what the hazard model or SR337 suggest.
          </p>
        </div>
      </div>
    </details>
  )
}

function DesignerMode({ locationKey, setLocationKey, siteClass, setSiteClass }) {
  const [alongEq, setAlongEq] = useState('')
  const [alongWind, setAlongWind] = useState('')
  const [acrossEq, setAcrossEq] = useState('')
  const [acrossWind, setAcrossWind] = useState('')

  const hazard = LOCATION_HAZARDS_BY_NAME[locationKey]
  const H = hazard.H[siteClass]
  const along = { eq: Number(alongEq) || 0, wind: Number(alongWind) || 0 }
  const across = { eq: Number(acrossEq) || 0, wind: Number(acrossWind) || 0 }
  const ready = alongEq !== '' && alongWind !== '' && acrossEq !== '' && acrossWind !== ''
    && (along.eq > 0 || along.wind > 0) && (across.eq > 0 || across.wind > 0)

  const alongResult = useMemo(
    () => computeDesignerResult({ eqBu: along.eq, windBu: along.wind, H }),
    [along.eq, along.wind, H]
  )
  const acrossResult = useMemo(
    () => computeDesignerResult({ eqBu: across.eq, windBu: across.wind, H }),
    [across.eq, across.wind, H]
  )

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 max-w-xl mb-6">
        <LocationField label="Where are you building?" valueKey={locationKey} onSelect={setLocationKey} />
        <SiteClassField value={siteClass} onChange={setSiteClass} />
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Enter the total earthquake and wind bracing units your NZS 3604:2011 calculation gives for each direction, summed across the whole house. For the purposes of this page, code minimum is taken as the larger of the wind and earthquake bracing units you enter below.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3.5">
        <p className="col-span-2 text-sm font-black uppercase tracking-widest text-slate-500">Along</p>
        <p className="col-span-2 text-sm font-black uppercase tracking-widest text-slate-500">Across</p>
        <BuField label="Earthquake" value={alongEq} onChange={setAlongEq} ariaLabel="Along earthquake bracing units, whole house total" />
        <BuField label="Wind" value={alongWind} onChange={setAlongWind} ariaLabel="Along wind bracing units, whole house total" />
        <BuField label="Earthquake" value={acrossEq} onChange={setAcrossEq} ariaLabel="Across earthquake bracing units, whole house total" />
        <BuField label="Wind" value={acrossWind} onChange={setAcrossWind} ariaLabel="Across wind bracing units, whole house total" />
      </div>

      <div className="mt-8 pt-8 border-t border-slate-100">
        <p className="text-sm text-slate-400 mb-6">
          The black bar is the baseline target, which considers the latest seismic hazard information released since NZS 3604 was published (see technical basis section for more information). In cases where the latest information suggests a higher level of hazard than accounted for in NZS 3604, the black bar is increased accordingly. In other cases, the NZS 3604 earthquake requirements remain sufficient to account for the latest hazard information, and so the black bar is set off the earthquake bracing unit figure set by the user. The green portion on top indicates the extra bracing that BRANZ SR337 recommends adding to work towards a low damage outcome, rather than only meeting the life-safety minimum targeted by NZS 3604.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Along</p>
            <DirectionPlot eq={along.eq} wind={along.wind} result={alongResult} ready={ready} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Across</p>
            <DirectionPlot eq={across.eq} wind={across.wind} result={acrossResult} ready={ready} />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-3">Indicative resilience multiplier</h3>
          <p className="text-sm text-slate-400 mb-6">
            A figure you could consider multiplying your existing NZS 3604 bracing units by. There are two percentages below for each direction of the home, both shown relative to your NZS 3604 governing bracing units (100% = code minimum). The first shows how much higher that figure becomes once scaled for the latest seismic hazard modelling. The second takes that further, adding the SR337 margin, to show what multiple might be required to achieve a low damage outcome.
          </p>
          <div className="grid gap-8 sm:grid-cols-2 mb-6">
            <DirectionNumber title="Along" result={alongResult} ready={ready} />
            <DirectionNumber title="Across" result={acrossResult} ready={ready} />
          </div>
          {ready && <CombinedPathway alongResult={alongResult} acrossResult={acrossResult} />}
        </div>
      </div>

      <DesignerTechnicalBasis />
    </div>
  )
}

function HomeownerMode({ locationKey, setLocationKey, siteClass, setSiteClass }) {
  const hazard = LOCATION_HAZARDS_BY_NAME[locationKey]

  const result = useMemo(
    () => getHomeownerResult({ H: hazard.H[siteClass] }),
    [hazard, siteClass]
  )
  const statementParts = result.hazardShiftStatement.split(/(roughly \d+%)/)

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 max-w-xl">
        <LocationField label="Where are you building?" valueKey={locationKey} onSelect={setLocationKey} />
        <SiteClassField value={siteClass} onChange={setSiteClass} label="Site subsoil class (if known)" />
      </div>

      <p className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 leading-tight mt-7">
        {statementParts.map((part, i) =>
          /^roughly \d+%$/.test(part) ? (
            <b key={i} style={{ color: BRAND }}>{part}</b>
          ) : (
            <React.Fragment key={i}>{part}</React.Fragment>
          )
        )}
      </p>

      <p className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 leading-tight mt-8">
        Meeting only that minimum can still leave a home <b style={{ color: BRAND }}>needing extensive repairs</b> - independent research suggests <b style={{ color: BRAND }}>around 50% more bracing</b> is needed to limit damage.
      </p>

      <details className="mt-5 group">
        <summary className="inline-flex items-center gap-2 cursor-pointer select-none text-sm font-black tracking-wide uppercase text-[#17638f] hover:text-[#0f4c6e] transition list-none [&::-webkit-details-marker]:hidden">
          <span>Want the technical basis?</span>
          <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <p className="mt-3 pl-4 md:pl-5 border-l-2 border-slate-200 text-base text-slate-500 leading-relaxed">
          This combines two independent sources: the 2022 National Seismic Hazard Model (as documented in TS 1170.5:2025), which is behind the hazard increase above, and BRANZ Study Report SR337 (2015), which found that homes built only to the NZS 3604 minimum may need around 50% more seismic bracing to limit damage in a design-level earthquake, rather than just meet the life-safety standard.
        </p>
      </details>

      <p className="text-base md:text-lg text-slate-600 leading-relaxed mt-5">{result.governanceFlavour}</p>

      <a
        href="/contact/"
        className="inline-flex items-center gap-2 text-white px-6 py-2.5 text-sm font-bold tracking-wide rounded-full shadow-md hover:opacity-90 transition motion-reduce:transition-none mt-7"
        style={{ backgroundColor: BRAND }}
      >
        Talk to our engineers <span aria-hidden="true">&rarr;</span>
      </a>

      <p className="text-sm text-slate-400 mt-4">
        This is a provisional, area-level indication. Once you have a concept design with bracing numbers, the designer view (or our engineers) can show the specific picture for your home.
      </p>
    </div>
  )
}

function FrontFootCta() {
  return (
    <a
      href="/frontfoot/"
      className="group block bg-gradient-to-b from-white to-[#eef1f3] border-t border-slate-100 px-6 md:px-9 py-8 md:py-10 hover:to-[#e4e9ec] transition-colors"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: BRAND }}>Reduce the demand instead</p>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-2">Adding bracing capacity is not the only option.</h2>
          <p className="text-slate-500 text-base md:text-lg max-w-xl">
            FrontFoot® takes the other pathway: it reduces the level of shaking that reaches your home's structure in the first place, rather than adding capacity to resist it.
          </p>
        </div>
        <span
          className="shrink-0 inline-flex items-center gap-2 text-white px-6 py-3 text-sm font-bold tracking-wide rounded-full shadow-md group-hover:opacity-90 transition md:ml-auto"
          style={{ backgroundColor: BRAND }}
        >
          Learn about FrontFoot
          <span aria-hidden="true">&rarr;</span>
        </span>
      </div>
    </a>
  )
}

function TownRankChart({ stats, maxVal, selectedLocation }) {
  const L = 4
  const R = 980
  const T = 16
  const B = 220
  const TOP_MARGIN = 34
  const y = (v) => B - (v / maxVal) * (B - T)
  const n = stats.length
  const gap = 1
  const barW = Math.max(1, (R - L) / n - gap)
  const selectedIndex = stats.findIndex((s) => s.name === selectedLocation)

  let marker = null
  if (selectedIndex >= 0) {
    const s = stats[selectedIndex]
    const x = L + selectedIndex * (barW + gap)
    const cx = x + barW / 2
    const topY = y(s.lowDamage)
    const anchor = cx < 60 ? 'start' : cx > R - 60 ? 'end' : 'middle'
    marker = (
      <g>
        <path d={`M ${cx - 4} ${topY - 12} L ${cx + 4} ${topY - 12} L ${cx} ${topY - 4} Z`} fill={SELECTED_EXCESS} />
        <text x={cx} y={topY - 16} textAnchor={anchor} fontSize="11" fontWeight="800" fill={SELECTED_BASE} fontFamily="DM Sans">
          {s.name}
        </text>
      </g>
    )
  }

  return (
    <svg
      viewBox={`0 -${TOP_MARGIN} ${R + L} ${B + 4 + TOP_MARGIN}`}
      role="img"
      aria-label="Towns and cities ranked by low damage target, largest to smallest, with the calculator's currently selected location highlighted"
      className="w-full h-auto block"
    >
      {stats.map((s, i) => {
        const isSelected = i === selectedIndex
        const x = L + i * (barW + gap)
        const baseY = y(s.base)
        const combinedY = y(s.combined)
        const lowY = y(s.lowDamage)
        const baseColor = isSelected ? SELECTED_BASE : TOWN_BASE
        const excessColor = isSelected ? SELECTED_EXCESS : TOWN_EXCESS
        const marginColor = isSelected ? SELECTED_MARGIN : TOWN_MARGIN
        return (
          <g key={s.name} className="cursor-pointer">
            <title>{s.name}</title>
            <rect x={x} y={baseY} width={barW} height={Math.max(0, B - baseY)} fill={baseColor} />
            {s.hazardExcess > 0.001 && (
              <rect x={x} y={combinedY} width={barW} height={Math.max(0, baseY - combinedY)} fill={excessColor} />
            )}
            <rect x={x} y={lowY} width={barW} height={Math.max(0, combinedY - lowY)} fill={marginColor} />
          </g>
        )
      })}
      {marker}
      <line x1={L} y1={B} x2={R} y2={B} stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  )
}

function TownComparisonChart({ selectedLocation, siteClass, setSiteClass }) {
  const statsByClass = useMemo(() => ({
    AB: getTownChartStats('AB'),
    C: getTownChartStats('C'),
    DE: getTownChartStats('DE'),
  }), [])
  // Same scale regardless of which site class is showing, so switching the
  // toggle moves bars rather than rescaling the whole chart.
  const maxVal = useMemo(() => Math.max(
    ...statsByClass.AB.map((s) => s.lowDamage),
    ...statsByClass.C.map((s) => s.lowDamage),
    ...statsByClass.DE.map((s) => s.lowDamage),
    0.01,
  ), [statsByClass])
  const stats = statsByClass[siteClass]

  return (
    <div className="rounded-3xl border border-slate-100 shadow-sm bg-white overflow-hidden p-6 md:p-9 mt-6">
      <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 mb-2">
        How does your town or city stack up against others?
      </h2>
      <p className="text-sm text-slate-400 mb-5">
        Here is a selection of towns and cities across New Zealand, and their relative seismic risk for a NZS 3604 structure - largest first. Dark blue is NZS 3604&rsquo;s own demand for that town&rsquo;s earthquake zone; mid blue, where present, is how much higher the latest hazard modelling (TS 1170.5:2025) pushes that for this specific town; light blue is the added SR337 margin on top, considering what might be required to reach a low damage outcome rather than just the life-safety minimum. Figures are unitless - useful only for comparing towns relative to each other, not as bracing units.
      </p>

      <SiteClassField value={siteClass} onChange={setSiteClass} />

      <p className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mt-5 mb-2">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M7 2.5a2 2 0 0 1 4 0v6.2l1.3-.9a1.8 1.8 0 0 1 2.6 2l-1.4 4.3a3 3 0 0 1-2.85 2.05H8.4a3 3 0 0 1-2.6-1.5L4 10.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Hover over any bar to see which town or city it is
      </p>

      <div>
        <TownRankChart stats={stats} maxVal={maxVal} selectedLocation={selectedLocation} />
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 pt-4">
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: TOWN_BASE }} />NZS 3604 demand</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: TOWN_EXCESS }} />TS 1170.5:2025 excess</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: TOWN_MARGIN }} />SR337 low damage margin</span>
        {selectedLocation && (
          <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: SELECTED_EXCESS }} />{selectedLocation} (selected above)</span>
        )}
      </div>

      <p className="text-center text-xs font-black uppercase tracking-widest text-slate-400 mt-5">Town / city</p>
    </div>
  )
}

export default function BracingCheck({ mode }) {
  // Designer and homeowner tabs each keep their own location/site-class
  // state, so the two tabs stay independent - but within a tab, the same
  // state feeds both the calculator's toggle and the comparison graph's
  // toggle below it, so those two stay linked.
  const [designerLocationKey, setDesignerLocationKey] = useState(DEFAULT_LOCATION)
  const [designerSiteClass, setDesignerSiteClass] = useState(DEFAULT_SITE_CLASS)
  const [homeownerLocationKey, setHomeownerLocationKey] = useState(DEFAULT_LOCATION)
  const [homeownerSiteClass, setHomeownerSiteClass] = useState(DEFAULT_SITE_CLASS)

  return (
    <>
      <a
        href="/bracing-check/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition motion-reduce:transition-none mb-6"
      >
        <span aria-hidden="true">&larr;</span> Choose a different path
      </a>

      <div className="rounded-3xl border border-slate-100 shadow-sm bg-white overflow-hidden">
        <div className="p-6 md:p-9">
          {mode === 'designer' ? (
            <DesignerMode
              locationKey={designerLocationKey}
              setLocationKey={setDesignerLocationKey}
              siteClass={designerSiteClass}
              setSiteClass={setDesignerSiteClass}
            />
          ) : (
            <HomeownerMode
              locationKey={homeownerLocationKey}
              setLocationKey={setHomeownerLocationKey}
              siteClass={homeownerSiteClass}
              setSiteClass={setHomeownerSiteClass}
            />
          )}
        </div>
        <FrontFootCta />
      </div>

      {mode === 'designer' ? (
        <TownComparisonChart
          selectedLocation={designerLocationKey}
          siteClass={designerSiteClass}
          setSiteClass={setDesignerSiteClass}
        />
      ) : (
        <TownComparisonChart
          selectedLocation={homeownerLocationKey}
          siteClass={homeownerSiteClass}
          setSiteClass={setHomeownerSiteClass}
        />
      )}
    </>
  )
}
