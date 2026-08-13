/* AQcredix — our own summary of each Objective Element.
 *
 * WHY THIS FILE EXISTS.
 * `nabh-data.js` holds wording close to the published NABH standard. That text is NABH's
 * copyright: it was free to READ on their site, which was never permission to reproduce it
 * in a commercial product, and since the standards moved behind a paywall the exposure is
 * both larger and more likely to be noticed.
 *
 * There is a second reason that matters more. Where that wording came from is not certain,
 * and text reproduced from memory can be subtly wrong — a "shall" for a "should", a
 * dropped clause. For a platform hospitals use to prepare for assessment, INACCURATE
 * standard text is worse than copied standard text: one is a legal problem, the other can
 * cause a hospital to fail an element.
 *
 * So the site shows a summary written by Dr Santhoshkumar, and points to the published
 * standard as the authority. That is safer, and it is also the better product — the whole
 * argument for AQcredix is that the book is hard to read.
 *
 * HOW TO USE THIS FILE
 *   summary   what the element requires, in his own words. Plain English, not a reworded
 *             copy: read the element, close the book, write what a hospital must do.
 *   reviewed  true only once he has checked it against the published standard he has
 *             legitimate access to. Anything false is treated as not ready and the site
 *             falls back to showing the code and chapter alone.
 *
 * Adding an entry is one object. `standards.html` and the lens card prefer the summary
 * whenever `reviewed` is true.
 */
window.NABH_SUMMARY = {

  /* ---------------------------------------------------------------------------
     WORKED EXAMPLES — the pattern to follow.
     Each is written from the requirement, not by shuffling the original's words.
     All are marked reviewed:false until Dr Santhoshkumar has checked them against the
     published standard. Nothing here should go live unreviewed.
     --------------------------------------------------------------------------- */

  "AAC.1.a": {
    summary: "Write down which clinical services you actually offer, and be able to show " +
             "that the list reflects what your community needs rather than what you wish " +
             "you offered.",
    reviewed: false
  },

  "AAC.1.b": {
    summary: "Every service you claim to provide must have the diagnostics, the treatment " +
             "capability and the qualified staff behind it — across out-patient, " +
             "in-patient, day-care and emergency.",
    reviewed: false
  },

  "COP.1.a": {
    summary: "Patients with the same condition should receive the same standard of care " +
             "wherever they are treated, and there must be written guidance that says so.",
    reviewed: false
  },

  "COP.1.b": {
    summary: "Identify every patient using at least two identifiers, the same way in every " +
             "department. Neither may be the bed or room number.",
    reviewed: false
  },

  "IPC.1.a": {
    summary: "Have a written infection prevention and control programme whose stated " +
             "purpose is reducing healthcare-associated infection — not a policy file, a " +
             "programme with objectives you measure against.",
    reviewed: false
  },

  "IPC.1.b": {
    summary: "Identify the activities in your hospital that carry the highest infection " +
             "risk, and write specific guidance for each of them.",
    reviewed: false
  },

  "IPC.2.c": {
    summary: "Hand-hygiene facilities must be available where care actually happens — rub " +
             "at the bedside, not soap at the end of the corridor — and staff must be able " +
             "to reach them without leaving the patient.",
    reviewed: false
  },

  "MOM.1.a": {
    summary: "Run the pharmacy and manage medicines according to written guidance that " +
             "covers the whole path: purchase, storage, prescribing, dispensing and " +
             "administration.",
    reviewed: false
  },

  "MOM.1.b": {
    summary: "A committee with members from more than one discipline decides how medication " +
             "management works and checks that it is being followed.",
    reviewed: false
  },

  "COP.5.a": {
    summary: "Resuscitation must be available throughout the hospital at all times, with " +
             "equipment that has been checked and staff on every shift who are trained to " +
             "use it.",
    reviewed: false
  },

  "PRE.4.a": {
    summary: "Consent is taken by someone who can explain the procedure, before any " +
             "sedation, in language the patient understands — and the risks, benefits and " +
             "alternatives are written down, not pre-printed.",
    reviewed: false
  },

  "PSQ.1.a": {
    summary: "The patient safety programme is built and run by a group drawn from across " +
             "the hospital, not by the quality department alone, and its decisions are " +
             "recorded.",
    reviewed: false
  },

  "ROM.1.a": {
    summary: "Name the people responsible for governing the hospital and write down what " +
             "each is accountable for. An assessor will then look for evidence they " +
             "exercised it.",
    reviewed: false
  },

  "IMS.1.a": {
    summary: "Ask the people who need information — clinicians, managers, regulators, " +
             "patients — what they need, and build your information plan from the answers.",
    reviewed: false
  },

  "MOM.4.a": {
    summary: "Prescriptions must be legible, use generic names, and state dose, route and " +
             "frequency. Audit them, and feed what you find back to the prescribers by name.",
    reviewed: false
  },

  "COP.14.d": {
    summary: "Mark the surgical site before the patient leaves the ward, with the operating " +
             "surgeon doing the marking, and record the time-out with who was present.",
    reviewed: false
  },

  "COP.16.a": {
    summary: "Define who counts as vulnerable in your hospital, identify them at admission, " +
             "and make sure the identification changes the care plan rather than only " +
             "ticking a box.",
    reviewed: false
  },

  "PRE.1.a": {
    summary: "Display patient rights in the languages your patients actually read, and make " +
             "sure staff can state them when asked.",
    reviewed: false
  },

  "HRM.5.a": {
    summary: "Everyone in the transfusion chain must be trained and assessed as competent — " +
             "including the ward nurses who hang the unit, not only blood bank staff.",
    reviewed: false
  },

  "IMS.4.a": {
    summary: "Every medical record must carry the reason for admission, the diagnosis and " +
             "the care plan, with entries dated, timed and signed by an identifiable person.",
    reviewed: false
  },

  "MOM.6.a": {
    summary: "Dispense medicines safely: look-alike and sound-alike drugs physically " +
             "separated, high-alert medicines stored apart with an independent double-check " +
             "recorded.",
    reviewed: false
  },

  "FMS.5.a": {
    summary: "Have plans for fire and other emergencies, train staff against them, and run " +
             "drills often enough that people know what to do without reading the plan.",
    reviewed: false
  }
};

