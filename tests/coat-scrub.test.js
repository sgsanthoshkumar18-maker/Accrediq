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
/* The three stages are RENDERED into the page rather than typed into it, so the
   renderer is part of this section now: an assertion against founder.html alone would
   pass on a page whose copy never arrives. */
const FJS = fs.readFileSync(path.join(__dirname, '../profile/founder.js'), 'utf8');

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
ok(/var fits = \(cw \* FIG_MAX\) \/ \(iw \* FIG_W\);\s*\n\s*if \(s > fits\) s = fits;/.test(JS_CODE),
   'and the push-in is clamped by them, so a narrow column crops empty pixels not shoulders');
/* THE CLAMP IS A CEILING ON HIS WIDTH, NOT ON THE CANVAS, and that distinction was found
   by measuring a 1000x1200 window: fitted to the stage HEIGHT he came out 74% of the page
   wide and his shoulder finished eight thousandths of a page from the headline. Held under
   half the stage he cannot cross the middle, so there is always clear ground on the far
   side whichever station he is at — at every aspect ratio, not just the ones measured. */
ok(/FIG_MAX = 0\.50;/.test(JS), 'and he is never drawn wider than half the stage');
ok(parseFloat(/FIG_MAX = (0\.\d+);/.exec(JS)[1]) <= 0.5,
   'which is what keeps him off the copy column on a tall narrow window');
/* Fitted to HEIGHT, never "contained": contain in a half-width column fits to the width
   and leaves him small with air above and below — the opposite of what the column is for. */
ok(/var s = \(ch \/ ih\) \* k;/.test(JS_CODE), 'the image is fitted to the stage height');
/* He sits at 46.7% of the frame, so centring the image would leave him visibly off-centre. */
/* He sits at 46.7% of the frame, so centring the IMAGE would leave him visibly off-centre
   wherever the path puts him. The correction now rides alongside the travel term. */
ok(/\(0\.5 - FIG_CX\) \* w \+ \(here\.x - 0\.5\) \* cw/.test(JS_CODE),
   'and offset to his real centre, on top of wherever the journey has carried him');

/* ================== THE TIMELINE, RUN RATHER THAN READ ==================
 *
 * The pacing block is pure arithmetic with no DOM in it, so it can be lifted straight out
 * of the file and exercised. That is the only way to assert the thing that actually
 * matters here — that a paragraph is never on screen while the figure is moving. A regex
 * can confirm the numbers were typed; only running them confirms they do not overlap.
 *
 * This has already caught the bug it exists for. The first table put block two's fade-out
 * at 0.53 and started the second crossing at 0.52, so for a hundredth of the section the
 * words were sliding out while he was setting off underneath them — invisible at a glance,
 * and exactly what he asked not to happen. */
const TL = (() => {
  const a = JS.indexOf('  /* ========================= THE TIMELINE');
  const b = JS.indexOf('  /* ======================== THE ENERGY FIELD');
  if (a < 0 || b < a) throw new Error('timeline block not found in coat.js');
  return new Function(JS.slice(a, b) +
    '\nreturn { PHASES, BLOCKS, DIP, stateAt, blockAlpha, blockSide, isCrossing };')();
})();

/* ---- right, then left, then right ----
   The direction is the request, so it is asserted as a direction and not as six numbers:
   renaming the stations must not be able to quietly flip it. */
const XS = TL.PHASES.map((p) => p.x);
ok(XS[0] > 0.5, 'he forms on the RIGHT');
ok(Math.min.apply(null, XS) < 0.5, 'crosses to the left');
ok(XS[XS.length - 1] > 0.5, 'and ends back on the right');
eq(XS[0], XS[XS.length - 1], 'the two right-hand stations are the same place, not nearly');
eq(TL.PHASES.filter((p, i) => TL.isCrossing(i)).length, 2, 'exactly two crossings');

/* Monotonic, and it reaches the final pose. A table that ends at f 0.98 leaves the last
   nine frames of the render unseen, which is a whole second of animation nobody paid for. */
let phasesRise = true, prevTo = 0, prevF = 0;
TL.PHASES.forEach((ph) => {
  if (!(ph.to > prevTo) || ph.f < prevF) phasesRise = false;
  prevTo = ph.to; prevF = ph.f;
});
ok(phasesRise, 'the phases advance and the sequence never runs backwards inside one');
eq(TL.PHASES[TL.PHASES.length - 1].f, 1, 'and the last phase completes the turn');
ok(TL.PHASES[TL.PHASES.length - 1].to >= 1, 'with the table covering the whole runway');

/* ---- THE ONE THAT MATTERS: no copy on screen while he is moving ----
   Sampled densely across the whole section rather than at the boundaries, because a fade
   is a ramp and the overlap this is looking for is a sliver. */
let movingWithCopy = -1, twoAtOnce = -1;
for (let i = 0; i <= 4000; i++) {
  const p = i / 4000;
  const st = TL.stateAt(p);
  const alphas = TL.BLOCKS.map((_, k) => TL.blockAlpha(p, k));
  const lit = alphas.filter((a) => a > 0).length;
  if (st.moving && lit > 0 && movingWithCopy < 0) movingWithCopy = p;
  if (lit > 1 && twoAtOnce < 0) twoAtOnce = p;
}
eq(movingWithCopy, -1, 'no block is on screen at any scroll position where he is travelling');
eq(twoAtOnce, -1, 'and two blocks are never up together');

