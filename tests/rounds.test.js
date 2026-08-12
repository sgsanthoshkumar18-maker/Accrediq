/* AQcredix — rounds/checklist engine and the homepage tour.
 * Run: node tests/rounds.test.js
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
const rd = read('workspace/rounds.js');
const tour = read('home-tour.js');
const home = read('index.html');
const css = read('styles.css');

/* -------------------------------- the schema -------------------------------- */

['checklists', 'checklist_items', 'rounds'].forEach(t => {
  ok(new RegExp('create table if not exists public\\.' + t).test(sql), t + ' exists');
});

/* Questions are ROWS, not a JSON blob on the checklist. A round can then reference the
   exact item it scored, and editing a checklist next quarter cannot silently rewrite what
   last quarter's round was measured against. */
ok(/checklist_id\s+text references public\.checklists\(id\) on delete cascade/.test(sql),
   'questions belong to a checklist');
ok(/critical\s+boolean not null default false/.test(sql), 'items can be marked critical');
ok(/target_pct\s+numeric default 90/.test(sql),
   'a checklist carries the target it is held to');
ok(/capa_id\s+text/.test(sql),
   'a failed round can be traced to the CAPA raised against it');

// Order: every loop must reference tables already created above it.
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
  eq(bad, 0, 'every loop references tables already created');
}

['checklists', 'checklist_items', 'rounds'].forEach(t => {
  const loops = sql.match(/foreach t in array array\[[^\]]*\]/g) || [];
  ok(loops.filter(l => l.includes("'" + t + "'")).length >= 2,
     t + ' is in both the RLS and org-stamping loops');
});

/* --------------------------------- scoring ---------------------------------
   The one piece of real logic here. Run against a real checklist rather than asserted
   on source text. */
{
  const body = rd.slice(rd.indexOf('function itemsOf'), rd.indexOf('function trend'));
  const items = [
    { id: 'q1', checklist_id: 'L', position: 0, text: 'a', critical: false },
    { id: 'q2', checklist_id: 'L', position: 1, text: 'b', critical: false },
    { id: 'q3', checklist_id: 'L', position: 2, text: 'c', critical: true },
    { id: 'q4', checklist_id: 'L', position: 3, text: 'd', critical: false }
  ];
  const { score } = new Function('items', body + '; return {score,itemsOf};')(items);
  const L = { id: 'L', target_pct: 90 };

  eq(score({ q1: 'yes', q2: 'yes', q3: 'yes', q4: 'yes' }, L).pct, 100, 'all yes scores 100');
  eq(score({ q1: 'yes', q2: 'yes', q3: 'yes', q4: 'no' }, L).pct, 75, 'one no scores 75');
  eq(score({ q1: 'yes', q2: 'yes', q3: 'yes', q4: 'no' }, L).passed, false,
     '75 is below a 90 target');

  /* N/A is EXCLUDED from the denominator, not counted as a pass. A crash cart with no
     paediatric drawer should not score 100% for having nothing to check — and should not
     be punished for a drawer it is not required to have either. */
  const na = score({ q1: 'yes', q2: 'yes', q3: 'yes', q4: 'na' }, L);
  eq(na.pct, 100, 'N/A is excluded from the denominator');
  eq(na.answered, 3, 'and from the count of applicable items');
  eq(na.total, 4, 'while the total still reflects the checklist');

  /* A critical item failing fails the round outright. You cannot average away a missing
     resuscitation drug, and a hospital scoring 95% with a dead defibrillator has learned
     nothing from the round. */
  const crit = score({ q1: 'yes', q2: 'yes', q3: 'no', q4: 'yes' }, L);
  eq(crit.pct, 75, 'a critical failure still reports the percentage');
  eq(crit.criticalFail, true, 'and flags the critical failure');
  eq(crit.passed, false, 'and cannot pass');

  // A critical failure fails even when the percentage would otherwise clear the target.
  const L0 = { id: 'L', target_pct: 0 };
  eq(score({ q1: 'yes', q2: 'yes', q3: 'no', q4: 'yes' }, L0).passed, false,
     'a critical failure overrides even a zero target');

  eq(score({}, L).pct, null, 'an unanswered round has no score');
  eq(score({}, L).passed, null, 'and no verdict');
}

/* ------------------------------- persistence ------------------------------- */

['checklists', 'checklist_items', 'rounds'].forEach(t => {
  ok(new RegExp('adapter\\.upsert\\("' + t + '"').test(rd), t + ' is written to the server');
});
ok(/adapter\.list\("rounds"\)/.test(rd), 'and read back from it');
eq(/localStorage/.test(rd), false, 'nothing is kept only in the browser');

