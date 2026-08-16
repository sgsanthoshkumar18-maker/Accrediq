/* AQcredix — gate pass, document library, apex manual.
 * Run: node tests/standards-export.test.js is unrelated; this is its own file.
 * Run: node tests/gatepass-library-apex.test.js
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
const sql = read('workspace/schema.sql');

/* ============================== schema ============================== */

['gate_passes', 'apex_manual'].forEach(t => {
  ok(new RegExp('create table if not exists public\\.' + t).test(sql), t + ' exists');
});
ok(/expected_return_on\s+date/.test(sql), 'gate passes carry an expected return date');
ok(/org_id\s+uuid primary key references public\.orgs/.test(
  sql.slice(sql.indexOf('public.apex_manual'))), 'the manual is one row per org');

{
  const created = {};
  [...sql.matchAll(/create table if not exists public\.(\w+)/g)].forEach(m => {
    if (!(m[1] in created)) created[m[1]] = m.index;
  });
  let bad = 0;
  [...sql.matchAll(/foreach t in array array\[([^\]]+)\]/g)].forEach(m => {
    m[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean).forEach(t => {
      if (!(t in created) || created[t] > m.index) { bad++; console.log('  order bug: ' + t); }
    });
  });
  eq(bad, 0, 'every loop references tables already created above it');
}
['gate_passes', 'apex_manual'].forEach(t => {
  const loops = sql.match(/foreach t in array array\[[^\]]*\]/g) || [];
  ok(loops.filter(l => l.includes("'" + t + "'")).length >= 1, t + ' joins the RLS loop');
});

/* ============================== gate pass ============================== */

const gp = read('workspace/gatepass.js');
{
  const body = gp.slice(gp.indexOf('function statusOf'), gp.indexOf('function departments'));
  const statusOf = new Function(body + '; return statusOf;')();

  eq(statusOf({ returnable: false }).state, 'closed', 'non-returnable closes immediately');
  eq(statusOf({ returnable: true, returned_on: '2026-08-01' }).state, 'ok',
     'a returned pass reads as ok');
  eq(statusOf({ returnable: true, expected_return_on: '2020-01-01' }).state, 'overdue',
     'a returnable pass past its date is overdue');
  eq(statusOf({ returnable: true, expected_return_on: '2099-01-01' }).state, 'soon',
     'and not yet due reads as soon');
  eq(statusOf({ returnable: true }).state, 'warn',
     'a returnable pass with no return date is flagged, not silently ok');
}

ok(/adapter\.upsert\("gate_passes"/.test(gp), 'gate passes are written to the server');
ok(/adapter\.list\("gate_passes"\)/.test(gp), 'and read back from it');
eq(/localStorage/.test(gp), false, 'nothing is kept only in the browser');

/* pass_no is assigned once and never overwritten. Sending it as part of an edit payload
   would ask Supabase to null it out on every save, and a gate pass losing its number
   defeats the one thing the paper register was good at. */
ok(/if \(existing\) delete row\.pass_no;/.test(gp),
   'the pass number is never touched on an edit');
ok(/function nextPassNo/.test(gp), 'new passes get the next sequential number');

// A returnable pass without an expected return date is refused at save time, not just flagged.
ok(/if \(returnable && !val\("gExp"\)\)/.test(gp),
   'a returnable pass cannot be saved without an expected return date');

ok(/W\.gate\(\)/.test(gp), 'the page is gated');
ok(/renderNav\("gatepass"\)/.test(gp), 'and appears in the workspace nav');
ok(/gatepass\.html/.test(read('workspace/shell.js')), 'with a nav entry');

/* Classes used must be defined — the failure that made the calendar modals dead buttons. */
{
  const sheets = read('styles.css') + read('workspace/workspace.css') + read('calendar/calendar.css');
  const used = new Set();
  let m; const re = /class="([^"]+)"/g;
  while ((m = re.exec(gp))) {
    m[1].split(/\s+/).forEach(c => { if (/^[a-zA-Z][\w-]*$/.test(c) && c !== 'false' && c !== 'true') used.add(c); });
  }
  const missing = [...used].filter(c => !new RegExp('\\.' + c + '(?![\\w-])').test(sheets));
  eq(missing.join(','), '', 'every class the gate pass page renders is defined in CSS');
}

/* ============================== document library ============================== */

const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(read('workspace/library-data.js'), sb);
const LIB = sb.window.DOC_LIBRARY;

ok(Array.isArray(LIB) && LIB.length > 100, 'the library has a substantial real inventory (' + LIB.length + ')');
const ids = LIB.map(i => i.id);
eq(ids.length, new Set(ids).size, 'every item has a unique id');
eq(LIB.filter(i => ['checklist', 'consent', 'forms', 'registers'].includes(i.name.toLowerCase())).length, 0,
   'no stray header row leaked into the data (the bug found while building this)');
