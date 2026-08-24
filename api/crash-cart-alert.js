/* AQcredix — CRASH CART MEDICINE EXPIRY ALERT.
 *
 * GET/POST /api/crash-cart-alert          send to every hospital that is due
 *          ?dry=1                         compute and report, send nothing
 *
 * Run monthly by cron. One mail per hospital, listing every crash cart medicine at or
 * inside that hospital's short-expiry window, grouped by the trolley it sits in.
 *
 * WHY ITS OWN MAIL AND NOT A SECTION OF THE DIGEST.
 * The weekly digest is a list of everything a quality manager owes. A crash cart is not
 * that: it is a box that has to be right at three in the morning, and the person who
 * restocks it is usually the clinical pharmacist rather than the quality manager. Buried
 * under nine overdue calibrations it becomes something to read later. Under its own
 * subject line it is a job with a beginning and an end.
 *
 * THE RULE LIVES IN workspace/shortexpiry.js AND IS REQUIRED FROM THERE.
 * Not copied. The pharmacist's screen calls the same function this does, so the two can
 * never disagree about which ampoules are short — and if they did, nobody would trust
 * either of them again.
 *
 * EXPIRED IS SEPARATED FROM SHORT, AND SAID FIRST.
 * An expired drug in a resus trolley is an incident, not a reorder. Listing it among
 * "expiring soon" is how it gets scheduled instead of removed.
 *
 * REQUIRED ENVIRONMENT
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY), RESEND_API_KEY
 */
const E = require("../workspace/shortexpiry.js");

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM || "AQcredix <noreply@aqcredix.com>";
const SITE = process.env.SITE_URL || "https://aqcredix.com";

/* The roles that would be expected to restock a trolley. A viewer is not mailed about a
   job they cannot record having done. */
const RESTOCK_ROLES = ["owner", "admin", "quality_manager", "director", "editor"];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

async function table(name, select) {
  try {
    const r = await fetch(SB + "/rest/v1/" + name + "?select=" + (select || "*"),
      { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) return null;               // null means "could not read", not "empty"
    return await r.json();
  } catch (e) { return null; }
}

function dmy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m[3] + " " + names[+m[2] - 1] + " " + m[1];
}

function rows(items, urgent) {
  return items.map(function (i) {
    const left = i.daysLeft < 0
      ? '<span style="color:#b42318;font-weight:700">expired ' + Math.abs(i.daysLeft) + 'd ago</span>'
      : i.daysLeft + " days left";
    return '<tr>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #e6e9ee">' + esc(i.name) +
        (i.strength ? ' <span style="color:#667">' + esc(i.strength) + '</span>' : "") +
        (i.batch ? '<br><span style="color:#889;font-size:12px">batch ' + esc(i.batch) + '</span>' : "") +
      '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #e6e9ee;text-align:center">' +
        esc(i.quantity) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #e6e9ee;white-space:nowrap' +
        (urgent ? ';color:#b42318;font-weight:700' : '') + '">' + dmy(i.expiry) + '</td>' +
      '<td style="padding:7px 10px;border-bottom:1px solid #e6e9ee;color:#667;white-space:nowrap">' +
        left + '</td></tr>';
  }).join("");
}

function section(title, groups, urgent) {
  if (!groups.length) return "";
  return '<h3 style="font:700 15px/1.3 system-ui;margin:26px 0 8px;color:' +
           (urgent ? "#b42318" : "#0B4F45") + '">' + esc(title) + '</h3>' +
    groups.map(function (g) {
      return '<div style="margin:0 0 16px">' +
        '<div style="font:600 14px system-ui;margin:0 0 4px">' + esc(g.cart) +
          (g.department ? ' <span style="color:#889;font-weight:400">· ' +
            esc(g.department) + '</span>' : "") + '</div>' +
        '<table style="border-collapse:collapse;width:100%;font:14px system-ui">' +
        '<tr style="text-align:left;color:#667;font-size:12px;text-transform:uppercase">' +
          '<th style="padding:4px 10px">Item</th>' +
          '<th style="padding:4px 10px;text-align:center">Qty</th>' +
          '<th style="padding:4px 10px">Expires</th>' +
          '<th style="padding:4px 10px">&nbsp;</th></tr>' +
        rows(g.items, urgent) + '</table></div>';
    }).join("");
}

