/* AQcredix — Committees dataset.
   Future-proof: add a new committee by pushing one object onto this array —
   the Committees explorer, detail view, and static redirect pages all read from here. */
window.COMMITTEE_DATA = [

{
  slug:"drug-and-therapeutics-committee",
  name:"Drug and Therapeutics Committee",
  short:"DTC",
  purpose:"Governs the hospital's medication system end-to-end — deciding what drugs the hospital stocks, ensuring they're used safely and rationally, and closing the loop on every medication error.",
  objectives:[
    "Develop, review, and update the hospital formulary at least annually.",
    "Evaluate and approve non-formulary drug requests through a defined justification pathway.",
    "Monitor medication errors, near misses, and adverse drug reactions, and drive corrective action.",
    "Promote rational, cost-effective, and evidence-based prescribing across the organisation.",
    "Oversee high-alert medication and look-alike/sound-alike (LASA) drug safety measures.",
  ],
  responsibilities:[
    "Reviews and approves additions/deletions to the hospital formulary based on clinical evidence and cost.",
    "Reviews aggregated medication-error and ADR data monthly and directs CAPA where needed.",
    "Sets policy for narcotic, psychotropic, and high-alert medication storage and handling.",
    "Approves antibiotic policy in coordination with the Antimicrobial Stewardship Committee.",
    "Educates prescribers on formulary changes and safe prescribing practice.",
  ],
  chairperson:"Senior Physician / Medical Superintendent (commonly a physician with pharmacology background)",
  memberSecretary:"Chief Pharmacist / Head of Pharmacy",
  frequency:"Quarterly, with an emergency session for urgent safety issues",
  termsOfReference:[
    "Reviews every formulary addition/deletion request with documented clinical justification.",
    "Reviews 100% of reported medication errors classified as Core-severity within 30 days.",
    "Reports directly to the Quality/Patient Safety Committee and hospital leadership.",
  ],
  mandatoryMembers:["Hospital Administration","Medical Superintendent","Pharmacy","Quality Department","Nursing","Internal Medicine","Surgery","Anaesthesia","Microbiology","Infection Control","Finance"],
  refChapters:["MOM","PSQ"],
  refKeywords:[/formulary/i,/medication error/i,/adverse drug/i,/narcotic/i,/high-alert/i,/prescri/i]
},

{
  slug:"infection-prevention-and-control-committee",
  name:"Infection Prevention and Control Committee",
  short:"IPCC",
  purpose:"Owns the hospital's infection prevention and control programme — the single most heavily-weighted area in NABH assessment.",
  objectives:[
    "Design, implement, and continuously improve the hospital-wide IPC programme.",
    "Reduce healthcare-associated infections (HAI) in patients and staff.",
    "Run surveillance on infection indicators and act on adverse trends.",
    "Ensure sterilization, disinfection, and biomedical waste practices meet standard.",
  ],
  responsibilities:[
    "Reviews HAI surveillance data monthly and investigates any outbreak or cluster.",
    "Sets and audits hand-hygiene compliance targets across all clinical areas.",
    "Approves IPC policies for isolation, PPE, sterilization, and waste segregation.",
    "Coordinates staff IPC training and post-exposure prophylaxis protocols.",
  ],
  chairperson:"Infection Control Officer (often a Microbiologist or senior physician)",
  memberSecretary:"Infection Control Nurse / Coordinator",
  frequency:"Monthly, with immediate ad-hoc meetings for outbreaks",
  termsOfReference:[
    "Reviews hospital-wide HAI rates against defined benchmarks every month.",
    "Any suspected outbreak triggers a meeting within 24 hours.",
    "Reports to the Quality/Patient Safety Committee and hospital leadership quarterly.",
  ],
  mandatoryMembers:["Infection Control","Microbiology","Nursing","Quality Department","Housekeeping","CSSD","Operation Theatre","ICU","Laboratory","Biomedical Engineering","Hospital Administration"],
  refChapters:["IPC"],
  refKeywords:[/infection/i,/hand hygiene/i,/surveillance/i,/sterili[sz]/i,/biomedical waste/i]
},

{
  slug:"antimicrobial-stewardship-committee",
  name:"Antimicrobial Stewardship Committee",
  short:"AMSC",
  purpose:"Protects the effectiveness of antibiotics by promoting appropriate use and pushing back against resistance-driving overuse.",
  objectives:[
    "Develop and maintain an evidence-based antibiotic policy.",
    "Monitor antibiotic consumption and resistance patterns.",
    "Review and restrict use of reserve/high-end antibiotics.",
    "Educate prescribers on rational antimicrobial use.",
  ],
  responsibilities:[
    "Reviews antibiogram data (local resistance patterns) at least twice a year.",
    "Approves or restricts the use of specific reserve antibiotics case-by-case.",
    "Runs prescription audits and feeds findings back to prescribers.",
    "Works with the Drug & Therapeutics Committee on formulary antibiotic decisions.",
  ],
  chairperson:"Clinical Microbiologist or Infectious Disease Physician",
  memberSecretary:"Antimicrobial Stewardship Pharmacist / Coordinator",
  frequency:"Quarterly",
  termsOfReference:[
    "Publishes an updated antibiogram to all clinical departments at least annually.",
    "Reviews restricted-antibiotic approval requests within 24 hours.",
    "Reports resistance trends to the Infection Prevention & Control Committee.",
  ],
  mandatoryMembers:["Microbiology","Infection Control","Pharmacy","Internal Medicine","Surgery","ICU","Quality Department"],
  refChapters:["MOM","IPC"],
  refKeywords:[/antimicrobial/i,/antibiotic/i,/narcotic drugs and psychotropic/i]
},

{
  slug:"purchase-and-condemnation-committee",
  name:"Purchase and Condemnation Committee",
  short:"PCC",
  purpose:"Governs how the hospital buys, evaluates, and retires equipment and consumables — balancing cost, quality, and safety.",
  objectives:[
    "Evaluate and approve major equipment and consumable purchase requests.",
    "Assess vendor quality, warranty, and after-sales service before procurement.",
    "Review and approve condemnation (write-off/disposal) of unserviceable equipment.",
    "Ensure procurement decisions align with clinical need, not just cost.",
  ],
  responsibilities:[
    "Reviews purchase requisitions above a defined value threshold.",
    "Inspects equipment proposed for condemnation and verifies genuine unserviceability.",
    "Maintains an auditable record of every condemnation decision and disposal method.",
    "Coordinates with Biomedical Engineering on technical evaluation of medical equipment.",
  ],
  chairperson:"Hospital Administrator / Medical Superintendent",
  memberSecretary:"Purchase Manager / Stores In-Charge",
  frequency:"Monthly, or as required for urgent procurement",
  termsOfReference:[
    "No equipment is condemned without a documented technical evaluation.",
    "Purchase decisions above threshold require multi-member sign-off, not single-signature approval.",
  ],
  mandatoryMembers:["Hospital Administration","Purchase","Finance","Biomedical Engineering","Maintenance/Engineering","Quality Department","Pharmacy"],
  refChapters:["FMS","ROM"],
  refKeywords:[/procurement/i,/equipment management/i,/medical equipment/i]
},

{
  slug:"medical-record-review-committee",
  name:"Medical Record Review Committee",
  short:"MRRC",
  purpose:"Audits the completeness, accuracy, and timeliness of medical records to ensure they genuinely reflect continuity of care.",
  objectives:[
    "Periodically audit medical records for completeness and documentation quality.",
    "Ensure discharge summaries are completed within the defined time window.",
    "Monitor record confidentiality, access control, and retention compliance.",
    "Identify documentation gaps and coordinate corrective training.",
  ],
  responsibilities:[
    "Conducts a structured audit of a representative record sample every month.",
    "Reviews discharge-summary completion timeliness against target.",
    "Flags illegible, incomplete, or unauthenticated entries back to the concerned department.",
    "Reports documentation trends to the Quality Committee.",
  ],
  chairperson:"Senior Physician or Medical Superintendent",
  memberSecretary:"Medical Records Officer / MRD In-Charge",
  frequency:"Monthly",
  termsOfReference:[
    "Audits a statistically representative sample of records each cycle, not a hand-picked set.",
    "Findings are shared with the concerned department within two weeks of the audit.",
  ],
  mandatoryMembers:["Medical Records Department","Quality Department","Nursing","Internal Medicine","Surgery","Hospital Administration"],
  refChapters:["IMS"],
  refKeywords:[/medical record/i,/discharge summary/i,/document control/i,/confidential/i]
},

{
  slug:"nursing-committee",
  name:"Nursing Committee",
  short:"NC",
  purpose:"Sets and monitors nursing practice standards, staffing, and professional development across the organisation.",
  objectives:[
    "Standardise nursing care protocols and clinical procedures hospital-wide.",
    "Monitor nurse-to-patient staffing ratios against acuity-based need.",
    "Oversee nursing competency assessment and continuing education.",
    "Review nursing-sensitive quality indicators (falls, pressure injuries, medication events).",
  ],
  responsibilities:[
    "Reviews and updates nursing care protocols and SOPs periodically.",
    "Monitors compliance with defined nurse-patient ratios per unit.",
    "Plans and tracks completion of mandatory nursing training and skill validation.",
    "Investigates nursing-related incidents and drives corrective action.",
  ],
  chairperson:"Chief Nursing Officer / Director of Nursing",
  memberSecretary:"Nursing Superintendent or Senior Nurse Educator",
  frequency:"Monthly",
  termsOfReference:[
    "Reviews nursing-sensitive indicator trends every month without exception.",
    "Any nursing protocol change requires committee sign-off before rollout.",
  ],
  mandatoryMembers:["Nursing","Quality Department","ICU","Emergency Department","Operation Theatre","Human Resources","Hospital Administration"],
  refChapters:["COP","HRM"],
  refKeywords:[/nursing/i,/nurse/i,/care plan/i,/fall/i,/pressure (ulcer|injury)/i]
},

{
  slug:"safety-committee",
  name:"Safety Committee",
  short:"SC",
  purpose:"Owns the hospital's overall facility and occupational safety programme — fire, non-fire emergencies, hazardous materials, and staff safety.",
  objectives:[
    "Identify and mitigate facility safety hazards proactively.",
    "Plan and drill fire and non-fire emergency response (Code Red, Code Orange, etc.).",
    "Oversee hazardous material (HAZMAT) management and MSDS availability.",
    "Address staff occupational health and workplace-violence prevention.",
  ],
  responsibilities:[
    "Conducts periodic facility safety rounds and closes identified hazards.",
    "Runs and documents mock fire and disaster drills per a fixed calendar.",
    "Reviews HAZMAT storage, labelling, and spill-response readiness.",
    "Reviews workplace-violence and staff-injury incidents.",
  ],
  chairperson:"Hospital Administrator or designated Safety Officer",
  memberSecretary:"Fire & Safety Officer / Facility Manager",
  frequency:"Quarterly, with monthly safety rounds",
  termsOfReference:[
    "Every identified hazard is logged with a named owner and closure date.",
    "Mock drills are conducted and documented at least twice a year per emergency type.",
  ],
  mandatoryMembers:["Hospital Administration","Maintenance/Engineering","Biomedical Engineering","Security","Housekeeping","Nursing","Human Resources","Quality Department"],
  refChapters:["FMS","HRM"],
  refKeywords:[/safe and secure environment/i,/fire/i,/hazardous/i,/workplace violence/i,/safety needs/i]
},

{
  slug:"cpr-committee",
  name:"CPR Committee",
  short:"CPRC",
  purpose:"Ensures cardio-pulmonary resuscitation services are delivered uniformly, safely, and by trained staff across every corner of the hospital.",
  objectives:[
    "Standardise the Code Blue response process hospital-wide.",
    "Ensure crash carts are stocked, checked, and functional at all times.",
    "Maintain BLS/ACLS training and certification currency for clinical staff.",
    "Review every Code Blue event for response-time and outcome quality.",
  ],
  responsibilities:[
    "Audits crash-cart readiness on a fixed schedule across all units.",
    "Reviews every Code Blue call for response time, team performance, and outcome.",
    "Coordinates mandatory BLS/ACLS training and renewal tracking.",
    "Runs periodic unannounced Code Blue mock drills.",
  ],
  chairperson:"Anaesthesiologist or Intensivist",
  memberSecretary:"Code Blue Team Coordinator / Senior Nurse",
  frequency:"Quarterly, with review after every actual Code Blue event",
  termsOfReference:[
    "Every Code Blue event is reviewed within one week of occurrence.",
    "Crash-cart checks are logged every shift without exception.",
  ],
  mandatoryMembers:["Anaesthesia","ICU","Emergency Department","Nursing","Internal Medicine","Quality Department","Biomedical Engineering"],
  refChapters:["COP","PSQ"],
  refKeywords:[/cardio-pulmonary resuscitation/i,/resuscitation/i,/crash cart/i]
},

{
  slug:"blood-transfusion-committee",
  name:"Blood Transfusion Committee",
  short:"BTC",
  purpose:"Oversees the safety, traceability, and appropriate use of blood and blood components across the hospital.",
  objectives:[
    "Set policy for donor screening, component storage, and cross-match verification.",
    "Monitor transfusion reactions and near-miss events.",
    "Review blood component wastage and appropriateness of use.",
    "Ensure full traceability from donor to recipient.",
  ],
  responsibilities:[
    "Reviews every reported transfusion reaction and drives root-cause analysis.",
    "Monitors component wastage rates and investigates outliers.",
    "Audits cross-match and compatibility-testing compliance.",
    "Approves blood bank policy updates and licensing compliance.",
  ],
  chairperson:"Transfusion Medicine Specialist / Pathologist",
  memberSecretary:"Blood Bank In-Charge",
  frequency:"Quarterly",
  termsOfReference:[
    "Every transfusion reaction is reviewed within 72 hours of report.",
    "Component wastage is reported and analysed every quarter without exception.",
  ],
  mandatoryMembers:["Blood Bank","Laboratory","Nursing","Surgery","ICU","Quality Department","Hospital Administration"],
  refChapters:["COP"],
  refKeywords:[/transfusion/i,/blood/i,/donor/i,/cross-?match/i]
},

{
  slug:"forms-committee",
  name:"Forms Committee",
  short:"FC",
  purpose:"Standardises and controls every clinical and administrative form in use, so the hospital always documents on the current, approved version.",
  objectives:[
    "Approve the design and content of new clinical/administrative forms.",
    "Maintain version control — retire and replace obsolete forms hospital-wide.",
    "Ensure forms across departments capture data consistently and completely.",
    "Support the transition from paper to electronic documentation where applicable.",
  ],
  responsibilities:[
    "Reviews and approves every new or revised form before it enters circulation.",
    "Maintains a master forms register with version numbers and effective dates.",
    "Coordinates recall of obsolete forms from all departments upon revision.",
    "Audits departments periodically to confirm only current forms are in use.",
  ],
  chairperson:"Medical Superintendent or Quality Head",
  memberSecretary:"Medical Records Officer / Quality Coordinator",
  frequency:"Quarterly, or as new forms are proposed",
  termsOfReference:[
    "No form is used hospital-wide without committee approval and a version number.",
    "Obsolete forms are withdrawn from circulation within 30 days of replacement.",
  ],
  mandatoryMembers:["Medical Records Department","Quality Department","Nursing","Front Office","Hospital Administration"],
  refChapters:["IMS"],
  refKeywords:[/document control/i,/current and relevant documents/i,/version/i]
},

{
  slug:"ot-and-cssd-committee",
  name:"OT and CSSD Committee",
  short:"OTCC",
  purpose:"Oversees surgical safety and sterile-supply practice together, since one depends entirely on the other.",
  objectives:[
    "Ensure consistent use of the WHO Surgical Safety Checklist.",
    "Oversee OT scheduling, turnaround, and infection-control compliance.",
    "Ensure CSSD sterilization validation and instrument traceability.",
    "Review surgical-site infection rates and instrument-related incidents.",
  ],
  responsibilities:[
    "Audits Surgical Safety Checklist compliance on a sample of cases monthly.",
    "Reviews biological indicator results and load documentation from CSSD.",
    "Investigates any instrument traceability gap or sterilization failure.",
    "Monitors OT air-quality, temperature, and humidity logs.",
  ],
  chairperson:"Head of Surgery or Senior Anaesthesiologist",
  memberSecretary:"OT In-Charge / CSSD In-Charge (rotating or joint)",
  frequency:"Monthly",
  termsOfReference:[
    "Every sterilization failure is investigated and closed within 48 hours.",
    "Surgical Safety Checklist audit results are reported to the Quality Committee monthly.",
  ],
  mandatoryMembers:["Operation Theatre","CSSD","Anaesthesia","Surgery","Nursing","Infection Control","Quality Department","Biomedical Engineering"],
  refChapters:["COP","IPC"],
  refKeywords:[/surgical/i,/operation theatre/i,/sterili[sz]/i,/biological indicator/i,/instrument/i]
},

{
  slug:"mortality-and-morbidity-committee",
  name:"Mortality and Morbidity Committee",
  short:"M&M",
  purpose:"Reviews deaths and significant complications in a structured, no-blame setting to extract genuine system-level learning.",
  objectives:[
    "Review all in-hospital deaths and defined high-severity complications.",
    "Distinguish preventable from non-preventable adverse outcomes.",
    "Identify systemic contributing factors, not individual blame.",
    "Feed findings into CAPA and clinical protocol updates.",
  ],
  responsibilities:[
    "Reviews every eligible mortality/morbidity case within a defined time window.",
    "Presents case reviews in a structured, blame-free format for peer learning.",
    "Tracks recurring themes across cases and escalates systemic issues.",
    "Reports trends and actions to hospital leadership and the Quality Committee.",
  ],
  chairperson:"Medical Superintendent or Senior Consultant (rotating chair by specialty is common)",
  memberSecretary:"Quality Coordinator or designated Medical Officer",
  frequency:"Monthly",
  termsOfReference:[
    "Every in-hospital death is reviewed within 30 days.",
    "Reviews are conducted in a structured, no-blame format with documented minutes.",
  ],
  mandatoryMembers:["Internal Medicine","Surgery","Anaesthesia","ICU","Nursing","Quality Department","Hospital Administration","Medical Records Department"],
  refChapters:["PSQ","COP"],
  refKeywords:[/incidents are collected and analysed/i,/high risk of morbidity/i,/sentinel/i]
},

];