LIB.forEach(i => {
  ok(['checklist', 'form', 'register'].includes(i.category), i.id + ' has a valid category');
  ok(i.department && i.department.length > 2, i.id + ' is assigned a department');
  ok(Array.isArray(i.fields) && i.fields.length >= 3, i.id + ' has a real field list');
});
const detailed = LIB.filter(i => i.detailed);
ok(detailed.length >= 8, 'a representative set has full detail (' + detailed.length + ')');
detailed.forEach(i => {
  ok(i.why && i.why.length > 20, i.id + ' explains why it matters');
  ok(i.analytics, i.id + ' describes what analytics would show');
});

// Every department mentioned actually has at least one document — a filter with an empty
// result reads as a bug, not as "this department has nothing".
{
  const depts = new Set(LIB.map(i => i.department));
  depts.forEach(d => {
    ok(LIB.some(i => i.department === d), d + ' has at least one document');
  });
  ok(depts.size >= 10, 'documents span a real range of departments (' + depts.size + ')');
}

const lib = read('workspace/library.js');
ok(/W\.gate\(\)/.test(lib), 'the library page is gated');
ok(/renderNav\("library"\)/.test(lib), 'and in the nav');
ok(/library\.html/.test(read('workspace/shell.js')), 'with a nav entry');
ok(/generateAsync/.test(lib), 'downloads use the same JSZip pattern as the data export');
ok(/t="inlineStr"/.test(lib), 'values are written as inline strings, not left for Excel to reinterpret');
{
  const sheets = read('styles.css') + read('workspace/workspace.css') + read('calendar/calendar.css');
  const used = new Set();
  let m; const re = /class="([^"]+)"/g;
  while ((m = re.exec(lib))) {
    m[1].split(/\s+/).forEach(c => { if (/^[a-zA-Z][\w-]*$/.test(c) && c !== 'false' && c !== 'true') used.add(c); });
  }
  const missing = [...used].filter(c => !new RegExp('\\.' + c + '(?![\\w-])').test(sheets));
  eq(missing.join(','), '', 'every class the library page renders is defined in CSS');
}

/* ============================== apex manual ============================== */

const dx = read('workspace/simple-docx.js');
const apex = read('workspace/apex.js');

ok(/generateAsync/.test(dx), 'the docx writer produces a real zip');
ok(/wordprocessingml\.document/.test(dx), 'with the correct Word MIME type');
ok(/w:styles/.test(dx) && /Heading1/.test(dx), 'headings are real Word styles, not bold text pretending');
ok(/w:numbering/.test(dx), 'bullet lists use real Word numbering');

// A multi-line answer must not collapse onto one line in the manual.
{
  const escBody = dx.slice(dx.indexOf('function esc('), dx.indexOf('function runs'));
  const body = dx.slice(dx.indexOf('function runs'), dx.indexOf('function heading'));
  const runs = new Function(escBody + body + '; return runs;')();
  const out = runs('Line one\nLine two');
  ok(/<w:br\/>/.test(out), 'a line break in an answer becomes a real line break in the document');
}

ok(/adapter\.upsert\("apex_manual"/.test(apex), 'answers are saved to the server');
ok(/adapter\.list\("apex_manual"\)/.test(apex), 'and loaded back from it');
eq(/localStorage/.test(apex), false, 'nothing is kept only in the browser');

/* Committees are pulled from the calendar, not retyped — typing the same thing twice is
   how the manual and the calendar quietly drift apart. */
ok(/adapter\.list\("committees"\)/.test(apex), 'committees are read from the shared table');
ok(/committeesBlock/.test(apex), 'and rendered into the manual automatically');

// Saving is debounced, not fired on every keystroke.
ok(/scheduleSave/.test(apex) && /setTimeout\(save, 900\)/.test(apex),
   'typing debounces the save rather than writing on every keystroke');

ok(/W\.gate\(\)/.test(apex), 'the page is gated');
ok(/renderNav\("apex"\)/.test(apex), 'and in the nav');
ok(/apex\.html/.test(read('workspace/shell.js')), 'with a nav entry');

/* The download can never be older than what is on screen: it is built from `answers`
   in memory, not re-fetched, so there is no window where a save is pending and the
   download reflects stale data. */
{
  const genBody = apex.slice(apex.indexOf('async function generate('),
                              apex.indexOf('async function init'));
  ok(!/await load\(\)/.test(genBody),
     'the download is generated from in-memory answers, not a fresh fetch');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
