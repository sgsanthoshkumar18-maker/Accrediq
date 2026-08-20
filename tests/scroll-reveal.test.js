/* AQcredix — scroll reveal must never be able to hide content.
 *
 * The bug this guards against cost most of a day to find, because every diagnostic said
 * the page was healthy: the markup rendered (259KB), the element measured 46,886px tall,
 * computed display was `block`, opacity `1`, visibility `visible`, colours correct, all
 * network requests 200. The content was simply never painted.
 *
 * The cause was an ANCESTOR at opacity 0 -- computed opacity does not inherit, so the
 * child truthfully reported 1 while its parent made everything inside invisible. And that
 * ancestor was stuck at 0 because the IntersectionObserver used `threshold: 0.04`:
 * "reveal once 4% of this element is on screen". For a 46,886px section that is 1,875px,
 * more than twice a laptop viewport. The condition was unsatisfiable at every scroll
 * position, so the reveal never fired.
 *
 * The rule these tests encode: a decoration must never be capable of hiding content.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const MOTION = read('motion/motion.js');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

console.log('scroll-reveal');

check('the reveal threshold is satisfiable by an element taller than the viewport', () => {
  const m = MOTION.match(/threshold:\s*(\[[^\]]*\]|[\d.]+)/);
  assert.ok(m, 'no threshold found on the reveal observer');
  const raw = m[1];
  const values = raw.startsWith('[')
    ? JSON.parse(raw)
    : [parseFloat(raw)];
  assert.ok(values.includes(0),
    'threshold must include 0. Any single positive threshold t is unsatisfiable for an ' +
    'element taller than viewport/t: at t=' + values[0] + ' anything over ~' +
    Math.round(800 / values[0]) + 'px can never reveal. Got: ' + raw);
});

/* The arithmetic, stated plainly, so the reason survives even if the code moves. */
check('the audit checklist height would defeat a 0.04-only threshold', () => {
  const VIEWPORT = 800;      // a modest laptop
  const CHECKLIST = 46886;   // measured on the live page
  assert.ok(CHECKLIST * 0.04 > VIEWPORT,
    'this test is only meaningful while the checklist is taller than viewport/threshold');
  // With 0 in the list, any intersection at all reveals it.
  const m = MOTION.match(/threshold:\s*\[([^\]]*)\]/);
  assert.ok(m && m[1].split(',').map(s => parseFloat(s)).includes(0),
    'a tall panel needs a 0 threshold to ever reveal');
});

check('nothing can stay hidden indefinitely', () => {
  assert.ok(/setTimeout\(function \(\)\s*\{[\s\S]{0,300}aq-in/.test(MOTION),
    'there must be a timed backstop that reveals anything the observer missed');
});

check('panels shown by script can force a reveal', () => {
  assert.ok(/function reveal\(root\)/.test(MOTION), 'Reveal.reveal(root) is missing');
  assert.ok(/reveal:\s*function \(root\)/.test(MOTION),
    'reveal must be exported on window.AQMotion for pages to call');

  // An element inside a display:none panel cannot intersect anything, so a panel opened
  // by JavaScript must release its own contents.
  const ui = read('audit/audit-ui.js');
  const calls = (ui.match(/AQMotion\.reveal\(/g) || []).length;
  assert.ok(calls >= 2,
    'both audWork and audDone are shown by script and must each force a reveal; found ' +
    calls + ' call(s)');
  assert.ok(/view\("audWork"\);[\s\S]{0,400}AQMotion\.reveal/.test(ui),
    'the checklist panel must reveal its contents right after being shown');
  assert.ok(/view\("audDone"\);[\s\S]{0,300}AQMotion\.reveal/.test(ui),
    'the report panel must reveal its contents right after being shown');
});

check('a missing IntersectionObserver still shows everything', () => {
  assert.ok(/IntersectionObserver" in window\)\)\s*\{[\s\S]{0,200}aq-in/.test(MOTION),
    'without observer support the page must show content, not hide it');
});

check('reduced motion does not depend on the observer', () => {
  const css = read('motion/motion.css');
  assert.ok(/prefers-reduced-motion[\s\S]*?\.aq-reveal/.test(css),
    'reduced-motion users must see content regardless of reveal state');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('scroll-reveal: all passed');
