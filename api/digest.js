/* AQcredix — the weekly digest email.
 *
 * POST /api/digest with a service-role key sends one email per subscribed user, computed
 * with the SAME digest engine the app uses. A second server-side implementation of "what
 * is overdue" would eventually disagree with the first, and the hospital would act on
 * whichever they happened to open.
 *
 * DEPLOYMENT. This needs three environment variables in Vercel:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, RESEND_API_KEY
 * and a cron entry. Until they are set the endpoint reports plainly that it is not
 * configured rather than failing obscurely — the in-app bell already works without any of
 * this, which is deliberate: a feature inert until an API key is added is one nobody sees.
 *
 * The service key is used because this runs with no user session and must read every
 * org's rows. It must never be exposed to the browser: RLS is what protects hospital data
 * from other hospitals, and the service key bypasses RLS by design.
 */
const K = require("../calendar/schedule.js");
const D = require("../workspace/digest.js");
/* The same short-expiry rule the screen and the entry receipt use. A second implementation
   would disagree with them the first time either was edited. */
const X = require("../workspace/shortexpiry.js");

const SB = process.env.SUPABASE_URL;
/* Either name — see the note in api/verify-payment.js. */
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM || "AQcredix <noreply@aqcredix.com>";
const SITE = process.env.SITE_URL || "https://aqcredix.com";

