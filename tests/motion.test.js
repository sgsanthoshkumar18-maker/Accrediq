/* AQcredix — motion layer.
 * Run: node tests/motion.test.js
 */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function eq(got, want, msg) {
  if (got === want) pass++;
  else { fail++; console.log('FAIL: ' + msg + ' - got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const js = read('motion/motion.js');
const css = read('motion/motion.css');

/* ---------------------------- accessibility first ---------------------------- */

ok(/prefers-reduced-motion/.test(js), 'the engine reads the reduced-motion preference');
ok(/prefers-reduced-motion/.test(css), 'and the stylesheet honours it independently');
// Belt and braces: if the class were the only guard, a stylesheet failing to load would
// leave every revealed section invisible.
ok(/aq-motion-off/.test(js) && /aq-motion-off/.test(css), 'a stand-down class exists on both sides');
ok(/opacity: 1 !important/.test(css), 'reduced motion forces content visible, never hidden');
ok(/@media print/.test(css), 'printing an audit never inherits a half-revealed state');

/* ------------------------- it must not break the header ------------------------- */

/* A transform wrapper is the usual way to do inertial scroll and it would break the
   sticky header, which carries backdrop-filter and is therefore the containing block
   for fixed descendants — the property that already collapsed the mobile menu once. */
ok(/window\.scrollTo/.test(js), 'the scroll engine drives the real scroll position');
eq(/transform:\s*translate3d\(0,\s*-?\$\{?scroll/.test(js), false, 'no wrapper transform');
ok(!/document\.body\.style\.transform/.test(js), 'the body is never transformed for scrolling');
ok(/scroll-behavior: auto/.test(css), 'native smooth scrolling is disabled so the two do not fight');

/* --------------------------------- touch ---------------------------------- */

ok(/pointer: coarse/.test(js), 'touch devices are detected');
ok(/if \(!coarse\)/.test(js), 'inertial scroll is skipped on touch, which already has momentum');

/* ------------------------------ wheel handling ------------------------------ */

ok(/e\.ctrlKey \|\| e\.metaKey/.test(js), 'browser zoom is left alone');
ok(/closestScrollable/.test(js), 'a scrollable panel keeps its own wheel events');
ok(/deltaMode === 1/.test(js), 'Firefox line-mode deltas are converted');
ok(/passive: false/.test(js), 'the wheel listener can preventDefault');
ok(/function resync/.test(js), 'keyboard and scrollbar movement resync the engine');

/* ------------------------------ page transitions ------------------------------ */

ok(/u\.origin !== location\.origin/.test(js), 'external links are not intercepted');
ok(/mailto:|tel:/.test(js), 'mail and phone links are not intercepted');
ok(/hasAttribute\("download"\)/.test(js), 'download links are not intercepted');
ok(/metaKey \|\| e\.ctrlKey \|\| e\.shiftKey/.test(js), 'open-in-new-tab still works');
/* A transitionend listener would strand the click if the fade were interrupted. */
ok(/setTimeout\(function \(\) \{ location\.href = href; \}/.test(js),
   'navigation is on a hard timeout, so an interrupted fade cannot swallow a click');
ok(/pageshow/.test(js), 'the Back button cannot restore a faded-out page');

/* -------------------------------- reveals -------------------------------- */

ok(/IntersectionObserver/.test(js), 'reveals use IntersectionObserver');
ok(/in window/.test(js), 'and degrade to visible where it is unsupported');
ok(/io\.unobserve/.test(js), 'an element reveals once, so re-reading does not flicker');
ok(/Math\.min\(i, 4\)/.test(js), 'the stagger is capped rather than growing with index');
// The hidden state must come from JS, or a no-JS visitor sees a blank page.
ok(/classList\.add\("aq-reveal"\)/.test(js), 'the hiding class is applied by script, not markup');
eq(/class="[^"]*aq-reveal/.test(read('index.html')), false, 'no page ships content pre-hidden');

/* ------------------------------- palette safety ------------------------------- */

// The whole motion layer is opacity and transform. No colour means nothing to keep in
// step with light/dark/neon — the rule the palette suite enforces site-wide.
eq(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css), false, 'the motion stylesheet declares no colours');

/* ------------------------------- wiring ------------------------------- */

function walk(dir, out) {
  out = out || [];
  const skip = new Set(['node_modules', '.git', 'build', 'tests',
    'galaxy', 'galaxy2', 'brain', 'dna', 'helix', 'radar', 'globe', 'hglobe', 'kpinet']);
  for (const n of fs.readdirSync(dir)) {
    if (skip.has(n)) continue;
    const full = path.join(dir, n);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (n.endsWith('.html')) out.push(full);
  }
  return out;
}
const pages = walk(ROOT);
ok(pages.length >= 47, 'the site still has its full page count (' + pages.length + ')');

let missing = 0, badPath = 0;
pages.forEach(f => {
  const h = fs.readFileSync(f, 'utf8');
  if (!/motion\/motion\.css/.test(h) || !/motion\/motion\.js/.test(h)) { missing++; return; }
  // Nested pages need ../ or the asset 404s and the page silently loses all motion.
  const depth = path.relative(ROOT, path.dirname(f)).split(path.sep).filter(Boolean).length;
  const want = '../'.repeat(depth) + 'motion/motion.js';
  if (h.indexOf('src="' + want + '"') < 0) { badPath++; console.log('  bad path: ' + f); }
});
eq(missing, 0, 'every page loads the motion layer');
eq(badPath, 0, 'every page uses a correct relative path for its depth');

// Parallax is opt-in per element, and restrained: heavy drift on a reference tool makes
// text hard to track while reading.
const home = read('index.html');
const speeds = [...home.matchAll(/data-parallax="(-?[\d.]+)"/g)].map(m => Math.abs(+m[1]));
ok(speeds.length > 0, 'the homepage uses parallax');
ok(speeds.every(v => v <= 0.12), 'parallax speeds stay subtle (max ' + Math.max(...speeds) + ')');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
