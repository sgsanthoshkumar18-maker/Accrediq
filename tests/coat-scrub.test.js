/* THE SCROLL-SCRUBBED IMAGE SEQUENCE.
 *
 * Four hundred images pretending to be one object. Everything that goes wrong with this
 * technique is arithmetic, and none of it is visible in a screenshot:
 *
 *   1. THE WRONG FRAME. Floor instead of round spends the last frame's whole share of the
 *      scroll on the second-to-last image, so the sequence never reaches its final pose.
 *   2. A BLANK CANVAS. The frame the scroll wants has not arrived yet. Drawing nothing
 *      flashes the page through the coat; the answer is the nearest frame that HAS.
 *   3. A LOADING ORDER THAT LEAVES THE END EMPTY. Fetching 1..N means the first second
 *      works and the rest is blank for ten seconds, which is exactly when a first-time
 *      reader scrolls fast to see what the page does.
 *
 * The maths is in its own module so all three can be asked directly rather than inferred
 * from a canvas nobody can assert against.
 */
const path = require('path');
const fs = require('fs');
const F = require('../profile/coat-frames.js');

let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };
const ok = (v, m) => eq(!!v, true, m);

/* ---- which frame belongs to a scroll position ---- */

eq(F.frameAt(0, 420), 0, 'the top of the runway is the first frame');
eq(F.frameAt(1, 420), 419, 'and the bottom is the last one');
/* The bug this catches: with Math.floor, frameAt(1 - epsilon) is 418 and the final pose
   only appears at exactly 1.0, which a scroll never lands on. */
eq(F.frameAt(0.999, 420), 419, 'the final pose is reached before the very last pixel');
eq(F.frameAt(0.5, 401), 200, 'the middle of the scroll is the middle frame');

/* Nothing outside the sequence, whatever the scroll reports. Rubber-banding on iOS and a
   resize mid-scroll both produce progress outside 0..1, and an index of -1 or 420 would
   draw nothing at the exact moment the reader is looking. */
eq(F.frameAt(-3, 420), 0, 'progress above the section clamps to the first frame');
eq(F.frameAt(9, 420), 419, 'and past it clamps to the last');
eq(F.frameAt(NaN, 420), 0, 'a NaN measurement draws frame one rather than nothing');
eq(F.frameAt(0.5, 0), 0, 'and no frames at all is not a crash');

/* ---- never a blank canvas ---- */

const loaded = new Array(10).fill(false);
loaded[0] = true; loaded[9] = true;
eq(F.nearestLoaded(0, loaded), 0, 'a loaded frame is used as-is');
eq(F.nearestLoaded(1, loaded), 0, 'and one that has not arrived falls back to its neighbour');
eq(F.nearestLoaded(8, loaded), 9, 'searching forwards as well as back');
/* Ties go backwards: the frame the reader has already scrolled through is a safer guess
   than one they have not reached, because it is where the coat visibly was. */
eq(F.nearestLoaded(4, loaded), 0, 'an exact tie prefers the frame already passed');
eq(F.nearestLoaded(3, new Array(10).fill(false)), -1,
   'and with nothing loaded it reports so rather than returning frame 0 that cannot draw');

/* ---- the loading order ---- */

[1, 2, 3, 7, 8, 96, 420].forEach((n) => {
  const order = F.loadOrder(n);
  eq(order.length, n, n + ' frames produce exactly ' + n + ' fetches');
  eq(new Set(order).size, n, 'and no frame is fetched twice at n=' + n);
  eq(order.every(i => i >= 0 && i < n), true, 'every index is in range at n=' + n);
});

/* THE POINT OF THE ORDER. After a handful of images the WHOLE scroll must already
   animate, coarsely — not the first tenth of it perfectly and the rest blank. */
const o420 = F.loadOrder(420);
eq(o420[0], 0, 'the first frame is fetched first, since nothing shows until it lands');
eq(o420[1], 419, 'the last is second, so the end of the scroll is never empty');
eq(o420[2], 209, 'then the middle');
/* With twenty of four hundred and twenty loaded, the worst gap anywhere in the sequence
   should already be small enough that nearestLoaded is never far wrong. */
const first20 = o420.slice(0, 20).sort((a, b) => a - b);
let worstGap = first20[0];
for (let i = 1; i < first20.length; i++) worstGap = Math.max(worstGap, first20[i] - first20[i - 1]);
ok(worstGap <= 32, 'twenty images in, no gap in the sequence exceeds 32 frames (got ' + worstGap + ')');
/* Fetching in file order would leave a gap of 400 at that point — the failure this
   whole ordering exists to prevent. */
