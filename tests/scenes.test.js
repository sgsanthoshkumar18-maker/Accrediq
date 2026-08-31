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

/* THE SPLIT. Line art is inverted on white so it does not vanish into the page; a globe is a
   lit object in space and keeps the same ground in both themes. Inverting a globe is what
   turned it into a white ball. */
check('the light-theme inversion covers line art only, never the globes', () => {
  /* Take the selector list of the rule that actually declares the inversion, by walking back
     to the end of the previous rule. A lazy match from the first :root:not() sweeps in
     neighbouring rules and reports selectors this rule never had. */
  const at = css.indexOf('filter:invert(1)');
  assert.ok(at > 0, 'the light-theme inversion rule is gone');
  const open = css.lastIndexOf('{', at);
  const prevEnd = Math.max(css.lastIndexOf('}', open), css.lastIndexOf('*/', open));
  const block = css.slice(prevEnd + 1, open);
  ['face-wrap', 'brain-wrap', 'dna-wrap', 'helix-canvas-wrap', 'kn-wrap', 'radar-canvas-wrap']
    .forEach(w => assert.ok(block.includes('.' + w), w + ' should be inverted on a light page'));
  ['hg-globe-wrap', 'qg-globe-wrap', 'ent-globe-wrap', 'gx-wrap']
    .forEach(w => assert.ok(!block.includes('.' + w),
      w + ' must NOT be inverted — that is what turns the globe white'));
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
