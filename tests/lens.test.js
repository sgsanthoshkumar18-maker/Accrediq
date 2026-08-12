/* AQcredix — rotating homepage lens card, and the portfolio signal network.
 * Run: node tests/lens.test.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function eq(g, w, m) {
  if (g === w) pass++;
  else { fail++; console.log('FAIL: ' + m + ' - got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(read('nabh-data.js'), sb);
vm.runInContext(read('lens-rotation.js'), sb);
const D = sb.window.NABH_DATA, R = sb.window.LENS_ROTATION;

const rotJs = read('lens-rotate.js');

/* Strip comments before asserting on code. Four of these checks first fired on the
   explanatory comments that describe the very thing being forbidden — "not Math.random()",
   "not THREE.js" — which is a false positive, not a finding. */
function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
const home = read('index.html');

/* ------------------------- every code must be real -------------------------
   The card quotes the standard verbatim from nabh-data.js. A code that does not resolve
   would render assessor guidance under an empty quotation, which is worse than showing
   one fewer standard. */
const idx = {};
Object.keys(D.chapters).forEach(ch => (D.chapters[ch].standards || []).forEach(s =>
  (s.elements || []).forEach(e => { idx[s.code + '.' + e.letter] = { ch, cat: e.category, sop: !!e.sop }; })));

const missing = R.filter(r => !idx[r.code]).map(r => r.code);
eq(missing.join(','), '', 'every rotating standard exists in the NABH data');
ok(R.length >= 12, 'the rotation is long enough to feel varied (' + R.length + ')');

// Spread across chapters, or the homepage looks like it only knows one part of the book.
const chapters = [...new Set(R.map(r => idx[r.code].ch))];
ok(chapters.length >= 6, 'the rotation spans at least six chapters (' + chapters.length + ')');

// No duplicates — the same standard twice in a cycle looks like a bug.
eq(new Set(R.map(r => r.code)).size, R.length, 'no standard appears twice');

/* Each entry must carry all three faces. A missing `gap` or `fix` renders an empty panel
   at the third scroll stage, which is the one a reader is most likely to have scrolled
   specifically to see. */
let thin = 0;
R.forEach(r => {
  if (!r.topic || !r.looks || r.looks.length < 3 || !r.gap || !r.fix) thin++;
});
eq(thin, 0, 'every entry has a topic, at least three assessor points, a gap and a fix');

/* The verbatim text is NEVER copied into the rotation file — it is pulled from the data
   at render time, so regenerating the dataset cannot leave a stale quotation behind. */
eq(/verbatim|stdText|"The organisation shall/.test(code(read('lens-rotation.js'))), false,
   'no standard text is duplicated into the rotation file');
ok(/esc\(e\.text\)/.test(rotJs), 'the quotation comes from the dataset at render time');

/* ------------------------------ the rotation ------------------------------ */

// Deterministic from the clock, not random: random gives every visitor a different card
// and a new one on every refresh, which reads as instability rather than variety.
ok(/Math\.floor\(Date\.now\(\) \/ BUCKET_MS\)/.test(rotJs), 'the choice is a time bucket');
eq(/Math\.random\(\)/.test(code(rotJs)), false, 'nothing is left to chance');
ok(/BUCKET_MS = 15 \* 60 \* 1000/.test(rotJs), 'the bucket is fifteen minutes');
ok(/\?lens=|get\("lens"\)/.test(rotJs), 'a specific standard can be requested by query');

// Simulate the bucket maths: a full cycle must show every standard exactly once.
{
  const BUCKET = 15 * 60 * 1000;
  const seen = {};
  for (let b = 0; b < R.length; b++) seen[R[b % R.length].code] = (seen[R[b % R.length].code] || 0) + 1;
  eq(Object.keys(seen).length, R.length, 'one full cycle shows every standard');
  eq(Object.values(seen).every(v => v === 1), true, 'each exactly once');

  // Two visitors at the same moment must see the same card.
  const at = t => R[Math.floor(t / BUCKET) % R.length].code;
  const now = Date.now();
  eq(at(now), at(now + 1000), 'two visitors a second apart see the same standard');
  // And a visit a full bucket later must differ.
  ok(at(now) !== at(now + BUCKET), 'a visit fifteen minutes later shows a different one');
  ok(at(now) !== at(now + BUCKET * 3), 'and so does one three buckets later');
}

