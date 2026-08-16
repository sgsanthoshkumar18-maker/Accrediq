# What was added — and a worked sample of each

Every date and figure below was computed with the platform's own scheduling engine
against **13 August 2026**, so what you read here is what the software will actually show.

---

## 1. Segregation of duties on CAPA

**What it does.** A Non-Conformity can no longer be verified or closed by the person who
raised it. Enforced in the database, not the browser.

**Sample**

> Dr Menon raises a finding: *"Hand hygiene compliance 67%, below the 90% target."*
> The corrective action is completed. He opens the finding and presses **Move to verified**.
>
> The button is greyed out. Hovering it says:
> *"A finding cannot be verified or closed by the person who raised it. Ask a colleague, or
> an admin, to verify it."*
>
> Sister Lakshmi opens the same finding, checks the re-audit, and closes it. The record now
> shows **raised by** Dr Menon and **verified by** Sister Lakshmi.

**Why.** A finding closed by its own author is a finding in itself — verification exists so
a second person confirms the action worked. Admins are exempt, because in a small hospital
the quality manager is sometimes genuinely the only person able to verify, and a rule that
cannot be satisfied gets worked around rather than followed. The action is still attributed.

---

## 2. Equipment & licence register — *Workspace → Register*

**What it does.** One register for everything with a renewal date: equipment, licences,
AMCs, credentials, reagents, software. Each item carries one or more cycles (calibration,
preventive maintenance, AMC renewal, inspection), and each time one is performed you record
it with the certificate number.

**Sample — adding a defibrillator**

| Field | What you enter |
|---|---|
| What is it? | Defibrillator — ICU bed 4 |
| Type | Equipment |
| Serial / number | ZOLL-R-88213 |
| Department | Biomedical |
| Location | ICU |
| Manufacturer | ZOLL |
| Responsible person | Mr Ravi, Biomedical Engineer |
| NABH element | FMS.4 |

Then **Add a cycle**:

| Field | What you enter |
|---|---|
| What kind? | Calibration |
| How often? | Yearly |
| When was it last done? | 15 June 2025 |
| Vendor / engineer | ZOLL Service India |

**What the register then shows, today:**

> **Defibrillator — ICU bed 4** · ZOLL-R-88213
> Calibration · Yearly · Biomedical · ICU · ZOLL Service India
> Next: **2026-06-15**
> `59 days overdue`

**Recording it when the engineer visits**

| Field | What you enter |
|---|---|
| Date performed | 13 August 2026 |
| Result | Pass |
| Performed by | ZOLL Service India |
| Certificate number | ZL/CAL/2026/4471 |
| Downtime (hours) | 1.5 |

The item moves to *Due 2027-08-13*, and the certificate number is kept in the History tab —
which is what an assessor asks for when they point at a named machine.

**Other things that belong in the same register**

| Item | Type | Cycle | Frequency |
|---|---|---|---|
| Fire NOC | Licence | Renewal | Yearly |
| Autoclave — CSSD 1 | Equipment | Preventive maintenance | Quarterly |
| Ventilator fleet — Hamilton | Contract | AMC renewal | Yearly |
| Sr Staff Nurse — TNNMC registration | Credential | Renewal | Yearly |
| Blood gas cartridges | Reagent | Inspection | Monthly |

---

## 3. Rounds & checklists — *Workspace → Rounds*

**What it does.** Any recurring check that produces a **score**. You write the questions
once; every round after that is scored, trended, and flagged if it falls below your target.

**Sample — creating the hand hygiene round**

| Field | What you enter |
|---|---|
| What is being checked? | Hand hygiene compliance round |
| Department | Infection Control |
| NABH element | IPC.2.c |
| How often? | Monthly |
| Target score (%) | 90 |
| Responsible person | Sister Lakshmi, ICN |

**The questions**

| # | Question | Critical? |
|---|---|---|
| 1 | Alcohol rub available at the point of care | ✔ yes |
| 2 | Sink with soap and running water accessible | — |
| 3 | Staff member can name the five moments when asked | — |
| 4 | Hand-hygiene poster displayed and legible | — |
| 5 | Training record matches the current duty roster | — |
| 6 | No wrist watches or rings on clinical staff | — |

**Walking the round in ICU**

| Question | Answer |
|---|---|
| 1. Alcohol rub at point of care | Yes |
| 2. Sink accessible | Yes |
| 3. Five moments known | **No** |
| 4. Poster displayed | Yes |
| 5. Training record matches roster | **No** |
| 6. No watches or rings | Yes |

The live score updates as you tap:

> **66.7%** · 6 of 6 applicable · target 90% · **below target**

Save, and you are told:

