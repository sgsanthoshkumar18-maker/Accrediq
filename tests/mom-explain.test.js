/* AQcredix — the MOM chapter explanations, and preview coverage across the site.
 * Run: node tests/mom-explain.test.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function eq(g, w, m) {
  if (g === w) pass++;
  else { fail++; console.log('FAIL: ' + m + ' - got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(R('nabh-data.js'), sb);
vm.runInContext(R('mom-explain.js'), sb);
vm.runInContext(R('nabh-explain.js'), sb);

const D = sb.window.NABH_DATA;
const E = sb.window.MOM_EXPLAIN;
const X = sb.window.NABH_EXPLAIN;

/* --------------------------- every element is covered --------------------------- */

const stored = {};
D.chapters.MOM.standards.forEach(s =>
  (s.elements || []).forEach(e => { stored[s.code + '.' + e.letter] = e.text; }));

eq(Object.keys(stored).length, 68, 'the MOM chapter has 68 elements');
const missing = Object.keys(stored).filter(c => !E[c]);
eq(missing.join(', '), '', 'every MOM element has an explanation');
const orphan = Object.keys(E).filter(c => !stored[c]);
eq(orphan.join(', '), '', 'and no explanation keys to an element that does not exist');

/* ----------------------- the plagiarism check, automated -----------------------
   These are Dr Santhoshkumar's own commentary, edited for register — not a rewrite of
   NABH's text. A long shared word-run would mean that distinction had slipped, so the
   check is automated rather than left to a careful read that gets skipped under pressure. */

function longestRun(a, b) {
  const wa = String(a).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const wb = String(b).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  let worst = 0, frag = '';
  for (let i = 0; i < wa.length; i++) {
    for (let j = 0; j < wb.length; j++) {
      let n = 0;
      while (i + n < wa.length && j + n < wb.length && wa[i + n] === wb[j + n]) n++;
      if (n > worst) { worst = n; frag = wa.slice(i, i + n).join(' '); }
    }
  }
  return { run: worst, frag: frag };
}

{
  let flagged = [], worst = 0;
  Object.keys(E).forEach(c => {
    const r = longestRun(E[c], stored[c] || '');
    if (r.run > worst) worst = r.run;
    if (r.run >= 7) flagged.push(c + ' (' + r.run + '): "' + r.frag + '"');
  });
  eq(flagged.join('; '), '', 'no explanation shares a 7-word run with the stored NABH text');
  ok(worst <= 6, 'the longest overlap anywhere is short (' + worst + ' words)');
}

/* Nor should two explanations be near-copies of each other — that would mean one was
   padded out rather than written. */
{
  const keys = Object.keys(E);
  let dupes = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (longestRun(E[keys[i]], E[keys[j]]).run >= 12) {
        dupes.push(keys[i] + ' / ' + keys[j]);
      }
    }
  }
  eq(dupes.join(', '), '', 'no two explanations are near-copies of each other');
}

/* ------------------------------- writing quality ------------------------------- */

Object.keys(E).forEach(c => {
  const t = E[c];
  ok(/[.!?]$/.test(t.trim()), c + ' ends with terminal punctuation');
  eq(/\s{2,}/.test(t), false, c + ' has no double spaces');
  eq(/\b(\w+) \1\b/i.test(t), false, c + ' has no repeated word');
  ok(t.split(/\s+/).length >= 15, c + ' says enough to be useful');
  ok(t.split(/\s+/).length <= 90, c + ' stays short enough to read');
  ok(/^[A-Z\u201c]/.test(t.trim()), c + ' starts with a capital');
});

/* Written as instructions to a hospital, not as restatements of the clause. "The
   organisation shall..." is the standard's voice; this file should not borrow it. */
{
  const echoes = Object.keys(E).filter(c => /^The organisation shall/i.test(E[c].trim()));
  eq(echoes.join(', '), '', 'no explanation opens in the standard\'s own voice');
}

/* ------------------------- authored text takes precedence ------------------------- */

ok(X.isAuthored('MOM.4.e'), 'a MOM element is recognised as authored');
eq(X.isAuthored('AAC.1.a'), false, 'an element in another chapter is not');
eq(X.explainFor('MOM.4.e', 'STORED TEXT'), E['MOM.4.e'],
   'the authored text is returned in preference to the stored wording');
ok(/In plain terms/.test(X.explainFor('AAC.1.a', 'The organisation shall define services.')),
   'other chapters still fall back to the mechanical simplifier');
/* That fallback is a rewrite OF the NABH wording, so it still derives from it — a stopgap,
   not a substitute for a professional's own account. Worth keeping visible. */
ok(/mechanical rewrite/.test(R('nabh-explain.js')),
   'and the file says plainly that the fallback derives from the original');

{
  const loaded = ['standards.html', 'know.html'].filter(f => {
    try { return /mom-explain\.js/.test(R(f)); } catch (e) { return false; }
  });
  ok(loaded.length >= 1, 'the standards page loads the authored explanations');
}

