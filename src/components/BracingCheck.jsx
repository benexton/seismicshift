import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  computeDesignerResult,
  getHomeownerResult,
  COPY,
} from '../lib/bracingChecker'
import { BRACING_LOCATIONS, getBracingLocation, isCuratedLocation } from '../lib/bracingLocations'
import { LOCATION_HAZARDS, LOCATION_HAZARDS_BY_NAME, SITE_CLASS_LABELS, DEFAULT_SITE_CLASS } from '../lib/locationHazard'

const BRAND = '#17638f'
const BRAND_TINT = '#eef1f3'
const EQ = '#c07c1c'
const EQ_TINT = '#f6edd9'
const EQ_INK = '#8a5a12'
const ALERT = '#a23b23'
const ALERT_TINT = '#f6e2dc'
const INK = '#0f172a'

// The searchable location list: every town locationHazard.ts knows about.
const ALL_LOCATIONS = LOCATION_HAZARDS.map((l) => ({
  key: l.name,
  name: l.name,
}))

const DEFAULT_LOCATION = 'Christchurch'

const FIELD_CLASS =
  'w-full text-[0.98rem] font-medium text-slate-900 px-3.5 py-2.5 border-2 border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#17638f] focus:ring-2 focus:ring-[#17638f]/20 transition motion-reduce:transition-none'

const BAND_STYLE = {
  moderate: { color: BRAND, backgroundColor: BRAND_TINT },
  high: { color: EQ_INK, backgroundColor: EQ_TINT },
  extreme: { color: ALERT, backgroundColor: ALERT_TINT },
}

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

function SiteClassField({ value, onChange }) {
  return (
    <div>
      <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">Site subsoil class</span>
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

function Gauge({ eq, wind, target, codeMin }) {
  const L = 44
  const R = 328
  const T = 26
  const B = 244
  const scaleMax = niceMax(Math.max(eq, wind, target, 1) * 1.15)
  const y = (val) => B - (val / scaleMax) * (B - T)
  const cols = [
    { x: 70, v: eq, c: EQ, label: 'EQ' },
    { x: 158, v: wind, c: BRAND, label: 'Wind' },
    { x: 246, v: target, c: INK, label: 'Target' },
  ]
  const bw = 52
  const ticks = 4
  const cmY = y(codeMin)

  return (
    <svg viewBox="0 0 340 280" role="img" aria-label="Bracing demand comparison" className="w-full h-auto block">
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

      <line x1={L} y1={B} x2={R} y2={B} stroke="#cbd5e1" strokeWidth="1.5" />
    </svg>
  )
}

function DirectionInputs({ eqValue, windValue, onEqChange, onWindChange, ariaPrefix }) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      <label className="block">
        <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
          Earthquake <span className="font-medium normal-case tracking-normal text-slate-400">BUs</span>
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={eqValue}
          onChange={(e) => onEqChange(e.target.value)}
          aria-label={`${ariaPrefix} earthquake bracing units, whole house total`}
          className={FIELD_CLASS}
        />
      </label>
      <label className="block">
        <span className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1.5">
          Wind <span className="font-medium normal-case tracking-normal text-slate-400">BUs</span>
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={windValue}
          onChange={(e) => onWindChange(e.target.value)}
          aria-label={`${ariaPrefix} wind bracing units, whole house total`}
          className={FIELD_CLASS}
        />
      </label>
    </div>
  )
}

function DirectionPlot({ eq, wind, result }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 pb-2">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Bracing demand, whole house</p>
      <Gauge eq={eq} wind={wind} target={result.seismicTarget} codeMin={result.codeMinimum} />
      <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600 pt-1 pb-0.5">
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: EQ }} />Earthquake (3604)</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: BRAND }} />Wind (3604)</span>
        <span><i className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]" style={{ backgroundColor: INK }} />Damage-control target</span>
        <span className="inline-flex items-center">
          <svg width="14" height="10" className="mr-1.5 shrink-0" aria-hidden="true">
            <line x1="0" y1="5" x2="14" y2="5" stroke="#334155" strokeWidth="2" strokeDasharray="3 2" />
          </svg>
          Code minimum
        </span>
      </div>
    </div>
  )
}

