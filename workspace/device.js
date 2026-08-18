/* AQcredix — device sessions, to stop one subscription being shared across a department.
 *
 * WHY NOT IP ADDRESSES.
 * IP locking was asked for and is the wrong mechanism. An Indian mobile carrier puts
 * thousands of subscribers behind one CGNAT address and rotates a handset's address
 * several times an hour; hospital Wi-Fi hands out a new lease most mornings. Locking to an
 * IP would throw out a nurse who walked from the ward to the car park, while two people on
 * the same hospital Wi-Fi would look like a single user. It fails in both directions at
 * once — false lockouts for honest customers, no barrier at all to the sharing it was
 * meant to stop. Nor can "PC" be told from "phone" by IP: that comes from the user-agent
 * string, which anyone can change in four seconds.
 *
 * A device is stable, survives a network change, and is what a customer understands.
 * The limit is TWO ACTIVE DEVICES per person — one desktop and one phone is the normal
 * working pattern for a quality manager, so it does not obstruct real use.
 *
 * WHAT THIS IS AND IS NOT.
 * This is a licence control, not a security boundary. Someone determined can clear their
 * storage and get a new device id. The point is to make casual sharing — passing one login
 * around a department — visible and inconvenient, not to make it impossible. Row-level
 * security is what actually protects data; this protects revenue, and it is honest to hold
 * those apart rather than dress one up as the other.
 */
window.AQDevice = (function () {
  "use strict";

  var S = window.AQStore;
  var KEY = "aq-device-id";
  var LIMIT = 2;

  /* A random id generated once and kept locally. Not a fingerprint: fingerprinting is
     covert, brittle across browser updates, and collects more about a person than a
     licence check needs. A stored random value tells us the same thing and can be seen
     and cleared by the person it describes. */
  function deviceId() {
    try {
      var v = localStorage.getItem(KEY);
      if (v) return v;
      v = "dev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, v);
      return v;
    } catch (e) {
      /* Private browsing with storage blocked. Returning a per-load id means the check
         cannot work, so it is treated as unlimited rather than locking someone out of a
         product they have paid for. */
      return null;
    }
  }

  function kind() {
    try {
      return matchMedia("(hover: hover) and (pointer: fine)").matches ? "desktop" : "mobile";
    } catch (e) { return "desktop"; }
  }

  /* A readable label so the revoke list means something. Deliberately coarse — "Windows ·
     Chrome" is enough to recognise your own laptop, and anything finer is tracking. */
  function label() {
    var ua = navigator.userAgent || "";
    var os = /Windows/.test(ua) ? "Windows"
      : /Android/.test(ua) ? "Android"
      : /iPhone|iPad|iPod/.test(ua) ? "iOS"
      : /Mac OS X/.test(ua) ? "macOS"
      : /Linux/.test(ua) ? "Linux" : "Unknown";
    var br = /Edg\//.test(ua) ? "Edge"
      : /OPR\//.test(ua) ? "Opera"
      : /Chrome\//.test(ua) ? "Chrome"
      : /Firefox\//.test(ua) ? "Firefox"
      : /Safari\//.test(ua) ? "Safari" : "Browser";
    return os + " \u00b7 " + br;
  }

  /* Devices not seen for 30 days stop counting. Without this, a laptop replaced two years
     ago would hold a slot forever and the customer would have to contact support to use
     the product they are paying for. */
  var STALE_DAYS = 30;

  function isActive(d) {
    if (d.revoked) return false;
    var age = (Date.now() - new Date(d.last_seen || d.first_seen).getTime()) / 86400000;
    return age <= STALE_DAYS;
  }

  async function check() {
    var id = deviceId();
    if (!id || !S || !S.adapter) return { ok: true, reason: "unavailable" };

    var rows;
    try {
      rows = (await S.adapter.list("device_sessions")) || [];
    } catch (e) {
      /* A failed lookup must not lock a paying customer out of their own account. Failing
         open is the right call for a licence control; it would be the wrong call for a
         security boundary, which is part of why this must not be mistaken for one. */
      return { ok: true, reason: "unreachable" };
    }

    var active = rows.filter(isActive);
    var mine = active.filter(function (d) { return d.id === id; })[0];

    if (mine) {
      /* Known device. Touch last_seen so it stays active, but not on every page load —
         once a day is enough to keep it alive and avoids a write per navigation. */
      var since = (Date.now() - new Date(mine.last_seen).getTime()) / 3600000;
      if (since > 12) {
        mine.last_seen = new Date().toISOString();
        try { await S.adapter.upsert("device_sessions", mine); } catch (e) {}
      }
      return { ok: true, device: mine, active: active };
    }

    if (active.length >= LIMIT) {
      return { ok: false, blocked: true, active: active, limit: LIMIT };
    }

    var rec = {
      id: id,
      label: label(),
      kind: kind(),
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      revoked: false
    };
    try { await S.adapter.upsert("device_sessions", rec); } catch (e) {}

    /* Second device is normal — a desktop and a phone is how one person works. Warned,
       not blocked, and told plainly what happens at the third. */
    return { ok: true, device: rec, active: active.concat([rec]),
             warn: active.length + 1 >= LIMIT };
  }

  async function revoke(id) {
    var rows = (await S.adapter.list("device_sessions")) || [];
    var d = rows.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    d.revoked = true;
    await S.adapter.upsert("device_sessions", d);
  }

  async function list() {
    var rows = (await S.adapter.list("device_sessions").catch(function () { return []; })) || [];
    return rows.filter(isActive);
  }

  return { check: check, revoke: revoke, list: list, deviceId: deviceId,
           label: label, kind: kind, isActive: isActive, LIMIT: LIMIT,
           STALE_DAYS: STALE_DAYS };
})();
