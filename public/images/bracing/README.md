# Bracing before/after comparison images

Used by `BeforeAfterSlider` on the bracing-check page (`src/pages/bracing-check.astro`).

- `room-standard.png` (before) / `room-resilient.png` (after): hero room comparison, 1672×941
- `corner-standard.png` (before) / `corner-resilient.png` (after): door-corner detail, 1536×1024

If either pair is ever regenerated or replaced, keep these two rules:

1. **Each pair must be pixel-aligned.** Generate/shoot the "after" as an edit of the exact
   same locked frame as the "before" (same camera position, same crop, same lighting rig),
   not two independent generations/shots. Any camera or framing drift between before/after
   shows up as a jarring jump when the slider is dragged across it.
2. **No baked-in text.** No labels, watermarks, or captions in the image content itself:
   `beforeLabel`/`afterLabel` are rendered as DOM overlays by the component, not part of the
   image.

Keep both images in a pair at identical dimensions.
