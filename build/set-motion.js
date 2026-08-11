/* Inject the motion layer into every HTML page.
 *
 * Same shape as build/set-default-theme.js: idempotent, run it as often as you like.
 *   node build/set-motion.js
 *
 * The stylesheet goes last in <head> so it wins over page CSS on specificity ties, and
 * the script goes last in <body> so the DOM it observes already exists. The path is
 * computed per file from its depth, because pages live at the root, in workspace/, and
 * in audit/ — a fixed "motion/motion.js" would 404 on every nested page.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CSS_MARK = "motion/motion.css";
const JS_MARK = "motion/motion.js";

/* Directories that are not part of the site: build tooling, tests, dependencies, and the
   ten abandoned hero experiments, which should not gain new script tags while they wait
   to be deleted. */
const SKIP = new Set([
  "node_modules", ".git", "build", "tests",
  "galaxy", "galaxy2", "brain", "dna", "helix", "radar", "globe", "hglobe", "kpinet"
]);

function walk(dir, out) {
  out = out || [];
  for (const name of fs.readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

function prefixFor(file) {
  const rel = path.relative(ROOT, path.dirname(file));
  if (!rel || rel === ".") return "";
  return rel.split(path.sep).map(() => "../").join("");
}

let changed = 0, already = 0, skipped = 0;

for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, "utf8");
  const p = prefixFor(file);

  if (html.includes(CSS_MARK) && html.includes(JS_MARK)) { already++; continue; }
  if (!html.includes("</head>") || !html.includes("</body>")) { skipped++; continue; }

  if (!html.includes(CSS_MARK)) {
    html = html.replace("</head>",
      '<link rel="stylesheet" href="' + p + 'motion/motion.css">\n</head>');
  }
  if (!html.includes(JS_MARK)) {
    html = html.replace("</body>",
      '<script src="' + p + 'motion/motion.js"></script>\n</body>');
  }

  fs.writeFileSync(file, html);
  changed++;
}

console.log("motion layer: " + changed + " updated, " + already + " already had it, " +
            skipped + " skipped (no head/body)");
