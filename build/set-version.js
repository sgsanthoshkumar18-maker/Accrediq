/* Stamp a version query onto every local CSS and JS reference.
 *
 *   node build/set-version.js
 *
 * WHY THIS EXISTS. Mobile browsers cache CSS and JS aggressively — far more so than
 * desktop — and a returning visitor keeps the old file until the URL changes. A CSS-only
 * fix therefore appears not to have deployed at all: the HTML is new, the stylesheet is
 * six hours old, and the page looks exactly as it did before the push. That is precisely
 * what happened with the publication reel on mobile, where founder.css was the only file
 * that had to change and was the one file with no version on it.
 *
 * Most of the site already carried ?v=20260805c. The founder portfolio, the calendar, the
 * motion layer and the command bar were all added later and never got one. This script
 * stamps them all, and re-stamps on every run, so it cannot drift again.
 *
 * The version is the current date plus a letter. Bump it by running the script; it
 * rewrites every reference in place.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

/* Change this when you want every browser to refetch. Date-based so it is obvious from
   the page source how stale a deployment is. */
const VERSION = process.argv[2] || (function () {
  const d = new Date();
  return d.getFullYear() +
         String(d.getMonth() + 1).padStart(2, "0") +
         String(d.getDate()).padStart(2, "0") + "a";
})();

const SKIP = new Set([
  "node_modules", ".git", "build", "tests",
  "galaxy", "galaxy2", "brain", "dna", "helix", "radar", "globe", "hglobe", "kpinet"
]);

/* Files that are not site pages even though they end in .html.
 *
 * videos/aqcredix-film.html is the FILM BUNDLE — a self-contained document shown inside
 * an iframe by videos/aq-film.js. Stamping it would put a canonical URL, a share card and
 * the analytics beacon inside the frame, which would claim the film is a page of its own
 * and count a second pageview every time someone presses play. It also carries its own
 * inline assets, so there is nothing for the version stamp to bust. Leave it alone. */
const SKIP_FILES = new Set(["aqcredix-film.html"]);


function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    if (SKIP.has(n) || SKIP_FILES.has(n)) continue;
    const f = path.join(dir, n);
    if (fs.statSync(f).isDirectory()) walk(f, out);
    else if (n.endsWith(".html")) out.push(f);
  }
  return out;
}

let files = 0, refs = 0;

for (const file of walk(ROOT)) {
  const before = fs.readFileSync(file, "utf8");

  /* Only local paths. An absolute URL points at a CDN we do not control, and appending a
     query to it can miss their cache or, worse, break a signed URL.

     /_vercel/ is excluded for that same reason even though it looks local. It is the
     platform's own endpoint — the Web Analytics script lives at
     /_vercel/insights/script.js — served and versioned by Vercel, not by us. Stamping it
     asks their edge for a URL we invented, which is the exact failure the rule above
     exists to prevent. */
  const after = before.replace(
    /(\s(?:href|src)=")((?!https?:|\/\/|data:|mailto:|\/_vercel\/)[^"?#]+\.(?:css|js))(\?[^"]*)?(")/g,
    function (m, lead, p, _q, tail) {
      refs++;
      return lead + p + "?v=" + VERSION + tail;
    }
  );

  if (after !== before) {
    fs.writeFileSync(file, after);
    files++;
  }
}

console.log("version " + VERSION + ": " + refs + " references stamped across " +
            files + " files changed");
