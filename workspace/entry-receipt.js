/* AQcredix — the receipt that lands the moment a hospital enters crash cart stock.
 *
 * WHY THIS EXISTS, AND WHY IT MATTERS MORE THAN THE WEEKLY ALERT.
 * The weekly alert is a promise about the future: "every Monday we will tell you what is
 * short." A promise is not evidence. Somebody typing thirty ampoules into a trolley register
 * on a Tuesday has no way of knowing whether the alerting works at all, and no reason to
 * believe it until a Monday comes and something happens to be expiring — which, if the
 * hospital is well run, may be months away. Until then the feature is indistinguishable from
 * a feature that is quietly broken.
 *
 * So this sends a mail when the data goes in. It is the only moment the hospital can check
 * the claim against something they know: they just typed it, and they can see whether what
 * came back matches. That is what makes the Monday mail believable.
 *
 * IT SENDS WHETHER OR NOT ANYTHING IS SHORT. A receipt that only arrives when there is bad
 * news teaches exactly the wrong lesson — silence would mean "nothing is wrong" and "the
 * email is broken" at the same time, and the hospital cannot tell which. "Nothing in your
 * data is expiring inside the window" is the useful message on most days, and it is the one
 * that proves the pipe is open.
 *
 * IT REPORTS THE WHOLE REGISTER, NOT JUST TODAY'S ROWS. Stock typed on Monday and stock typed
 * on Tuesday sit in the same trolley, and a pharmacist asking "what is short?" means all of
 * it. So each receipt is the current state of every cart, not a diff — which also means the
 * numbers in it can be checked against the screen.
 *
 * IT MAILS ONE ADDRESS: THE ONE THAT ASKED.
 * The recipient is never taken from the request. The caller presents a Supabase access token,
 * Supabase is asked whose token it is, and the answer is where the mail goes. Reading an
 * address out of the body would make this an open relay that signs its mail as AQcredix.
 *
 * WHERE IT LIVES. Vercel's Hobby plan allows twelve Serverless Functions and api/ is at
 * twelve. A thirteenth file breaks the whole deployment, so this is dispatched from
 * api/digest.js on ?scope=entry — a query string costs no function.
 */
const E = require("./shortexpiry.js");

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM || "AQcredix <noreply@aqcredix.com>";
const SITE = process.env.SITE_URL || "https://aqcredix.com";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function dmy(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return m[3] + " " + names[+m[2] - 1] + " " + m[1];
}