function DirectionNumber({ title, result }) {
  const numberColor = result.indicativeUpliftPct <= 101 ? '#475569' : BRAND

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div
        className="font-black tracking-tight leading-none text-4xl md:text-5xl mt-2 mb-2 tabular-nums"
        style={{ color: numberColor }}
      >
        {result.indicativeUpliftPct}
        <small className="text-base font-black text-slate-400 tracking-normal ml-1.5">% of code minimum</small>
      </div>
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
        Wind demand already covers the increased earthquake bracing in both directions here. <strong className="text-slate-900">A code-minimum design should be sufficient</strong> for damage control on this site.
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
        Wind demand already covers the {coveredDirection} direction, but the {shortDirection} direction needs more than the code minimum to limit damage. There are two ways to close the gap:
      </p>
      <GapOptions />
    </div>
  )
}

function DesignerMode() {
  const [locationKey, setLocationKey] = useState(DEFAULT_LOCATION)
  const [siteClass, setSiteClass] = useState(DEFAULT_SITE_CLASS)
  const [alongEq, setAlongEq] = useState(String(BRACING_LOCATIONS[DEFAULT_LOCATION].along.eq))
  const [alongWind, setAlongWind] = useState(String(BRACING_LOCATIONS[DEFAULT_LOCATION].along.wind))
  const [acrossEq, setAcrossEq] = useState(String(BRACING_LOCATIONS[DEFAULT_LOCATION].across.eq))
  const [acrossWind, setAcrossWind] = useState(String(BRACING_LOCATIONS[DEFAULT_LOCATION].across.wind))

  const curated = isCuratedLocation(locationKey)
  const hazard = LOCATION_HAZARDS_BY_NAME[locationKey]
  const H = hazard.H[siteClass]
  const along = { eq: Number(alongEq) || 0, wind: Number(alongWind) || 0 }
  const across = { eq: Number(acrossEq) || 0, wind: Number(acrossWind) || 0 }

  const alongResult = useMemo(
    () => computeDesignerResult({ eqBu: along.eq, windBu: along.wind, H }),
    [along.eq, along.wind, H]
  )
  const acrossResult = useMemo(
    () => computeDesignerResult({ eqBu: across.eq, windBu: across.wind, H }),
    [across.eq, across.wind, H]
  )

  function handleLocationSelect(key) {
    const loc = getBracingLocation(key)
    setLocationKey(key)
    if (loc) {
      setAlongEq(String(loc.along.eq))
      setAlongWind(String(loc.along.wind))
      setAcrossEq(String(loc.across.eq))
      setAcrossWind(String(loc.across.wind))
    } else {
      setAlongEq('')
      setAlongWind('')
      setAcrossEq('')
      setAcrossWind('')
    }
  }

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 max-w-xl mb-6">
        <LocationField label="Where are you building?" valueKey={locationKey} onSelect={handleLocationSelect} />
        <SiteClassField value={siteClass} onChange={setSiteClass} />
      </div>

      {!curated && (
        <p className="text-sm text-slate-400 mb-6 max-w-xl">
          These are baseline estimates for {locationKey}, scaled from its earthquake zone and wind region rather than a specific NZS 3604 calculation. Replace them with your own NZS 3604 bracing units below once you have a design.
        </p>
      )}

      <p className="text-sm text-slate-400 mb-8">
        Enter the total earthquake and wind bracing units your NZS 3604:2011 calculation gives for each direction, summed across the whole house. For the purposes of this page, code minimum is taken as the larger of the wind and earthquake demands you enter below.
      </p>

      <div>
        <p className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Along</p>
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <DirectionInputs
            eqValue={alongEq}
            windValue={alongWind}
            onEqChange={setAlongEq}
            onWindChange={setAlongWind}
            ariaPrefix="Along"
          />
          <DirectionPlot eq={along.eq} wind={along.wind} result={alongResult} />
        </div>
      </div>

      <div className="mt-8">
        <p className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">Across</p>
        <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <DirectionInputs
            eqValue={acrossEq}
            windValue={acrossWind}
            onEqChange={setAcrossEq}
            onWindChange={setAcrossWind}
            ariaPrefix="Across"
          />
          <DirectionPlot eq={across.eq} wind={across.wind} result={acrossResult} />
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-100">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Indicative resilience multiplier</p>
        <div className="grid gap-8 sm:grid-cols-2 mb-6">
          <DirectionNumber title="Along" result={alongResult} />
          <DirectionNumber title="Across" result={acrossResult} />
        </div>
        <CombinedPathway alongResult={alongResult} acrossResult={acrossResult} />
      </div>

      <div className="mt-6 px-4 py-3.5 border-l-4 border-slate-300 bg-slate-50 rounded-lg text-sm text-slate-500">
        {COPY.warning} Figures shown are illustrative placeholders.
      </div>
    </div>
  )
}

