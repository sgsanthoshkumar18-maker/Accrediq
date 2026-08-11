/* Inject the command bar into every page. Idempotent: node build/set-command.js
   Depth-aware paths, same as build/set-motion.js. */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const SKIP = new Set(["node_modules", ".git", "build", "tests",
  "galaxy", "galaxy2", "brain", "dna", "helix", "radar", "globe", "hglobe", "kpinet"]);

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const f = path.join(dir, n);
    if (fs.statSync(f).isDirectory()) walk(f, out);
    else if (n.endsWith(".html")) out.push(f);
  }
  return out;
}

let changed = 0, already = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, path.dirname(file));
  const p = (!rel || rel === ".") ? "" : rel.split(path.sep).map(() => "../").join("");
  if (html.includes("search/command.js")) { already++; continue; }
  if (!html.includes("</head>") || !html.includes("</body>")) continue;
  html = html.replace("</head>", `<link rel="stylesheet" href="${p}search/command.css">\n</head>`);
  // After the datasets, so the index can read whatever the page happens to have loaded.
  html = html.replace("</body>", `<script src="${p}search/command.js"></script>\n</body>`);
  fs.writeFileSync(file, html);
  changed++;
}
console.log(`command bar: ${changed} updated, ${already} already had it`);
