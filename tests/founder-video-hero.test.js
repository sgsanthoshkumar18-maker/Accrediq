/* THE FOUNDER HERO FOLLOWS THE CURSOR, AND IT HAS TWO FAILURE MODES THAT
 * MATTER — BOTH INVISIBLE IN THE SOURCE UNLESS YOU KNOW TO LOOK.
 *
 * 1. THE BLINK. An early version faded one layer out while fading the next in.
 *    Two layers at half opacity do not add back up to a picture: for a few
 *    frames neither is opaque and the page shows through the middle. The fix is
 *    that the incoming layer is lifted ABOVE the others and the outgoing one is
 *    left fully opaque underneath until it is completely covered. The obvious
 *    tidy-up — toggling both in the same tick — puts the blink straight back.
 *
 * 2. THE HEAD NOT MOVING AT ALL. The turn is 19 stills chosen by measured head
 *    angle, indexed by pointer position. If the easing is driven only by
 *    requestAnimationFrame then in a background tab, under battery saver, or
 *    inside an embedded web view — all places rAF is throttled to nothing —
 *    the head never moves. That reads as broken, not as less smooth, so a
 *    pointer event must move it by itself.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'founder.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'profile/hero-video.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'profile/hero-video.js'), 'utf8');

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
    ok(fs.existsSync(p), 'profile/hero/' + f + ' is missing — the hero will show an empty stage');
    ok(fs.statSync(p).size > 2000, 'profile/hero/' + f + ' is suspiciously small');
  });
});

check('the head-turn frames are numbered without gaps, and the code agrees', () => {
  /* The player picks a frame by index. A missing file is one dead angle the
     head snaps past — much harder to notice than a file that is simply absent. */
  const dir = path.join(ROOT, 'profile/hero/track');
  ok(fs.existsSync(dir), 'profile/hero/track is missing — there is nothing to track with');
  const files = fs.readdirSync(dir).filter(f => /^t\d\d\.webp$/.test(f)).sort();
  ok(files.length >= 12, 'only ' + files.length + ' head-turn frames; the turn will read as steps');
  files.forEach((f, i) => {
    const want = 't' + (i < 10 ? '0' : '') + i + '.webp';
    ok(f === want, 'frame numbering has a gap: expected ' + want + ', found ' + f);
  });
  const declared = (js.match(/var FRAMES\s*=\s*(\d+)/) || [])[1];
  ok(Number(declared) === files.length,
     'hero-video.js declares ' + declared + ' frames but ' + files.length + ' are on disk');
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

/* ---------- failure mode 1: the blink ---------- */

check('the shown layer is opaque AND lifted above the others', () => {
  const on = css.match(/\.fpv-clip\.is-on\s*\{([^}]*)\}/);
  ok(on, '.fpv-clip.is-on has no rule');
  ok(/opacity\s*:\s*1/.test(on[1]), 'the shown layer must be fully opaque');
  ok(/z-index/.test(on[1]),
     'the shown layer is not raised above the others; it will dissolve over a gap ' +
     'instead of over the outgoing picture — that is the white blink');
});

check('the outgoing layer is only switched off after the fade, not during it', () => {
  /* The giveaway is a setTimeout around the class removal. Removing is-on in
     the same tick as adding it to the next layer is exactly the bug. */
  ok(/setTimeout/.test(js) && /classList\.remove\("is-on"\)/.test(js),
     'nothing defers switching the old layer off; both will fade at once');
});

/* ---------- failure mode 2: a head that never moves ---------- */

check('the head is chosen by index, never by seeking a video', () => {
  /* Seeking is frame-exact only on keyframes, and iOS Safari is the worst of
     them. Picking a still by index is exact on every browser there is. */
  ok(/track\.src\s*=/.test(js), 'nothing swaps the tracking frame');
  const seeks = js.replace(/currentTime\s*=\s*0/g, '');
  ok(!/currentTime\s*=\s*[^0\s]/.test(seeks),
     'something seeks a video to a non-zero time; the turn must be frames, not seeking');
});

check('a pointer event moves the head by itself, without waiting for rAF', () => {
  const aim = js.match(/function aim\s*\([^)]*\)\s*\{([\s\S]*?)\n    \}/);
  ok(aim, 'aim() is gone');
  ok(/show\s*\(/.test(aim[1]),
     'aim() only schedules an animation frame; it must also take one immediately, ' +
     'or the head is frozen wherever rAF is throttled');
});

check('the frames are preloaded before the first cursor move', () => {
  ok(/new Image\(\)/.test(js),
     'the head-turn frames are not preloaded; the first move lands on a blank element');
});

/* ---------- sound ---------- */

check('only the greeting can make sound, and the choice is remembered', () => {
  ok(/idle\.muted\s*=\s*true/.test(js),
     'the looping idle clip is not muted — it would be blocked, and hostile if it were not');
  ok(/aq-hero-sound/.test(js) && /localStorage/.test(js),
     'the sound choice is not remembered');
  ok(/wave\.muted\s*=\s*!soundOn\(\)/.test(js),
     'the greeting does not honour the sound switch');
});

/* ---------- it is decoration, and must behave like it ---------- */

check('no pointer or reduced motion means one still, and nothing else is fetched', () => {
  ok(/prefers-reduced-motion/.test(js), 'reduced motion is not honoured');
  ok(/hover:\s*hover/.test(js), 'touch devices are not detected');
  ok(/fpv-still/.test(js), 'there is no still fallback');
  const early = js.indexOf('fpv-still');
  const firstVideo = js.indexOf('document.createElement("video")');
  ok(early > -1 && firstVideo > -1 && early < firstVideo,
     'the still fallback is set up after the clips are built; phones would download them all');
});

check('the clips are hidden from assistive tech', () => {
  ok(/aria-hidden/.test(js), 'the clips are not hidden from screen readers');
});

/* ---------- layout ---------- */

check('the copy sits on its own surface rather than trusting the video', () => {
  const left = css.match(/\.fpv-left\s*\{([^}]*)\}/);
  ok(left, '.fpv-left has no rule');
  ok(/background\s*:/.test(left[1]),
     'the copy column has no background; contrast would depend on which frame is showing, ' +
     'and the brightest frame in these clips is a lit white wall');
});

check('landscape shows the whole figure, portrait does not crop him to a head', () => {
  ok(/object-fit\s*:\s*contain/.test(css),
     'the clip is never contained; cover on a landscape screen clips his head and the desk');
  ok(/max-aspect-ratio/.test(css),
     'there is no portrait branch; a 16:9 frame filling a tall screen zooms him to a face');
});

check('the hero is measured in svh, not vh', () => {
  ok(/min-height\s*:\s*100svh/.test(css), 'the hero does not use svh for its height');
});

console.log('\n' + (fail ? fail + ' failing, ' : '') + pass + ' passing');
process.exit(fail ? 1 : 0);
