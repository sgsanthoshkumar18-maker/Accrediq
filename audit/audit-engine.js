/* AQcredix — internal audit engine.
 *
 * Owns the session: which elements are in scope, what was found, how long it took, and
 * what the result means. Deliberately holds no DOM — audit-ui.js renders it, audit-excel.js
 * exports it, audit-report.js interprets it. That split is what makes the export testable
 * without a browser.
 */
window.AQAudit = (function () {
  "use strict";

  var S = window.AQStore;

  /* Timing: wall-clock minus time the tab spent hidden for more than this. A quality
   * manager leaves the tab open over lunch; an audit that then claims six hours is worse
   * than not timing it at all. */
  var IDLE_GRACE_MS = 5 * 60 * 1000;

  var CH_ORDER = ["AAC", "COP", "MOM", "PRE", "IPC", "PSQ", "ROM", "FMS", "HRM", "IMS"];

  var STATUS = {
    compliant:  { key: "compliant",  short: "C",  label: "Compliant" },
    partial:    { key: "partial",    short: "PC", label: "Partially compliant" },
    nc:         { key: "nc",         short: "NC", label: "Non-compliant" },
    na:         { key: "na",         short: "NA", label: "Not applicable" },
    unassessed: { key: "unassessed", short: "—", label: "Unassessed" }
  };

  var SEVERITY = ["observation", "minor", "major", "critical"];

  /* Training map: NC/PC on these standards implies this training need. Keyed on the
   * standard, not the element, because training is organised by topic and no hospital
   * runs a session on AAC.4.c specifically. */
  var TRAINING = {
    "IPC.2": "Hand hygiene, PPE selection and standard precautions",
    "IPC.3": "Standard and transmission-based precautions; safe injection practice; antimicrobial stewardship",
    "IPC.4": "Housekeeping, BMW segregation, laundry and food-handling practices",
    "IPC.5": "HAI prevention bundles — CAUTI, VAP, CLABSI, SSI",
    "IPC.7": "Cleaning, disinfection, sterilisation and reprocessing",
    "IPC.8": "Occupational health, immunisation and post-exposure prophylaxis",
    "COP.5": "BLS / ACLS, CPR documentation and assigned roles during resuscitation",
    "COP.6": "Nursing clinical practice guidelines, care planning and documentation",
    "COP.7": "Procedure safety — consent, asepsis, site marking, monitoring",
    "COP.8": "Rational use of blood; transfusion reaction recognition and reporting",
    "COP.12": "Moderate sedation — competency, monitoring and discharge criteria",
    "COP.13": "Anaesthesia assessment, monitoring and adverse event recording",
    "COP.14": "Surgical safety checklist and post-operative care planning",
    "COP.16": "Care of vulnerable patients; restraint policy; pressure ulcer and DVT prevention",
    "COP.17": "Pain screening, assessment and titration",
    "COP.19": "Nutritional screening, therapeutic diets and patient diet education",
    "COP.20": "End of life care and multiprofessional support",
    "MOM.3": "Medication storage, LASA and high-alert handling, crash cart checks",
    "MOM.4": "Prescription standards — capitals, verbal orders, drug reconciliation",
    "MOM.6": "Safe dispensing and administration; patient identification before administration",
    "MOM.7": "Post-administration monitoring and tubing misconnection prevention",
    "MOM.8": "Near miss, medication error and ADR definitions and reporting",
    "MOM.9": "Narcotic handling, custody, documentation and disposal",
    "AAC.4": "Initial assessment content and time frames, including nutritional screening",
    "AAC.5": "Reassessment frequency and early warning signs",
    "AAC.12": "Structured clinical handover between shifts and units",
    "AAC.13": "Discharge planning and discharge summary completeness",
    "PRE.2": "Patient rights, dignity, privacy and respect for values and beliefs",
    "PRE.3": "Explaining care plan, risks and change in condition to patient and family",
    "PRE.4": "Informed consent — scope, language and authorised representative",
    "PRE.5": "Patient and family education on medication, diet and infection prevention",
    "PRE.7": "Complaint redressal procedure and closure within time frame",
    "PRE.8": "Healthcare communication techniques",
    "FMS.3": "Hazmat identification, MSDS and spill management",
    "FMS.4": "Equipment inventory, preventive maintenance and calibration",
    "FMS.7": "Fire and non-fire emergency response, exit routes and mock drills",
    "HRM.3": "Induction training content",
    "HRM.5": "Blood handling, vulnerable patients, restraint and communication training",
    "HRM.6": "Safety programme, incident reporting and occupational safety training",
    "HRM.11": "Credentialing and privileging of medical professionals",
    "HRM.12": "Credentialing and privileging of nursing staff",
    "IMS.3": "Medical record entries — named, signed, dated, timed; abbreviation policy",
    "IMS.4": "Medical record content completeness",
    "IMS.5": "Data security, confidentiality and privileged health information",
    "PSQ.1": "Patient safety programme, IPSG and incident reporting",
    "PSQ.3": "Indicator definition, data capture and validation",
    "PSQ.7": "Sentinel event identification and incident analysis"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function elementIndex() {
    if (elementIndex._c) return elementIndex._c;
    var D = window.NABH_DATA, idx = {};
    if (D) {
      Object.keys(D.chapters).forEach(function (ck) {
        D.chapters[ck].standards.forEach(function (st) {
          st.elements.forEach(function (el) {
            idx[st.code + "." + el.letter] = {
              code: st.code + "." + el.letter,
              chapter: ck, chapterName: D.chapters[ck].name,
              standard: st.code, standardText: st.text,
              letter: el.letter, text: el.text,
              category: el.category || "", sop: !!el.sop
            };
          });
        });
      });
    }
    elementIndex._c = idx;
    return idx;
  }

  function departments() {
    var sc = window.AUDIT_SCOPE || {};
    return Object.keys(sc).map(function (k) { return sc[k]; })
      .sort(function (a, b) {
        if (a.group !== b.group) return a.group === "clinical" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }

  /* The rows for one department: real elements, in assessor order, plus the shared
     interview block that closes every clinical area's table in the printed checklist. */
  function scopeRows(deptKey) {
    var sc = (window.AUDIT_SCOPE || {})[deptKey];
    if (!sc) return [];
    var idx = elementIndex();
    var seen = {}, rows = [];

    sc.codes.forEach(function (c) {
      if (idx[c] && !seen[c]) { seen[c] = 1; rows.push(assign({}, idx[c], { block: "scope" })); }
    });

    if (sc.group === "clinical") {
      var IV = window.AUDIT_INTERVIEWS || {};
      Object.keys(IV).forEach(function (k) {
        IV[k].codes.forEach(function (c) {
          if (idx[c] && !seen[c]) {
            seen[c] = 1;
            rows.push(assign({}, idx[c], { block: "interview", blockLabel: IV[k].label }));
          }
        });
      });
    }
    return rows;
  }

  function assign(t) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i];
      if (s) Object.keys(s).forEach(function (k) { t[k] = s[k]; });
    }
    return t;
  }

  function newId(p) {
    return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ------------------------------- session ------------------------------- */

  function create(deptKey, user) {
    var sc = (window.AUDIT_SCOPE || {})[deptKey];
    var rows = scopeRows(deptKey);
    return {
      id: newId("aud"),
      department_id: deptKey,
      department_name: sc ? sc.name : deptKey,
      department_group: sc ? sc.group : "",
      auditor_name: (user && (user.name || user.email)) || "",
      auditor_id: (user && user.id) || null,
      org_id: (user && user.org_id) || null,
      standard_edition: "NABH 5th Edition",
      started_at: new Date().toISOString(),
      last_active_at: Date.now(),
      paused_seconds: 0,
      finished_at: null,
      duration_seconds: null,
      status: "in_progress",
      total_elements: rows.length,
      findings: {},        // code -> { status, evidence, justification, severity, owner, due_date }
      kpi_checks: {},      // kpi label -> true/false
      /* quick list item -> true/false. Ticked means the auditor saw it in the department;
         unticked means it was not there. Absence is a real result, so an untouched item is
         reported as absent rather than as "not checked" — an internal audit that silently
         drops the things nobody looked at is the kind that passes and then fails on the day. */
      quick_checks: {}
    };
  }

  /* What the quick list says about this department. Driven entirely by the scope data, so
     every department gets it without a per-department change. */
  /* A quick-list item is scored the same four ways an element is, because presence and
     compliance are not the same thing. Something can be on the shelf and still be wrong: an
     out-of-date licence, a fridge with no temperature log, a narcotics register with gaps. A
     tick could only ever say "it exists", which is the weaker half of the question.

     Stored as a status string. Sessions saved when this was a checkbox hold booleans, so
     those are read forward here rather than migrated in place — an audit in progress must
     never be rewritten underneath the person running it. */
  function quickStatus(session, item) {
    var v = (session.quick_checks || {})[item];
    if (v === true) return "compliant";       /* ticked, under the old checkbox */
    if (v === false) return "nc";             /* explicitly cleared, under the old checkbox */
    if (typeof v === "string" && STATUS[v]) return v;
    return "unassessed";
  }

  function quickSummary(session) {
    var sc = (window.AUDIT_SCOPE || {})[session.department_id] || {};
    /* Deduplicated the same way the screen does it: a sub-area inherits its parent's list
       and then adds its own, so an item can appear twice. */
    var list = (sc.quickList || []).filter(function (q, i, a) { return a.indexOf(q) === i; });

    var counts = { compliant: 0, partial: 0, nc: 0, na: 0, unassessed: 0 };
    var rows = list.map(function (q) {
      var st = quickStatus(session, q);
      counts[st]++;
      return { item: q, status: st };
    });

    /* Scored like the elements are: half credit for partial, Not Applicable excluded from
       the denominator entirely. Anything left unassessed still counts against the score —
       a walk-the-floor item nobody looked at is not evidence of compliance. */
    var applicable = list.length - counts.na;
    var gained = counts.compliant + counts.partial * 0.5;

    return {
      list: list,
      rows: rows,
      counts: counts,
      /* Kept because the report, the Excel and the tests all read them. "present" now means
         fully compliant, which is the only reading that does not overstate the result. */
      present: rows.filter(function (r) { return r.status === "compliant"; })
                   .map(function (r) { return r.item; }),
      absent: rows.filter(function (r) { return r.status === "nc" || r.status === "unassessed"; })
                  .map(function (r) { return r.item; }),
      partial: rows.filter(function (r) { return r.status === "partial"; })
                   .map(function (r) { return r.item; }),
      na: rows.filter(function (r) { return r.status === "na"; })
              .map(function (r) { return r.item; }),
      total: list.length,
      applicable: applicable,
      unassessed: counts.unassessed,
      pct: applicable ? Math.round((gained / applicable) * 100) : null
    };
  }

  function finding(session, code) {
    return session.findings[code] || { status: "unassessed" };
  }

  function setFinding(session, code, patch) {
    var f = session.findings[code] || { status: "unassessed" };
    Object.keys(patch).forEach(function (k) { f[k] = patch[k]; });
    // Clearing back to compliant/NA should not leave a stale owner and date hanging
    // around to be exported as if someone still owed an action.
    if (f.status === "compliant" || f.status === "unassessed") {
      delete f.severity; delete f.owner; delete f.due_date;
    }
    if (f.status !== "na") delete f.justification;
    session.findings[code] = f;
    return f;
  }

  /* Elapsed time, excluding hidden-tab gaps longer than the grace period. */
  function tick(session) {
    var now = Date.now();
    var gap = now - (session.last_active_at || now);
    if (gap > IDLE_GRACE_MS) session.paused_seconds += Math.round(gap / 1000);
    session.last_active_at = now;
  }

  function elapsedSeconds(session) {
    var end = session.finished_at ? new Date(session.finished_at).getTime() : Date.now();
    var raw = Math.max(0, Math.round((end - new Date(session.started_at).getTime()) / 1000));
    return Math.max(0, raw - (session.paused_seconds || 0));
  }

  function fmtDuration(sec) {
    if (sec == null) return "—";
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + "h " : "") + (h || m ? m + "m " : "") + s + "s";
  }

  /* ------------------------------- scoring ------------------------------- */

  /* Unweighted is the number people expect; weighted is the honest one. Both are shown,
   * side by side, rather than quietly reporting the flattering one. Weights come from
   * AQStore so the audit and the org-wide readiness page cannot drift apart. */
  function score(session) {
    var rows = scopeRows(session.department_id);
    var out = {
      total: rows.length, applicable: 0,
      counts: { compliant: 0, partial: 0, nc: 0, na: 0, unassessed: 0 },
      weight: 0, gained: 0, plain: 0, weighted: 0,
      byChapter: {}, coreOpen: 0, sopOpen: 0, open: []
    };

    rows.forEach(function (r) {
      var f = finding(session, r.code);
      var st = f.status || "unassessed";
      out.counts[st] = (out.counts[st] || 0) + 1;

      var ch = out.byChapter[r.chapter] || (out.byChapter[r.chapter] =
        { code: r.chapter, name: r.chapterName, total: 0, applicable: 0, gained: 0, weight: 0,
          counts: { compliant: 0, partial: 0, nc: 0, na: 0, unassessed: 0 } });
      ch.total++; ch.counts[st]++;

      if (st === "na") return;
      out.applicable++; ch.applicable++;

      var w = (S && S.weightOf) ? S.weightOf(r.category) : 1;
      var gain = st === "compliant" ? 1 : st === "partial" ? 0.5 : 0;
      out.weight += w; out.gained += w * gain;
      ch.weight += w; ch.gained += w * gain;

      if (st !== "compliant") {
        if (S && S.isCore && S.isCore(r.category)) out.coreOpen++;
        if (r.sop) out.sopOpen++;
      }
      if (st === "nc" || st === "partial") {
        out.open.push(assign({}, r, { finding: f }));
      }
    });

    var plainGained = out.counts.compliant + out.counts.partial * 0.5;
    out.plain = out.applicable ? Math.round((plainGained / out.applicable) * 100) : 0;
    out.weighted = out.weight ? Math.round((out.gained / out.weight) * 100) : 0;
    out.assessed = out.applicable - out.counts.unassessed;
    out.assessedPct = out.total ? Math.round(((out.total - out.counts.unassessed) / out.total) * 100) : 0;

    Object.keys(out.byChapter).forEach(function (k) {
      var c = out.byChapter[k];
      c.pct = c.weight ? Math.round((c.gained / c.weight) * 100) : 0;
    });

    // Severity order matters more than element order once you are looking at gaps.
    out.open.sort(function (a, b) {
      var sa = SEVERITY.indexOf((a.finding.severity || "observation"));
      var sb = SEVERITY.indexOf((b.finding.severity || "observation"));
      if (sa !== sb) return sb - sa;
      if (a.finding.status !== b.finding.status) return a.finding.status === "nc" ? -1 : 1;
      return a.code.localeCompare(b.code);
    });

    out.band = band(out.weighted);
    return out;
  }

  function band(pct) {
    if (pct >= 90) return { key: "strong", label: "Strong",
      note: "This department's scope stands up. Keep the evidence current and re-audit on the normal cycle." };
    if (pct >= 75) return { key: "workable", label: "Workable",
      note: "Close the major findings before the department is put in front of an assessor." };
    if (pct >= 60) return { key: "notready", label: "Not ready",
      note: "The gaps are systemic rather than isolated. Re-audit after the CAPA actions close." };
    return { key: "substantial", label: "Substantial non-conformity",
      note: "Department-level remediation is needed before any mock survey is worth running." };
  }

  /* Training needs, derived from where the findings actually landed. Three or more open
     findings in one standard escalates from a refresher to structured training. */
  function trainingNeeds(sc) {
    var byStd = {};
    sc.open.forEach(function (r) {
      var t = TRAINING[r.standard];
      if (!t) return;
      var e = byStd[r.standard] || (byStd[r.standard] =
        { standard: r.standard, chapter: r.chapter, topic: t, count: 0, worst: "observation", codes: [] });
      e.count++;
      e.codes.push(r.code);
      if (SEVERITY.indexOf(r.finding.severity || "observation") > SEVERITY.indexOf(e.worst)) {
        e.worst = r.finding.severity || "observation";
      }
    });
    return Object.keys(byStd).map(function (k) { return byStd[k]; })
      .map(function (e) {
        e.mode = (e.count >= 3 || e.worst === "critical")
          ? "Structured departmental training with post-test and attendance record"
          : "Refresher briefing at shift handover, with attendance record";
        return e;
      })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function ownerMatrix(sc) {
    var by = {};
    sc.open.forEach(function (r) {
      var o = (r.finding.owner || "").trim() || "Unassigned";
      var e = by[o] || (by[o] = { owner: o, count: 0, earliest: null, worst: "observation", codes: [] });
      e.count++;
      e.codes.push(r.code);
      if (r.finding.due_date && (!e.earliest || r.finding.due_date < e.earliest)) e.earliest = r.finding.due_date;
      if (SEVERITY.indexOf(r.finding.severity || "observation") > SEVERITY.indexOf(e.worst)) {
        e.worst = r.finding.severity || "observation";
      }
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function reauditDays(sc) {
    var worst = "none";
    sc.open.forEach(function (r) {
      var s = r.finding.severity || "observation";
      if (worst === "none" || SEVERITY.indexOf(s) > SEVERITY.indexOf(worst)) worst = s;
    });
    return { critical: 14, major: 30, minor: 90, observation: 180, none: 365 }[worst] || 180;
  }

  /* Findings that block Finish: every NC and PC needs an owner and a date, and every NA
     needs a reason. This is the step real internal audits skip, which is exactly why it
     is enforced rather than merely prompted. */
  function blockers(session) {
    var rows = scopeRows(session.department_id), out = [];
    rows.forEach(function (r) {
      var f = finding(session, r.code);
      if (f.status === "nc" || f.status === "partial") {
        if (!(f.owner || "").trim()) out.push({ code: r.code, why: "needs a responsible person" });
        else if (!f.due_date) out.push({ code: r.code, why: "needs a target closure date" });
      } else if (f.status === "na" && !(f.justification || "").trim()) {
        out.push({ code: r.code, why: "needs a reason for Not Applicable" });
      }
    });
    return out;
  }

  /* ----------------------------- persistence ----------------------------- */

  function summaryRow(session) {
    var sc = score(session);
    return {
      id: session.id,
      org_id: session.org_id || null,
      department_id: session.department_id,
      department_name: session.department_name,
      auditor_id: session.auditor_id || null,
      auditor_name: session.auditor_name,
      started_at: session.started_at,
      finished_at: session.finished_at,
      duration_seconds: session.duration_seconds,
      paused_seconds: session.paused_seconds || 0,
      status: session.status,
      total_elements: sc.total,
      compliant: sc.counts.compliant,
      partial: sc.counts.partial,
      nc: sc.counts.nc,
      na: sc.counts.na,
      readiness_score: sc.weighted,
      payload: JSON.stringify({ findings: session.findings, kpi_checks: session.kpi_checks,
        quick_checks: session.quick_checks || {} })
    };
  }

  function hydrate(row) {
    var p = {};
    try { p = JSON.parse(row.payload || "{}"); } catch (e) { p = {}; }
    return assign({}, row, {
      findings: p.findings || {},
      kpi_checks: p.kpi_checks || {},
      quick_checks: p.quick_checks || {},
      last_active_at: Date.now()
    });
  }

  var saveTimer = null;
  function save(session, immediate) {
    var row = summaryRow(session);
    if (immediate) return S.adapter.put("audits", row);
    clearTimeout(saveTimer);
    return new Promise(function (res) {
      saveTimer = setTimeout(function () { S.adapter.put("audits", row).then(res, res); }, 800);
    });
  }

  function list() {
    return S.adapter.list("audits").then(function (rows) {
      return (rows || []).sort(function (a, b) {
        return String(b.started_at).localeCompare(String(a.started_at));
      });
    });
  }

  function remove(id) { return S.adapter.remove("audits", id); }

  /* Push every NC and PC into CAPA. An audit that ends in a spreadsheet and leaves no
     trackable action behind has not changed anything. */
  async function pushToCapa(session) {
    var sc = score(session), made = 0;
    for (var i = 0; i < sc.open.length; i++) {
      var r = sc.open[i], f = r.finding;
      await S.saveCapa({
        id: "capa_" + session.id + "_" + r.code.replace(/\./g, "_"),
        title: r.code + " — " + String(r.text || "").slice(0, 120),
        element_code: r.code,
        source: "internal audit",
        severity: f.severity || "minor",
        department: session.department_name,
        root_cause: "",
        corrective: "",
        preventive: "",
        owner: f.owner || "",
        due_date: f.due_date || null,
        status: "open",
        verification: "",
        created_at: new Date().toISOString(),
        audit_id: session.id,
        evidence: f.evidence || ""
      });
      made++;
    }
    return made;
  }

  return {
    STATUS: STATUS, SEVERITY: SEVERITY, TRAINING: TRAINING, CH_ORDER: CH_ORDER,
    esc: esc,
    departments: departments,
    scopeRows: scopeRows,
    elementIndex: elementIndex,
    create: create,
    finding: finding,
    setFinding: setFinding,
    tick: tick,
    elapsedSeconds: elapsedSeconds,
    fmtDuration: fmtDuration,
    score: score,
    quickSummary: quickSummary,
    quickStatus: quickStatus,
    band: band,
    trainingNeeds: trainingNeeds,
    ownerMatrix: ownerMatrix,
    reauditDays: reauditDays,
    blockers: blockers,
    summaryRow: summaryRow,
    hydrate: hydrate,
    save: save,
    list: list,
    remove: remove,
    pushToCapa: pushToCapa
  };
})();
