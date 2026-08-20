/* AQcredix — pin a workspace page as your landing page.
 *
 * A quality manager lives in the readiness dashboard; a biomedical engineer lives in the
 * register. Pinning takes them straight there on sign-in instead of making them navigate
 * the same three clicks every morning.
 *
 * STORED SERVER-SIDE in user_prefs, keyed on auth.uid() only. Two consequences that
 * matter: the pin follows the person to a ward tablet or a home laptop, and a colleague
 * cannot read or change it — it is a personal preference, not organisation data.
 *
 * localStorage is used as a cache so the redirect can happen before the network answers.
 * A sign-in that waits on a round-trip before deciding where to go feels broken.
 */
(function () {
  "use strict";

  var KEY = "aq-pinned-page";
  var S = window.AQStore;

  function here() {
    /* Path only. Storing a full URL would pin the deployment it was set on, so a pin made
       on a preview build would send the person to that preview forever. */
    var p = location.pathname.replace(/^.*\/workspace\//, "");
    return p || "workspace.html";
  }

  function cached() {
    try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; }
  }

  function cache(v) {
    try {
      if (v) localStorage.setItem(KEY, v);
      else localStorage.removeItem(KEY);
    } catch (e) {}
  }

  async function loadPref() {
    try {
      var rows = await S.adapter.list("user_prefs");
      var row = (rows || [])[0];
      var v = row && row.pinned_page ? row.pinned_page : "";
      /* The server is the record; the cache only exists to make the redirect instant.
         Writing the server value back keeps a second device in step after it signs in. */
      cache(v);
      return v;
    } catch (e) {
      return cached();
    }
  }

  async function savePref(page) {
    cache(page);
    try {
      var me = await S.currentUser();
      if (!me || !me.id) return false;
      await S.adapter.upsert("user_prefs", {
        user_id: me.id,
        pinned_page: page || null,
        updated_at: new Date().toISOString()
      });
      return true;
    } catch (e) {
      /* The cache already holds it, so the pin works on this device and will be written
         on the next successful save. Failing loudly here would make a preference feel
         like a broken feature. */
      return false;
    }
  }

  /* ------------------------------ the toggle ------------------------------ */

  function mount() {
    var host = document.getElementById("wsPin");
    if (!host) return;
    var page = here();

    function paint(pinned) {
      var on = pinned === page;
      host.innerHTML =
        '<button class="ws-pin' + (on ? " is-on" : "") + '" type="button" ' +
          'aria-pressed="' + on + '" title="' +
          (on ? "This is your landing page. Press to unpin."
              : "Open this page first when you sign in") + '">' +
          '<span aria-hidden="true">' + (on ? "\u2605" : "\u2606") + "</span>" +
          (on ? "Pinned" : "Pin this page") +
        "</button>";

      host.querySelector("button").addEventListener("click", async function () {
        var next = on ? "" : page;
        paint(next);                       // respond immediately; the write follows
        await savePref(next);
        if (window.AQWorkspace && window.AQWorkspace.toast) {
          window.AQWorkspace.toast(
            next ? "Pinned — this opens first when you sign in" : "Unpinned", "ok");
        }
      });
    }

    paint(cached());
    loadPref().then(paint);
  }

  /* ------------------------------ the redirect ------------------------------
     Runs on the workspace landing page only. Anywhere else, a redirect would fight the
     person's own navigation — clicking Audit and being thrown to the register would make
     the site feel possessed. */

  function maybeRedirect() {
    if (!/workspace\.html$/.test(location.pathname)) return;
    /* An explicit ?stay=1 always wins, and the "Workspace home" link carries it. Without
       an escape hatch a pinned page makes the landing page unreachable. */
    try {
      if (new URLSearchParams(location.search).get("stay")) return;
    } catch (e) { return; }

    var p = cached();
    if (!p || p === "workspace.html") return;
    /* Same-directory filenames only. A stored value is trusted as far as the workspace
       folder and no further, so a poisoned cache cannot send anyone off-site. */
    if (!/^[a-z0-9-]+\.html$/i.test(p)) { cache(""); return; }
    location.replace(p);
  }

  maybeRedirect();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  window.AQPin = { get: cached, set: savePref, load: loadPref };
})();
