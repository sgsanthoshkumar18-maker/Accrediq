/* AQcredix — the support form's send route.
 *
 * WHY A SERVER ROUTE AND NOT A mailto: LINK. A mailto: hands the problem back to the
 * person reporting it — it opens whatever mail client the hospital desktop has configured,
 * which on a shared ward machine is often nothing at all, and the complaint is lost with
 * no trace that it was ever attempted. This sends the message itself and tells the person
 * plainly whether it went.
 *
 * WHY reply_to AND NOT from. The message is sent FROM the verified aqcredix.com domain,
 * because Resend can only send as a domain we own — putting the reporter's address in
 * `from` would be a forgery, would fail SPF, and would land the whole domain in spam.
 * Their address goes in reply_to instead, so hitting Reply in Gmail reaches them. That is
 * the entire point of collecting it: a complaint you cannot answer is a complaint you have
 * only annoyed someone by taking.
 */

const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.DIGEST_FROM || "AQcredix <noreply@aqcredix.com>";
const TO = process.env.SUPPORT_TO || "support.aqcredix@gmail.com";

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

  const b = req.body || {};
  const email = String(b.email || "").trim();
  const message = String(b.message || "").trim();
  const page = String(b.page || "").slice(0, 300);
  const kind = String(b.kind || "Support").slice(0, 40);

  /* A hidden field no human ever sees. A bot fills every input on the form, so anything
     arriving with this set is discarded — and answered with 200 rather than an error, so
     the bot learns nothing about why it failed. */
  if (b.company) return res.status(200).json({ ok: true });

  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: "That email address does not look right. We need it to reply." });
  }
  if (message.length < 12) {
    return res.status(400).json({ error: "Please describe the problem in a sentence or two." });
  }
  if (message.length > 5000 || email.length > 200) {
    return res.status(400).json({ error: "That is longer than we can send. Please shorten it." });
  }

  if (!RESEND) {
    /* Say what is actually wrong rather than pretending it sent. A support form that
       silently drops messages is worse than no support form. */
    return res.status(503).json({
      error: "Support mail is not configured yet. Please email us directly.",
      fallback: TO
    });
  }

  const html =
    '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.6;color:#12201D">' +
    '<p style="margin:0 0 4px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7A5C36">' +
      esc(kind) + ' &middot; aqcredix.com</p>' +
    '<h2 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:400;font-size:22px">' +
      'Message from ' + esc(email) + '</h2>' +
    '<div style="white-space:pre-wrap;border-left:3px solid #2743C9;padding:2px 0 2px 16px;margin:0 0 20px">' +
      esc(message) + '</div>' +
    '<table style="font-size:13px;color:#5E6D67;border-collapse:collapse">' +
      '<tr><td style="padding:2px 14px 2px 0">Reply to</td><td>' + esc(email) + '</td></tr>' +
      '<tr><td style="padding:2px 14px 2px 0">Sent from</td><td>' + esc(page || "unknown page") + '</td></tr>' +
      '<tr><td style="padding:2px 14px 2px 0">Received</td><td>' + new Date().toISOString() + '</td></tr>' +
    '</table>' +
    '<p style="font-size:12px;color:#8B978F;margin-top:20px">Hit Reply — it goes straight to them.</p>' +
    '</div>';

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: TO,
        reply_to: email,
        subject: kind + " from " + email,
        html: html
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({
        error: "We could not send that just now. Please email us directly.",
        fallback: TO,
        upstream: detail.slice(0, 200)
      });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({
      error: "We could not reach the mail service. Please email us directly.",
      fallback: TO
    });
  }
};
