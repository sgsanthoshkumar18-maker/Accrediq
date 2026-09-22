/* AQcredix — care bundle definitions.
 *
 * The four healthcare-associated infection bundles a ward nurse actually
 * executes, plus the shift model the audits are recorded against.
 *
 * WHERE THESE COME FROM, AND WHAT IS OURS. The bundle ELEMENTS are clinical
 * facts — "elevate the head of the bed to 30-45 degrees" has one sensible
 * phrasing and no author can fence it off. The wording below is AQcredix's
 * own throughout; the underlying interventions are those described in the
 * IHI improvement bundles, the CDC/HICPAC prevention guidelines, and the WHO
 * Global Guidelines for the Prevention of Surgical Site Infection (2016,
 * revised 2018). Each bundle carries its source so a hospital can go and read
 * the original, which is the point of citing it.
 *
 * THE ALL-OR-NONE RULE IS THE WHOLE POINT. A bundle scores 1 only when every
 * applicable element was done. Four of five is zero, not eighty percent. That
 * is what makes bundles outperform the same elements audited separately, and
 * it is the single thing paper checklists get wrong, because a human adding up
 * ticks naturally writes 4/5. The scoring in bundles.js enforces it.
 *
 * "Not applicable" is honoured and excluded from the denominator, because some
 * elements genuinely do not apply to every patient — glycaemic control in a
 * non-diabetic, for instance. An audit where EVERY element is NA is not an
 * audit and is refused.
 */
(function (root) {
  "use strict";

  var BUNDLES = [
    {
      id: "clabsi",
      name: "Central line bundle",
      short: "CLABSI",
      target: "Central venous catheter",
      blurb: "Prevents central line-associated bloodstream infection. Audited once per line, per shift.",
      source: "Interventions per IHI central line bundle and CDC/HICPAC intravascular catheter guidance.",
      nabh: ["IPC.6", "COP.8"],
      elements: [
        { id: "hh",       text: "Hand hygiene performed before handling the line" },
        { id: "barrier",  text: "Maximal barrier precautions used at insertion (cap, mask, sterile gown, sterile gloves, full drape)" },
        { id: "chg",      text: "Skin prepared with chlorhexidine and allowed to dry fully" },
        { id: "site",     text: "Optimal insertion site chosen; femoral site avoided in adults" },
        { id: "dressing", text: "Dressing clean, dry and intact; changed on schedule or when soiled" },
        { id: "hub",      text: "Hub disinfected before every access" },
        { id: "review",   text: "Continued need for the line reviewed today and documented" },
      ],
    },

    {
      id: "cauti",
      name: "Urinary catheter bundle",
      short: "CAUTI",
      target: "Indwelling urinary catheter",
      blurb: "Prevents catheter-associated urinary tract infection. Audited once per catheter, per shift.",
      source: "Interventions per IHI and CDC/HICPAC guidance on catheter-associated urinary tract infection.",
      nabh: ["IPC.6", "COP.8"],
      elements: [
        { id: "indication", text: "A valid clinical indication for the catheter is documented" },
        { id: "aseptic",    text: "Inserted using aseptic technique and sterile equipment" },
        { id: "closed",     text: "Closed drainage system intact; junction not disconnected" },
        { id: "below",      text: "Drainage bag kept below bladder level and off the floor" },
        { id: "flow",       text: "Tubing free of kinks and dependent loops; flow unobstructed" },
        { id: "meatal",     text: "Meatal hygiene performed with soap and water" },
        { id: "review",     text: "Continued need for the catheter reviewed today and documented" },
      ],
    },

    {
      id: "vap",
      name: "Ventilator bundle",
      short: "VAP",
      target: "Mechanically ventilated patient",
      blurb: "Prevents ventilator-associated pneumonia and other ventilator events. Audited once per ventilated patient, per shift.",
      source: "Interventions per IHI ventilator bundle and subsequent ventilator-associated event prevention guidance.",
      nabh: ["IPC.6", "COP.9"],
      elements: [
        { id: "hob",      text: "Head of the bed elevated to between 30 and 45 degrees" },
        { id: "sedation", text: "Daily sedation interruption performed, or a documented reason not to" },
        { id: "extubate", text: "Readiness to extubate assessed today" },
        { id: "oral",     text: "Oral care with chlorhexidine given this shift" },
        { id: "cuff",     text: "Cuff pressure checked and within the intended range" },
        { id: "pud",      text: "Peptic ulcer prophylaxis prescribed, or a documented reason not to" },
        { id: "dvt",      text: "Venous thromboembolism prophylaxis prescribed, or a documented reason not to" },
      ],
    },

    {
      id: "ssi",
      name: "Surgical site bundle",
      short: "SSI",
      target: "Surgical patient",
      blurb: "Prevents surgical site infection. Audited once per operated patient, per shift.",
      source: "Interventions per the WHO Global Guidelines for the Prevention of Surgical Site Infection (2016, rev. 2018) and CDC guidance.",
      nabh: ["IPC.7", "COP.13"],
      elements: [
        { id: "abx",      text: "Prophylactic antibiotic given within 60 minutes before incision" },
        { id: "redose",   text: "Antibiotic re-dosed for a long procedure or major blood loss, where indicated" },
        { id: "hair",     text: "Hair removed with clippers, not a razor, and only where necessary" },
        { id: "skin",     text: "Skin prepared with an alcohol-based chlorhexidine solution" },
        { id: "temp",     text: "Normothermia maintained through the perioperative period" },
        { id: "glucose",  text: "Blood glucose kept within the agreed perioperative range" },
        { id: "dressing", text: "Wound dressing handled aseptically and kept intact" },
        { id: "stop",     text: "Prophylaxis stopped within 24 hours unless a documented reason to continue" },
      ],
    },
  ];

  /* ------------------------------ shifts ------------------------------
   *
   * The nurse never picks the shift. The tool reads the clock, because the
   * point of this tool is that it takes thirty seconds at the bedside, and
   * because a shift picked from a dropdown is a shift somebody eventually
   * picks wrongly.
   *
   * Boundaries follow the ward pattern most Indian hospitals run, and the
   * one the founder specified: anything from 13:00 is the afternoon shift.
   * They are shown in the interface rather than hidden, so a nurse recording
   * at 12:55 can see why it filed as morning.
   *
   * ALL TIMES ARE IST, NOT THE DEVICE CLOCK. A tablet left on UTC, or a phone
   * a nurse brought back from a trip, would otherwise file a 9 p.m. entry as
   * the wrong shift and on the wrong date. The offset is applied explicitly
   * (see istNow in bundles.js), the same way quality-dashboard.js does it. */
  var SHIFTS = [
    { id: "morning",   label: "Morning",   from: 7,  to: 13, window: "07:00 – 12:59" },
    { id: "afternoon", label: "Afternoon", from: 13, to: 20, window: "13:00 – 19:59" },
    /* Night wraps midnight. An entry at 02:00 belongs to the night shift that
       STARTED the previous evening, so the shift stays one unit and "were all
       three shifts covered on the 14th" has an answer. bundles.js handles the
       date roll-back; the hours here describe the window only. */
    { id: "night",     label: "Night",     from: 20, to: 7,  window: "20:00 – 06:59", wraps: true },
  ];

  root.AQ_BUNDLES = BUNDLES;
  root.AQ_BUNDLE_SHIFTS = SHIFTS;
})(window);