// Unresolvable codes are filtered rather than rendered blank.
ok(/filter\(function \(r\) \{ return !!idx\[r\.code\]/.test(rotJs),
   'codes that no longer resolve are dropped');

/* ------------------------------ page wiring ------------------------------ */

ok(/id="lensCard"/.test(home), 'the homepage has a slot for the rotating faces');
ok(/id="lensCode"/.test(home) && /id="lensCat"/.test(home), 'and for the code and category');
ok(/id="lensTopic"/.test(home), 'the step text names the current topic');
ok(/lens-rotation\.js/.test(home) && /lens-rotate\.js/.test(home), 'both scripts are loaded');
ok(/aq:content/.test(rotJs), 'the card re-triggers the motion scan after rendering');

/* nabh-data.js is now eager for this card, and the hero used to fetch it again. 124 KB
   twice on first paint is a real cost on the machines this site runs on. */
ok(/if \(window\.NABH_DATA\) \{ loadFaceChain\(\); return; \}/.test(home),
   'the hero reuses the already-parsed dataset instead of refetching it');
ok(/function loadFaceChain/.test(home), 'and the loader chain is entered directly');

// Escaping: element text contains quotes and ampersands.
ok(/function esc/.test(rotJs), 'rendered text is escaped');

/* ------------------------------ signal network ------------------------------ */

const net = read('profile/network.js');
const fcss = read('profile/founder.css');
const fhtml = read('founder.html');

ok(/id="fpNet"/.test(fhtml), 'the portfolio has a canvas for the network');
ok(/fp-exp-grid/.test(fhtml) && /fp-exp-grid/.test(fcss),
   'the timeline and network share a two-column grid');
ok(/\.fp-net-col \{ position: sticky/.test(fcss),
   'the network sticks while the timeline scrolls past');

/* Canvas 2D, not a third WebGL context. The homepage already runs two; a third on a page
   that also runs tilt, reveals and scrollytelling competes for the same frame budget. */
ok(/getContext\("2d"\)/.test(net), 'the network is canvas 2D');
eq(/THREE|WebGLRenderer/.test(code(net)), false, 'no third WebGL context is created');
// And it must not reuse the hero organs, or the page looks like a copy of the homepage.
eq(/organ|face\//.test(code(net)), false, 'the hero organ meshes are not reused');

ok(/prefers-reduced-motion/.test(net), 'reduced motion is respected');
ok(/draw\(0\);\n    return;/.test(net), 'and draws one static frame rather than nothing');
ok(/IntersectionObserver/.test(net), 'it only animates while on screen');
ok(/visibilitychange/.test(net), 'and pauses in a hidden tab');
ok(/cancelAnimationFrame/.test(net), 'the loop is actually stopped, not just flagged');

// Theme-aware: the palette can change under it.
ok(/getPropertyValue\("--accent-bright"\)/.test(net), 'colours come from theme tokens');
ok(/MutationObserver/.test(net), 'a palette change invalidates the cached colours');
ok(/attributeFilter: \["data-theme", "data-palette"\]/.test(net), 'watching the right attributes');
eq(/#[0-9a-fA-F]{6}["']\s*[,;)]/.test(net.replace(/\|\| "#5EEAD4"/g, '')), false,
   'no hardcoded palette colour beyond the documented fallback');

ok(/devicePixelRatio/.test(net), 'the canvas is drawn at device resolution');
ok(/Math\.min\(2, window\.devicePixelRatio/.test(net),
   'DPR is capped at 2, so a 3x phone does not render nine times the pixels');

// Pointer interaction, and it must not swallow vertical scrolling on a phone.
ok(/pointerdown/.test(net), 'the network can be dragged');
ok(/touch-action: pan-y/.test(fcss), 'vertical scrolling still works over the canvas');

// Mobile: no hardcoded colour in any media query.
let hard = 0;
for (let i = fcss.indexOf('@media'); i >= 0; i = fcss.indexOf('@media', i + 1)) {
  const o = fcss.indexOf('{', i);
  if (o < 0) break;
  let depth = 0, j = o;
  for (; j < fcss.length; j++) {
    if (fcss[j] === '{') depth++;
    else if (fcss[j] === '}') { depth--; if (!depth) break; }
  }
  if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(fcss.slice(o, j + 1))) hard++;
}
eq(hard, 0, 'no hardcoded colour inside a media query');
ok(/\.fp-net-col \{ position: static/.test(fcss), 'the network unsticks on a narrow screen');

/* Geometry, run for real. An orphan node or a duplicated edge shows up as a visual
   glitch that is hard to spot by eye but trivial to assert. */
{
  const body = net.slice(net.indexOf('var OUTER'), net.indexOf('/* -------------------------------- pulses'));
  const hexBody = net.slice(net.indexOf('function hexA'), net.indexOf('/* --------------------------------- loop'));
  const g = new Function('var nodes=[],edges=[];' + body + hexBody +
    ';buildNodes();buildEdges();return {nodes,edges,hexA};')();

  ok(g.nodes.length >= 30, 'the lattice has enough nodes to read as a network');
  ok(g.edges.length > g.nodes.length, 'and more edges than nodes');

  const deg = {};
  g.edges.forEach(e => { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
  eq(g.nodes.map((_, i) => i).filter(i => !deg[i]).length, 0, 'no node is left unconnected');

  const seen = new Set();
  let dup = 0;
  g.edges.forEach(e => { const k = e.a + '-' + e.b; if (seen.has(k)) dup++; seen.add(k); });
  eq(dup, 0, 'no edge is drawn twice');

  // Golden-angle placement: the outer shell must actually sit on the unit sphere.
  const off = g.nodes.filter(n => !n.ring)
    .filter(n => Math.abs(Math.hypot(n.x, n.y, n.z) - 1) > 0.01);
  eq(off.length, 0, 'outer nodes lie on the unit sphere');

  // The hex parser must survive shorthand and rubbish rather than emitting "rgba(NaN...)".
  eq(g.hexA('#5EEAD4', 0.5), 'rgba(94,234,212,0.5)', 'six-digit hex parses');
  eq(g.hexA('#5ED', 0.5), 'rgba(85,238,221,0.5)', 'shorthand hex expands');
  ok(!/NaN/.test(g.hexA('not-a-colour', 0.5)), 'an unreadable token falls back cleanly');
  ok(!/NaN/.test(g.hexA('', 0.5)), 'and so does an empty one');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
