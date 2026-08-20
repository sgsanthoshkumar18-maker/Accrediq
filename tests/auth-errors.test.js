/* AQcredix — sign-in error messages.
 * Run: node tests/auth-errors.test.js
 *
 * Supabase returns machine-readable JSON on failure. Printed raw, a person locked out sees
 *   {"code":400,"error_code":"email_not_confirmed","msg":"Email not confirmed"}
 * and cannot tell whether the account is missing, unconfirmed, or the password is simply
 * wrong — three different problems with three different fixes. It also overflowed its box,
 * because a JSON blob has no spaces to wrap at.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function eq(g, w, m) {
  if (g === w) pass++;
  else { fail++; console.log('FAIL: ' + m + ' - got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sb = {
  window: {},
  document: {
    addEventListener() {}, getElementById: () => null, querySelector: () => null,
    createElement: () => ({
      style: {}, classList: { add() {} }, appendChild() {}, addEventListener() {}
    }),
    body: { appendChild() {} },
    readyState: 'complete'
  },
  console
};
vm.createContext(sb);
// The file also does DOM setup that cannot run here; the translator is what matters.
try { vm.runInContext(R('workspace/auth-gate.js'), sb); } catch (e) { /* expected */ }

const f = sb.window.AQAuthError;
ok(typeof f === 'function', 'the translator is exported at module scope');

/* Module scope specifically: assigned inside a function that only runs on some pages, it
   would be undefined exactly where shell.js needs it. */
ok(/^\s{2}window\.AQAuthError = friendlyAuthError;/m.test(R('workspace/auth-gate.js')),
   'and is assigned at module scope, not inside a page-specific branch');

if (typeof f === 'function') {
  const cases = [
    ['email_not_confirmed', 'not been confirmed'],
    ['invalid_credentials', 'do not match an account'],
    ['user_already_exists', 'already exists'],
    ['over_email_send_rate', 'Too many attempts'],
    ['weak_password', 'too short']
  ];
  cases.forEach(function (c) {
    const out = f({ message: JSON.stringify({ code: 400, error_code: c[0] }) }).text;
    ok(out.indexOf(c[1]) >= 0, c[0] + ' is translated into plain words');
    eq(/[{}"]/.test(out), false, c[0] + ' output shows no raw JSON punctuation');
    ok(out.length < 220, c[0] + ' message is short enough to read');
  });

  /* The two cases with a remedy should offer it — knowing the problem without the fix
     leaves the person no better off. */
  ok(f({ message: '{"error_code":"email_not_confirmed"}' }).resend,
     'an unconfirmed email offers to resend');
  ok(f({ message: '{"error_code":"invalid_credentials"}' }).reset,
     'a credential mismatch offers a password reset');

  // An unrecognised error must still produce something readable rather than raw JSON.
  const unknown = f({ message: '{"code":500,"error_code":"something_new"}' }).text;
  ok(unknown.length > 0 && unknown.length < 220, 'an unknown error still reads as a sentence');
}

/* Both panels must share one translator — two copies would drift apart. */
const shell = R('workspace/shell.js');
ok(/window\.AQAuthError/.test(shell), 'the workspace panel uses the shared translator');
ok(/friendlyAuthError/.test(R('workspace/auth-gate.js')), 'which lives in auth-gate.js');

/* A long unbroken token has no spaces to wrap at and simply runs out of its container
   unless told otherwise. */
const css = R('workspace/workspace.css');
ok(/overflow-wrap:\s*anywhere/.test(css), 'the message box wraps unbreakable strings');
ok(/word-break:\s*break-word/.test(css), 'and breaks long words rather than overflowing');
ok(/\.ws-auth-msg\{[\s\S]{0,240}max-width:\s*100%/.test(css),
   'and cannot exceed its container');

/* ==================== NO BLANK SCREEN WHILE THE GATE RUNS ====================
   The page was hidden entirely until a network round-trip to Supabase returned — two or
   three seconds of blank screen on every load, worse on mobile data or a distant database.
   A blank screen is indistinguishable from a broken one. */
{
  const gate = R('workspace/auth-gate.js');
  ok(/function looksSignedIn/.test(gate),
     'the gate checks for a stored session before deciding to hide the page');
  ok(/if \(!looksSignedIn\(\)\)/.test(gate),
     'and only hides when there is no plausible session');
  /* A stored token is not proof of access and must not be treated as one — the real check
     still runs. It is proof this browser signed in recently, which is enough to justify
     painting immediately. */
  ok(/not proof of access/.test(gate),
     'with the reasoning recorded so it is not mistaken for an auth bypass');
  ok(/expires_at/.test(gate),
     'an expired token still hides, since a refresh round-trip really is pending');

  const css = R('workspace/workspace.css');
  ok(/\.ws-skel\{/.test(css), 'a loading skeleton exists');
  ok(/@keyframes wsShimmer/.test(css), 'and it animates so it reads as loading');
  /* A shimmering placeholder is worse than a still one for someone sensitive to motion —
     the animation is exactly the part they did not ask for. */
  ok(/prefers-reduced-motion:reduce\)\{[\s\S]{0,200}\.ws-skel-row/.test(css.replace(/\s+/g, m => m.includes('\n') ? '\n' : ' ')) ||
     /\.ws-skel-row,\.ws-skel-card\{animation:none/.test(css.replace(/\s+/g, '')),
     'and it stops animating under reduced motion');

  const shell = R('workspace/shell.js');
  ok(/clearSkeleton/.test(shell), 'the shell can clear the placeholder');
  /* Cleared on EVERY exit — signed in, paywalled, or signed out. A skeleton left behind a
     sign-in panel looks like the page is still loading behind it. */
  ok((shell.match(/W\.clearSkeleton\(\)/g) || []).length >= 2,
     'and clears it on more than one exit path');
  ok(/wsSkelTimeout/.test(shell), 'a stalled request eventually says so');
  ok(/taking longer than it should/.test(shell),
     'rather than shimmering for ever with no explanation');

  // Every workspace page must carry the placeholder, or some pages still blank.
  const pages = fs.readdirSync(path.join(ROOT, 'workspace')).filter(f => f.endsWith('.html'));
  const noSkel = pages.filter(f => !/wsSkel/.test(R('workspace/' + f)));
  eq(noSkel.join(', '), '', 'every workspace page has a loading placeholder (' + pages.length + ')');
}

/* ==================== DATA REGION STATED ACCURATELY ==================== */
{
  const priv = R('privacy.html');
  ok(/Mumbai/.test(priv), 'the privacy policy names the Mumbai region');
  eq(/Tokyo/.test(priv), false, 'and no longer refers to Tokyo');
  ok(/stored in India/.test(priv), 'and states plainly that data stays in India');
  // The claim must match the project the site actually talks to.
  const cfg = R('workspace/config.js');
  const key = /supabaseAnonKey: "([^"]+)"/.exec(cfg)[1];
  const ref = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString()).ref;
  ok(cfg.includes(ref), 'the anon key belongs to the project the site points at');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
