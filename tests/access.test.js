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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
