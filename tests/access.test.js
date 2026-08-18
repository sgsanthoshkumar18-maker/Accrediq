/* Complimentary access, gate freshness, and the shipped palette default. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', g, 'want', w); } };
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const cfg = R('billing/billing-config.js'), bill = R('billing/billing.js');
const gate = R('billing/page-gate.js'), sql = R('workspace/schema.sql');
const html = R('index.html');

// --- the complimentary account is granted, and is NOT an owner
eq(/complimentaryEmails:\s*\[\s*"mavissneha@gmail\.com"/.test(cfg), true,
   'complimentary address is listed in the config');
eq(/ownerEmails:\s*\[\s*"s\.g\.santhoshkumar18@gmail\.com"\s*\]/.test(cfg), true,
   'owner list still contains only the owner');
eq(cfg.indexOf('mavissneha') > cfg.indexOf('complimentaryEmails'), true,
   'the address is in the complimentary list, not the owner list');
eq(/isComplimentary\(user\)\)[\s\S]{0,220}owner: false/.test(bill), true,
   'complimentary status grants access with owner:false');
eq(/if \(isComplimentary\(user\)\)[\s\S]{0,400}reason: "complimentary"/.test(bill), true,
   'complimentary is reported as its own reason, not as a paid plan');
// it must be checked BEFORE the subscriptions table read, so an outage cannot lock them out
eq(bill.indexOf('isComplimentary(user)') < bill.indexOf('S.adapter.list("subscriptions")'), true,
   'complimentary access does not depend on the subscriptions table being reachable');

// --- the database must agree, since RLS is what actually hands over data
eq(/function public\.aq_is_comp\(\)/.test(sql), true, 'database has a complimentary predicate');
eq(/aq_norm_email\('mavissneha@gmail\.com'\)/.test(sql), true, 'address present in SQL');
// The row was first written with a misspelt address. The upsert has to correct it, or a
// re-run leaves the old spelling on any project where it already landed.
eq(/set status = 'active',[\s\S]{0,200}email = excluded\.email/.test(sql), true,
   'the upsert corrects a stored address');
eq(/user_id = null/.test(sql), true, 'and releases the binding so the trigger reclaims it');
// One misspelling would silently deny access, so no stale spelling may survive anywhere.
eq(/mavisneha@/.test(sql), false, 'no old spelling left in SQL');
eq(/mavisneha@/.test(cfg), false, 'no old spelling left in the billing config');
eq(/'sub_comp_mavisneha'[\s\S]{0,400}'active'/.test(sql), true, 'a real active subscription row exists');
eq(/now\(\) \+ interval '100 years'/.test(sql), true, 'the row does not expire in any practical sense');
// aq_is_comp must not be wired into anything owner-gated
// Skip comment lines — one of them explains precisely that this must never happen.
const ownerGated = sql.split('\n')
  .filter(l => !/^\s*--/.test(l))
  .filter(l => /aq_is_comp\(\)/.test(l) && /owner/i.test(l));
eq(ownerGated, [], 'complimentary is never treated as ownership in SQL');
// and every function it uses must be DEFINED EARLIER — Postgres validates bodies at creation
eq(sql.indexOf('function public.aq_norm_email') < sql.indexOf('function public.aq_is_comp'), true,
   'aq_norm_email is defined before aq_is_comp uses it');
eq(sql.indexOf('function public.aq_jwt_email') < sql.indexOf('function public.aq_is_comp'), true,
   'aq_jwt_email is defined before aq_is_comp uses it');
eq(sql.indexOf('create table if not exists public.subscriptions') < sql.indexOf("'sub_comp_mavisneha'"), true,
   'the subscriptions table exists before the complimentary row is inserted');

// --- a gated page must never be restored from memory
eq(/e\.persisted && document\.body\.getAttribute\("data-gated"\) === "1"/.test(gate), true,
   'a bfcache-restored payment screen reloads instead of sticking');
eq(/e\.key === "aq-sb-session"/.test(gate), true,
   'signing in or out in another tab re-runs the gate');

// --- the shipped palette default: neon on the very first paint, no refreshes needed
const boot = /<script>\(function\(\)\{try\{[\s\S]*?\}\)\(\);<\/script>/.exec(html)[0];
eq(/var DEF="neon"/.test(boot), true, 'neon is the shipped default');
eq(/aq-palette"\)\|\|DEF/.test(boot), true, 'a first-time visitor gets the default, not blue');
eq(/catch\(e\)\{[^}]*data-palette","neon"/.test(boot), true,
   'private browsing still gets the house palette');
eq(/localStorage.setItem\("aq-palette", "default"\)/.test(gate), false,
   'the gate no longer reverts a non-owner to the blue palette');


/* =========================== PRICING ===========================
   Money is in paise, integers only — a float becomes a rounding error on an invoice. And
   no path may fall back to a token amount: a missing config should never quietly sell a
   year's access for a rupee. */
{
  const sbx = { window: {} };
  vm.createContext(sbx);
  vm.runInContext(cfg, sbx);
  const C = sbx.window.AQ_BILLING;

  eq(Number.isInteger(C.monthlyInr), true, 'the monthly price is an integer number of paise');
  eq(Number.isInteger(C.yearlyInr), true, 'and so is the yearly price');
  eq(C.monthlyInr >= 10000, true, 'the monthly price is a real price, not a token test amount');
  eq(C.yearlyInr, C.monthlyInr * 10, 'the year is priced at ten months');
  eq(/: 100,/.test(bill), false, 'no path falls back to a one-rupee amount');

  /* Launching below what the product is worth is a fair trade, but raising a price on
     someone who signed up early feels like a betrayal unless they were told at the time. */
  const pw = R('billing/paywall.js');
  if (C.introductory) {
    eq(C.standardMonthlyInr > C.monthlyInr, true,
       'an introductory price declares the higher standard rate it will move to');
    eq(/Introductory pricing/.test(pw), true, 'the paywall says the rate is introductory');
    eq(/keep this rate/.test(pw), true, 'and what an early subscriber keeps');
    /* Above the plans, not under them — a notice someone had to scroll past does not
       count as having been told while deciding. */
    eq(pw.indexOf('pw-intro') < pw.indexOf('h += planCards();'), true,
       'and says so before showing the prices, not in small print after');
  }

  /* The reader of a paywall is usually not the person who signs off spending. */
  eq(/function justifyText/.test(pw), true, 'the paywall drafts an approval request to forward');
  eq(/Not the person who approves spending/.test(pw), true, 'and says plainly who it is for');
  eq(/several lakhs/.test(pw), true, 'the draft compares against consulting cost, not features');
  eq(/no per-user/.test(pw), true, 'and makes clear it is not charged per seat');
}

