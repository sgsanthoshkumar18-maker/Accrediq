/* AQcredix — asset register, PM/calibration scheduling, and the pinned landing page.
 * Run: node tests/register.test.js
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
const sql = read('workspace/schema.sql');
const reg = read('workspace/register.js');
const pin = read('workspace/pin.js');
const html = read('workspace/register.html');

/* ------------------------------- the schema ------------------------------- */

['assets', 'asset_schedules', 'asset_events', 'user_prefs'].forEach(t => {
  ok(new RegExp('create table if not exists public\\.' + t).test(sql), t + ' exists');
});

/* One table with a `kind`, not ten department tables. Ten would be ten things to maintain
   and ten chances to get a hospital's local practice wrong. */
ok(/kind\s+text not null default 'equipment'/.test(sql), 'one register covers every kind of item');
['equipment', 'licence', 'contract', 'credential', 'reagent', 'software'].forEach(k => {
  ok(new RegExp(k).test(sql.slice(sql.indexOf('create table if not exists public.assets'))),
     'the register covers ' + k);
});

/* Schedules hang off the ASSET, not off compliance_tasks: an assessor asks for the
   calibration history of a named machine, not of the lab in general. */
ok(/asset_id\s+text references public\.assets\(id\) on delete cascade/.test(sql),
   'schedules belong to a specific item');
ok(/certificate_no/.test(sql), 'events keep the certificate number an assessor asks for');
ok(/downtime_hours/.test(sql), 'and downtime, which is the KPI behind them');

// Org-scoped tables must join the RLS and org-stamping loops or they are unreachable.
['assets', 'asset_schedules', 'asset_events'].forEach(t => {
  const loops = sql.match(/foreach t in array array\[[^\]]*\]/g) || [];
  ok(loops.filter(l => l.includes("'" + t + "'")).length >= 2,
     t + ' is in both the RLS and org-stamping loops');
});

/* user_prefs is keyed on auth.uid() ONLY — never on org. A pinned landing page is a
   personal choice and a colleague has no business reading or changing it. */
ok(/create policy user_prefs_rw on public\.user_prefs for all\s*\n\s*using \(user_id = auth\.uid\(\)\)/.test(sql),
   'preferences are private to the user');
eq(/user_prefs[\s\S]{0,400}my_org\(\)/.test(sql), false, 'and are not org-scoped');

/* ------------------------------- the register ------------------------------- */

ok(/AQSchedule/.test(reg), 'the register uses the shared schedule engine');
eq(/new Date\([^)]*\)\s*[-+]/.test(reg), false, 'and does no date arithmetic of its own');

/* Every control must persist. A button that does not write is worse than no button: it
   teaches the user the product forgets. */
['assets', 'asset_schedules', 'asset_events'].forEach(t => {
  ok(new RegExp('adapter\\.upsert\\("' + t + '"').test(reg), t + ' is written to the server');
  ok(new RegExp('adapter\\.list\\("' + t + '"').test(reg), 'and read back from it');
});
eq(/localStorage/.test(reg), false, 'nothing is kept only in the browser');

// Recorded events beat the typed date, and the two are kept in step.
ok(/function lastDone/.test(reg), 'the last event is derived, not just read from a field');
ok(/sc\.last_done_on = on/.test(reg), 'and the stored field is updated to match');

// Soft delete: records against a condemned machine must still be produceable.
ok(/row\.status = "condemned"/.test(reg), 'removing an item is a soft delete');
eq(/adapter\.delete/.test(reg), false, 'nothing is hard-deleted');

// Department filtering is what makes this usable by a department rather than only by the
// quality manager.
ok(/deptFilter/.test(reg) && /regDept/.test(reg), 'the register filters by department');
ok(/kindFilter/.test(reg), 'and by cycle type');

// The page is gated and registered like every other workspace page.
ok(/W\.gate\(\)/.test(reg), 'the page is gated');
ok(/renderNav\("register"\)/.test(reg), 'and appears in the workspace nav');
ok(/register\.html/.test(read('workspace/shell.js')), 'with a nav entry pointing to it');
eq((html.match(/<body/g) || []).length, 1, 'the page has one body tag');

// Classes must exist, the failure that made the calendar modals dead buttons.
{
  const wcss = read('styles.css') + read('workspace/workspace.css') + read('calendar/calendar.css');
  const used = new Set();
  let m; const re = /class="([^"]+)"/g;
  while ((m = re.exec(reg))) {
    m[1].split(/\s+/).forEach(c => { if (/^[a-zA-Z][\w-]*$/.test(c)) used.add(c); });
  }
  const missing = [...used].filter(c => !new RegExp('\\.' + c + '(?![\\w-])').test(wcss));
  eq(missing.join(','), '', 'every class the register renders is defined in CSS');
  ok(/classList\.add\("open"\)/.test(reg), 'and the modal uses the class the stylesheet keys on');
}

