/* AQcredix — create a Razorpay order.
 *
 * Dormant until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in Vercel's environment
 * variables. Until then the site uses the UPI + manual approval path, which needs none of
 * this.
 *
 * The amount is taken from the server's own price table, never from the request body.
 * Trusting a client-supplied amount is how people buy a year's access for one rupee.
 */
/* FALLS BACK TO THE REAL PRICE, NOT ₹1 — same rule as billing.js, and for the same
   reason. These used to default to 100 paise, so enabling Razorpay without also setting
   PRICE_MONTHLY_PAISE and PRICE_YEARLY_PAISE would have created every order for one
   rupee: a live payment gateway quietly selling a year of access for ₹1, with a valid
   signature and nothing to flag it. A missing config should fail by charging correctly,
   never by charging almost nothing.

   Keep these in step with monthlyInr / yearlyInr in billing/billing-config.js, which is
   the price the customer is shown. If the two ever disagree the customer is charged this
   one — the server's number is the one that reaches the gateway. */
const FALLBACK_MONTHLY_PAISE = 50000;   // ₹500
const FALLBACK_YEARLY_PAISE  = 500000;  // ₹5,000 — the year at ten months

const PRICES = {
  monthly: Number(process.env.PRICE_MONTHLY_PAISE || FALLBACK_MONTHLY_PAISE),
  yearly:  Number(process.env.PRICE_YEARLY_PAISE  || FALLBACK_YEARLY_PAISE)
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const KEY = process.env.RAZORPAY_KEY_ID;
  const SECRET = process.env.RAZORPAY_KEY_SECRET;
  if (!KEY || !SECRET) {
    res.status(503).json({ error: "Razorpay is not configured on this deployment." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const plan = String((body && body.plan) || "");
  const amount = PRICES[plan];
  if (!amount) { res.status(400).json({ error: "Unknown plan." }); return; }

  try {
    const auth = Buffer.from(KEY + ":" + SECRET).toString("base64");
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Basic " + auth },
      body: JSON.stringify({
        amount: amount,
        currency: "INR",
        receipt: "aqx_" + Date.now(),
        notes: { plan: plan, email: String((body && body.email) || "") }
      })
    });
    const order = await r.json();
    if (!r.ok) { res.status(502).json({ error: order.error?.description || "Order failed." }); return; }
    res.status(200).json({ id: order.id, amount: order.amount, currency: order.currency });
  } catch (e) {
    res.status(500).json({ error: "Could not reach Razorpay." });
  }
};
