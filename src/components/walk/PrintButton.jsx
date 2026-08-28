export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-4 py-2 rounded-full border-2 border-slate-300 font-bold text-xs tracking-wide text-slate-600 hover:border-slate-400 transition-colors"
    >
      Print itinerary
    </button>
  )
}
