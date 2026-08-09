/* AQcredix — activity ledger.
 *
 * Records what a signed-in person has done, so the profile page reports real progress.
 * Every feature that completes a piece of work calls AQActivity.record().
 *
 * WHERE IT LIVES
 * The permanent copy is the Supabase `activity` table, keyed on the user. That is what
 * makes progress survive signing out, a cleared cache, a new browser and a different
 * device: a quiz taken on a phone counts when the same account opens the site on the
 * hospital PC. Row-level security means a row is readable only by the account that wrote
 * it — not by colleagues, not by the org's admins, not by anyone lacking that email and
 * password.
 *
 * The browser copy is now a CACHE and an OUTBOX, not the record:
 *   - cache  — the profile page paints immediately from it while the server read is in
 *              flight, and still shows something if the network is down.
 *   - outbox — a write that fails (offline, flaky hospital wifi) is queued and retried on
 *              the next record() or page load, so a quiz finished on a dropped connection
 *              is not silently lost.
 *
 * record() stays synchronous and cannot throw. It is called from inside success paths —
 * a submitted quiz, a saved incident — where an exception would surface to the user as
 * that feature failing. The server write is fired off separately and its failure only
 * ever results in a queued retry.
 *
 * In local mode (no Supabase configured) it degrades to the browser-only behaviour, which
 * is the correct answer when there is no account to attach history to.
 */
