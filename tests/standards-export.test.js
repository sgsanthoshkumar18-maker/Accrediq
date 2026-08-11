/* AQcredix — SOP department mapping and the standards Excel export.
 *
 * Plain Node, no install. Run: node tests/standards-export.test.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function eq(got, want, msg) {
  if (got === want) { pass++; }
  else { fail++; console.log('FAIL: ' + msg + ' - got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
}
function ok(cond, msg) { eq(!!cond, true, msg); }

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

/* A JSZip stand-in. Only the sheet XML matters here, not the compression, so this
   captures parts by name instead of producing a real archive. */
function Z() { this.f = {}; }
Z.prototype.file = function (n, c) { this.f[n] = c; return this; };
Z.prototype.folder = function (n) {
  const p = this;
  const o = { file: (a, b) => { p.f[n + '/' + a] = b; return o; },
              folder: m => p.folder(n + '/' + m) };
  return o;
};
Z.prototype.generateAsync = function () { return Promise.resolve({ size: 1, parts: this.f }); };

const sandbox = { window: { JSZip: Z }, console };
sandbox.window.JSZip = Z;
vm.createContext(sandbox);
['nabh-data.js', 'audit/scope-data.js', 'standards/sop-depts.js', 'standards/standards-excel.js']
  .forEach(f => vm.runInContext(read(f), sandbox, { filename: f }));

const W = sandbox.window;
const D = W.AQSopDepts, E = W.AQStandardsExcel, DATA = W.NABH_DATA;

/* ---------------- the map is inverted from the checklist, not guessed ---------------- */

// Every department name in the map must be a real department in the audit scope. A typo
// or an invented area would send a hospital to file an SOP with a team that does not exist.
const realNames = Object.keys(W.AUDIT_SCOPE).map(k => W.AUDIT_SCOPE[k].name);
let allCodes = [], sopCodes = [];
Object.keys(DATA.chapters).forEach(ch => DATA.chapters[ch].standards.forEach(s => s.elements.forEach(e => {
  const code = s.code + '.' + e.letter;
  allCodes.push(code);
  if (e.sop) sopCodes.push(code);
})));

let bogus = 0;
allCodes.forEach(c => D.forCode(c).forEach(n => { if (realNames.indexOf(n) < 0) bogus++; }));
eq(bogus, 0, 'every mapped department exists in the audit scope');

// The book asterisks 188 elements; that count is the whole basis of the SOP filter.
eq(sopCodes.length, 188, 'the SOP-required element count matches the book');

// No department may be listed twice for one element — areas inherit scope, so duplicates
// are possible and would show the same team twice in the panel.
let dupes = 0;
sopCodes.forEach(c => { const d = D.forCode(c); if (new Set(d).size !== d.length) dupes++; });
eq(dupes, 0, 'no department is repeated within an element');

// Sorted, so the panel and the sheet agree and the order is stable between runs.
let unsorted = 0;
sopCodes.forEach(c => {
  const d = D.forCode(c);
  if (d.join('|') !== d.slice().sort().join('|')) unsorted++;
});
eq(unsorted, 0, 'departments are returned in a stable sorted order');

// Most asterisked elements resolve to at least one department; the remainder are
// genuinely organisation-wide and must say so rather than resolve to a wrong team.
const mapped = sopCodes.filter(c => D.countFor(c) > 0).length;
ok(mapped >= 170, 'the large majority of SOP elements name a department (' + mapped + '/188)');
eq(D.labelFor(sopCodes.find(c => D.countFor(c) === 0)), D.UNSCOPED,
   'an unscoped element is labelled hospital-wide, not left blank');
ok(/not scoped/.test(D.UNSCOPED), 'the hospital-wide label explains itself');

// An unknown code returns an empty array rather than throwing — the panel calls this for
// whatever is on screen, and an exception there blanks the element list.
eq(D.forCode('ZZZ.9.z').length, 0, 'an unknown code returns empty, not an error');

/* ------------------------------ the export mirrors the filter ------------------------------ */

const sopRows = E.collect('AAC', 'sop');
const allRows = E.collect('AAC', 'all');
const coreRows = E.collect('AAC', 'CORE');
ok(sopRows.length > 0, 'the SOP filter selects rows');
ok(sopRows.every(r => r.sop), 'the SOP export contains only asterisked elements');
ok(allRows.length > sopRows.length, 'the all-elements export is larger than the SOP one');
ok(coreRows.every(r => r.category === 'CORE'), 'a category filter exports only that category');

// The sheet set differs by filter: department sheets only make sense for SOP rows.
eq(E.sheetNames('sop').length, 4, 'the SOP export carries four sheets');
eq(E.sheetNames('all').length, 2, 'a non-SOP export carries two');
ok(E.sheetNames('sop').indexOf('By Department') >= 0, 'the SOP export has a By Department sheet');

/* ------------------------------ the workbook itself ------------------------------ */

let parts = null;
E.build('AAC', 'sop').then(r => { parts = r.parts; });

