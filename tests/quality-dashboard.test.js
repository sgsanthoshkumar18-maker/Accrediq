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
/* NO HARDCODED COLOUR — with exactly one declared exception, and it has to stay declared.
   The ten code alert hues are the one place on this page where the colour IS the datum: a
   Code Red bar drawn in the platform blue is unreadable to the people who use these names
   every day. They are allowed as literals ONLY inside the :root / [data-theme="dark"] token
   blocks, so both themes get a value that survives their own ground — two of them invert,
   Code Black being invisible on dark and Code White on light. A literal anywhere else in
   this stylesheet is the bug this rule was written to catch, and still fails. */
const CSS_BODY = CSS
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(?::root|\[data-theme="dark"\])\{[^}]*--code-[\s\S]*?\}/g, '');
eq(/#[0-9a-fA-F]{3,8}\b/.test(CSS_BODY), false,
   'no hardcoded colour outside the declared code-alert token blocks');
eq(/:root\{[\s\S]{0,400}--code-black:/.test(CSS), true, 'the code colours are tokens');
eq(/\[data-theme="dark"\]\{[\s\S]{0,400}--code-black:/.test(CSS), true,
   'and every one of them is redefined for the dark theme');
eq(/"var\(--code-blue\)"/.test(SRC), true, 'the script names the token, never the hex');
eq(/#[0-9a-fA-F]{6}/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), false,
   'so no hex reaches the JavaScript at all');

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

/* ======================== THE FIVE SECTIONS ========================
 *
 * The board became five boards: KPI, Committee, Incident, Code alert, NABH readiness. The
 * failure that matters here is not a missing chart — it is a section that invents a second
 * copy of data another page already owns. A hospital with two incident tables has two
 * incident counts and no way to tell an assessor which is true, and the same goes for
 * committees and the element register. So the tests below check WHERE each section reads
 * from at least as hard as they check what it draws.
 */
['kpi', 'committee', 'incident', 'code', 'nabh'].forEach((s) => {
  eq(new RegExp('sec: "' + s + '"').test(SRC), true, s + ' section has tiles of its own');
});
eq(/SECTIONS = \[/.test(SRC), true, 'the five sections are declared once, as data');
eq(/qd-tabs/.test(SRC) && /\.qd-tabs\{/.test(CSS), true, 'and rendered as a real tab strip');

/* Only the KPI section owns tables. The other four read what the workspace already holds. */
eq(/CMTES = "committees"/.test(SRC), true, 'committees are read, not re-created');
eq(/INCIDENTS = "incidents"/.test(SRC), true, 'incidents are read from the incidents table');
eq(/CODES = "code_blue_events"/.test(SRC), true, 'code alerts reuse the existing event log');
eq(/S\.elements \? await S\.elements\(\)/.test(SRC), true,
   'readiness reads the element register through the same helper the tracker uses');
eq(/S\.readiness\(elementMap\)/.test(SRC), true,
   'and scores it with the same weighted maths, so the two pages cannot disagree');
/* The incident report itself belongs to the incidents page — sign-off chain, one-hour
   window, the lot. A second short form here would create incidents that skip all of it. */
eq(/href="incidents\.html"/.test(SRC), true, 'reporting an incident links out rather than duplicating the form');
eq(/id="qdIncidentForm"/.test(SRC) && /Object\.keys\(cur\)\.forEach/.test(SRC), true,
   'and classifying one PATCHES the existing row rather than replacing its payload');

/* A missing table in one section must not blank the page. Four sections that loaded are
   worth more than a setup notice for the fifth. */
eq(/async function soft\(name\)/.test(SRC), true, 'a rejected read degrades to an empty section');
eq(/host\.innerHTML = \(schemaMissing \? schemaNotice\(\) : ""\)/.test(SRC), true,
   'and the qd_* setup notice sits above the board rather than replacing it');

/* Layout is per section. One shared order list would drop a code alert tile into the KPI
   grid the first time either was rearranged. */
eq(/viewState\.order\[currentSection\(\)\] = o/.test(SRC), true, 'tile order is saved per section');
eq(/aq-qd-view-v2/.test(SRC), true, 'and the key was bumped, since a v1 array is not a v2 object');

/* Direction of travel is a THIRD answer here, not a default. More incidents reported can be
   a worse month or a hospital that has finally started reporting properly, and colouring
   that red teaches people to stop reporting. */
eq(/higherIsBetter == null\) \? null :/.test(SRC), true,
   'a movement with no good direction is drawn neutral, not green or red');

/* The readiness override must never REPLACE the computed figure, or a chapter can mark
   itself ready and nothing on the page disagrees. */
eq(/readiness_override/.test(SRC) && /computed:/.test(SRC), true,
   'the chapter row carries both the register figure and the hospital’s own');
eq(/Register says/.test(SRC) && /They say/.test(SRC), true,
   'and the table shows them side by side, never one instead of the other');

/* The chapter list had HIC, which is the previous edition's code for what is now IPC. A
   finding filed against HIC could never match the chapter readiness computes, so the
   cross-filter silently found nothing. */
eq(/return \["AAC"[^\]]*"IPC"[^\]]*\]/.test(SRC), true,
   'the fallback chapter list says IPC, not the dead HIC code');
eq(/"HIC",/.test(SRC), false, 'and HIC survives nowhere as a value');
eq(/window\.NABH_DATA[\s\S]{0,120}Object\.keys\(D\.chapters\)/.test(SRC), true,
   'and the chapter list is taken from the register rather than typed out again');

/* Quorum and the action counts are the three figures nobody had anywhere to put. */
eq(/quorum_required/.test(SRC) && /actions_raised/.test(SRC) && /actions_closed/.test(SRC),
   true, 'a meeting records quorum and its action points');
eq(/more actions closed than were raised/.test(SRC), true,
   'and closing more than were raised is refused, not drawn as over 100%');
eq(/attendance == null \|\| m\.quorum_required == null\) return null/.test(SRC), true,
   'a meeting missing either figure is not counted either way');

