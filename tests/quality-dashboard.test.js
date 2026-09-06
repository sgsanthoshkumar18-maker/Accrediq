/* THE HOSPITAL'S OWN QUALITY DASHBOARD.
 *
 * This page turns numbers a hospital types into a percentage it will report upwards, so the
 * failure that matters is not a broken chart — it is a chart that draws confidently and says
 * the wrong thing. Two ways that happens here:
 *
 *   1. DIRECTION. An infection rate of 3 against a target of 2 is WORSE than target. Scored as
 *      "achieved ÷ target" it comes out at 150% and the dashboard congratulates a hospital for
 *      getting sicker. Every metric therefore carries which way is good, and the maths has to
 *      honour it.
 *   2. A BLANK IS NOT A ZERO. A month nobody measured must not be stored as 0, or the trend
 *      draws a cliff that never happened and somebody explains it at a review.
 *
 * The scoring is lifted out of the module and exercised directly, because it is the part that
 * has no visible symptom when it is wrong.
 */
const path = require('path');
const fs = require('fs');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

const SRC = fs.readFileSync(path.join(__dirname, '../workspace/quality-dashboard.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../workspace/quality-dashboard.css'), 'utf8');
const SQL = fs.readFileSync(path.join(__dirname, '../workspace/schema.sql'), 'utf8');
const CHARTS = fs.readFileSync(path.join(__dirname, '../workspace/aq-charts.js'), 'utf8');

/* ------------------------------------------------------------------ the scoring maths */
const num = new Function('return function num(v){ var n = parseFloat(v); return isFinite(n) ? n : null; }')();
const attainment = new Function('num', 'return ' +
  SRC.match(/function attainment\(metric, achieved\) \{[\s\S]*?\n  \}/)[0])(num);

const up = t => ({ target: t, higher_is_better: true });
const down = t => ({ target: t, higher_is_better: false });

eq(attainment(up(95), 95), 100, 'exactly on a higher-is-better target is 100%');
eq(attainment(up(95), 79.5), 84, '79.5 against 95 is 84% of the way there');
eq(attainment(up(95), 0), 0, 'nothing achieved is nothing, not an error');

/* The one that matters. */
eq(attainment(down(2), 2), 100, 'exactly on a lower-is-better target is 100%');
eq(attainment(down(2), 2.6), 77, 'an infection rate ABOVE target scores below 100, not above');
eq(attainment(down(2), 1), 150, 'and beating it scores over 100, capped so one metric cannot ' +
   'carry a department on its own');
eq(attainment(down(24), 48) < 100, true, 'a turnaround time of double the target is failing');
eq(attainment(down(3), 0), 100, 'zero of a bad thing is full marks, not a divide by zero');

eq(attainment(up(95), null), null, 'no reading is not a score of zero');
eq(attainment({ target: null, higher_is_better: true }, 80), null, 'no target is not a score either');

/* Capped, so a single wildly-beaten metric cannot drag a department's average above what the
   rest of it deserves. */
eq(attainment(up(10), 1000), 150, 'attainment is capped at 150%');

