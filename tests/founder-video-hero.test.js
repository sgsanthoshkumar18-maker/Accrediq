/* THE FOUNDER HERO IS A VIDEO NOW, AND IT HAS ONE FAILURE MODE THAT MATTERS.
 *
 * The first build crossfaded one <video> out while another faded in. Two clips
 * at half opacity do not add back up to a picture — they wash out, and the
 * container shows through the gap. That is the white blink: for a few frames
 * you see half a video, half another video and a strip of the page, which is
 * exactly the "a video just started" tell the whole thing exists to hide.
 *
 * The fix was structural: the idle clip is a base layer that never fades, and
 * reactions are OPAQUE overlays on top of it. At every instant one fully
 * opaque video is on screen. These checks guard that arrangement, because it
 * is invisible in the source unless you know to look for it, and the obvious
 * "tidy-up" — giving .fpv-base a transition, or reintroducing a poster — puts
 * the blink straight back.
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

/* ---------- the pieces exist ---------- */

check('all four clips and the still are on disk', () => {
  ['idle.mp4', 'left.mp4', 'right.mp4', 'wave.mp4', 'poster.webp'].forEach(f => {
    const p = path.join(ROOT, 'profile/hero', f);
    ok(fs.existsSync(p), 'profile/hero/' + f + ' is missing — the hero will show an empty stage');
    ok(fs.statSync(p).size > 2000, 'profile/hero/' + f + ' is suspiciously small');
  });
});

check('the clips stay small enough for hospital wifi', () => {
  const total = ['idle.mp4', 'left.mp4', 'right.mp4', 'wave.mp4', 'poster.webp']
    .reduce((n, f) => n + fs.statSync(path.join(ROOT, 'profile/hero', f)).size, 0);
  /* Four clips autoplay on a page a hospital opens over a shared line. Past a
     few megabytes this stops being a hero and starts being a download. */
  ok(total < 4 * 1024 * 1024,
     'the hero clips total ' + (total / 1048576).toFixed(1) + 'MB, over the 4MB ceiling');
});

check('the page mounts the panel and loads its script', () => {
  ok(/id="fpVideo"/.test(html), 'the video panel element is gone from founder.html');
  ok(/hero-video\.js/.test(html), 'hero-video.js is not linked');
  ok(/hero-video\.css/.test(html), 'hero-video.css is not linked');
});

/* ---------- the no-blink arrangement ---------- */

check('the base clip is opaque and has nothing that could fade it', () => {
  const base = css.match(/\.fpv-clip\.fpv-base\s*\{([^}]*)\}/);
  ok(base, '.fpv-clip.fpv-base has no rule — the base layer is not pinned opaque');
  ok(/opacity\s*:\s*1/.test(base[1]),
     'the base layer is not opacity:1; anything less lets the page show through between clips');
  /* A transition on the base is the specific "improvement" that reintroduces
     the blink: it makes the always-on layer capable of not being on. */
  ok(!/transition/.test(base[1]),
     'the base layer has a transition; it must never animate its own opacity');
});

check('overlays are opaque when shown, never half-faded over the base', () => {
  const on = css.match(/\.fpv-clip\.is-on\s*\{([^}]*)\}/);
  ok(on, '.fpv-clip.is-on has no rule');
  ok(/opacity\s*:\s*1/.test(on[1]), 'a revealed overlay must be fully opaque');
});

check('no poster attribute is set on the clips', () => {
  /* A poster is painted before the first frame and dropped after it — one more
     visible swap on a surface whose whole job is to have none. */
  ok(!/\.poster\s*=/.test(js),
     'hero-video.js sets a poster on the video elements; that is an extra visible swap');
});

check('an overlay is only revealed after a frame has actually been painted', () => {
  ok(/requestVideoFrameCallback/.test(js),
     'nothing waits for a decoded frame; revealing on play() shows a blank element for a frame');
  ok(/is-on/.test(js), 'the reveal class is never applied');
});

/* ---------- the copy has to be readable over moving footage ---------- */

check('the copy sits on its own surface rather than trusting the video', () => {
  const left = css.match(/\.fpv-left\s*\{([^}]*)\}/);
  ok(left, '.fpv-left has no rule');
  ok(/background\s*:/.test(left[1]),
     'the copy column has no background; contrast would depend on which frame is playing, ' +
     'and the brightest frame in these clips is a lit white wall');
});

/* ---------- it has to survive every screen ---------- */

check('landscape shows the whole figure, portrait does not crop him to a head', () => {
  ok(/object-fit\s*:\s*contain/.test(css),
     'the clip is never contained; cover on a landscape screen clips his head and the desk');
  ok(/max-aspect-ratio/.test(css),
     'there is no portrait branch; a 16:9 frame filling a tall screen zooms him to a face');
});

check('the hero is measured in svh, not vh', () => {
  /* vh counts the area behind mobile browser chrome, which shows up as a band
     of dead ground under the hero on a phone. */
  ok(/min-height\s*:\s*100svh/.test(css), 'the hero does not use svh for its height');
});

/* ---------- it is decoration, and must behave like it ---------- */

check('no pointer or reduced motion means a still, and no clips are fetched', () => {
  ok(/prefers-reduced-motion/.test(js), 'reduced motion is not honoured');
  ok(/hover:\s*hover/.test(js), 'touch devices are not detected');
  /* The early return is what stops four videos being downloaded to express an
     interaction that cannot happen without a cursor. */
  ok(/fpv-still/.test(js) && /return;/.test(js),
     'there is no early return to the still; phones would download all four clips');
});

check('the clips are silent and hidden from assistive tech', () => {
  ok(/\.muted\s*=\s*true/.test(js), 'the clips are not muted');
  ok(/aria-hidden/.test(js), 'the clips are not hidden from screen readers');
});

console.log('\n' + (fail ? fail + ' failing, ' : '') + pass + ' passing');
process.exit(fail ? 1 : 0);
