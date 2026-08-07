/* AQcredix Workspace — shared shell.
   Renders the workspace sub-navigation, handles sign-in/sign-up, exposes the current
   user and a role check that every page uses to decide whether to allow edits. */
(function () {
  "use strict";

  var S = window.AQStore;
  var CFG = window.AQ_CONFIG || {};

  var PAGES = [
    { key: "readiness", href: "workspace.html", label: "Readiness",
      desc: "Element-by-element accreditation status" },
    { key: "audits", href: "audit.html", label: "Internal Audit",
      desc: "Department-level audits against the assessor checklist" },
    { key: "capa", href: "capa.html", label: "NC & CAPA",
      desc: "Findings, corrective actions, verification" },
    { key: "documents", href: "documents.html", label: "Documents",
      desc: "Controlled document register" },
    { key: "team", href: "team.html", label: "Team",
      desc: "Seats, roles and departments" }
  ];

  var ROLE_RANK = { owner: 4, admin: 3, editor: 2, viewer: 1 };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var W = {
    user: null,
    esc: esc,

    canEdit: function () {
      if (S.mode === "local") return true;              // single user, own browser
      return (ROLE_RANK[(W.user && W.user.role) || "viewer"] || 0) >= 2;
    },
    isAdmin: function () {
      if (S.mode === "local") return true;
      return (ROLE_RANK[(W.user && W.user.role) || "viewer"] || 0) >= 3;
    },

    toast: function (msg, kind) {
      var t = document.getElementById("wsToast");
      if (!t) {
        t = document.createElement("div"); t.id = "wsToast"; t.className = "ws-toast";
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.className = "ws-toast show" + (kind ? " " + kind : "");
      clearTimeout(W._tt);
      W._tt = setTimeout(function () { t.className = "ws-toast"; }, 2600);
    },

    /* ---------- sub-navigation ---------- */
    renderNav: function (activeKey) {
      var el = document.getElementById("wsNav");
      if (!el) return;
      var modeChip = S.mode === "local"
        ? '<span class="ws-mode ws-mode-local" title="Data is stored in this browser only">Local mode</span>'
        : '<span class="ws-mode ws-mode-cloud">' + esc((W.user && W.user.role) || "") + "</span>";

      el.innerHTML =
        '<div class="ws-nav-inner">' +
          '<div class="ws-nav-links">' +
            PAGES.map(function (p) {
              return '<a href="' + p.href + '" class="ws-nav-link' +
                (p.key === activeKey ? " active" : "") + '">' + esc(p.label) + "</a>";
            }).join("") +
          "</div>" +
          '<div class="ws-nav-right">' + modeChip +
            (W.user ? '<span class="ws-who">' + esc(W.user.name || W.user.email) + "</span>" +
                      '<button type="button" class="ws-signout" id="wsSignOut">Sign out</button>' : "") +
          "</div>" +
        "</div>";

      var so = document.getElementById("wsSignOut");
      if (so) so.addEventListener("click", async function () {
        await S.signOut();
        location.reload();
      });
    },

    /* ---------- local-mode warning ---------- */
    renderModeNotice: function () {
      var el = document.getElementById("wsNotice");
      if (!el || S.mode !== "local") return;
      el.innerHTML =
        '<div class="ws-notice">' +
          "<strong>Local mode.</strong> Everything on these pages works, but your data is " +
          "saved in this browser only — it is not shared with your team, and clearing your " +
          "browser data will erase it. Export regularly from the Readiness page. " +
          "To switch on real accounts and team access, follow the steps in " +
          "<code>workspace/config.js</code>." +
        "</div>";
    },

    /* ---------- auth gate ---------- */
    // Returns true when the page may render. In local mode it asks only for a name,
    // because pretending to authenticate against nothing would be theatre.
    async gate() {
      W.user = await S.currentUser();
      if (W.user) {
        // Same watermark as the rest of the site, minus the copy/right-click
        // restriction on your own account — see auth-gate.js for the full policy.
        if (window.AQGate && W.user.role !== "owner") window.AQGate.watermark(W.user);
        return true;
      }

      var host = document.getElementById("wsGate");
      if (!host) return true;

      if (S.mode === "local") {
        // No backend is connected, so there is nothing to authenticate against. Site
        // policy is that every exclusive page requires a real account — a typed name
        // is not that, so this is refused rather than accepted as a workaround.
        host.innerHTML =
          '<div class="ws-auth"><h2>Sign-in isn\u2019t connected yet</h2>' +
          '<p>This copy of AQcredix has no backend configured. Until it is, the Workspace ' +
          "cannot issue real accounts, so it stays locked rather than accept a typed name as " +
          "a substitute for one.</p>" +
          '<a class="btn btn-accent" href="../index.html">Back to Home</a></div>';
        return false;
      }

      host.innerHTML =
        '<div class="ws-auth"><div class="ws-auth-tabs">' +
          '<button type="button" class="active" data-t="in">Sign in</button>' +
          '<button type="button" data-t="up">Create account</button></div>' +
        '<div id="wsAuthBody"></div><p class="ws-auth-msg" id="wsAuthMsg"></p></div>';

      var body = host.querySelector("#wsAuthBody");
      var msg = host.querySelector("#wsAuthMsg");

      function draw(tab) {
        body.innerHTML =
          '<label for="auEmail">Work email</label><input id="auEmail" type="email" autocomplete="email">' +
          '<label for="auPass">Password</label><input id="auPass" type="password" autocomplete="current-password">' +
          (tab === "up"
            ? '<label for="auName">Your name</label><input id="auName" type="text">' +
              '<label for="auOrg">Hospital name</label><input id="auOrg" type="text">'
            : "") +
          '<button type="button" class="btn btn-accent" id="auGo">' +
            (tab === "up" ? "Create account" : "Sign in") + "</button>";

        body.querySelector("#auGo").addEventListener("click", async function () {
          var e = body.querySelector("#auEmail").value.trim();
          var p = body.querySelector("#auPass").value;
          if (!e || !p) { msg.textContent = "Email and password are both needed."; return; }
          if (tab === "up" && p.length < 8) {
            msg.textContent = "Use at least 8 characters."; return;
          }
          this.disabled = true; msg.textContent = "Working…";
          try {
            if (tab === "up") {
              await S.adapter.signUp(e, p,
                body.querySelector("#auName").value.trim() || e,
                body.querySelector("#auOrg").value.trim() || "My Hospital");
              msg.textContent = "Account created. If your project requires email confirmation, check your inbox, then sign in.";
            } else {
              await S.adapter.signInPassword(e, p);
            }
            location.reload();
          } catch (err) {
            msg.textContent = String(err.message || err).slice(0, 220);
            this.disabled = false;
          }
        });
      }
      draw("in");
      host.querySelectorAll(".ws-auth-tabs button").forEach(function (b) {
        b.addEventListener("click", function () {
          host.querySelectorAll(".ws-auth-tabs button").forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          msg.textContent = "";
          draw(b.getAttribute("data-t"));
        });
      });
      return false;
    },

    /* ---------- helpers shared by pages ---------- */
    DEPARTMENTS: (window.DEPT_DATA || []).map(function (d) { return d.name; }).sort(),

    fmtDate: function (d) {
      if (!d) return "—";
      try { return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
      catch (e) { return d; }
    },
    isOverdue: function (d, status) {
      if (!d || status === "closed" || status === "verified") return false;
      return new Date(d) < new Date(new Date().toDateString());
    },
    today: function () { return new Date().toISOString().slice(0, 10); }
  };

  window.AQWorkspace = W;
})();
