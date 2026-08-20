/* AQcredix — department isolation.
 *
 * A hospital buys one subscription and every department works inside it. Biomedical must
 * not read HR's personal files. That is a claim made to a hospital director at the point
 * of sale, which makes it a contractual statement rather than a nicety — and it is
 * enforced in Postgres, not in the browser, because a nav item that is merely hidden is
 * one network request away from being visible.
 *
 * The failure mode these tests exist for is silent. If a child table's policy is missed,
 * the parent row is correctly hidden, the screen looks right, and the child rows — the
 * calibration dates, the checklist answers, the document history — are served to anyone
 * who queries the API directly. Nothing in the UI would ever reveal it.
 *
 * This is the same shape as the RLS-enable gap that went unnoticed across two projects
 * until the Mumbai migration exposed it: two lists that must agree, that nobody diffs.
 * So this file enumerates the tables from the schema itself rather than from a list
 * written here.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SQL = fs.readFileSync(path.join(ROOT, 'workspace/schema.sql'), 'utf8');

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

console.log('department-isolation');

/* Tables that hold department-owned records. If one of these gains a policy without a
   department clause, the isolation promise is false for that table. */
const DEPT_SCOPED = ['capa', 'documents', 'audits', 'compliance_tasks',
                     'assets', 'checklists', 'gate_passes'];

/* Children whose department comes from a parent row. Each needs a subquery, not a
   column reference — this is where a miss is invisible. */
const CHILD_OF = {
  asset_schedules: 'assets',
  asset_events: 'assets',
  checklist_items: 'checklists',
  rounds: 'checklists',
  document_versions: 'documents'
};

/* Genuinely hospital-wide. A department clause here would be a bug, not extra safety:
   a committee only its chair's department could see is not a committee. */
const ORG_WIDE = ['elements', 'committees', 'committee_meetings',
                  'notifications', 'onboarding', 'apex_manual', 'trials'];

check('the three scoping functions exist', () => {
  ['my_dept', 'sees_all_depts', 'dept_visible'].forEach(f => {
    assert.ok(new RegExp('function public\\.' + f + '\\b').test(SQL),
      'public.' + f + '() is missing');
  });
});

check('owners and admins see all departments by role, not by flag', () => {
  const fn = SQL.split('function public.sees_all_depts()')[1].split('$$;')[0];
  assert.ok(/role in \('owner','admin'\)/.test(fn),
    'an admin who cleared their own flag would lock the hospital out of its own data');
  assert.ok(/all_departments\s*=\s*true/.test(fn), 'the explicit flag is not honoured');
});

check('untagged rows stay visible hospital-wide', () => {
  const fn = SQL.split('function public.dept_visible(')[1].split('$$;')[0];
  assert.ok(/row_dept is null/.test(fn),
    'rows with no department must not vanish — failing closed here silently loses records');
});

check('every department-scoped table filters on department', () => {
  const loop = SQL.split('DEPARTMENT-SCOPED tables')[1].split('end $$;')[0];
  DEPT_SCOPED.forEach(t => {
    assert.ok(new RegExp("'" + t + "'").test(loop),
      t + ' is not in the department-scoped policy loop');
  });
  assert.ok(/dept_visible\(department\)/.test(loop),
    'the department-scoped loop does not call dept_visible');
});