/* ============================ preview coverage ============================
   A locked page that shows nothing cannot sell itself. Every gated page should show
   something of what it does before asking for money. */
{
  const pvSb = { window: {}, console };
  vm.createContext(pvSb);
  vm.runInContext(R('billing/preview.js'), pvSb);
  const P = pvSb.window.AQPreview;

  const pages = [];
  function scan(dir, prefix) {
    fs.readdirSync(path.join(ROOT, dir)).forEach(f => {
      if (f.endsWith('.html')) pages.push(prefix + f);
    });
  }
  scan('.', '');
  scan('tools', 'tools/');

  const gated = pages.filter(f => /data-access="paid"/.test(R(f)));
  const noPreview = gated.filter(f => !/data-preview=/.test(R(f)));
  eq(noPreview.join(', '), '', 'every paid page declares a preview (' + gated.length + ' gated)');

  // And every declared preview must actually resolve to something.
  let unresolved = [];
  pages.forEach(f => {
    const m = /data-preview="([^"]+)"/.exec(R(f));
    if (m && !P.PAGES[m[1]]) unresolved.push(f + ' -> ' + m[1]);
  });
  eq(unresolved.join(', '), '', 'every declared preview resolves to a renderer');

  /* NO GATED PAGE MAY FALL BACK TO `generic`.
     Code Alerts once showed a defibrillator calibration, because it had no preview of its
     own and inherited the workspace sample. A preview that describes a different page is
     worse than none — it tells the visitor the product is not what they came for. */
  const generic = gated.filter(f => /data-preview="generic"/.test(R(f)));
  eq(generic.join(', '), '', 'no gated page falls back to the generic preview');

  /* Preview markup must depend only on styles.css. The first version borrowed `cal-row`
     from calendar.css, which the workspace loads and almost no other gated page does — so
     every preview outside the workspace rendered as a stack of bare text. */
  {
    const pvSrc = R('billing/preview.js');
    const code = pvSrc.replace(/\/\*[\s\S]*?\*\//g, '');
    eq(/cal-row|cal-pill|cal-meta|cal-next|cal-rows/.test(code), false,
       'preview markup does not depend on calendar.css');
    const css = R('styles.css');
    const used = new Set();
    let mm; const re = /class="([^"]+)"/g;
    while ((mm = re.exec(code))) {
      mm[1].split(/\s+/).forEach(c => {
        if (/^[a-zA-Z][\w-]*$/.test(c) && c !== 'btn') used.add(c);
      });
    }
    const undefinedCls = [...used].filter(c => !new RegExp('\\.' + c + '(?![\\w-])').test(css));
    eq(undefinedCls.join(', '), '', 'every class a preview renders is defined in styles.css');
  }

  // Each renders with the banner, real substance, and a route to the plans page.
  Object.keys(P.PAGES).forEach(k => {
    const h = P.render(k, '');
    ok(/pv-banner/.test(h), k + ' preview carries the banner');
    ok(/plans\.html/.test(h), k + ' preview routes to plans');
    ok(h.length > 900, k + ' preview shows enough to judge by');
  });

  /* The quiz is free with an account — that is the whole free tier, so it must not be
     behind the paid gate by accident. */
  ok(/data-access="login"/.test(R('quiz.html')), 'the quiz needs an account, not a subscription');
  ok(/free<\/b> with an account|free<\/b> \u2014 you do not need/.test(P.render('quiz', '')) ||
     /free/.test(P.render('quiz', '')),
     'and its preview says so');
}

/* ============================ the animated reel ============================
   A static sample table shows what a page contains; it does not show what the page DOES,
   and "does" is what someone weighing ₹500 a month is buying. Built as animated SVG rather
   than video: eighteen video files would be a hundred megabytes to host, unreadable on a
   slow hospital connection, and impossible to correct without re-recording. */
{
  const rlSb = { window: {}, console };
  vm.createContext(rlSb);
  vm.runInContext(R('billing/reel.js'), rlSb);
  vm.runInContext(R('billing/preview.js'), rlSb);
  const RL = rlSb.window.AQReel;
  const PV = rlSb.window.AQPreview;

  const noReel = Object.keys(PV.PAGES).filter(k => k !== 'generic' && !RL.REELS[k]);
  eq(noReel.join(', '), '', 'every previewable page has a reel');

  Object.keys(RL.REELS).forEach(k => {
    const r = RL.REELS[k];
    ok(r.title && r.line, k + ' reel has a title and a line');
    ok(r.scenes.length >= 3, k + ' reel has at least three scenes');
    ok(r.scenes.length <= 5, k + ' reel is short enough to watch');
    r.scenes.forEach((s, i) => {
      ok(s.cap && s.cap.length > 12, k + ' scene ' + i + ' has a real caption');
      ok(s.svg && s.svg.length > 40, k + ' scene ' + i + ' has a stage');
    });
    /* Each reel should end on the outcome, not on the mechanism — the last thing seen is
       what a visitor carries into the pricing decision. */
    ok(/rl-done/.test(r.scenes[r.scenes.length - 1].svg),
       k + ' reel ends on the payoff, not the mechanism');
  });

  const h = RL.render('rounds', '');
  ok(/rl-stage/.test(h), 'the reel renders a stage');
  ok(/rl-dot/.test(h), 'with scene controls');
  ok(/plans\.html/.test(h), 'and routes to plans');

  // The reel comes before the detail, because attention is spent in the first seconds.
  const full = PV.render('rounds', '');
  ok(full.indexOf('rl-stage') < full.indexOf('pv-detail-h'),
     'the reel appears before the sample data');

  const src = R('billing/reel.js');
  /* Autoplay must yield permanently once someone takes control — resuming pulls the scene
     away mid-read, which is the most irritating thing a carousel does. */
  ok(/touched = true/.test(src), 'manual control stops autoplay');
  ok(/if \(touched\) return;/.test(src), 'and it never resumes on its own');
  ok(/prefers-reduced-motion/.test(src), 'reduced motion disables it');
  ok(/IntersectionObserver/.test(src), 'it only plays on screen');
  ok(/visibilitychange/.test(src), 'and pauses in a background tab');
  /* Restarting a CSS animation needs a reflow; setting the same value again does nothing
     and the progress bar freezes on scene two. */
  ok(/void fill\.offsetWidth/.test(src), 'the progress bar restarts properly');

  const css = R('styles.css');
  ok(/@media \(prefers-reduced-motion:reduce\)[\s\S]{0,400}\.rl-scene/.test(css),
     'and the stylesheet stands down under reduced motion too');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
