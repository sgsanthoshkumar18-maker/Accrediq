/* AQcredix — customer data export and the department dashboard.
 * Run: node tests/export-dash.test.js
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
const ex = read('workspace/data-export.js');
const dash = read('workspace/dashboard.js');
const css = read('workspace/workspace.css');

/* =========================== the data export =========================== */

/* A JSZip stand-in: only the sheet XML matters, not the compression. */
function Z() { this.f = {}; }
Z.prototype.file = function (n, c) { this.f[n] = c; return this; };
Z.prototype.folder = function (n) {
  const p = this;
  const o = { file: (a, b) => { p.f[n + '/' + a] = b; return o; }, folder: m => p.folder(n + '/' + m) };
  return o;
};
Z.prototype.generateAsync = function () { return Promise.resolve({ parts: this.f }); };

const rows = {
  incidents: [{ id: 'inc_1', occurred_on: '2026-08-01', type: 'Fall & slip', department: 'ICU',
                severity: 'Moderate', status: 'closed', element_code: 'PSQ.4.a',
                created_at: '2026-08-01T10:00:00Z' }],
  capa: [{ id: 'capa_1', title: 'Hand hygiene below target', status: 'open', department: 'IPC' }],
  rounds: [{ id: 'r1', checklist_id: 'chk_1', performed_on: '2026-08-10', score_pct: 67,
             passed: false, answers: { q1: 'yes', q2: 'no' } }],
  checklists: [{ id: 'chk_1', name: 'Hand hygiene round', department: 'IPC' }],
  assets: [{ id: 'a1', name: 'Defibrillator ICU-4', kind: 'equipment' }],
  asset_events: [{ id: 'e1', asset_id: 'a1', kind: 'calibration', performed_on: '2025-06-15',
                   certificate_no: 'C-991', result: 'pass' }]
};

const sb = {
  window: { JSZip: Z },
  document: { createElement: () => ({}), body: { appendChild() {}, removeChild() {} } },
  console
};
sb.window.AQStore = {
  adapter: {
    list: async t => {
      // One table deliberately fails, to prove the export degrades rather than aborts.
      if (t === 'documents') throw new Error('unavailable');
      return rows[t] || [];
    }
  }
};
vm.createContext(sb);
vm.runInContext(ex, sb);
const E = sb.window.AQDataExport;

/* Every org-scoped table a hospital fills must be in the export. A table left out is data
   the hospital cannot retrieve, which is the whole thing this feature exists to prevent. */
['incidents', 'capa', 'audits', 'committees', 'committee_meetings', 'compliance_tasks',
 'assets', 'asset_events', 'checklists', 'rounds', 'documents'].forEach(t => {
  ok(E.SHEETS.some(s => s.table === t), t + ' is included in the export');
});
E.SHEETS.forEach(s => {
  ok(s.cols && s.cols.length >= 3, s.table + ' exports enough columns to be useful');
});

let parts = null;
E.build('Test Hospital').then(r => { parts = r.parts; });