function render(review, orgName) {
  const expiredByCart = E.byCart(review.expired);
  const shortByCart = E.byCart(review.short);
  const monthly = E.byMonth(review.short);

  return '<div style="font:15px/1.6 system-ui,-apple-system,sans-serif;color:#101828;' +
    'max-width:640px;margin:0 auto;padding:22px">' +
    '<h1 style="font:800 19px/1.3 system-ui;margin:0 0 4px;color:#b42318">' +
      'CRASH CART MEDICINE EXPIRY ALERT !!</h1>' +
    '<p style="margin:0 0 18px;color:#667;font-size:13.5px">' +
      esc(orgName || "Your hospital") + ' &middot; short-expiry policy: <b>' +
      review.months + ' months</b> &middot; covering everything expiring on or before <b>' +
      dmy(review.windowEnds) + '</b></p>' +

    (review.expired.length
      ? '<div style="background:#fef3f2;border:1px solid #fda29b;border-radius:8px;' +
        'padding:12px 14px;margin:0 0 6px"><b style="color:#b42318">' +
        review.expired.length + ' item' + (review.expired.length === 1 ? " has" : "s have") +
        ' already expired.</b> Remove from the trolley now — this is not a reorder.</div>'
      : "") +
    section("Already expired — remove today", expiredByCart, true) +

    section("Short expiry — replace before the date shown", shortByCart, false) +

    (monthly.length > 1
      ? '<h3 style="font:700 15px/1.3 system-ui;margin:26px 0 8px;color:#0B4F45">' +
        'By month</h3><ul style="margin:0 0 8px;padding-left:20px;color:#344">' +
        monthly.map(function (m) {
          return '<li><b>' + esc(E.monthLabel(m.month)) + '</b> — ' + m.items.length +
                 ' item' + (m.items.length === 1 ? "" : "s") + '</li>';
        }).join("") + '</ul>'
      : "") +

    '<p style="margin:22px 0 0"><a href="' + SITE + '/workspace/crashcart.html" ' +
      'style="background:#0E7C6B;color:#fff;text-decoration:none;padding:10px 18px;' +
      'border-radius:7px;font-weight:600;display:inline-block">Open the short expiry calendar</a></p>' +
    '<p style="margin:18px 0 0;color:#889;font-size:12px">Counted across ' +
      review.cartCount + ' crash cart' + (review.cartCount === 1 ? "" : "s") + ' and ' +
      review.itemCount + ' item' + (review.itemCount === 1 ? "" : "s") + '. ' +
      'After a code blue, record the items used so their new expiry dates are tracked.</p>' +
    '</div>';
}

module.exports = async function handler(req, res) {
  const dry = String((req.query && req.query.dry) || "") === "1";

  if (!SB || !KEY) {
    return res.status(200).json({
      ok: false, configured: false,
      message: "SUPABASE_URL and a service key are not set."
    });
  }

  const [carts, items, settings, members, orgs] = await Promise.all([
    table("crash_carts", "id,org_id,name,department"),
    table("crash_cart_items", "id,org_id,cart_id,name,strength,quantity,expires_on,batch"),
    table("crash_cart_settings", "*"),
    table("members", "org_id,email,name,role"),
    table("orgs", "id,name")
  ]);

  /* A failed read is not an empty hospital. Sending "nothing is expiring" because the
     database was unreachable would be a lie of exactly the kind this alert exists to
     prevent, so the run stops instead. */
  if (!carts || !items || !members) {
    console.error("crash-cart-alert: could not read the tables");
    return res.status(503).json({ ok: false, error: "could not read the register" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const orgName = {};
  (orgs || []).forEach(function (o) { orgName[o.id] = o.name; });
  const setting = {};
  (settings || []).forEach(function (s) { setting[s.org_id] = s; });

  const orgIds = {};
  carts.forEach(function (c) { if (c.org_id) orgIds[c.org_id] = true; });

  let sent = 0, quiet = 0, skipped = 0;
  const report = [];

  for (const org of Object.keys(orgIds)) {
    const s = setting[org] || {};
    if (s.last_sent_on === today) { skipped++; continue; }

    const review = E.review(
      carts.filter(function (c) { return c.org_id === org; }),
      items.filter(function (i) { return i.org_id === org; }),
      { today: today, months: E.normaliseMonths(s.months) }
    );

    /* Nothing expiring is a good month and does not need an email about it. A monthly
       "all clear" is how people learn to filter the alert into a folder, and then miss
       the one that mattered. */
    if (review.empty) { quiet++; continue; }

    /* Addressed to the person who restocks: the address set for this hospital if there is
       one, otherwise everyone who could actually act on it. Bcc, never To — a To line
       would show every recipient each other's address. */
    const recipients = s.alert_email
      ? [s.alert_email]
      : members.filter(function (m) {
          return m.org_id === org && m.email &&
                 RESTOCK_ROLES.indexOf(String(m.role || "").toLowerCase()) > -1;
        }).map(function (m) { return m.email; });

    report.push({
      org: orgName[org] || org, months: review.months,
      expired: review.expired.length, short: review.short.length,
      recipients: recipients.length
    });

    if (!recipients.length) { skipped++; continue; }
    if (dry) { sent++; continue; }

    if (RESEND) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: FROM,                 // Bcc carries the real recipients
          bcc: recipients,
          subject: "CRASH CART MEDICINE EXPIRY ALERT !!",
          html: render(review, orgName[org])
        })
      });
    }

    await fetch(SB + "/rest/v1/crash_cart_settings?on_conflict=org_id", {
      method: "POST",
      headers: {
        apikey: KEY, Authorization: "Bearer " + KEY,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({ org_id: org, months: review.months, last_sent_on: today })
    });
    sent++;
  }

  return res.status(200).json({
    ok: true, configured: !!RESEND, dry: dry, sent: sent, quiet: quiet, skipped: skipped,
    report: report,
    note: RESEND ? undefined : "RESEND_API_KEY is not set, so nothing was actually emailed."
  });
};

module.exports.render = render;
