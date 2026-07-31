/* AQcredix — department deep-dive content + keyword rules for matching real NABH elements */
window.DEPT_DATA = [

{
  id:"pharmacy", name:"Pharmacy", icon:"pill",
  keywords:[/pharmacy/i,/medication/i,/drug/i,/formulary/i,/narcotic/i,/psychotropic/i,/dispens/i,/prescri/i,/high-alert/i,/look-alike/i,/sound-alike/i,/expiry/i,/cold.?chain/i,/refrigerat/i],
  chapters:["MOM"],
  intro:"Pharmacy is the tightest-controlled real estate in the hospital — every square foot, every degree of temperature, and every gram of stock has a rule behind it.",
  sections:[
    { h:"Hospital formulary",
      items:[
        "The formulary is the hospital's own defined, approved list of medications — not every drug on the market, only what's clinically appropriate for the patient population and scope of services the organisation actually offers (MOM.2.a).",
        "Built and maintained by a multi-disciplinary Pharmacy & Therapeutics-style committee, not by pharmacy alone — physicians, pharmacists, and nursing all weigh in on what belongs on it.",
        "Reviewed and updated collaboratively at least once a year, with additions and deletions justified by clinical need, cost, and safety — not just habit.",
        "Kept genuinely available for clinicians to reference at the point of prescribing, so 'not on formulary' is discovered before the order is written, not after.",
        "A restricted or non-formulary drug request goes through a defined justification and approval pathway rather than an informal workaround.",
      ]},
    { h:"Why a clinical pharmacologist / clinical pharmacist matters",
      items:[
        "A clinical pharmacologist brings deep, specialist knowledge of how drugs actually behave in the body — interactions, dosing in organ impairment, and the clinical evidence behind a regimen — that most prescribers don't have time to track drug-by-drug.",
        "A clinical pharmacist reviews orders before they reach the patient: catching a wrong dose, a dangerous interaction, a duplicate therapy, or a contraindication a busy prescriber missed — a second, expert set of eyes on every prescription.",
        "Both roles anchor the multi-disciplinary medication management committee (MOM.1.b) that NABH requires — someone has to actually own the pharmacology expertise driving formulary decisions, not just the logistics of stocking shelves.",
        "In antimicrobial stewardship specifically, a clinical pharmacologist's input is often what keeps a hospital's antibiotic policy evidence-based rather than habit-based — directly protecting against resistance building up in the patient population.",
        "Their involvement is also what turns a medication error report into an actual practice change — the clinical reasoning behind 'why this happened' usually needs their expertise to interpret correctly.",
      ]},
    { h:"Physical requirements & storage dimensions",
      items:[
        "Minimum clear storage area sized to formulary volume — typically 1 sq.ft. of shelf per 150–200 SKUs as a working rule of thumb, scaled to bed strength.",
        "Shelving height: bottom shelf ≥ 15cm off the floor (flood/pest protection), top reachable shelf ≤ 1.8m without a step stool for routine stock.",
        "Narcotics and psychotropics: double-locked cabinet or safe, bolted to the wall/floor, access restricted to named, authorised staff only, with a register of every entry.",
        "Segregation by risk, not just alphabetically: high-alert medications physically separated from look-alike/sound-alike (LASA) drugs, LASA pairs never stored adjacent even if alphabetically consecutive.",
        "Refrigerated storage: 2–8°C for vaccines, insulin, and biologics, with continuous temperature logging (twice-daily minimum, ideally automated with alarm) and a documented cold-chain breach protocol.",
        "Room temperature storage generally maintained below 25°C; a calibrated thermometer/hygrometer is checked and logged daily.",
      ]},
    { h:"Inventory & lead-time control",
      items:[
        "Min-max stock levels defined per item, with reorder point set above (average daily consumption × lead time) plus a safety-stock buffer.",
        "Lead-time analysis tracked per supplier — average, and worst-case, days from purchase order to shelf-ready stock, revisited when a supplier's performance drifts.",
        "FEFO (First-Expiry-First-Out), not just FIFO — physically arranged so the earliest-expiring batch is picked first regardless of arrival order.",
        "Near-expiry flagging at a fixed threshold (commonly 3–6 months out) with a documented return/exchange/disposal pathway before expiry.",
        "Cycle counting on high-value and narcotic stock more frequently than the annual full inventory — discrepancies investigated and logged, not just corrected silently.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Retail/institutional Drug Licence under the Drugs & Cosmetics Act (Schedule H, H1, X handling permissions as applicable).",
        "Narcotic and Psychotropic Substances licence where Schedule X / NDPS-controlled drugs are stocked, with a separate register per the NDPS Act.",
        "Registered Pharmacist on duty at all times of dispensing, licence displayed and renewal-tracked.",
        "Biomedical waste authorisation for expired/discarded pharmaceutical waste disposal.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Daily Cold-Chain Temperature Log (fridge/freezer, twice daily)",
        "Daily Narcotic Register Reconciliation Checklist",
        "Weekly Near-Expiry Stock Review Checklist",
        "Monthly Pharmacy Storage & Housekeeping Audit Checklist",
        "Quarterly High-Alert Medication Storage Compliance Checklist",
        "Annual Full Physical Inventory Reconciliation",
      ]}
  ]
},

{
  id:"nursing", name:"Nursing", icon:"heart",
  keywords:[/nursing/i,/nurse/i,/bedside/i,/vital sign/i,/patient assessment/i,/care plan/i,/fall/i,/pressure (ulcer|injury)/i,/pain (assessment|management)/i,/handover/i,/monitored after medication/i,/near miss/i,/adverse drug/i,/medication error/i,/medications? (are|is) administered/i,/administration of medication/i,/before administration/i,/self-administration/i,/catheter and tubing/i,/medications? brought from outside/i],
  chapters:["COP","AAC","MOM"],
  intro:"Nursing carries the highest-frequency touchpoints with the patient — most Core elements assessors check ride on what nursing actually does at the bedside, not what's written in a policy folder. Post-administration monitoring (MOM.8) sits here too: nursing is who's actually at the bedside when a medication takes effect, or when it doesn't.",
  sections:[
    { h:"Ward & unit essentials",
      items:[
        "Nurse-to-patient ratio defined per acuity level (general ward, HDU, ICU) and staffed to it on every shift, not just on paper.",
        "Bedside chart/e-record updated in real time — vitals, pain score, and intake-output, not retrospectively at end of shift.",
        "Fall-risk screening at admission and after any status change, with visible risk-flagging (wristband/bed sign) for high-risk patients.",
        "Handover follows a structured format (e.g. SBAR) at every shift change, with two-identifier patient verification.",
      ]},
    { h:"Safe medication administration (MOM.7)",
      items:[
        "Administered only by staff permitted by law to do so — checked before independent duty, not assumed.",
        "The 'five rights' verified from the order every time before the dose is given: right patient (two identifiers), right medication (physically inspected against the order), right strength, right route, right timing.",
        "A prepared medication is labelled before the next drug is prepared — so two syringes on a tray are never a guessing game.",
        "Measures in place to prevent catheter and tubing mis-connections during administration — a Core, asterisked (SOP-required) element, because a tubing mix-up can be fatal.",
        "Every administration documented at the time it happens, not reconstructed later from memory.",
        "Patient self-administration and medications a patient brings in from outside are both governed by a defined process — not left informal.",
      ]},
    { h:"Medication monitoring (MOM.8)",
      items:[
        "Every patient monitored for response after medication administration — not just given the dose and moved on to the next bed.",
        "If monitoring shows an adverse response, the medication plan is adjusted and escalated to the prescriber — the observation has to actually change practice.",
        "Near misses, medication errors, and adverse drug reactions captured and reported within a defined time frame, in a no-blame reporting culture.",
        "Reported events are collected and genuinely analysed — not just filed — with corrective and preventive action taken based on what the analysis shows.",
      ]},
    { h:"Licensing & competency",
      items:[
        "State Nursing Council registration, current and verified before roster placement.",
        "BLS certification current for all clinical nursing staff; ACLS for critical-care nursing.",
        "Annual competency re-assessment for high-risk skills (IV cannulation, medication administration, restraint use).",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Shift Handover Checklist (SBAR format)",
        "Daily Fall-Risk Screening Log",
        "Crash Cart Daily Check Checklist",
        "Restraint Use & Monitoring Checklist",
        "Nursing Care Plan Audit Checklist (periodic)",
      ]}
  ]
},

{
  id:"emergency", name:"Emergency Department", icon:"zap",
  keywords:[/emergency/i,/triage/i,/casualty/i],
  chapters:["AAC","COP"],
  intro:"The department where the first 15 minutes decide the outcome — and where assessors specifically test whether triage is a real, timed process or a guess at the front desk.",
  sections:[
    { h:"Operational essentials",
      items:[
        "A validated triage scale (e.g. 4/5-level triage) applied and timed at every arrival, red-flag deterioration escalated immediately.",
        "Resuscitation bay stocked, checked, and sealed with a tamper-evident tag replaced after every use or shift check.",
        "Crash cart and airway trolley checked every shift, discrepancies logged and closed same-day.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Medico-legal case (MLC) register maintained per local police-reporting requirements.",
        "Controlled-drug stock in the ED tracked under the same narcotic register discipline as pharmacy.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Shift-Wise Crash Cart & Airway Trolley Checklist",
        "Triage Time Compliance Log",
        "MLC Register & Police Intimation Checklist",
        "Resuscitation Bay Readiness Checklist",
      ]}
  ]
},

{
  id:"icu", name:"ICU / Critical Care", icon:"activity",
  keywords:[/intensive care/i,/critical care/i,/ventilat/i,/sedation/i,/central line/i,/icu/i],
  chapters:["COP"],
  intro:"Every bundle here exists because a specific, well-documented failure mode killed someone somewhere before the bundle existed.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Ventilator-associated event (VAE) prevention bundle — head-of-bed elevation, oral care schedule, sedation-vacation protocol — documented per patient per shift.",
        "Central-line insertion bundle checklist completed and signed at every line insertion, not retrospectively.",
        "Daily multidisciplinary rounds with a documented plan, not just a verbal handoff.",
      ]},
    { h:"Licensing & competency",
      items:[
        "Intensivist/critical-care physician coverage per statutory nurse-patient and doctor-patient ratio requirements.",
        "Biomedical equipment (ventilators, monitors, infusion pumps) under current calibration and AMC contract.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Central-Line Insertion Bundle Checklist",
        "Daily VAE-Prevention Bundle Checklist",
        "Ventilator Circuit Change & Maintenance Log",
        "ICU Equipment Daily Function Check",
      ]}
  ]
},