// Resolve the promise chain before asserting — the stub is synchronous underneath.
setTimeout(function () {
  ok(parts, 'the workbook builds');
  const sheet2 = parts['xl/worksheets/sheet2.xml'];
  ok(/Departments that must maintain this SOP/.test(sheet2),
     'the department column is present in the SOP sheet');

  // The point of the whole feature: a real department name against a real element.
  const probe = sopRows.find(r => D.countFor(r.code) > 0);
  const firstDept = D.forCode(probe.code)[0];
  ok(sheet2.indexOf(firstDept.replace(/&/g, '&amp;')) >= 0,
     'a real department name appears beside its element');

  // Ampersands appear in real department names ("Front Office, Registration, Admission &
  // Billing"); an unescaped one makes the file unopenable in Excel.
  eq(/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(sheet2), false,
     'no raw ampersand survives into the sheet XML');

  const sheet4 = parts['xl/worksheets/sheet4.xml'];
  ok(/SOPs per department/.test(sheet4), 'the summary sheet counts SOPs per department');

  // A non-SOP export must not carry department sheets it has no data for.
  E.build('AAC', 'all').then(r2 => {
    ok(!r2.parts['xl/worksheets/sheet3.xml'], 'a non-SOP export writes no department sheet');
    ok(/sheet2\.xml/.test(r2.parts['xl/_rels/workbook.xml.rels']),
       'relationships match the sheets actually written');

    /* ------------------------------ the paid gate ------------------------------ */
    const page = read('standards.html');
    ok(/AQBilling/.test(page), 'the download consults the billing entitlement');
    ok(/st && st\.active/.test(page), 'it uses the single active flag, so owner and complimentary pass');
    ok(/entitled !== true/.test(page), 'unknown entitlement is treated as locked, failing closed');
    ok(/await refreshEntitlement\(\)/.test(page), 'entitlement is re-checked on each press, not cached from load');

    /* The accessor is currentUser(), and it is async. A call to a user() that does not
       exist threw into the catch, set entitled=false, and sent EVERY press — the owner's
       included — to the plans page instead of downloading. Both halves are asserted:
       the right name, and the await. */
    ok(/await S\.currentUser\(\)/.test(page), 'the real async currentUser accessor is awaited');
    eq(/AQStore\.user\(\)/.test(page), false, 'no call to the non-existent user() accessor');

    // The catch must be loud. A silent catch here is what made this look like a UI bug
    // rather than a failing call.
    ok(/console\.error\('AQcredix: entitlement check failed'/.test(page),
       'a failed entitlement check reports itself to the console');

    /* And the gate itself, run for real: the owner and the complimentary account must
       both come back active, or the export is locked for the two people who own it. */
    const vm2 = require('vm');
    const sb = { window: {}, console: { log(){}, warn(){}, error(){} },
                 fetch: async () => ({ ok: true, status: 200, json: async () => [] }) };
    sb.window.location = { origin: 'https://accrediq.vercel.app', search: '' };
    sb.window.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
    sb.window.addEventListener = () => {};
    vm2.createContext(sb);
    vm2.runInContext(read('billing/billing-config.js'), sb);
    sb.window.AQStore = { adapter: { list: async () => [] } };
    vm2.runInContext(read('billing/billing.js'), sb);
    const B = sb.window.AQBilling;
    Promise.all([
      B.status({ id: 'x', email: 's.g.santhoshkumar18@gmail.com' }),
      B.status({ id: 'x', email: 'sgsanthoshkumar18@gmail.com' }),
      B.status({ id: 'x', email: 'mavissneha@gmail.com' }),
      B.status({ id: 'x', email: 'someone@hospital.com' }),
      B.status(null)
    ]).then(([owner, ownerDotless, comp, free, out]) => {
      eq(owner.active, true, 'the owner is entitled to the export');
      eq(ownerDotless.active, true, 'and still is with Gmail dots removed');
      eq(comp.active, true, 'the complimentary account is entitled');
      eq(comp.owner, false, 'but is not an owner');
      eq(free.active, false, 'a free signed-in user is not entitled');
      eq(out.active, false, 'a signed-out visitor is not entitled');

      console.log('\n' + pass + ' passed, ' + fail + ' failed');
      if (fail) process.exit(1);
    });
    ok(/addEventListener\('load'/.test(page), 'the first check waits for the billing scripts to load');
    ok(/workspace\/workspace\.html/.test(page), 'a locked press routes to the real plans page');
    // The department panel is free: knowing who is accountable is part of the standard.
    ok(page.indexOf('openDeptModal') < page.indexOf('async function onDownload'),
       'the department panel is defined independently of the paid export');
    ok(!/entitled[\s\S]{0,200}openDeptModal/.test(page), 'the department panel is not gated');

    // Mobile: no hardcoded colour may appear inside a media query, or mobile stops
    // inheriting palette fixes. Same rule the palette suite enforces site-wide.
    /* Brace-match rather than regex: a non-greedy pattern spans from one @media to the
       close of a LATER rule and reports colours that are not in any media query at all. */
    let hard = 0;
    for (let i = page.indexOf('@media'); i >= 0; i = page.indexOf('@media', i + 1)) {
      const open = page.indexOf('{', i);
      if (open < 0) break;
      let depth = 0, j = open;
      for (; j < page.length; j++) {
        if (page[j] === '{') depth++;
        else if (page[j] === '}') { depth--; if (!depth) break; }
      }
      const block = page.slice(open, j + 1);
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(block)) {
        hard++;
        console.log('  hardcoded colour in: ' + block.slice(0, 120));
      }
    }
    eq(hard, 0, 'no hardcoded colour inside a media query');
    ok(/\.dept-btn\{[^}]*min-height/.test(page), 'the department button has a tap-sized target');
    ok(/\.dl-chip\{[^}]*min-height/.test(page), 'the download control has a tap-sized target');
    ok(/max-width:760px\)\{[\s\S]*?\.dl-chip\{width:100%/.test(page),
       'the download control goes full width on a phone');

  });
}, 0);