/* Every block does actually get its turn at full strength — the cheapest way to satisfy
   the test above is a schedule that shows nothing at all. */
TL.BLOCKS.forEach((b, k) => {
  const mid = (b[1] + b[2]) / 2;
  eq(TL.blockAlpha(mid, k), 1, 'block ' + (k + 1) + ' reaches full opacity');
  eq(TL.blockAlpha(0, k), 0, 'block ' + (k + 1) + ' is off at the top of the section');
});

/* ---- the pauses are long, and longer than the crossings ----
   His complaint was speed: "people should have at least one, two, three seconds to read
   it". Seconds cannot be asserted — a reader's scroll speed is theirs — but the share of
   the section spent standing still can be, and it is the thing that buys the seconds. */
let holdSpan = 0, crossSpan = 0, from = 0;
TL.PHASES.forEach((ph, i) => {
  const span = Math.min(1, ph.to) - from;
  if (span > 0) { if (TL.isCrossing(i)) crossSpan += span; else holdSpan += span; }
  from = Math.min(1, ph.to);
});
ok(holdSpan > crossSpan * 1.5, 'far more of the runway is spent standing still than travelling');
ok(/\.coat \{ min-height: (\d{3})vh; \}/.test(CSS), 'and the runway states its own height');
ok(parseInt(/\.coat \{ min-height: (\d{3})vh; \}/.exec(CSS)[1], 10) >= 500,
   'a long one — the pauses are the point, and they are only as long as the scroll is');
/* Each individual hold has to be worth stopping for, not just the total. */
let shortestHold = 1; from = 0;
TL.PHASES.forEach((ph, i) => {
  if (!TL.isCrossing(i) && i > 0) shortestHold = Math.min(shortestHold, Math.min(1, ph.to) - from);
  from = Math.min(1, ph.to);
});
ok(shortestHold > 0.12, 'and the shortest pause is still a real pause');

/* ---- the frame remap, and why it exists ----
   The renders join at frame 90 (a body appears) and frame 180 (a head does). Both joins
   must fall inside a crossing: a limb arriving while he stands still reads as a dropped
   frame, and no amount of lighting hides it. This is the assertion that makes the remap
   worth its complexity, so it is checked against the render's own numbers. */
[90 / 420, 180 / 420].forEach((join) => {
  let at = -1;
  for (let i = 0; i <= 20000 && at < 0; i++) {
    if (TL.stateAt(i / 20000).f >= join) at = i / 20000;
  }
  ok(at > 0, 'the sequence reaches frame ' + Math.round(join * 420));
  ok(TL.stateAt(at).moving,
     'and frame ' + Math.round(join * 420) + ' arrives while he is in motion, not mid-pause');
});

/* ---- the copy takes the side he is not on ----
   He no longer simply alternates: he ends where he began, so blocks one and three share a
   side. nth-child counting would have put the closing paragraph on his shoulder, which is
   why the side is derived from the station table instead. */
eq(TL.BLOCKS.map((_, k) => TL.blockSide(k)), ['left', 'right', 'left'],
   'left, right, left — always opposite the figure');
ok(/beats\[bi\]\.setAttribute\("data-side", blockSide\(bi\)\)/.test(JS_CODE),
   'and stamped onto the markup from that table, not written by hand');
ok(/\.coat-beat\[data-side="left"\]/.test(CSS) && /\.coat-beat\[data-side="right"\]/.test(CSS),
   'which is all the stylesheet needs to know');
eq(/\.coat-beat:nth-child/.test(CSS), false, 'nothing counts elements to decide a side any more');

/* ---- it still reverses exactly ----
   Everything on this stage is a function of scroll position and never of time, which is
   what lets a reader scrub back up and see the same thing they saw on the way down. */
let reverses = true;
for (let i = 0; i <= 1000; i++) {
  const p = i / 1000;
  const a = TL.stateAt(p), b = TL.stateAt(p);
  if (a.x !== b.x || a.f !== b.f || a.dip !== b.dip) reverses = false;
}
ok(reverses, 'the state is a pure function of scroll position');
/* And it is continuous: a jump in x is a teleport, which no easing can disguise. */
let biggestStep = 0, prev = TL.stateAt(0).x;
for (let i = 1; i <= 5000; i++) {
  const x = TL.stateAt(i / 5000).x;
  biggestStep = Math.max(biggestStep, Math.abs(x - prev));
  prev = x;
}
ok(biggestStep < 0.005, 'and moves continuously, with no jump between phases');

/* ---- the copy is scheduled, not laid out ----
   It used to be three blocks in flow, emphasised by whichever sat nearest the middle of
   the window — a second, independent notion of "where we are" that drifted from the
   figure's the moment either was edited. Both now read one number. */
