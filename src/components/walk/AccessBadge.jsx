const ACCESS_LEVELS = {
  interior_public: { label: 'Interior open to public', icon: '●', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  foyer_only: { label: 'Foyer / lobby only', icon: '◐', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  exterior_only: { label: 'Exterior viewing only', icon: '○', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  by_arrangement: { label: 'By arrangement / limited', icon: '△', className: 'bg-sky-50 text-sky-700 border-sky-200' },
}

export default function AccessBadge({ level, className = '' }) {
  const info = ACCESS_LEVELS[level]
  if (!info) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wide ${info.className} ${className}`}
    >
      <span aria-hidden="true">{info.icon}</span>
      {info.label}
    </span>
  )
}
