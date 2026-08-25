/* Palette rules: neon is the owner's, dark/light is everyone's. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', g, 'want', w); } };

const css = fs.readFileSync(path.join(__dirname, '../styles.css'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '../workspace/schema.sql'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// --- the boot snippet must not give neon to a non-owner
const boot = /<script>\(function\(\)\{try\{[\s\S]*?\}\)\(\);<\/script>/.exec(html)[0];
eq(/own&&p.has\("neon"\)/.test(boot), true, 'only the owner may CHANGE the palette via ?neon=');
eq(/q!=="default"&&t!=="light"/.test(boot), true, 'every visitor APPLIES the published palette');
eq(/q!=="default"&&t!=="light"/.test(boot), true, 'no palette rides over the light theme');
eq(/own&&p.has\("blood"\)/.test(boot), true, 'only the owner may CHANGE the palette via ?blood=');
eq(/q!=="default"&&q!=="blood"/.test(boot), true,
   'blood survives a page load instead of being folded into neon');
eq(/localStorage.getItem\("aq-is-owner"\)==="1"/.test(boot), true, 'boot reads the owner flag');
// The shipped default is now neon: falling back to "default" made the site open blue on
// a cold load and only turn neon after site_settings had been fetched and cached, which
// looked like needing two or three refreshes.
eq(/aq-palette"\)\|\|DEF/.test(boot), true, 'palette falls back to the shipped default');
eq(/var DEF="neon"/.test(boot), true, 'the shipped default is neon');
eq(/aq-theme"\)\|\|"dark"/.test(boot), true, 'theme still defaults to dark for everyone');

// --- the typed shortcut is owner-gated
eq(/function setPalette\(name\) \{[\s\S]{0,400}?if \(!isOwnerBrowser\(\)\) return;/.test(app), true,
   'typing a palette word does nothing for a non-owner');
/* The buffer was sliced to four characters, which silently makes any five-letter word
   unmatchable — "blood" could only ever have been seen as "lood". */
eq(/slice\(-8\)/.test(app), true, 'the typed buffer is long enough for a five-letter word');
eq(/endsWith\("blood"\)/.test(app), true, 'typing "blood" is recognised');
// --- the visible button must never set neon on its own
const btn = /const themeBtn[\s\S]*?\n    \}/.exec(app)[0];
eq(/localStorage.setItem\("aq-palette", "neon"\)/.test(btn), false,
   'the header button never turns neon on');
/* It restores the PUBLISHED palette for everyone. Gating the restore on ownership left
   a subscriber who tried light once stranded on blue for the rest of that page's life,
   because nothing else re-applies the attribute after boot. */
eq(/aq-palette"\) !== "default"/.test(btn), true,
   'returning to dark restores the published palette for every user');
eq(/isOwnerBrowser\(\)/.test(btn), false, 'the restore is not owner-gated');

/* --- the three ways the site used to open blue, each now locked shut --- */

// 1. Boot treats anything that is not a KNOWN palette as neon. "default" and "blood" are
//    known; everything else — including a value from a future build, or a corrupted one —
//    resolves to the shipped default rather than to an attribute nothing styles.
eq(/if\(q!=="default"&&q!=="blood"\)\{q="neon";\}/.test(boot), true,
   'an unknown stored value still resolves to neon');

