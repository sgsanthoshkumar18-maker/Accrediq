/* The short-expiry rule for crash cart medicines.
 *
 * This is the one piece of this platform where being wrong has a clinical consequence
 * rather than an aesthetic one: a window computed a fortnight short leaves an expired
 * ampoule in a resus trolley, and a window computed loosely condemns usable stock. The
 * screen and the alert email both call this module, so these are the only tests that
 * cover either.
 */
const path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

const E = require(path.join(__dirname, '../workspace/shortexpiry.js'));

// --- a pack printed "11/2026" is good until the 30th, not the 1st -----------
eq(E.lastUsableDay('2026-11'), '2026-11-30', 'a month-only expiry runs to the last day');
eq(E.lastUsableDay('2026-02'), '2026-02-28', 'February in a common year');
eq(E.lastUsableDay('2028-02'), '2028-02-29', 'February in a leap year');
eq(E.lastUsableDay('2026-11-14'), '2026-11-14', 'a full date is taken as given');
eq(E.lastUsableDay('rubbish'), '', 'an unreadable date is refused, never guessed');
eq(E.lastUsableDay(''), '', 'and so is a missing one');
eq(E.lastUsableDay('2026-13'), '', 'a thirteenth month is refused');

// --- the window edge --------------------------------------------------------
eq(E.windowEnd('2026-08-15', 3), '2026-11-15', 'three months from mid-August');
eq(E.windowEnd('2026-08-15', 6), '2027-02-15', 'six months crosses the year end');
eq(E.windowEnd('2026-10-31', 3), '2027-01-31', 'a 31st that exists in the target month');
eq(E.windowEnd('2026-11-30', 3), '2027-02-28', 'a day that does not exist is clamped, not rolled');
eq(E.windowEnd('2026-12-15', 3), '2027-03-15', 'December rolls into the next year correctly');

// --- only 3 or 6 are policies; anything else is not silently honoured -------
eq(E.normaliseMonths(3), 3, 'three months is allowed');
eq(E.normaliseMonths(6), 6, 'six months is allowed');
eq(E.normaliseMonths(4), 3, 'an unsupported window falls back to the stricter one');
eq(E.normaliseMonths(12), 3, 'and so does a longer one — never quietly laxer');
eq(E.normaliseMonths(null), 3, 'a missing policy is the stricter one');

// --- classify ---------------------------------------------------------------
const on = (d, months) => ({ today: d, months: months || 3 });
eq(E.classify({ expires_on: '2026-07-31' }, on('2026-08-15')).state, 'expired',
   'a date already past is EXPIRED, not merely short');
eq(E.classify({ expires_on: '2026-09-30' }, on('2026-08-15')).state, 'short',
   'September is short in August — the nearer cohort is never skipped');
eq(E.classify({ expires_on: '2026-11-15' }, on('2026-08-15')).state, 'short',
   'the far edge of the window is included');
eq(E.classify({ expires_on: '2026-11-16' }, on('2026-08-15')).state, 'ok',
   'one day past the edge is not');
eq(E.classify({ expires_on: '2026-11' }, on('2026-08-15')).state, 'ok',
   'a pack marked 11/2026 lasts to the 30th, which is outside a 3-month window from Aug 15');
eq(E.classify({ expires_on: '2027-01-31' }, on('2026-08-15', 6)).state, 'short',
   'six months reaches January');
eq(E.classify({ expires_on: '2026-08-15' }, on('2026-08-15')).state, 'short',
   'expiring today is short, not expired — it is still usable today');
eq(E.classify({ expires_on: '' }, on('2026-08-15')).state, 'unknown',
   'a missing expiry is unknown, never assumed safe');

// --- review over several carts ---------------------------------------------
const carts = [
  { id: 'c1', name: 'ICU bed 4', department: 'ICU' },
  { id: 'c2', name: 'Casualty resus bay', department: 'Emergency' }
];
const items = [
  { id: 'i1', cart_id: 'c1', name: 'Adrenaline 1mg', quantity: 6, expires_on: '2026-09-30' },
  { id: 'i2', cart_id: 'c1', name: 'Atropine 0.6mg', quantity: 4, expires_on: '2027-05-31' },
  { id: 'i3', cart_id: 'c2', name: 'Amiodarone 150mg', quantity: 2, expires_on: '2026-07-31' },
  { id: 'i4', cart_id: 'c2', name: 'Sodium bicarb', quantity: 3, expires_on: '2026-10-15' }
];
const r = E.review(carts, items, on('2026-08-15'));
eq(r.expired.map(x => x.name), ['Amiodarone 150mg'], 'the expired one is listed apart');
eq(r.short.map(x => x.name), ['Adrenaline 1mg', 'Sodium bicarb'],
   'both short items are caught, across two different carts');
eq(r.all.map(x => x.expiry), ['2026-07-31', '2026-09-30', '2026-10-15'],
   'soonest deadline first');
eq(r.all[0].cart, 'Casualty resus bay', 'each row carries the trolley it sits in');
eq(r.windowEnds, '2026-11-15', 'the window edge is reported so a human can check it');
eq(r.empty, false, 'not empty when something needs doing');
eq(E.review(carts, [items[1]], on('2026-08-15')).empty, true,
   'empty when everything is in date');

// The rule applies per ITEM, across every cart — the number of carts changes nothing.
const many = [];
for (let i = 0; i < 25; i++) {
  many.push({ id: 'x' + i, cart_id: i % 2 ? 'c1' : 'c2', name: 'Item ' + i,
              quantity: 1, expires_on: '2026-09-30' });
}
eq(E.review(carts, many, on('2026-08-15')).short.length, 25,
   'every item is judged individually, however many carts there are');

// --- grouping for the email -------------------------------------------------
const grouped = E.byCart(r.all);
eq(grouped.map(g => g.cart), ['Casualty resus bay', 'ICU bed 4'], 'grouped by trolley');
eq(grouped[0].items.length, 2, 'a trolley carries all of its own flagged items');
const months = E.byMonth(r.all);
eq(months.map(m => m.month), ['2026-07', '2026-09', '2026-10'], 'and grouped by month');
eq(E.monthLabel('2026-09'), 'September 2026', 'months are named, not numbered');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
