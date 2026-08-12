/* AQcredix — the homepage "how it runs" flow section.
 * Run: node tests/home-flow.test.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function eq(g, w, m) {
  if (g === w) pass++;
  else { fail++; console.log('FAIL: ' + m + ' - got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const home = read('index.html');
const flow = read('home-flow.js');
const css = read('styles.css');

/* The section must exist and be wired to the same scrollytelling engine as the lens
   strip — a second implementation would be a second thing to keep in step. */
ok(/flow-strip/.test(home), 'the homepage has a flow section');
ok(/class="flow-strip" data-scrolly/.test(home), 'driven by the shared scrollytelling engine');
ok(/id="flowScreen"/.test(home) && /id="flowSteps"/.test(home), 'with a screen and a step slot');
ok(/home-flow\.js/.test(home), 'the script is loaded');
ok(/aq:content/.test(flow), 'and re-triggers the motion scan after rendering');

/* Four steps, four screens, and they must correspond. A step whose screen key does not
   resolve renders an empty pinned frame at that stage. */
const sb = { window: {}, document: { getElementById: () => null, addEventListener: () => {}, readyState: 'complete' } };
vm.createContext(sb);
vm.runInContext(flow, sb);
const F = sb.window.HOME_FLOW;
eq(F.length, 4, 'there are four steps');
F.forEach(f => {
  ok(f.step && f.title && f.body && f.screen, 'every step is complete: ' + f.step);
});
const screenKeys = ['setup', 'due', 'record', 'report'];
eq(F.map(f => f.screen).join(','), screenKeys.join(','), 'each step names its screen');
screenKeys.forEach(k => {
  ok(new RegExp('\\b' + k + ':').test(flow), 'the "' + k + '" screen is defined');
});

/* HONESTY. The screens are sketches, not the visitor's data. A homepage cannot read a
   hospital, and figures that look real without saying they are illustrative would be the
   kind of quiet dishonesty an accreditation product least affords. */
ok(/flow-mock/.test(home), 'the frame carries a label');
ok(/Illustrative screens/.test(home), 'saying plainly that the screens are illustrative');
ok(/\.flow-mock\{/.test(css), 'and the label is styled, not hidden');

/* The section must show the platform DOING the work — that is the whole point of it.
   These four are the moments a hospital cannot screenshot and keep. */
ok(/overdue/i.test(flow), 'it shows something overdue');
ok(/Record a meeting/.test(flow), 'it shows work being recorded');
ok(/Evidence/.test(flow), 'it shows evidence landing against a standard');
ok(/Export/.test(flow), 'and the assessment-day export');

/* Real element codes, so the sketch is grounded in the actual book rather than invented.
   Every code shown must exist in nabh-data.js. */
{
  const dsb = { window: {}, console };
  vm.createContext(dsb);
  vm.runInContext(read('nabh-data.js'), dsb);
  const D = dsb.window.NABH_DATA;
  const known = new Set();
  Object.keys(D.chapters).forEach(ch => (D.chapters[ch].standards || []).forEach(s => {
    known.add(s.code);
    (s.elements || []).forEach(e => known.add(s.code + '.' + e.letter));
  }));
  const shown = [...new Set((flow.match(/\b[A-Z]{3}\.\d+(\.[a-z])?\b/g) || []))];
  ok(shown.length >= 4, 'the screens reference real element codes (' + shown.length + ')');
  const bogus = shown.filter(c => !known.has(c));
  eq(bogus.join(', '), '', 'every code shown exists in the NABH data');
}

/* The dates in the setup screen must agree with the scheduling engine, or the homepage
   teaches a rule the product does not follow. 12 May 2026 quarterly, preferring Monday. */
{
  const ssb = { window: {}, console };
  vm.createContext(ssb);
  vm.runInContext(read('calendar/schedule.js'), ssb);
  const K = ssb.window.AQSchedule;
  const d = K.nextDates('2026-05-12', 'quarterly', 1);
  eq(d.exact, '2026-08-12', 'the exact date shown matches the engine');
  eq(d.preferred, '2026-08-10', 'and so does the preferred Monday');
  ok(/12 Aug/.test(flow) && /10 Aug/.test(flow), 'both dates appear on the screen');
  ok(/compliance interval/.test(flow), 'and the distinction is explained');
}

/* Faces share one box so the pinned frame never changes height — a frame that jumps as
   the stage changes is more distracting than the fade it replaces. */
ok(/\.fl-face\{[^}]*position:absolute/.test(css), 'inactive faces are taken out of flow');
ok(/\[data-stage="3"\] \.fl-face\[data-face="3"\]/.test(css), 'all four stages are addressed');

/* Copy: the lead must promise the system, not only the explanation. This is the gap the
   whole section exists to close. */
ok(/the system that runs it/.test(home), 'the hero lead promises the operating system');
ok(/committee calendars/.test(home), 'naming what that means concretely');

/* No hardcoded colour inside a media query, site-wide rule. */
{
  let hard = 0;
  const tail = css.slice(css.indexOf('/* ---------- Homepage "how it runs" flow ---------- */'));
  for (let i = tail.indexOf('@media'); i >= 0; i = tail.indexOf('@media', i + 1)) {
    const o = tail.indexOf('{', i);
    if (o < 0) break;
    let d = 0, j = o;
    for (; j < tail.length; j++) {
      if (tail[j] === '{') d++;
      else if (tail[j] === '}') { d--; if (!d) break; }
    }
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(tail.slice(o, j + 1))) hard++;
  }
  eq(hard, 0, 'no hardcoded colour inside a media query');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
