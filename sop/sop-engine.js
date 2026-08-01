/* AQcredix — Smart SOP generator engine
 *
 * HOW IT WORKS (and what it is not):
 * This is a deterministic, rules-based generator, not a large language model.
 * It reads the user's plain-English topic, matches it against the REAL text of
 * all 639 NABH 6th-edition Objective Elements loaded from nabh-data.js, picks
 * the standards that genuinely apply, and composes an SOP around them using
 * the standard NABH document structure.
 *
 * Every "Reference Standards" row is a real element code with its real book
 * text. Nothing in that section is invented. The procedural steps are drawn
 * from a curated topic library where one exists, and otherwise fall back to a
 * generic-but-honest skeleton the user is told to complete.
 */
window.SopEngine = (function () {

  const STOPWORDS = new Set(["sop","for","the","a","an","of","and","to","in","on","at","is","are",
    "how","what","need","want","make","create","write","please","hospital","procedure","policy","my","our"]);

  // Synonym expansion so everyday phrasing reaches the book's formal wording.
  const SYNONYMS = {
    fridge: ["refrigerat", "cold chain", "storage", "temperature"],
    refrigerator: ["refrigerat", "cold chain", "storage", "temperature"],
    freezer: ["refrigerat", "storage", "temperature"],
    temperature: ["temperature", "storage", "monitor"],
    vaccine: ["vaccin", "immunis", "immuniz", "cold chain", "storage"],
    medicine: ["medication", "drug", "pharmac"],
    medication: ["medication", "drug", "pharmac", "prescri", "dispens", "administ"],
    drug: ["medication", "drug", "narcotic", "pharmac"],
    handwash: ["hand hygiene", "hand-wash"],
    handwashing: ["hand hygiene"],
    handhygiene: ["hand hygiene"],
    infection: ["infection", "hygiene", "steril", "disinfect"],
    waste: ["waste", "biomedical", "segregat", "disposal"],
    biomedical: ["biomedical", "waste", "equipment"],
    fire: ["fire", "emergency", "evacuat", "safety"],
    consent: ["consent", "inform"],
    discharge: ["discharge", "summary"],
    admission: ["admission", "registration"],
    triage: ["triage", "emergency"],
    blood: ["blood", "transfusion", "donor"],
    laundry: ["linen", "laundry"],
    linen: ["linen", "laundry"],
    housekeeping: ["cleaning", "housekeep", "waste", "hygiene"],
    cleaning: ["cleaning", "disinfect", "hygiene"],
    sterilisation: ["steril", "disinfect", "autoclav"],
    sterilization: ["steril", "disinfect", "autoclav"],
    cssd: ["steril", "disinfect"],
    equipment: ["equipment", "maintenance", "calibrat"],
    maintenance: ["maintenance", "equipment", "preventive"],
    calibration: ["calibrat", "equipment"],
    training: ["training", "orientation", "competen"],
    credentialing: ["credential", "privileg"],
    incident: ["incident", "adverse", "near miss", "sentinel"],
    audit: ["audit", "quality", "monitor"],
    record: ["record", "document", "medical record"],
    documentation: ["document", "record"],
    restraint: ["restrain"],
    fall: ["fall"],
    pain: ["pain"],
    nutrition: ["nutrition", "diet"],
    ambulance: ["ambulance", "transport"],
    oxygen: ["gas", "oxygen", "medical gas"],
    radiation: ["radiation", "imaging"],
    imaging: ["imaging", "radiation"],
    laboratory: ["laborator", "specimen", "sample"],
    lab: ["laborator", "specimen"],
    antibiotic: ["antimicrobial", "antibiotic"],
    security: ["security", "safe", "violence"],
    grievance: ["grievance", "complaint", "feedback"]
  };

  function tokenize(text) {
    return String(text || "").toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  function expandTerms(tokens) {
    const terms = new Set();
    tokens.forEach(t => {
      terms.add(t);
      if (SYNONYMS[t]) SYNONYMS[t].forEach(s => terms.add(s));
      // crude stem so "monitoring" reaches "monitor"
      if (t.length > 5) terms.add(t.slice(0, t.length - 3));
    });
    return [...terms];
  }

  /** Score every real NABH element against the topic; return the best matches. */
  function matchElements(topic, deptChapter, limit = 12) {
    if (!window.NABH_DATA) return [];
    const terms = expandTerms(tokenize(topic));
    if (!terms.length) return [];

    // Short terms must match on a word boundary, otherwise "hand" matches
    // "handled" and "lab" matches "labelled" — which produced clearly wrong
    // references. Longer terms are treated as stems and may match a prefix.
    const matchers = terms.map(t => ({
      term: t,
      re: t.length <= 5
        ? new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i")
        : new RegExp("\\b" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      weight: t.length > 6 ? 3 : 2
    }));

    const out = [];
    Object.entries(window.NABH_DATA.chapters).forEach(([code, ch]) => {
      ch.standards.forEach(std => {
        std.elements.forEach(el => {
          const hay = std.text + " " + el.text;
          let score = 0, hits = 0;
          matchers.forEach(m => { if (m.re.test(hay)) { score += m.weight; hits++; } });
          if (!hits) return;                       // must genuinely match at least one term
          // Bonuses only apply on top of a real textual match, never instead of one.
          if (deptChapter && code === deptChapter) score += 3;
          if (el.sop) score += 4;
          if (el.category === "CORE") score += 2;
          out.push({
            chapter: code, code: `${std.code}.${el.letter}`,
            standardText: std.text, text: el.text,
            category: el.category, sop: !!el.sop, score, hits
          });
        });
      });
    });

    // Prefer elements that matched more distinct terms, then raw score.
    out.sort((a, b) => (b.hits - a.hits) || (b.score - a.score));
    return out.slice(0, limit);
  }

  // Curated procedural content for common SOP topics. Where a topic isn't
  // covered, the SOP still generates but flags the steps as a skeleton to
  // complete — rather than inventing clinical detail.
  const TOPIC_LIBRARY = [
    {
      match: /fridge|refrigerat|freezer|cold.?chain|vaccine storage|temperature (monitor|log)/i,
      title: "Refrigerator and Cold-Chain Temperature Monitoring",
      purpose: "To define a uniform process for monitoring, recording and responding to temperature excursions in refrigerators and freezers used to store medications, vaccines, reagents and other temperature-sensitive items, so that product integrity and patient safety are maintained at all times.",
      scope: "All refrigerators, freezers and cold-chain equipment used to store medications, vaccines, blood components, laboratory reagents and nutritional products across the organisation.",
      definitions: [
        "Cold chain — the uninterrupted series of storage and distribution activities that maintain a defined temperature range.",
        "Temperature excursion — any recorded temperature outside the defined acceptable range for that unit.",
        "Continuous monitoring device — a data logger or sensor that records temperature at set intervals without manual intervention."
      ],
      steps: [
        "Assign every refrigerator/freezer a unique identification number and display it on the unit.",
        "Define and label the acceptable temperature range on each unit (commonly +2 °C to +8 °C for vaccines and most refrigerated medicines; consult the manufacturer's insert for each product).",
        "Place a calibrated thermometer or continuous data logger in the central zone of each unit, not against the wall or on the door shelf.",
        "Record the temperature at the start of each shift, or at a minimum twice in 24 hours, on the designated temperature log.",
        "The person recording must sign or initial each entry with the date and time.",
        "If a reading falls outside the acceptable range, do not use the stored items; quarantine them, label them 'DO NOT USE — under review', and inform the department in-charge immediately.",
        "Escalate the excursion to the Pharmacist / Infection Control / Quality department as applicable, and record it as an incident.",
        "Assess the affected stock for usability in consultation with the manufacturer or pharmacist, and document the disposition decision (retain, return or discard).",
        "Take corrective action on the equipment (servicing, repair or replacement) and record it in the maintenance log.",
        "Review completed temperature logs at a defined frequency and retain them per the organisation's record-retention policy.",
        "Verify thermometer and data-logger calibration at the defined periodic interval and retain calibration certificates.",
        "Ensure an alternate storage arrangement and a documented power-failure contingency exists for each critical unit."
      ],
      responsibilities: [
        ["Department in-charge / Nurse in-charge", "Ensures temperatures are recorded every shift and logs are complete and signed."],
        ["Pharmacist", "Reviews logs periodically, decides on the disposition of affected stock during an excursion."],
        ["Biomedical / Maintenance Engineer", "Maintains, services and calibrates the units; responds to breakdown calls."],
        ["Infection Control / Quality", "Reviews excursion incidents and tracks corrective and preventive action."]
      ],
      records: [
        "Refrigerator / Freezer Temperature Log (per unit, per shift)",
        "Temperature Excursion / Incident Report",
        "Thermometer and Data-Logger Calibration Certificates",
        "Preventive Maintenance Record for each unit",
        "Stock Disposition Record following an excursion"
      ],
      flowchart: [
        "Record temperature at start of shift",
        "Is reading within the defined range?",
        "YES → Sign the log and continue",
        "NO → Quarantine stock and label 'DO NOT USE'",
        "Inform department in-charge and pharmacist",
        "Raise an incident report",
        "Assess stock usability and record the decision",
        "Repair / service the unit and log the action",
        "Review at the quality committee and close the CAPA"
      ]
    },
    {
      match: /hand hygiene|handwash|hand wash/i,
      title: "Hand Hygiene",
      purpose: "To define the process for hand hygiene at every point of patient care so as to prevent and reduce healthcare-associated infection.",
      scope: "All clinical and non-clinical staff, students, visitors and contract personnel in every patient-care area.",
      definitions: [
        "WHO Five Moments — the five defined occasions on which hand hygiene must be performed during patient care.",
        "Hand rub — alcohol-based formulation applied to dry hands.",
        "Hand wash — cleansing with soap and running water."
      ],
      steps: [
        "Perform hand hygiene at the WHO Five Moments: before touching a patient; before a clean/aseptic procedure; after body-fluid exposure risk; after touching a patient; after touching patient surroundings.",
        "Use alcohol-based hand rub for routine decontamination when hands are not visibly soiled.",
        "Wash with soap and water when hands are visibly soiled, after using the toilet, and when caring for patients with spore-forming organisms.",
        "Follow the defined technique and contact time for hand rub and for hand wash.",
        "Ensure hand-rub dispensers are available at the point of care and are checked and refilled on a defined round.",
        "Keep nails short, and do not wear rings, wrist watches or artificial nails in clinical areas.",
        "Conduct hand-hygiene compliance observation audits at a defined frequency and record the results.",
        "Feed audit results back to the department and take documented corrective action where compliance falls below target.",
        "Train all new staff on hand hygiene during induction and re-train at a defined interval."
      ],
      responsibilities: [
        ["All staff", "Perform hand hygiene at the Five Moments."],
        ["Nurse in-charge", "Ensures dispenser availability and staff compliance in the unit."],
        ["Housekeeping", "Refills dispensers on the defined round and records it."],
        ["Infection Control Nurse", "Conducts compliance audits and reports results."],
        ["Infection Control Committee", "Reviews compliance trends and directs corrective action."]
      ],
      records: [
        "Hand Hygiene Compliance Audit Record",
        "Dispenser Refill / Availability Round Log",
        "Hand Hygiene Training Attendance Record"
      ],
      flowchart: [
        "Identify the moment of care",
        "Are hands visibly soiled?",
        "YES → Hand wash with soap and water",
        "NO → Apply alcohol-based hand rub",
        "Follow the defined technique and contact time",
        "Proceed with patient care",
        "Compliance observed and recorded during audit"
      ]
    },
    {
      match: /biomedical waste|bmw|waste (segregat|manage|dispos)/i,
      title: "Biomedical Waste Management",
      purpose: "To define the process for safe segregation, collection, storage, transport and disposal of biomedical waste so as to protect patients, staff, visitors and the community from harm.",
      scope: "All areas generating biomedical waste across the organisation.",
      definitions: [
        "Biomedical waste — waste generated during diagnosis, treatment or immunisation of human beings or animals.",
        "Segregation at source — separating waste into the correct category at the point where it is generated."
      ],
      steps: [
        "Segregate waste into the correct colour-coded container at the point of generation — never sort it later.",
        "Display the colour-coding chart at every waste-generation point.",
        "Do not fill any container beyond three-quarters of its capacity.",
        "Use puncture-proof, leak-proof containers for sharps and never recap needles by hand.",
        "Label each bag/container with the date, department and waste category before removal.",
        "Transport waste in covered, dedicated trolleys along the defined route and at the defined times.",
        "Store waste in the designated central storage area with restricted access for no longer than the permitted period.",
        "Hand over waste to the authorised common treatment facility and retain the manifest.",
        "Record daily waste quantities by category.",
        "Manage spills using the spill kit and the defined spill procedure, and record the event.",
        "Provide staff with the required personal protective equipment and immunisation.",
        "Audit segregation accuracy at a defined frequency and act on the findings."
      ],
      responsibilities: [
        ["All staff generating waste", "Segregate correctly at source."],
        ["Housekeeping", "Collects, transports and stores waste per the defined route and timing."],
        ["Infection Control Nurse", "Audits segregation accuracy and trains staff."],
        ["Waste Management Officer", "Liaises with the authorised disposal facility and maintains statutory records."]
      ],
      records: [
        "Daily Biomedical Waste Quantity Register",
        "Waste Handover Manifest from the authorised facility",
        "BMW Segregation Audit Record",
        "Spill Incident Record",
        "Staff Immunisation and Training Record"
      ],
      flowchart: [
        "Waste generated at the point of care",
        "Identify the waste category",
        "Place in the correct colour-coded container",
        "Container three-quarters full? → Seal and label",
        "Housekeeping collects on the defined round",
        "Transport via the dedicated route to central storage",
        "Handover to the authorised facility with manifest",
        "Record quantity and retain the manifest"
      ]
    }
  ];

  function findTopic(text) {
    return TOPIC_LIBRARY.find(t => t.match.test(text)) || null;
  }

  const SIZE_NOTES = {
    small: "This organisation is a small healthcare facility. Where a dedicated role is named below, the responsibility may be combined and assigned to an available trained staff member, provided the assignment is documented in writing.",
    medium: "This organisation is a medium-sized hospital. Responsibilities below should be assigned to named individuals and reflected in their job descriptions.",
    large: "This organisation is a large / tertiary-care hospital. Responsibilities below should be assigned to named individuals within each department, with a documented deputy for each role."
  };

  /**
   * Compose the full SOP. Returns { meta, blocks } where blocks feed SopDocx
   * and can also be rendered as an on-screen preview.
   */
  function generate(opts) {
    const { topic, department, deptChapter, hospitalSize, language, orgName } = opts;
    const matches = matchElements(topic, deptChapter);
    const lib = findTopic(topic);

    const title = lib ? lib.title : toTitleCase(topic.replace(/\bsop\b/ig, "").trim());
    const today = new Date().toISOString().slice(0, 10);
    const sopCode = "SOP/" + (deptChapter || "GEN") + "/" + String(Math.abs(hashCode(title)) % 900 + 100);

    const blocks = [];
    const push = (type, text) => blocks.push({ type, text });

    push("title", `Standard Operating Procedure: ${title}`);
    blocks.push({
      type: "table",
      header: ["Field", "Detail"],
      rows: [
        ["Organisation", orgName || "____________________"],
        ["SOP title", title],
        ["SOP number", sopCode],
        ["Department", department || "____________________"],
        ["Version", "1.0"],
        ["Date of issue", today],
        ["Next review due", addYear(today)],
        ["Prepared by", "____________________"],
        ["Reviewed by", "____________________"],
        ["Approved by", "____________________"]
      ]
    });

    push("h1", "1. Purpose");
    push("p", lib ? lib.purpose
      : `To define a uniform, documented process for ${title.toLowerCase()} within ${department || "the department"}, in line with the applicable NABH Objective Elements listed in Section 9.`);

    push("h1", "2. Scope");
    push("p", lib ? lib.scope
      : `This SOP applies to all staff of ${department || "the department"} involved in ${title.toLowerCase()}, and to any other personnel performing this activity within the organisation.`);

    push("h1", "3. Definitions");
    (lib ? lib.definitions : ["Define here any term used in this SOP that a new staff member may not know."])
      .forEach(d => push("bullet", d));

    push("h1", "4. Responsibilities");
    push("small", SIZE_NOTES[hospitalSize] || SIZE_NOTES.medium);
    blocks.push({
      type: "table",
      header: ["Role", "Responsibility"],
      rows: lib ? lib.responsibilities : [
        [department || "Department in-charge", "Owns this SOP and ensures it is followed."],
        ["Performing staff", "Carry out the procedure exactly as written and complete the records."],
        ["Quality Department", "Audits compliance and tracks corrective action."]
      ]
    });

    push("h1", "5. Procedure");
    if (lib) {
      lib.steps.forEach(s => push("numbered", s));
    } else {
      push("small", "The steps below are a structural skeleton. Replace each with the exact practice followed in your organisation — an SOP must describe what your staff actually do, not a generic description.");
      [
        "State the trigger — when this procedure begins.",
        "List the equipment, forms and materials required.",
        "Describe each action in sequence, naming the role that performs it.",
        "State the acceptable limits, timings or thresholds that apply.",
        "Describe what to do when something falls outside those limits.",
        "State who must be informed and within what time frame.",
        "Describe the record to be completed and by whom.",
        "State how the record is reviewed and retained."
      ].forEach(s => push("numbered", s));
    }

    push("h1", "6. Process Flow");
    if (lib && lib.flowchart) {
      lib.flowchart.forEach((s, i) => push("numbered", s));
      push("small", "Render the above as a flowchart in your document-control template if your organisation requires a diagram.");
    } else {
      push("p", "Draw the process flow for this procedure: Start → each action in sequence → decision points → End.");
    }

    push("h1", "7. Records to be maintained");
    (lib ? lib.records : ["List every form, register or log generated by this procedure, with its retention period."])
      .forEach(r => push("bullet", r));

    push("h1", "8. Monitoring and Review");
    push("p", "Compliance with this SOP shall be monitored through periodic audit by the Quality Department. This SOP shall be reviewed at least once a year, or earlier if there is a change in process, equipment, regulation or an incident indicating that revision is required. Superseded versions shall be withdrawn from circulation.");

    push("h1", "9. Reference Standards — NABH 6th Edition");
    if (matches.length) {
      push("small", "The Objective Elements below were matched to this topic from the NABH 6th Edition (effective 1 January 2025). Elements marked ✱ are asterisked in the book, meaning a written, documented SOP is explicitly required.");
      blocks.push({
        type: "table",
        header: ["Element", "Category", "Requirement (verbatim)"],
        rows: matches.map(m => [
          (m.sop ? "✱ " : "") + m.code,
          m.category,
          m.text.length > 260 ? m.text.slice(0, 257) + "…" : m.text
        ])
      });
    } else {
      push("p", "No NABH Objective Element matched this topic directly. Review the relevant chapter manually and add the applicable element codes here before issuing this SOP.");
    }

    push("h1", "10. Other References");
    push("bullet", "NABH Accreditation Standards for Hospitals, 6th Edition (effective 1 January 2025).");
    push("bullet", "Applicable national and state statutory requirements.");
    push("bullet", "Relevant equipment manufacturer instructions for use.");
    push("bullet", "Organisation's own quality manual and document-control policy.");

    push("h1", "11. Document Control");
    blocks.push({
      type: "table",
      header: ["Version", "Date", "Change summary", "Approved by"],
      rows: [["1.0", today, "First issue", "____________________"]]
    });

    if (language && language !== "en") {
      push("small", "Language note: this draft has been generated in English. Have it translated by a competent bilingual staff member and record the translated version under document control — machine translation of a clinical SOP should be verified before issue.");
    }

    push("small", "Generated by AQcredix as a starting draft. It must be reviewed, adapted to your organisation's actual practice, and formally approved before use. It is not a substitute for professional judgement or for reading the NABH standard in full.");

    return {
      meta: { title, sopCode, department, hospitalSize, date: today, matchCount: matches.length, curated: !!lib },
      matches,
      blocks
    };
  }

  function toTitleCase(s) {
    if (!s) return "Untitled Procedure";
    return s.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
  }
  function addYear(iso) {
    const d = new Date(iso); d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }
  function hashCode(s) {
    let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h;
  }

  return { generate, matchElements, findTopic, TOPIC_LIBRARY };
})();