/* ==================== ACCOUNT SHARING: DEVICES, NOT IPs ====================
   IP locking was asked for and rejected. An Indian carrier puts thousands of subscribers
   behind one CGNAT address and rotates a handset's address several times an hour; hospital
   Wi-Fi re-leases most mornings. It would throw out a nurse who walked to the car park
   while two people on one hospital's Wi-Fi looked like a single user — wrong in both
   directions at once. */
{
  const dev = R('workspace/device.js');
  const ui = R('workspace/device-ui.js');

  eq(/x-forwarded-for|remoteAddr|ipAddress/i.test(dev), false,
     'no IP address is used to identify a session');
  eq(/CGNAT/.test(dev), true, 'and the file records why, so it is not re-attempted later');

  const lim = /LIMIT = (\d+)/.exec(dev);
  eq(lim && +lim[1], 2, 'the limit is two devices — a computer and a phone is one person working');
  eq(/STALE_DAYS = 30/.test(dev), true,
     'devices unused for 30 days stop counting, so a replaced laptop keeps no slot');

  /* Failing OPEN is correct for a licence control and wrong for a security boundary —
     which is exactly why the two must not be conflated. */
  eq(/reason: "unreachable"/.test(dev), true,
     'a failed lookup lets a paying customer in rather than locking them out');
  eq(/reason: "unavailable"/.test(dev), true, 'and so does blocked browser storage');
  eq(/licence control, not a security boundary/.test(dev), true,
     'the file states plainly that this protects revenue, not data');
  eq(/Not a fingerprint/.test(dev), true, 'identification is a stored random id, not fingerprinting');

  eq(/warnOnce/.test(ui), true, 'the second device warns rather than blocks');
  eq(/aq-device-warned/.test(ui), true, 'and warns once, since a repeated warning becomes noise');
  eq(/data-revoke=/.test(ui), true, 'a third device can free a slot by signing an old one out');
  /* The likeliest person to hit this is an honest customer who changed laptops, so the
     message must carry a fix rather than an accusation. */
  eq(/If one of these is an old device/.test(ui), true, 'the block screen offers a remedy');
  eq(/own account rather than sharing/.test(ui), true,
     'and points at the real answer, which is more accounts');

  eq(/create table if not exists public\.device_sessions/.test(sql), true, 'devices are stored');
  /* Not org-scoped: which devices a colleague signs in from is not their employer's
     business, and exposing it would turn a licence control into surveillance. */
  eq(/using \(user_id = auth\.uid\(\)\)/.test(sql.slice(sql.indexOf('device_sessions_rw'))), true,
     'a person sees only their own devices, never a colleague\'s');
}

