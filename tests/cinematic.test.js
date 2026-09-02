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
        /* The reveal puts a guard class on while it plays and takes it off afterwards, so
           remove() has to be real — a stub that throws would abort the escape hatches. */
        remove(...cs) { cs.forEach(c => { delete this._o._cls[c]; }); },
        contains(c) { return !!this._o._cls[c]; }
      },
      /* height/width matter: the module treats a zero-size box as "not rendered yet" and
         defers judging it, so a rect without them would be skipped rather than placed. */
      getBoundingClientRect() {
        const r = e.rect || { top: 5000, bottom: 5200 };
        return { top: r.top, bottom: r.bottom,
                 height: r.height !== undefined ? r.height : (r.bottom - r.top),
                 width: r.width !== undefined ? r.width : 400 };
      },
      querySelectorAll() { return []; },
      get textContent() { return e.text || ''; },
      set innerHTML(v) { this._html = v; },
      /* The reveal is driven by element.animate(), so the fake element has to record what it
         was asked to play — that recording is what the timing checks below read. */
      _anims: [],
      animate(keys, opts) {
        const a = { keys, opts, id: null, cancelled: false,
                    cancel() { this.cancelled = true; } };
        this._anims.push(a);
        return a;
      },
      getAnimations() { return this._anims; },
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
    /* cinematic.css is still the single place the numbers live; the module reads them out of
       these custom properties at start-up. Answering each one separately is what lets the
       timing checks below assert real durations rather than a placeholder. */
    getComputedStyle: () => ({
      getPropertyValue: (k) => ({
        '--cine-dur': '900ms', '--cine-stagger': '90ms', '--cine-shift': '26px',
        '--cine-blur': '12px', '--cine-scale': '1.06',
        '--cine-ease': 'cubic-bezier(.16, 1, .3, 1)'
      }[k] || ''),
      opacity: '1', clipPath: 'none'
    }),
    /* A visible tab: the frame arrives. Nested rAF is used by the on-screen reveal, so this
       has to run the callback rather than merely record it. */
    requestAnimationFrame: opts.noRaf ? undefined : (fn) => { fn(); return 1; },
    /* The 4s backstop must NOT fire during a test, or every case would look like it passed. */
    setTimeout: () => 0,
    /* The module re-scans on load, because a deferred script runs before DOMContentLoaded and
       may have measured a page whose content was not rendered yet. */
    addEventListener() {},
    removeEventListener() {}
  };
  if (opts.noIO) delete win.IntersectionObserver;

  let listeners = [];
  const doc = {
    documentElement: html,
    /* The on-screen reveal reads a layout property to flush the hidden state before adding
       the end state — reading it is the point, so the stub just has to answer. */
    body: { offsetWidth: 1440 },
    hidden: false,
    /* The module re-checks on visibilitychange, because a tab backgrounded during load runs
       no transitions and an element can be told to arrive and never move. */
    addEventListener(type, fn) { listeners.push(type); },
    querySelectorAll(sel) {
      if (sel === '[data-cine]') return els;
      return [];
    }
  };

  /* A browser that can animate. opts.noAnimate takes it away, which is the check that the
     module still REVEALS when it cannot MOVE. */
  const El = function () {};
  El.prototype.animate = opts.noAnimate ? undefined : function () {};

  new Function('window', 'document', 'matchMedia', 'IntersectionObserver',
               'getComputedStyle', 'setTimeout', 'requestAnimationFrame', 'Element', js)(
    win, doc, win.matchMedia, win.IntersectionObserver, win.getComputedStyle,
    win.setTimeout, win.requestAnimationFrame, El);

  return {
    armed: html.contains('aq-cine'),
    shown: els.filter(e => e.classList.contains('is-cine-in')).length,
    total: els.length,
    observed, disconnected, els, listeners
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

/* THE BUG THAT MADE THE HERO NOT ANIMATE.
 * A CSS transition needs two computed values in two different frames. Above-the-fold elements
 * were getting the hidden state (via html.aq-cine) and the end state (is-cine-in) inside one
 * synchronous run, so the browser resolved the final style once and painted it — no start
 * value, no transition. Below-the-fold elements were always fine, because the observer fires
 * them in a later frame. The gap has to be forced for the ones already on screen. */
check('above-the-fold elements are animated explicitly, not by flipping a class', () => {
  /* THE FIX. A class flip only ASKS for a transition, and the ask is granted only if the
     browser happened to resolve the hidden state in an earlier style change event. Three
     separate things on the founder page collapse that gap — a hero rendered from data after
     DOMContentLoaded, a portrait injected on img.onload, and motion.js holding opacity:0 on
     <body> for the first two frames — and when it collapses the element simply appears.
     element.animate() is handed both keyframes, so there is no gap to lose. */
  const r = run({ els: [{ attrs: { 'data-cine': 'rise', 'data-cine-delay': '360' },
                          rect: { top: 100, bottom: 160 } }] });
  const anims = r.els[0]._anims;
  assert.ok(anims.length >= 1, 'the on-screen element was revealed but never animated');
  const a = anims[0];
  assert.strictEqual(a.opts.delay, 360, 'data-cine-delay must reach the animation');
  assert.strictEqual(a.opts.duration, 900, 'the duration must come from --cine-dur');
  assert.strictEqual(a.opts.fill, 'backwards',
    'without fill:backwards the element sits at its resting state during its delay and the ' +
    'stagger is lost — everything appears at once, then moves');
  assert.strictEqual(a.keys[0].opacity, 0, 'the animation must start from the hidden state');
  assert.strictEqual(a.keys[1].transform, 'none', 'the animation must end at rest');
  assert.strictEqual(a.id, 'cine',
    'animations must be tagged so a replay cancels its own and nothing else');

  /* The class still goes on, and goes on FIRST. It is the resting state, so an animation that
     never starts leaves the content visible rather than hidden — the failure mode this whole
     file exists to prevent. */
  assert.strictEqual(r.shown, 1, 'the class must be applied regardless of the animation');
  const noAnim = run({ els: [{ attrs: { 'data-cine': 'rise' }, rect: { top: 100, bottom: 160 } }],
                       noAnimate: true });
  assert.strictEqual(noAnim.shown, 1,
    'a browser without element.animate must still be shown the content');
  assert.strictEqual(noAnim.els[0]._anims.length, 0, 'it should not have tried to animate');

  /* THE FIVE-SECOND NAME. A deferred script runs BEFORE DOMContentLoaded, so a page that
     renders in a DOMContentLoaded handler is measured while still empty — the hero was a
     zero-height box at a negative offset, failed the on-screen test, went to the observer,
     and was rescued by the backstop four seconds later. Re-scanning is the fix. */
  assert.ok(/function scan\(\)/.test(js), 'the re-scannable path is gone');
  assert.ok(/if \(!r\.height && !r\.width\) return;/.test(js),
    'a zero-size box means the content has not rendered — it must be left for the next scan, ' +
    'not judged off-screen');
  assert.ok(/window\.AQCine = \{ refresh: scan, play: play \}/.test(js),
    'refresh() and play() must both be exported: refresh for a late-rendering page, play for ' +
    'content that arrives after its container was already revealed');

  /* THE PORTRAIT. founder.js injects the <img> on img.onload, which lands after the container
     has been revealed — so the box rose while empty and the photograph appeared inside it
     having missed its own entrance. It has to replay once the image is actually there. */
  assert.ok(/AQCine\.play\(ph\)/.test(read('profile/founder.js')),
    'the portrait must replay its reveal when the image finally loads');
  assert.ok(/addEventListener\("load", scan\)/.test(js),
    'a re-scan on load is the safety net for pages that never call refresh()');
  assert.ok(/AQCine\.refresh\(\)/.test(read('profile/founder.js')),
    'founder.js renders on DOMContentLoaded and must tell the reveal module when it is done');
  assert.ok(/if \(el\.classList\.contains\("is-cine-in"\)\) return;/.test(js),
    'runIn must be idempotent — refresh() and the load re-scan both call it');
  assert.ok(/io\.observe\(el\)/.test(js), 'the observer path is gone');
});

/* THE ONE THAT ACTUALLY BROKE THE PORTRAIT.
 * Transitions outrank animations in the cascade, so a `transition` an element carries for its
 * own reasons silently takes the property over. .fp-photo still has `transition: transform
 * 220ms ease` from its days as a small circular avatar, and it was replacing the founder
 * portrait's 1800ms rise with a 220ms snap — which is why that one element never looked
 * animated while its neighbours did. */
check('no other transition can shadow a reveal while it plays', () => {
  const r = run({ els: [{ attrs: { 'data-cine': 'riseslow' }, rect: { top: 100, bottom: 700 } }] });
  assert.ok(r.els[0].classList.contains('is-cine-run'),
    'the guard class is not applied — a competing transition would win the property');
  assert.ok(/\.is-cine-run[\s\S]{0,120}transition:none !important/.test(css),
    'the guard class must actually suppress transitions, and !important is what it takes');

  /* It has to come OFF again, or that element loses its own hover effects for the rest of the
     visit. Two ways out, because animation events are dispatched during the rendering
     lifecycle and a hidden or throttled tab does not run one. */
  assert.ok(/last\.onfinish = done/.test(js) && /last\.oncancel = done/.test(js),
    'the guard must be released when the reveal ends, cancellation included');
  assert.ok(/setTimeout\(done, lastEnd \+ \d+\)/.test(js),
    'a finish event that never arrives would leave the guard on forever — a timer must ' +
    'release it too');

  /* And every hard-reveal path has to drop it as well, or the escape hatches leave it behind. */
  const outs = js.match(/remove\("is-cine-run"\)/g) || [];
  assert.ok(outs.length >= 3,
    'showAll, the backstop and the visibilitychange recheck must each drop the guard');
});

check('there is a last-resort reveal so nothing can stay hidden', () => {
  assert.ok(/setTimeout\(/.test(js), 'the fallback timer is gone');

  /* THIS ASSERTION USED TO BE WRONG, AND THE BUG IT MISSED SHIPPED. It checked that the
     fallback looked for "stuck" elements — meaning elements MISSING is-cine-in. But adding
     the class only ASKS for a transition; if that transition never runs, the element keeps
     its hidden start state while carrying the class that claims it arrived. That case — the
     only one that actually matters — was invisible to a check written this way, and the
     founder page shipped with its headline permanently hidden.

     The right question is whether the element RENDERED, so that is what is asserted now. */
  assert.ok(/function looksHidden/.test(js),
    'the fallback must ask whether the element rendered, not whether it has the class');
  assert.ok(/clipPath/.test(js),
    'opacity alone is not enough: the drop variant hides via clip-path:inset(100%) and is ' +
    'invisible at full opacity');
  assert.ok(!/var stuck = all\.filter/.test(js),
    'the fallback is back to looking for elements missing the class');
  assert.ok(/is-cine-shown/.test(js),
    'there must be a hard end state that does not depend on a transition running');
});

check('a tab backgrounded during load is rechecked when the visitor returns', () => {
  const r = run(three);
  assert.ok(r.listeners.indexOf('visibilitychange') !== -1,
    'no visibilitychange listener: a tab hidden at load runs no transitions, so elements ' +
    'can be told to arrive and simply never move');
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
  /* The numbers still live in the CSS; the module reads them out at start-up rather than
     restating them, so one change still retunes the whole system. */
  ['--cine-dur', '--cine-stagger', '--cine-shift', '--cine-blur', '--cine-scale', '--cine-ease']
    .forEach(v => assert.ok(js.includes('"' + v + '"'),
      js + '' && 'cinematic.js hardcodes a number instead of reading ' + v + ' from the CSS'));
  /* Durations must be derived from --cine-dur, not written as literals per effect. */
  assert.ok(/DUR \* t\.mul/.test(js) && /DUR \* 0\.95/.test(js),
    'effect durations should be multiples of --cine-dur so one change retunes the system');
  assert.ok(!/duration: \d{3,}/.test(js), 'a literal duration crept in');
});

/* It must not fight the animation layer that already exists. */
check('it does not duplicate or override motion.js', () => {
  /* The concern is a competing SCROLL controller, not rAF as such: one frame of deferral is
     what gives an above-the-fold transition a start state, and that is not scrolling.
     Comments are stripped first — the module's header explains why it does not drive the
     scroll, and matching that explanation would fail the check it is describing. */
  const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/scrollTo|scrollBy|scrollIntoView|addEventListener\(\s*['"](?:wheel|scroll)['"]/.test(code),
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
  /* The name is full-bleed now, so it is fitted to the SCREEN rather than to the padded
     container it sits inside — measuring the container capped it well short of the edges. */
  assert.ok(/var gutter = window\.innerWidth/.test(src),
    'the fit must measure against the viewport, with a gutter, now that the name is full-bleed');
  assert.ok(/box\.clientWidth - gutter \* 2/.test(src),
    'the available width should be the bleed box less the gutter');
  /* THE BUG THIS REPLACES. The name is full-bleed, so the element is as wide as the screen,
     and scrollWidth on a block is floored at its own clientWidth: it reports the CONTAINER
     whenever the text is narrower than it. The fit could therefore only ever shrink. Nothing
     showed while the face was wide enough to overflow at the trial size; swapping in a
     condensed one exposed it, and the name stayed at exactly its old 90px instead of growing
     into the 1388px it now had. A Range over the contents reports the glyphs at any width. */
  assert.ok(/function textWidth/.test(src),
    'the fit must measure the glyphs, not the box');
  assert.ok(/selectNodeContents/.test(src),
    'a Range over the contents is what reports text narrower than its container');
  assert.ok(/textWidth\(\) > avail/.test(src),
    'there must be a corrective pass against the real render, not just a prediction');
  assert.ok(/var MAX = 220/.test(src),
    'without a ceiling a wide monitor sizes the name from width alone and the hero stops ' +
    'fitting on one screen');
  assert.ok(/document\.fonts/.test(src),
    'webfonts land after first paint and change every measurement');
  assert.ok(/var MIN = 40/.test(src),
    'there must be a floor below which the name wraps rather than shrinking to body size');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('\nall passing');
