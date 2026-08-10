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

     Gmail ignores dots in the local part, so s.g.name@gmail.com and
     sgname@gmail.com are the same mailbox. isOwner() normalises that,
     so either spelling works and you cannot lock yourself out by
     signing in with the dotted form of your own address.
     --------------------------------------------------------------- */
  ownerEmails: [
    "s.g.santhoshkumar18@gmail.com"
  ],

  /* ---------------------------------------------------------------
     COMPLIMENTARY ACCESS — lifetime, no payment.

     These accounts get everything a paying subscriber gets and are
     never shown the payment page. They are NOT owners: no Access
     panel, no approving other people's payments, no palette control.
     Ownership stays with ownerEmails above and nowhere else.

     Use this for pilot hospitals, a reference customer, or anyone you
     have promised free access to. Adding an address here is the whole
     job — nothing else needs changing.

     The same list must also be present in workspace/schema.sql, in
     aq_is_comp(). This copy decides what the browser DISPLAYS; the SQL
     copy decides what the database will actually hand over. The second
     one is the one that matters — keep them in step.

     Dots and +tags in Gmail addresses are normalised, so any spelling
     of the same mailbox works.
     --------------------------------------------------------------- */
  complimentaryEmails: [
    "mavisneha@gmail.com"
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

     upiVpa is your UPI ID, not your phone number. Google Pay issues a
     handle per linked bank — the suffix (@oksbi, @okhdfcbank, @okicici,
     @okaxis) identifies the bank, and the local part is not necessarily
     your mobile number.

     Find the exact one: Google Pay → tap your photo → Bank accounts →
     your account → "UPI IDs". Copy it character for character.

     A wrong VPA produces a QR that scans but fails at payment, which is
     a maddening thing to debug, so verify it by scanning your own QR
     with a different phone before you launch.
     --------------------------------------------------------------- */
  upiVpa: "s.g.santhoshkumar18-1@oksbi",
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
  supportEmail: "s.g.santhoshkumar18@gmail.com"
};