/* ---------------------------------------------------------------------------
   Helper used by the pages. Returns the summary only when it has been reviewed, so an
   unfinished entry can never reach a hospital as though it were checked.
   --------------------------------------------------------------------------- */
window.NABH_SUMMARY_GET = function (code) {
  var s = window.NABH_SUMMARY && window.NABH_SUMMARY[code];
  if (!s || !s.reviewed || !s.summary) return null;
  return s.summary;
};

/* ---------------------------------------------------------------------------
   THE ACCESSOR EVERY PAGE SHOULD USE.

   Rather than editing twenty files to check for a summary, each one calls this. It
   returns our own words when they exist and have been reviewed, and the stored wording
   otherwise — so migration can proceed element by element without the site breaking, and
   without an unreviewed draft ever reaching a hospital.

   `AQText.isOwn(code)` tells a caller whether what it received is ours, which is what the
   attribution line under each element keys on.
   --------------------------------------------------------------------------- */
window.AQText = (function () {
  "use strict";

  function own(code) {
    var s = window.NABH_SUMMARY && window.NABH_SUMMARY[code];
    return !!(s && s.reviewed && s.summary);
  }

  return {
    isOwn: own,

    /* code: "IPC.2.c", fallback: the stored wording from nabh-data.js */
    element: function (code, fallback) {
      var s = window.NABH_SUMMARY && window.NABH_SUMMARY[code];
      if (s && s.reviewed && s.summary) return s.summary;
      return fallback || "";
    },

    /* One line to print beneath an element, so a reader always knows which they are
       looking at. Saying "our summary" plainly is more honest than a quiet swap, and it
       is the sentence that makes the paraphrase defensible rather than furtive. */
    note: function (code) {
      return own(code)
        ? "AQcredix summary. The published NABH standard is the authority."
        : "Refer to the published NABH standard for the exact wording.";
    },

    /* Progress, for the review tool and for knowing when the migration is finished. */
    coverage: function (codes) {
      var n = 0;
      (codes || []).forEach(function (c) { if (own(c)) n++; });
      return { done: n, total: (codes || []).length };
    }
  };
})();
