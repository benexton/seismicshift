const ACCESS_LEVELS = {
  interior_public: { label: 'Interior open', dot: 'bg-emerald-500', className: 'text-emerald-800 bg-emerald-50 ring-emerald-200' },
  foyer_only: { label: 'Foyer only', dot: 'bg-amber-500', className: 'text-amber-800 bg-amber-50 ring-amber-200' },
  exterior_only: { label: 'Exterior only', dot: 'bg-slate-400', className: 'text-slate-700 bg-slate-100 ring-slate-200' },
  by_arrangement: { label: 'By arrangement', dot: 'bg-sky-500', className: 'text-sky-800 bg-sky-50 ring-sky-200' },
}

export default function AccessBadge({ level, className = '' }) {
  const info = ACCESS_LEVELS[level]
  if (!info) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset text-[11px] font-semibold ${info.className} ${className}`}
    >
      <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      {info.label}
    </span>
  )
}
