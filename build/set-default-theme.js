/* One-off maintenance script: normalise the theme boot snippet across every page.
 *
 * The snippet had drifted into three different versions across 42 pages. It was then
 * normalised the other way — absence of a preference meant neon dark — because neon dark
 * was the house look. Reader feedback reversed that: a first visit now opens light, and
 * dark is something the visitor chooses and is then asked whether to keep.
 *
 * It has to run inline in <head>, before any stylesheet paints, or the page flashes white
 * before the attribute lands. That is why this is duplicated into every file rather than
 * living in app.js, which loads far too late.
 *
 * Re-runnable: it replaces whatever boot snippet is there with the canonical one.
 */
const fs = require("fs");
const path = require("path");

const SNIPPET =
  '<script>(function(){try{' +
  /* The palette the site ships with. This is what a first-time visitor sees on their
     very first paint, before any network read — and getting it wrong is visible: with a
     "default" fallback the site opened blue and only turned neon on the second or third
     load, once the gate had fetched site_settings and cached it. The owner's published
     choice still overrides this on the next load; this only decides the cold start. */
  'var DEF="neon";' +
  /* One-time cache reset. The bug that stamped aq-palette="default" ran for months, so
     every device that ever opened a workspace page is carrying that value right now.
     Fixing the writer does not help them: "default" is a legitimate published choice, so
     nothing downstream can tell a poisoned cache from a real one. Bumping this marker
     clears the stored palette exactly once per device; the owner's published choice is
     re-read from site_settings on the next protected page and lands again within a load.
     Raise the number if a future bug ever poisons it again. */
  'if(localStorage.getItem("aq-palette-v")!=="2"){localStorage.removeItem("aq-palette");' +
  'localStorage.setItem("aq-palette-v","2");}' +
  'var p=new URLSearchParams(location.search);' +
  // Only the owner may CHANGE the palette; everyone applies whatever is published.
  'var own=localStorage.getItem("aq-is-owner")==="1";' +
  'if(p.has("dark")){localStorage.setItem("aq-theme",p.get("dark")==="0"?"light":"dark");}' +
  'if(own&&p.has("neon")){localStorage.setItem("aq-palette",p.get("neon")==="0"?"default":"neon");}' +
  /* LIGHT IS THE COLD START. Readers said so: a site that opens black is a choice
     made for them, and for a hospital quality manager opening it at a desk in
     daylight it reads as a consumer app, not a reference. So absence of any
     preference means light.

     Three values are consulted, in this order, and the order is the whole design:
       1. localStorage "aq-theme"  — a decision the visitor asked us to remember
       2. sessionStorage "aq-theme-s" — dark chosen for THIS visit only, so it
          holds across page navigations and is gone tomorrow
       3. light
     Choosing dark writes only (2). It is promoted to (1) when the visitor answers
     yes to the small prompt the toggle raises. */
  /* THE SESSION VALUE WINS. This order was the other way round and it broke the toggle
     outright: switching to light once wrote localStorage "light" for good, and from then
     on every dark choice — which only writes the session value — was read AFTER that
     "light" and never reached. Dark reverted on every single navigation.

     The session value is what the visitor chose a moment ago, in this tab. A stored value
     is what they chose on some earlier visit. The recent choice must win, or the toggle is
     decorative. */
  'var t=null;' +
  'try{t=sessionStorage.getItem("aq-theme-s");}catch(e2){}' +
  'if(!t){t=localStorage.getItem("aq-theme");}' +
  'if(!t){t="light";}' +
  /* Anything that is not the literal string "default" means neon. A plain ||DEF
     fallback only covered a MISSING value, so any other string left behind by an older
     build — or a stale "default" written by a bug since fixed — quietly opted the device
     out of the house look with no way back. Neon is the floor; only the owner's
     published "default" lifts it. */
  'var q=localStorage.getItem("aq-palette")||DEF;if(q!=="default"){q="neon";}' +
  /* Only the literal "dark" darkens. The old test was t!=="light", which darkened on
     any stray value — harmless when dark was the default, wrong now that light is. */
  'if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}' +
  // Neon is a true-black palette and unreadable over light, so it only rides with dark.
  'if(q==="neon"&&t==="dark"){document.documentElement.setAttribute("data-palette","neon");}' +
  '}catch(e){}' +
  /* Private browsing throws on localStorage. Nothing to do: no attribute means light,
     which is now exactly the right answer for a visitor we know nothing about. */
  '})();<\/script>';

const BOOT = /<script>\(function\(\)\{try\{[\s\S]*?\}\)\(\);<\/script>/;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    /* build/ holds og-card.html, which is a template rendered offscreen to produce the
       social image — it has no visitor and no theme, and stamping a boot snippet into it
       made it look like a site page to the test that checks every page loads the motion
       layer. tests/ and docs/ are excluded for the same reason: not pages. */
    if (name === "node_modules" || name === ".git" ||
        name === "build" || name === "tests" || name === "docs") continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith(".html")) out.push(full);
  }
  return out;
}

const root = path.join(__dirname, "..");
let changed = 0, added = 0;

for (const file of walk(root, [])) {
  const src = fs.readFileSync(file, "utf8");
  let out;
  if (BOOT.test(src)) {
    out = src.replace(BOOT, SNIPPET);
    if (out !== src) changed++;
  } else if (/<head>/i.test(src)) {
    // A page that never had the snippet would flash light and then stay light.
    out = src.replace(/<head>/i, "<head>\n" + SNIPPET);
    added++;
  } else {
    continue;
  }
  fs.writeFileSync(file, out);
}

console.log("boot snippet: " + changed + " replaced, " + added + " added");