// 1b. Devices poisoned by the old bug are cleared once, then boot neon.
eq(/aq-palette-v"\)!=="2"/.test(boot), true, 'the poisoned palette cache is reset once');
{
  const store = { 'aq-palette': 'default', 'aq-theme': 'dark' };   // a phone as it is today
  const attrs = {};
  const body = boot.replace(/<\/?script>/g, '').replace('<\\/script>', '');
  new Function('localStorage', 'document', 'location', 'URLSearchParams', body)(
    { getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; } },
    { documentElement: { setAttribute: (k, v) => { attrs[k] = v; },
                         removeAttribute: k => { delete attrs[k]; } } },
    { search: '' }, URLSearchParams);
  eq(attrs['data-palette'], 'neon', 'a device carrying the old bad value now boots neon');
  eq(store['aq-palette'], undefined, 'the poisoned value is cleared, not overwritten');

  // ...but a genuine published "default" from the owner is still honoured.
  const store2 = { 'aq-palette': 'default', 'aq-palette-v': '2', 'aq-theme': 'dark' };
  const attrs2 = {};
  new Function('localStorage', 'document', 'location', 'URLSearchParams', body)(
    { getItem: k => (k in store2 ? store2[k] : null),
      setItem: (k, v) => { store2[k] = String(v); },
      removeItem: k => { delete store2[k]; } },
    { documentElement: { setAttribute: (k, v) => { attrs2[k] = v; },
                         removeAttribute: k => { delete attrs2[k]; } } },
    { search: '' }, URLSearchParams);
  eq(attrs2['data-palette'], undefined, "the owner's published 'default' is still obeyed");
}

// 2. The workspace gate must never write a palette. It used to stamp
//    aq-palette="default" for every non-owner — including signed-out visitors, since
//    that branch is also taken when there is no user — which stuck the device on blue.
const shell = fs.readFileSync(path.join(__dirname, '../workspace/shell.js'), 'utf8');
eq(/setItem\("aq-palette"/.test(shell), false,
   'the workspace gate never writes the palette');
eq(/removeAttribute\("data-palette"\)/.test(shell), false,
   'the workspace gate never strips the palette');

// 3. An absent site_settings row means the shipped default, not the stale cache.
eq(/raw === "default" \|\| raw === "blood"\) \? raw : "neon"/.test(app), true,
   'a published "default" or "blood" is honoured; anything else is neon');

