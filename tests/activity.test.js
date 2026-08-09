// Minimal localStorage + window shim, then exercise the real activity.js.
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
global.window = {};
require(require('path').join(__dirname,'../profile/activity.js'));
const A = global.window.AQActivity;
let pass = 0, fail = 0;
const eq = (got, want, msg) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; }
  else { fail++; console.log('FAIL:', msg, '- got', got, 'want', want); }
};

// 1. guest activity migrates to the account on sign-in
A.record('quiz_completed', { score: 10 });
A.record('quiz_completed', { score: 8 });
eq(A.count('quiz_completed'), 2, 'guest records');
A.setUser({ email: 's.g.santhoshkumar18@gmail.com' });
eq(A.count('quiz_completed'), 2, 'guest history migrated on sign-in');

// 2. Gmail dot/plus normalisation maps to the same history
A.setUser({ email: 'guest2@x.com' });
A.setUser({ email: 'sgsanthoshkumar18+test@gmail.com' });
eq(A.count('quiz_completed'), 2, 'gmail dots and +tag resolve to one account');

// 3. distinct() vs count()
A.record('certificate_earned', { serial: 'S1' });
A.record('certificate_earned', { serial: 'S1' });
A.record('certificate_earned', { serial: 'S2' });
eq(A.count('certificate_earned'), 3, 'raw count includes repeats');
eq(A.distinct('certificate_earned', 'serial'), 2, 'distinct serials ignore regeneration');

// 4. gap analysis counts distinct days, not element presses
for (let i = 0; i < 250; i++) A.record('gap_saved', { day: '2026-08-10', element: 'AAC.1.a' });
A.record('gap_saved', { day: '2026-08-11', element: 'AAC.2.b' });
eq(A.distinct('gap_saved', 'day'), 2, '250 presses over two days = 2 gap analyses');

// 5. per-type cap holds and does not throw
eq(A.count('gap_saved') <= 200, true, 'per-type cap enforced');

// 6. unknown type is zero, not a crash
eq(A.count('never_used'), 0, 'unused feature reads zero');

// 7. timeline is newest-first and spans types
const tl = A.timeline();
eq(tl.length > 0, true, 'timeline populated');
eq(new Date(tl[0].at) >= new Date(tl[tl.length - 1].at), true, 'timeline newest first');

// 8. record must never throw, even when storage fails
const realSet = global.localStorage.setItem;
global.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
let threw = false;
try { A.record('quiz_completed', {}); } catch (e) { threw = true; }
global.localStorage.setItem = realSet;
eq(threw, false, 'record survives a storage quota failure');

// 9. corrupt ledger does not crash reads
store['aq-activity-v1'] = '{not json';
eq(A.count('quiz_completed'), 0, 'corrupt ledger degrades to zero, not a crash');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
