/* AQcredix — create a Razorpay order.
 *
 * Dormant until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in Vercel's environment
 * variables. Until then the site uses the UPI + manual approval path, which needs none of
 * this.
 *
 * The amount is taken from the server's own price table, never from the request body.
 * Trusting a client-supplied amount is how people buy a year's access for one rupee.
 */
const PRICES = {
  monthly: Number(process.env.PRICE_MONTHLY_PAISE || 100),
  yearly:  Number(process.env.PRICE_YEARLY_PAISE  || 100)
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
