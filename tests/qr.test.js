/* THE QR ENCODER MUST KEEP PRODUCING SCANNABLE CODES.
 *
 * quiz/qr.js is the one piece of this site that implements a published binary
 * format from scratch. It cannot be eyeballed: a single misplaced module gives
 * a code that looks perfectly tidy on a projector and that no phone in the room
 * will read, and the first you hear of it is a hall full of people saying "it's
 * not working". A visual check proves nothing here.
 *
 * Two kinds of assertion, deliberately:
 *
 * 1. FIXTURES. The output was verified module-for-module against the `qrcode`
 *    npm package — 44 of 45 sample-and-level combinations byte-identical, the
 *    45th being a mask choice where that package deviates from the standard
 *    (see the note at the top of qr.js). Those verified matrices are frozen
 *    here. The npm package is NOT a dependency of this repo; it was used once,
 *    to establish that what is frozen is right.
 *
 * 2. STRUCTURE. Checks derived from the specification rather than from this
 *    implementation — finder patterns, timing patterns, the dark module, size,
 *    and decoding the format block back to the level and mask it claims. These
 *    would catch a regression even if somebody regenerated the fixtures from
 *    broken code.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

/* Load the browser file the way a browser would. */
const src = fs.readFileSync(path.join(ROOT, 'quiz/qr.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const AQQR = window.AQQR;

eq(typeof AQQR.matrix, 'function', 'AQQR.matrix is exported');
eq(typeof AQQR.svg, 'function', 'AQQR.svg is exported');

/* ---------- 1. Frozen, externally verified output ---------- */
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'qr-fixtures.json'), 'utf8'));
eq(fixtures.length > 5, true, 'the fixture set is not empty (' + fixtures.length + ')');

fixtures.forEach(fx => {
  const m = AQQR.matrix(fx.text, fx.ecl);
  const label = JSON.stringify(fx.text).slice(0, 24) + ' @' + fx.ecl;
  eq(m.version, fx.version, label + ': version');
  eq(m.size, fx.size, label + ': size');
  let bits = '';
  for (let r = 0; r < m.size; r++) for (let c = 0; c < m.size; c++) bits += m.modules[r][c] ? '1' : '0';
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4).padEnd(4, '0'), 2).toString(16);
  eq(hex, fx.hex, label + ': every module matches the verified matrix');
});

/* ---------- 2. Structure, from the specification ---------- */
const m = AQQR.matrix('https://aqcredix.com/quiz/join?c=4K7P2M', 'M');
const g = m.modules, size = m.size;

eq(size, m.version * 4 + 17, 'size follows 4V+17');

/* A finder is a 7x7 target: dark ring, light ring, 3x3 dark core. */
function finderOk(top, left) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const ring = (r === 0 || r === 6 || c === 0 || c === 6);
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (g[top + r][left + c] !== (ring || core)) return false;
    }
  }
  return true;
}
eq(finderOk(0, 0), true, 'top-left finder pattern is intact');
eq(finderOk(0, size - 7), true, 'top-right finder pattern is intact');
eq(finderOk(size - 7, 0), true, 'bottom-left finder pattern is intact');

/* Timing patterns alternate, starting dark at index 8. */
let timingOk = true;
for (let i = 8; i < size - 8; i++) {
  if (g[6][i] !== (i % 2 === 0)) timingOk = false;
  if (g[i][6] !== (i % 2 === 0)) timingOk = false;
}
eq(timingOk, true, 'both timing patterns alternate correctly — the bug that silently ' +
   'broke them was a format-reservation loop writing over index 6');

eq(g[size - 8][8], true, 'the dark module at (size-8, 8) is set');

/* Decode the format block back. If the encoder wrote it with the bits reversed
   — which it did once — this fails while the code still looks perfect. */
function decodeFormat() {
  let raw = 0;
  for (let i = 0; i < 15; i++) {
    let bit;
    if (i < 6) bit = g[8][i];
    else if (i === 6) bit = g[8][7];
    else if (i === 7) bit = g[8][8];
    else if (i === 8) bit = g[7][8];
    else bit = g[14 - i][8];
    raw |= (bit ? 1 : 0) << (14 - i);
  }
  const bits = raw ^ 0x5412;
  const data = bits >> 10;
  /* Re-run the BCH and check the remainder agrees, which proves the whole
     15-bit block is self-consistent and not merely plausible. */
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
  return { ecl: data >> 3, mask: data & 7, valid: ((data << 10) | rem) === bits };
}
const fmt = decodeFormat();
eq(fmt.valid, true, 'the format block passes its own BCH check');
eq(fmt.ecl, 0, 'the format block reports level M (0) as requested');
eq(fmt.mask >= 0 && fmt.mask <= 7, true, 'the format block names a real mask (' + fmt.mask + ')');

/* The second copy must agree with the first — a scanner reads whichever it
   can, so they cannot disagree. */
let copy2 = 0;
for (let i = 0; i < 15; i++) {
  const bit = i < 7 ? g[size - 1 - i][8] : g[8][size - 15 + i];
  copy2 |= (bit ? 1 : 0) << (14 - i);
}
let copy1 = 0;
for (let i = 0; i < 15; i++) {
  let bit;
  if (i < 6) bit = g[8][i];
  else if (i === 6) bit = g[8][7];
  else if (i === 7) bit = g[8][8];
  else if (i === 8) bit = g[7][8];
  else bit = g[14 - i][8];
  copy1 |= (bit ? 1 : 0) << (14 - i);
}
eq(copy2, copy1, 'both copies of the format information carry the same bits');

/* ---------- Behaviour ---------- */
eq(AQQR.matrix('A', 'L').version, 1, 'a single character fits version 1');
/* Capacity must be enforced rather than producing a corrupt symbol. */
let threw = false;
try { AQQR.matrix('q'.repeat(400), 'H'); } catch (e) { threw = true; }
eq(threw, true, 'a payload too long for version 10 is refused, not silently truncated');

/* Every error-correction level has to work; the host page may pick any. */
['L', 'M', 'Q', 'H'].forEach(lvl => {
  const r = AQQR.matrix('https://aqcredix.com/quiz/join?c=ABC123', lvl);
  eq(r.size, r.version * 4 + 17, 'level ' + lvl + ' produces a consistent matrix');
});

/* The SVG has to be inline-able and contain actual modules. */
const svg = AQQR.svg('https://aqcredix.com/quiz/join?c=4K7P2M', { ecl: 'M' });
eq(/^<svg /.test(svg), true, 'svg() returns an SVG element');
eq(svg.indexOf('<path d="M') > -1, true, 'the SVG contains a module path');
eq(/viewBox="0 0 \d+ \d+"/.test(svg), true, 'the SVG carries a viewBox so it scales');
eq(svg.indexOf('fill="#fff"') > -1, true,
   'the SVG paints its own white background — a QR drawn dark-on-transparent ' +
   'inverts on a dark theme and stops scanning');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
