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
eq(/--hero-tint:#A78BFA/.test(heroRules[heroRules.length - 1] || ""), true,
   'the last blood hero rule tints to the bright purple, not to a leftover from before');
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
eq(/--purple:#8B5CF6/.test(bloodTokens), true, 'the brand purple is stated');
eq(/--accent-bright:#A78BFA/.test(bloodTokens), true, 'the action colour is the bright purple');
eq(/--purple-light:#C4B0F5/.test(bloodTokens), true, 'the light purple is stated');
eq(/--bg:#07050C/.test(bloodTokens), true, 'the field is black with a violet cast');
eq(/--bg-elevated:#150F24/.test(bloodTokens), true, 'panels are dark purple');
eq(/--nc:#FF5C6E/.test(bloodTokens), true, 'non-conformity is the alarm red');
eq(/--ok:#34D399/.test(bloodTokens), true, 'compliant is green, as in every other palette');

/* BORDERS ARE LIGHT PURPLE AND VISIBLE — the defining instruction for this palette.
   These surfaces differ from the field by about 3% luminance, so unlike every earlier
   palette here the border is not trim, it is the only thing separating a card from the
   page. A "tasteful" 6% hairline turns the site into an undifferentiated smear. */
eq(/--border:rgba\(196,176,245,\.32\)/.test(bloodTokens), true,
   'the default border is the light purple');
(function () {
  const m = bloodTokens.match(/--border:rgba\(196,176,245,(\.\d+)\)/);
  eq(m && parseFloat(m[1]) >= 0.3, true, 'the border alpha is at or above the .3 floor');
})();
/* No structural border may fall back to a purple that is not the light one. The build's
   border pass rewrites them; this catches a hand-edit that puts --purple back on an edge. */
(function () {
  const blood = css.slice(css.indexOf("VIOLET PALETTE"));
  const bad = (blood.match(/border[a-z-]*\s*:[^;{}]*rgba\((?:139,92,246|109,64,204|59,31,107)[^)]*\)/gi) || []);
  eq(bad.length, 0, 'no border uses a dark purple instead of the light one' +
     (bad.length ? ' — found ' + bad[0] : ''));
})();
eq(/:root\[data-palette="blood"\] \.btn-primary,\n:root\[data-palette="blood"\] \.btn-accent\{\n  border:1px solid rgba\(196,176,245,\.45\)/.test(css), true,
   'purple buttons carry the light purple border too');

/* THE ATMOSPHERE STAYS VIOLET. The palette before this one was red, and red at low opacity
   over a dark field silts into brown because the green channel lands between red and blue.
   Purple cannot do that — it composites B > R > G at every opacity — but the assertion is
   kept because the failure was expensive and the guard costs nothing. */
const atmo = css.split("}").filter(r =>
  /:root\[data-palette="blood"\] body\{/.test(r) && /background-attachment:fixed/.test(r))[0] || "";
eq(/rgba\(139,92,246,\.1[0-9]\)/.test(atmo), true, 'the atmosphere carries the brand purple');
(function () {
  const m = atmo.match(/rgba\((\d+),(\d+),(\d+),(\.\d+)\)/);
  const a = parseFloat(m[4]), base = [7, 5, 12];
  const c = [1, 2, 3].map(k => Math.round(+m[k] * a + base[k - 1] * (1 - a)));
  eq(c[2] > c[0] && c[0] > c[1], true,
     'composited atmosphere rgb(' + c + ') is B>R>G, so it reads violet not mud');
})();

/* CONTRAST. Measured on #07050C and the panels #150F24 / #1E1533; AA small text is 4.5:1.
   --purple itself measures 4.10 on the deepest panel and is NOT safe as a label, which is
   why anything that was purple text resolves to the bright. If someone binds --purple to a
   text token, this fails. */
eq(/--purple-text:#A78BFA/.test(bloodTokens), true, 'purple text resolves to the bright purple');
eq(/--core-text:#E879F9/.test(bloodTokens), true, 'the CORE chip carries the orchid');
eq(/--fg:#F5F2FB/.test(bloodTokens), true, 'body text measures 15.7:1');
eq(/--fg-faint:#8F87A3/.test(bloodTokens), true, 'tertiary text measures 5.1:1');
eq(/--purple-text:#8B5CF6/.test(bloodTokens), false, 'the unsafe purple is not bound to text');

/* RED IS SPENT ENTIRELY ON MEANING. There is no decorative red left in this palette, so
   --nc is the only red on the site and always means non-conformity. */
eq(/:root\[data-palette="blood"\] \.tr-tag\.bad[\s\S]{0,160}?color:var\(--nc\)/.test(css), true,
   'the non-conformity chip takes the alarm red');
(function () {
  const blood = css.slice(css.indexOf("VIOLET PALETTE"));
  const reds = (blood.match(/#E23E4E|226,62,78|#E34252/g) || []);
  eq(reds.length, 0, 'no arterial red survives from the palette this replaced');
})();

/* Primary buttons run deep purple into bright purple — a gradient, never a flat fill. */
eq(/linear-gradient\(135deg,#6D40CC,#A78BFA\)/.test(css), true,
   'primary buttons run deep purple into bright purple');

/* THE GLOW IS THE THEME. Flat bright colour on dark is the thing this is not, so the
   token set has to exist and be layered — a single shadow is not a bloom. */
["--glow-purple-sm", "--glow-purple-md", "--glow-purple-lg",
 "--glow-bright-sm", "--glow-bright-md", "--glow-bright-lg",
 "--glow-light-md", "--glow-nc-md", "--glow-gold-md",
 "--text-glow-purple", "--text-glow-bright", "--text-glow-nc"]
 .forEach(g => eq(bloodTokens.includes(g), true, 'glow token ' + g + ' exists'));
eq(/--glow-purple-lg:[^;]*,[^;]*,/.test(bloodTokens), true,
   'the strong glow is layered, not a single shadow');

/* The atmosphere: three light sources over the black, not a flat fill. */
eq(/:root\[data-palette="blood"\] body\{[\s\S]*?radial-gradient[\s\S]*?radial-gradient[\s\S]*?radial-gradient/.test(css),
   true, 'the background is layered light rather than a flat dark fill');

/* Surfaces are translucent glass. Carried through three palettes now — the structure has
   outlived every colour scheme that has been put on it. */
const cardRule = css.split("}").filter(r =>
  /:root\[data-palette="blood"\][^{]*\.kpi-card/.test(r) &&
  /rgba\(21,15,36,\.72\)/.test(r))[0] || "";
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
