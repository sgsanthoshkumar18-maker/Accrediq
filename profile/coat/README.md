# The founder sequence frames

210 WebP frames, 7.5MB, rendered in Blender from a Rodin-generated 3D model of a doctor in
a lab coat. `profile/coat.js` scrubs through them as the founder page scrolls.

Files are `coat-0001.webp` … `coat-0210.webp` — one-based, zero-padded to four digits, no
gaps. A test asserts that the count here matches `data-frames` in `founder.html`, because
those two drifting apart is silent: too high and the tail of the scroll requests files that
404, too low and renders somebody waited for are quietly thrown away.

## How these were made

Blender 5.2 LTS, EEVEE. The model is parented to an Empty at the world origin; the Empty
carries two rotation keyframes — 0° at frame 1 and 360° at frame 420 — set to **Linear**
interpolation. Linear matters: with Blender's default Bézier easing the spin slows at both
ends, and on a scroll-scrubbed sequence that reads as the page sticking rather than as a
graceful ease.

Lighting is a studio HDRI in the World (Poly Haven, CC0), strength 1.0. **Not** a bare
world colour at high strength — that lights from every direction equally, which removes
every shading gradient and makes the figure look like a paper cutout. That mistake was made
once here and it is worth not repeating.

Output: 1100×1100, **Film → Transparent ON**, WebP, RGBA, quality 82, path ending `coat-`
so Blender appends the numbers itself. Transparency is what lets one set of frames work on
both the light and the dark theme — the page's own background shows through.

Blender writes WebP directly, so there is no PNG conversion step.

## Why 210 and not 420

420 frames were rendered, then thinned to every other one — keeping **both endpoints**, so
the 360° loop still closes exactly. 420 frames is 15MB; 210 is 7.5MB. At 210 the figure
turns 1.7° per frame across a 460vh runway, which is finer than the scroll can resolve.

To rebuild at a different count: render the full sequence, then keep an evenly spaced
subset that includes frame 1 and the last frame, renumber from 0001, and update
`data-frames` in `founder.html`.

## What the page does with them

- **Desktop** loads all of them, but not in file order. `coat-frames.js` fetches the first
  frame, then the last, then the middle, then quarters — so after about twenty images the
  whole scroll already animates coarsely and nothing is ever blank. Fetching 1…N would
  leave the end of the sequence empty for ten seconds, which is exactly when a first-time
  reader scrolls fast to see what the page does.
- **Phones** load an evenly spaced 96, keeping the first and last.
- **Reduced motion** loads exactly one — the opening pose, and none of the movement.
- The section is `display:none` until a frame has actually loaded, so a deploy without
  these files leaves no gap in the page rather than four screens of blank canvas.
