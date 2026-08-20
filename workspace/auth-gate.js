/* AQcredix — site-wide access gate.
 *
 * Loaded on every page that is NOT in the public set (home, about, standards, standard
 * detail, privacy, terms, contact, 404). Blocks rendering until a signed-in AQStore user
 * is confirmed, then reveals the page and applies a watermark tied to that user.
 *
 * Honesty, stated once here rather than repeated everywhere: this is a client-side gate
 * on a static site with no server rendering. It stops casual and incidental access —
 * the address bar, a shared link, a bookmark — for the overwhelming majority of visitors.
 * It cannot stop someone who disables JavaScript, reads page source, or fetches a .js
 * data file directly by URL; no code running in the browser can prevent that, and this
 * file does not claim to. Real confidentiality for the underlying NABH content depends
 * on the written-permission question, not on this gate.
 *
 * Load order required in <head>, before anything else render-affecting:
 *   config.js -> store.js -> auth-gate.js
 * (workspace pages already load this chain via shell.js and do not need this file too.)
 */
(function () {
  "use strict";

function friendlyAuthError(err) {
    var raw = String((err && err.message) || err || "");
    var code = "";
    try { code = (JSON.parse(raw) || {}).error_code || (JSON.parse(raw) || {}).code || ""; }
    catch (e) { code = ""; }
    var t = (code + " " + raw).toLowerCase();

    if (t.indexOf("email_not_confirmed") >= 0 || t.indexOf("not confirmed") >= 0) {
      return { text: "This email has not been confirmed yet. Open the confirmation link " +
               "sent when the account was created, then sign in.", resend: true };
    }
    if (t.indexOf("invalid_credentials") >= 0 || t.indexOf("invalid login") >= 0) {
      return { text: "That email and password do not match an account. If the account " +
               "was created on another device, use Reset password below.", reset: true };
    }
    if (t.indexOf("user_already_exists") >= 0 || t.indexOf("already registered") >= 0) {
      return { text: "An account with this email already exists — use Sign in instead." };
    }
    if (t.indexOf("over_email_send_rate") >= 0 || t.indexOf("rate limit") >= 0) {
      return { text: "Too many attempts just now. Wait a minute and try again." };
    }
    if (t.indexOf("weak_password") >= 0 || t.indexOf("password should be") >= 0) {
      return { text: "That password is too short — six characters or more." };
    }
    if (t.indexOf("failed to fetch") >= 0 || t.indexOf("networkerror") >= 0) {
      return { text: "No connection to the server. Check the network and try again." };
    }
    return { text: raw.slice(0, 200) || "Sign-in failed. Please try again." };
  }

  /* Shared with workspace/shell.js, which printed the raw Supabase JSON — a 400
     response reached the screen as {"code":400,"error_code":"email_not_confirmed",...},
     unreadable and overflowing its box because a JSON blob has no spaces to wrap at.
     One translator, used by both panels, so they cannot drift apart. */
  window.AQAuthError = friendlyAuthError;


  /* Hide the page before first paint so protected content never flashes while the auth
     check runs.

     BUT ONLY WHEN THERE IS NO STORED SESSION. Hiding unconditionally meant every page
     load sat blank for the whole network round-trip to Supabase — two or three seconds,
     and worse the further away the database is. The visitor could not tell a slow page
     from a broken one.

     A stored session token is not proof of access, and it is not treated as such: the
     real check still runs and still redirects if it fails. It is proof that this browser
     signed in recently, which is enough to justify painting the page immediately. The
     failure mode of guessing wrong is a brief glimpse of a shell that the gate then
     replaces — far better than blanking every load for everyone. */
  function looksSignedIn() {
    try {
      var raw = localStorage.getItem("aq-sb-session");
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || !s.access_token) return false;
      /* An expired token means a refresh round-trip is coming, so hiding is honest there:
         the page really is not ready yet. */
      if (s.expires_at && (s.expires_at * 1000) < Date.now()) return false;
      return true;
    } catch (e) { return false; }
  }

  var lock = null;
  if (!looksSignedIn()) {
    lock = document.createElement("style");
    lock.id = "aqGateLock";
    lock.textContent = "body{visibility:hidden !important;}";
    document.head.appendChild(lock);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function reveal() {
    var el = document.getElementById("aqGateLock");
    if (el) el.remove();
    var ov = document.getElementById("aqGateOverlay");
    if (ov) ov.remove();
  }

  function watermark(user) {
    var d = document.createElement("div");
    d.id = "aqWatermark";
    d.setAttribute("aria-hidden", "true");
    var label = (user.email || user.name || "AQcredix") + " · " + new Date().toLocaleDateString();
    var tiles = [];
    for (var i = 0; i < 60; i++) tiles.push('<span>' + esc(label) + "</span>");
    d.innerHTML = tiles.join("");
    document.body.appendChild(d);

    // A best-effort nudge, not a claim of protection: discourage casual copy/paste and
    // right-click save of protected pages. Trivially bypassed by anyone who wants to,
    // and deliberately NOT applied to form fields, so the workspace stays usable.
    document.addEventListener("contextmenu", function (e) {
      if (!e.target.closest("input, textarea, select, [contenteditable]")) e.preventDefault();
    });
    document.addEventListener("copy", function (e) {
      if (!e.target.closest("input, textarea, select, [contenteditable]")) {
        // Leave a trace in whatever gets pasted, rather than silently blocking copy —
        // blocking it outright breaks legitimate use (citing an element code, etc).
        var sel = document.getSelection();
        if (sel && String(sel)) {
          e.clipboardData.setData("text/plain", String(sel) + "\n\n— copied from AQcredix by " + label);
          e.preventDefault();
        }
      }
    });
  }

  function loginOverlay(kind) {
    var ov = document.createElement("div");
    ov.id = "aqGateOverlay";
    ov.className = "aq-gate-overlay";
    var here = encodeURIComponent(location.pathname + location.search);

    if (kind === "unconfigured") {
      // No backend connected at all — nothing to sign into. Say so rather than show a
      // login form that cannot work, and point at the one page that still functions.
      ov.innerHTML =
        '<div class="aq-gate-box"><h2>Sign-in isn’t connected yet</h2>' +
        '<p>This copy of AQcredix has no backend configured, so there is no account system ' +
        "to sign into. The public pages — Home, About and Standards — still work normally.</p>" +
        '<a class="btn btn-accent" href="' + (document.body.getAttribute("data-base") || "") + 'index.html">Back to Home</a></div>';
      document.body.appendChild(ov);
      document.body.style.visibility = "visible";
      var lk = document.getElementById("aqGateLock"); if (lk) lk.remove();
      return;
    }

    ov.innerHTML =
      '<div class="aq-gate-box">' +
        '<h2>Sign in to continue</h2>' +
        '<p>Home, About and Standards are open to everyone. Everything else — Departments, ' +
        "Learn, the Quality Tools, the Workspace and the Dashboard — needs an account. " +
        "Sign in once and every one of those pages opens without asking again.</p>" +
        '<div class="aq-gate-tabs"><button type="button" class="active" data-t="in">Sign in</button>' +
        '<button type="button" data-t="up">Create account</button></div>' +
        '<div id="aqGateBody"></div><p class="aq-gate-msg" id="aqGateMsg"></p>' +
        '<a class="aq-gate-back" href="' + (document.body.getAttribute("data-base") || "") + 'index.html">\u2190 Back to Home</a>' +
      "</div>";
    document.body.appendChild(ov);
    document.body.style.visibility = "visible";
    var lk2 = document.getElementById("aqGateLock"); if (lk2) lk2.remove();

    var body = ov.querySelector("#aqGateBody"), msg = ov.querySelector("#aqGateMsg");
    var S = window.AQStore;


    /* Supabase returns machine-readable JSON on failure, and this panel used to print it
       raw and truncated at 220 characters. A person locked out on a new device then sees
       something like {"code":"email_not_confirmed","message":... and cannot tell whether
       the account is missing, unconfirmed, or the password is simply wrong — three very
       different problems with three different fixes. Translate them. */
    /* Exposed so workspace/shell.js uses the same translator. It previously printed the
       raw Supabase JSON, which is how a 400 response ended up on screen as
       {"code":400,"error_code":"email_not_confirmed",...} — unreadable, and overflowing
       its box because a JSON blob has no spaces to wrap at. Two copies of this logic
       would drift; one cannot. */
    // Defined at module scope below and shared with shell.js.



    function draw(tab) {
      body.innerHTML =
        '<label>Work email</label><input id="agEmail" type="email" autocomplete="email">' +
        '<label>Password</label><input id="agPass" type="password" autocomplete="current-password">' +
        (tab === "up"
          ? '<label>Your name</label><input id="agName" type="text">' +
            '<label>Hospital name</label><input id="agOrg" type="text">'
          : "") +
        '<button type="button" class="btn btn-accent" id="agGo">' +
          (tab === "up" ? "Create account" : "Sign in") + "</button>";

      body.querySelector("#agGo").addEventListener("click", async function () {
        var e = body.querySelector("#agEmail").value.trim();
        var p = body.querySelector("#agPass").value;
        if (!e || !p) { msg.textContent = "Email and password are both needed."; return; }
        this.disabled = true; msg.textContent = "Working…";
        try {
          if (tab === "up") {
            await S.adapter.signUp(e, p,
              body.querySelector("#agName").value.trim() || e,
              body.querySelector("#agOrg").value.trim() || "My Hospital");
            msg.textContent = "Account created. If email confirmation is required, check your inbox, then sign in.";
            this.disabled = false;
          } else {
            await S.adapter.signInPassword(e, p);
            location.href = decodeURIComponent(here) || location.href;
          }
        } catch (err) {
          var f = friendlyAuthError(err);
          msg.innerHTML = f.text +
            (f.reset || f.resend
              ? ' <button type="button" class="aq-gate-link" id="agRecover">' +
                (f.resend ? "Resend confirmation" : "Reset password") + "</button>"
              : "");
          var rec = msg.querySelector("#agRecover");
          if (rec) {
            rec.addEventListener("click", async function () {
              rec.disabled = true;
              try {
                if (f.resend) await S.adapter.resendConfirmation(e);
                else await S.adapter.resetPassword(e);
                msg.textContent = "Sent. Check the inbox for " + e +
                  " (including the spam folder).";
              } catch (e2) {
                msg.textContent = friendlyAuthError(e2).text;
              }
            });
          }
          this.disabled = false;
        }
      });
    }
    draw("in");
    ov.querySelectorAll(".aq-gate-tabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        ov.querySelectorAll(".aq-gate-tabs button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active"); msg.textContent = ""; draw(b.getAttribute("data-t"));
      });
    });
  }

  async function run() {
    window.AQGate = { watermark: watermark };
    var S = window.AQStore;
    if (!S) { reveal(); return; }               // store failed to load — fail open rather than lock everyone out permanently

    if (S.mode !== "supabase") {
      // No real backend: there is nothing to authenticate against. Local-mode "login"
      // on a single page is not access control, so gating pretends nothing here —
      // it would just be friction with zero security behind it.
      loginOverlay("unconfigured");
      return;
    }

    var user = await S.currentUser();
    if (user) {
      reveal();
      // The account owner's own view carries no watermark and no copy/right-click
      // restriction — those exist to trace a leak from someone ELSE's session, and
      // applying them to the person running the site would just be friction.
      if (user.role !== "owner") watermark(user);
      return;
    }
    loginOverlay("supabase");
  }

    var LIBRARY_ONLY = document.body && document.body.getAttribute("data-page") === "workspace";

  if (LIBRARY_ONLY) {
    // Undo the instant lock style this file adds at load time — shell.js is doing
    // its own hide/reveal via #wsGate / #wsBody, so this page must not also be
    // forced invisible while its own auth flow is still running.
    var l = document.getElementById("aqGateLock"); if (l) l.remove();
    window.AQGate = { watermark: watermark };
  } else {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
    else run();
  }
})();