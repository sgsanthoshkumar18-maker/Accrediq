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
 * THE WINDOW IS WHOLE MONTHS, IN INDIAN STANDARD TIME.
 * "At most N months left" is still the rule, but the edge is the END of the target month,
 * not the same day-of-month N months out. In September, with a three-month policy, every
 * batch stamped December is short — the 1st and the 31st alike. That is how a crash cart is
 * actually checked: against the month printed on the pack, not against a rolling date. The
 * earlier day-anchored version flagged stock up to 2 December and left the rest of the month
 * standing, and it gave two people entering the same ampoule a week apart two answers.
 * Anything already past its last usable DAY is "expired" — that stays a date, because an
 * expired ampoule is expired on the day, not at the end of its month.
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

  /* TODAY IN INDIAN STANDARD TIME, NOT UTC.
     The whole rule now turns on which MONTH it is, and UTC is five and a half hours behind
     IST — so for the first five and a half hours of every Indian day the server would still
     be on yesterday, and on the 1st of a month it would still be in the PREVIOUS MONTH. That
     would quietly shift the entire window by a month for anyone opening the page early, and
     for the cron job, which runs at 02:00. IST has no daylight saving, so a fixed offset is
     exact rather than an approximation. */
  var IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  function todayIST() {
    return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
  }

  /* THE WINDOW IS WHOLE MONTHS, NOT A ROLLING DATE.
     This used to be "today plus N months to the day" — on 2 September it flagged everything
     up to 2 December and left 3–31 December alone. No pharmacy works that way. A crash cart
     is checked by the month printed on the pack: in September you pull anything stamped
     December, whatever the day. Anchoring on the day of entry also meant two people entering
     the same stock a week apart got two different answers about the same ampoule.

     So the edge is the LAST day of the target month, always. September + 3 gives
     2026-12-31, and every batch expiring anywhere in December is short. */
  function windowEnd(todayIso, months) {
    var m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(todayIso || ""));
    if (!m) return "";
    var y = +m[1], mo = +m[2];
    var targetMonth = mo + months;
    var targetYear = y + Math.floor((targetMonth - 1) / 12);
    targetMonth = ((targetMonth - 1) % 12) + 1;
    var lastOfTarget = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    return targetYear + "-" + pad(targetMonth) + "-" + pad(lastOfTarget);
  }

  /* The target month itself, for labelling: "everything expiring in December 2026 or before"
     is what the rule actually says, and it is what the screen and the email should print. */
  function windowMonth(todayIso, months) {
    return windowEnd(todayIso, months).slice(0, 7);
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
    var todayIso = o.today || todayIST();
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
    var todayIso = o.today || todayIST();
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
      windowMonth: windowMonth(todayIso, months),
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
    windowMonth: windowMonth,
    todayIST: todayIST,
    normaliseMonths: normaliseMonths,
    classify: classify,
    review: review,
    byCart: byCart,
    byMonth: byMonth,
    monthLabel: monthLabel
  };
});
