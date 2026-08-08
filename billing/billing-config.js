/* AQcredix — billing configuration.
 *
 * This is the only file you edit to change pricing, payment details or who gets free
 * access. Nothing here is secret: it ships to the browser, so it must contain only public
 * values. The Razorpay KEY SECRET and the webhook secret belong in Vercel environment
 * variables and must never appear in this file or anywhere else in the repository.
 */
window.AQ_BILLING = {

  /* ---------------------------------------------------------------
     Free access. Matched on email, case-insensitive.
     Add co-founders or a demo account here. Everyone else pays.
     --------------------------------------------------------------- */
  ownerEmails: [
    "sgsanthoshkumar18@gmail.com"
  ],

  /* ---------------------------------------------------------------
     Prices, in PAISE (100 paise = ₹1).
     Integers only — money should never touch a floating-point number.

     Both are set to 100 (₹1) so you can test the whole flow end to end
     with a real payment for one rupee. Put the real prices in when the
     flow is proven; suggested figures are in BILLING-SETUP.md.
     --------------------------------------------------------------- */
  monthlyInr: 100,
  yearlyInr: 100,

  /* ---------------------------------------------------------------
     UPI — manual verification path.

     upiVpa is your UPI ID, not your phone number. For most Google Pay
     users on a mobile number it is <number>@okaxis, @oksbi, @okhdfcbank
     or @okicici depending on the bank behind the account.

     Find the exact one: Google Pay → tap your photo → Bank accounts →
     your account → "UPI IDs". Copy it character for character.

     A wrong VPA produces a QR that scans but fails at payment, which is
     a maddening thing to debug, so verify it by scanning your own QR
     with a different phone before you launch.
     --------------------------------------------------------------- */
  upiVpa: "9962679338@okaxis",
  upiName: "AQcredix",
  upiPhone: "9962679338",

  /* ---------------------------------------------------------------
     Razorpay — automatic verification path.

     Leave razorpayEnabled false until you have an account and the
     serverless functions are deployed. When false, the site uses the
     UPI + manual approval flow, which works without any of this.

     razorpayKeyId is public (it starts rzp_test_ or rzp_live_).
     The key SECRET goes in Vercel environment variables. Never here.
     --------------------------------------------------------------- */
  razorpayEnabled: false,
  razorpayKeyId: "",

  /* Support contact shown on the payment screen when something goes wrong. */
  supportEmail: "sgsanthoshkumar18@gmail.com"
};