> *"Scored 66.7% — below target. Raise a CAPA against it."*

**Two scoring rules worth knowing**

**N/A is excluded from the denominator.** If ICU has no paediatric drawer, marking that
question N/A means it is not counted either way — the ward is neither rewarded for having
nothing to check nor punished for equipment it is not required to hold.

**A critical failure fails the round outright.** If question 1 were answered No, the round
fails at any percentage. You cannot average away a missing alcohol rub.

**Other rounds that fit the same engine**

| Checklist | Department | Frequency | Target |
|---|---|---|---|
| Cleaning audit — wards | Housekeeping | Monthly | 85% |
| Medical record completion review | Medical Records | Monthly | 90% |
| Crash cart and emergency drug check | Every ward | Monthly | 100% |
| BMW segregation audit | Facilities | Monthly | 95% |
| Pre-anaesthesia checklist audit | Operation Theatre | Quarterly | 90% |

---

## 4. My department dashboard — *Workspace → My department*

**What it does.** Everything already in the platform, filtered to **one** department, in
one screen. No new data — a view.

**Sample — Mr Ravi opens it and picks "Biomedical"**

> **1 Overdue · 0 Due soon · 1 Open finding · 12 SOPs to hold**
>
> **Needs attention now — 1**
> `EQUIPMENT` **Defibrillator — ICU bed 4**
> calibration · Yearly · Due 2026-06-15 — `59 days overdue`
>
> **On track — 3**
> Autoclave — CSSD 1, Ventilator AMC, Blood gas analyser
>
> **Open findings — 1**
> Defibrillator calibration lapsed — *open*
>
> **SOPs Biomedical must hold — 12**
> FMS.4.a, FMS.4.b, FMS.5.a … each linking to the standard

Switch the dropdown to **Whole hospital** and committees appear too. They are hidden in a
department view on purpose — showing every committee to the biomedical engineer would bury
the four things he actually owns.

The chosen department is remembered, so he lands on Biomedical every morning.

---

## 5. Notification bell

**What it does.** A flag in the top bar of every workspace page. It tells people rather
than waiting for them to look.

**Sample — what Mr Ravi sees on Monday**

> 🚩 **①**
>
> **1 overdue · 1 open finding in Biomedical**
>
> **OVERDUE**
> **Defibrillator — ICU bed 4** — Equipment · 59 days overdue
>
> **OPEN FINDINGS**
> **Defibrillator calibration lapsed** — open
>
> ☑ Email me a weekly summary  ☐ Overdue only

**And the weekly email** (Mondays, once configured). A real one, generated by the
endpoint's own renderer for a Biomedical department on 13 August 2026 — the file is at
`docs/sample-digest-email.html`, openable in a browser:

> **Subject:** AQcredix · 4 overdue · 2 due soon · 1 open finding in Biomedical
>
> *Ravi, this is what is outstanding in Biomedical today.*
>
> **OVERDUE**
> **Defibrillator — ICU bed 4** — Equipment · calibration · Yearly · 59 days overdue
> **Biomedical equipment user training refresher** — Task · Half-yearly · 29 days overdue
> **Medical gas pipeline pressure check** — Task · Monthly · 24 days overdue
> **Autoclave — CSSD 1** — Equipment · preventive · Quarterly · 3 days overdue
>
> **DUE SOON**
> **Blood gas analyser — Lab** — calibration · Half-yearly · Due in 1 day
> **Ventilator — Hamilton C3 (fleet AMC)** — amc · Yearly · Due in 19 days
>
> **OPEN FINDINGS**
> **Defibrillator calibration lapsed beyond 12 months** — open
>
> [ Open my department ]

The red dot returns when the **situation** changes, not on a timer — so dismissing it means
"I have seen this", and a new overdue item next week brings it back on its own. Nobody is
ever emailed to be told nothing is wrong.

---

## 6. Onboarding checklist

**What it does.** A new hospital lands in an empty workspace. This walks them through
setup, and each step marks itself done by **detecting real data** — never by ticking a box.

**Sample — what a hospital sees on day one**

> **Getting set up** — 1 of 6 done · about 10 minutes left
> ▓▓▒▒▒▒▒▒▒▒▒▒ 17%
>
> ✓ **Add your departments and people** — 4 on the team
> ○ **Enter your committees** → *Open Calendar*
> ○ **Add your recurring obligations**
> ○ **Build the equipment register**
> ○ **Set up your rounds**
> ○ **Score your readiness**

The panel disappears once setup is finished. A checklist you can complete without doing the
work teaches people the checklist *is* the work — which is the habit this platform exists to
argue against.

---

## 7. File attachments

