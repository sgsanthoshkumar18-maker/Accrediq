/* The walk-the-floor list, end to end: tick it on the floor, see it in the finished report,
 * find it in the Excel.
 *
 * This is going to be used to run a real internal audit, so the failure that matters is not
 * a wrong colour — it is a tick that does not survive a save, an item silently dropped from
 * the count, or a workbook Excel refuses to open. Those are what these cover.
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

console.log('audit-quicklist');

/* Boot the real data and the real engine against a bare window. No DOM is needed: the engine
   deliberately holds none, which is what makes this testable at all. */
function boot() {
  const win = { location: { href: 'http://localhost/' } };
  new Function('window', read('nabh-data.js'))(win);
  new Function('window', read('audit/scope-data.js'))(win);
  win.AQStore = null;
  new Function('window', read('audit/audit-engine.js'))(win);
  return win;
}

const win = boot();
const A = win.AQAudit;
const SCOPE = win.AUDIT_SCOPE || {};
const DEPTS = Object.keys(SCOPE);

check('the engine loads and every department is in scope', () => {
  assert.ok(A, 'AQAudit did not load');
  assert.ok(DEPTS.length >= 40, 'expected the full department set, got ' + DEPTS.length);
});

/* One wiring, every department. If a department were missing a list the tick UI would render
   nothing and that area's audit would quietly lose a whole section of its result. */
check('every department has a walk-the-floor list', () => {
  const without = DEPTS.filter(k => !(SCOPE[k].quickList || []).length);
  assert.deepStrictEqual(without, [], 'departments with no quick list: ' + without.join(', '));
});

check('a new session starts with an empty tick map', () => {
  const s = A.create(DEPTS[0], { name: 'Test', id: 'u1' });
  assert.deepStrictEqual(s.quick_checks, {}, 'quick_checks should start empty');
});

/* An unticked item is ABSENT, not "not checked". An audit that reports only what was looked
   at is the kind that passes here and fails on the day. */
check('unticked items are counted as absent, not skipped', () => {
  const dept = DEPTS.find(k => (SCOPE[k].quickList || []).length >= 3);
  const s = A.create(dept, { name: 'Test' });
  const q = A.quickSummary(s);
  assert.strictEqual(q.present.length, 0, 'nothing was ticked');
  assert.strictEqual(q.absent.length, q.total, 'every item should read as absent');
  assert.strictEqual(q.pct, 0, 'percent present should be 0, got ' + q.pct);
});

check('ticking is reflected in the summary and the percentage', () => {
  const dept = DEPTS.find(k => (SCOPE[k].quickList || []).length >= 4);
  const s = A.create(dept, { name: 'Test' });
  const list = A.quickSummary(s).list;
  s.quick_checks[list[0]] = true;
  s.quick_checks[list[1]] = true;
  const q = A.quickSummary(s);
  assert.strictEqual(q.present.length, 2, 'two items were ticked');
  assert.strictEqual(q.absent.length, q.total - 2, 'the rest must be absent');
  assert.strictEqual(q.pct, Math.round((2 / q.total) * 100), 'percentage does not match');
  assert.ok(q.present.includes(list[0]) && q.present.includes(list[1]),
    'the present list must name the ticked items');
});

/* A sub-area inherits its parent's list and adds its own, so an item can appear twice in the
   raw data. Counting it twice would make the denominator wrong and the percentage a lie. */
check('duplicated inherited items are counted once', () => {
  const dupes = DEPTS.filter(k => {
    const l = SCOPE[k].quickList || [];
    return new Set(l).size !== l.length;
  });
  dupes.forEach(k => {
    const s = A.create(k, { name: 'Test' });
    const q = A.quickSummary(s);
    assert.strictEqual(q.total, new Set(SCOPE[k].quickList).size,
      k + ' counts a duplicated item twice');
  });
  console.log('        (' + dupes.length + ' department(s) inherit a duplicated item)');
});

/* THE ONE THAT MATTERS ON THE FLOOR. A tick has to survive being written to storage and read
   back, or the auditor loses their morning's work when the tab reloads. */
check('ticks survive the save/hydrate round trip', () => {
  const dept = DEPTS.find(k => (SCOPE[k].quickList || []).length >= 3);
  const s = A.create(dept, { name: 'Test' });
  const list = A.quickSummary(s).list;
  s.quick_checks[list[0]] = true;
  s.quick_checks[list[2]] = true;
  s.finished_at = new Date().toISOString();
  s.status = 'completed';

  const row = A.summaryRow(s);
  assert.ok(row.payload.indexOf('quick_checks') > 0, 'quick_checks is not persisted');
  const back = A.hydrate(row);
  assert.deepStrictEqual(back.quick_checks, s.quick_checks, 'ticks were lost on hydrate');
  const q = A.quickSummary(back);
  assert.strictEqual(q.present.length, 2, 'the rehydrated session lost its ticks');
});

/* A session saved before the list became tickable has no map at all. The engine must not
   throw on it, or opening an old audit breaks. */
check('an audit saved before this feature still opens', () => {
  const dept = DEPTS[0];
  const legacy = A.create(dept, { name: 'Test' });
  delete legacy.quick_checks;
  const q = A.quickSummary(legacy);
  assert.strictEqual(q.present.length, 0, 'a legacy session should report nothing present');
  assert.strictEqual(q.total, new Set(SCOPE[dept].quickList).size, 'the list should still load');
});

/* The workbook: a sheet added to the file list but not to SHEETS — or the reverse — produces
   a workbook Excel refuses to open, which would be discovered at the worst moment. */
check('the workbook declares exactly as many sheets as it writes', () => {
  const xl = read('audit/audit-excel.js');
  const names = (xl.match(/var SHEETS = \[([\s\S]*?)\];/) || [, ''])[1]
    .split(',').map(s => s.trim()).filter(Boolean);
  const files = (xl.match(/ws\.file\("sheet\d+\.xml"/g) || []).length;
  assert.strictEqual(names.length, files,
    names.length + ' sheet names but ' + files + ' sheets written — Excel will reject the file');
  assert.ok(/Walk-the-Floor List/.test(xl), 'the walk-the-floor sheet is not in the workbook');
  assert.ok(/function quickSheet\(/.test(xl), 'quickSheet() is missing');
  /* Sheet numbering must be contiguous from 1, or the relationship ids do not line up. */
  const nums = (xl.match(/ws\.file\("sheet(\d+)\.xml"/g) || [])
    .map(s => +s.replace(/\D/g, '')).sort((a, b) => a - b);
  assert.deepStrictEqual(nums, nums.map((_, i) => i + 1), 'sheet numbers are not contiguous: ' + nums);
});

check('the report and the UI both read the shared summary', () => {
  assert.ok(/A\.quickSummary\(session\)/.test(read('audit/audit-report.js')),
    'the report does not use the engine summary — it would drift from the Excel');
  assert.ok(/window\.AQAudit\.quickSummary\(session\)/.test(read('audit/audit-excel.js')),
    'the Excel does not use the engine summary');
  const ui = read('audit/audit-ui.js');
  assert.ok(/data-quick=/.test(ui), 'the quick list has no checkboxes');
  assert.ok(/if \(!session\.quick_checks\) session\.quick_checks = \{\};/.test(ui),
    'the UI must guard against a session saved before this existed');
  assert.ok(/A\.save\(session\)/.test(ui), 'a tick must persist immediately');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
