/* Expands the PDF's shorthand into real NABH element codes, validates every one of them
 * against nabh-data.js, and writes audit/scope-data.js.
 *
 * Anything that fails to resolve is written to build/scope-unmatched.json rather than
 * shipped. The checklist PDF is a scanned working document with genuine typos in it;
 * silently shipping a dead code would put a row on an auditor's screen that no NABH
 * standard backs.
 *
 *   node build/build-scope.js
 */
const fs = require("fs");
const path = require("path");

global.window = {};
/* The repo root is the parent of build/, found by walking up rather than by naming the
   folder. The folder name used to be hardcoded as "AccrediQ", which broke this script
   the moment the directory was renamed — and it is the only place in the project that
   cared about the folder's name at all. Everything the website serves uses relative
   paths, so the checkout can be called anything. */
const ROOT = path.join(__dirname, "..");
require(path.join(ROOT, "nabh-data.js"));
const D = global.window.NABH_DATA;
const SRC = require("./scope-source.js");

/* The PDF predates the current chapter naming. */
const ALIAS = { HIC: "IPC", CQI: "PSQ" };

/* code -> { chapter, standard, standardText, letter, text, category, sop } */
const INDEX = {};
Object.keys(D.chapters).forEach(ck => {
  D.chapters[ck].standards.forEach(st => {
    st.elements.forEach(el => {
      INDEX[st.code + "." + el.letter] = {
        chapter: ck, standard: st.code, standardText: st.text,
        letter: el.letter, text: el.text,
        category: el.category, sop: !!el.sop
      };
    });
  });
});
const LETTERS_OF = {};
Object.keys(INDEX).forEach(c => {
  const st = INDEX[c].standard;
  (LETTERS_OF[st] = LETTERS_OF[st] || []).push(INDEX[c].letter);
});

const unmatched = [];

function expandToken(tok, deptKey) {
  tok = tok.trim();
  if (!tok) return [];
  // "AAC.4 a,b,c" | "COP.7 a-h" | "COP.4"
  const m = tok.match(/^([A-Z]{3})\.(\d+)\s*(.*)$/);
  if (!m) { unmatched.push({ dept: deptKey, token: tok, reason: "unparseable" }); return []; }

  const chap = ALIAS[m[1]] || m[1];
  const std = chap + "." + m[2];
  const spec = m[3].trim();

  if (!LETTERS_OF[std]) {
    unmatched.push({ dept: deptKey, token: tok, resolved: std, reason: "no such standard" });
    return [];
  }
  if (!spec) return LETTERS_OF[std].map(l => std + "." + l);   // whole standard

  const want = [];
  spec.split(",").forEach(part => {
    part = part.trim();
    const r = part.match(/^([a-z])\s*-\s*([a-z])$/);
    if (r) {
      for (let c = r[1].charCodeAt(0); c <= r[2].charCodeAt(0); c++) {
        want.push(String.fromCharCode(c));
      }
    } else if (/^[a-z]$/.test(part)) {
      want.push(part);
    } else if (part) {
      unmatched.push({ dept: deptKey, token: tok, part: part, reason: "bad letter spec" });
    }
  });

  const out = [];
  want.forEach(l => {
    const code = std + "." + l;
    if (INDEX[code]) out.push(code);
    // A range that overshoots the standard's real element count is expected — the PDF
    // writes "a-h" loosely. Only flag a MISS when the letter was named explicitly.
    else if (!/-/.test(spec)) unmatched.push({ dept: deptKey, token: tok, code, reason: "no such element" });
  });
  return out;
}

const scope = {};
Object.keys(SRC).forEach(key => {
  const d = SRC[key];
  const codes = [];
  d.codes.split(";").forEach(tok => {
    expandToken(tok, key).forEach(c => { if (codes.indexOf(c) === -1) codes.push(c); });
  });
  scope[key] = {
    key, name: d.name, group: d.group, pdfPage: d.pdfPage,
    inherits: d.inherits || null,
    quickList: d.quickList || [],
    kpis: d.kpis || [],
    codes
  };
});

/* Merge inherited scopes (the PDF's "in addition to wards"). */
Object.keys(scope).forEach(k => {
  const s = scope[k];
  if (!s.inherits) return;
  const parent = scope[s.inherits];
  if (!parent) { unmatched.push({ dept: k, reason: "unknown parent " + s.inherits }); return; }
  const merged = parent.codes.slice();
  s.codes.forEach(c => { if (merged.indexOf(c) === -1) merged.push(c); });
  s.codes = merged;
  s.quickList = parent.quickList.concat(s.quickList);
  s.kpis = parent.kpis.concat(s.kpis.filter(x => parent.kpis.indexOf(x) === -1));
});

