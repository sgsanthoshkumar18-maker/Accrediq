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
 * day ratio is computed the same way in every case: DDD = total_dose / who_ddd.
 *
 * WHO REFERENCE PROVENANCE. Each drug carries its ATC code and the DDD is
 * verified against the WHO Collaborating Centre for Drug Statistics Methodology
 * ATC/DDD Index at https://atcddd.fhi.no . The index is updated annually (each
 * January), and a build-time script (build/refresh-who-ddd.js) fetches the
 * current values for every drug in this file and prints a diff to help the
 * maintainer keep the catalogue in step. The verification date below is the
 * last time that script's diff was reviewed. */
(function (root) {
  "use strict";

  /* Last time build/refresh-who-ddd.js was run and its diff reviewed. Update
   * this alongside any change to a whoDdd value. The tracker page renders
   * this on its "WHO ATC/DDD — verified" badge. */
  var WHO_VERIFIED = "2026-09-22";
  var WHO_INDEX_URL = "https://atcddd.fhi.no/atc_ddd_index/";
  function atcLink(code) {
    return WHO_INDEX_URL + "?code=" + encodeURIComponent(code) + "&showdescription=no";
  }

  var DRUGS = [
    /* ============================ Antibiotics ============================ */
    { id: "ertapenem",           name: "Ertapenem",             group: "antibiotic",
      atc: "J01DH03", whoDdd: 1,    unit: "g", whoRoute: "P",
      strengths: [1],
      combos: ["Ertapenem"] },

    { id: "vancomycin",          name: "Vancomycin",            group: "antibiotic",
      atc: "J01XA01", whoDdd: 2,    unit: "g", whoRoute: "P",
      strengths: [0.5, 1],
      combos: ["Vancomycin"] },

    { id: "linezolid",           name: "Linezolid",             group: "antibiotic",
      atc: "J01XX08", whoDdd: 1.2,  unit: "g", whoRoute: "P",
      strengths: [0.6],
      combos: ["Linezolid"] },

    { id: "ceftazidime-avibactam", name: "Ceftazidime + Avibactam", group: "antibiotic",
      atc: "J01DD52", whoDdd: 6,    unit: "g", whoRoute: "P",
      strengths: [2.5],
      combos: ["Ceftazidime + Avibactam"] },

    { id: "meropenem",           name: "Meropenem",             group: "antibiotic",
      atc: "J01DH02", whoDdd: 3,    unit: "g", whoRoute: "P",
      strengths: [0.5, 1, 2],
      combos: ["Meropenem", "Meropenem + Sulbactam", "Meropenem + Tazobactam"] },

    { id: "colistin",            name: "Colistin",              group: "antibiotic",
      atc: "J01XB01", whoDdd: 9,    unit: "MIU", whoRoute: "P",
      strengths: [1, 2, 3, 4.5],
      combos: ["Colistin"] },

    { id: "polymyxin-b",         name: "Polymyxin B",           group: "antibiotic",
      atc: "J01XB02", whoDdd: 0.15, unit: "MU", whoRoute: "P",
      strengths: [0.5, 0.75],
      combos: ["Polymyxin B"] },

    { id: "imipenem-cilastatin", name: "Imipenem + Cilastatin", group: "antibiotic",
      atc: "J01DH51", whoDdd: 2,    unit: "g", whoRoute: "P",
      strengths: [0.25, 0.5, 1],
      combos: ["Imipenem + Cilastatin"] },

    { id: "teicoplanin",         name: "Teicoplanin",           group: "antibiotic",
      atc: "J01XA02", whoDdd: 0.4,  unit: "g", whoRoute: "P",
      strengths: [0.2, 0.4],
      combos: ["Teicoplanin"] },

    { id: "daptomycin",          name: "Daptomycin",            group: "antibiotic",
      atc: "J01XX09", whoDdd: 0.28, unit: "g", whoRoute: "P",
      strengths: [0.35, 0.5],
      combos: ["Daptomycin"] },

    { id: "tigecycline",         name: "Tigecycline",           group: "antibiotic",
      atc: "J01AA12", whoDdd: 0.1,  unit: "g", whoRoute: "P",
      strengths: [0.05],
      combos: ["Tigecycline"] },

    { id: "fosfomycin",          name: "Fosfomycin",            group: "antibiotic",
      atc: "J01XX01", whoDdd: 8,    unit: "g", whoRoute: "P",
      strengths: [4],
      combos: ["Fosfomycin"] },

    /* ============================ Antifungals ============================ */
    { id: "anidulafungin",       name: "Anidulafungin",         group: "antifungal",
      atc: "J02AX06", whoDdd: 0.1,  unit: "g", whoRoute: "P",
      strengths: [0.1],
      combos: ["Anidulafungin"] },

    { id: "voriconazole",        name: "Voriconazole",          group: "antifungal",
      atc: "J02AC03", whoDdd: 0.4,  unit: "g", whoRoute: "P",
      strengths: [0.2],
      combos: ["Voriconazole"] },

    { id: "caspofungin",         name: "Caspofungin",           group: "antifungal",
      atc: "J02AX04", whoDdd: 0.05, unit: "g", whoRoute: "P",
      strengths: [0.05, 0.07],
      combos: ["Caspofungin"] },

    { id: "amphotericin-b",      name: "Amphotericin B (liposomal)", group: "antifungal",
      atc: "J02AA01", whoDdd: 0.035, unit: "g", whoRoute: "P",
      strengths: [0.05],
      combos: ["Amphotericin B"] },

    { id: "micafungin",          name: "Micafungin",            group: "antifungal",
      atc: "J02AX05", whoDdd: 0.1,  unit: "g", whoRoute: "P",
      strengths: [0.05],
      combos: ["Micafungin"] },

    { id: "isavuconazole",       name: "Isavuconazole",         group: "antifungal",
      atc: "J02AC05", whoDdd: 0.2,  unit: "g", whoRoute: "P",
      strengths: [0.2],
      combos: ["Isavuconazole"] },
  ];

  root.AMSP_DRUGS = DRUGS;
  root.AMSP_WHO = {
    verified: WHO_VERIFIED,
    indexUrl: WHO_INDEX_URL,
    atcLink: atcLink,
  };
})(window);
