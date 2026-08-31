/* Quality Dashboard — department analytics.
 *
 * The drill-down used to be a KRA list and a KPI table. It now carries charts, real element
 * counts and an edit mode that writes a hospital's own figures over the shipped samples.
 * These guard the parts that are easy to break silently: the attainment maths that decides
 * how long a bar is, the override layer that must never mutate the source data, and the
 * rule that no trend is invented when there is no history to draw.
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

console.log('dept-analytics');

/* Load the module against a minimal DOM-free window. Only the pure helpers are exercised
   here; the rendering is verified in a browser, where it can actually be measured. */
function load(extraWindow) {
  const store = {};
  const win = Object.assign({
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    dispatchEvent() {}, CustomEvent: function () {}
  }, extraWindow || {});
  new Function('window', read('workspace/dept-analytics.js'))(win);
  return { api: win.AQDeptAnalytics, store, win };
}

check('module loads without a DOM', () => {
  const { api } = load();
  assert.ok(api && typeof api.render === 'function', 'render missing');
  assert.ok(typeof api.merged === 'function', 'merged missing');
});

/* THE OVERRIDE LAYER MUST NOT MUTATE THE SHIPPED DATA. DEPTS is a module-level array reused
   by the grid, the globe and the search; writing a hospital's edits into it would leak one
   hospital's figures into the sample everyone else sees on the same page load. */
check('merged() never mutates the source department', () => {
  const { api, win } = load();
  const src = { id: 'hic', name: 'Infection Control', short: 'IPC', score: 91, status: 'ok',
                kra: ['a'], kpi: [['K', '86%', '>= 80%', 'ok']] };
  const snapshot = JSON.stringify(src);
  win.localStorage.setItem('aq-dept-overrides', JSON.stringify({ hic: { score: 55 } }));
  const out = api.merged(src);
  assert.strictEqual(out.score, 55, 'override did not apply');
  assert.strictEqual(JSON.stringify(src), snapshot, 'the source object was modified');
  assert.strictEqual(src.score, 91, 'source score was overwritten');
});

check('a department with no override is returned untouched', () => {
  const { api } = load();
  const src = { id: 'zzz', score: 70, kra: [], kpi: [] };
  assert.strictEqual(api.merged(src), src, 'a clean department should be the same object');
});

/* NO INVENTED TRENDS. A quality dashboard that draws a plausible line from nothing produces
   a number that can end up in front of an assessor. The empty state has to survive. */
check('no trend is generated when there is no history', () => {
  const js = read('workspace/dept-analytics.js');
  assert.ok(/series\.length < 2/.test(js), 'the trend guard is gone');
  assert.ok(/da-trend-empty/.test(js), 'the empty state was removed');
  assert.ok(!/Math\.random/.test(js), 'the module must never generate figures');
});

/* THE COMPARATOR IN A TARGET DECIDES WHICH DIRECTION IS GOOD. "< 2.0" met by 1.4 is doing
   well; the same 1.4 against ">= 80%" is not. Getting this backwards would colour a failing
   KPI green, which is worse than showing no chart at all. */
check('attainment respects the direction of the target', () => {
  const js = read('workspace/dept-analytics.js');
  assert.ok(/higherIsBetter === false \? t\.value \/ v : v \/ t\.value/.test(js),
    'the lower-is-better branch is missing or inverted');
  assert.ok(/[≥>]/.test(js) && /[≤<]/.test(js), 'the comparators are not both recognised');
});

/* The counts on the tiles are real NABH figures, read from the chapter-keyed dataset. An
   array filter here silently returns nothing and the tiles just disappear. */
check('chapter facts walk the chapter-keyed dataset', () => {
  const js = read('workspace/dept-analytics.js');
  assert.ok(/window\.NABH_DATA && window\.NABH_DATA\.chapters/.test(js),
    'NABH_DATA is chapter-keyed, not an array');
  assert.ok(/c\.standards/.test(js) && /s\.elements/.test(js),
    'element counts must walk standards then elements');
  assert.ok(/refChapters/.test(js), 'committees link by refChapters, not a string search');
});

/* Editing is a role, not a mood. Against a real backend only the people who own quality may
   change the hospital's figures. */