function HomeownerMode() {
  const [locationKey, setLocationKey] = useState(DEFAULT_LOCATION)
  const [siteClass, setSiteClass] = useState(DEFAULT_SITE_CLASS)
  const locationBu = getBracingLocation(locationKey)
  const hazard = LOCATION_HAZARDS_BY_NAME[locationKey]

  const result = useMemo(
    () => getHomeownerResult({ H: hazard.H[siteClass], windLikelyGoverns: locationBu?.windLikelyGoverns }),
    [hazard, siteClass, locationBu]
  )
  const bandStyle = BAND_STYLE[result.band]
  const statementParts = result.hazardShiftStatement.split(/(roughly \d+%)/)

  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2 max-w-xl">
        <LocationField label="Where are you building?" valueKey={locationKey} onSelect={setLocationKey} />
        <SiteClassField value={siteClass} onChange={setSiteClass} />
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

      <p className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-slate-900 leading-tight mt-3">
        Meeting only that minimum can still leave a home <b style={{ color: BRAND }}>needing extensive repairs</b> - independent research suggests <b style={{ color: BRAND }}>around 50% more bracing</b> is needed to limit that damage.
      </p>

      <details className="mt-5 group">
        <summary className="inline-flex items-center gap-2 cursor-pointer select-none text-sm font-black tracking-wide uppercase text-[#17638f] hover:text-[#0f4c6e] transition list-none [&::-webkit-details-marker]:hidden">
          <span>Want the technical basis?</span>
          <svg className="w-3 h-3 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <p className="mt-3 pl-4 md:pl-5 border-l-2 border-slate-200 text-base text-slate-500 leading-relaxed">
          This combines two independent sources: the 2022 National Seismic Hazard Model, which is behind the hazard increase above, and BRANZ Study Report SR337 (2015), which found that homes built only to the NZS 3604 minimum may need around 50% more seismic bracing to limit damage in a design-level earthquake, rather than just meet the life-safety standard.
        </p>
      </details>

      <span
        className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-1.5 rounded-full mt-5"
        style={bandStyle}
      >
        {result.bandLabel}
      </span>

      <p className="text-base md:text-lg text-slate-600 leading-relaxed mt-4">{result.governanceFlavour}</p>

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

export default function BracingCheck() {
  const [mode, setMode] = useState('designer')

  return (
    <>
      <div role="tablist" aria-label="Choose mode" className="inline-flex flex-wrap gap-2 mb-6">
        <button
          type="button"
          role="tab"
          aria-pressed={mode === 'designer'}
          onClick={() => setMode('designer')}
          className={`font-bold text-xs tracking-wide px-4 py-1.5 rounded-full border-2 transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#17638f]/30 ${
            mode === 'designer'
              ? 'border-[#17638f] bg-[#eef1f3] text-[#17638f]'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          }`}
        >
          I have bracing figures
        </button>
        <button
          type="button"
          role="tab"
          aria-pressed={mode === 'homeowner'}
          onClick={() => setMode('homeowner')}
          className={`font-bold text-xs tracking-wide px-4 py-1.5 rounded-full border-2 transition motion-reduce:transition-none focus:outline-none focus:ring-2 focus:ring-[#17638f]/30 ${
            mode === 'homeowner'
              ? 'border-[#17638f] bg-[#eef1f3] text-[#17638f]'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          }`}
        >
          I just have a location
        </button>
      </div>

      <div className="rounded-3xl border border-slate-100 shadow-sm bg-white overflow-hidden">
        <div className="p-6 md:p-9">
          {mode === 'designer' ? <DesignerMode /> : <HomeownerMode />}
        </div>
        <FrontFootCta />
      </div>
    </>
  )
}
