/* AQcredix — certificate expiry tracking (RNRM, TNPC, licences, AERB permits).
 *
 * The feature is a chain: a printed expiry date on a schedule row must drive the due
 * status in the register, appear in the calendar, and reach the monthly email. A break
 * anywhere in that chain is silent — the register looks right and the email never arrives,
 * or the email arrives and says a date nobody can act on.
 *
 * The failure that matters most is the inverted one: someone renews a registration, the
 * expiry does not move, and the calendar keeps saying overdue. Within two cycles nobody
 * believes the calendar. That case is tested explicitly below.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const K = require(path.join(ROOT, 'calendar/schedule.js'));
const D = require(path.join(ROOT, 'workspace/digest.js'));

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

console.log('certificate-expiry');

/* ---- the schedule engine ---- */

check('a printed expiry date drives the due date', () => {
  // Frequency says five-yearly and nothing was ever "performed", but the certificate
  // expires in ten days. That is due soon, not "never recorded".
  const st = K.status(null, 'yearly', '2026-08-20', '2026-08-30', 90);
  assert.strictEqual(st.state, 'soon', 'expected soon, got ' + st.state);
  assert.strictEqual(st.due, '2026-08-30');
});

check('an expired certificate reads as overdue', () => {
  const st = K.status(null, 'yearly', '2026-08-20', '2026-07-01', 90);
  assert.strictEqual(st.state, 'overdue');
  assert.ok(st.days < 0, 'overdue items must report negative days');
});

check('the ninety-day lead is honoured rather than a fifth of the cycle', () => {
  // 100 days out with a 90-day lead: not yet urgent.
  const far = K.status(null, 'yearly', '2026-08-20', '2026-11-28', 90);
  assert.strictEqual(far.state, 'ok', 'expected ok at 100 days, got ' + far.state);
  // 80 days out: inside the lead.
  const near = K.status(null, 'yearly', '2026-08-20', '2026-11-08', 90);
  assert.strictEqual(near.state, 'soon', 'expected soon at 80 days, got ' + near.state);
});

check('without an expiry the old cycle behaviour is unchanged', () => {
  // This is the regression guard: equipment calibration must not shift because
  // registrations were added.
  const a = K.status('2026-01-01', 'yearly', '2026-08-20');
  const b = K.status('2026-01-01', 'yearly', '2026-08-20', null, null);
  assert.deepStrictEqual(a, b, 'passing an explicit null lead changed the result');
  assert.strictEqual(a.state, 'ok');
});

/* ---- the digest ---- */

function digestWith(sched, today) {
  return D.build(K, {
    assets: [{ id: 'a1', name: 'Staff Nurse — A. Kumar', department: 'Human Resource Department',
               status: 'active', element_code: 'HRM.3' }],
    schedules: [Object.assign({ id: 's1', asset_id: 'a1', active: true }, sched)],
    events: []
  }, { today: today });
}

check('a registration reaches the digest as its own kind', () => {
  const d = digestWith(
    { kind: 'registration', frequency: 'yearly', expires_on: '2026-09-15' }, '2026-08-20');
  const all = [].concat(d.overdue || [], d.soon || [], d.never || []);
  const reg = all.filter(i => i.kind === 'Registration');
  assert.strictEqual(reg.length, 1, 'expected one Registration item, got ' + reg.length);
  assert.strictEqual(reg[0].expires_on, '2026-09-15',
    'the digest item must carry the expiry so the monthly run can filter on it');
});

check('equipment is still labelled Equipment', () => {
  const d = digestWith({ kind: 'calibration', frequency: 'yearly', last_done_on: '2025-01-01' },
                       '2026-08-20');
  const all = [].concat(d.overdue || [], d.soon || [], d.never || []);
  assert.ok(all.some(i => i.kind === 'Equipment'), 'calibration should still read as Equipment');
  assert.ok(all.every(i => !i.expires_on), 'cycle items must not claim an expiry date');
});

