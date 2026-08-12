/* AQcredix — recurrence and due-date maths for the committee and compliance calendars.
 *
 * Pure functions, no DOM and no network, so this is the part that can actually be tested.
 * Every "is this overdue" answer in the calendar comes from here.
 *
 * DATES ARE HANDLED AS PLAIN 'YYYY-MM-DD' STRINGS, never as Date objects carrying a time.
 * `new Date("2026-03-01")` parses as UTC midnight, which in IST (+05:30) is still
 * 2026-03-01 locally — but in any timezone west of Greenwich it is the previous day, and
 * a committee meeting would show as due on the wrong date. Since a due date is a calendar
 * day and not an instant, the string is the correct representation and Date is only used
 * for arithmetic, constructed from explicit parts.
 */
/* Dual-mode. The browser gets window.AQSchedule as before; a Vercel function can
   require() the same file, so the weekly email computes due dates with exactly the code
   the app uses. A second implementation server-side would eventually disagree with the
   first, and the hospital would act on whichever it happened to open. */
(function (root, factory) {
  var api = factory();
  if (root) root.AQSchedule = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  /* Frequencies a hospital actually uses. `months` drives the arithmetic; `days` is only
     for the sub-monthly ones, where adding months is meaningless. */
  var FREQ = {
    weekly:      { label: "Weekly",        days: 7 },
    fortnightly: { label: "Fortnightly",   days: 14 },
    monthly:     { label: "Monthly",       months: 1 },
    bimonthly:   { label: "Every 2 months", months: 2 },
    quarterly:   { label: "Quarterly",     months: 3 },
    half_yearly: { label: "Half-yearly",   months: 6 },
    yearly:      { label: "Yearly",        months: 12 }
  };

  function label(freq) { return (FREQ[freq] || {}).label || freq; }
  function all() { return Object.keys(FREQ); }

  /* ------------------------------ date primitives ------------------------------ */

  function parse(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3] };
  }

  function fmt(p) {
    if (!p) return "";
    return p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0");
  }

  function today() {
    var n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }

  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  function addDays(p, n) {
    var d = new Date(p.y, p.m - 1, p.d);
    d.setDate(d.getDate() + n);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }

  /* Adding a month to 31 January must not produce 3 March. The day is clamped to the
     length of the target month, which is what a person means by "monthly" — a committee
     that met on the 31st meets on the 28th in February, not in March. */
  function addMonths(p, n) {
    var total = (p.y * 12) + (p.m - 1) + n;
    var y = Math.floor(total / 12);
    var m = (total % 12) + 1;
    return { y: y, m: m, d: Math.min(p.d, daysInMonth(y, m)) };
  }

  function cmp(a, b) {
    if (!a || !b) return 0;
    return (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
  }

  function diffDays(a, b) {
    var da = Date.UTC(a.y, a.m - 1, a.d), db = Date.UTC(b.y, b.m - 1, b.d);
    return Math.round((db - da) / 86400000);
  }

  /* ------------------------- preferred weekday ------------------------- */

  var DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function dowName(n) { return DOW_NAMES[n] || ""; }

  /* Which weekday does this date fall on? 0 = Sunday, matching Date.getDay(). Built from
     explicit parts so no timezone is ever consulted. */
  function dayOfWeek(p) {
    return new Date(p.y, p.m - 1, p.d).getDay();
  }

  /* The nearest date to `p` that falls on weekday `want`, searching both directions.
     A quarterly committee is due exactly three months from its last sitting; if the
     hospital prefers Mondays, that exact date will usually not BE a Monday. Both dates
     matter and both are kept: the exact one is the compliance obligation an assessor
     measures against, the nearest preferred one is when the meeting will actually be
     held. Collapsing them into one number loses whichever the hospital needs to defend.

     Ties go forward. Meeting slightly late is defensible; the alternative silently pulls
     the interval shorter every cycle, so a "quarterly" committee drifts to meeting every
     89 days and then 88, which compounds over a year. */
  function nearestDow(p, want) {
    if (want == null || want === "" || isNaN(want)) return p;
    want = Number(want);
    var have = dayOfWeek(p);
    var fwd = (want - have + 7) % 7;
    var back = (have - want + 7) % 7;
    if (fwd === 0) return p;
    return fwd <= back ? addDays(p, fwd) : addDays(p, -back);
  }

  /* Both dates for the next sitting. `exact` is the obligation; `preferred` is the day it
     will actually be held. When no weekday preference is set they are the same date. */
  function nextDates(lastIso, freq, prefDow) {
    var last = parse(lastIso);
    if (!last) return { exact: null, preferred: null, shifted: false };
    var exact = advance(last, freq);
    var pref = nearestDow(exact, prefDow);
    return {
      exact: fmt(exact),
      preferred: fmt(pref),
      shifted: fmt(exact) !== fmt(pref),
      shiftDays: diffDays(exact, pref)
    };
  }

  /* ------------------------------ the actual rules ------------------------------ */

  function advance(p, freq) {
    var f = FREQ[freq] || FREQ.monthly;
    return f.days ? addDays(p, f.days) : addMonths(p, f.months);
  }

  /* When is this next due? Never met yet means it is due now — a committee that has
     never sat is the most overdue thing in the building, not something with no date. */
  function nextDue(lastIso, freq) {
    var last = parse(lastIso);
    if (!last) return null;
    return fmt(advance(last, freq));
  }

  /* days < 0 is overdue, 0 is due today. `null` due means never met. */
  function status(lastIso, freq, refIso, dueOverride) {
    var ref = parse(refIso) || today();
    /* dueOverride carries the preferred-weekday date. Status must be measured against the
       day the meeting will actually be held, or a committee shifted two days forward
       would read as overdue for those two days every single cycle. */
    var due = dueOverride || nextDue(lastIso, freq);
    if (!due) {
      return { state: "never", due: null, days: null,
               text: "Never recorded" };
    }
    var d = diffDays(ref, parse(due));
    if (d < 0) return { state: "overdue", due: due, days: d,
                        text: Math.abs(d) + (Math.abs(d) === 1 ? " day overdue" : " days overdue") };
    if (d === 0) return { state: "due", due: due, days: 0, text: "Due today" };
    /* "Due soon" is a fifth of the interval, not a fixed 30 days: a week ahead is urgent
       for a weekly huddle and irrelevant for an annual review. */
    var f = FREQ[freq] || FREQ.monthly;
    var span = f.days || (f.months * 30);
    if (d <= Math.max(3, Math.round(span / 5))) {
      return { state: "soon", due: due, days: d, text: "Due in " + d + (d === 1 ? " day" : " days") };
    }
    return { state: "ok", due: due, days: d, text: "Due " + due };
  }

  /* Every occurrence from the last meeting up to `untilIso`. Used to paint the calendar
     forward and to count how many sittings a committee has missed. */
  function occurrences(lastIso, freq, untilIso, cap, prefDow) {
    var last = parse(lastIso), until = parse(untilIso);
    var out = [];
    if (!last || !until) return out;
    var cur = advance(last, freq);
    var limit = cap || 400;
    while (cmp(cur, until) <= 0 && out.length < limit) {
      /* The series always advances from the EXACT date, never from the shifted one.
         Advancing from a shifted date would compound the shift every cycle, so a
         quarterly Monday committee would creep away from its true quarter. Only the
         displayed date moves. */
      out.push(fmt(nearestDow(cur, prefDow)));
      cur = advance(cur, freq);
    }
    return out;
  }

  /* How many required sittings have been skipped. An assessor asks this directly:
     "your terms of reference say quarterly — show me four sets of minutes." */
  function missedCount(lastIso, freq, refIso) {
    var ref = fmt(parse(refIso) || today());
    var occ = occurrences(lastIso, freq, ref);
    // The most recent occurrence is the one currently due, not one already missed.
    return Math.max(0, occ.length - 1);
  }

  /* Occurrences falling inside one calendar month, for the grid. */
  function inMonth(lastIso, freq, y, m, prefDow) {
    if (!parse(lastIso)) return [];
    /* Look one month past the end: a date shifted forward to the preferred weekday can
       land in the following month, and would otherwise vanish from both grids. */
    var end = fmt(addMonths({ y: y, m: m, d: daysInMonth(y, m) }, 1));
    return occurrences(lastIso, freq, end, null, prefDow).filter(function (iso) {
      var p = parse(iso);
      return p.y === y && p.m === m;
    });
  }

  return {
    FREQ: FREQ, all: all, label: label,
    DOW_NAMES: DOW_NAMES, dowName: dowName, dayOfWeek: dayOfWeek,
    nearestDow: nearestDow, nextDates: nextDates,
    parse: parse, fmt: fmt, today: today, daysInMonth: daysInMonth,
    addDays: addDays, addMonths: addMonths, cmp: cmp, diffDays: diffDays,
    advance: advance, nextDue: nextDue, status: status,
    occurrences: occurrences, missedCount: missedCount, inMonth: inMonth
  };
});
