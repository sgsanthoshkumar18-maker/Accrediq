/* AQcredix — high-end antimicrobial catalogue.
 *
 * Twelve high-end antibiotics and six high-end antifungals — the same list Indian
 * hospitals commonly restrict on their antimicrobial stewardship formulary. The
 * WHO Defined Daily Dose (DDD) figures and the common vial strengths come from
 * Dr Santhoshkumar's DDD workbook (Apollo Vanagaram, May 2025 report), which
 * itself takes them from the WHO ATC/DDD Index. Combinations are pre-populated
 * where they matter (e.g. Meropenem alone vs Meropenem + Sulbactam) but the
 * tracker also lets the auditor enter any custom combination on the fly.
 *
 * The WHO DDD value is quoted in the unit the drug is supplied in ("g" for
 * grams, "MIU" for million international units, "MU" for mega units), so a
 * comparison across drugs uses each drug's own reference; the DDD/1000 patient-
 * day ratio is computed the same way in every case: DDD = total_dose / who_ddd. */
(function (root) {
  "use strict";

  var DRUGS = [
    /* ============================ Antibiotics ============================ */
    { id: "ertapenem",           name: "Ertapenem",             group: "antibiotic",
      whoDdd: 1,    unit: "g",
      strengths: [1],
      combos: ["Ertapenem"] },

    { id: "vancomycin",          name: "Vancomycin",            group: "antibiotic",
      whoDdd: 2,    unit: "g",
      strengths: [0.5, 1],
      combos: ["Vancomycin"] },

    { id: "linezolid",           name: "Linezolid",             group: "antibiotic",
      whoDdd: 1.2,  unit: "g",
      strengths: [0.6],
      combos: ["Linezolid"] },

    { id: "ceftazidime-avibactam", name: "Ceftazidime + Avibactam", group: "antibiotic",
      whoDdd: 6,    unit: "g",
      strengths: [2.5],
      combos: ["Ceftazidime + Avibactam"] },

    { id: "meropenem",           name: "Meropenem",             group: "antibiotic",
      whoDdd: 3,    unit: "g",
      strengths: [0.5, 1, 2],
      combos: ["Meropenem", "Meropenem + Sulbactam", "Meropenem + Tazobactam"] },

    { id: "colistin",            name: "Colistin",              group: "antibiotic",
      whoDdd: 9,    unit: "MIU",
      strengths: [1, 2, 3, 4.5],
      combos: ["Colistin"] },

    { id: "polymyxin-b",         name: "Polymyxin B",           group: "antibiotic",
      whoDdd: 0.15, unit: "MU",
      strengths: [0.5, 0.75],
      combos: ["Polymyxin B"] },

    { id: "imipenem-cilastatin", name: "Imipenem + Cilastatin", group: "antibiotic",
      whoDdd: 2,    unit: "g",
      strengths: [0.25, 0.5, 1],
      combos: ["Imipenem + Cilastatin"] },

    { id: "teicoplanin",         name: "Teicoplanin",           group: "antibiotic",
      whoDdd: 0.4,  unit: "g",
      strengths: [0.2, 0.4],
      combos: ["Teicoplanin"] },

    { id: "daptomycin",          name: "Daptomycin",            group: "antibiotic",
      whoDdd: 0.28, unit: "g",
      strengths: [0.35, 0.5],
      combos: ["Daptomycin"] },

    { id: "tigecycline",         name: "Tigecycline",           group: "antibiotic",
      whoDdd: 0.1,  unit: "g",
      strengths: [0.05],
      combos: ["Tigecycline"] },

    { id: "fosfomycin",          name: "Fosfomycin",            group: "antibiotic",
      whoDdd: 8,    unit: "g",
      strengths: [4],
      combos: ["Fosfomycin"] },

    /* ============================ Antifungals ============================ */
    { id: "anidulafungin",       name: "Anidulafungin",         group: "antifungal",
      whoDdd: 0.1,  unit: "g",
      strengths: [0.1],
      combos: ["Anidulafungin"] },

    { id: "voriconazole",        name: "Voriconazole",          group: "antifungal",
      whoDdd: 0.4,  unit: "g",
      strengths: [0.2],
      combos: ["Voriconazole"] },

    { id: "caspofungin",         name: "Caspofungin",           group: "antifungal",
      whoDdd: 0.5,  unit: "g",
      strengths: [0.05, 0.07],
      combos: ["Caspofungin"] },

    { id: "amphotericin-b",      name: "Amphotericin B (liposomal)", group: "antifungal",
      whoDdd: 0.21, unit: "g",
      strengths: [0.05],
      combos: ["Amphotericin B"] },

    { id: "micafungin",          name: "Micafungin",            group: "antifungal",
      whoDdd: 0.1,  unit: "g",
      strengths: [0.05],
      combos: ["Micafungin"] },

    /* WHO DDD for Isavuconazole is not in the source workbook; the value below
     * follows the current WHO ATC/DDD Index (2024) — J02AC05. If your hospital
     * uses a different reference, correct it in the DDD calculator. */
    { id: "isavuconazole",       name: "Isavuconazole",         group: "antifungal",
      whoDdd: 0.2,  unit: "g",
      strengths: [0.2],
      combos: ["Isavuconazole"] },
  ];

  root.AMSP_DRUGS = DRUGS;
})(window);
