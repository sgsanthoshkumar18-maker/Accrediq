/* AQcredix — page-level access gate.
 *
 * The workspace has its own gate inside shell.js. This is the equivalent for every other
 * protected page, which have no workspace shell to hang it on.
 *
 * A page declares what it needs with a body attribute:
 *
 *   <body data-access="free">   nothing required (default when the attribute is absent)
 *   <body data-access="login">  a signed-in account, no payment
 *   <body data-access="paid">   a signed-in account with an active subscription
 *
 * Honest limitation, stated plainly because it changes what this is for: this runs in the
 * browser, so it controls what the page DISPLAYS, not what a determined person can
 * retrieve. Anyone who opens developer tools can read the page source and the standards
 * data behind it. That is true of every client-side paywall on a static site, and no
 * amount of obfuscation changes it.
 *
 * What actually protects the valuable material is that the workspace's data — audits,
 * incidents, CAPA, documents — lives in Supabase behind row-level security, where the
 * database refuses to hand it over without a valid session. This gate is the front door;
 * RLS is the lock on the safe.
 */
(function () {
  "use strict";

  function need() {
    var v = (document.body && document.body.getAttribute("data-access")) || "free";
    return String(v).toLowerCase();
  }

  function base() {
    return (document.body && document.body.getAttribute("data-base")) || "";
  }

  function shell(title, bodyHtml) {
    return '<div class="ag-wrap"><div class="ag-card">' +
      '<svg class="ag-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="16" stroke="var(--border)" stroke-width="2.6"/>' +
      '<path d="M20 4a16 16 0 1 1-11.31 4.69" stroke="var(--accent-bright)" ' +
      'stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M19.15 14.05H20.85L25.61 25.015H26.97V25.95H22.21V25.015H23.315L22 22H18L16.685 25.015H17.79V25.95H13.03V25.015H14.39ZM20 16.26L22.027 20.935H17.973Z" fill="var(--accent-bright)" fill-rule="evenodd"/></svg>' +
      "<h1>" + title + "</h1>" + bodyHtml + "</div></div>";
  }

  /* Replaces the page content rather than overlaying it. An overlay leaves the real
     content in the DOM underneath, which anyone can reveal by deleting one element —
     that is a curtain, not a gate. */
  function block(html) {
    var main = document.getElementById("aq-main") || document.querySelector("main");
    if (main) {
      main.innerHTML = html;
    } else {
      var keep = document.getElementById("site-header");
      document.body.innerHTML = "";
      if (keep) document.body.appendChild(keep);
      var d = document.createElement("div");
      d.innerHTML = html;
      document.body.appendChild(d);
    }
    document.body.setAttribute("data-gated", "1");
  }

  function signInPrompt(paid) {
    var b = base();
    return shell(
      paid ? "This is part of the AQcredix workspace" : "Sign in to continue",
      "<p>" + (paid
        ? "Readiness scoring, internal audit, incident reporting, CAPA, documents and the " +
          "practice tools are part of the subscription. The standards library stays free."
        : "The standards library is free, but it needs an account so your progress and " +
          "bookmarks stay with you.") + "</p>" +
      '<p class="ag-actions">' +
      '<a class="btn btn-accent" href="' + b + 'workspace/workspace.html">' +
      (paid ? "Sign in or subscribe" : "Sign in") + "</a> " +
      '<a class="btn btn-ghost" href="' + b + 'standards.html">Browse the standards</a>' +
      "</p>");
  }

  function subscribePrompt(st) {
    var b = base();
    var extra = "";
    if (st && st.reason === "expired") {
      extra = "<p>Your subscription ended on " +
        (window.AQBilling ? window.AQBilling.fmtDate(st.record && st.record.expires_at) : "") +
        ". Your data is untouched and returns the moment you renew.</p>";
    } else if (st && st.reason === "pending") {
      extra = "<p>Your payment has been submitted and is awaiting confirmation. " +
        "You will not need to pay again.</p>";
    } else if (st && st.reason === "unavailable") {
      extra = "<p>Subscription status could not be checked just now, so access is held " +
        "rather than opened. If you have an active subscription nothing has been lost \u2014 " +
        "please reload in a moment.</p>";
    }
    return shell("Subscription required",
      "<p>This page is part of the AQcredix workspace subscription.</p>" + extra +
      '<p class="ag-actions">' +
      '<a class="btn btn-accent" href="' + b + 'workspace/workspace.html">View plans</a> ' +
      '<a class="btn btn-ghost" href="' + b + 'standards.html">Browse the standards</a>' +
      "</p>");
  }

  async function run() {
    var mode = need();
    if (mode === "free") return;

    var S = window.AQStore;
    if (!S) return;    // billing/store not loaded on this page; do not lock people out

    var user = null;
    try { user = await S.currentUser(); } catch (e) { user = null; }

    /* The gate runs on every protected page and is the one place the signed-in user is
       resolved, so it is where the activity ledger learns whose history to write to.
       Without this every entry files under "guest" and the profile page reports zero for
       someone who has been using the site all week. */
    if (window.AQActivity) window.AQActivity.setUser(user);

    if (!user) { block(signInPrompt(mode === "paid")); return; }
    if (mode === "login") return;

    if (!window.AQBilling) return;
    var st = await window.AQBilling.status(user);
    if (st.active) return;
    block(subscribePrompt(st));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
