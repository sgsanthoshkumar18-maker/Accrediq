/* THE FOUNDER HERO: he works at his laptop, turns his head toward whichever
 * side of him the cursor is on, and waves when you click him.
 *
 * Everything this file guards was got wrong at least once, and none of it is
 * visible in the source unless you already know what you are looking at.
 *
 * 1. THE POSE LOOKUP. He used to turn by swapping between 28 stills chosen by
 *    measured head angle. Only the HEAD had been matched, so his shoulders and
 *    hands jumped between neighbouring frames. Every movement on this stage is
 *    now a continuous run of real frames and the code only chooses which run to
 *    play, so these checks fail if a lookup ever comes back.
 *
 * 2. THE TURNS ARE THE RETURNS, REVERSED. Each source clip runs
 *    rest -> turn -> hold -> return -> rest. Cutting the turn from the FRONT
 *    does not work: early in every clip he settles his hands into a different
 *    resting posture, so the frame the turn starts from is about seventeen
 *    ordinary frame-steps away from the idle pose — a visible jump of his hands.
 *    turn-*.mp4 is therefore the return reversed and back-*.mp4 is the same run
 *    forwards, which makes them exact mirrors and closes the state on itself.
 *    A turn and its back MUST stay the same length, or he no longer returns to
 *    where he started.
 *
 * 3. THE BLACK FLASH. Cross-fading stacked <video> opacity shows the page
 *    through the middle of the blend. One canvas, outgoing picture first.
 *
 * 4. AN OPAQUE CANVAS. getContext("2d",{alpha:false}) starts solid BLACK, which
 *    is the exact flash the canvas was adopted to remove.
 *
 * 5. THE GREETING THAT PLAYED INVISIBLY. Seeking to 0 drops readyState below 2,
 *    so a build that waited on 'loadeddata' waited forever — that event fires
 *    during preload and never fires twice.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const HERO = path.join(ROOT, 'profile/hero');
const html = fs.readFileSync(path.join(ROOT, 'founder.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'profile/hero-video.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'profile/hero-video.js'), 'utf8');
/* The comments in that file name the very mistakes these checks look for — one
   spells out "alpha:false" in a warning never to use it, another describes the
   deleted pose lookup at length. Matching the raw text would find the warning
   rather than the bug, so assertions about what the CODE does run against the
   code with comments stripped. */
const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

const CLIPS = ['idle', 'wave', 'turn-left', 'turn-right', 'back-left', 'back-right'];

console.log('founder video hero');

/* ---------- the pieces ---------- */

check('every clip and the still are on disk', () => {
  CLIPS.concat().forEach(f => {
    const p = path.join(HERO, f + '.mp4');
    ok(fs.existsSync(p), 'profile/hero/' + f + '.mp4 is missing');
    ok(fs.statSync(p).size > 2000, 'profile/hero/' + f + '.mp4 is suspiciously small');
  });
  ok(fs.existsSync(path.join(HERO, 'poster.webp')), 'the poster is missing');
});

check('the whole hero stays small enough for hospital wifi', () => {
  const total = fs.readdirSync(HERO)
    .map(f => path.join(HERO, f))
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
  ok(/id="fpvNameHit"/.test(html), 'the name hit-target is missing');
});

/* ---------- failure mode 1 and 2: the movement itself ---------- */

check('the head-turn frame strip is gone, and stays gone', () => {
  ok(!fs.existsSync(path.join(HERO, 'track')),
     'the frame strip is back on disk; movement is made of clips now, not poses');
  ok(!/frames\.json|track\//.test(code), 'the frame manifest is being fetched again');
  ok(!/nearestFrame|tgtYaw|curYaw|tgtPitch|curPitch/.test(code),
     'the head-angle pose lookup is back; he will twitch between mismatched frames');
});

check('each turn and its return are the same run of frames, so he lands home', () => {
  /* If these ever differ in length, one of them was re-cut on its own and the
     mirror is broken — he would stop coming back to the pose the idle sits on. */
  function frames(f) {
    const out = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
      '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0',
      path.join(HERO, f + '.mp4')], { encoding: 'utf8' });
    return parseInt(out.trim(), 10);
  }
  ['left', 'right'].forEach(side => {
    const t = frames('turn-' + side), b = frames('back-' + side);
    ok(t === b, 'turn-' + side + ' is ' + t + ' frames but back-' + side + ' is ' + b +
       '; they are meant to be the same run reversed, so he no longer returns to where he started');
    ok(t > 8, 'turn-' + side + ' is only ' + t + ' frames; the turn will read as a jump');
  });
});

check('the idle loops without a seam', () => {
  /* It is a ping-pong — the same frames forwards then backwards — so the loop
     point cannot jump. An odd frame count is the signature of that build; a
     plain trim would have to jump from its last frame back to its first. */
  const n = parseInt(execFileSync('ffprobe', ['-v', 'error', '-count_frames',
    '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0',
    path.join(HERO, 'idle.mp4')], { encoding: 'utf8' }).trim(), 10);
  ok(n % 2 === 1,
     'idle.mp4 has ' + n + ' frames — an even count means it is no longer the ping-pong ' +
     'that makes its loop seamless');
  ok(/loop.*true|mkVideo\("idle", true\)/.test(code), 'the idle is not set to loop');
});

