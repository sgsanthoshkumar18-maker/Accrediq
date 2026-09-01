/* The cinematic reveal system.
 *
 * This system's whole job is to hide things and then show them. So the failure that matters
 * is not a janky animation — it is content that is hidden and never arrives. Every check
 * below is really asking one question: can this leave something invisible?
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

console.log('cinematic');

const js = read('motion/cinematic.js');
const css = read('motion/cinematic.css');

/* Run the module against a fake DOM and report what it did. */
function run(opts) {
  opts = opts || {};
  const els = (opts.els || []).map(function (e, i) {
    return {
      _cls: {}, dataset: {}, style: { _p: {},
        setProperty(k, v) { this._p[k] = v; },
        getPropertyValue(k) { return this._p[k] || ''; } },
      attrs: e.attrs || {},
      getAttribute(k) { return this.attrs[k] != null ? this.attrs[k] : null; },
      setAttribute(k, v) { this.attrs[k] = v; },
      classList: {
        _o: null,
        add(c) { this._o._cls[c] = true; },
        contains(c) { return !!this._o._cls[c]; }
      },
      getBoundingClientRect() { return e.rect || { top: 5000, bottom: 5200 }; },
      querySelectorAll() { return []; },
      get textContent() { return e.text || ''; },
      set innerHTML(v) { this._html = v; },
      _idx: i
    };
  });
  els.forEach(el => { el.classList._o = el; });

  const html = { _cls: {} };
  html.classList = {
    add(c) { html._cls[c] = true; },
    contains(c) { return !!html._cls[c]; }
  };
  html.contains = c => !!html._cls[c];

  let observed = 0, disconnected = false;
  const win = {
    innerWidth: opts.w === undefined ? 1440 : opts.w,
    innerHeight: opts.h === undefined ? 900 : opts.h,
    matchMedia: () => ({ matches: !!opts.reduced }),
    IntersectionObserver: opts.noIO ? undefined : function (cb, o) {
      this.observe = () => { observed++; };
      this.unobserve = () => {};
      this.disconnect = () => { disconnected = true; };
    },
    getComputedStyle: () => ({ getPropertyValue: () => '90ms' }),
    setTimeout: () => 0
  };
  if (opts.noIO) delete win.IntersectionObserver;

  const doc = {
    documentElement: html,
    querySelectorAll(sel) {
      if (sel === '[data-cine]') return els;
      return [];
    }
  };

  new Function('window', 'document', 'matchMedia', 'IntersectionObserver',
               'getComputedStyle', 'setTimeout', js)(
    win, doc, win.matchMedia, win.IntersectionObserver, win.getComputedStyle, win.setTimeout);

  return {
    armed: html.contains('aq-cine'),
    shown: els.filter(e => e.classList.contains('is-cine-in')).length,
    total: els.length,
    observed, disconnected, els
  };
}

const three = { els: [{ attrs: { 'data-cine': 'rise' } },
                      { attrs: { 'data-cine': 'wipe' } },
                      { attrs: { 'data-cine': 'image' } }] };

