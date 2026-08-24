/* Deployment constraints that fail the BUILD rather than a request.
 *
 * These are the worst kind of bug this project can have: they do not break a feature, they
 * break the deploy, which means the last good version stays live and the site silently
 * stops receiving anything new. Both of the checks below have already cost a broken
 * deployment once.
 */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

const root = path.join(__dirname, '..');

// --- twelve Serverless Functions, and not one more ------------------------
/* Vercel Hobby: "No more than 12 Serverless Functions can be added to a Deployment on the
   Hobby plan." Every .js file in api/ is one function. Adding a thirteenth does not fail
   that route — it fails the whole build, and the crash cart release did exactly that.
   The fix when this trips is not to delete a feature: put the logic in a module outside
   api/ and dispatch to it from an existing endpoint, which is what
   workspace/crashcart-alert.js does. A cron path is not a function. */
const fns = fs.readdirSync(path.join(root, 'api')).filter(f => f.endsWith('.js'));
eq(fns.length <= 12, true,
   'api/ holds at most 12 serverless functions (currently ' + fns.length + ': ' +
   fns.join(', ') + ')');

// --- every cron must point at a real function -----------------------------
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
(vercel.crons || []).forEach(c => {
  const file = c.path.split('?')[0].replace(/^\/api\//, '') + '.js';
  eq(fns.indexOf(file) > -1, true, 'cron ' + c.path + ' resolves to api/' + file);
});

// --- and every cron endpoint must accept GET ------------------------------
/* "To trigger a cron job, Vercel makes an HTTP GET request." An endpoint guarded as POST
   only answers 405 to every scheduled run, forever, while still working perfectly when a
   developer tests it by hand with POST. api/digest.js was written that way, so no digest
   was ever actually sent on a schedule and nothing anywhere reported a problem. */
const cronFiles = new Set((vercel.crons || [])
  .map(c => c.path.split('?')[0].replace(/^\/api\//, '') + '.js'));
cronFiles.forEach(f => {
  const src = fs.readFileSync(path.join(root, 'api', f), 'utf8');
  const rejectsGet = /req\.method\s*!==\s*["']POST["']\s*\)/.test(
    src.replace(/\/\*[\s\S]*?\*\//g, ''));
  eq(rejectsGet, false, 'api/' + f + ' does not refuse the GET that a cron sends');
});

// --- a cron must not be answered by a redirect ----------------------------
/* "Cron jobs do not follow redirects. When a cron-triggered endpoint returns a 3xx
   redirect status code, the job completes without further requests." Vercel triggers the
   job against the production deployment URL, and this project redirects everything on the
   accrediq.vercel.app host to aqcredix.com. That catch-all used to match /api/* as well,
   so a cron would have been handed a 308 and finished having done nothing — with a green
   tick in the dashboard and no email. The redirect now excludes /api/. */
(vercel.redirects || []).forEach(r => {
  if (!/:path|\*/.test(r.source)) return;              // not a catch-all
  const body = r.source.replace(/^\/:?[a-z]*/i, '');
  const re = new RegExp('^/(' + (body || '.*').replace(/^\(|\)$/g, '') + ')$');
  (vercel.crons || []).forEach(c => {
    const p = c.path.split('?')[0];
    let caught = false;
    try { caught = re.test(p); } catch (e) { caught = false; }
    eq(caught, false, 'catch-all redirect "' + r.source + '" does not swallow cron ' + p);
  });
});
/* And the substitution token in the destination must exist in the source, or the rewritten
   URL loses the path entirely. */
(vercel.redirects || []).forEach(r => {
  const token = /:([a-z]+)/i.exec(r.destination.replace(/^https?:\/\/[^/]+/, ''));
  if (!token) return;
  eq(r.source.indexOf(':' + token[1]) > -1, true,
     'redirect destination ":' + token[1] + '" is a group that exists in its source');
});

// --- hobby crons may run at most once per day -----------------------------
/* "Cron jobs can only run once per day. Expressions that would run more frequently will
   fail deployment." A minute or hour field of * means more often than daily. */
(vercel.crons || []).forEach(c => {
  const [min, hour] = String(c.schedule).split(/\s+/);
  eq(min !== '*' && hour !== '*' && !min.includes('/') && !hour.includes('/'), true,
     'cron ' + c.schedule + ' runs at most once a day');
});

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
