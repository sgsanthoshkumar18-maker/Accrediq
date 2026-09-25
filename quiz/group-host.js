/* AQcredix — group quiz, the host's screen.
 *
 * This is the one that goes on the projector, so it is built for a room rather
 * than for a desk: big type, one thing happening at a time, and every control
 * the host needs on the same screen as the thing it controls. The host is
 * usually standing up, holding a clicker, talking.
 *
 * Four states, in order: setup (write the quiz), lobby (people join), running
 * (question, reveal, leaderboard, repeating), and done (final board and
 * certificates). The running state is driven entirely by the host pressing
 * Next — nothing advances on a timer, because a room needs the host to be able
 * to stop and explain an answer for two minutes without the quiz running off
 * without them.
 */
(function () {
  "use strict";

  var G = window.AQGroupQuiz;
  var root, session = null, poll = null, tick = null;
  var draft = { title: "", hospital: "", secondsPerQ: 20, questions: [] };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function stopTimers() {
    if (poll) { clearInterval(poll); poll = null; }
    if (tick) { clearInterval(tick); tick = null; }
  }

  /* ============================ SETUP ============================ */

  function blankQuestion() {
    /* Two options by default, as asked, with a button to add more. Two is the
       floor a question can work at (true/false) and anything more is a guess
       about what this particular question needs. */
    return { q: "", options: ["", ""], a: 0 };
  }

  function renderSetup() {
    stopTimers();
    if (!draft.questions.length) draft.questions.push(blankQuestion());

    root.innerHTML =
      '<div class="gq-setup">' +
        '<h2 class="gq-h">Set up your quiz</h2>' +
        '<p class="gq-sub">Everyone answers on their own phone. You control when each ' +
          "question opens and when the answer is shown.</p>" +
        '<div class="gq-fields">' +
          '<label class="gq-f gq-f-wide"><span>Quiz title</span>' +
            '<input type="text" id="gqTitle" maxlength="80" placeholder="e.g. Infection control refresher — March" ' +
            'value="' + esc(draft.title) + '"></label>' +
          '<label class="gq-f gq-f-wide"><span>Hospital name</span>' +
            '<input type="text" id="gqHospital" maxlength="80" placeholder="Printed on the certificates" ' +
            'value="' + esc(draft.hospital) + '"></label>' +
          '<label class="gq-f"><span>Seconds per question</span>' +
            '<input type="number" id="gqSeconds" min="5" max="120" value="' + draft.secondsPerQ + '"></label>' +
        "</div>" +
        '<div id="gqQs"></div>' +
        '<div class="gq-setup-foot">' +
          '<button type="button" class="gq-btn gq-btn-ghost" id="gqAddQ">Add a question</button>' +
          '<span class="gq-spacer"></span>' +
          '<button type="button" class="gq-btn gq-btn-go" id="gqStart">Create the quiz</button>' +
        "</div>" +
        '<p class="gq-err" id="gqErr" hidden></p>' +
      "</div>";

    renderQuestions();

    document.getElementById("gqTitle").addEventListener("input", function () { draft.title = this.value; });
    document.getElementById("gqHospital").addEventListener("input", function () { draft.hospital = this.value; });
    document.getElementById("gqSeconds").addEventListener("input", function () {
      draft.secondsPerQ = parseInt(this.value, 10) || 20;
    });
    document.getElementById("gqAddQ").addEventListener("click", function () {
      draft.questions.push(blankQuestion());
      renderQuestions();
      var cards = root.querySelectorAll(".gq-q");
      var last = cards[cards.length - 1];
      if (last) {
        last.scrollIntoView({ behavior: "smooth", block: "center" });
        var inp = last.querySelector("textarea");
        if (inp) inp.focus();
      }
    });
    document.getElementById("gqStart").addEventListener("click", createQuiz);
  }

  function renderQuestions() {
    var host = document.getElementById("gqQs");
    host.innerHTML = draft.questions.map(function (q, qi) {
      return '<div class="gq-q" data-q="' + qi + '">' +
        '<div class="gq-q-top"><span class="gq-q-n">Question ' + (qi + 1) + "</span>" +
          (draft.questions.length > 1
            ? '<button type="button" class="gq-x" data-del="' + qi + '" aria-label="Remove question ' +
              (qi + 1) + '">Remove</button>'
            : "") +
        "</div>" +
        '<textarea class="gq-q-text" data-qt="' + qi + '" rows="2" maxlength="400" ' +
          'placeholder="Type the question">' + esc(q.q) + "</textarea>" +
        '<p class="gq-q-hint">Tick the circle beside the correct answer.</p>' +
        '<div class="gq-opts">' +
          q.options.map(function (o, oi) {
            return '<div class="gq-opt' + (q.a === oi ? " is-right" : "") + '">' +
              '<button type="button" class="gq-mark" data-mark="' + qi + ":" + oi + '" ' +
                'role="radio" aria-checked="' + (q.a === oi) + '" ' +
                'aria-label="Mark option ' + "ABCDEFGH".charAt(oi) + ' correct"><span></span></button>' +
              '<span class="gq-letter">' + "ABCDEFGH".charAt(oi) + "</span>" +
              '<input type="text" class="gq-opt-in" data-opt="' + qi + ":" + oi + '" maxlength="200" ' +
                'placeholder="Option ' + "ABCDEFGH".charAt(oi) + '" value="' + esc(o) + '">' +
              (q.options.length > 2
                ? '<button type="button" class="gq-x gq-x-sm" data-delopt="' + qi + ":" + oi +
                  '" aria-label="Remove option">&times;</button>'
                : "") +
            "</div>";
          }).join("") +
        "</div>" +
        (q.options.length < 8
          ? '<button type="button" class="gq-add-opt" data-addopt="' + qi + '">+ Add option</button>'
          : "") +
      "</div>";
    }).join("");

    host.querySelectorAll("[data-qt]").forEach(function (t) {
      t.addEventListener("input", function () {
        draft.questions[+t.getAttribute("data-qt")].q = t.value;
      });
    });
    host.querySelectorAll("[data-opt]").forEach(function (i) {
      i.addEventListener("input", function () {
        var p = i.getAttribute("data-opt").split(":");
        draft.questions[+p[0]].options[+p[1]] = i.value;
      });
    });
    host.querySelectorAll("[data-mark]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.getAttribute("data-mark").split(":");
        draft.questions[+p[0]].a = +p[1];
        renderQuestions();
      });
    });
    host.querySelectorAll("[data-addopt]").forEach(function (b) {
      b.addEventListener("click", function () {
        draft.questions[+b.getAttribute("data-addopt")].options.push("");
        renderQuestions();
      });
    });
    host.querySelectorAll("[data-delopt]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.getAttribute("data-delopt").split(":");
        var q = draft.questions[+p[0]], oi = +p[1];
        q.options.splice(oi, 1);
        /* Removing the option that was marked correct must not silently leave
           the mark pointing at a different answer than the host chose. */
        if (q.a === oi) q.a = 0;
        else if (q.a > oi) q.a--;
        renderQuestions();
      });
    });
    host.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        draft.questions.splice(+b.getAttribute("data-del"), 1);
        renderQuestions();
      });
    });
  }

  function showErr(msg) {
    var e = document.getElementById("gqErr");
    if (!e) { alert(msg); return; }
    e.hidden = false;
    e.textContent = msg;
    e.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function createQuiz() {
    if (!draft.title.trim()) return showErr("Give the quiz a title — it goes on the certificates.");
    if (draft.secondsPerQ < 5 || draft.secondsPerQ > 120) {
      return showErr("Seconds per question needs to be between 5 and 120.");
    }
    for (var i = 0; i < draft.questions.length; i++) {
      var q = draft.questions[i];
      if (!q.q.trim()) return showErr("Question " + (i + 1) + " has no text.");
      var filled = q.options.filter(function (o) { return o.trim(); });
      if (filled.length < 2) return showErr("Question " + (i + 1) + " needs at least two options.");
      if (!q.options[q.a] || !q.options[q.a].trim()) {
        return showErr("Question " + (i + 1) + ": mark which option is correct.");
      }
    }

    var btn = document.getElementById("gqStart");
    btn.disabled = true; btn.textContent = "Creating…";
    try {
      /* Trim here rather than as they type, so a trailing space does not fight
         the cursor while somebody is still writing. */
      session = await G.create({
        title: draft.title.trim(),
        hospital: draft.hospital.trim(),
        secondsPerQ: draft.secondsPerQ,
        questions: draft.questions.map(function (q) {
          var opts = q.options.map(function (o) { return o.trim(); });
          var keep = [], newA = 0;
          opts.forEach(function (o, oi) {
            if (!o) return;
            if (oi === q.a) newA = keep.length;
            keep.push(o);
          });
          return { q: q.q.trim(), options: keep, a: newA };
        })
      });
      renderLobby();
    } catch (e) {
      btn.disabled = false; btn.textContent = "Create the quiz";
      showErr(String(e.message || e));
    }
  }

  /* ============================ LOBBY ============================ */

  function renderLobby() {
    stopTimers();
    var url = G.joinUrl(session.code);
    var qr = "";
    try {
      qr = window.AQQR.svg(url, { ecl: "M", margin: 2 });
    } catch (e) {
      /* A missing QR is survivable — the code is right beside it in large type
         and can always be typed. Losing the whole lobby is not. */
      qr = '<p class="gq-qr-fail">Scan code unavailable — type the join code instead.</p>';
    }

    root.innerHTML =
      '<div class="gq-lobby">' +
        '<p class="gq-eyebrow">' + esc(session.title) + "</p>" +
        '<h2 class="gq-h">Join at <span class="gq-url">' + esc(location.host) + "/quiz/join</span></h2>" +
        '<div class="gq-join-row">' +
          '<div class="gq-qr">' + qr + "</div>" +
          '<div class="gq-code-box"><span class="gq-code-label">Join code</span>' +
            '<span class="gq-code">' + esc(session.code) + "</span></div>" +
        "</div>" +
        '<div class="gq-lobby-foot">' +
          /* The roll call. The host reads this against their own attendance
             list and chases whoever is missing, so it is a list of names
             first and a count second — a number alone cannot tell you WHO
             has not joined, which is the only question being asked here. */
          '<div class="gq-roll">' +
            '<div class="gq-roll-top">' +
              '<p class="gq-count"><b id="gqN">0</b> <span id="gqNLabel">people have joined</span></p>' +
              '<div class="gq-roll-tools">' +
                '<button type="button" class="gq-chip" id="gqSort">Joined order</button>' +
                '<button type="button" class="gq-chip" id="gqCopy">Copy list</button>' +
              "</div>" +
            "</div>" +
            '<ol id="gqNames" class="gq-names"></ol>' +
            '<p id="gqEmpty" class="gq-roll-empty">Names appear here the moment somebody joins.</p>' +
          "</div>" +
          '<button type="button" class="gq-btn gq-btn-go" id="gqBegin" disabled>Start the quiz</button>' +
          '<p class="gq-note">' + draft.questions.length + " question" +
            (draft.questions.length === 1 ? "" : "s") + " · " + session.seconds_per_q +
            " seconds each</p>" +
        "</div>" +
      "</div>";

    document.getElementById("gqBegin").addEventListener("click", function () { openQuestion(0); });

    document.getElementById("gqSort").addEventListener("click", function () {
      /* Joined order shows arrivals as they happen; A–Z is what you want when
         checking against a register that is itself alphabetical. */
      roll.sort = roll.sort === "joined" ? "az" : "joined";
      this.textContent = roll.sort === "joined" ? "Joined order" : "A – Z";
      roll.sig = "";                      // force a repaint in the new order
      paintRoll();
    });

    document.getElementById("gqCopy").addEventListener("click", function () {
      var txt = orderedNames().map(function (p, i) { return (i + 1) + ". " + p.name; }).join("\n");
      var btn = this, was = "Copy list";
      function done(ok) {
        btn.textContent = ok ? "Copied" : "Press Ctrl+C";
        setTimeout(function () { btn.textContent = was; }, 1800);
      }
      /* navigator.clipboard is unavailable over plain http and on older
         Safari, which is exactly the laptop a hospital lecture room has.
         The textarea fallback is not legacy cruft — it is the path that
         will actually run on some of these machines. */
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { done(true); },
                                                function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        var ok = false;
        try {
          var ta = document.createElement("textarea");
          ta.value = txt;
          ta.setAttribute("readonly", "");
          ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        } catch (e) { ok = false; }
        if (ok) { done(true); return; }
        /* Both copy routes refused. Telling somebody to press Ctrl+C is only
           useful if something is actually selected, so select the list itself
           and say so. */
        try {
          var sel = window.getSelection();
          var range = document.createRange();
          range.selectNodeContents(document.getElementById("gqNames"));
          sel.removeAllRanges();
          sel.addRange(range);
          btn.textContent = "Selected — Ctrl+C";
          setTimeout(function () { btn.textContent = was; }, 2600);
        } catch (e) { done(false); }
      }
    });

    /* Poll for arrivals. Slower than the in-quiz poll on purpose: a lobby is
       people drifting in over a couple of minutes, not a live scoreboard. */
    refreshLobby();
    poll = setInterval(refreshLobby, 2500);
  }

  /* Roll-call state lives outside the poll. The list is repainted every couple
     of seconds and the host is reading it, so a blind innerHTML rewrite on each
     tick would throw away their scroll position and their chosen sort order
     every time somebody new walked in. */
  var roll = { sort: "joined", players: [], sig: "", seen: {} };

  function orderedNames() {
    var list = roll.players.slice();
    if (roll.sort === "az") {
      list.sort(function (a, b) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
    }
    return list;
  }

  function paintRoll() {
    var host = document.getElementById("gqNames");
    var empty = document.getElementById("gqEmpty");
    if (!host) return;

    var list = orderedNames();
    /* Two people typing the same name is a real roll-call hazard: it reads as
       both of them present when it may be one person who joined twice, and the
       host ticks off somebody who is not in the room. Flagged rather than
       merged, because the host is the one who can tell which it is. */
    var counts = {};
    list.forEach(function (p) {
      var k = p.name.trim().toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    });

    var sig = roll.sort + "|" + list.map(function (p) { return p.id; }).join(",");
    if (sig === roll.sig) return;
    roll.sig = sig;

    var scrolled = host.scrollTop;
    host.innerHTML = list.map(function (p, i) {
      var isNew = !roll.seen[p.id];
      var dup = counts[p.name.trim().toLowerCase()] > 1;
      return '<li class="gq-name' + (isNew ? " is-new" : "") + '">' +
        '<span class="gq-name-n">' + (i + 1) + "</span>" +
        '<span class="gq-name-t">' + esc(p.name) + "</span>" +
        (dup ? '<span class="gq-dup" title="Somebody else typed this name too">same name</span>' : "") +
        "</li>";
    }).join("");
    host.scrollTop = scrolled;
    list.forEach(function (p) { roll.seen[p.id] = true; });

    if (empty) empty.hidden = list.length > 0;
  }

  async function refreshLobby() {
    try {
      var list = await G.players(session.id);
      var n = document.getElementById("gqN");
      if (!n) return;

      /* A name is never allowed to render as nothing. An empty pill is
         indistinguishable from a missing person, which is the one mistake this
         panel exists to prevent. */
      roll.players = (list || []).map(function (p) {
        return { id: p.id, name: (p.name == null ? "" : String(p.name)).trim() || "(no name)" };
      });

      n.textContent = roll.players.length;
      document.getElementById("gqNLabel").textContent =
        roll.players.length === 1 ? "person has joined" : "people have joined";
      paintRoll();
      document.getElementById("gqBegin").disabled = roll.players.length === 0;
    } catch (e) { /* a dropped poll is not worth interrupting a lobby for */ }
  }

  /* ============================ RUNNING ============================ */

  async function openQuestion(index) {
    stopTimers();
    session = await G.advance(session.id, {
      phase: "question",
      current_q: index,
      /* The server stamps the start time. Sending the host's clock would make
         the whole room's countdown depend on one laptop being right. */
      question_started_at: new Date().toISOString()
    });
    renderQuestion();
  }

  function currentQuestion() {
    return draft.questions[session.current_q] ||
           (session.questions && session.questions[session.current_q]);
  }

  function renderQuestion() {
    stopTimers();
    var q = currentQuestion();
    root.innerHTML =
      '<div class="gq-run">' +
        '<div class="gq-run-top">' +
          '<span class="gq-q-pos">Question ' + (session.current_q + 1) + " of " +
            draft.questions.length + "</span>" +
          '<span class="gq-timer" id="gqTimer">' + session.seconds_per_q + "</span>" +
        "</div>" +
        '<p class="gq-run-q">' + esc(q.q) + "</p>" +
        '<div class="gq-run-opts">' +
          q.options.map(function (o, oi) {
            return '<div class="gq-run-opt" data-o="' + oi + '">' +
              '<span class="gq-letter">' + "ABCDEFGH".charAt(oi) + "</span>" +
              "<span>" + esc(o) + "</span></div>";
          }).join("") +
        "</div>" +
        '<div class="gq-run-foot">' +
          '<p class="gq-answered"><b id="gqAns">0</b> answered</p>' +
          '<button type="button" class="gq-btn gq-btn-go" id="gqNext">Show the answer</button>' +
        "</div>" +
      "</div>";

    document.getElementById("gqNext").addEventListener("click", showAnswer);

    var timerEl = document.getElementById("gqTimer");
    /* Counted against the host's own clock, from the start time the server
       stamped. The players correct their countdown against the server; the host
       does not need to, because this laptop is the machine that just asked the
       server to start the question — any drift is one round trip, not a
       misconfigured phone. */
    var startedMs = new Date(session.question_started_at).getTime();
    tick = setInterval(function () {
      var left = Math.max(0, Math.ceil(
        (session.seconds_per_q * 1000 - (Date.now() - startedMs)) / 1000));
      timerEl.textContent = left;
      timerEl.classList.toggle("is-low", left <= 5);
      if (left <= 0) { clearInterval(tick); tick = null; }
    }, 250);

    poll = setInterval(async function () {
      try {
        var st = await G.state(session.code, null);
        var a = document.getElementById("gqAns");
        if (a && st && st.ok) a.textContent = st.answered == null ? a.textContent : st.answered;
      } catch (e) {}
    }, 1800);
  }

  async function showAnswer() {
    stopTimers();
    session = await G.advance(session.id, { phase: "reveal" });
    var q = currentQuestion();
    root.innerHTML =
      '<div class="gq-run gq-reveal">' +
        '<div class="gq-run-top"><span class="gq-q-pos">Question ' + (session.current_q + 1) +
          " of " + draft.questions.length + "</span></div>" +
        '<p class="gq-run-q">' + esc(q.q) + "</p>" +
        '<div class="gq-run-opts">' +
          q.options.map(function (o, oi) {
            return '<div class="gq-run-opt' + (oi === q.a ? " is-right" : " is-dim") + '">' +
              '<span class="gq-letter">' + "ABCDEFGH".charAt(oi) + "</span>" +
              "<span>" + esc(o) + "</span>" +
              (oi === q.a ? '<span class="gq-tick" aria-label="Correct answer">✓</span>' : "") +
              "</div>";
          }).join("") +
        "</div>" +
        '<div class="gq-run-foot"><span class="gq-spacer"></span>' +
          '<button type="button" class="gq-btn gq-btn-go" id="gqNext">Show the leaderboard</button>' +
        "</div>" +
      "</div>";
    document.getElementById("gqNext").addEventListener("click", showBoard);
  }

  async function showBoard() {
    stopTimers();
    var last = session.current_q >= draft.questions.length - 1;
    session = await G.advance(session.id, { phase: last ? "final" : "leaderboard" });
    var data = await G.leaderboard(session.code, last ? 8 : 5);
    var rows = (data && data.rows) || [];

    root.innerHTML =
      '<div class="gq-board">' +
        '<h2 class="gq-h">' + (last ? "Final leaderboard" : "Leaderboard") + "</h2>" +
        (last ? '<p class="gq-sub">' + esc(session.title) + "</p>" : "") +
        '<ol class="gq-rank">' +
          (rows.length
            ? rows.map(function (r, i) {
                return '<li class="gq-rank-row' + (i < 3 && last ? " is-podium" : "") + '">' +
                  '<span class="gq-pos">' + (i + 1) + "</span>" +
                  '<span class="gq-pname">' + esc(r.name) + "</span>" +
                  '<span class="gq-pscore">' + r.score + "</span>" +
                  '<span class="gq-ptime">' + (r.ms / 1000).toFixed(1) + "s</span>" +
                "</li>";
              }).join("")
            : '<li class="gq-rank-empty">Nobody has scored yet.</li>') +
        "</ol>" +
        '<p class="gq-legend">Ranked by correct answers. Time only separates people who are level.</p>' +
        '<div class="gq-run-foot"><span class="gq-spacer"></span>' +
          (last
            ? '<button type="button" class="gq-btn gq-btn-go" id="gqCerts">Certificates for the top three</button>'
            : '<button type="button" class="gq-btn gq-btn-go" id="gqNext">Next question</button>') +
        "</div>" +
        '<div id="gqCertHost"></div>' +
      "</div>";

    if (last) {
      document.getElementById("gqCerts").addEventListener("click", function () {
        issueCertificates(rows.slice(0, 3), rows.length);
      });
    } else {
      document.getElementById("gqNext").addEventListener("click", function () {
        openQuestion(session.current_q + 1);
      });
    }
  }

  /* ============================ CERTIFICATES ============================ */

  function issueCertificates(top, field) {
    var host = document.getElementById("gqCertHost");
    host.innerHTML = '<p class="gq-note">Preparing…</p>';
    if (!window.AQCert) { host.innerHTML = '<p class="gq-err">Certificate renderer not loaded.</p>'; return; }

    window.AQCert.ready().then(function () {
      host.innerHTML = "";
      var today = new Date();
      var iso = today.getFullYear() + "-" +
                String(today.getMonth() + 1).padStart(2, "0") + "-" +
                String(today.getDate()).padStart(2, "0");

      top.forEach(function (r, i) {
        var res = window.AQCert.render({
          name: r.name,
          title: session.title,
          hospital: session.hospital || "",
          rank: i + 1,
          field: field,
          score: r.score,
          total: draft.questions.length,
          dateISO: iso,
          code: session.code
        });
        var card = el("div", "gq-cert");
        var img = document.createElement("img");
        img.alt = "Certificate for " + r.name;
        img.src = res.canvas.toDataURL("image/png");
        card.appendChild(img);
        card.appendChild(el("p", "gq-cert-meta", r.name + " · " + res.serial));
        var dl = el("button", "gq-btn gq-btn-ghost", "Download");
        dl.type = "button";
        dl.addEventListener("click", function () { window.AQCert.download(res, r.name); });
        card.appendChild(dl);
        host.appendChild(card);
      });
    });
  }

  /* ============================ BOOT ============================ */

  async function init() {
    root = document.getElementById("gqRoot");
    if (!root) return;

    /* Hosting writes a row owned by a user, so it needs an account. Said plainly
       and once, rather than letting somebody write fifteen questions and only
       then discover they cannot start. */
    var user = null;
    try { user = await window.AQStore.adapter.currentUser(); } catch (e) {}
    if (!user) {
      root.innerHTML =
        '<div class="gq-gate"><h2 class="gq-h">Sign in to host a quiz</h2>' +
        '<p class="gq-sub">Hosting creates a quiz owned by your account, so the room can ' +
        "join it and so the certificates carry your hospital’s name. Taking part in " +
        "someone else’s quiz needs no account at all.</p>" +
        '<a class="gq-btn gq-btn-go" href="' +
          ((document.body && document.body.getAttribute("data-base")) || "") +
          'workspace/start">Sign in</a></div>';
      return;
    }
    renderSetup();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