{
  id:"ot", name:"Operation Theatre", icon:"scissors",
  keywords:[/operation theatre/i,/surgical/i,/surgery/i,/anaesthesi/i,/anesthesi/i,/pre-?operative/i,/post-?operative/i],
  chapters:["COP"],
  intro:"The zero-tolerance zone — wrong-site surgery is one of the few events that ends careers and licences, which is why the checklist culture here is the strictest in the building.",
  sections:[
    { h:"Operational essentials",
      items:[
        "WHO Surgical Safety Checklist used at all three phases — sign-in, time-out, sign-out — verbally, out loud, every single case.",
        "Site-marking done by the operating surgeon before the patient enters the OT, not by a resident or nurse.",
        "Instrument, sponge and needle counts performed and documented before closure, discrepancy protocol triggers an X-ray before the patient leaves.",
      ]},
    { h:"Physical & licensing requirements",
      items:[
        "Positive-pressure ventilation with HEPA filtration and a minimum air-change rate appropriate to OT class.",
        "Temperature (typically 20–24°C) and humidity (30–60%) logged per session.",
        "Anaesthesia machines under a current calibration and preventive-maintenance contract with logged service dates.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "WHO Surgical Safety Checklist (per case)",
        "OT Instrument & Sponge Count Checklist",
        "Daily OT Temperature/Humidity/Air-Change Log",
        "Anaesthesia Machine Pre-Use Checklist",
      ]}
  ]
},

