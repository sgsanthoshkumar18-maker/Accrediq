/* One-off maintenance script: restore the serif A as an outlined path.
 *
 * History of this mark, so nobody re-treads it:
 *   1. The A was an SVG <text> glyph in Georgia, positioned by baseline (y="26.6").
 *      Georgia is absent on Android and most iOS builds, so the fallback serif's metrics
 *      sat the letter high — correct on a desktop, off centre on a phone.
 *   2. It was replaced with a stroked triangle, which centred correctly but lost the
 *      serifs, and the serifs are the mark.
 *   3. This: the serif letterform drawn as an outline. Font-independent like the stroke
 *      version, and identical to the original shape.
 *
 * Geometry is symmetric about x=20 and spans y 14.05 to 25.95 — centred on (20,20) by
 * construction rather than by a font's opinion of where a baseline goes. Cap height is
 * ~0.37 of the ring diameter, matching the original Georgia proportion.
 *
 * fill-rule="evenodd" is required: the counter (the triangular hole above the crossbar)
 * is a second subpath, and without evenodd it fills solid and the A becomes a triangle.
 *
 * Re-runnable.
 */
const fs = require("fs");
const path = require("path");

// Outer silhouette. The crossbar's underside is part of it, which is why the space
// between the two feet is open.
const OUTER = "M19.15 14.05H20.85L25.61 25.015H26.97V25.95H22.21V25.015H23.315L22 22H18" +
              "L16.685 25.015H17.79V25.95H13.03V25.015H14.39Z";
// The counter above the crossbar.
const COUNTER = "M20 16.26L22.027 20.935H17.973Z";
const A_PATH = OUTER + COUNTER;

// Matches the stroked A introduced by the previous pass, in either quote style.
const STROKE_RE = /<path\s+d=(['"])M13\.6 26\.6[^'"]*\1[^>]*\/>/g;

function replacement(tag) {
  const strokeMatch = tag.match(/stroke=(['"])(.*?)\1/);
  const q = strokeMatch ? strokeMatch[1] : '"';
  const colour = strokeMatch ? strokeMatch[2] : "currentColor";
  return "<path d=" + q + A_PATH + q +
    " fill=" + q + colour + q +
    " fill-rule=" + q + "evenodd" + q + "/>";
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(html|js)$/.test(name) && !/^(center-mark|serif-mark)\.js$/.test(name)) out.push(full);
  }
  return out;
}

const root = path.join(__dirname, "..");
let files = 0, marks = 0;

for (const file of walk(root, [])) {
  const src = fs.readFileSync(file, "utf8");
  STROKE_RE.lastIndex = 0;
  if (!STROKE_RE.test(src)) continue;
  STROKE_RE.lastIndex = 0;
  let n = 0;
  const out = src.replace(STROKE_RE, (tag) => { n++; return replacement(tag); });
  if (out !== src) { fs.writeFileSync(file, out); files++; marks += n; }
}

console.log("serif mark: " + marks + " replaced across " + files + " files");