check('edit permission is limited to the quality roles', () => {
  const js = read('workspace/dept-analytics.js');
  assert.ok(/"owner", "admin", "quality", "quality_manager", "director"/.test(js),
    'the editing roles changed unexpectedly');
});

/* The dashboard has to actually load the module, and with the same stamp as everything else
   or the browser keeps yesterday's copy. */
check('the dashboard loads the analytics module', () => {
  const html = read('dashboard.html');
  assert.ok(/workspace\/dept-analytics\.css\?v=/.test(html), 'stylesheet not linked');
  assert.ok(/workspace\/dept-analytics\.js\?v=/.test(html), 'script not loaded');
  assert.ok(/AQDeptAnalytics\.render\(detail, d, !!startInEdit\)/.test(html), 'drill-down not wired');
  assert.ok(/AQDeptAnalytics\.merged\(src\)/.test(html), 'grid tiles do not show saved edits');
  /* The edit entry point must be gated on the module's own permission check, not merely
     hidden with CSS — a hidden button is still a button. */
  assert.ok(/AQDeptAnalytics\.canEdit\(\)/.test(html),
    'the edit entry point is not gated on canEdit()');
  assert.ok(/id="deptEditMode" hidden/.test(html),
    'the edit button must ship hidden and only be revealed for permitted roles');
  const stamps = new Set((html.match(/\?v=[0-9a-zA-Z._-]+/g) || []));
  assert.strictEqual(stamps.size, 1, 'mixed cache stamps: ' + [...stamps].join(', '));
});

/* EVERY TILE OPENS INTO THE RECORDS BEHIND ITS NUMBER. "13 Core elements" that cannot tell
 * you which thirteen is a number without a use, and it was sending people to the standards
 * page to find out. The detail comes from the real datasets, so a tile that silently returns
 * nothing means the lookup drifted from the data shape. */
check('every tile has detail content behind it', () => {
  const js = read('workspace/dept-analytics.js');
  ['kra', 'kpi', 'ontarget', 'elements', 'core', 'commitment', 'committees'].forEach(k =>
    assert.ok(js.includes('"' + k + '"'), 'no tile detail for ' + k));
  assert.ok(/function tileDetail\(/.test(js), 'tileDetail() is missing');
  assert.ok(/data-tile="/.test(js), 'tiles are not buttons');
  /* Counts and lists must come from the same walk, or a tile can say 13 and open 12. */
  assert.ok(/out\.core = out\.coreList\.length/.test(js),
    'the Core count must be derived from the list it opens, not counted separately');
  assert.ok(/out\.commitment = out\.commitmentList\.length/.test(js),
    'the Commitment count must be derived from the list it opens');
  assert.ok(/out\.committees = cm\.length/.test(js),
    'the committee count must be derived from the list it opens');
});

/* The globe's CTA said "Open full department profile" and navigated to the standards page,
 * which lists a chapter's elements and says nothing about the department. */
check('the globe CTA opens the department profile, not the standards page', () => {
  const qg = read('qglobe/qglobe.js');
  assert.ok(/openDeptDetailFromQGlobe/.test(qg),
    'the CTA does not call the dashboard hook');
  assert.ok(/data-qg-profile=/.test(qg), 'the CTA is not addressable');
  /* The href stays as a fallback for pages with no dashboard, and for middle-click. */
  assert.ok(/ev\.metaKey \|\| ev\.ctrlKey \|\| ev\.shiftKey/.test(qg),
    'opening in a new tab must still work');
});

/* Charts are drawn from tokens so they follow light, dark and neon with no per-theme rule.
   A literal hex here is a colour that will be wrong in two themes out of three. */
check('charts are drawn from theme tokens, not literals', () => {
  const js = read('workspace/dept-analytics.js');
  const hexes = (js.match(/#[0-9A-Fa-f]{6}\b/g) || []);
  assert.deepStrictEqual(hexes, [], 'literal colours in the charts: ' + hexes.join(', '));
  assert.ok(/var\(--ok\)/.test(js) && /var\(--warn\)/.test(js) && /var\(--nc\)/.test(js),
    'status colours must come from the semantic tokens');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