{
  id:"lab", name:"Laboratory", icon:"flask",
  keywords:[/laboratory/i,/\blab\b/i,/specimen/i,/sample/i,/pathology/i,/critical value/i],
  chapters:["AAC"],
  intro:"The evidence behind every diagnosis — and the department where a mislabeled tube causes a downstream error nobody traces back to its source.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Two-identifier patient/specimen matching at every collection point, barcode-verified where available.",
        "Critical-value reporting to the treating clinician within a fixed, timed window (commonly 30 minutes), documented with read-back confirmation.",
        "Internal and external quality control (EQAS) run per test category on a fixed schedule, not skipped when busy.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Clinical Establishment / lab-specific state licensing as applicable, with biosafety-level compliance for the tests performed.",
        "NABL accreditation (separate from NABH) where pursued, strengthens the same quality-control discipline.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Daily Internal Quality Control (IQC) Checklist per analyser",
        "Sample Rejection Log & Root-Cause Review",
        "Critical Value Reporting & Read-Back Log",
        "Equipment Calibration & Maintenance Schedule",
      ]}
  ]
},

{
  id:"bloodbank", name:"Blood Bank", icon:"droplet",
  keywords:[/blood bank/i,/transfusion/i,/donor/i,/blood component/i,/cross-?match/i],
  chapters:["COP"],
  intro:"Traceability isn't optional here — every unit has a documented life story from donor to patient, and the chain can never have a gap.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Donor screening and deferral criteria applied and documented for every donation, no exceptions for 'known' donors.",
        "Cross-match and compatibility testing verified by two independent staff before release for transfusion.",
        "Cold-chain maintained (typically 2–6°C for red cells, -18°C or below for plasma) with continuous monitoring and alarm.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Blood Bank licence under the Drugs & Cosmetics Act, Schedule F, renewed and displayed.",
        "Component-wise wastage tracked and reported, since it's a direct indicator of process control.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Donor Screening & Deferral Checklist",
        "Cross-Match Verification Checklist (dual sign-off)",
        "Cold-Chain Temperature Log (blood bank refrigerators/freezers)",
        "Component Wastage & Discard Log",
      ]}
  ]
},

