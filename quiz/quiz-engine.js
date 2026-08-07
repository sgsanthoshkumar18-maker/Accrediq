/* AQcredix — Today's Quiz engine.
 *
 * Daily selection is deterministic from the calendar date, so every visitor on
 * a given day gets the same department and the same ten questions, and a
 * refresh cannot reroll into an easier set.
 *
 * Department rotation: day N picks departments[N % deptCount].
 * Question selection within a department walks a seeded permutation of that
 * department's pool, so no question repeats until the whole pool is exhausted.
 *
 * Honest note on cycle length: with 10 departments x 12 questions = 120
 * questions and 10 per day, the bank cycles in 12 days. A full year with no
 * repetition needs 3,650 questions. Adding questions to any pool in
 * quiz-data.js extends the cycle automatically — the engine reads pool length
 * at runtime and needs no change.
 */
(function () {
  "use strict";

  var PER_DAY = 10;
  var LS_KEY = "aq_quiz_state_v1";
  var LS_NAME = "aq_quiz_name_v1";

  /* ---- deterministic randomness ---- */

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFrom(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function permutation(n, seed) {
    var idx = [], rnd = mulberry32(seed);
    for (var i = 0; i < n; i++) idx.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1));
      var t = idx[j]; idx[j] = idx[k]; idx[k] = t;
    }
    return idx;
  }

  /* ---- date handling ---- */

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function dayIndex(iso) {
    var parts = iso.split("-");
    var utc = Date.UTC(+parts[0], +parts[1] - 1, +parts[2]);
    return Math.floor(utc / 86400000);
  }

  /* ---- selection ---- */

  function selectForDate(iso) {
    var bank = window.AQ_QUIZ_BANK;
    if (!bank || !bank.departments || !bank.departments.length) return null;

    var depts = bank.departments;
    var di = dayIndex(iso);
    var dept = depts[((di % depts.length) + depts.length) % depts.length];
    var pool = dept.questions;
    if (!pool || !pool.length) return null;

    /* Which visit to this department is today? */
    var visit = Math.floor(di / depts.length);
    var count = Math.min(PER_DAY, pool.length);
    var picked = [], pos = visit * count, guard = 0;

    while (picked.length < count && guard++ < 500) {
      var epoch = Math.floor(pos / pool.length);
      var offset = ((pos % pool.length) + pool.length) % pool.length;
      var perm = permutation(pool.length, seedFrom(dept.id + ":" + epoch));
      var q = pool[perm[offset]];
      if (picked.indexOf(q) === -1) picked.push(q);
      pos++;
    }

    /* Shuffle the options too, so the correct answer is not always in the
       position the author happened to write it. Seeded by question id + date
       so it is stable across a refresh. */
    var out = picked.map(function (q) {
      var order = permutation(q.options.length, seedFrom(q.id + iso));
      return {
        id: q.id,
        q: q.q,
        why: q.why,
        options: order.map(function (i) { return q.options[i]; }),
        a: order.indexOf(q.a)
      };
    });

    return { date: iso, department: dept, questions: out };
  }

  /* ---- persistence (localStorage; small, non-clinical, safe to lose) ---- */

  function loadState(iso) {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      return s && s.date === iso ? s : null;
    } catch (e) { return null; }
  }

  function saveState(s) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function savedName() {
    try { return localStorage.getItem(LS_NAME) || ""; } catch (e) { return ""; }
  }

  function rememberName(n) {
    try { localStorage.setItem(LS_NAME, n); } catch (e) {}
  }

  /* ---- rendering ---- */

  var root, set, answers, revealed, submitted;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function longDate(iso) {
    var months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    var p = iso.split("-");
    return (+p[2]) + " " + months[+p[1] - 1] + " " + p[0];
  }

  function render() {
    root.innerHTML = "";

    /* h2, not h1 — the page template already supplies the h1 ("Today's Quiz").
       Two h1s on one page is both a document-outline error and an SEO one. */
    var head = el("div", "aq-quiz-head");
    head.appendChild(el("p", "aq-quiz-eyebrow", longDate(set.date)));
    head.appendChild(el("h2", "aq-quiz-title", set.department.name));
    head.appendChild(el("p", "aq-quiz-sub",
      "Every option is plausible \u2014 read all four before choosing. A perfect score earns a dated certificate."));
    root.appendChild(head);

    var bar = el("div", "aq-quiz-progress");
    var fill = el("div", "aq-quiz-progress-fill");
    fill.id = "aqQuizFill";
    bar.appendChild(fill);
    root.appendChild(bar);

    set.questions.forEach(function (q, qi) {
      var card = el("div", "aq-q-card");
      card.id = "q" + qi;

      var num = el("span", "aq-q-num", "Question " + (qi + 1) + " of " + set.questions.length);
      card.appendChild(num);
      card.appendChild(el("p", "aq-q-text", q.q));

      var list = el("div", "aq-q-options");
      q.options.forEach(function (opt, oi) {
        var b = el("button", "aq-opt");
        b.type = "button";
        b.setAttribute("data-q", qi);
        b.setAttribute("data-o", oi);
        var letter = el("span", "aq-opt-letter", "ABCD".charAt(oi));
        var txt = el("span", "aq-opt-text", opt);
        b.appendChild(letter);
        b.appendChild(txt);
        b.addEventListener("click", function () { choose(qi, oi); });
        list.appendChild(b);
      });
      card.appendChild(list);

      var why = el("div", "aq-q-why");
      why.id = "why" + qi;
      card.appendChild(why);

      root.appendChild(card);
    });

    var foot = el("div", "aq-quiz-foot");
    var submit = el("button", "aq-btn aq-btn-primary", "Submit answers");
    submit.type = "button";
    submit.id = "aqQuizSubmit";
    submit.addEventListener("click", grade);
    foot.appendChild(submit);
    var note = el("p", "aq-quiz-note",
      "You can change any answer until you submit. Answers and explanations appear after submission.");
    foot.appendChild(note);
    root.appendChild(foot);

    var result = el("div", "aq-quiz-result");
    result.id = "aqQuizResult";
    root.appendChild(result);

    restore();
  }

  function choose(qi, oi) {
    if (submitted) return;
    answers[qi] = oi;
    paintSelection();
    saveState({ date: set.date, answers: answers, submitted: false });
  }

  function paintSelection() {
    var btns = root.querySelectorAll(".aq-opt");
    for (var i = 0; i < btns.length; i++) {
      var q = +btns[i].getAttribute("data-q");
      var o = +btns[i].getAttribute("data-o");
      btns[i].classList.toggle("is-picked", answers[q] === o);
    }
    var done = answers.filter(function (a) { return a != null; }).length;
    var fill = document.getElementById("aqQuizFill");
    if (fill) fill.style.width = Math.round((done / set.questions.length) * 100) + "%";
    var btn = document.getElementById("aqQuizSubmit");
    if (btn && !submitted) {
      btn.disabled = done < set.questions.length;
      btn.textContent = done < set.questions.length
        ? "Answer all " + set.questions.length + " to submit (" + done + " done)"
        : "Submit answers";
    }
  }

  function grade() {
    var done = answers.filter(function (a) { return a != null; }).length;
    if (done < set.questions.length) return;
    submitted = true;
    saveState({ date: set.date, answers: answers, submitted: true });

    var score = 0;
    set.questions.forEach(function (q, qi) {
      var correct = answers[qi] === q.a;
      if (correct) score++;
      var btns = root.querySelectorAll('.aq-opt[data-q="' + qi + '"]');
      for (var i = 0; i < btns.length; i++) {
        var o = +btns[i].getAttribute("data-o");
        btns[i].disabled = true;
        if (o === q.a) btns[i].classList.add("is-correct");
        else if (o === answers[qi]) btns[i].classList.add("is-wrong");
      }
      var why = document.getElementById("why" + qi);
      why.className = "aq-q-why is-open " + (correct ? "is-right" : "is-miss");
      why.innerHTML = "";
      why.appendChild(el("span", "aq-why-tag", correct ? "Correct" : "Not quite"));
      why.appendChild(el("p", "aq-why-text", q.why));
    });

    var btn = document.getElementById("aqQuizSubmit");
    if (btn) btn.style.display = "none";

    showResult(score);
    document.getElementById("aqQuizResult").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showResult(score) {
    var box = document.getElementById("aqQuizResult");
    box.innerHTML = "";
    box.className = "aq-quiz-result is-open " + (score === set.questions.length ? "is-perfect" : "is-partial");

    box.appendChild(el("p", "aq-result-score", score + " / " + set.questions.length));

    if (score === set.questions.length) {
      box.appendChild(el("p", "aq-result-line",
        "A clean sweep on " + set.department.name + ". Claim your certificate below."));

      var row = el("div", "aq-cert-row");
      var input = el("input", "aq-cert-name");
      input.type = "text";
      input.placeholder = "Your full name, as it should appear";
      input.value = savedName();
      input.maxLength = 60;
      row.appendChild(input);

      var go = el("button", "aq-btn aq-btn-primary", "Generate certificate");
      go.type = "button";
      go.addEventListener("click", function () {
        var nm = input.value.trim();
        if (nm.length < 2) { input.focus(); input.classList.add("is-empty"); return; }
        input.classList.remove("is-empty");
        rememberName(nm);
        issue(nm, score, box);
      });
      row.appendChild(go);
      box.appendChild(row);
    } else {
      box.appendChild(el("p", "aq-result-line",
        "The certificate needs all " + set.questions.length + " correct. Read the explanations under each question \u2014 " +
        "the reasoning matters more than the score. A new department and a new set arrive tomorrow."));
    }
  }

  function issue(name, score, box) {
    if (!window.AQCert) return;
    // The countersignature is loaded from disk, and render() reads the canvas back
    // immediately. Without this wait the very first certificate of a session would
    // download unsigned while the preview quietly showed the signed one.
    window.AQCert.ready().then(function () { draw(name, score, box); });
  }

  function draw(name, score, box) {
    var res = window.AQCert.render({
      name: name,
      department: set.department.name,
      dateISO: set.date,
      score: score,
      total: set.questions.length
    });

    var old = box.querySelector(".aq-cert-preview");
    if (old) old.parentNode.removeChild(old);

    var wrap = el("div", "aq-cert-preview");
    var img = document.createElement("img");
    img.alt = "AQcredix certificate for " + name;
    img.src = res.canvas.toDataURL("image/png");
    wrap.appendChild(img);

    var meta = el("p", "aq-cert-meta",
      "Serial " + res.serial + " \u00B7 valid one year from issue");
    wrap.appendChild(meta);

    var dl = el("button", "aq-btn aq-btn-primary", "Download PNG");
    dl.type = "button";
    dl.addEventListener("click", function () { window.AQCert.download(res, name); });
    wrap.appendChild(dl);

    box.appendChild(wrap);
    wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function restore() {
    var saved = loadState(set.date);
    if (!saved) { paintSelection(); return; }
    answers = saved.answers || answers;
    paintSelection();
    if (saved.submitted) { submitted = false; grade(); }
  }

  /* ---- boot ---- */

  function init() {
    root = document.getElementById("aqQuizRoot");
    if (!root) return;

    var iso = todayISO();
    set = selectForDate(iso);
    if (!set) {
      root.innerHTML = "";
      root.appendChild(el("p", "aq-quiz-note", "The question bank could not be loaded."));
      return;
    }
    answers = new Array(set.questions.length).fill(null);
    submitted = false;
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.AQQuiz = { selectForDate: selectForDate, todayISO: todayISO };
})();
