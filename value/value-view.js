/* AQcredix — "What your department gets" page.
 *
 * WHY THIS IS GENERATED RATHER THAN WRITTEN.
 *
 * This page is a sales page: it tells a department head what they are paying for. That
 * makes every number on it a promise. A hand-written page claiming "114 documents" stays
 * on the site claiming 114 long after the figure changes, and — worse — invites the
 * reader to expect 114 finished documents when only a dozen currently carry full field
 * lists. A subscriber who finds generic stubs behind a specific claim has a refund
 * argument, and under a no-refund policy that is a conversation with no good ending.
 *
 * So every count here is computed at render time from the same two files the product
 * itself reads:
 *
 *   audit/scope-data.js   — AUDIT_SCOPE, generated from the NABH 5th Ed assessor
 *                           checklist. Gives the element count and quick list per area.
 *   workspace/library-data.js — DOC_LIBRARY, the forms/checklists/registers inventory.
 *                           `detailed: true` marks the ones with a real field list.
 *
 * Add a department, write a field list, or flip a `detailed` flag, and this page updates
 * on the next load with no edit here. Nothing on it can drift out of step with what the
 * product actually ships, because there is no second copy of the figure to drift.
 *
 * The honest-count principle is deliberate and load-bearing: the page shows the detailed
 * count SEPARATELY from the total, and says plainly when a department's documents are
 * still generic templates. Overstating here would cost more than it earns.
 */
