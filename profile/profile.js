/* AQcredix — profile / my progress.
 *
 * Answers three questions for a subscriber:
 *   1. What is on this site, and how much of it have I actually used?
 *   2. How much work have I done — quizzes, certificates, gap analyses, mock surveys,
 *      audits, SOPs, incidents?
 *   3. When did my subscription start, what did I pay, and when does it end?
 *
 * Counts come from the activity ledger (profile/activity.js) plus two stores that already
 * existed before the ledger did — the mock surveyor's own attempt history and the
 * readiness scores. Reading those directly means a person who used the site before this
 * page shipped still sees their earlier work instead of a wall of zeroes.
 */
(function () {
  "use strict";

  var A = window.AQActivity;
  var S = window.AQStore;
  var B = window.AQBilling;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Same convention as app.js: the prefix that makes a root-relative link work from
     whatever depth the page sits at. profile.html is at the root, so this is "", but
     reading it rather than assuming keeps the page movable. */
  function base() {
    return document.body.getAttribute("data-base") || "";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtRupees(paise) {
    if (paise == null) return "—";
    var r = paise / 100;
    // Whole rupees read better on an invoice line; paise only shown when they exist.
    return "\u20B9" + r.toLocaleString("en-IN", {
      minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2
    });
  }

  function relative(iso) {
    if (!iso) return "";
    var days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (isNaN(days)) return "";
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + " days ago";
    if (days < 365) return Math.floor(days / 30) + " months ago";
    return Math.floor(days / 365) + " years ago";
  }

  /* Counts that predate the ledger, read from the stores those features already wrote to.
     Without this a long-standing user would open the page and see nothing, and conclude
     the tracker is broken rather than new. */
  function legacyCount(key, email) {
    try {
      if (key === "mock_audit") {
        var all = JSON.parse(localStorage.getItem("aq-surveyor-profiles") || "{}");
        var mine = all[String(email || "").trim().toLowerCase()] || [];
        return mine.length;
      }
    } catch (e) { /* a malformed legacy store must not blank the whole page */ }
    return 0;
  }

  /* Counts read from Supabase rather than from the local ledger.
   *
   * Audits, incidents and CAPAs are already written to real tables by the workspace, so
   * they can be counted from the source. That makes these three genuinely cross-device:
   * a gap analysis done on the ward tablet still counts when the same account opens the
   * site on a desk PC. No new writes and no new policies were added to get this — it is
   * a read of rows that already exist, which is why it carries none of the risk of
   * instrumenting those features with a second write path.
   *
   * IMPORTANT: these tables are scoped to the ORGANISATION, not the individual, because
   * row-level security grants a member access to their org's rows. So these three are
   * the hospital's totals, not one person's. The page labels them that way — quietly
   * reporting a colleague's audit as your own would be a lie the user could catch.
   *
   * Fails soft: if the read fails the local figure is used instead, so an outage shows a
   * smaller number rather than an error page.
   */
  async function serverCounts() {
    var out = {};
    if (!S || !S.adapter || S.mode !== "supabase") return out;

    var jobs = [
      ["audit_completed", "audits", function (r) { return r.status === "completed" || r.finished_at; }],
      ["incident_reported", "incidents", function (r) { return !!r.submitted_at; }],
      ["capa_created", "capa", function () { return true; }]
    ];

    await Promise.all(jobs.map(async function (job) {
      try {
        var rows = await S.adapter.list(job[1]);
        if (Array.isArray(rows)) out[job[0]] = rows.filter(job[2]).length;
      } catch (e) { /* leave undefined; the local count is used */ }
    }));
    return out;
  }

  var SERVER = {};          // filled once, before the stats render

  function countFor(f, email) {
    // A server figure, where one exists, is authoritative: it survives a cleared browser
    // and a change of device, which the ledger does not.
    if (SERVER[f.key] != null) return SERVER[f.key];
    var live = f.distinctBy ? A.distinct(f.key, f.distinctBy) : A.count(f.key);
    var legacy = legacyCount(f.key, email);
    // The ledger and the legacy store can describe the same attempt, so take the larger
    // rather than the sum — adding them would double-count every mock survey run after
    // the ledger shipped.
    return Math.max(live, legacy);
  }

  /* Consecutive days with at least one recorded action, counting back from today. Stops
     at the first gap. A streak that counts today only if something was done today would
     read as broken every morning, so today is allowed to be empty while yesterday still
     holds the streak up. */
  function streak(timeline) {
    if (!timeline.length) return 0;
    var days = {};
    timeline.forEach(function (e) {
      var d = new Date(e.at);
      if (!isNaN(d)) days[d.toISOString().slice(0, 10)] = true;
    });
    var n = 0, cursor = new Date();
    if (!days[cursor.toISOString().slice(0, 10)]) cursor.setDate(cursor.getDate() - 1);
    for (;;) {
      if (!days[cursor.toISOString().slice(0, 10)]) break;
      n++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return n;
  }

  function statCard(f, count) {
    var pct = Math.min(100, Math.round((count / f.goal) * 100));
    var last = A.lastAt(f.key);
    var fromServer = SERVER[f.key] != null;
    /* Says where the number came from. Without this the three org-wide, server-backed
       figures sit beside six device-local personal ones looking identical, and the user
       has no way to tell that one of them counts their colleagues' work too. */
    var note = fromServer
      ? "Hospital total \u00B7 synced"
      : (count ? esc(relative(last) || "recorded") : "Not started yet");
    return '<a class="pf-stat' + (fromServer ? " is-synced" : "") + '" href="' + esc(f.href) + '">' +
      '<div class="pf-stat-n">' + count + "</div>" +
      '<div class="pf-stat-l">' + esc(f.label) + "</div>" +
      '<div class="pf-bar" role="progressbar" aria-valuenow="' + count +
        '" aria-valuemin="0" aria-valuemax="' + f.goal + '">' +
        '<span style="width:' + pct + '%"></span></div>' +
      '<div class="pf-stat-m">' + note + "</div></a>";
  }

  function renderStats(host, email) {
    var groups = {};
    A.FEATURES.forEach(function (f) {
      (groups[f.group] = groups[f.group] || []).push(f);
    });

    var used = 0;
    var html = "";
    Object.keys(groups).forEach(function (g) {
      html += '<h3 class="pf-group">' + esc(g) + "</h3><div class=\"pf-grid\">";
      groups[g].forEach(function (f) {
        var n = countFor(f, email);
        if (n > 0) used++;
        html += statCard(f, n);
      });
      html += "</div>";
    });

    var total = A.FEATURES.length;
    var pct = Math.round((used / total) * 100);
    var coverage = '<div class="pf-coverage">' +
      '<div class="pf-cov-head"><b>' + used + " of " + total + " features used</b>" +
      "<span>" + pct + "%</span></div>" +
      '<div class="pf-bar pf-bar-lg"><span style="width:' + pct + '%"></span></div>' +
      "<p>" + (used === total
        ? "You have used every tool on the site at least once."
        : "The cards below with no count are tools you have not opened yet \u2014 each one links straight to it.") +
      "</p></div>";

    host.innerHTML = coverage + html;
  }

  function renderNext(host, email) {
    // Suggest the untouched tools, not a generic nudge. Ordered as the feature list is,
    // which runs roughly from lightest to heaviest commitment.
    var unused = A.FEATURES.filter(function (f) { return countFor(f, email) === 0; });
    if (!unused.length) {
      host.innerHTML = '<div class="pf-next-done">Every tool has been used at least once. ' +
        "Keep the streak going \u2014 readiness is a cycle, not a finish line.</div>";
      return;
    }
    host.innerHTML = '<ul class="pf-next">' + unused.slice(0, 4).map(function (f) {
      return '<li><a href="' + esc(f.href) + '"><b>' + esc(f.label.replace(/s$/, "")) +
        "</b><span>Try your first " + esc(f.verb) + "</span></a></li>";
    }).join("") + "</ul>";
  }

  async function renderSubscription(host, user) {
    try {
      var st = await B.status(user);

      if (st.owner) {
        host.innerHTML = '<div class="pf-sub pf-sub-owner"><div class="pf-sub-row">' +
          "<span>Plan</span><b>Owner \u2014 full access</b></div>" +
          '<div class="pf-sub-row"><span>Renews</span><b>Never expires</b></div>' +
          "<p class=\"pf-sub-note\">This account owns the platform and bypasses billing.</p></div>";
        return;
      }

      if (st.reason === "unavailable") {
        host.innerHTML = '<div class="pf-sub pf-sub-warn"><b>Subscription details unavailable.</b>' +
          "<p>The billing record could not be read just now. Your access is unaffected if " +
          "your plan is active; try again shortly.</p>" +
          '<p class="pf-tech">' + esc(st.error || "") + "</p></div>";
        return;
      }

      var rows = [];
      var r = st.record || null;

      if (st.active && r) {
        var startedAt = r.activated_at || r.requested_at || r.created_at;
        rows.push(["Status", '<b class="pf-ok">Active</b>']);
        rows.push(["Plan", esc(r.plan === "yearly" ? "Annual" : "Monthly") +
          (r.months ? " \u00B7 " + r.months + " month" + (r.months > 1 ? "s" : "") : "")]);
        rows.push(["Amount paid", esc(fmtRupees(r.amount_paise))]);
        rows.push(["Started", esc(fmtDate(startedAt))]);
        rows.push(["Ends", esc(fmtDate(r.expires_at))]);
        rows.push(["Days remaining", st.daysLeft != null
          ? '<b' + (st.daysLeft <= 7 ? ' class="pf-warn"' : "") + ">" + st.daysLeft + "</b>"
          : "—"]);
        if (r.txn_ref) rows.push(["Payment reference", esc(r.txn_ref)]);

        var note = st.daysLeft != null && st.daysLeft <= 7
          ? '<p class="pf-sub-note pf-warn">Your plan ends in ' + st.daysLeft +
            " day" + (st.daysLeft === 1 ? "" : "s") + ". Renew to keep access to the workspace.</p>"
          : "";
        host.innerHTML = '<div class="pf-sub">' + rows.map(function (kv) {
          return '<div class="pf-sub-row"><span>' + kv[0] + "</span><b>" + kv[1] + "</b></div>";
        }).join("") + "</div>" + note;
        return;
      }

      /* status() signals this through `reason`, not a `pending` flag — the docstring at
         the top of billing.js lists a `pending` field that the function never actually
         sets. Check the reason. */
      if (st.reason === "pending") {
        var pr = st.record || {};
        host.innerHTML = '<div class="pf-sub pf-sub-warn"><b>Payment submitted \u2014 awaiting approval.</b>' +
          "<p>Your reference has been received and is being checked against the bank " +
          "statement. Access opens as soon as it is approved.</p>" +
          (pr.requested_at ? "<p>Submitted " + esc(fmtDate(pr.requested_at)) + "." : "") +
          (pr.amount_paise != null ? " Amount " + esc(fmtRupees(pr.amount_paise)) + "." : "") +
          (pr.requested_at ? "</p>" : "") + "</div>";
        return;
      }

      /* An expired plan is the case that most needs its dates shown: this person is
         deciding whether to renew and wants to know what they had and when it ran out.
         This is also why the page is gated at "login" rather than "paid" — locking it
         would hide the renewal information behind the thing needing renewal. */
      if (st.reason === "expired" && st.record) {
        var x = st.record;
        var lapsed = Math.floor((Date.now() - new Date(x.expires_at)) / 86400000);
        host.innerHTML = '<div class="pf-sub">' +
          '<div class="pf-sub-row"><span>Status</span><b class="pf-warn">Expired</b></div>' +
          '<div class="pf-sub-row"><span>Plan</span><b>' +
            esc(x.plan === "yearly" ? "Annual" : "Monthly") + "</b></div>" +
          '<div class="pf-sub-row"><span>Amount paid</span><b>' +
            esc(fmtRupees(x.amount_paise)) + "</b></div>" +
          '<div class="pf-sub-row"><span>Started</span><b>' +
            esc(fmtDate(x.activated_at || x.requested_at || x.created_at)) + "</b></div>" +
          '<div class="pf-sub-row"><span>Ended</span><b>' + esc(fmtDate(x.expires_at)) +
            (isNaN(lapsed) ? "" : " \u00B7 " + lapsed + " day" + (lapsed === 1 ? "" : "s") + " ago") +
          "</b></div></div>" +
          '<p class="pf-sub-note">Your work is kept. Renewing restores access to it ' +
          'immediately. <a href="' + base() + 'dashboard.html">View plans</a></p>';
        return;
      }

      host.innerHTML = '<div class="pf-sub pf-sub-none"><b>No active subscription.</b>' +
        "<p>Free pages stay open. The departments, workspace, quiz and tools need a plan.</p>" +
        '<a class="btn btn-accent btn-sm" href="' + base() + 'dashboard.html">View plans</a></div>';
    } catch (e) {
      host.innerHTML = '<div class="pf-sub pf-sub-warn"><b>Could not load subscription details.</b>' +
        '<p class="pf-tech">' + esc(String(e && e.message || e)) + "</p></div>";
    }
  }

  function renderRecent(host) {
    var labels = {};
    A.FEATURES.forEach(function (f) { labels[f.key] = f.label.replace(/s$/, ""); });
    var items = A.timeline().slice(0, 12);
    if (!items.length) {
      host.innerHTML = '<p class="pf-empty">Nothing recorded yet. Anything you complete \u2014 ' +
        "a quiz, a mock survey, an SOP \u2014 appears here.</p>";
      return;
    }
    host.innerHTML = '<ol class="pf-timeline">' + items.map(function (e) {
      var extra = e.meta && (e.meta.title || e.meta.department || e.meta.name) || "";
      return "<li><b>" + esc(labels[e.type] || e.type) + "</b>" +
        (extra ? '<span class="pf-tl-x">' + esc(extra) + "</span>" : "") +
        '<time>' + esc(relative(e.at)) + "</time></li>";
    }).join("") + "</ol>";
  }

  async function init() {
    var user = null;
    try { user = await S.currentUser(); } catch (e) { user = null; }

    var whoHost = document.getElementById("pfWho");
    if (!user) {
      // page-gate normally intercepts first; this is the belt-and-braces case.
      whoHost.innerHTML = "<h1>Your progress</h1><p class=\"pf-sub-lead\">Sign in to see your activity.</p>";
      document.getElementById("pfBody").innerHTML =
        '<p class="pf-empty">You are not signed in.</p>';
      return;
    }

    A.setUser(user);
    var email = user.email || "";

    /* Wait for the server history before painting any count.
     *
     * setUser() kicks off a sync but does not block, which is right for a feature page
     * that only needs to record. Here it is the opposite: this page exists to state the
     * user's totals, and a number that jumps upward a second after it appears — because
     * the cache was drawn first and the real history arrived later — reads as a bug.
     * On a new device the cache is empty, so without this the page would briefly claim
     * the person had done nothing.
     *
     * Returns false when offline or in local mode, in which case the cache is all there
     * is and the page says so in the footer note. */
    var synced = await A.sync();

    whoHost.innerHTML = '<div class="pf-id"><div class="pf-avatar">' +
      esc((user.name || email || "?").trim().charAt(0).toUpperCase()) + "</div><div>" +
      "<h1>" + esc(user.name || email) + "</h1>" +
      '<p class="pf-email">' + esc(email) + (user.role ? " \u00B7 " + esc(user.role) : "") + "</p>" +
      "</div></div>";

    var tl = A.timeline();
    var days = streak(tl);
    document.getElementById("pfStreak").innerHTML =
      '<div class="pf-chip"><b>' + tl.length + "</b><span>actions recorded</span></div>" +
      '<div class="pf-chip"><b>' + days + "</b><span>day streak</span></div>" +
      /* Says plainly whether what is on screen is the permanent record or a local copy
         that has not reached the server. A subscriber relying on this for their own
         audit trail needs to know which they are looking at. */
      (synced
        ? '<div class="pf-chip pf-chip-ok"><b>\u2713</b><span>Saved to your account</span></div>'
        : '<div class="pf-chip pf-chip-warn"><b>!</b><span>Offline \u2014 showing this device only</span></div>');

    /* Before the stats render, so a card is never drawn with the local figure and then
       silently swapped for the server one — a number that changes under the reader is
       worse than a moment's wait. The subscription panel renders after and independently,
       so a slow table read cannot hold up the plan dates. */
    SERVER = await serverCounts();

    renderStats(document.getElementById("pfStats"), email);
    renderNext(document.getElementById("pfNext"), email);
    renderRecent(document.getElementById("pfRecent"));
    await renderSubscription(document.getElementById("pfSub"), user);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
