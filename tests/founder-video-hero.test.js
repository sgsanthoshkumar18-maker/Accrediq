/* THE FOUNDER HERO: HE WORKS AT HIS LAPTOP, AND HE WAVES WHEN YOU CLICK HIM.
 * That is the whole of it. The things this file guards are the ones that were
 * got wrong at least once each, and every one of them is invisible in the
 * source unless you already know what you are looking at.
 *
 * 1. THE CURSOR TRACKING, WHICH IS GONE ON PURPOSE. He used to turn his head
 *    toward the pointer, driven by 28 stills ordered by measured head angle. It
 *    never read as a person looking at you: the poses came from a clip never
 *    shot for it, so the angles were narrow and unevenly spread, and between
 *    any two of them his shoulders and hands jumped, because only the head had
 *    been matched. It was removed rather than tuned again. These checks exist
 *    so it does not creep back in — a stray pointermove handler on the stage
 *    would make him twitch, and a reinstated frame strip would put half a
 *    megabyte back on the page for nothing.
 *
 * 2. THE BLACK FLASH. Earlier builds stacked a <video>, an <img> and another
 *    <video> and cross-faded their CSS opacity. While two layers are each part
 *    transparent, whatever is behind shows through the middle of the blend —
 *    and behind them is the page. Everything is now drawn into one canvas,
 *    outgoing picture first and incoming over the top of it, so the surface is
 *    never showing less than one complete image.
 *
 * 3. AN OPAQUE CANVAS. getContext("2d", {alpha:false}) starts the canvas as
 *    solid BLACK. That reintroduces the exact flash the canvas was adopted to
 *    remove, in the window before the first draw and anywhere the draw loop
 *    cannot run. Transparent means the poster underneath shows instead.
 *
 * 4. THE GREETING THAT PLAYED INVISIBLY. Seeking to 0 drops readyState below 2,
 *    so a build that waited for 'loadeddata' waited forever — that event fires
 *    during preload and never fires twice. It played through to the end with
 *    sound and no picture.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'founder.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'profile/hero-video.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'profile/hero-video.js'), 'utf8');
/* Comments in that file name the very mistakes these checks look for — one
   spells out "alpha:false" in a warning never to use it, and the header
   describes the tracking at length. Matching against the raw text therefore
   finds the warning rather than the bug, so assertions about what the CODE does
   run against the code with comments stripped. */
const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

console.log('founder video hero');

/* ---------- the pieces ---------- */

check('the two clips and the still are on disk', () => {
  ['idle.mp4', 'wave.mp4', 'poster.webp'].forEach(f => {
    const p = path.join(ROOT, 'profile/hero', f);
    ok(fs.existsSync(p), 'profile/hero/' + f + ' is missing');
    ok(fs.statSync(p).size > 2000, 'profile/hero/' + f + ' is suspiciously small');
  });
});

check('the whole hero stays small enough for hospital wifi', () => {
  const dir = path.join(ROOT, 'profile/hero');
  const total = fs.readdirSync(dir)
    .map(f => path.join(dir, f))
    .filter(p => fs.statSync(p).isFile())
    .reduce((n, p) => n + fs.statSync(p).size, 0);
  ok(total < 4 * 1024 * 1024,
     'the hero totals ' + (total / 1048576).toFixed(1) + 'MB, over the 4MB ceiling');
});

check('the page mounts the stage, the script and the sound switch', () => {
  ok(/id="fpVideo"/.test(html), 'the video stage is gone from founder.html');
  ok(/hero-video\.js/.test(html), 'hero-video.js is not linked');
  ok(/hero-video\.css/.test(html), 'hero-video.css is not linked');
  ok(/id="fpvSound"/.test(html), 'the sound switch is missing');
});

/* ---------- failure mode 1: the cursor tracking coming back ---------- */

