/* ONE MONDAY EMAIL, WITH A HEADING PER RESPONSIBILITY.
 *
 * A hospital used to get two mails an hour apart on a Monday — the weekly digest at 03:00 and
 * the crash cart alert at 02:00. Two things to open is two things to start ignoring, so they
 * are now one mail, and what appears in it is decided by ASSIGNMENT: a section is there
 * because that person is responsible for that thing.
 *
 * The two failures that matter are opposite, and both are silent:
 *   - a section reaching someone who was never assigned to it (the crash cart list is
 *     clinical stock data and a viewer has no business receiving it), and
 *   - somebody assigned to two areas hearing about neither because the rule that decides
 *     "is there anything to say" only knew about one of them.
 */
const path = require('path');
const fs = require('fs');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

const X = require(path.join(__dirname, '../workspace/shortexpiry.js'));
const H = require(path.join(__dirname, '../api/digest.js'));
const SRC = fs.readFileSync(path.join(__dirname, '../api/digest.js'), 'utf8');

const carts = [{ id: 'w1', name: 'Deluxe Ward' }, { id: 'w2', name: 'Tag Ward' }];
const shortItems = [
  { id: 'a', cart_id: 'w1', name: 'Adrenaline', strength: '1mg/ml', batch: 'ADR-2291',
    quantity: 6, expires_on: '2026-12-15' },
  { id: 'b', cart_id: 'w2', name: 'Sodium bicarbonate', strength: '7.5%', batch: 'SBC-0091',
    quantity: 3, expires_on: '2026-08-31' }
];
const on = { today: '2026-09-03', months: 3 };
const cartsShort = X.review(carts, shortItems, on);
const cartsClear = X.review(carts, [{ id: 'c', cart_id: 'w1', name: 'Atropine',
  quantity: 4, expires_on: '2027-09-30' }], on);

const bioClear = { department: 'Biomedical Engineering', overdue: [], never: [], soon: [],
  findings: [], empty: true, total: 0, counts: { overdue: 0, never: 0, soon: 0, findings: 0 } };
const bioBusy = { department: 'Biomedical Engineering',
  overdue: [{ name: 'Defibrillator — ICU 3', kind: 'Calibration', text: 'due 12 days ago' }],
  never: [], soon: [], findings: [], empty: false, total: 1,
  counts: { overdue: 1, never: 0, soon: 0, findings: 0 } };

/* ---- the case that prompted this: one person, two responsibilities, one of them quiet ---- */
{
  const html = H.render(bioClear, 'Dr S', cartsShort);
  eq(/Biomedical Engineering/.test(html), true, 'the quiet area still gets its own heading');
  eq(/Nothing overdue in Biomedical Engineering as of today/.test(html), true,
     'and says so in words — an absent section cannot be told apart from a broken alert');
  eq(/Crash cart medicines/.test(html), true, 'the busy area gets its heading too');
  eq(/Adrenaline/.test(html) && /Sodium bicarbonate/.test(html), true,
     'and lists what is actually short, in one mail rather than a second one');
}

/* ---- assignment decides who sees the medicines, not who is on the account ---- */
{
  const html = H.render(bioBusy, 'A N Other', null);
  eq(/Crash cart medicines/.test(html), false,
     'somebody not assigned to the carts gets no medicine heading at all');
  eq(/Adrenaline/.test(html), false, 'and never sees the stock itself');
  eq(/Defibrillator/.test(html), true, 'their own work is unaffected');
}

/* ---- a quiet crash cart still reports, when it shares the mail with something actionable -- */
{
  const html = H.render(bioBusy, 'Dr S', cartsClear);
  eq(/No batch is expiring inside your 3-month window/.test(html), true,
     'an assigned but quiet cart says it is quiet');
  eq(/December 2026|Adrenaline/.test(html), false, 'and lists nothing, because there is nothing');
}

/* ---- the send rule has to know about BOTH halves ---- */
eq(/const cartsWorthSending = myCarts && !myCarts\.empty;/.test(SRC), true,
   'the crash cart is considered when deciding whether there is anything to say');
eq(/if \(digest\.empty && !cartsWorthSending\) \{ quiet\+\+; continue; \}/.test(SRC), true,
   'a clean register plus an expiring ampoule must still send — the old test knew only about ' +
   'the digest and would have sent that person nothing');

/* ---- and the assignment rule itself ---- */
eq(/if \(role === "owner"\) return true;/.test(SRC), true,
   'the owner is always assigned, so narrowing the list cannot lock them out');
eq(/if \(named\.length\) return named\.some/.test(SRC), true,
   'named addresses decide it when the hospital has named anyone');
eq(/return RESTOCK_ROLES\.indexOf\(role\) > -1;/.test(SRC), true,
   'and a hospital that has never opened the setting keeps being told');

/* ---- there must be exactly one Monday cron left ---- */
{
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'));
  const mondays = (v.crons || []).filter(c => / \* \* 1$/.test(c.schedule));
  eq(mondays.length, 1, 'one Monday email, not two — the crash cart rides in the digest now');
  eq(mondays[0].path, '/api/digest', 'and it is the digest that carries it');
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
