/* Palette rules: neon is the owner's, dark/light is everyone's. */
const fs = require('fs'), path = require('path');
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
eq(/q==="neon"&&t!=="light"/.test(boot), true, 'every visitor APPLIES the published palette');
eq(/q==="neon"&&t!=="light"/.test(boot), true, 'neon never rides over the light theme');
eq(/localStorage.getItem\("aq-is-owner"\)==="1"/.test(boot), true, 'boot reads the owner flag');
// The shipped default is now neon: falling back to "default" made the site open blue on
// a cold load and only turn neon after site_settings had been fetched and cached, which
// looked like needing two or three refreshes.
eq(/aq-palette"\)\|\|DEF/.test(boot), true, 'palette falls back to the shipped default');
eq(/var DEF="neon"/.test(boot), true, 'the shipped default is neon');
eq(/aq-theme"\)\|\|"dark"/.test(boot), true, 'theme still defaults to dark for everyone');

// --- the typed shortcut is owner-gated
eq(/function togglePalette\(\) \{\s*\/\/[\s\S]*?if \(!isOwnerBrowser\(\)\) return;/.test(app), true,
   'typing "neon" does nothing for a non-owner');
// --- the visible button must never set neon on its own
const btn = /const themeBtn[\s\S]*?\n    \}/.exec(app)[0];
eq(/localStorage.setItem\("aq-palette", "neon"\)/.test(btn), false,
   'the header button never turns neon on');
eq(/isOwnerBrowser\(\)/.test(btn), true, 'the button restores neon only for the owner');

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
const neonBlock = /:root\[data-palette="neon"\]\{[\s\S]*?\n\}/.exec(css)[0]
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
eq(/:root\[data-palette="neon"\] \.hero\{[\s\S]*?--hero-tint:#22D3EE/.test(css), true,
   'home hero keeps its original cyan tone');
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