/* ======================= PREVIEW INSTEAD OF A BLANK WALL =======================
   A locked page that shows nothing cannot sell itself. This leaks nothing: someone who has
   not subscribed has no data, so the preview is sample data from a fictional hospital. */
{
  const pv = R('billing/preview.js');
  const sbx = { window: {}, console };
  vm.createContext(sbx);
  vm.runInContext(pv, sbx);
  const P = sbx.window.AQPreview;

  ['readiness', 'dashboard', 'register', 'rounds', 'capa', 'calendar', 'generic']
    .forEach(function (k) {
      const h = P.render(k, '../');
      eq(/pv-banner/.test(h), true, k + ' preview carries the banner');
      eq(/pv-cta/.test(h), true, k + ' preview ends with what subscribing changes');
      eq(h.length > 1200, true, k + ' preview shows enough to judge the product by');
    });

  /* A preview that stops saying it is a preview is a lie by omission — someone could
     otherwise believe those are their own hospital's numbers. */
  const h = P.render('dashboard', '../');
  eq(/sample data/.test(h), true, 'the banner says the data is a sample');
  eq(/fictional hospital/.test(h), true, 'and that the hospital is not real');
  eq(/plans\.html/.test(h), true, 'and it routes to the plans page');

  const gate = R('billing/page-gate.js');
  eq(/function previewFor/.test(gate), true, 'the page gate can render a preview');
  eq(/window\.AQPreview\.render/.test(gate), true, 'and calls it');
  /* A pending payment must NOT get a preview — that person has paid and is waiting, and
     showing them a sales page would read as the payment having failed. */
  eq(/!\(st && st\.reason === "pending"\)/.test(gate), true,
     'someone awaiting confirmation sees their status, not a sales pitch');

  const shell = R('workspace/shell.js');
  eq(/data-preview/.test(shell), true, 'the workspace gate honours the preview attribute');
  eq(/AQPreview\.render/.test(shell), true, 'and renders it above the paywall');
}

