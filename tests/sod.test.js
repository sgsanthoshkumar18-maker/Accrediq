/* AQcredix — segregation of duties on CAPA verification and closure.
 * Run: node tests/sod.test.js
 */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
function eq(g, w, m) {
  if (g === w) pass++;
  else { fail++; console.log('FAIL: ' + m + ' - got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sql = read('workspace/schema.sql');
const capa = read('workspace/capa.js');

/* ---------------------------- the database rule ----------------------------
   This has to live in the database. page-gate.js controls what a page DISPLAYS, not what
   a determined person can write — so a rule an assessor cares about cannot be a UI rule. */

ok(/create or replace function public\.aq_guard_capa_closure/.test(sql),
   'closure is guarded by a database trigger');
ok(/create trigger capa_sod_trg before update on public\.capa/.test(sql),
   'and the trigger is attached to capa');
ok(/security definer/.test(sql.slice(sql.indexOf('aq_guard_capa_closure'))),
   'the guard runs with definer rights so it cannot be bypassed by role');

// Authorship must be stamped from the JWT, never trusted from the client.
ok(/new\.created_by := coalesce\(new\.created_by, auth\.uid\(\)\)/.test(sql),
   'authorship comes from auth.uid()');
ok(/create or replace function public\.aq_stamp_author/.test(sql), 'stamped by trigger');
ok(/before insert on public\.%I/.test(sql), 'on insert, before the row lands');
['capa', 'incidents', 'audits'].forEach(t => {
  ok(new RegExp("'" + t + "'").test(sql.slice(sql.indexOf('aq_stamp_author'))),
     t + ' records who created the row');
});
ok(/add column if not exists created_by/.test(sql),
   'the column is added idempotently, so an existing project gains it on re-run');

/* Only the TRANSITION into a closing state is guarded. Editing an already-closed row, or
   reopening it, is a different action and belongs to can_edit(). Guarding every update
   would make a closed CAPA uneditable by anyone, including to fix a typo. */
ok(/new\.status in \('verified','closed'\) and coalesce\(old\.status,''\) not in \('verified','closed'\)/.test(sql),
   'only the transition into verified or closed is guarded');

// The rule itself.
ok(/new\.created_by = actor and not public\.is_admin\(\)/.test(sql),
   'the raiser is refused unless they are an admin');
ok(/AQ_SOD: a CAPA cannot be verified or closed by the person who raised it/.test(sql),
   'and the error says why, in words a user could be shown');
ok(/actor is null/.test(sql), 'an unauthenticated write is refused outright');

/* The admin exemption is deliberate and worth pinning: in a small hospital the quality
   manager who raised a finding is sometimes the only person able to verify it, and a rule
   that cannot be satisfied gets worked around rather than followed. The action is still
   attributed. */
ok(/verified_by := coalesce\(new\.verified_by, actor\)/.test(sql),
   'whoever verifies is recorded');
ok(/closed_by\s*:= coalesce\(new\.closed_by, actor\)/.test(sql), 'and whoever closes');

/* ------------------------------ the courtesy layer ------------------------------
   The UI must agree with the database, or a user fills a form and is refused on save. */

ok(/function isMine/.test(capa), 'the page knows which findings are its user\'s own');
ok(/function mayClose/.test(capa), 'and whether closure is permitted');
ok(/W\.isAdmin\(\)/.test(capa), 'with the same admin exemption as the database');
ok(/myUid = me && me\.id/.test(capa), 'the identity is read once at start-up');

// Both write paths are covered — the quick advance button and the full form.
ok(/if \(\(STATUS\[i\] === "verified" \|\| STATUS\[i\] === "closed"\) && !mayClose\(row\)\)/.test(capa),
   'the advance button is guarded');
ok(/data\.status === "closed"\) &&\s*\n?\s*row\.status !== "verified"/.test(capa) ||
   /row\.status !== "verified" && row\.status !== "closed" && !mayClose\(row\)/.test(capa),
   'and so is the save path');

/* Checked against the SAVED status, not the form's: re-saving an already-closed record
   must not be refused, only the transition. */
ok(/row\.status !== "verified" && row\.status !== "closed"/.test(capa),
   'the guard compares against the stored status, so editing a closed row still works');

// Disabled rather than hidden: a missing button reads as a bug.
ok(/is-off/.test(capa) && /\.btn-mini\.is-off|\.is-off\{/.test(read('workspace/workspace.css')),
   'a blocked control is shown disabled');
ok(/title="' \+ esc\(SOD_MSG\)/.test(capa), 'with the reason in its tooltip');
ok(/cursor:not-allowed/.test(read('workspace/workspace.css')), 'and reads as unavailable');

/* The message must be actionable — telling someone they cannot do something without
   telling them what to do instead just moves the problem. */
ok(/Ask a colleague, or an admin, to verify it\./.test(capa),
   'the message says what to do instead');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
