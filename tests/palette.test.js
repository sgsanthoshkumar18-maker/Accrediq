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
/* A third palette was added here and later removed. The boot snippet must carry no trace
   of it, and — more importantly — must re-home any device whose localStorage still holds
   it. "anything not default becomes neon" does that with no migration step. */
eq(/blood/i.test(boot), false, 'the boot snippet carries no trace of the removed palette');
eq(/q!=="default"&&t!=="light"/.test(boot), true, 'every visitor APPLIES the published palette');
eq(/q!=="default"&&t!=="light"/.test(boot), true, 'no palette rides over the light theme');
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
/* The buffer was once sliced to four characters, which silently makes any longer word
   unmatchable. Kept at 8 so a future word longer than "neon" works without rediscovering
   this. */
eq(/slice\(-8\)/.test(app), true, 'the typed buffer is longer than the longest word');
eq(/endsWith\("blood"\)/.test(app), false, 'the removed palette has no typed shortcut');
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

// 1. Boot treats anything that is not a KNOWN palette as neon. Only "default" is known;
//    everything else — a value from a future build, a corrupted one, or the palette that
//    was removed — resolves to the shipped default rather than to an attribute nothing
//    styles. That is also the whole migration path for devices left holding the old value.
eq(/if\(q!=="default"\)\{q="neon";\}/.test(boot), true,
   'an unknown stored value — including the removed palette — resolves to neon');

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
eq(/raw === "default" \? raw : "neon"/.test(app), true,
   'only a published "default" is honoured; anything else — including a site_settings row ' +
   'still naming the removed palette — resolves to neon');

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
/* This used to match a twinned "neon,\nblood{" selector list. The blood half is gone, so
   the block is neon alone — and .exec(...)[0] on a pattern that no longer matches throws
   rather than fails, which is how the removal first showed up. */
const neonBlockMatch = /:root\[data-palette="neon"\]\{[\s\S]*?\n\}/.exec(css);
eq(!!neonBlockMatch, true, 'the neon token block is present');
const neonBlock = (neonBlockMatch ? neonBlockMatch[0] : '').replace(/\/\*[\s\S]*?\*\//g, '');
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
eq(/:root\[data-palette="neon"\] \.hero\{[\s\S]*?--hero-tint:#22D3EE/.test(css), true,
   'home hero keeps its original cyan tone under neon');
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

/* THE CASCADE TRAP. :root[data-theme="dark"]:not([data-palette="neon"]) is (0,3,0) while
   :root[data-palette="x"] is (0,2,0), so naming neon there let the dark block outrank any
   OTHER palette wherever it sat in the file — its backgrounds applied while its accents
   silently stayed indigo. A third palette hit this exactly, and has since been removed.
   The bare attribute selector stays: it costs nothing and it is what stops the next one
   repeating it. */
eq(/:root\[data-theme="dark"\]:not\(\[data-palette\]\)/.test(css), true,
   'the dark block steps aside for ANY palette, not for neon by name');
eq(/:not\(\[data-palette="neon"\]\)\{/.test(css), false,
   'no rule still excludes neon by name');

/* THE REMOVAL IS COMPLETE. A third palette lived here and was taken out; the twinned
   selector lists it shared with neon had to be unpicked one at a time, keeping the neon
   half. These assert that nothing survived and that neon did not lose rules on the way. */
eq(/data-palette="blood"/.test(css), false, 'no blood selector survives in the stylesheet');
const neonSel = (css.match(/:root\[data-palette="neon"\]/g) || []).length;
eq(neonSel >= 90, true, 'neon still covers every surface it did before (' + neonSel + ')');
const sceneJs = fs.readFileSync(path.join(__dirname, '../theme/scene-palette.js'), 'utf8');
eq(/blood/i.test(sceneJs), false, 'the scene palette carries no trace of it either');
eq(/blood/i.test(app), false, 'app.js carries no trace of it either');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
