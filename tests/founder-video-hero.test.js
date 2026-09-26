/* THE FOUNDER HERO FOLLOWS THE CURSOR. THREE THINGS BREAK IT, ALL INVISIBLE
 * IN THE SOURCE UNLESS YOU KNOW WHAT YOU ARE LOOKING AT.
 *
 * 1. THE BLACK FLASH. Earlier builds stacked a <video>, an <img> and another
 *    <video> and cross-faded their CSS opacity. While two layers are each part
 *    transparent, whatever is behind shows through the middle of the blend —
 *    and behind them is a black page. Assigning a new src to an <img> can also
 *    leave it with nothing to paint for a frame, and a blank <img> at full
 *    opacity is a black rectangle. Everything is now drawn into one canvas,
 *    outgoing picture first and incoming over the top of it, so the surface is
 *    never showing less than one complete image.
 *
 * 2. AN OPAQUE CANVAS. getContext("2d", {alpha:false}) starts the canvas as
 *    solid BLACK. That reintroduces the exact flash the canvas was adopted to
 *    remove, in the window before the first draw and anywhere the draw loop
 *    cannot run. Transparent means the poster underneath shows instead.
 *
 * 3. HIM LOOKING THE WRONG WAY. The strip is ordered by measured head angle,
 *    not by timestamp, and it is NOT symmetrical — the clip sweeps from his
 *    full left profile round to the front and barely past it, so "facing the
 *    camera" is index 14 of 20. Mapping the cursor linearly across all 21
 *    frames puts front in the wrong place and his gaze sits permanently off to
 *    one side, which is exactly what it did.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'founder.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'profile/hero-video.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'profile/hero-video.js'), 'utf8');
/* Comments in that file name the very mistakes these checks look for — one
   spells out "alpha:false" in a warning never to use it. Matching against the
   raw text therefore finds the warning rather than the bug, so assertions about
   what the CODE does run against the code with comments stripped. */
const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

console.log('founder video hero');

/* ---------- the pieces ---------- */

check('the clips, the still and the manifest are on disk', () => {
  ['idle.mp4', 'wave.mp4', 'poster.webp'].forEach(f => {
    const p = path.join(ROOT, 'profile/hero', f);
    ok(fs.existsSync(p), 'profile/hero/' + f + ' is missing');
    ok(fs.statSync(p).size > 2000, 'profile/hero/' + f + ' is suspiciously small');
  });
  ok(fs.existsSync(path.join(ROOT, 'profile/hero/track/frames.json')),
     'the frame manifest is missing — nothing knows which still faces the camera');
});

check('the head poses are complete, cover both axes, and front is marked', () => {
  const dir = path.join(ROOT, 'profile/hero/track');
  const files = fs.readdirSync(dir).filter(f => /^t\d\d\.webp$/.test(f)).sort();
  ok(files.length >= 12, 'only ' + files.length + ' head-turn frames; the turn will read as steps');
  files.forEach((f, i) => {
    const want = 't' + (i < 10 ? '0' : '') + i + '.webp';
    ok(f === want, 'frame numbering has a gap: expected ' + want + ', found ' + f);
  });

  const man = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
  ok(man.n === files.length,
     'the manifest says ' + man.n + ' frames but ' + files.length + ' are on disk');

  /* Every pose carries the yaw AND pitch it was measured at. Without both, the
     lookup can only answer left and right — which is exactly why he appeared to
     stare upward whenever the cursor went low. */
  ok(Array.isArray(man.f) && man.f.length === man.n, 'the manifest has no pose list');
  man.f.forEach((p, i) => {
    ok(typeof p.y === 'number' && typeof p.p === 'number',
       'pose ' + i + ' is missing a yaw or a pitch');
  });

  /* Both axes must actually vary, or one of them is decorative. */
  const ys = man.f.map(p => p.y), ps = man.f.map(p => p.p);
  ok(Math.max(...ys) - Math.min(...ys) > 0.04,
     'the poses barely turn (yaw span ' + (Math.max(...ys) - Math.min(...ys)).toFixed(3) +
     '); his gaze will never reach the cursor');
  ok(Math.max(...ps) - Math.min(...ps) > 0.02,
     'the poses barely tilt (pitch span ' + (Math.max(...ps) - Math.min(...ps)).toFixed(3) +
     '); he will look the same whether the cursor is high or low');

  ok(man.neutral >= 0 && man.neutral < man.n, 'the front-facing pose index is out of range');
  /* The measured range is not symmetric about the front, so the neutral index
     is not the midpoint. This guards against someone "tidying" it to the
     middle, which aims his gaze permanently off to one side. */
  const nAbs = Math.abs(man.f[man.neutral].y);
  ok(man.f.every(p => Math.abs(p.y) >= nAbs - 1e-9),
     'the pose marked as front is not the one closest to a zero turn');
});