ok(worstGap < 100, 'which naive 1..N ordering could never manage');

/* ---- the mobile subset ---- */

const sub = F.subset(420, 96);
eq(sub.length <= 96, true, 'a phone fetches at most the count asked for');
eq(sub[0], 0, 'starting on the first frame');
eq(sub[sub.length - 1], 419, 'and ending on the last, so the pose it was composed for still lands');
eq(new Set(sub).size, sub.length, 'with no duplicate fetching the same file twice');
let mono = true;
for (let i = 1; i < sub.length; i++) if (sub[i] <= sub[i - 1]) mono = false;
ok(mono, 'and in order, so the coat turns one way');
eq(F.subset(420, 0).length, 420, 'asking for none means all of them, not an empty animation');
eq(F.subset(50, 96).length, 50, 'and asking for more than exist is capped at what exists');
eq(F.subset(9, 1), [0], 'a single-frame subset is the opening pose');

/* ---- file names ---- */

eq(F.fileFor('profile/coat/coat-#.webp', 0), 'profile/coat/coat-0001.webp',
   'frames are one-based on disk, because a render that starts at 0001 is what Blender writes');
eq(F.fileFor('profile/coat/coat-#.webp', 419), 'profile/coat/coat-0420.webp', 'and zero-padded to four');
/* A directory that sorts 1, 10, 100, 2 is one nobody can check by eye, and checking by
   eye is exactly what happens when four hundred renders finish overnight. */
eq(F.fileFor('x/#.webp', 8), 'x/0009.webp', 'padding holds at every magnitude');

/* ================= the page it is wired into ================= */

const JS = fs.readFileSync(path.join(__dirname, '../profile/coat.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../profile/coat.css'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '../founder.html'), 'utf8');

/* NO GSAP, NO LIBRARY. The reference implementation uses ScrollTrigger; this site has no
   build step and no node_modules, and seventy kilobytes to replace one division is the
   wrong trade twice over. */
/* Comments stripped first: the file explains at length why it does NOT use ScrollTrigger,
   and a test that reads prose cannot tell an explanation from a dependency. */