async function table(name, select) {
  const r = await fetch(
    `${SB}/rest/v1/${name}?select=${select || "*"}`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
  );
  if (!r.ok) return [];
  return await r.json();
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* Plain HTML, tables, inline styles. Not a preference — Outlook, which is what hospital
   administration runs, ignores most modern CSS and any external stylesheet. */
/* alert_email names the people assigned to the crash cart, and a hospital usually names more
   than one. Split on what a person actually types. */
function addresses(raw) {
  return String(raw == null ? "" : raw)
    .split(/[,;\s]+/).map(a => a.trim()).filter(a => a.indexOf("@") > 0);
}
function sameMailbox(a, b) {
  const norm = e => {
    const x = String(e || "").trim().toLowerCase();
    const at = x.lastIndexOf("@");
    if (at < 1) return x;
    let local = x.slice(0, at);
    const domain = x.slice(at + 1);
    const plus = local.indexOf("+");
    if (plus > -1) local = local.slice(0, plus);
    if (domain === "gmail.com" || domain === "googlemail.com") local = local.split(".").join("");
    return local + "@" + domain;
  };
  return norm(a) === norm(b);
}

const RESTOCK_ROLES = ["owner", "admin", "quality_manager", "director", "editor"];

/* IS THIS PERSON ASSIGNED TO THE CRASH CART?
   The whole email is built from assignment: a section appears in someone's mail because they
   are responsible for that thing, not because they happen to be on the account. Named
   addresses win; the owner is always included so narrowing the list cannot lock them out of
   their own hospital; and if nobody has been named at all, everyone whose role could restock
   is treated as assigned, so a hospital that never opened the setting is still told. */
function assignedToCarts(member, settingsRow) {
  const named = addresses(settingsRow && settingsRow.alert_email);
  const role = String(member.role || "").toLowerCase();
  if (role === "owner") return true;
  if (named.length) return named.some(a => sameMailbox(a, member.email));
  return RESTOCK_ROLES.indexOf(role) > -1;
}

function render(digest, name, carts) {
  const row = (i, colour) => `
    <tr><td style="padding:10px 12px;border-left:3px solid ${colour};background:#f7f9fa;border-radius:4px;">
      <div style="font-weight:600;font-size:14px;color:#0E2233;">${esc(i.name)}</div>
      <div style="font-size:12px;color:#5A6C7A;">${esc(i.kind)} &middot; ${esc(i.text)}</div>
    </td></tr><tr><td style="height:6px;"></td></tr>`;

  const group = (title, items, colour) => items.length ? `
    <tr><td style="padding:16px 0 8px;font-size:12px;font-weight:700;letter-spacing:.05em;
      text-transform:uppercase;color:#5A6C7A;">${esc(title)}</td></tr>
    ${items.slice(0, 8).map(i => row(i, colour)).join("")}
    ${items.length > 8 ? `<tr><td style="font-size:12px;color:#8B99A4;">and ${items.length - 8} more</td></tr>` : ""}` : "";

  /* ONE HEADING PER THING THIS PERSON IS RESPONSIBLE FOR, INCLUDING THE QUIET ONES.
     A section that says "nothing overdue" is not filler — it is the difference between "there
     is nothing to do" and "the alerting is broken", and the reader cannot tell those apart
     from an absence. So when somebody is assigned to two areas and only one has anything, they
     get both headings: the quiet one states it is quiet, and the other lists the work.

     The whole email is still suppressed when EVERY section is quiet — see the send rule.
     Reassurance is worth reading beside something actionable; on its own, every Monday, it is
     what teaches people to filter us into a folder they never open. */
  const cartRows = c => c.map(i => `
    <tr><td style="padding:10px 12px;border-left:3px solid ${i.state === "expired" ? "#B3261E" : "#B54708"};
      background:#f7f9fa;border-radius:4px;">
      <div style="font-weight:600;font-size:14px;color:#0E2233;">${esc(i.name)}${i.strength ? " " + esc(i.strength) : ""}</div>
      <div style="font-size:12px;color:#5A6C7A;">${esc(i.cart)} &middot; qty ${esc(i.quantity)} &middot;
        expires ${esc(i.expiry)}${i.batch ? " &middot; batch " + esc(i.batch) : ""}</div>
    </td></tr><tr><td style="height:6px;"></td></tr>`).join("");

  const heading = t => `<tr><td style="padding:22px 0 8px;font-size:12px;font-weight:700;
    letter-spacing:.05em;text-transform:uppercase;color:#0E2233;border-top:1px solid #e6ebee;">${esc(t)}</td></tr>`;

  const quiet = t => `<tr><td style="padding:4px 0 2px;font-size:13px;color:#5A6C7A;">${esc(t)}</td></tr>`;

  const cartSection = !carts ? "" :
    heading("Crash cart medicines") +
    (carts.empty
      ? quiet("No batch is expiring inside your " + carts.months + "-month window. Every cart is in date.")
      : quiet((carts.expired.length ? carts.expired.length + " already expired. " : "") +
              "Everything expiring in " + X.monthLabel(carts.windowMonth) + " or earlier is listed.") +
        cartRows(carts.expired) + cartRows(carts.short));

  const workQuiet = digest.empty
    ? quiet("Nothing overdue" + (digest.department ? " in " + digest.department : "") + " as of today.")
    : "";

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#eef2f4;
    font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;
      background:#fff;border-radius:10px;padding:26px;">
      <tr><td style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;
        color:#4C6FFF;font-weight:700;">AQcredix &middot; weekly summary</td></tr>
      <tr><td style="font-size:20px;font-weight:700;color:#0E2233;padding:8px 0 4px;">
        ${esc(D.summarise(digest))}</td></tr>
      <tr><td style="font-size:13px;color:#5A6C7A;padding-bottom:6px;">
        ${name ? esc(name) + ", this" : "This"} is what is outstanding
        ${digest.department ? "in " + esc(digest.department) : "across the hospital"} today.</td></tr>
      ${heading(digest.department ? digest.department : "Your departments")}
      ${workQuiet}
      ${group("Overdue", digest.overdue, "#B3261E")}
      ${group("Never recorded", digest.never, "#7A5200")}
      ${group("Due soon", digest.soon, "#4C6FFF")}
      ${digest.findings.length ? group("Open findings",
          digest.findings.map(c => ({ name: c.title, kind: "Finding", text: c.status || "open" })),
          "#B3261E") : ""}
      ${cartSection}
      <tr><td style="padding:20px 0 0;">
        <a href="${SITE}/workspace/dashboard.html" style="display:inline-block;background:#4C6FFF;
          color:#fff;text-decoration:none;padding:12px 22px;border-radius:99px;font-weight:600;
          font-size:14px;">Open my department</a></td></tr>
      <tr><td style="padding-top:18px;font-size:11px;color:#8B99A4;">
        You are receiving this because weekly summaries are switched on in your AQcredix
        notification settings. Turn them off from the bell in the workspace.</td></tr>
    </table></body></html>`;
}

/* The handler is the default export, as Vercel requires. render is hung off it so the
   wording of the mail can be checked without a database or a mail server — this email is the
   only thing most of a hospital ever sees of the platform. */
module.exports = async function handler(req, res) {
  /* GET IS ACCEPTED, AND HAS TO BE.
     This was POST only, and Vercel invokes a cron job with a GET — "Vercel makes an HTTP
     GET request to your project's production deployment URL". So every scheduled run since
     the cron was added has been answered with 405 and no digest has ever actually been
     sent by it. The endpoint worked perfectly whenever it was tested by hand with POST,
     which is exactly why it went unnoticed.

     POST still works, for triggering a run manually. The shared-secret check below is
     unchanged and is what actually guards this route — Vercel sends it as a bearer token
     on cron requests when CRON_SECRET is set. */
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "GET or POST only" });
  }

  /* ?scope=entry is the receipt a hospital gets the moment it enters crash cart stock, and it
     is the one caller here that is a SIGNED-IN PERSON rather than the cron.

     It is dispatched before the shared-secret check on purpose, and that is safe because it
     does not rely on the shared secret for its safety. It carries a stricter guard of its own:
     the caller presents a Supabase access token, Supabase is asked whose token it is, and the
     mail goes to that verified address and nowhere else. There is no recipient in the request
     to tamper with, so the worst anyone can do with a stolen route is mail themselves. The
     cron secret cannot be used here anyway — the browser has no business holding it. */
  if (String((req.query && req.query.scope) || "") === "entry") {
    return require("../workspace/entry-receipt.js").run(req, res);
  }

  /* Guarded by a shared secret as well as the method. A digest endpoint that anyone can
     POST to is a way to email a hospital's overdue list to its own staff repeatedly, which
     is at best a nuisance and at worst how people learn to ignore the digest. */
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorised" });
  }

  /* ?scope=expiry selects the monthly certificate run. Anything else is the weekly
     all-items digest, so an unrecognised value degrades to the existing behaviour rather
     than sending nothing. */
  /* ?scope=crashcart is a different mail entirely — the crash cart short-expiry alert —
     and is handed straight to its own module.

     It lives here rather than at /api/crash-cart-alert because Vercel's Hobby plan allows
     twelve Serverless Functions per deployment and this project already has twelve. A
     thirteenth file in api/ does not fail that one route, it fails the BUILD, which takes
     the whole site down with it. Scheduled jobs therefore share this endpoint and dispatch
     on scope. A cron path is not a function, so the separate schedule costs nothing. */
  if (String((req.query && req.query.scope) || "") === "crashcart") {
    return require("../workspace/crashcart-alert.js").run(req, res);
  }

  const EXPIRY_ONLY = String((req.query && req.query.scope) || "") === "expiry";

  if (!SB || !KEY) {
    return res.status(200).json({
      ok: false,
      configured: false,
      message: "SUPABASE_URL and SUPABASE_SERVICE_KEY are not set. The in-app bell works " +
               "without this; the weekly email needs them plus RESEND_API_KEY."
    });
  }

  try {
    const [prefs, members, tasks, committees, meetings,
           assets, schedules, events, lists, rounds, capa] = await Promise.all([
      table("notify_prefs"), table("members"),
      table("compliance_tasks"), table("committees"), table("committee_meetings"),
      table("assets"), table("asset_schedules"), table("asset_events"),
      table("checklists"), table("rounds"), table("capa")
    ]);

    /* THE CRASH CART NOW RIDES IN THIS EMAIL RATHER THAN ITS OWN.
       Two mails landing within an hour of each other on a Monday is two things to open and
       two things to start ignoring. One mail, with a heading per responsibility, is what a
       person can actually act on — and it is only possible now that assignment decides who
       sees the medicine list, because before this the digest reached everyone on the account
       and folding the carts in would have handed a viewer the trolley's contents. */
    const [carts, cartItems, cartSettings] = await Promise.all([
      table("crash_carts"), table("crash_cart_items"), table("crash_cart_settings")
    ]);

    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    const dow = today.getDay();

    let sent = 0, skipped = 0, quiet = 0;

    for (const p of prefs) {
      if (!p.email_digest) { skipped++; continue; }
      /* Only on the day they chose, and only once. Without the last_sent_on check a cron
         that runs hourly would send twenty-four identical emails, which is the fastest
         possible way to make someone switch the digest off for good. */
      if (Number(p.digest_dow) !== dow) { skipped++; continue; }
      if (p.last_sent_on === iso) { skipped++; continue; }

      const member = members.find(m => m.user_id === p.user_id);
      if (!member || !member.email) { skipped++; continue; }

      const org = member.org_id;
      const mine = rows => rows.filter(r => r.org_id === org);

      /* Only for the people this hospital has put on the crash cart. Everyone else's email
         simply has no such heading — the section's presence IS the assignment. */
      const cartSet = (cartSettings || []).find(x => x.org_id === org) || {};
      const myCarts = assignedToCarts(member, cartSet)
        ? X.review(mine(carts || []), mine(cartItems || []),
                   { today: X.todayIST(), months: cartSet.months })
        : null;

      const digest = D.build(K, {
        tasks: mine(tasks), committees: mine(committees), meetings: mine(meetings),
        assets: mine(assets), schedules: mine(schedules), events: mine(events),
        lists: mine(lists), rounds: mine(rounds), capa: mine(capa)
      }, { department: p.department || "", today: iso, overdueOnly: !!p.overdue_only });

      /* Monthly certificate run.
         The weekly digest already carries registrations among everything else, and for a
         biomedical engineer that is the right shape. It is the wrong shape for HR: a
         registration expiring in eleven weeks sits below six overdue calibrations and is
         read as noise, every week, until it is not a warning any more.

         So the monthly run keeps only the things with a printed expiry date and sends
         them under their own subject line. Same data, same lead time, different envelope
         — a mail an HR head can act on in one pass rather than one they learn to skim. */
      if (EXPIRY_ONLY) {
        const keep = i => i.expires_on && i.state !== "ok";
        digest.overdue = (digest.overdue || []).filter(keep);
        digest.soon = (digest.soon || []).filter(keep);
        digest.never = [];
        digest.findings = [];
        digest.empty = !digest.overdue.length && !digest.soon.length;
      }

      /* Nothing to say is a real answer. "You have 0 overdue items" every Monday is how a
         digest teaches people to filter it into a folder they never open.

         But "nothing" now has to mean nothing ACROSS EVERYTHING they are responsible for. A
         biomedical engineer with a clean register and an expiring ampoule in their crash cart
         has something to read, and the old test — which knew only about the digest — would
         have sent them nothing at all. */
      const cartsWorthSending = myCarts && !myCarts.empty;
      if (digest.empty && !cartsWorthSending) { quiet++; continue; }

      if (RESEND) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            to: member.email,
            subject: EXPIRY_ONLY
              ? "AQcredix · Certificates expiring soon"
              : "AQcredix · " + (digest.empty && cartsWorthSending
                  ? (myCarts.expired.length + myCarts.short.length) + " crash cart batch" +
                    (myCarts.expired.length + myCarts.short.length === 1 ? "" : "es") +
                    " need attention"
                  : D.summarise(digest)),
            html: render(digest, member.name, EXPIRY_ONLY ? null : myCarts)
          })
        });
      }

      await fetch(`${SB}/rest/v1/notify_prefs?user_id=eq.${p.user_id}`, {
        method: "PATCH",
        headers: {
          apikey: KEY, Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json", Prefer: "return=minimal"
        },
        body: JSON.stringify({ last_sent_on: iso })
      });
      sent++;
    }

    return res.status(200).json({
      ok: true,
      configured: !!RESEND,
      sent, skipped, quiet,
      note: RESEND ? undefined : "RESEND_API_KEY is not set, so nothing was actually emailed."
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};

module.exports.render = render;
