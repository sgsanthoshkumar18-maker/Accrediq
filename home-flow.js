/* AQcredix — the "how it runs" homepage section.
 *
 * The site explains standards beautifully and then asks for a subscription. This section
 * closes that gap: it shows the platform DOING the work — a department opening the
 * calendar, finding what is overdue, recording a drill, and the evidence landing against
 * an element — because that is the part a hospital cannot screenshot and keep.
 *
 * Built on the same scrollytelling engine as the lens strip. Four steps drive a pinned
 * panel that swaps between four mocked-up screens.
 *
 * THE SCREENS ARE MOCK-UPS, NOT LIVE DATA, and are labelled as such in the markup. A
 * homepage cannot read a visitor's hospital, and inventing plausible-looking figures
 * without saying they are illustrative would be the kind of quiet dishonesty an
 * accreditation product least affords.
 */
window.HOME_FLOW = [

  {
    step: "01 — SET UP",
    title: "Tell it how your hospital runs",
    body: "Your committees, how often each must meet, when each last met. Your drills, " +
          "audits, calibration and training cycles. Ten minutes of setup, once.",
    screen: "setup"
  },

  {
    step: "02 — EVERY MORNING",
    title: "Everyone knows what is due",
    body: "The calendar works out every date from there — exact intervals for compliance, " +
          "shifted to your preferred day for the meeting itself. Overdue items surface " +
          "first, so nothing waits for someone to remember it.",
    screen: "due"
  },

  {
    step: "03 — AS WORK HAPPENS",
    title: "Evidence files itself",
    body: "Record the drill, log the incident, close the CAPA. Each one lands against the " +
          "NABH element it evidences — not in a folder someone has to maintain.",
    screen: "record"
  },

  {
    step: "04 — ASSESSMENT DAY",
    title: "A report, not a scramble",
    body: "Every SOP with the departments answerable for it, every committee with its " +
          "sitting history, every recurring obligation with its record. Exported, in one press.",
    screen: "report"
  }
];

(function () {
  "use strict";

  var host = document.getElementById("flowScreen");
  if (!host || !window.HOME_FLOW) return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Each screen is a small, honest sketch of a real AQcredix view. Deliberately not
     pixel-perfect replicas: a sketch reads as "this is what it does", where a fake
     screenshot invites the visitor to believe it is their own data. */
  var SCREENS = {

    setup:
      '<div class="fl-bar"><span class="fl-dot"></span>Add a committee</div>' +
      '<div class="fl-form">' +
        '<div class="fl-f"><label>Committee name</label><div class="fl-in">Infection Control Committee</div></div>' +
        '<div class="fl-f"><label>How often must it meet?</label><div class="fl-in">Quarterly</div></div>' +
        '<div class="fl-f"><label>When did it last meet?</label><div class="fl-in">12 May 2026</div></div>' +
        '<div class="fl-f"><label>Preferred day</label><div class="fl-in">Monday</div></div>' +
      "</div>" +
      '<div class="fl-note">Next sitting due <b>12 Aug</b> · nearest Monday <b>10 Aug</b>. ' +
      "Both are kept — one is the compliance interval, one is when you will actually meet.</div>",

    due:
      '<div class="fl-bar"><span class="fl-dot"></span>This week</div>' +
      '<div class="fl-rows">' +
        '<div class="fl-row is-bad"><div><b>Hand hygiene compliance audit</b>' +
          '<span>Monthly · IPC.2.c · Infection Control</span></div>' +
          '<span class="fl-pill bad">14 days overdue</span></div>' +
        '<div class="fl-row is-bad"><div><b>Crash cart and emergency drug check</b>' +
          '<span>Monthly · COP.5 · Every ward</span></div>' +
          '<span class="fl-pill bad">6 days overdue</span></div>' +
        '<div class="fl-row is-warn"><div><b>Infection Control Committee</b>' +
          '<span>Quarterly · chaired by the Microbiologist</span></div>' +
          '<span class="fl-pill warn">Due Monday</span></div>' +
        '<div class="fl-row"><div><b>Fire drill / mock evacuation</b>' +
          '<span>Half-yearly · FMS.5 · Facilities</span></div>' +
          '<span class="fl-pill">Due 4 Nov</span></div>' +
      "</div>",

    record:
      '<div class="fl-bar"><span class="fl-dot"></span>Record a meeting</div>' +
      '<div class="fl-form">' +
        '<div class="fl-f"><label>Date held</label><div class="fl-in">10 August 2026</div></div>' +
        '<div class="fl-f"><label>Members present</label><div class="fl-in">9 · quorum met</div></div>' +
      "</div>" +
      '<div class="fl-toast">Meeting recorded — next sitting 9 November</div>' +
      '<div class="fl-rows fl-tight">' +
        '<div class="fl-row is-ok"><div><b>Filed against IPC.2.c</b>' +
          "<span>Hand hygiene facilities and practices</span></div>" +
          '<span class="fl-pill ok">Evidence</span></div>' +
        '<div class="fl-row is-ok"><div><b>Committee history updated</b>' +
          "<span>4 sittings recorded this year</span></div>" +
          '<span class="fl-pill ok">Logged</span></div>' +
      "</div>",

    report:
      '<div class="fl-bar"><span class="fl-dot"></span>Export</div>' +
      '<div class="fl-sheet">' +
        '<div class="fl-sh-row fl-sh-head"><span>Element</span><span>Objective Element</span>' +
          "<span>Departments</span></div>" +
        '<div class="fl-sh-row"><span>IPC.2.c</span><span>Hand-hygiene facilities are appropriate…</span>' +
          "<span>All clinical areas</span></div>" +
        '<div class="fl-sh-row"><span>COP.5.a</span><span>Resuscitation services are available…</span>' +
          "<span>ICU, Wards, ER</span></div>" +
        '<div class="fl-sh-row"><span>FMS.5.a</span><span>Fire and non-fire emergency plans…</span>' +
          "<span>Facilities, Security</span></div>" +
        '<div class="fl-sh-row"><span>MOM.6.a</span><span>Medications are dispensed safely…</span>' +
          "<span>Pharmacy</span></div>" +
      "</div>" +
      '<div class="fl-note">188 SOP-required elements, each with the departments answerable ' +
      "for it. Excel, in one press.</div>"
  };

  function render() {
    var F = window.HOME_FLOW;

    host.innerHTML = F.map(function (f, i) {
      return '<div class="fl-face" data-face="' + i + '">' +
        (SCREENS[f.screen] || "") + "</div>";
    }).join("");

    var steps = document.getElementById("flowSteps");
    if (steps) {
      steps.innerHTML = F.map(function (f) {
        return '<div data-scrolly-step><div class="step">' + esc(f.step) + "</div>" +
          "<h3>" + esc(f.title) + "</h3><p>" + esc(f.body) + "</p></div>";
      }).join("");
    }

    /* The scrollytelling and reveal observers ran at DOMContentLoaded, before this markup
       existed. Without the re-scan the whole section sits invisible and unpinned. */
    document.dispatchEvent(new Event("aq:content"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
