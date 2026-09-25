/* AQcredix — group quiz: everything that talks to the server.
 *
 * Kept apart from the two interfaces (host and player) because they share every
 * call but look nothing alike, and because the security reasoning is easier to
 * check when it is in one file. The short version: the host is signed in and
 * reads its own session row directly under RLS; participants are anonymous and
 * never touch a table, only the four aq_quiz_* functions, which decide what
 * they are allowed to see. The correct answers are not among it.
 */
window.AQGroupQuiz = (function () {
  "use strict";

  var S = window.AQStore;

  /* No O/0 and no I/1/L. A join code gets read off a projector at the back of a
     lecture room and typed on a phone; every ambiguous glyph is somebody
     failing to join and blaming the wifi. */
  var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  function newCode(len) {
    var out = "", n = len || 6;
    var buf = new Uint32Array(n);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(buf);
      for (var i = 0; i < n; i++) out += ALPHABET.charAt(buf[i] % ALPHABET.length);
    } else {
      for (var j = 0; j < n; j++) {
        out += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
      }
    }
    return out;
  }

  function rpc(fn, args) { return S.adapter.rpc(fn, args); }

  /* ---------------- Host ---------------- */

  /* A fresh code every time, as asked. Codes are reused across the life of the
     site — six characters is 887 million combinations, but only among sessions
     that are still open — so a collision is caught by the unique index and
     retried rather than assumed away. */
  async function create(opts) {
    var user = await S.adapter.currentUser();
    if (!user) throw new Error("Sign in to host a quiz");

    var questions = (opts.questions || []).map(function (q) {
      return { q: q.q, options: q.options.slice() };
    });
    var key = (opts.questions || []).map(function (q) { return q.a; });

    var lastErr = null;
    for (var attempt = 0; attempt < 6; attempt++) {
      var row = {
        code: newCode(6),
        title: opts.title,
        hospital: opts.hospital || null,
        host_id: user.id,
        questions: questions,
        answer_key: key,
        seconds_per_q: opts.secondsPerQ || 20,
        phase: "lobby",
        current_q: -1
      };
      try {
        var saved = await S.adapter.insert("quiz_sessions", row);
        return saved;
      } catch (e) {
        lastErr = e;
        /* 23505 is the unique violation. Anything else is a real failure and
           retrying it would just be six identical errors. */
        if (String(e.message || e).indexOf("23505") === -1 &&
            String(e.message || e).toLowerCase().indexOf("duplicate") === -1) throw e;
      }
    }
    throw lastErr || new Error("Could not allocate a join code");
  }

  function advance(sessionId, patch) {
    return S.adapter.patch("quiz_sessions", sessionId, patch);
  }

  /* The host's own view. Reads the table directly, which RLS allows only for
     the row whose host_id is this user — and which carries the answer key,
     because the host is the one putting it on the projector. */
  async function hostSession(sessionId) {
    var rows = await S.adapter.select("quiz_sessions", "id=eq." + sessionId);
    return rows[0] || null;
  }

  function players(sessionId) {
    return S.adapter.select("quiz_players", "session_id=eq." + sessionId + "&order=joined_at.asc");
  }

  /* Quizzes this host started and has not finished. RLS already limits the
     table to rows whose host_id is this user, so the filters here are about
     which of their OWN quizzes are still worth offering: open, and not already
     played to the end. Without this a host who closed the tab after creating a
     quiz had no route back to it at all — the code was live, the lobby was
     filling, and the only screen that could drive it was gone. */
  function myQuizzes() {
    return S.adapter.select("quiz_sessions",
      "closed_at=is.null&phase=neq.final&order=created_at.desc&limit=10");
  }

  /* Ends a quiz without deleting it. closed_at is what every participant-facing
     function checks, so this drops the lobby and frees the host's list in one
     write, while the answers stay for anyone who wants the results later. */
  function closeQuiz(sessionId) {
    return S.adapter.patch("quiz_sessions", sessionId, { closed_at: new Date().toISOString() });
  }

  /* ---------------- Participant ---------------- */

  async function join(code, name) {
    return await rpc("aq_quiz_join", { p_code: code, p_name: name });
  }

  async function state(code, playerId) {
    return await rpc("aq_quiz_state", { p_code: code, p_player: playerId || null });
  }

  async function answer(playerId, qIndex, choice) {
    return await rpc("aq_quiz_answer", { p_player: playerId, p_q: qIndex, p_choice: choice });
  }

  async function leaderboard(code, limit) {
    return await rpc("aq_quiz_leaderboard", { p_code: code, p_limit: limit || 8 });
  }

  /* ---------------- Shared helpers ---------------- */

  /* How much of this question is left, in seconds.
   *
   * Computed from the server's clock, not the device's. A phone that is forty
   * seconds fast would otherwise show a timer already expired, and the
   * participant would never see the question at all. The offset is measured
   * once per poll and applied to the countdown, so the whole room counts down
   * together regardless of what their phones think the time is.
   */
  function remaining(st) {
    if (!st || !st.startedAt || !st.secondsPerQ) return 0;
    var started = new Date(st.startedAt).getTime();
    var serverNow = new Date(st.serverNow).getTime();
    var skew = Date.now() - serverNow;          // device ahead of server by this much
    var elapsed = (Date.now() - skew) - started;
    return Math.max(0, Math.ceil((st.secondsPerQ * 1000 - elapsed) / 1000));
  }

  /* The join URL a participant's camera resolves. Built from the page's own
     origin so it is right on the live site, on a preview deployment and on a
     laptop serving the folder, without anybody remembering to change it. */
  function joinUrl(code) {
    return location.origin + "/quiz/join?c=" + encodeURIComponent(code);
  }

  return {
    newCode: newCode,
    create: create,
    advance: advance,
    hostSession: hostSession,
    players: players,
    myQuizzes: myQuizzes,
    closeQuiz: closeQuiz,
    join: join,
    state: state,
    answer: answer,
    leaderboard: leaderboard,
    remaining: remaining,
    joinUrl: joinUrl
  };
})();
