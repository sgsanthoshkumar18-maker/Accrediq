/* AQcredix — the support panel behind the flag in the header.
 *
 * WHAT IT COLLECTS AND WHY. An email address and a message, nothing else. The address is
 * required and the panel says why in the label rather than in a tooltip: without it a
 * complaint is a dead end, and people give an address readily once they understand it is
 * how they get an answer, not how they get a mailing list.
 *
 * The page URL is sent along silently. Half of all bug reports are "it does not work",
 * and knowing which screen they were on when they wrote it is usually the whole diagnosis.
 * It is stated on the panel, because collecting anything unannounced on a site that sells
 * itself on honest data handling would be the wrong trade for a field nobody minds giving.
 *
 * The panel is a fixed full-viewport backdrop, so aq-scroll-lock.js recognises it and
 * holds the page still — no extra wiring, and it behaves exactly like every other overlay.
 */
(function () {
  "use strict";

  var panel = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function close() {
    if (!panel) return;
    panel.remove();
    panel = null;
  }

  function open() {
    if (panel) return;
    panel = document.createElement("div");
    panel.className = "aqs-back";
    panel.innerHTML =
      '<div class="aqs-card" role="dialog" aria-modal="true" aria-labelledby="aqsTitle">' +
        '<button type="button" class="aqs-x" aria-label="Close">&#10005;</button>' +
        '<h2 id="aqsTitle">Report a problem</h2>' +
        '<p class="aqs-sub">Tell us what went wrong and we will look at it. If something is ' +
          'broken, saying what you were trying to do helps more than the error itself.</p>' +
        '<label for="aqsEmail">Your email <span>— so we can reply. That is the only thing we use it for.</span></label>' +
        '<input id="aqsEmail" type="email" autocomplete="email" placeholder="you@hospital.org">' +
        '<label for="aqsMsg">What happened</label>' +
        '<textarea id="aqsMsg" rows="6" placeholder="What you were doing, what you expected, and what happened instead."></textarea>' +
        /* Honeypot. Off-screen rather than display:none, which some bots skip. */
        '<input type="text" id="aqsCo" tabindex="-1" autocomplete="off" aria-hidden="true" class="aqs-hp">' +
        '<div class="aqs-note">We will also send the page you are on right now — ' +
          '<code>' + esc(location.pathname) + '</code> — because it is usually the fastest clue.</div>' +
        '<div class="aqs-msg" id="aqsMsgBox"></div>' +
        '<div class="aqs-actions">' +
          '<button type="button" class="btn btn-accent" id="aqsSend">Send to support</button>' +
          '<button type="button" class="btn btn-ghost" id="aqsCancel">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(panel);

    var emailEl = panel.querySelector("#aqsEmail");
    var msgEl = panel.querySelector("#aqsMsg");
    var box = panel.querySelector("#aqsMsgBox");
    var send = panel.querySelector("#aqsSend");

    setTimeout(function () { emailEl.focus(); }, 40);

    function say(kind, html) {
      box.className = "aqs-msg " + kind;
      box.innerHTML = html;
    }

    panel.querySelector(".aqs-x").addEventListener("click", close);
    panel.querySelector("#aqsCancel").addEventListener("click", close);
    /* Clicking the backdrop closes; clicking the card must not. */
    panel.addEventListener("click", function (e) { if (e.target === panel) close(); });
    document.addEventListener("keydown", function esc2(e) {
      if (e.key === "Escape" && panel) { close(); document.removeEventListener("keydown", esc2); }
    });

    send.addEventListener("click", async function () {
      var email = emailEl.value.trim(), message = msgEl.value.trim();
      if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
        say("bad", "That email address does not look right — we need it to reply.");
        emailEl.focus(); return;
      }
      if (message.length < 12) {
        say("bad", "Please describe the problem in a sentence or two.");
        msgEl.focus(); return;
      }
      send.disabled = true; send.textContent = "Sending…";
      say("", "");
      try {
        var r = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email, message: message,
            company: panel.querySelector("#aqsCo").value,
            page: location.pathname + location.search,
            kind: "Support"
          })
        });
        var j = await r.json().catch(function () { return {}; });
        if (r.ok && j.ok) {
          say("ok", "<b>Sent.</b> We have your message and your address, and we will reply " +
                    "to <b>" + esc(email) + "</b>.");
          msgEl.value = "";
          send.textContent = "Sent";
          setTimeout(close, 2600);
          return;
        }
        /* Never claim it sent when it did not — give them the address instead so the
           complaint is not lost because our mail service was having a bad afternoon. */
        var fb = j.fallback
          ? ' You can reach us at <a href="mailto:' + esc(j.fallback) + '">' + esc(j.fallback) + "</a>."
          : "";
        say("bad", esc(j.error || "That did not send.") + fb);
      } catch (e) {
        say("bad", "We could not reach the server. Please check your connection and try again.");
      }
      send.disabled = false; send.textContent = "Send to support";
    });
  }

  /* Delegated, so the button works no matter when app.js injects the header. */
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-aq-support]");
    if (!b) return;
    e.preventDefault();
    open();
  });

  window.AQSupport = { open: open, close: close };
})();
