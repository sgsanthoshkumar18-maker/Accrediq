/* AQcredix — care bundle compliance.
 *
 * A nurse opens this at the bedside, picks the bundle and the ward, ticks the
 * elements, and saves. The clock decides the shift. Governance reads it back
 * as a monthly compliance figure and exports it.
 *
 * THREE DESIGN DECISIONS WORTH KNOWING:
 *
 * 1. ALL-OR-NONE SCORING IS ENFORCED, NOT SUGGESTED. A bundle passes only if
 *    every applicable element passed. The form shows the verdict flipping to
 *    "Not compliant" the moment one element is marked No, because a nurse who
 *    finds that out only after saving learns nothing at the bedside, which is
 *    where the learning is worth something.
 *
 * 2. THE SHIFT IS READ FROM THE CLOCK, IN IST. Never a dropdown. A shift
 *    somebody picks is a shift somebody eventually picks wrongly, and the
 *    whole value of this tool is that it costs thirty seconds. IST is applied
 *    explicitly rather than trusting the device, because a tablet left on UTC
 *    would file a 9 p.m. entry as the wrong shift AND the wrong date.
 *
 * 3. EXPORT IS OFFERED ONLY TO GOVERNANCE, AND THAT IS A COURTESY. The real
 *    enforcement is the RLS policy in schema.sql. Hiding the button stops the
 *    wrong person asking for something they cannot have; it is not what stops
 *    them having it.
 */
