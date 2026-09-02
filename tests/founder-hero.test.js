/* The founder hero: an oversized name with the cut-out figure standing in front of it.
 *
 * Every check here exists because of a specific failure, and each one guards a property
 * rather than a number. The recurring bug in this layout has been the same one three times:
 * a value tuned by eye at 1440x900 that was silently wrong at every other size. So the tests
 * assert that the numbers are DERIVED — from the hero height, from the cut-out's ratio, from
 * the glyphs actually rendered — rather than asserting the particular values.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

console.log('founder hero');

const css = read('profile/founder.css');
const js = read('profile/founder.js');
const data = read('profile/founder-data.js');
const html = read('founder.html');

const rule = sel => {
  const m = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}'));
  assert.ok(m, sel + ' is gone from founder.css');
  return m[0];
};

/* ---------------------------------------------------------------- the black band
 * The complaint that drove this whole layout: a strip of ground under the shoulders. The
 * figure was sized by WIDTH, so its height was whatever fell out of the ratio, and any
 * shortfall against the hero showed as background. Sizing it by height makes the gap
 * unrepresentable rather than merely absent at the size I happened to measure.
 */
check('the figure takes its height from the hero, so a gap under it cannot exist', () => {
  const fig = rule('.fp-stage .fp-photo');
  assert.ok(/height:100%/.test(fig),
    'the figure must fill the hero height, not be sized by its width');
  assert.ok(/width:auto/.test(fig),
    'a fixed width fights the height and brings the shortfall back');
  const wrap = rule('.fp-stage-photo');
  assert.ok(/top:0/.test(wrap) && /bottom:/.test(wrap),
    'both edges must be pinned; anchoring only the bottom leaves the leftover height as ground');
});

check('the gap to the next block is one number, spent at both ends', () => {
  /* The remaining band was the stat band's own top margin. The figure is now bled downward by
     exactly that amount so the two cancel. Written as two literals they would drift apart the
     first time either was retuned. */
  assert.ok(/--fp-gap-to-next:/.test(css), '--fp-gap-to-next is gone');
  assert.ok(/margin-top:var\(--fp-gap-to-next\)/.test(css),
    'the stat band should take its margin from the shared variable');
  assert.ok(/bottom:calc\(var\(--fp-gap-to-next\) \* -1\)/.test(css),
    'the figure should be bled down by exactly the gap it has to cover');
});

/* ---------------------------------------------------------------- the columns
 * The cut-out's silhouette is about 45% of the frame at head height and widens to the FULL
 * frame across the shoulders at the floor — which is exactly where the text columns sit. A
 * hand-set track width cleared the figure at 1440 and overlapped it by 53px elsewhere.
 */
check('the middle track is derived from the figure width, not hand-tuned', () => {
  assert.ok(/--fp-figure-w:/.test(css), '--fp-figure-w is gone');
  assert.ok(/grid-template-columns:minmax\(0,1fr\) var\(--fp-figure-w\) minmax\(0,1fr\)/.test(css),
    'the middle track must be the figure width, or the columns run under the shoulders');
  assert.ok(/max-width:var\(--fp-figure-w\)/.test(rule('.fp-stage .fp-photo')),
    'the figure and the space reserved for it must come from one expression');
  assert.ok(/--fp-hero-h:/.test(css) && /min-height:var\(--fp-hero-h\)/.test(css),
    'the hero height should be declared once and referenced, not repeated');
});

/* ---------------------------------------------------------------- the light theme
 * A drop-shadow read as a passport-photo border on white. The cut-out reaches the left, right
 * and bottom edges of its own frame, so the shadow has straight edges to follow there instead
 * of a silhouette. Invisible on black, obvious on white — which is why it survived so long.
 */
check('nothing paints a box around the cut-out', () => {
  const fig = rule('.fp-stage .fp-photo');
  assert.ok(/filter:none/.test(fig),
    'a filter on the figure draws straight edges where the cut-out meets its frame');
  assert.ok(/border:0/.test(fig), 'the figure must not have a border');
  assert.ok(/background:transparent/.test(fig),
    'the figure must sit on the page ground, not on a panel');
  assert.ok(!/box-shadow/.test(fig), 'a box-shadow would draw the rectangle back');
});

/* ---------------------------------------------------------------- the empty band on top
 * 205px of the source's 1005 were transparent above the hair — a fifth of the frame. At any
 * box height the figure therefore rendered a fifth smaller than its box and stopped short of
 * the name it was supposed to stand in front of.
 */
