/* The 3D scenes: what they sit on, and what must never clip them.
 *
 * Two bugs live here and both were shipped at least once:
 *   - a wrapper with overflow:hidden cuts off the tooltip that is its own direct child, so
 *     hovering a node showed a label sliced by an invisible edge;
 *   - treating the globes and the line-art scenes with one rule turns the globe white in the
 *     light theme, because inverting a lit sphere is not the same as inverting a wireframe.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

console.log('scenes');

const css = read('styles.css');

/* Every one of these holds its tooltip as a direct child. */
const WRAPPERS = ['gx-wrap', 'hg-globe-wrap', 'qg-globe-wrap', 'kn-wrap', 'dna-wrap',
                  'brain-wrap', 'face-wrap', 'radar-canvas-wrap', 'helix-canvas-wrap',
                  'ent-globe-wrap'];

check('no scene wrapper clips its own tooltip', () => {
  /* Find the shared wrapper rule and read what it sets. */
  const m = css.match(/\.gx-wrap,[\s\S]*?\.ent-globe-wrap\{([^}]*)\}/);
  assert.ok(m, 'the shared scene-wrapper rule is gone');
  assert.ok(/overflow:visible/.test(m[1]),
    'wrappers must not clip: a tooltip is a direct child and gets sliced by overflow:hidden');
  assert.ok(/background:transparent/.test(m[1]), 'wrappers must not paint a panel');
  assert.ok(/border:0/.test(m[1]), 'wrappers must not draw a border');
});

