/* AQcredix — Today's Quiz question bank.
 *
 * Shape:
 *   { id, q, options:[4 strings], a: <index of correct option>, why: "explanation" }
 *
 * Rules followed when authoring:
 *   - Every question is a scenario, not a definition lookup.
 *   - All four options are plausible actions a real quality manager might take.
 *   - The wrong answers are wrong for a *reason* that is explained in `why`,
 *     usually "defensible but not the FIRST thing" or "treats the symptom".
 *   - `why` is shown after answering, so the quiz teaches rather than just scores.
 *
 * To extend: add objects to any department's `questions` array. The engine
 * reads pool length at runtime — no engine change needed.
 */
window.AQ_QUIZ_BANK = {
  departments: [

    {
      id: "ipc",
      name: "Infection Prevention & Control",
      chapter: "IPC",
      questions: [
        {
          id: "ipc01",
          q: "Your monthly surveillance shows CLABSI rate in the medical ICU has risen from 1.8 to 4.6 per 1000 line-days over two months. Insertion bundle compliance audits report 98%. What is the most defensible first action?",
          options: [
            "Retrain all ICU nurses on insertion bundle technique",
            "Validate the audit method itself — check who audits, when, and whether maintenance is being observed at all",
            "Switch to antimicrobial-impregnated catheters across the unit",
            "Escalate to the Infection Control Committee for a formal root cause analysis"
          ],
          a: 1,
          why: "A 98% compliance figure sitting next to a tripled infection rate is a data-integrity signal, not a clinical one. Most insertion-bundle audits observe insertion only, while CLABSI is driven heavily by maintenance — hub disinfection, dressing integrity, line necessity. Retraining or changing the device acts on an unverified cause. Escalating to committee is correct eventually, but you would be taking them a number you cannot defend."
        },
        {
          id: "ipc02",
          q: "A nurse sustains a needlestick from a patient with unknown HIV/HBV status at 2 am. The needle was hollow-bore and visibly blood-filled. Which sequence is correct?",
          options: [
            "Wash the site, report to the supervisor in the morning, test the source patient after consent, then start PEP if indicated",
            "Wash the site, obtain baseline testing of the nurse, start PEP immediately, then seek source-patient consent and testing",
            "Squeeze the site to express blood, apply spirit, report to the Infection Control Nurse the next working day",
            "Wash the site, wait for the source patient's HIV result before any prophylaxis decision"
          ],
          a: 1,
          why: "HIV post-exposure prophylaxis is time-critical — ideally within hours, and its benefit falls sharply with delay. A high-risk exposure means you start PEP and reconcile later; you never hold prophylaxis waiting on a source result. Options A and D both introduce a fatal delay. Squeezing the wound is actively contraindicated — it increases local trauma and inoculation."
        },
        {
          id: "ipc03",
          q: "During an internal round you find a multi-dose vial of insulin on the ward counter, opened, undated, with a needle left in the septum. The nurse says it is used for one patient only. What does this most represent?",
          options: [
            "A medication-storage non-conformity for the pharmacy department",
            "An acceptable practice since the vial is single-patient",
            "An infection control breach requiring immediate discard, plus a systems check of whether this is the unit norm",
            "A documentation gap — the vial simply needed a date label"
          ],
          a: 2,
          why: "The retained needle turns the vial into an open conduit to the environment regardless of single-patient use, so the vial goes immediately. The trap in this question is scope: writing it up as a labelling gap or handing it to pharmacy treats one vial. The right instinct is to ask whether every vial on the unit looks like this, because a needle left in a septum is almost never an isolated act."
        },
        {
          id: "ipc04",
          q: "Environmental surveillance of your OT air sampling returns counts above your defined limit for the second consecutive month. Surgeries are running normally and no surgical site infections have been reported. What should drive your decision?",
          options: [
            "No SSIs means no problem — continue monitoring and re-sample next month",
            "Stop all elective surgery in that theatre until counts are within limits",
            "Investigate the engineering cause (filters, air changes, pressure differentials, door discipline) while continuing to monitor SSI as a separate outcome",
            "Increase the frequency of fumigation until the counts fall"
          ],
          a: 2,
          why: "Air counts and SSI rates are a process measure and an outcome measure, and the outcome lags the process. Waiting for infections to appear before acting is exactly backwards. Stopping elective surgery is disproportionate when you have not yet identified a cause. Fumigation is the classic wrong answer — it resets counts temporarily without touching the ventilation defect actually generating them."
        },
        {
          id: "ipc05",
          q: "A patient with suspected pulmonary TB has been in a shared six-bed ward for three days awaiting a bed in the isolation room. The isolation room is occupied by a stable patient with MRSA colonisation. What is the correct call?",
          options: [
            "Keep the arrangement — MRSA also requires isolation, so the current occupant has priority",
            "Move the TB patient to the isolation room and manage the MRSA patient with contact precautions in the open ward",
            "Discharge the MRSA patient early to free the room",
            "Give the TB patient a surgical mask and continue in the shared ward"
          ],
          a: 1,
          why: "This is a transmission-route triage question. TB is airborne and needs negative-pressure containment; MRSA colonisation is contact-spread and can be managed safely in an open ward with contact precautions and cohorting. Clinical need for the engineering control decides who gets the room, not who arrived first. Masking the TB patient in a shared ward is a stopgap for transport, not a three-day housing plan, and discharging a patient to solve a bed problem is an ethics failure."
        },
        {
          id: "ipc06",
          q: "Hand hygiene compliance in your hospital is reported at 92%. Observations are done by unit nurse-in-charges on their own staff. An external assessor is likely to challenge this figure primarily because:",
          options: [
            "92% is too low to be acceptable for accreditation",
            "The observers are not trained in WHO's five moments",
            "Self-observation by a line manager on their own team introduces a structural bias, and the denominator method is not stated",
            "The sample size is not reported monthly"
          ],
          a: 2,
          why: "The vulnerability is who is holding the clipboard. A nurse-in-charge auditing her own team has an incentive aligned with a good number, and the Hawthorne effect compounds it. An assessor will ask how opportunities were counted and whether an independent observer ever validates the figure. The number being high is not the problem; being unverifiable is."
        },
        {
          id: "ipc07",
          q: "Biomedical waste segregation audits show consistent errors — general waste in yellow bags — concentrated in the evening shift across multiple wards. Corrective training was done twice with no improvement. What is the most likely real cause to investigate?",
          options: [
            "Staff attitude and lack of accountability",
            "Insufficient training content",
            "A structural cause — bin availability, housekeeping staffing ratios, or bag supply at that hour",
            "Absence of a written biomedical waste policy"
          ],
          a: 2,
          why: "When a failure is time-bound and location-independent, it is a systems fingerprint, not a knowledge one. Twice-failed training is your evidence that people already know what to do. Look for what changes at that hour: reduced housekeeping, bins overflowing with no replacement bags, or a single porter covering four wards. Attributing it to attitude is the least useful conclusion available and the most commonly written one."
        },
        {
          id: "ipc08",
          q: "Your antibiotic policy specifies restricted use of meropenem with prior approval. Audit shows 40% of meropenem prescriptions have no documented approval, mostly initiated at night. The most effective control is:",
          options: [
            "Circulate the antibiotic policy again to all clinicians",
            "Make meropenem physically unavailable at night from the pharmacy",
            "Introduce a 24-hour automatic stop with mandatory review by the stewardship team the next morning",
            "Report the non-compliant prescribers to the medical superintendent"
          ],
          a: 2,
          why: "The night-time clustering tells you the approver is not available, not that prescribers are defying policy. Blocking access can cause real harm — someone with septic shock at 2 am may genuinely need it. The automatic stop is the mature control: it permits the urgent dose, then forces the review to happen, converting an unenforceable prior approval into a reliable post-approval. Re-circulating policy and naming prescribers both address a compliance problem that is really an access problem."
        },
        {
          id: "ipc09",
          q: "A cluster of three post-operative wound infections with the same organism appears in one surgeon's cases over five weeks. What is the first evidence you should gather?",
          options: [
            "The surgeon's hand hygiene compliance and glove technique",
            "Antibiogram and typing of the three isolates, plus a line list of all cases in that OT, that shift, with those instrument sets",
            "The patients' comorbidity profiles to establish whether they were high-risk",
            "Sterilisation logs for the autoclave used for that surgeon's sets"
          ],
          a: 1,
          why: "Before you can investigate a cluster, you must establish that it is one. Confirming the isolates are genuinely related and building a line list defines the denominator and reveals what the three cases actually share — which may turn out to be the theatre, the shift, or an instrument set rather than the surgeon. Options A and D are single hypotheses tested before you know the shape of the problem, and starting with the surgeon risks a personnel conclusion the data cannot yet support."
        },
        {
          id: "ipc10",
          q: "During an assessor round, a CSSD technician cannot demonstrate the biological indicator records for one autoclave cycle from three weeks ago. The chemical indicator strips for that cycle are available and correct. What is the assessor's actual concern?",
          options: [
            "That the cycle was probably unsuccessful and patients were exposed",
            "That the sterilisation process cannot be retrospectively verified, and traceability from cycle to patient is therefore broken",
            "That the technician is inadequately trained",
            "That chemical indicators are being used instead of biological ones"
          ],
          a: 1,
          why: "Chemical indicators show the pack met physical conditions; they do not confirm sterility. The missing biological record does not prove the cycle failed — it proves you cannot prove it passed. That is a traceability defect, and its consequence is that if a problem ever surfaces you cannot identify which patients received items from that load. Concluding harm occurred overstates the evidence just as badly as dismissing it."
        },
        {
          id: "ipc11",
          q: "Your hospital's ICU has a 12-bed capacity with two isolation rooms. During a surge you are asked to cohort four patients with carbapenem-resistant Klebsiella. What is the sound approach?",
          options: [
            "Distribute them across the unit to avoid concentrating the organism",
            "Cohort all four in a defined geographic zone with dedicated nursing staff and dedicated equipment",
            "Place two in the isolation rooms and the other two in general beds",
            "Transfer two patients to another hospital"
          ],
          a: 1,
          why: "Cohorting works because it contains both the patients and the staff and equipment that touch them. Dedicated nursing is the part most often dropped, and it is the part that matters — a nurse moving between a cohort bed and a clean bed defeats the geography entirely. Distributing them multiplies the exposed surface. Splitting between isolation and general beds without dedicated staffing gives you the appearance of control without the mechanism."
        },
        {
          id: "ipc12",
          q: "A visiting assessor asks your infection control nurse to explain how the hospital decides which surveillance indicators to monitor. The strongest possible answer would reference:",
          options: [
            "The indicators listed in the accreditation standard",
            "The hospital's own risk profile, case mix, and historical infection data, reviewed periodically by the committee",
            "Indicators used by comparable hospitals in the region",
            "All device-associated infections, as these are the international standard"
          ],
          a: 1,
          why: "Surveillance is meant to be risk-based, and the standard expects you to justify your choices, not recite theirs. A hospital with no neurosurgery has little reason to expend effort on ventriculitis surveillance. Answering from the standard, from peers, or from a universal list all signal the same weakness: the programme was adopted rather than designed, and cannot adapt when the case mix changes."
        }
      ]
    },

    {
      id: "biomedical",
      name: "Biomedical Engineering",
      chapter: "FMS",
      questions: [
        {
          id: "bme01",
          q: "A defibrillator in the emergency department fails during a code. The crash cart checklist shows it was verified as functional every shift for the past month. What should the investigation prioritise?",
          options: [
            "Disciplinary review of the staff who signed the checklist",
            "Whether the checklist verifies actual discharge into a test load or merely that the unit powers on",
            "Immediate replacement of all defibrillators of that model",
            "Increasing checklist frequency to twice per shift"
          ],
          a: 1,
          why: "A daily check that only confirms the unit switches on and charges will pass a device whose output has degraded. The distinction between a presence check and a function check is the whole finding here. Increasing the frequency of a test that does not test the failure mode gives you twice as many meaningless signatures, and discipline assumes bad faith where the tool was inadequate."
        },
        {
          id: "bme02",
          q: "Preventive maintenance is 100% complete on paper for your ventilator fleet, yet two ventilators failed calibration during an unannounced check. The most probable systemic cause is:",
          options: [
            "The technicians are falsifying records",
            "PM schedules are being closed on date rather than on completed task content, with no independent verification",
            "The ventilators are beyond their useful life",
            "The PM interval is too long for that device class"
          ],
          a: 1,
          why: "100% completion is itself a suspicious number in maintenance systems — real schedules slip. The usual mechanism is not fraud but drift: the work order gets closed because the date arrived and the machine looked fine, without the calibration step being performed or recorded separately. All the other options may be true, but you cannot evaluate any of them while the completion data is unreliable."
        },
        {
          id: "bme03",
          q: "You are asked to approve the purchase of a used C-arm from another hospital at a third of the new price. What is the decisive question before approval?",
          options: [
            "Whether the price is competitive against other used units",
            "Whether the manufacturer still supports the model with spares, service, and radiation-safety certification for its remaining life",
            "Whether the radiology department wants it",
            "Whether it has fewer than a specified number of operating hours"
          ],
          a: 1,
          why: "The capital cost is the smallest number in a used-imaging decision. An unsupported model becomes unusable the first time a component fails, and radiation-emitting equipment additionally needs valid regulatory certification to be operated at all. Hours and departmental enthusiasm both become irrelevant if you cannot get a part or a licence."
        },
        {
          id: "bme04",
          q: "During a power interruption, the ICU generator starts after 45 seconds. Ventilators have internal batteries; syringe pumps in the unit do not. What is the correct conclusion?",
          options: [
            "Acceptable — the generator started within a minute",
            "The gap must be covered by UPS for life-support and infusion equipment; generator start time alone is not the relevant metric",
            "Ventilator batteries make the gap irrelevant",
            "The generator needs servicing to reduce start time to under 10 seconds"
          ],
          a: 1,
          why: "Generators are not designed to be instantaneous, which is precisely why UPS exists as the bridging layer. Framing this as a generator performance problem points you at an expensive fix for the wrong system. The real finding is that a class of critical devices — pumps delivering vasopressors, for instance — has no ride-through, and 45 seconds without a noradrenaline infusion is a clinical event."
        },
        {
          id: "bme05",
          q: "A nurse reports that a multipara monitor gives erratic SpO2 readings. Biomedical tests it, finds no fault, and returns it. It is reported again twice in the following fortnight, each time returning 'no fault found'. What should you do?",
          options: [
            "Accept the biomedical assessment and counsel the nursing staff on probe placement",
            "Condemn the monitor as unreliable and replace it",
            "Treat repeated no-fault-found as a signal in itself and investigate the use context — patient type, probe condition, cable, electrical interference at that bed position",
            "Send the monitor to the manufacturer for a full service"
          ],
          a: 2,
          why: "Three reports from users who gain nothing by complaining is data. No-fault-found usually means the test conditions do not reproduce the use conditions — a bench test with a healthy technician's finger will not reveal a probe that fails on poorly perfused patients, or interference from a specific bed position. Both dismissing the nurses and condemning the device skip the step that would actually explain it."
        },
        {
          id: "bme06",
          q: "Your equipment inventory lists 340 items. During an assessment, three devices in use in the wards are found that are not on the inventory. The core problem this reveals is:",
          options: [
            "Poor asset tagging discipline",
            "That equipment can enter clinical use without passing through acceptance testing, safety checks, and the PM schedule",
            "That the inventory needs updating more frequently",
            "That departments are purchasing equipment independently"
          ],
          a: 1,
          why: "An untagged device is a symptom; the disease is that the entry gate has a hole in it. A device that never appeared on the inventory also never had electrical safety testing, never entered a maintenance schedule, and has no history if it harms someone. Whether it arrived by donation, departmental purchase, or trial loan is a secondary question to the fact that nothing stopped it."
        },
        {
          id: "bme07",
          q: "An infusion pump is involved in an adverse event where a patient received an overdose. What must happen to the device immediately?",
          options: [
            "Return it to service after verifying it calibrates correctly",
            "Sequester the device with its settings, tubing, and consumables undisturbed, and quarantine it pending investigation",
            "Send it to the manufacturer for analysis",
            "Reset it and log the incident in the maintenance record"
          ],
          a: 1,
          why: "Everything on that pump is evidence, including the programmed rate still on the screen and the giving set attached to it. Recalibrating, resetting, or shipping it out destroys the only record that can distinguish a device malfunction from a programming error — which is the entire question the investigation exists to answer, and which also determines whether other pumps of that model are a risk."
        },
        {
          id: "bme08",
          q: "Medical gas pipeline outlets in a newly commissioned ward need verification before patient occupancy. The single most critical test is:",
          options: [
            "Flow rate at each outlet",
            "Pressure at the manifold",
            "Gas-specific identity at every outlet, confirming no cross-connection",
            "Leak testing of the pipeline"
          ],
          a: 2,
          why: "Cross-connection is the failure mode that kills, and it kills quietly — an outlet labelled oxygen delivering nitrous oxide passes a pressure test, passes a flow test, and passes a leak test. Every other check verifies that gas arrives; only identity testing verifies that the right gas arrives. This is why gas identity verification is non-negotiable before occupancy rather than one item among four."
        },
        {
          id: "bme09",
          q: "Your hospital plans to run a trial of a loaner ultrasound machine for one month before purchase. What must be in place before it touches a patient?",
          options: [
            "A signed agreement with the vendor covering the trial period",
            "Electrical safety testing, entry on the inventory as a temporary asset, user training records, and defined liability",
            "Approval from the department head requesting it",
            "Verification that the machine is new and under warranty"
          ],
          a: 1,
          why: "Loaner and demo equipment is the most common route by which unverified devices reach patients, precisely because it feels temporary and therefore exempt. It is not exempt: a device on trial can electrocute or misdiagnose exactly as effectively as one you own. The commercial agreement matters, but it is not what protects the patient in the meantime."
        },
        {
          id: "bme10",
          q: "Breakdown maintenance requests for the same suction apparatus model appear 14 times in six months across different wards. Each was repaired successfully. What should this trigger?",
          options: [
            "Nothing — each was resolved within the response time",
            "A shift to more frequent preventive maintenance for that model",
            "A fleet-level review: whether the model is fit for purpose, misused, or has a design or supply-chain defect worth escalating to the vendor",
            "Retraining of ward staff in suction apparatus use"
          ],
          a: 2,
          why: "Closing every ticket successfully can hide a pattern completely, because the metric being watched is response time rather than recurrence. Fourteen failures of one model is a fleet question, not fourteen incidents. Increasing PM or retraining users are both possible outcomes of the review, but choosing either before the review means guessing whether the fault lies in the device or the hands."
        },
        {
          id: "bme11",
          q: "A critical care ventilator is due for calibration but the unit is at full occupancy and the device is in continuous use. The correct approach is:",
          options: [
            "Defer calibration and document the reason, rescheduling when a gap appears",
            "Perform calibration in situ between patients regardless of schedule pressure",
            "Apply a documented risk-assessed deferral with a defined new date, interim verification if feasible, and authorisation at an appropriate level",
            "Remove the ventilator from service immediately at the due date"
          ],
          a: 2,
          why: "Both extremes are wrong here. Removing a working ventilator from an occupied ICU on a calendar date can harm a patient today for a theoretical risk; informally deferring it with a note creates an untracked overdue device that will still be overdue in six months. The defensible middle is a deferral that is assessed, authorised, time-bound, and visible — which an assessor will accept and an unmanaged slip will not."
        },
        {
          id: "bme12",
          q: "Which of these is the strongest evidence that your biomedical department's maintenance programme is genuinely effective?",
          options: [
            "PM completion percentage above 95%",
            "Mean time to repair under 24 hours",
            "Downtime of critical equipment trending down alongside a stable or falling breakdown rate, with no rise in deferred PM",
            "Zero equipment-related incidents reported in the last year"
          ],
          a: 2,
          why: "Each of the first two is a single metric that can be gamed — completion by closing on date, repair time by reclassifying jobs. Zero reported incidents is the weakest of all, because it is equally consistent with excellent maintenance and with a reporting culture that has stopped functioning. Effectiveness only shows up when a process measure and an outcome measure move together and a third measure confirms nothing was hidden to achieve it."
        }
      ]
    },

    {
      id: "pharmacy",
      name: "Pharmacy & Medication Safety",
      chapter: "MOM",
      questions: [
        {
          id: "phm01",
          q: "A prescription reads 'Inj. Amiodarone 150 mg IV stat'. The nurse administers it as a rapid bolus and the patient becomes profoundly hypotensive. Where does the system failure primarily sit?",
          options: [
            "With the nurse, for not knowing the correct administration rate",
            "With the prescriber, for not specifying dilution and rate for a high-alert drug",
            "With the system, for permitting a high-alert drug order to be actioned without mandatory rate and diluent fields",
            "With the pharmacy, for dispensing without a rate query"
          ],
          a: 2,
          why: "Every individual answer here has some truth in it, which is what makes them tempting. But an order form that allows a high-alert drug to be prescribed without the two parameters that determine whether it harms is a design defect that will keep producing this event with different names attached. Medication safety analysis asks what made the error possible, not who was closest to it."
        },
        {
          id: "phm02",
          q: "Look-alike sound-alike errors between Dopamine and Dobutamine have occurred twice. Your team proposes tall-man lettering on labels. What additional control most reduces residual risk?",
          options: [
            "Circulating an alert about the two drugs",
            "Physically separating storage locations so the two are never adjacent",
            "Adding both to the high-alert medication list",
            "Requiring pharmacist verification of all orders for either drug"
          ],
          a: 1,
          why: "Tall-man lettering helps a person who is reading; separation helps a person who is reaching without fully reading, which is the actual condition under which these errors happen. Ranking controls by how little they depend on human attention is the core skill being tested — alerts and list membership rely almost entirely on it, and pharmacist verification is strong but does not protect the ward stock drawer at 3 am."
        },
        {
          id: "phm03",
          q: "During a ward inspection, you find emergency drugs in the crash cart with three months' remaining shelf life, all correctly listed. The cart seal is intact and the checklist is signed daily. What is the highest-value question to ask next?",
          options: [
            "Whether the drugs will be replaced before expiry",
            "Whether the daily signature is verifying the seal only, and how anyone would know if an item were removed and the seal replaced",
            "Whether the cart contains the full approved drug list",
            "Whether the cart is locked between uses"
          ],
          a: 1,
          why: "A sealed cart with a daily signature is a good system when the signature means something. The question worth asking is what the signer actually verifies — if checking the seal is the whole check, then the contents are only as reliable as the last person to break and replace it. Expiry and list completeness matter, but they are verified at restock; seal integrity is what the daily ritual is supposed to guarantee and most often does not."
        },
        {
          id: "phm04",
          q: "A patient on warfarin is prescribed a course of fluconazole by a visiting consultant. No INR monitoring change is ordered. Your medication safety system should have:",
          options: [
            "Flagged the interaction at the point of prescribing",
            "Relied on the pharmacist to catch it at dispensing",
            "Relied on the nurse to query it at administration",
            "Caught it at the weekly clinical pharmacy review"
          ],
          a: 0,
          why: "All four points can catch an interaction, and a robust system uses several. But the earliest interception is the one that prevents the order existing rather than correcting it afterwards, and each later stage adds a chance the drug reaches the patient first. Note that the weekly review is the weakest option offered — a clinically significant interaction can produce a bleed well within seven days."
        },
        {
          id: "phm05",
          q: "Your narcotics register shows a discrepancy of one ampoule of morphine. The nurse involved says it was wasted after a partial dose but she forgot to have it witnessed. What is the correct handling?",
          options: [
            "Accept the explanation, counsel on documentation, and correct the register",
            "Report to police immediately",
            "Document the discrepancy as reported, investigate through the defined controlled-substance process, and do not retrospectively alter the register",
            "Have a second nurse counter-sign now to close the entry"
          ],
          a: 2,
          why: "The register is a legal document and a discrepancy in it is an event to be recorded, not a mistake to be tidied away. Both accepting the explanation with a correction and obtaining a retrospective witness signature produce a clean register that no longer reflects what happened — and the second of those asks a colleague to attest to something she did not see. Police involvement is a possible outcome of the investigation, not its opening move."
        },
        {
          id: "phm06",
          q: "Concentrated potassium chloride ampoules are found in a general ward stock cupboard. The nurse explains they are needed urgently sometimes. The correct response is:",
          options: [
            "Label them with a high-alert warning sticker and keep them",
            "Remove concentrated KCl from ward stock entirely and supply pre-diluted ready-to-use bags instead",
            "Restrict access to the cupboard to senior nursing staff only",
            "Add KCl to the high-alert list and require double-checking before use"
          ],
          a: 1,
          why: "Concentrated potassium is one of the very few drugs where the accepted control is elimination rather than mitigation, because the error is undetectable until it is fatal and no amount of double-checking has been shown to reliably prevent it. Warnings, access restriction, and double-checks all leave the ampoule in the building. Supplying pre-diluted bags answers the nurse's genuine clinical need without keeping the hazard on the ward."
        },
        {
          id: "phm07",
          q: "Medication reconciliation is documented on admission for 95% of patients. Audit of the actual content shows most entries list only regular prescriptions, omitting over-the-counter drugs, herbal preparations, and inhalers. What is the finding?",
          options: [
            "Compliance is acceptable at 95%",
            "The process is being completed but not performed — the form is filled without the clinical interrogation it exists to prompt",
            "Staff need training on what constitutes a medication",
            "The reconciliation form needs redesigning with explicit prompts"
          ],
          a: 1,
          why: "This is the difference between an audit of completion and an audit of quality, and it is one of the most common gaps an experienced assessor probes. Training and form redesign may both follow, but naming the finding correctly matters first: a 95% figure that measures whether a box was filled tells you nothing about whether a patient's herbal anticoagulant was ever discovered."
        },
        {
          id: "phm08",
          q: "A prescriber routinely uses the abbreviation 'U' for units in insulin orders. No error has yet occurred. Your position should be:",
          options: [
            "Monitor for errors before intervening",
            "Address it now — 'U' misread as a zero is a documented and lethal failure mode, and absence of harm so far is not evidence of safety",
            "Accept it if the prescriber's handwriting is legible",
            "Add it to the next medical staff meeting agenda"
          ],
          a: 1,
          why: "Waiting for the error is the trap, and it is phrased attractively as prudence. The 'U' abbreviation is on every do-not-use list precisely because tenfold insulin overdoses have already killed people elsewhere — you do not need your own case to justify acting. Legibility does not help when the character itself is ambiguous, and routing a known-lethal abbreviation to a meeting agenda treats urgency as a scheduling matter."
        },
        {
          id: "phm09",
          q: "Your cold chain monitoring shows a vaccine refrigerator excursion to 12°C for an unknown duration overnight. What is the correct action?",
          options: [
            "Discard all vaccines in the refrigerator immediately",
            "Continue use — most vaccines tolerate brief excursions",
            "Quarantine the stock, do not use or discard it, and seek manufacturer or authority guidance on stability for the specific products and exposure",
            "Use the stock first, before any newly received supply"
          ],
          a: 2,
          why: "Stability after an excursion is product-specific and duration-specific, and neither you nor the ward can determine it by judgement. Discarding immediately may waste viable and expensive stock; continuing use may administer inactive vaccine, which is a silent failure a patient discovers only when they contract the disease. Quarantine holds both options open until someone with the stability data decides."
        },
        {
          id: "phm10",
          q: "Nurses report that the automated dispensing cabinet's override function is used frequently for urgent doses. Override rate is 18% of all withdrawals. This indicates:",
          options: [
            "Appropriate flexibility for emergencies",
            "That pharmacist review is being bypassed at a rate that makes the review largely notional, and the causes need separating into genuine urgency versus workflow friction",
            "That nurses need retraining on the cabinet",
            "That the cabinet's drug list needs expanding"
          ],
          a: 1,
          why: "An 18% override rate cannot plausibly be 18% emergencies. What it usually reflects is turnaround time — if pharmacist verification takes 40 minutes and the patient needs the drug now, override becomes the normal path rather than the exception. The important discipline is refusing to treat the number as either acceptable or as misbehaviour until you have split it into its causes, because the fixes are completely different."
        },
        {
          id: "phm11",
          q: "A chemotherapy dose is prepared and dispensed at twice the intended dose. It is intercepted by the administering nurse before reaching the patient. How should this be classified and handled?",
          options: [
            "No harm occurred, so it needs no formal reporting",
            "As a near miss, reported and investigated with the same rigour as an event that reached the patient",
            "As a minor deviation to be logged in the pharmacy error register only",
            "As an adverse drug event"
          ],
          a: 1,
          why: "The severity of a near miss is determined by what could have happened, not by the luck of who was paying attention. A double-dose cytotoxic that got as far as the bedside means every barrier upstream of that nurse failed, and the same failure next week may meet a distracted nurse instead. Organisations that investigate near misses at full rigour are the ones that stop having the corresponding events."
        },
        {
          id: "phm12",
          q: "An assessor asks how you know your high-alert medication list is the right one for your hospital. The strongest answer is:",
          options: [
            "It follows the internationally published high-alert list",
            "It was approved by the pharmacotherapeutics committee",
            "It is derived from published lists then adjusted using our own incident data, formulary, and case mix, and reviewed at defined intervals",
            "It includes all injectable medications"
          ],
          a: 2,
          why: "Published lists are the starting point, not the answer — a hospital with a large obstetric service and one with none should not have identical high-alert lists. Committee approval speaks to authority rather than to fitness. The answer that survives follow-up questions is the one showing local evidence shaped the list and that a review mechanism exists to reshape it as your incidents and formulary change."
        }
      ]
    },

    {
      id: "emergency",
      name: "Emergency & Ambulance Services",
      chapter: "AAC",
      questions: [
        {
          id: "emr01",
          q: "Your emergency department triage audit shows 30% of patients categorised as priority 2 were later found to warrant priority 1. The triage nurses are experienced. What should you examine first?",
          options: [
            "Individual nurse competency and retraining needs",
            "The triage tool itself — whether its criteria discriminate adequately for your case mix, and whether vital signs are being measured at triage or estimated",
            "Whether the department is understaffed at triage",
            "The medical officer's re-categorisation threshold"
          ],
          a: 1,
          why: "Experienced staff systematically producing the same error points at the instrument rather than the operators. The frequent practical cause is that triage is being done on appearance because there is no time or equipment to take vitals at the front door, which makes even a good tool blind. Understaffing may be the reason vitals are skipped, but you find that by examining the process rather than by starting with the headcount."
        },
        {
          id: "emr02",
          q: "A patient in the emergency department requires admission to ICU but no bed is available in your hospital or in three nearby facilities. The correct approach to this situation is:",
          options: [
            "Keep the patient in the ED and manage as best as possible until a bed opens",
            "Provide ICU-level care in the ED with defined staffing, monitoring, and escalation, document the capacity constraint, and continue active transfer efforts with a named owner",
            "Transfer to the nearest facility regardless of its capability",
            "Admit to a general ward with additional nursing attention"
          ],
          a: 1,
          why: "The scenario is common and there is no clean answer, which is the point. What distinguishes a defensible response is that the level of care is defined and staffed rather than improvised, the constraint is recorded so the organisation can act on it, and the search for a bed has an owner rather than being everyone's assumption. Admitting to a general ward moves the patient somewhere with less monitoring, which is worse than the ED."
        },
        {
          id: "emr03",
          q: "Your ambulance service records show an average response time of 18 minutes, which meets your internal standard of 20. Complaints suggest much longer waits. What is the most likely explanation to investigate?",
          options: [
            "Complainants are exaggerating",
            "The clock start point — whether the timer begins at call receipt, at dispatch, or at vehicle movement",
            "Traffic conditions during peak hours",
            "Insufficient ambulances in the fleet"
          ],
          a: 1,
          why: "When a measured average and lived experience diverge sharply, the definition is usually doing the work. A timer that starts when the ambulance moves silently excludes call handling and dispatch delay, which is exactly the interval the caller is experiencing. Fleet size and traffic are real factors but they would show up in the measured number too; only a definitional gap hides the time entirely."
        },
        {
          id: "emr04",
          q: "An unidentified unconscious patient arrives by ambulance requiring emergency surgery. No relatives are present. What governs the decision to proceed?",
          options: [
            "Wait for relatives to arrive and provide consent",
            "Proceed under the emergency doctrine with documentation of the clinical necessity and the reason consent could not be obtained, with the required internal authorisation",
            "Obtain consent from the police officer who accompanied the patient",
            "Two doctors sign in place of the patient"
          ],
          a: 1,
          why: "Emergency treatment necessary to preserve life proceeds without consent when the patient cannot give it and no authorised person is available — but it proceeds with a documented record of why. Waiting for relatives when delay causes harm is not caution, it is an omission. Police cannot consent on a patient's behalf, and two doctors signing is a common misconception; their signatures document necessity rather than substitute for consent."
        },
        {
          id: "emr05",
          q: "Review of ED deaths shows three patients who died within four hours of arrival had documented abnormal vital signs at triage that were not escalated. What is the most effective corrective action?",
          options: [
            "Retrain triage staff on recognising abnormal vitals",
            "Implement a scored early warning system with a mandatory, defined escalation response tied to the score",
            "Increase medical officer presence in the triage area",
            "Audit all triage documentation monthly"
          ],
          a: 1,
          why: "The failure described is not recognition but escalation — the numbers were recorded, so someone saw them. Training addresses a gap that the evidence says does not exist. A scored system with a mandated response converts a judgement call into a trigger, which is what removes the possibility of an abnormal number being noted and then simply filed. Auditing afterwards detects the next occurrence rather than preventing it."
        },
        {
          id: "emr06",
          q: "A patient presenting with chest pain waits 40 minutes for an ECG. Your protocol specifies 10 minutes. Investigation shows the ECG machine was in use elsewhere. The most robust fix is:",
          options: [
            "Purchase an additional ECG machine dedicated to triage",
            "Establish a rule that the triage ECG machine is never removed from the area, plus define what happens when it fails",
            "Reinforce the 10-minute protocol with staff",
            "Move chest pain patients directly to the cardiac area"
          ],
          a: 1,
          why: "Buying a second machine looks like the obvious answer but does not stop the second machine also being borrowed. The control that holds is a rule about the resource combined with a defined fallback, because equipment shared by convenience will always migrate to wherever someone needed it last. Reinforcing a time target without addressing the physical constraint asks staff to comply with something the environment prevents."
        },
        {
          id: "emr07",
          q: "Your hospital receives eight casualties from a road accident simultaneously. The disaster plan is activated. Which failure is most likely to actually occur in the first 20 minutes?",
          options: [
            "Insufficient blood availability",
            "Communication and command ambiguity — unclear who is directing, and duplicated or missed patient assignments",
            "Shortage of trolleys and stretchers",
            "Inadequate operating theatre capacity"
          ],
          a: 1,
          why: "Physical resources are what disaster plans enumerate best, and they are rarely the first thing to fail. What fails first is coordination: several senior people each assuming they are in charge, patients assessed twice while another is not assessed at all. This is why command structure and role identification dominate credible drills, and why a plan that lists supplies but not who wears the incident commander's tabard is untested."
        },
        {
          id: "emr08",
          q: "An intoxicated patient who is medically stable insists on leaving against medical advice. What is the correct approach?",
          options: [
            "Have him sign the AMA form and allow him to leave",
            "Assess decision-making capacity in his current state, document that assessment, and detain only if capacity is absent and he is at risk",
            "Refuse to let him leave until sober",
            "Call security to escort him out"
          ],
          a: 1,
          why: "Intoxication does not automatically remove capacity, and it does not automatically preserve it either — which is why the assessment, and the record of it, is the whole answer. Taking a signature from someone who may lack capacity makes the form worthless; blanket detention is unlawful confinement if capacity is intact. The documented capacity assessment is what protects both the patient and the hospital, whichever way the decision falls."
        },
        {
          id: "emr09",
          q: "Handover from ambulance crew to ED staff is currently verbal and unstructured. Two patients in six months had critical information lost at this interface. The best control is:",
          options: [
            "Require the ambulance crew to submit a written record",
            "Adopt a structured handover format with a defined receiving person and a read-back or confirmation step",
            "Record all handovers on audio",
            "Have the ED doctor attend every ambulance arrival"
          ],
          a: 1,
          why: "A written record can be handed over and never read, which is the same failure with a paper trail. Structure fixes what is said, a named receiver fixes the diffusion of responsibility that lets everyone assume someone else took the information, and confirmation closes the loop. Audio recording captures the failure rather than preventing it, and requiring a doctor at every arrival is unaffordable in staffing terms and therefore will not hold."
        },
        {
          id: "emr10",
          q: "Your ED reports zero medication errors over 12 months, while inpatient wards report 40. The most likely interpretation is:",
          options: [
            "The ED has superior medication practices",
            "ED reporting is suppressed — likely a mix of time pressure, verbal orders normalising deviation, and no perceived benefit from reporting",
            "The ED administers fewer medications",
            "ED staff are more experienced"
          ],
          a: 1,
          why: "A high-volume, high-pressure, verbal-order-heavy environment producing zero errors is not a plausible clinical result — it is a reporting result. Treating it as excellence is the dangerous reading because it removes the impetus to look. The right response is to find out why staff do not report there, which is usually that nothing visible ever happens when they do."
        },
        {
          id: "emr11",
          q: "A patient's condition deteriorates in the ED waiting area 25 minutes after triage as priority 3. What does an adequate system require?",
          options: [
            "Faster initial triage",
            "Defined re-assessment intervals for waiting patients, with a mechanism for patients or relatives to raise concern",
            "More seating and monitoring equipment in the waiting area",
            "Reclassifying more patients to priority 2"
          ],
          a: 1,
          why: "Triage is a snapshot and patients deteriorate after it, so a system that assesses once and then waits has a structural blind spot no amount of triage speed will close. Re-assessment intervals address the clinical side and a patient-activated escalation route addresses the gap between intervals — relatives frequently notice deterioration first. Reclassifying more patients upward simply moves the queue and degrades the meaning of the categories."
        },
        {
          id: "emr12",
          q: "Which single indicator best reflects genuine emergency department quality rather than throughput?",
          options: [
            "Average length of stay in the ED",
            "Door-to-doctor time",
            "Unplanned return visits within 72 hours with admission on the return",
            "Number of patients who left without being seen"
          ],
          a: 2,
          why: "The first two measure speed, which a department can improve by moving people along faster without treating them better. Left-without-being-seen measures access and is genuinely useful, but it describes the queue rather than the care. Returning within 72 hours and needing admission is the closest available proxy for a decision that was wrong the first time, which is what clinical quality actually means here."
        }
      ]
    },

    {
      id: "ot",
      name: "Operating Theatre & Anaesthesia",
      chapter: "COP",
      questions: [
        {
          id: "ot01",
          q: "A surgical safety checklist is completed for 100% of cases. An observational study finds the sign-out step is typically done after the patient has left the theatre, by the circulating nurse alone. What is the finding?",
          options: [
            "Documentation timing error requiring a policy note",
            "The checklist is being recorded rather than performed — sign-out exists to verify counts and specimen labelling with the team present, and none of that is happening",
            "The circulating nurse needs training",
            "The checklist should be redesigned to be shorter"
          ],
          a: 1,
          why: "Sign-out done retrospectively by one person is not sign-out; it is a signature. The specific losses are concrete — instrument and swab counts confirmed with the team present, specimen labelling verified aloud, equipment problems flagged while the people involved are still in the room. A 100% completion rate that conceals this is worse than a lower rate that reflects reality, because it removes the signal that anything is wrong."
        },
        {
          id: "ot02",
          q: "A retained surgical sponge is discovered on a post-operative X-ray. The count was documented as correct at the end of surgery. Where should the investigation focus?",
          options: [
            "On the scrub nurse who performed the count",
            "On why a documented-correct count can coexist with a retained item — count methodology, interruptions, cavity packing practice, and whether counts are performed as a distinct uninterrupted task",
            "On introducing radio-frequency tagged sponges",
            "On mandatory post-operative X-rays for all cases"
          ],
          a: 1,
          why: "A count that is documented correct while an item remains inside the patient means the counting process itself does not do what everyone believes it does — commonly because it happens amid noise and interruption, or because packing placed early is not carried into the final count. Technology and universal imaging are both possible controls, but adopting either before understanding the failure buys an expensive fix for a mechanism you have not identified."
        },
        {
          id: "ot03",
          q: "Anaesthesia records for 20 cases show pre-anaesthetic assessment documented on the morning of surgery for elective cases. What is the concern?",
          options: [
            "The assessment should be documented by the surgeon",
            "Same-day assessment for elective surgery leaves no time to act on findings — optimisation, investigations, or postponement all become impossible",
            "The records should be electronic",
            "Assessment should be repeated immediately before induction"
          ],
          a: 1,
          why: "The purpose of pre-anaesthetic assessment for elective work is to change something before the patient reaches the table. Discovering uncontrolled hypertension or an undiagnosed murmur an hour before induction gives you two options, both bad: proceed with unmitigated risk or cancel with the theatre already staffed. A re-check immediately before induction is good practice, but it is additional to the earlier assessment rather than a replacement for it."
        },
        {
          id: "ot04",
          q: "Your OT utilisation is 55% while the surgical waiting list is growing. First-case start times average 45 minutes late. The most productive intervention is:",
          options: [
            "Extending theatre hours into the evening",
            "Determining why first cases start late — pre-op readiness, consent, fasting status, staff arrival, or equipment setup — since that delay usually cascades through the whole list",
            "Adding another operating theatre",
            "Reducing scheduled case duration estimates"
          ],
          a: 1,
          why: "A 45-minute late start does not cost 45 minutes; it costs that plus every downstream case that no longer fits, which is how a theatre can be half-idle with a growing waiting list. Extending hours or building capacity adds resource to a process that is wasting the resource it has. Trimming duration estimates makes the schedule look better on paper and produces overruns instead."
        },
        {
          id: "ot05",
          q: "A wrong-site surgery near miss is averted when the patient corrects the marking during time-out. Investigation shows the site was marked by a junior doctor from the operation list, not with the patient. The key corrective action is:",
          options: [
            "Counsel the junior doctor",
            "Require site marking to be performed by the operating surgeon with the awake patient participating, verified against the source document rather than the list",
            "Add a second time-out immediately before incision",
            "Make the operation list more accurate"
          ],
          a: 1,
          why: "The list is a transcription, and marking from it propagates whatever error the transcription contains — which is precisely what happened. The patient was the last barrier and it worked, but a system that depends on the patient noticing has already failed. Involving the awake patient and the operating surgeon at the marking step puts verification at the point where the error is introduced rather than adding another check downstream of it."
        },
        {
          id: "ot06",
          q: "Post-operative patients are transferred from recovery to the ward when the recovery nurse judges them ready. Two patients required rapid response calls within an hour of transfer. What is missing?",
          options: [
            "More experienced recovery nurses",
            "Objective discharge criteria from recovery with documented scoring, and a structured handover to the receiving ward",
            "Longer mandatory recovery observation for all patients",
            "Continuous monitoring on the ward for all post-operative patients"
          ],
          a: 1,
          why: "Judgement varies between nurses, across shifts, and with how busy recovery is, which is why a scored discharge criterion exists. The handover matters equally — a ward that does not know what to watch for cannot watch for it. Mandating longer recovery for everyone consumes capacity to manage a minority risk, and continuous ward monitoring for all post-operative patients is neither affordable nor necessary."
        },
        {
          id: "ot07",
          q: "Sterile instrument sets are opened for a case that is then cancelled because the patient is not fasted. Over six months this happened 22 times. What is the highest-leverage response?",
          options: [
            "Charge the cost of reprocessing to the surgical department",
            "Move the fasting-status verification to a defined checkpoint before any sterile field is opened, and find why fasting instructions fail",
            "Reduce the number of instruments in standard sets",
            "Reprocess opened but unused sets to reduce cost"
          ],
          a: 1,
          why: "Twenty-two occurrences is a process defect with two halves, and the answer must address both: a gate that prevents the sterile field opening before status is confirmed, and the upstream reason patients keep arriving unfasted — which is usually an instruction given verbally, or given to a relative, or given in a language the patient does not read. Internal charging redistributes the cost without reducing it, and reprocessing opened sets trades a financial problem for a sterility one."
        },
        {
          id: "ot08",
          q: "During an assessment, the assessor asks to see evidence that anaesthesia machines undergo a pre-use check. Records exist and are signed. What will the assessor probe next?",
          options: [
            "Whether the checks are done daily or per-case",
            "What the check actually covers, whether a failed check has ever been recorded, and what happened when it was",
            "Whether the anaesthetist or technician performs it",
            "Whether the records are stored for the required duration"
          ],
          a: 1,
          why: "A check register with no failures ever recorded is the tell — real equipment fails sometimes, so an unbroken run of passes suggests the check is ritual. Asking what happened on the occasion something did fail tests whether the process has a functioning consequence, which is what separates a control from a signature. Who performs it and how long records are kept are secondary to whether the check has ever done anything."
        },
        {
          id: "ot09",
          q: "A surgeon requests that a specific implant brand be used, which is not on the hospital's approved list, for a case tomorrow. The correct process is:",
          options: [
            "Permit it since the surgeon has clinical autonomy",
            "Refuse and require the approved implant",
            "Route it through the defined non-formulary or exception process — verifying regulatory approval, traceability, sterility, and vendor accountability — and postpone if that cannot be completed safely",
            "Permit it provided the patient consents to the choice"
          ],
          a: 2,
          why: "An implant that enters a patient without traceability cannot be recalled, and the hospital carries that liability for the life of the device. Blanket refusal ignores that there are legitimate clinical reasons for a specific implant; blanket permission ignores that clinical autonomy does not extend to bypassing device verification. Patient consent is not the relevant safeguard — the patient cannot verify a regulatory approval."
        },
        {
          id: "ot10",
          q: "Theatre temperature and humidity logs show humidity outside range on 15 of 30 days. No action is recorded against any excursion. The finding is:",
          options: [
            "A maintenance failure of the HVAC system",
            "A monitoring system that records without responding — the absence of any action against half the readings means the log serves no control purpose",
            "Incorrect calibration of the humidity sensor",
            "The specified humidity range is too narrow"
          ],
          a: 1,
          why: "The HVAC may well be faulty and the range may well be wrong, but neither can be the primary finding while nobody is reacting to the data. A log without a defined action threshold and a recorded response is data collection mistaken for control, and it fails the same way whether the underlying reading is real or a sensor artefact — because nobody looked closely enough to find out which."
        },
        {
          id: "ot11",
          q: "Two patients with the same name are scheduled in the same theatre on the same day. What is the minimum acceptable safeguard?",
          options: [
            "Schedule them on different days",
            "Alert the theatre team verbally at the start of the list",
            "Apply the standard two-identifier verification at every step, plus an explicit duplicate-name alert flag on both records and physical separation of their notes and specimens",
            "Assign different theatres"
          ],
          a: 2,
          why: "Rescheduling and reassigning theatres both solve today's instance and teach nothing for the next one, which will happen without anyone noticing. A verbal alert decays across a long list and across shift changes. The layered answer works because it combines identification discipline that runs anyway with a visible flag and physical separation of the artefacts — notes and specimen pots — that are where same-name errors actually occur."
        },
        {
          id: "ot12",
          q: "Which measure would most meaningfully demonstrate that your surgical safety programme is working?",
          options: [
            "Surgical safety checklist completion rate",
            "Number of surgical safety training sessions conducted",
            "Rate of unplanned return to theatre within 30 days, alongside observed checklist quality rather than completion",
            "Zero wrong-site surgeries in the reporting period"
          ],
          a: 2,
          why: "Completion rates and training counts measure activity, and this question deliberately offers both. Zero wrong-site surgeries is tempting but statistically empty in most hospitals — the event is rare enough that zero is the expected result whether or not your programme works. Pairing an outcome measure that occurs often enough to trend with an observed-quality process measure is the combination that can actually detect improvement or decay."
        }
      ]
    },

    {
      id: "laboratory",
      name: "Laboratory & Blood Bank",
      chapter: "COP",
      questions: [
        {
          id: "lab01",
          q: "A critical potassium result of 7.2 mmol/L is telephoned to the ward. The nurse who took the call cannot be identified and no read-back was recorded. The patient was treated appropriately. What is the finding?",
          options: [
            "None — the patient received correct treatment",
            "The critical value communication loop is not closed or traceable, which means the next call may reach nobody and no one will know",
            "The laboratory should have called the treating doctor directly",
            "The result should have been sent electronically instead"
          ],
          a: 1,
          why: "A good outcome on one occasion tells you nothing about the reliability of the mechanism. Without a named recipient and a read-back, you cannot demonstrate the value was received or received correctly, and a mistranscribed potassium is a lethal event. The finding stands independently of the fact that this particular patient did well."
        },
        {
          id: "lab02",
          q: "Internal quality control for your biochemistry analyser has been within limits for six months with almost no variation. External quality assessment scores are poor. The most likely explanation is:",
          options: [
            "The EQA scheme is unsuitable for your analyser",
            "The internal QC is not being run as designed — possibly the same vial reused, results copied forward, or QC run only after a passing patient batch",
            "Reagent lot variation between internal and external material",
            "The analyser requires recalibration"
          ],
          a: 1,
          why: "Real analytical systems drift, so QC data with almost no variation is itself abnormal. When internal QC looks impossibly good and external assessment disagrees, the internal data is usually not being generated the way the protocol assumes. Calibration and reagent variation are worth checking, but they cannot explain the absence of normal random scatter."
        },
        {
          id: "lab03",
          q: "A blood sample arrives in the blood bank labelled with the patient's name but no second identifier and no time of collection. The patient is bleeding and needs urgent transfusion. What is correct?",
          options: [
            "Process it, given the clinical urgency, and correct the label afterwards",
            "Reject the sample and request a correctly labelled recollection, issuing group O emergency units under the emergency release protocol in the meantime",
            "Accept it if the phlebotomist confirms the identity by phone",
            "Process it and record a non-conformity"
          ],
          a: 1,
          why: "Mislabelled samples are the dominant route to fatal ABO-incompatible transfusion, which is why sample rejection rules have no urgency exception. Urgency is answered by the emergency release pathway, which exists exactly so that clinical need never becomes an argument for relaxing identification. Telephone confirmation does not verify what was in the tube."
        },
        {
          id: "lab04",
          q: "Turnaround time for routine biochemistry is reported as a mean of 90 minutes against a 120-minute target. Clinicians complain of long waits. What analysis would you request?",
          options: [
            "A recount of the same data to verify the mean",
            "The distribution rather than the mean — particularly the 90th percentile and outliers by time of day, and confirmation of the clock start and stop points",
            "A separate target for urgent samples",
            "Clinician satisfaction survey results"
          ],
          a: 1,
          why: "Means conceal tails, and it is the tail that generates complaints — a handful of six-hour results shapes clinical opinion far more than a good average. Checking start and stop definitions matters equally, since a clock beginning at sample receipt in the lab excludes transport, which may be where the delay lives."
        },
        {
          id: "lab05",
          q: "A transfusion reaction is reported. The unit was discarded by the ward before the blood bank was informed. This primarily compromises:",
          options: [
            "The blood bank's inventory records",
            "The ability to determine whether the reaction was haemolytic, contaminated, or a clerical mismatch — which determines both patient management and whether other units are at risk",
            "The patient's transfusion history documentation",
            "The reporting timeline for the reaction"
          ],
          a: 1,
          why: "The returned unit is the single most informative item in a transfusion reaction workup. Without it you cannot repeat grouping and crossmatching, culture the unit, or check the label against the patient — so you cannot distinguish an error affecting only this patient from a contaminated donation or a mislabelling that may affect others."
        },
        {
          id: "lab06",
          q: "Your laboratory reports a haemoglobin of 3.4 g/dL on a patient who is clinically well and ambulant. What should the laboratory do first?",
          options: [
            "Report it immediately as a critical value",
            "Suppress the result pending clinical correlation",
            "Verify the result — check the sample for clot or dilution, re-run, and check delta against previous results — then communicate as critical if confirmed",
            "Request a fresh sample before reporting anything"
          ],
          a: 2,
          why: "A result that contradicts the clinical picture that starkly is most often pre-analytical — a sample drawn above a drip is the classic cause. Reporting it unverified can trigger an unnecessary transfusion; suppressing it risks missing a real emergency. Verification with delta checking resolves which of those you are dealing with, quickly."
        },
        {
          id: "lab07",
          q: "Reagents in the laboratory refrigerator include several opened vials without an opened-on date. The expiry dates printed on them are all in the future. What is the issue?",
          options: [
            "No issue — the printed expiry governs",
            "Printed expiry applies to unopened stock; once opened, in-use stability is shorter and undated vials cannot be assessed at all",
            "The reagents need to be moved to a different refrigerator",
            "The vials need relabelling with the printed expiry repeated"
          ],
          a: 1,
          why: "In-use stability after opening is almost always shorter than shelf expiry, and it is the manufacturer's in-use figure that governs. An undated open vial cannot be judged against it, so it is unusable by definition — not because it has necessarily degraded but because you cannot demonstrate it has not."
        },
        {
          id: "lab08",
          q: "Blood bank records show two units of platelets discarded for expiry in a month with three cancelled surgeries. What does this most likely indicate?",
          options: [
            "Over-ordering by the blood bank",
            "A gap between surgical scheduling and blood component planning — components ordered against a schedule that changed without the blood bank being told",
            "Poor inventory rotation",
            "Excessive shelf life expectations for platelets"
          ],
          a: 1,
          why: "Platelets have a very short shelf life, so wastage tracks scheduling communication far more than ordering discipline. The signal here is the coincidence with cancellations: the blood bank was working from a plan that had already changed. The fix is an information link, not a smaller order."
        },
        {
          id: "lab09",
          q: "A histopathology specimen is received in the laboratory with the requisition naming a different patient than the container label. What is the correct action?",
          options: [
            "Process using the requisition details as authoritative",
            "Process using the container label as authoritative",
            "Do not process; quarantine the specimen, notify the requesting clinician, and resolve identity through the defined discrepancy process — recognising an irreplaceable specimen cannot simply be rejected",
            "Reject and request recollection"
          ],
          a: 2,
          why: "Choosing either document as authoritative is a guess with a diagnosis attached. Blanket rejection is also wrong here, because a tissue specimen may be irreplaceable and the patient would face another procedure. The correct handling holds the specimen safely while identity is established by investigation rather than assumption."
        },
        {
          id: "lab10",
          q: "Point-of-care glucose meters on the wards are used by nursing staff. What is most commonly missing from such programmes?",
          options: [
            "Adequate numbers of meters",
            "Operator competency records, meter QC linked to a named operator, and reconciliation of point-of-care values against laboratory results",
            "Written instructions for use",
            "A policy on when point-of-care testing is appropriate"
          ],
          a: 1,
          why: "Point-of-care testing is laboratory testing performed outside the laboratory, and it inherits every quality requirement while typically inheriting none of the infrastructure. The three things listed are the ones that most often do not exist, and without them a ward meter is producing clinical decisions with no traceability to an operator or a control."
        },
        {
          id: "lab11",
          q: "Your laboratory wishes to introduce a new test. What must be established before it is offered clinically?",
          options: [
            "That the analyser can run it",
            "Verification of performance in your own setting, defined reference intervals, competent trained staff, QC and EQA arrangements, and a defined reporting and critical-value pathway",
            "That there is clinical demand for it",
            "That the cost is recoverable"
          ],
          a: 1,
          why: "A test the analyser can technically run is not a test the laboratory can responsibly report. Reference intervals in particular are frequently adopted from the manufacturer without local verification, which produces confidently wrong interpretations. Demand and cost decide whether to introduce it; the rest decides whether you are allowed to."
        },
        {
          id: "lab12",
          q: "An assessor reviews your laboratory's non-conformity register and finds 40 entries, all closed. What conclusion is most likely to be drawn?",
          options: [
            "The laboratory is well controlled since everything is closed",
            "It depends entirely on what closure meant — whether root causes were addressed and effectiveness verified, or whether the entries were simply marked resolved",
            "The laboratory has too many non-conformities",
            "The register is being used appropriately as a reporting tool"
          ],
          a: 1,
          why: "Forty open entries and forty closed entries are both consistent with a good laboratory and a poor one. What the assessor will actually sample is whether closure involved a cause, an action, and evidence the action worked — and whether the same non-conformity keeps reappearing under different numbers, which is the clearest sign closure means nothing."
        }
      ]
    },

    {
      id: "nursing",
      name: "Nursing & Patient Care",
      chapter: "COP",
      questions: [
        {
          id: "nur01",
          q: "Pressure ulcer incidence has risen in your medical ward. Risk assessment using a validated scale is documented on admission for 96% of patients. What is the most useful next question?",
          options: [
            "Whether nurses are using the scale correctly",
            "Whether the assessment triggers anything — whether a high score results in a documented, delivered prevention plan, and whether reassessment occurs as condition changes",
            "Whether the ward has enough pressure-relieving mattresses",
            "Whether the incidence rise is statistically significant"
          ],
          a: 1,
          why: "Risk assessment is worthless as an isolated act; its value lies entirely in what it triggers. A 96% assessment rate alongside rising incidence strongly suggests scores are being recorded and then not acted upon, or that admission assessment is never repeated as patients deteriorate. Mattress availability is a likely component of the answer but is found by following the trigger question."
        },
        {
          id: "nur02",
          q: "A patient falls while attempting to reach the toilet unaided at night. She was assessed as high falls risk. Which corrective action addresses the actual mechanism?",
          options: [
            "Reinforce falls risk assessment training",
            "Apply bed rails for all high-risk patients",
            "Introduce scheduled proactive toileting rounds for high-risk patients overnight, since most such falls occur when a patient tries not to be a burden",
            "Increase the frequency of falls risk reassessment"
          ],
          a: 2,
          why: "The risk was correctly identified, so assessment and reassessment are not where this failed. Bed rails are a well-documented trap — they convert a floor-level fall into a fall from height and can constitute restraint. Anticipating the need removes the reason the patient got up alone, which is the only one of these that addresses why she moved."
        },
        {
          id: "nur03",
          q: "Nursing handover between shifts takes place at the nurses' station and takes 40 minutes for 30 patients. Two medication omissions in a month traced to handover. The most effective change is:",
          options: [
            "Extend handover time",
            "Move to a structured bedside handover with a defined format, patient involvement where appropriate, and explicit handling of outstanding tasks",
            "Introduce a written handover sheet",
            "Reduce the number of patients per nurse"
          ],
          a: 1,
          why: "Handover fails on structure and verification, not usually on duration — extending it produces a longer unstructured narrative. Bedside handover attaches the information to the patient, allows visual verification of drains and infusions, and lets the patient correct errors. A written sheet is useful support but on its own it is another document that can be handed over unread."
        },
        {
          id: "nur04",
          q: "A nursing sister reports that a doctor's verbal order was misheard, resulting in a wrong dose that reached the patient without harm. Investigation shows verbal orders are routine in the ward during rounds. What is the correct position?",
          options: [
            "Prohibit verbal orders entirely",
            "Restrict verbal orders to defined urgent circumstances, require immediate read-back and documentation, and countersignature within a defined period",
            "Require all verbal orders to be witnessed by a second nurse",
            "Accept verbal orders as an operational necessity"
          ],
          a: 1,
          why: "Total prohibition sounds safest and is exactly why it fails — the practice moves underground and becomes unmanaged. Verbal orders during an emergency are legitimate; verbal orders as the routine mode during rounds are not. Defining when they are permitted, requiring read-back at the moment of the order, and closing the loop with countersignature keeps the practice visible and controlled."
        },
        {
          id: "nur05",
          q: "Physical restraint is used on an agitated elderly patient overnight. Documentation records the restraint was applied. What else must the record show for this to be defensible?",
          options: [
            "The nurse's name and the time of application",
            "The clinical indication, alternatives tried first, authorisation, the type and duration, monitoring at defined intervals, and review for continued necessity",
            "That the family were informed",
            "That the patient was aggressive"
          ],
          a: 1,
          why: "Restraint is a deprivation of liberty justified only by necessity, and necessity must be shown rather than asserted. The elements that make it defensible are the ones proving less restrictive options were attempted, that someone with authority approved it, that the patient was monitored, and that necessity was re-examined rather than the restraint simply continuing until morning."
        },
        {
          id: "nur06",
          q: "Nurse-to-patient ratios in your ICU vary between 1:1 and 1:3 depending on shift. Adverse events cluster on the 1:3 shifts. What is the correct interpretation for a quality manager?",
          options: [
            "The nurses on those shifts are less competent",
            "Staffing is functioning as a patient safety variable, and ratio should be set against patient acuity with a defined escalation route when it cannot be met",
            "More training is needed for those shifts",
            "The adverse event reporting is inconsistent across shifts"
          ],
          a: 1,
          why: "Nursing ratio is one of the better-evidenced determinants of patient outcome, and the data described is behaving exactly as that evidence predicts. Framing it as competence or training misattributes a resource constraint to the people absorbing it. What the organisation needs is an acuity-based standard and a defined path for what happens when it cannot be met, so the gap is visible rather than silently tolerated."
        },
        {
          id: "nur07",
          q: "A patient's allergy to penicillin is documented in the previous admission record but not on the current admission. He receives amoxicillin and develops a rash. The system defect is:",
          options: [
            "The admitting nurse failed to ask about allergies",
            "Allergy information does not persist across episodes in the record, so it depends on being re-elicited correctly every single time",
            "The prescriber did not check the notes",
            "The pharmacy did not screen the order"
          ],
          a: 1,
          why: "Every individual answer here identifies a real missed opportunity, but they all describe people compensating for a record that forgets. An allergy is a permanent patient attribute; a system that requires it to be rediscovered at each admission will lose it eventually, and the only question is which patient and when."
        },
        {
          id: "nur08",
          q: "Your ward has a policy that patient identification must use two identifiers. Observation shows nurses commonly identify patients by bed number during medication rounds. The most likely underlying cause is:",
          options: [
            "Deliberate non-compliance",
            "Insufficient training on the policy",
            "The workflow makes compliance slow or awkward — wristbands illegible, absent, or the drug trolley layout organised by bed",
            "Lack of supervision during medication rounds"
          ],
          a: 2,
          why: "When a whole team deviates the same way, look at what the environment rewards. A trolley organised by bed number makes bed number the natural referent, and a faded or absent wristband makes the compliant behaviour physically harder than the non-compliant one. Training and supervision push against the environment rather than changing it."
        },
        {
          id: "nur09",
          q: "Patients report they were not told what their medications were for at discharge. Discharge summaries are complete and given to every patient. What is missing?",
          options: [
            "The summaries need to be in the local language",
            "A structured discharge counselling step with teach-back confirmation, distinct from handing over the document",
            "More detail in the medication section of the summary",
            "A follow-up phone call after discharge"
          ],
          a: 1,
          why: "Handing someone a complete document is not the same as ensuring they understood it, and a discharge summary is written primarily for the next clinician. Teach-back is the element that converts information transfer into confirmed understanding. Language and detail matter, but a longer document in the right language still does not verify comprehension."
        },
        {
          id: "nur10",
          q: "A junior nurse is uncomfortable with a senior doctor's instruction that she believes is unsafe, but complies. The instruction turns out to be an error, caught later without harm. The organisational issue is:",
          options: [
            "The nurse's assertiveness",
            "That the hierarchy suppresses challenge, and there is no protected, expected mechanism for raising a safety concern without personal risk",
            "The doctor's clinical knowledge",
            "The nurse's clinical knowledge, since she was uncertain"
          ],
          a: 1,
          why: "She identified the risk correctly, so knowledge and assertiveness are not the gap — what stopped her was the predictable cost of speaking up. Organisations that rely on individual courage to overcome hierarchy will lose that bet regularly. A defined escalation phrase or graded assertiveness protocol makes challenge an expected professional act rather than an act of defiance."
        },
        {
          id: "nur11",
          q: "Nursing documentation audit shows care plans are individualised for 30% of patients; the remainder use unmodified templates. The concern is:",
          options: [
            "Templates should not be used at all",
            "Documentation is not reflecting actual care planning, which means the record cannot demonstrate what care the patient needed or received",
            "The audit sample was too small",
            "Nurses need training in care plan writing"
          ],
          a: 1,
          why: "Templates are a reasonable starting point; unmodified templates mean no thinking was applied to this patient. The consequence is practical rather than clerical — if care was individualised in practice but not recorded, the organisation cannot show what it did, and if it was not individualised in practice, the patient received a generic plan for a specific problem."
        },
        {
          id: "nur12",
          q: "Which indicator best reflects nursing care quality rather than nursing workload?",
          options: [
            "Number of patients cared for per nurse",
            "Nursing documentation completion rate",
            "Rate of hospital-acquired pressure ulcers and falls with injury, adjusted for patient acuity",
            "Nursing overtime hours"
          ],
          a: 2,
          why: "Ratios and overtime describe the input, and documentation rates describe the paperwork. Pressure ulcers and falls with injury are the classic nursing-sensitive outcomes precisely because they respond to the quality of nursing surveillance and intervention. Acuity adjustment is what stops a ward being penalised for taking sicker patients."
        }
      ]
    },

    {
      id: "radiology",
      name: "Radiology & Imaging",
      chapter: "COP",
      questions: [
        {
          id: "rad01",
          q: "A chest X-ray reported as normal is later found to show an early lung malignancy. The patient presented again eight months later. What should the discrepancy review focus on?",
          options: [
            "The reporting radiologist's competence",
            "Whether a systematic discrepancy review process exists at all, what the reporting conditions were, and whether double-reading applies to any category of study",
            "Whether the image quality was adequate",
            "Whether the referring clinician provided sufficient history"
          ],
          a: 1,
          why: "Perceptual misses are an irreducible feature of imaging — every radiologist has them, and a review that ends at one individual learns nothing transferable. What matters is whether the organisation has a mechanism to find these systematically, and whether reporting conditions such as workload, interruption, and display quality were contributing. Image quality and clinical history are legitimate contributors to check within that process."
        },
        {
          id: "rad02",
          q: "A pregnant patient undergoes an abdominal CT after the pregnancy was not identified at screening. What is the first priority?",
          options: [
            "Determine the fetal dose and provide the patient with accurate counselling by an appropriate specialist",
            "Report the incident to the radiation safety officer",
            "Review the screening questionnaire",
            "Establish who failed to ask the question"
          ],
          a: 0,
          why: "There is a frightened patient who needs to know what this actually means, and fetal dose from a single abdominal CT is usually far below the threshold for deterministic effects — a fact that prevents unnecessary termination decisions. Regulatory reporting and process review both follow, but a delay in counselling has consequences that a delay in paperwork does not."
        },
        {
          id: "rad03",
          q: "Radiographers report that lead aprons are stored folded over chair backs. What is the concern?",
          options: [
            "Aprons may be misplaced or stolen",
            "Folding creates cracks in the attenuating layer that are invisible externally, so protection may be absent where it appears intact",
            "Aprons need to be cleaned more frequently",
            "Aprons should be assigned to individual staff"
          ],
          a: 1,
          why: "The hazard is that the failure is invisible — a cracked apron looks identical to an intact one, so the wearer has no reason to doubt it. This is why aprons require hanging storage and periodic fluoroscopic or radiographic integrity checks. Hygiene and assignment are real but secondary considerations."
        },
        {
          id: "rad04",
          q: "Your department reports 100% compliance with justification of radiation exposure because every request has a signed clinician request form. An assessor is likely to challenge this because:",
          options: [
            "The form should be countersigned by a radiologist",
            "A signed request evidences that a study was ordered, not that it was justified — justification requires a judgement that benefit exceeds risk for that patient",
            "Electronic ordering would be preferable",
            "The forms are not retained long enough"
          ],
          a: 1,
          why: "Conflating a request with a justification is one of the most common radiation-protection gaps. Justification is an active decision, most meaningfully evidenced by vetting of requests against criteria, rejection or modification of inappropriate studies, and a record of that having ever happened. If no request has ever been challenged, the process is not operating."
        },
        {
          id: "rad05",
          q: "Turnaround for reporting routine outpatient MRI is 11 days. Critical findings on such studies are therefore also delayed by up to 11 days. The most important control is:",
          options: [
            "Reduce overall reporting turnaround",
            "Introduce a mechanism that surfaces potentially critical findings early — such as radiographer flagging or a preliminary review — independent of the routine reporting queue",
            "Prioritise MRI over other modalities",
            "Outsource reporting to reduce the backlog"
          ],
          a: 1,
          why: "Reducing the whole queue is the right long-term goal but it is slow, expensive, and leaves patients exposed meanwhile. The immediate risk is that a queue designed for routine work is also carrying urgent findings invisibly. A separate fast path for suspected critical findings decouples the clinical risk from the capacity problem, which can then be solved on its own timescale."
        },
        {
          id: "rad06",
          q: "A patient is scanned with contrast despite a documented previous contrast reaction. The reaction history was in the electronic record. What does this indicate?",
          options: [
            "The radiographer did not read the record",
            "Contrast reaction history is not surfaced at the decision point — it is retrievable but not presented, which makes detection dependent on someone choosing to look",
            "The patient should have mentioned it",
            "Contrast protocols need revision"
          ],
          a: 1,
          why: "Information that exists somewhere in a record is not the same as information that reaches the person about to act. This distinction — retrievable versus presented — is the crux of most electronic-record safety failures. Blaming the radiographer or the patient accepts a design in which the safe outcome depends on memory or diligence at exactly the busiest moment."
        },
        {
          id: "rad07",
          q: "Your MRI unit has a documented ferromagnetic screening process. An oxygen cylinder is nonetheless brought into the scan room by a porter during an emergency. The corrective action must address:",
          options: [
            "Porter training on MRI safety",
            "Zone control — physical access restriction to the magnet room, so that screening does not depend on the knowledge of whoever happens to approach it, plus MR-safe equipment for emergencies",
            "Signage at the entrance to the MRI suite",
            "Supervision of all personnel entering the MRI area"
          ],
          a: 1,
          why: "Screening processes are defeated by the emergency, because that is exactly when people move fast and defer to urgency. MRI safety therefore relies on physical zoning rather than on knowledge, so that an unscreened person with a ferromagnetic object physically cannot reach the magnet. Providing MR-safe emergency equipment removes the reason to try."
        },
        {
          id: "rad08",
          q: "Radiation dose records for CT show wide variation between radiographers for the same protocol on similar patients. What does this most likely mean?",
          options: [
            "Some radiographers are more skilled",
            "Protocols are being modified at the console without governance, so the standardisation the protocol exists to provide is not happening",
            "The equipment needs calibration",
            "Patient sizes vary more than assumed"
          ],
          a: 1,
          why: "Protocols exist so that dose is a property of the examination rather than of the operator. Wide variation on similar patients means individual adjustment is happening at the console, which may be well-intentioned but is unmonitored. Calibration would produce systematic rather than operator-linked variation, and patient size effects should be visible in the size distribution."
        },
        {
          id: "rad09",
          q: "An assessor asks how the radiology department ensures reports reach the referring clinician. The strongest evidence would be:",
          options: [
            "A log of reports dispatched",
            "Demonstrated closure of the loop — evidence that unviewed or unacknowledged reports, particularly abnormal ones, are identified and followed up",
            "Confirmation that reports are available in the electronic record",
            "Referring clinician satisfaction feedback"
          ],
          a: 1,
          why: "Dispatch and availability both prove the report left the department, which is the easy half. The half that harms patients is the report that is available and never opened, and the only evidence that addresses it is a mechanism that notices non-acknowledgement and chases it. Satisfaction feedback samples opinion rather than the failure cases."
        },
        {
          id: "rad10",
          q: "A portable X-ray is performed in a busy ward. What is the most commonly overlooked safety requirement?",
          options: [
            "Patient identification before exposure",
            "Controlling the area around the exposure — clearing or shielding other patients, visitors, and staff within the affected distance",
            "Recording the exposure in the patient record",
            "Verifying the correct anatomical side"
          ],
          a: 1,
          why: "Portable radiography moves the radiation source out of a shielded room into an environment full of people who did not consent to exposure and have no protection. The others in the list are important and are usually performed; area control is the one that regularly gets compressed by the difficulty of clearing a busy ward."
        },
        {
          id: "rad11",
          q: "Your department wants to demonstrate appropriate use of imaging. Which measure is most meaningful?",
          options: [
            "Total number of examinations performed",
            "Proportion of studies with normal findings, interpreted against referral criteria for specific indication groups",
            "Average waiting time for examinations",
            "Equipment utilisation rate"
          ],
          a: 1,
          why: "Volume, waiting time, and utilisation all measure throughput and can look excellent while the wrong patients are being scanned. Normal-result rate for defined indications is an imperfect but genuinely informative signal of over-requesting, provided it is read against criteria — a very high normal rate for a targeted indication suggests the threshold for requesting is too low."
        },
        {
          id: "rad12",
          q: "A radiographer notices that a colleague routinely omits the pregnancy status check for women of childbearing age when the department is busy. What is the correct organisational response once this is raised?",
          options: [
            "Discipline the individual radiographer",
            "Treat it as a signal about workload and process design as well as an individual practice issue, and check whether it is confined to one person",
            "Retrain the individual",
            "Increase supervision during busy periods"
          ],
          a: 1,
          why: "A shortcut taken when busy is usually a shortcut the system invites, and the first thing worth knowing is whether one person or many are taking it. Responding with discipline alone also carries a cost the organisation feels later: the colleague who raised it learns what happens to people who report, and the next report does not come."
        }
      ]
    },

    {
      id: "hr",
      name: "Human Resources & Training",
      chapter: "HRM",
      questions: [
        {
          id: "hr01",
          q: "A newly joined staff nurse independently manages a ventilated patient on her second day. Her credentials are verified and she has three years' prior ICU experience. What is missing?",
          options: [
            "Nothing — her experience and credentials are sufficient",
            "Organisation-specific orientation and demonstrated competency on this hospital's equipment, protocols, and escalation pathways before independent practice",
            "A probation period before ICU assignment",
            "Supervision by a senior nurse for one month"
          ],
          a: 1,
          why: "Credentials establish that she is qualified; they do not establish that she knows which ventilator model you use, where your emergency drugs are, or who to call at 3 am. This distinction between credentialling and organisation-specific competency is what the standard is actually asking about. A fixed supervision period is a blunt substitute for demonstrated competency, which may take less or more time."
        },
        {
          id: "hr02",
          q: "Training records show 100% of staff attended fire safety training. During a mock drill, most staff cannot locate the nearest extinguisher or state their assembly point. The finding is:",
          options: [
            "Training frequency is insufficient",
            "Training effectiveness is not being evaluated — attendance is being recorded as though it were competence",
            "The drill was poorly designed",
            "Staff need refresher training"
          ],
          a: 1,
          why: "This is the single most common training-related finding in accreditation. Attendance is an input measure and the drill just provided the output measure, which disagrees with it. Naming it as an evaluation gap rather than a frequency gap matters, because more of an ineffective training produces the same drill result next year."
        },
        {
          id: "hr03",
          q: "A doctor's registration lapsed three months ago and was noticed during an internal audit. He continued to practise. The primary control failure is:",
          options: [
            "The doctor's personal responsibility to renew",
            "The absence of a proactive credential-expiry tracking system that flags before expiry rather than detecting after it",
            "Insufficient frequency of internal audits",
            "The medical superintendent's oversight"
          ],
          a: 1,
          why: "Any system that depends on individuals remembering renewal dates will fail eventually across a large medical staff. Detection three months late by audit is the system working as designed and the design being wrong — audit finds problems, a tracking system prevents them. More frequent auditing shortens the exposure without removing it."
        },
        {
          id: "hr04",
          q: "Your hospital conducts annual appraisals for all staff. An assessor asks how appraisal connects to patient care quality. The strongest answer would be:",
          options: [
            "Appraisals are completed for 100% of staff annually",
            "Appraisal identifies individual competency gaps that feed the training plan, and role-relevant quality indicators form part of the discussion",
            "Appraisals determine annual increments",
            "Appraisals are conducted by the immediate supervisor"
          ],
          a: 1,
          why: "Completion rates, increment linkage, and who conducts it are all administrative facts about the process. The question is whether the appraisal changes anything, and the demonstrable link is a loop: gaps identified in appraisal appear in the training plan, and quality performance relevant to the person's role is part of what is discussed."
        },
        {
          id: "hr05",
          q: "Staff turnover in your ICU is 35% annually, well above the hospital average of 12%. From a quality perspective, why does this matter most?",
          options: [
            "Recruitment and training costs increase",
            "Continuous loss of experienced staff degrades the tacit knowledge and team familiarity that underpin safe complex care, and constant orientation load falls on the remaining seniors",
            "It suggests poor management in the unit",
            "It affects staffing ratios"
          ],
          a: 1,
          why: "Cost and ratio effects are real but they are the visible layer. The safety mechanism is that complex critical care depends heavily on knowledge that lives in people rather than protocols, and on teams that can anticipate each other. High turnover also compounds itself, because the seniors who remain spend their capacity orienting newcomers instead of delivering care."
        },
        {
          id: "hr06",
          q: "A staff member reports being harassed by a senior colleague. Your grievance policy exists and was followed, with the complaint dismissed after investigation. The complainant subsequently resigns. What should the organisation examine?",
          options: [
            "Nothing — the policy was followed correctly",
            "Whether the investigation was independent of the reporting line, whether the complainant was protected from retaliation during it, and what the resignation indicates about confidence in the process",
            "Whether the complaint was malicious",
            "Whether the policy needs revision"
          ],
          a: 1,
          why: "Following a policy correctly and producing a just outcome are different things, and a resignation after dismissal of a complaint is a signal worth reading rather than filing. The specific vulnerabilities to check are independence — a senior colleague may sit in the investigator's reporting line — and whether the complainant experienced consequences while the process ran."
        },
        {
          id: "hr07",
          q: "Contract housekeeping staff are not included in your infection control and safety training records because they are employed by an agency. What is the correct position?",
          options: [
            "Correct — the agency is responsible for their training",
            "Anyone working within the hospital and performing tasks affecting patient safety must be trained and evidenced by the hospital, regardless of who employs them",
            "They should be trained only if they enter clinical areas",
            "The agency contract should require training certificates"
          ],
          a: 1,
          why: "Employment status does not alter exposure. Housekeeping staff handle biomedical waste, clean isolation rooms, and move between clinical areas, so their competence is a patient safety matter for the hospital that hosts them. Requiring certificates from the agency is a reasonable contractual clause but transfers evidence rather than assurance — you still need to know they can do it here."
        },
        {
          id: "hr08",
          q: "Your hospital requires BLS certification for all clinical staff. Audit shows 78% currency, with lapses concentrated among consultants. The most effective response is:",
          options: [
            "Issue a circular requiring immediate compliance",
            "Examine the barrier — session timing that conflicts with clinical commitments — and offer scheduling that fits, alongside making currency a condition of continued privileges",
            "Extend the certification validity period",
            "Exempt consultants who rarely perform resuscitation"
          ],
          a: 1,
          why: "A group-specific lapse pattern usually reflects a group-specific barrier, and for consultants that is almost always scheduling. Fixing access is necessary but insufficient on its own, which is why linking currency to privileges supplies the accountability. Extending validity or granting exemptions solves the number rather than the capability."
        },
        {
          id: "hr09",
          q: "During an assessment, a housekeeping staff member is asked what she would do if she found a spill of blood. She describes the correct procedure fluently. What has this demonstrated?",
          options: [
            "That the training records are accurate",
            "Meaningful evidence of training effectiveness at the point of care, which is stronger than any attendance record",
            "That she has been coached for the assessment",
            "That the spill management policy is adequate"
          ],
          a: 1,
          why: "Assessors ask frontline staff precisely because a fluent answer from someone with no reason to have memorised it is the most credible evidence available that training reached its target. It is worth noticing that this is the mirror image of the fire drill scenario — the same test, passed instead of failed, and it is the demonstration rather than the record that carries the weight in both cases."
        },
        {
          id: "hr10",
          q: "A nurse involved in a serious medication error is suspended pending investigation. What is the likely consequence for your safety culture?",
          options: [
            "Improved compliance through deterrence",
            "Reduced incident reporting across the organisation, as staff learn that reporting or being involved in error carries personal risk",
            "No significant effect if the investigation is fair",
            "Improved accountability"
          ],
          a: 1,
          why: "Suspension before any determination of whether the error was a system failure, an at-risk choice, or genuine recklessness tells everyone watching what happens to the person nearest the mistake. The reporting rate falls, and the organisation loses the information it needs to prevent recurrence. A just-culture framework exists to separate the small number of cases warranting individual action from the majority that do not."
        },
        {
          id: "hr11",
          q: "Job descriptions in your hospital list duties but not required competencies or reporting relationships for several roles. Why does this matter for patient safety?",
          options: [
            "It creates confusion at appraisal time",
            "Undefined competency requirements mean there is no standard against which to assess suitability or identify training needs, and unclear reporting lines create escalation ambiguity in a crisis",
            "It makes recruitment harder",
            "It is a documentation requirement of the standard"
          ],
          a: 1,
          why: "A duty list says what someone does; a competency requirement says what they must be able to do, which is what makes assessment and gap analysis possible at all. The reporting line half is the sharper risk — when a deteriorating patient needs escalation, ambiguity about who is responsible costs minutes that matter."
        },
        {
          id: "hr12",
          q: "Which is the most meaningful indicator of training programme effectiveness?",
          options: [
            "Training hours delivered per employee",
            "Percentage of staff trained against plan",
            "Demonstrated post-training competency, combined with movement in the clinical or safety outcome the training was intended to improve",
            "Participant satisfaction scores"
          ],
          a: 2,
          why: "Hours, coverage, and satisfaction all measure delivery, and satisfaction in particular correlates poorly with learning. The only evidence that training worked is that people can now do the thing, and the only evidence it mattered is that the outcome it targeted moved. If hand hygiene training does not shift compliance and infection rates, it was an activity rather than an intervention."
        }
      ]
    },

    {
      id: "facility",
      name: "Facility Management & Safety",
      chapter: "FMS",
      questions: [
        {
          id: "fms01",
          q: "A fire drill is conducted in the outpatient block on a Sunday morning when the department is closed. The drill report records successful evacuation in four minutes. What is the problem?",
          options: [
            "The drill should be conducted more frequently",
            "The drill did not test the conditions that matter — occupied areas, patients who cannot self-evacuate, and staff actually on duty",
            "Four minutes is too slow",
            "The drill report lacks detail"
          ],
          a: 1,
          why: "A drill in an empty building tests the building. The hard parts of hospital evacuation are precisely what was excluded: moving non-ambulant patients, deciding about ventilated patients, accounting for visitors, and doing it with the real staffing on duty. A four-minute result under those conditions is not information about your readiness."
        },
        {
          id: "fms02",
          q: "Fire extinguishers throughout the hospital carry valid inspection tags. During a walkthrough you find three obstructed by stored equipment and one behind a locked door. What does this indicate?",
          options: [
            "The inspection process is working since tags are current",
            "Inspection verifies the device but not its accessibility, so the programme is checking a component rather than the capability to use it",
            "Storage practices need improvement",
            "More extinguishers are needed"
          ],
          a: 1,
          why: "An extinguisher you cannot reach in eight seconds is not a fire control. The inspection regime is examining the cylinder while ignoring the only thing that determines whether it can be used, which is a scope failure rather than an execution failure. Storage discipline is the symptom that revealed it."
        },
        {
          id: "fms03",
          q: "Your hospital's medical gas manifold has an automatic changeover to reserve banks. The reserve bank has never been used in two years. What should concern you?",
          options: [
            "The reserve capacity may be excessive",
            "Whether the changeover mechanism has ever been function-tested, since an untested standby system is an assumption rather than a control",
            "The cost of maintaining unused reserves",
            "Whether the primary supply is over-specified"
          ],
          a: 1,
          why: "Standby systems fail silently — nothing indicates a failed changeover valve until the moment the primary supply runs out and it does not switch. Two years without activation means two years without evidence it works. This applies identically to generators, UPS, and fire pumps: untested standby capacity is a belief."
        },
        {
          id: "fms04",
          q: "Water testing for the hospital's storage tanks is done quarterly and results are filed. Two results in the past year exceeded acceptable limits and no action is recorded. What is the finding?",
          options: [
            "Testing frequency should be monthly",
            "There is no defined action threshold or response process, so testing generates data without control — the same defect regardless of the parameter being monitored",
            "The tanks need cleaning",
            "The testing laboratory should be accredited"
          ],
          a: 1,
          why: "Monitoring without a defined trigger and response is filing, not control, and the shape of this failure recurs across every monitoring system a hospital runs. The tanks may well need cleaning, but that is the specific consequence; the systemic finding is that an out-of-limit result produced no reaction, which means the next one will not either."
        },
        {
          id: "fms05",
          q: "A patient's attendant slips on a wet floor in a corridor. A warning sign was present. What should the incident review conclude?",
          options: [
            "No liability — a warning sign was displayed",
            "Signage is the weakest control; the review should examine cleaning schedules relative to traffic, whether the area could be closed during cleaning, and floor surface selection",
            "The attendant was not paying attention",
            "More warning signs are needed"
          ],
          a: 1,
          why: "A sign transfers responsibility to the person walking rather than removing the hazard, which places it near the bottom of the control hierarchy. The controls that actually work are temporal and physical — cleaning when traffic is low, closing a section rather than signing it, and surfaces that are less slippery when wet. Adding signs does more of the least effective thing."
        },
        {
          id: "fms06",
          q: "Your hospital stores diesel for the generator in a room adjacent to the medical records store. What is the primary concern?",
          options: [
            "Risk of fuel theft",
            "Fuel storage adjacent to a high fuel-load combustible store compounds fire risk and threatens both continuity of power and irreplaceable records simultaneously",
            "Fuel odour affecting staff",
            "Records may be damaged by fuel leakage"
          ],
          a: 1,
          why: "The issue is the adjacency, not either room individually. A paper store is one of the highest fuel loads in the building; putting an ignition-capable accelerant next to it means a single event takes out both your emergency power and your records. Separation of hazardous storage from high fuel load areas is the point."
        },
        {
          id: "fms07",
          q: "During an assessment the assessor asks a ward nurse what she would do if she smelled smoke. She describes evacuation but cannot say how she would raise the alarm. This reveals:",
          options: [
            "Inadequate individual training",
            "That the response protocol is known incompletely — alarm activation is the step that mobilises everyone else, and its absence means the response depends on one person's actions alone",
            "That the fire alarm system is inadequate",
            "That evacuation drills have been over-emphasised"
          ],
          a: 1,
          why: "Evacuating without raising the alarm means the fire response is limited to whoever noticed. Alarm activation is the step that converts an individual observation into an organisational response, which is why it comes first in every protocol. The gap is in what the training emphasised, not in the individual's diligence."
        },
        {
          id: "fms08",
          q: "Your hospital has a written disaster management plan reviewed annually. What would most strengthen the assessor's confidence in it?",
          options: [
            "The plan's comprehensiveness and length",
            "Evidence of mock drills that surfaced problems, and documented changes to the plan resulting from them",
            "Approval by the governing body",
            "Alignment with national disaster management guidelines"
          ],
          a: 1,
          why: "A plan that has been tested and never revised is a plan whose drills were not honest. The most persuasive evidence is the record of failures found and the amendments they produced, because that demonstrates the drill was designed to find problems rather than to be passed. Length, approval, and alignment describe the document rather than the capability."
        },
        {
          id: "fms09",
          q: "Waste water from the dialysis unit is discharged to the general sewage line without treatment. What is the correct position?",
          options: [
            "Acceptable, as dialysis effluent is largely water",
            "Effluent handling must comply with the applicable pollution control requirements, which need verification for this specific stream rather than assumption",
            "It should be treated as biomedical waste",
            "It requires only pH neutralisation"
          ],
          a: 1,
          why: "The answerable form of this question is regulatory rather than intuitive — what governs is the applicable pollution control board consent and its conditions for your discharge streams. Both the reassuring answer and the maximally cautious one are guesses. The competent response is to verify the requirement for that specific effluent rather than reason from first principles."
        },
        {
          id: "fms10",
          q: "Emergency exit routes in your hospital are clearly marked and unobstructed. During a night visit you find two exit doors locked for security. The correct resolution is:",
          options: [
            "Accept the locks as a necessary security measure at night",
            "Install hardware that permits egress at all times while restricting entry — security and egress are not in genuine conflict once the right hardware is fitted",
            "Post a security guard at each door with a key",
            "Unlock the doors and accept the security risk"
          ],
          a: 1,
          why: "This is presented as a trade-off and is not one. Panic hardware and one-way egress devices allow free exit while preventing entry, which resolves the conflict at source. Both accepting the locks and simply unlocking them accept an avoidable harm, and a guard with a key introduces a human dependency at the exact moment that dependency is least reliable."
        },
        {
          id: "fms11",
          q: "Your facility's electrical safety testing programme covers all biomedical equipment but not patient beds, examination lamps, or ward refrigerators. The gap matters because:",
          options: [
            "These items are also assets requiring maintenance",
            "Any mains-powered device in the patient environment can deliver an electrical hazard, and electrically-operated beds in particular are in continuous direct contact with patients",
            "The inventory should be complete for accounting purposes",
            "These items may fail and disrupt operations"
          ],
          a: 1,
          why: "The scope of electrical safety testing is defined by the patient environment rather than by whether an item is classified as medical equipment. An electrically-operated bed sits under the patient for their entire stay, which makes an earth fault in it more consequential than one in many devices that do get tested."
        },
        {
          id: "fms12",
          q: "Which best demonstrates that your facility safety programme is effective rather than merely documented?",
          options: [
            "All required policies and plans are current and approved",
            "Scheduled inspections are completed on time",
            "Hazards identified through rounds, drills, and incident reports are trending toward closure, with evidence that identified risks led to physical or process change",
            "Zero safety incidents reported in the period"
          ],
          a: 2,
          why: "Current documents and completed inspections describe a functioning administrative process. Zero reported incidents is the weakest option, because in facility safety as in clinical safety it more often indicates a reporting failure than an absence of hazards. Effectiveness shows in the loop closing — hazards found, acted on, and verified as changed."
        }
      ]
    }

  ]
};
