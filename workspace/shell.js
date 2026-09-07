/* AQcredix Workspace — shared shell.
   Renders the workspace sub-navigation, handles sign-in/sign-up, exposes the current
   user and a role check that every page uses to decide whether to allow edits. */
(function () {
  "use strict";

  var S = window.AQStore;
  var CFG = window.AQ_CONFIG || {};

  var PAGES = [
    { key: "start", href: "start.html", label: "Start",
      desc: "Choose where to go" },
    { key: "dashboard", href: "dashboard.html", label: "My department",
      desc: "Everything one department is answerable for, in one place" },
    /* ?stay=1 so this link is reachable when the user has pinned another page. Without
       it the pin redirect fires the moment they click Readiness and throws them straight
       back to the pinned page, making the landing page impossible to open. */
    { key: "readiness", href: "workspace.html?stay=1", label: "Readiness",
      desc: "Element-by-element accreditation status" },
    { key: "evidence", href: "evidence.html", label: "Evidence",
      desc: "Everything you hold against one element, for the moment an assessor asks" },
    { key: "audits", href: "audit.html", label: "Internal Audit",
      desc: "Department-level audits against the assessor checklist" },
    { key: "incidents", href: "incidents.html", label: "Incidents",
      desc: "Report, analyse and close patient-safety events" },
    { key: "calendar", href: "calendar.html", label: "Calendar",
      desc: "Committee meetings and recurring NABH obligations" },
    { key: "register", href: "register.html", label: "Register",
      desc: "Equipment, licences, contracts and staff registrations with their renewal cycles" },
    { key: "training", href: "training.html", label: "Training",
      desc: "Induction, fire safety, BLS and competency — who has it and when it lapses" },
    { key: "crashcart", href: "crashcart.html", label: "Short Expiry",
      desc: "Crash cart medicines and their expiry dates" },
    /* Their OWN dashboard, not the general one. Sits in the workspace rather than beside the
       public dashboard because it is built from data only this hospital has. */
    { key: "qualitydashboard", href: "quality-dashboard.html", label: "My Dashboard",
      desc: "Your own departments, KRAs and targets — charted from your own figures" },
    { key: "rounds", href: "rounds.html", label: "Rounds",
      desc: "Recurring checks that produce a score, trended against your target" },
    { key: "capa", href: "capa.html", label: "NC & CAPA",
      desc: "Findings, corrective actions, verification" },
        { key: "library", href: "library.html", label: "Forms & Registers",
      desc: "Every checklist, form and register a department must maintain" },
    { key: "apex", href: "apex.html", label: "Apex Manual",
      desc: "Build and download your hospital's quality manual" },
    { key: "gatepass", href: "gatepass.html", label: "Gate Pass",
      desc: "Material movement — returnable and non-returnable, tracked to closure" },
    { key: "accreditation", href: "accreditation.html", label: "Accreditation",
      desc: "Where you are in the three-year cycle and what falls due next" },
    { key: "documents", href: "documents.html", label: "Documents",
      desc: "Controlled document register" },
    { key: "access", href: "access.html", label: "Access", ownerOnly: true,
      desc: "Subscriptions and payment approvals" },
    { key: "import", href: "import.html", label: "Bulk Import",
      desc: "Bring in existing spreadsheets — equipment, obligations, committees, team" },
    /* "Team" is NOT in this row any more. It is administration — who has a seat, what
       they may open — not one of the jobs somebody comes here to do, and sitting among
       fifteen daily tasks it both lengthened the row and read as one of them. It is now a
       button beside the page heading, which is where the settings for a place usually
       live. Still reachable from every workspace page, still the same page. */
  ];

  /* WHICH GROUP EACH PAGE BELONGS TO, and the order the groups read in.
     Twenty destinations in one flat list is a list of twenty whatever container holds it.
     The grouping is by WHEN somebody reaches for a page, not by what module built it:
     "Daily" is the handful opened every morning, "Prove it" is what an assessor asks for,
     and so on. A page with no group falls into "More" rather than disappearing. */
  var GROUPS = [
    ["Daily",     ["start", "dashboard", "qualitydashboard", "readiness"]],
    ["Prove it",  ["evidence", "audits", "rounds", "accreditation"]],
    ["Incidents", ["incidents", "capa"]],
    ["Running",   ["calendar", "register", "training", "crashcart", "gatepass"]],
    ["Records",   ["library", "apex", "documents"]],
    ["Admin",     ["access", "import"]]
  ];

  /* One 24x24 glyph per page, drawn on a single shared stroke style so the rail reads as
     one set rather than twenty clip-art pieces. Deliberately simple: at 19px on a rail,
     detail becomes noise. Anything without an entry falls back to a dot, so a new page
     added to PAGES never renders a broken icon. */
  var ICONS = {
    start:            'M3 11l9-8 9 8M5 10v10h14V10',
    dashboard:        'M3 3h8v8H3zM13 3h8v5h-8zM13 12h8v9h-8zM3 15h8v6H3z',
    qualitydashboard: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    readiness:        'M12 3l8 4v6c0 4-3.4 7.4-8 8-4.6-.6-8-4-8-8V7zM9 12l2 2 4-4',
    evidence:         'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 14h6M9 17h4',
    audits:           'M9 4h6v3H9zM7 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2M9 13l2 2 4-4',
    rounds:           'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
    accreditation:    'M12 2l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 8.2l5.9-.9zM8 20l4 2 4-2',
    incidents:        'M12 3l9.5 17H2.5zM12 9v5M12 17.5v.5',
    capa:             'M4 20V6a2 2 0 0 1 2-2h6l2 3h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6l-2-3H6',
    calendar:         'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M9 14h2M14 14h2',
    register:         'M5 4h11l3 3v13H5zM8 9h8M8 13h8M8 17h5',
    training:         'M12 4L2 9l10 5 10-5zM6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5',
    crashcart:        'M6 8h12l-1 12H7zM9 8V5a3 3 0 0 1 6 0v3M12 12v5M9.5 14.5h5',
    gatepass:         'M3 8l9-4 9 4-9 4zM3 8v8l9 4 9-4V8M12 12v8',
    library:          'M4 5h5v15H4zM10 5h4v15h-4zM16.5 5.6l3.4.9L17 20.4l-3.4-.9z',
    apex:             'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
    documents:        'M8 3h8l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M16 3v4h4M4 8v11a2 2 0 0 0 2 2h9',
    access:           'M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5M5 10h14v11H5zM12 14v3',
    import:           'M12 3v11M8 10l4 4 4-4M4 18v2h16v-2'
  };

  function icon(key) {
    var d = ICONS[key];
    return '<svg class="ws-rail-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (d ? '<path d="' + d + '"/>' : '<circle cx="12" cy="12" r="4"/>') + "</svg>";
  }

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

    /* WHICH SECTIONS THIS PERSON MAY OPEN.
     *
     * Mirrors can_open() in the database, and is presentation only — the policies are what
     * actually stop a biomedical account reading a gate pass, and they are enforced
     * whatever this returns. Hiding the tab is a courtesy: a menu full of links that
     * answer "not permitted" teaches people the software is broken.
     *
     * An empty or absent list means everything, so nobody's access narrows until an admin
     * deliberately narrows it. The two master roles ignore the list entirely. */
    canOpen: function (key) {
      var u = W.user;
      if (!u) return true;
      if (["owner", "admin", "quality_manager", "director"].indexOf(u.role) > -1) return true;
      var mods = u.modules;
      if (!mods || !mods.length) return true;
      /* Start is the way back to everything else, so it is never hidden. */
      if (key === "start" || key === "dashboard") return true;
      return mods.indexOf(key) > -1;
    },

    /* ---------- sub-navigation ---------- */
    renderNav: function (activeKey) {
      var el = document.getElementById("wsNav");
      if (!el) return;
      var modeChip = S.mode === "local"
        ? '<span class="ws-mode ws-mode-local" title="Data is stored in this browser only">Local mode</span>'
        : '<span class="ws-mode ws-mode-cloud">' + esc((W.user && W.user.role) || "") + "</span>";

      // Owner-only tabs are hidden from everyone else. This is presentation, not
      // security — access.html enforces it again server-side via RLS, because a
      // hidden link is not a locked door.
      function allowed(p) {
        if (p.ownerOnly) return window.AQBilling && window.AQBilling.isOwner(W.user);
        return W.canOpen(p.key);
      }
      var visible = PAGES.filter(allowed);
      var byKey = {};
      visible.forEach(function (p) { byKey[p.key] = p; });

      /* THE RAIL, grouped. Rendered on every screen and hidden by CSS below 1100px, where
         the flat row underneath takes over — one markup pass, no JS listening to width, so
         a resize can never leave the two out of step.

         The link carries the description in its title, so the tooltip answers "what is
         this" for anyone who hovers a moment longer than the rail takes to open. */
      var railHtml = GROUPS.map(function (g) {
        var items = g[1].map(function (k) { return byKey[k]; }).filter(Boolean);
        if (!items.length) return "";
        return '<div class="ws-rail-group">' + esc(g[0]) + "</div>" +
          items.map(function (p) {
            return '<a href="' + p.href + '" class="ws-rail-link' +
              (p.key === activeKey ? " active" : "") + '" title="' + esc(p.desc || p.label) + '">' +
              icon(p.key) + '<span class="ws-rail-label">' + esc(p.label) + "</span></a>";
          }).join("");
      }).join("");

      /* Anything in PAGES that no group claims still has to be reachable. Silence here
         would mean a new page simply vanished from the navigation. */
      var grouped = {};
      GROUPS.forEach(function (g) { g[1].forEach(function (k) { grouped[k] = 1; }); });
      var ungrouped = visible.filter(function (p) { return !grouped[p.key]; });
      if (ungrouped.length) {
        railHtml += '<div class="ws-rail-group">More</div>' + ungrouped.map(function (p) {
          return '<a href="' + p.href + '" class="ws-rail-link' +
            (p.key === activeKey ? " active" : "") + '" title="' + esc(p.desc || p.label) + '">' +
            icon(p.key) + '<span class="ws-rail-label">' + esc(p.label) + "</span></a>";
        }).join("");
      }

      /* The account block, repeated at the foot of the rail. On a wide screen the flat row
         that normally carries it is hidden, and losing "who am I signed in as" and the way
         out would be a real regression. Two sign-out buttons therefore exist; both are
         wired below, and only one is ever on screen because CSS shows one navigation or
         the other, never both. Distinct ids because an id must be unique. */
      var railFoot =
        '<div class="ws-rail-foot">' + modeChip +
          (W.user && W.canOpen("team")
            ? '<a href="team.html" class="ws-team-link' +
              (activeKey === "team" ? " active" : "") + '">Team</a>' : "") +
          (W.user ? '<span class="ws-who">' + esc(W.user.name || W.user.email) + "</span>" +
                    '<button type="button" class="ws-signout" id="wsSignOutRail">Sign out</button>' : "") +
        "</div>";

      el.innerHTML =
        '<nav class="ws-rail" id="wsRail" aria-label="Hospital workspace">' +
          '<div class="ws-rail-in">' + railHtml + railFoot + "</div></nav>" +
        '<div class="ws-nav-inner">' +
          '<div class="ws-nav-links">' +
            visible.map(function (p) {
              return '<a href="' + p.href + '" class="ws-nav-link' +
                (p.key === activeKey ? " active" : "") + '">' + esc(p.label) + "</a>";
            }).join("") +
          "</div>" +
          /* Team sits here with the account, not in the row of jobs above: it is who may
             come in, which belongs beside who you are signed in as. Only shown to people
             who can actually act on it — for everyone else it is a door that opens onto a
             refusal, which is worse than no door. */
          '<div class="ws-nav-right">' + modeChip +
            /* Suppressed where the page already offers Team beside its own heading —
               Start does. Two identical controls a few centimetres apart make a reader
               stop and work out whether they do different things. */
            (W.user && W.canOpen("team") && !document.getElementById("wsTeamBtn")
              ? '<a href="team.html" class="ws-team-link' +
                (activeKey === "team" ? " active" : "") + '">Team</a>' : "") +
            (W.user ? '<span class="ws-who">' + esc(W.user.name || W.user.email) + "</span>" +
                      '<button type="button" class="ws-signout" id="wsSignOut">Sign out</button>' : "") +
          "</div>" +
        "</div>";

      /* The row scrolls sideways on a phone, so the tab for the page you are on can sit
         off the right edge. Bringing it into view is the difference between a menu and a
         menu you can orient yourself in. Harmless on a wide screen, where nothing
         overflows and there is nothing to scroll. */
      var act = el.querySelector(".ws-nav-link.active");
      if (act && act.scrollIntoView) {
        try { act.scrollIntoView({ inline: "center", block: "nearest" }); } catch (e) {}
      }

      /* The Start page carries its own Team button beside the heading. It ships hidden and
         is revealed here, rather than shipping visible and being taken away, so a slow or
         failed sign-in never flashes an administration button at somebody who turns out
         not to be allowed to use it. */
      var teamBtn = document.getElementById("wsTeamBtn");
      if (teamBtn) teamBtn.hidden = !(W.user && W.canOpen("team"));

      /* Both sign-out buttons — the one in the flat row and the one at the foot of the
         rail. Wiring only the first left the rail's button dead on every wide screen. */
      ["wsSignOut", "wsSignOutRail"].forEach(function (id) {
        var so = document.getElementById(id);
        if (so) so.addEventListener("click", async function () {
          await S.signOut();
          location.reload();
        });
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

    /* ---------- subscription gate ----------
       Runs after authentication. Renders the paywall into the same host the auth gate
       uses, so an unentitled user sees the subscribe screen exactly where they would
       have seen the sign-in form. */
    async entitled() {
      if (!window.AQBilling) return true;   // billing not deployed; do not lock people out
      var st = await window.AQBilling.status(W.user);
      W.subscription = st;
      if (st.active) return true;

      var host = document.getElementById("wsGate");
      if (!host) return false;
      W.clearSkeleton();

      /* Preview first, paywall beneath it. A locked page that shows nothing cannot sell
         itself: someone weighing ₹500 a month needs to see what they would be paying for.
         Nothing is leaked — an unsubscribed person has no data, so the preview is sample
         data from a fictional hospital, labelled as such on screen throughout. */
      var pv = document.body.getAttribute("data-preview");
      if (pv && window.AQPreview) {
        host.innerHTML = window.AQPreview.render(pv, "../");
        setTimeout(function () { window.AQPreview.mount(); }, 0);
        var pw = document.createElement("div");
        host.appendChild(pw);
        if (window.AQPaywall) window.AQPaywall.render(pw, W.user, st);
      } else if (window.AQPaywall) {
        window.AQPaywall.render(host, W.user, st);
      } else {
        host.innerHTML = '<div class="ws-auth"><h2>Subscription required</h2></div>';
      }
      return false;
    },

    /* ---------- auth gate ---------- */
    // Returns true when the page may render. In local mode it asks only for a name,
    // because pretending to authenticate against nothing would be theatre.
    /* Clears the loading placeholder. Called on EVERY exit from the gate — signed in,
       paywalled, or signed out — because a skeleton left behind a sign-in panel looks like
       the page is still loading behind it. */
    clearSkeleton() {
      var sk = document.getElementById("wsSkel");
      if (sk) sk.remove();
    },

    async gate() {
      W.user = await S.currentUser();
      /* Workspace pages gate through here rather than billing/page-gate.js, so the
         activity ledger has to be told the user in both places — audits, incidents and
         CAPAs are recorded from inside the workspace and would otherwise all file under
         "guest". */
      if (window.AQActivity) window.AQActivity.setUser(W.user);
      /* Workspace pages gate here rather than through billing/page-gate.js, so the
         owner flag that unlocks the neon palette has to be set in both places. */
      try {
        window.AQ_CURRENT_USER = W.user || null;
        if (W.user && window.AQBilling && window.AQBilling.isOwner(W.user)) {
          localStorage.setItem("aq-is-owner", "1");
        } else {
          /* Clears only the right to CHANGE the palette, never the palette itself.
             This used to also write aq-palette="default" and strip the attribute for
             every non-owner — including a signed-out visitor, since W.user is null on
             this branch too. That write is sticky: one visit to a workspace page while
             signed out flipped the cache to blue permanently, on every page, on that
             device, and no amount of reloading brought neon back. It is the reason the
             site opened blue on a phone. page-gate.js already learned this lesson; the
             two gates must agree. */
          localStorage.removeItem("aq-is-owner");
        }
      } catch (e) { /* storage unavailable: palette stays as booted */ }
      if (W.user) {
        // Same watermark as the rest of the site, minus the copy/right-click
        // restriction on your own account — see auth-gate.js for the full policy.
        if (window.AQGate && W.user.role !== "owner") window.AQGate.watermark(W.user);
        // Signed in is not the same as entitled. The paywall is a second gate, and it
        // fails closed: if entitlement cannot be established, access is held rather
        // than granted.
        var okEnt = await W.entitled();
        W.clearSkeleton();
        /* Announced once the user AND their entitlement are known. The notification bell
           listens for this rather than DOMContentLoaded: before sign-in there is no org to
           read, and firing early would produce an empty bell that never refills. */
        if (okEnt) {
          try { document.dispatchEvent(new Event("aq:ready")); } catch (e) {}
        }
        return okEnt;
      }

      var host = document.getElementById("wsGate");
      if (!host) { W.clearSkeleton(); return true; }

      /* SIGNED OUT IS AN ANSWER, NOT A STALL. The placeholder belongs to "we are still
         finding out"; once there is a sign-in panel on screen the finding out is over. Left
         behind, it shimmers beside the form and then, twelve seconds later, replaces itself
         with "the workspace could not reach the server" — on a page whose server answered
         immediately. Every workspace page did this to every signed-out visitor. */
      W.clearSkeleton();

      if (S.mode === "local") {
        // No backend is connected, so there is nothing to authenticate against. Site
        // policy is that every exclusive page requires a real account — a typed name
        // is not that, so this is refused rather than accepted as a workaround.
        host.innerHTML =
          '<div class="ws-auth"><h2>Sign-in isn’t connected yet</h2>' +
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

        /* ENTER SUBMITS — same reasoning as auth-gate.js, and it has to be done in both
           or the two panels behave differently depending on which one the person met.
           There is no <form> here either, so Enter was silently ignored. Routed through
           the button's click so a single handler stays the only sign-in path. */
        body.querySelectorAll("input").forEach(function (inp) {
          inp.addEventListener("keydown", function (ev) {
            if (ev.key !== "Enter") return;
            ev.preventDefault();
            var go = body.querySelector("#auGo");
            if (go && !go.disabled) go.click();
          });
        });

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
            /* Translate rather than dumping the raw response. Supabase returns JSON on
               failure, and printing it left a person reading
               {"code":400,"error_code":"email_not_confirmed",...} with no idea whether the
               account was missing, unconfirmed, or the password simply wrong — three
               problems with three different fixes. Shared with auth-gate.js so the two
               panels cannot drift apart. */
            msg.textContent = window.AQAuthError
              ? window.AQAuthError(err).text
              : String(err.message || err).slice(0, 220);
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
  /* A request that never returns would otherwise leave the placeholder shimmering for
     ever, which tells the visitor nothing and looks broken. After twelve seconds, say so
     plainly and offer the one action that helps. */
  (function wsSkelTimeout() {
    setTimeout(function () {
      var sk = document.getElementById("wsSkel");
      if (!sk) return;
      sk.className = "wrap ws-skel-stalled";
      sk.innerHTML = "<h2>This is taking longer than it should</h2>" +
        "<p>The workspace could not reach the server. Check your connection and reload — " +
        "nothing you have entered is affected.</p>" +
        '<button class="btn btn-accent" onclick="location.reload()">Reload</button>';
    }, 12000);
  })();

})();