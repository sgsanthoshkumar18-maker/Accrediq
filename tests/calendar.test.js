/* AQcredix — calendar scheduling, calendar page wiring, command bar.
 * Run: node tests/calendar.test.js
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
vm.runInContext(read('calendar/schedule.js'), sb);
const K = sb.window.AQSchedule;

/* ------------------------------ month arithmetic ------------------------------
   The clamp is the whole game. A committee that met on 31 January meets on 28
   February — not 3 March, which is what naive date arithmetic produces and which would
   quietly shift every subsequent meeting. */
eq(K.fmt(K.addMonths({ y: 2026, m: 1, d: 31 }, 1)), '2026-02-28', '31 Jan + 1 month clamps to 28 Feb');
eq(K.fmt(K.addMonths({ y: 2028, m: 1, d: 31 }, 1)), '2028-02-29', 'and to 29 Feb in a leap year');
eq(K.fmt(K.addMonths({ y: 2026, m: 3, d: 31 }, 1)), '2026-04-30', '31 Mar + 1 month clamps to 30 Apr');
eq(K.fmt(K.addMonths({ y: 2026, m: 12, d: 15 }, 1)), '2027-01-15', 'December rolls into the next year');
eq(K.fmt(K.addMonths({ y: 2026, m: 1, d: 15 }, -1)), '2025-12-15', 'and backwards across the year boundary');
eq(K.fmt(K.addMonths({ y: 2026, m: 5, d: 10 }, 0)), '2026-05-10', 'adding nothing changes nothing');

/* The clamp must not be sticky: once clamped to 28 Feb, adding another month gives
   28 March, which is correct — the ORIGINAL day is not remembered. That is a real
   trade-off and this test pins the chosen behaviour so it is not changed by accident. */
eq(K.fmt(K.addMonths(K.addMonths({ y: 2026, m: 1, d: 31 }, 1), 1)), '2026-03-28',
   'the clamp carries forward rather than springing back to 31');

eq(K.fmt(K.addDays({ y: 2026, m: 2, d: 28 }, 1)), '2026-03-01', 'day arithmetic crosses a month');
eq(K.fmt(K.addDays({ y: 2028, m: 2, d: 28 }, 1)), '2028-02-29', 'and knows about leap days');
eq(K.daysInMonth(2026, 2), 28, 'February 2026 has 28 days');
eq(K.daysInMonth(2028, 2), 29, 'February 2028 has 29');

/* --------------------------- dates are strings, not instants ---------------------------
   new Date("2026-03-01") is UTC midnight, which is the PREVIOUS DAY in any timezone west
   of Greenwich. A due date is a calendar day, so it must never round-trip through an
   instant. */
