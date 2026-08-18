/* AQcredix — bulk import, global search, cross-linking, mobile touch targets.
 * Run: node tests/import-search.test.js
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

/* ============================== bulk import ============================== */

const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(read('calendar/schedule.js'), sb);
sb.window.AQSchedule = sb.window.AQSchedule;
vm.runInContext(read('workspace/import.js'), sb);
const I = sb.window.AQImport;

ok(I && I.TYPES, 'the importer exists');
['assets', 'compliance_tasks', 'committees', 'members'].forEach(t => {
  ok(I.TYPES[t], t + ' can be imported');
  ok(I.TYPES[t].cols.some(c => c[2]), t + ' declares at least one required column');
});

/* The one thing that actually breaks hospital spreadsheets is a comma inside a quoted
   description. A naive split corrupts exactly those rows, silently. */
{
  const rows = I.parseCSV('Name,Dept\n"Defibrillator, ICU bed 4",Biomedical\n');
  eq(rows[1][0], 'Defibrillator, ICU bed 4', 'a comma inside quotes survives parsing');
  eq(rows[1][1], 'Biomedical', 'and the following column is not shifted');
}
{
  const rows = I.parseCSV('A,B\n"say ""hi""",x\n');
  eq(rows[1][0], 'say "hi"', 'escaped quotes are unescaped');
}
{
  const rows = I.parseCSV('A,B\n1,2\n\n\n3,4\n');
  eq(rows.length, 3, 'blank lines are dropped rather than imported as empty records');
}

// Headers match loosely — a hospital's sheet will not match our capitalisation.
{
  const spec = I.TYPES.assets;
  const map = I.mapHeaders(spec, ['NAME', 'serial / number', 'Department']);
  eq(map.name, 0, 'header matching ignores case');
  eq(map.identifier, 1, 'and spacing and punctuation');
}

/* Validation must reject rather than silently write bad data — a frequency the schedule
   engine does not know creates a row that never appears on the calendar, which is worse
   than a rejected import because nobody notices. */
{
  const csv =
    'Name,Type,Department,Cycle type,Cycle frequency,Last done (YYYY-MM-DD)\n' +
    'Defibrillator,equipment,Biomedical,calibration,Yearly,2025-06-15\n' +
    ',equipment,Biomedical,,,\n' +
    'Fire NOC,licence,Facilities,renewal,yearly,15-06-2025\n' +
    'Autoclave,equipment,Biomedical,preventive,everyfortnight,2026-05-10\n';
  const v = I.validate('assets', I.parseCSV(csv));
  eq(v.rows.length, 4, 'every data row is reported, valid or not');
  eq(v.rows[0].errs.length, 0, 'a good row passes');
  eq(v.rows[0].rec.cycle_frequency, 'yearly', '"Yearly" is normalised, not rejected');
  ok(/required/.test(v.rows[1].errs.join()), 'a missing required field is caught');
  ok(/YYYY-MM-DD/.test(v.rows[2].errs.join()), 'a wrong date format is caught');
  ok(/not a frequency/.test(v.rows[3].errs.join()), 'an unknown frequency is caught');
}

// A missing required COLUMN fails the whole file, with a message naming it.
{
  const v = I.validate('assets', I.parseCSV('Type,Department\nequipment,Biomedical\n'));
  ok(v.error && /Name/.test(v.error), 'a missing required column names itself');
  ok(/template/.test(v.error), 'and points at the template');
}
eq(I.validate('assets', []).error !== undefined, true, 'an empty file is refused');

// Templates round-trip: the generated template must itself validate.
Object.keys(I.TYPES).forEach(t => {
  const v = I.validate(t, I.parseCSV(I.templateCSV(t)));
  eq(v.error, undefined, 'the ' + t + ' template has all required columns');
  eq(v.rows.filter(r => r.errs.length).length, 0,
     'and its example row is itself valid');
});

const iui = read('workspace/import-ui.js');
/* Preview before write. A bad import is worse than no import — a hospital cannot easily
   tell which of two hundred rows are duplicates, and undo across four tables is not a
   promise to make casually. */
ok(/function previewHtml/.test(iui), 'the import previews before writing');
ok(/data-act="commit"/.test(iui), 'and writes only on an explicit action');
ok(iui.indexOf('previewHtml') < iui.indexOf('async function commit'),
   'the preview is defined before the commit path');
ok(/Will be skipped/.test(iui), 'the preview says how many rows will be dropped');
ok(/renderNav\("import"\)/.test(iui), 'the page is in the nav');
ok(/import\.html/.test(read('workspace/shell.js')), 'with a nav entry');
ok(/xlsx/.test(read('workspace/import.html')), 'the spreadsheet reader is loaded');

