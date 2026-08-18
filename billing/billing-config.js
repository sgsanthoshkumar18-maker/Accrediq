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
    "mavissneha@gmail.com"
  ],

  /* ---------------------------------------------------------------
     Prices, in PAISE (100 paise = ₹1).
     Integers only — money should never touch a floating-point number.

     ONE PRICE, NOT TIERS. Tiering by bed count was considered and dropped:
     a hospital declares its own bed count, nothing here can verify it, so a
     300-bed hospital could simply select the small tier. A tier that cannot
     be enforced does not price by size — it just charges the honest ones
     more, which is the wrong incentive to build into a compliance product.

     If segmentation is wanted later, tier on something the platform can
     actually see (departments configured, accounts in use), never on
     something the customer asserts about itself.

     INTRODUCTORY PRICING: ₹500/month, ₹5,000/year (the year at ten months).

     Deliberately below what the platform is worth, to find out whether
     hospitals use it before finding out what they will pay. That is a
     reasonable trade, but it has one real cost: raising a price on someone
     who signed up early feels like a betrayal unless they were told at the
     time. So the paywall states plainly that this is an introductory rate
     and that early subscribers keep it — which makes a later increase a
     plan that was announced, not a change of mind.

     `introductory: true` is what drives that wording. Set it to false when
     the price moves to the standard rate below, and the notice disappears
     on its own rather than becoming a lie left on the page.
     --------------------------------------------------------------- */
  monthlyInr: 50000,
  yearlyInr: 500000,

  introductory: true,

  /* ---------------------------------------------------------------
     FREE TRIAL LENGTH, in days. Change this one number to adjust it.

     Set to 7. The worry that a longer trial lets people "use it and not
     subscribe" is understandable but points the wrong way: nobody runs a
     hospital's compliance calendar for a week and then rebuilds it in a
     spreadsheet. The risk is the opposite one — a trial too short to reach
     the moment the product becomes useful, which for this product is
     entering committees and seeing the calendar compute real dates.

     There is also a hard floor. RBI requires a pre-debit notice at least
     24 hours before any charge, and we send at 48. On a 3-day trial that
     notice lands on day one, so the customer is warned about payment
     before they have done anything — which reads worse than no trial.
     5 days is the practical minimum; 7 gives a working week.
     --------------------------------------------------------------- */
  trialDays: 7,

  /* What the price is expected to become. Shown next to the current price so
     the discount is concrete rather than a claim, and so nobody can say they
     were not told. */
  standardMonthlyInr: 399900,

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
