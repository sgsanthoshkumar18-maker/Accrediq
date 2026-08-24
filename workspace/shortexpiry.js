/* AQcredix — the short-expiry rule for crash cart medicines.
 *
 * ONE IMPLEMENTATION, USED BY BOTH THE SCREEN AND THE EMAIL.
 * The page a pharmacist looks at and the alert that lands in their inbox must agree about
 * what "short expiry" means, always. Two implementations of the same rule stay in step
 * right up until one of them is edited, and then a hospital is told on Monday that four
 * ampoules are short and shown three on Tuesday, and stops believing either. So this file
 * is loaded by workspace/crashcart.js in the browser AND required by api/crash-cart-alert.js
 * on the server — the same module, not a copy of it.
 *
 * THE WINDOW IS "AT MOST N MONTHS LEFT", NOT "EXPIRING IN THE NTH MONTH".
 * Asked for as "in August, alert me about November — three months out". Read literally
 * that alerts on the November cohort and says nothing about an ampoule expiring in
 * September, which is nearer and worse. Short expiry in a pharmacy means shelf life at or
 * below the threshold, so that is what this computes; the report is then grouped BY MONTH,
 * so the three-months-out cohort still appears as its own heading. Nothing is hidden and
 * nothing nearer is missed.
 *
 * EXPIRY IS END-OF-MONTH UNLESS A DAY IS GIVEN.
 * A pack printed "11/2026" is usable to the last day of November, not the first. Treating
 * it as the 1st would condemn a month of stock; treating a dated item loosely would keep
 * an expired one. Both forms are accepted and each is read the way a pharmacist reads it.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AQShortExpiry = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ALLOWED_MONTHS = [3, 6];

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /* Accepts "2026-11-30", "2026-11" and a Date. Returns the last usable day as an ISO
     string, or "" if it cannot be read — never a guess, because a guessed expiry is worse
     than a missing one. */
  function lastUsableDay(value) {
    if (value instanceof Date && !isNaN(value)) {
      return value.getUTCFullYear() + "-" + pad(value.getUTCMonth() + 1) + "-" +
             pad(value.getUTCDate());
    }
    var s = String(value == null ? "" : value).trim();
    var full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (full) return s;
    var monthOnly = /^(\d{4})-(\d{2})$/.exec(s);
    if (monthOnly) {
      var y = +monthOnly[1], m = +monthOnly[2];
      if (m < 1 || m > 12) return "";
      var last = new Date(Date.UTC(y, m, 0)).getUTCDate();   // day 0 of next month
      return y + "-" + pad(m) + "-" + pad(last);
    }
    return "";
  }

  function daysBetween(fromIso, toIso) {
    var a = Date.parse(fromIso + "T00:00:00Z"), b = Date.parse(toIso + "T00:00:00Z");
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  /* The far edge of the window: today plus N calendar months, clamped to the end of the
     target month. Adding 90 days instead would put the boundary in a different place
     depending on which months you crossed, and a pharmacist checking the maths by hand
     would get a different answer from the software. */
  function windowEnd(todayIso, months) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(todayIso || ""));
    if (!m) return "";
    var y = +m[1], mo = +m[2], d = +m[3];
    var targetMonth = mo + months;
    var targetYear = y + Math.floor((targetMonth - 1) / 12);
    targetMonth = ((targetMonth - 1) % 12) + 1;
    var lastOfTarget = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    return targetYear + "-" + pad(targetMonth) + "-" + pad(Math.min(d, lastOfTarget));
  }

  function normaliseMonths(v) {
    var n = Number(v);
    return ALLOWED_MONTHS.indexOf(n) > -1 ? n : 3;
  }

  /* expired | short | ok — and "expired" is deliberately its own state rather than the
     worst kind of short. An expired ampoule in a crash cart is not an ordering problem,
     it is a patient-safety incident, and it must never be mixed into a list headed
     "expiring soon" where it reads as something to get round to. */
  function classify(item, opts) {
    var o = opts || {};
    var todayIso = o.today || new Date().toISOString().slice(0, 10);
    var months = normaliseMonths(o.months);
    var expiry = lastUsableDay(item && (item.expires_on || item.expiry));
    if (!expiry) return { state: "unknown", expiry: "", daysLeft: null };

    var daysLeft = daysBetween(todayIso, expiry);
    if (daysLeft === null) return { state: "unknown", expiry: expiry, daysLeft: null };
    if (daysLeft < 0) return { state: "expired", expiry: expiry, daysLeft: daysLeft };

    var edge = windowEnd(todayIso, months);
    var state = (edge && expiry <= edge) ? "short" : "ok";
    return { state: state, expiry: expiry, daysLeft: daysLeft };
  }

  /* Everything that needs acting on, newest deadline first, with the cart it sits in
     carried along — the pharmacist walks to a trolley, not to a spreadsheet row. */
  function review(carts, items, opts) {
    var o = opts || {};
    var todayIso = o.today || new Date().toISOString().slice(0, 10);
    var months = normaliseMonths(o.months);
    var byId = {};
    (carts || []).forEach(function (c) { byId[c.id] = c; });

    var flagged = [];
    (items || []).forEach(function (it) {
      var c = classify(it, { today: todayIso, months: months });
      if (c.state !== "expired" && c.state !== "short") return;
      var cart = byId[it.cart_id];
      flagged.push({
        id: it.id, cart_id: it.cart_id,
        cart: (cart && cart.name) || "Unassigned",
        department: (cart && cart.department) || "",
        name: it.name, strength: it.strength || "", batch: it.batch || "",
        quantity: Number(it.quantity) || 0,
        expiry: c.expiry, month: c.expiry.slice(0, 7),
        state: c.state, daysLeft: c.daysLeft
      });
    });

    flagged.sort(function (a, b) {
      if (a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1;
      if (a.cart !== b.cart) return a.cart < b.cart ? -1 : 1;
      return String(a.name) < String(b.name) ? -1 : 1;
    });

    return {
      today: todayIso, months: months, windowEnds: windowEnd(todayIso, months),
      expired: flagged.filter(function (f) { return f.state === "expired"; }),
      short: flagged.filter(function (f) { return f.state === "short"; }),
      all: flagged,
      itemCount: (items || []).length,
      cartCount: (carts || []).length,
      empty: flagged.length === 0
    };
  }

  /* Grouped for the email: cart first, because the person reading it is going to walk to
     one trolley at a time and wants one list per trolley rather than a date-ordered list
     that sends them round the hospital twice. */
  function byCart(flagged) {
    var out = [], seen = {};
    (flagged || []).forEach(function (f) {
      if (!seen[f.cart_id]) {
        seen[f.cart_id] = { cart: f.cart, department: f.department, items: [] };
        out.push(seen[f.cart_id]);
      }
      seen[f.cart_id].items.push(f);
    });
    out.sort(function (a, b) { return a.cart < b.cart ? -1 : a.cart > b.cart ? 1 : 0; });
    return out;
  }

  function byMonth(flagged) {
    var out = [], seen = {};
    (flagged || []).forEach(function (f) {
      if (!seen[f.month]) { seen[f.month] = { month: f.month, items: [] }; out.push(seen[f.month]); }
      seen[f.month].items.push(f);
    });
    out.sort(function (a, b) { return a.month < b.month ? -1 : 1; });
    return out;
  }

  function monthLabel(ym) {
    var names = ["January", "February", "March", "April", "May", "June", "July",
                 "August", "September", "October", "November", "December"];
    var m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
    if (!m) return String(ym || "");
    return names[+m[2] - 1] + " " + m[1];
  }

  return {
    ALLOWED_MONTHS: ALLOWED_MONTHS,
    lastUsableDay: lastUsableDay,
    windowEnd: windowEnd,
    normaliseMonths: normaliseMonths,
    classify: classify,
    review: review,
    byCart: byCart,
    byMonth: byMonth,
    monthLabel: monthLabel
  };
});