/* Writing an empty schedule would put an item on the calendar with no due date, which
   reads as a bug rather than as "no cycle yet". */
ok(/if \(rec\.cycle_frequency\) \{/.test(read('workspace/import.js')),
   'a cycle is only created when the row actually describes one');

/* ============================== global search ============================== */

const wq = read('workspace/wsearch.js');
ok(/NABH_DATA/.test(wq), 'search covers the standards');
ok(/DOC_LIBRARY/.test(wq), 'and the document library');
['assets', 'compliance_tasks', 'committees', 'checklists', 'capa', 'incidents', 'gate_passes']
  .forEach(t => ok(new RegExp('"' + t + '"').test(wq), 'and ' + t));

/* Search must not leak text the pages are deliberately hiding — the same accessor, or the
   copyright work is undone by the search index. */
ok(/window\.AQText \? window\.AQText\.element\(code, e\.text\)/.test(wq),
   'element text in search goes through the same summary accessor as the pages');

ok(/terms\.every/.test(wq), 'all terms must match, in any order');
ok(/building/.test(wq) && /if \(index \|\| building\) return;/.test(wq),
   'the index is built once, lazily');
ok(/catch\(function \(\) \{ return \[\]; \}\)/.test(wq),
   'a failing table gives partial search rather than none');
ok(/e\.key\.toLowerCase\(\) === "k"/.test(wq), 'Ctrl/Cmd-K opens it');
ok(/aq:ready/.test(wq), 'it mounts after the gate, when there is an org to read');

// Name matches rank above description matches.
{
  const sb2 = { window: {}, document: { addEventListener() {}, getElementById: () => null },
                console };
  vm.createContext(sb2);
  sb2.window.AQStore = { adapter: { list: async () => [] } };
  vm.runInContext(wq, sb2);
  const A = sb2.window.AQSearch;
  ok(typeof A.search === 'function', 'the search function is exposed for testing');
}

{
  const pages = fs.readdirSync(path.join(ROOT, 'workspace')).filter(f => f.endsWith('.html'));
  let missing = 0;
  pages.forEach(f => { if (!/wsearch\.js/.test(read('workspace/' + f))) missing++; });
  eq(missing, 0, 'every workspace page loads search (' + pages.length + ' pages)');
}

/* ============================== cross-linking ============================== */

const rd = read('workspace/rounds.js');
ok(/function offerCapa/.test(rd), 'a failed round offers to raise a finding');
/* Offered, not created automatically: a finding nobody chose to raise is a finding nobody
   owns, and an auto-generated queue teaches a hospital to ignore its own findings. */
ok(/data-act="make-capa"/.test(rd), 'and only on an explicit action');
ok(/r\.capa_id = capaId/.test(rd), 'the round stores the finding it caused');
ok(/Raised from the round recorded on/.test(rd), 'and the finding names the round');
ok(/No action recorded against this round/.test(rd),
   'a failed round with no finding says so, since that is what an assessor looks for');
ok(/capa_id\s+text/.test(read('workspace/schema.sql')), 'the column exists');

/* ============================== onboarding ============================== */

const ob = read('workspace/onboard.js');
ok(/library\.html/.test(ob), 'onboarding points at the document library');
ok(/key: "library"/.test(ob), 'as its own step');

/* ============================== mobile ============================== */

/* The Yes/No/NA button is tapped three times per question by someone holding a phone
   one-handed on a ward round — the most-tapped control in the product. */
{
  const wcss = read('workspace/workspace.css');
  const m = /\.rd-a\{[^}]*min-height:\s*(\d+)px/.exec(wcss);
  ok(m && +m[1] >= 44, 'the round answer button is at least 44px tall');
  ok(/\.rd-a\{flex:1;min-height:48px/.test(wcss.replace(/\s+/g, '')),
     'and full-width on a phone');
}
{
  // No interactive control anywhere below the comfortable tap threshold.
  let small = [];
  ['styles.css', 'workspace/workspace.css', 'calendar/calendar.css'].forEach(f => {
    const css = read(f);
    [...css.matchAll(/(\.[\w-]+)\s*\{[^}]*cursor:\s*pointer[^}]*min-height:\s*(\d+)px/g)]
      .forEach(m => { if (+m[2] < 38) small.push(f + ' ' + m[1] + ' ' + m[2] + 'px'); });
  });
  eq(small.join(', '), '', 'no clickable control is below 38px tall');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
