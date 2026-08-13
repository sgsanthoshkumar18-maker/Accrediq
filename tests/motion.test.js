/* AQcredix — motion layer.
 * Run: node tests/motion.test.js
 */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function eq(got, want, msg) {
  if (got === want) pass++;
  else { fail++; console.log('FAIL: ' + msg + ' - got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const js = read('motion/motion.js');
const css = read('motion/motion.css');

/* ---------------------------- accessibility first ---------------------------- */

ok(/prefers-reduced-motion/.test(js), 'the engine reads the reduced-motion preference');
ok(/prefers-reduced-motion/.test(css), 'and the stylesheet honours it independently');
// Belt and braces: if the class were the only guard, a stylesheet failing to load would
// leave every revealed section invisible.
ok(/aq-motion-off/.test(js) && /aq-motion-off/.test(css), 'a stand-down class exists on both sides');
ok(/opacity: 1 !important/.test(css), 'reduced motion forces content visible, never hidden');
ok(/@media print/.test(css), 'printing an audit never inherits a half-revealed state');

/* ------------------------- it must not break the header ------------------------- */

/* A transform wrapper is the usual way to do inertial scroll and it would break the
   sticky header, which carries backdrop-filter and is therefore the containing block
   for fixed descendants — the property that already collapsed the mobile menu once. */
ok(/window\.scrollTo/.test(js), 'the scroll engine drives the real scroll position');
eq(/transform:\s*translate3d\(0,\s*-?\$\{?scroll/.test(js), false, 'no wrapper transform');
ok(!/document\.body\.style\.transform/.test(js), 'the body is never transformed for scrolling');
ok(/scroll-behavior: auto/.test(css), 'native smooth scrolling is disabled so the two do not fight');

/* --------------------------------- touch ---------------------------------- */

ok(/pointer: coarse/.test(js), 'touch devices are detected');
ok(/if \(!coarse\)/.test(js), 'inertial scroll is skipped on touch, which already has momentum');

/* ------------------------------ wheel handling ------------------------------ */

ok(/e\.ctrlKey \|\| e\.metaKey/.test(js), 'browser zoom is left alone');
ok(/closestScrollable/.test(js), 'a scrollable panel keeps its own wheel events');
ok(/deltaMode === 1/.test(js), 'Firefox line-mode deltas are converted');
ok(/passive: false/.test(js), 'the wheel listener can preventDefault');
/* Scroll pace. 0.11 kept gliding after the wheel stopped, which reads as lag when you
   are trying to reach a specific element rather than as smoothness. */
ok(/var EASE = 0\.22/.test(js), 'the scroll eases fast enough to feel responsive');
ok(/d \*= 1\.35/.test(js), 'and each wheel notch covers a native-feeling distance');
ok(/function resync/.test(js), 'keyboard and scrollbar movement resync the engine');

/* ------------------------------ page transitions ------------------------------ */

ok(/u\.origin !== location\.origin/.test(js), 'external links are not intercepted');
ok(/mailto:|tel:/.test(js), 'mail and phone links are not intercepted');
ok(/hasAttribute\("download"\)/.test(js), 'download links are not intercepted');
ok(/metaKey \|\| e\.ctrlKey \|\| e\.shiftKey/.test(js), 'open-in-new-tab still works');
/* A transitionend listener would strand the click if the fade were interrupted. */
ok(/setTimeout\(function \(\) \{ location\.href = href; \}/.test(js),
   'navigation is on a hard timeout, so an interrupted fade cannot swallow a click');
ok(/pageshow/.test(js), 'the Back button cannot restore a faded-out page');

/* -------------------------------- reveals -------------------------------- */

ok(/IntersectionObserver/.test(js), 'reveals use IntersectionObserver');
ok(/in window/.test(js), 'and degrade to visible where it is unsupported');
ok(/io\.unobserve/.test(js), 'an element reveals once, so re-reading does not flicker');
ok(/Math\.min\(i, 4\)/.test(js), 'the stagger is capped rather than growing with index');
// The hidden state must come from JS, or a no-JS visitor sees a blank page.
ok(/classList\.add\("aq-reveal"\)/.test(js), 'the hiding class is applied by script, not markup');
eq(/class="[^"]*aq-reveal/.test(read('index.html')), false, 'no page ships content pre-hidden');

/* ------------------------------- palette safety ------------------------------- */

// The whole motion layer is opacity and transform. No colour means nothing to keep in
// step with light/dark/neon — the rule the palette suite enforces site-wide.
eq(/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css), false, 'the motion stylesheet declares no colours');

/* ------------------------------- wiring ------------------------------- */

function walk(dir, out) {
  out = out || [];
  /* `docs` holds a rendered sample of the digest EMAIL, not a site page. Email HTML is
     deliberately standalone with inline styles — Outlook ignores external stylesheets —
     so it must never carry the site's motion layer. */
  const skip = new Set(['node_modules', '.git', 'build', 'tests', 'docs',
    'galaxy', 'galaxy2', 'brain', 'dna', 'helix', 'radar', 'globe', 'hglobe', 'kpinet']);
  for (const n of fs.readdirSync(dir)) {
    if (skip.has(n)) continue;
    const full = path.join(dir, n);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (n.endsWith('.html')) out.push(full);
  }
  return out;
}
const pages = walk(ROOT);
ok(pages.length >= 47, 'the site still has its full page count (' + pages.length + ')');

let missing = 0, badPath = 0;
pages.forEach(f => {
  const h = fs.readFileSync(f, 'utf8');
  if (!/motion\/motion\.css/.test(h) || !/motion\/motion\.js/.test(h)) { missing++; return; }
  // Nested pages need ../ or the asset 404s and the page silently loses all motion.
  const depth = path.relative(ROOT, path.dirname(f)).split(path.sep).filter(Boolean).length;
  /* The version query (?v=...) is appended by build/set-version.js, so match the path
     up to the quote-or-query rather than requiring an exact string. */
  const want = '../'.repeat(depth) + 'motion/motion.js';
  if (!new RegExp('src="' + want.replace(/[./]/g, '\\$&') + '(\\?[^"]*)?"').test(h)) {
    badPath++; console.log('  bad path: ' + f);
  }
});
eq(missing, 0, 'every page loads the motion layer');
eq(badPath, 0, 'every page uses a correct relative path for its depth');

// Parallax is opt-in per element, and restrained: heavy drift on a reference tool makes
// text hard to track while reading.
const home = read('index.html');
const speeds = [...home.matchAll(/data-parallax="(-?[\d.]+)"/g)].map(m => Math.abs(+m[1]));
ok(speeds.length > 0, 'the homepage uses parallax');
ok(speeds.every(v => v <= 0.12), 'parallax speeds stay subtle (max ' + Math.max(...speeds) + ')');


/* ------------------------------- split text -------------------------------
   The split walks text nodes. The tempting shortcut — rebuilding innerHTML from a
   word-joined string — would flatten the <br> and the <span class="em"> that colours
   "assessor" in the hero headline. This runs the real function against a small DOM to
   prove it does not. */
{
  const { Element, Text, makeDocument } = require('./helpers/mini-dom.js');

  // Rebuild the hero headline: Know it before<br>the <span class="em">assessor</span> does.
  const h1 = new Element('h1');
  h1.appendChild(new Text('Know it before'));
  h1.appendChild(new Element('br'));
  h1.appendChild(new Text('the '));
  const em = new Element('span'); em.className = 'em';
  em.appendChild(new Text('assessor'));
  h1.appendChild(em);
  h1.appendChild(new Text(' does.'));

  // Pull splitNode out of the source and run it against the shim.
  const src = js.slice(js.indexOf('function splitNode'), js.indexOf('function init() {\n      var sel = "[data-split]"'));
  const doc = makeDocument();
  const splitNode = new Function('document', src + '; return splitNode;')(doc);

  const before = h1.textContent;
  const count = splitNode(h1);

  eq(h1.textContent, before, 'the split does not change the text of the heading');
  ok(before.length > 0, 'the harness built a heading with real text');
  eq(count, 6, 'every word is wrapped (Know it before the assessor does.)');
  ok(h1.querySelectorAll('.em').length === 1, 'the accent span survives the split');
  eq(h1.querySelectorAll('.em')[0].textContent, 'assessor', 'and still holds its word');
  ok(h1.querySelectorAll('br').length === 1, 'the line break survives the split');
  eq(h1.getAttribute('aria-label'), 'Know it before the assessor does.',
     'the whole sentence is restored for screen readers');
  eq(h1.querySelectorAll('.aq-w').length, 6, 'each word has a clipping wrapper');
  eq(h1.querySelectorAll('.aq-w-i').length, 6, 'and a moving inner span');

  // Index drives the stagger; it must run 0..n-1 across the whole heading, including
  // words inside the accent span, or the sequence jumps.
  const idx = h1.querySelectorAll('.aq-w-i').map(e => e.style.props['--aq-i']);
  eq(idx.join(','), '0,1,2,3,4,5', 'the stagger index is continuous across nested elements');

  // Whitespace between words must be preserved as real text, or words run together.
  ok(/<br>/.test(h1.outerHTML), 'the break is still in the serialised markup');
  ok(/the <span class="em">/.test(h1.outerHTML.replace(/ aria-label="[^"]*"/g,'')) ||
     h1.textContent.includes('the assessor'), 'spacing between words is intact');

  // Running twice must not double-wrap — init() guards on the class.
  ok(h1.classList.contains('aq-split'), 'the element is marked as split');
}

// Words, not letters: letter-by-letter makes a heading unreadable while it assembles.
ok(/split\(\/\(\\s\+\)\//.test(js), 'the split is on whitespace, so words stay whole');
ok(/aria-label/.test(js), 'the original sentence is preserved for assistive tech');
ok(/tagName !== "BR"/.test(js), 'line breaks are stepped over rather than descended into');

// The hero plays on load; anything already in view starts explicitly rather than waiting
// for an observer callback that can land a frame late and flash the finished heading.
ok(/innerHeight \* 0\.9/.test(js), 'headings already in view start immediately');
ok(/aq-hero-in/.test(js) && /aq-hero-in/.test(css), 'the ring mark has its own entrance');
ok(/stroke-dashoffset/.test(css), 'the logo arc draws itself');

// The hero headline slides sideways, out from behind the mark, rather than rising.
ok(/hero-headline h1\.aq-split \.aq-w-i \{[\s\S]*?translate3d\(-[\d.]+em, 0, 0\)/.test(css),
   'the hero words travel horizontally from the mark');
ok(/hero-headline h1\.aq-split \.aq-w-i \{[\s\S]*?1250ms/.test(css),
   'and do so slowly enough to read as deliberate');

/* SPECIFICITY. The hero start state is (0,3,1); the generic finished state is (0,3,0),
   so the generic rule lost and the words stayed shifted left with their first letters
   clipped away. The hero needs its own finished-state rule that out-ranks it. */
ok(/\.hero-headline h1\.aq-split\.aq-split-in \.aq-w-i \{[\s\S]{0,120}transform: none/.test(css),
   'the hero has a finished-state rule specific enough to clear its own offset');
ok(/\.hero-headline h1\.aq-split\.aq-split-in \.aq-w \{[\s\S]{0,80}overflow: visible/.test(css),
   'and stops clipping once the words have arrived');

// Order matters as well as specificity: the finished state must come after the offset it
// overrides, or an equal-specificity future edit would silently lose again.
ok(css.indexOf('.hero-headline h1.aq-split .aq-w-i') <
   css.indexOf('.hero-headline h1.aq-split.aq-split-in .aq-w-i'),
   'the finished state is declared after the start state');

// Descenders must not be clipped by the overflow box.
ok(/padding-bottom: 0\.12em/.test(css) && /margin-bottom: -0\.12em/.test(css),
   'descenders have room inside the clipping wrapper');


/* ------------------------------ scrollytelling ------------------------------ */
{
  const sc = read('motion/scrolly.js');
  const home = read('index.html');

  /* position:sticky, not transforms and not wheel interception. Faking a pin by stealing
     the wheel is what earns scrollytelling its bad name, and it would fight the inertial
     scroll engine in motion.js. */
  ok(/position: sticky/.test(css), 'the pin is native sticky');
  eq(/addEventListener\("wheel"/.test(sc), false, 'scrolly never intercepts the wheel');
  eq(/preventDefault/.test(sc), false, 'and never blocks a scroll');

  /* Phones AND tablets. Pinning on a touch device fights the address bar resizing on
     scroll, and a tablet in portrait has too little height for a pinned card plus text. */
  ok(/max-width: 1024px/.test(sc), 'tablets are excluded, not just phones');
  ok(/pointer: coarse/.test(sc), 'and any touch device regardless of width');
  ok(/scrolly-off/.test(sc) && /scrolly-off/.test(css), 'there is an unpinned fallback');
  ok(/prefers-reduced-motion/.test(sc), 'reduced motion disables pinning');
  // The fallback must SHOW everything — the content is the point, the pin is decoration.
  ok(/scrolly-off[\s\S]{0,200}opacity: 1/.test(css), 'the fallback reveals every stage');

  ok(/IntersectionObserver/.test(sc), 'steps activate by observer');
  ok(/rootMargin: "-45% 0px -45% 0px"/.test(sc),
     'a step activates at the middle of the viewport, not the top');
  ok(/requestAnimationFrame\(measure\)/.test(sc),
     'progress is measured in a frame, not on every scroll event');

  // The pinned card must clear the sticky header, which has backdrop-filter and paints above.
  ok(/\.scrolly-sticky \{[\s\S]{0,400}top: 96px/.test(css), 'the pinned element clears the header');

  // Homepage wiring, and all three stages present.
  ok(/data-scrolly\b/.test(home), 'the homepage has a scrolly section');
  eq((home.match(/data-scrolly-step/g) || []).length, 3, 'with three steps');
  ok(/data-scrolly-sticky/.test(home), 'and a pinned element');
  /* The three faces moved out of index.html and into lens-rotate.js when the card became
     a rotating one — the markup is now generated per standard. Assert where they live. */
  const rot = read('lens-rotate.js');
  eq((rot.match(/data-face="\d"/g) || []).length, 3, 'the card has three faces');
  ok(/id="lensCard"/.test(home), 'and the homepage still has the slot they render into');
  ok(/motion\/scrolly\.js/.test(home), 'the script is loaded');

  /* The faces must be absolutely positioned when inactive so the card keeps one height.
     A card that resizes while pinned is more distracting than the fade it replaces. */
  ok(/\.lens-face\{[^}]*position:absolute/.test(read('styles.css')),
     'inactive faces are taken out of flow so the card never resizes');
  ok(/\[data-stage="0"\] \.lens-face\[data-face="0"\]/.test(read('styles.css')),
     'stage drives which face is visible');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
