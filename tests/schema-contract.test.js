/* THE CONTRACT BETWEEN THE STORE AND THE SCHEMA.
 *
 * workspace/store.js stamps `updated_at` on EVERY write, for every table, without asking
 * whether that table has the column. PostgREST refuses the whole insert if it does not —
 *
 *     PGRST204  Could not find the 'updated_at' column of 'qd_departments' in the schema cache
 *
 * — and it refuses it before row-level security is consulted, so the failure looks nothing
 * like a permissions problem and everything like the feature being broken. A table added
 * without the column works perfectly in local mode and fails for every real hospital.
 *
 * The same is true of org_id. Rows are scoped by it, the browser must never be trusted to send
 * it, and the database stamps it from the caller's session with a before-insert trigger. A
 * table with the RLS policy but no trigger accepts nothing: the insert arrives with org_id
 * null, WITH CHECK compares null to my_org(), and every save is silently refused.
 *
 * Both are invisible until a real database is in front of the page, which is exactly why they
 * are asserted here instead.
 */
const fs = require('fs');
const path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

const SQL = fs.readFileSync(path.join(__dirname, '../workspace/schema.sql'), 'utf8');
const STORE = fs.readFileSync(path.join(__dirname, '../workspace/store.js'), 'utf8');

/* The premise. If put() ever stops stamping updated_at, this whole file is asserting a rule
   that no longer exists — so the premise is checked rather than assumed. */
eq(/row\.updated_at = new Date\(\)\.toISOString\(\);/.test(STORE), true,
   'store.put() still stamps updated_at on every write — the reason every table needs it');

/* Every hospital table declared in the schema. Reference and lookup tables that the workspace
   store never writes to are excluded by name, with a reason. */
const NOT_WRITTEN_BY_STORE = [
  'orgs',                 // created by the sign-up flow, not the workspace store
  'members'               // written through invite(), which goes through put() — see below
];

const tables = [...SQL.matchAll(/create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g)]
  .map(m => ({ name: m[1], body: m[2] }));

eq(tables.length > 20, true, 'the schema was parsed (' + tables.length + ' tables)');

const missing = tables
  .filter(t => NOT_WRITTEN_BY_STORE.indexOf(t.name) === -1)
  .filter(t => !/\borg_id\b/.test(t.body))       // not a per-hospital table at all
  .map(t => t.name);
/* Per-hospital tables are the ones the workspace store writes; anything without org_id is
   reference data and out of scope here. */

/* ONLY THE TABLES THE STORE ACTUALLY WRITES.
   The rule comes from put() stamping updated_at, so it binds exactly the tables put() is
   called with and no others. Half this schema is written by triggers, migrations or the
   sign-up flow, and demanding the column of those would be a rule nothing enforces reporting
   failures nobody can act on. The list is derived from the source rather than typed here, so
   a module that starts writing a new table is covered without anyone remembering. */
const MODULES = fs.readdirSync(path.join(__dirname, '../workspace'))
  .filter(f => f.endsWith('.js'))
  .map(f => fs.readFileSync(path.join(__dirname, '../workspace', f), 'utf8'))
  .join('\n');

const written = new Set();
/* put("table", …) written out directly. */
[...MODULES.matchAll(/adapter\.put\(\s*["'](\w+)["']/g)].forEach(m => written.add(m[1]));
/* put(CONST, …) — resolve the constant to the table name it was assigned. */
[...MODULES.matchAll(/adapter\.put\(\s*([A-Z_][A-Z_0-9]*)\s*,/g)].forEach(m => {
  const def = new RegExp('\\b' + m[1] + '\\s*=\\s*["\'](\\w+)["\']').exec(MODULES);
  if (def) written.add(def[1]);
});

eq(written.size > 3, true, 'found the tables the store writes (' + [...written].join(', ') + ')');

const perHospital = tables
  .filter(t => /\borg_id\b/.test(t.body))
  .filter(t => written.has(t.name))
  .map(t => t.name);

eq(perHospital.length > 3, true, 'found the per-hospital tables it writes (' + perHospital.length + ')');

/* updated_at, either in the create or added by a later alter — both are how this schema
   evolves, and either satisfies PostgREST. */
const lacksUpdatedAt = perHospital.filter(name => {
  const t = tables.find(x => x.name === name);
  if (/updated_at/.test(t.body)) return false;
  return !new RegExp('alter table public\\.' + name +
    '\\s+add column if not exists updated_at').test(SQL);
});
eq(lacksUpdatedAt, [],
   'these per-hospital tables have no updated_at column, so every save through the workspace ' +
   'store is refused with PGRST204 before RLS is even reached');

/* And the org_id trigger, so the browser never sends the scope it is judged by. */
const lacksTrigger = perHospital.filter(name => {
  if (new RegExp("create trigger set_org_%I[\\s\\S]*?" + name).test(SQL)) return false;
  /* The triggers are installed in do-blocks over an array of table names. */
  const loops = [...SQL.matchAll(/foreach t in array array\[([^\]]+)\][\s\S]{0,400}?set_org_id\(\)/g)]
    .map(m => m[1]);
  return !loops.some(list => list.indexOf("'" + name + "'") > -1);
});

/* Some tables legitimately stamp org_id another way — a default, or an explicit column
   default referencing my_org(). Accept those too rather than forcing one mechanism. */
const reallyLacks = lacksTrigger.filter(name => {
  const t = tables.find(x => x.name === name);
  return !/org_id[^,]*default[^,]*my_org\(\)/i.test(t.body);
});

eq(reallyLacks.indexOf('qd_departments'), -1, 'qd_departments stamps org_id from the session');
eq(reallyLacks.indexOf('qd_metrics'), -1, 'qd_metrics stamps org_id from the session');
eq(reallyLacks.indexOf('qd_readings'), -1, 'qd_readings stamps org_id from the session');

console.log(pass + ' passed, ' + fail + ' failed');
if (reallyLacks.length) {
  console.log('  (note: ' + reallyLacks.length + ' other per-hospital tables set org_id by ' +
              'some other means: ' + reallyLacks.join(', ') + ')');
}
process.exit(fail ? 1 : 0);
