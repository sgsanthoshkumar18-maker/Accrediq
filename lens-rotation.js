/* AQcredix — the standards that rotate through the homepage scrollytelling card.
 *
 * WHY A CURATED LIST RATHER THAN ALL 640 ELEMENTS.
 * The card shows three things: the standard, what an assessor looks for, and the gap that
 * becomes a Non-Conformity. Only the first can be generated — it is the verbatim text and
 * it is pulled from nabh-data.js at render time, so it can never drift from the book. The
 * other two are professional judgement about how an assessor behaves, and inventing them
 * for all 640 elements would put confident, unverified guidance in front of hospitals
 * preparing for assessment. That is the one failure mode this platform cannot afford.
 * So this file carries a hand-written set, and grows when there is something true to add.
 *
 * `code` must exist in nabh-data.js. A code that does not resolve is dropped at render
 * time rather than shown with an empty quotation.
 */
window.LENS_ROTATION = [

  { code: "IPC.2.c",
    topic: "Hand hygiene",
    looks: [
      "Sinks, soap and alcohol rub within reach at the point of care — not down the corridor",
      "Your own compliance audit: numbers, not an assertion",
      "Staff stopped at random and asked to name the five moments",
      "Training records that match the current duty roster"
    ],
    gap: "The audit exists but stops at 60% compliance with no action recorded against it.",
    fix: "Raise it as a finding, assign a department owner, re-audit, and file the second set " +
         "of numbers beside the first. That second audit is the evidence — the first one " +
         "on its own is only the finding." },

  { code: "COP.14.d",
    topic: "Wrong-site surgery",
    looks: [
      "A completed surgical safety checklist in the file, not a blank pro forma",
      "The site marked before the patient leaves the ward, by the operating surgeon",
      "A time-out documented with the names of who was present",
      "What happened the last time a discrepancy was found at time-out"
    ],
    gap: "Checklists are signed at the end of the list, in a batch, after the cases are done.",
    fix: "Sign each section at the moment it happens. An assessor who sees identical " +
         "handwriting and one timestamp across eight cases has found a retrospective record, " +
         "and a retrospective safety check protects nobody." },

  { code: "MOM.6.a",
    topic: "Safe dispensing",
    looks: [
      "Look-alike and sound-alike drugs physically separated and labelled",
      "High-alert medications stored apart, with independent double-checks recorded",
      "Expiry checks with a documented frequency and a named person",
      "What was done after the last dispensing error — not just that it was logged"
    ],
    gap: "The LASA list exists on paper but the shelves are still alphabetical, so the two " +
         "look-alikes sit side by side.",
    fix: "Walk the shelf against the list. The document is not the control — the physical " +
         "separation is. An assessor checks the shelf, not the folder." },

  { code: "PRE.4.a",
    topic: "Informed consent",
    looks: [
      "Consent taken by someone who can actually explain the procedure",
      "Risks, benefits and alternatives written in, not pre-printed and ticked",
      "The language the patient understands, and who interpreted if they did not",
      "Consent dated and timed before sedation, not after"
    ],
    gap: "The consent form is complete but signed after the pre-medication was given.",
    fix: "Consent must precede sedation, and the times on the two records have to show it. " +
         "This is one an assessor can find in sixty seconds by comparing two timestamps." },

  { code: "COP.16.a",
    topic: "Vulnerable patients",
    looks: [
      "A definition of vulnerable that your own staff can state",
      "Identification happening at admission, visible in the record",
      "The extra measures actually in place for those patients",
      "Elderly, paediatric, disabled and unconscious patients all covered"
    ],
    gap: "The policy names five vulnerable groups; the assessment form has one tick-box marked " +
         "“vulnerable: yes/no”.",
    fix: "Make the form carry the same categories as the policy, and make the care plan change " +
         "when the box is ticked. An identification that changes nothing is not identification." },

  { code: "IMS.1.a",
    topic: "Information needs",
    looks: [
      "Who was asked, and when — patients, staff, management, regulators",
      "The information plan that came out of asking",
      "Evidence it was reviewed, not written once and filed",
      "Data actually reaching the people who make decisions with it"
    ],
    gap: "The information plan was written for the last assessment and has not been reviewed " +
         "since.",
    fix: "Review it against what your departments genuinely need now, and record the review. " +
         "A three-year-old plan tells an assessor the system is dormant." },

  { code: "PSQ.1.a",
    topic: "Patient safety programme",
    looks: [
      "A multi-disciplinary group — not the quality department alone",
      "Minutes showing decisions, not attendance",
      "Incidents that changed something, traced end to end",
      "Leadership present in the room, on the record"
    ],
    gap: "The committee meets and records attendance, but no minute shows a decision that " +
         "changed practice.",
    fix: "Minute the decision, the owner and the date, then close it at the next meeting. " +
         "An assessor reads minutes for outcomes; attendance alone reads as a formality." },

  { code: "MOM.4.a",
    topic: "Rational prescribing",
    looks: [
      "Prescriptions legible, with generic names, dose, route and frequency",
      "The antibiotic policy followed — and the deviations justified in writing",
      "Prescription audits with findings fed back to prescribers",
      "Verbal orders countersigned within a defined time"
    ],
    gap: "Prescription audits are done and filed, but no prescriber has ever been shown their " +
         "own data.",
    fix: "Feed the findings back by name and re-audit. An audit nobody sees changes no " +
         "prescribing, and an assessor will ask what changed." },

  { code: "PRE.1.a",
    topic: "Patient rights",
    looks: [
      "Rights displayed in the languages your patients actually speak",
      "Staff able to say what the rights are when asked",
      "The grievance route visible to a patient standing in the corridor",
      "Complaints closed with a response to the complainant"
    ],
    gap: "The rights charter is displayed in English only, in a hospital where most patients " +
         "read Tamil.",
    fix: "Display it in the languages of the population you serve. A right the patient cannot " +
         "read has not been made known to them, which is what the element actually requires." },

  { code: "COP.5.a",
    topic: "Resuscitation",
    looks: [
      "Crash cart contents checked against a list, with the check signed and dated",
      "Defibrillator tested, with the test strip retained",
      "Staff trained in BLS across every shift, including nights",
      "Code blue response times recorded and reviewed"
    ],
    gap: "The crash cart checklist is signed daily but the defibrillator test strips stop three " +
         "months ago.",
    fix: "Test and retain the strip. A signed checklist covering an untested defibrillator is " +
         "worse than no checklist — it documents an assurance that was never carried out." },

  { code: "COP.1.a",
    topic: "Uniform care",
    looks: [
      "The same clinical protocol applied regardless of who is paying",
      "Written guidance that staff on the floor can produce when asked",
      "Care of the same condition compared across units",
      "Deviations from protocol explained in the record"
    ],
    gap: "Written protocols exist centrally, but ward staff cannot find them when asked.",
    fix: "Put them where care happens and check that staff can retrieve them. An assessor " +
         "asks the nurse, not the quality manager." },

  { code: "MOM.1.a",
    topic: "Medication management",
    looks: [
      "Written guidance covering procurement through to administration",
      "Storage conditions monitored, with temperature logs that have gaps explained",
      "Narcotics accounted for, with a register that balances",
      "Recalls actioned and documented"
    ],
    gap: "Refrigerator temperature logs are complete except for Sundays, every week, for months.",
    fix: "Cover the gap with a named person on every shift. A pattern of absence is more " +
         "damaging than a single missed reading, because it shows the control is unstaffed " +
         "rather than occasionally missed." },

  { code: "HRM.5.a",
    topic: "Transfusion training",
    looks: [
      "Training records for everyone who handles blood, not only the blood bank",
      "Competence assessed, not just attendance recorded",
      "Transfusion reactions reported, investigated and closed",
      "The bedside check demonstrated on request"
    ],
    gap: "The blood bank staff are trained; the ward nurses who actually hang the unit are not " +
         "on the register.",
    fix: "Train and record everyone in the chain. The bedside check is the last barrier before " +
         "a wrong-patient transfusion, and it is performed on the ward." },

  { code: "IMS.4.a",
    topic: "Medical records",
    looks: [
      "Reason for admission, diagnosis and care plan present in every file sampled",
      "Entries dated, timed and signed with a legible identity",
      "Record review happening on a defined cycle, with findings acted on",
      "Records retrievable within the time your own policy states"
    ],
    gap: "Record review is done monthly, and the same three deficiencies appear every month.",
    fix: "A finding that recurs unchanged shows review without corrective action. Assign each " +
         "deficiency an owner and re-sample specifically for it." },

  { code: "ROM.1.a",
    topic: "Governance",
    looks: [
      "Who governs, named, with documented responsibilities",
      "Evidence they exercise those responsibilities — minutes, approvals, decisions",
      "Quality reports reaching the governing body",
      "Resources committed on the record"
    ],
    gap: "Roles are documented but there is no record of the governing body acting on a quality " +
         "report.",
    fix: "Minute what the governing body was shown and what it decided. Documented " +
         "responsibility without documented action is the most common finding at this level." }
];
