/* AQcredix — set a new password from a recovery link.
 *
 * Supabase mails a link back to whatever redirect_to the recover call named.
 * Until now that was the site root, which reads no token, so every reset
 * dead-ended on the homepage looking like it had worked. This page is where
 * the link lands now, and it is the only thing on the site that can set a
 * password for somebody who cannot sign in.
 *
 * TWO LINK SHAPES, BECAUSE SUPABASE HAS SHIPPED BOTH.
 *   1. Implicit  #access_token=...&type=recovery   (fragment)
 *   2. PKCE      ?code=...                          (query)
 * Which one arrives depends on the project's age and the client that sent it.
 * Handling only the shape we happen to see today is how this breaks again in
 * a year, so both are handled.
 *
 * THE TOKEN IS SCRUBBED FROM THE URL the moment it is read. A recovery token
 * is a credential: leaving it in the address bar puts it in browser history,
 * in screen shares, and in the Referer header of anything the page loads next.
 */
(function () {
  "use strict";

  var S = window.AQStore;
  var token = null;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------------------------- read the link ---------------------------- */

  /* '+' means space here, and decodeURIComponent does not know that — it only
     handles %XX. Supabase form-encodes error_description, so without the swap
     a dead link reads "Email+link+is+invalid+or+has+expired" to the user. */
  function decodeParam(s) {
    try { return decodeURIComponent(String(s).replace(/\+/g, " ")); }
    catch (e) { return String(s).replace(/\+/g, " "); }
  }

  function readFragment() {
    var h = String(location.hash || "").replace(/^#/, "");
    if (!h) return null;
    var out = {};
    h.split("&").forEach(function (kv) {
      var i = kv.indexOf("=");
      if (i > 0) out[decodeParam(kv.slice(0, i))] = decodeParam(kv.slice(i + 1));
    });
    return out;
  }
  function readQuery(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }
  /* Replace the URL without the credential, keeping the entry in place so Back
     does not walk the user into a token-bearing URL. */
  function scrubUrl() {
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
  }

  /* ------------------------------- strength -------------------------------
     Advisory only. It nudges towards a longer password; it never blocks one,
     because a rule that refuses the password somebody can actually remember
     just sends them back to writing it on a sticky note. The only hard floor
     is Supabase's own six characters. */
  function strength(pw) {
    var n = 0;
    if (pw.length >= 8) n++;
    if (pw.length >= 12) n++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n++;
    if (/\d/.test(pw)) n++;
    if (/[^A-Za-z0-9]/.test(pw)) n++;
    if (pw.length < 6) n = 0;
    return Math.min(n, 4);
  }
  var BANDS = [
    { w: "12%", c: "var(--nc)",   t: "Too short — six characters minimum" },
    { w: "30%", c: "var(--nc)",   t: "Weak" },
    { w: "55%", c: "var(--warn)", t: "Fair" },
    { w: "78%", c: "var(--warn)", t: "Good" },
    { w: "100%", c: "var(--ok)",  t: "Strong" },
  ];

  /* -------------------------------- render -------------------------------- */

  var EYE_OPEN =
    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF =
    '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>' +
    '<line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function field(id, label, placeholder) {
    return '<div class="rp-f">' +
      '<label for="' + id + '">' + esc(label) + "</label>" +
      '<div class="rp-in">' +
        '<input id="' + id + '" type="password" autocomplete="new-password" ' +
          'placeholder="' + esc(placeholder) + '" spellcheck="false">' +
        '<button type="button" class="rp-eye" data-eye="' + id + '" ' +
          'aria-label="Show password" aria-pressed="false">' + EYE_OPEN + "</button>" +
      "</div>" +
    "</div>";
  }

  function renderForm(email) {
    el("rpBody").innerHTML =
      "<h1>Choose a new password</h1>" +
      '<p class="rp-sub">' +
        (email ? "For <b>" + esc(email) + "</b>. " : "") +
        "Type it twice so a slip of the finger does not lock you out again." +
      "</p>" +
      field("rpPw", "New password", "At least 6 characters") +
      '<div class="rp-meter"><i id="rpMeter"></i></div>' +
      '<div class="rp-hint" id="rpHint">&nbsp;</div>' +
      '<div style="height:14px"></div>' +
      field("rpPw2", "Type it again", "Repeat the new password") +
      '<button type="button" class="rp-btn" id="rpSave">Save new password</button>' +
      '<div class="rp-msg" id="rpMsg"></div>';
    wireForm();
  }

  function fail(text) {
    el("rpBody").innerHTML =
      "<h1>This link cannot be used</h1>" +
      '<p class="rp-sub">' + esc(text) + "</p>" +
      '<p class="rp-sub">Reset links are single-use and expire after about an hour. ' +
      "Ask for a fresh one from the sign-in screen and open it on this device.</p>" +
      '<a class="rp-btn" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box" ' +
        'href="workspace/start">Go to sign in</a>';
  }

  function msg(kind, text) {
    var m = el("rpMsg");
    if (!m) return;
    m.className = "rp-msg on " + kind;
    m.innerHTML = text;
  }

  /* --------------------------------- wire --------------------------------- */

  function wireForm() {
    document.querySelectorAll("[data-eye]").forEach(function (b) {
      b.addEventListener("click", function () {
        var input = el(b.getAttribute("data-eye"));
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        b.innerHTML = showing ? EYE_OPEN : EYE_OFF;
        b.setAttribute("aria-label", showing ? "Show password" : "Hide password");
        b.setAttribute("aria-pressed", showing ? "false" : "true");
        input.focus();
      });
    });

    var pw = el("rpPw");
    pw.addEventListener("input", function () {
      var v = pw.value;
      var band = BANDS[strength(v)];
      var meter = el("rpMeter");
      meter.style.width = v ? band.w : "0";
      meter.style.background = band.c;
      el("rpHint").textContent = v ? band.t : " ";
    });

    [el("rpPw"), el("rpPw2")].forEach(function (i) {
      i.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); save(); }
      });
    });

    el("rpSave").addEventListener("click", save);
    pw.focus();
  }

  async function save() {
    var pw = el("rpPw").value;
    var pw2 = el("rpPw2").value;
    var btn = el("rpSave");

    if (pw.length < 6) { msg("bad", "Passwords must be at least 6 characters."); return; }
    if (pw !== pw2)    { msg("bad", "The two passwords do not match."); el("rpPw2").focus(); return; }

    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await S.adapter.setPasswordWithToken(token, pw);
      el("rpBody").innerHTML =
        "<h1>Password changed</h1>" +
        '<p class="rp-sub">Your new password is saved. Sign in with it now — ' +
        "the old one no longer works, and the link you used has been spent.</p>" +
        '<a class="rp-btn" style="display:block;text-align:center;text-decoration:none;box-sizing:border-box" ' +
          'href="workspace/start">Sign in</a>';
    } catch (err) {
      var t = String((err && err.message) || err || "");
      var friendly =
        /expired|invalid|JWT/i.test(t)
          ? "That reset link has expired or was already used. Ask for a fresh one from the sign-in screen."
          : /weak|short|least/i.test(t)
            ? "Supabase rejected that password as too weak. Try a longer one."
            : t || "Something went wrong saving the password.";
      msg("bad", esc(friendly));
      btn.disabled = false;
      btn.textContent = "Save new password";
    }
  }

  /* --------------------------------- boot --------------------------------- */

  async function boot() {
    if (!S || !S.adapter || S.adapter.mode !== "supabase") {
      fail("Accounts are not connected on this build, so there is no password to change.");
      return;
    }

    var frag = readFragment() || {};

    /* Supabase reports a dead link by redirecting WITH an error in the
       fragment rather than by failing, so this has to be read before the
       token, or an expired link renders an empty form that fails on submit. */
    if (frag.error || frag.error_description) {
      fail(frag.error_description || frag.error);
      scrubUrl();
      return;
    }

    if (frag.access_token && (frag.type === "recovery" || !frag.type)) {
      token = frag.access_token;
      scrubUrl();
      renderForm(null);
      return;
    }

    var code = readQuery("code");
    if (code) {
      try {
        var s = await S.adapter.exchangeCodeForSession(code);
        token = s && s.access_token;
        scrubUrl();
        if (!token) throw new Error("no token returned");
        renderForm((s.user && s.user.email) || null);
      } catch (e) {
        fail("This reset link could not be verified. It may have expired or already been used.");
      }
      return;
    }

    fail("This page opens from the link in a password-reset email, and no reset token came with it.");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