(function () {
  "use strict";

  var W = window.AQWorkspace, S = window.AQStore;
  var BUNDLES = window.AQ_BUNDLES || [];
  var SHIFTS = window.AQ_BUNDLE_SHIFTS || [];
  var TABLE = "bundle_audits";
  var esc;

  var state = {
    view: "record",      /* record | report */
    bundle: null,        /* current bundle object */
    rows: [],            /* audits loaded from the store */
    month: null,         /* YYYY-MM-01 for the report */
    ward: "",            /* remembered between entries in a shift */
    canExport: false,
    schemaMissing: false,
  };

  /* ------------------------------ time, in IST ------------------------------
   *
   * Shift the epoch by +05:30 and then read the UTC getters. The returned Date
   * is a LIE about its own timezone and must only be read with getUTC*; that
   * is the same trick quality-dashboard.js uses, kept identical so the two
   * pages can never disagree about which month a record belongs to. */
  function istNow() {
    return new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
  }
  function istParts(d) {
    return {
      y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(),
      hh: d.getUTCHours(), mm: d.getUTCMinutes(),
    };
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDate(p) { return p.y + "-" + pad(p.m) + "-" + pad(p.d); }

  /* Which shift a given IST moment belongs to, and which DATE that shift is
   * filed under. The night shift wraps midnight: an audit at 02:00 belongs to
   * the shift that started the previous evening, so it is filed under
   * yesterday. Without that, every night shift splits across two dates and the
   * "all three shifts covered" check can never pass. */
  function shiftFor(d) {
    var p = istParts(d);
    var h = p.hh;
    if (h >= 7 && h < 13)  return { shift: "morning",   date: isoDate(p) };
    if (h >= 13 && h < 20) return { shift: "afternoon", date: isoDate(p) };
    if (h >= 20)           return { shift: "night",     date: isoDate(p) };
    /* 00:00–06:59 — still last night's shift. Roll the date back one day. */
    var back = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    return { shift: "night", date: isoDate(istParts(back)) };
  }

  function shiftLabel(id) {
    var s = SHIFTS.filter(function (x) { return x.id === id; })[0];
    return s ? s.label : id;
  }
  function fmtClock(d) {
    var p = istParts(d);
    return pad(p.hh) + ":" + pad(p.mm);
  }
  function fmtDay(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    var names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return +m[3] + " " + names[+m[2] - 1] + " " + m[1];
  }
  function monthLabel(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    var names = ["January","February","March","April","May","June",
                 "July","August","September","October","November","December"];
    return names[+m[2] - 1] + " " + m[1];
  }
  function thisMonth() {
    var p = istParts(istNow());
    return p.y + "-" + pad(p.m) + "-01";
  }
  function monthOf(shiftDate) { return String(shiftDate || "").slice(0, 7) + "-01"; }
  function daysInMonth(monthIso) {
    var m = /^(\d{4})-(\d{2})/.exec(monthIso);
    if (!m) return 30;
    return new Date(+m[1], +m[2], 0).getDate();
  }

  /* ------------------------------ scoring ------------------------------
   *
   * All-or-none. Every element is yes / no / na. The bundle passes only when
   * the applicable ones are all yes. An audit where every element is NA is not
   * an audit and is refused by the caller. */
  function score(bundle, answers) {
    var applicable = 0, passed = 0, unanswered = 0;
    bundle.elements.forEach(function (el) {
      var v = answers[el.id];
      if (v === "na") return;
      if (v === "yes") { applicable++; passed++; return; }
      if (v === "no")  { applicable++; return; }
      unanswered++;
    });
    return {
      applicable: applicable,
      passed: passed,
      unanswered: unanswered,
      compliant: unanswered === 0 && applicable > 0 && passed === applicable,
      complete: unanswered === 0,
      anyApplicable: applicable > 0,
    };
  }

  /* ------------------------------ storage ------------------------------ */

  function id() { return "bnd_" + Math.random().toString(36).slice(2, 11); }

  async function refresh() {
    try {
      state.rows = (await S.adapter.list(TABLE)) || [];
      state.schemaMissing = false;
    } catch (err) {
      var msg = String((err && err.message) || err || "");
      /* PGRST205 is PostgREST for "no such table". That means the hospital has
         not run the migration yet, which is a setup step and should read as
         one — not as a fault, and not as an empty ward. */
      if (msg.indexOf("PGRST205") > -1 || /schema cache|does not exist/i.test(msg)) {
        state.schemaMissing = true;
        state.rows = [];
      } else {
        state.rows = [];
        throw err;
      }
    }
  }

  /* Does an audit already exist for this patient, bundle and shift? The
     database has a unique index on exactly this, so catching it here lets us
     offer to REPLACE rather than hand the nurse a constraint violation. */
  function existing(bundleId, ward, patientRef, shiftDate, shift) {
    return state.rows.filter(function (r) {
      return r.bundle === bundleId && r.ward === ward &&
        (r.patient_ref || "") === (patientRef || "") &&
        r.shift_date === shiftDate && r.shift === shift;
    })[0];
  }

  /* ------------------------------ permissions ------------------------------
   *
   * Mirrors public.is_admin() in schema.sql: the governance roles. Kept as a
   * courtesy so the export button is not offered to someone the database would
   * refuse; the refusal itself lives in the RLS policy. */
  var GOVERNANCE = ["owner", "admin", "director", "quality_manager"];
  async function loadRole() {
    try {
      var email = (W.user && W.user.email || "").toLowerCase();
      if (window.AQBilling && W.user && window.AQBilling.isOwner(W.user)) return true;
      var members = (await S.adapter.list("members")) || [];
      var me = members.filter(function (m) {
        return String(m.email || "").toLowerCase() === email;
      })[0];
      return !!(me && GOVERNANCE.indexOf(String(me.role || "")) > -1);
    } catch (e) {
      /* Cannot read the roster — assume NOT governance. Failing closed on a
         permission question is the only safe direction. */
      return false;
    }
  }

  /* ------------------------------ render: shell ------------------------------ */

  function el(x) { return document.getElementById(x); }

  function schemaNotice() {
    return '<div class="bn-setup">' +
      "<h3>One setup step left</h3>" +
      "<p>The <code>bundle_audits</code> table is not in this workspace's database yet, so there is nowhere to save an audit. " +
      "Run <code>workspace/schema.sql</code> against your Supabase project — it creates the table and the access rules " +
      "in the same pass, and it is safe to re-run.</p>" +
      "<p>Until then the form below will show you how it works, but nothing will be stored.</p>" +
      "</div>";
  }

  function nowStrip() {
    var d = istNow();
    var sd = shiftFor(d);
    var p = istParts(d);
    return '<div class="bn-now">' +
      '<div class="bn-now-main">' +
        '<span class="bn-now-shift">' + esc(shiftLabel(sd.shift)) + " shift</span>" +
        '<span class="bn-now-clock">' + fmtClock(d) + ' <small>IST</small></span>' +
      "</div>" +
      '<div class="bn-now-sub">Filed under ' + esc(fmtDay(sd.date)) +
        (sd.shift === "night" && p.hh < 7
          ? ' <span class="bn-now-note">(night shift that began yesterday evening)</span>'
          : "") +
      "</div>" +
      '<div class="bn-now-windows">' +
        SHIFTS.map(function (s) {
          return '<span class="bn-win' + (s.id === sd.shift ? " on" : "") + '">' +
            esc(s.label) + " " + esc(s.window) + "</span>";
        }).join("") +
      "</div>" +
    "</div>";
  }

  function tabs() {
    return '<div class="bn-tabs" role="tablist">' +
      '<button type="button" class="bn-tab' + (state.view === "record" ? " active" : "") +
        '" data-view="record">Record an audit</button>' +
      '<button type="button" class="bn-tab' + (state.view === "report" ? " active" : "") +
        '" data-view="report">Monthly report</button>' +
    "</div>";
  }

  /* ------------------------------ render: record ------------------------------ */

  function bundlePicker() {
    return '<div class="bn-picker">' +
      BUNDLES.map(function (b) {
        var n = state.rows.filter(function (r) { return r.bundle === b.id; }).length;
        return '<button type="button" class="bn-bundle" data-bundle="' + esc(b.id) + '">' +
          '<span class="bn-b-short">' + esc(b.short) + "</span>" +
          '<span class="bn-b-name">' + esc(b.name) + "</span>" +
          '<span class="bn-b-blurb">' + esc(b.blurb) + "</span>" +
          '<span class="bn-b-meta">' + b.elements.length + " elements" +
            (n ? "  ·  " + n + " audit" + (n === 1 ? "" : "s") + " recorded" : "") + "</span>" +
        "</button>";
      }).join("") +
    "</div>";
  }

  function elementRow(el_, idx) {
    return '<div class="bn-el" data-el="' + esc(el_.id) + '">' +
      '<div class="bn-el-n">' + (idx + 1) + "</div>" +
      '<div class="bn-el-t">' + esc(el_.text) + "</div>" +
      '<div class="bn-el-a">' +
        ["yes", "no", "na"].map(function (v) {
          var label = v === "yes" ? "Yes" : (v === "no" ? "No" : "N/A");
          return '<button type="button" class="bn-ans bn-ans-' + v +
            '" data-el="' + esc(el_.id) + '" data-val="' + v + '">' + label + "</button>";
        }).join("") +
      "</div>" +
    "</div>";
  }

  function recordForm() {
    var b = state.bundle;
    var d = istNow(), sd = shiftFor(d);
    return '<div class="bn-form">' +
      '<div class="bn-form-h">' +
        '<button type="button" class="bn-back" data-back="1">&larr; All bundles</button>' +
        "<h2>" + esc(b.name) + "</h2>" +
        '<span class="bn-chip">' + esc(b.short) + "</span>" +
        '<span class="bn-chip bn-chip-soft">' + esc(b.target) + "</span>" +
      "</div>" +

      nowStrip() +

      '<div class="bn-fields">' +
        '<label class="bn-f"><span>Ward <i>required</i></span>' +
          '<input type="text" id="bnWard" value="' + esc(state.ward) + '" placeholder="e.g. ICU 2, Surgical Ward A" autocomplete="off"></label>' +
        '<label class="bn-f"><span>Department</span>' +
          '<input type="text" id="bnDept" placeholder="e.g. Critical Care" autocomplete="off"></label>' +
        '<label class="bn-f"><span>Patient / bed reference <i>required</i></span>' +
          '<input type="text" id="bnPatient" placeholder="e.g. Bed 14, or UHID" autocomplete="off">' +
          '<small>One audit per patient per shift. Use whatever the ward already writes on the chart.</small></label>' +
        '<label class="bn-f"><span>Recorded by</span>' +
          '<input type="text" id="bnNurse" value="' + esc((W.user && (W.user.name || W.user.email)) || "") + '" autocomplete="off"></label>' +
      "</div>" +

      '<div class="bn-els">' +
        '<div class="bn-els-h"><h3>Bundle elements</h3>' +
          '<button type="button" class="bn-allyes" id="bnAllYes">Mark all Yes</button></div>' +
        b.elements.map(elementRow).join("") +
      "</div>" +

      '<label class="bn-f bn-f-wide"><span>Notes</span>' +
        '<textarea id="bnNotes" rows="2" placeholder="Anything the next shift should know"></textarea></label>' +

      '<div class="bn-verdict" id="bnVerdict"></div>' +

      '<div class="bn-actions">' +
        '<button type="button" class="btn btn-accent" id="bnSave">Save audit</button>' +
        '<span class="bn-sp"></span>' +
        '<a class="btn btn-ghost" href="bundles-print?bundle=' + esc(b.id) + '" target="_blank" rel="noopener">Printable blank form</a>' +
      "</div>" +

      '<p class="bn-src">' + esc(b.source) + "</p>" +
    "</div>";
  }

  /* The verdict panel updates on every tap, so the nurse sees the bundle fail
     at the bedside rather than after saving. */
  var answers = {};
  function paintVerdict() {
    var host = el("bnVerdict");
    if (!host || !state.bundle) return;
    var s = score(state.bundle, answers);
    var cls, head, body;
    if (!s.complete) {
      cls = "pending";
      head = s.unanswered + " element" + (s.unanswered === 1 ? "" : "s") + " left";
      body = "Every element needs an answer before this can be saved.";
    } else if (!s.anyApplicable) {
      cls = "pending";
      head = "Nothing to score";
      body = "Every element is marked not applicable, so there is no bundle to pass or fail.";
    } else if (s.compliant) {
      cls = "pass";
      head = "Compliant";
      body = "All " + s.applicable + " applicable element" + (s.applicable === 1 ? "" : "s") + " met.";
    } else {
      cls = "fail";
      head = "Not compliant";
      body = s.passed + " of " + s.applicable + " applicable elements met. A bundle scores " +
             "all-or-none, so missing one means the bundle is not met.";
    }
    host.className = "bn-verdict bn-" + cls;
    host.innerHTML = "<b>" + esc(head) + "</b><span>" + esc(body) + "</span>";
  }

  /* ------------------------------ render: report ------------------------------ */

  function monthsPresent() {
    var set = {};
    state.rows.forEach(function (r) { set[monthOf(r.shift_date)] = 1; });
    var list = Object.keys(set).sort();
    if (list.indexOf(thisMonth()) === -1) list.push(thisMonth());
    return list.sort();
  }

  function pct(n, d) { return d ? Math.round((n / d) * 100) : null; }
  function pctText(v) { return v == null ? "—" : v + "%"; }
  function band(v) {
    if (v == null) return "none";
    if (v >= 95) return "ok";
    if (v >= 80) return "warn";
    return "bad";
  }

  function reportView() {
    var month = state.month || thisMonth();
    var inMonth = state.rows.filter(function (r) { return monthOf(r.shift_date) === month; });

    var overall = pct(inMonth.filter(function (r) { return r.compliant; }).length, inMonth.length);

    /* Per bundle */
    var byBundle = BUNDLES.map(function (b) {
      var rs = inMonth.filter(function (r) { return r.bundle === b.id; });
      var ok = rs.filter(function (r) { return r.compliant; }).length;
      return { key: b.short, name: b.name, n: rs.length, ok: ok, pct: pct(ok, rs.length) };
    }).filter(function (x) { return x.n > 0; });

    /* Per ward */
    var wardMap = {};
    inMonth.forEach(function (r) {
      var w = r.ward || "(unnamed)";
      wardMap[w] = wardMap[w] || { n: 0, ok: 0 };
      wardMap[w].n++;
      if (r.compliant) wardMap[w].ok++;
    });
    var byWard = Object.keys(wardMap).sort().map(function (w) {
      return { key: w, n: wardMap[w].n, ok: wardMap[w].ok, pct: pct(wardMap[w].ok, wardMap[w].n) };
    });

    /* Shift coverage — the question "did every shift get recorded" needs the
       three shifts checked against each day of the month that has passed. */
    var cov = shiftCoverage(inMonth, month);

    /* Trend across months */
    var trend = monthsPresent().map(function (m) {
      var rs = state.rows.filter(function (r) { return monthOf(r.shift_date) === m; });
      var ok = rs.filter(function (r) { return r.compliant; }).length;
      return { m: m, v: pct(ok, rs.length), n: rs.length };
    }).filter(function (x) { return x.n > 0; });

    return '<div class="bn-report">' +

      '<div class="bn-rep-h">' +
        '<label class="bn-f bn-f-inline"><span>Month</span>' +
          '<select id="bnMonth">' +
            monthsPresent().map(function (m) {
              return '<option value="' + m + '"' + (m === month ? " selected" : "") + ">" +
                esc(monthLabel(m)) + "</option>";
            }).join("") +
          "</select></label>" +
        '<span class="bn-sp"></span>' +
        (state.canExport
          ? '<button type="button" class="btn btn-accent" id="bnExport">Download CSV</button>'
          : '<span class="bn-locked" title="Export is limited to the governance roles">' +
            "Export is limited to the director, quality manager and admin roles</span>") +
      "</div>" +

      /* headline */
      '<div class="bn-cards">' +
        '<div class="bn-card"><span class="k">Bundle compliance</span>' +
          '<span class="v bn-' + band(overall) + '">' + pctText(overall) + "</span>" +
          '<span class="s">all-or-none, ' + inMonth.length + " audit" + (inMonth.length === 1 ? "" : "s") + "</span></div>" +
        '<div class="bn-card"><span class="k">Audits recorded</span>' +
          '<span class="v">' + inMonth.length + "</span>" +
          '<span class="s">' + byWard.length + " ward" + (byWard.length === 1 ? "" : "s") + "</span></div>" +
        '<div class="bn-card"><span class="k">Shifts covered</span>' +
          '<span class="v bn-' + band(cov.pct) + '">' + pctText(cov.pct) + "</span>" +
          '<span class="s">' + cov.done + " of " + cov.expected + " shift slots</span></div>" +
      "</div>" +

      (inMonth.length === 0
        ? '<div class="bn-empty">No audits recorded for ' + esc(monthLabel(month)) + " yet.</div>"
        : (
          section("By bundle", table(byBundle, "Bundle")) +
          section("By ward", table(byWard, "Ward")) +
          section("Shift coverage", coverageGrid(cov)) +
          (trend.length > 1 ? section("Compliance over time", trendChart(trend)) : "")
        )) +
    "</div>";
  }

  function section(title, body) {
    return '<section class="bn-sec"><h3>' + esc(title) + "</h3>" + body + "</section>";
  }

  function table(rows, label) {
    if (!rows.length) return '<div class="bn-empty">Nothing recorded.</div>';
    return '<table class="bn-table"><thead><tr>' +
      "<th>" + esc(label) + "</th><th>Audits</th><th>Compliant</th><th>Compliance</th><th></th>" +
      "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr>" +
          "<td><b>" + esc(r.key) + "</b>" + (r.name ? '<small>' + esc(r.name) + "</small>" : "") + "</td>" +
          '<td class="n">' + r.n + "</td>" +
          '<td class="n">' + r.ok + "</td>" +
          '<td class="n bn-' + band(r.pct) + '"><b>' + pctText(r.pct) + "</b></td>" +
          '<td class="bar"><i style="width:' + (r.pct || 0) + '%" class="bn-' + band(r.pct) + '"></i></td>' +
        "</tr>";
      }).join("") + "</tbody></table>";
  }

  /* Were all three shifts recorded on each day so far this month? Counts only
     days up to today, because a month in progress should not be marked down
     for shifts that have not happened. */
  function shiftCoverage(rows, month) {
    var today = istParts(istNow());
    var mm = /^(\d{4})-(\d{2})/.exec(month);
    var isCurrent = mm && +mm[1] === today.y && +mm[2] === today.m;
    var lastDay = isCurrent ? today.d : daysInMonth(month);

    var seen = {};
    rows.forEach(function (r) { seen[r.shift_date + "|" + r.shift] = 1; });

    var days = [];
    for (var d = 1; d <= lastDay; d++) {
      var iso = month.slice(0, 8) + pad(d);
      var marks = SHIFTS.map(function (s) {
        return { id: s.id, label: s.label, on: !!seen[iso + "|" + s.id] };
      });
      days.push({ d: d, iso: iso, marks: marks });
    }
    var expected = lastDay * SHIFTS.length;
    var done = days.reduce(function (n, day) {
      return n + day.marks.filter(function (m) { return m.on; }).length;
    }, 0);
    return { days: days, expected: expected, done: done, pct: pct(done, expected) };
  }

  function coverageGrid(cov) {
    if (!cov.days.length) return '<div class="bn-empty">Nothing yet.</div>';
    return '<p class="bn-sec-sub">One square per shift. A filled square means at least one ' +
      "audit was recorded in that shift; an empty one means the shift went unrecorded.</p>" +
      '<div class="bn-cov">' +
        cov.days.map(function (day) {
          return '<div class="bn-cov-day" title="' + esc(fmtDay(day.iso)) + '">' +
            '<span class="bn-cov-n">' + day.d + "</span>" +
            day.marks.map(function (m) {
              return '<span class="bn-cov-m' + (m.on ? " on" : "") + '" title="' +
                esc(m.label + " — " + (m.on ? "recorded" : "not recorded")) + '"></span>';
            }).join("") +
          "</div>";
        }).join("") +
      "</div>" +
      '<div class="bn-cov-key">' +
        SHIFTS.map(function (s, i) {
          return '<span><i class="bn-cov-m on"></i>' + esc(s.label) + " " + esc(s.window) + "</span>";
        }).join("") +
      "</div>";
  }

  function trendChart(points) {
    var W_ = 720, H = 180, PL = 44, PR = 12, PT = 14, PB = 30;
    function x(i) {
      return points.length === 1 ? PL + (W_ - PL - PR) / 2
        : PL + (i / (points.length - 1)) * (W_ - PL - PR);
    }
    function y(v) { return H - PB - (v / 100) * (H - PT - PB); }
    var grid = "", ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var gy = PT + (t / ticks) * (H - PT - PB);
      grid += '<line class="g" x1="' + PL + '" x2="' + (W_ - PR) + '" y1="' + gy + '" y2="' + gy + '"/>' +
        '<text class="l ly" x="' + (PL - 6) + '" y="' + (gy + 4) + '">' + (100 - (t / ticks) * 100) + "</text>";
    }
    var path = "M" + points.map(function (p, i) { return x(i).toFixed(1) + "," + y(p.v).toFixed(1); }).join(" L");
    var dots = points.map(function (p, i) {
      return '<circle class="d" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="4"/>';
    }).join("");
    var xl = points.map(function (p, i) {
      return '<text class="l lx" x="' + x(i) + '" y="' + (H - PB + 18) + '">' +
        esc(monthLabel(p.m).slice(0, 3) + " " + p.m.slice(2, 4)) + "</text>";
    }).join("");
    return '<svg class="bn-chart" viewBox="0 0 ' + W_ + " " + H + '" preserveAspectRatio="none">' +
      grid + '<path class="s" d="' + path + '"/>' + dots + xl + "</svg>";
  }

  /* ------------------------------ export ------------------------------ */

  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    var month = state.month || thisMonth();
    var rows = state.rows.filter(function (r) { return monthOf(r.shift_date) === month; })
      .sort(function (a, b) {
        return (a.shift_date + a.shift) < (b.shift_date + b.shift) ? -1 : 1;
      });
    if (!rows.length) { W.toast("Nothing to export for " + monthLabel(month), "bad"); return; }

    /* One column per element, per bundle, would make a sparse and unreadable
       sheet. The elements go in one cell as id=value pairs instead, which an
       auditor can read and a spreadsheet can split if they want to. */
    var head = ["Date (shift)", "Shift", "Bundle", "Ward", "Department", "Patient ref",
                "Compliant", "Elements met", "Elements applicable", "Elements",
                "Recorded by", "Recorded at (IST)", "Notes"];
    var lines = [head.map(csvCell).join(",")];
    rows.forEach(function (r) {
      var b = BUNDLES.filter(function (x) { return x.id === r.bundle; })[0];
      var els = Object.keys(r.elements || {}).map(function (k) {
        return k + "=" + r.elements[k];
      }).join("; ");
      lines.push([
        r.shift_date, shiftLabel(r.shift), (b ? b.short : r.bundle), r.ward, r.department || "",
        r.patient_ref || "", r.compliant ? "Yes" : "No", r.passed, r.applicable, els,
        r.auditor_name || "", r.recorded_at || "", r.notes || ""
      ].map(csvCell).join(","));
    });

    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "bundle-compliance-" + month.slice(0, 7) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    W.toast("Exported " + rows.length + " audit" + (rows.length === 1 ? "" : "s"));
  }

  /* ------------------------------ render ------------------------------ */

  function render() {
    var host = el("bnHost");
    if (!host) return;
    var body;
    if (state.view === "report") body = reportView();
    else body = state.bundle ? recordForm() : bundlePicker();
    host.innerHTML = (state.schemaMissing ? schemaNotice() : "") + tabs() + body;
    wire();
    if (state.view === "record" && state.bundle) paintVerdict();
  }

  function wire() {
    var host = el("bnHost");

    host.querySelectorAll("[data-view]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.view = b.getAttribute("data-view");
        render();
      });
    });

    host.querySelectorAll("[data-bundle]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.bundle = BUNDLES.filter(function (x) { return x.id === b.getAttribute("data-bundle"); })[0];
        answers = {};
        render();
      });
    });

    var back = host.querySelector("[data-back]");
    if (back) back.addEventListener("click", function () {
      state.bundle = null; answers = {}; render();
    });

    host.querySelectorAll(".bn-ans").forEach(function (b) {
      b.addEventListener("click", function () {
        var elId = b.getAttribute("data-el"), val = b.getAttribute("data-val");
        answers[elId] = answers[elId] === val ? undefined : val;
        host.querySelectorAll('.bn-ans[data-el="' + elId + '"]').forEach(function (x) {
          x.classList.toggle("on", x.getAttribute("data-val") === answers[elId]);
        });
        paintVerdict();
      });
    });

    var allYes = el("bnAllYes");
    if (allYes) allYes.addEventListener("click", function () {
      state.bundle.elements.forEach(function (e) { answers[e.id] = "yes"; });
      host.querySelectorAll(".bn-ans").forEach(function (x) {
        x.classList.toggle("on", x.getAttribute("data-val") === "yes");
      });
      paintVerdict();
    });

    var save = el("bnSave");
    if (save) save.addEventListener("click", saveAudit);

    var mSel = el("bnMonth");
    if (mSel) mSel.addEventListener("change", function () {
      state.month = mSel.value; render();
    });

    var exp = el("bnExport");
    if (exp) exp.addEventListener("click", exportCsv);
  }

  async function saveAudit() {
    var b = state.bundle;
    var ward = (el("bnWard").value || "").trim();
    var patient = (el("bnPatient").value || "").trim();
    if (!ward) { W.toast("Enter the ward.", "bad"); el("bnWard").focus(); return; }
    if (!patient) { W.toast("Enter the patient or bed reference.", "bad"); el("bnPatient").focus(); return; }

    var s = score(b, answers);
    if (!s.complete) { W.toast("Answer every element first.", "bad"); return; }
    if (!s.anyApplicable) { W.toast("Every element is N/A — there is no bundle to score.", "bad"); return; }

    var d = istNow(), sd = shiftFor(d);
    var prior = existing(b.id, ward, patient, sd.date, sd.shift);
    if (prior && !confirm(
      "An audit already exists for " + patient + " on this bundle, this shift.\n\n" +
      "Saving will replace it. A second entry for the same patient and shift is a " +
      "correction, not a new data point — counting both would inflate the denominator.\n\n" +
      "Replace it?")) return;

    var row = {
      id: prior ? prior.id : id(),
      bundle: b.id,
      ward: ward,
      department: (el("bnDept").value || "").trim(),
      patient_ref: patient,
      recorded_at: new Date().toISOString(),
      shift: sd.shift,
      shift_date: sd.date,
      elements: Object.assign({}, answers),
      compliant: s.compliant,
      applicable: s.applicable,
      passed: s.passed,
      auditor_name: (el("bnNurse").value || "").trim(),
      auditor_email: (W.user && W.user.email) || "",
      notes: (el("bnNotes").value || "").trim(),
    };

    try {
      await S.adapter.put(TABLE, row);
    } catch (err) {
      W.toast("Could not save: " + ((err && err.message) || err), "bad");
      return;
    }

    state.ward = ward;   /* remembered for the next patient on the round */
    answers = {};
    await refresh();
    W.toast(
      (s.compliant ? "Compliant" : "Not compliant") + " — " +
      b.short + " audit saved for " + patient + " (" + shiftLabel(sd.shift) + " shift)."
    );
    render();
  }

  /* ------------------------------ boot ------------------------------ */

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    /* Spelled out rather than routed through el(), because tests/workspace-boot
       greps for exactly this call. That guard exists because a page which
       never reveals #wsBody sits blank behind its own loading placeholder and
       looks like a hang — worth keeping greppable. */
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("bundles");
    if (W.renderModeNotice) W.renderModeNotice();

    state.month = thisMonth();
    state.canExport = await loadRole();
    try { await refresh(); }
    catch (err) {
      el("bnHost").innerHTML =
        '<div class="bn-setup"><h3>Could not load</h3><p>' +
        esc(String((err && err.message) || err)) + "</p></div>";
      return;
    }
    render();

    /* The clock strip would otherwise say "Morning shift" all evening on a
       tablet left open at the nursing station. Repaint it every half minute,
       but only the strip, so a half-filled form is never thrown away. */
    setInterval(function () {
      var strip = document.querySelector(".bn-now");
      if (!strip) return;
      var wrap = document.createElement("div");
      wrap.innerHTML = nowStrip();
      strip.replaceWith(wrap.firstChild);
    }, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