eq(/function activeBeat\(/.test(JS_CODE), false, 'nothing measures a block against the viewport');
eq(/classList\.toggle\("is-on"/.test(JS_CODE), false, 'and nothing toggles a CSS transition');
ok(/beats\[i\]\.style\.opacity = a\.toFixed\(3\)/.test(JS_CODE),
   'the opacity is written from the scroll position, so it unwinds with the figure');
ok(/beats\[i\]\.style\.pointerEvents = a > 0\.5/.test(JS_CODE),
   'and invisible words cannot be selected');

/* ONE COPY OF THE STORY, NOT TWO. The three stages were typed into founder.html and also
   rendered into the lens below it from founder-data.js, so the figure crossed down into a
   card repeating what he had just said — the overlap in his screenshot. The markup now
   holds an empty node and both are built from the same array. */
eq(/data-beat/.test(HTML), false, 'the beats are no longer hard-coded in the page');
ok(/id="fCoatText"/.test(HTML), 'just the node they are rendered into');
ok(/coat\.innerHTML = F\.lens\.map/.test(FJS), 'and they come from the same lens data as the fallback');
ok(/el\("fLensSteps"\)\.innerHTML = F\.lens\.map/.test(FJS), 'which still renders too');
ok(/\.coat\[data-coat-ready="1"\] ~ \.fp-lens \{ display: none; \}/.test(CSS),
   'with the fallback hidden only once the figure is actually live');
/* Which is load-bearing, not tidiness: the coat section is display:none until a frame has
   decoded, so on a deploy without the renders the lens is the only copy of the content. */
ok(/\.coat\[data-coat-ready="1"\] \{ display: block; \}/.test(CSS),
   'and the figure hidden until it has something to show');
ok(/if \(!host\.querySelector\("\[data-beat\]"\)\) return;/.test(JS_CODE),
   'the first pass bails without latching, so the aq:content pass still gets the section');

/* ---- ONE PINNED LAYER, AND NO NEGATIVE MARGINS ----
   THIS IS THE ASSERTION FOR THE BUG THAT SHIPPED. The figure and the copy were two sibling
   sticky layers overlapped by margin-bottom: -100vh, and that margin quietly extended the
   pinning a full screen past the end of the section. A sticky box is constrained so its
   MARGIN box stays inside its containing block, and a -100vh bottom margin on a 100vh box
   makes that margin box zero-height — so the browser had no reason to release it. Measured
   at 1440x900: 800px past the foot of the runway the stage was still at viewport top while
   the next section had scrolled up to 100px, and the experience timeline printed itself
   across the figure's chest.

   Nothing about the effect was wrong; the layout trick holding it up was. One sticky
   wrapper with an honest margin box releases exactly at the end of the runway. The rule is
   therefore not 'two margins' but NO negative margin anywhere in the pinned structure —
   asserted as an absence, because that is the shape the bug took. */
eq(/margin(-bottom)?:\s*-\d/.test(CSS.replace(/\/\*[\s\S]*?\*\//g, '')), false,
   'nothing in the pinned structure is overlapped by a negative margin');
eq((CSS.replace(/\/\*[\s\S]*?\*\//g, '').match(/position: sticky/g) || []).length, 1,
   'and there is exactly one sticky box, so only one thing can overrun');
ok(/\.coat-pin \{[\s\S]*?position: sticky;[\s\S]*?height: 100vh;/.test(CSS),
   'the pin is one screen tall, which is what makes its release point the end of the runway');
/* Layer order is now plain z-index between two absolute siblings rather than a margin
   nobody can read: the stage paints behind, the copy over it. */
eq(HTML.indexOf('coat-stage') < HTML.indexOf('fCoatText'), true, 'the stage comes first in the DOM');
ok(/\.coat-stage \{[\s\S]*?position: absolute;[\s\S]*?z-index: 0;/.test(CSS), 'and paints behind');
ok(/\.coat-text \{[\s\S]*?position: absolute;[\s\S]*?z-index: 1;/.test(CSS), 'with the copy over it');
ok(/\.coat-text \{[\s\S]*?pointer-events: none;/.test(CSS),
   'the copy layer covers the viewport, so it must not swallow the page');

/* THE RELEASE POINT, DERIVED RATHER THAN TRUSTED. A sticky box of height H inside a
   containing block of height C stops being pinned once it has travelled C - H, and the
   scroll progress coat.js measures is (-r.top) / (r.height - innerHeight) — the same
   C - H. So with one un-margined 100vh pin the release lands exactly on prog 1, and the
   tableau scrolls away the instant the last block has been read. Both numbers come from
   the stylesheet, so this catches a runway height that stops agreeing with the pin. */
eq(/\.coat-pin \{[\s\S]*?height: 100vh;/.test(CSS) && /r\.height - window\.innerHeight/.test(JS_CODE),
   true, 'the pin releases on exactly the progress the script calls 1');

/* MEASURED IN THE SAME UNITS AS THE FIGURE, and this was a real bug on wide screens. The
   copy sat inside the site's centred column while the figure's position is a fraction of
   the full-bleed canvas: on a 2560px monitor the column's right edge is at about 76% of the
   glass and he stands at 72% of it, so the words landed on his shoulder on exactly the
   widest screens. Both now measure from the same edge. */
ok(/\.coat-beat \{[\s\S]*?width: min\(34vw, 460px\);/.test(CSS), 'the copy is sized in viewport units');
ok(/left: max\(28px, 6vw\)/.test(CSS) && /right: max\(28px, 6vw\)/.test(CSS),
   'and inset from the same edge the figure is placed against');
eq(/coat-copy[\s\S]{0,120}class="wrap"/.test(HTML), false,
   'not nested in the centred column, which is a different coordinate system');
/* Drawn, not laid out: translating the canvas element would move its backing store and
   repaint the whole stage every scroll frame for an identical result. */
ok(/\(here\.x - 0\.5\) \* cw/.test(JS_CODE), 'the travel is drawn onto a canvas that never moves');
ok(/function easeInOut/.test(JS_CODE),
   'and eased in and out, or a crossing reads as a jump cut rather than travel');

/* TWO PROGRESSES, AND SWAPPING THEM IS SILENT. `p` is how far the reader has scrolled and
   drives the shot — the push-in, the arrival, the smoke. `st.f` is how far he has turned
   and drives the render — the frame, his angle, the two joins. Pinning the frame to scroll
   would undo the whole remap and drop both joins inside a pause. */
ok(/want = F\.frameAt\(st\.f, n\);/.test(JS_CODE), 'the frame comes from the sequence progress');
ok(/var ang = st\.f \* Math\.PI \* 2;/.test(JS_CODE), 'so does his angle, so the dust turns with him');
ok(/flare\(st\.f\)/.test(JS_CODE), 'and so does the flare, or it fires nowhere near its join');
ok(/var k = reduce \? 1 : zoomAt\(p\);/.test(JS_CODE), 'while the camera push stays on the scroll');
ok(/var ARRIVE = PHASES\[0\]\.to;/.test(JS_CODE),
   'and the arrival ends exactly where the first phase does, rather than drifting into a pause');

/* ---- the unpinned layouts ----
   Under 900px and under reduced motion the stylesheet unpins everything and shows all
   three blocks at once. The script has to agree, or it keeps writing opacity 0 over copy
   the stylesheet has just made permanent and a phone shows three invisible paragraphs. */
ok(/window\.matchMedia\("\(max-width: 900px\)"\)/.test(JS_CODE),
   'the script reads the same breakpoint the stylesheet does');
ok(/if \(flat\(\)\) \{ beats\[i\]\.style\.opacity = ""/.test(JS_CODE),
   'and clears its inline opacity there rather than fighting the stylesheet');
ok(/var here = flat\(\) \? \{ x: 0\.5, dip: 0 \} : st;/.test(JS_CODE),
   'with the figure centred, since a 390px page has nowhere to travel');
ok(/@media \(max-width: 900px\)[\s\S]{0,700}position: static/.test(CSS),
   'no pinning and no travel on a phone');
ok(/@media \(max-width: 900px\)[\s\S]{0,900}opacity: 1/.test(CSS),
   'with every line readable at once rather than scheduled');
ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,900}opacity: 1/.test(CSS),
   'and the same for reduced motion');
/* A tall, narrow desktop window is the one shape where the columns can still meet: he is
   fitted to the stage HEIGHT, so a 1000x1200 window draws him three quarters of the page
   wide and reaches across into the copy. */
ok(/@media \(min-width: 901px\) and \(max-aspect-ratio: 1\/1\)/.test(CSS),
   'a tall narrow window pulls the copy in rather than letting them touch');


/* ===================== THE RIDER =====================
   When the section lets go he shrinks, drops to the middle, comes to the FRONT of the whole
   site and takes over the glowing head that rides down the experience timeline.

   Verified in a browser at 1440x900 against founder-motion.js's own head position: he sits
   within 7px horizontally of it for the entire ride, holds the reading line while the page
   scrolls past exactly as the head does, and stops at the foot of the line (delta -7,-7 at
   p=1) then scrolls away locked to it. The handover moves his painted box by at most 10px
   across 10px of scroll — which is the shrink, not a jump. */

const RIDER = (() => {
  const a = JS.indexOf('  /* ===================== THE RIDER');
  const b = JS.indexOf('  /* ======================== THE ENERGY FIELD');
  if (a < 0 || b < a) throw new Error('rider block not found in coat.js');
  /* ridePlace leans on the section's own constants, so they come along. */
  const consts = 'var ZOOM_TO = ' + /ZOOM_TO = ([\d.]+)/.exec(JS)[1] + ';' +
                 'var PAN_TO = ' + /PAN_TO = ([\d.]+)/.exec(JS)[1] + ';' +
                 'var FIG_W = ' + /FIG_W = ([\d.]+)/.exec(JS)[1] + ';' +
                 'var FIG_CX = ' + /FIG_CX = ([\d.]+)/.exec(JS)[1] + ';' +
                 'var FIG_MAX = ' + /FIG_MAX = ([\d.]+)/.exec(JS)[1] + ';' +
                 'var PHASES = ' + JSON.stringify(TL.PHASES) + ';' +
                 'function easeInOut(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}';
  return new Function(consts + JS.slice(a, b) +
    '\nreturn { ridePlace, rideHeight, READ_LINE, rideTumble, rideSwing, rideDepth, rideFrame, rideSpin, TURN_LO };')();
})();

/* THE READING LINE IS ONE NUMBER LIVING IN TWO FILES, and that is the thing most likely to
   break here. founder-motion.js fills the spine against a line 45% down the viewport; the
   rider reproduces that path from the same figure. Change one and he drifts off the line he
   is supposed to be replacing — silently, because both still look plausible alone. */
const FMOTION = fs.readFileSync(path.join(__dirname, '../profile/founder-motion.js'), 'utf8');
eq(RIDER.READ_LINE, 0.45, 'the rider measures against the reading line');
ok(/var read = vh \* 0\.45;/.test(FMOTION), 'and founder-motion.js fills the spine against the same one');

/* t = 0 MUST REPRODUCE THE SECTION EXACTLY, or the handover is a jump. The fixed layer
   starts by painting the identical picture the sticky one was painting — same scale, same
   centre — and only then moves it. There is no crossfade to hide a mismatch behind. */
const VW = 1440, VH = 900;
const sec = RIDER.ridePlace(0, VW, VH, 713, 405);
const h0 = Math.min(VH * 1.20, (VW * 0.50) / 0.62);
eq(Math.round(sec.h), Math.round(h0), 'at handover he is exactly the size the section had him');
/* The last station is where the phase table leaves him, not a number typed twice. */
const lastX = TL.PHASES[TL.PHASES.length - 1].x;
const expectX = (VW - h0) / 2 + (0.5 - 0.467) * h0 + (lastX - 0.5) * VW + h0 * 0.467;
eq(Math.round(sec.cx), Math.round(expectX), 'and standing exactly where the last station left him');

/* t = 1 is the spine head, wherever that has been measured to be. */
const rid = RIDER.ridePlace(1, VW, VH, 713, 405);
eq([Math.round(rid.cx), Math.round(rid.cy)], [713, 405], 'and at the end of the handover he IS the head');
eq(Math.round(rid.h), Math.round(RIDER.rideHeight(VH)), 'shrunk to the riding size');
ok(RIDER.rideHeight(VH) < VH * 0.2, 'which is a token on the line, not a man standing on it');
/* Monotonic: he shrinks the whole way in, never swelling back out mid-fall. */
let shrinks = true, prevH = RIDER.ridePlace(0, VW, VH, 713, 405).h;
for (let i = 1; i <= 100; i++) {
  const hh = RIDER.ridePlace(i / 100, VW, VH, 713, 405).h;
  if (hh > prevH + 0.001) shrinks = false;
  prevH = hh;
}
ok(shrinks, 'and shrinks monotonically rather than pulsing on the way down');

/* ---- HE TUMBLES; HE DOES NOT FLIP ----
   The first version turned him with a horizontal squash — the standard two-dimensional
   coin flip — and it read as exactly what it was: a flat cutout being squeezed. A squash is
   the one transform that tells the eye there is no depth, because a solid object turning
   never loses width without also changing what you can see of it. Three things replace it,
   and the frame sweep is the one that actually carries the third dimension. */
eq(/c\.scale\(sx, 1\)/.test(JS_CODE), false, 'nothing squashes him horizontally any more');
ok(/c\.rotate\(rideTumble\(t, p\)\)/.test(JS_CODE),
   'the sprite fallback rotates in the picture plane — head over heels, like a piece knocked over');
ok(/c\.scale\(depth, depth\)/.test(JS_CODE), 'and reads nearer and further through the turn');
ok(/F\.frameAt\(rideFrame\(t, p\), n\)/.test(JS_CODE),
   'sweeping the rendered turn, which is the most a flat sprite can do');

/* ---- AND ABOVE IT, THE REAL THING ----
   A turntable render turns about ONE axis. It is a carousel: you can walk around the
   subject but you can never see the top of his head, because no such frame was ever
   rendered. So the sprite above is the best a flat image can do, and it is still flat.
   Measured on the actual model: 90 degrees of pitch renders a 48x27 silhouette where the
   standing figure is 55x88 — he is lying flat, seen from above, and there is no frame in
   the 420 that contains that picture.

   Confirmed in the browser on the live page, WebGL canvas only, sampled down the ride:
   12x21 upright at the top, 18x15 lying flat at 30%, 9x19 upright again at 60%, 18x16 flat
   at 80%, 13x21 standing at the foot. The aspect ratio inverting and recovering IS the
   tumble; a flat sprite cannot produce that sequence at any scale. */
ok(/rideSpin\(t, p\)/.test(JS_CODE), 'the model is driven by a three-axis spin');
ok(/rx: \(HANDOFF_TUMBLE \* t \+ TUMBLE_X \* p\)/.test(JS_CODE), 'with pitch dominant, the way a piece knocked over falls');
/* Coprime turn counts, so no two attitudes on the way down are the same. */
const TX = +/TUMBLE_X = (\d+)/.exec(JS)[1], TY = +/TUMBLE_Y = (\d+)/.exec(JS)[1], TZ = +/TUMBLE_Z = (\d+)/.exec(JS)[1];
ok(TX > TY && TY >= TZ, 'pitch turns fastest, so it reads as falling rather than as spinning on the spot');
/* The same end condition as everything else here: upright when it matters. */
['rx', 'ry', 'rz'].forEach((ax) => {
  const atHandover = RIDER.rideSpin(1, 0)[ax] / (Math.PI * 2);
  const atFoot = RIDER.rideSpin(1, 1)[ax] / (Math.PI * 2);
  eq(atHandover, Math.round(atHandover), ax + ' is a whole number of turns at the end of the handover');
  eq(atFoot, Math.round(atFoot), ax + ' is a whole number of turns at the foot of the line');
});
eq([RIDER.rideSpin(0, 0).rx, RIDER.rideSpin(0, 0).ry, RIDER.rideSpin(0, 0).rz], [0, 0, 0],
   'and every axis starts at rest, so the handover does not begin with a jolt');

/* THE FALLBACK IS NOT A FORMALITY. This is the only thing on the site needing WebGL and a
   third-party CDN, so a blocked script, an old browser or a machine with no GPU has to land
   somewhere sensible — the flatter sprite, not a hole in the page. The module is loaded
   separately and as a module precisely so that its failure is silent and isolated. */
ok(/var drew3d = three && three\.ready && three\.draw\(/.test(JS_CODE),
   'the model is asked, never assumed');
ok(/if \(!drew3d\) \{/.test(JS_CODE), 'and the sprite draws when it is not there');
ok(/<script type="module" src="profile\/coat-3d\.js/.test(HTML), 'the 3D renderer is a module');
ok(/<script type="importmap">/.test(HTML), 'with an import map rather than a build step');
const T3 = fs.readFileSync(path.join(__dirname, '../profile/coat-3d.js'), 'utf8');
ok(/api\.ready = false;/.test(T3), 'a model that will not load leaves ready false');
ok(/catch \(e\) \{ api\.ready = false; \}/.test(T3), 'and a renderer that will not start does too');

/* THE LIGHTING FIX, WHICH HE HAS ALREADY BEEN BITTEN BY ONCE IN BLENDER.
   A physically based material shows what it REFLECTS, so given nothing to reflect it
   renders as dark mud however many lamps are aimed at it — which is exactly the "why is
   there no colour in my 3D model" problem from the render pass. Measured here: lights
   alone gave the figure a median luminance of 61 and the white coat read as slate; with a
   room to reflect it is 207 and the coat peaks at 248. */
ok(/RoomEnvironment/.test(T3), 'the model has an environment to reflect, not just lights');
ok(/ACESFilmicToneMapping/.test(T3), 'and filmic tone mapping, so the white coat stays white');

/* One world unit is one CSS pixel at the model's depth, so coat.js hands over a position in
   screen coordinates and never has to know any 3D. Perspective, not orthographic: with no
   perspective a tumbling object has no near edge and flattens back into the cutout this
   whole change exists to stop. */
ok(/PerspectiveCamera/.test(T3), 'a perspective camera, so the tumble has depth');
ok(/cam\.fov = 2 \* Math\.atan\(h \/ 2 \/ dist\)/.test(T3),
   'solved so that one world unit is one CSS pixel, and coat.js can stay in screen space');
/* The model is centred on its own bounding box before anything rotates it — the same
   problem FIG_CX solves for the sprite. Rotating about an exporter's origin is an orbit. */
ok(/root\.position\.sub\(box\.getCenter/.test(T3), 'and centred on itself, so it tumbles rather than orbits');
/* Rotated about the figure, not the frame: the renders put him at 46.7% of a square canvas,
   so turning about the canvas centre would swing him round a point off to his side. */
ok(/c\.translate\(gx, gy\);[\s\S]{0,120}c\.rotate/.test(JS_CODE), 'about his own centre, so it is a tumble and not an orbit');

/* THE SAFETY PROPERTY, AND THE ONLY REASON THE SWEEP IS A SWEEP.
   The complete figure exists only from frame 181 of 420. If the frame index ever dips below
   that while he is riding, the EMPTY COAT reappears halfway down the timeline — a bug that
   would look like a rendering fault rather than a maths one. Checked across the whole
   two-dimensional space of handover and ride progress, not just at the ends. */
let below = 0, above = 0;
for (let i = 0; i <= 120; i++) for (let j = 0; j <= 120; j++) {
  const f = RIDER.rideFrame(i / 120, j / 120);
  if (f < RIDER.TURN_LO - 1e-9) below++;
  if (f > 1 + 1e-9) above++;
}
eq([below, above], [0, 0], 'the frame sweep never leaves the range where the whole man exists');
eq(+RIDER.rideFrame(0, 0).toFixed(6), 1,
   'and starts on the exact frame the section ends on, so the handover stays invisible');
/* It must actually sweep, or the "rendered turn" is a still image with a rotation on it. */
let lo = 1, hi = 0;
for (let j = 0; j <= 400; j++) { const f = RIDER.rideFrame(1, j / 400); if (f < lo) lo = f; if (f > hi) hi = f; }
ok(hi - lo > 0.5, 'and sweeps most of that range, so the geometry visibly turns as he falls');

/* ---- HE LANDS UPRIGHT, AND ON THE LINE ----
   Every constant is a whole number for one reason: at the end of the handover and at the
   foot of the line the tumble is back to zero and the swing is back on centre. He leaves
   the handover standing and lands standing, exactly on the point where the line stops —
   rather than frozen mid-topple beside it, which is what any fractional count would give. */
const turnsAtHandover = RIDER.rideTumble(1, 0) / (Math.PI * 2);
const turnsAtFoot = RIDER.rideTumble(1, 1) / (Math.PI * 2);
eq(turnsAtHandover, Math.round(turnsAtHandover), 'a whole number of turns by the end of the handover');
eq(turnsAtFoot, Math.round(turnsAtFoot), 'and a whole number by the foot of the line');
ok(turnsAtFoot - turnsAtHandover >= 2, 'with real tumbling in between, not a token half-turn');
ok(Math.abs(RIDER.rideSwing(1, 1)) < 1e-9, 'and he lands ON the line, not beside it');
ok(Math.abs(RIDER.rideSwing(0, 0)) < 1e-9, 'having started on it too, so the handover does not jog sideways');

/* ---- AND HE FALLS DIAGONALLY, NOT STRAIGHT DOWN ----
   A rigid vertical slide was the other half of what made it look like a sprite on rails.
   He swings across the line on the way down, so the fall reads as diagonal — but the swing
   is a fraction of the viewport, not of the timeline, so it cannot grow into a lurch on a
   wide monitor. */
let swung = 0;
for (let j = 0; j <= 400; j++) swung = Math.max(swung, Math.abs(RIDER.rideSwing(1, j / 400)));
ok(swung > 0.03, 'he crosses the line rather than sliding down it');
ok(swung < 0.12, 'by enough to read as a fall, not so much that he leaves the column');
/* Both directions: a swing that only ever goes one way is a drift, not a fall. */
let left = false, right = false;
for (let j = 0; j <= 400; j++) { const v = RIDER.rideSwing(1, j / 400); if (v < -0.02) left = true; if (v > 0.02) right = true; }
ok(left && right, 'and crosses to BOTH sides of it on the way down');
/* Depth stays positive, or a negative scale would mirror him mid-fall. */
let minDepth = 9;
for (let i = 0; i <= 60; i++) for (let j = 0; j <= 60; j++) minDepth = Math.min(minDepth, RIDER.rideDepth(i / 60, j / 60));
ok(minDepth > 0.5, 'and never turns inside out through the depth change');

/* IN FRONT OF THE PAGE, BUT NOT IN THE WAY. Above the sticky header so he genuinely passes
   in front of the site; below the search overlay and the modals so he can never sit on top
   of something a reader is trying to use; and never taking a click, or a full-screen fixed
   layer would swallow every card he passes over. */
const riderZ = +/\.coat-rider \{[\s\S]*?z-index: (\d+);/.exec(CSS)[1];
ok(riderZ > 60, 'the rider is above the sticky site header');
ok(riderZ < 200, 'and below the search overlay and the modals');
ok(/\.coat-rider \{[\s\S]*?position: fixed;/.test(CSS), 'fixed, so it escapes its own section');
ok(/\.coat-rider \{[\s\S]*?pointer-events: none;/.test(CSS), 'and never swallows a click');
ok(/\.coat-rider \{[\s\S]*?display: none;/.test(CSS) && /\.coat-rider\[data-on="1"\] \{ display: block; \}/.test(CSS),
   'hidden until he is actually riding, so it is not a permanent sheet over the page');

/* He replaces the HEAD, not the line: the drawn line becomes the trail behind him. */
ok(/\.fp-timeline\[data-ridden="1"\] \.fp-spine::after \{ opacity: 0; \}/.test(CSS),
   'the blue head goes while he is doing its job');
eq(/\[data-ridden="1"\] \.fp-spine \{/.test(CSS), false, 'but the line itself stays, as his trail');
ok(/ride\.setAttribute\("data-ridden", "1"\)/.test(JS_CODE) && /ride\.removeAttribute\("data-ridden"\)/.test(JS_CODE),
   'and comes back the moment he is not');

/* ONE OF THEM DRAWS HIM, NEVER BOTH. At the handover they occupy the same pixels, so
   leaving the section painting would show two men for the screen it takes to scroll away. */
ok(/if \(riderUpdate\(\)\) \{/.test(JS_CODE), 'the rider is asked first');
ok(/ctx\.clearRect\(0, 0, canvas\.width, canvas\.height\); drawn = -2;/.test(JS_CODE),
   'and the section canvas is cleared while he has him');
/* Verified in the browser: sectionInk was false at every scroll position the rider was on. */

/* Unpinned layouts get none of it — there is no moment of letting go to hand over at. */
ok(/if \(flat\(\) \|\| reduce \|\| !ride\) \{ riderHide\(\); return false; \}/.test(JS_CODE),
   'no rider on a phone or under reduced motion');
ok(/@media \(max-width: 900px\), \(prefers-reduced-motion: reduce\) \{\s*\.coat-rider \{ display: none !important; \}/.test(CSS),
   'and the stylesheet agrees, so the blue head keeps its job there');

/* ---- no band, no box ----
   The section used to be a full-bleed near-black panel. It made the figure easy to light
   and announced itself as a separate thing bolted onto the page, so it is gone: the figure
   now stands on the site's own background in both themes. */
ok(/\.coat \{[\s\S]{0,200}background: transparent;/.test(CSS), 'the section has no background of its own');
eq(/coat-vignette/.test(HTML), false, 'and no vignette panel remains in the markup');
eq(/--coat-ink:/.test(CSS), false, 'nor a private text palette — the copy follows the page');
/* Which means the copy MUST take the page's own tokens now, or a light-theme reader gets
   pale text on white. The h2 still states its colour, because styles.css gives every h2 its
   own rule and an element's own rule beats anything inherited. */
ok(/\.coat-beat h2 \{[\s\S]*?color: var\(--fg\);/.test(CSS), 'the headline states var(--fg)');
ok(/\.coat-beat p \{[\s\S]*?color: var\(--fg-muted\)/.test(CSS), 'and the body copy var(--fg-muted)');

/* ---- the rim is load-bearing on light ----
   MEASURED, and this is the whole argument: a white lab coat on the light theme's white
   page is 1.04:1. Not subtle — invisible. The blue rim is the only thing drawing the
   silhouette, so it is tighter and stronger there, and it uses the site's own accent
   (#2743C9, 7.24:1 on white) rather than the pale glow that suited black and measures
   2.45:1 here. */
ok(/--coat-aura: #2743C9;/.test(CSS), 'light theme uses the site accent for the rim');
ok(/:root\[data-theme="dark"\] \.coat \{[\s\S]*?--coat-aura: #7C9CFF;/.test(CSS),
   'dark theme keeps the pale glow that suits a black page');
ok(/--coat-halo-alpha: 0\.55;/.test(CSS) && /--coat-halo-alpha: 0\.34;/.test(CSS),
   'and the rim is stronger on light than on dark');
/* Read from CSS, not hard-coded: these are design decisions, and a design decision inside
   a script is one nobody can change without a deploy. */
ok(/function readSkin/.test(JS_CODE), 'the script reads the palette from the stylesheet');
ok(/attributeFilter: \["data-theme"\]/.test(JS_CODE),
   'and re-reads it when the theme changes, since the page can switch while open');

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
/* LIGHTNING IS GONE and must not come back. It looked artificial and always would have:
   drawn marks with hard edges sit ON a photoreal render rather than belonging to it. Dust
   has no shape to get wrong, so a viewer reads it as air. */
eq(/BOLTS/.test(JS_CODE), false, 'no lightning arcs remain');
ok(/MOTES = \d+;/.test(JS), 'the field is drifting dust instead');
ok(/moteSprite/.test(JS_CODE),
   'stamped from one pre-rendered sprite, not a gradient rebuilt per mote per frame');

/* ================= the arrival ================= */

/* THE DISSOLVE MASK IS GONE, and its failure is the reason for this test. It revealed him
   through a per-pixel THRESHOLD computed at 132x198 and scaled up. A hard threshold has no
   intermediate values to interpolate, so enlarging it produced chunky square blocks — it
   read as a corrupted JPEG, not a formation. Nothing here may reintroduce one. */
eq(/revealField|buildMask|createImageData/.test(JS_CODE), false,
   'no per-pixel threshold mask — that is what produced the blocky artefact');
ok(/function smokeAt/.test(JS_CODE), 'he arrives out of a puff of smoke instead');
ok(/function zoomAt/.test(JS_CODE), 'growing from a speck, in two zoom stages');
ok(/ZOOM_TINY = 0\.\d+/.test(JS), 'with a declared starting size');
/* Only opacity and scale are in play, both continuous, so there is nothing to pixelate. */
ok(/function figureAlpha/.test(JS_CODE), 'and fades up by opacity, never by a mask');
/* Rotation is not paused for the arrival, or the opening reads as a still image being
   faded in. Asserted against the table as well as the source line, because the frame
   index no longer tracks the scroll: what matters is that the sequence has actually
   advanced by the time he is solid, not that some expression mentions an angle. */
ok(/var ang = st\.f \* Math\.PI \* 2;/.test(JS_CODE), 'his angle comes from the sequence progress');
ok(TL.stateAt(TL.PHASES[0].to / 2).f > 0, 'and he is already turning halfway through forming');
ok(TL.stateAt(TL.PHASES[0].to).f * 420 > 15,
   'with a real arc of the turn behind him by the time he is solid');

/* ================= the head fades in ================= */

/* Frame 180 has no head and 181 does, so untreated the head arrives in one frame. The
   flare covered the moment but not the fact — it still read as a pop. */
ok(/HEAD_AT = 180 \/ 420;/.test(JS), 'the head handover is declared');
ok(/function headAlpha/.test(JS_CODE), 'and the head fades up across a scroll window');
/* THE FIX THAT ACTUALLY WORKED, after one that did not. Drawing the two halves straight
   onto the stage at different opacities left the pop in place, because the HALO is built by
   blurring the figure and was reading the raw frame — head included, at full strength —
   behind it. Composing once means halo, spill and figure all read the same picture and none
   of them can know about a head that has not arrived. */
ok(/function figureFor/.test(JS_CODE), 'the faded figure is composed once');
ok(/drawField\(ctx, shown,[^)]*"halo"\)/.test(JS_CODE), 'and the halo reads from it');
ok(/drawField\(ctx, shown,[^)]*"spill"\)/.test(JS_CODE), 'as does the light spill');
/* A gradient, not a threshold — the same rule the dissolve broke. */
ok(/createLinearGradient/.test(JS_CODE), 'the neck join is a gradient, so it cannot band');
/* The common case must cost nothing: no offscreen work once the head is fully there. */
ok(/if \(ha >= 1\) return img;/.test(JS_CODE),
   'and a fully-arrived head skips the offscreen composition entirely');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
