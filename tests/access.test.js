/* Complimentary access, gate freshness, and the shipped palette default. */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', g, 'want', w); } };
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const cfg = R('billing/billing-config.js'), bill = R('billing/billing.js');
const gate = R('billing/page-gate.js'), sql = R('workspace/schema.sql');
const html = R('index.html');

// --- the complimentary account is granted, and is NOT an owner
eq(/complimentaryEmails:\s*\[\s*"mavisneha@gmail\.com"/.test(cfg), true,
   'complimentary address is listed in the config');
eq(/ownerEmails:\s*\[\s*"s\.g\.santhoshkumar18@gmail\.com"\s*\]/.test(cfg), true,
   'owner list still contains only the owner');
eq(cfg.indexOf('mavisneha') > cfg.indexOf('complimentaryEmails'), true,
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
eq(/aq_norm_email\('mavisneha@gmail\.com'\)/.test(sql), true, 'address present in SQL');
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