setTimeout(function () {
  ok(parts, 'the workbook builds');

  const sheetFiles = Object.keys(parts).filter(k => /worksheets\/sheet\d+\.xml$/.test(k));
  eq(sheetFiles.length, E.SHEETS.length + 1, 'a cover sheet plus one per table');

  const cover = parts['xl/worksheets/sheet1.xml'];
  ok(/Test Hospital/.test(cover), 'the cover names the organisation');

  /* One table failing must not lose the other ten. A hospital exporting because it is
     unhappy, or because IT asked, is exactly when a half-failure is least forgivable. */
  ok(/Could not be read/.test(cover), 'a failed table is reported on the cover, not thrown');
  const docIdx = E.SHEETS.findIndex(s => s.table === 'documents') + 2;
  ok(/could not be read/i.test(parts['xl/worksheets/sheet' + docIdx + '.xml']),
     'and its sheet says so rather than being absent');

  /* Ids resolved to names. An export full of "chk_m8x2p1" is technically complete and
     practically useless. */
  const rIdx = E.SHEETS.findIndex(s => s.table === 'rounds') + 2;
  ok(/Hand hygiene round/.test(parts['xl/worksheets/sheet' + rIdx + '.xml']),
     'a round names its checklist, not its id');
  const eIdx = E.SHEETS.findIndex(s => s.table === 'asset_events') + 2;
  ok(/Defibrillator ICU-4/.test(parts['xl/worksheets/sheet' + eIdx + '.xml']),
     'a calibration record names its equipment');

  // Booleans read as words, not "true".
  ok(/>No</.test(parts['xl/worksheets/sheet' + rIdx + '.xml']),
     'booleans export as Yes/No');

  /* Ampersands appear in real hospital data ("Fall & slip"); an unescaped one makes the
     file unopenable in Excel. */
  const all = Object.keys(parts).map(k => parts[k]).join('');
  eq(/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(all), false, 'no raw ampersand survives');

  /* Excel refuses sheet names over 31 characters or containing : \ / ? * [ ] */
  const names = [...(parts['xl/workbook.xml'].matchAll(/name="([^"]+)"/g))].map(m => m[1]);
  eq(names.filter(n => n.length > 31).length, 0, 'no sheet name exceeds 31 characters');
  eq(names.filter(n => /[:\\\/?*\[\]]/.test(n)).length, 0, 'and none contains a forbidden character');

  // Relationships must match the sheets actually written, or the file will not open.
  const rels = parts['xl/_rels/workbook.xml.rels'];
  eq((rels.match(/worksheets\/sheet\d+\.xml/g) || []).length, sheetFiles.length,
     'every sheet has a relationship');

  /* Values are written as inline STRINGS, including numbers: a reference like "2026-001"
     is not a number, and letting Excel decide turns some into dates and others into
     scientific notation, silently and differently per locale. */
  ok(/t="inlineStr"/.test(all), 'values are written as inline strings');
  eq(/<v>/.test(all), false, 'nothing is left for Excel to reinterpret');

  ok(/downloadJson/.test(ex), 'a JSON export exists alongside the workbook');
  ok(/document\.body\.appendChild\(a\)/.test(ex),
     'the download anchor is attached, which mobile browsers require');

  // Wired into the workspace, with JSZip available.
  const wsHtml = read('workspace/workspace.html');
  ok(/data-export\.js/.test(wsHtml), 'the export script is loaded');
  ok(/jszip/i.test(wsHtml), 'and so is the spreadsheet engine');
  ok(/wsExportAll/.test(read('workspace/readiness.js')), 'the button exists');
  /* W.org() does not exist; calling it would have thrown inside the try and reported
     "Could not build" for a working export. */
  /* Strip comments first — the assertion fired on the comment explaining the very thing
     it forbids, which is a false positive rather than a finding. */
  const readinessCode = read('workspace/readiness.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  eq(/W\.org\(\)/.test(readinessCode), false,
     'the org name is read from a property that exists');
  ok(/W\.user && \(W\.user\.org_name/.test(readinessCode), 'and it comes from the member row');

  /* =========================== the dashboard =========================== */

  ok(/AQSchedule/.test(dash), 'the dashboard uses the shared schedule engine');
  eq(/new Date\([^)]*\)\s*[-+]/.test(dash), false, 'and does no date arithmetic of its own');

  /* It aggregates all three engines. A department head does not care which table a job
     came from, only when it was due. */
  ['compliance_tasks', 'asset_schedules', 'checklists', 'capa', 'incidents'].forEach(t => {
    ok(new RegExp('"' + t + '"').test(dash), 'the dashboard reads ' + t);
  });
  ok(/function dueItems/.test(dash), 'and merges them into one due list');
  ok(/rank\[a\.st\.state\] - rank\[b\.st\.state\]/.test(dash), 'sorted by how late they are');

  /* Committees are hospital-wide, so showing every one to the pharmacy would bury the
     four things the pharmacy actually owns. */
  ok(/if \(!dept\) \{[\s\S]{0,400}data\.committees/.test(dash),
     'committees appear only in the whole-hospital view');

  // One failing table must not blank the page a department head opened to find out what
  // is overdue.
  ok(/catch\(function \(\) \{ return \[\]; \}\)|catch\(function\s*\(\)\s*\{\s*return \[\];/.test(dash),
     'a missing table degrades to empty rather than erroring');

  // The chosen department is remembered per person, server-side.
  ok(/adapter\.upsert\("user_prefs"/.test(dash), 'the chosen department is saved');
  ok(/localStorage/.test(dash), 'with a cache so the page does not render the wrong one first');
  /* A department stored last session may no longer exist — a hospital renames a unit.
     Falling back is better than an empty page that looks broken. */
  ok(/departments\(\)\.indexOf\(dept\) < 0/.test(dash),
     'a department that no longer exists falls back to the whole hospital');

  // SOPs come from the assessor checklist scope, not a keyword guess.
  ok(/AUDIT_SCOPE/.test(dash), 'SOPs are scoped from the assessor checklist');
  ok(/e\.sop && codes\[code\]/.test(dash), 'and only asterisked elements are listed');
  ok(/scope-data\.js/.test(read('workspace/dashboard.html')), 'the scope data is loaded');

  ok(/W\.gate\(\)/.test(dash), 'the page is gated');
  ok(/renderNav\("dashboard"\)/.test(dash), 'and is in the workspace nav');
  ok(/dashboard\.html/.test(read('workspace/shell.js')), 'with a nav entry');

  // Classes must exist — the failure that made the calendar modals dead buttons.
  {
    const sheets = read('styles.css') + css + read('calendar/calendar.css');
    const used = new Set();
    let m; const re = /class="([^"]+)"/g;
    while ((m = re.exec(dash))) {
      m[1].split(/\s+/).forEach(c => {
        if (/^[a-zA-Z][\w-]*$/.test(c) && c !== 'false' && c !== 'true') used.add(c);
      });
    }
    const missing = [...used].filter(c => !new RegExp('\\.' + c + '(?![\\w-])').test(sheets));
    eq(missing.join(','), '', 'every class the dashboard renders is defined in CSS');
  }

  // No hardcoded colour in a media query — the site-wide rule.
  {
    let hard = 0;
    const tail = css.slice(css.indexOf('/* Department dashboard.'));
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
}, 20);
