/* AQcredix — value.html.
 *
 * This page tells a prospective subscriber what they get. Every number on it is therefore
 * a commercial promise, and the site sells under a no-refund policy — so an overstated
 * figure is not a cosmetic bug, it is a dispute the business cannot win.
 *
 * These tests exist to keep two properties true:
 *   1. No count is hardcoded. Every figure must come from AUDIT_SCOPE or DOC_LIBRARY.
 *   2. The "full field lists" figure is always shown apart from the document total, so
 *      "114 documents" can never be read as 114 finished documents.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

/* Render the page the way a browser would: real data files, a stub document. */
function render() {
  const els = {};
  const sandbox = {
    window: {},
    document: {
      readyState: 'complete',
      getElementById: id => (els[id] = els[id] || { id, innerHTML: '' }),
      addEventListener: () => {}
    }
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  ['audit/scope-data.js', 'workspace/library-data.js', 'value/value-view.js']
    .forEach(f => vm.runInContext(read(f), sandbox, { filename: f }));
  return { html: els.vlBody.innerHTML, win: sandbox.window };
}

console.log('value-page');

const { html, win } = render();

check('renders one card per department in scope', () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read('audit/scope-data.js'), sandbox);
  const n = Object.keys(sandbox.window.AUDIT_SCOPE).length;
  const cards = (html.match(/class="vl-card"/g) || []).length;
  assert.strictEqual(cards, n, 'expected ' + n + ' cards, rendered ' + cards);
});

check('headline totals match the source data', () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read('audit/scope-data.js'), sandbox);
  vm.runInContext(read('workspace/library-data.js'), sandbox);
  const S = sandbox.window.AUDIT_SCOPE;
  const L = sandbox.window.DOC_LIBRARY;
  const els = Object.keys(S).reduce((n, k) =>
    n + (S[k].codes || S[k].elements || []).length, 0);
  const detailed = L.filter(d => d.detailed).length;

  assert.ok(html.includes('<b>' + Object.keys(S).length + '</b><span>departments in scope</span>'),
    'department total not rendered from data');
  assert.ok(html.includes('<b>' + els + '</b><span>element checks mapped</span>'),
    'element total not rendered from data');
  assert.ok(html.includes('<b>' + L.length + '</b><span>documents in the library</span>'),
    'document total not rendered from data');
  assert.ok(html.includes('<b>' + detailed + '</b><span>with full field lists</span>'),
    'detailed total not rendered from data');
  assert.ok(detailed < L.length,
    'if every document is detailed this test needs revisiting, not deleting');
});

/* The whole point of the page. A department whose documents are all standard templates
   must say so, not report a bare total that reads as finished work. */
check('departments with no detailed documents say so', () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read('workspace/library-data.js'), sandbox);
  vm.runInContext(read('audit/scope-data.js'), sandbox);
  vm.runInContext(read('value/value-view.js'), Object.assign(sandbox, {
    document: { readyState: 'loading', getElementById: () => null, addEventListener: () => {} }
  }));
  const V = sandbox.window.AQValue;
  assert.ok(V && V.docsFor, 'AQValue.docsFor not exported');

  // CSSD has registers in the library but none detailed — the case this guards.
  const cssd = V.docsFor('cssd');
  assert.ok(cssd.total > 0, 'expected CSSD to have mapped documents');
  assert.strictEqual(cssd.detailed, 0,
    'CSSD now has detailed docs; pick another zero-detailed department for this test');
  assert.ok(/standard templates, full field lists in progress/.test(html),
    'a department with zero detailed documents must say its documents are templates');
});

check('detailed count is never presented alone as the total', () => {
  // Every rendered document line that quotes a total also quotes the detailed figure
  // or explicitly flags the templates.
  const lines = html.match(/<div class="vl-docs">[\s\S]*?<\/div>/g) || [];
  assert.ok(lines.length > 0, 'no document lines rendered');
  lines.forEach(l => {
    if (!/<b>\d+<\/b> documents/.test(l)) return;
    assert.ok(/full field lists/.test(l),
      'a document total was shown without the field-list qualification: ' + l.slice(0, 120));
  });
});

check('no hardcoded counts in the page markup', () => {
  const page = read('value.html');
  // The prose may name features, but must not assert a countable figure that could drift.
  const bad = page.match(/\b\d{2,}\s+(documents|elements|departments|checklists|registers|forms)\b/gi);
  assert.ok(!bad, 'hardcoded counts in value.html: ' + (bad || []).join(', '));
});

check('every pitch maps to a real department key', () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read('audit/scope-data.js'), sandbox);
  const keys = Object.keys(sandbox.window.AUDIT_SCOPE);
  const stray = Object.keys(win.AQValue.PITCH).filter(k => keys.indexOf(k) < 0);
  assert.strictEqual(stray.length, 0, 'pitch written for unknown departments: ' + stray.join(', '));
});

check('every library mapping names a real library department', () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read('workspace/library-data.js'), sandbox);
  const depts = new Set(sandbox.window.DOC_LIBRARY.map(d => d.department));
  const stray = [];
  Object.keys(win.AQValue.LIB_FOR).forEach(k => {
    win.AQValue.LIB_FOR[k].forEach(n => { if (!depts.has(n)) stray.push(k + ' -> ' + n); });
  });
  assert.strictEqual(stray.length, 0, 'mappings to non-existent library departments: ' + stray.join(', '));
});

check('page is free to read and wired into nav, footer and sitemap', () => {
  const page = read('value.html');
  assert.ok(/data-access="free"/.test(page), 'value.html should be readable without a plan');
  const app = read('app.js');
  assert.ok(/href: "value\.html"/.test(app), 'value.html missing from the nav');
  assert.ok(/\$\{base\}value\.html/.test(app), 'value.html missing from the footer');
  assert.ok(read('sitemap.xml').includes('/value.html'), 'value.html missing from the sitemap');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('value-page: all passed');
