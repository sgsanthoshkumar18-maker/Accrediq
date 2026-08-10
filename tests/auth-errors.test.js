/* Sign-in failures must say what is actually wrong. A person locked out on a second
   device was shown raw truncated JSON, which cannot distinguish "not confirmed" from
   "wrong password" from "no such account" — three problems with three different fixes. */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', g, 'want', w); } };

const src = fs.readFileSync(path.join(__dirname, '../workspace/auth-gate.js'), 'utf8');
const body = /function friendlyAuthError\(err\) \{[\s\S]*?\n    \}/.exec(src)[0];
eval(body);

// Real Supabase error payloads.
const cases = [
  ['{"code":"email_not_confirmed","message":"Email not confirmed"}', /not been confirmed/, 'resend'],
  ['{"error_code":"invalid_credentials","message":"Invalid login credentials"}', /do not match/, 'reset'],
  ['{"code":"user_already_exists","message":"User already registered"}', /already exists/, null],
  ['{"code":"over_email_send_rate_limit","message":"..."}', /Too many attempts/, null],
  ['{"code":"weak_password","message":"Password should be at least 6 characters"}', /too short/, null],
  ['TypeError: Failed to fetch', /No connection/, null],
];
cases.forEach(([raw, expect, action]) => {
  const r = friendlyAuthError(new Error(raw));
  eq(expect.test(r.text), true, 'explains: ' + raw.slice(0, 42));
  eq(/[{}"]|error_code/.test(r.text), false, 'no raw JSON shown for: ' + raw.slice(0, 30));
  if (action) eq(!!r[action], true, 'offers ' + action + ' for ' + raw.slice(0, 30));
});
// An unrecognised error must still say something, never blank.
eq(friendlyAuthError(new Error('')).text.length > 0, true, 'unknown errors still produce a message');

// Recovery must exist on both adapters, or local mode throws.
const store = fs.readFileSync(path.join(__dirname, '../workspace/store.js'), 'utf8');
eq((store.match(/async resetPassword/g) || []).length, 2, 'resetPassword on both adapters');
eq((store.match(/async resendConfirmation/g) || []).length, 2, 'resendConfirmation on both adapters');
eq(/\/auth\/v1\/recover/.test(store), true, 'reset uses the Supabase recover endpoint');
eq(/\/auth\/v1\/resend/.test(store), true, 'resend uses the Supabase resend endpoint');


/* --- confirmation links must point at the site the user is actually on ---
   Without an explicit redirect Supabase builds the link from Site URL, which defaults
   to localhost:3000. Every new user then gets a confirmation email whose link goes
   nowhere, and is refused at sign-in — while the developer's own machine keeps working
   off a saved session, so the site looks fine to the one person who cannot see it. */
const storeJs = fs.readFileSync(path.join(__dirname, '../workspace/store.js'), 'utf8');
eq(/function siteOrigin\(\)/.test(storeJs), true, 'the redirect target is derived, not hardcoded');
eq(/emailRedirectTo: siteOrigin\(\)/.test(storeJs), true, 'sign-up sends a redirect target');
eq(/recover\?redirect_to=/.test(storeJs), true, 'password reset sends a redirect target');
eq(/resend\?redirect_to=/.test(storeJs), true, 'confirmation resend sends a redirect target');
// Derived from location.origin, never a pasted domain that would rot on a rename.
eq(/location\.origin/.test(storeJs), true, 'the redirect target comes from the browser');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