check('the shipping cut-out matches what the CSS expects', () => {
  /* Read the asset path OUT of the data file rather than naming it here, so this follows a
     swap between the colour and greyscale cut-outs instead of silently passing on a stale
     filename — an earlier version matched the old filename, which the comment in the data
     file satisfied even after the shipping photo had changed. */
  const m = data.match(/photo:\s*"([^"]+)"/);
  assert.ok(m, 'founder-data.js no longer declares a photo');
  const rel = m[1];
  const p = path.join(ROOT, rel);
  assert.ok(fs.existsSync(p), rel + ' is missing');

  /* Decode it. The greyscale cut-out is stored as grey+alpha (colour type 4, two bytes per
     pixel) rather than RGBA, so the byte width has to come from the header — assuming four
     read the file as noise and would have passed or failed for the wrong reason. */
  const b = fs.readFileSync(p);
  let q = 8, w, h, depth, ctype, idat = [];
  while (q < b.length) {
    const len = b.readUInt32BE(q), t = b.toString('ascii', q + 4, q + 8);
    if (t === 'IHDR') {
      w = b.readUInt32BE(q + 8); h = b.readUInt32BE(q + 12);
      depth = b[q + 16]; ctype = b[q + 17];
    }
    if (t === 'IDAT') idat.push(b.slice(q + 8, q + 8 + len));
    q += len + 12;
  }
  assert.strictEqual(depth, 8, rel + ' is not 8 bits per channel');
  const CH = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  assert.ok(CH, rel + ' has an unsupported colour type ' + ctype);
  assert.ok(ctype === 4 || ctype === 6,
    rel + ' has no alpha channel, so its background is baked in as opaque pixels and the ' +
    'figure will render as a rectangle on the page');

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = CH, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, bb = y > 0 ? px[(y - 1) * stride + x] : 0,
            cc = (x >= bpp && y > 0) ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pa = Math.abs(bb - cc), pb = Math.abs(a - cc), pc = Math.abs(a + bb - 2 * cc);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : cc);
      }
      px[y * stride + x] = v & 255;
    }
  }
  const ALPHA = bpp - 1;                       /* alpha is the last channel either way */

  /* No empty band above the hair. 205 rows of the original source's 1005 were transparent —
     a fifth of the frame — so at any box height the figure rendered a fifth smaller than its
     box and stopped short of the name it was supposed to stand in front of. */
  let firstRow = -1;
  for (let y = 0; y < h && firstRow < 0; y++)
    for (let x = 0; x < w; x++) if (px[y * stride + x * bpp + ALPHA] > 16) { firstRow = y; break; }
  assert.strictEqual(firstRow, 0,
    rel + ' has ' + firstRow + 'px of empty space above the hair; the figure will render that ' +
    'much smaller than its box and stop short of the name');

  /* The CSS ratio has to match the file, or the figure letterboxes inside its box and the
     black band comes back from the other direction. Both the figure's width and the grid
     track that holds the columns clear of it are derived from this one number. */
  const r = css.match(/--fp-figure-ratio:\s*calc\(\s*(\d+)\s*\/\s*(\d+)\s*\)/);
  assert.ok(r, '--fp-figure-ratio is gone or is no longer written as calc(w / h)');
  assert.strictEqual(r[1] + 'x' + r[2], w + 'x' + h,
    '--fp-figure-ratio says ' + r[1] + 'x' + r[2] + ' but ' + rel + ' is ' + w + 'x' + h);
  assert.ok(/aspect-ratio:var\(--fp-figure-ratio\)/.test(css),
    'the figure box should take its ratio from --fp-figure-ratio, not repeat the numbers');
});

/* ---------------------------------------------------------------- the name
 */