/* Every clinical area's table ends with patient + staff interview. */
const INTERVIEWS = {
  patient: { label: "Patient and family interview",
    codes: "AAC.5 b; AAC.13 a; COP.19; COP.17; COP.19 e; MOM.11 d; PRE.1 b; PRE.2 a-j; PRE.3 a-e; PRE.4 a-e; PRE.5 a-g; PRE.6 c,d; PRE.7 b" },
  care: { label: "Staff interview — care of patients",
    codes: "AAC.12 c,d; COP.5 a-f; COP.8 c; COP.9 b; COP.16 b; COP.12 c,d; COP.15 c,d; COP.17 e; COP.17 a-d; COP.20 e; MOM.3 d-g; MOM.7 b-h; MOM.7 a,b; MOM.8 d; PRE.1 d; PRE.8 f; IPC.1 c,d; PSQ.1" },
  hr: { label: "Staff interview — HR", codes: "HRM.3 a-e; HRM.7 a-e; HRM.9 a-d" },
  safety: { label: "Staff interview — safety",
    codes: "AAC.8 d,e; AAC.11 e; COP.4 a-d; MOM.9 a-e; IPC.4 d; HRM.6; FMS.7 c; FMS.3 e; COP.11 f; HRM.4 b,c; HRM.4 d" }
};
const interviewCodes = {};
Object.keys(INTERVIEWS).forEach(k => {
  const out = [];
  INTERVIEWS[k].codes.split(";").forEach(tok => {
    expandToken(tok, "interview:" + k).forEach(c => { if (out.indexOf(c) === -1) out.push(c); });
  });
  interviewCodes[k] = { label: INTERVIEWS[k].label, codes: out };
});

/* Sort each department's codes into chapter, then standard number, then letter —
   an auditor works down a checklist, not through insertion order. */
const CH_ORDER = ["AAC", "COP", "MOM", "PRE", "IPC", "PSQ", "ROM", "FMS", "HRM", "IMS"];
function sortCodes(codes) {
  return codes.slice().sort((a, b) => {
    const A = a.split("."), B = b.split(".");
    const ci = CH_ORDER.indexOf(A[0]) - CH_ORDER.indexOf(B[0]);
    if (ci) return ci;
    const ni = (+A[1]) - (+B[1]);
    if (ni) return ni;
    return A[2] < B[2] ? -1 : A[2] > B[2] ? 1 : 0;
  });
}
Object.keys(scope).forEach(k => { scope[k].codes = sortCodes(scope[k].codes); });
Object.keys(interviewCodes).forEach(k => {
  interviewCodes[k].codes = sortCodes(interviewCodes[k].codes);
});

const header =
`/* AQcredix — department audit scope. GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Source: 5thEdChkList.pdf (NABH 5th Edition assessor checklist), transcribed in
 * build/scope-source.js and expanded by build/build-scope.js. Regenerate with:
 *
 *     node build/build-scope.js
 *
 * Scope is taken from the printed assessor checklist rather than from keyword matching,
 * because which elements an assessor checks in a given area is a published fact, not
 * something to infer from a regex. DEPT_DATA keywords stay where they are, driving the
 * department deep-dive pages.
 *
 * Every code below is verified to exist in nabh-data.js at build time.
 * Chapter aliases applied: HIC -> IPC, CQI -> PSQ.
 */
`;

const outDir = path.join(ROOT, "audit");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "scope-data.js"),
  header +
  "window.AUDIT_SCOPE = " + JSON.stringify(scope, null, 1) + ";\n\n" +
  "window.AUDIT_INTERVIEWS = " + JSON.stringify(interviewCodes, null, 1) + ";\n");

fs.writeFileSync(path.join(__dirname, "scope-unmatched.json"),
  JSON.stringify(unmatched, null, 2));

const total = Object.keys(scope).reduce((n, k) => n + scope[k].codes.length, 0);
console.log("departments:", Object.keys(scope).length);
console.log("scoped element rows:", total);
console.log("unmatched tokens:", unmatched.length);
unmatched.slice(0, 40).forEach(u => console.log("  !", JSON.stringify(u)));
