/* One-off maintenance script: centre the A inside the ring mark.
 *
 * The mark drew its A as an SVG <text> glyph positioned by baseline (y="26.6"), a number
 * derived from Georgia's cap height. Georgia is not installed on Android and on many
 * iOS versions, so the fallback serif's different metrics shifted the letter off centre —
 * visibly high on a phone while looking correct on a desktop with Georgia present.
 *
 * A baseline offset cannot fix that, because there is no single correct offset across
 * fonts. Drawing the A as a path removes the font from the equation: the geometry is
 * centred on (20,20) and renders identically on every device, which also means the mark
 * no longer changes shape when a font fails to load.
 *
 * Cap spans y 13.4 to 26.6 — dead centre on 20. Round caps extend it equally at both
 * ends, so the optical centre holds.
 *
 * Re-runnable: pages already converted contain no <text> node to match.
 */
const fs = require("fs");
const path = require("path");

const A_PATH = "M13.6 26.6L20 13.4L26.4 26.6M16.15 21.5H23.85";

// Matches the A glyph whichever quote style the file uses. Favicons are single-quoted
// inside a data: URI; the inline marks are double-quoted.
const TEXT_RE = /<text\s+[^>]*>A<\/text>/g;

/* The A's stroke is set a little lighter than the ring it sits inside, so the letter
   reads as a letter rather than as a fourth arc. */
function strokeFor(weight) { return weight >= 3 ? "3" : "2.4"; }

function replacement(tag) {
  const fillMatch = tag.match(/fill=(['"])(.*?)\1/);
  const q = fillMatch ? fillMatch[1] : '"';
  const colour = fillMatch ? fillMatch[2] : "currentColor";
  // The favicon marks use a heavier 3.4 ring; the inline ones use 2.6. The escaped hex
  // colour only ever appears in the favicon data URI, so it identifies the heavy variant.
  const weight = colour.indexOf("%23") === 0 ? 3.4 : 2.6;
  const w = strokeFor(weight);
  return "<path d=" + q + A_PATH + q +
    " fill=" + q + "none" + q +
    " stroke=" + q + colour + q +
    " stroke-width=" + q + w + q +
    " stroke-linecap=" + q + "round" + q +
    " stroke-linejoin=" + q + "round" + q + "/>";
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(html|js)$/.test(name) && name !== "center-mark.js") out.push(full);
  }
  return out;
}

const root = path.join(__dirname, "..");
let files = 0, marks = 0;

for (const file of walk(root, [])) {
  const src = fs.readFileSync(file, "utf8");
  if (!TEXT_RE.test(src)) { TEXT_RE.lastIndex = 0; continue; }
  TEXT_RE.lastIndex = 0;
  let n = 0;
  const out = src.replace(TEXT_RE, (tag) => { n++; return replacement(tag); });
  if (out !== src) { fs.writeFileSync(file, out); files++; marks += n; }
}

console.log("ring mark: " + marks + " glyphs replaced across " + files + " files");
