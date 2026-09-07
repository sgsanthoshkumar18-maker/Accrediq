# The lab coat frames

This directory holds the rendered image sequence that `profile/coat.js` scrubs through on
`founder.html`. **It is empty until the renders are produced**, and that is a safe state:
the section is `display:none` until the first frame actually decodes, so a deploy without
these files has no gap in the page rather than four screens of black canvas.

## What goes here

Files named `coat-0001.webp` … `coat-0420.webp` — one-based, zero-padded to four digits.

Two things in `founder.html` must match what is actually here, and nothing else:

```html
<section class="coat" data-coat data-frames="420"
         data-src="profile/coat/coat-#.webp">
```

- `data-frames` — how many files exist.
- `data-src` — the path, with `#` where the padded number goes.

Render 300 and set `data-frames="300"` and it works. The count is not baked in anywhere
else.

## Producing them from the Meshy GLB, in Blender

1. **File → Import → glTF 2.0**, choose the `.glb`. Delete the default cube.
2. Select the model, `Object → Set Origin → Origin to Geometry`, then `Alt+G` to drop it
   at the world centre. **This is the step that matters most** — if the origin is off, the
   coat wobbles instead of turning.
3. Add an **Empty** at the world centre (`Add → Empty → Plain Axes`). Select the model,
   then shift-select the Empty, `Ctrl+P → Object`. The Empty is now the turntable.
4. Select the Empty. On frame 1 press `I → Rotation`. Go to frame 420, set Z rotation to
   `360°`, press `I → Rotation` again.
5. Open the **Graph Editor**, select both keyframes, `T → Linear`. Without this the
   rotation eases in and out, and a scroll-scrubbed sequence with easing feels like it is
   sticking.
6. **Camera**: `Numpad 0`, frame the coat with a little headroom. Lock it — it must not
   move, or the coat will appear to swim.
7. **Lighting**: a three-point setup, or an HDRI in `World Properties`. Whatever reads
   cleanly on both a white and a near-black page background.
8. **Output Properties**:
   - Resolution `1400 × 1400` (square keeps the framing identical on any window shape).
   - Frame Start `1`, End `420`.
   - **Film → Transparent: ON.** Essential. The page's own background shows through, so
     one set of frames works on both the light and the dark theme.
   - Output path this directory, File Format **PNG**, Color **RGBA**.
9. **Render → Render Animation.** This is the long part.

## Converting the PNGs to WebP

PNGs at this size are far too heavy to ship. From this directory:

```bash
for f in coat-*.png; do cwebp -q 82 -alpha_q 90 "$f" -o "${f%.png}.webp"; done
```

Then delete the PNGs — **only the `.webp` files belong in the repository.**

Check the total before committing:

```bash
du -sh .
```

Aim for **under 12 MB** for the whole directory. If it is larger, either drop the
resolution to 1100 px or render fewer frames (300 is still smooth). Do not raise the
quality above 82 — the difference is invisible against the page and roughly doubles the
weight.

## What the page does with them

- **Desktop** loads all of them, but not in file order. `coat-frames.js` fetches frame 1,
  then the last, then the middle, then quarters — so after about twenty images the whole
  scroll already animates coarsely and nothing is ever blank. Fetching 1…N would leave the
  end of the sequence empty for ten seconds, which is exactly when a first-time reader
  scrolls fast to see what the page does.
- **Phones** load an evenly spaced 96 of them, keeping the first and last. Ten megabytes
  on mobile data to watch a coat turn is a hostile thing to do to somebody on a train, and
  nobody can pick out the missing frames on a 390 px screen.
- **Reduced motion** loads exactly one — the opening pose, and none of the movement.