(function () {
  "use strict";

  var KEY = "aq-activity-v1";
  var QUEUE_KEY = "aq-activity-queue-v1";
  var MAX_PER_TYPE = 200;
  var TABLE = "activity";

  /* Mirrors the Gmail normalisation in billing.js. Without it the same person signing in
     as s.g.name@gmail.com and sgname@gmail.com would accumulate two separate local
     caches and each would look emptier than the truth. The server is keyed on the user's
     uid, so it is immune to this — this only matters for the cache. */
  function normEmail(raw) {
    var email = String(raw || "").toLowerCase().trim();
    var at = email.lastIndexOf("@");
    if (at < 1) return email;
    var local = email.slice(0, at), domain = email.slice(at + 1);
    var plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
    if (domain === "gmail.com" || domain === "googlemail.com") local = local.replace(/\./g, "");
    return local + "@" + domain;
  }

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }

  function writeAll(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); }
    catch (e) { /* private mode or quota: the server copy is the real one */ }
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") || []; }
    catch (e) { return []; }
  }

  function writeQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-300))); }
    catch (e) { /* best effort */ }
  }

  var _who = "guest";
  var _user = null;
  var _serverLoaded = false;

  function store() { return window.AQStore; }
  function online() {
    var S = store();
    return !!(S && S.mode === "supabase" && S.adapter && _user && _user.id);
  }

  function bucket(all, who) {
    if (!all[who]) all[who] = {};
    return all[who];
  }

  function newId() {
    return "act_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Push one row to the server. Resolves true on success, false on a failure worth
     retrying — never rejects, because callers are in success paths that must not break.
     
     A duplicate-key error counts as SUCCESS. store.js writes with merge-duplicates, but
     the activity table deliberately has no UPDATE policy (history is append-only), so an
     upsert that collides is refused. That collision only happens when retrying a row
     that actually did land the first time and whose response was lost — so the row is
     already safe, and treating it as a failure would queue it for retry forever. */
  async function push(row) {
    if (!online()) return false;
    try {
      await store().adapter.put(TABLE, {
        id: row.id, type: row.type, meta: row.meta || {}, at: row.at
      });
      return true;
    } catch (e) {
      var msg = String((e && e.message) || e).toLowerCase();
      if (msg.indexOf("duplicate") >= 0 || msg.indexOf("23505") >= 0 ||
          msg.indexOf("409") >= 0 || msg.indexOf("conflict") >= 0) return true;
      return false;
    }
  }

  /* Retry anything stranded by an earlier failure.
     
     Attempts are counted and a row is abandoned after MAX_TRIES. Without that, one row
     the server will never accept — a type added by a future version, say — would be
     retried on every page load for the life of the browser profile. */
  var MAX_TRIES = 6;

  async function flush() {
    if (!online()) return;
    var q = readQueue();
    if (!q.length) return;
    var left = [];
    for (var i = 0; i < q.length; i++) {
      var row = q[i];
      var ok = await push(row);
      if (!ok) {
        row.tries = (row.tries || 0) + 1;
        if (row.tries < MAX_TRIES) left.push(row);
      }
    }
    writeQueue(left);
  }

  function cacheLocally(row) {
    var all = readAll();
    var mine = bucket(all, _who);
    var list = mine[row.type] || [];
    // Guard against the same id being cached twice by a retry.
    if (!list.some(function (e) { return e.id === row.id; })) list.push(row);
    mine[row.type] = list.slice(-MAX_PER_TYPE);
    writeAll(all);
  }

  var API = {
    /* Called once the signed-in user is known (billing/page-gate.js and workspace shell).
       Loads the server history into the cache and flushes any queued writes. */
    setUser: function (user) {
      var who = user && user.email ? normEmail(user.email) : "guest";
      _user = user || null;

      if (who !== _who) {
        _who = who;
        if (who !== "guest") {
          // Work done before signing in is kept rather than discarded — otherwise a quiz
          // finished on the landing page vanishes the moment the person logs in.
          var all = readAll();
          var guest = all.guest;
          if (guest && Object.keys(guest).length) {
            var mine = bucket(all, who);
            Object.keys(guest).forEach(function (type) {
              mine[type] = (mine[type] || []).concat(guest[type]).slice(-MAX_PER_TYPE);
            });
            delete all.guest;
            writeAll(all);
            // and send it up, so it is permanent from here on
            Object.keys(mine).forEach(function (type) {
              (mine[type] || []).forEach(function (e) {
                if (!e.id) return;
                var q = readQueue();
                q.push({ id: e.id, type: type, meta: e.meta, at: e.at });
                writeQueue(q);
              });
            });
          }
        }
      }

      if (online()) {
        // Fire and forget: the profile page awaits sync() itself when it needs certainty.
        API.sync();
      }
    },

    /* Pull this user's history from the server into the cache. The server is the truth,
       so it replaces the cache rather than merging into it — a cache that only ever grows
       would keep showing work that was recorded on a different account. */
    sync: async function () {
      await flush();
      if (!online()) return false;
      try {
        var rows = await store().adapter.list(TABLE);
        if (!Array.isArray(rows)) return false;
        var mine = {};
        rows.forEach(function (r) {
          if (!r || !r.type) return;
          (mine[r.type] = mine[r.type] || []).push({
            id: r.id, at: r.at || r.created_at, meta: r.meta || {}
          });
        });
        Object.keys(mine).forEach(function (t) {
          mine[t].sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
        });
        var all = readAll();
        all[_who] = mine;
        writeAll(all);
        _serverLoaded = true;
        return true;
      } catch (e) { return false; }
    },

    isServerBacked: function () { return _serverLoaded; },

    /* record(type, meta)
     * Synchronous and exception-free by design. Caches immediately so the UI is correct
     * at once, then sends to the server; a failed send is queued for retry. */
    record: function (type, meta) {
      try {
        if (!type) return;
        var row = { id: newId(), type: type, at: new Date().toISOString(), meta: meta || {} };
        cacheLocally(row);
        if (online()) {
          push(row).then(function (ok) {
            if (!ok) { var q = readQueue(); q.push(row); writeQueue(q); }
          });
        } else if (store() && store().mode === "supabase") {
          // Signed out or offline: hold it so it lands once there is an account again.
          var q = readQueue(); q.push(row); writeQueue(q);
        }
      } catch (e) { /* never let tracking break the thing being tracked */ }
    },

    entries: function (type) {
      var mine = readAll()[_who] || {};
      return (mine[type] || []).slice().reverse();
    },

    count: function (type) {
      var mine = readAll()[_who] || {};
      return (mine[type] || []).length;
    },

    /* Distinct values of meta[field] — "how many different videos", not "how many plays".
       Watching one video ten times is not ten videos watched, and reporting it as such
       would flatter the number in a way the person would notice and stop trusting. */
    distinct: function (type, field) {
      var mine = readAll()[_who] || {};
      var seen = {};
      (mine[type] || []).forEach(function (e) {
        var v = e && e.meta && e.meta[field];
        if (v != null && v !== "") seen[String(v)] = true;
      });
      return Object.keys(seen).length;
    },

    lastAt: function (type) {
      var mine = readAll()[_who] || {};
      var list = mine[type] || [];
      return list.length ? list[list.length - 1].at : null;
    },

    timeline: function () {
      var mine = readAll()[_who] || {};
      var out = [];
      Object.keys(mine).forEach(function (type) {
        (mine[type] || []).forEach(function (e) { out.push({ type: type, at: e.at, meta: e.meta }); });
      });
      out.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
      return out;
    },

    /* Clears the local cache only. The server history is deliberately not deletable from
       the client — see the schema note on the activity table being append-only. */
    clear: function () {
      var all = readAll();
      delete all[_who];
      writeAll(all);
    },

    normEmail: normEmail
  };

  /* The catalogue of things worth tracking. The profile page renders straight from this,
     so adding a feature here (and one record() call at its completion point) is all that
     is needed for it to appear — no edits to the page itself.
     
     `goal` is a soft target used only to draw a progress bar; it is not a limit. */
  API.FEATURES = [
    { key: "quiz_completed",    label: "Daily quizzes attempted",   href: "quiz.html",
      group: "Learning", goal: 30, verb: "quiz" },
    { key: "certificate_earned", label: "Certificates earned",      href: "quiz.html",
      group: "Learning", goal: 10, verb: "certificate", distinctBy: "serial" },
    { key: "video_watched",     label: "Learning videos watched",   href: "videos.html",
      group: "Learning", goal: 12, verb: "video", distinctBy: "id" },
    { key: "gap_saved",         label: "Gap analyses saved",        href: "workspace/workspace.html",
      group: "Readiness", goal: 10, verb: "gap analysis", distinctBy: "day" },
    { key: "mock_audit",        label: "Mock surveys completed",    href: "surveyor.html",
      group: "Readiness", goal: 10, verb: "mock survey" },
    { key: "audit_completed",   label: "Internal audits finished",  href: "workspace/audit.html",
      group: "Readiness", goal: 12, verb: "internal audit" },
    { key: "sop_generated",     label: "SOPs generated",            href: "sop.html",
      group: "Documents", goal: 25, verb: "SOP" },
    { key: "incident_reported", label: "Incidents reported",        href: "workspace/incidents.html",
      group: "Documents", goal: 20, verb: "incident report" },
    { key: "capa_created",      label: "CAPAs raised",              href: "workspace/capa.html",
      group: "Documents", goal: 20, verb: "CAPA" }
  ];

  window.AQActivity = API;
})();
