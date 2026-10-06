import { tagLabel } from '../../lib/structuralTags'
import { WALK } from './theme'

export default function TagChip({ tag }) {
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
      style={{ color: WALK.maroon, backgroundColor: WALK.tint }}
    >
      {tagLabel(tag)}
    </span>
  )
}