/* Donabedian is the field the incidents page never asked for, and the reason the count
   becomes a direction to look in. */
['structure', 'process', 'outcome'].forEach((d) => {
  eq(new RegExp('"' + d + '"').test(SRC), true, 'incidents can be classified as ' + d);
});

/* A drill is marked as a drill rather than hidden in another table: an assessor asks how
   the team performs, and the answer is worth less if the practice runs are excluded. */
eq(/is_drill/.test(SRC), true, 'code alerts distinguish a real event from a mock drill');
eq(/team_expected/.test(SRC) && /team_present/.test(SRC) && /absent_roles/.test(SRC), true,
   'and record who was expected, who came, and who was missing');
eq(/more of the team present than were expected/.test(SRC), true,
   'more present than expected is refused');

/* Every KPI gets its OWN line. An average cannot show a KPI that fell four months running
   while its department's mean held steady. */
eq(/id: "kpiEach"/.test(SRC), true, 'every KPI is drawn with its own trend');
eq(/spark\.length > 1/.test(SRC), true,
   'and a single reading draws no line, since a flat line reads as "no change"');

/* ---- the schema the five sections need ---- */
eq(/alter table public\.incidents add column if not exists donabedian/.test(SQL), true,
   'incidents gained a donabedian column rather than a second table');
['actions_raised', 'actions_closed', 'quorum_required'].forEach((c) => {
  eq(new RegExp('committee_meetings add column if not exists ' + c).test(SQL), true,
     'committee_meetings gained ' + c);
});
['code_colour', 'is_drill', 'team_expected', 'team_present', 'absent_roles',
 'response_seconds', 'performance_score'].forEach((c) => {
  eq(new RegExp('code_blue_events add column if not exists ' + c).test(SQL), true,
     'code_blue_events gained ' + c);
});
eq(/create table if not exists public\.chapter_owners/.test(SQL), true,
   'chapter champions get their own small table');
