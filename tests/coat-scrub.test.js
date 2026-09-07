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
eq(/<div class="coat-bar" aria-hidden="true">/.test(HTML), true, 'the progress bar is decorative');

/* The two things that change when the renders are replaced, and nothing else. */
eq(/data-frames="420"/.test(HTML), true, 'the frame count is declared in the markup');
eq(/data-src="profile\/coat\/coat-#\.webp"/.test(HTML), true, 'and so is the path pattern');
eq(/profile\/coat-frames\.js/.test(HTML) && /profile\/coat\.js/.test(HTML), true,
   'both scripts are loaded, maths before driver');
eq(HTML.indexOf('profile/coat-frames.js') < HTML.indexOf('profile/coat.js'), true,
   'in that order, since the driver returns early without the maths');

/* devicePixelRatio is capped: a phone reporting 3 would otherwise allocate nine times the
   canvas area for a difference nobody can see, on the device least able to afford it. */
eq(/Math\.min\(2, window\.devicePixelRatio/.test(JS), true, 'the canvas is capped at 2x');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
