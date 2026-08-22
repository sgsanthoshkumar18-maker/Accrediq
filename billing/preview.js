/* AQcredix — preview mode for gated pages.
 *
 * A locked page that shows nothing cannot sell itself. Someone deciding whether ₹500 a
 * month is worth it needs to see what they would be paying for, and a wall of text about
 * "readiness scoring" is not the same as seeing a readiness score.
 *
 * WHY THIS LEAKS NOTHING. A person who has not subscribed has no data in the system —
 * their workspace would be empty even if we opened it. So a preview cannot expose a
 * hospital's records; there are none. What it shows is illustrative sample data, labelled
 * as such on every screen, which is honest and is also the only thing that would be worth
 * showing.
 *
 * The real protection is unchanged: hospital data lives behind row-level security, and the
 * database refuses to hand it to a session that has no right to it. This file changes what
 * an unsubscribed visitor SEES, not what anyone can retrieve.
 */
window.AQPreview = (function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* One sample hospital, used across every preview so the pages tell a consistent story:
     the same defibrillator overdue on the register appears in the dashboard, the bell and
     the finding. A preview where each page invents unrelated numbers reads as a mock-up;
     one that hangs together reads as a product. */
  var HOSPITAL = "Sample Hospital, Chennai";

  var SAMPLE = {
    readiness: { pct: 68, met: 437, partial: 121, notMet: 82,
      chapters: [["AAC", 74], ["COP", 61], ["MOM", 80], ["PRE", 66], ["IPC", 55],
                 ["PSQ", 72], ["ROM", 81], ["FMS", 58], ["HRM", 70], ["IMS", 64]] },

    due: [
      { kind: "Equipment", name: "Defibrillator — ICU bed 4",
        meta: "Calibration · yearly · Biomedical", state: "overdue", text: "59 days overdue" },
      { kind: "Round", name: "Hand hygiene compliance round",
        meta: "Monthly · Infection Control · IPC.2.c", state: "overdue", text: "43 days overdue" },
      { kind: "Task", name: "Medical gas pipeline pressure check",
        meta: "Monthly · Biomedical · FMS.6.a", state: "overdue", text: "24 days overdue" },
      { kind: "Committee", name: "Infection Control Committee",
        meta: "Quarterly · Chair: Dr Rao", state: "soon", text: "Due Monday" },
      { kind: "Equipment", name: "Autoclave — CSSD 1",
        meta: "Preventive · quarterly · Biomedical", state: "ok", text: "Due 10 Nov" }
    ],

    findings: [
      { title: "Hand hygiene compliance 67%, below the 90% target",
        meta: "IPC.2.c · Sister Lakshmi · verification due", state: "overdue" },
      { title: "Defibrillator calibration lapsed beyond 12 months",
        meta: "FMS.4.a · Mr Ravi · corrective action", state: "overdue" }
    ],

    rounds: [
      { name: "Hand hygiene compliance round", score: 67, passed: false,
        meta: "10 Aug · ICU · target 90%" },
      { name: "Cleaning audit — wards", score: 92, passed: true,
        meta: "8 Aug · Ward 3 · target 85%" },
      { name: "Crash cart and emergency drug check", score: 100, passed: true,
        meta: "12 Aug · ICU · target 100%" }
    ],

    register: [
      { name: "Defibrillator — ICU bed 4", meta: "ZOLL-R-88213 · Biomedical · ICU",
        state: "overdue", text: "59 days overdue" },
      { name: "Autoclave — CSSD 1", meta: "AUT-01 · Biomedical · CSSD",
        state: "ok", text: "Due 10 Nov" },
      { name: "Fire NOC", meta: "NOC-2025 · Facilities", state: "soon", text: "Due 2 Nov" },
      { name: "Ventilator fleet AMC — Hamilton", meta: "Contract · Biomedical",
        state: "ok", text: "Due 20 Jan" }
    ]
  };

  /* The banner sits ABOVE the content and stays on screen. A preview that does not
     continuously say it is a preview is a lie by omission — someone could otherwise
     believe those are their own hospital's numbers. */
  function banner(b) {
    return '<div class="pv-banner">' +
      '<div class="pv-banner-in">' +
        '<span class="pv-tag">Preview</span>' +
        "<span>This page is shown with sample data from a fictional hospital, so you can " +
        "see what it does. Subscribe to use it with your own.</span>" +
        '<a class="btn btn-accent btn-sm" href="' + b + 'plans.html">See what you get</a>' +
      "</div></div>";
  }

  /* Self-contained classes, deliberately.
     The first version reused `cal-row` and friends from calendar.css — which the workspace
     loads and almost no other gated page does, so every preview outside the workspace
     rendered as a stack of unstyled text. Preview markup must depend only on styles.css,
     because it appears on pages that share nothing else. */
  function pill(state, text) {
    return '<span class="pv-pill pv-' + esc(state) + '">' + esc(text) + "</span>";
  }

  function rows(list) {
    return '<div class="pv-rows">' + list.map(function (d) {
      return '<div class="pv-row pv-' + esc(d.state) + '">' +
        '<div class="pv-row-main">' +
          (d.kind ? '<span class="pv-kind">' + esc(d.kind) + "</span>" : "") +
          "<b>" + esc(d.name || d.title) + "</b>" +
          '<span class="pv-meta">' + esc(d.meta) + "</span>" +
        "</div>" +
        (d.text ? '<div class="pv-row-side">' + pill(d.state, d.text) + "</div>" : "") +
      "</div>";
    }).join("") + "</div>";
  }

  function readinessBlock() {
    var r = SAMPLE.readiness;
    return '<div class="pv-score">' +
      '<div class="pv-ring" style="--pct:' + r.pct + '"><span>' + r.pct + "<i>%</i></span></div>" +
      '<div class="pv-legend">' +
        "<div><b>" + r.met + "</b><span>Met</span></div>" +
        "<div><b>" + r.partial + "</b><span>Partially met</span></div>" +
        "<div><b>" + r.notMet + "</b><span>Not met</span></div>" +
      "</div></div>" +
      '<div class="pv-bars">' + r.chapters.map(function (c) {
        return '<div class="pv-bar"><span>' + c[0] + '</span><i><b style="width:' +
          c[1] + '%"></b></i><em>' + c[1] + "%</em></div>";
      }).join("") + "</div>";
  }

  function stat(n, l, cls) {
    return '<div class="ws-stat' + (cls ? " " + cls : "") + '"><span class="n">' + n +
      '</span><span class="l">' + esc(l) + "</span></div>";
  }

  /* Each preview mirrors the real page's structure, so what a visitor sees here is what
     they will find after subscribing. A preview that looks nothing like the product is
     worse than none — it sets up a disappointment at exactly the wrong moment. */
  var PAGES = {
    readiness: function () {
      return "<h1>Accreditation readiness</h1>" +
        '<p class="lead">Every Objective Element scored, chapter by chapter.</p>' +
        readinessBlock();
    },
    dashboard: function () {
      return "<h1>My department</h1>" +
        '<p class="lead">Everything one department is answerable for, in one place.</p>' +
        '<div class="pv-stats">' + stat(3, "Overdue", "ws-stat-bad") +
          stat(1, "Due soon", "ws-stat-warn") + stat(2, "Open findings") +
          stat(12, "SOPs to hold") + "</div>" +
        "<h3>Needs attention now</h3>" + rows(SAMPLE.due.slice(0, 3)) +
        "<h3>Open findings</h3>" + rows(SAMPLE.findings.map(function (f) {
          return { name: f.title, meta: f.meta, state: "overdue", text: "Open" };
        }));
    },
    register: function () {
      return "<h1>Equipment &amp; licence register</h1>" +
        '<p class="lead">Every item with a renewal date, with its calibration and ' +
        "maintenance cycle.</p>" +
        '<div class="pv-stats">' + stat(1, "Overdue", "ws-stat-bad") +
          stat(1, "Due soon", "ws-stat-warn") + stat(42, "Items on the register") +
          stat(511, "Records held") + "</div>" +
        rows(SAMPLE.register);
    },
    rounds: function () {
      return "<h1>Rounds &amp; checklists</h1>" +
        '<p class="lead">Any recurring check that produces a score, trended against your ' +
        "own target.</p>" +
        '<div class="pv-stats">' + stat(1, "Rounds overdue", "ws-stat-bad") +
          stat(1, "Below target", "ws-stat-warn") + stat(9, "Checklists") +
          stat(187, "Rounds recorded") + "</div>" +
        '<div class="pv-rows">' + SAMPLE.rounds.map(function (r) {
          return '<div class="pv-row pv-' + (r.passed ? "ok" : "overdue") + '">' +
            '<div class="pv-row-main"><b>' + esc(r.name) + "</b>" +
            '<span class="pv-meta">' + esc(r.meta) + "</span>" +
            (!r.passed ? '<span class="pv-flag">Below target — record an action</span>' : "") +
            "</div>" +
            '<div class="pv-row-side"><span class="pv-pill pv-' +
              (r.passed ? "ok" : "overdue") + '">' + r.score + "%</span></div></div>";
        }).join("") + "</div>";
    },
    capa: function () {
      return "<h1>NC &amp; CAPA</h1>" +
        '<p class="lead">Findings tracked to closure — and never closed by whoever ' +
        "raised them.</p>" +
        '<div class="pv-stats">' + stat(2, "Open", "ws-stat-bad") +
          stat(1, "Awaiting verification", "ws-stat-warn") + stat(17, "Raised this year") +
          stat(14, "Closed") + "</div>" +
        rows(SAMPLE.findings.map(function (f) {
          return { name: f.title, meta: f.meta, state: "overdue", text: "Open" };
        }));
    },
    calendar: function () {
      return "<h1>Compliance calendar</h1>" +
        '<p class="lead">Committees and recurring obligations, with what is overdue today.</p>' +
        '<div class="pv-stats">' + stat(3, "Overdue", "ws-stat-bad") +
          stat(1, "Due this week", "ws-stat-warn") + stat(12, "Committees") +
          stat(31, "Recurring obligations") + "</div>" +
        rows(SAMPLE.due);
    },
    quiz: function () {
      return "<h1>Today’s quiz</h1>" +
        '<p class="lead">A fresh set every day, drawn from the standards, with your score ' +
        "history and a certificate in your name.</p>" +
        '<div class="pv-q">' +
          "<div class=\"pv-q-n\">Question 3 of 10 · IPC</div>" +
          "<b>Hand-hygiene facilities must be accessible where care is delivered. Which of " +
          "these best evidences compliance?</b>" +
          '<div class="pv-q-opt">A written hand-hygiene policy signed by the ICN</div>' +
          '<div class="pv-q-opt is-on">Your own observed compliance audit data, by unit</div>' +
          '<div class="pv-q-opt">A training attendance register</div>' +
          '<div class="pv-q-opt">Alcohol rub purchase invoices</div>' +
        "</div>" +
        '<div class="pv-note-inline">The quiz is <b>free with an account</b> — you do ' +
        "not need a subscription for this page.</div>";
    },
    kpi: function () {
      return "<h1>KPI library</h1>" +
        '<p class="lead">The indicators an assessor expects, with how each is calculated.</p>' +
        '<div class="pv-kpi">' +
          '<div><b>Hand hygiene compliance rate</b><span>Opportunities taken \u00f7 ' +
            "opportunities observed × 100 · monthly · IPC</span></div>" +
          '<div><b>Medication error rate</b><span>Errors \u00f7 patient days × 1000 ' +
            "· monthly · Pharmacy</span></div>" +
          '<div><b>Return to ICU within 48 hours</b><span>Unplanned returns \u00f7 ICU ' +
            "discharges × 100 · monthly · ICU</span></div>" +
        "</div>";
    },
    sop: function () {
      return "<h1>SOPs by department</h1>" +
        '<p class="lead">188 SOP-required elements, each with the departments answerable ' +
        "for it.</p>" +
        '<div class="tr-sheet">' +
          '<div class="tr-sh tr-sh-h"><span>Element</span><span>Departments</span></div>' +
          '<div class="tr-sh"><span>IPC.2.c</span><span>All clinical areas</span></div>' +
          '<div class="tr-sh"><span>COP.5.a</span><span>ICU, Wards, Emergency</span></div>' +
          '<div class="tr-sh"><span>MOM.6.a</span><span>Pharmacy</span></div>' +
          '<div class="tr-sh"><span>FMS.5.a</span><span>Facilities, Security</span></div>' +
        "</div>";
    },
    tools: function () {
      return "<h1>Quality tools</h1>" +
        '<p class="lead">Five Why, fishbone, PDCA and the rest — working tools, not ' +
        "diagrams to look at.</p>" +
        '<div class="pv-tool">' +
          "<b>5 Why — hand hygiene compliance fell to 67%</b>" +
          '<div class="pv-why"><span>1</span>Why? Alcohol rub was empty in three of six bays.</div>' +
          '<div class="pv-why"><span>2</span>Why? Nobody was named to check levels each shift.</div>' +
          '<div class="pv-why is-dim"><span>3</span>Continue in the full tool…</div>' +
        "</div>";
    },
    videos: function () {
      return "<h1>Video library</h1>" +
        '<p class="lead">Short explainers on the elements teams find hardest.</p>' +
        '<div class="pv-vids">' +
          '<div class="pv-vid"><b>Medication reconciliation at transitions</b>' +
            "<span>MOM.4.e · 6 min</span></div>" +
          '<div class="pv-vid"><b>What an assessor actually asks about hand hygiene</b>' +
            "<span>IPC.2.c · 8 min</span></div>" +
          '<div class="pv-vid"><b>Writing a CAPA that closes</b><span>PSQ · 5 min</span></div>' +
        "</div>";
    },
    standards: function () {
      return "<h1>The standards, explained</h1>" +
        '<p class="lead">Every element with what it requires in plain terms.</p>' +
        '<div class="tr-head"><b>MOM.4.e</b><span class="tr-chip">Core</span></div>' +
        '<div class="pv-explain">Reconcile medicines at every transition in care. The ' +
        "purpose is to confirm that what the patient is taking still matches the current " +
        "clinical picture and care plan, and that nothing carried over from before is now " +
        "working against it.</div>" +
        '<div class="pv-note-inline">Browsing the standards is <b>free with an account</b>.</div>';
    },
    committees: function () {
      return "<h1>Committees</h1>" +
        '<p class="lead">Which committees a hospital must run, how often, and who sits on them.</p>' +
        rows([
          { name: "Infection Control Committee", meta: "Quarterly · chaired by the Microbiologist",
            state: "ok", text: "4 sittings/yr" },
          { name: "Pharmacy & Therapeutics Committee", meta: "Quarterly · chaired by the Medical Superintendent",
            state: "ok", text: "4 sittings/yr" },
          { name: "Quality Assurance Committee", meta: "Monthly · chaired by the Quality Manager",
            state: "ok", text: "12 sittings/yr" }
        ]);
    },
    codealerts: function () {
      return "<h1>Code alerts</h1>" +
        '<p class="lead">The colour codes your hospital must define, publish and drill — ' +
        "with who responds and what they do.</p>" +
        rows([
          { kind: "Code Blue", name: "Cardiopulmonary arrest",
            meta: "Response team · all clinical areas · drill half-yearly",
            state: "ok", text: "Defined" },
          { kind: "Code Red", name: "Fire",
            meta: "Fire marshal and security · hospital-wide · drill half-yearly",
            state: "ok", text: "Defined" },
          { kind: "Code Pink", name: "Infant or child abduction",
            meta: "Security · maternity, paediatrics · drill yearly",
            state: "warn", text: "Not drilled" }
        ]) +
        '<div class="pv-note-inline">The full page carries every code, the response ' +
        "protocol for each, and the drill record an assessor asks to see.</div>";
    },
    icd: function () {
      return "<h1>ICD-11 lookup</h1>" +
        '<p class="lead">Search the classification by term or code, without leaving the ' +
        "platform.</p>" +
        rows([
          { kind: "5A11", name: "Type 2 diabetes mellitus",
            meta: "Endocrine, nutritional or metabolic diseases", state: "ok", text: "ICD-11" },
          { kind: "BA00", name: "Essential hypertension",
            meta: "Diseases of the circulatory system", state: "ok", text: "ICD-11" },
          { kind: "CA40", name: "Pneumonia",
            meta: "Diseases of the respiratory system", state: "ok", text: "ICD-11" }
        ]);
    },
    audit: function () {
      return "<h1>Internal audit</h1>" +
        '<p class="lead">Department-scoped audit built from the assessor checklist, timed, ' +
        "with findings pushed straight to CAPA.</p>" +
        '<div class="pv-stats">' + stat(45, "Departments in scope") + stat(12, "Audits this year") +
          stat(3, "Open findings", "ws-stat-bad") + stat("68%", "Average score") + "</div>" +
        rows([
          { name: "Pharmacy", meta: "Audited 4 Aug · Dr Menon · 34 elements",
            state: "ok", text: "82%" },
          { name: "Intensive Care Unit", meta: "Audited 28 Jul · 41 elements",
            state: "overdue", text: "61%" },
          { name: "Central Sterile Supply", meta: "Not yet audited this cycle",
            state: "warn", text: "Due" }
        ]);
    },
    incidents: function () {
      return "<h1>Incident reporting</h1>" +
        '<p class="lead">Four-level classification, a one-hour reporting window, and root ' +
        "cause analysis built in.</p>" +
        '<div class="pv-stats">' + stat(42, "Reported this year") + stat(2, "Open", "ws-stat-bad") +
          stat(6, "Near misses this month") + stat("94%", "Reported within the hour") + "</div>" +
        rows([
          { kind: "Level 3", name: "Patient fall — no injury",
            meta: "ICU · 1 Aug · RCA complete", state: "ok", text: "Closed" },
          { kind: "Level 2", name: "Wrong-strength medicine dispensed, intercepted",
            meta: "Pharmacy · 9 Aug · near miss", state: "warn", text: "In review" }
        ]) +
        '<div class="pv-note-inline">Patient identifiers are <b>deliberately not stored</b> ' +
        "— the printed form carries them in pen, and the hospital keeps that.</div>";
    },
    gap: function () {
      return "<h1>Gap analysis</h1>" +
        '<p class="lead">Where you stand against every element, and what closing each gap ' +
        "takes.</p>" +
        rows([
          { kind: "IPC.2.c", name: "Hand-hygiene facilities at the point of care",
            meta: "Partially met · audit data missing", state: "warn", text: "Gap" },
          { kind: "MOM.4.e", name: "Medication reconciliation at transitions",
            meta: "Not met · no defined process", state: "overdue", text: "Gap" },
          { kind: "FMS.5.a", name: "Fire and emergency plans",
            meta: "Met · drill records current", state: "ok", text: "Met" }
        ]);
    },
    generic: function () {
      return "<h1>Part of the workspace</h1>" +
        '<p class="lead">This page is included in the subscription.</p>' +
        rows(SAMPLE.due.slice(0, 3));
    }
  };

  /* What the subscription actually adds, said next to the preview rather than on a
     separate page nobody visits. */
  function cta(b) {
    return '<div class="pv-cta">' +
      "<h2>This is a preview. Here is what changes when you subscribe.</h2>" +
      '<div class="pv-grid">' +
        '<div><b>Your own hospital</b><p>Every figure above becomes your data — your ' +
          "equipment, your committees, your findings.</p></div>" +
        '<div><b>Every department, one account</b><p>Your subscription covers you, ' +
          "across all 45 departments — nothing in the platform is held back.</p></div>" +
        '<div><b>It tells you</b><p>Weekly email and in-app alerts for what is overdue, ' +
          "by department.</p></div>" +
        '<div><b>Evidence an assessor accepts</b><p>Certificates attached to records, ' +
          "and one-press exports.</p></div>" +
      "</div>" +
      '<p class="pv-actions">' +
        '<a class="btn btn-accent" href="' + b + 'plans.html">See plans and pricing</a> ' +
        '<a class="btn btn-ghost" href="' + b + 'workspace/workspace.html">Sign in</a>' +
      "</p></div>";
  }

  function render(key, baseHref) {
    var b = baseHref || "";
    var fn = PAGES[key] || PAGES.generic;

    /* The reel goes FIRST. A visitor deciding whether to read on gives this a couple of
       seconds, and motion showing the page working earns that attention in a way a table
       of sample rows does not. The sample data still follows, for the reader who wants
       detail rather than a pitch. */
    var reel = (window.AQReel && window.AQReel.render(key, b)) || "";

    return banner(b) +
      (reel ? '<section class="section wrap rl-wrap">' + reel + "</section>" : "") +
      '<section class="section wrap pv-body" aria-label="Preview with sample data">' +
        (reel ? '<h2 class="pv-detail-h">And in detail</h2>' : "") +
        fn() + cta(b) +
      "</section>";
  }

  /* Called after the markup is in the DOM. Kept separate from render() so the markup can
     be produced and tested without a document. */
  function mount() {
    if (window.AQReel) window.AQReel.attach(document);
  }

  return { render: render, mount: mount, PAGES: PAGES, SAMPLE: SAMPLE, HOSPITAL: HOSPITAL };
})();