/* =========================== FREE vs PAID, STATED ===========================
   Someone deciding cannot decide without knowing what each tier includes. */
{
  const plans = R('plans.html');
  eq((plans.match(/<body/g) || []).length, 1, 'the plans page is a single well-formed page');
  eq(/Today&rsquo;s quiz/.test(plans) || /Today\u2019s quiz/.test(plans) || /quiz/.test(plans), true,
     'the free tier names the quiz');
  eq(/certificate/i.test(plans), true, 'and the certificate');
  eq(/Unlimited accounts/.test(plans), true, 'the paid tier states it is not per-user');
  eq(/not affiliated with NABH/i.test(plans), true,
     'and the page repeats that AQcredix is not an accrediting body');
  /* The annual saving is computed from the config, never typed — a hardcoded figure goes
     stale the moment a price changes and then quietly misleads. */
  eq(/rupees\(saved\)/.test(plans), true, 'the annual saving is computed, not hardcoded');
  eq(/plans\.html/.test(R('app.js')), true, 'and the site links to it');
}

/* ==================== SUBSCRIPTION DATES MUST BE EXACT ====================
   setMonth() rolls past the end of a short month: 31 January plus one month lands on
   3 March. A subscriber would get free days and be shown a date they were not charged for. */
{
  const vp = R('api/verify-payment.js');
  eq(/function addMonths/.test(vp), true, 'expiry is computed by a clamping helper');
  eq(/expires\.setMonth/.test(vp), false, 'and never by raw setMonth, which rolls over');

  const i = vp.indexOf('function addMonths'), j = vp.indexOf('module.exports');
  const addMonths = new Function(vp.slice(i, j) + '; return addMonths;')();
  const iso = (d) => d.toISOString().slice(0, 10);
  eq(iso(addMonths(new Date('2026-01-31T10:00:00Z'), 1)), '2026-02-28',
     '31 January plus a month is the last day of February, not 3 March');
  eq(iso(addMonths(new Date('2026-08-31T10:00:00Z'), 1)), '2026-09-30',
     '31 August plus a month is 30 September');
  eq(iso(addMonths(new Date('2026-08-19T10:00:00Z'), 12)), '2027-08-19',
     'a year is exactly a year');
  eq(iso(addMonths(new Date('2026-01-15T10:00:00Z'), 1)), '2026-02-15',
     'an ordinary date is unaffected');
}

/* Expiry warning rides along with the weekly digest rather than getting its own job, so it
   reaches someone who never opens the site. */
{
  const dg = R('workspace/digest.js');
  eq(/opts\.expiresAt/.test(dg), true, 'the digest knows when the subscription ends');
  eq(/days <= 3/.test(dg), true, 'and warns three days ahead');
  eq(/&& !expiry/.test(dg), true,
     'an expiry notice counts against emptiness, so it is never silently skipped');
}

