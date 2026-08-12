/* AQcredix — onboarding.
 *
 * A hospital signs up and lands in an empty workspace. Every engine underneath is good and
 * none of it does anything until someone enters their first committee. If setup takes ten
 * guided minutes and ends with a populated calendar, adoption follows; if it takes an
 * afternoon of blank forms, it does not, however good the engine is.
 *
 * Steps are marked done by DETECTING REAL DATA, not by ticking a box. A checklist that can
 * be completed without doing the work teaches people that the checklist is the work — which
 * is precisely the habit this platform exists to argue against.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace;
  if (!S) return;

  var state = null, counts = {};

  var STEPS = [
    { key: "team",
      title: "Add your departments and people",
      body: "Invite the department heads who will use this. Each signs in as themselves, " +
            "so every record carries who did it \u2014 which is what an assessor asks.",
      href: "team.html", cta: "Open Team",
      done: function (c) { return c.members > 1; },
      detail: function (c) { return c.members + " on the team"; } },

    { key: "committees",
      title: "Enter your committees",
      body: "Name, how often each must meet, and when each last met. Every future date is " +
            "worked out from there.",
      href: "calendar.html", cta: "Open Calendar",
      done: function (c) { return c.committees > 0; },
      detail: function (c) { return c.committees + " committees"; } },

    { key: "tasks",
      title: "Add your recurring obligations",
      body: "Drills, audits, training, surveillance \u2014 anything on a cycle an assessor " +
            "will ask about.",
      href: "calendar.html", cta: "Open Calendar",
      done: function (c) { return c.tasks > 0; },
      detail: function (c) { return c.tasks + " obligations"; } },

    { key: "assets",
      title: "Build the equipment register",
      body: "Equipment, licences and AMCs with their calibration and maintenance cycles. " +
            "Start with the items an assessor always asks about \u2014 defibrillators, " +
            "autoclaves, the fire NOC.",
      href: "register.html", cta: "Open Register",
      done: function (c) { return c.assets > 0; },
      detail: function (c) { return c.assets + " items \u00b7 " + c.schedules + " cycles"; } },

    { key: "rounds",
      title: "Set up your rounds",
      body: "Hand hygiene, cleaning, record review \u2014 any recurring check that produces " +
            "a score. Write the questions once.",
      href: "rounds.html", cta: "Open Rounds",
      done: function (c) { return c.lists > 0; },
      detail: function (c) { return c.lists + " checklists"; } },

    { key: "score",
      title: "Score your readiness",
      body: "Work through the elements chapter by chapter. You do not have to finish it " +
            "today \u2014 the score updates as you go.",
      href: "workspace.html?stay=1", cta: "Open Readiness",
      done: function (c) { return c.elements > 0; },
      detail: function (c) { return c.elements + " elements assessed"; } }
  ];

  async function load() {
    var names = ["members", "committees", "compliance_tasks", "assets",
                 "asset_schedules", "checklists", "elements"];
    var keys = ["members", "committees", "tasks", "assets", "schedules", "lists", "elements"];
    var got = await Promise.all(names.map(function (n) {
      return S.adapter.list(n).catch(function () { return []; });
    }));
    counts = {};
    keys.forEach(function (k, i) { counts[k] = (got[i] || []).length; });

    try {
      var rows = await S.adapter.list("onboarding");
      state = (rows && rows[0]) || null;
    } catch (e) { state = null; }
  }

  function progress() {
    var done = STEPS.filter(function (s) { return s.done(counts); }).length;
    return { done: done, total: STEPS.length,
             pct: Math.round((done / STEPS.length) * 100) };
  }

  function esc(s) { return W && W.esc ? W.esc(s) : String(s == null ? "" : s); }

  function render() {
    var host = document.getElementById("onboard");
    if (!host) return;

    var p = progress();

    /* Hidden once finished, or once dismissed. A setup panel that stays after setup is
       finished is clutter on the page a quality manager opens every morning. */
    if (p.done === p.total || (state && state.dismissed)) {
      host.innerHTML = "";
      host.hidden = true;
      return;
    }
    host.hidden = false;

    var next = STEPS.filter(function (s) { return !s.done(counts); })[0];

    host.innerHTML =
      '<div class="ob">' +
        '<div class="ob-top">' +
          "<div><b>Getting set up</b>" +
            '<span class="ob-sub">' + p.done + " of " + p.total +
              " done \u00b7 about " + Math.max(2, (p.total - p.done) * 2) + " minutes left</span></div>" +
          '<button class="ob-x" data-ob="dismiss" type="button" ' +
            'title="Hide this. Everything stays where it is.">\u2715</button>' +
        "</div>" +
        '<div class="ob-track"><i style="width:' + p.pct + '%"></i></div>' +
        '<div class="ob-steps">' + STEPS.map(function (s) {
          var ok = s.done(counts);
          return '<div class="ob-step' + (ok ? " is-done" : "") +
            (s === next ? " is-next" : "") + '">' +
            '<span class="ob-tick">' + (ok ? "\u2713" : "") + "</span>" +
            '<div class="ob-body"><b>' + esc(s.title) + "</b>" +
              (ok ? '<span class="ob-detail">' + esc(s.detail(counts)) + "</span>"
                  : "<span>" + esc(s.body) + "</span>") +
            "</div>" +
            (ok ? "" : '<a class="btn btn-' + (s === next ? "accent" : "ghost") +
              ' btn-sm" href="' + esc(s.href) + '">' + esc(s.cta) + "</a>") +
          "</div>";
        }).join("") + "</div>" +
      "</div>";

    host.querySelector('[data-ob="dismiss"]').addEventListener("click", dismiss);
  }

  async function dismiss() {
    var host = document.getElementById("onboard");
    if (host) { host.innerHTML = ""; host.hidden = true; }
    try {
      /* Stored per ORG, not per user: onboarding half-finished by someone who has since
         left is a common way a platform quietly stops being used, and the next person
         should not be shown a panel their colleague already dismissed. */
      await S.adapter.upsert("onboarding", {
        org_id: (W.user && W.user.org_id) || null,
        dismissed: true,
        updated_at: new Date().toISOString()
      });
    } catch (e) {}
  }

  async function init() {
    if (!document.getElementById("onboard")) return;
    await load();
    render();
  }

  document.addEventListener("aq:ready", init);
  if (window.AQWorkspace && window.AQWorkspace.user) init();

  window.AQOnboard = { STEPS: STEPS, progress: function () { return progress(); } };
})();
