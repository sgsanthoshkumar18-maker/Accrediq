/* AQcredix — Management of Medication (MOM): element explanations.
 *
 * PROVENANCE, which matters here more than anywhere else on the site.
 * These are written from Dr Santhoshkumar's own working notes on the MOM chapter —
 * his professional understanding of what each element requires, recorded in his own words
 * as an ID clinical pharmacist. They have been edited here for grammar, register and
 * consistency, not rewritten from any NABH publication.
 *
 * That distinction is the whole point. `nabh-data.js` holds wording close to NABH's
 * copyrighted text; this file holds original commentary that happens to describe the same
 * requirements. Commentary on a standard is his to write. The standard's own sentences are
 * not.
 *
 * Every entry has been checked for word-run overlap against the stored NABH text — see
 * tests/mom-explain.test.js, which fails the build if any explanation shares a seven-word
 * run with it. The check is automated precisely because a careful human read is exactly
 * the thing that gets skipped under time pressure.
 *
 * The published standard remains the authority. This is one pharmacist's reading of it.
 */
window.MOM_EXPLAIN = {

  /* ---------------- MOM 1 · pharmacy services and medication management ---------------- */

  "MOM.1.a":
    "Maintain a medication management manual covering the full path a medicine takes " +
    "through the hospital: procurement, storage, prescribing, dispensing, administration " +
    "and monitoring of use. It should apply everywhere medicines are handled, not only in " +
    "the pharmacy, and a suitably qualified person should be named as supervising pharmacy " +
    "services. The hospital formulary sits alongside it, listing what actually moves " +
    "through the organisation, including surgical items and implants.",

  "MOM.1.b":
    "Constitute a committee drawn from more than one discipline to govern medication " +
    "management. Its remit covers control of what enters the hospital's drug list, revision " +
    "of the formulary, review of how medicines are being used, and discussion of any " +
    "patient safety incident involving a medicine. Membership should represent the major " +
    "clinical departments rather than the pharmacy alone.",

  "MOM.1.c":
    "The committee must actively maintain the system, not simply exist. It needs sight of " +
    "rational prescribing, medication errors and adverse events, and should review the " +
    "medication management system at least once a year. Appoint a medication safety officer " +
    "capable of analysing adverse medication events and answerable for taking that analysis " +
    "forward.",

  "MOM.1.d":
    "A pharmacy open around the clock is preferable. Where it is not, written guidance must " +
    "set out how a medicine is obtained while the pharmacy is closed. The same guidance " +
    "should cover what happens during a stock-out or shortage, so ward staff are not left " +
    "improvising at night.",

  "MOM.1.e":
    "Establish a defined route for telling relevant staff about changes that affect " +
    "prescribing: a shortage, a stock-out, a recall, or an adverse event. Set a time limit " +
    "for that communication rather than leaving it to whoever remembers — a recall reaching " +
    "the prescriber within twenty-four hours is a reasonable benchmark. Patient safety " +
    "incidents involving medicines follow the same route.",

  /* ---------------- MOM 2 · hospital formulary ---------------- */

  "MOM.2.a":
    "The multidisciplinary committee owns the formulary. Additions, revisions and deletions " +
    "should carry the agreement of the members and the chair rather than being made " +
    "informally. Build the list against the National List of Essential Medicines and the WHO " +
    "model list, and against the clinical services the hospital actually provides.",

  "MOM.2.b":
    "Review the formulary at least annually. Non-formulary medicines that were purchased " +
    "repeatedly during the year deserve consideration for inclusion. Weigh adverse drug " +
    "reactions, changing disease and resistance patterns, and cost before adding or removing " +
    "anything.",

  "MOM.2.c":
    "Every clinician who prescribes should be able to reach the current formulary. Paper or " +
    "electronic both serve; what matters is that the version in a clinician's hands is the " +
    "current one after each annual revision, not a copy left over from two years ago.",

  "MOM.2.d":
    "Adherence is measurable, so measure it. Track how often prescriptions are rejected or " +
    "met by local purchase because the medicine sits outside the formulary, and use that " +
    "figure to judge whether the formulary reflects real practice or is being worked around.",

  "MOM.2.e":
    "Set out in writing how formulary medicines are acquired: vendor selection and " +
    "evaluation, reorder levels, tendering, raising the purchase order, and receipt. The " +
    "same discipline applies to a local purchase as to a scheduled one.",

  "MOM.2.f":
    "A separate route is needed for medicines outside the formulary. Where a locally " +
    "purchased medicine is likely to continue in use, the decision should carry the " +
    "committee chair's approval, and the committee should consider at the next review " +
    "whether something being bought repeatedly belongs on the list.",

  /* ---------------- MOM 3 · storage ---------------- */

  "MOM.3.a":
    "Store medicines cleanly, securely, and to each manufacturer's stated conditions. The " +
    "same standard applies in clinical areas as in the pharmacy. Guard against theft through " +
    "restricted access and a location that is genuinely observed, and name who is " +
    "responsible for the area.",

  "MOM.3.b":
    "Apply a recognised inventory method — VED, ABC, FSN, lead-time analysis, FIFO or FEFO — " +
    "rather than reordering by impression. Verify stock at regular intervals so a loss or " +
    "theft surfaces quickly, and decide in advance how not-for-sale and physician sample " +
    "medicines are handled.",

  "MOM.3.c":
    "Identify which medicines the hospital treats as high risk, write the list down, and keep " +
    "it current. It will typically include psychotropics, concentrated electrolytes and " +
    "controlled substances. The list belongs in every clinical area, not only in the pharmacy.",

  "MOM.3.d":
    "High-risk medicines should sit where clinical need places them, which will often be " +
    "outside the pharmacy. Where they do, label them plainly — high-alert medicines and " +
    "narcotics in particular — and put a barrier in place against misuse or accidental " +
    "administration.",

  "MOM.3.e":
    "Identify from the formulary which medicines look alike or sound alike, and where the " +
    "same medicine is stocked at more than one strength. Distribute that list to the clinical " +
    "areas. Then separate them physically: distance between two confusable items on a shelf " +
    "prevents more errors than any label.",

  "MOM.3.f":
    "Define the emergency medicine list against each department's needs. A crash cart helps, " +
    "but only if the contents of each drawer are specified rather than left to whoever " +
    "restocked it. Prevent anything other than emergency medicines being stored there.",

  "MOM.3.g":
    "Emergency medicines must be present whenever they are needed, in the quantity decided, " +
    "and replaced promptly after use. Where a cart is sealed, set a periodic check that " +
    "confirms the contents are still complete rather than assuming the seal proves it.",

  /* ---------------- MOM 4 · prescribing ---------------- */

  "MOM.4.a":
    "Prescribing for both inpatients and outpatients should follow recognised guidance on " +
    "rational prescription — the Code of Medical Ethics 2002 and the WHO definition of a " +
    "prescription are the usual references. The hospital's responsibility is to see that its " +
    "clinicians are trained in those principles, not merely that the guidance exists.",

  "MOM.4.b":
    "Agree the minimum a prescription must carry and hold every prescription to it: patient " +
    "name and unique identification number, the medicine named by generic composition unless " +
    "it is a combination product, dose, dosage form, route, frequency and duration. National " +
    "or regulatory requirements set the floor.",

  "MOM.4.c":
    "Ask about drug allergy and any previous adverse drug reaction before prescribing, and " +
    "record the answer. This applies in outpatients as much as on the ward, where it is more " +
    "often skipped.",

  "MOM.4.d":
    "Give prescribers something to check against — electronic or printed, either is " +
    "acceptable. It should help with drug–drug, drug–food and alcohol–drug interactions, " +
    "therapeutic duplication, and dose adjustment. The point is that a clinician in doubt has " +
    "somewhere to look.",

  "MOM.4.e":
    "Reconcile medicines at every transition in care. The purpose is to confirm that what the " +
    "patient is taking still matches the current clinical picture and care plan, and that " +
    "nothing carried over from before is now working against it. Check accuracy, dose and " +
    "dosage form before the patient moves.",

  "MOM.4.f":
    "Verbal orders need written rules: which medicines may be ordered verbally at all, how " +
    "the order is read back and confirmed, and within what period it must be entered into the " +
    "chart and signed. A defined shortlist of medicines eligible for verbal order is safer " +
    "than a general permission.",

  "MOM.4.g":
    "Audit prescriptions rather than assuming quality. Look at legibility and completeness of " +
    "dose, frequency and dosage form; at therapeutic duplication and interactions; and at " +
    "whether doses needed adjustment for renal or hepatic function. An audit that only counts " +
    "prescriptions tells you nothing.",

  "MOM.4.h":
    "Act on what the audit finds. Identify the root cause, take corrective and preventive " +
    "action against it, and keep the record — an audit with no action recorded against it is " +
    "the most common finding an assessor raises.",

  /* ---------------- MOM 5 · medication orders ---------------- */

  "MOM.5.a":
    "Only those permitted by law may write a medication order — in practice a doctor holding " +
    "at least an MBBS qualification. Where anyone else is permitted, that permission must " +
    "rest on a statutory or regulatory basis, not on local convenience. This holds whether " +
    "the order is written on a drug chart, an outpatient sheet, admission notes or in the " +
    "electronic record.",

  "MOM.5.b":
    "Fix one place in the record where medication orders are written, so that anyone opening " +
    "a file finds them without searching. Recording prescription and administration on the " +
    "same sheet helps. Avoid shorthand such as “continue same treatment” or " +
    "“repeat all”: each review should state what the patient is actually taking.",

  "MOM.5.c":
    "Every order must be legible, dated, timed and signed. The date and time make it possible " +
    "to establish how long a patient has been on a medicine; the signature makes the order " +
    "traceable to a person. Holding a master signature list of authorised prescribers in " +
    "medical records is what makes that traceability work in practice.",

  "MOM.5.d":
    "An order must name the medicine and state route, strength, dosage form and frequency. " +
    "When a strength changes, write a fresh order and discontinue the previous one with a " +
    "signature rather than amending it in place.",

  /* ---------------- MOM 6 · dispensing ---------------- */

  "MOM.6.a":
    "Write down how a medication order is carried out in the pharmacy, from receiving the " +
    "indent to handing the medicine over, and address high-alert and narcotic medicines " +
    "separately within it. Build in a check by a second person before dispensing — the value " +
    "lies in it being someone other than whoever picked the item.",

  "MOM.6.b":
    "Have a defined process for recalls, whether announced by a regulator, a manufacturer or " +
    "the hospital itself. Reaching prescribing staff within twenty-four hours of the " +
    "announcement is a reasonable standard, and the recalled stock must be removed from " +
    "circulation rather than simply flagged.",

  "MOM.6.c":
    "Decide what counts as near-expiry and apply it consistently; three months is the common " +
    "convention. Anything inside that window should be withdrawn from issue to inpatients and " +
    "outpatients alike, and removed during the monthly stock check rather than left to be " +
    "noticed.",

  "MOM.6.d":
    "Label what is dispensed. At a minimum the label should carry the medicine name, dosage " +
    "form, dose, batch number and expiry date. Cut strips need labelling before they go back " +
    "on the rack or out to a patient, since that is where identity is most easily lost. The " +
    "same applies to chemotherapy preparations and dilutions.",

  "MOM.6.e":
    "Verify a high-risk medication order before it is dispensed, by a second person who was " +
    "not the one who picked it. Visible marking of high-alert stock supports the check but " +
    "does not replace it.",

  "MOM.6.f":
    "Set out how returned medicines are handled, separately for inpatients and outpatients. " +
    "State the conditions a returned item must meet — packaging intact, storage and cold " +
    "chain maintained — and the period within which a return is accepted. Confirm the " +
    "returned item matches what was dispensed by name, dose, dosage form and batch number.",

  /* ---------------- MOM 7 · administration ---------------- */

  "MOM.7.a":
    "Only a registered nurse or a doctor may administer medication, unless another cadre " +
    "holds a statutory basis for doing so. The question to answer is not who is available but " +
    "who is permitted.",

  "MOM.7.b":
    "Where a patient is due several medicines at once, prepare and label one before beginning " +
    "the next. Labelling at the point of preparation is what prevents two prepared syringes " +
    "becoming indistinguishable a minute later.",

  "MOM.7.c":
    "Identify the patient using at least two identifiers before administering. The unique " +
    "identification number should be one; the wristband, name or inpatient number may serve " +
    "as the second.",

  "MOM.7.d":
    "Check the prepared medicine against the order and inspect it physically before giving " +
    "it: appearance, dose, dosage form, route and frequency. For high-alert medicines two " +
    "staff should verify independently and record that they did. A nurse who understands why " +
    "a medicine is high-alert is also the person most likely to catch a prescribing error " +
    "before it reaches the patient.",

  "MOM.7.e":
    "Confirm strength against the prescription before administering. Where the prescription " +
    "is unclear or illegible, resolve it with the prescriber rather than inferring what was " +
    "meant.",

  "MOM.7.f":
    "Confirm the route before administering. Different routes carry different techniques and " +
    "different consequences for getting it wrong.",

  "MOM.7.g":
    "Confirm that the medicine is due now. A twice-daily medicine given six-hourly, or given " +
    "at a time that suits the round rather than the schedule, is a dosing error even when the " +
    "medicine and dose are correct. Recognised timing guidance for scheduled medicines is a " +
    "reasonable reference.",

  "MOM.7.h":
    "Take deliberate steps against administration by the wrong route. Reserve particular " +
    "extension sets for particular purposes, keep dissimilar lines physically apart, and " +
    "check the line from connection to fluid for integrity before administering.",

  "MOM.7.i":
    "Record administration immediately after each medicine, not once at the end of the round. " +
    "Where relevant, record drop rate and volume for each shift in a consistent format.",

  "MOM.7.j":
    "Decide whether patients may administer their own medicines, and if so which ones. Where " +
    "it is permitted the prescriber should approve it, staff should confirm the timing with " +
    "the patient, and the administration should still be recorded in the chart.",

  "MOM.7.k":
    "Decide whether medicines brought in from outside are accepted, and set out which ones " +
    "and on what terms. What is accepted should carry legible identification — name, dose, " +
    "dosage form, strength, batch number and expiry — since anything else cannot be verified.",

  /* ---------------- MOM 8 · monitoring ---------------- */

  "MOM.8.a":
    "Monitor the patient after administration at defined intervals, watching for adverse " +
    "effects and for change in orientation or condition. Name the situations that warrant " +
    "closer observation — intensive care, dialysis, the elderly — rather than applying one " +
    "interval to everyone.",

  "MOM.8.b":
    "Where monitoring shows the expected therapeutic effect is not being achieved, or new " +
    "symptoms appear, the medicine should be reconsidered. Any change is made with the " +
    "prescriber, not around them.",

  "MOM.8.c":
    "Define what counts as a near miss, a medication error and an adverse drug reaction, and " +
    "then capture them: identify, document, report, analyse and act. Definitions matter " +
    "because staff cannot report what has never been named.",

  "MOM.8.d":
    "Set the time within which any of these must be reported, and to whom. A reporting rule " +
    "without a deadline produces reports that arrive too late to change anything.",

  "MOM.8.e":
    "Collect and analyse what is reported, within a defined period, through the " +
    "multidisciplinary committee. A clinical pharmacist should take part. Analysis across " +
    "reports is what reveals a pattern; a single report rarely does.",

  "MOM.8.f":
    "Take corrective and preventive action against the cause the analysis identified, and " +
    "keep the record. Action aimed at the individual rather than the cause tends to reduce " +
    "reporting rather than errors.",

  /* ---------------- MOM 9 · narcotics, chemotherapy, radiopharmaceuticals ---------------- */

  "MOM.9.a":
    "Handle narcotic drugs, psychotropic substances, chemotherapy agents and " +
    "radiopharmaceuticals under written guidance, aligned with the statutory requirements " +
    "that apply to each — the Narcotic Drugs and Psychotropic Substances legislation, and " +
    "atomic energy regulatory guidance for radiopharmaceuticals.",

  "MOM.9.b":
    "Restrict prescribing to those authorised for it: narcotics to privileged medical " +
    "officers, chemotherapy to oncologists or clinicians trained and experienced in it, and " +
    "radiopharmaceuticals to those authorised under the relevant statute.",

  "MOM.9.c":
    "Store these substances to the standard the statute requires, accessible only to " +
    "authorised staff. Keeping them separated from routine stock reduces both unauthorised " +
    "access and selection error.",

  "MOM.9.d":
    "Only authorised, qualified staff should prepare and administer these medicines. " +
    "Chemotherapy preparation belongs in a biological safety cabinet, with appropriate " +
    "personal protective equipment — the exposure risk here is to the person preparing it as " +
    "much as to the patient.",

  "MOM.9.e":
    "Keep registers recording use, dispensing, administration and disposal. The requirement " +
    "comes from the narcotics legislation and from biomedical waste rules, and the register " +
    "is what makes diversion detectable rather than merely unlikely.",

  /* ---------------- MOM 10 · implants and medical devices ---------------- */

  "MOM.10.a":
    "Base the choice of an implant or device on evidence and on recognised national and " +
    "international guidance. Confirm the necessary regulatory approvals and compliance with " +
    "the Drugs and Cosmetics Act before purchase, and route the decision through the " +
    "multidisciplinary committee rather than leaving it with a single department.",

  "MOM.10.b":
    "Set out in writing how implants and devices are handled through the organisation, " +
    "consistent with statutory requirements and with each manufacturer's instructions.",

  "MOM.10.c":
    "The patient is entitled to know what is being implanted, what outcome is expected, what " +
    "may go wrong, and what precautions follow. Explain it, obtain informed consent before " +
    "the procedure, and record both.",

  "MOM.10.d":
    "Record the name, batch number and serial number of every device implanted — in the case " +
    "file, the medical record, the master log and, where practical, the discharge summary. " +
    "Without it a recall cannot be traced to the patients affected.",

  "MOM.10.e":
    "Handle a device recall under written guidance, communicate it within twenty-four hours, " +
    "and keep the record of what was recalled and what was done, so the affected devices can " +
    "still be traced later.",

  /* ---------------- MOM 11 · medical supplies and consumables ---------------- */

  "MOM.11.a":
    "Define how supplies and consumables are purchased: vendor selection and evaluation, " +
    "indenting, raising the purchase order, and receipt. The same documentary discipline " +
    "applies as for medicines.",

  "MOM.11.b":
    "Open and use items following the manufacturer's instructions and the precautions that " +
    "preserve sterility and integrity. A device handled carelessly at the point of opening " +
    "is compromised regardless of how well it was stored.",

  "MOM.11.c":
    "Store supplies as the manufacturer specifies, in a clean, secure, monitored area. " +
    "Maintain the cold chain where it applies, and hold refrigerated items within the stated " +
    "range.",

  "MOM.11.d":
    "Apply a recognised inventory method — ABC, VED or FSN analysis — to decide stocking " +
    "levels against actual usage, and verify stock regularly so loss is detected. Good " +
    "inventory control is what keeps items available without accumulating waste.",

  "MOM.11.e":
    "Check the condition of an item before it is issued. Physical damage, dampness, an " +
    "unexpected smell or a passed expiry date should all stop it being used, and the check " +
    "has to happen at issue rather than at receipt."
};

/* The accessor used by the standards pages. Mirrors AQText in nabh-summary.js: our own
   commentary where we have written it, the stored wording where we have not, so migration
   can proceed chapter by chapter without the site breaking. */
window.MOM_EXPLAIN_GET = function (code) {
  return (window.MOM_EXPLAIN && window.MOM_EXPLAIN[code]) || null;
};
