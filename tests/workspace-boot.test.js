/* EVERY WORKSPACE PAGE MUST ACTUALLY OPEN.
 *
 * The workspace shell renders a loading placeholder and leaves it there until somebody calls
 * the gate — and the gate is what clears it. A page module that forgets to call it does not
 * fail loudly: the page sits shimmering for twelve seconds and then replaces itself with
 * "This is taking longer than it should. The workspace could not reach the server", on a page
 * whose server answered immediately. Nothing in the console, nothing in the network tab, and
 * the message actively points the reader at the wrong cause.
 *
 * That is what happened to quality-dashboard.js, and it is invisible to every other kind of
 * test, so the boot sequence is asserted here for all of them at once.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', JSON.stringify(g), 'want', JSON.stringify(w)); } };

/* A workspace page is one that renders the shell's skeleton and gate. Discovered rather than
   listed, so a page added next month is covered without anyone remembering to add it here. */
const pages = fs.readdirSync(path.join(ROOT, 'workspace'))
  .filter(f => f.endsWith('.html'))
  .filter(f => {
    const h = fs.readFileSync(path.join(ROOT, 'workspace', f), 'utf8');
    return /id="wsSkel"/.test(h) && /id="wsGate"/.test(h);
  });

eq(pages.length > 5, true, 'the workspace pages were found (' + pages.length + ')');

pages.forEach(page => {
  const html = fs.readFileSync(path.join(ROOT, 'workspace', page), 'utf8');

  /* Which local module drives this page? The one script it loads from workspace/ that is not
     shared plumbing. */
  const scripts = [...html.matchAll(/<script src="([^"]+)\?v=[^"]*"><\/script>/g)]
    .map(m => m[1])
    .filter(s => !s.startsWith('../') && s.endsWith('.js'));

  /* Plumbing every workspace page loads. readiness.js is deliberately NOT here: it looks like
     shared code and is in fact the driver for workspace.html, which is exactly the sort of
     thing an exclusion list gets wrong — listing it made this check pass a page it had not
     actually looked at. */
  const SHARED = ['config.js', 'auth-gate.js', 'store.js', 'pin.js', 'shell.js', 'digest.js',
                  'bell.js', 'attach.js', 'library-data.js', 'wsearch.js', 'device.js',
                  'device-ui.js', 'aq-charts.js', 'shortexpiry.js'];
  const own = scripts.filter(s => SHARED.indexOf(s) === -1);
  if (!own.length) return;                       // a page with no module of its own

  /* At least one of its own modules must run the boot sequence. Several pages load a helper
     alongside the driver (an Excel writer, a renderer), and only the driver gates. */
  const sources = own.map(s => {
    try { return fs.readFileSync(path.join(ROOT, 'workspace', s), 'utf8'); }
    catch (e) { return ''; }
  });
  const joined = sources.join('\n');

  eq(/await W\.gate\(\)/.test(joined), true,
     page + ' never calls W.gate() — its placeholder is never cleared and the page dies at ' +
     'the shell\'s twelve-second timeout with a message blaming the server');
  eq(/getElementById\("wsBody"\)/.test(joined), true,
     page + ' never reveals #wsBody, so the page stays blank behind the placeholder');
  eq(/clearSkeleton/.test(joined), true,
     page + ' never clears the loading placeholder');
});

/* And the shell must clear it on the SIGNED-OUT exit too. Every workspace page used to leave
   a shimmering skeleton beside its own sign-in form, which then became "could not reach the
   server" — the gate had already answered, and answered correctly. */
{
  const shell = fs.readFileSync(path.join(ROOT, 'workspace/shell.js'), 'utf8');
  const gate = shell.slice(shell.indexOf('async gate()'));
  const signedOut = gate.slice(gate.indexOf('var host = document.getElementById("wsGate")'));
  eq(/W\.clearSkeleton\(\)/.test(signedOut.slice(0, 1200)), true,
     'the signed-out path clears the placeholder, as gate()\'s own comment promises');
}

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