check('it arms the CSS only from JavaScript', () => {
  /* Every hidden state is scoped under html.aq-cine. If the script never runs, the class is
     never added and nothing is ever hidden — that is the whole safety design. */
  const hidden = css.match(/\[data-cine="(rise|wipe|image)"\]\{[^}]*opacity:0/g) || [];
  assert.ok(hidden.length >= 3, 'the hiding rules are gone');
  const unscoped = css.split('\n').filter(l =>
    /^\s*\[data-cine/.test(l) && !/html\.aq-cine/.test(l));
  assert.deepStrictEqual(unscoped, [],
    'a hiding rule not scoped under html.aq-cine would hide content even if the script fails');
  assert.ok(run(three).armed, 'the script does not arm the CSS');
});

/* THE ONE THAT MATTERS MOST. */
check('reduced motion shows everything immediately', () => {
  const r = run({ els: three.els, reduced: true });
  assert.strictEqual(r.shown, r.total, 'reduced motion left content hidden');
  assert.strictEqual(r.observed, 0, 'reduced motion should not observe anything');
});

check('a browser with no IntersectionObserver shows everything', () => {
  const r = run({ els: three.els, noIO: true });
  assert.strictEqual(r.shown, r.total, 'content stays hidden without an observer');
});

/* A hidden or prerendered tab lays out at zero size. An observer has nothing to intersect
   against there, so without this guard every element sits hidden indefinitely. */
check('a zero-size viewport shows everything instead of waiting', () => {
  const r = run({ els: three.els, w: 0, h: 0 });
  assert.strictEqual(r.shown, r.total, 'a zero viewport left content hidden');
});

check('elements already on screen arrive without needing a scroll', () => {
  const r = run({ els: [
    { attrs: { 'data-cine': 'rise' }, rect: { top: 100, bottom: 300 } },
    { attrs: { 'data-cine': 'rise' }, rect: { top: 4000, bottom: 4200 } }
  ] });
  assert.strictEqual(r.shown, 1, 'the on-screen element should arrive immediately');
  assert.strictEqual(r.observed, 1, 'only the off-screen element should be observed');
});

check('there is a last-resort reveal so nothing can stay hidden', () => {
  assert.ok(/setTimeout\(/.test(js), 'the fallback timer is gone');
  assert.ok(/stuck/.test(js), 'the fallback no longer looks for stuck elements');
});

/* Only composited properties: anything else animates layout and drops frames mid-scroll. */
check('it animates only transform, opacity, clip-path and filter', () => {
  const props = (css.match(/transition:\s*([^;]+);/g) || []).join(' ');
  ['width', 'height', 'margin', 'padding', 'top', 'left', 'font-size']
    .forEach(p => assert.ok(!new RegExp('\\b' + p + '\\s').test(props),
      'animating ' + p + ' forces layout — use transform instead'));
  assert.ok(/transform/.test(props) && /opacity/.test(props), 'the core properties are gone');
});

/* The tuning contract: five numbers, and every effect expressed in terms of them. */
check('speed and intensity are tunable from one place', () => {
  ['--cine-dur', '--cine-stagger', '--cine-shift', '--cine-blur', '--cine-scale', '--cine-ease']
    .forEach(v => assert.ok(css.includes(v + ':'), 'the tuning variable ' + v + ' is gone'));
  /* Durations must be derived from --cine-dur, not written as literals per effect. */
  assert.ok(/calc\(var\(--cine-dur\)/.test(css),
    'effect durations should be derived from --cine-dur so one change retunes the system');
});

/* It must not fight the animation layer that already exists. */
check('it does not duplicate or override motion.js', () => {
  assert.ok(!/scrollTo|requestAnimationFrame/.test(js),
    'scrolling belongs to motion.js — a second controller would fight it');
  assert.ok(!/data-split|aq-reveal|aq-in/.test(js),
    'the existing reveal and split systems must be left alone');
  const m = read('motion/motion.js');
  assert.ok(/inertial scroll/.test(m), 'motion.js smooth scroll should still be there');
  assert.ok(/data-split/.test(m), 'motion.js split-text should still be there');
});

/* GSAP already existed before this work, on the two globe pages only: lazily CDN-loaded after
 * three.js, purely as optional polish for a camera move, with a plain fallback when it does
 * not arrive. That is fine and is left alone. What must stay true is that the reveal system
 * itself depends on nothing — otherwise reveals would work on two pages out of twenty-seven,
 * or 80KB would have to load on all of them to schedule a CSS transition. */
check('the reveal system adds no dependency, and none is loaded site-wide', () => {
  /* Strip comments first: the module's own header explains why it does NOT use GSAP, and a
     naive search finds that explanation and calls it a dependency. */
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ['gsap', 'ScrollTrigger', 'lenis', 'locomotive', 'anime', 'framer']
    .forEach(lib => assert.ok(!new RegExp(lib, 'i').test(code),
      'cinematic.js must not depend on ' + lib));

  const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f));
  const withGsap = pages.filter(f => /gsap/i.test(read(f)));
  assert.ok(withGsap.length <= 2,
    'GSAP has spread beyond the globe pages: ' + withGsap.join(', '));
  /* Both globe pages load it lazily and say in a comment that the scene degrades without it.
     The wording differs between the two, so match the property that matters — that the page
     documents GSAP as optional — rather than one page's exact phrasing. */
  withGsap.forEach(f => {
    const t = read(f);
    assert.ok(/gsap[\s\S]{0,400}?optional|optional[\s\S]{0,400}?gsap/i.test(t),
      f + ' loads GSAP without documenting it as optional — the globe must degrade without it');
    assert.ok(!/<script src="[^"]*gsap[^"]*"><\/script>/i.test(t),
      f + ' loads GSAP as a blocking tag; it should stay lazily chained after three.js');
  });

  /* A scroll library is the one that would actively break things: motion.js already drives
     the real scroll position, and two controllers fighting over it is a bug, not a preference. */
  const banned = [];
  pages.forEach(f => {
    const t = read(f);
    ['lenis', 'locomotive', 'ScrollTrigger', 'aos.js']
      .forEach(lib => { if (new RegExp(lib, 'i').test(t)) banned.push(f + ' -> ' + lib); });
  });
  assert.deepStrictEqual(banned, [], 'a scroll library crept in: ' + banned.join(', '));
});

/* The oversized name carries the FULL name, title included, split so the last word is the
 * solid half. An earlier version split on a literal "s" because a heredoc ate the backslash,
 * which rendered the name as "Santho hkumar" — hence checking the split itself, not just the
 * regex text. */
check('the founder name splits correctly for the oversized hero', () => {
  const src = read('profile/founder.js');
  assert.ok(/\.split\(\/\\s\+\/\)/.test(src),
    'the name is split on a literal "s" rather than on whitespace');
  const parts = 'Dr. Santhoshkumar SG'.trim().split(/\s+/).filter(Boolean);
  const solid = parts.pop(), outline = parts.join(' ');
  assert.strictEqual(outline, 'Dr. Santhoshkumar', 'the outline half is wrong');
  assert.strictEqual(solid, 'SG', 'the solid half should be the last word');
});

/* "As large as fits on one line" is a fact about rendered glyphs, so it has to be measured.
 * The failures that matter are an overflowing name and a name too small to be the headline. */
check('the name is fitted by measurement, not by a vw guess', () => {
  const src = read('profile/founder.js');
  assert.ok(/function fitStageName/.test(src), 'the fit routine is gone');
  assert.ok(/paddingLeft/.test(src) && /paddingRight/.test(src),
    'the fit must measure the content box — clientWidth includes padding and overflows by it');
  assert.ok(/box\.scrollWidth > avail/.test(src),
    'there must be a corrective pass against the real render, not just a prediction');
  assert.ok(/document\.fonts/.test(src),
    'webfonts land after first paint and change every measurement');
  assert.ok(/var MIN = 40/.test(src),
    'there must be a floor below which the name wraps rather than shrinking to body size');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
