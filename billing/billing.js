/* AQcredix — subscriptions and access control.
 *
 * Gates the workspace behind a paid plan. Sits between the auth gate (are you signed in?)
 * and the feature (are you entitled to this?).
 *
 * Two payment paths, because they solve different problems:
 *
 *   1. UPI + manual verification. The payer scans the QR, pays, and submits the UPI
 *      transaction reference. The owner approves it from the Access panel. This works
 *      today with no gateway account and no fees.
 *
 *      It is important to understand WHY the approval step exists rather than trusting
 *      the claim: a static UPI QR sends no callback to this site. Nothing here can see
 *      that a payment happened. Any design that unlocks access the moment someone types a
 *      reference number is unlocking access for anyone who types anything.
 *
 *   2. Razorpay. Real verification — the gateway signs the payment and the signature is
 *      checked server-side before access is granted. This is the path to run a business
 *      on. Wired and dormant until keys are configured.
 */
window.AQBilling = (function () {
  "use strict";

  var S = window.AQStore;
  var CFG = window.AQ_BILLING || {};

  /* Plans. Amounts in the smallest currency unit (paise) so nothing ever depends on
   * floating-point arithmetic touching money. */
  var PLANS = [
    {
      key: "monthly",
      label: "Monthly",
      months: 1,
      /* Falls back to the real price, not to ₹1. A missing config should never
         quietly sell a year's access for a rupee — if the fallback is ever reached
         something is wrong, and charging correctly is the safer failure. */
      inr: CFG.monthlyInr != null ? CFG.monthlyInr : 50000,
      note: "Billed each month. Cancel any time."
    },
    {
      key: "yearly",
      label: "Annual",
      months: 12,
      inr: CFG.yearlyInr != null ? CFG.yearlyInr : 500000,
      note: "Two months free against the monthly rate."
    }
  ];

  /* The owner never pays. Matched on email so it survives a database reset — an ID would
   * not. Configured in billing-config.js, not hardcoded here. */
  /* Gmail ignores dots in the local part and everything after a "+", so
     s.g.name@gmail.com, sgname@gmail.com and sgname+test@gmail.com are one mailbox.
     Comparing the raw strings would have let the owner sign in with a spelling of their
     own address that the site then treated as a stranger — which is exactly the failure
     that locked the approval queue behind a paywall. Normalise before comparing.

     The normalisation is applied only to Gmail and Googlemail: for most other providers
     dots are significant, and stripping them there would wrongly match a different
     person's account. */
  function normalizeEmail(raw) {
    var email = String(raw || "").toLowerCase().trim();
    var at = email.lastIndexOf("@");
    if (at < 1) return email;
    var local = email.slice(0, at), domain = email.slice(at + 1);
    if (domain === "gmail.com" || domain === "googlemail.com") {
      local = local.split("+")[0].replace(/\./g, "");
      domain = "gmail.com";
    }
    return local + "@" + domain;
  }

  /* Lifetime free access, granted by address in billing-config.js. Deliberately separate
     from isOwner(): free access and ownership are different things, and conflating them
     would hand a pilot hospital the Access panel. */
  function isComplimentary(user) {
    var list = (CFG.complimentaryEmails || []).map(normalizeEmail);
    var email = normalizeEmail(user && user.email);
    return !!email && list.indexOf(email) >= 0;
  }

  function isOwner(user) {
    if (!user) return false;
    var owners = (CFG.ownerEmails || []).map(normalizeEmail);
    var email = normalizeEmail(user.email);
    return !!email && owners.indexOf(email) >= 0;
  }

  function planOf(key) {
    for (var i = 0; i < PLANS.length; i++) if (PLANS[i].key === key) return PLANS[i];
    return null;
  }

  function rupees(paise) {
    var r = paise / 100;
    return "₹" + (r % 1 === 0 ? r.toFixed(0) : r.toFixed(2));
  }

  function addMonths(d, n) {
    var x = new Date(d.getTime());
    x.setMonth(x.getMonth() + n);
    return x;
  }

  /* ---------------------------- entitlement ---------------------------- */

  /* The single question the rest of the app asks. Returns:
   *   { active, reason, plan, expiresAt, daysLeft, owner, pending }
   *
   * Fails CLOSED. If the subscription table cannot be read, access is denied rather than
   * granted — an availability problem must not become a free-access problem. The message
   * distinguishes the two so a genuine outage is not mistaken for an expired plan. */
  async function status(user) {
    if (isOwner(user)) {
      return { active: true, owner: true, reason: "owner", plan: null, daysLeft: null };
    }
    if (!user || !user.id) {
      return { active: false, reason: "signed_out" };
    }
    /* Complimentary accounts: everything a subscriber gets, for life, with no payment
       page ever shown. Checked before the table read, so their access does not depend on
       the subscriptions table being reachable — and note owner:false, because these are
       guests of the platform, not operators of it. The Access panel, the palette control
       and approving other people's payments stay with the owner alone. */
    if (isComplimentary(user)) {
      return {
        active: true, owner: false, reason: "complimentary",
        plan: "complimentary", daysLeft: null, expiresAt: null
      };
    }

    var rows;
    try {
      rows = await S.adapter.list("subscriptions");
    } catch (e) {
      return { active: false, reason: "unavailable", error: String(e && e.message || e) };
    }

    var mine = (rows || []).filter(function (r) {
      return r.user_id === user.id || (user.email && r.email &&
        String(r.email).toLowerCase() === String(user.email).toLowerCase());
    });

    var now = Date.now();
    var live = mine.filter(function (r) {
      return r.status === "active" && r.expires_at && new Date(r.expires_at).getTime() > now;
    }).sort(function (a, b) { return new Date(b.expires_at) - new Date(a.expires_at); })[0];

    if (live) {
      var days = Math.ceil((new Date(live.expires_at) - now) / 86400000);
      return {
        active: true, reason: "subscribed", plan: live.plan,
        expiresAt: live.expires_at, daysLeft: days, record: live
      };
    }

    var pending = mine.filter(function (r) { return r.status === "pending"; })[0];
    if (pending) return { active: false, reason: "pending", record: pending };

    var expired = mine.filter(function (r) { return r.status === "active"; })[0];
    if (expired) return { active: false, reason: "expired", record: expired };

    return { active: false, reason: "none" };
  }

  /* ------------------------------ records ------------------------------ */

  function newId() {
    return "sub_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* A claimed UPI payment. Deliberately created as "pending": this record is the user's
   * assertion that they paid, not evidence of it. Only owner approval turns it active. */
  function claimUpi(user, planKey, txnRef, note) {
    var p = planOf(planKey);
    return {
      id: newId(),
      user_id: user.id,
      email: user.email || "",
      name: user.name || "",
      plan: planKey,
      months: p ? p.months : 1,
      amount_paise: p ? p.inr : 0,
      method: "upi_manual",
      txn_ref: String(txnRef || "").trim(),
      note: String(note || "").trim(),
      status: "pending",
      requested_at: new Date().toISOString(),
      activated_at: null,
      expires_at: null,
      approved_by: null
    };
  }

  async function submitClaim(user, planKey, txnRef, note) {
    var rec = claimUpi(user, planKey, txnRef, note);
    await S.adapter.put("subscriptions", rec);
    return rec;
  }

  /* Owner action. Sets the window from the moment of approval, not from the claim, so a
   * claim sitting unapproved for a week does not silently eat the subscriber's time. */
  async function approve(rec, approver) {
    var p = planOf(rec.plan) || PLANS[0];
    var now = new Date();
    rec.status = "active";
    rec.activated_at = now.toISOString();
    rec.expires_at = addMonths(now, p.months).toISOString();
    rec.approved_by = (approver && (approver.email || approver.name)) || "owner";
    await S.adapter.put("subscriptions", rec);
    return rec;
  }

  async function reject(rec, approver, reason) {
    rec.status = "rejected";
    rec.approved_by = (approver && (approver.email || approver.name)) || "owner";
    rec.note = (rec.note ? rec.note + " | " : "") + "Rejected: " + (reason || "no reason given");
    await S.adapter.put("subscriptions", rec);
    return rec;
  }

  function list() {
    return S.adapter.list("subscriptions").then(function (rows) {
      return (rows || []).sort(function (a, b) {
        return String(b.requested_at).localeCompare(String(a.requested_at));
      });
    });
  }

  /* -------------------------------- UPI -------------------------------- */

  /* A UPI intent string. Any UPI app can render this as a QR, and on a phone it opens the
   * app directly with the amount pre-filled — which removes the commonest failure of a
   * printed QR, someone typing the wrong amount. */
  function upiUri(planKey) {
    var p = planOf(planKey) || PLANS[0];
    var vpa = CFG.upiVpa || "";
    var name = CFG.upiName || "AQcredix";
    var amt = (p.inr / 100).toFixed(2);
    var note = "AQcredix " + p.label;
    // The VPA is NOT percent-encoded. Its legal characters (letters, digits, dot, hyphen,
    // underscore, @) are all URL-safe already, and while %40 is technically correct for
    // the @, several UPI apps fail to resolve a payee address that arrives encoded. Every
    // other parameter is encoded normally.
    return "upi://pay?pa=" + String(vpa).trim() +
      "&pn=" + encodeURIComponent(name) +
      "&am=" + encodeURIComponent(amt) +
      "&cu=INR&tn=" + encodeURIComponent(note);
  }

  /* ----------------------------- Razorpay ------------------------------ */

  function razorpayReady() {
    return !!(CFG.razorpayKeyId && CFG.razorpayEnabled);
  }

  /* LOADS RAZORPAY'S CHECKOUT SCRIPT ON DEMAND.
   *
   * Nothing on this site ever loaded checkout.js, so window.Razorpay was always
   * undefined and payWithRazorpay refused every payment with "Razorpay script has not
   * loaded" — an integration that looked switched on and could not take a single rupee.
   *
   * Loaded here rather than as a <script> tag on sixty pages, for two reasons. It is a
   * third-party script on a site whose visitors are often on hospital wifi, and only the
   * paywall ever needs it — so a page that never asks for money never pays for it. And a
   * tag on every page would have to be kept in step across sixty files, which is the kind
   * of list that eventually disagrees with itself.
   *
   * The promise is cached so two clicks do not inject two scripts, and cleared on failure
   * so a customer who lost their connection can simply press pay again. */
  function loadCheckout() {
    if (window.Razorpay) return Promise.resolve();
    if (loadCheckout._p) return loadCheckout._p;
    loadCheckout._p = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = function () {
        if (window.Razorpay) resolve();
        else { loadCheckout._p = null; reject(new Error("Payment window could not start. Please try again.")); }
      };
      s.onerror = function () {
        loadCheckout._p = null;
        reject(new Error("Could not reach the payment provider. Check the connection and try again."));
      };
      document.head.appendChild(s);
    });
    return loadCheckout._p;
  }

  /* Opens Razorpay checkout. Verification happens server-side in /api/verify-payment —
   * the signature must never be checked in the browser, because anything the browser
   * decides, the browser can be made to decide differently. */
  function payWithRazorpay(user, planKey, onDone, onFail) {
    if (!razorpayReady()) return onFail(new Error("Razorpay is not configured."));
    var p = planOf(planKey) || PLANS[0];

    loadCheckout().then(function () {
    return fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planKey, amount: p.inr, email: user.email })
    }).then(function (r) { return r.json(); }).then(function (order) {
      if (!order || !order.id) throw new Error(order && order.error || "Could not create order.");
      var rz = new window.Razorpay({
        key: CFG.razorpayKeyId,
        amount: p.inr,
        currency: "INR",
        name: "AQcredix",
        description: p.label + " subscription",
        order_id: order.id,
        prefill: { email: user.email || "", name: user.name || "" },
        theme: { color: "#4C6FFF" },
        handler: function (resp) {
          fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              plan: planKey, user_id: user.id, email: user.email
            })
          }).then(function (r) { return r.json(); }).then(function (v) {
            if (v && v.verified) onDone(v);
            else onFail(new Error(v && v.error || "Payment could not be verified."));
          }).catch(onFail);
        },
        modal: { ondismiss: function () { onFail(new Error("Payment cancelled.")); } }
      });
      rz.open();
    });
    }).catch(onFail);
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    return isNaN(d) ? "—" : d.toLocaleDateString(undefined,
      { day: "2-digit", month: "short", year: "numeric" });
  }

  return {
    PLANS: PLANS, CFG: CFG,
    isOwner: isOwner, isComplimentary: isComplimentary, normalizeEmail: normalizeEmail, planOf: planOf, rupees: rupees, fmtDate: fmtDate,
    status: status, submitClaim: submitClaim, approve: approve, reject: reject,
    list: list, upiUri: upiUri,
    razorpayReady: razorpayReady, payWithRazorpay: payWithRazorpay
  };
})();
