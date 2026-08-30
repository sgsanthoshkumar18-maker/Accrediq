/* Regression tests for the batch of display bugs reported 20 Aug 2026.
 *
 * Every one of these was visible on the live site, and several had already been "fixed"
 * once in source without the fix reaching a browser. So these assert the SOURCE is right;
 * the cache-busting stamp is what gets it to the user, and that is checked too.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const SKIP = new Set(['node_modules', '.git', 'build', 'tests']);
function walk(dir, ext, out = []) {
  for (const n of fs.readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(n)) out.push(p);
  }
  return out;
}

let failures = 0;
function check(name, fn) {
  try { fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

console.log('display-fixes');

/* 1. No \uXXXX punctuation escapes left in shipped JS or HTML.
 *
 * These are valid JavaScript and render correctly in a browser, so this is not strictly
 * a correctness bug — but the literal text "\u00b7" was reaching users on the live site,
 * which means something between the repo and the browser was double-escaping them. Using
 * the real character removes that whole class of failure rather than guessing at which
 * layer was responsible. */
check('no unicode punctuation escapes in js/html', () => {
  const files = walk(ROOT, /\.(js|html)$/);
  const bad = [];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    const m = s.match(/\\u(00b7|2014|2013|2026|2713|20b9|201[89cd])/gi);
    if (m) bad.push(path.relative(ROOT, f) + ' (' + m.length + ')');
  }
  assert.strictEqual(bad.length, 0,
    'escaped punctuation still present in: ' + bad.join(', '));
});

/* 2. The middot the user asked about really is a middot now. */
check('library card status line uses a real middot', () => {
  const s = read('workspace/library.js');
  assert.ok(s.includes('Full detail \u00b7 downloadable'),
    'expected a literal middot in the lib-ready label');
});

/* 3. Sign out exists, is reachable, and goes somewhere that exists.
 *
 * The redirect was "../index.html" while profile.html sits at the site root, so signing
 * out landed on a 404 one level above the site and looked like it had failed. */
check('profile sign out redirects within the site', () => {
  const s = read('profile/profile.js');
  assert.ok(s.includes('id="pfSignOut"'), 'sign out button missing');
  assert.ok(!s.includes('location.replace("../index.html")'),
    'sign out still redirects above the site root');
  assert.ok(/location\.replace\(base\(\)\s*\+\s*"index\.html"\)/.test(s),
    'sign out should redirect to base() + index.html');
});

/* Painted before the sync await, so a hanging network call cannot leave someone signed
   in on a shared computer with no way out. */
check('sign out renders before the activity sync await', () => {
  const s = read('profile/profile.js');
  const btn = s.indexOf('id="pfSignOut"');
  const sync = s.indexOf('await A.sync()');
  assert.ok(btn > -1 && sync > -1, 'markers not found');
  assert.ok(btn < sync,
    'identity block must render before the sync await, not after it');
});

/* 4. "owner" is the platform owner, not every hospital's first account.
 *
 * members.role stores "owner" for whoever created an organisation, which is ownership of
 * that hospital's workspace — not of AQcredix. Printed raw it told every customer they
 * owned the platform. */