const JS_CODE = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
eq(/gsap|ScrollTrigger/i.test(JS_CODE), false, 'the scrubber pulls in no animation library');
eq(/<script[^>]+gsap/i.test(HTML), false, 'and the page does not load one either');
eq(/position: sticky/.test(CSS), true, 'pinning is position:sticky, as scrolly.js does it');
eq(/addEventListener\("wheel"/.test(JS), false,
   'and the wheel is never intercepted — that is what earns this technique its bad name');
eq(/requestAnimationFrame\(measure\)/.test(JS), true, 'scroll reads are rAF-throttled');
eq(/passive: true/.test(JS), true, 'and passive, so scrolling is never blocked on our handler');

/* A PORTFOLIO WITH NO RENDERS DEPLOYED MUST HAVE NO GAP IN IT. Not a black canvas, not
   four screens of empty runway — no section at all. */
eq(/\.coat \{ display: none; \}/.test(CSS), true, 'the section starts hidden');
eq(/\.coat\[data-coat-ready="1"\] \{ display: block; \}/.test(CSS), true,
   'and is revealed only by the attribute the script sets');
eq(/if \(!first\) return;/.test(JS), true,
   'a first frame that will not load reveals nothing and stops');
eq(/host\.setAttribute\("data-coat-ready", "1"\)/.test(JS), true,
   'which happens after a real paint, not after a load event');

/* Reduced motion and touch must agree with the rest of the site, or the page pins in one
   section and not in another. */
eq(/prefers-reduced-motion/.test(JS) && /prefers-reduced-motion/.test(CSS), true,
   'reduced motion is honoured in both the script and the stylesheet');
eq(/max-width: 1024px/.test(JS), true, 'and the touch breakpoint matches scrolly.js');
eq(/reduce \? \[0\]/.test(JS), true, 'reduced motion fetches one frame, not four hundred');
eq(/coarse \? Math\.min\(total, 96\)/.test(JS), true,
   'and a phone fetches a quarter of them rather than ten megabytes on mobile data');

/* The canvas has to be a real image to a screen reader, and the decorative bar must not. */
eq(/<canvas class="coat-canvas" role="img"/.test(HTML), true, 'the canvas is announced as an image');
eq(/aria-label="A doctor in a lab coat, turning as the page scrolls"/.test(HTML), true,
   'with a description of what it shows');
eq(/<div class="coat-rail" aria-hidden="true">/.test(HTML), true, "the progress rail is decorative");
eq(/<div class="coat-glow" aria-hidden="true"><\/div>/.test(HTML), true,
   'and so is the glow behind the figure');

/* The two things that change when the renders are replaced, and nothing else. */
/* THE DECLARED COUNT MUST MATCH WHAT IS ACTUALLY ON DISK, and this is the assertion that
   catches the mismatch. Declaring more frames than exist means the loader spends the tail
   of the scroll requesting files that 404; declaring fewer silently throws away renders
   somebody waited seven minutes for. The sequence was thinned from 420 to 210 after the
   render, which is exactly the kind of change that leaves these two out of step. */
const declared = /data-frames="(\d+)"/.exec(HTML);
ok(declared, 'the frame count is declared in the markup');
const onDisk = fs.readdirSync(path.join(__dirname, '../profile/coat'))
  .filter(f => /^coat-\d{4}\.webp$/.test(f)).length;
eq(Number(declared[1]), onDisk,
   'and it matches the ' + onDisk + ' frames actually in profile/coat/');
/* One-based and contiguous: a gap would draw the nearest neighbour instead, which reads as
   the figure sticking for a moment rather than as a missing file. */
let contiguous = true;
for (let i = 1; i <= onDisk; i++) {
  if (!fs.existsSync(path.join(__dirname, '../profile/coat',
      'coat-' + String(i).padStart(4, '0') + '.webp'))) contiguous = false;
}
ok(contiguous, 'the frames are numbered 1..' + onDisk + ' with no gaps');
eq(/data-src="profile\/coat\/coat-#\.webp"/.test(HTML), true, 'and so is the path pattern');
eq(/profile\/coat-frames\.js/.test(HTML) && /profile\/coat\.js/.test(HTML), true,
   'both scripts are loaded, maths before driver');
eq(HTML.indexOf('profile/coat-frames.js') < HTML.indexOf('profile/coat.js'), true,
   'in that order, since the driver returns early without the maths');

/* devicePixelRatio is capped: a phone reporting 3 would otherwise allocate nine times the
   canvas area for a difference nobody can see, on the device least able to afford it. */
eq(/Math\.min\(2, window\.devicePixelRatio/.test(JS), true, 'the canvas is capped at 2x');

/* THE DECODE TRAP — the bug that hid the whole section and logged nothing.
   img.decode() in a hidden or backgrounded document does not reject. Its promise NEVER
   SETTLES. Awaiting it before marking a frame ready meant a visitor whose tab was in the
   background while the page loaded lost this section permanently: the frames arrived
   200 OK, nothing was drawn, and no error appeared anywhere. The load event must be the
   authority and decode must be fire-and-forget. */
ok(/ok\(\);\s*\n\s*if \(img\.decode\)/.test(JS_CODE),
   'a frame is marked ready on load, BEFORE decode is attempted');
eq(/img\.decode\(\)\.then\(ok/.test(JS_CODE), false,
   'readiness is never gated on the decode promise settling');
ok(/img\.decode\(\)\.catch\(/.test(JS_CODE),
   'and a decode rejection is swallowed rather than treated as a failed frame');

/* The camera move is done at draw time, not baked into the render — so the framing can be
   judged and changed in a second instead of costing a re-render each time. */
ok(/ZOOM_FROM = 0\.\d+, ZOOM_TO = 1\.\d+/.test(JS), 'the push-in is two tunable numbers');
ok(/function ease\(/.test(JS_CODE),
   'the push-in is eased, since a linear one never appears to settle');

/* THE FIGURE MUST NEVER BE CLIPPED BY THE COLUMN, and a zoom ceiling alone cannot promise
   that — the safe ceiling depends on how wide the column happens to be. It is guaranteed
   instead by measurement: he is never wider than FIG_W of the frame, so the largest scale
   that still fits is cw / (iw * FIG_W), and the push-in stops there. Verified in a browser
   at 1440x900: the painted alpha box never touched either edge at any scroll position. */
ok(/FIG_W = 0\.\d+, FIG_CX = 0\.\d+/.test(JS),
   'the figure extents are measured constants, not guesses');
ok(/var fits = cw \/ \(iw \* FIG_W\);\s*\n\s*if \(s > fits\) s = fits;/.test(JS_CODE),
   'and the push-in is clamped by them, so a narrow column crops empty pixels not shoulders');
/* Fitted to HEIGHT, never "contained": contain in a half-width column fits to the width
   and leaves him small with air above and below — the opposite of what the column is for. */
ok(/var s = \(ch \/ ih\) \* k;/.test(JS_CODE), 'the image is fitted to the stage height');
/* He sits at 46.7% of the frame, so centring the image would leave him visibly off-centre. */
ok(/var dx = \(0\.5 - FIG_CX\) \* w;/.test(JS_CODE), 'and offset to his real centre');

/* ---- the copy is beside the figure, never over it ----
   The first version painted the headline across his coat and it was unreadable. Two
   columns, and the emphasised block is decided by where the BLOCK is rather than by
   section progress — the same rule scrolly.js uses, so the two sections cannot drift. */
ok(/data-beat/.test(JS) && /data-beat/.test(HTML), 'the copy beats are wired to the scroll');
ok(/function activeBeat\(/.test(JS_CODE), 'the active block is chosen by its own position');
ok(/window\.innerHeight \/ 2/.test(JS_CODE), 'nearest the middle of the viewport, as scrolly.js does');
ok(/classList\.toggle\("is-on"/.test(JS_CODE),
   'toggled as a class, so the fade lives in the stylesheet rather than in the scroll handler');
eq(/coat-copy/.test(HTML), false, 'the overlay caption is gone from the markup');
ok(/\.coat-grid \{/.test(CSS) && /grid-template-columns/.test(CSS), 'the section is two columns');
/* It pins on the RIGHT because motion.css pins the very next section on the left. Two
   consecutive sections with a frozen left edge read as one long stuck panel. */
eq(HTML.indexOf('coat-text') < HTML.indexOf('coat-stage'), true,
   'text first in the DOM, so the pinned figure sits on the right');
ok(/\.coat-stage \{[^}]*position: sticky/.test(CSS), 'and the figure column is the pinned one');
/* On a phone there is no scroll to drive them and no room for two columns. */
ok(/@media \(max-width: 900px\)[\s\S]{0,400}grid-template-columns: 1fr/.test(CSS),
   'which collapses to one column on a phone');
ok(/@media \(max-width: 900px\)[\s\S]{0,400}opacity: 1/.test(CSS),
   'with every line readable at once rather than dimmed');

/* ---- the dark stage ----
   A cut-out on a pale ground sits ON the page; the same cut-out on a dark ground lifts OFF
   it. The band is therefore dark in BOTH themes, which is the whole reason it carries its
   own palette instead of following --bg and --fg: in the light theme those would put
   near-black text on a near-black stage. */
ok(/--coat-ink:\s*#/.test(CSS) && /--coat-ink-2:\s*#/.test(CSS) && /--coat-accent:\s*#/.test(CSS),
   'the stage declares its own palette rather than following the page tokens');
/* THE BUG THIS LOCKS DOWN. styles.css gives every h2 its own `color: var(--fg)`, which
   beats anything inherited from the section. Setting colour on .coat alone left the
   headline rendering rgb(7,10,18) on a rgb(5,7,14) band — invisible, and it shipped that
   way in a screenshot before it was caught. Measured after the fix: 17.79:1. */
ok(/\.coat-beat h2 \{[\s\S]*?color: var\(--coat-ink\);/.test(CSS),
   'and the headline states its colour explicitly, since a bare h2 rule outranks inheritance');
ok(/\.coat-beat \.k \{[\s\S]*?color: var\(--coat-accent\)/.test(CSS),
   'as does the eyebrow');
ok(/\.coat-beat p \{[\s\S]*?color: var\(--coat-ink-2\)/.test(CSS), 'and the body copy');
/* Every colour on the stage comes from the local palette. A --fg or --bg reaching in here
   is the exact failure above, waiting to happen again. */
/* Comments stripped first — this file explains the bug in prose that names the very token
   the rule forbids, and a test that reads prose cannot tell an explanation from a usage. */
const stageBlock = CSS.slice(CSS.indexOf('.coat {'), CSS.indexOf('@media (max-width: 900px)'))
  .replace(/\/\*[\s\S]*?\*\//g, '');
eq(/var\(--fg\b|var\(--fg-muted\)|var\(--bg\b/.test(stageBlock), false,
   'no page foreground or background token reaches into the dark band');
/* Three stacked gradients, not one: a single radial reads as a spotlight sticker. */
ok((CSS.match(/radial-gradient/g) || []).length >= 4,
   'the lift is layered gradients rather than one flat glow');
ok(/\.coat-vignette/.test(CSS) && /coat-vignette/.test(HTML),
   'and the band has a horizon rather than a hard edge against the light page');

/* ================= the energy field ================= */

/* THE HASH BUG, LOCKED DOWN. The textbook version of this function is written for C where
   integer multiplication wraps. In JavaScript every number is a double, so `n * n * 15731`
   reaches 2^76 and the low bits — where a hash keeps all its entropy — are rounded away.
   It produced 258 distinct values from 4000 inputs, handed every bolt the same coordinates
   so they stacked into one thick bar, and returned exactly 1.000 for every jitter sample.
   A glowing banana across his face, and nothing anywhere threw. */
ok(/Math\.imul/.test(JS_CODE), 'the hash uses Math.imul for an exact 32-bit multiply');
eq(/n \* \(n \* n \* 15731/.test(JS_CODE), false,
   'and never the C-style multiply that silently loses its low bits in a double');
(function () {
  /* Run the real function, rather than trusting that it looks right. */
  const m = /function nz\(n\) \{[\s\S]*?\n  \}/.exec(JS);
  ok(m, 'the hash is extractable for testing');
  const nz = new Function('return (' + m[0].replace(/^function nz/, 'function') + ')')();
  const vals = [];
  for (let i = 0; i < 4000; i++) vals.push(nz(i));
  const distinct = new Set(vals.map(v => v.toFixed(4))).size;
  ok(distinct > 3000, 'it yields well over 3000 distinct values from 4000 inputs (got ' + distinct + ')');
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  ok(Math.abs(mean) < 0.05, 'centred near zero (mean ' + mean.toFixed(4) + ')');
  eq(nz(12345), nz(12345), 'and is deterministic, which is what lets the field scrub backwards');
  /* The specific failure: seven bolts drawing at one place. */
  const spread = new Set();
  for (let b = 0; b < 7; b++) spread.add(nz(30 * 977 + b * 3571).toFixed(4));
  eq(spread.size, 7, 'seven bolts get seven different positions, not one');
})();

/* Most of the effect must be LIGHT, not line art — that was the whole complaint. */
ok(/destination-in/.test(JS_CODE) && /source-in/.test(JS_CODE),
   'the halo is cut from the figure’s own silhouette');
ok(/globalCompositeOperation = "source-atop"/.test(JS_CODE),
   'and spill is painted back ONTO the figure, so the light lands on the fabric');
ok(/rgba\(255,255,255,/.test(JS_CODE),
   'arcs are white-hot at the core, coloured only in the falloff, as an arc photographs');
ok(/BOLTS = [1-5];/.test(JS), 'and are few enough to be a detail rather than the effect');

/* ================= the assembly ================= */

ok(/ASSEMBLE_END/.test(JS), 'he assembles over a declared span of the scroll');
ok(/revealField/.test(JS_CODE), 'from a per-pixel reveal-order field');
/* Seeded at the chest, cheap downwards and expensive sideways, with the head last — that
   ordering is what makes it read as a body forming rather than a stain spreading. */
ok(/var sx = FIG_CX, sy = 0\.\d+;/.test(JS_CODE), 'seeded at his chest, not the canvas centre');
ok(/head = v < 0\.\d+/.test(JS_CODE), 'with the head paying a surcharge so it arrives last');
/* NORMALISED AGAINST THE BODY, NOT THE RECTANGLE. Dividing by the whole frame's maximum
   uses a far corner of empty transparent space, which squashed every real value into the
   bottom half of the range: he finished forming at 20% of the scroll and the rest of the
   runway animated nothing. Bounds are the ones measured off the frames. */
ok(/u >= 0\.158 && u <= 0\.776/.test(JS_CODE),
   'and normalised against his measured bounds so the pacing uses the whole span');
/* Once he is whole this must cost nothing: the masking is per-pixel work. */
ok(/if \(t >= 1\) return null;/.test(JS_CODE),
   'the finished figure skips the masking entirely');
/* The halo during assembly must hug only what exists — keyed on the mask, not the frame,
   or a canvas with no .src would crash it and a stale cache would glow around a body he
   has not grown yet. */
ok(/img\.src \? img\.src\.slice\(-24\) : "part" \+ maskAt/.test(JS_CODE),
   'the halo cache handles the masked canvas and re-keys as he forms');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
