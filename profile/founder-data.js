/* AQcredix — founder profile.
 *
 * Transcribed from Dr Santhoshkumar SG's LinkedIn profile as supplied by him. Nothing
 * here is inferred: every line came from the profile itself. Posts and reshares are
 * deliberately excluded at his instruction.
 *
 * This is the single place to edit the portfolio. `founder.html` renders whatever is
 * here, so adding a publication means adding one object to an array — no markup to touch.
 */
window.FOUNDER = {

  name: "Dr. Santhoshkumar SG",
  post: "Pharm.D., RPh.",
  pronouns: "He/Him",
  location: "Greater Chennai Area, Tamil Nadu, India",
  linkedin: "https://www.linkedin.com/in/dr-santhoshkumar-sg-pharm-d-rph-420333260",
  email: "s.g.santhoshkumar18@gmail.com",

  roleLine: "Infectious Disease Clinical Pharmacologist · Fellow of ISQua · Founder & CEO, AQcredix",
  affiliation: "Department of Clinical Pharmacy, The Voluntary Health Services Multispecialty Hospital, Chennai",

  headline: [
    "ID Clinical Pharmacologist, VHS",
    "Reviewer — ARIC",
    "Reviewer — IJIDT",
    "Consultant — Clinical Documentation Designer (NABH, JCI)",
    "Ex-Oncology & AMSP CP, APCC",
    "Administrator & Secretary — MEDODRIX"
  ],

  /* Portrait. Drop a file at assets/founder.jpg and it appears automatically; until then
     the page falls back to the ring mark with initials, which is deliberately not a
     broken-image icon. LinkedIn images cannot be hot-linked — they are signed URLs that
     expire — so the file has to live in the repo. */
  photo: "assets/founder.png",

  /* The three-stage story for the pinned scrollytelling card. */
  lens: [
    {
      step: "01 — THE FLOOR",
      title: "It starts at the bedside",
      heading: "Clinical practice",
      body: "Infectious disease pharmacology at Voluntary Health Services, oncology and " +
            "antimicrobial stewardship at Apollo Proton Cancer Centre. Every standard on " +
            "this platform was read first as someone who had to follow it on a ward.",
      points: [
        "ID Clinical Pharmacologist, Voluntary Health Services",
        "AMSP Clinical Pharmacologist, Apollo Proton Cancer Centre",
        "Internship, Stanley Medical College & Hospital"
      ]
    },
    {
      step: "02 — THE EVIDENCE",
      title: "Then it becomes evidence",
      heading: "Research and peer review",
      body: "Nine peer-reviewed publications on medication safety, regulatory compliance " +
            "and clinical case management — and now peer review for two journals, " +
            "including a Q1 Springer Nature title.",
      points: [
        "Reviewer — Antimicrobial Resistance and Infection Control (Springer Nature, Q1)",
        "Reviewer — International Journal of Infectious Diseases and Therapy",
        "10 publications, 2022–2025"
      ]
    },
    {
      step: "03 — THE SYSTEM",
      title: "Then it becomes a system",
      heading: "Quality and accreditation",
      body: "NABH and JCI documentation design, ISQua membership, Lean Six Sigma. " +
            "AQcredix is the same work, built once so every hospital can use it instead " +
            "of rebuilding it alone.",
      points: [
        "Consultant — Clinical Documentation Designer (NABH, JCI)",
        "Fellow of ISQua (FISQua) · ID 1013000",
        "CPQIH (Basic), CAHO — NABH Entry Level Standards",
        "Lean Six Sigma Yellow Belt · Six Sigma White Belt"
      ]
    }
  ],

  /* Reverse-chronological. `current: true` draws the live marker on the timeline. */
  experience: [
    { role: "Founder & CEO", org: "AQcredix",
      type: "Sole proprietorship · Chennai",
      from: "2026", to: "Present", current: true,
      note: "An accreditation platform for Indian hospitals: all 639 NABH objective " +
            "elements explained the way an assessor reads them, with the committee " +
            "calendar, evidence trail and internal audit across 45 departments that " +
            "prove them." },

    { role: "Clinical Reviewer", org: "Springer Nature", type: "Full-time · Remote",
      from: "Mar 2026", to: "Present", current: true,
      note: "Reviewer of Antimicrobial Resistance and Infection Control Journal (Q1)." },

    { role: "Clinical Reviewer",
      org: "International Journal of Infectious Diseases and Therapy (IJIDT)",
      type: "Science Publishing Group · Full-time",
      from: "Mar 2026", to: "Present", current: true,
      note: "Certificate of Reviewing issued 3 June 2026, for the review of “Expert Perspectives " +
            "on the usage of co-amoxiclav and cefuroxime in clinical practice: A cross-sectional " +
            "survey from Indian settings”." },

    { role: "ID Clinical Pharmacologist", org: "Voluntary Health Services",
      type: "Full-time · Chennai · On-site",
      from: "Dec 2025", to: "Present", current: true,
      note: "Consultant — Documentation Designer (NABH), Communication and more." },

    { role: "Head Content Writer", org: "MEDODRIX.COM",
      type: "Part-time · Chennai · Hybrid",
      from: "Aug 2018", to: "Present", current: true, note: "Web content writing." },

    { role: "AMSP Clinical Pharmacologist", org: "Apollo Proton Cancer Centre",
      type: "Chennai · On-site", from: "Aug 2025", to: "Dec 2025" },

    { role: "Clinical Pharmacologist", org: "Apollo Proton Cancer Centre",
      type: "Full-time", from: "Feb 2025", to: "Dec 2025" },

    { role: "Internship Trainee",
      org: "Stanley Medical College & Hospital, Chennai",
      type: "Full-time · On-site", from: "Jan 2024", to: "Dec 2025" },

    { role: "Clinical Pharmacologist", org: "Voluntary Health Services",
      type: "Internship · Chennai", from: "Feb 2023", to: "Sep 2023",
      note: "Pharmacy and pharmacy practice." }
  ],

  education: [
    { school: "C.L. Baid Metha College of Pharmacy, Chennai",
      degree: "Doctor of Pharmacy — Pharm.D", from: "Aug 2018", to: "Dec 2024",
      note: "Team leadership, Basic Life Support (BLS), IBM SPSS Statistics, communication." },
    { school: "The Tamil Nadu Dr. M.G.R. Medical University",
      degree: "Doctor of Pharmacy — Pharm.D, Pharmacology and Toxicology",
      from: "2018", to: "Present" }
  ],

  /* Newest first. `journal` is printed as given on the profile. */
  publications: [
    { title: "Patient Safety at Risk: Non-Compliance with Drug Regulations Among Community Pharmacies in Chennai, Tamil Nadu",
      journal: "International Journal of Community Medicine and Public Health",
      date: "1 February 2025",
      note: "Using the Simulated Client Method, the study highlights critical gaps in pharmacy compliance with prescription requirements." },

    { title: "Pilocytic Astrocytoma — Management of Post-Operative Complications",
      journal: "International Journal of Medical and Pharmaceutical Case Reports",
      date: "29 December 2024",
      note: "A case of recurrent pilocytic astrocytoma in a five-year-old, and the complexity of managing it after surgery." },

    { title: "Ratol Paste Poisoning in Addition with Oleander Buds",
      journal: "International Journal of Biological and Pharmaceutical Sciences Archive",
      date: "26 December 2024",
      note: "On the severe toxicity of yellow-phosphorus-based rodenticides and the urgency of recognising it early." },

    { title: "Assessment of Knowledge, Attitude and Practice among Community Pharmacists on Non-Prescription Drugs in Tamil Nadu",
      journal: "Indian Journal of Pharmacy Practice",
      date: "1 November 2024",
      note: "The role of community pharmacists in promoting safe medication use." },

    { title: "The Financial Ramifications of Dysmenorrhea: A Cross-Sectional Study on Employed Women in Chennai",
      journal: "International Journal of Innovative Scientific Research",
      date: "20 October 2024",
      note: "A common menstrual disorder measured for what it costs in quality of life and lost productivity." },

    { title: "Revitalizing Pharmacy Education: Leveraging Freshers' Insights To Level Up Pedagogical Approaches",
      journal: "International Journal of Pharmaceutical Sciences",
      date: "29 September 2024",
      note: "Pharmacy education seen through the perceptions of first-year students." },

    { title: "Community Pharmacies' Operational Compliance with PPR 2015: A Pilot Study of Naturalistic Practice Patterns",
      journal: "Journal of Hospital Pharmacy",
      date: "28 September 2024",
      note: "Operational compliance of Chennai community pharmacies against the Pharmacy Practice Regulations." },

    { title: "Transverse Myelitis with Positive Dengue Infection",
      journal: "International Journal of Science and Research Archive",
      date: "13 January 2024",
      note: "A rare inflammatory disease of the spinal cord presenting with sensory deficits and rapid progression." },

    { title: "Extensive Study on Rett Syndrome: A Case Report",
      journal: "International Journal of Pharmaceutical Sciences and Research",
      date: "1 November 2022",
      note: "An extremely rare post-natal neurodevelopmental syndrome, documented in detail." }
  ],

  project: {
    title: "Assessment of Knowledge, Attitude and Practice among Community Pharmacists on Non-Prescription Drugs in Tamil Nadu",
    body: "A KAP study of community pharmacists' practice and their knowledge of non-prescription " +
          "(OTC) drugs, accompanied by simulated-patient interviews with 15 community pharmacists " +
          "in Erode and Chennai. The need was underlined by action taken in Kerala on 6 January 2024, " +
          "banning the sale of prescription drugs without a doctor's prescription."
  },

  /* Every entry below is transcribed from the certificate PDF he supplied, including the
     credential number where the certificate carries one. Nothing is inferred. */
  certifications: [
    /* ---- ISQua: the headline credentials ---- */
    { name: "Fellowship", issuer: "The International Society for Quality in Health Care (ISQua)",
      date: "17 July 2026", id: "1013000", group: "quality", top: true,
      note: "Satisfied the requirements of the award of Fellowship." },
    { name: "Individual Member of the Society", issuer: "ISQua",
      date: "Valid 28 April 2026 — 28 April 2027", id: "1010566", group: "quality" },
    { name: "Artificial Intelligence & Machine Learning in Healthcare", issuer: "ISQua course",
      date: "17 July 2026", group: "quality" },
    { name: "Quality Improvement", issuer: "ISQua course", date: "21 May 2026", group: "quality" },

    /* ---- CAHO: the NABH-facing credentials ---- */
    { name: "Certified Professional for Quality Implementation in Hospitals (CPQIH — Basic)",
      issuer: "Consortium of Accredited Healthcare Organizations (CAHO)",
      date: "30–31 May 2026", id: "CPQIH-31-025", group: "quality", top: true,
      note: "Implementation of NABH Entry Level Standards (2nd Edition) for Hospitals · 8 CAHO credit points." },
    { name: "Basic Certificate Course on Antimicrobial Stewardship", issuer: "CAHO",
      date: "16 May 2026", id: "AMS-22-046", group: "quality",
      note: "Antibiotic policy, PK/PD, diagnostic stewardship, surgical prophylaxis, AMSP implementation · 4 CAHO credit points." },
    { name: "CAHOCON 2026 — 10th Edition, Delegate",
      issuer: "CAHO · Chennai Trade Centre",
      date: "11–12 April 2026", group: "quality",
      note: "Tech · Touch · Trust — The New Healthcare Code." },

    /* ---- Six Sigma ---- */
    { name: "Lean Six Sigma Yellow Belt", issuer: "Anexas Europe Certification",
      date: "11 May 2026", id: "22381-177-848-5049", group: "quality",
      note: "Accredited by AEC Denmark and CSSC, US." },
    { name: "Six Sigma White Belt", issuer: "The Council for Six Sigma Certification (CSSC)",
      date: "25 March 2026", id: "N0gW5KCtO7", group: "quality" },

    /* ---- Patient safety and governance ---- */
    { name: "Data-Driven Decision Making in Clinical Governance",
      issuer: "Society for Innovation in Safety & Healthcare Quality (ISHQ)",
      date: "29 May 2026", group: "quality" },
    { name: "Hazmat Management", issuer: "Centre for Patient Safety & Quality (CPSQ)",
      date: "7 May 2026", id: "CPSQ/WEB-HZMT/22/26", group: "quality" },
    { name: "How to Build Clinical Quality Improvement into Everyday Care in India",
      issuer: "SkillsforMed", date: "July 2026", group: "quality" },

    /* ---- Clinical and public health ---- */
    { name: "The Social and Technical Context of Health Informatics",
      issuer: "Johns Hopkins University · Coursera", date: "7 May 2026",
      id: "VSOQRHYQGT8A", group: "clinical" },
    { name: "Foundations of Public Health Practice: The Public Health Approach",
      issuer: "Imperial College London · Coursera", date: "2 May 2026",
      id: "26IUC1N78A29", group: "clinical" },
    { name: "Basic Course in Vector-Borne Diseases for Health Professionals",
      issuer: "SWAYAM MHRD", date: "September 2024", group: "clinical" },
    { name: "Wound Management in Resource-Limited Settings: Training of Health Workers on Skin-NTDs",
      issuer: "World Health Organization", date: "September 2024", group: "clinical" },
    { name: "Management of Tuberculosis in Children and Adolescents — Programmatic Considerations",
      issuer: "World Health Organization", date: "July 2024", group: "clinical" },
    { name: "How to Taper Patients Off of Chronic Opioid Therapy",
      issuer: "Stanford University School of Medicine", date: "July 2024", group: "clinical" },
    { name: "Dose Calculation Program Module", issuer: "MEDODRIX",
      date: "July 2024", group: "clinical" }
  ],

  skills: [
    "Quality Improvement", "Clinical Documentation Design (NABH)", "Pharmacy Practice",
    "Antimicrobial Stewardship", "Patient Safety", "Clinical Audit", "IBM SPSS Statistics",
    "Web Content Writing", "Analytical Skills", "Problem Solving", "Team Leadership",
    "Communication", "Basic Life Support (BLS)", "Marketing", "Support Services"
  ],

  /* Counters for the animated stat band. Derived at render time where possible so they
     cannot fall out of step with the arrays above. */
  stats: [
    { key: "publications", label: "Peer-reviewed publications" },
    { key: "journals", value: 2, label: "Journals peer-reviewed for" },
    { key: "certifications", label: "Certifications" },
    { key: "years", value: 8, label: "Years in practice and writing" }
  ]
};