check('role label distinguishes platform owner from org owner', () => {
  const s = read('profile/profile.js');
  assert.ok(s.includes('function roleLabel('), 'roleLabel helper missing');
  assert.ok(!/esc\(email\)\s*\+\s*\(user\.role\s*\?/.test(s),
    'raw user.role is still being printed after the email');
  assert.ok(/B\.isOwner\(user\)/.test(s),
    'roleLabel must decide ownership from billing isOwner, not from members.role');
  assert.ok(/ORG_ROLE\s*=/.test(s), 'org role mapping missing');
});

check('only the configured owner email can be owner', () => {
  const cfg = read('billing/billing-config.js');
  const owners = cfg.match(/ownerEmails:\s*\[([^\]]*)\]/);
  assert.ok(owners, 'ownerEmails not found');
  const n = (owners[1].match(/"/g) || []).length / 2;
  assert.strictEqual(n, 1, 'expected exactly one owner email, found ' + n);
});

/* 5. Every department carries a risk matrix and a risk register in its quick list, and
 *    inheritance does not duplicate entries. */
check('all departments list risk matrix and risk register', () => {
  const sandbox = { window: {} };
  const vm = require('vm');
  vm.createContext(sandbox);
  vm.runInContext(read('audit/scope-data.js'), sandbox);
  const S = sandbox.window.AUDIT_SCOPE;
  const keys = Object.keys(S);
  assert.ok(keys.length >= 45, 'expected at least 45 departments, got ' + keys.length);
  const missing = keys.filter(k => {
    const q = (S[k].quickList || []).join(' | ');
    return !/Risk matrix/i.test(q) || !/Risk register/i.test(q);
  });
  assert.strictEqual(missing.length, 0,
    'departments without risk matrix/register: ' + missing.join(', '));
});

check('quick list is deduplicated at render', () => {
  const s = read('audit/audit-ui.js');
  assert.ok(/a\.indexOf\(q\) === i/.test(s),
    'quick list should filter duplicates introduced by scope inheritance');
});

/* 6. The severity dropdown's option list must be themed, and the audit rule must not
 *    leave the control transparent — a transparent control is what made the OS draw the
 *    popup white with near-white text. */
check('select option list is themed', () => {
  const s = read('styles.css');
  assert.ok(/select option\s*\{/.test(s), 'select option rule missing');
  assert.ok(/color-scheme:dark/.test(s), 'dark color-scheme missing on select');
  assert.ok(/\[data-theme="light"\]\s*select\{color-scheme:light;\}/.test(s),
    'light theme must not be forced to dark widgets');
  const a = read('audit/audit.css');
  assert.ok(/\.aud-fix select\s*\{[^}]*background:\s*var\(--aud-surface\)/.test(a),
    'severity select must have a real background, not transparent');
});

/* 7. The About page mark rotates about the circle centre.
 *
 * fill-box resolves the origin against the arc's own bounding box, whose centre is about
 * (20, 18.7) rather than (20, 20) — the arc then swings off the ring it should trace. */
check('about page arc rotates about the viewBox centre', () => {
  const s = read('styles.css');
  const block = s.match(/\.aqo-mark \.hero-logo-arc\{[^}]*\}/);
  assert.ok(block, 'aqo-mark arc rule missing');
  assert.ok(/transform-box:view-box/.test(block[0]),
    'arc must use view-box, not fill-box');
  assert.ok(/animation:aq-ring-spin/.test(block[0]), 'arc animation missing');
});

/* 8. The selected language chip is text ON a filled accent, so it takes --on-accent.
 *    This used to assert a literal #FFFFFF, which was correct only while the accent was a
 *    light teal. The accent is a dark cobalt now, and pinning the literal is what let the
 *    chip drift to 2.57:1 against its own background — the token is what has to hold, not
 *    the colour it happens to resolve to today. */
check('active language chip takes its colour from --on-accent', () => {
  const s = read('quote/quote.css');
  assert.ok(s.includes('color:var(--on-accent) !important'),
    'the active chip must use --on-accent, not a literal or the page foreground');
  assert.ok(s.includes('.aq-quote-lang.is-active{background:var(--accent-solid'),
    'and sit on --accent-solid, the accent tuned to carry white text');
});

/* 9. Library card titles are full foreground, not the panel's muted colour. */
check('library card titles use full foreground', () => {
  const s = read('workspace/workspace.css');
  assert.ok(/\.lib-grid \.lib-card b\{[^}]*color:var\(--fg\)/.test(s),
    'lib-card title must win against the workspace panel muted colour');
});

/* 10. Cache busting. Every one of the fixes above is in a CSS or JS file, and a stale
 *     stamp is the difference between fixed-in-repo and fixed-for-the-user. */
check('all local css and js references carry the same version stamp', () => {
  /* set-version.js deliberately skips the standalone visualiser folders (galaxy, brain,
     kpinet and friends) — they are self-contained experiments, not part of the site's
     asset graph. References INTO them are excluded here for the same reason. */
  const STANDALONE = /(galaxy2?|brain|dna|helix|radar|globe|hglobe|kpinet)\//;
  const files = walk(ROOT, /\.html$/);
  const stamps = new Set();
  const unstamped = [];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    const re = /(?:href|src)="([^"]+\.(?:css|js))(\?v=([^"]*))?"/g;
    let m;
    while ((m = re.exec(s))) {
      if (/^https?:|^\/\//.test(m[1])) continue;
      /* Vercel's own endpoints are not our asset graph. /_vercel/insights/script.js is
         served and cache-managed by the platform, so build/set-version.js deliberately
         leaves it alone — asserting a stamp on it here would fail a correct build. */
      if (/^\/_vercel\//.test(m[1])) continue;
      if (STANDALONE.test(m[1]) || STANDALONE.test(path.relative(ROOT, f))) continue;
      if (!m[3]) unstamped.push(path.relative(ROOT, f) + ' -> ' + m[1]);
      else stamps.add(m[3]);
    }
  }
  assert.strictEqual(unstamped.length, 0,
    'unstamped local assets (will be served from cache): ' + unstamped.slice(0, 8).join(', '));
  assert.strictEqual(stamps.size, 1,
    'mixed version stamps across the site: ' + [...stamps].join(', '));
});

if (failures) { console.log('\n' + failures + ' failing'); process.exit(1); }
console.log('display-fixes: all passed');
