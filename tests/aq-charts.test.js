/* The shared chart vocabulary, and the two claims it makes on screen.
 *
 * These charts render clinical numbers, so the failures that matter are not visual. They are
 * a truncated axis that makes a small change look like a cliff, a "best/worst" ranking that
 * is really just sorting by raw value, and an empty series drawn as a flat line — which reads
 * as "no change" and is a lie.
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

console.log('aq-charts');

const win = { document: { createElement: () => ({ style: {} }) } };
new Function('window', read('workspace/aq-charts.js'))(win);
const C = win.AQCharts;

check('the toolkit loads and exposes the vocabulary', () => {
  ['card', 'area', 'bars', 'rings', 'legend', 'callout', 'sparkline']
    .forEach(k => assert.strictEqual(typeof C[k], 'function', k + '() is missing'));
});

/* A trend needs at least two real points. Drawing one point as a flat line says "steady"
   about a department nobody has measured twice. */
check('an empty or single-point series renders an empty state, never a line', () => {
  assert.ok(/aqc-empty/.test(C.area([])), 'no empty state for an empty series');
  assert.ok(/aqc-empty/.test(C.area([{ m: 'Apr', v: 70 }])), 'one point should not draw a trend');
  assert.ok(!/<path/.test(C.area([])), 'an empty series must not draw a path');
});

/* Bars start at zero unless the caller opts out. A truncated axis is the classic way to make
   a 2% move look like a collapse, and these sit next to accreditation decisions. */
check('the value axis starts at zero by default', () => {
  const js = read('workspace/aq-charts.js');
  assert.ok(/o\.zeroBased === false \? Math\.min\.apply\(null, vals\) : 0/.test(js),
    'the area chart no longer defaults to a zero baseline');
});

/* Up is not automatically good. An infection rate rising is bad; compliance rising is good.
   Colouring every rise green would misreport half the clinical indicators on the site. */
check('a delta is coloured by whether it is good, not by its sign', () => {
  const up = C.card({ label: 'x', value: 1, delta: 5 });
  assert.ok(/aqc-delta good/.test(up), 'a rise should read as good by default');
  const upBad = C.card({ label: 'x', value: 1, delta: 5, higherIsBetter: false });
  assert.ok(/aqc-delta bad/.test(upBad),
    'a rise in a lower-is-better measure must read as bad');
  const downGood = C.card({ label: 'x', value: 1, delta: -5, higherIsBetter: false });
  assert.ok(/aqc-delta good/.test(downGood),
    'a fall in a lower-is-better measure must read as good');
});

check('markup is escaped, so a department name cannot inject', () => {
  const out = C.callout({ kicker: 'k', title: '<img src=x onerror=alert(1)>' });
  assert.ok(!/<img/.test(out), 'callout title is not escaped');
  const c = C.card({ label: '<script>', value: '<b>' });
  assert.ok(!/<script>/.test(c) && !/<b>/.test(c), 'card content is not escaped');
});

/* THE RANKING THAT MATTERS. "Worst" must mean furthest from that KPI's own target. Sorting by
   raw value would rank a 2% infection rate below a 90% compliance rate and be useless. */
check('best and worst are ranked by attainment against target, not raw value', () => {
  const js = read('workspace/dept-analytics.js');
  assert.ok(/a: attainment\(k\[1\], k\[2\]\)/.test(js),
    'the insight block no longer scores against the target');
  assert.ok(/ranked\[0\]/.test(js) && /ranked\[ranked\.length - 1\]/.test(js),
    'best and worst are not taken from the ranked list');
  assert.ok(/higherIsBetter === false \? t\.value \/ v : v \/ t\.value/.test(js),
    'attainment no longer respects the direction of the target');
});

/* The audit analysis names what would cost accreditation. That has to be Core findings
   specifically — Core is the tier that is not offset by strength elsewhere. */
check('the audit analysis flags open Core elements as the risk', () => {
  const rep = read('audit/audit-report.js');
  assert.ok(/coreRisk/.test(rep), 'the Core risk block is gone');
  assert.ok(/\/\^core\$\/i\.test\(r\.category/.test(rep),
    'the risk list must filter on the Core category');
  assert.ok(/What would cost you/.test(rep), 'the risk callout lost its kicker');
  assert.ok(/Strongest area/.test(rep), 'the strongest-area callout is gone');
  /* sc.open is pre-sorted by severity, so taking from the front is taking the most serious. */
  assert.ok(/coreRisk\.slice\(0, 5\)/.test(rep), 'the risk list should show the worst few');
});

/* No literal colours: a chart with a hex is a chart that is wrong in two themes out of three. */
check('charts are drawn from theme tokens only', () => {
  const js = read('workspace/aq-charts.js');
  const hexes = (js.match(/#[0-9A-Fa-f]{6}\b/g) || []);
  assert.deepStrictEqual(hexes, [], 'literal colours in the toolkit: ' + hexes.join(', '));
  ['--ok', '--warn', '--nc', '--accent-bright', '--surface-2'].forEach(t =>
    assert.ok(js.includes(t), 'the toolkit should use ' + t));
});

/* Both surfaces must actually load it, with the same stamp as everything else. */
check('both surfaces load the toolkit', () => {
  const dash = read('dashboard.html'), aud = read('workspace/audit.html');
  assert.ok(/aq-charts\.js\?v=/.test(dash), 'the dashboard does not load the toolkit');
  assert.ok(/aq-charts\.css\?v=/.test(dash), 'the dashboard does not load the toolkit styles');
  assert.ok(/aq-charts\.js\?v=/.test(aud), 'the audit page does not load the toolkit');
  assert.ok(/aq-charts\.css\?v=/.test(aud), 'the audit page does not load the toolkit styles');
  /* Order matters: the report checks for window.AQCharts when it renders. */
  assert.ok(aud.indexOf('aq-charts.js') < aud.indexOf('audit-report.js'),
    'the toolkit must load before the report that uses it');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
