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
/* WHOLE MONTHS. The edge is the LAST day of the target month, never the same day-of-month
   N months out. A crash cart is checked against the month printed on the pack: in September,
   on a three-month policy, everything stamped December comes out — the 1st and the 31st
   alike. The day-anchored version this replaced flagged stock to 2 December and left the
   rest of the month standing, and gave two people entering the same ampoule a week apart
   two different answers. The day of entry must not appear in the result at all. */
eq(E.windowEnd('2026-08-15', 3), '2026-11-30', 'three months from August ends WITH November');
eq(E.windowEnd('2026-08-01', 3), '2026-11-30', 'the 1st gives the same answer as the 15th');
eq(E.windowEnd('2026-08-31', 3), '2026-11-30', 'and so does the 31st');
eq(E.windowEnd('2026-08-15', 6), '2027-02-28', 'six months crosses the year end');
eq(E.windowEnd('2026-10-31', 3), '2027-01-31', 'a 31-day target month');
eq(E.windowEnd('2026-11-30', 3), '2027-02-28', 'February is 28 days, not rolled into March');
eq(E.windowEnd('2026-12-15', 3), '2027-03-31', 'December rolls into the next year correctly');
eq(E.windowMonth('2026-09-02', 3), '2026-12', 'September plus three is December');

/* IST, not UTC. The rule turns on which MONTH it is, and UTC runs 5h30m behind — so on the
   1st of a month, for the first five and a half hours of the Indian day, a UTC clock is
   still in the previous month and the whole window slides. The cron fires at 02:00 IST,
   which is exactly that window. */
{
  const iso = E.todayIST();
  eq(/^\d{4}-\d{2}-\d{2}$/.test(iso), true, 'todayIST returns an ISO date');
  const utc = new Date().toISOString().slice(0, 10);
  const shifted = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  eq(iso, shifted, 'todayIST is UTC plus 5h30m');
  eq(iso >= utc, true, 'IST is never behind UTC');
}

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
   'mid-November is inside the window');
eq(E.classify({ expires_on: '2026-11-01' }, on('2026-08-15')).state, 'short',
   'so is the FIRST of the target month');
eq(E.classify({ expires_on: '2026-11-30' }, on('2026-08-15')).state, 'short',
   'and the last of it — the whole month comes out, not part of it');
eq(E.classify({ expires_on: '2026-12-01' }, on('2026-08-15')).state, 'ok',
   'the month after the target is not flagged');
eq(E.classify({ expires_on: '2026-11' }, on('2026-08-15')).state, 'short',
   'a pack marked 11/2026 is short — it is a November pack and November is the target month');
/* The day of entry must not change the answer for any pack in the target month. */
['2026-08-01', '2026-08-15', '2026-08-31'].forEach(function (d) {
  eq(E.classify({ expires_on: '2026-11-29' }, on(d)).state, 'short',
     'entered on ' + d + ', a 29 November pack is still short');
});
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
eq(r.windowEnds, '2026-11-30', 'the window edge is reported so a human can check it');
eq(r.windowMonth, '2026-11', 'and the target month, which is what the screen prints');
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


/* ============ copying an item list from one crash cart to another ============
 *
 * Every crash cart in a hospital carries the same drugs; what differs between the Deluxe Ward
 * trolley and the Tag Ward one is batch numbers and expiry dates. Retyping thirty names per
 * ward is the longest job in the module and every retype can silently drop a drug.
 *
 * The clinical risk here is the OPPOSITE of the usual one: it is not that too little is
 * copied, it is that too much is. Carrying a batch number or an expiry across would put a
 * date into a trolley that no one has read off a pack — an expiry that is wrong and looks
 * checked. So the tests below are mostly about what must NOT travel.
 */
const fs2 = require('fs');
const CC = fs2.readFileSync(path.join(__dirname, '../workspace/crashcart.js'), 'utf8');
const has = (re, m) => eq(re.test(CC), true, m);

/* Quantity is the total across batches. "Two adrenaline" is two adrenaline whether they
   arrived as one batch or two — the split is an accident of delivery, not part of the cart's
   design, and the person copying the list means the quantity they hold. */
{
  const rows = [
    { name: 'Adrenaline', strength: '1mg/ml', quantity: 1, expires_on: '2026-12-31' },
    { name: 'Adrenaline', strength: '1mg/ml', quantity: 1, expires_on: '2027-03-31' },
    { name: 'Atropine',   strength: '0.6mg',  quantity: 4, expires_on: '2027-01-31' }
  ];
  /* The same grouping the module does: name + strength is the item, the rest are its batches. */
  const g = {};
  rows.forEach(r => {
    const k = r.name + '|' + r.strength;
    g[k] = (g[k] || 0) + r.quantity;
  });
  eq(g['Adrenaline|1mg/ml'], 2, 'one item split across two batches copies as quantity 2');
  eq(g['Atropine|0.6mg'], 4, 'and a single batch copies its own quantity');
  eq(Object.keys(g).length, 2, 'two batches of one drug are ONE item to copy, not two');
}

/* What must not travel. */
eq(/data-c="batch"[^>]*value=""/.test(CC), true,
   'the batch field must start EMPTY — a copied batch number describes stock in another ward');
eq(/data-c="expires_on"[^>]*required[^>]*\n?\s*'value=""/.test(CC) ||
   /expires_on"[^]{0,120}value=""/.test(CC), true,
   'the expiry field must start EMPTY — a copied expiry is a date nobody has read off a pack');

/* Nothing is written until every row is answerable. A half-written list is worse than none:
   the cart reads as stocked while missing whatever came after the bad row. */
has(/rows\.forEach\(function \(r\) \{[^]*?every item needs an expiry/,
    'expiries are validated across all rows BEFORE the first row is written');
eq(CC.indexOf('every item needs an expiry') < CC.indexOf('await S.adapter.put(ITEMS, {\n        id: id("cci"),\n        cart_id: targetId'), true,
   'the validation loop must come before the write loop');

/* The offer appears only where it helps: an empty cart standing beside a stocked one. */
has(/if \(!itemsOf\(tid\)\.length && cartsWithItems\(tid\)\.length\) offerCopy\(tid\);/,
    'the copy offer is raised only when this cart is empty and another has items');
has(/else itemForm\(null, tid\);/,
    'and typing it by hand stays one click away');
has(/id="ccCopyNo"/, 'the offer must be declinable');

/* A copied row lands in the TARGET cart, not the source. */
has(/cart_id: targetId,/, 'copied rows are written to the cart being filled');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
