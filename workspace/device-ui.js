/* AQcredix — the device-limit notice and the blocking screen.
 *
 * Two states worth distinguishing, because they call for very different tone:
 *   the SECOND device is normal and gets a quiet note;
 *   the THIRD is refused, and the message has to be actionable rather than accusatory —
 *   the most likely person hitting it is an honest customer who changed laptops.
 */
(function () {
  "use strict";

  var D = window.AQDevice, W = window.AQWorkspace;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function when(iso) {
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    return days + " days ago";
  }

  function blockScreen(res) {
    var host = document.getElementById("wsBody") || document.body;
    var gate = document.getElementById("wsGate");
    if (gate) gate.style.display = "none";
    host.style.display = "";
    host.innerHTML =
      '<section class="section wrap"><div class="dev-block">' +
        "<h1>This account is already in use on two devices</h1>" +
        "<p>An AQcredix subscription covers one person on up to " + res.limit +
          " devices — typically a computer and a phone. Signing in here would make a " +
          "third, so it has been held.</p>" +
        "<p><b>If one of these is an old device you no longer use</b>, sign it out below " +
          "and this one will work straight away.</p>" +
        '<div class="dev-list">' + res.active.map(function (d) {
          return '<div class="dev-row"><div><b>' + esc(d.label || "Device") + "</b>" +
            "<span>" + esc(d.kind === "mobile" ? "Phone or tablet" : "Computer") +
            " · last used " + esc(when(d.last_seen)) + "</span></div>" +
            '<button class="btn btn-ghost btn-sm" data-revoke="' + esc(d.id) + '">Sign out</button>' +
          "</div>";
        }).join("") + "</div>" +
        '<p class="dev-note">If your hospital needs more people to have access, each person ' +
          "should have their own account rather than sharing one — that is also what " +
          "makes the record of who did what stand up to an assessor. Add colleagues from " +
          '<a href="team.html">Team</a>.</p>' +
      "</div></section>";

    host.querySelectorAll("[data-revoke]").forEach(function (b) {
      b.addEventListener("click", async function () {
        b.disabled = true; b.textContent = "Signing out…";
        await D.revoke(b.dataset.revoke);
        location.reload();
      });
    });
  }

  function warnOnce(res) {
    /* Shown once per device, not on every page load. A warning repeated after it has been
       read stops being a warning and becomes noise the customer learns to dismiss. */
    var key = "aq-device-warned";
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) {}

    if (W && W.toast) {
      W.toast("This is the second device on your account. A third will be refused — " +
              "each person needs their own login.", "warn");
    }
  }

  async function run() {
    if (!D || !window.AQStore) return;
    var res = await D.check();
    if (res.blocked) blockScreen(res);
    else if (res.warn) warnOnce(res);
  }

  document.addEventListener("aq:ready", run);
  if (window.AQWorkspace && window.AQWorkspace.user) run();
})();
