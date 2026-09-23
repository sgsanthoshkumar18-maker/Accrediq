/* AQcredix — group quiz, the participant's screen.
 *
 * A phone, held by somebody sitting in a room looking mostly at a projector.
 * So: no account, no reading, buttons big enough to hit without looking, and
 * nothing on screen that the wall is already showing better.
 *
 * It polls rather than holding a socket open. A quiz has one state change every
 * twenty seconds or so, all of them triggered by the host, and a poll every
 * second and a half is both fast enough to feel immediate and robust to the
 * hospital wifi dropping for a moment — a dropped socket needs reconnection
 * logic, a dropped poll just misses one beat.
 *
 * The countdown runs locally off the start time the server published, corrected
 * for how far this phone's clock is out. Without that correction a phone forty
 * seconds fast shows every question as already expired.
 */
(function () {
  "use strict";

  var G = window.AQGroupQuiz;
  var root, code = "", playerId = null, myName = "";
  var poll = null, tick = null, lastPhase = null, lastQ = -2, answered = false;

  var KEY = "aq_quiz_player_v1";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function stopTimers() {
    if (poll) { clearInterval(poll); poll = null; }
    if (tick) { clearInterval(tick); tick = null; }
  }

  /* Remembering the seat matters more here than it looks. Phones lock, browsers
     evict background tabs, and somebody who taps away mid-quiz must come back
     as themselves rather than as a second player on nought. Stored per code, so
     a second quiz in the same session does not inherit the first one's seat. */
  function saveSeat() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ code: code, id: playerId, name: myName }));
    } catch (e) {}
  }
  function loadSeat(forCode) {
    try {
      var s = JSON.parse(sessionStorage.getItem(KEY) || "null");
      return (s && s.code === forCode) ? s : null;
    } catch (e) { return null; }
  }

  /* ---------------- Join ---------------- */

  function renderJoin(prefill, err) {
    stopTimers();
    root.innerHTML =
      '<div class="gp-join">' +
        '<h2 class="gp-h">Join the quiz</h2>' +
        '<p class="gp-sub">Enter the code on the screen, and the name you want on the ' +
          "leaderboard.</p>" +
        (err ? '<p class="gp-err">' + esc(err) + "</p>" : "") +
        '<label class="gp-f"><span>Join code</span>' +
          '<input type="text" id="gpCode" class="gp-code-in" maxlength="6" autocapitalize="characters" ' +
          'autocomplete="off" spellcheck="false" inputmode="text" value="' + esc(prefill || "") + '"></label>' +
        '<label class="gp-f"><span>Your name</span>' +
          '<input type="text" id="gpName" maxlength="40" autocomplete="name" ' +
          'placeholder="How you should appear" value="' + esc(myName) + '"></label>' +
        '<button type="button" class="gp-btn" id="gpGo">Join</button>' +
      "</div>";

    var codeIn = document.getElementById("gpCode");
    codeIn.addEventListener("input", function () {
      /* Uppercase as they type. The codes are shown uppercase and the server
         uppercases anyway, but a field that visibly disagrees with the wall
         makes people think they have mistyped. */
      var p = this.selectionStart;
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      this.setSelectionRange(p, p);
    });
    document.getElementById("gpGo").addEventListener("click", doJoin);
    root.querySelectorAll("input").forEach(function (i) {
      i.addEventListener("keydown", function (e) { if (e.key === "Enter") doJoin(); });
    });
    (prefill ? document.getElementById("gpName") : codeIn).focus();
  }

  async function doJoin() {
    var c = document.getElementById("gpCode").value.trim().toUpperCase();
    var n = document.getElementById("gpName").value.trim();
    if (c.length < 4) return renderJoin(c, "That code looks too short.");
    if (!n) return renderJoin(c, "Please put in a name.");

    var btn = document.getElementById("gpGo");
    btn.disabled = true; btn.textContent = "Joining…";
    try {
      var id = await G.join(c, n);
      code = c; playerId = id; myName = n;
      saveSeat();
      startPolling();
    } catch (e) {
      var msg = String(e.message || e);
      /* The server's own words are friendlier than the PostgREST envelope
         around them, which is JSON nobody in a lecture room should be shown. */
      try { msg = JSON.parse(msg).message || msg; } catch (x) {}
      renderJoin(c, msg);
    }
  }

  /* ---------------- The quiz ---------------- */

  function startPolling() {
    stopTimers();
    lastPhase = null; lastQ = -2;
    refresh();
    poll = setInterval(refresh, 1500);
  }

  var lastState = null;

  async function refresh() {
    try {
      var st = await G.state(code, playerId);
      if (!st || !st.ok) { renderMessage("That quiz has ended.", ""); stopTimers(); return; }
      lastState = st;

      /* Re-render only when something actually changed. Repainting every poll
         would wipe the pressed state off a button the moment somebody tapped
         it, and make the whole screen flicker once a second. */
      if (st.phase !== lastPhase || st.currentQ !== lastQ) {
        lastPhase = st.phase; lastQ = st.currentQ;
        answered = st.myChoice != null;
        paint(st);
      } else if (st.phase === "question" && st.myChoice != null && !answered) {
        answered = true;
        paint(st);
      }
    } catch (e) { /* one missed poll is invisible; the next one catches up */ }
  }

  function paint(st) {
    if (tick) { clearInterval(tick); tick = null; }

    if (st.phase === "lobby") {
      renderMessage("You’re in, " + myName + ".",
        "Keep this page open. The first question appears when the host starts.");
      return;
    }
    if (st.phase === "leaderboard") {
      renderMessage("Leaderboard is on the screen.", "Next question coming up.");
      return;
    }
    if (st.phase === "final") { renderFinal(); return; }
    if (st.phase === "reveal") { renderReveal(st); return; }
    if (st.phase === "question") { renderQuestion(st); return; }
    renderMessage("Waiting for the host…", "");
  }

  function renderMessage(title, sub) {
    root.innerHTML =
      '<div class="gp-msg"><h2 class="gp-h">' + esc(title) + "</h2>" +
      (sub ? '<p class="gp-sub">' + esc(sub) + "</p>" : "") + "</div>";
  }

  function renderQuestion(st) {
    var q = st.question;
    if (!q) { renderMessage("Waiting for the host…", ""); return; }

    root.innerHTML =
      '<div class="gp-q">' +
        '<div class="gp-q-top"><span class="gp-q-pos">Question ' + (st.currentQ + 1) +
          " of " + st.total + "</span>" +
          '<span class="gp-timer" id="gpTimer">–</span></div>' +
        '<p class="gp-q-text">' + esc(q.q) + "</p>" +
        '<div class="gp-opts" id="gpOpts">' +
          q.options.map(function (o, oi) {
            return '<button type="button" class="gp-opt" data-o="' + oi + '">' +
              '<span class="gp-letter">' + "ABCDEFGH".charAt(oi) + "</span>" +
              '<span class="gp-opt-t">' + esc(o) + "</span></button>";
          }).join("") +
        "</div>" +
        '<p class="gp-state" id="gpState"></p>' +
      "</div>";

    if (st.myChoice != null) lockIn(st.myChoice);
    else {
      root.querySelectorAll(".gp-opt").forEach(function (b) {
        b.addEventListener("click", function () { choose(+b.getAttribute("data-o"), st.currentQ); });
      });
    }

    var t = document.getElementById("gpTimer");
    tick = setInterval(function () {
      var left = G.remaining(lastState);
      t.textContent = left;
      t.classList.toggle("is-low", left <= 5);
      if (left <= 0) {
        clearInterval(tick); tick = null;
        /* Time is up: stop offering buttons that the server will now refuse.
           Leaving them live and having the tap silently fail is worse than
           saying so. */
        if (!answered) {
          document.getElementById("gpState").textContent = "Time’s up.";
          root.querySelectorAll(".gp-opt").forEach(function (b) { b.disabled = true; });
        }
      }
    }, 250);
  }

  function lockIn(choice) {
    answered = true;
    root.querySelectorAll(".gp-opt").forEach(function (b) {
      b.disabled = true;
      b.classList.toggle("is-mine", +b.getAttribute("data-o") === choice);
    });
    var s = document.getElementById("gpState");
    /* Deliberately does not say whether it was right — the host controls the
       reveal, and a phone that gives it away early ruins the room. */
    if (s) s.textContent = "Answer locked in. Watch the screen.";
  }

  async function choose(oi, qIndex) {
    if (answered) return;
    answered = true;
    lockIn(oi);
    try {
      var res = await G.answer(playerId, qIndex, oi);
      if (res && !res.ok) {
        var s = document.getElementById("gpState");
        if (s) {
          s.textContent = res.reason === "too_late"
            ? "That came in after time. Not counted."
            : "That question has closed.";
        }
      }
    } catch (e) {
      var s2 = document.getElementById("gpState");
      if (s2) s2.textContent = "Could not send that — check your connection.";
      answered = false;
      root.querySelectorAll(".gp-opt").forEach(function (b) { b.disabled = false; });
    }
  }

  function renderReveal(st) {
    var q = st.question;
    if (!q) { renderMessage("Waiting…", ""); return; }
    var right = st.answer;
    var mine = st.myChoice;
    var gotIt = mine != null && mine === right;

    root.innerHTML =
      '<div class="gp-q gp-reveal">' +
        '<div class="gp-verdict ' + (mine == null ? "is-none" : gotIt ? "is-right" : "is-wrong") + '">' +
          (mine == null ? "No answer" : gotIt ? "Correct" : "Not this time") + "</div>" +
        '<p class="gp-q-text">' + esc(q.q) + "</p>" +
        '<div class="gp-opts">' +
          q.options.map(function (o, oi) {
            var cls = "gp-opt is-locked";
            if (oi === right) cls += " is-right";
            else if (oi === mine) cls += " is-wrong";
            else cls += " is-dim";
            return '<div class="' + cls + '">' +
              '<span class="gp-letter">' + "ABCDEFGH".charAt(oi) + "</span>" +
              '<span class="gp-opt-t">' + esc(o) + "</span></div>";
          }).join("") +
        "</div>" +
      "</div>";
  }

  async function renderFinal() {
    stopTimers();
    root.innerHTML = '<div class="gp-msg"><h2 class="gp-h">That’s the quiz.</h2>' +
      '<p class="gp-sub">Final leaderboard is on the screen.</p></div>';
    try {
      var data = await G.leaderboard(code, 8);
      var rows = (data && data.rows) || [];
      var mineIdx = -1;
      rows.forEach(function (r, i) { if (r.id === playerId) mineIdx = i; });
      root.innerHTML =
        '<div class="gp-final">' +
          '<h2 class="gp-h">That’s the quiz.</h2>' +
          (mineIdx >= 0
            ? '<p class="gp-sub">You finished <b>' + (mineIdx + 1) + "</b> of " +
              rows.length + ".</p>"
            : '<p class="gp-sub">Final leaderboard is on the screen.</p>') +
          '<ol class="gp-rank">' +
            rows.map(function (r, i) {
              return '<li class="gp-rank-row' + (r.id === playerId ? " is-me" : "") + '">' +
                '<span class="gp-pos">' + (i + 1) + "</span>" +
                '<span class="gp-pname">' + esc(r.name) + "</span>" +
                '<span class="gp-pscore">' + r.score + "</span></li>";
            }).join("") +
          "</ol>" +
          (mineIdx >= 0 && mineIdx < 3
            ? '<p class="gp-cert-note">Top three — your certificate is with the host.</p>'
            : "") +
        "</div>";
    } catch (e) { /* the message above is already a complete ending */ }
  }

  /* ---------------- Boot ---------------- */

  function init() {
    root = document.getElementById("gpRoot");
    if (!root) return;

    /* A QR scan lands here with the code already in the URL, which is the whole
       point of the QR — the participant should not have to type anything they
       can avoid. */
    var url = new URLSearchParams(location.search);
    var prefill = (url.get("c") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

    var seat = prefill ? loadSeat(prefill) : null;
    if (seat) {
      code = seat.code; playerId = seat.id; myName = seat.name;
      startPolling();
      return;
    }
    renderJoin(prefill, "");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
