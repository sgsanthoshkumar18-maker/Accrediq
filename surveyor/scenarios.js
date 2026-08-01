/* AQcredix — Mock Surveyor scenario bank
 *
 * 10 scenarios, difficulty ramping easy -> hard, 6 questions each (60 total).
 * Distractors are written to look almost identical to the correct answer, with
 * only a few words changed that reverse or weaken the meaning — mirroring how
 * real assessors probe whether a team understands the intent of a standard
 * rather than having memorised a phrase.
 *
 * Every `ref` is a REAL NABH 6th-edition Objective Element code, verified to
 * exist in nabh-data.js. `nc` describes the Non-Conformity a real assessor
 * would raise, and `capa` the corrective/preventive action expected to close it.
 *
 * `sop` defines what the uploaded document is checked for: `must` concepts are
 * expected; `bonus` concepts indicate a mature document.
 */
window.SURVEYOR_SCENARIOS = [

/* ---------- 1. EASY ---------- */
{
  id: "s1", level: "Easy", chapter: "IPC",
  title: "The bedside dispenser",
  brief: "You are walking a general ward at 11:40 am with the assessor. A nurse finishes a dressing, turns to the wall-mounted alcohol hand-rub dispenser beside the bed and presses it twice. Nothing comes out. She walks to the nursing station, uses the dispenser there, and returns. The ward's hand-hygiene compliance board shows 94% for last month.",
  questions: [
    { q: "The assessor lifts the empty bedside dispenser. What is the finding actually about?",
      opts: [
        "Hand-hygiene facilities were not available at the point of care.",
        "Hand-hygiene facilities were not available anywhere in the ward.",
        "The nurse did not perform hand hygiene after the procedure.",
        "The compliance percentage on the board was calculated incorrectly."],
      a: 0, ref: "IPC.2.c",
      why: "She did perform hand hygiene, and the ward does have facilities — but not AT THE POINT OF CARE, which is what the element requires. Option 1 overstates it; option 2 is factually wrong; option 3 is a different issue entirely." },
    { q: "The 94% compliance figure is displayed. What does an assessor do with it?",
      opts: [
        "Accepts it as evidence, since it exceeds the 80% benchmark.",
        "Asks how it was measured and what action followed the 6% gap.",
        "Rejects it, because self-reported compliance data is never accepted.",
        "Recalculates it from the ward register during the round."],
      a: 1, ref: "IPC.6.d",
      why: "Assessors test whether a number is real and whether it drove action. Blind acceptance and blanket rejection are both wrong — the question is method and follow-through." },
    { q: "Who is accountable for the empty dispenser?",
      opts: [
        "The nurse, because she used it and found it empty.",
        "Housekeeping alone, because refilling is their task.",
        "The system — a defined refill round with named ownership was absent.",
        "The Infection Control Nurse, because compliance is her indicator."],
      a: 2, ref: "IPC.2.c",
      why: "Assessors look for the system failure, not the individual. Naming one person as the cause is the classic wrong instinct in a quality audit." },
    { q: "Which is the strongest immediate corrective action?",
      opts: [
        "Refill the dispenser and counsel the nurse.",
        "Refill the dispenser and issue a memo to all wards.",
        "Refill it, and start a signed refill round with a visible empty-flag mechanism.",
        "Refill it and increase the compliance audit frequency to weekly."],
      a: 2, ref: "IPC.2.c",
      why: "Only option 3 changes the system so the failure is prevented and visible. Memos and counselling do not survive a busy night shift." },
    { q: "The nurse says 'we always use the station dispenser, it's only ten steps.' The correct response is:",
      opts: [
        "Acceptable, provided hand hygiene is genuinely performed each time.",
        "Not acceptable — distance from the point of care reduces compliance and risks contamination in transit.",
        "Acceptable only in general wards, not in ICU.",
        "Not acceptable, because alcohol rub must never be wall-mounted."],
      a: 1, ref: "IPC.3.b",
      why: "The requirement is accessibility at the point of care precisely because distance predicts non-compliance. Options 1 and 3 concede the principle; option 4 is invented." },
    { q: "Hand hygiene is asterisked in the NABH book. That means:",
      opts: [
        "It carries double weight in the final score.",
        "A written, documented SOP is explicitly required for it.",
        "It must be audited monthly rather than quarterly.",
        "It is assessed only at re-accreditation."],
      a: 1, ref: "IPC.3.b",
      why: "The asterisk denotes a documentation requirement — a written SOP that exists, is implemented and is retrievable. It is not about scoring weight or audit frequency." }
  ],
  sop: { name: "Hand Hygiene SOP",
    must: ["five moments", "alcohol", "soap", "point of care", "audit", "training", "dispenser"],
    bonus: ["technique", "contact time", "compliance target", "corrective action", "visibly soiled"] },
  nc: "Hand-hygiene facilities were not available at the point of care in the general ward (empty bedside dispenser observed).",
  capa: "Immediate: refill all dispensers ward-wide and verify. Preventive: institute a signed refill round with named ownership per shift, add a visible empty-flag tag system, and audit dispenser availability monthly alongside compliance observation."
},

/* ---------- 2. MODERATE ---------- */
{
  id: "s2", level: "Moderate", chapter: "MOM",
  title: "Two vials, one shelf",
  brief: "In a medical ward drug cupboard you find two insulin preparations in near-identical vials, stored side by side, both labelled in small print. A staff nurse is preparing a dose. The ward has had no reported medication error in 14 months. The medication error register shows three entries in that period, all marked 'nil'.",
  questions: [
    { q: "The most significant finding here is:",
      opts: [
        "Look-alike medications are stored adjacently without physical separation.",
        "The insulin vials are labelled in print that is too small to read.",
        "The nurse was preparing the dose without a second check.",
        "Insulin is being stored in a ward cupboard rather than the pharmacy."],
      a: 0, ref: "MOM.3.b",
      why: "Look-alike/sound-alike storage is the system trap. The other options may be true but are secondary or, in the case of ward storage, not inherently non-compliant." },
    { q: "'No reported medication error in 14 months' should make an assessor:",
      opts: [
        "Score the medication indicator favourably.",
        "Suspect under-reporting and probe the reporting culture.",
        "Verify the figure against the pharmacy dispensing log.",
        "Recommend the ward be cited as best practice."],
      a: 1, ref: "MOM.8.c",
      why: "A zero-error claim in a busy ward almost always signals a reporting problem, not a safety triumph. Assessors treat suspiciously clean data as a red flag." },
    { q: "Which control most reliably prevents this error?",
      opts: [
        "Retraining all ward nurses on insulin types.",
        "A memo instructing staff to double-check insulin vials.",
        "Physical separation with distinct high-alert labelling.",
        "Increasing the frequency of pharmacy ward rounds."],
      a: 2, ref: "MOM.3.b",
      why: "Design the error out. Training and memos rely on vigilance, which fails under load — this is the single most-tested concept in medication safety." },
    { q: "The register shows three entries marked 'nil'. The assessor concludes:",
      opts: [
        "The register is being maintained correctly.",
        "The register exists but is not being used as a reporting tool.",
        "The register should be replaced with an electronic system.",
        "Three entries in 14 months is an acceptable reporting rate."],
      a: 1, ref: "MOM.8.c",
      why: "A register with 'nil' entries proves the form exists, not that reporting happens. Assessors distinguish the artefact from the practice." },
    { q: "Which element is asterisked and therefore demands a written SOP here?",
      opts: [
        "Capturing near misses, medication errors and adverse drug reactions.",
        "Storing medications at the correct temperature.",
        "Recording the batch number of each administered dose.",
        "Verifying the prescriber's signature before dispensing."],
      a: 0, ref: "MOM.8.c",
      why: "MOM.8.c is asterisked — capture of near misses and errors requires documented process. The others are requirements but not the asterisked one in question." },
    { q: "The nurse says 'we've never had a problem with these two.' This is:",
      opts: [
        "Reassuring evidence that the current arrangement is safe.",
        "Irrelevant — absence of harm to date does not remove the latent risk.",
        "Acceptable if supported by the incident register.",
        "Evidence the ward is complying with high-alert requirements."],
      a: 1, ref: "MOM.8.e",
      why: "'It hasn't happened yet' is the most common defence and the weakest. Latent risk is assessed on potential, not on luck to date." }
  ],
  sop: { name: "High-Alert & LASA Medication SOP",
    must: ["high-alert", "look-alike", "separation", "labelling", "storage", "double check", "list"],
    bonus: ["insulin", "concentration", "tallman", "audit", "review", "error reporting"] },
  nc: "Look-alike insulin preparations were stored adjacently without physical separation or distinct high-alert labelling; medication error reporting appears non-functional (nil entries over 14 months).",
  capa: "Immediate: physically separate the LASA pair, apply tall-man lettering and high-alert labels, and audit all ward cupboards for similar pairs. Preventive: publish the organisation's LASA and high-alert list, re-launch no-blame error reporting with a defined feedback loop, and track reporting RATE (not just error count) as an indicator."
},

/* ---------- 3. MODERATE ---------- */
{
  id: "s3", level: "Moderate", chapter: "PRE",
  title: "A signature at 6 am",
  brief: "A patient is scheduled for an elective laparoscopic cholecystectomy at 8 am. The consent form is complete and signed. The signature is dated 06:05 that morning. The form lists the procedure name and has a printed generic risk list. The patient tells the assessor she signed 'whatever they gave me' before the surgeon's round.",
  questions: [
    { q: "The primary deficiency is:",
      opts: [
        "The consent form was signed too close to the procedure time.",
        "Consent was obtained but not demonstrably informed.",
        "The consent form uses a printed generic risk list.",
        "The surgeon did not countersign the consent form."],
      a: 1, ref: "PRE.4.a",
      why: "The distinction between SIGNED and INFORMED is the entire point of the element. Timing and format are symptoms; the absent element is the informing conversation." },
    { q: "Informed consent must include which of the following?",
      opts: [
        "The procedure, its risks, and the cost estimate.",
        "The procedure, expected benefits, risks, alternatives and consequences of refusal.",
        "The procedure, the surgeon's name and the anticipated duration.",
        "The procedure, the anaesthesia type and the ward of admission."],
      a: 1, ref: "PRE.4.c",
      why: "Alternatives and consequences of refusal are the two most commonly omitted components — assessors probe for exactly these." },
    { q: "Who must obtain informed consent for this procedure?",
      opts: [
        "Any registered nurse trained in the consent process.",
        "The ward clerk, with the surgeon countersigning afterwards.",
        "The person performing the procedure, or a suitably delegated qualified clinician.",
        "The duty medical officer on the ward at the time."],
      a: 2, ref: "PRE.4.b",
      why: "Consent is obtained by the one who can genuinely explain the procedure and answer questions — not by whoever is handy with a pen." },
    { q: "The patient's statement 'I signed whatever they gave me' is:",
      opts: [
        "Anecdotal and cannot form the basis of a finding.",
        "Direct evidence from patient interview, which assessors weight heavily.",
        "Relevant only if corroborated by a second patient.",
        "Inadmissible because the form is properly completed."],
      a: 1, ref: "PRE.4.a",
      why: "Patient interview is a primary assessment method. A perfect form contradicted by the patient is exactly what assessors look for." },
    { q: "The strongest preventive action is:",
      opts: [
        "Move consent-taking to the day before surgery as routine.",
        "Add a checklist to the form confirming each element was explained, signed by the explainer.",
        "Have a witness sign every consent form.",
        "Print the risk list in a larger font."],
      a: 1, ref: "PRE.4.c",
      why: "The checklist forces the conversation and creates the evidence trail. Timing alone doesn't guarantee informing; witnesses and font size don't address the gap." },
    { q: "For a patient who cannot give consent, the SOP must define:",
      opts: [
        "That the nearest relative present may always sign.",
        "Who may give consent, in what order of priority, and how that is documented.",
        "That treatment must be delayed until the patient regains capacity.",
        "That two doctors may authorise treatment without any consent."],
      a: 1, ref: "PRE.4.d",
      why: "The element requires the organisation to DESCRIBE who can consent — a defined hierarchy, not an assumption or a blanket rule." }
  ],
  sop: { name: "Informed Consent SOP",
    must: ["informed consent", "risks", "alternatives", "procedure", "who obtains", "documentation", "language"],
    bonus: ["refusal", "capacity", "surrogate", "witness", "high-risk", "anaesthesia", "blood transfusion"] },
  nc: "Informed consent was documented but not demonstrably informed — the patient reported signing without explanation of risks or alternatives prior to an elective procedure.",
  capa: "Immediate: re-consent the patient before the procedure with a documented explanation. Preventive: redesign the consent form with an explainer checklist (procedure, benefits, risks, alternatives, consequences of refusal), signed by the clinician obtaining consent; audit 10 consents per month by patient interview, not form review alone."
},

/* ---------- 4. MODERATE ---------- */
{
  id: "s4", level: "Moderate", chapter: "COP",
  title: "The time-out that wasn't",
  brief: "In OT-2, the team is positioning a patient for a right-knee arthroscopy. The surgical safety checklist is on the wall, filled and signed for the case. You observe the sign-in and sign-out being ticked, but the time-out was ticked while the scrub nurse was still counting instruments and the surgeon was scrubbing outside. The site is marked.",
  questions: [
    { q: "What is the finding?",
      opts: [
        "The surgical safety checklist was not used for this case.",
        "The checklist was completed as a record but the time-out was not performed as a team pause.",
        "The site marking was done by the wrong person.",
        "The instrument count was performed at the wrong stage."],
      a: 1, ref: "COP.14.c",
      why: "The document exists and is complete — that's the trap. The practice (a genuine team pause with all members present) did not occur. Form completed ≠ process performed." },
    { q: "The purpose of the time-out is to:",
      opts: [
        "Create a documented record before incision.",
        "Confirm patient identity, site and procedure with the whole team simultaneously present.",
        "Allow the anaesthetist to confirm readiness.",
        "Give the scrub nurse time to complete the instrument count."],
      a: 1, ref: "COP.14.d",
      why: "Simultaneity is the mechanism. Any answer that reduces it to documentation or a single role's task misses why it prevents wrong-site surgery." },
    { q: "Site marking should be performed by:",
      opts: [
        "The nurse receiving the patient in the OT holding area.",
        "The operating surgeon, before the patient enters the theatre.",
        "The anaesthetist during the pre-anaesthetic check.",
        "Any member of the surgical team, provided it is verified at time-out."],
      a: 1, ref: "COP.14.d",
      why: "It must be the person who will operate, and before the patient is anaesthetised so the patient can participate in verification." },
    { q: "COP.14.d is asterisked. Practically, this means the organisation must:",
      opts: [
        "Report all wrong-site events to NABH within 24 hours.",
        "Maintain a written SOP for preventing wrong-site, wrong-patient, wrong-procedure events.",
        "Achieve 100% checklist compliance before accreditation.",
        "Have a dedicated safety officer present in every theatre."],
      a: 1, ref: "COP.14.d",
      why: "The asterisk mandates documentation of the process. The other options are inventions or conflate the requirement with performance targets." },
    { q: "Which evidence best demonstrates the time-out is genuinely performed?",
      opts: [
        "100% of checklists in the file are complete and signed.",
        "Direct observation of cases plus a documented observational audit.",
        "A staff training register showing all OT staff were trained.",
        "The OT register showing no adverse events this year."],
      a: 1, ref: "COP.14.c",
      why: "Only observation distinguishes practice from paperwork. Complete forms and clean event registers are precisely what a poorly-performed time-out also produces." },
    { q: "The surgeon argues the team 'knows the case, it's a routine scope.' This is:",
      opts: [
        "Reasonable for low-risk elective procedures.",
        "Unacceptable — familiarity is a recognised contributor to wrong-site events.",
        "Acceptable if the site is already marked.",
        "Acceptable provided the checklist is completed afterwards."],
      a: 1, ref: "COP.14.d",
      why: "Routine cases are exactly where wrong-site events cluster, because vigilance drops. The standard makes no exemption for familiarity." }
  ],
  sop: { name: "Surgical Safety / Wrong-Site Prevention SOP",
    must: ["checklist", "time out", "sign in", "sign out", "site marking", "identity", "count"],
    bonus: ["who marks", "team present", "verbal", "audit", "observation", "anaesthesia", "specimen"] },
  nc: "The surgical safety time-out was recorded as complete but was not performed as a simultaneous team pause; observation showed key team members absent at the time of ticking.",
  capa: "Immediate: brief all OT teams that the time-out requires a verbal, all-stop pause with every team member present. Preventive: appoint a checklist coordinator per case, introduce monthly unannounced observational audits of the time-out (not file audits), and report compliance to the OT & CSSD Committee."
},

/* ---------- 5. MODERATE-HARD ---------- */
{
  id: "s5", level: "Moderate-Hard", chapter: "FMS",
  title: "The drill everyone passed",
  brief: "The fire safety file is well maintained. It shows two mock drills this year, both with attendance sheets, photographs and a completion report stating 'drill conducted successfully, all staff evacuated within 4 minutes.' Extinguishers carry current inspection tags. During the ward round, you ask a housekeeping aide what she would do if she saw smoke. She says she would 'call the supervisor and wait.'",
  questions: [
    { q: "What does this contrast reveal?",
      opts: [
        "The drills were conducted but training effectiveness was not achieved.",
        "The drill records have been falsified.",
        "Housekeeping staff were not included in the drills.",
        "The extinguisher inspection tags are unreliable."],
      a: 0, ref: "FMS.7.c",
      why: "You cannot conclude falsification from one interview, and you don't yet know she was excluded. What you CAN evidence is that training did not produce competence — which is the finding." },
    { q: "Under RACE, the first action on discovering fire is:",
      opts: [
        "Raise the alarm so the response team is mobilised.",
        "Rescue anyone in immediate danger.",
        "Confine the fire by closing doors and windows.",
        "Extinguish the fire if it is small and contained."],
      a: 1, ref: "FMS.7.a",
      why: "R comes first — Rescue. Many candidates choose Alarm because it feels procedurally correct, but life safety precedes notification." },
    { q: "Under PASS, 'A' stands for:",
      opts: [
        "Alert the fire response team before discharging.",
        "Aim the nozzle at the base of the flames.",
        "Assess whether the fire is small enough to fight.",
        "Aim the nozzle at the centre of the flames."],
      a: 1, ref: "FMS.7.a",
      why: "Base, not centre — option 4 changes one word and reverses the technique's effectiveness. Options 1 and 3 are sensible actions but are not what the A denotes." },
    { q: "The drill report says 'conducted successfully.' A rigorous drill report should instead record:",
      opts: [
        "The number of staff who attended and the time taken.",
        "What went wrong, who did not respond correctly, and the actions arising.",
        "Photographic evidence and the fire officer's signature.",
        "Confirmation that all extinguishers were checked afterwards."],
      a: 1, ref: "FMS.7.c",
      why: "A drill that finds nothing wrong has not been analysed. Assessors treat uniformly 'successful' drill reports as evidence the drill was not evaluated." },
    { q: "The most defensible corrective action is:",
      opts: [
        "Repeat the drill with all housekeeping staff included.",
        "Add a competency check after training, with re-training for those who fail.",
        "Display RACE and PASS posters in every corridor.",
        "Increase drill frequency from twice to four times a year."],
      a: 1, ref: "FMS.7.c",
      why: "The gap is competence, so the fix must verify competence. More drills, posters and attendance alone repeat the same unverified cycle." },
    { q: "The aide's answer would be acceptable if:",
      opts: [
        "She is a contract employee rather than hospital staff.",
        "It would not be acceptable — every person on the premises must know the initial response.",
        "Her role does not involve patient care.",
        "The supervisor is stationed within the same ward."],
      a: 1, ref: "FMS.7.b",
      why: "Fire response applies to everyone on the premises, including contract and non-clinical staff. The distractors all offer plausible-sounding exemptions that do not exist." }
  ],
  sop: { name: "Fire Safety & Emergency Evacuation SOP",
    must: ["race", "pass", "evacuation", "alarm", "extinguisher", "drill", "assembly", "training"],
    bonus: ["horizontal evacuation", "vertical", "fire exit", "competency", "roles", "code red", "patient triage"] },
  nc: "Fire safety training was conducted and documented, but effectiveness was not verified — a staff member could not describe the correct initial response to fire.",
  capa: "Immediate: re-brief the ward and confirm understanding by questioning, not attendance. Preventive: introduce a post-training competency check (verbal or scenario-based) for every staff member including contract and support staff; change drill reporting to record failures and actions rather than a pass statement; re-test annually and track a competency-pass indicator."
},

/* ---------- 6. HARD ---------- */
{
  id: "s6", level: "Hard", chapter: "PSQ",
  title: "The incident that closed itself",
  brief: "An incident report from four months ago describes a patient fall with a minor head injury. The form is complete. The 'action taken' box reads: 'Staff counselled. Patient monitored. Family informed.' The incident is marked CLOSED. Quality indicator data shows the ward's fall rate has risen from 0.8 to 1.6 per 1,000 patient-days over the same period.",
  questions: [
    { q: "The most serious deficiency is:",
      opts: [
        "The incident was closed without root-cause analysis or preventive action.",
        "The incident was not reported to the Quality Department within 24 hours.",
        "The patient's family was informed before the investigation concluded.",
        "The fall rate indicator was not reported to the governing body."],
      a: 0, ref: "PSQ.7.b",
      why: "'Staff counselled' is containment, not corrective action, and there is no preventive element at all. The other options may be true but are not evidenced by what you were given." },
    { q: "The rising fall rate alongside a closed incident indicates:",
      opts: [
        "The indicator is measuring a different population.",
        "The corrective action taken was ineffective and the loop was never re-checked.",
        "The reporting rate has improved, which raises the measured rate.",
        "Seasonal variation that requires no action."],
      a: 1, ref: "PSQ.2.i",
      why: "Option 3 is a genuinely plausible confounder an assessor would consider — but here the incident was CLOSED with no verification, so the unverified-closure explanation is the defensible finding." },
    { q: "Closing a CAPA legitimately requires:",
      opts: [
        "Sign-off by the department head and the quality manager.",
        "Evidence that the action was implemented AND that it worked.",
        "Completion of all actions listed in the action plan.",
        "Confirmation that the event has not recurred within 30 days."],
      a: 1, ref: "PSQ.7.c",
      why: "Implementation without effectiveness verification is the single most common CAPA failure. Sign-offs and action completion are steps, not proof of effect." },
    { q: "'Staff counselled' as a corrective action is weak because:",
      opts: [
        "It is not documented in the personnel file.",
        "It addresses the individual rather than the system that permitted the event.",
        "It should have been done by HR rather than the ward in-charge.",
        "It was not accompanied by a written warning."],
      a: 1, ref: "PSQ.7.b",
      why: "This is the person-versus-system distinction again, at CAPA level. Options 1, 3 and 4 all accept the premise that disciplining the individual is the right axis." },
    { q: "PSQ.7.a is asterisked. The organisation must therefore have:",
      opts: [
        "An incident management system, documented in writing.",
        "A sentinel event reporting agreement with NABH.",
        "A quality manager holding a recognised quality certification.",
        "An electronic incident reporting platform."],
      a: 0, ref: "PSQ.7.a",
      why: "The asterisk requires a documented system. It does not mandate a particular technology or an external reporting agreement." },
    { q: "Which single indicator best tests whether incident reporting is healthy?",
      opts: [
        "The number of incidents reported per month, trending down.",
        "The reporting rate including near misses, trending up, with CAPA closure verified.",
        "The proportion of incidents closed within 30 days.",
        "The number of sentinel events, held at zero."],
      a: 1, ref: "PSQ.7.d",
      why: "Falling reports usually means falling reporting, not rising safety. Fast closure without verification is the exact failure in this scenario. Zero sentinel events is a target, not a measure of reporting health." }
  ],
  sop: { name: "Incident Reporting & CAPA SOP",
    must: ["incident", "near miss", "reporting", "root cause", "corrective", "preventive", "closure", "timeframe"],
    bonus: ["no blame", "sentinel", "effectiveness", "verification", "trend", "committee", "feedback", "rca"] },
  nc: "An incident was closed without root-cause analysis, preventive action or verification of effectiveness; the related indicator subsequently deteriorated without triggering review.",
  capa: "Immediate: re-open the incident, conduct RCA and identify the system factors behind the fall. Preventive: redefine CAPA closure to require documented effectiveness verification before closing; link incident closure to the related indicator trend; audit a sample of closed incidents quarterly at the Quality Committee and track 'CAPA closed with verified effectiveness' as an indicator."
},

/* ---------- 7. HARD ---------- */
{
  id: "s7", level: "Hard", chapter: "HRM",
  title: "The locum who never was verified",
  brief: "A locum anaesthetist has covered weekend lists for six months. His personnel file contains a CV, a photocopy of a medical degree, and an appointment letter. There is no primary-source verification of his registration, no privileging document, and no record of his scope of practice being defined. The Medical Superintendent says 'he's known to us, he trained here.'",
  questions: [
    { q: "The core finding is:",
      opts: [
        "The locum's qualifications were not verified from the primary source.",
        "The locum was appointed without a formal interview process.",
        "The locum's personnel file is incomplete.",
        "The locum has been working excessive weekend hours."],
      a: 0, ref: "HRM.11.a",
      why: "Option 3 is true but too vague to be actionable. The specific, citable failure is absence of primary-source verification — the file being 'incomplete' is the symptom." },
    { q: "Privileging differs from credentialing in that privileging:",
      opts: [
        "Verifies that the qualifications presented are genuine.",
        "Defines what specific clinical activities the individual may perform.",
        "Confirms the individual holds current professional indemnity.",
        "Records the individual's employment terms and remuneration."],
      a: 1, ref: "HRM.11.b",
      why: "Credential = are you who you say you are. Privilege = what are you permitted to do here. Conflating them is the most common error in this area." },
    { q: "'He trained here, we know him' is:",
      opts: [
        "Acceptable as internal verification, if recorded.",
        "Not acceptable — familiarity does not substitute for documented verification.",
        "Acceptable for locums but not for permanent staff.",
        "Acceptable if countersigned by the Medical Superintendent."],
      a: 1, ref: "HRM.11.a",
      why: "Each distractor offers a plausible-sounding shortcut. The standard requires documented verification regardless of personal knowledge or seniority of the voucher." },
    { q: "The risk this creates is best described as:",
      opts: [
        "A documentation gap that will attract a Non-Conformity.",
        "A patient-safety and legal exposure — unverified practitioners may be practising outside a defined scope.",
        "A human resources record-keeping deficiency.",
        "A delay in the accreditation timeline."],
      a: 1, ref: "HRM.11.a",
      why: "Assessors want to see that the team understands WHY the requirement exists. Framing it as paperwork (options 1, 3, 4) is itself a maturity signal." },
    { q: "Credentialing must be repeated:",
      opts: [
        "Only when the practitioner changes department.",
        "At defined intervals and on renewal of registration, not once at hiring.",
        "Every three years for all clinical staff.",
        "Only if a complaint is raised against the practitioner."],
      a: 1, ref: "HRM.11.c",
      why: "Registration lapses. A one-time check at hiring leaves an open-ended risk — the element requires a re-verification cycle." },
    { q: "Which evidence would satisfy an assessor here?",
      opts: [
        "A signed declaration from the practitioner confirming his registration is current.",
        "A verification record from the issuing council, plus a signed privileging document defining scope.",
        "The original degree certificate held in the file.",
        "An attendance record showing his weekend duty roster."],
      a: 1, ref: "HRM.11.b",
      why: "Self-declaration and original documents in a file are not primary-source verification. Verification means confirmation obtained FROM the issuing authority." }
  ],
  sop: { name: "Credentialing & Privileging SOP",
    must: ["credential", "privileg", "verification", "registration", "scope", "renewal", "committee"],
    bonus: ["primary source", "locum", "temporary", "re-privileging", "interval", "performance", "suspension"] },
  nc: "A locum anaesthetist has practised for six months without primary-source verification of registration and without a documented privileging record defining scope of practice.",
  capa: "Immediate: suspend independent practice pending verification; obtain primary-source confirmation from the council and issue a privileging document. Preventive: apply the credentialing SOP to locum, visiting and contract practitioners identically to permanent staff; institute a pre-duty checklist that blocks roster allocation until verification is on file; audit all clinical personnel files within 60 days and re-verify on a defined cycle."
},

/* ---------- 8. HARD ---------- */
{
  id: "s8", level: "Hard", chapter: "IMS",
  title: "Two versions of the truth",
  brief: "Reviewing a discharged inpatient record, you find the nursing notes record a penicillin allergy on admission. The discharge summary lists 'no known allergies.' The patient received a cephalosporin during the stay without reaction. The record has a unique identifier and is otherwise complete. The MRD reports 94% discharge-summary completion within 24 hours.",
  questions: [
    { q: "The most significant finding is:",
      opts: [
        "The discharge summary was completed within 24 hours but contains an error.",
        "The medical record contains contradictory clinical information, compromising continuity of care.",
        "The patient was given a cephalosporin despite a documented penicillin allergy.",
        "The nursing notes and medical notes are not integrated."],
      a: 1, ref: "IMS.4.a",
      why: "Option 3 is tempting and clinically real, but the assessable, evidenced failure is that the record contradicts itself and the discharge summary carries the wrong information forward." },
    { q: "Why does the contradiction matter most at discharge?",
      opts: [
        "Because the discharge summary is audited for completeness.",
        "Because the summary is what the next care provider will rely on.",
        "Because the summary is a statutory document.",
        "Because incomplete summaries delay insurance settlement."],
      a: 1, ref: "IMS.4.b",
      why: "Continuity of care is the purpose. Audit, statute and billing are consequences, not the reason the element exists." },
    { q: "The 94% completion rate is:",
      opts: [
        "Strong evidence that medical record processes are effective.",
        "A measure of timeliness that says nothing about accuracy.",
        "Below the acceptable benchmark and itself a finding.",
        "Unverifiable without access to the hospital information system."],
      a: 1, ref: "IMS.7.a",
      why: "This is a recurring assessor theme: organisations measure what is easy to count. Timeliness and accuracy are different constructs." },
    { q: "The medical record review committee should have detected this by:",
      opts: [
        "Reviewing 100% of discharge summaries before release.",
        "Auditing a representative sample for internal consistency, not just completeness.",
        "Cross-checking summaries against the pharmacy dispensing record.",
        "Requiring consultant countersignature on every summary."],
      a: 1, ref: "IMS.7.a",
      why: "100% review is not feasible and not required; the element expects a structured sample audit that tests content quality, including consistency." },
    { q: "Which is the strongest preventive control?",
      opts: [
        "Retrain doctors on discharge summary completion.",
        "Make allergy status a mandatory field that auto-populates from the admission record.",
        "Add a second signature line to the discharge summary.",
        "Increase the audit sample size from 5% to 10%."],
      a: 1, ref: "IMS.4.a",
      why: "Design the inconsistency out. Retraining, signatures and larger samples all still depend on someone noticing." },
    { q: "If the patient had reacted to the cephalosporin, this would additionally become:",
      opts: [
        "A medication error requiring reporting and RCA under the incident system.",
        "A documentation deficiency only, since the drug was correctly prescribed.",
        "A pharmacy dispensing error.",
        "A consent-related deficiency."],
      a: 0, ref: "PSQ.7.a",
      why: "Assessors probe whether teams can trace an issue across chapters — documentation failure becoming a patient-safety incident triggers the incident system." }
  ],
  sop: { name: "Medical Record Documentation & Review SOP",
    must: ["medical record", "discharge summary", "allergy", "review", "audit", "completeness", "retention", "identifier"],
    bonus: ["consistency", "authentication", "legibility", "confidentiality", "sample", "committee", "correction"] },
  nc: "The medical record contained contradictory allergy information between the nursing notes and the discharge summary; record review monitors timeliness but not content accuracy or internal consistency.",
  capa: "Immediate: correct the discharge summary per the record-correction procedure and inform the patient's next care provider. Preventive: make allergy status a mandatory field carried forward from admission; expand the Medical Record Review Committee audit tool to test internal consistency (allergy, diagnosis, medication) on a representative monthly sample; report a 'record consistency' indicator alongside completion timeliness."
},

/* ---------- 9. HARDEST ---------- */
{
  id: "s9", level: "Hardest", chapter: "IPC",
  title: "A cluster nobody called an outbreak",
  brief: "Microbiology data shows four cases of carbapenem-resistant Klebsiella in the same ICU over 19 days. Each was reported individually to the treating unit. Surveillance data was compiled monthly and presented at the quarterly Infection Control Committee, which met three weeks after the fourth case. No outbreak was declared. Hand-hygiene compliance in that ICU was 71% that month against a target of 80%.",
  questions: [
    { q: "The central failure is:",
      opts: [
        "Hand-hygiene compliance fell below the target in that ICU.",
        "Surveillance data was collected but not analysed in a time frame that permitted intervention.",
        "The Infection Control Committee meets only quarterly.",
        "Four cases in 19 days was not sufficient to declare an outbreak."],
      a: 1, ref: "IPC.6.b",
      why: "Every other option is a contributing factor. The failure that connects them is that surveillance existed as data collection rather than as an early-warning function." },
    { q: "Surveillance is required to be:",
      opts: [
        "Comprehensive across all clinical areas and all organisms.",
        "Targeted and ongoing, with defined triggers for action.",
        "Conducted by an external agency to ensure objectivity.",
        "Reported to the state health authority monthly."],
      a: 1, ref: "IPC.6.a",
      why: "Comprehensive surveillance of everything is neither required nor achievable; the element expects targeted surveillance with action thresholds." },
    { q: "The 71% hand-hygiene compliance in that ICU should have:",
      opts: [
        "Been recorded and reviewed at the next quarterly meeting.",
        "Triggered documented corrective action at the time it was measured.",
        "Been excluded as an outlier pending re-measurement.",
        "Prompted retraining of the ICU nursing team."],
      a: 1, ref: "IPC.6.d",
      why: "Option 4 is a reasonable action but option 2 is what the standard requires — a defined response when a monitored indicator breaches its threshold. Assessors fail the open loop, not the dip." },
    { q: "An assessor asks 'at what point would you have declared an outbreak?' The best answer is:",
      opts: [
        "When cases exceed the historical baseline for that unit and organism, per our defined threshold.",
        "When five or more cases occur within one month.",
        "When the Infection Control Committee reviews the data and agrees.",
        "When the treating consultant raises a concern."],
      a: 0, ref: "IPC.6.c",
      why: "A defined, baseline-referenced threshold is the mature answer. Fixed numbers, committee consensus and clinician instinct are all reactive and undefined." },
    { q: "Which action would most reduce recurrence?",
      opts: [
        "Increase hand-hygiene audit frequency in the ICU to weekly.",
        "Move to real-time surveillance review with defined escalation triggers and an outbreak SOP.",
        "Convene the Infection Control Committee monthly instead of quarterly.",
        "Implement contact precautions for all ICU admissions."],
      a: 1, ref: "IPC.6.b",
      why: "Options 1 and 3 improve cadence but keep the same reactive structure. Option 4 is disproportionate. Only option 2 changes surveillance from retrospective to actionable." },
    { q: "In the assessor's report, this most likely appears as:",
      opts: [
        "An observation, since no patient harm was demonstrated.",
        "A Non-Conformity against a Core element, given the systemic surveillance failure.",
        "A recommendation for improvement in the next surveillance cycle.",
        "A minor NC, as the data was ultimately reviewed."],
      a: 1, ref: "IPC.6.b",
      why: "Delayed detection of a resistant-organism cluster in ICU is a systemic failure of a Core requirement. Framing it as an observation or minor issue understates it." }
  ],
  sop: { name: "Infection Surveillance & Outbreak Management SOP",
    must: ["surveillance", "outbreak", "threshold", "baseline", "notification", "isolation", "escalation", "review"],
    bonus: ["cluster", "multidrug", "resistant", "contact precautions", "cohorting", "environmental", "root cause", "real time"] },
  nc: "Surveillance data identifying a cluster of carbapenem-resistant organisms in ICU was not analysed or escalated in a time frame permitting intervention; no outbreak threshold was defined and a below-target hand-hygiene compliance result triggered no documented action.",
  capa: "Immediate: declare and investigate the cluster retrospectively, implement contact precautions and cohorting, and conduct environmental sampling. Preventive: define outbreak thresholds referenced to unit-level baselines; move surveillance review to real-time/weekly with named escalation authority; mandate documented corrective action whenever a monitored indicator breaches threshold; report cluster-detection-to-action interval as an indicator to the Infection Control Committee."
},

/* ---------- 10. HARDEST ---------- */
{
  id: "s10", level: "Hardest", chapter: "ROM",
  title: "The quality programme on paper",
  brief: "The quality manual is impressive: 42 indicators defined, a full committee structure, and a quality policy signed by the Managing Director. Reviewing minutes, you find the Quality Committee met twice this year against a stated quarterly frequency. Of the 42 indicators, 11 have data for the last two quarters. Three indicators have breached their threshold for three consecutive months with no recorded action. The Managing Director tells you quality is 'the quality manager's department.'",
  questions: [
    { q: "The most fundamental finding is:",
      opts: [
        "The Quality Committee did not meet at its stated frequency.",
        "Leadership has not assumed accountability for the quality programme.",
        "Only 11 of 42 defined indicators are being collected.",
        "Threshold breaches did not trigger corrective action."],
      a: 1, ref: "ROM.6.a",
      why: "Options 1, 3 and 4 are all real findings — but they are symptoms of the same root: quality is delegated rather than governed. Assessors look for the causal finding." },
    { q: "Defining 42 indicators and collecting 11 suggests:",
      opts: [
        "An overly ambitious indicator set that should be rationalised.",
        "That indicator selection was not linked to feasibility or to actual use.",
        "That data collection resources are inadequate.",
        "That the remaining 31 indicators are not clinically relevant."],
      a: 1, ref: "PSQ.3.a",
      why: "Option 1 is the action that may follow, but the finding is that indicators were defined without regard to whether they would be collected and used — a documentation exercise." },
    { q: "Three indicators breaching threshold for three months with no action means:",
      opts: [
        "The thresholds were set unrealistically.",
        "The monitoring loop is open — measurement occurs without response.",
        "The data is unreliable and requires validation.",
        "The indicators should be escalated to the governing body."],
      a: 1, ref: "PSQ.2.i",
      why: "Each distractor is a possible next step, but the finding itself is the open loop. This is the single most repeated concept across a NABH assessment." },
    { q: "'Quality is the quality manager's department' is a finding against:",
      opts: [
        "Responsibility of Management — leadership accountability for quality and safety.",
        "Human Resource Management — role definition and job description.",
        "Patient Safety & Quality — programme structure.",
        "Information Management — reporting lines."],
      a: 0, ref: "ROM.6.a",
      why: "The statement is about governance, not structure or staffing. Mapping a finding to the correct chapter is a core assessor skill." },
    { q: "The strongest evidence that leadership owns quality would be:",
      opts: [
        "A quality policy signed by the Managing Director.",
        "Minutes showing leadership reviewed indicator trends and directed specific actions with owners and dates.",
        "The Managing Director chairing the Quality Committee.",
        "Budget allocation for the quality department."],
      a: 1, ref: "ROM.6.b",
      why: "Signatures, chairs and budgets are structural. Only documented decision-making on real data demonstrates ownership in practice." },
    { q: "Facing this pattern across chapters, an assessor would most likely conclude:",
      opts: [
        "Several isolated Non-Conformities requiring individual CAPAs.",
        "A systemic weakness in the quality management system requiring a governance-level response.",
        "That the organisation is not yet ready to be assessed.",
        "That documentation is adequate but implementation is lagging."],
      a: 1, ref: "ROM.6.a",
      why: "Option 4 is a common but shallow framing — 'implementation lag' implies time will fix it. Recurring open loops across chapters point to governance, which is what the report should say." }
  ],
  sop: { name: "Quality Management System / Quality Programme SOP",
    must: ["quality", "indicator", "committee", "review", "threshold", "corrective", "responsibility", "frequency"],
    bonus: ["governance", "leadership", "benchmark", "data validation", "capa", "minutes", "accountability", "escalation"] },
  nc: "The quality programme is documented but not governed — the Quality Committee met below its stated frequency, most defined indicators are not collected, sustained threshold breaches triggered no action, and leadership does not demonstrate accountability for quality outcomes.",
  capa: "Immediate: convene the Quality Committee, review the three breached indicators and assign owners and dates for corrective action. Preventive: rationalise the indicator set to those that will genuinely be collected and used; define escalation rules that trigger automatically on threshold breach; place quality indicator review as a standing agenda item at the governing-body meeting with documented decisions; report committee-meeting adherence and 'breaches with action taken within 30 days' as governance indicators."
}

];
