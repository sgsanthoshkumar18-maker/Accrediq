/* AQcredix — verify a Razorpay payment and activate the subscription.
 *
 * The signature check MUST happen here and never in the browser. Razorpay signs
 * order_id|payment_id with your key secret; recomputing that HMAC is the only thing that
 * distinguishes a real payment from a forged callback. A browser-side check protects
 * nothing, because anything the browser decides, the browser can be made to decide
 * differently.
 *
 * Activation uses the Supabase SERVICE ROLE key, because RLS deliberately forbids users
 * from updating their own subscription row. That key must exist only in Vercel's
 * environment variables — never in the repository, never in a file that ships to a
 * browser.
 */
const crypto = require("crypto");

const MONTHS = { monthly: 1, yearly: 12 };

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const SECRET = process.env.RAZORPAY_KEY_SECRET;
  const SB_URL = process.env.SUPABASE_URL;
  const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SECRET || !SB_URL || !SB_SERVICE) {
    res.status(503).json({ error: "Payment verification is not configured." });
    return;
  }

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, user_id, email } = b || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: "Incomplete payment response." });
    return;
  }

  const expected = crypto.createHmac("sha256", SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  // Constant-time comparison: a plain !== leaks timing information about the signature.
  const a = Buffer.from(expected, "utf8");
  const c = Buffer.from(String(razorpay_signature), "utf8");
  if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) {
    res.status(400).json({ verified: false, error: "Signature did not verify." });
    return;
  }

  const months = MONTHS[plan] || 1;
  const now = new Date();
  const expires = new Date(now.getTime());
  expires.setMonth(expires.getMonth() + months);

  try {
    const r = await fetch(SB_URL + "/rest/v1/subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SB_SERVICE,
        Authorization: "Bearer " + SB_SERVICE,
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        id: "sub_rzp_" + razorpay_payment_id,
        user_id: user_id || null,
        email: email || null,
        plan: plan,
        months: months,
        method: "razorpay",
        txn_ref: razorpay_payment_id,
        status: "active",
        requested_at: now.toISOString(),
        activated_at: now.toISOString(),
        expires_at: expires.toISOString(),
        approved_by: "razorpay:verified"
      })
    });
    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ verified: true, error: "Payment verified but activation failed: " + t });
      return;
    }
    res.status(200).json({ verified: true, expires_at: expires.toISOString() });
  } catch (e) {
    res.status(500).json({ verified: true, error: "Payment verified but activation errored." });
  }
};