// The two gates must agree: neither may strip a non-owner's palette.
const gate = fs.readFileSync(path.join(__dirname, '../billing/page-gate.js'), 'utf8');
eq(/setItem\("aq-palette"/.test(gate), false,
   'the billing gate never writes the palette either');

// --- every palette must define the deep-surface tokens, or a theme inherits the wrong ones
['--deep-1', '--deep-2', '--border-strong'].forEach(tok => {
  const inNeon = new RegExp('\\[data-palette="neon"\\][\\s\\S]*?' + tok + ':').test(css);
  const inDark = new RegExp('\\[data-theme="dark"\\]\\{[\\s\\S]*?' + tok + ':').test(css);
  eq(inNeon, true, tok + ' defined for neon');
  eq(inDark, true, tok + ' defined for dark');
});

// --- and no component may still hardcode the indigo those tokens replaced
const body = css.slice(css.indexOf('html{scroll-behavior'));
['#232a6b', '#090b21', '#CBD0F0'].forEach(hex => {
  eq(body.includes(hex), false, 'no hardcoded ' + hex + ' left outside the token blocks');
});

// --- the build script must not depend on the checkout folder's name
const build = fs.readFileSync(path.join(__dirname, '../build/build-scope.js'), 'utf8');
// Only code matters here — the word still appears in a comment explaining the fix.
const buildCode = build.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
eq(/AccrediQ/.test(buildCode), false, 'build script no longer hardcodes the folder name');
eq(/path\.join\(ROOT, "audit"\)/.test(buildCode), true, 'build output path derived from the repo root');

// --- the neon palette must be teal, with no blue left anywhere in it
// Strip comments: the word "blue" appears in one explaining why it was removed.
const neonBlock = /:root\[data-palette="neon"\],\n:root\[data-palette="blood"\]\{[\s\S]*?\n\}/.exec(css)[0]
  .replace(/\/\*[\s\S]*?\*\//g, '');
['#38BDF8', '#22D3EE', '56,189,248', '34,211,238'].forEach(blue => {
  eq(neonBlock.includes(blue), false, 'neon palette contains no ' + blue);
});
eq(/--brand-2:#5EEAD4/.test(neonBlock), true, 'neon brand is the brain teal');
/* The home hero is a deliberate, documented exception: it keeps the original cyan tone
   to match the particle canvas it sits behind. Every OTHER neon rule must be teal, so
   the hero rules are excluded here rather than the check being dropped — that way a
   blue value creeping back into, say, the header would still fail. */
const neonRules = css.split('\n')
  .filter(l => l.includes('data-palette="neon"') && !l.includes('.hero'))
  .join('\n');
['#38BDF8', '#22D3EE', '56,189,248', '34,211,238', '#06283D'].forEach(blue => {
  eq(neonRules.includes(blue), false, 'no ' + blue + ' outside the hero exception');
});
// And the hero exception must actually still be there.
eq(/:root\[data-palette="neon"\] \.hero,\n:root\[data-palette="blood"\] \.hero\{[\s\S]*?--hero-tint:#22D3EE/.test(css), true,
   'home hero keeps its original cyan tone under neon');
/* ...and blood overrides that same hero afterwards, or the one screen the whole palette
   was designed around would still be cyan. */
/* The LAST blood .hero rule wins, and it is the one in the corrections block at the end.
   Matching the first would pass while the page rendered from a different rule entirely. */
const heroRules = css.split("}").filter(r => /:root\[data-palette="blood"\] \.hero\{/.test(r));
eq(/--hero-tint:#E23E4E/.test(heroRules[heroRules.length - 1] || ""), true,
   'the last blood hero rule tints to arterial red, not to a leftover cyan');
// It must be scoped to .hero — a bare override would repaint the whole site.
// Check the global block itself (already isolated as neonBlock above), not a span of
// the file that can run on into the hero rule.
eq(/--brand-2:#38BDF8/.test(neonBlock), false,
   'the cyan override is scoped to the hero, not the global palette');
eq(/--brand-2:#5EEAD4/.test(neonBlock), true,
   'the global neon brand stays teal');

// --- site_settings: everyone reads, only the owner writes
eq(/create policy site_settings_read on public\.site_settings\s+for select using \(true\)/.test(sql),
   true, 'site settings are readable by every visitor');
eq(/create policy site_settings_insert[\s\S]*?with check \(public\.aq_is_owner\(\)\)/.test(sql),
   true, 'only the owner may create the palette setting');
eq(/create policy site_settings_update[\s\S]*?using \(public\.aq_is_owner\(\)\)[\s\S]*?with check \(public\.aq_is_owner\(\)\)/.test(sql),
   true, 'only the owner may change the palette setting');

/* Mobile must never need its own colour rules. Palette changes are made with CSS
   variables on :root (and on .hero), which every breakpoint inherits — so a colour fixed
   on desktop is fixed on the phone in the same edit. A hardcoded colour inside a media
   query would break that guarantee silently, so this fails if one appears. */
{
  const lines = css.split('\n');
  let depth = 0, media = null; const offenders = [];
  lines.forEach((l, i) => {
    if (/@media/.test(l)) media = { d: depth };
    for (const c of l) {
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (media && depth <= media.d) media = null; }
    }
    // Neutral black/white shadows and scrims are palette-independent by nature — a drop
    // shadow is black in every theme — so they are not drift.
    const neutral = /rgba?\(\s*(0\s*,\s*0\s*,\s*0|255\s*,\s*255\s*,\s*255)\s*[,)]/.test(l)
                    && !/#[0-9a-fA-F]{3,8}/.test(l);
    if (media && !neutral && /(background|color|border-color|box-shadow)\s*:/.test(l)
              && /#[0-9a-fA-F]{3,8}|rgba?\(/.test(l)) {
      offenders.push((i + 1) + ': ' + l.trim().slice(0, 70));
    }
  });
  eq(offenders, [], 'no hardcoded colour inside a media query (mobile follows the palette)');
}

/* ---- the blood palette ----------------------------------------------------
   It exists because the owner asked for a circulatory-system tone, but the parts that
   matter here are the ones a screenshot cannot check: that it is a real third value
   rather than a coat of paint on neon, and that it did not walk into the cascade trap
   documented above it. */
const bloodBlock = /:root\[data-palette="blood"\]\{[\s\S]*?\n\}/g;
let bm, bloodTokens = null;
while ((bm = bloodBlock.exec(css))) bloodTokens = bm[0];   // the LAST one is the real block
eq(!!bloodTokens, true, 'the blood palette declares its own token block');
eq(/--accent-bright:#3FA9E0/.test(bloodTokens), true, 'the action colour is the venous blue');
eq(/--brand-2:#E23E4E/.test(bloodTokens), true, 'the brand colour is the arterial red');
eq(/--gold:#F2C14E/.test(bloodTokens), true, 'gold is the shine');
eq(/--warn:#F2A93B/.test(bloodTokens), true, 'warning is amber');
eq(/--nc:#FF5C6E/.test(bloodTokens), true, 'non-conformity is the alarm red');
eq(/--ok:#34D399/.test(bloodTokens), true, 'compliant is green, as in every other palette');

/* THE BROWN BUG. This palette exists because the previous one laid a desaturated red at
   10% over a WARM near-black and composited to rgb(35,22,18) — brown. Two things have to
   stay true or the whole site silts up again: the field must be neutral, and the
   atmosphere red must stay saturated. This is the single most important test in the file. */
eq(/--bg:#08070A/.test(bloodTokens), true, 'the field is a neutral black');
eq(/--bg:#10110E/.test(bloodTokens), false, 'the warm field that caused the brown is gone');
/* Pick the rule by what it CONTAINS, not by position. There is an earlier one-line
   `blood body{background:#000}` twinned with neon, and a non-greedy match anchored on
   "\n}" runs straight past it and swallows half the file. */
const atmo = css.split("}").filter(r =>
  /:root\[data-palette="blood"\] body\{/.test(r) && /background-attachment:fixed/.test(r))[0] || "";
eq(/rgba\(226,62,78,\.1[5-9]\)/.test(atmo), true,
   'the atmosphere red is saturated enough to read as red rather than as mud');
(function () {
  /* composite the atmosphere red over the field and prove the hue, rather than trusting
     that the hex "looks red". Brown is R>G>B; a true red keeps B above G. */
  const m = atmo.match(/rgba\((\d+),(\d+),(\d+),(\.\d+)\)/);
  const a = parseFloat(m[4]), base = [8, 7, 10];
  const c = [1, 2, 3].map(k => Math.round(+m[k] * a + base[k - 1] * (1 - a)));
  eq(c[2] > c[1], true,
     'composited atmosphere rgb(' + c + ') keeps blue above green, so it reads wine not brown');
})();

/* CONTRAST. Measured on the field #08070A and the panel #161318; AA small text is 4.5:1.
   Only the arterial red fell short, at 4.41 against the panel, and it has one lifted
   sibling. The others passed unchanged and are stated so downstream rules resolve.
   If someone "tidies" --red-text back to #E23E4E, this fails. */
eq(/--red-text:#E34252/.test(bloodTokens), true, '--red-text is the measured, text-safe red');
["--blue-text:#3FA9E0", "--magenta-text:#E0637F", "--violet-text:#A78BD0"]
  .forEach(v => eq(bloodTokens.includes(v), true, v.split(":")[0] + ' is stated and passes AA'));
eq(/--fg-faint:#8D8791/.test(bloodTokens), true, 'tertiary text measures 5.3:1');
eq(/--fg-muted:#C2BCC4/.test(bloodTokens), true, 'secondary text measures 9.9:1');

/* RED MEANS TWO THINGS HERE, AND THE RAMP IS WHAT KEEPS THEM APART.
   --red is the brand; --nc is the alarm. If they collapse to one value, a page full of
   brand colour reads as a page full of failures. */
eq(bloodTokens.match(/--red:#E23E4E/) && bloodTokens.match(/--nc:#FF5C6E/) ? true : false, true,
   'brand red and alarm red are two distinct values');
eq(/:root\[data-palette="blood"\] \.tr-tag\.bad[\s\S]{0,160}?color:var\(--nc\)/.test(css), true,
   'the non-conformity chip takes the alarm red, not the brand red');
eq(/:root\[data-palette="blood"\] \.cat-CORE[\s\S]{0,200}?var\(--red-text\)/.test(css), true,
   'the CORE category keeps the brand red — it is a category, not a finding');

/* RED IS NEVER A CONTROL. A saturated red button reads as destructive, and this platform
   has real destructive controls. Primary buttons run blue into blue. */
eq(/linear-gradient\(135deg,#2B7FB5,#3FA9E0\)/.test(css), true,
   'primary buttons run deep venous blue into bright venous blue');
eq(/background:linear-gradient\(135deg,#E23E4E/.test(css), false,
   'no button is filled with the brand red');

/* THE GLOW IS THE THEME. Flat bright colour on dark is the thing this is not, so the
   token set has to exist and be layered — a single shadow is not a bloom. */
["--glow-red-sm", "--glow-red-md", "--glow-red-lg",
 "--glow-blue-sm", "--glow-blue-md", "--glow-blue-lg",
 "--glow-nc-md", "--glow-gold-md", "--glow-amber-md",
 "--text-glow-red", "--text-glow-blue", "--text-glow-gold", "--text-glow-nc"]
 .forEach(g => eq(bloodTokens.includes(g), true, 'glow token ' + g + ' exists'));
eq(/--glow-red-lg:[^;]*,[^;]*,/.test(bloodTokens), true,
   'the strong glow is layered, not a single shadow');

/* The atmosphere: three light sources over the black, not a flat fill. */
eq(/:root\[data-palette="blood"\] body\{[\s\S]*?radial-gradient[\s\S]*?radial-gradient[\s\S]*?radial-gradient/.test(css),
   true, 'the background is layered light rather than a flat dark fill');

/* Surfaces are translucent glass, not solid cards. Kept from the spec this palette
   replaced — the structure was right even though the colours were not. */
const cardRule = css.split("}").filter(r =>
  /:root\[data-palette="blood"\][^{]*\.kpi-card/.test(r) &&
  /rgba\(22,19,24,\.72\)/.test(r))[0] || "";
eq(/backdrop-filter/.test(cardRule), true, 'cards are translucent with a backdrop blur');
eq(/box-shadow:[^;]*inset/.test(cardRule), true,
   'cards carry an inner bloom, not just an outer shadow');

/* TWINNED RULES. Some rules put neon and blood in one selector list and so share a
   declaration block carrying neon's literal teal. Every one is re-stated in the
   corrections block at the end of the file. If that block goes, blood grows teal patches. */
eq(/twinned-rule corrections/.test(css), true, 'the twinned-rule corrections block is present');
["#06322C", "94,234,212", "45,212,191", "#22D3EE"].forEach(lit => {
  const idx = css.lastIndexOf(lit);
  eq(idx < css.indexOf("twinned-rule corrections"), true,
     'no neon literal (' + lit + ') survives after the corrections block');
});
/* Red is reserved. On a NABH platform --nc means "this is wrong" and must never also be
   the decorative accent, or a page full of brand colour reads as a page full of failures. */
eq(/--accent-bright:#FF5C6E/.test(bloodTokens), false, 'the accent is not the NC red');

/* THE CASCADE TRAP, one palette later. :root[data-theme="dark"]:not([data-palette="neon"])
   is (0,3,0) and :root[data-palette="blood"] is (0,2,0), so naming neon there let the dark
   block outrank blood wherever it sat in the file — blood's backgrounds applied and its
   accents silently stayed indigo. The bare attribute selector cannot repeat it. */
eq(/:root\[data-theme="dark"\]:not\(\[data-palette\]\)/.test(css), true,
   'the dark block steps aside for ANY palette, not for neon by name');
eq(/:not\(\[data-palette="neon"\]\)\{/.test(css), false,
   'no rule still excludes neon by name');

/* Every neon rule has a blood twin, so a surface cannot be re-tinted for one palette and
   forgotten for the other — which is exactly how the previous palette left surfaces indigo. */
const neonSel = (css.match(/:root\[data-palette="neon"\]/g) || []).length;
const bloodSel = (css.match(/:root\[data-palette="blood"\]/g) || []).length;
eq(bloodSel >= neonSel - 5, true,
   'blood covers essentially every surface neon does (' + bloodSel + ' vs ' + neonSel + ')');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