check('the head-turn frame strip is gone, and stays gone', () => {
  ok(!fs.existsSync(path.join(ROOT, 'profile/hero/track')),
     'the frame strip is back on disk; that is ~half a megabyte serving an effect ' +
     'that was removed because the footage could not support it');
  ok(!/frames\.json/.test(code), 'the frame manifest is being fetched again');
  ok(!/track\//.test(code), 'the frame strip is being requested again');
});

check('nothing on the stage reacts to the pointer moving', () => {
  ok(!/nearestFrame|tgtYaw|curYaw|tgtPitch|curPitch/.test(code),
     'the head-angle lookup is back; he will twitch between mismatched poses');
  /* pointermove is legitimate in exactly ONE place: the list of first-gesture
     events that unblocks autoplay when the browser refuses it outright. Any
     other occurrence is a handler steering him by the cursor. */
  const moves = code.match(/pointermove/g) || [];
  ok(moves.length <= 1,
     moves.length + ' references to pointermove; only the autoplay-unblock list may have one');
  ok(!/addEventListener\(\s*["']pointermove["']/.test(code),
     'something listens for pointermove directly — he is being steered by the cursor again');
  ok(!/pointerleave/.test(code),
     'a pointerleave handler is back; it only existed to return him from tracking');
});

/* ---------- failure mode 2 and 3: black ---------- */

check('everything is drawn into one canvas, not stacked as fading layers', () => {
  ok(/createElement\("canvas"\)/.test(js), 'there is no canvas; layers are being stacked again');
  ok(/\.fpv-canvas/.test(css), 'the canvas has no rule');
  ok(!/\.fpv-clip/.test(css), 'the old stacked-layer rules are still in the stylesheet');
});

check('the canvas is transparent, never an opaque black surface', () => {
  ok(!/alpha:\s*false/.test(code),
     'the canvas context is opaque; it starts BLACK and shows as a flash before the ' +
     'first draw and anywhere the draw loop cannot run');
});

check('the outgoing picture is drawn before the incoming one, every frame', () => {
  /* Order is the whole mechanism: laying the old picture down whole and then
     drawing the new one over it at a rising alpha is what leaves no gap. */
  const f = js.match(/function frame\([\s\S]*?\n    \}/);
  ok(f, 'the draw loop is gone');
  const shownAt = f[0].indexOf('paint(shown, 1)');
  const incomingAt = f[0].indexOf('paint(incoming');
  ok(shownAt > -1 && incomingAt > -1 && shownAt < incomingAt,
     'the incoming picture is drawn before the outgoing one, or not over it at all');
});

check('a poster is on the stage under the canvas, so it is never empty', () => {
  ok(/backgroundImage[\s\S]{0,60}poster/.test(js),
     'no poster is set behind the canvas; before the first draw the stage is bare');
});

/* ---------- failure mode 4: the invisible greeting ---------- */

check('the greeting switches picture without waiting on a readiness event', () => {
  const g = code.match(/function greet\([\s\S]*?\n    \}/);
  ok(g, 'the greeting is gone');
  ok(/switchTo\(wave\)/.test(g[0]), 'the greeting never switches the canvas to the wave clip');
  ok(!/loadeddata[\s\S]{0,80}wave|wave[\s\S]{0,120}loadeddata/.test(g[0]),
     "the greeting waits on 'loadeddata' again — the seek to 0 drops readyState below 2 " +
     'and that event has already fired during preload, so it plays with no picture');
});

check('clicking him or his name is the only thing that sets him waving', () => {
  ok(/root\.addEventListener\("click", greet\)/.test(code),
     'clicking the stage no longer greets');
  ok(/fpvNameHit/.test(code) && /hit\.addEventListener\("click", greet\)/.test(code),
     'clicking his name no longer greets');
  ok(/id="fpvNameHit"/.test(html), 'the name hit-target is missing from the page');
});

check('the greeting ends once, and cannot leave him waving for good', () => {
  /* Every click used to add another 'ended' handler without removing the old
     ones, so the second greeting was cut short by the first one's listener. */
  ok(/removeEventListener\("ended", done\)/.test(code),
     "the 'ended' listener is never removed; repeat greetings cut each other short");
  ok(/setTimeout\(done/.test(code),
     "nothing backstops a missing 'ended' event; a decode error leaves him waving forever");
  ok(/greeting = false/.test(code), 'the greeting never clears its own flag');
});

check('the page copy tells the visitor to click, since nothing else responds', () => {
  const hint = html.match(/class="fpv-hint"[\s\S]*?<\/p>/);
  ok(hint, 'the hint line is gone');
  ok(/Click/i.test(hint[0]),
     'the hint no longer tells the visitor to click; with tracking removed, a click ' +
     'is the only thing on this stage that does anything');
  ok(!/move|hover|cursor/i.test(hint[0].replace(/<[^>]*>/g, '')),
     'the hint still promises a cursor reaction that was removed');
});

/* ---------- sizing and cost ---------- */

check('the canvas is sized from the box, when the box actually changes', () => {
  /* Reading the rect during init catches the stage mid-layout — it pinned the
     canvas at one pixel wide, and nothing resized afterwards to correct it. */
  ok(/ResizeObserver/.test(js),
     'the canvas size is only taken at init and on window resize; it will be measured ' +
     'mid-layout and stay wrong');
});

check('the hero is measured in svh and allows for what sits above it', () => {
  ok(/min-height\s*:\s*calc\(100svh/.test(css), 'the hero height is not measured from 100svh');
  ok(/--fpv-top/.test(css), 'the hero does not subtract how far down the page it starts');
  ok(!/min-height\s*:\s*(calc\()?100vh\b/.test(css),
     'the hero uses vh; on a phone that leaves a band of dead ground beneath it');
});

check('the canvas is only redrawn when the picture has actually changed', () => {
  /* Redrawing a full-screen picture every frame regardless is what made the
     page hang. With him paused in a background tab this must cost nothing. */
  ok(/if \(!dirty\)/.test(code), 'the draw loop redraws unconditionally');
  ok(/Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/.test(code),
     'the device pixel ratio is uncapped; at 2 a full-screen canvas is ~3400x2000');
});

/* ---------- sound and fallbacks ---------- */

check('only the greeting can make sound, and the choice is remembered', () => {
  /* Muting happens where the elements are built, so this follows the builder
     rather than a variable name that may be refactored away. */
  ok(/function mkVideo/.test(code) && /\.muted\s*=\s*true/.test(code),
     'the clips are not muted at creation — an autoplaying idle with sound is blocked ' +
     'by the browser, and hostile if it were not');
  ok(/aq-hero-sound/.test(js) && /localStorage/.test(js), 'the sound choice is not remembered');
  ok(/wave\.muted\s*=\s*!soundOn\(\)/.test(js), 'the greeting does not honour the sound switch');
  ok(/stopPropagation/.test(code),
     'the sound switch does not stop its click reaching the stage, so changing the ' +
     'sound also sets him waving');
});

check('reduced motion gets one still, and touch is no longer shut out', () => {
  ok(/prefers-reduced-motion/.test(code), 'reduced motion is not honoured');
  /* The hover gate existed only to spare phones a cursor effect they could not
     drive. The greeting is a TAP, so a phone can have the whole thing. */
  ok(!/hover:\s*hover/.test(code),
     'touch devices are still cut down to a static image, but the only interaction ' +
     'left on this stage is a click, which a phone can do');
  const early = code.indexOf('fpv-still');
  const firstVideo = code.indexOf('createElement("canvas")');
  ok(early > -1 && firstVideo > -1 && early < firstVideo,
     'the still fallback is set up after the canvas and clips; a reduced-motion ' +
     'visitor would download them all anyway');
});

check('the copy sits on its own surface rather than trusting the video', () => {
  const left = css.match(/\.fpv-left\s*\{([^}]*)\}/);
  ok(left, '.fpv-left has no rule');
  ok(/background\s*:/.test(left[1]),
     'the copy column has no background; contrast would depend on which frame is showing');
});

console.log('\n' + (fail ? fail + ' failing, ' : '') + pass + ' passing');
process.exit(fail ? 1 : 0);
