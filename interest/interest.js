/* AQcredix — the class-interest poll.
 *
 * One question, two buttons, an email address. It exists to answer a question worth money:
 * before building a training service, is there demand for one?
 *
 * WHY THE EMAIL IS ASKED FOR AFTER THE ANSWER, NOT BEFORE.
 * Asking for an address up front turns a one-tap question into a form, and most people
 * will not start a form to answer a question they were not asked. Pressing yes or no
 * costs nothing, and by the time the address is requested the person has already
 * committed to an opinion — the sunk cost is on our side of the transaction, which is
 * where it should be.
 *
 * WHY THE RESULT IS NEVER SHOWN BACK.
 * A poll that displays "72% said no" tells every hospital director who visits that other
 * hospitals are not interested. The totals are a fact about the business and belong to
 * the owner alone; the visitor is told their answer was recorded, and thanked. The API
 * enforces this — there is no endpoint that returns totals without an owner's token.
 *
 * ONE ANSWER PER ADDRESS is enforced by a unique index in the database, not here. A
 * check in the browser is a suggestion; a unique index is a rule. The local flag below
 * only saves a return visitor from being asked twice.
 */
(function () {
  "use strict";

  var KEY = "aq-interest-answered";
  var EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

  function base() {
    return (document.body && document.body.getAttribute("data-base")) || "";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function mount(host) {
    var answered = false;
    try { answered = localStorage.getItem(KEY) === "1"; } catch (e) {}

    host.className = "aqi";
    host.innerHTML =
      '<div class="aqi-card">' +
        '<span class="eyebrow">One question</span>' +
        '<h2 class="aqi-q">Would you want AQcredix to run real-time NABH implementation ' +
          'classes at your organisation?</h2>' +
        '<p class="aqi-sub">Live sessions, on your wards, with your own documents — not a ' +
          'recorded course. We are deciding whether to build it, and this is the only ' +
          'question we are asking.</p>' +
        '<div class="aqi-step" data-step="ask">' +
          '<button type="button" class="btn btn-accent" data-yes>Yes, I would</button>' +
          '<button type="button" class="btn btn-ghost" data-no>No, not for us</button>' +
        '</div>' +
        '<form class="aqi-step" data-step="email" hidden>' +
          '<label for="aqiEmail">Your email — so we count you once, and can tell you if it happens</label>' +
          '<div class="aqi-row">' +
            '<input id="aqiEmail" type="email" autocomplete="email" placeholder="you@hospital.org" required>' +
            '<button type="submit" class="btn btn-accent" data-send>Record my answer</button>' +
          '</div>' +
          '<input type="text" class="aqi-hp" data-hp tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<p class="aqi-note">Used only to count your answer once and to let you know. ' +
            'Never published, never sold.</p>' +
          '<p class="aqi-msg" data-msg role="status"></p>' +
        '</form>' +
        '<div class="aqi-step aqi-done" data-step="done" hidden>' +
          '<span class="aqi-tick" aria-hidden="true">&#10003;</span>' +
          '<p><b>Your response has been recorded. Thank you very much.</b></p>' +
        '</div>' +
      '</div>';

    var stepAsk   = host.querySelector('[data-step="ask"]');
    var stepEmail = host.querySelector('[data-step="email"]');
    var stepDone  = host.querySelector('[data-step="done"]');
    var emailEl   = host.querySelector("#aqiEmail");
    var msgEl     = host.querySelector("[data-msg]");
    var sendBtn   = host.querySelector("[data-send]");
    var choice    = null;

    if (answered) { show(stepDone); return; }

    function show(step) {
      [stepAsk, stepEmail, stepDone].forEach(function (s) { s.hidden = s !== step; });
    }
    function say(kind, html) {
      msgEl.className = "aqi-msg " + (kind || "");
      msgEl.innerHTML = html || "";
    }

    function pick(v) {
      choice = v;
      show(stepEmail);
      try { emailEl.focus({ preventScroll: true }); } catch (e) { emailEl.focus(); }
    }
    host.querySelector("[data-yes]").addEventListener("click", function () { pick(true); });
    host.querySelector("[data-no]").addEventListener("click", function () { pick(false); });

    stepEmail.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = emailEl.value.trim();
      if (!EMAIL_RE.test(email)) {
        say("bad", "That email address does not look right.");
        emailEl.focus();
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = "Recording…";
      say("", "");

      fetch(base() + "api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          answer: choice,
          company: host.querySelector("[data-hp]").value
        })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return { ok: r.ok, body: j };
        });
      }).then(function (r) {
        if (r.ok && r.body.ok) {
          try { localStorage.setItem(KEY, "1"); } catch (e) {}
          show(stepDone);
          if (r.body.already) {
            stepDone.querySelector("p").innerHTML =
              "<b>You have already answered — thank you.</b> One response per address, " +
              "so that the numbers mean something.";
          }
          return;
        }
        /* Never pretend it was recorded when it was not. */
        say("bad", esc(r.body.error || "That did not record. Please try again in a moment."));
        sendBtn.disabled = false;
        sendBtn.textContent = "Record my answer";
      }).catch(function () {
        say("bad", "We could not reach the server. Please check your connection.");
        sendBtn.disabled = false;
        sendBtn.textContent = "Record my answer";
      });
    });
  }

  function init() {
    var host = document.getElementById("aqInterest");
    if (host) mount(host);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.AQInterest = { mount: mount };
})();

/* ------------------------------------------------------------------ *
 * THE OWNER'S READOUT.
 *
 * Rendered on the profile page, and only after the server has confirmed who is asking.
 * The check is not here — a check in the browser is a suggestion. This asks the API for
 * the totals with the signed-in user's own token; the API compares that token's real
 * identity against OWNER_EMAIL and answers 404 to everybody else. Nothing is drawn on a
 * 404, so a subscriber opening their profile sees no trace that the panel exists.
 * ------------------------------------------------------------------ */