/* ------------------------------------------------------------- a blank month is not a zero */
eq(/if \(String\(v\)\.trim\(\) === ""\) \{[\s\S]{0,200}?remove\(READINGS/.test(SRC), true,
   'an empty box removes the reading rather than storing 0 — a month nobody measured must not ' +
   'draw a cliff on the trend');

/* --------------------------------------------------------------- the month is stamped, in IST */
eq(/function thisMonth\(\)/.test(SRC), true, 'readings are filed by month');
eq(/\(5 \* 60 \+ 30\) \* 60 \* 1000/.test(SRC), true,
   'in IST, like the rest of the platform — a figure typed late on the 31st must not land in ' +
   'the following month');
eq(/toISOString\(\)\.slice\(0, 7\) \+ "-01"/.test(SRC), true,
   'always the first of the month, so two hospitals’ Septembers are comparable');
eq(/unique \(metric_id, month\)/.test(SQL), true,
   'one reading per metric per month, updated in place rather than appended');

/* ------------------------------------------------------ nothing is written half-finished */
eq(/rows\.forEach\(function \(r\) \{[\s\S]*?every row needs a target/.test(SRC), true,
   'measures are validated before the first one is written — half a department saved is worse ' +
   'than none, because the dashboard would score it against an incomplete list');

/* ------------------------------------------------------------- it degrades, never blanks */
eq(/PGRST205/.test(SRC), true,
   'a database without these tables yet is a setup step, and must say so rather than ' +
   'rendering an empty page');
eq(/try \{ await refresh\(\); \} catch/.test(SRC), true,
   'and start-up cannot reject out and leave nothing on screen');

/* --------------------------------------------------------- the general dashboard is intact */
{
  const general = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
  eq(/quality-dashboard\.html/.test(general), true,
     'the general dashboard offers the custom one');
  eq(/id="qdPanel"/.test(general), false,
     'but is not itself replaced by it — a half-finished setup must never leave a hospital ' +
     'worse off than before they started');
}

/* --------------------------------------------------------------- the shared chart vocabulary */
eq(/pie: pie, pareto: pareto/.test(CHARTS), true,
   'pie and pareto live in the shared toolkit, not in this page — the dashboard and the audit ' +
   'analysis must keep reading as one product');
eq(/if \(clean\.length > 6\)/.test(CHARTS), true,
   'a pie collapses past six slices, because nobody can rank twenty slivers by eye');
eq(/Math\.round\(\(r\.v \/ total\) \* 100\)/.test(CHARTS), true,
   'and every slice is labelled with its own percentage — colour alone cannot carry a ' +
   'compliance figure');

/* Status colour is not the accent: "on target" must never be the same blue as "this is a link". */
eq(/\.qd-badge\.ok\{color:var\(--ok\)/.test(CSS), true, 'on-target uses the status token');
eq(/\.qd-badge\.nc\{color:var\(--nc\)/.test(CSS), true, 'and so does needs-attention');
eq(/#[0-9a-fA-F]{3,8}\b/.test(CSS.replace(/\/\*[\s\S]*?\*\//g, '')), false,
   'no hardcoded colour anywhere in the stylesheet');

/* ------------------------------------------------------------------ findings

   The open-findings line is the one derivation here with no visible symptom when it is
   wrong: it draws a confident curve either way. "Open at the end of month M" means raised
   on or before M and not closed until AFTER M — the off-by-one that closes a finding in
   the month it was raised and still counts it as open all month is exactly the kind of
   thing a hospital would report upwards without noticing. */
const openAtMonth = (function () {
  const body = SRC.match(/function openAtMonth\(iso\) \{[\s\S]*?\n  \}/)[0];
  return new Function('findings', 'return (' + body.replace('function openAtMonth', 'function') + ')');
})();

const FS = [
  { raised_month: '2026-01-01', closed_month: null },          // still open
  { raised_month: '2026-01-01', closed_month: '2026-01-01' },  // raised and closed same month
  { raised_month: '2026-02-01', closed_month: '2026-04-01' },
  { raised_month: '2026-05-01', closed_month: null }
];
const at = (m) => openAtMonth(FS)(m);

eq(at('2025-12-01'), 0, 'nothing is open before the first finding was raised');
eq(at('2026-01-01'), 1, 'a finding closed in the month it was raised is NOT open at month end');
eq(at('2026-02-01'), 2, 'the January one still open, plus February');
eq(at('2026-03-01'), 2, 'a finding closed in April is still open through March');
eq(at('2026-04-01'), 1, 'and is gone by the end of April');
eq(at('2026-06-01'), 2, 'both still-open findings count in a later month');

/* A hospital two months in must not be shown ten months of flat zero — that reads as
   "nothing went wrong", not "we were not using this yet". */
eq(/function findingMonths\(\)/.test(SRC), true, 'the trend is drawn only over recorded months');
eq(/for \(var m = 0; m < 12/.test(SRC), false, 'no fixed twelve-month window is assumed');

/* One table, read three ways. If the schema ever grew a stored per-month open count, the
   number on the chart and the findings behind it could disagree with nothing to reconcile. */
eq(/create table if not exists public\.qd_findings/.test(SQL), true, 'findings are rows, not a summary');
eq(/raised_month\s+date not null/.test(SQL), true, 'every finding carries the month it was raised');
eq(/closed_month\s+date\b/.test(SQL), true, 'and an optional month it was closed');
eq(/open_count/.test(SQL), false, 'no stored open count that could drift from the rows');

/* Both new tables must carry updated_at and be inside the RLS and org-stamp loops, or every
   save is refused — the exact failure that broke qd_departments and code_blue_events before. */
['qd_findings', 'qd_obligations'].forEach((t) => {
  eq(new RegExp('alter table public\\.' + t + '\\s+add column if not exists updated_at').test(SQL),
     true, t + ' carries updated_at');
  eq(new RegExp('alter table public\\.' + t + '\\s+enable row level security').test(SQL), true,
     t + ' has row level security on');
  eq((SQL.match(new RegExp("'" + t + "'", 'g')) || []).length >= 2, true,
     t + ' is in the policy loop AND the set_org_id trigger loop');
});

/* Committees are deliberately absent from the month record: the workspace already runs a
   committee calendar, and two sources for one figure is two answers. */
eq(/committees_held_pct/.test(SQL), false, 'the month record does not re-ask for committees');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
