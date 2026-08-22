/* AQcredix — the owner's grant panel.
 *
 * Type an address, press grant. Both halves happen in one request or neither does.
 *
 * THE CHECK IS NOT HERE. This panel renders only when /api/grant answers, and that route
 * verifies the caller's token against OWNER_EMAIL before it returns anything. Everyone
 * else gets a 404 and this file draws nothing at all — no empty panel, no disabled
 * button, no hint that the feature exists. A guard in the browser is a suggestion; the
 * one that matters is on the server.
 */
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
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function api(method, body) {
    return fetch(base() + "api/grant", {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token()
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; })
        .then(function (j) { return { ok: r.ok, body: j }; });
    });
  }

  function init() {
    var host = document.getElementById("aqGrant");
    if (!host || !token()) return;

    api("GET").then(function (r) {
      if (!r.ok) return;                 // 404 for anyone but the owner: draw nothing
      render(host, r.body.accounts || []);
    }).catch(function () {});
  }

  function render(host, accounts) {
    host.innerHTML =
      '<h2>Complimentary access</h2>' +
      '<p class="muted">Grant a free lifetime account. This does both halves at once — ' +
        'the entitlement the database checks, and the subscription record the app shows. ' +
        'No SQL, no deploy. They do not need to have signed up yet.</p>' +
      '<form class="gr-form">' +
        '<input type="email" id="grEmail" placeholder="name@hospital.org" autocomplete="off" required>' +
        '<input type="text" id="grNote" placeholder="Why (optional) — e.g. pilot hospital">' +
        '<button type="submit" class="btn btn-accent" id="grGo">Grant access</button>' +
      '</form>' +
      '<p class="gr-msg" id="grMsg" role="status"></p>' +
      '<div id="grList"></div>';

    var form = host.querySelector(".gr-form");
    var msg  = host.querySelector("#grMsg");
    var go   = host.querySelector("#grGo");

    function say(kind, text) {
      msg.className = "gr-msg " + (kind || "");
      msg.textContent = text || "";
    }

    function list(rows) {
      var el = host.querySelector("#grList");
      if (!rows.length) { el.innerHTML = '<p class="muted">Nobody yet.</p>'; return; }
      el.innerHTML =
        '<div class="gr-tablewrap"><table class="gr-table">' +
        '<thead><tr><th>Email</th><th>Note</th><th>Granted</th><th></th></tr></thead><tbody>' +
        rows.map(function (a) {
          return '<tr>' +
            '<td class="gr-mail">' + esc(a.email) + '</td>' +
            '<td>' + esc(a.note || "—") + '</td>' +
            '<td>' + esc(a.granted_at ? new Date(a.granted_at).toLocaleDateString() : "") + '</td>' +
            '<td><button type="button" class="gr-revoke" data-email="' + esc(a.email) +
              '">Revoke</button></td>' +
          '</tr>';
        }).join("") + "</tbody></table></div>";

      [].forEach.call(el.querySelectorAll(".gr-revoke"), function (b) {
        b.addEventListener("click", function () {
          var who = b.getAttribute("data-email");
          /* Confirmed, because this is the one button here that takes something away and
             the person on the other end will not be told. */
          if (!confirm("Remove complimentary access for " + who + "?")) return;
          b.disabled = true;
          api("POST", { email: who, revoke: 1 }).then(function (r) {
            if (r.ok && r.body.ok) { say("ok", "Removed " + who + "."); refresh(); }
            else { say("bad", r.body.error || "Could not remove that."); b.disabled = false; }
          });
        });
      });
    }

    function refresh() {
      api("GET").then(function (r) { if (r.ok) list(r.body.accounts || []); });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = host.querySelector("#grEmail").value.trim();
      var note  = host.querySelector("#grNote").value.trim();
      if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
        say("bad", "That email address does not look right."); return;
      }
      go.disabled = true; go.textContent = "Granting…"; say("", "");
      api("POST", { email: email, note: note }).then(function (r) {
        go.disabled = false; go.textContent = "Grant access";
        if (r.ok && r.body.ok) {
          say("ok", email + " now has complimentary access. They can sign in straight away.");
          host.querySelector("#grEmail").value = "";
          host.querySelector("#grNote").value = "";
          refresh();
          return;
        }
        /* Never a green tick over a failure — the whole point of this panel is that the
           two halves cannot drift apart silently. */
        say("bad", r.body.error || "That did not go through.");
      }).catch(function () {
        go.disabled = false; go.textContent = "Grant access";
        say("bad", "Could not reach the server.");
      });
    });

    list(accounts);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