check('an expiring registration is not lost among overdue equipment', () => {
  // The monthly run keeps only expiry-dated items. This asserts the filter the API applies.
  const d = D.build(K, {
    assets: [
      { id: 'a1', name: 'Staff Nurse — A. Kumar', status: 'active' },
      { id: 'a2', name: 'Defibrillator — ICU 4', status: 'active' }
    ],
    schedules: [
      { id: 's1', asset_id: 'a1', active: true, kind: 'registration',
        frequency: 'yearly', expires_on: '2026-10-01' },
      { id: 's2', asset_id: 'a2', active: true, kind: 'calibration',
        frequency: 'monthly', last_done_on: '2025-01-01' }
    ],
    events: []
  }, { today: '2026-08-20' });

  const all = [].concat(d.overdue || [], d.soon || []);
  const kept = all.filter(i => i.expires_on && i.state !== 'ok');
  assert.strictEqual(kept.length, 1, 'expiry filter should keep exactly the registration');
  assert.strictEqual(kept[0].name, 'Staff Nurse — A. Kumar');
});

/* ---- the register UI contract ---- */

check('renewing moves the expiry forward', () => {
  const s = read('workspace/register.js');
  assert.ok(/sc\.expires_on\s*=\s*newExp/.test(s),
    'saveLog must write a new expiry, or a renewed certificate stays overdue for ever');
  assert.ok(/val\("eExp"\)/.test(s), 'the log form must ask for the new printed expiry');
  assert.ok(/K\.nextDue\(on, sc\.frequency\)/.test(s),
    'there must be a fallback when the new expiry is left blank');
});

check('the register asks for the expiry and uses it for status', () => {
  const s = read('workspace/register.js');
  assert.ok(/id="sExp"/.test(s), 'the cycle form must offer an expiry date field');
  assert.ok(/expires_on: val\("sExp"\)/.test(s), 'the expiry must be persisted');
  assert.ok(/if \(sc\.expires_on\)[\s\S]{0,200}EXPIRY_LEAD_DAYS/.test(s),
    'statusOf must prefer the printed expiry');
  assert.ok(/registration:\s*"Registration renewal"/.test(s),
    'registration must be a selectable schedule kind');
});

check('the two ninety-day leads agree', () => {
  const r = read('workspace/register.js').match(/EXPIRY_LEAD_DAYS\s*=\s*(\d+)/);
  const g = read('workspace/digest.js').match(/EXPIRY_LEAD_DAYS\s*=\s*(\d+)/);
  assert.ok(r && g, 'both files must define a lead');
  assert.strictEqual(r[1], g[1],
    'register and digest disagree on the lead time: ' + r[1] + ' vs ' + g[1]);
});

/* ---- delivery ---- */

check('the monthly certificate run is wired up', () => {
  const api = read('api/digest.js');
  assert.ok(/scope.*===\s*"expiry"/.test(api), 'the expiry scope flag is missing');
  assert.ok(/Certificates expiring soon/.test(api), 'the monthly run needs its own subject');
  assert.ok(/i\.expires_on && i\.state !== "ok"/.test(api),
    'the monthly run must filter to expiry-dated items');

  const v = JSON.parse(read('vercel.json'));
  const monthly = (v.crons || []).filter(c => /scope=expiry/.test(c.path));
  assert.strictEqual(monthly.length, 1, 'expected exactly one monthly expiry cron');
  assert.ok(/^\d+ \d+ 1 \* \*$/.test(monthly[0].schedule),
    'the certificate run should fire on the 1st of the month, got ' + monthly[0].schedule);
  // The weekly digest must survive untouched.
  assert.ok((v.crons || []).some(c => c.path === '/api/digest'),
    'the weekly digest cron was removed');
});

check('the schema carries expires_on and can be re-run safely', () => {
  const sql = read('workspace/schema.sql');
  assert.ok(/expires_on\s+date/.test(sql), 'expires_on missing from the table definition');
  assert.ok(/add column if not exists expires_on date/.test(sql),
    'existing projects need an idempotent alter, not just a fresh-project column');
  assert.ok(/registration/.test(sql.split('asset_schedules')[1] || ''),
    'the kind comment should list registration');
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('certificate-expiry: all passed');
