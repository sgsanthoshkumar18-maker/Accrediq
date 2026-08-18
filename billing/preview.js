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
      { kind: "Equipment", name: "Defibrillator \u2014 ICU bed 4",
        meta: "Calibration \u00b7 yearly \u00b7 Biomedical", state: "overdue", text: "59 days overdue" },
      { kind: "Round", name: "Hand hygiene compliance round",
        meta: "Monthly \u00b7 Infection Control \u00b7 IPC.2.c", state: "overdue", text: "43 days overdue" },
      { kind: "Task", name: "Medical gas pipeline pressure check",
        meta: "Monthly \u00b7 Biomedical \u00b7 FMS.6.a", state: "overdue", text: "24 days overdue" },
      { kind: "Committee", name: "Infection Control Committee",
        meta: "Quarterly \u00b7 Chair: Dr Rao", state: "soon", text: "Due Monday" },
      { kind: "Equipment", name: "Autoclave \u2014 CSSD 1",
        meta: "Preventive \u00b7 quarterly \u00b7 Biomedical", state: "ok", text: "Due 10 Nov" }
    ],

    findings: [
      { title: "Hand hygiene compliance 67%, below the 90% target",
        meta: "IPC.2.c \u00b7 Sister Lakshmi \u00b7 verification due", state: "overdue" },
      { title: "Defibrillator calibration lapsed beyond 12 months",
        meta: "FMS.4.a \u00b7 Mr Ravi \u00b7 corrective action", state: "overdue" }
    ],

    rounds: [
      { name: "Hand hygiene compliance round", score: 67, passed: false,
        meta: "10 Aug \u00b7 ICU \u00b7 target 90%" },
      { name: "Cleaning audit \u2014 wards", score: 92, passed: true,
        meta: "8 Aug \u00b7 Ward 3 \u00b7 target 85%" },
      { name: "Crash cart and emergency drug check", score: 100, passed: true,
        meta: "12 Aug \u00b7 ICU \u00b7 target 100%" }
    ],

    register: [
      { name: "Defibrillator \u2014 ICU bed 4", meta: "ZOLL-R-88213 \u00b7 Biomedical \u00b7 ICU",
        state: "overdue", text: "59 days overdue" },
      { name: "Autoclave \u2014 CSSD 1", meta: "AUT-01 \u00b7 Biomedical \u00b7 CSSD",
        state: "ok", text: "Due 10 Nov" },
      { name: "Fire NOC", meta: "NOC-2025 \u00b7 Facilities", state: "soon", text: "Due 2 Nov" },
      { name: "Ventilator fleet AMC \u2014 Hamilton", meta: "Contract \u00b7 Biomedical",
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

  function pill(state, text) {
    return '<span class="cal-pill st-' + esc(state) + '">' + esc(text) + "</span>";
  }

  function rows(list) {
    return '<div class="cal-rows">' + list.map(function (d) {
      return '<div class="cal-row st-' + esc(d.state) + '">' +
        '<div class="cal-row-main">' +
          (d.kind ? '<span class="dash-kind">' + esc(d.kind) + "</span>" : "") +
          "<h4>" + esc(d.name || d.title) + "</h4>" +
          '<div class="cal-meta">' + esc(d.meta) + "</div>" +
        "</div>" +
        '<div class="cal-row-side">' + pill(d.state, d.text || "") + "</div>" +
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
        '<div class="cal-rows">' + SAMPLE.rounds.map(function (r) {
          return '<div class="cal-row st-' + (r.passed ? "ok" : "overdue") + '">' +
            '<div class="cal-row-main"><h4>' + esc(r.name) + "</h4>" +
            '<div class="cal-meta">' + esc(r.meta) + "</div>" +
            (!r.passed ? '<div class="cal-next rd-flag">Below target \u2014 ' +
              "record an action</div>" : "") + "</div>" +
            '<div class="cal-row-side"><span class="cal-pill st-' +
              (r.passed ? "ok" : "overdue") + '">' + r.score + "%</span></div></div>";
        }).join("") + "</div>";
    },
    capa: function () {
      return "<h1>NC &amp; CAPA</h1>" +
        '<p class="lead">Findings tracked to closure \u2014 and never closed by whoever ' +
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
      return "<h1>Today\u2019s quiz</h1>" +
        '<p class="lead">A fresh set every day, drawn from the standards, with your score ' +
        "history and a certificate in your name.</p>" +
        '<div class="pv-q">' +
          "<div class=\"pv-q-n\">Question 3 of 10 \u00b7 IPC</div>" +
          "<b>Hand-hygiene facilities must be accessible where care is delivered. Which of " +
          "these best evidences compliance?</b>" +
          '<div class="pv-q-opt">A written hand-hygiene policy signed by the ICN</div>' +
          '<div class="pv-q-opt is-on">Your own observed compliance audit data, by unit</div>' +
          '<div class="pv-q-opt">A training attendance register</div>' +
          '<div class="pv-q-opt">Alcohol rub purchase invoices</div>' +
        "</div>" +
        '<div class="pv-note-inline">The quiz is <b>free with an account</b> \u2014 you do ' +
        "not need a subscription for this page.</div>";
    },
    kpi: function () {
      return "<h1>KPI library</h1>" +
        '<p class="lead">The indicators an assessor expects, with how each is calculated.</p>' +
        '<div class="pv-kpi">' +
          '<div><b>Hand hygiene compliance rate</b><span>Opportunities taken \u00f7 ' +
            "opportunities observed \u00d7 100 \u00b7 monthly \u00b7 IPC</span></div>" +
          '<div><b>Medication error rate</b><span>Errors \u00f7 patient days \u00d7 1000 ' +
            "\u00b7 monthly \u00b7 Pharmacy</span></div>" +
          '<div><b>Return to ICU within 48 hours</b><span>Unplanned returns \u00f7 ICU ' +
            "discharges \u00d7 100 \u00b7 monthly \u00b7 ICU</span></div>" +
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
        '<p class="lead">Five Why, fishbone, PDCA and the rest \u2014 working tools, not ' +
        "diagrams to look at.</p>" +
        '<div class="pv-tool">' +
          "<b>5 Why \u2014 hand hygiene compliance fell to 67%</b>" +
          '<div class="pv-why"><span>1</span>Why? Alcohol rub was empty in three of six bays.</div>' +
          '<div class="pv-why"><span>2</span>Why? Nobody was named to check levels each shift.</div>' +
          '<div class="pv-why is-dim"><span>3</span>Continue in the full tool\u2026</div>' +
        "</div>";
    },
    videos: function () {
      return "<h1>Video library</h1>" +
        '<p class="lead">Short explainers on the elements teams find hardest.</p>' +
        '<div class="pv-vids">' +
          '<div class="pv-vid"><b>Medication reconciliation at transitions</b>' +
            "<span>MOM.4.e \u00b7 6 min</span></div>" +
          '<div class="pv-vid"><b>What an assessor actually asks about hand hygiene</b>' +
            "<span>IPC.2.c \u00b7 8 min</span></div>" +
          '<div class="pv-vid"><b>Writing a CAPA that closes</b><span>PSQ \u00b7 5 min</span></div>' +
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
          { name: "Infection Control Committee", meta: "Quarterly \u00b7 chaired by the Microbiologist",
            state: "ok", text: "4 sittings/yr" },
          { name: "Pharmacy & Therapeutics Committee", meta: "Quarterly \u00b7 chaired by the Medical Superintendent",
            state: "ok", text: "4 sittings/yr" },
          { name: "Quality Assurance Committee", meta: "Monthly \u00b7 chaired by the Quality Manager",
            state: "ok", text: "12 sittings/yr" }
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
        '<div><b>Your own hospital</b><p>Every figure above becomes your data \u2014 your ' +
          "equipment, your committees, your findings.</p></div>" +
        '<div><b>Everyone in your hospital</b><p>Unlimited accounts, every department, ' +
          "no per-user charge.</p></div>" +
        '<div><b>It tells you</b><p>Weekly email and in-app alerts for what is overdue, ' +
          "by department.</p></div>" +
        '<div><b>Evidence an assessor accepts</b><p>Certificates attached to records, ' +
          "and one-press exports.</p></div>" +
      "</div>" +
      '<p class="ag-actions">' +
        '<a class="btn btn-accent" href="' + b + 'plans.html">See plans and pricing</a> ' +
        '<a class="btn btn-ghost" href="' + b + 'workspace/workspace.html">Sign in</a>' +
      "</p></div>";
  }

  function render(key, baseHref) {
    var b = baseHref || "";
    var fn = PAGES[key] || PAGES.generic;
    return banner(b) +
      '<section class="section wrap pv-body" aria-label="Preview with sample data">' +
        fn() + cta(b) +
      "</section>";
  }

  return { render: render, PAGES: PAGES, SAMPLE: SAMPLE, HOSPITAL: HOSPITAL };
})();
