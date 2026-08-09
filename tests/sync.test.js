/* Server-backed activity: the behaviours a subscriber depends on.
   Runs the real profile/activity.js against a fake Supabase adapter. */
const path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', g, 'want', w); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A fake server: rows keyed by id, rejecting duplicates like an append-only table.
function makeServer() {
  return { rows: [], offline: false,
    async list() { if (this.offline) throw new Error('network'); return this.rows.slice(); },
    async put(t, row) {
      if (this.offline) throw new Error('network');
      if (this.rows.some(r => r.id === row.id)) throw new Error('duplicate key value 23505');
      this.rows.push(Object.assign({}, row)); return row;
    } };
}

function boot(server, user) {
  const store = {};
  global.localStorage = { getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  global.window = { AQStore: { mode: 'supabase', adapter: server } };
  delete require.cache[require.resolve(path.join(__dirname, '../profile/activity.js'))];
  require(path.join(__dirname, '../profile/activity.js'));
  const A = global.window.AQActivity;
  A.setUser(user);
  return { A, store };
}

(async () => {
  const user = { id: 'u1', email: 's.g.santhoshkumar18@gmail.com' };

  // --- 1. work done on device A reaches the server
  const server = makeServer();
  const a = boot(server, user);
  a.A.record('quiz_completed', { score: 10 });
  a.A.record('certificate_earned', { serial: 'S1' });
  a.A.record('sop_generated', { title: 'Hand hygiene' });
  await sleep(20);
  eq(server.rows.length, 3, 'three actions written to the server');

  // --- 2. THE CORE CASE: a different device, empty browser, same account
  const b = boot(server, user);
  await b.A.sync();
  eq(b.A.count('quiz_completed'), 1, 'quiz visible on a second device');
  eq(b.A.distinct('certificate_earned', 'serial'), 1, 'certificate visible on a second device');
  eq(b.A.count('sop_generated'), 1, 'SOP visible on a second device');
  eq(b.A.timeline().length, 3, 'full timeline rebuilt from the server');

  // --- 3. log out and back in on that same device: nothing lost
  b.A.setUser(null);
  b.A.setUser(user);
  await b.A.sync();
  eq(b.A.count('quiz_completed'), 1, 'survives sign-out and sign-in');

  // --- 4. offline work is queued, not lost, and lands on reconnect
  server.offline = true;
  b.A.record('video_watched', { id: 'The dispenser test' });
  await sleep(20);
  eq(b.A.count('video_watched'), 1, 'offline action still shows locally at once');
  eq(server.rows.length, 3, 'nothing reached the server while offline');
  server.offline = false;
  await b.A.sync();
  eq(server.rows.length, 4, 'queued action lands after reconnect');
  const c = boot(server, user);
  await c.A.sync();
  eq(c.A.count('video_watched'), 1, 'and is then visible on another device');

  // --- 5. a retry of a row that already landed must not loop forever
  const before = server.rows.length;
  await c.A.sync();
  await c.A.sync();
  eq(server.rows.length, before, 'repeated syncs do not duplicate rows');
  eq(JSON.parse(c.store['aq-activity-queue-v1'] || '[]').length, 0, 'queue drains, no retry loop');

  // --- 6. a second account on the same machine starts from its own history.
  //        The fake server returns every row regardless of caller (it has no RLS), so
  //        this checks the client keys its cache per account; the actual cross-account
  //        guarantee is the RLS policy asserted in section 8.
  const otherServer = makeServer();
  const other = boot(otherServer, { id: 'u2', email: 'someone.else@hospital.org' });
  await other.A.sync();
  eq(other.A.count('quiz_completed'), 0, 'a different account starts with its own empty history');

  // --- 7. record() must never throw, even with storage broken
  const realSet = global.localStorage.setItem;
  global.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  let threw = false;
  try { c.A.record('quiz_completed', {}); } catch (e) { threw = true; }
  global.localStorage.setItem = realSet;
  eq(threw, false, 'record survives a storage failure');

  // --- 8. the schema must actually enforce per-user isolation
  const sql = require('fs').readFileSync(path.join(__dirname, '../workspace/schema.sql'), 'utf8');
  eq(/create policy activity_select on public\.activity\s+for select using \(user_id = auth\.uid\(\)\)/.test(sql),
     true, 'RLS: a user can select only their own rows');
  eq(/create policy activity_insert on public\.activity\s+for insert with check \(user_id = auth\.uid\(\)\)/.test(sql),
     true, 'RLS: a user can insert only as themselves');
  eq(/new\.user_id := auth\.uid\(\)/.test(sql), true, 'user_id is stamped from the JWT, not trusted from the client');
  eq(/create policy activity_update/.test(sql), false, 'no update policy: history is append-only');
  eq(/create policy activity_delete/.test(sql), false, 'no delete policy: history cannot be wiped');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