{
  id:"radiology", name:"Radiology / Imaging", icon:"scan",
  keywords:[/radiology/i,/imaging/i,/radiation/i,/x-?ray/i,/contrast/i],
  chapters:["AAC"],
  intro:"Image, interpret, inform — with a radiation-safety discipline that protects staff as much as patients.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Radiation dose monitoring per modality, with ALARA (as low as reasonably achievable) principle applied and reviewed.",
        "Contrast-reaction preparedness — emergency drug tray and protocol available wherever contrast is administered.",
        "Report turnaround time tracked per modality and against a defined target, escalated when it drifts.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "AERB (Atomic Energy Regulatory Board) licence for radiation-emitting equipment, renewed and displayed.",
        "Lead-apron and shielding inventory checked for integrity on a fixed schedule (annual lead-shield X-ray test is common practice).",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Radiation Dose Monitoring Log (staff badge review)",
        "Equipment Calibration & AERB Compliance Checklist",
        "Contrast Reaction Emergency Tray Checklist",
        "Lead Apron/Shielding Integrity Check (annual)",
      ]}
  ]
},

{
  id:"housekeeping", name:"Housekeeping", icon:"spray",
  keywords:[/housekeeping/i,/cleaning/i,/hand hygiene/i,/hand-rub/i,/biomedical waste/i,/\bbmw\b/i,/spill/i,/dispenser/i],
  chapters:["IPC"],
  intro:"The frontline of infection control — the department whose daily discipline decides whether the hospital's infection numbers stay low or climb.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Colour-coded biomedical waste segregation at the point of generation — never sorted later.",
        "Hand-rub dispensers checked and refilled on a fixed round, with a visible tag system for reporting empty ones immediately.",
        "Cleaning schedule risk-graded by zone (OT/ICU highest frequency, general ward standard, admin lowest) and logged per shift.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Biomedical Waste Management authorisation under the BMW Rules, with a contract for off-site treatment/disposal.",
        "Staff trained and certified on BMW handling before independent duty.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Zone-Wise Daily Cleaning Checklist",
        "BMW Segregation Compliance Checklist",
        "Hand-Rub Dispenser Refill Round Log",
        "Spill Kit Availability & Response Log",
      ]}
  ]
},

{
  id:"hr", name:"Human Resources", icon:"users",
  keywords:[/human resource/i,/staff health/i,/recruitment/i,/credential/i,/pre-?employment/i,/code of conduct/i,/workforce/i],
  chapters:["HRM"],
  intro:"The evidence assessors ask for first — because every other department's competence traces back to what HR verified before day one.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Pre-employment medical examination and background/credential verification completed before roster placement, not after.",
        "Mandatory training (BLS, fire safety, infection control) tracked to a completion deadline per new hire.",
        "Annual staff health checks scheduled and completion tracked, especially for high-exposure roles.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Professional council/registration verification for every clinical role, re-verified on renewal cycles, not just at hiring.",
        "Statutory compliance (PF, ESI, labour law posters, minimum wage) current and displayed as required.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "New-Hire Credentialing & Verification Checklist",
        "Mandatory Training Completion Tracker",
        "Annual Staff Health Check Schedule",
        "Professional Registration Renewal Tracker",
      ]}
  ]
},

