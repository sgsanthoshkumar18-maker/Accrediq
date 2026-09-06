/* AQcredix — the hospital's OWN quality dashboard.
 *
 * WHY THIS EXISTS ALONGSIDE THE GENERAL DASHBOARD.
 * The general dashboard is one shape for every hospital, and no two hospitals share a shape.
 * The departments differ, the KRAs differ, the number of KPIs under each differs, and half of
 * what a department is measured on this year was invented by its own director — "bring a green
 * initiative into the hospital" is a real objective that appears on no standard list. A
 * hospital that cannot find its own departments on its own dashboard reads the whole product
 * as somebody else's demo. So this is built from what they type, and nothing is assumed.
 *
 * The general dashboard is left exactly as it is. This is a second page, not a replacement:
 * a half-finished setup must never leave a hospital worse off than before it started.
 *
 * EVERYTHING IS A METRIC WITH A TARGET AND MONTHLY READINGS.
 * KRAs, KPIs, committees in place, SOPs written, training attended, and the director's green
 * initiative are all the same shape: a name, a target, and a number that changes each month.
 * Modelling them as four different things would mean four trend engines and four sets of
 * charts that drift apart the first time one is edited. One shape means the Pareto that ranks
 * KPI gaps ranks committee gaps for nothing extra.
 *
 * THE MONTH IS THE POINT.
 * A single "achieved" figure answers "how are we doing" and can never answer "is it working".
 * Readings are stamped with the month, so a hospital returning in October writes an October
 * row and the graph grows a point rather than overwriting September. That is what makes the
 * trend honest instead of a number that always looks like today.
 *
 * SETUP IS ONE SITTING, AND IT IS RESUMABLE.
 * Twenty departments is a long afternoon, so every step is saved as it is entered rather than
 * at the end. Closing the tab halfway loses nothing, which is the difference between a feature
 * people finish and one they abandon.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, C = window.AQCharts, esc;

  var DEPTS = "qd_departments", METRICS = "qd_metrics", READINGS = "qd_readings";
  var FINDINGS = "qd_findings", OBLIG = "qd_obligations";

  var depts = [], metrics = [], readings = [], view = "overview", openDept = null;
  var findings = [], oblig = [];

  function id(p) { return p + "_" + Math.random().toString(36).slice(2, 11); }

  /* The month a reading belongs to, in IST — the same clock the rest of the platform reads,
     so a hospital in Chennai entering figures late on the 31st does not file them under the
     following month. */
  function thisMonth() {
    var d = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
    return d.toISOString().slice(0, 7) + "-01";
  }
  function monthLabel(iso) {
    var names = ["January", "February", "March", "April", "May", "June", "July",
                 "August", "September", "October", "November", "December"];
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
    return m ? names[+m[2] - 1] + " " + m[1] : String(iso || "");
  }
  function shortMonth(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
    return m ? ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m[2] - 1] : "";
  }

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function metricsOf(did) {
    return metrics.filter(function (m) { return m.dept_id === did; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
  }
  function readingsOf(mid) {
    return readings.filter(function (r) { return r.metric_id === mid; })
      .sort(function (a, b) { return String(a.month) < String(b.month) ? -1 : 1; });
  }
  function latest(mid) {
    var rs = readingsOf(mid);
    return rs.length ? rs[rs.length - 1] : null;
  }

  /* ------------------------------------------------------------------ scoring
     HOW FAR TOWARDS TARGET, AS A PERCENTAGE — and it has to handle both directions. A hand
     hygiene score of 78 against a target of 95 is 82% of the way there. An infection rate of
     3 against a target of 2 is NOT 150% of the way there; it is over, and the number has to
     fall. Treating every metric as "higher is better" is the single easiest way to draw a
     dashboard that congratulates a hospital for getting worse. */
  function attainment(metric, achieved) {
    var t = num(metric.target), a = num(achieved);
    if (t == null || a == null) return null;
    if (metric.higher_is_better === false) {
      if (a <= 0) return 100;
      return Math.max(0, Math.min(150, Math.round((t / a) * 100)));
    }
    if (t <= 0) return a > 0 ? 100 : 0;
    return Math.max(0, Math.min(150, Math.round((a / t) * 100)));
  }

  function deptScore(dept) {
    var ms = metricsOf(dept.id), vals = [];
    ms.forEach(function (m) {
      var r = latest(m.id);
      if (!r) return;
      var a = attainment(m, r.achieved);
      if (a != null) vals.push(Math.min(100, a));
    });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (n, v) { return n + v; }, 0) / vals.length);
  }

  function band(score) {
    if (score == null) return { key: "none", label: "Not measured yet", tone: "var(--fg-faint)" };
    if (score >= 90) return { key: "ok", label: "On target", tone: "var(--ok)" };
    if (score >= 70) return { key: "warn", label: "Below target", tone: "var(--warn)" };
    return { key: "nc", label: "Needs attention", tone: "var(--nc)" };
  }

  /* ------------------------------------------------------- findings, derived

     One table, read four ways. The hospital records a finding once — when it was raised,
     which chapter, why it happened, and when it was closed — and the donut, the Pareto and
     the open-findings line all fall out of that. Asking for three separate summaries would
     guarantee they disagree by the second month, and none of them could be audited back to
     a finding an assessor could ask to see. */

  /* Open at the END of a month: raised on or before it, and not closed until after it.
     A stored "open count" per month could not answer WHICH, which is the first question. */
  function openAtMonth(iso) {
    return findings.filter(function (f) {
      if (!f.raised_month || f.raised_month > iso) return false;
      return !f.closed_month || f.closed_month > iso;
    }).length;
  }

  /* The months the hospital has actually recorded something in — never a fixed twelve.
     A hospital two months into using this must not be shown ten months of flat zero, which
     reads as "nothing went wrong" rather than "we were not here yet". */
  function findingMonths() {
    var seen = {};
    findings.forEach(function (f) { if (f.raised_month) seen[f.raised_month] = 1; });
    oblig.forEach(function (o) { if (o.month) seen[o.month] = 1; });
    return Object.keys(seen).sort();
  }

  function tally(rows, key) {
    var by = {};
    rows.forEach(function (f) {
      var k = (f[key] || "").trim() || "Not stated";
      by[k] = (by[k] || 0) + 1;
    });
    return Object.keys(by).map(function (k) { return { label: k, v: by[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
  }

  function openFindings() {
    return findings.filter(function (f) { return !f.closed_month; });
  }

  /* The newest month record, and separately the newest assessment date on any of them —
     the date is entered once and must not have to be retyped every month to stay visible. */
  function latestOblig() {
    return oblig.slice().sort(function (a, b) {
      return String(b.month || "").localeCompare(String(a.month || ""));
    })[0] || null;
  }
  function assessmentDate() {
    var withDate = oblig.filter(function (o) { return o.assessment_date; })
      .sort(function (a, b) { return String(b.month).localeCompare(String(a.month)); });
    return withDate.length ? withDate[0].assessment_date : null;
  }
  function daysToAssessment() {
    var d = assessmentDate();
    if (!d) return null;
    var ms = new Date(d + "T00:00:00Z").getTime() - Date.now();
    return Math.max(0, Math.round(ms / 86400000));
  }

  /* Causes the hospital has already used, offered back as a datalist. Free text underneath,
     because the eighth cause is always one nobody thought to list — but without the list,
     "Incomplete documentation" and "incomplete docs" become two bars on the same Pareto. */
  function knownCauses() {
    var seen = {};
    findings.forEach(function (f) { if (f.cause) seen[f.cause.trim()] = 1; });
    return Object.keys(seen).sort();
  }

  var CHAPTERS = ["AAC", "COP", "MOM", "PRE", "HIC", "PSQ", "ROM", "FMS", "HRM", "IMS"];

  var KIND_LABEL = { kra: "KRA", kpi: "KPI", committee: "Committee",
                     sop: "SOP", training: "Learning & development", custom: "Custom" };

  /* ================================ the setup wizard ================================ */

  function setupIntro() {
    return '<div class="qd-intro">' +
      "<h2>Build your hospital&rsquo;s own dashboard</h2>" +
      "<p>The general dashboard shows one shape for every hospital. Yours is not that shape " +
      "&mdash; your departments, your KRAs, your targets. Enter them once and every chart on " +
      "this page is drawn from your own numbers.</p>" +
      '<ol class="qd-steps">' +
        "<li><b>Name your departments.</b> As many as you have, called what you call them.</li>" +
        "<li><b>For each one, what it is measured on.</b> KRAs and KPIs with a target, how " +
          "many committees and SOPs it should have and how many it has, and its training " +
          "record. Anything else the director has set it, add as your own.</li>" +
        "<li><b>Each month, update what has been achieved.</b> That is what builds the trend " +
          "&mdash; one figure per measure, not a re-entry of everything.</li>" +
      "</ol>" +
      '<p class="tr-hint">Everything saves as you type it. You can stop halfway and come ' +
        "back to exactly where you were.</p>" +
      '<button class="btn btn-accent" id="qdStart">Add the first department</button></div>';
  }

  function deptForm(d) {
    var e = d || {};
    modal("<h3>" + (d ? "Edit department" : "Add a department") + "</h3>" +
      '<form id="qdDeptForm" class="ws-form"' + (d ? ' data-id="' + esc(e.id) + '"' : "") + ">" +
      '<div class="ws-f ws-f-wide"><label>Department name *</label>' +
        '<input name="name" required value="' + esc(e.name || "") + '" ' +
        'placeholder="Casualty" autocomplete="off"></div>' +
      '<div class="ws-f ws-f-wide"><label>Head of department</label>' +
        '<input name="head" value="' + esc(e.head || "") + '" placeholder="Dr A Kumar"></div>' +
      '<p class="tr-hint">Call it what your hospital calls it. Nothing here is matched ' +
        "against a standard list &mdash; a department that exists only in your hospital is " +
        "exactly what this page is for.</p>" +
      /* SAY WHAT COMES NEXT. This step asks two questions and the next one asks fifteen, so on
         its own it reads as though the whole setup is a name and an HOD — which is a fair
         reading, and it is wrong. The KRAs, KPIs, targets, committees, SOPs and training are
         all on the following step, which opens by itself the moment this is saved. */
      (d ? "" :
        '<p class="qd-next"><b>Next:</b> what this department is measured on &mdash; its KRAs ' +
        "and KPIs with their targets, how many committees and SOPs it should have and how " +
        "many it has, and its training record. That step opens as soon as you save this " +
        "one.</p>") +
      '<div class="ws-modal-actions">' +
        (d ? '<button type="button" class="btn btn-ghost" id="qdDeptDel">Delete</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">' +
          (d ? "Save" : "Save and continue") + "</button></div></form>");
  }

  async function saveDept(f) {
    var fd = new FormData(f), rid = f.getAttribute("data-id");
    var name = String(fd.get("name") || "").trim();
    if (!name) throw new Error("a department needs a name");
    await S.adapter.put(DEPTS, {
      id: rid || id("qdd"),
      name: name,
      head: String(fd.get("head") || "").trim() || null,
      position: rid ? (depts.filter(function (x) { return x.id === rid; })[0] || {}).position || 0
                    : depts.length
    });
  }

  /* ---- findings and the month record ---- */

  /* A <input type="month"> gives "2026-09". Everything downstream compares months as ISO
     dates, so it is normalised to the first here rather than at four separate read sites. */
  function firstOf(v) {
    var s = String(v || "").trim();
    return /^\d{4}-\d{2}$/.test(s) ? s + "-01" : (s || null);
  }

  async function saveFinding(f) {
    var fd = new FormData(f), rid = f.getAttribute("data-id");
    var raised = firstOf(fd.get("raised"));
    if (!raised) throw new Error("a finding needs the month it was raised");
    await S.adapter.put(FINDINGS, {
      id: rid || id("qdf"),
      raised_month: raised,
      closed_month: firstOf(fd.get("closed")),
      chapter: String(fd.get("chapter") || "").trim().toUpperCase() || null,
      /* Trimmed but not case-folded: the Pareto groups on this string, and a hospital that
         writes "Expired stock on shelf" deserves to see it back in its own words. The
         datalist of previous answers is what keeps the groups from splitting. */
      cause: String(fd.get("cause") || "").trim() || null,
      dept_id: String(fd.get("dept") || "") || null,
      severity: String(fd.get("severity") || "nc"),
      note: String(fd.get("note") || "").trim() || null
    });
  }

  async function saveOblig(f) {
    var fd = new FormData(f), month = f.getAttribute("data-month");
    var existing = oblig.filter(function (x) { return x.month === month; })[0];
    await S.adapter.put(OBLIG, {
      id: (existing && existing.id) || id("qdo"),
      month: month,
      evidence_filed_pct: num(fd.get("evidence")),
      training_closed_pct: num(fd.get("training")),
      elements_evidenced: num(fd.get("done")),
      elements_total: num(fd.get("total")),
      assessment_date: String(fd.get("assess") || "") || null
    });
  }

  /* ---- metrics ---- */

  function metricRow(n, m) {
    m = m || {};
    return '<div class="qd-mrow" data-mrow>' +
      '<span class="qd-mrow-n">' + n + "</span>" +
      '<div class="ws-f"><label>What is measured *</label>' +
        '<input data-m="name" required value="' + esc(m.name || "") + '" ' +
        'placeholder="Hand hygiene compliance"></div>' +
      '<div class="ws-f qd-narrow"><label>Type</label><select data-m="kind">' +
        ["kpi", "kra", "committee", "sop", "training", "custom"].map(function (k) {
          return '<option value="' + k + '"' + (m.kind === k ? " selected" : "") + ">" +
                 KIND_LABEL[k] + "</option>";
        }).join("") + "</select></div>" +
      '<div class="ws-f qd-narrow"><label>Unit</label>' +
        '<input data-m="unit" value="' + esc(m.unit || "") + '" placeholder="%"></div>' +
      '<div class="ws-f qd-narrow"><label>Target *</label>' +
        '<input data-m="target" type="number" step="any" required value="' +
        esc(m.target == null ? "" : m.target) + '"></div>' +
      '<div class="ws-f qd-narrow"><label>Good is</label><select data-m="dir">' +
        '<option value="up"' + (m.higher_is_better === false ? "" : " selected") + ">Higher</option>" +
        '<option value="down"' + (m.higher_is_better === false ? " selected" : "") + ">Lower</option>" +
        "</select></div>" +
      (n > 1 ? '<button type="button" class="cc-batch-x" data-rmmetric>Remove</button>' : "") +
      "</div>";
  }

  function metricsForm(dept) {
    var existing = metricsOf(dept.id);
    modal("<h3>What is " + esc(dept.name) + " measured on?</h3>" +
      '<form id="qdMetricsForm" class="ws-form" data-dept="' + esc(dept.id) + '">' +
      '<p class="tr-hint">One row per thing you track. <b>Higher</b> or <b>lower</b> matters: ' +
        "an infection rate falling is good and a compliance score falling is not, and the " +
        "charts colour themselves from that rather than from the direction of the number.</p>" +
      '<div id="qdMetricRows">' +
        (existing.length ? existing.map(function (m, i) { return metricRow(i + 1, m); }).join("")
                         : metricRow(1)) + "</div>" +
      '<button type="button" class="btn btn-ghost btn-sm" id="qdAddMetric">+ Add another</button>' +
      '<div class="qd-presets"><span>Add the usual ones:</span>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-preset="committee">Committees</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-preset="sop">SOPs</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-preset="training">Training</button>' +
      "</div>" +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Save</button></div></form>');

    var box = document.getElementById("qdMetricRows");
    document.getElementById("qdAddMetric").addEventListener("click", function () {
      box.insertAdjacentHTML("beforeend", metricRow(box.querySelectorAll("[data-mrow]").length + 1));
      box.lastElementChild.querySelector('[data-m="name"]').focus();
    });
    /* The three every hospital tracks, pre-filled rather than explained. Typing "Committees
       this department sits on" twenty times is the kind of work that stops a setup halfway. */
    var PRESET = {
      committee: { name: "Committees this department sits on", kind: "committee", unit: "count" },
      sop: { name: "SOPs written and current", kind: "sop", unit: "count" },
      training: { name: "Training sessions attended", kind: "training", unit: "count" }
    };
    document.querySelector(".qd-presets").addEventListener("click", function (e) {
      var b = e.target.closest("[data-preset]");
      if (!b) return;
      box.insertAdjacentHTML("beforeend",
        metricRow(box.querySelectorAll("[data-mrow]").length + 1, PRESET[b.getAttribute("data-preset")]));
    });
    box.addEventListener("click", function (e) {
      if (!e.target.closest("[data-rmmetric]")) return;
      e.target.closest("[data-mrow]").remove();
      [].forEach.call(box.querySelectorAll(".qd-mrow-n"), function (el, i) { el.textContent = i + 1; });
    });
  }

  async function saveMetrics(f) {
    var dept = f.getAttribute("data-dept");
    var rows = [].slice.call(f.querySelectorAll("[data-mrow]"));
    if (!rows.length) throw new Error("add at least one measure");

    /* Validated before anything is written. Half a department's measures saved is worse than
       none: the dashboard would score it against a list nobody meant to be complete. */
    rows.forEach(function (r) {
      if (!String(r.querySelector('[data-m="name"]').value || "").trim()) {
        throw new Error("every row needs something to measure");
      }
      if (num(r.querySelector('[data-m="target"]').value) == null) {
        throw new Error("every row needs a target — it is what the chart compares against");
      }
    });

    /* Replaced wholesale rather than merged: this form IS the department's list, so a row the
       hospital deleted here has to disappear from the dashboard too. Readings for a removed
       metric go with it, which is why the delete is explicit and not a side effect. */
    var old = metricsOf(dept);
    for (var o = 0; o < old.length; o++) await S.adapter.remove(METRICS, old[o].id);

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      await S.adapter.put(METRICS, {
        id: id("qdm"),
        dept_id: dept,
        kind: r.querySelector('[data-m="kind"]').value || "kpi",
        name: String(r.querySelector('[data-m="name"]').value).trim(),
        unit: String(r.querySelector('[data-m="unit"]').value || "").trim() || null,
        target: num(r.querySelector('[data-m="target"]').value),
        higher_is_better: r.querySelector('[data-m="dir"]').value !== "down",
        position: i
      });
    }
  }

  /* ---- the monthly figure ---- */

  function monthForm(dept) {
    var ms = metricsOf(dept.id);
    if (!ms.length) { W.toast("Add what this department is measured on first", "bad"); return; }
    var month = thisMonth();
    modal("<h3>" + esc(monthLabel(month)) + " &mdash; " + esc(dept.name) + "</h3>" +
      '<form id="qdMonthForm" class="ws-form" data-dept="' + esc(dept.id) +
        '" data-month="' + month + '">' +
      '<p class="tr-hint">Only what has been <b>achieved</b>. Targets stay as you set them, ' +
        "and last month&rsquo;s figures are left alone &mdash; that is what the trend is made " +
        "of.</p>" +
      ms.map(function (m) {
        var r = readings.filter(function (x) { return x.metric_id === m.id && x.month === month; })[0];
        var prev = readingsOf(m.id).filter(function (x) { return x.month < month; }).pop();
        return '<div class="qd-mrow" data-monthrow data-metric="' + esc(m.id) + '">' +
          '<div class="ws-f"><label>' + esc(m.name) +
            ' <span class="qd-tag">' + esc(KIND_LABEL[m.kind] || m.kind) + "</span></label>" +
            '<input data-v="achieved" type="number" step="any" value="' +
            esc(r ? r.achieved : "") + '" placeholder="' +
            (prev ? "last: " + esc(prev.achieved) : "") + '"></div>' +
          '<div class="qd-target">target ' + esc(m.target) + (m.unit ? " " + esc(m.unit) : "") +
            '<span>' + (m.higher_is_better === false ? "lower is better" : "higher is better") +
            "</span></div>" +
          "</div>";
      }).join("") +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Save ' + esc(shortMonth(month)) +
        "</button></div></form>");
  }

  async function saveMonth(f) {
    var month = f.getAttribute("data-month");
    var rows = [].slice.call(f.querySelectorAll("[data-monthrow]"));
    for (var i = 0; i < rows.length; i++) {
      var mid = rows[i].getAttribute("data-metric");
      var v = rows[i].querySelector('[data-v="achieved"]').value;
      var existing = readings.filter(function (x) { return x.metric_id === mid && x.month === month; })[0];
      /* A blank box means "not measured this month", which is a real answer and is not the
         same as zero. Storing it as 0 would draw a cliff on the trend that never happened. */
      if (String(v).trim() === "") {
        if (existing) await S.adapter.remove(READINGS, existing.id);
        continue;
      }
      await S.adapter.put(READINGS, {
        id: existing ? existing.id : id("qdr"),
        metric_id: mid, month: month, achieved: num(v)
      });
    }
    W.toast(monthLabel(month) + " saved");
  }

  /* ================================ the dashboard ================================ */

  /* ONE FINDING. Short on purpose: a quality manager records these while walking a ward,
     and a form long enough to need a desk is a form that gets filled in from memory a week
     later. Everything optional except the month, because a finding you cannot categorise
     yet is still a finding, and losing it to a required field is the worse outcome. */
  function findingForm(f) {
    f = f || {};
    var causes = knownCauses();
    modal("<h3>" + (f.id ? "Edit finding" : "Record a finding") + "</h3>" +
      '<form id="qdFindingForm"' + (f.id ? ' data-id="' + esc(f.id) + '"' : "") + ">" +
      '<div class="ws-form">' +
        '<div class="ws-f"><label>Month raised *</label>' +
          '<input name="raised" type="month" required value="' +
          esc((f.raised_month || thisMonth()).slice(0, 7)) + '"></div>' +
        '<div class="ws-f"><label>Chapter</label><input name="chapter" list="qdChapters" ' +
          'value="' + esc(f.chapter || "") + '" placeholder="MOM"></div>' +
        '<datalist id="qdChapters">' +
          CHAPTERS.map(function (c) { return '<option value="' + c + '">'; }).join("") +
        "</datalist>" +
        '<div class="ws-f ws-f-wide"><label>Why did it happen?</label>' +
          '<input name="cause" list="qdCauses" value="' + esc(f.cause || "") + '" ' +
          'placeholder="Incomplete documentation" autocomplete="off"></div>' +
        '<datalist id="qdCauses">' +
          causes.map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") +
        "</datalist>" +
        '<div class="ws-f"><label>Department</label><select name="dept">' +
          '<option value="">&mdash; not specific &mdash;</option>' +
          depts.map(function (d) {
            return '<option value="' + esc(d.id) + '"' +
              (f.dept_id === d.id ? " selected" : "") + ">" + esc(d.name) + "</option>";
          }).join("") + "</select></div>" +
        '<div class="ws-f"><label>Kind</label><select name="severity">' +
          ["nc:Non-conformity", "observation:Observation", "oi:Opportunity"].map(function (o) {
            var p = o.split(":");
            return '<option value="' + p[0] + '"' +
              ((f.severity || "nc") === p[0] ? " selected" : "") + ">" + p[1] + "</option>";
          }).join("") + "</select></div>" +
        '<div class="ws-f"><label>Month closed</label>' +
          '<input name="closed" type="month" value="' +
          esc(f.closed_month ? f.closed_month.slice(0, 7) : "") + '"></div>' +
        '<div class="ws-f ws-f-wide"><label>Note</label>' +
          '<input name="note" value="' + esc(f.note || "") + '" ' +
          'placeholder="Anything the next reader needs"></div>' +
      "</div>" +
      /* Leaving "month closed" empty is what keeps a finding on the open line. Saying so
         here saves the support message asking why the count never falls. */
      '<p class="tr-hint">Leave <b>month closed</b> empty while the finding is still open ' +
        "&mdash; that is what keeps it on the open-findings line.</p>" +
      '<div class="ws-modal-actions">' +
        (f.id ? '<button type="button" class="btn btn-ghost qd-danger" id="qdDelFinding">Delete</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save finding</button></div></form>');
  }

  /* THE MONTH RECORD. Two percentages and one count — whole-hospital, never per department,
     because a departmental split of "evidence filed" adds up to a total that means nothing.
     Committees are absent on purpose: the workspace already runs a committee calendar, and
     asking for the same figure twice produces two answers and no way to tell which is right. */
  function obligForm(month) {
    var o = oblig.filter(function (x) { return x.month === month; })[0] || {};
    var known = assessmentDate();
    modal("<h3>" + esc(monthLabel(month)) + " &mdash; evidence and obligations</h3>" +
      '<form id="qdObligForm" data-month="' + esc(month) + '">' +
      '<div class="ws-form">' +
        '<div class="ws-f"><label>Evidence filed (%)</label>' +
          '<input name="evidence" type="number" step="any" min="0" max="100" value="' +
          esc(o.evidence_filed_pct == null ? "" : o.evidence_filed_pct) + '" placeholder="78"></div>' +
        '<div class="ws-f"><label>Training closed (%)</label>' +
          '<input name="training" type="number" step="any" min="0" max="100" value="' +
          esc(o.training_closed_pct == null ? "" : o.training_closed_pct) + '" placeholder="61"></div>' +
        '<div class="ws-f"><label>Elements evidenced</label>' +
          '<input name="done" type="number" step="1" min="0" value="' +
          esc(o.elements_evidenced == null ? "" : o.elements_evidenced) + '" placeholder="651"></div>' +
        '<div class="ws-f"><label>Elements in scope</label>' +
          '<input name="total" type="number" step="1" min="0" value="' +
          esc(o.elements_total == null ? "" : o.elements_total) + '" placeholder="745"></div>' +
        '<div class="ws-f ws-f-wide"><label>Assessment date</label>' +
          '<input name="assess" type="date" value="' +
          esc(o.assessment_date || known || "") + '"></div>' +
      "</div>" +
      '<p class="tr-hint">The assessment date is carried forward &mdash; enter it once and ' +
        "every later month keeps counting down to it.</p>" +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save month</button></div></form>');
  }

  /* The findings half of the overview. Rendered only once there is something to draw —
     an empty donut beside an empty Pareto is four panels of nothing saying "broken". */
  function findingsPanels() {
    var open = openFindings();
    var months = findingMonths();
    var ob = latestOblig();
    var days = daysToAssessment();

    if (!findings.length && !oblig.length) {
      return '<div class="aqc-panel qd-findings-cta">' +
        "<h3>Findings, evidence and training</h3>" +
        "<p class=\"aqc-note\">Record a finding once &mdash; when it was raised, which chapter, " +
          "and why it happened &mdash; and three charts build themselves from it: findings by " +
          "chapter, why findings happen, and how many are still open month by month.</p>" +
        '<div class="ws-f-actions"><button class="btn btn-ghost" id="qdAddMonth2">' +
          "Enter this month&rsquo;s evidence</button>" +
          '<button class="btn btn-primary" id="qdAddFinding2">Record a finding</button></div></div>';
    }

    var trend = months.map(function (m) { return { m: shortMonth(m), v: openAtMonth(m) }; });
    var rings = [];
    if (ob && ob.evidence_filed_pct != null) {
      rings.push({ label: "Evidence filed", pct: num(ob.evidence_filed_pct),
                   tone: "var(--accent-bright)" });
    }
    if (ob && ob.training_closed_pct != null) {
      rings.push({ label: "Training closed", pct: num(ob.training_closed_pct),
                   tone: num(ob.training_closed_pct) >= 80 ? "var(--ok)" : "var(--nc)" });
    }

    var head =
      '<div class="qd-cards">' +
        C.card({ label: "Open findings", value: open.length, higherIsBetter: false,
                 note: findings.length + " recorded in total" }) +
        C.card({ label: "Closed", value: findings.length - open.length,
                 note: "resolved and evidenced" }) +
        (ob && ob.elements_total
          ? C.card({ label: "Elements evidenced",
                     value: (ob.elements_evidenced || 0) + " / " + ob.elements_total,
                     note: monthLabel(ob.month) })
          : "") +
        (days != null
          ? C.card({ label: "Assessment window", value: days, unit: " days",
                     note: assessmentDate() })
          : "") +
      "</div>";

    return head +
      '<div class="qd-grid2">' +
        '<div class="aqc-panel"><h3>Findings by chapter</h3>' +
          '<p class="aqc-note">Every finding recorded, grouped by the chapter it was raised ' +
            "against.</p>" +
          C.pie(tally(findings, "chapter"),
                { centre: String(findings.length), centreSub: "findings",
                  empty: "No findings recorded yet." }) + "</div>" +
        '<div class="aqc-panel"><h3>Why findings happen</h3>' +
          '<p class="aqc-note">The line is the running share. Where it flattens, the rest is ' +
            "detail &mdash; fix what is left of it.</p>" +
          C.pareto(tally(findings, "cause"), { empty: "No causes recorded yet." }) + "</div>" +
      "</div>" +
      '<div class="qd-grid2">' +
        '<div class="aqc-panel"><h3>Still open, month by month</h3>' +
          '<p class="aqc-note">Raised on or before the month and not closed until after it. ' +
            "Only months you have recorded are drawn.</p>" +
          C.area(trend, { zeroBased: true, label: "Open findings by month",
                          empty: "Two months of findings will draw the trend." }) + "</div>" +
        '<div class="aqc-panel"><h3>Evidence and training</h3>' +
          (rings.length
            ? C.rings(rings, days == null ? {} : { centre: { value: String(days), label: "days" } })
            : '<p class="aqc-empty">No month record entered yet.</p>') +
          '<div class="ws-f-actions"><button class="btn btn-ghost" id="qdAddMonth2">' +
            "Enter this month&rsquo;s figures</button></div>" +
        "</div>" +
      "</div>" +
      '<div class="aqc-panel"><h3>Every finding</h3>' + findingTable() + "</div>";
  }

  function findingTable() {
    if (!findings.length) return '<p class="aqc-empty">Nothing recorded yet.</p>';
    var deptName = {};
    depts.forEach(function (d) { deptName[d.id] = d.name; });
    var rows = findings.slice().sort(function (a, b) {
      return String(b.raised_month || "").localeCompare(String(a.raised_month || ""));
    });
    return '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
      "<th>Raised</th><th>Chapter</th><th>Why</th><th>Department</th>" +
      "<th>Status</th><th></th></tr></thead><tbody>" +
      rows.map(function (f) {
        return "<tr><td>" + esc(shortMonth(f.raised_month)) + "</td>" +
          "<td>" + esc(f.chapter || "—") + "</td>" +
          "<td>" + esc(f.cause || "—") + "</td>" +
          "<td>" + esc(f.dept_id ? (deptName[f.dept_id] || "—") : "—") + "</td>" +
          '<td>' + (f.closed_month
            ? '<span class="qd-badge ok">Closed ' + esc(shortMonth(f.closed_month)) + "</span>"
            : '<span class="qd-badge nc">Open</span>') + "</td>" +
          '<td><button class="qd-linkbtn" data-editfinding="' + esc(f.id) + '">Edit</button></td>' +
          "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  function overview() {
    if (!depts.length) return setupIntro();

    var scored = depts.map(function (d) {
      var s = deptScore(d);
      return { d: d, score: s, band: band(s), metrics: metricsOf(d.id).length };
    });
    var measured = scored.filter(function (x) { return x.score != null; });
    var hospital = measured.length
      ? Math.round(measured.reduce(function (n, x) { return n + x.score; }, 0) / measured.length)
      : null;

    /* The mix, so "how are we doing" has an answer before any single department is opened. */
    var mix = ["ok", "warn", "nc", "none"].map(function (k) {
      var b = band(k === "ok" ? 95 : k === "warn" ? 80 : k === "nc" ? 40 : null);
      return { label: b.label, tone: b.tone,
               v: scored.filter(function (x) { return x.band.key === k; }).length };
    });

    /* Where the gap actually is. Ranked by how far each department is from its own targets,
       not by score — a department at 40% with two measures matters less than one at 60% with
       twenty, and the cumulative line is what shows that. */
    var gaps = scored.filter(function (x) { return x.score != null && x.score < 100; })
      .map(function (x) { return { label: x.d.name, v: (100 - x.score) * Math.max(1, x.metrics) }; });

    var cards =
      '<div class="qd-cards">' +
        C.card({ label: "Hospital attainment", value: hospital == null ? "—" : hospital + "%",
                 sub: measured.length + " of " + depts.length + " departments measured" }) +
        C.card({ label: "Departments", value: depts.length,
                 sub: metrics.length + " measures tracked" }) +
        C.card({ label: "On target", value: mix[0].v,
                 sub: "at 90% of target or better" }) +
        C.card({ label: "Need attention", value: mix[2].v,
                 sub: "below 70% of target" }) +
      "</div>";

    return cards +
      '<div class="qd-grid2">' +
        '<div class="aqc-panel"><h3>Where the hospital stands</h3>' +
          C.pie(mix, { centre: hospital == null ? "—" : hospital + "%",
                       centreSub: "attainment", title: "Departments by band" }) + "</div>" +
        '<div class="aqc-panel"><h3>Biggest gap to target</h3>' +
          '<p class="aqc-note">Ranked by how far a department is from its own targets, ' +
            "weighted by how much it measures. The line is the running share &mdash; where it " +
            "flattens, the rest is detail.</p>" +
          C.pareto(gaps, { title: "Gap by department", empty: "Nothing is behind target." }) +
        "</div>" +
      "</div>" +
      '<div class="aqc-panel"><h3>Attainment by department</h3>' +
        C.bars(scored.map(function (x) {
          return { label: x.d.name, v: x.score == null ? 0 : x.score, tone: x.band.tone };
        }), { pct: true, max: 100, empty: "No figures entered yet." }) + "</div>" +
      '<div class="qd-depts">' + scored.map(deptCard).join("") + "</div>" +
      /* The findings half sits BELOW the departments, not above. Attainment is the question
         the hospital came to answer; findings are what explains it. Leading with the
         findings would open the page on bad news out of context. */
      '<h2 class="qd-section">Findings, evidence and training</h2>' +
      '<div class="ws-f-actions qd-section-actions">' +
        '<button class="btn btn-ghost" id="qdAddMonth2">This month&rsquo;s figures</button>' +
        '<button class="btn btn-primary" id="qdAddFinding2">Record a finding</button></div>' +
      findingsPanels();
  }

  function deptCard(x) {
    return '<button class="qd-dept" data-open="' + esc(x.d.id) + '">' +
      '<span class="qd-dept-top"><b>' + esc(x.d.name) + "</b>" +
        '<span class="qd-badge ' + x.band.key + '">' + esc(x.band.label) + "</span></span>" +
      (x.d.head ? '<span class="qd-dept-head">' + esc(x.d.head) + "</span>" : "") +
      '<span class="qd-dept-bar"><i style="width:' + Math.min(100, x.score || 0) +
        "%;background:" + x.band.tone + '"></i></span>' +
      '<span class="qd-dept-foot">' + (x.score == null ? "not measured yet" : x.score + "% of target") +
        " &middot; " + x.metrics + " measure" + (x.metrics === 1 ? "" : "s") + "</span></button>";
  }

  /* ---- one department, in detail ---- */

  function deptPanel(d) {
    var ms = metricsOf(d.id);
    var score = deptScore(d), b = band(score);

    if (!ms.length) {
      return '<div class="qd-back"><button class="btn btn-ghost btn-sm" id="qdBack">' +
        "&larr; All departments</button></div>" +
        '<div class="ws-empty"><p><b>' + esc(d.name) + "</b> has nothing to measure yet. " +
        "Add its KRAs, KPIs, committees and SOPs and this page fills itself in.</p>" +
        '<button class="btn btn-accent" data-metrics="' + esc(d.id) + '">Add what it is ' +
        "measured on</button></div>";
    }

    var rows = ms.map(function (m) {
      var r = latest(m.id);
      var a = r ? attainment(m, r.achieved) : null;
      return { m: m, r: r, a: a, bandv: band(a == null ? null : Math.min(100, a)) };
    });

    /* Target against achieved, side by side. Two bars per measure rather than one percentage,
       because "78 against 95" is a fact a head of department can act on and "82%" is not. */
    var compare = rows.filter(function (x) { return x.r; }).map(function (x) {
      return { label: x.m.name, parts: [{ v: num(x.r.achieved) || 0, tone: x.bandv.tone }] };
    });

    var byKind = {};
    rows.forEach(function (x) {
      var k = KIND_LABEL[x.m.kind] || x.m.kind;
      byKind[k] = (byKind[k] || 0) + 1;
    });
    var kindMix = Object.keys(byKind).map(function (k, i) {
      var tones = ["var(--accent-bright)", "var(--brand-2)", "var(--ok)", "var(--warn)",
                   "var(--nc)", "var(--fg-faint)"];
      return { label: k, v: byKind[k], tone: tones[i % tones.length] };
    });

    var gaps = rows.filter(function (x) { return x.a != null && x.a < 100; })
      .map(function (x) { return { label: x.m.name, v: 100 - Math.min(100, x.a) }; });

    /* The trend. Every month that has a reading for anything in this department, averaged to
       the department's attainment — the same figure the card shows, drawn over time. */
    var months = {};
    rows.forEach(function (x) {
      readingsOf(x.m.id).forEach(function (r) {
        var a = attainment(x.m, r.achieved);
        if (a == null) return;
        (months[r.month] = months[r.month] || []).push(Math.min(100, a));
      });
    });
    var trend = Object.keys(months).sort().map(function (mo) {
      var v = months[mo];
      return { label: shortMonth(mo),
               v: Math.round(v.reduce(function (n, k) { return n + k; }, 0) / v.length) };
    });

    return '<div class="qd-back"><button class="btn btn-ghost btn-sm" id="qdBack">' +
        "&larr; All departments</button>" +
        '<div class="qd-back-actions">' +
          '<button class="btn btn-accent btn-sm" data-month="' + esc(d.id) + '">Update ' +
            esc(shortMonth(thisMonth())) + " figures</button>" +
          '<button class="btn btn-ghost btn-sm" data-metrics="' + esc(d.id) + '">Edit measures</button>' +
          '<button class="btn btn-ghost btn-sm" data-editdept="' + esc(d.id) + '">Edit department</button>' +
        "</div></div>" +

      '<div class="qd-cards">' +
        C.card({ label: esc(d.name) + " attainment", value: score == null ? "—" : score + "%",
                 sub: b.label }) +
        C.card({ label: "Measures", value: ms.length, sub: "KRAs, KPIs and more" }) +
        C.card({ label: "On target", value: rows.filter(function (x) { return x.a != null && x.a >= 90; }).length,
                 sub: "of " + rows.filter(function (x) { return x.r; }).length + " with a figure" }) +
        C.card({ label: "Months recorded", value: trend.length,
                 sub: trend.length < 2 ? "a trend needs two" : "trend below" }) +
      "</div>" +

      '<div class="aqc-panel"><h3>How ' + esc(d.name) + " has moved</h3>" +
        (trend.length < 2
          ? '<p class="aqc-empty">One month recorded. Come back after the next update and ' +
            "this becomes a line &mdash; that is the whole reason the figures are stamped " +
            "with their month.</p>"
          : C.area(trend, { pct: true, max: 100 })) + "</div>" +

      '<div class="qd-grid2">' +
        '<div class="aqc-panel"><h3>What this department tracks</h3>' +
          C.pie(kindMix, { centre: ms.length, centreSub: "measures" }) + "</div>" +
        '<div class="aqc-panel"><h3>Furthest from target</h3>' +
          C.pareto(gaps, { title: "Gap by measure", empty: "Everything is at target." }) + "</div>" +
      "</div>" +

      '<div class="aqc-panel"><h3>Achieved against target</h3>' +
        C.bars(compare, { empty: "No figures entered yet." }) + "</div>" +

      '<div class="aqc-panel"><h3>Every measure</h3>' + metricTable(rows) + "</div>";
  }

  function metricTable(rows) {
    return '<div class="ws-tablewrap"><table class="ws-table">' +
      "<tr><th>Measure</th><th>Type</th><th>Target</th><th>Achieved</th><th>Attainment</th>" +
      "<th>Last recorded</th></tr>" +
      rows.map(function (x) {
        return "<tr><td><b>" + esc(x.m.name) + "</b>" +
          (x.m.higher_is_better === false ? '<span class="tr-sub">lower is better</span>' : "") +
          "</td><td>" + esc(KIND_LABEL[x.m.kind] || x.m.kind) + "</td>" +
          "<td>" + esc(x.m.target) + (x.m.unit ? " " + esc(x.m.unit) : "") + "</td>" +
          "<td>" + (x.r ? esc(x.r.achieved) : "&mdash;") + "</td>" +
          "<td>" + (x.a == null ? "&mdash;"
            : '<span class="tr-tag ' + x.bandv.key + '">' + x.a + "%</span>") + "</td>" +
          "<td>" + (x.r ? esc(monthLabel(x.r.month)) : "&mdash;") + "</td></tr>";
      }).join("") + "</table></div>";
  }

  /* ================================ plumbing ================================ */

  function modal(html) {
    var m = document.getElementById("qdModal");
    m.innerHTML = '<div class="ws-modal-in">' + html + "</div>";
    m.classList.add("open");
    return m;
  }
  function close() {
    var m = document.getElementById("qdModal");
    m.classList.remove("open");
    m.innerHTML = "";
  }

  function render() {
    var host = document.getElementById("qdPanel");
    if (!host) return;
    if (schemaMissing) { host.innerHTML = schemaNotice(); return; }
    var d = openDept ? depts.filter(function (x) { return x.id === openDept; })[0] : null;
    host.innerHTML = d ? deptPanel(d) : overview();

    var bar = document.getElementById("qdActions");
    if (bar) bar.innerHTML = depts.length && !openDept
      ? '<button class="btn btn-accent" id="qdAddDept">Add a department</button>'
      : "";
  }

  /* THE TABLES MIGHT NOT BE THERE YET, AND THAT MUST NOT BE A BLANK PAGE.
     These three tables ship in workspace/schema.sql, and a hospital whose database predates
     them gets PGRST205 from PostgREST on the very first read. Left unhandled that rejects out
     of init() and the page renders nothing at all — which looks like a broken product rather
     than one step of setup that has not been done. Say what is missing and what to run. */
  var schemaMissing = false;

  async function refresh() {
    try {
      depts = (await S.adapter.list(DEPTS)) || [];
      metrics = (await S.adapter.list(METRICS)) || [];
      readings = (await S.adapter.list(READINGS)) || [];
      findings = (await S.adapter.list(FINDINGS)) || [];
      oblig = (await S.adapter.list(OBLIG)) || [];
      schemaMissing = false;
    } catch (err) {
      var msg = String((err && err.message) || err || "");
      /* PGRST205 is "no such table". Anything else is a real fault and should not be dressed
         up as a setup step — the hospital would go looking in the wrong place. */
      if (msg.indexOf("PGRST205") > -1 || /schema cache|does not exist/i.test(msg)) {
        schemaMissing = true;
        depts = []; metrics = []; readings = []; findings = []; oblig = [];
      } else {
        depts = []; metrics = []; readings = []; findings = []; oblig = [];
        var host = document.getElementById("qdPanel");
        if (host) {
          host.innerHTML = '<div class="ws-empty"><p><b>Could not load your dashboard.</b></p>' +
            "<p>" + esc(msg || "The workspace did not answer.") + "</p></div>";
        }
        return;
      }
    }
    depts.sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    render();
  }

  function schemaNotice() {
    return '<div class="qd-intro">' +
      "<h2>One step of setup is missing</h2>" +
      "<p>This page stores your departments, their measures, your findings and each " +
      "month&rsquo;s evidence in five tables that are not in your database yet. They ship " +
      "with the platform &mdash; run " +
      "<code>workspace/schema.sql</code> against your Supabase project (or just the block at " +
      "the end of it, headed <em>THE HOSPITAL&rsquo;S OWN QUALITY DASHBOARD</em>) and reload " +
      "this page.</p>" +
      "<p>Nothing else is affected: every other part of your workspace is working, and no " +
      "existing data is touched by adding them.</p>" +
      '<p class="tr-hint">The block is written to be safe to run more than once &mdash; it ' +
        "creates each table only if it is not already there.</p></div>";
  }

  function wire() {
    document.getElementById("qdPanel").addEventListener("click", function (e) {
      var open = e.target.closest("[data-open]");
      if (open) { openDept = open.getAttribute("data-open"); render(); window.scrollTo(0, 0); return; }
      if (e.target.id === "qdBack") { openDept = null; render(); return; }
      if (e.target.id === "qdStart") { deptForm(); return; }
      var mm = e.target.closest("[data-metrics]");
      if (mm) {
        var dm = depts.filter(function (x) { return x.id === mm.getAttribute("data-metrics"); })[0];
        if (dm) metricsForm(dm);
        return;
      }
      var mo = e.target.closest("[data-month]");
      if (mo) {
        var dmo = depts.filter(function (x) { return x.id === mo.getAttribute("data-month"); })[0];
        if (dmo) monthForm(dmo);
        return;
      }
      var ed = e.target.closest("[data-editdept]");
      if (ed) {
        var de = depts.filter(function (x) { return x.id === ed.getAttribute("data-editdept"); })[0];
        if (de) deptForm(de);
        return;
      }
      if (e.target.id === "qdAddFinding2") { findingForm(); return; }
      if (e.target.id === "qdAddMonth2") { obligForm(thisMonth()); return; }
      var ef = e.target.closest("[data-editfinding]");
      if (ef) {
        var fe = findings.filter(function (x) {
          return x.id === ef.getAttribute("data-editfinding");
        })[0];
        if (fe) findingForm(fe);
      }
    });

    var actions = document.getElementById("qdActions");
    if (actions) actions.addEventListener("click", function (e) {
      if (e.target.id === "qdAddDept") deptForm();
    });

    document.getElementById("qdModal").addEventListener("submit", async function (e) {
      e.preventDefault();
      var f = e.target;
      try {
        if (f.id === "qdDeptForm") await saveDept(f);
        else if (f.id === "qdMetricsForm") await saveMetrics(f);
        else if (f.id === "qdMonthForm") await saveMonth(f);
        else if (f.id === "qdFindingForm") await saveFinding(f);
        else if (f.id === "qdObligForm") await saveOblig(f);
      } catch (err) {
        W.toast("Could not save: " + (err && err.message || err), "bad");
        return;
      }
      close();
      await refresh();
      /* Straight on to what it is measured on. A department with no measures is an empty card,
         and the moment somebody has just named it is the moment they know the answer. */
      if (f.id === "qdDeptForm" && !f.getAttribute("data-id")) {
        var newest = depts[depts.length - 1];
        if (newest) metricsForm(newest);
      }
    });

    document.getElementById("qdModal").addEventListener("click", async function (e) {
      if (e.target === e.currentTarget || e.target.id === "qdCancel") { close(); return; }
      if (e.target.id === "qdDeptDel") {
        var f = document.getElementById("qdDeptForm");
        var rid = f.getAttribute("data-id");
        if (!rid) return;
        var n = metricsOf(rid).length;
        if (!confirm(n ? "Delete this department and its " + n + " measure" +
                         (n === 1 ? "" : "s") + "?" : "Delete this department?")) return;
        for (var i = 0; i < metricsOf(rid).length; i++) {
          await S.adapter.remove(METRICS, metricsOf(rid)[i].id);
        }
        await S.adapter.remove(DEPTS, rid);
        openDept = null;
        close();
        await refresh();
        return;
      }
      if (e.target.id === "qdDelFinding") {
        var ff = document.getElementById("qdFindingForm");
        var fid = ff && ff.getAttribute("data-id");
        if (!fid) return;
        /* Deleting a finding rewrites history on three charts at once, so it asks first —
           and the wording says so, because "Delete?" reads as undoable and this is not. */
        if (!confirm("Delete this finding? It will disappear from the chapter chart, the " +
                     "Pareto and the open-findings trend.")) return;
        await S.adapter.remove(FINDINGS, fid);
        close();
        await refresh();
      }
    });
  }

  async function init() {
    if (!S || !W || !C) return;
    esc = W.esc;

    /* THE GATE, THE SKELETON AND THE BODY — in that order, exactly as every other workspace
       page does it. Leaving this out is what made the page sit on its loading placeholder
       until the shell's twelve-second timeout replaced it with "this is taking longer than it
       should". Nothing was slow and nothing was unreachable: the placeholder is cleared by
       whoever called the gate, and nobody had. */
    if (!(await W.gate())) return;
    var g = document.getElementById("wsGate");
    if (g) g.style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    var body = document.getElementById("wsBody");
    if (body) body.style.display = "";
    W.renderNav("qualitydashboard");
    W.renderModeNotice();

    wire();
    try { await refresh(); } catch (e) {
      var host = document.getElementById("qdPanel");
      if (host) host.innerHTML = '<div class="ws-empty"><p>Could not start: ' +
        esc(String((e && e.message) || e)) + "</p></div>";
    }
    document.dispatchEvent(new Event("aq:content"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
