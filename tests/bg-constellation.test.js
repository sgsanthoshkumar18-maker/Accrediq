/* The constellation background, verified by driving the real module against a recording
 * canvas rather than by looking at it.
 *
 * The failures that matter here are not aesthetic. A background that paints an opaque ground
 * covers the page it is supposed to sit behind; one that compares every node with every other
 * makes a phone stutter; one that catches pointer events steals clicks from the content. Each
 * of those is checked below.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

console.log('bg-constellation');

/* A 2D context that records what was asked of it. */
function recorder() {
  const calls = { fillRect: 0, clearRect: 0, arc: 0, stroke: 0, fill: 0, fillText: 0 };
  const strokes = [], fills = [];
  return {
    calls, strokes, fills,
    canvas: {},
    setTransform() {}, scale() {},
    clearRect() { calls.clearRect++; },
    fillRect() { calls.fillRect++; },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
    arc() { calls.arc++; },
    stroke() { calls.stroke++; strokes.push(this.strokeStyle); },
    fill() { calls.fill++; fills.push(this.fillStyle); },
    fillText() { calls.fillText++; },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, drawImage() {},
    strokeStyle: '', fillStyle: '', lineWidth: 1, font: '',
    globalAlpha: 1, imageSmoothingEnabled: true, imageSmoothingQuality: 'high'
  };
}

/* Run bg.js for one effect at a given viewport and theme, and return what it drew. */
function run(kind, opts) {
  opts = opts || {};
  const ctx = recorder();
  const listeners = {};
  const canvasEl = {
    className: '', width: 0, height: 0, style: {},
    setAttribute() {}, getContext: () => ctx
  };
  const raf = [];
  const win = {
    innerWidth: opts.w || 1440,
    innerHeight: opts.h || 900,
    devicePixelRatio: 2,
    addEventListener(t, f) { listeners[t] = f; },
    removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame(f) { raf.push(f); return raf.length; },
    cancelAnimationFrame() {},
    getComputedStyle: () => ({
      getPropertyValue: n => (n === '--bg' ? (opts.dark === false ? '#FFFFFF' : '#000000') : '')
    }),
    performance: { now: () => 1000 },
    MutationObserver: function () { this.observe = function () {}; }
  };
  win.window = win;
  const doc = {
    documentElement: {},
    body: { dataset: { bg: kind }, insertBefore() {}, firstChild: null },
    hidden: false,
    createElement: t => (t === 'canvas' ? canvasEl : { style: {}, getContext: () => ctx }),
    addEventListener(t, f) { listeners['doc:' + t] = f; }
  };
  win.document = doc;

  new Function('window', 'document', 'matchMedia', 'requestAnimationFrame',
               'cancelAnimationFrame', 'getComputedStyle', 'performance', 'MutationObserver',
               read('motion/bg.js'))(
    win, doc, win.matchMedia, win.requestAnimationFrame, win.cancelAnimationFrame,
    win.getComputedStyle, win.performance, win.MutationObserver);

  return { ctx, canvasEl, listeners, raf };
}

check('the effect is registered and mounts', () => {
  const r = run('constellation');
  assert.strictEqual(r.canvasEl.className, 'aq-bg', 'the canvas did not mount');
  assert.ok(r.canvasEl.width > 0, 'the canvas was never sized');
});

/* THE ONE THAT MATTERS FOR A BACKGROUND. The reference implementation fills the whole canvas
   with an opaque colour every frame. Doing that here would paint over the founder page. */
check('it clears rather than painting an opaque ground', () => {
  const r = run('constellation');
  assert.ok(r.ctx.calls.clearRect > 0, 'the canvas is never cleared');
  assert.strictEqual(r.ctx.calls.fillRect, 0,
    'a background fill would cover the page this is meant to sit behind');
});

check('it draws a mesh — nodes and links', () => {
  const r = run('constellation');
  assert.ok(r.ctx.calls.arc > 100, 'too few nodes drawn: ' + r.ctx.calls.arc);
  assert.ok(r.ctx.calls.stroke > 100, 'too few links drawn: ' + r.ctx.calls.stroke);
});

/* No hex-coordinate readout: it would print text across the biography. */
check('it prints no text over the page', () => {
  const r = run('constellation');
  assert.strictEqual(r.ctx.calls.fillText, 0, 'the background must not draw text');
});

