/* AQcredix — notifications, onboarding, attachments.
 * Run: node tests/notify.test.js
 */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function eq(g, w, m) {
  if (g === w) pass++;
  else { fail++; console.log('FAIL: ' + m + ' - got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sql = read('workspace/schema.sql');

const K = require('../calendar/schedule.js');
const D = require('../workspace/digest.js');

/* ============================== the digest ==============================
   Run for real, not asserted on source. This is the one piece of logic all three
   surfaces share — the bell, the email and the dashboard. */

const data = {
  tasks: [{ id: 't1', title: 'Hand hygiene audit', department: 'Infection Control',
            frequency: 'monthly', last_done_on: '2026-06-01', element_code: 'IPC.2.c', active: true },
          { id: 't2', title: 'Fire drill', department: 'Facilities',
            frequency: 'half_yearly', last_done_on: '2026-05-01', active: true }],
  assets: [{ id: 'a1', name: 'Defibrillator ICU-4', department: 'Biomedical', status: 'active' }],
  schedules: [{ id: 's1', asset_id: 'a1', kind: 'calibration', frequency: 'yearly',
                last_done_on: '2025-06-15', active: true }],
  events: [], lists: [], rounds: [],
  committees: [{ id: 'c1', name: 'Infection Control Committee', frequency: 'quarterly',
                 last_met_on: '2026-01-10', active: true }],
  meetings: [],
  capa: [{ id: 'x1', title: 'Low compliance', status: 'open', department: 'Biomedical' }]
};

const all = D.build(K, data, { today: '2026-08-12' });
ok(all.counts.overdue >= 2, 'the digest finds overdue items across engines');
ok(all.overdue.some(i => i.kind === 'Equipment'), 'including equipment');
ok(all.overdue.some(i => i.kind === 'Task'), 'and recurring tasks');
eq(all.counts.findings, 1, 'and counts open findings');

/* Committees are hospital-wide. Sending every committee to the pharmacy's engineer buries
   the four things they own, and they stop reading — which costs more than it gains. */
ok(all.overdue.concat(all.soon).some(i => i.kind === 'Committee') ||
   all.never.some(i => i.kind === 'Committee'),
   'committees appear in the whole-hospital digest');
const bio = D.build(K, data, { today: '2026-08-12', department: 'Biomedical' });
eq(bio.overdue.concat(bio.soon, bio.never).filter(i => i.kind === 'Committee').length, 0,
   'but never in a department digest');
eq(bio.department, 'Biomedical', 'the department is carried through');
ok(bio.counts.overdue < all.counts.overdue, 'a department digest is narrower than the hospital one');

/* "Nothing to say" must be its own state. A digest that emails "0 overdue" every Monday
   teaches people to filter it into a folder they never open. */
const none = D.build(K, {}, { today: '2026-08-12' });
eq(none.empty, true, 'an empty digest knows it is empty');
eq(D.summarise(none), 'Nothing overdue', 'and says so plainly');
ok(/overdue/.test(D.summarise(all)), 'a full digest leads with the overdue count');

// Sorted by lateness, so the worst thing is first in an email preview pane.
const days = all.overdue.map(i => i.days);
eq(days.slice().sort((a, b) => a - b).join(','), days.join(','), 'overdue items are sorted by lateness');

/* schedule.js must work in BOTH modes: the browser reads a global, the serverless function
   requires it. A second server-side implementation of "overdue" would eventually disagree
   with the app, and the hospital would act on whichever they happened to open. */
ok(typeof K.nextDates === 'function', 'the schedule engine can be required in Node');
{
  const sandboxed = {};
  const vm = require('vm');
  const sb = { window: sandboxed, module: undefined };
  vm.createContext(sb);
  vm.runInContext(read('calendar/schedule.js'), sb);
  ok(typeof sandboxed.AQSchedule.nextDates === 'function', 'and still works as a browser global');
}

/* ============================== notifications ============================== */

const bell = read('workspace/bell.js');
const api = read('api/digest.js');

ok(/create table if not exists public\.notify_prefs/.test(sql), 'notify_prefs exists');
ok(/create policy notify_prefs_rw[\s\S]{0,120}user_id = auth\.uid\(\)/.test(sql),
   'notification preferences are private to the user');

ok(/AQDigest/.test(bell), 'the bell uses the shared digest engine');
ok(/adapter\.upsert\("notify_prefs"/.test(bell), 'preferences are saved server-side');
/* The bell must work with no mail provider configured. A feature inert until an API key is
   added is a feature nobody sees. */
eq(/RESEND|resend/.test(bell), false, 'the bell needs no external service');
ok(/aq:ready/.test(bell) && /aq:ready/.test(read('workspace/shell.js')),
   'the bell waits for the gate, since before sign-in there is no org to read');
ok(/window\.AQWorkspace && window\.AQWorkspace\.user\) init\(\)/.test(bell),
   'and still initialises if the event already fired');

/* The dot returns when the SITUATION changes, not on a timer — so dismissing it means "I
   have seen this" and a new overdue item next week brings it back on its own. */
ok(/function signature/.test(bell), 'unseen state is keyed on what is outstanding');
ok(/counts\.overdue, digest\.counts\.never/.test(bell), 'not on a timestamp');

// The email endpoint.
ok(/SUPABASE_SERVICE_KEY/.test(api), 'the digest job uses a service key');
ok(/CRON_SECRET/.test(api), 'and is guarded by a shared secret');
ok(/req\.method !== "POST"/.test(api), 'GET cannot trigger a send');
ok(/configured: false/.test(api), 'it reports plainly when not configured rather than failing');
ok(/if \(digest\.empty\) \{ quiet\+\+; continue; \}/.test(api),
   'nobody is emailed to be told nothing is wrong');
/* Without last_sent_on an hourly cron sends twenty-four identical emails, which is the
   fastest possible way to make someone switch the digest off for good. */
ok(/p\.last_sent_on === iso/.test(api), 'an email is sent at most once a day');
ok(/Number\(p\.digest_dow\) !== dow/.test(api), 'and only on the chosen day');
ok(/require\("\.\.\/calendar\/schedule\.js"\)/.test(api), 'it shares the app scheduling code');
ok(/require\("\.\.\/workspace\/digest\.js"\)/.test(api), 'and the app digest code');

/* ============================== onboarding ============================== */

const ob = read('workspace/onboard.js');
ok(/create table if not exists public\.onboarding/.test(sql), 'onboarding state is stored');
ok(/org_id\s+uuid primary key/.test(sql.slice(sql.indexOf('public.onboarding'))),
   'per org, so it survives the person who started it leaving');

/* Steps are marked done by DETECTING REAL DATA. A checklist completable without doing the
   work teaches people the checklist is the work — the habit this platform argues against. */
ok(/done: function \(c\) \{ return c\.\w+ > 0; \}/.test(ob),
   'steps complete from real records, not a tick');
eq(/dismissed: true[\s\S]{0,200}steps:/.test(ob), false, 'nothing marks a step done directly');
ok(/W\.user && W\.user\.org_id/.test(ob), 'dismissal is stored against the org');
ok(/p\.done === p\.total/.test(ob), 'the panel disappears once setup is finished');
ok(/id="onboard"/.test(read('workspace/workspace.html')), 'and it has a slot on the landing page');
ok(/onboard\.js/.test(read('workspace/workspace.html')), 'with the script loaded');

/* ============================== attachments ============================== */

const att = read('workspace/attach.js');
ok(/create table if not exists public\.attachments/.test(sql), 'attachment metadata is stored');
ok(/entity_table text not null/.test(sql), 'each file knows the record it evidences');

/* A public bucket would make every hospital's incident photographs and credential scans
   readable by anyone who guessed a path — the worst possible failure for this product. */
ok(/storage\/v1\/object\/sign/.test(att), 'links are signed, not public');
ok(/expiresIn: 120/.test(att), 'and short-lived');
eq(/getPublicUrl|\/public\//.test(att), false, 'no public URL is ever produced');

/* The filename is not the path: two people uploading "certificate.pdf" would collide, and
   a name containing a slash would escape the folder. */
ok(/function pathFor/.test(att), 'a safe storage path is generated');
{
  const vm = require('vm');
  const sb = { window: {}, console };
  vm.createContext(sb);
  vm.runInContext(att, sb);
  const A = sb.window.AQAttach;
  const ORG = '6f1c2d3e-1111-2222-3333-444455556666';
  const p1 = A.pathFor('asset_events', 'e1', 'certificate.pdf', ORG);
  const p2 = A.pathFor('asset_events', 'e1', 'certificate.pdf', ORG);
  ok(p1 !== p2, 'two identical filenames do not collide');
  ok(/\.pdf$/.test(p1), 'the extension is preserved');
  eq(/\.\./.test(A.pathFor('x', '../../etc', 'a.pdf', ORG)), false, 'a traversal attempt is stripped');
  eq(A.pathFor('a/b', 'c d', 'x.PDF', ORG).includes(' '), false, 'and so is whitespace');

  /* THE ORG IS THE FIRST PATH SEGMENT. That leading folder is what the Storage policies
     check; without it a private bucket still lets any signed-in subscriber fetch any
     other hospital's incident photographs, knowing the path. */
  eq(p1.split('/')[0], ORG, 'the path begins with the org id');
  eq(A.pathFor('x', 'y', 'a.pdf', '../../other').indexOf('..'), -1,
     'and a forged org cannot climb out of the folder');

  // Narrow by design: executables and archives have no business in a compliance record.
  ok(A.ALLOWED['application/pdf'], 'PDFs are accepted');
  ok(A.ALLOWED['image/jpeg'], 'and photographs');
  eq(A.ALLOWED['application/x-msdownload'], undefined, 'executables are not');
  eq(A.ALLOWED['application/zip'], undefined, 'nor archives');
  eq(A.MAX, 10 * 1024 * 1024, 'the size limit is 10 MB');
}

/* A row pointing at a file that is not there shows a broken link in an evidence list,
   which is worse than an orphaned object nobody can reach. */
ok(/adapter\.remove\("attachments"/.test(att), 'the row is removed even if the object delete failed');

/* Storage has its own RLS, entirely separate from the table policies. A private bucket
   stops the anonymous public; it does NOT stop one hospital reading another's objects. */
ok(/storage\.foldername\(name\)\)\[1\] = public\.my_org\(\)::text/.test(sql),
   'storage policies scope objects to the org folder');
['evidence_read', 'evidence_write', 'evidence_update', 'evidence_delete'].forEach(pol => {
  ok(new RegExp(pol).test(sql), pol + ' policy exists');
});
ok(/for insert to authenticated[\s\S]{0,200}public\.can_edit\(\)/.test(sql),
   'a viewer cannot upload');
ok(/information_schema\.tables[\s\S]{0,200}'storage'/.test(sql),
   'the block is skipped where Storage was never initialised, rather than failing the script');

/* And the metadata row is guarded too: a client could upload legitimately and then record
   a path pointing at another hospital's object. Storage would refuse the fetch, but the
   filename alone leaks more than it should. */
ok(/aq_guard_attachment_path/.test(sql), 'attachment paths are verified server-side');
ok(/split_part\(new\.path, '\/', 1\) <> want/.test(sql), 'against the writer\'s own org');
ok(/orgId\(\)/.test(att) && /W\.user\.org_id/.test(att),
   'the client reads the org from the signed-in member row, not from anything it can set');
ok(/not linked to a hospital yet/.test(att),
   'and refuses early with a message that says what is wrong');

['register.html', 'capa.html', 'incidents.html', 'rounds.html'].forEach(p => {
  ok(/attach\.js/.test(read('workspace/' + p)), p + ' can attach evidence');
});

// Schema order, the rule that broke a migration once already.
{
  const created = {};
  [...sql.matchAll(/create table if not exists public\.(\w+)/g)].forEach(m => {
    if (!(m[1] in created)) created[m[1]] = m.index;
  });
  let bad = 0;
  [...sql.matchAll(/foreach t in array array\[([^\]]+)\]/g)].forEach(m => {
    m[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean).forEach(t => {
      if (!(t in created) || created[t] > m.index) { bad++; console.log('  order bug: ' + t); }
    });
  });
  eq(bad, 0, 'every loop still references tables already created');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
