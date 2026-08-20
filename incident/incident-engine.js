/* AQcredix — incident reporting engine.
 *
 * Modelled on the hospital incident form supplied as the template, generalised so it
 * works for any organisation rather than carrying one hospital's letterhead and form
 * number. The classification ladder — near miss, no harm, adverse event, sentinel event —
 * is the standard patient-safety taxonomy the template uses, and the definitions here are
 * the ones printed on it, because a reporter who has to guess what "adverse" means will
 * classify inconsistently and the data becomes noise.
 *
 * Holds no DOM. incident-ui.js renders it, incident-docx.js exports it.
 */
window.AQIncident = (function () {
  "use strict";

  var S = window.AQStore;

  /* The template requires the form to reach Quality within one hour. That deadline is the
   * single most-missed requirement on a paper form, so it is modelled rather than
   * mentioned: the engine computes it and the UI shows the countdown. */
  var REPORT_WINDOW_MIN = 60;

  var CLASSES = [
    { key: "near_miss", label: "Near Miss", severity: 1,
      def: "A patient safety event that was discovered, aborted or prevented by an " +
           "intervention BEFORE reaching or having an impact on the patient." },
    { key: "no_harm", label: "No Harm", severity: 2,
      def: "A patient safety event that REACHES THE PATIENT but does not cause harm." },
    { key: "adverse", label: "Adverse Event", severity: 3,
      def: "A serious, undesirable and usually unanticipated patient safety event that " +
           "RESULTED IN HARM to the patient, but does not rise to the level of sentinel." },
    { key: "sentinel", label: "Sentinel Event", severity: 4,
      def: "A patient safety event (not primarily related to the natural course of the " +
           "patient's illness or underlying condition) that reaches a patient and RESULTS " +
           "IN DEATH, PERMANENT HARM, OR SEVERE TEMPORARY HARM." },
    { key: "other", label: "Other", severity: 2,
      def: "An event that does not fit the categories above. Describe it fully below." }
  ];

  var AFFECTED = [
    { key: "patient", label: "Patient" },
    { key: "staff", label: "Staff" },
    { key: "visitor", label: "Visitor" },
    { key: "property", label: "Property" }
  ];

  var STATUSES = [
    { key: "reported", label: "Reported" },
    { key: "under_review", label: "Under review" },
    { key: "rca_done", label: "RCA complete" },
    { key: "actions_open", label: "Actions open" },
    { key: "closed", label: "Closed" }
  ];

  /* The template's sign-off chain: department head, then hospital director / GM
   * operations, then Quality. Kept as data so the acknowledgement block and the printed
   * form cannot disagree about who signs. */
  var SIGNOFFS = [
    { key: "hod", label: "Department HOD (where the incident occurred)" },
    { key: "director", label: "Director / GM Operations" },
    { key: "quality", label: "Quality Department" }
  ];

  function classOf(key) {
    for (var i = 0; i < CLASSES.length; i++) if (CLASSES[i].key === key) return CLASSES[i];
    return null;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function newId() {
    return "inc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* Reference number. Sequential within the year would need a server to be safe against
   * two people reporting at once, so this is date plus a short random tail — unique in
   * practice, and it sorts chronologically, which is what anyone reading a register
   * actually wants. */
  function refFor(dateISO, id) {
    var d = (dateISO || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
    return "IR-" + d + "-" + id.slice(-4).toUpperCase();
  }

  function create(user) {
    var now = new Date();
    return {
      id: newId(),
      org_id: (user && user.org_id) || null,
      reference: "",
      occurred_at: "",                  // when it happened
      reported_at: now.toISOString(),   // when this form was opened
      department: "",
      location: "",
      affected: [],                     // patient / staff / visitor / property
      // No patient identifiers are stored. They are written by hand on the printed form
      // and kept in the hospital's own records, which keeps identifiable patient data out
      // of this platform and out of scope for the obligations that would follow it.
      classification: "",
      details: "",
      immediate_action: "",
      witnesses: "",
      reporter_name: (user && (user.name || user.email)) || "",
      reporter_id: (user && user.id) || null,
      reporter_dept: "",
      // The template's three analysis blocks.
      root_cause: "",
      corrective: "",
      preventive: "",
      contributing: [],                 // structured contributing factors
      signoffs: {},                     // key -> { name, at }
      status: "reported",
      closed_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
  }

  /* Contributing-factor prompts, drawn from the usual RCA domains. Offered as checkboxes
   * because a blank "root cause" box on a form reliably produces "human error", which is
   * a conclusion rather than a cause and stops the analysis exactly where it should
   * start. */
  var FACTORS = [
    "Communication / handover",
    "Staffing levels or skill mix",
    "Training or competency",
    "Policy absent, unclear or not followed",
    "Equipment failure or unavailability",
    "Medication process (prescribe / dispense / administer)",
    "Environment, layout or signage",
    "Workload, fatigue or time pressure",
    "Patient identification",
    "Documentation or records",
    "Supervision or escalation",
    "Infection prevention practice"
  ];

  /* How long the reporter has left against the one-hour rule. Negative means late — shown
   * plainly rather than hidden, because a register that quietly swallows late reports
   * tells you nothing about your reporting culture. */
  function reportWindow(inc) {
    if (!inc.occurred_at) return null;
    var occurred = new Date(inc.occurred_at).getTime();
    if (isNaN(occurred)) return null;
    var deadline = occurred + REPORT_WINDOW_MIN * 60000;
    var ref = inc.submitted_at ? new Date(inc.submitted_at).getTime() : Date.now();
    var mins = Math.round((deadline - ref) / 60000);
    return { deadline: new Date(deadline), minutesLeft: mins, late: mins < 0 };
  }

  /* Fields the form cannot be submitted without. Deliberately short: a reporting system
   * that demands twelve fields at the moment of an incident is a reporting system people
   * route around. Analysis fields are required to *close*, not to report. */
  function validate(inc) {
    var errs = [];
    if (!inc.occurred_at) errs.push({ field: "occurred_at", msg: "When did it happen?" });
    if (!inc.department) errs.push({ field: "department", msg: "Which department?" });
    if (!inc.affected.length) errs.push({ field: "affected", msg: "Who or what was affected?" });
    if (!inc.classification) errs.push({ field: "classification", msg: "Classify the incident." });
    if (!(inc.details || "").trim()) errs.push({ field: "details", msg: "Describe what happened." });
    if (!(inc.reporter_name || "").trim()) errs.push({ field: "reporter_name", msg: "Reporter name is required." });
    // A sentinel event with no immediate action recorded is nearly always an omission
    // rather than the truth, so it is caught here rather than at review.
    if (inc.classification === "sentinel" && !(inc.immediate_action || "").trim()) {
      errs.push({ field: "immediate_action", msg: "Record the immediate action taken for a sentinel event." });
    }
    return errs;
  }

  function closeBlockers(inc) {
    var b = [];
    if (!(inc.root_cause || "").trim()) b.push("Root cause analysis is empty.");
    if (!(inc.corrective || "").trim()) b.push("No corrective action recorded.");
    if (!(inc.preventive || "").trim()) b.push("No preventive action recorded.");
    if (!inc.signoffs.quality) b.push("Quality department has not signed off.");
    var c = classOf(inc.classification);
    if (c && c.severity >= 3 && !inc.signoffs.director) {
      b.push("An adverse or sentinel event needs Director / GM Operations sign-off.");
    }
    return b;
  }

  function fmtDateTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  /* ----------------------------- persistence ----------------------------- */

  function row(inc) {
    var c = classOf(inc.classification);
    return {
      id: inc.id,
      org_id: inc.org_id || null,
      reference: inc.reference || refFor(inc.occurred_at || inc.created_at, inc.id),
      occurred_at: inc.occurred_at || null,
      reported_at: inc.reported_at,
      submitted_at: inc.submitted_at || null,
      department: inc.department,
      classification: inc.classification,
      severity: c ? c.severity : 0,
      status: inc.status,
      reporter_name: inc.reporter_name,
      closed_at: inc.closed_at,
      created_at: inc.created_at,
      updated_at: new Date().toISOString(),
      payload: JSON.stringify(inc)
    };
  }

  function hydrate(r) {
    var p = {};
    try { p = JSON.parse(r.payload || "{}"); } catch (e) { p = {}; }
    p.id = r.id;
    p.reference = r.reference;
    p.status = r.status;
    if (!p.signoffs) p.signoffs = {};
    if (!p.affected) p.affected = [];
    if (!p.contributing) p.contributing = [];
    return p;
  }

  var saveTimer = null;
  function save(inc, immediate) {
    if (!inc.reference) inc.reference = refFor(inc.occurred_at || inc.created_at, inc.id);
    var r = row(inc);
    if (immediate) return S.adapter.put("incidents", r);
    clearTimeout(saveTimer);
    return new Promise(function (res) {
      saveTimer = setTimeout(function () { S.adapter.put("incidents", r).then(res, res); }, 700);
    });
  }

  function list() {
    return S.adapter.list("incidents").then(function (rows) {
      return (rows || []).sort(function (a, b) {
        return String(b.occurred_at || b.created_at).localeCompare(String(a.occurred_at || a.created_at));
      });
    });
  }

  function remove(id) { return S.adapter.remove("incidents", id); }

  /* Push corrective and preventive actions into CAPA. The incident register records what
   * happened; CAPA is where closure is actually tracked, and an incident that ends in a
   * filed form has changed nothing. */
  async function pushToCapa(inc) {
    var c = classOf(inc.classification);
    var sev = c && c.severity >= 4 ? "critical" : c && c.severity === 3 ? "major" : "minor";
    await S.saveCapa({
      id: "capa_" + inc.id,
      title: inc.reference + " — " + String(inc.details || "").slice(0, 110),
      element_code: "PSQ.7",     // incident management
      source: "incident report",
      severity: sev,
      department: inc.department,
      root_cause: inc.root_cause || "",
      corrective: inc.corrective || "",
      preventive: inc.preventive || "",
      owner: (inc.signoffs.hod && inc.signoffs.hod.name) || "",
      due_date: null,
      status: inc.status === "closed" ? "closed" : "open",
      verification: "",
      created_at: new Date().toISOString(),
      incident_id: inc.id
    });
    return 1;
  }

  /* Register statistics. The point of an incident system is the pattern, not the file. */
  function stats(rows) {
    var out = {
      total: rows.length, open: 0, closed: 0, late: 0,
      byClass: {}, byDept: {}, byMonth: {}
    };
    CLASSES.forEach(function (c) { out.byClass[c.key] = 0; });
    rows.forEach(function (r) {
      if (r.status === "closed") out.closed++; else out.open++;
      if (r.classification) out.byClass[r.classification] = (out.byClass[r.classification] || 0) + 1;
      if (r.department) out.byDept[r.department] = (out.byDept[r.department] || 0) + 1;
      var m = String(r.occurred_at || r.created_at).slice(0, 7);
      if (m) out.byMonth[m] = (out.byMonth[m] || 0) + 1;
      if (r.occurred_at && r.submitted_at) {
        var mins = (new Date(r.submitted_at) - new Date(r.occurred_at)) / 60000;
        if (mins > REPORT_WINDOW_MIN) out.late++;
      }
    });
    // Near-miss share is the health check on a reporting culture. A register that is all
    // adverse events is not a safe hospital; it is one where near misses go unreported.
    var nm = out.byClass.near_miss || 0;
    out.nearMissPct = out.total ? Math.round((nm / out.total) * 100) : 0;
    return out;
  }

  return {
    CLASSES: CLASSES, AFFECTED: AFFECTED, STATUSES: STATUSES,
    SIGNOFFS: SIGNOFFS, FACTORS: FACTORS,
    REPORT_WINDOW_MIN: REPORT_WINDOW_MIN,
    classOf: classOf, esc: esc, create: create, refFor: refFor,
    reportWindow: reportWindow, validate: validate, closeBlockers: closeBlockers,
    fmtDateTime: fmtDateTime,
    save: save, list: list, remove: remove, hydrate: hydrate, row: row,
    pushToCapa: pushToCapa, stats: stats
  };
})();
