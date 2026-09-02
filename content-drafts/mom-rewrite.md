# MOM — element descriptions in Dr Santhoshkumar's own words

**Status: draft. Not implemented. Do not ship from this file until the whole chapter is done
and reviewed.**

## Why this file exists

The element descriptions currently in `nabh-data.js` came from an AI rephrasing pass and read
like software product names — *"Broadcast Notification Node: System utility push-alerting
active clinical profiles…"*. That is neither the standard nor a useful explanation of it.

These replacements are dictated by Dr Santhoshkumar from his own understanding as a practising
clinical pharmacologist. That is the point: they are his explanation of what the requirement
means in a hospital, not a reworded version of NABH's text. Element **codes** and **tiers**
(Core / Commitment / Achievement / Excellence) stay as published — those are facts about the
standard, not expression.

Captured verbatim in substance from his dictation, lightly tidied for punctuation only.
Nothing here has been added, inferred or embellished.

---

## MOM.1 — the standard

Medicines used inside the hospital and the hospital pharmacy shall run properly, with defined
functions, in a safe manner that does not compromise patient care.

*(Current title in the data: "Pharmacy Governance & Committee Oversight")*

---

### MOM.1.a — Commitment

**Title:** Documents shall be made available for all the functions of the pharmacy and
medication-related concerns.

**Explanation:**
There shall be documentation on how medicines are bought, stored, dispensed, administered,
prescribed and monitored inside the hospital. This will be a master booklet containing all the
medicines used in the hospital.

Medication management is not confined to the pharmacy alone — it covers the entire hospital.
There shall be a person in charge of the pharmacy and of medication services across the
hospital.

There shall also be a master functional booklet explaining all the functions of the pharmacy,
covering not only the pharmacy itself but every critical area where medicines are stored or
used.

---

### MOM.1.b — Commitment

**Title:** A dedicated team that assists in all medication-related processes — additions,
deletions, recommendations, and the implementation of medication handling and management.

**Explanation:**
There shall be a team that deals with all medication-related issues, problems and requests.

The team decides on new actions the pharmacy can take: adding a medicine to the master booklet,
removing a medicine from the formulary, analysing medication errors in the hospital and taking
measures to prevent them recurring, and addressing patient-safety problems caused by
medications.

The team shall meet at defined intervals in defined locations, and all its actions shall be
documented as minutes after the meeting wherever possible. The strength of the team, its
composition, and the details of its meetings shall be documented. It is best that the team
meets at least once every three months.

---

### MOM.1.c — Achievement

**Title:** The dedicated team shall also update the medication services and their processes.

**Explanation as dictated:**
The team shall also deal with how medicines are used inside the hospital at the patient's
bedside — any medication errors, adverse events, patient-safety problems, or issues relating to
high-alert medications. There shall additionally be a person appointed as in charge of all
medicines and adverse events within the hospital.

> **⚠ Open question — title and explanation do not describe the same thing.**
> The title is about the team *updating services and processes*. The explanation is about the
> team *monitoring use, errors, adverse events and high-alert medicines*. These are two
> different requirements.
>
> Worth noting: this is the only element in MOM.1 tiered **Achievement** rather than
> Commitment, and the existing data describes it as process updates — which matches the
> **title**, not the explanation. Needs a decision before implementation.

---

### MOM.1.d — Commitment

**Title:** There shall be documented proof of how medication unavailability is handled, and how
medication shall be obtained when the pharmacy is closed.

**Explanation:**
There shall be documented proof of how the pharmacy operates when it is closed, or when a
specific medicine is unavailable at that point in time.

It is always best if the pharmacy runs twenty-four hours a day, seven days a week. But if the
pharmacy is closed, or a requested medicine is unavailable at that time, there shall be
documented proof of how the pharmacy will operate in those circumstances and how medicines will
be arranged.

---

### MOM.1.e — Commitment

**Title:** To avoid confusion, the hospital shall have a method of transmitting information from
the pharmacy when there is medication unavailability or a problem with a particular medicine.

**Explanation:**
The hospital shall have a defined way of informing all patient-care areas about any change in
the hospital's drug or medication management process — for example, a medicine being
discontinued, a medicine becoming unavailable, or adverse events relating to a specific batch,
company or brand.

There shall be a person in charge in the pharmacy who communicates this information to all
patient-care areas in the hospital, from high-risk areas through to every clinical area.

This includes problems with dosage, formulation and similar issues.

---

## Notes for implementation (not yet actioned)

1. **Two fields per element, not one.** The data currently holds a single `text` string. This
   draft gives a short *title* and a longer *explanation*, which is more useful and matches how
   the rest of the site presents a standard. Implementation will add a field rather than
   discard one of them.

2. **"Person in charge" appears three times** — in 1.a (pharmacy and medication services),
   1.c (medicines and adverse events), and 1.e (communication). Real enough, but worth deciding
   whether these are one role or three so the page does not read as repetitive.

3. **Numbering confirmed.** MOM.1.b was referred to once in dictation as "MOM 2.b"; the titles
   given afterwards confirm it is 1.b. MOM.1 has exactly five elements, a–e, and all five are
   covered.
