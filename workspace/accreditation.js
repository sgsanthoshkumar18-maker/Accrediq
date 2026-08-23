/* AQcredix — where the hospital is in the accreditation cycle.
 *
 * NABH is not an event. It is a loop: application, desktop review, pre-assessment, final
 * assessment, accreditation, surveillance at around eighteen months, then re-accreditation
 * at three years. The calendar here already tracked committee meetings and equipment
 * renewals, but not the accreditation itself — so the question a quality manager is asked
 * most often by their director, "when is the next one", had no answer on this platform.
 *
 * ONE ROW PER HOSPITAL. A hospital is at one point in one cycle. Modelling this as a list
 * of records invites two rows that disagree about the certificate expiry, and then the
 * page has to decide which is right — which it cannot.
 *
 * NOTHING IS INFERRED THAT THE HOSPITAL HAS NOT ENTERED. The surveillance date is
 * SUGGESTED from the accreditation date because the interval is well known, but it is
 * offered as a default in a field the user can overwrite, never written silently. NABH
 * schedules the actual visit, and a platform that quietly invented a date a hospital then
 * planned around would be doing real harm.
 */
(function () {
  "use strict";

  var W = window.AQWorkspace, S = window.AQStore;
  if (!W || !S) return;

  var TABLE = "accreditation";
  var rec = null;
  var esc;

  var DAY = 86400000;

  /* The stages in order, with what each one actually means. The descriptions are here
     because "desktop review" means nothing to a first-timer, and this page is most useful
     to exactly that person. */
  var STAGES = [
    ["preparing",            "Preparing",            "Building the evidence. Nothing submitted yet."],
    ["applied",              "Applied",              "Application lodged with NABH."],
    ["desktop_review",       "Desktop review",       "NABH is reviewing the submitted documents."],
    ["pre_assessment",       "Pre-assessment",       "The first on-site visit. Findings to close before the final."],
    ["final_assessment",     "Final assessment",     "The full on-site assessment."],
    ["accredited",           "Accredited",           "Certificate held and in date."],
    ["surveillance_due",     "Surveillance due",     "The mid-cycle visit is approaching or overdue."],
    ["re_accreditation_due", "Re-accreditation due", "The certificate is nearing expiry."],
    ["lapsed",               "Lapsed",               "The certificate has expired."]
  ];
  function stageLabel(k) {
    var h = STAGES.filter(function (s) { return s[0] === k; })[0];
    return h ? h[1] : (k || "—");
  }
  function stageDesc(k) {
    var h = STAGES.filter(function (s) { return s[0] === k; })[0];
    return h ? h[2] : "";
  }

  function fmtDate(d) {
    if (!d) return null;
    var x = new Date(d);
    return isNaN(x) ? null : x.toLocaleDateString("en-IN",
      { day: "2-digit", month: "short", year: "numeric" });
  }
  function daysTo(d) {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / DAY);
  }
  function plural(n, w) { return n + " " + w + (Math.abs(n) === 1 ? "" : "s"); }

  /* ------------------------------------------------------------------ *
   * The one line that matters. A quality manager opening this page wants
   * a single sentence they can repeat to their director, not a table.
   * ------------------------------------------------------------------ */
  function nextDue() {
    if (!rec) return null;
    var candidates = [
      { when: rec.desktop_review_on,   what: "Desktop review" },
      { when: rec.pre_assessment_on,   what: "Pre-assessment" },
      { when: rec.final_assessment_on, what: "Final assessment" },
      { when: rec.surveillance_due,    what: "Surveillance assessment" },
      { when: rec.accredited_until,    what: "Certificate expires" }
    ].filter(function (c) { return c.when; })
     .map(function (c) { c.days = daysTo(c.when); return c; })
     .filter(function (c) { c.days = daysTo(c.when); return c.days !== null; })
     .sort(function (a, b) { return a.days - b.days; });

    /* OVERDUE ALWAYS WINS, and the first version of this got it backwards.
     *
     * It picked the soonest date still ahead, which meant a surveillance assessment
     * twenty days overdue was silently passed over in favour of a certificate expiring in
     * four hundred — the page reassuring a hospital about next year while this year's
     * obligation sat unmet. An overdue assessment is the single most important fact this
     * page can show, so anything in the past is surfaced before anything in the future,
     * and the one overdue longest comes first. */
    var overdue = candidates.filter(function (c) { return c.days < 0; });
    if (overdue.length) return overdue[0];          // already sorted ascending: most overdue
    return candidates.length ? candidates[0] : null;
  }

  function renderHero() {
    var host = document.getElementById("acHero");
    if (!rec) {
      host.innerHTML =
        '<div class="ac-hero none"><h2>Not set up yet</h2>' +
        "<p>Fill in what you know below — even just the stage. Everything else can be " +
        "added as it happens.</p></div>";
      return;
    }

    var due = nextDue();
    var line, cls = "";
    if (!due) {
      line = "No dates entered yet.";
    } else if (due.days < 0) {
      cls = "bad";
      line = "<b>" + esc(due.what) + "</b> was due " + plural(Math.abs(due.days), "day") + " ago";
    } else if (due.days <= 90) {
      cls = "warn";
      line = "<b>" + esc(due.what) + "</b> in " + plural(due.days, "day") +
             " &mdash; " + esc(fmtDate(due.when));
    } else {
      cls = "ok";
      line = "<b>" + esc(due.what) + "</b> in " + plural(due.days, "day") +
             " &mdash; " + esc(fmtDate(due.when));
    }

    host.innerHTML =
      '<div class="ac-hero ' + cls + '">' +
        '<span class="eyebrow">' + esc(rec.programme || "NABH") +
          (rec.edition ? " &middot; " + esc(rec.edition) : "") + "</span>" +
        "<h2>" + esc(stageLabel(rec.stage)) + "</h2>" +
        '<p class="ac-desc">' + esc(stageDesc(rec.stage)) + "</p>" +
        '<p class="ac-next">' + line + "</p>" +
        (rec.certificate_no
          ? '<p class="ac-cert">Certificate ' + esc(rec.certificate_no) + "</p>" : "") +
      "</div>";
  }

  function renderTimeline() {
    var host = document.getElementById("acTimeline");
    if (!rec) { host.innerHTML = ""; return; }

    var steps = [
      ["Applied",            rec.applied_on],
      ["Desktop review",     rec.desktop_review_on],
      ["Pre-assessment",     rec.pre_assessment_on],
      ["Final assessment",   rec.final_assessment_on],
      ["Accredited from",    rec.accredited_from],
      ["Surveillance due",   rec.surveillance_due],
      ["Certificate expires", rec.accredited_until]
    ];

    host.innerHTML =
      '<div class="ac-timeline">' +
      steps.map(function (s) {
        var d = s[1], days = daysTo(d);
        var st = !d ? "empty" : days < 0 ? "past" : days <= 90 ? "soon" : "future";
        return '<div class="ac-step ' + st + '">' +
          '<span class="ac-dot" aria-hidden="true"></span>' +
          '<div><b>' + esc(s[0]) + "</b>" +
          '<span class="ac-when">' + (d ? esc(fmtDate(d)) : "not set") +
            (d && days >= 0 && days <= 365 ? " &middot; in " + plural(days, "day") : "") +
            (d && days < 0 ? " &middot; " + plural(Math.abs(days), "day") + " ago" : "") +
          "</span></div></div>";
      }).join("") + "</div>";
  }

  function renderForm() {
    var host = document.getElementById("acForm");
    var r = rec || {};
    host.innerHTML =
      '<div class="ac-editor"><h3>Update the cycle</h3>' +
      '<form id="acF" class="ws-form">' +
        '<div class="ws-f"><label>Stage</label><select name="stage">' +
          STAGES.map(function (s) {
            return '<option value="' + s[0] + '"' +
              (r.stage === s[0] ? " selected" : "") + ">" + esc(s[1]) + "</option>";
          }).join("") + "</select></div>" +
        fld("Programme", "programme", "text", r.programme || "NABH Hospital (Full)") +
        fld("Edition", "edition", "text", r.edition || "6th Edition") +
        fld("Certificate number", "certificate_no", "text", r.certificate_no) +
        fld("Applied on", "applied_on", "date", r.applied_on) +
        fld("Desktop review", "desktop_review_on", "date", r.desktop_review_on) +
        fld("Pre-assessment", "pre_assessment_on", "date", r.pre_assessment_on) +
        fld("Final assessment", "final_assessment_on", "date", r.final_assessment_on) +
        fld("Accredited from", "accredited_from", "date", r.accredited_from) +
        fld("Certificate expires", "accredited_until", "date", r.accredited_until) +
        fld("Surveillance due", "surveillance_due", "date", r.surveillance_due) +
        '<p class="ws-f-wide ac-hint">Entering <b>accredited from</b> offers a surveillance date ' +
          "eighteen months later and an expiry three years later, as a suggestion you can " +
          "overwrite. NABH sets the real dates &mdash; these are only so the page has " +
          "something to count down to before the letter arrives.</p>" +
        '<div class="ws-f-wide ws-modal-actions"><button type="submit" class="btn btn-accent">Save</button></div>' +
      "</form></div>";

    /* Suggest, never impose. Filling an empty field is a help; overwriting one the user
       has already typed would be the platform second-guessing them about their own
       hospital's dates. */
    var from = host.querySelector('[name="accredited_from"]');
    from.addEventListener("change", function () {
      if (!this.value) return;
      var surv = host.querySelector('[name="surveillance_due"]');
      var till = host.querySelector('[name="accredited_until"]');
      var d = new Date(this.value);
      if (!surv.value) {
        var s = new Date(d); s.setMonth(s.getMonth() + 18);
        surv.value = s.toISOString().slice(0, 10);
      }
      if (!till.value) {
        var t = new Date(d); t.setFullYear(t.getFullYear() + 3);
        till.value = t.toISOString().slice(0, 10);
      }
    });

    document.getElementById("acF").addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var out = Object.assign({}, rec || {});
      ["stage", "programme", "edition", "certificate_no", "applied_on", "desktop_review_on",
       "pre_assessment_on", "final_assessment_on", "accredited_from", "accredited_until",
       "surveillance_due"].forEach(function (k) {
        var v = (fd.get(k) || "").toString().trim();
        out[k] = v === "" ? null : v;
      });
      try {
        /* org_id is filled by the database default from my_org(); sending it from the
           browser would be an assertion the client is not entitled to make. */
        await S.adapter.put(TABLE, out);
        await refresh();
      } catch (err) {
        alert("Could not save: " + (err && err.message || err));
      }
    });
  }

  function fld(label, name, type, val) {
    return '<div class="ws-f"><label>' + esc(label) + "</label>" +
      '<input type="' + type + '" name="' + name + '" value="' +
      esc(val == null ? "" : val) + '"></div>';
  }

  async function refresh() {
    try {
      var list = await S.adapter.list(TABLE) || [];
      rec = list[0] || null;
    } catch (e) {
      document.getElementById("acHero").innerHTML =
        '<div class="ac-hero none"><h2>Could not load</h2><p>' +
        esc(String(e && e.message || e)) + "</p></div>";
      return;
    }
    renderHero(); renderTimeline(); renderForm();
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("accreditation");
    if (W.renderModeNotice) W.renderModeNotice();
    await refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