check('every child table reaches its parent department', () => {
  Object.keys(CHILD_OF).forEach(child => {
    const parent = CHILD_OF[child];
    const read = SQL.match(
      new RegExp('create policy ' + child + '_read[\\s\\S]*?;', 'm'));
    assert.ok(read, child + '_read policy is missing entirely');
    assert.ok(new RegExp('from public\\.' + parent + '\\b').test(read[0]),
      child + '_read must reach ' + parent + ' for its department');
    assert.ok(/dept_visible\(/.test(read[0]),
      child + '_read has a parent subquery but never checks dept_visible');

    const write = SQL.match(
      new RegExp('create policy ' + child + '_write[\\s\\S]*?with check[\\s\\S]*?;', 'm'));
    assert.ok(write, child + '_write policy is missing');
    assert.ok(/dept_visible\(/.test(write[0]),
      child + '_write is unscoped — readable rows would still be writable across departments');
  });
});

check('hospital-wide tables are deliberately not scoped', () => {
  // Both loops live in the same do-block, so slice at the next loop's banner rather than
  // at `end $$;` — otherwise this reads the department loop too and always "passes".
  const loop = SQL.split('HOSPITAL-WIDE tables')[1].split('DEPARTMENT-SCOPED tables')[0];
  ORG_WIDE.forEach(t => {
    assert.ok(new RegExp("'" + t + "'").test(loop), t + ' is missing from the org-wide loop');
  });
  assert.ok(!/dept_visible/.test(loop),
    'the org-wide loop must not filter by department');
});

/* No table may fall through both loops unnoticed. Any table that has RLS enabled but
   appears in neither list is one nobody decided about, and the default for an
   undecided table is the wrong one either way. */
check('no table is left out of both loops', () => {
  const enables = SQL.split('RLS is enabled by LOOP')[1].split('end $$;')[0];
  const listed = (enables.match(/'(\w+)'/g) || []).map(x => x.replace(/'/g, ''));
  const accounted = new Set([].concat(DEPT_SCOPED, ORG_WIDE,
    Object.keys(CHILD_OF), ['incidents', 'attachments']));
  const orphans = listed.filter(t => !accounted.has(t));
  assert.strictEqual(orphans.length, 0,
    'tables with RLS on but no decided scope: ' + orphans.join(', '));
});

/* ---- incidents: three-way visibility, by explicit decision ---- */

check('incidents carry a responsible department', () => {
  assert.ok(/responsible_department text/.test(SQL),
    'the responsible department column is missing');
  assert.ok(/add column if not exists responsible_department text/.test(SQL),
    'existing projects need an idempotent alter, not just a fresh-project column');
});

check('an incident is visible to reporter, responsible department and quality', () => {
  const p = SQL.match(/create policy incidents_read[\s\S]*?\);/)[0];
  assert.ok(/sees_all_depts\(\)/.test(p), 'quality must see every incident');
  assert.ok(/department = public\.my_dept\(\)/.test(p),
    'the reporting department must keep sight of what it raised');
  assert.ok(/responsible_department = public\.my_dept\(\)/.test(p),
    'the department that has to act on it must be able to see it');
});

check('anyone may report an incident regardless of department', () => {
  const p = SQL.match(/create policy incidents_write[\s\S]*?with check \([^;]*\);/)[0];
  const withCheck = p.split('with check')[1];
  assert.ok(!/my_dept\(\)/.test(withCheck),
    'insert must not be department-restricted — a nurse who spots a pharmacy error ' +
    'has to be able to say so');
});

/* ---- the member flag ---- */

check('members carry an all_departments flag, added idempotently', () => {
  assert.ok(/all_departments boolean not null default false/.test(SQL),
    'the flag is missing from the members table');
  assert.ok(/add column if not exists all_departments/.test(SQL),
    'the existing Mumbai project needs the alter, not just the create');
  assert.ok(/members_dept_idx/.test(SQL),
    'department lookups run on every query; they need an index');
});

check('the schema still parses and stays idempotent', () => {
  // Every policy created must first be dropped, or a second run of the file errors and
  // the session ends with a half-applied schema.
  const created = [...SQL.matchAll(/create policy (\w+)/g)].map(m => m[1]);
  const dropped = new Set([...SQL.matchAll(/drop policy if exists (\w+)/g)].map(m => m[1]));
  const missing = created.filter(c => !dropped.has(c));
  assert.strictEqual(missing.length, 0,
    'policies created without a matching drop: ' + missing.join(', '));
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('department-isolation: all passed');