check('every scene wrapper is covered by that rule', () => {
  const m = css.match(/(\.gx-wrap,[\s\S]*?\.ent-globe-wrap)\{/);
  assert.ok(m, 'the shared rule is gone');
  const missing = WRAPPERS.filter(w => !m[1].includes('.' + w));
  assert.deepStrictEqual(missing, [], 'wrappers left out of the shared rule: ' + missing.join(', '));
});

/* THE SPLIT. Line art is tinted on white so it does not vanish into the page; a globe is a
   lit object in space and keeps the same ground in both themes. Tinting a globe is what
   turned it into a white ball. */
check('the light-theme tint covers line art only, never the globes', () => {
  /* Take the selector list of the rule that actually declares the tint, by walking back to
     the end of the previous rule. A lazy match from the first :root:not() sweeps in
     neighbouring rules and reports selectors this rule never had. */
  const at = css.indexOf('filter:brightness(0)');
  assert.ok(at > 0, 'the light-theme tint rule is gone');
  const open = css.lastIndexOf('{', at);
  const prevEnd = Math.max(css.lastIndexOf('}', open), css.lastIndexOf('*/', open));
  const block = css.slice(prevEnd + 1, open);
  /* face-wrap is deliberately absent: the hero mesh picks its own light-theme colours from
     the scene palette, which is the only way to land on an exact hue. A filter can shift a
     hue but cannot tint a pixel that has already collapsed to black — which is why the mesh
     read as soot rather than as the button's blue. The rest still use the filter. */
  ['brain-wrap', 'dna-wrap', 'helix-canvas-wrap', 'kn-wrap', 'radar-canvas-wrap']
    .forEach(w => assert.ok(block.includes('.' + w), w + ' should be tinted on a light page'));
  assert.ok(!block.includes('.face-wrap'),
    'the hero mesh draws its own light colours; tinting it as well would double-correct it');
  ['hg-globe-wrap', 'qg-globe-wrap', 'ent-globe-wrap', 'gx-wrap']
    .forEach(w => assert.ok(!block.includes('.' + w),
      w + ' must NOT be tinted — that is what turns the globe white'));
});

/* The tint has one job: put the remaining line-art scenes on the same blue the hero mesh and
 * the primary button use. The chain was solved numerically against #2743C9, so a retune by
 * eye that drifts off the brand hue should fail here rather than merely look different.
 * brightness(0) is the load-bearing step: it collapses the drawing to a silhouette whose
 * density is its own alpha, which is the only way a near-white glow can end up blue. */
check('the tint targets the button blue', () => {
  const at = css.indexOf('filter:brightness(0)');
  const decl = css.slice(at, css.indexOf(';', at));
  assert.ok(/invert\(\.11\)/.test(decl),
    'invert() is the only step that can lift a zero; without it the artwork stays black');
  assert.ok(/sepia\(1\)/.test(decl) && /hue-rotate\(212deg\)/.test(decl),
    'the tint no longer targets the button hue');
});

/* The hero mesh draws in the light palette natively, so those helpers have to exist and have
 * to return the button blue — this is what the filter cannot do. */
check('the scene palette draws the hero mesh in the button blue on white', () => {
  const js = read('theme/scene-palette.js');
  ['blending', 'lineColor', 'lineOpacity', 'glowHex', 'impulseHex'].forEach(fn =>
    assert.ok(new RegExp('function ' + fn + '\\b').test(js), 'scene palette is missing ' + fn + '()'));
  assert.ok(/lineColor\(fallback\) \{ return pick\(0x2743C9/.test(js),
    'the light-theme line colour is no longer the button blue');
  assert.ok(/NormalBlending/.test(js),
    'light must draw with normal blending — additive over white washes out');
  const face = read('face/face.js');
  ['P.blending(', 'P.lineColor(', 'P.lineOpacity(', 'P.glowHex(', 'P.impulseHex(']
    .forEach(c => assert.ok(face.includes(c), 'face.js no longer routes through ' + c));
});

/* THE COST OF DRAWING PER-THEME IN JS. The hero mesh gets an exact hue that no filter can
 * produce, but its materials and glow textures are built once at startup — so without a
 * broadcast, toggling the theme leaves flat light-mode lines on a black page until the
 * visitor happens to reload. Three links have to hold: the toggle announces, the palette
 * forwards, the scene rebuilds. Breaking any one of them fails silently and only shows up
 * as "the mesh looks wrong sometimes", which is the hardest kind of bug to be told about. */
check('a theme toggle re-tints the hero mesh without a reload', () => {
  const app = read('app.js');
  assert.ok(/new CustomEvent\("aq:theme"/.test(app), 'the theme change is not broadcast');
  const calls = (app.match(/announceTheme\(\);/g) || []).length;
  assert.ok(calls >= 2, 'both theme toggles must announce; found ' + calls);
  /* There are two toggles and they live in different functions. Declaring the helper inside
     either one leaves the other throwing a ReferenceError on click — which happened, and is
     invisible until someone uses the keyboard path. Module scope is what makes it reachable
     from both, and in this file module scope is a two-space indent. */
  assert.ok(/\n  function announceTheme\(\) \{/.test(app),
    'announceTheme() must be declared at module scope, not inside one of the toggles');

  const pal = read('theme/scene-palette.js');
  assert.ok(/function onTheme\(fn\)/.test(pal), 'scene palette does not expose onTheme()');
  assert.ok(/addEventListener\("aq:theme"/.test(pal), 'scene palette does not listen for aq:theme');
  assert.ok(/onTheme: onTheme/.test(pal), 'onTheme is not exported');

  const face = read('face/face.js');
  assert.ok(/function retint\(\)/.test(face), 'face.js has no retint()');
  assert.ok(/P\.onTheme\(retint\)/.test(face), 'face.js never subscribes to the theme change');
  /* Regenerating textures without disposing the old ones leaks GPU memory on every toggle. */
  assert.ok(/dispose\(\)/.test(face), 'retint must dispose the textures it replaces');
});

/* The globe shells paint a dark ground in every theme, so their contents cannot take the
   light theme's ink or the readings disappear — which is exactly what happened. */
check('the globe shells carry dark tokens in both themes', () => {
  const m = css.match(/\.hg-shell, \.qg-shell\{([^}]*)\}/);
  assert.ok(m, 'the globe-shell token island is gone');
  const b = m[1];
  ['--fg:', '--fg-muted:', '--fg-faint:', '--surface-1:', '--border:'].forEach(tok =>
    assert.ok(b.includes(tok), 'the island must override ' + tok));
  assert.ok(/--fg:#[EFef]/.test(b), '--fg on the island must be a light value');
  assert.ok(/border:0/.test(b), 'the shell must not draw a rule around itself');
});

check('no stylesheet re-draws a border on the globe shells', () => {
  ['hglobe/hglobe.css', 'qglobe/qglobe.css'].forEach(f => {
    const s = read(f);
    const m = s.match(/\.(hg|qg)-shell\{([^}]*)\}/);
    assert.ok(m, 'shell rule missing in ' + f);
    assert.ok(!/border:1px|border-top:2px/.test(m[2]),
      f + ' re-draws the border that styles.css removes, and it loads later so it wins');
  });
  assert.ok(!/:root\[data-palette="neon"\] \.hg-shell\{[^}]*border-color/.test(css),
    'the neon palette must not put the border back');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