(function () {
  "use strict";

  function token() {
    try {
      var raw = localStorage.getItem("aq-sb-session");
      return raw ? (JSON.parse(raw).access_token || "") : "";
    } catch (e) { return ""; }
  }
  function base() {
    return (document.body && document.body.getAttribute("data-base")) || "";
  }

  function esc2(x) {
    return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* THE ADDRESSES OF EVERY OTHER RESPONDENT GO IN BCC, NEVER IN To.
   *
   * Putting them all in To would show each person the address of every other hospital
   * that answered. That is disclosing personal data to third parties without their
   * consent — a reportable breach under the DPDP Act, and irreversible the moment Send is
   * pressed. It is also commercially foolish: it hands anyone on the list the contact
   * details of every hospital interested in the same training.
   *
   * So the mail is addressed TO the sender and everyone else is BCC'd. Each recipient
   * sees a message addressed to AQcredix and to themselves alone. */
  var SUPPORT = "support.aqcredix@gmail.com";

  function gmailCompose(opts) {
    var q = "view=cm&fs=1" +
      "&to=" + encodeURIComponent(opts.to || "") +
      (opts.bcc ? "&bcc=" + encodeURIComponent(opts.bcc) : "") +
      "&su=" + encodeURIComponent(opts.subject || "") +
      "&body=" + encodeURIComponent(opts.body || "");
    return "https://mail.google.com/mail/?" + q;
  }

  function render(host, d) {
    var pct = d.total ? Math.round((d.yes / d.total) * 100) : 0;
    var people = d.respondents || [];
    var yesList = (d.yesEmails || []).join(",");

    /* Built from an array so the newlines are unambiguous. */
    var bulkBody = [
      "Dear colleague,", "",
      "You told us on aqcredix.com that you would want real-time NABH implementation",
      "classes at your organisation. Thank you — that is what we needed to know.", "",
      "", "",
      "Dr S. G. Santhoshkumar",
      "Founder & CEO, AQcredix",
      "https://aqcredix.com"
    ].join("\n");

    var bulkHref = gmailCompose({
      to: SUPPORT,
      bcc: yesList,
      subject: "AQcredix — the NABH implementation classes you asked about",
      body: bulkBody
    });

    var rows = people.map(function (p) {
      var one = gmailCompose({
        to: p.email,
        subject: "AQcredix — your answer about NABH implementation classes",
        body: ["Dear " + (p.name || "colleague") + ",", "", "", "",
               "Dr S. G. Santhoshkumar", "Founder & CEO, AQcredix",
               "https://aqcredix.com"].join("\n")
      });
      return '<tr>' +
        '<td>' + esc2(p.name || "—") + '</td>' +
        '<td class="aqi-mail">' + esc2(p.email) + '</td>' +
        '<td><span class="aqi-tag ' + (p.answer ? "yes" : "no") + '">' +
          (p.answer ? "Yes" : "No") + '</span></td>' +
        '<td>' + esc2(p.at ? new Date(p.at).toLocaleDateString() : "") + '</td>' +
        '<td><a class="aqi-reply" href="' + one + '" target="_blank" rel="noopener">Reply</a></td>' +
      '</tr>';
    }).join("");

    host.innerHTML =
      '<h2>Class interest</h2>' +
      '<p class="muted">Answers to the question on the home page. Visible to you only — ' +
        'the endpoint returns nothing to anyone else, and the table grants no read access ' +
        'to the site at all.</p>' +
      '<div class="aqi-stats">' +
        '<div class="aqi-stat"><b>' + d.total + '</b><span>answers</span></div>' +
        '<div class="aqi-stat"><b>' + d.yes + '</b><span>yes</span></div>' +
        '<div class="aqi-stat"><b>' + d.no + '</b><span>no</span></div>' +
        '<div class="aqi-stat"><b>' + pct + '%</b><span>interested</span></div>' +
      '</div>' +
      (d.yes ?
        '<div class="aqi-actions">' +
          '<a class="btn btn-accent" href="' + bulkHref + '" target="_blank" rel="noopener">' +
            'Email all ' + d.yes + ' who said yes</a>' +
          '<p class="aqi-bcc">Opens Gmail with everyone in <b>Bcc</b> and the message addressed ' +
            'to <b>' + SUPPORT + '</b>. Sign in to Gmail as that account first, or it will send ' +
            'from whichever account is active. Recipients never see each other&#8217;s addresses ' +
            '&mdash; putting them in To would disclose every hospital&#8217;s address to all the ' +
            'others.</p>' +
        '</div>' : "") +
      (people.length ?
        '<div class="aqi-tablewrap"><table class="aqi-table">' +
          '<thead><tr><th>Name</th><th>Email</th><th>Answer</th><th>When</th><th></th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div>' +
          '<p class="aqi-bcc">A name appears only where that address already belongs to an ' +
            'account here. The poll is on the public home page and needs no sign-in, so most ' +
            'rows will show a dash.</p>'
        : '<p class="muted">No answers yet.</p>');
    host.hidden = false;
  }

  function init() {
    var host = document.getElementById("aqInterestStats");
    if (!host) return;
    var t = token();
    if (!t) return;                       // not signed in: nothing to ask with
    fetch(base() + "api/interest?stats=1", {
      headers: { Authorization: "Bearer " + t }
    }).then(function (r) {
      if (!r.ok) return null;             // 404 for everyone but the owner
      return r.json();
    }).then(function (d) {
      if (d && typeof d.total === "number") render(host, d);
    }).catch(function () { /* silence is the correct outcome here */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
