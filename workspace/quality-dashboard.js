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
  /* The other four sections do not get their own tables. Committees, incidents, code alerts
     and the element register are already in this workspace, already being written by their
     own pages, and a second copy of any of them would be two answers to the same question
     with no way to tell which an assessor should believe. This page reads what is there and
     adds only the columns nobody was recording yet. */
  var CMTES = "committees", MEETINGS = "committee_meetings";
  var INCIDENTS = "incidents", CODES = "code_blue_events", OWNERS = "chapter_owners";

  var depts = [], metrics = [], readings = [], view = "overview", openDept = null;
  var findings = [], oblig = [];
  var cmtes = [], meetings = [], incidents = [], codes = [], owners = [], elementMap = {};

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
    /* Brand blue, not amber. "Below target" is the ordinary middle of the range — most
       departments live here most of the time — and an amber bar for every one of them
       turns the whole chart into a warning about nothing. Amber is kept for status that
       has actually slipped, and it is a foreign colour on a site whose palette is blue.
       Red still marks what genuinely needs attention. */
    if (score >= 70) return { key: "warn", label: "Below target", tone: "var(--accent-bright)" };
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

  /* Taken from the element register itself rather than typed out, because a hand-written
     copy drifts and this one had: it listed HIC, which is the old code for what the current
     edition calls IPC. A finding filed against "HIC" could never match the chapter the
     readiness section computes, so the cross-filter silently found nothing. The literal list
     stays only as a fallback for a page loaded before nabh-data.js. */
  var CHAPTERS = (function () {
    var D = window.NABH_DATA;
    if (D && D.chapters) {
      var k = Object.keys(D.chapters);
      if (k.length) return k;
    }
    return ["AAC", "COP", "MOM", "PRE", "IPC", "PSQ", "ROM", "FMS", "HRM", "IMS"];
  })();

  var KIND_LABEL = { kra: "KRA", kpi: "KPI", committee: "Committee",
                     sop: "SOP", training: "Learning & development", custom: "Custom" };

  /* ======================= the other four sections, in one place =======================

     THE FIVE SECTIONS ARE FIVE QUESTIONS, NOT FIVE PAGES.
     A quality manager does not ask "how is the hospital", they ask one of five things: are
     we hitting our numbers, are the committees actually meeting, what is going wrong, does
     the emergency team turn up, and are we ready for the assessor. One board of thirty tiles
     answers none of them well, because the tile that answers today's question is buried in
     the twenty-nine that do not. So the board is cut into five, each with its own entry
     point and its own charts, and the tab you left on is the tab you come back to.

     WHERE EACH SECTION'S DATA COMES FROM MATTERS MORE THAN THE CHARTS.
     Only the KPI section owns its tables. Committees, incidents and the element register are
     written by pages that already exist, so this page reads them and offers exactly the
     fields that were missing — quorum and action counts on a meeting, the Donabedian
     category on an incident, a champion and an honest override on a chapter. Code alerts are
     the exception: the table existed but only the crash-cart module ever wrote to it, and a
     fire drill has no crash cart, so this page is where a code alert is recorded in full. */

  /* Structure, process, outcome. Donabedian's three, and the reason a hospital records the
     category at all: twenty incidents that are all "process" is a broken workflow, and
     twenty that are all "structure" is a building or a staffing problem. Two very different
     letters to the board, and the incident count alone cannot tell them apart. */
  var DONABEDIAN = [
    ["structure", "Structure", "The setting — equipment, staffing, building, supplies."],
    ["process",   "Process",   "What was done, or not done — the steps of care itself."],
    ["outcome",   "Outcome",   "What happened to the patient as a result."]
  ];
  function donaLabel(k) {
    var hit = DONABEDIAN.filter(function (d) { return d[0] === k; })[0];
    return hit ? hit[1] : "Not classified";
  }

  /* The code colours an Indian hospital actually calls. The tone IS the datum here — a Code
     Red bar drawn in the platform blue would be unreadable to the very people who use these
     names daily — so these are the only literal colours on the page. Yellow is set at a deep
     gold rather than an amber, so it stays legible on the light theme and is never mistaken
     for a warning tone. */
  /* The hex is not written here. Code Black at #111827 is invisible on the dark theme and
     Code White is invisible on the light one, so each colour is a token that the stylesheet
     redefines per theme — the name stays true and the swatch stays visible on both grounds.
     Every other colour on this page is a platform token for the same reason. */
  var CODE_COLOURS = [
    ["blue",   "Code Blue",   "var(--code-blue)",   "Cardiac or respiratory arrest"],
    ["red",    "Code Red",    "var(--code-red)",    "Fire"],
    ["pink",   "Code Pink",   "var(--code-pink)",   "Infant or child abduction"],
    ["purple", "Code Purple", "var(--code-purple)", "Bomb threat"],
    ["yellow", "Code Yellow", "var(--code-yellow)", "Internal emergency"],
    ["orange", "Code Orange", "var(--code-orange)", "Hazardous material spill"],
    ["brown",  "Code Brown",  "var(--code-brown)",  "Mass casualty"],
    ["grey",   "Code Grey",   "var(--code-grey)",   "Combative or violent person"],
    ["black",  "Code Black",  "var(--code-black)",  "Evacuation"],
    ["white",  "Code White",  "var(--code-white)",  "Paediatric or obstetric emergency"]
  ];
  function codeOf(k) {
    return CODE_COLOURS.filter(function (c) { return c[0] === k; })[0] ||
           ["other", "Unclassified", "var(--fg-faint)", ""];
  }

  /* ---- committees ---- */

  function cmteName(id) {
    var c = cmtes.filter(function (x) { return x.id === id; })[0];
    return c ? (c.name || c.short_name || "Committee") : "Committee";
  }
  /* Held, not merely scheduled. A calendar full of planned meetings that never happened is
     the single most common thing an assessor finds, so every figure on this section counts
     only what has a date it was actually held on. */
  function heldMeetings() {
    return meetings.filter(function (m) { return m.held_on; })
      .sort(function (a, b) { return String(a.held_on).localeCompare(String(b.held_on)); });
  }
  function monthOf(d) {
    var s = String(d || "");
    return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) + "-01" : null;
  }
  /* Quorum is only knowable where both figures were entered. Treating a blank required
     figure as "quorum met" would flatter every meeting nobody had finished recording. */
  function quorumMet(m) {
    if (m.quorum_met === true || m.quorum_met === false) return m.quorum_met;
    if (m.attendance == null || m.quorum_required == null) return null;
    return num(m.attendance) >= num(m.quorum_required);
  }

  /* ---- incidents ---- */

  function incMonth(i) {
    return monthOf(i.occurred_at || i.reported_at || i.created_at);
  }
  function incClosed(i) {
    return !!(i.closed_at || i.status === "closed");
  }
  function incClassLabel(k) {
    var E = window.AQIncident;
    if (E && E.classOf) { var c = E.classOf(k); if (c) return c.label; }
    return k ? String(k).replace(/_/g, " ") : "Not classified";
  }

  /* ---- code alerts ---- */

  function codeMonth(c) { return monthOf(c.happened_on); }
  function codeSorted() {
    return codes.slice().sort(function (a, b) {
      return String(a.happened_on).localeCompare(String(b.happened_on));
    });
  }
  /* One event's absent roles, split on commas. Free text on purpose — "anaesthetist" and
     "the on-call anaesthetist" are the same gap, and a fixed list of roles would be wrong
     for the first hospital that reads it. The Pareto groups on the trimmed string, and the
     datalist of what has been typed before is what keeps the groups from splitting. */
  function absentRoles(c) {
    return String(c.absent_roles || "").split(",").map(function (s) { return s.trim(); })
      .filter(Boolean);
  }
  function knownRoles() {
    var seen = {};
    codes.forEach(function (c) { absentRoles(c).forEach(function (r) { seen[r] = 1; }); });
    return Object.keys(seen).sort();
  }

  /* ---- NABH readiness ----

     THE COMPUTED FIGURE AND THE HOSPITAL'S OWN FIGURE ARE BOTH SHOWN, ALWAYS.
     The element register gives a weighted percentage per chapter, which is the honest number
     but lags reality — work done last week is not in it until somebody marks the elements.
     A champion who knows their chapter is further on needs to be able to say so. What must
     never happen is the override quietly replacing the computed figure, because then a
     chapter can mark itself ready and nothing on the page disagrees. So both are carried,
     side by side, and the gap between them is itself worth looking at. */
  function chapterRows() {
    var R = null;
    try { R = S.readiness ? S.readiness(elementMap) : null; } catch (e) { R = null; }
    var by = (R && R.byChapter) || {};
    var ownerBy = {};
    owners.forEach(function (o) { if (o.chapter) ownerBy[o.chapter] = o; });

    var keys = Object.keys(by);
    /* Before the element register has been touched there is still a list of chapters to
       show — a champion can be named on day one, and an empty table would suggest
       otherwise. */
    if (!keys.length) keys = CHAPTERS.slice();

    return keys.map(function (k) {
      var c = by[k] || {};
      var o = ownerBy[k] || {};
      var own = o.readiness_override == null ? null : num(o.readiness_override);
      return {
        key: k,
        name: c.name || k,
        computed: c.pct == null ? null : num(c.pct),
        assessed: c.assessed || 0,
        total: c.total || 0,
        own: own,
        champion: o.champion || "",
        role: o.champion_role || "",
        note: o.note || "",
        id: o.id || null
      };
    }).sort(function (a, b) { return String(a.key).localeCompare(String(b.key)); });
  }
  function overallReadiness() {
    var rows = chapterRows().filter(function (r) { return r.computed != null; });
    if (!rows.length) return null;
    return Math.round(rows.reduce(function (n, r) { return n + r.computed; }, 0) / rows.length);
  }

  /* ================================ the setup wizard ================================ */

  function setupIntro() {
    return '<div class="qd-intro">' +
      "<h2>Build your hospital&rsquo;s own dashboard</h2>" +
      "<p>The general dashboard shows one shape for every hospital. Yours is not that shape " +
      "&mdash; your departments, your KRAs, your targets. Enter them once and every chart on " +
      "this page is drawn from your own numbers.</p>" +
      /* WHAT THE PAGE BECOMES, BEFORE ANY OF IT EXISTS. Somebody looking at an empty page
         is deciding whether the afternoon of typing is worth it, and five section names is
         a far better answer to that than a promise about charts. */
      '<div class="qd-secs">' + SECTIONS.map(function (s) {
        return '<div class="qd-sec"><b>' + esc(s[1]) + "</b><span>" + esc(s[2]) + "</span></div>";
      }).join("") + "</div>" +
      "<p>Four of the five read what your workspace already holds &mdash; your committees, " +
      "your incidents, your element register &mdash; so they start filling in on their own. " +
      "The KPI section is the one that needs you.</p>" +
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

  /* ---------------------------------------------------- a committee meeting

     WHAT THIS FORM ADDS, AND WHAT IT DELIBERATELY DOES NOT.
     The calendar page schedules committees and always has. This one records what happened
     when the meeting was held: who turned up against the quorum the terms of reference
     require, and how many action points were raised and closed. Those three were the
     figures an assessor asks for and the only ones nobody had anywhere to put. Scheduling
     stays on the calendar, and the link says so rather than duplicating it here. */
  function meetingForm(m) {
    m = m || {};
    var isNew = !m.id;
    modal("<h3>" + (isNew ? "Record a meeting" : "Edit meeting") + "</h3>" +
      '<form id="qdMeetingForm"' + (isNew ? "" : ' data-id="' + esc(m.id) + '"') + ">" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label>Committee *</label><select name="cmte" required>' +
          (cmtes.length
            ? '<option value="">&mdash; choose &mdash;</option>' +
              cmtes.map(function (c) {
                return '<option value="' + esc(c.id) + '"' +
                  (m.committee_id === c.id ? " selected" : "") + ">" +
                  esc(c.name || c.short_name || c.id) + "</option>";
              }).join("")
            : '<option value="">no committees set up yet</option>') +
          "</select></div>" +
        '<div class="ws-f"><label>Held on *</label>' +
          '<input name="held" type="date" required value="' + esc(m.held_on || "") + '"></div>' +
        '<div class="ws-f"><label>Members present</label>' +
          '<input name="attendance" type="number" min="0" step="1" value="' +
          esc(m.attendance == null ? "" : m.attendance) + '" placeholder="9"></div>' +
        '<div class="ws-f"><label>Quorum required</label>' +
          '<input name="quorum" type="number" min="0" step="1" value="' +
          esc(m.quorum_required == null ? "" : m.quorum_required) + '" placeholder="7"></div>' +
        '<div class="ws-f"><label>Action points raised</label>' +
          '<input name="raised" type="number" min="0" step="1" value="' +
          esc(m.actions_raised == null ? "" : m.actions_raised) + '" placeholder="6"></div>' +
        '<div class="ws-f"><label>Of those, closed</label>' +
          '<input name="closed" type="number" min="0" step="1" value="' +
          esc(m.actions_closed == null ? "" : m.actions_closed) + '" placeholder="4"></div>' +
        '<div class="ws-f ws-f-wide"><label>Agenda or subject</label>' +
          '<input name="agenda" value="' + esc(m.agenda || "") + '" ' +
          'placeholder="Quarterly review of indicator data"></div>' +
      "</div>" +
      '<p class="tr-hint">Quorum is worked out from the two figures &mdash; enter both and ' +
        "the meeting counts as quorate or not on its own. Leave them blank and it is simply " +
        "not counted either way, which is honest.</p>" +
      '<div class="ws-modal-actions">' +
        (isNew ? "" : '<button type="button" class="btn btn-ghost qd-danger" id="qdDelMeeting">Delete</button>') +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save meeting</button></div></form>');
  }

  async function saveMeeting(f) {
    var fd = new FormData(f), rid = f.getAttribute("data-id");
    var cid = String(fd.get("cmte") || "");
    var held = String(fd.get("held") || "");
    if (!cid) throw new Error("choose which committee met");
    if (!held) throw new Error("a meeting needs the date it was held");
    var existing = meetings.filter(function (x) { return x.id === rid; })[0] || {};
    var att = num(fd.get("attendance")), qr = num(fd.get("quorum"));
    var raised = num(fd.get("raised")), closed = num(fd.get("closed"));
    /* More closed than raised is a typo every time, and it would draw a closure rate above
       100% that nobody could explain to an assessor. */
    if (raised != null && closed != null && closed > raised) {
      throw new Error("more actions closed than were raised — check the two figures");
    }
    await S.adapter.put(MEETINGS, {
      id: rid || id("qdcm"),
      committee_id: cid,
      /* A meeting recorded after the fact still needs the scheduled date the table
         requires. It was scheduled for the day it was held unless we already know
         otherwise. */
      scheduled_on: existing.scheduled_on || held,
      held_on: held,
      status: "held",
      attendance: att,
      quorum_required: qr,
      quorum_met: (att == null || qr == null) ? null : att >= qr,
      actions_raised: raised,
      actions_closed: closed,
      agenda: String(fd.get("agenda") || "").trim() || null
    });
  }

  /* ------------------------------------------------------------- an incident

     THE INCIDENT ITSELF IS REPORTED ON THE INCIDENTS PAGE, NOT HERE.
     That form is the hospital's own reporting form — classification ladder, sign-off chain,
     the one-hour reporting window — and a second, shorter one on this page would produce
     incidents that skip all of it. What this dashboard adds is the field that page never
     asked for: which of Donabedian's three the incident belongs to. So this edits an
     existing incident rather than creating one, and says where to go to create it. */
  function incidentForm(i) {
    i = i || {};
    modal("<h3>Classify " + esc(i.reference || "this incident") + "</h3>" +
      '<form id="qdIncidentForm" data-id="' + esc(i.id) + '">' +
      '<p class="tr-hint">Reported ' + esc(i.department || "—") + " &middot; " +
        esc(incClassLabel(i.classification)) + "</p>" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label>Donabedian category</label>' +
          '<select name="dona">' +
            '<option value="">&mdash; not classified &mdash;</option>' +
            DONABEDIAN.map(function (d) {
              return '<option value="' + d[0] + '"' +
                (i.donabedian === d[0] ? " selected" : "") + ">" + d[1] + " &mdash; " +
                d[2] + "</option>";
            }).join("") +
          "</select></div>" +
        '<div class="ws-f"><label>Status</label><select name="status">' +
          (window.AQIncident && window.AQIncident.STATUSES
            ? window.AQIncident.STATUSES.map(function (s) {
                return '<option value="' + esc(s.key) + '"' +
                  ((i.status || "reported") === s.key ? " selected" : "") + ">" +
                  esc(s.label) + "</option>";
              }).join("")
            : '<option value="reported">Reported</option><option value="closed"' +
              (i.status === "closed" ? " selected" : "") + ">Closed</option>") +
          "</select></div>" +
        '<div class="ws-f"><label>Closed on</label>' +
          '<input name="closed" type="date" value="' +
          esc(String(i.closed_at || "").slice(0, 10)) + '"></div>' +
      "</div>" +
      '<p class="tr-hint">Structure, process or outcome is what turns a count of incidents ' +
        "into a direction to look in. Everything else about this incident stays on the " +
        "incidents page.</p>" +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save</button></div></form>');
  }

  async function saveIncident(f) {
    var fd = new FormData(f), rid = f.getAttribute("data-id");
    var cur = incidents.filter(function (x) { return x.id === rid; })[0];
    if (!cur) throw new Error("that incident is no longer there");
    var closedOn = String(fd.get("closed") || "");
    var status = String(fd.get("status") || cur.status || "reported");
    /* PATCHED, NOT REPLACED. The incidents page keeps the whole report in `payload`, and
       writing a row built only from this form's five fields would throw the rest of it
       away — the sign-offs, the factors, the narrative. Everything already on the row is
       carried forward and only what this form asked about changes. */
    var row = {};
    Object.keys(cur).forEach(function (k) { row[k] = cur[k]; });
    row.donabedian = String(fd.get("dona") || "") || null;
    row.status = status;
    row.closed_at = closedOn ? closedOn + "T00:00:00.000Z"
                             : (status === "closed" ? (cur.closed_at || new Date().toISOString()) : null);
    await S.adapter.put(INCIDENTS, row);
  }

  /* ----------------------------------------------------------- a code alert

     THIS ONE IS RECORDED HERE IN FULL, and it is the only new record on the page.
     The table existed, but only the crash-cart module ever wrote to it — an event was
     something that emptied a cart. A fire drill empties no cart, and neither does a mock
     Code Blue, so three-quarters of a hospital's code alerts had nowhere to be written
     down at all. Drills are marked as drills rather than kept in a separate table: an
     assessor asks how the team performs, and the answer is worth less if the practice runs
     are hidden from it. */
  function codeForm(c) {
    c = c || {};
    var isNew = !c.id;
    var roles = knownRoles();
    modal("<h3>" + (isNew ? "Record a code alert" : "Edit code alert") + "</h3>" +
      '<form id="qdCodeForm"' + (isNew ? "" : ' data-id="' + esc(c.id) + '"') + ">" +
      '<div class="ws-form">' +
        '<div class="ws-f"><label>Which code *</label><select name="colour" required>' +
          '<option value="">&mdash; choose &mdash;</option>' +
          CODE_COLOURS.map(function (k) {
            return '<option value="' + k[0] + '"' +
              (c.code_colour === k[0] ? " selected" : "") + ">" + k[1] + " &mdash; " +
              k[3] + "</option>";
          }).join("") + "</select></div>" +
        '<div class="ws-f"><label>Date *</label>' +
          '<input name="on" type="date" required value="' + esc(c.happened_on || "") + '"></div>' +
        '<div class="ws-f"><label>Real or drill</label><select name="drill">' +
          '<option value="0"' + (c.is_drill ? "" : " selected") + ">Real event</option>" +
          '<option value="1"' + (c.is_drill ? " selected" : "") + ">Mock drill</option>" +
          "</select></div>" +
        '<div class="ws-f"><label>Response time (seconds)</label>' +
          '<input name="secs" type="number" min="0" step="1" value="' +
          esc(c.response_seconds == null ? "" : c.response_seconds) + '" placeholder="180"></div>' +
        '<div class="ws-f"><label>Team expected</label>' +
          '<input name="expected" type="number" min="0" step="1" value="' +
          esc(c.team_expected == null ? "" : c.team_expected) + '" placeholder="6"></div>' +
        '<div class="ws-f"><label>Team present</label>' +
          '<input name="present" type="number" min="0" step="1" value="' +
          esc(c.team_present == null ? "" : c.team_present) + '" placeholder="5"></div>' +
        '<div class="ws-f ws-f-wide"><label>Who was missing</label>' +
          '<input name="absent" list="qdRoles" value="' + esc(c.absent_roles || "") + '" ' +
          'placeholder="Anaesthetist, respiratory therapist" autocomplete="off"></div>' +
        '<datalist id="qdRoles">' +
          roles.map(function (r) { return '<option value="' + esc(r) + '">'; }).join("") +
        "</datalist>" +
        '<div class="ws-f"><label>Team performance (0&ndash;100)</label>' +
          '<input name="score" type="number" min="0" max="100" step="1" value="' +
          esc(c.performance_score == null ? "" : c.performance_score) + '" placeholder="82"></div>' +
        '<div class="ws-f ws-f-wide"><label>Notes</label>' +
          '<input name="notes" value="' + esc(c.notes || "") + '" ' +
          'placeholder="Debrief findings, equipment issues"></div>' +
      "</div>" +
      '<p class="tr-hint">Separate several missing roles with commas &mdash; each one is ' +
        "counted on its own, which is what makes the ranking of who is never there mean " +
        "something.</p>" +
      '<div class="ws-modal-actions">' +
        (isNew ? "" : '<button type="button" class="btn btn-ghost qd-danger" id="qdDelCode">Delete</button>') +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save code alert</button></div></form>');
  }

  async function saveCode(f) {
    var fd = new FormData(f), rid = f.getAttribute("data-id");
    var colour = String(fd.get("colour") || "");
    var on = String(fd.get("on") || "");
    if (!colour) throw new Error("choose which code was called");
    if (!on) throw new Error("a code alert needs the date it happened");
    var exp = num(fd.get("expected")), pres = num(fd.get("present"));
    if (exp != null && pres != null && pres > exp) {
      throw new Error("more of the team present than were expected — check the two figures");
    }
    var cur = codes.filter(function (x) { return x.id === rid; })[0] || {};
    await S.adapter.put(CODES, {
      id: rid || id("qdca"),
      /* Only crash-cart events carry a cart. One recorded here has none, and that is not a
         missing field — it is what tells the two kinds of event apart. */
      cart_id: cur.cart_id || null,
      happened_on: on,
      items_used: cur.items_used || [],
      code_colour: colour,
      is_drill: String(fd.get("drill")) === "1",
      team_expected: exp,
      team_present: pres,
      absent_roles: String(fd.get("absent") || "").trim() || null,
      response_seconds: num(fd.get("secs")),
      performance_score: num(fd.get("score")),
      notes: String(fd.get("notes") || "").trim() || null
    });
  }

  /* ------------------------------------------------------- a chapter champion */

  function chapterForm(row) {
    modal("<h3>" + esc(row.key) + " &mdash; " + esc(row.name) + "</h3>" +
      '<form id="qdChapterForm" data-chapter="' + esc(row.key) + '"' +
        (row.id ? ' data-id="' + esc(row.id) + '"' : "") + ">" +
      '<div class="ws-form">' +
        '<div class="ws-f"><label>Chapter champion</label>' +
          '<input name="champion" value="' + esc(row.champion) + '" placeholder="Dr A Kumar"></div>' +
        '<div class="ws-f"><label>Their role</label>' +
          '<input name="role" value="' + esc(row.role) + '" placeholder="Head of Nursing"></div>' +
        '<div class="ws-f ws-f-wide"><label>Your own readiness figure (%)</label>' +
          '<input name="own" type="number" min="0" max="100" step="1" value="' +
          esc(row.own == null ? "" : row.own) + '" placeholder="' +
          (row.computed == null ? "" : row.computed) + '"></div>' +
        '<div class="ws-f ws-f-wide"><label>Note</label>' +
          '<input name="note" value="' + esc(row.note) + '" ' +
          'placeholder="Why your figure differs from the register"></div>' +
      "</div>" +
      /* SAY WHAT THE OVERRIDE DOES AND WHAT IT CANNOT DO. A hospital that believes it has
         replaced the computed figure will type an optimistic number and stop marking
         elements, which is the exact failure this page exists to prevent. */
      '<p class="tr-hint">The register says <b>' +
        (row.computed == null ? "nothing yet" : row.computed + "%") + "</b> for this chapter, " +
        "from " + row.assessed + " of " + row.total + " elements assessed. Your own figure is " +
        "shown <b>beside</b> it, never instead of it &mdash; both stay on the page, and the " +
        "gap between them is the useful part.</p>" +
      '<div class="ws-modal-actions">' +
        (row.id ? '<button type="button" class="btn btn-ghost qd-danger" id="qdDelChapter">Clear</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="qdCancel">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save</button></div></form>');
  }

  async function saveChapter(f) {
    var fd = new FormData(f);
    var ch = f.getAttribute("data-chapter"), rid = f.getAttribute("data-id");
    var own = num(fd.get("own"));
    if (own != null && (own < 0 || own > 100)) {
      throw new Error("a readiness figure is a percentage between 0 and 100");
    }
    await S.adapter.put(OWNERS, {
      id: rid || id("qdch"),
      chapter: ch,
      champion: String(fd.get("champion") || "").trim() || null,
      champion_role: String(fd.get("role") || "").trim() || null,
      readiness_override: own,
      note: String(fd.get("note") || "").trim() || null
    });
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

  /* ===================================================================== TILES

     THE DASHBOARD IS A BOARD, NOT A PAGE. Eleven tiles of different weights, and three
     things a page of charts cannot do:

       CROSS-FILTER  Clicking a chapter redraws every other tile to that chapter alone.
                     That is the difference between looking at a dashboard and asking it
                     a question. The active filter is always shown and always dismissible
                     — a filter you cannot see is a dashboard lying to you quietly.
       EDIT          The hospital drags tiles into its own order, switches a tile between
                     chart types, and hides what it does not use. Saved per browser, so
                     it is still theirs next week.
       DRILL         A department name anywhere opens that department, using the detail
                     view this page already had.

     Every figure carries its comparison. A bare number tells you where you are and never
     whether it is working. */

  /* FIVE SECTIONS, ONE BOARD EACH.
     The order a hospital drags its tiles into is per section — the KPI board and the code
     alert board are different boards, and one shared list would put a code alert tile in
     the middle of the KPI grid the first time either was rearranged. Which section you were
     last on is remembered too: somebody who lives in the committee section should not have
     to walk back to it every morning. */
  var SECTIONS = [
    ["kpi",       "KPI",            "Departments, their KPIs, targets and what was achieved"],
    ["committee", "Committee",      "Which committees met, whether they were quorate, and what came of it"],
    ["incident",  "Incident",       "What went wrong, when, and whether it is structure, process or outcome"],
    ["code",      "Code alert",     "Every code called, who turned up, and how the team performed"],
    ["nabh",      "NABH readiness", "Chapter by chapter, with a champion for each and your findings"]
  ];
  function isSection(k) {
    return SECTIONS.some(function (s) { return s[0] === k; });
  }

  /* v2: the stored order became per-section, so a v1 order array read as a v2 object would
     put every tile in the wrong place rather than fail loudly. A new key is cheaper than a
     migration nobody could test against a browser they cannot see. */
  var VIEW_KEY = "aq-qd-view-v2";
  var viewState = (function () {
    var d = { order: {}, hidden: [], types: {}, chapter: null, section: "kpi" };
    try {
      var raw = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}");
      return {
        order: raw.order && typeof raw.order === "object" && !Array.isArray(raw.order) ? raw.order : {},
        hidden: Array.isArray(raw.hidden) ? raw.hidden : [],
        types: raw.types && typeof raw.types === "object" ? raw.types : {},
        chapter: raw.chapter || null,
        section: isSection(raw.section) ? raw.section : "kpi"
      };
    } catch (e) { return d; }
  })();
  function saveView() {
    try { localStorage.setItem(VIEW_KEY, JSON.stringify(viewState)); } catch (e) {}
  }

  var editing = false;

  /* Findings filtered by whatever cross-filter is active. Every tile reads through this
     rather than the raw array, which is what makes one click redraw the whole board. */
  function shown() {
    if (!viewState.chapter) return findings;
    return findings.filter(function (f) { return f.chapter === viewState.chapter; });
  }
  function tallyShown(key) {
    var by = {};
    shown().forEach(function (f) {
      var k = (f[key] || "").trim() || "Not stated";
      by[k] = (by[k] || 0) + 1;
    });
    return Object.keys(by).map(function (k) { return { label: k, v: by[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
  }
  function openAtShown(iso) {
    return shown().filter(function (f) {
      if (!f.raised_month || f.raised_month > iso) return false;
      return !f.closed_month || f.closed_month > iso;
    }).length;
  }

  /* The comparison badge. Direction is never colour alone — the arrow carries it too. */
  function vsBadge(d, label, higherIsBetter) {
    if (d == null) return "";
    d = Math.round(d * 10) / 10;
    /* NULL IS A THIRD ANSWER, NOT A DEFAULT. Some movements have no good direction — more
       incidents reported can mean a worse month or a hospital that has finally started
       reporting properly, and colouring that red teaches people to stop reporting. Passing
       null draws the arrow and leaves the colour neutral. */
    var good = (d === 0 || higherIsBetter == null) ? null : (higherIsBetter === false ? d < 0 : d > 0);
    var cls = (d === 0 || higherIsBetter == null) ? "flat" : good ? "up" : "down";
    var arrow = d === 0 ? "—" : d > 0 ? "▲" : "▼";
    return '<span class="qd-vs"><b class="' + cls + '">' + arrow + " " + Math.abs(d) +
      "</b> vs " + esc(label) + "</span>";
  }

  function scoredDepts() {
    return depts.map(function (d) {
      var s = deptScore(d);
      return { d: d, score: s, band: band(s), metrics: metricsOf(d.id).length };
    });
  }

  /* Every month the hospital has recorded anything in — never a fixed twelve. A hospital
     two months in must not be shown ten months of flat zero, which reads as "nothing went
     wrong" rather than "we were not here yet". */
  function monthCols() {
    var seen = {};
    readings.forEach(function (r) { if (r.month) seen[r.month] = 1; });
    findings.forEach(function (f) { if (f.raised_month) seen[f.raised_month] = 1; });
    oblig.forEach(function (o) { if (o.month) seen[o.month] = 1; });
    return Object.keys(seen).sort().slice(-12);
  }

  /* A department's score for one month, from the readings that existed by then. Returns
     null for a month it did not measure, so the heatmap draws a blank rather than a zero. */
  function scoreAt(dept, iso) {
    var ms = metricsOf(dept.id), vals = [];
    ms.forEach(function (m) {
      var upTo = readingsOf(m.id).filter(function (r) { return r.month <= iso; });
      if (!upTo.length) return;
      var a = attainment(m, upTo[upTo.length - 1].achieved);
      if (a != null) vals.push(Math.min(100, a));
    });
    if (!vals.length) return null;
    return Math.round(vals.reduce(function (n, v) { return n + v; }, 0) / vals.length);
  }

  /* The name of the department a metric belongs to. The KPI table's first column, and the
     reason it is a table at all: "Hand hygiene 95 / 78" means nothing until you know whose. */
  function deptNameOf(did) {
    var d = depts.filter(function (x) { return x.id === did; })[0];
    return d ? d.name : "—";
  }

  /* The hospital's attainment in each month it recorded anything, from the readings that
     existed by then. The same figure the headline shows, drawn over time. */
  function hospitalTrend() {
    return monthCols().map(function (m) {
      var vals = [];
      depts.forEach(function (d) {
        var s = scoreAt(d, m);
        if (s != null) vals.push(s);
      });
      return { m: shortMonth(m), month: m,
               v: vals.length
                 ? Math.round(vals.reduce(function (n, v) { return n + v; }, 0) / vals.length)
                 : 0 };
    }).filter(function (p) { return p.v > 0; });
  }

  var TILES = [
    /* ============================== 1 · KPI ============================== */

    { id: "readiness", sec: "kpi", name: "Hospital attainment", size: "s3", types: ["figure"],
      render: function () {
        var sc = scoredDepts(), measured = sc.filter(function (x) { return x.score != null; });
        var h = measured.length
          ? Math.round(measured.reduce(function (n, x) { return n + x.score; }, 0) / measured.length)
          : null;
        var ob = latestOblig(), days = daysToAssessment();
        return '<div class="qd-big">' + (h == null ? "—" : h) + (h == null ? "" : "<small>%</small>") + "</div>" +
          '<div class="qd-vs-row">' + measured.length + " of " + depts.length + " departments measured</div>" +
          '<div class="qd-mini">' +
            '<div><span class="k">On target</span><span class="v">' +
              sc.filter(function (x) { return x.band.key === "ok"; }).length + "</span></div>" +
            '<div><span class="k">Need attention</span><span class="v">' +
              sc.filter(function (x) { return x.band.key === "nc"; }).length + "</span></div>" +
            (ob && ob.elements_total
              ? '<div><span class="k">Evidenced</span><span class="v">' +
                esc(ob.elements_evidenced || 0) + "</span></div>" +
                '<div><span class="k">In scope</span><span class="v">' + esc(ob.elements_total) + "</span></div>"
              : "") +
            (days != null
              ? '<div><span class="k">Days to window</span><span class="v">' + days + "</span></div>"
              : "") +
          "</div>";
      } },

    { id: "mix", sec: "kpi", name: "Departments by band", size: "s4", types: ["donut", "bar"],
      render: function (type) {
        var sc = scoredDepts();
        var mix = ["ok", "warn", "nc", "none"].map(function (k) {
          var b = band(k === "ok" ? 95 : k === "warn" ? 80 : k === "nc" ? 40 : null);
          return { label: b.label, tone: b.tone,
                   v: sc.filter(function (x) { return x.band.key === k; }).length };
        }).filter(function (r) { return r.v > 0; });
        return type === "bar"
          ? C.bars(mix, { height: 190, empty: "No figures entered yet." })
          : C.pie(mix, { centre: String(depts.length), centreSub: "departments",
                         empty: "No figures entered yet." });
      } },

    { id: "attainment", sec: "kpi", name: "Attainment by department", size: "s5", types: ["bar"],
      note: "click a bar to open it",
      render: function () {
        return C.bars(scoredDepts().map(function (x) {
          return { label: x.d.name, v: x.score == null ? 0 : x.score, tone: x.band.tone };
        }), { pct: true, max: 100, empty: "No figures entered yet." });
      } },

    { id: "kpiTrend", sec: "kpi", name: "Attainment over time", size: "s6", types: ["area", "bar"],
      render: function (type) {
        var t = hospitalTrend();
        if (t.length < 2) {
          return '<p class="aqc-empty">One month recorded. Enter next month&rsquo;s figures ' +
            "and this becomes a line &mdash; that is the whole reason readings are stamped " +
            "with their month.</p>";
        }
        var last = t[t.length - 1].v, prev = t[t.length - 2].v;
        return '<div class="qd-big sm">' + last + "<small>%</small></div>" +
          vsBadge(last - prev, "last month", true) +
          '<div style="margin-top:8px">' +
          (type === "bar"
            ? C.bars(t.map(function (p) { return { label: p.m, v: p.v }; }), { height: 150, pct: true, max: 100 })
            : C.area(t, { height: 150, pct: true, max: 100 })) + "</div>";
      } },

    /* EVERY KPI, ITS TARGET, WHAT WAS ACHIEVED, AND ITS OWN LINE.
       This is the tile the rest of the section is built around. A hospital's question is
       never "what is our attainment" — it is "which KPI, in which department, is missing its
       target and has been getting worse". One row per KPI answers all three at once: the
       department it belongs to, the target it was set, the figure it reached, and a line of
       every month it has been measured. An average cannot show a KPI that fell for four
       months straight while the department's mean held steady. */
    { id: "kpiEach", sec: "kpi", name: "Every KPI, month by month", size: "s12", types: ["lines"],
      note: "click a row to open the department",
      render: function () {
        if (!metrics.length) {
          return '<p class="aqc-empty">Add what a department is measured on and every KPI ' +
            "appears here with its own line.</p>";
        }
        var rows = metrics.slice().sort(function (a, b) {
          var da = deptNameOf(a.dept_id), db = deptNameOf(b.dept_id);
          return da === db ? (a.position || 0) - (b.position || 0) : da.localeCompare(db);
        });
        return '<div class="qd-kpis">' + rows.map(function (m) {
          var rs = readingsOf(m.id);
          var r = rs.length ? rs[rs.length - 1] : null;
          var a = r ? attainment(m, r.achieved) : null;
          var b = band(a == null ? null : Math.min(100, a));
          var spark = rs.map(function (x) { return num(x.achieved); })
                        .filter(function (v) { return v != null; });
          return '<div class="qd-kpi" data-open="' + esc(m.dept_id) + '">' +
            '<div class="qd-kpi-h"><b>' + esc(m.name) + "</b>" +
              '<span class="qd-tag">' + esc(KIND_LABEL[m.kind] || m.kind) + "</span></div>" +
            '<div class="qd-kpi-d">' + esc(deptNameOf(m.dept_id)) + "</div>" +
            '<div class="qd-kpi-n">' +
              '<span><i>Target</i><b>' + esc(m.target) +
                (m.unit ? " " + esc(m.unit) : "") + "</b></span>" +
              '<span><i>Achieved</i><b>' + (r ? esc(r.achieved) : "—") + "</b></span>" +
              '<span><i>Attainment</i><b class="' + b.key + '">' +
                (a == null ? "—" : a + "%") + "</b></span>" +
            "</div>" +
            /* A single point is not a trend, and a flat line drawn from one reading reads
               as "no change" — which is a lie about a KPI measured once. */
            (spark.length > 1
              ? C.sparkline(spark, b.tone)
              : '<div class="qd-kpi-none">' +
                (spark.length ? "one month recorded" : "not measured yet") + "</div>") +
            "</div>";
        }).join("") + "</div>";
      } },

    { id: "kpiTable", sec: "kpi", name: "Department, KPI, target, achieved", size: "s12",
      types: ["table"],
      render: function () {
        if (!metrics.length) return '<p class="aqc-empty">Nothing measured yet.</p>';
        var rows = metrics.slice().sort(function (a, b) {
          var da = deptNameOf(a.dept_id), db = deptNameOf(b.dept_id);
          return da === db ? (a.position || 0) - (b.position || 0) : da.localeCompare(db);
        });
        return '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
          "<th>Department</th><th>KPI</th><th>Type</th><th>Target</th><th>Achieved</th>" +
          "<th>Attainment</th><th>Month</th></tr></thead><tbody>" +
          rows.map(function (m) {
            var r = latest(m.id);
            var a = r ? attainment(m, r.achieved) : null;
            var b = band(a == null ? null : Math.min(100, a));
            return "<tr><td>" + esc(deptNameOf(m.dept_id)) + "</td>" +
              "<td><b>" + esc(m.name) + "</b>" +
              (m.higher_is_better === false ? '<span class="tr-sub">lower is better</span>' : "") +
              "</td><td>" + esc(KIND_LABEL[m.kind] || m.kind) + "</td>" +
              "<td>" + esc(m.target) + (m.unit ? " " + esc(m.unit) : "") + "</td>" +
              "<td>" + (r ? esc(r.achieved) : "&mdash;") + "</td>" +
              "<td>" + (a == null ? "&mdash;"
                : '<span class="tr-tag ' + b.key + '">' + a + "%</span>") + "</td>" +
              "<td>" + (r ? esc(shortMonth(r.month)) : "&mdash;") + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      } },

    /* =========================== 2 · COMMITTEE =========================== */

    { id: "cmTotals", sec: "committee", name: "Committee record", size: "s3", types: ["figure"],
      render: function () {
        var held = heldMeetings();
        var judged = held.filter(function (m) { return quorumMet(m) !== null; });
        var quorate = judged.filter(function (m) { return quorumMet(m) === true; }).length;
        var raised = 0, closed = 0;
        held.forEach(function (m) {
          if (m.actions_raised != null) raised += num(m.actions_raised) || 0;
          if (m.actions_closed != null) closed += num(m.actions_closed) || 0;
        });
        return '<div class="qd-big">' + held.length + "</div>" +
          '<div class="qd-vs-row">meetings held across ' + cmtes.length + " committee" +
            (cmtes.length === 1 ? "" : "s") + "</div>" +
          '<div class="qd-mini">' +
            '<div><span class="k">Quorate</span><span class="v">' +
              (judged.length ? Math.round((quorate / judged.length) * 100) + "%" : "—") + "</span></div>" +
            '<div><span class="k">Of meetings</span><span class="v">' + judged.length + "</span></div>" +
            '<div><span class="k">Actions raised</span><span class="v">' + raised + "</span></div>" +
            '<div><span class="k">Actions closed</span><span class="v">' + closed + "</span></div>" +
          "</div>" +
          /* A quorum percentage computed from four meetings out of thirty is not a hospital
             statistic, and saying how many it came from is the difference between a figure
             and a claim. */
          (judged.length < held.length
            ? '<p class="qd-foot">' + (held.length - judged.length) + " meeting" +
              (held.length - judged.length === 1 ? " has" : "s have") +
              " no attendance or quorum figure, so " +
              (held.length - judged.length === 1 ? "it is" : "they are") + " not counted above.</p>"
            : "");
      } },

    { id: "cmTimeline", sec: "committee", name: "Meetings held, month by month", size: "s5",
      types: ["bar"],
      render: function () {
        var held = heldMeetings();
        if (!held.length) return '<p class="aqc-empty">No meeting has been recorded yet.</p>';
        var by = {};
        held.forEach(function (m) {
          var mo = monthOf(m.held_on);
          if (!mo) return;
          by[mo] = by[mo] || { q: 0, nq: 0, un: 0 };
          var v = quorumMet(m);
          by[mo][v === true ? "q" : v === false ? "nq" : "un"]++;
        });
        var months = Object.keys(by).sort().slice(-12);
        /* Stacked by whether the meeting was quorate, because a hospital that met every
           month without a quorum has a calendar, not a committee. */
        return C.bars(months.map(function (mo) {
          return { label: shortMonth(mo), parts: [
            { v: by[mo].q,  label: "quorate",     tone: "var(--ok)" },
            { v: by[mo].nq, label: "not quorate", tone: "var(--nc)" },
            { v: by[mo].un, label: "not recorded", tone: "var(--surface-2)" }
          ] };
        }), { height: 200, legend: [
          { label: "Quorate", tone: "var(--ok)" },
          { label: "Not quorate", tone: "var(--nc)" },
          { label: "Not recorded", tone: "var(--surface-2)" }
        ] });
      } },

    { id: "cmQuorum", sec: "committee", name: "Quorum by committee", size: "s4", types: ["bar"],
      render: function () {
        var by = {};
        heldMeetings().forEach(function (m) {
          var v = quorumMet(m);
          if (v === null) return;
          var k = cmteName(m.committee_id);
          by[k] = by[k] || { n: 0, q: 0 };
          by[k].n++;
          if (v) by[k].q++;
        });
        var rows = Object.keys(by).map(function (k) {
          var pct = Math.round((by[k].q / by[k].n) * 100);
          return { label: k, v: pct, sub: by[k].q + "/" + by[k].n,
                   tone: pct >= 90 ? "var(--ok)" : pct >= 70 ? "var(--accent-bright)" : "var(--nc)" };
        }).sort(function (a, b) { return a.v - b.v; });
        return C.bars(rows, { pct: true, max: 100, height: 200,
          empty: "Enter members present and the quorum required, and this ranks itself." });
      } },

    { id: "cmActions", sec: "committee", name: "Action points, raised against closed",
      size: "s6", types: ["bar"],
      render: function () {
        var by = {};
        heldMeetings().forEach(function (m) {
          if (m.actions_raised == null) return;
          var k = cmteName(m.committee_id);
          by[k] = by[k] || { r: 0, c: 0 };
          by[k].r += num(m.actions_raised) || 0;
          by[k].c += num(m.actions_closed) || 0;
        });
        var rows = Object.keys(by).map(function (k) {
          /* Closed and still-open stacked, so the bar's height is everything the committee
             raised and the red is what it has not finished. Two separate bars would let a
             committee that raises a hundred and closes ten look busy. */
          return { label: k, parts: [
            { v: by[k].c, label: "closed", tone: "var(--ok)" },
            { v: Math.max(0, by[k].r - by[k].c), label: "still open", tone: "var(--nc)" }
          ] };
        }).sort(function (a, b) {
          return (b.parts[1].v) - (a.parts[1].v);
        });
        return C.bars(rows, { height: 210, legend: [
          { label: "Closed", tone: "var(--ok)" },
          { label: "Still open", tone: "var(--nc)" }
        ], empty: "Record how many action points a meeting raised and closed." });
      } },

    { id: "cmTrend", sec: "committee", name: "Action points over time", size: "s6",
      types: ["bar", "area"],
      render: function (type) {
        var by = {};
        heldMeetings().forEach(function (m) {
          var mo = monthOf(m.held_on);
          if (!mo || m.actions_raised == null) return;
          by[mo] = by[mo] || { r: 0, c: 0 };
          by[mo].r += num(m.actions_raised) || 0;
          by[mo].c += num(m.actions_closed) || 0;
        });
        var months = Object.keys(by).sort().slice(-12);
        if (!months.length) {
          return '<p class="aqc-empty">No action points recorded yet.</p>';
        }
        if (type === "area") {
          var pts = months.map(function (mo) {
            return { m: shortMonth(mo), v: Math.max(0, by[mo].r - by[mo].c) };
          });
          return C.area(pts, { zeroBased: true, height: 200, label: "Action points left open",
            empty: "Two months of meetings will draw the trend." });
        }
        return C.bars(months.map(function (mo) {
          return { label: shortMonth(mo), parts: [
            { v: by[mo].c, label: "closed", tone: "var(--ok)" },
            { v: Math.max(0, by[mo].r - by[mo].c), label: "still open", tone: "var(--nc)" }
          ] };
        }), { height: 200, legend: [
          { label: "Closed", tone: "var(--ok)" },
          { label: "Still open", tone: "var(--nc)" }
        ] });
      } },

    { id: "cmTable", sec: "committee", name: "Every meeting", size: "s12", types: ["table"],
      note: "click a row to edit it",
      render: function () {
        var held = heldMeetings().slice().reverse();
        if (!held.length) {
          return '<p class="aqc-empty">Nothing recorded yet. Committees are scheduled on the ' +
            "calendar; this is where what happened at the meeting is written down.</p>";
        }
        return '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
          "<th>Held</th><th>Committee</th><th>Present</th><th>Quorum</th>" +
          "<th>Raised</th><th>Closed</th><th></th></tr></thead><tbody>" +
          held.map(function (m) {
            var v = quorumMet(m);
            return "<tr><td>" + esc(m.held_on) + "</td>" +
              "<td><b>" + esc(cmteName(m.committee_id)) + "</b>" +
              (m.agenda ? '<span class="tr-sub">' + esc(m.agenda) + "</span>" : "") + "</td>" +
              "<td>" + (m.attendance == null ? "&mdash;" : esc(m.attendance)) + "</td>" +
              "<td>" + (v === null
                ? "&mdash;"
                : '<span class="qd-badge ' + (v ? "ok" : "nc") + '">' +
                  (v ? "Met" : "Not met") + "</span>") + "</td>" +
              "<td>" + (m.actions_raised == null ? "&mdash;" : esc(m.actions_raised)) + "</td>" +
              "<td>" + (m.actions_closed == null ? "&mdash;" : esc(m.actions_closed)) + "</td>" +
              '<td><button class="qd-linkbtn" data-editmeeting="' + esc(m.id) +
              '">Edit</button></td></tr>';
          }).join("") + "</tbody></table></div>";
      } },

    /* ============================ 3 · INCIDENT ============================ */

    { id: "inTotals", sec: "incident", name: "This month", size: "s3", types: ["figure"],
      render: function () {
        var now = thisMonth();
        var mine = incidents.filter(function (i) { return incMonth(i) === now; });
        var open = incidents.filter(function (i) { return !incClosed(i); });
        var prevIso = (function () {
          var d = new Date(now + "T00:00:00Z");
          d.setUTCMonth(d.getUTCMonth() - 1);
          return d.toISOString().slice(0, 8) + "01";
        })();
        var prev = incidents.filter(function (i) { return incMonth(i) === prevIso; }).length;
        return '<div class="qd-big">' + mine.length + "</div>" +
          '<div class="qd-vs-row">' + esc(monthLabel(now)) + "</div>" +
          /* More incidents is not automatically worse. A hospital that has just started
             reporting properly SHOULD see the number rise, and an arrow that calls that a
             failure teaches people to stop reporting. The badge says which way it moved and
             leaves the judgement to the reader. */
          vsBadge(mine.length - prev, "last month", null) +
          '<div class="qd-mini">' +
            '<div><span class="k">Still open</span><span class="v">' + open.length + "</span></div>" +
            '<div><span class="k">Closed</span><span class="v">' +
              (incidents.length - open.length) + "</span></div>" +
            '<div><span class="k">All time</span><span class="v">' + incidents.length + "</span></div>" +
            '<div><span class="k">Unclassified</span><span class="v">' +
              incidents.filter(function (i) { return !i.donabedian; }).length + "</span></div>" +
          "</div>";
      } },

    { id: "inMonth", sec: "incident", name: "Incidents by month", size: "s5", types: ["bar"],
      render: function () {
        var by = {};
        incidents.forEach(function (i) {
          var mo = incMonth(i);
          if (!mo) return;
          by[mo] = by[mo] || { o: 0, c: 0 };
          by[mo][incClosed(i) ? "c" : "o"]++;
        });
        var months = Object.keys(by).sort().slice(-12);
        if (!months.length) return '<p class="aqc-empty">No incidents recorded yet.</p>';
        /* Open and closed stacked rather than two charts: the height is how many happened
           that month and the red is what is still outstanding from it. A month whose bar is
           entirely red is a month nobody went back to. */
        return C.bars(months.map(function (mo) {
          return { label: shortMonth(mo), parts: [
            { v: by[mo].c, label: "closed", tone: "var(--ok)" },
            { v: by[mo].o, label: "open",   tone: "var(--nc)" }
          ] };
        }), { height: 200, legend: [
          { label: "Closed", tone: "var(--ok)" },
          { label: "Still open", tone: "var(--nc)" }
        ] });
      } },

    { id: "inDona", sec: "incident", name: "Structure, process or outcome", size: "s4",
      types: ["donut", "bar"],
      render: function (type) {
        var by = {};
        incidents.forEach(function (i) {
          var k = donaLabel(i.donabedian);
          by[k] = (by[k] || 0) + 1;
        });
        var tones = { Structure: "var(--brand-2)", Process: "var(--accent-bright)",
                      Outcome: "var(--nc)" };
        var rows = Object.keys(by).map(function (k) {
          return { label: k, v: by[k], tone: tones[k] || "var(--fg-faint)" };
        }).sort(function (a, b) { return b.v - a.v; });
        return (type === "bar"
          ? C.bars(rows, { height: 190, empty: "No incidents recorded yet." })
          : C.pie(rows, { centre: String(incidents.length), centreSub: "incidents",
                          empty: "No incidents recorded yet." }));
      } },

    { id: "inDonaTrend", sec: "incident", name: "Category, month by month", size: "s4",
      types: ["bar"],
      render: function () {
        var by = {};
        incidents.forEach(function (i) {
          var mo = incMonth(i);
          if (!mo) return;
          by[mo] = by[mo] || { structure: 0, process: 0, outcome: 0, none: 0 };
          by[mo][i.donabedian === "structure" || i.donabedian === "process" ||
                 i.donabedian === "outcome" ? i.donabedian : "none"]++;
        });
        var months = Object.keys(by).sort().slice(-12);
        if (!months.length) return '<p class="aqc-empty">No incidents recorded yet.</p>';
        return C.bars(months.map(function (mo) {
          return { label: shortMonth(mo), parts: [
            { v: by[mo].structure, label: "structure", tone: "var(--brand-2)" },
            { v: by[mo].process,   label: "process",   tone: "var(--accent-bright)" },
            { v: by[mo].outcome,   label: "outcome",   tone: "var(--nc)" },
            { v: by[mo].none,      label: "unclassified", tone: "var(--surface-2)" }
          ] };
        }), { height: 190, legend: [
          { label: "Structure", tone: "var(--brand-2)" },
          { label: "Process", tone: "var(--accent-bright)" },
          { label: "Outcome", tone: "var(--nc)" },
          { label: "Unclassified", tone: "var(--surface-2)" }
        ] });
      } },

    { id: "inClass", sec: "incident", name: "How serious", size: "s4", types: ["donut", "bar"],
      render: function (type) {
        var by = {};
        incidents.forEach(function (i) {
          var k = incClassLabel(i.classification);
          by[k] = (by[k] || 0) + 1;
        });
        var tone = { "Near Miss": "var(--ok)", "No Harm": "var(--accent-bright)",
                     "Adverse Event": "var(--brand-2)", "Sentinel Event": "var(--nc)" };
        var rows = Object.keys(by).map(function (k) {
          return { label: k, v: by[k], tone: tone[k] || "var(--fg-faint)" };
        }).sort(function (a, b) { return b.v - a.v; });
        return type === "bar"
          ? C.bars(rows, { height: 190, empty: "No incidents recorded yet." })
          : C.pie(rows, { centre: String(incidents.length), centreSub: "incidents",
                          empty: "No incidents recorded yet." });
      } },

    { id: "inDept", sec: "incident", name: "Where they are reported", size: "s6",
      types: ["pareto", "bar"],
      render: function (type) {
        var by = {};
        incidents.forEach(function (i) {
          var k = (i.department || "").trim() || "Not stated";
          by[k] = (by[k] || 0) + 1;
        });
        var rows = Object.keys(by).map(function (k) { return { label: k, v: by[k] }; })
          .sort(function (a, b) { return b.v - a.v; });
        return type === "bar"
          ? C.bars(rows, { height: 200, empty: "No incidents recorded yet." })
          : C.pareto(rows, { empty: "No incidents recorded yet." });
      } },

    { id: "inTable", sec: "incident", name: "Every incident", size: "s12", types: ["table"],
      note: "click a row to set its category",
      render: function () {
        if (!incidents.length) {
          return '<p class="aqc-empty">Nothing recorded yet. Incidents are reported on the ' +
            "incidents page, and this is where they are categorised and read.</p>";
        }
        var rows = incidents.slice().sort(function (a, b) {
          return String(incMonth(b) || "").localeCompare(String(incMonth(a) || ""));
        }).slice(0, 60);
        return '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
          "<th>Reference</th><th>Month</th><th>Department</th><th>How serious</th>" +
          "<th>Category</th><th>Status</th><th></th></tr></thead><tbody>" +
          rows.map(function (i) {
            return "<tr><td><b>" + esc(i.reference || "—") + "</b></td>" +
              "<td>" + esc(shortMonth(incMonth(i))) + "</td>" +
              "<td>" + esc(i.department || "—") + "</td>" +
              "<td>" + esc(incClassLabel(i.classification)) + "</td>" +
              "<td>" + (i.donabedian
                ? '<span class="tr-tag">' + esc(donaLabel(i.donabedian)) + "</span>"
                : '<span class="qd-unset">not classified</span>') + "</td>" +
              "<td>" + (incClosed(i)
                ? '<span class="qd-badge ok">Closed</span>'
                : '<span class="qd-badge nc">Open</span>') + "</td>" +
              '<td><button class="qd-linkbtn" data-editincident="' + esc(i.id) +
              '">Classify</button></td></tr>';
          }).join("") + "</tbody></table></div>" +
          (incidents.length > 60
            ? '<p class="qd-foot">Showing the 60 most recent of ' + incidents.length + ".</p>"
            : "");
      } },

    /* =========================== 4 · CODE ALERT =========================== */

    { id: "caTotals", sec: "code", name: "Code alerts", size: "s3", types: ["figure"],
      render: function () {
        var all = codes.filter(function (c) { return c.code_colour; });
        var drills = all.filter(function (c) { return c.is_drill; }).length;
        var withT = all.filter(function (c) { return c.response_seconds != null; });
        var withP = all.filter(function (c) { return c.performance_score != null; });
        var avgT = withT.length
          ? Math.round(withT.reduce(function (n, c) { return n + num(c.response_seconds); }, 0) / withT.length)
          : null;
        var avgP = withP.length
          ? Math.round(withP.reduce(function (n, c) { return n + num(c.performance_score); }, 0) / withP.length)
          : null;
        return '<div class="qd-big">' + all.length + "</div>" +
          '<div class="qd-vs-row">' + drills + " drill" + (drills === 1 ? "" : "s") + " and " +
            (all.length - drills) + " real" + "</div>" +
          '<div class="qd-mini">' +
            '<div><span class="k">Avg response</span><span class="v">' +
              (avgT == null ? "—" : (avgT >= 90 ? Math.round(avgT / 6) / 10 + "m" : avgT + "s")) +
              "</span></div>" +
            '<div><span class="k">Avg performance</span><span class="v">' +
              (avgP == null ? "—" : avgP + "%") + "</span></div>" +
            '<div><span class="k">Full team</span><span class="v">' +
              all.filter(function (c) {
                return c.team_expected != null && c.team_present != null &&
                       num(c.team_present) >= num(c.team_expected);
              }).length + "</span></div>" +
            '<div><span class="k">Short-handed</span><span class="v">' +
              all.filter(function (c) {
                return c.team_expected != null && c.team_present != null &&
                       num(c.team_present) < num(c.team_expected);
              }).length + "</span></div>" +
          "</div>" +
          (codes.length > all.length
            ? '<p class="qd-foot">' + (codes.length - all.length) + " older event" +
              (codes.length - all.length === 1 ? " has" : "s have") +
              " no code colour recorded, so " +
              (codes.length - all.length === 1 ? "it is" : "they are") + " left out.</p>"
            : "");
      } },

    { id: "caColour", sec: "code", name: "Which codes are called", size: "s4",
      types: ["donut", "bar"],
      render: function (type) {
        var by = {};
        codes.forEach(function (c) {
          if (!c.code_colour) return;
          by[c.code_colour] = (by[c.code_colour] || 0) + 1;
        });
        var rows = Object.keys(by).map(function (k) {
          var d = codeOf(k);
          return { label: d[1], v: by[k], tone: d[2] };
        }).sort(function (a, b) { return b.v - a.v; });
        var n = rows.reduce(function (t, r) { return t + r.v; }, 0);
        return type === "bar"
          ? C.bars(rows, { height: 190, empty: "No code alert recorded yet." })
          : C.pie(rows, { centre: String(n), centreSub: "alerts",
                          empty: "No code alert recorded yet." });
      } },

    { id: "caTimeline", sec: "code", name: "How often each code is called", size: "s8",
      types: ["bar"],
      render: function () {
        var used = {}, by = {};
        codes.forEach(function (c) {
          var mo = codeMonth(c);
          if (!mo || !c.code_colour) return;
          used[c.code_colour] = 1;
          by[mo] = by[mo] || {};
          by[mo][c.code_colour] = (by[mo][c.code_colour] || 0) + 1;
        });
        var months = Object.keys(by).sort().slice(-12);
        if (!months.length) return '<p class="aqc-empty">No code alert recorded yet.</p>';
        var keys = CODE_COLOURS.filter(function (k) { return used[k[0]]; });
        return C.bars(months.map(function (mo) {
          return { label: shortMonth(mo), parts: keys.map(function (k) {
            return { v: by[mo][k[0]] || 0, label: k[1], tone: k[2] };
          }) };
        }), { height: 210, legend: keys.map(function (k) {
          return { label: k[1], tone: k[2] };
        }) });
      } },

    { id: "caTeam", sec: "code", name: "Who turned up", size: "s6", types: ["bar"],
      note: "the gap is who was missing",
      render: function () {
        var rows = codeSorted().filter(function (c) {
          return c.team_expected != null && c.team_present != null;
        }).slice(-12).map(function (c) {
          var d = codeOf(c.code_colour);
          var exp = num(c.team_expected) || 0, pres = num(c.team_present) || 0;
          /* Present and missing stacked to the expected total, so a bar that is all colour
             is a full team and the grey at the top is exactly the shortfall. Plotting only
             attendance would make a team of three out of four look the same as three out of
             ten. */
          return { label: shortMonth(codeMonth(c)) + " " + d[1].replace("Code ", ""),
                   parts: [
                     { v: pres, label: "present", tone: d[2] },
                     { v: Math.max(0, exp - pres), label: "missing", tone: "var(--surface-2)" }
                   ] };
        });
        return C.bars(rows, { height: 200, legend: [
          { label: "Present", tone: "var(--fg-muted)" },
          { label: "Missing", tone: "var(--surface-2)" }
        ], empty: "Record the team expected and present, and this draws itself." });
      } },

    { id: "caAbsent", sec: "code", name: "Who is never there", size: "s6",
      types: ["pareto", "bar"],
      render: function (type) {
        var by = {};
        codes.forEach(function (c) {
          absentRoles(c).forEach(function (r) { by[r] = (by[r] || 0) + 1; });
        });
        var rows = Object.keys(by).map(function (k) { return { label: k, v: by[k] }; })
          .sort(function (a, b) { return b.v - a.v; });
        return type === "bar"
          ? C.bars(rows, { height: 200, empty: "Nobody has been recorded as missing." })
          : C.pareto(rows, { empty: "Nobody has been recorded as missing." });
      } },

    { id: "caPerf", sec: "code", name: "Team performance over time", size: "s6",
      types: ["area", "bar"],
      render: function (type) {
        var pts = codeSorted().filter(function (c) { return c.performance_score != null; })
          .map(function (c) {
            return { m: shortMonth(codeMonth(c)), v: num(c.performance_score) };
          });
        if (pts.length < 2) {
          return '<p class="aqc-empty">Score two code alerts and the trend appears here.</p>';
        }
        return type === "bar"
          ? C.bars(pts.map(function (p) { return { label: p.m, v: p.v }; }),
                   { height: 190, pct: true, max: 100 })
          : C.area(pts, { height: 190, pct: true, max: 100, label: "Team performance" });
      } },

    { id: "caResponse", sec: "code", name: "How fast the team arrives", size: "s6",
      types: ["area", "bar"],
      render: function (type) {
        var pts = codeSorted().filter(function (c) { return c.response_seconds != null; })
          .map(function (c) {
            return { m: shortMonth(codeMonth(c)), v: num(c.response_seconds) };
          });
        if (pts.length < 2) {
          return '<p class="aqc-empty">Time two code alerts and the trend appears here.</p>';
        }
        /* Seconds, and down is the good direction — the axis says seconds so nobody reads a
           falling line as a falling standard. */
        return (type === "bar"
          ? C.bars(pts.map(function (p) { return { label: p.m, v: p.v }; }), { height: 190 })
          : C.area(pts, { height: 190, zeroBased: true, label: "Response time in seconds" })) +
          '<p class="qd-foot">Seconds from the call going out to the team arriving. Lower ' +
          "is better.</p>";
      } },

    { id: "caTable", sec: "code", name: "Every code alert", size: "s12", types: ["table"],
      note: "click a row to edit it",
      render: function () {
        var rows = codeSorted().reverse();
        if (!rows.length) {
          return '<p class="aqc-empty">Nothing recorded yet. Record a code alert &mdash; a ' +
            "real one or a mock drill &mdash; and this section fills itself in.</p>";
        }
        return '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
          "<th>Date</th><th>Code</th><th>Kind</th><th>Team</th><th>Missing</th>" +
          "<th>Response</th><th>Score</th><th></th></tr></thead><tbody>" +
          rows.map(function (c) {
            var d = codeOf(c.code_colour);
            return "<tr><td>" + esc(c.happened_on) + "</td>" +
              '<td><span class="qd-dot" style="background:' + d[2] + '"></span><b>' +
                esc(d[1]) + "</b></td>" +
              "<td>" + (c.is_drill ? "Drill" : "Real") + "</td>" +
              "<td>" + (c.team_expected == null || c.team_present == null
                ? "&mdash;"
                : esc(c.team_present) + " of " + esc(c.team_expected)) + "</td>" +
              "<td>" + esc(c.absent_roles || "—") + "</td>" +
              "<td>" + (c.response_seconds == null ? "&mdash;" : esc(c.response_seconds) + "s") + "</td>" +
              "<td>" + (c.performance_score == null ? "&mdash;" : esc(c.performance_score) + "%") + "</td>" +
              '<td><button class="qd-linkbtn" data-editcode="' + esc(c.id) +
              '">Edit</button></td></tr>';
          }).join("") + "</tbody></table></div>";
      } },

    /* ========================= 5 · NABH READINESS ========================= */

    { id: "nrTotals", sec: "nabh", name: "Readiness", size: "s3", types: ["figure"],
      render: function () {
        var rows = chapterRows();
        var overall = overallReadiness();
        var days = daysToAssessment();
        var withChamp = rows.filter(function (r) { return r.champion; }).length;
        var assessed = rows.reduce(function (n, r) { return n + r.assessed; }, 0);
        var total = rows.reduce(function (n, r) { return n + r.total; }, 0);
        return '<div class="qd-big">' + (overall == null ? "—" : overall) +
            (overall == null ? "" : "<small>%</small>") + "</div>" +
          '<div class="qd-vs-row">weighted across ' + rows.length + " chapters</div>" +
          '<div class="qd-mini">' +
            '<div><span class="k">Elements assessed</span><span class="v">' + assessed + "</span></div>" +
            '<div><span class="k">In scope</span><span class="v">' + total + "</span></div>" +
            '<div><span class="k">Champions named</span><span class="v">' +
              withChamp + " / " + rows.length + "</span></div>" +
            (days != null
              ? '<div><span class="k">Days to window</span><span class="v">' + days + "</span></div>"
              : '<div><span class="k">Open findings</span><span class="v">' +
                openFindings().length + "</span></div>") +
          "</div>" +
          (overall == null
            ? '<p class="qd-foot">Nothing marked on the readiness tracker yet, so there is ' +
              "no computed figure to show.</p>"
            : "");
      } },

    { id: "nrChapters", sec: "nabh", name: "Readiness by chapter", size: "s9", types: ["bar"],
      note: "the register's figure, chapter by chapter",
      render: function () {
        var rows = chapterRows();
        if (!rows.some(function (r) { return r.computed != null; })) {
          return '<p class="aqc-empty">Mark elements on the readiness tracker and every ' +
            "chapter appears here.</p>";
        }
        return C.bars(rows.map(function (r) {
          var v = r.computed == null ? 0 : r.computed;
          var b = band(v);
          return { label: r.key, v: v, sub: r.own == null ? "" : "own " + r.own + "%",
                   tone: b.tone };
        }), { pct: true, max: 100, height: 220 }) +
        /* The hospital's own figures drawn as a second row rather than replacing the bars.
           Both numbers stay visible, which is the whole point of allowing an override. */
        (rows.some(function (r) { return r.own != null; })
          ? '<p class="qd-foot">The bar is the register&rsquo;s weighted figure. Where a ' +
            "chapter champion has entered their own, it is written under the bar.</p>"
          : "");
      } },

    { id: "nrChampions", sec: "nabh", name: "Chapter champions", size: "s12", types: ["table"],
      note: "click a row to name a champion or enter your own figure",
      render: function () {
        var rows = chapterRows();
        return '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
          "<th>Chapter</th><th>Champion</th><th>Role</th><th>Register says</th>" +
          "<th>They say</th><th>Assessed</th><th></th></tr></thead><tbody>" +
          rows.map(function (r) {
            /* The gap between the two figures, shown as a figure rather than left to be
               worked out. A champion twenty points ahead of the register is either doing
               work nobody has marked or marking work nobody has done, and both are worth
               a conversation. */
            var gap = (r.own != null && r.computed != null) ? r.own - r.computed : null;
            return "<tr><td><b>" + esc(r.key) + "</b>" +
              '<span class="tr-sub">' + esc(r.name) + "</span></td>" +
              "<td>" + (r.champion ? esc(r.champion)
                : '<span class="qd-unset">nobody named</span>') + "</td>" +
              "<td>" + esc(r.role || "—") + "</td>" +
              "<td>" + (r.computed == null ? "&mdash;"
                : '<span class="tr-tag ' + band(r.computed).key + '">' + r.computed + "%</span>") + "</td>" +
              "<td>" + (r.own == null ? "&mdash;"
                : esc(r.own) + "%" + (gap == null ? ""
                  : ' <span class="qd-gap ' + (gap > 0 ? "up" : gap < 0 ? "down" : "flat") + '">' +
                    (gap > 0 ? "+" : "") + gap + "</span>")) + "</td>" +
              "<td>" + r.assessed + " / " + r.total + "</td>" +
              '<td><button class="qd-linkbtn" data-editchapter="' + esc(r.key) +
              '">Edit</button></td></tr>';
          }).join("") + "</tbody></table></div>";
      } },

    { id: "trend", sec: "nabh", name: "Open findings", size: "s4", types: ["area", "bar"],
      render: function (type) {
        var ms = monthCols();
        if (ms.length < 2) {
          return '<p class="aqc-empty">Two months of findings will draw the trend.</p>';
        }
        var series = ms.map(function (m) { return { m: shortMonth(m), v: openAtShown(m) }; });
        var last = series[series.length - 1].v, prev = series[series.length - 2].v;
        return '<div class="qd-big sm">' + last + "</div>" +
          vsBadge(last - prev, "last month", false) +
          '<div style="margin-top:8px">' +
          (type === "bar"
            ? C.bars(series.map(function (p) { return { label: p.m, v: p.v }; }), { height: 140 })
            : C.area(series, { height: 140, zeroBased: true })) + "</div>";
      } },

    { id: "chapters", sec: "nabh", name: "Findings by chapter", size: "s4", types: ["donut", "bar"],
      note: "click to filter the page",
      render: function (type) {
        var d = tallyShown("chapter");
        return type === "bar"
          ? C.bars(d, { height: 190, empty: "No findings recorded yet." })
          : C.pie(d, { centre: String(shown().length), centreSub: "findings",
                       empty: "No findings recorded yet." });
      } },

    { id: "causes", sec: "nabh", name: "Why findings happen", size: "s8", types: ["pareto", "bar"],
      render: function (type) {
        var d = tallyShown("cause");
        return type === "pareto"
          ? C.pareto(d, { empty: "No causes recorded yet." })
          : C.bars(d, { height: 200, empty: "No causes recorded yet." });
      } },

    { id: "bullet", sec: "kpi", name: "Against target", size: "s6", types: ["bullet"],
      render: function () {
        /* Every metric that carries a target, expressed as a percentage of it, so five
           different units can share one chart without lying about any of them. */
        var rowsB = metrics.filter(function (m) { return num(m.target) != null; })
          .map(function (m) {
            var r = latest(m.id);
            var a = r ? attainment(m, r.achieved) : null;
            return a == null ? null : { k: m.name, v: Math.min(100, a), target: 100, ok: 80 };
          }).filter(Boolean)
          .sort(function (a, b) { return a.v - b.v; })
          .slice(0, 8);
        return C.bullet(rowsB, { empty: "Give a measure a target and it appears here." });
      } },

    { id: "scatter", sec: "nabh", name: "Findings against closure speed", size: "s6", types: ["scatter"],
      note: "top-right needs help",
      render: function () {
        var by = {}, name = {};
        depts.forEach(function (d) { name[d.id] = d.name; });
        shown().forEach(function (f) {
          if (!f.dept_id) return;
          var k = name[f.dept_id];
          if (!k) return;
          by[k] = by[k] || { n: 0, d: 0, closed: 0 };
          by[k].n++;
          if (f.closed_month && f.raised_month) {
            by[k].d += Math.max(0, Math.round(
              (new Date(f.closed_month) - new Date(f.raised_month)) / 86400000));
            by[k].closed++;
          }
        });
        var pts = Object.keys(by).map(function (k) {
          return { label: k, x: by[k].n, y: by[k].closed ? Math.round(by[k].d / by[k].closed) : 0 };
        });
        return C.scatter(pts, { xLabel: "FINDINGS RAISED", yLabel: "DAYS TO CLOSE",
                                empty: "Record findings against a department to plot this." });
      } },

    { id: "rings", sec: "nabh", name: "Evidence and training", size: "s4", types: ["rings"],
      render: function () {
        var ob = latestOblig(), days = daysToAssessment();
        var segs = [];
        if (ob && ob.evidence_filed_pct != null) {
          segs.push({ label: "Evidence filed", pct: num(ob.evidence_filed_pct),
                      tone: "var(--accent-bright)" });
        }
        if (ob && ob.training_closed_pct != null) {
          segs.push({ label: "Training closed", pct: num(ob.training_closed_pct),
                      tone: num(ob.training_closed_pct) >= 80 ? "var(--ok)" : "var(--nc)" });
        }
        if (!segs.length) {
          return '<p class="aqc-empty">No month record entered yet.</p>' +
            '<div class="ws-f-actions"><button class="btn btn-ghost" id="qdAddMonth3">' +
            "Enter this month&rsquo;s figures</button></div>";
        }
        return C.rings(segs, days == null ? {} : { centre: { value: String(days), label: "days" } });
      } },

    { id: "ageing", sec: "nabh", name: "Age of every open finding", size: "s4", types: ["bar"],
      render: function () {
        var open = shown().filter(function (f) { return !f.closed_month; });
        if (!open.length) return '<p class="aqc-empty">Nothing is open.</p>';
        var now = Date.now();
        var buckets = [["<15d", 0], ["15–30d", 0], ["31–45d", 0], ["46–60d", 0], ["60d+", 0]];
        open.forEach(function (f) {
          var days = Math.max(0, Math.round((now - new Date(f.raised_month).getTime()) / 86400000));
          var i = days < 15 ? 0 : days < 30 ? 1 : days < 45 ? 2 : days < 60 ? 3 : 4;
          buckets[i][1]++;
        });
        /* Anything past thirty days is late, and the bar says so rather than the axis. */
        return C.bars(buckets.map(function (b, i) {
          return { label: b[0], v: b[1], tone: i >= 2 ? "var(--nc)" : "var(--accent-bright)" };
        }), { height: 190 });
      } },

    { id: "heat", sec: "kpi", name: "Attainment, department by month", size: "s12", types: ["heatmap"],
      note: "click a cell to open the department",
      render: function () {
        var ms = monthCols();
        if (!ms.length) return '<p class="aqc-empty">No monthly figures yet.</p>';
        return C.heatmap(depts.map(function (d) {
          return { name: d.name, values: ms.map(function (m) { return scoreAt(d, m); }) };
        }), ms.map(shortMonth), { label: "Attainment by department and month" }) +
        C.legend([
          { label: "Below 70%", tone: "var(--nc)" },
          { label: "70–85%", tone: "color-mix(in srgb,var(--accent-bright) 45%,transparent)" },
          { label: "Above 85%", tone: "var(--accent-bright)" },
          { label: "Not measured", tone: "var(--surface-1)" }
        ]);
      } },

    { id: "wall", sec: "kpi", name: "Every department", size: "s12", types: ["wall"],
      note: "click one to open it",
      render: function () {
        return '<div class="qd-depts">' + scoredDepts().map(deptCard).join("") + "</div>";
      } }
  ];

  function currentSection() {
    return isSection(viewState.section) ? viewState.section : "kpi";
  }
  function tilesIn(sec) {
    return TILES.filter(function (t) { return t.sec === sec; });
  }
  function tileOrder() {
    var sec = currentSection();
    var ids = tilesIn(sec).map(function (t) { return t.id; });
    var saved = viewState.order[sec];
    if (!Array.isArray(saved)) return ids;
    /* A tile the hospital never saw — one added in a release since it last rearranged this
       section — is appended rather than dropped. Silently hiding new work is the worse of
       the two failures. */
    var kept = saved.filter(function (id) { return ids.indexOf(id) > -1; });
    ids.forEach(function (id) { if (kept.indexOf(id) < 0) kept.push(id); });
    return kept;
  }

  /* The buttons that belong to the section you are on, and only those. Five sections'
     worth of actions in one row would be a toolbar nobody reads, and four of the five
     would be wrong for whatever is on screen. */
  function sectionActions(sec) {
    if (sec === "kpi") {
      return '<button type="button" class="btn btn-ghost qd-bar-b" id="qdAddDept2">Add a department</button>' +
        '<button type="button" class="btn btn-accent qd-bar-b" id="qdAddMonth2">This month&rsquo;s figures</button>';
    }
    if (sec === "committee") {
      return '<a class="btn btn-ghost qd-bar-b" href="calendar.html#committees">Schedule committees</a>' +
        '<button type="button" class="btn btn-accent qd-bar-b" id="qdAddMeeting">Record a meeting</button>';
    }
    if (sec === "incident") {
      return '<a class="btn btn-accent qd-bar-b" href="incidents.html">Report an incident</a>';
    }
    if (sec === "code") {
      return '<button type="button" class="btn btn-accent qd-bar-b" id="qdAddCode">Record a code alert</button>';
    }
    return '<a class="btn btn-ghost qd-bar-b" href="readiness.html">Open the readiness tracker</a>' +
      '<button type="button" class="btn btn-ghost qd-bar-b" id="qdAddMonth2">Evidence figures</button>' +
      '<button type="button" class="btn btn-accent qd-bar-b" id="qdAddFinding2">Record a finding</button>';
  }

  function sectionTabs(sec) {
    return '<div class="qd-tabs" role="tablist" aria-label="Dashboard sections">' +
      SECTIONS.map(function (s) {
        return '<button type="button" class="qd-tab' + (s[0] === sec ? " on" : "") +
          '" role="tab" aria-selected="' + (s[0] === sec ? "true" : "false") +
          '" data-sec="' + s[0] + '"><b>' + esc(s[1]) + "</b></button>";
      }).join("") + "</div>";
  }

  function overview() {
    if (!depts.length && !meetings.length && !incidents.length && !codes.length &&
        !owners.length && !findings.length) {
      return setupIntro();
    }

    var sec = currentSection();
    var meta = SECTIONS.filter(function (s) { return s[0] === sec; })[0];

    var bar = sectionTabs(sec) +
      '<div class="qd-bar">' +
        '<span class="qd-bar-t">' + esc(meta[1]) + "</span>" +
        '<span class="qd-bar-sub">' + esc(meta[2]) + "</span>" +
        /* The cross-filter belongs to the readiness section, where the findings live. Shown
           on other sections it would claim to be filtering charts it never touches. */
        (viewState.chapter && sec === "nabh"
          ? '<span class="qd-chip">Chapter: ' + esc(viewState.chapter) +
            '<button type="button" id="qdChipX" aria-label="Clear the chapter filter">&times;</button></span>'
          : "") +
        '<span class="qd-bar-sp"></span>' +
        sectionActions(sec) +
        '<button type="button" class="btn btn-ghost qd-bar-b' + (editing ? " on" : "") +
          '" id="qdEdit">' + (editing ? "Done" : "Edit layout") + "</button>" +
        (editing ? '<button type="button" class="btn btn-ghost qd-bar-b" id="qdResetView">Reset</button>' : "") +
      "</div>" +
      /* The KPI section is the only one that needs its own tables set up before it can show
         anything. Saying so here, rather than leaving five empty tiles, is the difference
         between "not started" and "broken". */
      (sec === "kpi" && !depts.length
        ? '<div class="qd-nudge"><b>No departments yet.</b> Add one and every chart in this ' +
          "section is drawn from its KPIs, targets and monthly figures.</div>"
        : "");

    var grid = tileOrder().map(function (id) {
      var t = TILES.filter(function (x) { return x.id === id; })[0];
      if (!t) return "";
      var isHidden = viewState.hidden.indexOf(id) > -1;
      var type = viewState.types[id] || t.types[0];
      var tools = editing
        ? '<span class="qd-tools">' +
            (t.types.length > 1
              ? '<select data-tiletype="' + id + '" aria-label="Chart type">' +
                t.types.map(function (ty) {
                  return '<option value="' + ty + '"' + (ty === type ? " selected" : "") + ">" + ty + "</option>";
                }).join("") + "</select>"
              : "") +
            '<button type="button" data-tilehide="' + id + '" title="Hide this tile">&minus;</button>' +
          "</span>"
        : "";
      var body;
      try { body = t.render(type); }
      catch (err) {
        /* One tile that throws must not take the page with it. Say which one, so the
           fault is reportable rather than an unexplained gap. */
        body = '<p class="aqc-empty">This tile could not be drawn.</p>';
      }
      return '<section class="qd-tile ' + t.size + (isHidden ? " is-hidden" : "") +
        '" data-tile="' + id + '"' + (editing ? ' draggable="true"' : "") + ">" +
        '<div class="qd-tile-h"><span class="qd-tile-n">' + esc(t.name) + "</span>" +
          (t.note && !editing ? '<span class="qd-tile-note">' + esc(t.note) + "</span>" : "") +
          tools + "</div>" +
        '<div class="qd-tile-b">' + body + "</div></section>";
    }).join("");

    /* Only this section's hidden tiles. A tray listing every hidden tile on the page would
       offer to restore a code alert chart onto the KPI board. */
    var hiddenHere = viewState.hidden.filter(function (id) {
      var t = TILES.filter(function (x) { return x.id === id; })[0];
      return t && t.sec === sec;
    });
    var tray = editing
      ? '<div class="qd-tray"><h4>Hidden tiles</h4>' +
          (hiddenHere.length
            ? hiddenHere.map(function (id) {
                var t = TILES.filter(function (x) { return x.id === id; })[0];
                return t ? '<button type="button" class="btn btn-ghost qd-bar-b" data-tileshow="' +
                  id + '">' + esc(t.name) + "</button>" : "";
              }).join("")
            : '<span class="qd-tray-none">Nothing hidden.</span>') +
        "</div>"
      : "";

    return bar + '<div class="qd-grid' + (editing ? " is-editing" : "") + '">' + grid + "</div>" + tray;
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
    var d = openDept ? depts.filter(function (x) { return x.id === openDept; })[0] : null;
    /* THE MISSING TABLES ARE ONE SECTION'S PROBLEM, NOT THE PAGE'S.
       Only the KPI section owns qd_* tables. Replacing the whole page with the setup notice
       would hide four sections whose data loaded perfectly well — a hospital with two years
       of incidents would be told its dashboard does not exist. The notice sits above the
       board instead, and the board still works. */
    host.innerHTML = (schemaMissing ? schemaNotice() : "") +
      (d ? deptPanel(d) : overview());

    var bar = document.getElementById("qdActions");
    if (bar) bar.innerHTML = depts.length && !openDept && currentSection() === "kpi"
      ? '<button class="btn btn-accent" id="qdAddDept">Add a department</button>'
      : "";
  }

  /* THE TABLES MIGHT NOT BE THERE YET, AND THAT MUST NOT BE A BLANK PAGE.
     These three tables ship in workspace/schema.sql, and a hospital whose database predates
     them gets PGRST205 from PostgREST on the very first read. Left unhandled that rejects out
     of init() and the page renders nothing at all — which looks like a broken product rather
     than one step of setup that has not been done. Say what is missing and what to run. */
  var schemaMissing = false;

  /* THE OTHER FOUR SECTIONS MUST NOT BE ABLE TO BLANK THE PAGE.
     Their tables belong to other parts of the workspace and one of them — chapter_owners —
     is new enough that a hospital which has not run the latest schema block will not have
     it. A rejected read there is a section with nothing in it, which is true and readable.
     It is not a reason to lose the four sections that did load. */
  async function soft(name) {
    try { return (await S.adapter.list(name)) || []; }
    catch (e) { return []; }
  }

  async function refreshOthers() {
    var got = await Promise.all([
      soft(CMTES), soft(MEETINGS), soft(INCIDENTS), soft(CODES), soft(OWNERS)
    ]);
    cmtes = got[0]; meetings = got[1]; incidents = got[2]; codes = got[3]; owners = got[4];
    /* The element register, read through the same helper the readiness page uses so the two
       pages can never disagree about what a chapter's percentage is. */
    try { elementMap = (S.elements ? await S.elements() : {}) || {}; }
    catch (e) { elementMap = {}; }
  }

  async function refresh() {
    await refreshOthers();
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
    return '<div class="qd-intro qd-intro-warn">' +
      "<h2>The KPI section needs one step of setup</h2>" +
      "<p>The other four sections read tables you already have and are working. This page " +
      "stores your departments, their measures, your findings and each " +
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
      if (e.target.id === "qdAddMonth2" || e.target.id === "qdAddMonth3") {
        obligForm(thisMonth()); return;
      }
      if (e.target.id === "qdAddDept2") { deptForm(); return; }

      /* ---- the four other sections' entry points ---- */
      if (e.target.id === "qdAddMeeting") {
        /* A meeting has to belong to a committee, and there is nowhere on this page to
           create one — that is the calendar's job. Saying so beats an empty dropdown. */
        if (!cmtes.length) {
          W.toast("Set your committees up on the calendar first", "bad");
          return;
        }
        meetingForm();
        return;
      }
      if (e.target.id === "qdAddCode") { codeForm(); return; }

      var em = e.target.closest("[data-editmeeting]");
      if (em) {
        var mh = meetings.filter(function (x) { return x.id === em.getAttribute("data-editmeeting"); })[0];
        if (mh) meetingForm(mh);
        return;
      }
      var ei = e.target.closest("[data-editincident]");
      if (ei) {
        var ih = incidents.filter(function (x) { return x.id === ei.getAttribute("data-editincident"); })[0];
        if (ih) incidentForm(ih);
        return;
      }
      var ec = e.target.closest("[data-editcode]");
      if (ec) {
        var ch2 = codes.filter(function (x) { return x.id === ec.getAttribute("data-editcode"); })[0];
        if (ch2) codeForm(ch2);
        return;
      }
      var ech = e.target.closest("[data-editchapter]");
      if (ech) {
        var key = ech.getAttribute("data-editchapter");
        var crow = chapterRows().filter(function (r) { return r.key === key; })[0];
        if (crow) chapterForm(crow);
        return;
      }

      /* ---- switching section ---- */
      var tab = e.target.closest("[data-sec]");
      if (tab) {
        var next = tab.getAttribute("data-sec");
        if (!isSection(next) || next === currentSection()) return;
        viewState.section = next;
        /* Leaving edit mode on the way out. A hospital that switches sections mid-rearrange
           and finds five dashed boxes it did not ask for reads it as a fault. */
        editing = false;
        saveView(); render();
        return;
      }

      /* ---- the board's own controls ---- */
      if (e.target.id === "qdEdit") {
        editing = !editing; render();
        return;
      }
      if (e.target.id === "qdResetView") {
        /* This section only. Resetting all five because somebody tidied one is the kind of
           surprise that stops people using edit mode at all. */
        var here = currentSection();
        if (!confirm("Put every tile in this section back where it started?")) return;
        delete viewState.order[here];
        viewState.hidden = viewState.hidden.filter(function (id) {
          var t = TILES.filter(function (x) { return x.id === id; })[0];
          return t && t.sec !== here;
        });
        tilesIn(here).forEach(function (t) { delete viewState.types[t.id]; });
        if (here === "nabh") viewState.chapter = null;
        saveView(); render();
        return;
      }
      if (e.target.id === "qdChipX") {
        viewState.chapter = null; saveView(); render();
        return;
      }
      var th = e.target.closest("[data-tilehide]");
      if (th) {
        viewState.hidden.push(th.getAttribute("data-tilehide"));
        saveView(); render();
        return;
      }
      var ts = e.target.closest("[data-tileshow]");
      if (ts) {
        var showId = ts.getAttribute("data-tileshow");
        viewState.hidden = viewState.hidden.filter(function (x) { return x !== showId; });
        saveView(); render();
        return;
      }
      /* While the board is being rearranged, a click on a chart is a mis-click, not a
         filter. Nothing below this line runs in edit mode. */
      if (editing) return;

      /* CROSS-FILTER. Only the chapter tile filters, and only on a chapter it actually
         knows — clicking "Not stated" or a cause must not silently filter to nothing. */
      var slice = e.target.closest("[data-slice]");
      if (slice && e.target.closest('[data-tile="chapters"]')) {
        var ch = slice.getAttribute("data-slice");
        if (ch && ch !== "Other") {
          viewState.chapter = viewState.chapter === ch ? null : ch;
          saveView(); render(); window.scrollTo(0, 0);
        }
        return;
      }
      /* A department name, wherever it appears — the heatmap, the scatter, a bar. */
      var byName = e.target.closest("[data-heat],[data-scatter],[data-bar]");
      if (byName) {
        var nm = byName.getAttribute("data-heat") || byName.getAttribute("data-scatter") ||
                 byName.getAttribute("data-bar");
        var hit = depts.filter(function (d) { return d.name === nm; })[0];
        if (hit) { openDept = hit.id; render(); window.scrollTo(0, 0); return; }
      }
      var ef = e.target.closest("[data-editfinding]");
      if (ef) {
        var fe = findings.filter(function (x) {
          return x.id === ef.getAttribute("data-editfinding");
        })[0];
        if (fe) findingForm(fe);
      }
    });

    /* Switching a tile's chart type. A change event, not a click, because a <select>
       fires the first and never reliably the second. */
    document.getElementById("qdPanel").addEventListener("change", function (e) {
      var sel = e.target.closest("[data-tiletype]");
      if (!sel) return;
      viewState.types[sel.getAttribute("data-tiletype")] = sel.value;
      saveView(); render();
    });

    /* DRAG TO REORDER. Delegated to the panel rather than bound per tile, because render()
       replaces every tile on each pass and per-tile listeners would be re-bound (and
       leaked) each time. */
    (function () {
      var panel = document.getElementById("qdPanel"), dragging = null;
      panel.addEventListener("dragstart", function (e) {
        var t = e.target.closest("[data-tile]");
        if (!t || !editing) return;
        dragging = t.getAttribute("data-tile");
        t.classList.add("is-drag");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragging); } catch (err) {}
      });
      panel.addEventListener("dragend", function (e) {
        var t = e.target.closest("[data-tile]");
        if (t) t.classList.remove("is-drag");
        dragging = null;
      });
      panel.addEventListener("dragover", function (e) {
        if (!editing || !dragging) return;
        var t = e.target.closest("[data-tile]");
        if (!t) return;
        e.preventDefault();
        t.classList.add("is-over");
      });
      panel.addEventListener("dragleave", function (e) {
        var t = e.target.closest("[data-tile]");
        if (t) t.classList.remove("is-over");
      });
      panel.addEventListener("drop", function (e) {
        if (!editing || !dragging) return;
        var t = e.target.closest("[data-tile]");
        if (!t) return;
        e.preventDefault();
        t.classList.remove("is-over");
        var target = t.getAttribute("data-tile");
        if (target === dragging) return;
        var o = tileOrder();
        var from = o.indexOf(dragging), to = o.indexOf(target);
        if (from < 0 || to < 0) return;
        o.splice(to, 0, o.splice(from, 1)[0]);
        viewState.order[currentSection()] = o;
        dragging = null;
        saveView(); render();
      });
    })();

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
        else if (f.id === "qdMeetingForm") await saveMeeting(f);
        else if (f.id === "qdIncidentForm") await saveIncident(f);
        else if (f.id === "qdCodeForm") await saveCode(f);
        else if (f.id === "qdChapterForm") await saveChapter(f);
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
        return;
      }
      if (e.target.id === "qdDelMeeting") {
        var mf = document.getElementById("qdMeetingForm");
        var mid2 = mf && mf.getAttribute("data-id");
        if (!mid2) return;
        if (!confirm("Delete this meeting record? The quorum and action figures go with it.")) return;
        await S.adapter.remove(MEETINGS, mid2);
        close();
        await refresh();
        return;
      }
      if (e.target.id === "qdDelCode") {
        var cf = document.getElementById("qdCodeForm");
        var cid2 = cf && cf.getAttribute("data-id");
        if (!cid2) return;
        if (!confirm("Delete this code alert? It will disappear from every chart in this " +
                     "section.")) return;
        await S.adapter.remove(CODES, cid2);
        close();
        await refresh();
        return;
      }
      if (e.target.id === "qdDelChapter") {
        var chf = document.getElementById("qdChapterForm");
        var chid = chf && chf.getAttribute("data-id");
        if (!chid) return;
        /* Clearing a champion does not clear the chapter — the computed figure comes from
           the element register and is untouched by this. The wording says so. */
        if (!confirm("Clear the champion and your own figure for this chapter? The " +
                     "register's figure is not affected.")) return;
        await S.adapter.remove(OWNERS, chid);
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
