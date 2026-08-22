/* AQcredix — tell the owner when somebody signs up.
 *
 * Called by a Supabase Database Webhook on INSERT into auth.users. Sends one short email
 * to the owner, which arrives on a phone as a push notification through the mail app.
 *
 * WHY A DATABASE WEBHOOK AND NOT A CALL FROM THE BROWSER.
 * The obvious place to put this is right after signUp() succeeds in auth-gate.js. It is
 * also the wrong place: the browser can be closed, the tab can be switched, the network
 * can drop, an ad blocker can eat the request — and every one of those loses the
 * notification silently while the account is created regardless. The database is the only
 * component that cannot miss the event, because the event IS a row appearing in it.
 *
 * WHY NOT SMS.
 * Transactional SMS in India requires DLT registration with TRAI — a Principal Entity
 * registration, an approved Header, and a registered template for each message. That is
 * weeks of paperwork and a paid provider, for a line of text the mail app already
 * delivers to the same lock screen.
 *
 * REQUIRED ENVIRONMENT
 *   RESEND_API_KEY      already set
 *   OWNER_EMAIL         where the notice goes (falls back to SUPPORT_TO)
 *   NEW_USER_SECRET     a shared secret, checked below — see the note on why
 */

const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM || "AQcredix <noreply@aqcredix.com>";
const TO = (process.env.OWNER_EMAIL || process.env.SUPPORT_TO || "").trim();
const SECRET = (process.env.NEW_USER_SECRET || "").trim();
const SITE = process.env.SITE_URL || "https://aqcredix.com";

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  /* THE SECRET IS NOT OPTIONAL, AND THE ENDPOINT REFUSES TO RUN WITHOUT ONE.
   *
   * This URL is public. Without a check, anybody who found it could post whatever they
   * liked and have it arrive in the owner's inbox looking exactly like a genuine sign-up
   * notice — which is worse than no notice, because a false one is believed.
   *
   * If NEW_USER_SECRET is unset the route answers 503 rather than defaulting to open.
   * Failing closed on a missing secret is the only safe direction: an endpoint that is
   * accidentally unprotected looks identical to one that is working. */
  if (!SECRET) {
    return res.status(503).json({ error: "Not configured." });
  }
  const given = req.headers["x-aq-secret"] || req.headers["authorization"] || "";
  const token = String(given).replace(/^Bearer\s+/i, "").trim();
  if (token !== SECRET) {
    /* 404 rather than 401: there is nothing to gain by confirming to a stranger that
       this endpoint exists and is worth guessing at. */
    return res.status(404).json({ error: "Not found" });
  }

  if (!RESEND || !TO) {
    return res.status(503).json({ error: "Mail is not configured." });
  }

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  /* Supabase webhooks wrap the row in { type, table, record }. A hand-made test post
     may send the fields flat. Accept either rather than making the caller care. */
  const row = b.record || b;
  const email = String(row.email || "").trim();
  const meta = row.raw_user_meta_data || row.user_metadata || {};
  const name = meta.full_name || meta.name || null;
  const org = meta.org_name || null;
  const when = row.created_at ? new Date(row.created_at) : new Date();

  if (!email) return res.status(400).json({ error: "No email in payload." });

  const rows = [
    ["Email", email],
    name ? ["Name", name] : null,
    org ? ["Hospital", org] : null,
    ["Signed up", when.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"]
  ].filter(Boolean);

  const html =
    '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#12201D">' +
    '<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7A5C36">' +
      'New account &middot; aqcredix.com</p>' +
    '<h2 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:400;font-size:22px">' +
      esc(name || email) + ' signed up</h2>' +
    '<table style="font-size:14px;color:#5E6D67;border-collapse:collapse">' +
      rows.map(function (r) {
        return '<tr><td style="padding:3px 16px 3px 0;color:#8B978F">' + esc(r[0]) +
               '</td><td style="color:#12201D">' + esc(r[1]) + '</td></tr>';
      }).join("") +
    '</table>' +
    '<p style="font-size:13px;color:#5E6D67;margin-top:20px">' +
      'They have an account. They do not have a subscription unless they pay or you grant ' +
      'complimentary access.</p>' +
    '<p style="font-size:12px;color:#8B978F;margin-top:14px">' +
      '<a href="' + esc(SITE) + '/profile.html" style="color:#0B4F45">Open AQcredix</a></p>' +
    '</div>';

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: TO,
        subject: "New AQcredix account — " + (name || email),
        html: html
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      /* Answer 200 anyway. Supabase retries a failing webhook, and a retry storm over a
         notification is not worth risking the sign-up path for — the account itself is
         already created and unaffected either way. The failure is reported in the body
         so it is visible in the webhook log rather than silently swallowed. */
      return res.status(200).json({ ok: false, error: detail.slice(0, 200) });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
