/* AQcredix — what a person is owed this week.
 *
 * One pure function over rows already loaded elsewhere, so the in-app notification centre,
 * the weekly email and the department dashboard cannot disagree about what is overdue.
 * Three implementations of "what is due" would eventually give three answers, and the one
 * a hospital acts on would be whichever they happened to open.
 *
 * No DOM, no network: everything comes in as arrays and a reference date comes in as a
 * string, which is what makes it testable and reusable from a serverless function.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.AQDigest = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  /* K is injected rather than reached for, because this file runs both in the browser
     (where AQSchedule is a global) and in a Vercel function (where it is a require). */
  function build(K, data, opts) {
    opts = opts || {};
    var dept = opts.department || "";
    var ref = opts.today || null;
    var overdueOnly = !!opts.overdueOnly;

    var items = [];

    function lastOf(rows, key, matchKey, matchVal, fallback) {
      var d = (rows || []).filter(function (r) { return r[matchKey] === matchVal && r[key]; })
        .map(function (r) { return r[key]; }).sort();
      return d.length ? d[d.length - 1] : (fallback || null);
    }

    function push(kind, name, meta, freq, last, prefDow, href, el) {
      var d = K.nextDates(last, freq, prefDow);
      var st = K.status(last, freq, ref, d.preferred);
      items.push({ kind: kind, name: name, meta: meta, element: el || null,
                   due: d.preferred, state: st.state, days: st.days, text: st.text,
                   href: href });
    }

    (data.tasks || []).filter(function (t) {
      return t.active !== false && (!dept || t.department === dept);
    }).forEach(function (t) {
      push("Task", t.title, K.label(t.frequency), t.frequency, t.last_done_on,
           t.pref_dow, "workspace/calendar.html", t.element_code);
    });

    (data.schedules || []).filter(function (sc) { return sc.active !== false; })
      .forEach(function (sc) {
        var a = (data.assets || []).filter(function (x) { return x.id === sc.asset_id; })[0];
        if (!a || a.status === "condemned") return;
        if (dept && a.department !== dept) return;
        var last = lastOf(data.events, "performed_on", "schedule_id", sc.id, sc.last_done_on);
        push("Equipment", a.name,
             String(sc.kind || "").replace(/_/g, " ") + " \u00b7 " + K.label(sc.frequency),
             sc.frequency, last, sc.pref_dow, "workspace/register.html", a.element_code);
      });

    (data.lists || []).filter(function (l) {
      return l.active !== false && (!dept || l.department === dept);
    }).forEach(function (l) {
      var last = lastOf(data.rounds, "performed_on", "checklist_id", l.id, l.last_done_on);
      push("Round", l.name, K.label(l.frequency), l.frequency, last, l.pref_dow,
           "workspace/rounds.html", l.element_code);
    });

    /* Committees are hospital-wide. Sending every committee to the pharmacy's engineer
       would bury the four things they actually own, and they would stop reading. */
    if (!dept) {
      (data.committees || []).filter(function (c) { return c.active !== false; })
        .forEach(function (c) {
          var last = lastOf(data.meetings, "held_on", "committee_id", c.id, c.last_met_on);
          push("Committee", c.name, K.label(c.frequency), c.frequency, last, c.pref_dow,
               "workspace/calendar.html", null);
        });
    }

    var findings = (data.capa || []).filter(function (c) {
      return c.status !== "closed" && (!dept || c.department === dept);
    });

    var rank = { overdue: 0, never: 1, due: 2, soon: 3, ok: 4 };
    items.sort(function (a, b) {
      return (rank[a.state] - rank[b.state]) ||
             ((a.days == null ? 0 : a.days) - (b.days == null ? 0 : b.days));
    });

    var overdue = items.filter(function (i) { return i.state === "overdue"; });
    var never = items.filter(function (i) { return i.state === "never"; });
    var soon = items.filter(function (i) { return i.state === "due" || i.state === "soon"; });

    return {
      department: dept || null,
      overdue: overdue,
      never: never,
      soon: soon,
      findings: findings,
      /* Nothing to say is a real answer. Sending "you have 0 overdue items" every Monday
         is how a digest teaches people to filter it into a folder they never open. */
      empty: !overdue.length && !never.length && !soon.length && !findings.length,
      total: (overdueOnly ? overdue.length : items.length),
      counts: { overdue: overdue.length, never: never.length,
                soon: soon.length, findings: findings.length }
    };
  }

  /* A one-line summary for a notification title or an email subject. Written so the most
     important number is first and readable in a phone's preview pane, where most of these
     will be read and most will be judged. */
  function summarise(d) {
    var c = d.counts;
    var where = d.department ? " in " + d.department : "";
    if (d.empty) return "Nothing overdue" + where;
    var bits = [];
    if (c.overdue) bits.push(c.overdue + " overdue");
    if (c.never) bits.push(c.never + " never recorded");
    if (c.soon) bits.push(c.soon + " due soon");
    if (c.findings) bits.push(c.findings + " open finding" + (c.findings === 1 ? "" : "s"));
    return bits.join(" \u00b7 ") + where;
  }

  return { build: build, summarise: summarise };
});