{
  id:"biomedical", name:"Biomedical Engineering", icon:"cpu",
  keywords:[/biomedical/i,/equipment (maintenance|management|calibrat)/i,/preventive maintenance/i,/medical device/i,/calibrat/i],
  chapters:["FMS"],
  intro:"Every device in the building, accounted for — the department that proves a piece of equipment works before it touches a patient, not after it fails.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Complete equipment inventory with a unique asset tag, criticality rating, and PPM (planned preventive maintenance) schedule per manufacturer recommendation.",
        "Calibration certificates current and traceable for all measurement-critical devices (BP apparatus, infusion pumps, ventilators).",
        "Breakdown response time tracked against a target, with a documented backup-equipment plan for critical devices.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "AMC/CMC contracts current for all high-criticality equipment, with defined response-time SLAs from vendors.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Equipment Master Inventory & Criticality List",
        "PPM Schedule & Completion Log (per device)",
        "Calibration Due-Date Tracker",
        "Breakdown & Corrective Maintenance Log",
      ]}
  ]
},

{
  id:"cssd", name:"CSSD", icon:"package",
  keywords:[/cssd/i,/steriliz/i,/sterilis/i,/sterile/i,/autoclave/i,/biological indicator/i],
  chapters:["IPC"],
  intro:"Sterility, verified — nothing leaves CSSD on trust; every load has a biological indicator result before it's released.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Biological indicator run with every load type, result verified before the load is released for use — not released 'pending' results.",
        "Full traceability: every instrument set traceable from wash → pack → sterilise → issue → the specific patient/procedure it went to.",
        "Load documentation complete for every cycle — load contents, parameters, operator, and result.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Autoclave/sterilizer validated and periodically re-validated per manufacturer and statutory requirement.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Daily Biological Indicator Test Log",
        "Load Documentation Checklist (per cycle)",
        "Instrument Traceability Log",
        "Autoclave Preventive Maintenance & Validation Schedule",
      ]}
  ]
},

{
  id:"medrecords", name:"Medical Records Department (MRD)", icon:"file",
  keywords:[/medical record/i,/document control/i,/record retention/i,/confidential/i,/health information/i],
  chapters:["IMS"],
  intro:"One source of truth — the department that decides whether a chart tells a clear story or a confusing one to the next clinician who opens it.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Discharge summary completion tracked to a fixed window (commonly within 24–72 hours of discharge).",
        "Access to records restricted and logged — every access to a patient's chart traceable to a named user.",
        "Document control: only the current, approved version of any form or policy is in circulation; obsolete versions withdrawn.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Record retention period defined per statutory requirement (commonly a minimum of 3 years for adult records, longer for specific categories like MLC and paediatric records) and followed, not just written.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Discharge Summary Completion Timeliness Log",
        "Record Access Audit Log",
        "Document Control & Version Withdrawal Checklist",
        "Retention & Purge Schedule Compliance Log",
      ]}
  ]
},

{
  id:"dietary", name:"Dietary / Food Services", icon:"utensils",
  keywords:[/dietary/i,/nutrition/i,/food safety/i,/diet order/i,/meal/i],
  chapters:["COP"],
  intro:"Nutrition as treatment — food safety here carries the same seriousness as a medication order, because a diet error can be just as harmful.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Nutritional screening within a fixed window of admission (commonly 24 hours), with a documented care plan for at-risk patients.",
        "Special-diet orders verified against the physician's prescription before the tray leaves the kitchen.",
        "Food safety practices (temperature control, cross-contamination prevention) audited on a fixed schedule.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "FSSAI licence for the kitchen/food-handling operation, displayed and renewed.",
        "Food-handler medical fitness certificates current for kitchen staff.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Daily Food Safety & Hygiene Audit Checklist",
        "Diet Order Verification Checklist",
        "Cold Storage Temperature Log (kitchen)",
        "Food-Handler Health Certification Tracker",
      ]}
  ]
},