const src = read('calendar/schedule.js');
eq(/new Date\(\s*iso/.test(src), false, 'an ISO string is never handed to the Date parser');
eq(/new Date\(\s*[a-z]+Iso/.test(src), false, 'nor is any date-string variable');
ok(/Date\.UTC/.test(src), 'day differences go through UTC so DST cannot shift them');

/* ------------------------------ due dates and status ------------------------------ */

eq(K.nextDue('2026-05-10', 'monthly'), '2026-06-10', 'monthly advances one month');
eq(K.nextDue('2026-05-10', 'quarterly'), '2026-08-10', 'quarterly advances three');
eq(K.nextDue('2026-05-10', 'half_yearly'), '2026-11-10', 'half-yearly advances six');
eq(K.nextDue('2026-05-10', 'yearly'), '2027-05-10', 'yearly advances twelve');
eq(K.nextDue('2026-05-10', 'weekly'), '2026-05-17', 'weekly advances seven days');
eq(K.nextDue('2026-05-10', 'fortnightly'), '2026-05-24', 'fortnightly advances fourteen');
eq(K.nextDue(null, 'monthly'), null, 'a committee that never met has no computable next date');

/* "Never met" is its own state, not "fine". A committee that has never sat is the most
   overdue thing in the building and must not read as having no obligation. */
const never = K.status(null, 'monthly', '2026-08-11');
eq(never.state, 'never', 'never-met is a distinct state');
eq(never.due, null, 'with no due date to show');

const od = K.status('2026-05-10', 'monthly', '2026-08-11');
eq(od.state, 'overdue', 'a monthly committee last met in May is overdue in August');
eq(od.due, '2026-06-10', 'and was due in June');
ok(od.days < 0, 'overdue days are negative');
ok(/62 days overdue/.test(od.text), 'the text counts the days');

eq(K.status('2026-08-11', 'monthly', '2026-08-11').state, 'ok', 'met today is not due today');
eq(K.status('2026-07-11', 'monthly', '2026-08-11').state, 'due', 'exactly one interval on is due today');
eq(K.status('2026-07-11', 'monthly', '2026-08-11').days, 0, 'with zero days remaining');

/* "Due soon" scales with the interval: a week out is urgent for a weekly huddle and
   irrelevant for an annual review. A fixed 30-day window would flag every yearly task
   for a month and never flag a weekly one at all. */
eq(K.status('2026-08-08', 'weekly', '2026-08-15').state, 'due', 'a weekly task due today');
eq(K.status('2026-08-09', 'weekly', '2026-08-15').state, 'soon', 'and one day out is soon, not due');
const yearlySoon = K.status('2025-09-01', 'yearly', '2026-08-11');
eq(yearlySoon.state, 'soon', 'a yearly task three weeks out counts as soon');
const monthlyFar = K.status('2026-08-01', 'monthly', '2026-08-11');
eq(monthlyFar.state, 'ok', 'a monthly task three weeks out does not');

/* ------------------------------ missed sittings ------------------------------ */

eq(K.missedCount('2026-05-10', 'monthly', '2026-08-11'), 2,
   'two monthly sittings missed between June and August');
eq(K.missedCount('2026-08-01', 'monthly', '2026-08-11'), 0, 'nothing missed inside the interval');
eq(K.missedCount('2026-01-10', 'quarterly', '2026-08-11'), 1, 'one quarterly sitting missed');
eq(K.missedCount(null, 'monthly', '2026-08-11'), 0, 'never-met reports no missed count, not a huge one');

/* Occurrences are capped, or a weekly committee last met in 1990 would spin building a
   list of thousands while the page waits. */
const many = K.occurrences('1990-01-01', 'weekly', '2026-08-11');
ok(many.length <= 400, 'occurrence generation is capped (' + many.length + ')');

const aug = K.inMonth('2026-05-10', 'monthly', 2026, 8);
eq(aug.length, 1, 'one monthly occurrence falls in August');
eq(aug[0], '2026-08-10', 'on the tenth');
eq(K.inMonth(null, 'monthly', 2026, 8).length, 0, 'a never-met committee paints nothing on the grid');

/* ------------------------------ the calendar page ------------------------------ */

const cal = read('calendar/calendar.js');
const html = read('workspace/calendar.html');

ok(/AQSchedule/.test(cal), 'the page uses the shared schedule engine');
// One source of truth for "overdue" — the page must not do its own date maths.
eq(/new Date\([^)]*\)\s*[-+]/.test(cal), false, 'the page does no date arithmetic of its own');

// The three things he asked to collect, on the committee form.
ok(/Committee name/.test(cal), 'the form asks for the committee name');
ok(/How often must it meet/.test(cal), 'and how often it must meet');
ok(/When did it last meet/.test(cal), 'and when it last met');
ok(/cmteNames/.test(cal), 'known committees are suggested but not forced');

ok(/W\.gate\(\)/.test(cal), 'the page is gated like every other workspace page');
ok(/renderNav\("calendar"\)/.test(cal), 'it registers in the workspace nav');
ok(/calendar\.html/.test(read('workspace/shell.js')), 'and the nav links to it');
ok(/schedule\.js/.test(html) && /calendar\.js/.test(html), 'the page loads both scripts');
eq((html.match(/<body/g) || []).length, 1, 'the page has exactly one body tag');
eq((html.match(/<\/head>/g) || []).length, 1, 'and one head');

// Soft delete: minutes must survive a committee being stood down.
ok(/active = false/.test(cal), 'removing a committee is a soft delete');
eq(/adapter\.delete/.test(cal), false, 'nothing is hard-deleted');

// Recorded meetings beat the typed last-met date once they exist.
ok(/function lastMet/.test(cal), 'the last meeting is derived, not just read from the field');

/* ------------------------------ the command bar ------------------------------ */

const cmd = read('search/command.js');
ok(/ctrlKey \|\| e\.metaKey/.test(cmd), 'Ctrl+K and Cmd+K both open it');
ok(/INPUT\|TEXTAREA\|SELECT/.test(cmd),
   'the slash shortcut yields while the user is typing, or it hijacks every slash in a note');
ok(/if \(!idx\) idx = build\(\)/.test(cmd), 'the index is built lazily on first open');
ok(/ArrowDown/.test(cmd) && /ArrowUp/.test(cmd), 'the list is keyboard navigable');
ok(/aria-modal/.test(cmd), 'the dialog announces itself');
ok(/documentElement\.style\.overflow = "hidden"/.test(cmd), 'the page behind is locked while open');
ok(/documentElement\.style\.overflow = ""/.test(cmd), 'and released on close');
ok(/r\.k\.indexOf\(q\) === 0/.test(cmd), 'an exact prefix match outranks a body-text hit');

/* ------------------------------ palette + mobile ------------------------------ */

[['calendar/calendar.css', 'calendar'], ['search/command.css', 'command bar']].forEach(([f, name]) => {
  const css = read(f);
  // Brace-match the media blocks; a non-greedy regex spans past the closing brace.
  let hard = 0;
  for (let i = css.indexOf('@media'); i >= 0; i = css.indexOf('@media', i + 1)) {
    const o = css.indexOf('{', i);
    if (o < 0) break;
    let depth = 0, j = o;
    for (; j < css.length; j++) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') { depth--; if (!depth) break; }
    }
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css.slice(o, j + 1))) hard++;
  }
  eq(hard, 0, 'no hardcoded colour inside a media query (' + name + ')');
  ok(/@media \(max-width: 760px\)/.test(css), 'the ' + name + ' has a mobile layout');
});

ok(/min-height: 40px/.test(read('calendar/calendar.css')), 'calendar controls are tap-sized');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