eq(/'chapter_owners'/.test(SQL), true, 'which is inside the RLS and org-stamp loops');
eq(/unique \(org_id, chapter\)/.test(SQL), true,
   'and one hospital cannot end up with two champions for one chapter');

/* The crash cart's cadence lives beside its recipients, on the org — not on notify_prefs.
   Split per-user, one person could pick daily and still be mailed weekly, because the
   sender reads the org's address list and not theirs. */
eq(/crash_cart_settings\s+add column if not exists alert_frequency/.test(SQL), true,
   'the crash cart alert frequency is an org setting');
eq(/notify_prefs add column if not exists crashcart_frequency/.test(SQL), false,
   'and is not duplicated onto per-user preferences');


/* ================= CHOOSING WHICH BOARD TO BUILD =================
   The first screen listed the five boards and then put ONE button under them: "Add the
   first department". So whatever a hospital came here to do, the only door led into KPI —
   the heaviest of the five, needing departments, KRAs, targets and a monthly figure before
   it draws anything. A quality manager who wanted to record last week's committee meeting
   had to build a KPI framework first, or guess that the tabs behind the intro let them out.

   Nothing required that order. The boards share no data: committees read meetings,
   incidents read incidents, readiness reads the element register. KPI was first because it
   was written first, and a default became a prerequisite by accident. */
const intro = (function () {
  const secs = SRC.match(/var SECTIONS = \[[\s\S]*?\n  \];/)[0];
  const starts = SRC.match(/var STARTS = \{[\s\S]*?\n  \};/)[0];
  const fn = SRC.match(/function setupIntro\(\) \{[\s\S]*?\n  \}/)[0];
  const escFn = 'function esc(v){return String(v==null?"":v).replace(/[&<>"]/g,function(c){' +
    'return {"&":"&amp;","<":"&lt;",">":"&gt;",\'"\':"&quot;"}[c];});}';
  return new Function(secs + '\n' + starts + '\n' + escFn + '\n' + fn +
    '\nreturn { html: setupIntro(), SECTIONS: SECTIONS, STARTS: STARTS };')();
})();

/* Every board is a door, and each door is a real button rather than a description. */
intro.SECTIONS.forEach(function (sec) {
  eq(intro.html.indexOf('data-start="' + sec[0] + '"') > -1, true,
     sec[1] + ' can be chosen from the first screen');
});
eq((intro.html.match(/data-start=/g) || []).length, intro.SECTIONS.length,
   'all five, and nothing that is not a board');
eq(/<button type="button" class="qd-sec"/.test(intro.html), true,
   'as buttons, so they are reachable by keyboard and announced as controls');

/* THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL. One button, hard-wired to one board. */
eq(/qdStart/.test(intro.html), false, 'no single hard-wired start button');
eq(/Add the first department/.test(intro.html), false,
   'and the first screen no longer tells a hospital which board to build');
eq(/Name your departments/.test(intro.html), false,
   'nor walks them through KPI as though it were step one of five');

/* Each door says what it will ask, so the choice is between actions and not topics. */
intro.SECTIONS.forEach(function (sec) {
  eq(typeof intro.STARTS[sec[0]] === 'string' && intro.STARTS[sec[0]].length > 3, true,
     sec[1] + ' names its own first question');
});
eq(intro.STARTS.committee, 'Record a meeting', 'committee asks about a meeting, not a department');

/* ---- picking a board opens THAT board, and asks only its questions ---- */
const startFn = SRC.match(/function startSection\(sec\) \{[\s\S]*?\n  \}/)[0];
eq(/viewState\.section = sec;/.test(startFn), true, 'the chosen board becomes the open one');
eq(/viewState\.started = true;/.test(startFn), true, 'and the choice is recorded');
eq(startFn.indexOf('saveView()') < startFn.indexOf('location.href'), true,
   'saved BEFORE any navigation, so the two boards that leave this page come back to the ' +
   'one the hospital picked');
