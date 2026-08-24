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
function render(digest, name) {
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

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#eef2f4;
    font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;
      background:#fff;border-radius:10px;padding:26px;">
      <tr><td style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;
        color:#0EA5A0;font-weight:700;">AQcredix &middot; weekly summary</td></tr>
      <tr><td style="font-size:20px;font-weight:700;color:#0E2233;padding:8px 0 4px;">
        ${esc(D.summarise(digest))}</td></tr>
      <tr><td style="font-size:13px;color:#5A6C7A;padding-bottom:6px;">
        ${name ? esc(name) + ", this" : "This"} is what is outstanding
        ${digest.department ? "in " + esc(digest.department) : "across the hospital"} today.</td></tr>
      ${group("Overdue", digest.overdue, "#B3261E")}
      ${group("Never recorded", digest.never, "#7A5200")}
      ${group("Due soon", digest.soon, "#0EA5A0")}
      ${digest.findings.length ? group("Open findings",
          digest.findings.map(c => ({ name: c.title, kind: "Finding", text: c.status || "open" })),
          "#B3261E") : ""}
      <tr><td style="padding:20px 0 0;">
        <a href="${SITE}/workspace/dashboard.html" style="display:inline-block;background:#0EA5A0;
          color:#fff;text-decoration:none;padding:12px 22px;border-radius:99px;font-weight:600;
          font-size:14px;">Open my department</a></td></tr>
      <tr><td style="padding-top:18px;font-size:11px;color:#8B99A4;">
        You are receiving this because weekly summaries are switched on in your AQcredix
        notification settings. Turn them off from the bell in the workspace.</td></tr>
    </table></body></html>`;
}

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
         digest teaches people to filter it into a folder they never open. */
      if (digest.empty) { quiet++; continue; }

      if (RESEND) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM,
            to: member.email,
            subject: EXPIRY_ONLY
              ? "AQcredix · Certificates expiring soon"
              : "AQcredix · " + D.summarise(digest),
            html: render(digest, member.name)
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
