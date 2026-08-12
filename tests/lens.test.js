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

/* ------------------------- the globe opens on data -------------------------
   It used to open on the Atlantic: nothing clickable until you dragged. The start angle
   is now chosen by scoring every 2 degrees against the capitals list. */
{
  const g = read('hglobe/hglobe.js');
  ok(/START_ROT_Y = -1\.2915/.test(g), 'the opening rotation is the computed one');
  ok(/START_ROT_X = 0\.30/.test(g), 'with the matching pitch');
  eq(/rotY = -0\.3\b/.test(g), false, 'the old Atlantic-facing default is gone');
  // Reset must return to the same view, not to the old empty one.
  eq((g.match(/START_ROT_Y/g) || []).length, 3, 'reset uses the same constant');

  const caps = {};
  vm.runInContext(read('hglobe/capitals-data.js'), sb);
  const C = sb.window.WORLD_CAPITALS;
  ok(C.length > 50, 'the capitals list is populated');

  // Score the chosen angle the same way the choice was made.
  function visible(rotY, rotX) {
    let n = 0;
    C.forEach(c => {
      const la = c.lat * Math.PI / 180, lo = c.lon * Math.PI / 180;
      const x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
      const cx = Math.cos(rotY), sx = Math.sin(rotY);
      const x2 = x * cx + z * sx, z2 = -x * sx + z * cx;
      const cy = Math.cos(rotX), sy = Math.sin(rotX);
      const z3 = y * sy + z2 * cy;
      if (z3 > 0.25) n++;
    });
    return n;
  }
  const chosen = visible(-1.2915, 0.30);
  const old = visible(-0.3, 0.15);
  ok(chosen > old, 'the new opening view shows more capitals than the old one (' +
     chosen + ' vs ' + old + ')');
  ok(chosen >= C.length * 0.75, 'and at least three quarters of them are facing the viewer');
}

/* --------------------------- the WHO proxy is reachable ---------------------------
   Vercel maps /api/who to api/who.js by file convention. A rewrite pointing at the
   literal /api/who.js path made Vercel serve the FUNCTION SOURCE as a static file with
   a 200, so res.json() failed to parse it, health-data.js caught the error, and every
   field showed "No data" — which read as WHO having no figures rather than as the proxy
   never being invoked. */
{
  const vj = JSON.parse(read('vercel.json'));
  const rw = vj.rewrites || [];
  eq(rw.filter(r => /^\/api\//.test(r.source)).length, 0,
     'no rewrite shadows the api directory');
  eq(/api\/who\.js/.test(JSON.stringify(rw)), false,
     'nothing points at the function source path');
  ok(/api\/who/.test(read('hglobe/health-data.js')), 'the client still calls the proxy');
  ok(vj.functions, 'the functions block is present so the runtime is explicit');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
