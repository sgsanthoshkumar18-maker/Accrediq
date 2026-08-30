/* AQcredix — the contact form.
 *
 * IT POSTS TO api/support.js RATHER THAN GETTING ITS OWN ROUTE.
 * api/ holds exactly twelve serverless functions, which is the Vercel Hobby ceiling. A
 * thirteenth file there does not fail at runtime — it fails the BUILD, and the site keeps
 * serving the last good deploy while quietly not updating. So this reuses the endpoint that
 * already sends to the support inbox, and marks itself with kind:"Contact" so the two are
 * distinguishable in the mailbox.
 *
 * THE HONEYPOT IS THE SERVER'S, NOT A NEW ONE. api/support.js discards any submission that
 * fills a field called "company". The visible organisation field is therefore named "org",
 * and a real, hidden "company" input is passed through untouched.
 */
(function () {
  "use strict";

  function init() {
    var form = document.getElementById("ctForm");
    if (!form) return;
    var say = document.getElementById("ctSay");
    var send = document.getElementById("ctSend");

    function tell(kind, text) {
      if (!say) return;
      say.textContent = text;
      say.className = "ct-say" + (kind ? " is-" + kind : "");
    }

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var name = (form.querySelector("#ctName").value || "").trim();
      var email = (form.querySelector("#ctEmail").value || "").trim();
      var org = (form.querySelector("#ctOrg").value || "").trim();
      var msg = (form.querySelector("#ctMsg").value || "").trim();
      var pot = (form.querySelector("#ctCo").value || "").trim();

      /* Check here as well as on the server, so a typo is caught before a round trip and
         the message says which field to fix. */
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        tell("bad", "That email address does not look right — we need it to reply.");
        form.querySelector("#ctEmail").focus();
        return;
      }
      if (msg.length < 12) {
        tell("bad", "Please describe what you need in a sentence or two.");
        form.querySelector("#ctMsg").focus();
        return;
      }

      /* The server takes one message body, so the name and hospital are folded into it
         rather than dropped. */
      var body = msg;
      var who = [];
      if (name) who.push(name);
      if (org) who.push(org);
      if (who.length) body = who.join(" — ") + "\n\n" + msg;

      send.disabled = true;
      var original = send.textContent;
      send.textContent = "Sending…";
      tell("", "");

      try {
        var r = await fetch("/api/support", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email,
            message: body,
            company: pot,
            page: location.pathname + location.search,
            kind: "Contact"
          })
        });
        var data = {};
        try { data = await r.json(); } catch (err) {}
        if (r.ok && data.ok) {
          form.reset();
          tell("ok", "Thank you — that has reached us. We reply to " + email + ".");
        } else {
          tell("bad", data.error || "That did not send. Please email support.aqcredix@gmail.com directly.");
        }
      } catch (err) {
        /* Offline, blocked, or the function is cold and timed out. Never leave someone
           staring at a dead button — give them the address. */
        tell("bad", "That did not send. Please email support.aqcredix@gmail.com directly.");
      } finally {
        send.disabled = false;
        send.textContent = original;
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