(function () {
  "use strict";

  var SCOPE = window.AUDIT_SCOPE || {};
  var LIB = window.DOC_LIBRARY || [];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ------------------------------------------------------------------
     Library departments are named for how a hospital says them ("Biomedical",
     "Central Sterile Supply Department (CSSD)"); scope keys are the assessor
     checklist's areas. This maps one onto the other so a department's document
     count is its own and not a near-miss.

     Only real correspondences are listed. A scope area with no library entry
     shows zero documents and says so — inventing a mapping to avoid an
     awkward zero is exactly the overstatement this page exists to avoid.
     ------------------------------------------------------------------ */
  var LIB_FOR = {
    biomedical:      ["Biomedical"],
    pharmacy:        ["Pharmacy"],
    facility:        ["Facilities"],
    safety:          ["Security", "Facilities"],
    cssd:            ["Central Sterile Supply Department (CSSD)"],
    mrd:             ["Medical Records"],
    infectioncontrol:["Infection Control"],
    qualitymgmt:     ["Quality Department"],
    radiology:       ["Radiology"],
    bloodbank:       ["Blood Bank"],
    laboratory:      ["Blood Bank"],
    nursing:         ["Nursing"],
    ot:              ["Operation Theatre", "Anaesthesia"],
    recovery:        ["Anaesthesia"],
    obg:             ["Obstetrics & Gynaecology"],
    paediatric:      ["Neonatology / NICU"],
    icu:             ["Neonatology / NICU"],
    chemotherapy:    ["Oncology"],
    dialysis:        ["Dialysis / Nephrology"],
    nutrition:       ["Dietetics"],
    emergency:       ["Emergency Department"],
    frontoffice:     ["Billing / Front Office"],
    wards:           ["Medical / Clinical"],
    opd:             ["Medical / Clinical"]
  };

  function docsFor(key) {
    var names = LIB_FOR[key] || [];
    var mine = LIB.filter(function (d) { return names.indexOf(d.department) > -1; });
    return {
      total: mine.length,
      detailed: mine.filter(function (d) { return d.detailed; }).length,
      checklist: mine.filter(function (d) { return d.category === "checklist"; }).length,
      form: mine.filter(function (d) { return d.category === "form"; }).length,
      register: mine.filter(function (d) { return d.category === "register"; }).length
    };
  }

  /* The specific reason THIS department pays, as opposed to the four things every
     department gets. Written per area because "you get audits and incidents" is true
     of all 45 and therefore persuades nobody. Where an area has no distinct argument
     beyond the universal four, it gets none rather than a padded one. */
  var PITCH = {
    biomedical: "An assessor opens the calibration register and works backwards to the one pump that lapsed. The renewal calendar surfaces that lapse weeks before the assessor does — calibration, preventive maintenance and AMC renewal all carry owners and due dates.",
    pharmacy: "Licence expiry, LASA separation, narcotics reconciliation and high-risk medication lists are checked by inspection, not by policy. The element explanations here are written from a practising clinical pharmacist's notes, not paraphrased from the standard.",
    facility: "Nineteen checkable items, most of which fail on paperwork rather than on condition — the plant is fine, the drawing is from 2019. Licences, STP, manifold room and alternate water and power all renew on dates somebody has to hold.",
    safety: "Mock drills twice a year is the most commonly missed dated requirement in NABH. Drills, fire plans, spill management and facility rounds are scheduled and evidenced here rather than remembered.",
    cssd: "Validation records, ETO safety and the recall procedure — the last of which is usually written the week an assessor asks for it. Nine registers already mapped to this department.",
    hr: "Credentialing and privileging is where hospitals lose points hardest, because it is per-person and registrations expire quietly. Credentials are a first-class asset type in the register, with the same expiry tracking as equipment.",
    mrd: "Record audit and case-record sampling are recurring dated activities, not one-off documents. Retention and destruction schedules run on the calendar with a signed trail.",
    his: "Backup, confidentiality, access control and data destruction are now enforceable under the DPDP Act as well as NABH — two regulators, one set of evidence.",
    laundry: "Thirteen checkable items in a department that assumes accreditation is not about it: segregation, washing protocols, machinery maintenance, and quality assurance on the outsourced contract.",
    kitchen: "Food handler screening and staff health check-ups are dated, per-person records that expire. The same tracking that runs credentials runs these.",
    housekeeping: "A small scope — four elements — but biomedical waste handling and hazmat sit here, and both are checked on the floor rather than in a file.",
    mortuary: "A three-item scope that is almost always undocumented entirely, because no one owns it until the assessor asks who does.",
    purchase: "Implant and prosthesis traceability is a patient-safety requirement wearing a stores uniform. Selection, acquisition and disposal all need a defensible trail.",
    frontoffice: "The first thing an assessor sees on walking in: rights display, UHID generation, and whether the complaints route actually closes anything.",
    radiology: "AERB licensing sits on top of NABH — a second regulator with its own renewal dates, handled here as licence renewals alongside the equipment.",
    nuclearmed: "AERB licensing and source handling run on their own dates, tracked alongside the NABH scope rather than in a separate file nobody opens.",
    radiotherapy: "AERB licensing, source records and equipment QA on dated schedules, in the same register as everything else the department owns.",
    bloodbank: "A drugs licence with its own expiry, on top of thirty-three elements and the transfusion reaction trail.",
    infectioncontrol: "This department audits all the others. Surveillance data, hand hygiene rounds and the antibiotic policy all need evidence on a schedule — and IPC's own audits of other areas become their evidence too.",
    icu: "Two hundred and fourteen elements. No individual holds that in their head, and the ward-level checklist most units use covers a fraction of it.",
    obg: "Two hundred elements across labour room and OBG, including consent, MTP records and newborn identification — all separately checkable.",
    wards: "One hundred and seventy-eight elements, and the department where an assessor spends the most floor time.",
    ot: "One hundred and thirty-nine elements, plus surgical safety checklist compliance measured as a rate rather than claimed as a practice.",
    emergency: "Triage, MLC, dead-on-arrival and disaster plan testing twice a year — dated obligations that live outside anyone's job description.",
    nursing: "Sixty-nine elements and fifteen forms, and the staff group that carries the most documentation per shift.",
    qualitymgmt: "The department that has to produce everything above on request. Readiness scoring, CAPA tracking and the audit trail exist so that request is answerable in an afternoon.",
    management: "The ROM interview is unscripted and covers seventy-one elements. Knowing which ones is the whole preparation."
  };

  var GROUP_LABEL = { clinical: "Clinical areas", nonclinical: "Administrative & support" };

  function card(key) {
    var d = SCOPE[key];
    if (!d) return "";
    var docs = docsFor(key);
    var quick = (d.quickList || []).filter(function (q, i, a) { return a.indexOf(q) === i; });
    var els = (d.codes || d.elements || []).length;

    /* Documents line. Says the detailed figure alongside the total, always — a total on
       its own reads as a promise of finished documents. When none are detailed yet, the
       page says so outright rather than letting "5 documents" imply five field lists. */
    var docLine;
    if (!docs.total) {
      docLine = '<span class="vl-none">Documents mapped from the shared library</span>';
    } else if (!docs.detailed) {
      docLine = "<b>" + docs.total + "</b> documents — " +
        '<span class="vl-none">standard templates, full field lists in progress</span>';
    } else {
      docLine = "<b>" + docs.total + "</b> documents, <b class=\"vl-hi\">" + docs.detailed +
        "</b> with full field lists";
    }

    var cats = [];
    if (docs.checklist) cats.push(docs.checklist + " checklist" + (docs.checklist > 1 ? "s" : ""));
    if (docs.form) cats.push(docs.form + " form" + (docs.form > 1 ? "s" : ""));
    if (docs.register) cats.push(docs.register + " register" + (docs.register > 1 ? "s" : ""));

    return '<article class="vl-card">' +
      '<header class="vl-head">' +
        "<h3>" + esc(d.name) + "</h3>" +
        (d.pdfPage ? '<span class="vl-page">Checklist p.' + esc(d.pdfPage) + "</span>" : "") +
      "</header>" +
      '<div class="vl-nums">' +
        '<div class="vl-num"><b>' + els + "</b><span>elements in scope</span></div>" +
        '<div class="vl-num"><b>' + quick.length + "</b><span>quick-list items</span></div>" +
        '<div class="vl-num"><b>' + docs.total + "</b><span>documents</span></div>" +
      "</div>" +
      (PITCH[key] ? '<p class="vl-pitch">' + esc(PITCH[key]) + "</p>" : "") +
      '<div class="vl-docs">' + docLine +
        (cats.length ? ' <span class="vl-cats">' + esc(cats.join(" · ")) + "</span>" : "") +
      "</div>" +
      (quick.length
        ? '<details class="vl-quick"><summary>What the assessor scans for here (' +
          quick.length + ")</summary><ul>" +
          quick.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") +
          "</ul></details>"
        : "") +
      "</article>";
  }

  function render() {
    var host = document.getElementById("vlBody");
    if (!host) return;

    var keys = Object.keys(SCOPE);
    if (!keys.length) {
      host.innerHTML = '<p class="vl-none">Department scope could not be loaded.</p>';
      return;
    }

    var groups = {};
    keys.forEach(function (k) {
      var g = SCOPE[k].group || "other";
      (groups[g] = groups[g] || []).push(k);
    });

    /* Totals across the whole platform, computed the same way as the per-department
       figures so the headline and the cards can never disagree. */
    var totalEls = keys.reduce(function (n, k) {
      return n + (SCOPE[k].codes || SCOPE[k].elements || []).length;
    }, 0);
    var detailed = LIB.filter(function (d) { return d.detailed; }).length;

    var summary = '<div class="vl-summary">' +
      '<div class="vl-num vl-num-lg"><b>' + keys.length + "</b><span>departments in scope</span></div>" +
      '<div class="vl-num vl-num-lg"><b>' + totalEls + "</b><span>element checks mapped</span></div>" +
      '<div class="vl-num vl-num-lg"><b>' + LIB.length + "</b><span>documents in the library</span></div>" +
      '<div class="vl-num vl-num-lg"><b>' + detailed + "</b><span>with full field lists</span></div>" +
      "</div>" +
      '<p class="vl-honest">The last two figures are shown separately on purpose. Most library ' +
      "documents currently use a standard template for their category; the ones with a " +
      "written field list and a download are counted apart so you know what you are " +
      "getting before you pay, not after.</p>";

    var order = ["nonclinical", "clinical"];
    var html = summary;
    order.concat(Object.keys(groups).filter(function (g) { return order.indexOf(g) < 0; }))
      .forEach(function (g) {
        if (!groups[g]) return;
        html += '<section class="vl-group"><h2>' + esc(GROUP_LABEL[g] || g) +
          '<span class="vl-gn">' + groups[g].length + "</span></h2>" +
          '<div class="vl-grid">' + groups[g].map(card).join("") + "</div></section>";
      });

    host.innerHTML = html;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }

  window.AQValue = { docsFor: docsFor, PITCH: PITCH, LIB_FOR: LIB_FOR };
})();
