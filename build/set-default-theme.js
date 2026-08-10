/* One-off maintenance script: normalise the theme boot snippet across every page.
 *
 * The snippet had drifted into three different versions across 42 pages, and all of them
 * treated light as the default — a stored value was needed to get dark or neon. The house
 * look is neon dark, so absence of a preference must now mean neon dark, and only an
 * explicit "light"/"default" (written by the toggles) opts out.
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
  'var p=new URLSearchParams(location.search);' +
  // Only the owner may CHANGE the palette; everyone applies whatever is published.
  'var own=localStorage.getItem("aq-is-owner")==="1";' +
  'if(p.has("dark")){localStorage.setItem("aq-theme",p.get("dark")==="0"?"light":"dark");}' +
  'if(own&&p.has("neon")){localStorage.setItem("aq-palette",p.get("neon")==="0"?"default":"neon");}' +
  'var t=localStorage.getItem("aq-theme")||"dark";' +
  'var q=localStorage.getItem("aq-palette")||DEF;' +
  'if(t!=="light"){document.documentElement.setAttribute("data-theme","dark");}' +
  // Neon is a true-black palette and unreadable over light, so it only rides with dark.
  'if(q==="neon"&&t!=="light"){document.documentElement.setAttribute("data-palette","neon");}' +
  '}catch(e){' +
  // Private browsing throws on localStorage. Ship the house look rather than falling
  // back to a palette the visitor was never meant to see.
  'document.documentElement.setAttribute("data-theme","dark");' +
  'document.documentElement.setAttribute("data-palette","neon");' +
  '}})();<\/script>';

const BOOT = /<script>\(function\(\)\{try\{[\s\S]*?\}\)\(\);<\/script>/;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
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
