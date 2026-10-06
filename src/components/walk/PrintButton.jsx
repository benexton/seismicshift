export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-xs text-slate-700 hover:border-slate-500 transition-colors"
    >
      Print itinerary
    </button>
  )
}