async function table(name, select, filter) {
  try {
    const url = SB + "/rest/v1/" + name + "?select=" + (select || "*") + (filter ? "&" + filter : "");
    const r = await fetch(url, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

/* Who is this token, really? Asked of Supabase rather than read from the request, which would
   let anyone claim any address by typing it. Same check api/video-url.js makes. */
async function emailOf(token) {
  try {
    const r = await fetch(SB + "/auth/v1/user", {
      headers: { apikey: KEY || ANON, Authorization: "Bearer " + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.email ? String(u.email) : null;
  } catch (e) { return null; }
}

function rows(items) {
  return items.map(function (i) {
    const left = i.daysLeft < 0
      ? '<span style="color:#b42318;font-weight:700">expired ' + Math.abs(i.daysLeft) + "d ago</span>"
      : i.daysLeft + " days left";
    return '<tr><td style="padding:7px 10px;border-bottom:1px solid #eee">' +
        "<b>" + esc(i.name) + "</b>" + (i.strength ? " " + esc(i.strength) : "") +
        (i.batch ? '<br><span style="color:#889;font-size:12px">batch ' + esc(i.batch) + "</span>" : "") +
      '</td><td style="padding:7px 10px;border-bottom:1px solid #eee">' + esc(i.cart) +
      '</td><td style="padding:7px 10px;border-bottom:1px solid #eee;text-align:right">' + esc(i.quantity) +
      '</td><td style="padding:7px 10px;border-bottom:1px solid #eee;white-space:nowrap">' + dmy(i.expiry) +
      '</td><td style="padding:7px 10px;border-bottom:1px solid #eee;white-space:nowrap">' + left +
      "</td></tr>";
  }).join("");
}

function table_(title, items, tone) {
  if (!items.length) return "";
  return '<h2 style="font:700 15px/1.3 system-ui;margin:22px 0 8px;color:' + tone + '">' +
      esc(title) + "</h2>" +
    '<table style="border-collapse:collapse;width:100%;font:13px/1.45 system-ui">' +
      '<tr style="text-align:left;color:#667;font-size:12px">' +
        '<th style="padding:6px 10px">Item</th><th style="padding:6px 10px">Crash cart</th>' +
        '<th style="padding:6px 10px;text-align:right">Qty</th>' +
        '<th style="padding:6px 10px">Expires</th><th style="padding:6px 10px">&nbsp;</th></tr>' +
      rows(items) + "</table>";
}

/* Exported so the wording can be checked without a mail server or a database. */
function render(review, orgName, when) {
  const policyLine = "It is <b>" + esc(E.monthLabel(String(review.today).slice(0, 7))) +
    "</b> and your short-expiry policy is <b>" + review.months + " months</b>, so anything " +
    "expiring in <b>" + esc(E.monthLabel(review.windowMonth)) + " or earlier</b> is short. " +
    "The whole month counts &mdash; the date printed on the pack does not matter, only the month.";

  const clear =
    '<div style="background:#ecfdf3;border:1px solid #a6f4c5;border-radius:8px;padding:14px 16px;' +
      'margin:0 0 6px;color:#054f31;font:14px/1.55 system-ui">' +
      "<b>Nothing in your crash cart data is expiring inside the window.</b><br>" +
      "We have checked every batch in every cart, not just what you entered just now." +
    "</div>";

  const bad =
    '<div style="background:#fef3f2;border:1px solid #fda29b;border-radius:8px;padding:14px 16px;' +
      'margin:0 0 6px;color:#7a271a;font:14px/1.55 system-ui">' +
      "<b>" + (review.expired.length + review.short.length) + " batch" +
      (review.expired.length + review.short.length === 1 ? "" : "es") +
      " need attention.</b>" +
      (review.expired.length
        ? "<br>" + review.expired.length + " already expired &mdash; remove from the trolley now."
        : "") +
    "</div>";

  return '<div style="max-width:680px;margin:0 auto;padding:26px 22px;font-family:system-ui,' +
      '-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a">' +
    '<h1 style="font:800 19px/1.3 system-ui;margin:0 0 4px">' +
      "Crash cart data received</h1>" +
    '<p style="margin:0 0 16px;color:#667;font-size:13.5px">' +
      esc(orgName || "Your hospital") + " &middot; " + esc(when) + "</p>" +

    (review.empty ? clear : bad) +

    table_("Already expired — remove now", review.expired, "#b42318") +
    table_("Short expiry", review.short, "#b54708") +

    '<p style="margin:22px 0 0;padding:14px 16px;background:#f6f7f9;border-radius:8px;' +
      'color:#344;font:13px/1.6 system-ui">' + policyLine + "</p>" +

    '<p style="margin:14px 0 0;color:#667;font:13px/1.6 system-ui">' +
      "You will also get a summary <b>every Monday</b>, covering this and everything else due " +
      "across your hospital. This message was sent because stock was entered just now &mdash; " +
      "so you can see the alerts working rather than take our word for it." +
    "</p>" +

    '<p style="margin:18px 0 0"><a href="' + SITE + '/workspace/crashcart.html" ' +
      'style="color:#4C6FFF;font:600 13px system-ui">Open the short expiry calendar</a></p>' +
  "</div>";
}

async function run(req, res) {
  if (!SB || !KEY) {
    return res.status(200).json({ ok: false, configured: false,
      note: "SUPABASE_URL and a service key are not set, so no receipt could be sent." });
  }

  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return res.status(401).json({ error: "sign in first" });

  const email = await emailOf(token);
  if (!email) return res.status(401).json({ error: "that session is not valid" });

  /* Which hospital is this person in? Read from members rather than trusted from the body,
     for the same reason the address is. */
  const members = await table("members", "org_id,email,name,role");
  if (!members) return res.status(200).json({ ok: false, note: "could not read members" });
  const mine = members.filter(function (m) {
    return String(m.email || "").trim().toLowerCase() === email.trim().toLowerCase();
  })[0];
  if (!mine) return res.status(200).json({ ok: false, note: "no hospital is linked to that address" });
  const org = mine.org_id;

  const [carts, items, settings, orgs] = await Promise.all([
    table("crash_carts", "id,org_id,name,department"),
    table("crash_cart_items", "id,org_id,cart_id,name,strength,batch,quantity,expires_on"),
    table("crash_cart_settings", "org_id,months"),
    table("orgs", "id,name")
  ]);
  if (!carts || !items) return res.status(200).json({ ok: false, note: "could not read the register" });

  const mineCarts = carts.filter(function (c) { return c.org_id === org; });
  const mineItems = items.filter(function (i) { return i.org_id === org; });
  const s = (settings || []).filter(function (x) { return x.org_id === org; })[0] || {};
  const orgName = ((orgs || []).filter(function (o) { return o.id === org; })[0] || {}).name;

  const today = E.todayIST();
  const review = E.review(mineCarts, mineItems, { today: today, months: s.months });

  const when = dmy(today);
  const subject = review.empty
    ? "Crash cart updated — nothing short expiry"
    : "Crash cart updated — " + (review.expired.length + review.short.length) +
      " batch" + (review.expired.length + review.short.length === 1 ? "" : "es") + " need attention";

  if (!RESEND) {
    return res.status(200).json({ ok: false, configured: false, wouldSendTo: email,
      expired: review.expired.length, short: review.short.length,
      note: "RESEND_API_KEY is not set, so nothing was actually emailed." });
  }

  /* ONE recipient, and it is the verified owner of the token. No bcc list, because there is
     no list: this is a receipt for the person who just typed, not a broadcast. */
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM, to: [email], subject: subject,
      html: render(review, orgName, when)
    })
  });

  return res.status(200).json({ ok: true, sentTo: email,
    expired: review.expired.length, short: review.short.length,
    windowMonth: review.windowMonth });
}

module.exports = { run: run, render: render };