// Recorded rounds beat the typed date, and the two are kept in step.
ok(/function lastDone/.test(rd), 'the last round is derived from recorded rounds');
ok(/l\.last_done_on = on/.test(rd), 'and the stored field is updated to match');

/* Removing a checklist is a soft delete, but removing a QUESTION is a real delete — a
   question is not evidence, the round is, and a round stores its own answers, so removing
   a question cannot orphan a past score. */
ok(/l\.active = false/.test(rd), 'removing a checklist is a soft delete');
ok(/adapter\.remove\("checklist_items"/.test(rd), 'but a removed question is deleted');

ok(/AQSchedule/.test(rd), 'due dates come from the shared engine');
eq(/new Date\([^)]*\)\s*[-+]/.test(rd), false, 'and no date arithmetic is done here');

// The live score is what makes a round usable while walking it.
ok(/function paintLive/.test(rd), 'the score updates as answers are given');
ok(/below target/.test(rd), 'and says plainly when it is below target');

ok(/W\.gate\(\)/.test(rd), 'the page is gated');
ok(/renderNav\("rounds"\)/.test(rd), 'and is in the workspace nav');
ok(/rounds\.html/.test(read('workspace/shell.js')), 'with a nav entry');

// Classes must exist — the failure that made the calendar modals dead buttons.
{
  const sheets = read('styles.css') + read('workspace/workspace.css') + read('calendar/calendar.css');
  const used = new Set();
  let m; const re = /class="([^"]+)"/g;
  while ((m = re.exec(rd))) {
    m[1].split(/\s+/).forEach(c => {
      // Skip template expressions caught by the crude class regex — "false" is the tail
      // of a ternary, not a class name.
      if (/^[a-zA-Z][\w-]*$/.test(c) && c !== 'false' && c !== 'true') used.add(c);
    });
  }
  const missing = [...used].filter(c => !new RegExp('\\.' + c + '(?![\\w-])').test(sheets));
  eq(missing.join(','), '', 'every class the rounds page renders is defined in CSS');
  ok(/classList\.add\("open"\)/.test(rd), 'and the modal uses the class the stylesheet keys on');
}

/* -------------------------------- the tour -------------------------------- */

ok(/tour-strip/.test(home), 'the homepage has a tour section');
ok(/id="tourStage"/.test(home), 'with a stage');
ok(/home-tour\.js/.test(home), 'and the script loaded');

/* Every locked page must appear, or the tour undersells exactly what is being paid for. */
['readiness', 'standards', 'departments', 'calendar', 'register', 'rounds', 'capa', 'export']
  .forEach(k => ok(new RegExp('key: "' + k + '"').test(tour), 'the tour covers ' + k));

/* HONESTY. Screenshots would show either invented hospital data as though it were real,
   or an empty demo account that makes the product look unused. */
ok(/Illustrative screens/.test(home), 'the frame says the screens are illustrative');
ok(/\.tour-mock\{/.test(css), 'and the label is styled, not hidden');

// Autoplay must yield to the person the moment they take control.
ok(/touched = true/.test(tour), 'manual control stops autoplay');
ok(/if \(touched\) return;/.test(tour), 'and it never resumes on its own afterwards');
ok(/prefers-reduced-motion/.test(tour), 'reduced motion disables autoplay');
ok(/IntersectionObserver/.test(tour), 'it only plays while on screen');
ok(/visibilitychange/.test(tour), 'and pauses in a hidden tab');
ok(/clearInterval/.test(tour), 'the timer is actually cleared, not just flagged');

/* Restarting a CSS animation needs the property removed and reflowed; setting the same
   value again does nothing, so the progress bar would freeze on the second frame. */
ok(/void bar\.offsetWidth/.test(tour), 'the progress bar animation is restarted properly');

// Element codes shown must be real, same rule as the flow section.
{
  const dsb = { window: {}, console };
  vm.createContext(dsb);
  vm.runInContext(read('nabh-data.js'), dsb);
  const D = dsb.window.NABH_DATA;
  const known = new Set();
  Object.keys(D.chapters).forEach(ch => (D.chapters[ch].standards || []).forEach(s => {
    known.add(s.code);
    (s.elements || []).forEach(e => known.add(s.code + '.' + e.letter));
  }));
  const shown = [...new Set(tour.match(/\b[A-Z]{3}\.\d+(\.[a-z])?\b/g) || [])];
  ok(shown.length >= 4, 'the tour references real element codes (' + shown.length + ')');
  eq(shown.filter(c => !known.has(c)).join(', '), '', 'every code shown exists in the data');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