{
  id:"physio", name:"Physiotherapy", icon:"activity",
  keywords:[/physiotherapy/i,/rehabilitat/i,/mobility/i,/functional status/i],
  chapters:["COP"],
  intro:"Function, restored — with a documentation trail from referral to discharge that proves progress, not just attendance.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Assessment completed within a fixed window of referral, with a documented, goal-based treatment plan.",
        "Fall-prevention protocol applied for any patient undergoing mobility training.",
        "Discharge functional-status documented, so the next care setting knows exactly where the patient is starting from.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Referral-to-Assessment Timeliness Log",
        "Goal-Based Treatment Plan Documentation Checklist",
        "Mobility Fall-Prevention Checklist",
        "Discharge Functional-Status Documentation Checklist",
      ]}
  ]
},

{
  id:"maintenance", name:"Maintenance / Engineering", icon:"tool",
  keywords:[/facility/i,/utility/i,/electric/i,/water supply/i,/medical gas/i,/fire safety/i,/engineering support/i],
  chapters:["FMS"],
  intro:"The building that never stops — utilities that patients never think about until the one time they fail.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Critical utility (power, water, medical gas, vacuum) backup tested on a fixed schedule, not just installed and assumed to work.",
        "Fire safety systems (alarms, sprinklers, extinguishers) tested and tagged with the next-due date visible on each unit.",
        "Work-order response time tracked against a target, with escalation for anything patient-safety-critical.",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Fire NOC (No Objection Certificate) current and displayed.",
        "Lift, pressure-vessel, and electrical safety certifications current per local statutory inspection requirements.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Critical Utility Backup Test Log (generator, water, medical gas)",
        "Fire Safety Equipment Inspection & Tagging Checklist",
        "Monthly Facility Safety Round Checklist",
        "Statutory Certification Renewal Tracker",
      ]}
  ]
},

{
  id:"admin", name:"Administration", icon:"briefcase",
  keywords:[/governance/i,/leadership/i,/policy review/i,/grievance/i,/statutory/i,/ethics/i],
  chapters:["ROM"],
  intro:"Governance in motion — the department that has to prove leadership isn't just a title on an org chart.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Policy review cycle on a fixed calendar (commonly annual), with version control and sign-off.",
        "Grievance mechanism with a defined closure timeline, tracked and reported to leadership.",
        "Statutory licences and registrations tracked on a renewal calendar, not discovered lapsed during an audit.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Policy Review & Version Control Checklist",
        "Grievance Register & Closure Timeliness Log",
        "Statutory Licence Renewal Tracker",
        "Leadership Round Schedule & Completion Log",
      ]}
  ]
},

{
  id:"laundry", name:"Laundry & Mortuary", icon:"shirt",
  keywords:[/laundry/i,/linen/i,/mortuary/i,/chain.?of.?custody/i],
  chapters:["FMS"],
  intro:"Dignity in the details — two very different services that share the same non-negotiable standard: clean separated from soiled, always.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Linen segregated soiled-from-clean at source, transported in separate, colour-coded bags/trolleys — never mixed even briefly.",
        "Mortuary chain-of-custody documented for every body received and released, matching the medical record.",
        "Microbial load of processed linen checked on a periodic schedule, not assumed acceptable.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Soiled-Clean Linen Segregation Checklist",
        "Linen Microbial Load Audit Log",
        "Mortuary Chain-of-Custody Register",
        "Linen Supply Turnaround Time Log",
      ]}
  ]
},

{
  id:"quality", name:"Quality Department", icon:"target",
  keywords:[/quality improvement/i,/quality indicator/i,/incident report/i,/sentinel event/i,/capa/i,/mock drill/i,/root cause/i],
  chapters:["PSQ"],
  intro:"The nerve centre — the department that turns every other department's data into an actual improvement, not just a dashboard nobody reads.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Quality indicators reviewed on a fixed monthly cadence, with trend direction discussed, not just recorded.",
        "Incident reporting culture built on no-blame, full-disclosure — near-misses reported, not hidden.",
        "CAPA closed within a committed timeline, with evidence the corrective action actually worked, not just that it was proposed.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Monthly Quality Indicator Review Checklist",
        "Incident/Near-Miss Reporting Log",
        "CAPA Tracker with Closure Evidence",
        "Mock Drill Calendar & Completion Log",
      ]}
  ]
},

