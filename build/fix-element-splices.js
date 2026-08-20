/* One-off repair of two data faults in nabh-data.js.
 *
 *   node build/fix-element-splices.js --dry     (report only, changes nothing)
 *   node build/fix-element-splices.js           (apply)
 *
 * WHAT WAS WRONG. The stored element text was scraped, and the scraper did not stop at
 * the element boundary. In 58 places the LAST element of standard N has the HEADING of
 * standard N+1 glued to the end of it, with no punctuation between:
 *
 *   AAC.1.d  "...are prominently displayed. The organisation has a well-defined
 *             registration and admission"          <- that tail is AAC.2's heading
 *
 * This matters more than the copyright question that prompted the summary migration. A
 * hospital preparing against AAC.1.d was reading a requirement that belongs to a
 * different standard, and the sentence it ended on was truncated mid-clause. Wrong
 * standard text in a product hospitals prepare with is a worse defect than copied
 * standard text: one is a legal exposure, the other can cause a hospital to fail an
 * element it thought it had covered.
 *
 * THE SECOND FAULT: IPC.7.h. It is not an element at all. Its text is two fragments
 * spliced together — the tail of IPC.6.h ("...control outbreaks") followed by the opening
 * of another standard ("The organisation takes action to prevent or reduce healthcare") —
 * and its letter is "h" in a standard whose elements otherwise run a to e. Three separate
 * checks agree it is spurious: removing it takes IPC from 50 elements to the published
 * 49, takes IPC's Commitment count from 34 to the published 33, and makes IPC.7's letter
 * sequence contiguous. It was the single element behind the 640-vs-639 discrepancy.
 *
 * WHY THIS IS SAFE TO DO MECHANICALLY. Neither repair writes any new standard text. Both
 * only REMOVE text that provably belongs somewhere else — the truncation point is the
 * exact index at which another standard's own heading begins. Every one of the 58 results
 * ends on a full stop. Authoring replacement wording is a separate job and belongs to
 * nabh-summary.js, where it is Dr Santhoshkumar's professional judgement against a
 * legitimate copy of the standard.
 *
 * This is idempotent: run it twice and the second run reports nothing to do.
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "nabh-data.js");
const DRY = process.argv.includes("--dry");

const raw = fs.readFileSync(FILE, "utf8");
const PREFIX = "window.NABH_DATA = ";
if (!raw.startsWith(PREFIX)) {
  console.error("nabh-data.js does not start with '" + PREFIX + "' — aborting rather than guessing.");
  process.exit(1);
}
const body = raw.slice(PREFIX.length).replace(/;\s*$/, "");
const D = JSON.parse(body);

/* Every standard's opening words, used as the needle. Short headings are skipped: a
   25-character prefix can occur innocently inside a long element, and a false positive
   here would silently delete real requirement text. */
const heads = [];
for (const k of Object.keys(D.chapters)) {
  for (const s of D.chapters[k].standards) {
    const head = (s.text || "").slice(0, 45).trim();
    if (head.length > 25) heads.push({ code: s.code, head: head });
  }
}

/* ---- fault 2 first: drop the spurious IPC.7.h ---------------------------------- */
let removed = 0;
const ipc7 = D.chapters.IPC.standards.find(s => s.code === "IPC.7");
if (ipc7) {
  const before = ipc7.elements.length;
  ipc7.elements = ipc7.elements.filter(e => e.letter !== "h");
  removed = before - ipc7.elements.length;
}

/* ---- fault 1: strip the appended foreign heading -------------------------------- */
let repaired = 0;
const log = [];
for (const k of Object.keys(D.chapters)) {
  for (const s of D.chapters[k].standards) {
    for (const e of s.elements) {
      const t = e.text || "";
      for (const h of heads) {
        const i = t.indexOf(h.head);
        /* i > 25 keeps an element that legitimately BEGINS with the same words as its own
           standard — common, and not a splice. */
        if (i > 25) {
          const kept = t.slice(0, i).trim();
          if (kept.length >= 20) {
            log.push(s.code + "." + e.letter + "  <- " + h.code);
            e.text = kept;
            repaired++;
          }
          break;
        }
      }
    }
  }
}

/* ---- verify against the published figures before writing ------------------------ */
let stored = 0;
for (const k of Object.keys(D.chapters))
  for (const s of D.chapters[k].standards) stored += s.elements.length;

console.log("spurious elements removed : " + removed + "  (expected 1: IPC.7.h)");
console.log("spliced elements repaired : " + repaired);
console.log("stored elements now       : " + stored + "   published: " + D.totals.elements);

for (const k of Object.keys(D.chapters)) {
  let n = 0;
  for (const s of D.chapters[k].standards) n += s.elements.length;
  if (n !== D.official[k].elements)
    console.log("  STILL MISMATCHED: " + k + " stored " + n + " official " + D.official[k].elements);
}

if (DRY) {
  console.log("\n--dry: nothing written. Repairs that would be made:");
  for (const l of log.slice(0, 12)) console.log("  " + l);
  if (log.length > 12) console.log("  ...and " + (log.length - 12) + " more");
  process.exit(0);
}

if (stored !== D.totals.elements) {
  console.error("\nRefusing to write: element count " + stored +
                " does not match the published " + D.totals.elements + ".");
  process.exit(1);
}

fs.writeFileSync(FILE, PREFIX + JSON.stringify(D) + ";");
console.log("\nnabh-data.js rewritten.");