check('the name is one colour, in the condensed display face', () => {
  /* Two-tone (outlined half, solid half) was rejected twice. Both halves must resolve to the
     same token, and neither may carry a stroke. */
  const outline = rule('.fp-n-outline'), solid = rule('.fp-n-solid');
  const tok = s => (s.match(/color:(var\([^)]+\)|#[0-9a-fA-F]+)/) || [])[1];
  assert.ok(tok(outline) && tok(outline) === tok(solid),
    'the two halves of the name are different colours again');
  assert.ok(/-webkit-text-stroke:0/.test(outline),
    'the outlined treatment is back; the name should be solid throughout');
  assert.ok(/--font-hero:/.test(css), '--font-hero is gone');
  assert.ok(/font-family:var\(--font-hero\)/.test(rule('.fp-stage-name')),
    'the name should use the hero face, not the body or display face');
  assert.ok(/fonts\.googleapis\.com[^"]*family=Anton/.test(html),
    'founder.html no longer loads the hero face');
});

check('the overlap scales with the name instead of being a fixed distance', () => {
  /* fitStageName() sets the size at runtime, so a pixel overlap is most of a small name and a
     sliver of a large one. And an earlier clamp here had its bounds reversed — min > max, so
     the browser silently returned the minimum and the overlap never appeared at all. */
  const nm = rule('.fp-stage-name');
  const mb = (nm.match(/margin-bottom:([^;]+);/) || [])[1] || '';
  assert.ok(/em\s*$/.test(mb.trim()),
    'the overlap should be stated in the name\'s own em so it tracks the fitted size, got: ' + mb);
  assert.ok(parseFloat(mb) < 0, 'the overlap must be negative or the figure sits below the name');

  /* clamp(MIN, VAL, MAX) requires MIN <= MAX. With negatives the more-negative bound comes
     first, and getting it backwards fails silently — no error, no warning, just the minimum
     returned forever. */
  const reversed = [];
  (css.match(/clamp\([^()]*(?:\([^()]*\)[^()]*)*\)/g) || []).forEach(c => {
    const parts = c.slice(6, -1).split(',');
    if (parts.length !== 3) return;
    const a = parseFloat(parts[0]), b = parseFloat(parts[2]);
    if (!isNaN(a) && !isNaN(b) && a > b) reversed.push(c);
  });
  assert.deepStrictEqual(reversed, [],
    'clamp() with min > max silently returns min: ' + reversed.join(', '));
});

check('the figure is not also being moved by the parallax layer', () => {
  /* The figure is pinned to the hero floor. A data-depth offset slides it off that floor on
     the first scroll, which is the black band this layout exists to remove. */
  const m = html.match(/<div class="fp-stage-photo"[^>]*>/);
  assert.ok(m, '.fp-stage-photo is gone from founder.html');
  assert.ok(!/data-depth/.test(m[0]),
    'the pinned figure has a parallax offset again; it will drift off the floor on scroll');
});

/* ---------------------------------------------------------------- the name never arrived
 * Shipped broken: the giant name stayed invisible on the live site while the portrait showed.
 * Two causes, and the second is the one worth guarding forever.
 */
check('nothing in the hero is driven by two systems at once', () => {
  /* founder-motion.js writes an INLINE transform on every [data-depth] layer in the hero on
     pointer-move. An inline transform outranks the stylesheet, so .is-cine-in{transform:none}
     could never return the element to its resting place. */
  const both = [];
  (html.match(/<[^>]*data-cine[^>]*>/g) || []).forEach(t => {
    if (/data-depth/.test(t)) both.push(t.slice(0, 80));
  });
  assert.deepStrictEqual(both, [],
    'these carry both data-cine and data-depth; the parallax writes transform inline and the ' +
    'reveal cannot undo it: ' + both.join(' | '));

  const motion = read('profile/founder-motion.js');
  assert.ok(/hasAttribute\("data-cine"\)/.test(motion),
    'the parallax must exclude revealed elements itself, not rely on the markup staying right');
});

check('the reveal has a failure mode that actually shows content', () => {
  /* is-cine-in only ASKS for a transition. If the transition never runs the element keeps its
     hidden start state while carrying the class that claims it arrived — and "drop" starts at
     clip-path:inset(100% 0 0 0), invisible at any opacity. The old backstop looked for
     elements MISSING the class, so this exact case was the one thing it could not see. */
  const cjs = read('motion/cinematic.js');
  const ccss = read('motion/cinematic.css');

  assert.ok(/is-cine-shown/.test(ccss), 'the hard end-state class is gone from the CSS');
  const shown = ccss.match(/\.is-cine-shown[^{]*\{[^}]*\}/);
  assert.ok(shown, 'no rule defines is-cine-shown');
  ['opacity:1 !important', 'clip-path:none !important', 'transition:none !important']
    .forEach(d => assert.ok(shown[0].includes(d),
      'is-cine-shown must force ' + d + ' or it is just another request for a transition'));

  assert.ok(/function looksHidden/.test(cjs),
    'the backstop must ask whether the element RENDERED, not whether it has the class');
  assert.ok(/cs\.clipPath/.test(cjs),
    'opacity alone is not enough: drop hides via clip-path and would pass an opacity check');
  assert.ok(!/var stuck = all\.filter/.test(cjs),
    'the backstop is back to looking for elements missing the class, which is the one ' +
    'failure it cannot detect');
  assert.ok(/visibilitychange/.test(cjs),
    'a tab backgrounded during load runs no transitions; there must be a re-check on return');

  /* The escape hatch must show, not ask. */
  const sa = cjs.match(/function showAll\(\)[\s\S]*?\n  \}/);
  assert.ok(sa && /is-cine-shown/.test(sa[0]),
    'showAll still only adds is-cine-in, so in the very cases it exists for the content ' +
    'stays hidden');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