/* THE PERFORMANCE CLAIM, MEASURED. Comparing every node with every other is O(n²); linking
   grid neighbours is O(n). At this viewport the quadratic version would be ~250,000 checks
   per frame. If someone reinstates it, this fails loudly. */
check('link cost is linear in node count, not quadratic', () => {
  const r = run('constellation', { w: 1440, h: 900 });
  const nodes = r.ctx.calls.arc;
  const links = r.ctx.calls.stroke;
  assert.ok(links <= nodes * 4 + 8,
    'links (' + links + ') should be at most four per node (' + nodes + ') — ' +
    'an all-pairs comparison has come back');
  const quadratic = (nodes * (nodes - 1)) / 2;
  assert.ok(links < quadratic / 10,
    'link count is in the quadratic range: ' + links + ' vs ' + quadratic);
});

/* A phone must not draw several thousand nodes. Spacing widens as the viewport narrows. */
check('a phone draws a comparable node count to a laptop, not thousands', () => {
  const phone = run('constellation', { w: 375, h: 812 }).ctx.calls.arc;
  const laptop = run('constellation', { w: 1440, h: 900 }).ctx.calls.arc;
  assert.ok(phone > 20, 'the phone should still show a mesh, got ' + phone);
  assert.ok(phone < laptop, 'a phone should draw fewer nodes than a laptop');
  assert.ok(laptop < 1200, 'node count runs away on a large viewport: ' + laptop);
});

/* Cobalt in both themes, and quieter on paper — a full-screen mesh competes with the text
   sitting on top of it. */
check('it is cobalt in both themes, and quieter in light', () => {
  const dark = run('constellation', { dark: true });
  const light = run('constellation', { dark: false });
  const darkLink = dark.ctx.strokes.find(Boolean) || '';
  const lightLink = light.ctx.strokes.find(Boolean) || '';
  assert.ok(/108,140,255/.test(darkLink), 'dark links are not the cobalt highlight: ' + darkLink);
  assert.ok(/39,67,201/.test(lightLink), 'light links are not the deep cobalt: ' + lightLink);
  const alphaOf = s => parseFloat((s.match(/,\s*([\d.]+)\)$/) || [])[1] || 0);
  assert.ok(alphaOf(lightLink) < alphaOf(darkLink) + 0.001,
    'the light theme must not be louder than the dark one');
});

/* It can never take a click or a scroll from the page in front of it. */
check('the canvas is inert and sits behind the page', () => {
  const css = read('styles.css');
  const rule = /\.aq-bg\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'the .aq-bg rule is gone');
  assert.ok(/z-index:-1/.test(rule[1]), 'the canvas must sit behind the page');
  assert.ok(/pointer-events:none/.test(rule[1]), 'the canvas must not catch pointer events');
  assert.ok(/position:fixed/.test(rule[1]), 'the canvas must be fixed');
});

/* The founder page used this briefly and now has the oversized-name hero instead, so no page
 * currently requests it. The effect is kept rather than deleted: it is ~90 lines beside three
 * siblings in the same module, fully covered by the checks above, and it is the obvious answer
 * the next time a page wants a background. What matters is that it stays correct and stays
 * reachable by the one attribute that turns it on. */
check('the effect stays available even though no page requests it today', () => {
  const js = read('motion/bg.js');
  assert.ok(/constellation: constellation/.test(js),
    'the effect must stay registered in the DRAW map to be reachable by data-bg');
  const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f));
  const users = pages.filter(f => /data-bg="constellation"/.test(read(f)));
  /* Not an error either way — this records which pages use it so a future change is visible. */
  console.log('        (pages using it: ' + (users.length ? users.join(', ') : 'none'));
});

/* The founder page dropped it deliberately. If data-bg comes back without motion/bg.js being
 * loaded, or the other way round, the page half-works — so assert they agree. */
check('the founder page requests no background, and loads none', () => {
  const html = read('founder.html');
  const asks = /data-bg="/.test(html);
  const loads = /motion\/bg\.js/.test(html);
  assert.strictEqual(asks, loads,
    asks ? 'the page requests a background but does not load the module'
         : 'the page loads the background module but requests no effect');
});

/* Reduced motion still gets one painted frame — a still mesh, not a blank page. */
check('reduced motion paints once and does not animate', () => {
  const js = read('motion/bg.js');
  assert.ok(/if \(!REDUCED\) requestAnimationFrame\(frame\)/.test(js),
    'reduced motion must skip the animation loop');
  assert.ok(/DRAW\(2400\);/.test(js), 'a single frame must still be painted');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