check('only which SIDE the cursor is on is read, never where it is', () => {
  ok(/zoneAt/.test(code), 'nothing reduces the pointer to a side');
  ok(/clientX/.test(code), 'the pointer x is never read');
  ok(!/clientY/.test(code),
     'the pointer y is being read; he is meant to look at the column on that side ' +
     'regardless of how high or low the cursor is');
  ok(/dead/.test(code),
     'there is no dead band at his centre; he will flip-flop when the cursor sits ' +
     'near the parting line');
});

check('a movement is never interrupted halfway', () => {
  /* The cursor crossing the stage mid-turn must not cut the clip short — the
     state is re-read only once the current run finishes, which is what stops
     him snapping or reversing in the middle of a movement. */
  ok(/if \(busy \|\| greeting\) return;/.test(code),
     'step() no longer refuses to act while a clip is playing');
  ok(/busy = true/.test(code) && /busy = false/.test(code),
     'nothing marks a movement as in progress');
});

/* ---------- failure mode 3 and 4: black ---------- */

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

check('a bigger join gets a longer dissolve', () => {
  /* Blending a join over N frames makes it read as motion at (join/N) of normal
     speed. Returning from the greeting is the largest join on the stage, so a
     single dissolve length for everything makes that one look fast. */
  ok(/FADE_LONG/.test(code), 'there is only one dissolve length');
  const f = code.match(/var FADE\s*=\s*(\d+)/), l = code.match(/var FADE_LONG\s*=\s*(\d+)/);
  ok(f && l && +l[1] > +f[1], 'FADE_LONG is not actually longer than FADE');
});

/* ---------- failure mode 5: the invisible greeting ---------- */

check('the greeting switches picture without waiting on a readiness event', () => {
  ok(/function playOnce/.test(code), 'clips are no longer played through one helper');
  const p = code.match(/function playOnce\([\s\S]*?\n    \}/);
  ok(p && /switchTo\(v, ms\)/.test(p[0]), 'playOnce never switches the canvas to the clip');
  ok(!/loadeddata[\s\S]{0,120}wave|wave[\s\S]{0,160}loadeddata/.test(code),
     "the greeting waits on 'loadeddata' again — the seek to 0 drops readyState below 2 " +
     'and that event has already fired during preload, so it plays with no picture');
});

check('clicking him or his name is what sets him waving', () => {
  ok(/root\.addEventListener\("click", greet\)/.test(code), 'clicking the stage no longer greets');
  ok(/hit\.addEventListener\("click", greet\)/.test(code), 'clicking his name no longer greets');
});

check('a clip can never strand him mid-gesture', () => {
  ok(/removeEventListener\("ended", finish\)/.test(code),
     "the 'ended' listener is never removed; a later play is cut short by an earlier one");
  ok(/setTimeout\(finish/.test(code),
     "nothing backstops a missing 'ended' event; a decode error would freeze him mid-movement");
});

/* ---------- sizing and cost ---------- */

check('the canvas is sized from the box, when the box actually changes', () => {
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
  ok(/if \(!dirty\)/.test(code), 'the draw loop redraws unconditionally');
  ok(/Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/.test(code),
     'the device pixel ratio is uncapped; at 2 a full-screen canvas is ~3400x2000');
});

/* ---------- sound and fallbacks ---------- */

check('only the greeting carries sound, and the choice is remembered', () => {
  ok(/function mkVideo/.test(code) && /\.muted\s*=\s*true/.test(code),
     'the clips are not muted at creation — an autoplaying idle with sound is blocked ' +
     'by the browser, and hostile if it were not');
  ok(/aq-hero-sound/.test(js) && /localStorage/.test(js), 'the sound choice is not remembered');
  ok(/wave\.muted\s*=\s*!soundOn\(\)/.test(js), 'the greeting does not honour the sound switch');
  ok(/stopPropagation/.test(code),
     'the sound switch does not stop its click reaching the stage, so changing the ' +
     'sound also sets him waving');
});

check('reduced motion gets one still, and nothing else is fetched', () => {
  ok(/prefers-reduced-motion/.test(code), 'reduced motion is not honoured');
  const early = code.indexOf('fpv-still');
  const firstVideo = code.indexOf('createElement("canvas")');
  ok(early > -1 && firstVideo > -1 && early < firstVideo,
     'the still fallback is set up after the canvas and clips; a reduced-motion visitor ' +
     'would download all six anyway');
});

check('the copy sits on its own surface rather than trusting the video', () => {
  const left = css.match(/\.fpv-left\s*\{([^}]*)\}/);
  ok(left, '.fpv-left has no rule');
  ok(/background\s*:/.test(left[1]),
     'the copy column has no background; contrast would depend on which frame is showing');
});

console.log('\n' + (fail ? fail + ' failing, ' : '') + pass + ' passing');
process.exit(fail ? 1 : 0);