**What it does.** Attach the actual certificate or photograph to the record it evidences —
on register events, CAPAs, incidents and rounds.

**Sample**

> **Evidence** ②
> `PDF` ZOLL-calibration-2026.pdf — 412 KB
> `JPEG` crash-cart-photo.jpg — 1.2 MB
> \+ Attach a certificate or photo

Accepts PDF, images and Office documents up to 10 MB. Executables and archives are refused.

**On privacy.** Files live in a private bucket, and every link is signed and expires after
two minutes. The storage path begins with your hospital's own id, and Supabase itself
checks that folder — so one hospital cannot read another's files even knowing the exact
path. A certificate number recorded with the PDF in someone's inbox is not evidence an
assessor can be shown.

---

## 8. Customer data export — *Workspace → Readiness → Export everything*

**What it does.** Twelve sheets containing every record your hospital has entered, plus a
JSON copy.

**Sample cover sheet**

| Sheet | Records |
|---|---|
| Incidents | 42 |
| NC and CAPA | 17 |
| Internal audits | 8 |
| Committees | 12 |
| Committee meetings | 94 |
| Recurring obligations | 31 |
| Register | 268 |
| Calibration history | 511 |
| Checklists | 9 |
| Rounds | 187 |
| Documents | 76 |

> *"This is your hospital's own data, exported in full. Every record you have entered is
> here, in open format. Nothing is held back."*

Ids are resolved to names, so the Rounds sheet reads *"Hand hygiene compliance round"*, not
`chk_m8x2p1`.

---

## 9. Pin a page

Press **☆ Pin this page** on any workspace page and it becomes where you land after signing
in. Stored against your account, so it follows you to a ward tablet or a home laptop.

Mr Ravi pins **Register**; Dr Santhoshkumar pins **Readiness**. Neither has to navigate
each morning. *Readiness* in the nav always reaches the landing page regardless.

---

## 10. Homepage changes

**A tour of the locked pages.** Eight frames auto-playing through readiness, standards,
SOP-by-department, calendar, register, rounds, CAPA and the export — because the workspace
is behind the paywall and a visitor cannot otherwise see what they are being asked to pay
for. Labelled *"Illustrative screens"*, because inventing hospital data and presenting it
as real would be the wrong kind of persuasion for this product.

**A "how it runs" section.** Four pinned screens showing setup → what is due → evidence
being recorded → the assessment export.

**A rotating standard.** The scrollytelling card now cycles through fifteen standards
across eight chapters, changing every fifteen minutes.

---

## 11. Material gate pass — *Workspace → Gate Pass*

Modelled directly on your VHS Material Gate Pass form (VHS/QRF/MAT/01).

**Sample**

> Pass #050 — Dell Optiplex 3020 MT (SMPS, CPU fan, board, processor), S/N: C0N HY9V3
> IT · Service · Returnable
> Taken by Ratna J · TN 09 CX 5913
> **12 days overdue**

Press **Record return** and it moves to *Returned*. Non-returnable passes (disposal, gift,
scrap) close the moment they're issued — no return date to chase.

## 12. Forms, checklists & registers library — *Workspace → Forms & Registers*

114 real documents from your own inventory, tagged to department, browsable by category.

**Sample**

> **Biomedical** — Planned Preventive Maintenance *(Register)*
>
> *Why:* The PM log biomedical maintains alongside the AQcredix register.
>
> **What it must contain:** Equipment name and asset code · Location · PM frequency ·
> Scheduled date · Date performed · Checklist items verified · Result · Engineer/vendor ·
> Next due date · Downtime
>
> [ Download blank template (Excel) ]

10 documents carry this full detail; the rest use a standard template for their category
until written specifically — marked plainly, same as the element summaries.

## 13. Apex (quality) manual — *Workspace → Apex Manual*

Nine guided sections. Committees pull in automatically from your calendar — nothing typed
twice.

**Sample — section 4, Committees**

> **Infection Control Committee**
> Quarterly · Chair: Dr Rao · Convener: Sister Lakshmi
>
> *(pulled from your calendar, not retyped)*

Press **Download manual (Word)** and get a real `.docx` — real Word headings, a real table
for the committee list, built from what's on screen so it's never stale.

---

## What still needs you

1. **Pricing is ₹1** on both plans.
2. **Nobody has ever paid and got in.** The paywall has only been tested from accounts that
   bypass it. This is the largest untested path in the product.
3. **Tax and KYC** — business income to a personal UPI.
4. **Terms and privacy pages** do not exist yet. A hospital storing incident data will ask.

The engineering is in reasonable shape. What remains is mostly operational, and most of it
only you can do.