check('the whole hero stays small enough for hospital wifi', () => {
  const clips = ['idle.mp4', 'wave.mp4', 'poster.webp']
    .reduce((n, f) => n + fs.statSync(path.join(ROOT, 'profile/hero', f)).size, 0);
  const td = path.join(ROOT, 'profile/hero/track');
  const frames = fs.readdirSync(td).reduce((n, f) => n + fs.statSync(path.join(td, f)).size, 0);
  const total = clips + frames;
  ok(total < 4 * 1024 * 1024,
     'the hero totals ' + (total / 1048576).toFixed(1) + 'MB, over the 4MB ceiling');
});

check('the page mounts the stage, the script and the sound switch', () => {
  ok(/id="fpVideo"/.test(html), 'the video stage is gone from founder.html');
  ok(/hero-video\.js/.test(html), 'hero-video.js is not linked');
  ok(/hero-video\.css/.test(html), 'hero-video.css is not linked');
  ok(/id="fpvSound"/.test(html), 'the sound switch is missing');
});

/* ---------- failure mode 1 and 2: black ---------- */

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

/* ---------- failure mode 3: looking the wrong way ---------- */

check('the cursor is measured from HIS head, not the middle of the window', () => {
  ok(/headX/.test(js),
     'the pointer angle is not taken from his head position; the picture is letterboxed ' +
     'inside the stage, so the two are not the same place and his gaze sits off to one side');
  ok(/rectFor/.test(js), 'nothing computes where the picture is actually drawn');
});

check('the cursor maps piecewise around the front frame, not linearly across the strip', () => {
  ok(/neutral/.test(js), 'the front-facing frame index is never used');
  ok(/t\s*<\s*0\s*\?/.test(js) || /t\s*<\s*0\s*$/m.test(js),
     'the mapping is not split either side of the front frame; the strip is asymmetric, ' +
     'so a linear map puts front in the wrong place');
});

check('the frames are preloaded before the first cursor move', () => {
  ok(/new Image\(\)/.test(js),
     'the head-turn frames are not preloaded; the first move lands on nothing');
});

/* ---------- sizing ---------- */

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

/* ---------- sound and decoration ---------- */

check('only the greeting can make sound, and the choice is remembered', () => {
  /* Muting happens where the elements are built, so this follows the builder
     rather than a variable name that may be refactored away. */
  ok(/function mkVideo/.test(code) && /\.muted\s*=\s*true/.test(code),
     'the clips are not muted at creation — an autoplaying idle with sound is blocked ' +
     'by the browser, and hostile if it were not');
  ok(/aq-hero-sound/.test(js) && /localStorage/.test(js), 'the sound choice is not remembered');
  ok(/wave\.muted\s*=\s*!soundOn\(\)/.test(js), 'the greeting does not honour the sound switch');
});

check('no pointer or reduced motion means one still, and nothing else is fetched', () => {
  ok(/prefers-reduced-motion/.test(js), 'reduced motion is not honoured');
  ok(/hover:\s*hover/.test(js), 'touch devices are not detected');
  const early = js.indexOf('fpv-still');
  const firstVideo = js.indexOf('createElement("canvas")');
  ok(early > -1 && firstVideo > -1 && early < firstVideo,
     'the still fallback is set up after the canvas and clips; phones would download them all');
});

check('the copy sits on its own surface rather than trusting the video', () => {
  const left = css.match(/\.fpv-left\s*\{([^}]*)\}/);
  ok(left, '.fpv-left has no rule');
  ok(/background\s*:/.test(left[1]),
     'the copy column has no background; contrast would depend on which frame is showing');
});

console.log('\n' + (fail ? fail + ' failing, ' : '') + pass + ' passing');
process.exit(fail ? 1 : 0);