/* ==================== FREE TRIAL: 7 DAYS, NOT 12 HOURS ====================
   A twelve-hour trial ending in an automatic debit cannot legally be built in India. The
   RBI's Digital Payments E-mandate Framework, 2026 requires a pre-transaction notification
   at least 24 hours before any charge, with an opt-out — so a sub-24-hour trial would mean
   warning the customer before the trial had started. */
{
  const tSb = { window: {}, console };
  vm.createContext(tSb);
  vm.runInContext(R('billing/trial.js'), tSb);
  const T = tSb.window.AQTrial;

  /* Length is a config value so it is one edit, and the terms page cannot drift from what
     the code does. But it has a hard floor: the RBI notice goes 48 hours ahead, so on a
     3-day trial the payment warning lands on day one — worse than offering no trial. */
  eq(T.DAYS >= 5, true, 'the trial is long enough that the pre-debit notice is not immediate');
  eq(T.DAYS - (T.NOTICE_HOURS / 24) >= 2, true,
     'leaving at least two clear days of use before payment is mentioned');
  eq(T.NOTICE_HOURS >= 24, true, 'the pre-debit notice meets the RBI 24-hour minimum');
  eq(T.NOTICE_HOURS, 48, 'and is sent early enough to survive a weekend or a failed send');

  const start = new Date('2026-08-19T10:00:00Z');
  const ends = T.addDays(start, 7).toISOString();
  eq(ends.slice(0, 10), '2026-08-26', 'seven days from 19 August is 26 August');

  eq(T.status({ ends_at: ends }, '2026-08-19T11:00:00Z').state, 'active', 'day one is active');
  eq(T.status({ ends_at: ends }, '2026-08-27T10:00:00Z').state, 'ended', 'after the end it has ended');
  eq(T.status({ ends_at: ends, cancelled_at: 'x' }, '2026-08-20T10:00:00Z').state, 'cancelled',
     'a cancelled trial reports cancelled, not active');

  /* The notice must fire before the debit, never on the day. */
  eq(T.status({ ends_at: ends }, '2026-08-20T10:00:00Z').noticeDue, false,
     'no notice while the trial has days to run');
  eq(T.status({ ends_at: ends }, '2026-08-25T10:00:00Z').noticeDue, true,
     'the notice becomes due inside the window');
  eq(T.status({ ends_at: ends, notified_at: 'x' }, '2026-08-25T10:00:00Z').noticeDue, false,
     'and is not sent twice');

  /* Nobody should ever be surprised by a debit from this platform. */
  const late = T.noticeText(T.status({ ends_at: ends }, '2026-08-25T10:00:00Z'), '₹500');
  eq(/will be charged/.test(late), true, 'the late notice says money will be taken');
  eq(/Cancel before that and nothing is taken/.test(late), true, 'and how to avoid it');
  const early = T.noticeText(T.status({ ends_at: ends }, '2026-08-20T10:00:00Z'), '₹500');
  eq(/we will remind you before anything is charged/.test(early), true,
     'the early banner promises a reminder');

  eq(/E-mandate Framework, 2026/.test(R('billing/trial.js')), true,
     'the file records the regulation it is built around, so it is not "simplified" later');
  eq(/trialDays/.test(R('billing/billing-config.js')), true,
     'the length lives in the config, not buried in the logic');
  eq(/AQ_BILLING && window\.AQ_BILLING\.trialDays/.test(R('billing/trial.js')), true,
     'and the logic reads it from there');

  /* The terms page must state the same number the code uses. A policy promising seven days
     while the code grants three is the kind of discrepancy that ends in a chargeback. */
  const termsDays = /(\d+)-day free trial/.exec(R('terms.html'));
  eq(termsDays && Number(termsDays[1]), T.DAYS, 'the terms state the same trial length as the code');
}

/* ==================== LEGAL PAGES ARE ACTUALLY FILLED ==================== */
{
  const terms = R('terms.html'), priv = R('privacy.html');
  /* A published policy with [LEGAL ENTITY NAME] still in it is worse than none — Razorpay
     will bounce it and a hospital will not trust it. */
  eq(/<span class="tofill">/.test(terms), false, 'terms.html has no unfilled placeholders');
  eq(/<span class="tofill">\[/.test(priv), false, 'privacy.html has no bracketed placeholders');

  eq(/sole proprietorship/.test(terms), true, 'the entity type is stated');
  eq(/Thoraipakkam/.test(terms), true, 'and the address');
  eq(/Chennai/.test(terms), true, 'and the jurisdiction');

  eq(/7-day free trial/.test(terms), true, 'the trial is documented in the terms');
  eq(/at least 24 hours before any\s*\n?\s*debit/.test(terms.replace(/<[^>]+>/g, '')), true,
     'and so is the pre-debit notice');
  eq(/not refundable once taken/.test(terms), true, 'the refund position is stated plainly');
  /* A blanket refusal that ignores our own failures would not be fair, and would not
     stand — so the fault case is carved out explicitly. */
  eq(/Where the fault is ours/.test(terms), true,
     'with an exception where the platform itself is at fault');
  eq(/90 days/.test(terms), true, 'and the retention period after a lapse');

  eq(/All rights reserved/.test(R('app.js')), true, 'the footer asserts copyright');
  eq(/original work/.test(R('app.js')), true,
     'and distinguishes our commentary from the standards themselves');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
