# AQcredix — "The Gap" film · handoff brief

Two files make the whole thing:

- `videos/aq-film.css` — all styling and every transition
- `videos/aq-film.js` — markup, the beat sheet, the clock, two canvases, the player chrome

Nothing else is needed. No build step, no dependencies, no images. Drop both in
`videos/` and it works.

---

## The contract a replacement must satisfy

If someone rebuilds this, it has to keep **four** things or the site breaks.

**1. Expose `window.AQFilm` with two methods.**

```js
window.AQFilm = {
  mount(hostElement, opts)  // renders the film inside an existing div
  open()                    // opens it fullscreen over the current page
};
```

`index.html` calls `AQFilm.mount(document.getElementById("aqFilmHost"))` on
`DOMContentLoaded`. `app.js` calls `AQFilm.open()` from the
"Wanna know about AQcredix?" link when no host is on the page.

**2. Add `aqf-mount` to the host element**, and `aqf-mount is-full` when fullscreen.
`aq-scroll-lock.js` watches for `.aqf-mount.is-full` to hold the page still while the
film plays fullscreen. Change the class and the page scrolls behind it.

**3. Support `?aqft=<seconds>`** — jump straight to a moment. Used for checking a
specific beat without watching from the start, and for linking someone to the part
that answers their question.

**4. Respect `prefers-reduced-motion`.** The current build jumps to the final frame
rather than animating. A film that ignores this is unusable for some people and is a
straightforward accessibility failure.

---

## Why it is a web animation and not an MP4

**Do not let anyone replace this with a video file.** A 1080p MP4 is soft on a
projector, heavy on hospital wifi, and cannot be corrected without re-rendering. This
is composed once at 1920×1080 and the whole stage is scaled to whatever box it is
given, so the composition — every crop, every mask, every transition — is identical
on a phone and a theatre screen. It is a few kilobytes and the words are editable in
a text editor.

The scaling itself has two traps worth stating, both of which cost real debugging:

- **Measure, never guess.** Layout reports `0` for a frame or two while an embedded
  panel sizes itself. Clamping a zero reading to a "safe" minimum locks the film at a
  wrong scale that looks deliberate. Ask again next frame instead.
- **Do not centre with CSS grid.** An auto-sized grid track grows to the 1920px
  content, so "centred in the track" is not centred on screen. Use
  `position:absolute; left:50%; top:50%` with `translate(-50%,-50%) scale(s)`.

---

## The structure, if the edit is being reworked

Total **52 seconds**, one clock, three acts. Every beat is a timestamp in the `BEATS`
array — `[time, act, beat]` — so the edit can be retimed without touching any logic.

| Act | Time | What it does |
|---|---|---|
| I · Broadcast | 0–16s | The market fact, with news-bulletin urgency |
| II · The ward | 16–34s | One quality manager at 02:14, as narrative |
| III · Product | 34–52s | The platform, as a launch film |

Transitions in use, all CSS: **landing** (`scale 1.9` → overshoot → settle),
**speed ramp** (blur + scale on act-out), **creative masking** (`clip-path` wipes,
horizontal and vertical), **phone transition** (the camera dives into the handset
until it fills the frame), **slam** (hard 220ms cut-in, used only on numbers).

Two canvases: a scatter-to-grid dot field in Act II, and a node mesh in Act III.

---

## The numbers are real. Keep them that way.

Every figure was checked against the codebase or a public source:

- **639** objective elements, **100** standards, **10** chapters, **45** audit departments
- **43,500** private hospitals in India, **4,200** NABH accredited
- **PM-JAY +10%** on the base package rate, for the two-year ELC validity
- Consultant engagement **₹3–25 lakh**
- **₹500/month**, **₹5,000/year**, 7-day trial

A film that inflates its own figures is the one thing a hospital will actually check.
If a rebuild rounds "4,200" up to "5,000" because it scans better, that is a defect.

---

## Where it is wired in

| File | What it does |
|---|---|
| `index.html` | `<link>` to the CSS, `<script>` to the JS, `#aqFilmHost` section, mount call |
| `app.js` | Footer link `#aqFilmBtn` → plays in place, or `AQFilm.open()` elsewhere |
| `aq-scroll-lock.js` | Watches `.aqf-mount.is-full` |

It is **not** on `videos.html` in any way that a stranger can reach: that page loads
`auth-gate.js` and is subscriber-gated, so a signed-out visitor gets a sign-in wall.
The film has to stay on a free page — its whole job is explaining the product to
someone who has not signed up.