eq(/if \(sec === "committee"\)/.test(startFn) && /meetingForm\(\)/.test(startFn), true,
   'committee opens the meeting form');
eq(/if \(sec === "kpi"\) \{ deptForm\(\); return; \}/.test(startFn), true,
   'and KPI still opens the department form — it is one of five now, not the gate');
/* A meeting belongs to a committee and committees are made on the calendar, so choosing
   committee with none set up has to go there rather than open an empty dropdown. */
eq(/if \(!cmtes\.length\) \{ location\.href = "calendar\.html#committees"; return; \}/.test(startFn), true,
   'and a hospital with no committees yet is sent where committees are made');

/* ---- a chosen board stays open even before it holds anything ---- */
eq(/if \(!viewState\.started && !depts\.length/.test(SRC), true,
   'the chooser closes when a board is CHOSEN, not when data first appears');
/* Those are different moments, and using the second for the first was the bug: pick
   Committee, open the meeting form, change your mind, and the page threw you back to the
   chooser as though you had never decided anything. */
eq(/started: raw\.started === true/.test(SRC), true,
   'and the choice survives a reload');
/* The saved view is rebuilt field by field, so anything not named there is dropped — which
   is deliberate, and means a new field has to be added in two places or it silently does
   not persist. */
eq(/section: "kpi", started: false/.test(SRC), true, 'with a default that matches');

/* ---- every empty board explains itself, not just KPI ---- */
const nudge = (function () {
  const fn = SRC.match(/function emptyNudge\(sec\) \{[\s\S]*?\n  \}\n/)[0];
  return function (state) {
    return new Function('depts', 'cmtes', 'meetings', 'incidents', 'codes', 'owners', 'findings',
      fn + '\nreturn emptyNudge;')(
      state.depts || [], state.cmtes || [], state.meetings || [], state.incidents || [],
      state.codes || [], state.owners || [], state.findings || []);
  };
})();
const bare = nudge({});
['kpi', 'committee', 'incident', 'code', 'nabh'].forEach(function (sec) {
  eq(bare(sec).length > 40, true, sec + ' tells an empty board what it needs');
});
/* Only KPI had one of these, because only KPI could be reached from the old first screen —
   the other four were never seen empty by anybody who had not already filled something in.
   Now that any of the five can be the first thing a hospital opens, an empty grid of tiles
   would read as broken rather than as not started. */
eq(/No committees yet/.test(bare('committee')), true,
   'committee with nothing set up points at the calendar, where committees are made');
eq(/calendar\.html#committees/.test(bare('committee')), true, 'and links there');
eq(/No meetings recorded yet/.test(nudge({ cmtes: [{ id: 'c1' }] })('committee')), true,
   'and once committees exist it asks for a meeting instead');
eq(nudge({ meetings: [{ id: 'm1' }], cmtes: [{ id: 'c1' }] })('committee'), '',
   'and says nothing once the board has something to draw');
/* Each one points at where that record is actually made, which is not always this page. */
eq(/incidents\.html/.test(bare('incident')), true, 'incidents point at the incident page');
eq(/readiness\.html/.test(bare('nabh')), true, 'readiness points at the tracker');

/* ---- the cards have to behave like the controls they now are ---- */
eq(/\.qd-sec\{[^}]*cursor:pointer/.test(CSS), true, 'a chooser card takes a pointer');
eq(/\.qd-sec:focus-visible\{[^}]*outline/.test(CSS), true, 'and shows a focus ring');
eq(/\.qd-sec:hover\{/.test(CSS), true, 'and answers a hover, or it reads as decoration');
eq(/@media \(prefers-reduced-motion: reduce\)\{[\s\S]*?\.qd-sec\{transition:none/.test(CSS), true,
   'without moving for anyone who has asked it not to');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