/* --------------------------------- the pin --------------------------------- */

/* Server-backed, so the pin follows the person to a ward tablet or a home laptop. */
ok(/adapter\.upsert\("user_prefs"/.test(pin), 'the pin is stored on the server');
ok(/adapter\.list\("user_prefs"\)/.test(pin), 'and read back on sign-in');
/* The cache exists so the redirect can happen before the network answers — a sign-in that
   waits on a round-trip before deciding where to go feels broken. */
ok(/localStorage/.test(pin), 'with a local cache for an instant redirect');
ok(/cache\(v\)/.test(pin), 'and the server value is written back to it');

// Path only: a full URL would pin the deployment it was set on.
ok(/location\.pathname\.replace/.test(pin), 'the pin stores a path, not a URL');
ok(/\^\[a-z0-9-\]\+\\\.html\$/.test(pin) || /\[a-z0-9-\]\+\\\.html/.test(pin),
   'a stored value is validated before being followed');

/* The redirect fires on the landing page ONLY. Anywhere else it would fight the person's
   own navigation — clicking Audit and being thrown to the register feels possessed. */
ok(/workspace\\\.html\$\/\.test\(location\.pathname\)/.test(pin),
   'the redirect only runs on the workspace landing page');

/* And there must be an escape hatch, or a pinned page makes the landing page unreachable
   because clicking Readiness bounces straight back. */
ok(/get\("stay"\)/.test(pin), 'an explicit ?stay=1 defeats the redirect');
ok(/workspace\.html\?stay=1/.test(read('workspace/shell.js')),
   'and the Readiness nav link carries it');

// The control is on every workspace page, and states are distinguishable.
{
  const pages = fs.readdirSync(path.join(ROOT, 'workspace')).filter(f => f.endsWith('.html'));
  let missing = 0;
  pages.forEach(f => {
    const h = read('workspace/' + f);
    if (!/pin\.js/.test(h)) { missing++; console.log('  no pin.js in ' + f); }
  });
  eq(missing, 0, 'every workspace page loads the pin script (' + pages.length + ' pages)');
}
ok(/aria-pressed/.test(pin), 'the toggle announces its state');
ok(/\.ws-pin\.is-on/.test(read('workspace/workspace.css')), 'and pinned looks different');

/* ---------------------- schema ORDER, not just content ----------------------
   schema.sql runs top to bottom in one pass. Attaching a trigger requires the table to
   exist; defining the function does not. Adding `assets` to the authorship loop while
   creating the table further down failed the entire script with
     ERROR: relation "public.assets" does not exist
   and, because the file is idempotent and re-run every session, that breaks EVERY
   migration rather than just the new part. */
{
  const created = {};
  [...sql.matchAll(/create table if not exists public\.(\w+)/g)].forEach(m => {
    if (!(m[1] in created)) created[m[1]] = m.index;
  });

  let bad = 0;
  [...sql.matchAll(/foreach t in array array\[([^\]]+)\]/g)].forEach(m => {
    m[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean).forEach(t => {
      if (!(t in created)) { bad++; console.log('  loop names unknown table: ' + t); }
      else if (created[t] > m.index) {
        bad++; console.log('  loop uses ' + t + ' before it is created');
      }
    });
  });
  eq(bad, 0, 'every do-block loop references tables already created above it');

  /* ALTER TABLE was not checked by the first version of this test, and that is exactly how
     `alter table public.incidents` ended up above `create table public.incidents` — the
     whole script failed on a fresh project with
       ERROR: 42P01: relation "public.incidents" does not exist
     Every statement type that requires an existing table must be checked, not just loops. */
  /* FUNCTIONS USED BY POLICIES MUST BE DEFINED FIRST.
     `create policy` resolves function names at creation time. A plpgsql function BODY does
     not — it resolves at call time — so a helper called from inside another function may be
     defined later, but one called from a policy may not. Defining aq_is_owner() below the
     site_settings policies failed a fresh project with
       ERROR: 42883: function public.aq_is_owner() does not exist
     while passing on an existing project where the function was already present. */
  {
    const fnDef = {};
    [...sql.matchAll(/create or replace function public\.(\w+)/g)].forEach(m => {
      if (!(m[1] in fnDef)) fnDef[m[1]] = m.index;
    });
    // Blank out comments and function bodies so only executable references remain.
    let scan = sql.replace(/^--.*$/gm, m => ' '.repeat(m.length));
    [...scan.matchAll(/create or replace function[\s\S]*?\$\$;/g)].forEach(m => {
      scan = scan.slice(0, m.index) + ' '.repeat(m[0].length) + scan.slice(m.index + m[0].length);
    });
    let badFn = 0;
    [...scan.matchAll(/public\.(\w+)\s*\(/g)].forEach(m => {
      const fn = m[1];
      if (!(fn in fnDef)) return;
      if (m.index < fnDef[fn]) {
        badFn++;
        console.log('  ' + fn + ' is called before it is defined');
      }
    });
    eq(badFn, 0, 'every function called outside a function body is defined above that call');
  }

  /* EVERY TABLE MUST HAVE RLS ENABLED.
     This was a hand-written list of eight tables while the POLICY loops covered
     twenty-one. Every table added afterwards got policies that did nothing, because RLS
     was never switched on for it — fifteen tables were readable by any signed-in user of
     any hospital, and the schema ran without a single error. Two lists that must agree
     will eventually disagree; the enable is now a loop over the same list. */
  {
    const createdTables = [...sql.matchAll(/create table if not exists public\.(\w+)/g)]
      .map(m => m[1]);
    const explicit = [...sql.matchAll(/alter table public\.(\w+)\s+enable row level security/g)]
      .map(m => m[1]);
    const loopM = /foreach t in array array\[([^\]]*?)\] loop\s*\n\s*execute format\('alter table public\.%I enable row level security'/
      .exec(sql);
    const looped = loopM
      ? loopM[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean)
      : [];
    ok(looped.length > 15, 'RLS is enabled by a loop, not a hand-written list');

    const covered = new Set([...explicit, ...looped]);
    const noRls = createdTables.filter(t => !covered.has(t));
    eq(noRls.join(', '), '', 'every table created has RLS enabled (' +
       createdTables.length + ' tables)');

    /* And the enable list must match the policy list. A table with policies but no RLS is
       silently open; a table with RLS but no policy is silently locked. */
    /* Non-greedy AND anchored to the nearest loop: a greedy match spans from the RLS loop
       all the way to the policy loop and swallows everything between. */
    const policyLoop = /foreach t in array array\[([^\]]*?)\] loop\s*\n\s*execute format\('drop policy if exists %I_read/
      .exec(sql);
    if (policyLoop) {
      const polTables = policyLoop[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean);
      const noEnable = polTables.filter(t => !covered.has(t));
      eq(noEnable.join(', '), '', 'every table with policies also has RLS switched on');
    }
  }

  let badAlter = 0;
  [...sql.matchAll(/alter table (?:if exists )?public\.(\w+)/g)].forEach(m => {
    const t = m[1];
    if (created[t] === undefined) {
      badAlter++; console.log('  alter on unknown table: ' + t);
    } else if (created[t] > m.index) {
      badAlter++; console.log('  alter on ' + t + ' precedes its create table');
    }
  });
  eq(badAlter, 0, 'every ALTER TABLE comes after the table it alters');

  let badIdx = 0;
  [...sql.matchAll(/create index if not exists \w+\s+on public\.(\w+)/g)].forEach(m => {
    if (created[m[1]] !== undefined && created[m[1]] > m.index) {
      badIdx++; console.log('  index on ' + m[1] + ' precedes its table');
    }
  });
  eq(badIdx, 0, 'every index comes after its table');

  let badPol = 0;
  [...sql.matchAll(/create policy \w+ on public\.(\w+)/g)].forEach(m => {
    if (created[m[1]] !== undefined && created[m[1]] > m.index) {
      badPol++; console.log('  policy on ' + m[1] + ' precedes its table');
    }
  });
  eq(badPol, 0, 'every policy comes after its table');

  let badTrig = 0;
  [...sql.matchAll(/create trigger \w+ (?:before|after) \w+ on public\.(\w+)/g)].forEach(m => {
    if (created[m[1]] !== undefined && created[m[1]] > m.index) {
      badTrig++; console.log('  trigger on ' + m[1] + ' precedes its table');
    }
  });
  eq(badTrig, 0, 'every trigger is attached after its table exists');

  // The authorship loop specifically must be at the end, after the register tables.
  ok(sql.lastIndexOf("'assets','asset_events'") > sql.indexOf('create table if not exists public.assets'),
     'the authorship loop runs after the register tables are created');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
