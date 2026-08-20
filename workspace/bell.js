/* AQcredix — the notification bell.
 *
 * Everything else in the workspace waits for someone to open it. This is the one piece
 * that tells them, and it is the difference between owning a calendar and using one.
 *
 * The bell works with no external service: it computes the digest client-side from the
 * same engine the dashboard uses. The weekly email (api/digest.js) is the same digest
 * pushed rather than pulled, and needs a mail provider — but the product is useful before
 * that is configured, which is deliberate. A feature that is inert until an API key is
 * added is a feature nobody sees.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, K = window.AQSchedule, D = window.AQDigest;
  if (!S || !K || !D) return;

  var prefs = { email_digest: true, digest_dow: 1, department: null, overdue_only: false };
  var digest = null;

  async function load() {
    var names = ["compliance_tasks", "committees", "committee_meetings",
                 "assets", "asset_schedules", "asset_events",
                 "checklists", "rounds", "capa"];
    var keys = ["tasks", "committees", "meetings", "assets", "schedules", "events",
                "lists", "rounds", "capa"];
    /* One missing table must not silence the bell. Being told about four overdue items
       when there are five is far better than being told nothing. */
    var got = await Promise.all(names.map(function (n) {
      return S.adapter.list(n).catch(function () { return []; });
    }));
    var data = {};
    keys.forEach(function (k, i) { data[k] = got[i] || []; });

    try {
      var rows = await S.adapter.list("notify_prefs");
      if (rows && rows[0]) prefs = Object.assign(prefs, rows[0]);
    } catch (e) {}

    digest = D.build(K, data, {
      department: prefs.department || "",
      overdueOnly: !!prefs.overdue_only
    });
  }

  /* Seen state is local. A notification is not a record — marking one read is a personal
     act, and round-tripping it to the server on every glance would cost a request per
     bell press for no benefit an assessor would ever ask about. */
  function seenKey() { return "aq-ntf-seen"; }
  function lastSeen() {
    try { return localStorage.getItem(seenKey()) || ""; } catch (e) { return ""; }
  }
  function markSeen(sig) {
    try { localStorage.setItem(seenKey(), sig); } catch (e) {}
  }

  /* A signature of what is currently outstanding. The dot returns when the SITUATION
     changes, not on a timer — so dismissing it means "I have seen this", and a new
     overdue item next week brings it back on its own. */
  function signature() {
    if (!digest) return "";
    return [digest.counts.overdue, digest.counts.never,
            digest.counts.soon, digest.counts.findings].join("-");
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function base() {
    return document.body.getAttribute("data-base") || "";
  }

  function render() {
    var host = document.getElementById("wsBell");
    if (!host || !digest) return;

    var n = digest.counts.overdue + digest.counts.never;
    var unseen = signature() !== lastSeen() && n > 0;

    host.innerHTML =
      '<button class="ws-bell' + (unseen ? " is-new" : "") + '" id="bellBtn" type="button" ' +
        'aria-label="Notifications" aria-expanded="false">' +
        '<span aria-hidden="true">\u2691</span>' +
        (n ? '<i class="ws-bell-n">' + n + "</i>" : "") +
      "</button>" +
      '<div class="ws-bell-panel" id="bellPanel" hidden>' +
        '<div class="ws-bell-head"><b>' + esc(D.summarise(digest)) + "</b>" +
          '<button class="ws-bell-x" data-n="close" type="button" aria-label="Close">\u2715</button></div>' +
        body() +
        '<div class="ws-bell-foot">' +
          '<label class="ws-bell-opt"><input type="checkbox" id="bellEmail"' +
            (prefs.email_digest ? " checked" : "") + "><span>Email me a weekly summary</span></label>" +
          '<label class="ws-bell-opt"><input type="checkbox" id="bellOverdue"' +
            (prefs.overdue_only ? " checked" : "") + "><span>Overdue only</span></label>" +
          '<a class="btn btn-ghost btn-sm" href="' + base() + 'workspace/dashboard.html">Open my department</a>' +
        "</div>" +
      "</div>";

    document.getElementById("bellBtn").addEventListener("click", toggle);
    host.addEventListener("click", function (e) {
      if (e.target.closest('[data-n="close"]')) hide();
    });
    var em = document.getElementById("bellEmail");
    if (em) em.addEventListener("change", function () { savePrefs({ email_digest: this.checked }); });
    var ov = document.getElementById("bellOverdue");
    if (ov) ov.addEventListener("change", async function () {
      await savePrefs({ overdue_only: this.checked });
      await load(); render(); show();
    });
  }

  function body() {
    if (digest.empty) {
      return '<div class="ws-bell-empty">Nothing overdue' +
        (digest.department ? " in " + esc(digest.department) : "") +
        ". Everything on the calendar is on track.</div>";
    }
    var groups = [];
    if (digest.overdue.length) groups.push(["Overdue", digest.overdue, "bad"]);
    if (digest.never.length) groups.push(["Never recorded", digest.never, "warn"]);
    if (!prefs.overdue_only && digest.soon.length) groups.push(["Due soon", digest.soon, "warn"]);

    var html = groups.map(function (g) {
      return '<div class="ws-bell-grp"><span>' + g[0] + "</span>" +
        g[1].slice(0, 5).map(function (i) {
          return '<a class="ws-bell-row is-' + g[2] + '" href="' + base() + esc(i.href) + '">' +
            "<b>" + esc(i.name) + "</b>" +
            "<span>" + esc(i.kind) + " · " + esc(i.text) + "</span></a>";
        }).join("") +
        (g[1].length > 5 ? '<div class="ws-bell-more">and ' + (g[1].length - 5) + " more</div>" : "") +
        "</div>";
    }).join("");

    if (digest.findings.length) {
      html += '<div class="ws-bell-grp"><span>Open findings</span>' +
        digest.findings.slice(0, 3).map(function (c) {
          return '<a class="ws-bell-row is-bad" href="' + base() + 'workspace/capa.html">' +
            "<b>" + esc(c.title) + "</b><span>" + esc(c.status || "open") + "</span></a>";
        }).join("") + "</div>";
    }
    return '<div class="ws-bell-body">' + html + "</div>";
  }

  function toggle() {
    var p = document.getElementById("bellPanel");
    p.hidden ? show() : hide();
  }
  function show() {
    var p = document.getElementById("bellPanel");
    if (!p) return;
    p.hidden = false;
    document.getElementById("bellBtn").setAttribute("aria-expanded", "true");
    markSeen(signature());
    document.querySelector(".ws-bell").classList.remove("is-new");
  }
  function hide() {
    var p = document.getElementById("bellPanel");
    if (!p) return;
    p.hidden = true;
    var b = document.getElementById("bellBtn");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  async function savePrefs(patch) {
    prefs = Object.assign(prefs, patch);
    try {
      var me = await S.currentUser();
      if (!me || !me.id) return;
      await S.adapter.upsert("notify_prefs", {
        user_id: me.id,
        email_digest: !!prefs.email_digest,
        digest_dow: prefs.digest_dow == null ? 1 : prefs.digest_dow,
        department: prefs.department || null,
        overdue_only: !!prefs.overdue_only,
        updated_at: new Date().toISOString()
      });
      if (W && W.toast) W.toast("Saved", "ok");
    } catch (e) {}
  }

  document.addEventListener("click", function (e) {
    var host = document.getElementById("wsBell");
    if (host && !host.contains(e.target)) hide();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });

  async function init() {
    if (!document.getElementById("wsBell")) return;
    await load();
    render();
  }

  /* Waits for the workspace gate rather than DOMContentLoaded: before sign-in there is no
     org to read, and firing early would produce an empty bell that never refills. */
  document.addEventListener("aq:ready", init);
  /* Already past the gate when this script parsed — the event has fired and will not fire
     again, so the listener alone would leave the bell permanently empty. */
  if (window.AQWorkspace && window.AQWorkspace.user) init();
})();
