/* AQcredix — the free trial.
 *
 * SEVEN DAYS, AND WHY NOT TWELVE HOURS.
 *
 * A twelve-hour trial ending in an automatic debit cannot legally be built in India. The
 * RBI's Digital Payments E-mandate Framework, 2026 requires the issuer to send a
 * pre-transaction notification to the customer at least 24 hours before any charge, with an
 * option to opt out of that debit. A trial shorter than 24 hours would mean warning the
 * customer before the trial had even started, which is incoherent.
 *
 * Seven days is also the shortest period in which a hospital can genuinely judge this
 * product. A quality manager has to enter their committees, watch the calendar compute the
 * dates, and walk one round before any of it means anything. A trial too short to evaluate
 * does not increase conversions — it produces cancellations, refund arguments and
 * chargebacks, each of which costs more than the trial ever saved.
 *
 * The trial is honest by construction: the mandate is registered up front so the customer
 * knows a payment will follow, the end date is shown from the first screen, and the RBI
 * notice arrives a day before anything is taken. Nobody should ever be surprised by a
 * debit from this platform.
 */
window.AQTrial = (function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace;

  /* Read from billing-config.js so the length is one edit in one place, and the terms
     page and the banner cannot drift apart from what the code actually does. */
  var DAYS = (window.AQ_BILLING && window.AQ_BILLING.trialDays) || 7;
  /* The pre-debit notice must go at least 24 hours ahead. Sending at 48 leaves room for a
     failed send, a weekend, or someone not opening email until the next morning — the
     legal minimum is a floor, not a target. */
  var NOTICE_HOURS = 48;

  function addDays(date, n) {
    var d = new Date(date.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  async function current() {
    try {
      var rows = await S.adapter.list("trials");
      return (rows && rows[0]) || null;
    } catch (e) { return null; }
  }

  function status(t, nowIso) {
    if (!t) return { state: "none" };
    var now = new Date(nowIso || Date.now()).getTime();
    var ends = new Date(t.ends_at).getTime();
    if (t.cancelled_at) return { state: "cancelled" };
    if (t.converted_at) return { state: "converted" };
    if (now >= ends) return { state: "ended", endsAt: t.ends_at };

    var msLeft = ends - now;
    var hoursLeft = Math.ceil(msLeft / 3600000);
    var daysLeft = Math.ceil(msLeft / 86400000);
    return {
      state: "active",
      endsAt: t.ends_at,
      hoursLeft: hoursLeft,
      daysLeft: daysLeft,
      /* Whether the RBI pre-debit notice is now due. Computed here rather than only in the
         cron so the UI and the mailer cannot disagree about when the customer was told. */
      noticeDue: hoursLeft <= NOTICE_HOURS && !t.notified_at
    };
  }

  async function start() {
    var now = new Date();
    var ends = addDays(now, DAYS);
    var row = {
      org_id: (W && W.user && W.user.org_id) || null,
      started_at: now.toISOString(),
      ends_at: ends.toISOString(),
      updated_at: now.toISOString()
    };
    await S.adapter.upsert("trials", row);
    return row;
  }

  async function cancel() {
    var t = await current();
    if (!t) return null;
    t.cancelled_at = new Date().toISOString();
    t.updated_at = t.cancelled_at;
    await S.adapter.upsert("trials", t);
    return t;
  }

  /* Wording used in the banner and in the pre-debit email, kept in one place so the two
     always say the same thing. */
  function noticeText(st, amountLabel) {
    if (st.state !== "active") return "";
    if (st.hoursLeft <= NOTICE_HOURS) {
      return "Your free trial ends on " + fmt(st.endsAt) + ", and " + amountLabel +
        " will be charged then. Cancel before that and nothing is taken.";
    }
    return "Free trial · " + st.daysLeft + " day" + (st.daysLeft === 1 ? "" : "s") +
      " left. It ends on " + fmt(st.endsAt) + ", and we will remind you before anything " +
      "is charged.";
  }

  function fmt(iso) {
    try {
      return new Date(iso).toLocaleDateString("en-IN",
        { day: "numeric", month: "long", year: "numeric" });
    } catch (e) { return String(iso).slice(0, 10); }
  }

  return { DAYS: DAYS, NOTICE_HOURS: NOTICE_HOURS, current: current, status: status,
           start: start, cancel: cancel, noticeText: noticeText, fmt: fmt, addDays: addDays };
})();