{
  id:"ims", name:"Information Management (IT)", icon:"server",
  keywords:[/information/i,/\bdata\b/i,/medical record/i,/\brecord\b/i,/electronic/i,/technology/i,/database/i,/document control/i,/access control/i,/downtime/i,/\bIT\b/i,/digital health/i],
  chapters:["IMS"],
  intro:"Data integrity, always — the department responsible for making sure a system crash never becomes a patient-safety crash.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Clinical system uptime tracked against a target, with a documented downtime procedure staff have actually drilled.",
        "Data backup verified — not just scheduled — on a fixed cadence, with periodic restore tests.",
        "Access control reviewed periodically; access no longer needed (role change, exit) revoked promptly, not left active.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Daily Backup Verification Log",
        "Access Control Review Checklist (periodic)",
        "Downtime Procedure Drill Log",
        "System Uptime & Incident Log",
      ]}
  ]
},

{
  id:"pre", name:"Patient Rights & Education", icon:"shield",
  keywords:[/informed consent/i,/patient rights/i,/grievance/i,/patient education/i,/dignity/i,/privacy/i],
  chapters:["PRE"],
  intro:"Where the patient is treated as a partner in their own care, not a passive recipient of it.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Informed consent obtained with the procedure, risks, and alternatives explained in a language the patient understands — documented, not assumed.",
        "Patient rights and responsibilities displayed prominently and explained at admission, not buried in fine print.",
        "Grievance mechanism accessible and its existence actually communicated to patients and families.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Informed Consent Documentation Checklist",
        "Patient Rights Display & Explanation Log",
        "Grievance Register & Resolution Tracker",
      ]}
  ]
},

{
  id:"frontoffice", name:"Front Office", icon:"users",
  keywords:[/registration/i,/admission/i,/unique identification number/i,/non-availability of beds/i,/prioritised according to/i,/effective communication/i],
  chapters:["AAC","PRE"],
  intro:"The hospital's first impression and its first safety checkpoint — a bad registration process doesn't just annoy patients, it breaks the identifier trail that every downstream department depends on.",
  sections:[
    { h:"Operational essentials",
      items:[
        "Registration and admission follows written, standard guidance — not staff-dependent improvisation (AAC.2.a).",
        "A unique identification number generated for every patient at the end of registration, before any clinical step happens (AAC.2.b, Core).",
        "A defined process for managing patients when beds aren't available, so 'we're full' has a documented next step, not an ad-hoc one (AAC.2.d).",
        "Where demand exceeds capacity, access is prioritised by clinical urgency, not order of arrival or influence (AAC.2.e).",
        "First point of contact for effective communication with patients and families — tone and clarity set here carry through the whole visit (PRE.8.a).",
      ]},
    { h:"Licensing & regulatory",
      items:[
        "Staff trained on patient-identification protocol and two-identifier verification before independent duty.",
        "Data privacy and confidentiality training current for anyone handling patient registration information.",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Daily Registration Accuracy Spot-Check",
        "Bed Non-Availability Escalation Log",
        "Unique ID Generation Verification Checklist",
        "Front Desk Communication Standards Checklist",
      ]}
  ]
},

{
  id:"pro", name:"Public Relations Office (PRO)", icon:"megaphone",
  keywords:[/patient's feedback/i,/redress complaints/i,/patient experience/i,/patient and \/ or family members are made aware/i,/enhanced communication/i,/unacceptable communication/i],
  chapters:["PRE"],
  intro:"The department that turns a complaint into a fixed process instead of a forgotten form — and the one that has to know, ahead of time, which patients need a different kind of conversation.",
  sections:[
    { h:"Operational essentials",
      items:[
        "A defined mechanism captures patient feedback, including complaints, not just praise (PRE.7.a).",
        "Patients and families are actively made aware of how to give feedback — the option exists whether or not anyone asks about it (PRE.7.d).",
        "Every complaint is redressed through the defined mechanism, and reviewed within a fixed time frame — not left open indefinitely (PRE.7.c, Core; PRE.7.e).",
        "Corrective or preventive action taken where the analysis shows a real pattern, not just a one-off apology (PRE.7.f).",
        "Special situations needing enhanced communication (language barriers, breaking bad news, vulnerable patients) are identified in advance, not discovered mid-conversation (PRE.8.b, PRE.8.c).",
        "Communication is monitored for effectiveness and reviewed periodically, and the organisation actively guards against unacceptable communication (PRE.8.d, PRE.8.e).",
      ]},
    { h:"Checklists to maintain",
      items:[
        "Patient Feedback & Complaint Register",
        "Complaint Closure Timeliness Log",
        "Enhanced-Communication Situation Identification Checklist",
        "Patient Experience Survey Schedule & Review Log",
      ]}
  ]
},
];
