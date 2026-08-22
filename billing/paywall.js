/* AQcredix — paywall and access panel.
 *
 * Renders the subscribe screen when someone is signed in but not entitled, and the owner's
 * approval queue when they are.
 *
 * The QR is drawn locally rather than fetched from an image service. A remote QR generator
 * would mean handing your UPI ID to a third party on every page view, and it would break
 * the payment screen entirely if that service ever went down.
 */
window.AQPaywall = (function () {
  "use strict";

  var B = window.AQBilling;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* --------------------------- QR generation --------------------------- */

  /* A minimal byte-mode QR encoder. Only what a UPI intent string needs: byte mode,
   * error-correction level M, versions up to 10 — comfortably more than the ~120
   * characters a UPI URI runs to. Written out rather than pulled from a CDN so the payment
   * screen has no external dependency at the one moment it must not fail. */
  function qrMatrix(text) {
    var ECC_M = 0;
    // Capacity in bytes for versions 1..10 at ECC level M.
    var CAP = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
    var bytes = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) { bytes.push(192 | (c >> 6), 128 | (c & 63)); }
      else { bytes.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63)); }
    }
    var ver = 0;
    for (var v = 0; v < CAP.length; v++) if (bytes.length <= CAP[v]) { ver = v + 1; break; }
    if (!ver) return null;

    // Total codewords and EC codewords per block, versions 1..10, level M.
    var TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
    var ECPB = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
    var BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
    var total = TOTAL[ver - 1], ecpb = ECPB[ver - 1], nblocks = BLOCKS[ver - 1];
    var dataWords = total - ecpb * nblocks;

    // Bit stream: mode 0100 (byte), length, payload, terminator, pad.
    var bits = [];
    function push(val, len) { for (var b = len - 1; b >= 0; b--) bits.push((val >> b) & 1); }
    push(4, 4);
    push(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    var cap = dataWords * 8;
    for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var pads = [0xEC, 0x11], pi = 0;
    while (bits.length < cap) { push(pads[pi++ % 2], 8); }

    var data = [];
    for (var k = 0; k < bits.length; k += 8) {
      var byte = 0;
      for (var j = 0; j < 8; j++) byte = (byte << 1) | bits[k + j];
      data.push(byte);
    }

    // Galois field for Reed-Solomon.
    var EXP = new Array(512), LOG = new Array(256);
    for (var x = 0, e = 1; x < 255; x++) { EXP[x] = e; LOG[e] = x; e <<= 1; if (e & 256) e ^= 285; }
    for (var y = 255; y < 512; y++) EXP[y] = EXP[y - 255];
    function mul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }

    function rsGen(n) {
      var g = [1];
      for (var i2 = 0; i2 < n; i2++) {
        var ng = new Array(g.length + 1).fill(0);
        for (var j2 = 0; j2 < g.length; j2++) {
          ng[j2] ^= g[j2];
          ng[j2 + 1] ^= mul(g[j2], EXP[i2]);
        }
        g = ng;
      }
      return g;
    }
    function rsEnc(block, n) {
      var gen = rsGen(n), res = block.concat(new Array(n).fill(0));
      for (var i3 = 0; i3 < block.length; i3++) {
        var coef = res[i3];
        if (!coef) continue;
        for (var j3 = 0; j3 < gen.length; j3++) res[i3 + j3] ^= mul(gen[j3], coef);
      }
      return res.slice(block.length);
    }

    // Split into blocks, interleave data then EC.
    var shorter = Math.floor(dataWords / nblocks), longerCount = dataWords % nblocks;
    var dblocks = [], eblocks = [], off = 0;
    for (var bi = 0; bi < nblocks; bi++) {
      var len = shorter + (bi >= nblocks - longerCount ? 1 : 0);
      var blk = data.slice(off, off + len); off += len;
      dblocks.push(blk);
      eblocks.push(rsEnc(blk, ecpb));
    }
    var final = [];
    var maxLen = Math.max.apply(null, dblocks.map(function (b) { return b.length; }));
    for (var c2 = 0; c2 < maxLen; c2++) {
      dblocks.forEach(function (b) { if (c2 < b.length) final.push(b[c2]); });
    }
    for (var c3 = 0; c3 < ecpb; c3++) {
      eblocks.forEach(function (b) { final.push(b[c3]); });
    }

    // Build the module matrix.
    var size = ver * 4 + 17;
    var m = [], reserved = [];
    for (var r = 0; r < size; r++) {
      m.push(new Array(size).fill(0));
      reserved.push(new Array(size).fill(false));
    }
    function finder(cx, cy) {
      for (var dy = -1; dy <= 7; dy++) for (var dx = -1; dx <= 7; dx++) {
        var px = cx + dx, py = cy + dy;
        if (px < 0 || py < 0 || px >= size || py >= size) continue;
        var on = (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) ||
                 (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6)) ||
                 (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
        m[py][px] = on ? 1 : 0; reserved[py][px] = true;
      }
    }
    finder(0, 0); finder(size - 7, 0); finder(0, size - 7);

    for (var i4 = 8; i4 < size - 8; i4++) {
      var bit = i4 % 2 === 0 ? 1 : 0;
      if (!reserved[6][i4]) { m[6][i4] = bit; reserved[6][i4] = true; }
      if (!reserved[i4][6]) { m[i4][6] = bit; reserved[i4][6] = true; }
    }

    // Alignment patterns.
    var ALIGN = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
                 [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]][ver] || [];
    ALIGN.forEach(function (ay) {
      ALIGN.forEach(function (ax) {
        if (reserved[ay] && reserved[ay][ax]) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
          var px = ax + dx, py = ay + dy;
          if (px < 0 || py < 0 || px >= size || py >= size) continue;
          var on = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
          m[py][px] = on ? 1 : 0; reserved[py][px] = true;
        }
      });
    });

    // Reserve format areas.
    for (var f = 0; f < 9; f++) {
      if (f !== 6) { reserved[8][f] = true; reserved[f][8] = true; }
    }
    for (var f2 = 0; f2 < 8; f2++) {
      reserved[8][size - 1 - f2] = true;
      reserved[size - 1 - f2][8] = true;
    }
    reserved[size - 8][8] = true; m[size - 8][8] = 1;

    // Version information for versions >= 7.
    if (ver >= 7) {
      var vbits = ver << 12, gpoly = 0x1F25;
      for (var vb = 17; vb >= 12; vb--) if ((vbits >> vb) & 1) vbits ^= gpoly << (vb - 12);
      var vinfo = (ver << 12) | vbits;
      for (var vi = 0; vi < 18; vi++) {
        var vbit = (vinfo >> vi) & 1;
        var rr = Math.floor(vi / 3), cc = vi % 3;
        m[rr][size - 11 + cc] = vbit; reserved[rr][size - 11 + cc] = true;
        m[size - 11 + cc][rr] = vbit; reserved[size - 11 + cc][rr] = true;
      }
    }

    // Place data, zigzag from bottom-right, with mask 0.
    var bitIdx = 0, upward = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (var n = 0; n < size; n++) {
        var row = upward ? size - 1 - n : n;
        for (var s2 = 0; s2 < 2; s2++) {
          var cx2 = col - s2;
          if (reserved[row][cx2]) continue;
          var dbit = 0;
          if (bitIdx < final.length * 8) {
            dbit = (final[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
          }
          bitIdx++;
          if ((row + cx2) % 2 === 0) dbit ^= 1;   // mask pattern 0
          m[row][cx2] = dbit;
        }
      }
      upward = !upward;
    }

    // Format information: ECC M (0b00) with mask 0.
    var fmt = (ECC_M << 3) | 0;
    var rem = fmt;
    for (var fb = 4; fb >= 0; fb--) if ((rem >> (fb + 10)) & 1) rem ^= 0x537 << fb;
    var fbits = ((fmt << 10) | (rem & 0x3FF)) ^ 0x5412;
    for (var g2 = 0; g2 < 15; g2++) {
      var gb = (fbits >> g2) & 1;
      if (g2 < 6) m[g2][8] = gb;
      else if (g2 === 6) m[7][8] = gb;
      else if (g2 === 7) m[8][8] = gb;
      else if (g2 === 8) m[8][7] = gb;
      else m[8][14 - g2] = gb;

      if (g2 < 8) m[8][size - 1 - g2] = gb;
      else m[size - 15 + g2][8] = gb;
    }

    return m;
  }

  function qrSvg(text, px) {
    var m = qrMatrix(text);
    if (!m) return '<p class="pw-qrfail">The payment link is too long to encode as a QR.</p>';
    var n = m.length, quiet = 4, total = n + quiet * 2;
    var rects = "";
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        if (m[y][x]) {
          var w = 1;
          while (x + w < n && m[y][x + w]) w++;
          rects += '<rect x="' + (x + quiet) + '" y="' + (y + quiet) + '" width="' + w + '" height="1"/>';
          x += w;
        } else x++;
      }
    }
    return '<svg class="pw-qr" viewBox="0 0 ' + total + " " + total + '" width="' + px +
      '" height="' + px + '" role="img" aria-label="UPI payment QR code" ' +
      'xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
      '<rect width="' + total + '" height="' + total + '" fill="#fff"/>' +
      '<g fill="#0E2233">' + rects + "</g></svg>";
  }

  /* ------------------------------ paywall ------------------------------ */

  var selected = "yearly";
  var showingJustify = false;

  /* Written to be forwarded, not to be read here. Names the cost against what it displaces
     rather than listing features — the person approving it has never seen the product and
     does not care what modules exist. */
  function justifyText(plan) {
    var yearly = B.planOf("yearly");
    return "Subject: NABH accreditation software — approval request\n\n" +
      "I would like approval to subscribe to AQcredix, a platform for managing our NABH " +
      "accreditation work.\n\n" +
      "What it does\n" +
      "• Tracks every recurring obligation — committee meetings, drills, audits, " +
      "calibration, licence renewals — and shows what is overdue, by department.\n" +
      "• Holds our equipment and licence register with calibration certificates " +
      "attached to each item.\n" +
      "• Records rounds and audits with scores, and tracks findings through to " +
      "verified closure.\n" +
      "• Produces the evidence exports an assessor asks for, in one press.\n\n" +
      "Cost\n" +
      B.rupees(plan.inr) + " " + (plan.months > 1 ? "per year" : "per month") +
      " per person, for one account with access to every department and every " +
      "feature listed above.\n" +
      (B.CFG.introductory
        ? "This is an introductory rate. The standard price will be " +
          B.rupees(B.CFG.standardMonthlyInr || 399900) +
          " a month; subscribing now holds the current rate for as long as the " +
          "subscription runs without a break.\n"
        : "") + "\n" +
      "For comparison, a NABH consulting engagement typically runs into several lakhs, and " +
      "the standards guidebook alone is ₹6,000. This does not replace a consultant, but it " +
      "does replace the spreadsheets and reminders we currently maintain by hand, and it " +
      "keeps the evidence in one place between surveillance visits.\n\n" +
      "The main risk it addresses is a non-conformity raised for something that lapsed " +
      "because nobody was reminded — which is the most common category of finding.\n\n" +
      "Happy to walk you through it.\n";
  }

  function planCards() {
    return '<div class="pw-plans">' + B.PLANS.map(function (p) {
      var monthly = p.months > 1 ? Math.round(p.inr / p.months) : p.inr;
      return '<button type="button" class="pw-plan' + (selected === p.key ? " on" : "") +
        '" data-plan="' + p.key + '">' +
        '<span class="l">' + esc(p.label) + "</span>" +
        '<span class="p">' + B.rupees(p.inr) + "</span>" +
        '<span class="s">' + (p.months > 1 ? B.rupees(monthly) + " / month equivalent" : "per month") + "</span>" +
        '<span class="n">' + esc(p.note) + "</span></button>";
    }).join("") + "</div>";
  }

  function render(host, user, st) {
    var plan = B.planOf(selected);
    var h = '<div class="pw">';

    h += '<div class="pw-head">' +
      "<h2>Subscribe to the AQcredix workspace</h2>" +
      '<p class="pw-sub">The standards library, departments and tools stay free. ' +
      "The workspace — readiness scoring, internal audit, incidents, CAPA and documents " +
      "— needs an active subscription.</p></div>";

    if (st && st.reason === "expired") {
      h += '<div class="pw-note warn">Your subscription ended on ' +
        B.fmtDate(st.record && st.record.expires_at) +
        ". Your data is untouched and comes straight back when you renew.</div>";
    }
    if (st && st.reason === "pending") {
      h += '<div class="pw-note ok"><b>Payment submitted — awaiting confirmation.</b>' +
        "<p>Reference <code>" + esc(st.record.txn_ref || "—") + "</code>, submitted " +
        B.fmtDate(st.record.requested_at) + ". Each UPI payment is checked by hand against " +
        "the bank statement, so this is usually same-day rather than instant. You will not " +
        "need to pay again.</p></div>";
    }
    if (st && st.reason === "unavailable") {
      h += '<div class="pw-note bad"><b>Subscription status could not be checked.</b>' +
        "<p>Access is held rather than opened while this is unresolved. If you have an " +
        "active subscription, nothing has been lost — reload in a moment, or contact " +
        esc(B.CFG.supportEmail || "support") + ".</p>" +
        '<p class="pw-tech">' + esc(st.error || "") + "</p></div>";
    }

    /* Stated BEFORE the plans, not in small print under them. The whole point is that a
       later price rise should be something the subscriber was told about while deciding,
       and a notice they had to scroll past does not achieve that. */
    if (B.CFG.introductory) {
      h += '<div class="pw-intro">' +
        "<b>Introductory pricing</b>" +
        "<p>AQcredix is new. This is an introductory rate while we learn how hospitals " +
        "actually use it — the standard price will be " +
        B.rupees(B.CFG.standardMonthlyInr || 399900) + " a month. " +
        "<b>Subscribe now and you keep this rate for as long as your subscription runs " +
        "without a break.</b></p></div>";
    }

    h += planCards();

    /* THE PERSON READING THIS IS USUALLY NOT THE PERSON WHO PAYS.
       A quality manager will not put ₹3,999 a month on a personal card, and should not be
       asked to. What they need is something to forward to whoever signs off spending —
       so the paywall offers that instead of assuming the reader holds the budget. */
    h += '<div class="pw-justify">' +
      "<b>Not the person who approves spending?</b>" +
      "<p>Most quality managers are not. Send this to whoever signs off — it sets out " +
      "what the subscription covers and what it replaces.</p>" +
      '<button type="button" class="btn btn-ghost btn-sm" data-pw="justify">' +
      "Draft an email I can forward</button></div>";

    /* ONE PAYMENT PATH AT A TIME, AND RAZORPAY WINS WHEN IT IS AVAILABLE.
     *
     * Both used to render together, with the manual UPI claim first and Razorpay tacked
     * on below as "or". That was right when Razorpay was dormant and wrong the moment it
     * went live, because Razorpay ALREADY TAKES UPI — the customer can still pay from the
     * same app, the payment is verified in seconds, and access opens by itself.
     *
     * Leaving both up asked a hospital to choose between two ways to pay by UPI, one of
     * which needs them to hunt for a UTR, paste it, and then wait for a human to approve
     * it. Offering a worse version of the same thing beside the better one does not read
     * as flexibility; it reads as a payment page that is not sure of itself. And it made
     * the founder the bottleneck on every sale.
     *
     * The manual path is not deleted. It is the fallback, and it returns automatically
     * the moment razorpayEnabled goes false or the key is cleared — which is also the
     * kill switch if Razorpay is ever suspended or dropped. */
    if (B.razorpayReady()) {
      h += '<div class="pw-pay pw-pay-primary">' +
        "<h3>Pay " + B.rupees(plan.inr) + " — card, UPI or netbanking</h3>" +
        '<p class="pw-sub">Confirmed instantly. Your workspace opens the moment the ' +
        "payment succeeds — nothing to submit and nobody to wait for.</p>" +
        '<dl class="pw-dl">' +
        "<div><dt>Amount</dt><dd>" + B.rupees(plan.inr) + "</dd></div>" +
        "<div><dt>Plan</dt><dd>" + esc(plan.label) + " · " + plan.months + " month" +
          (plan.months > 1 ? "s" : "") + "</dd></div></dl>" +
        '<button type="button" class="btn btn-accent btn-lg" id="pwRzp">Pay ' +
        B.rupees(plan.inr) + " securely</button>" +
        /* #pwMsg must exist in BOTH branches: the Razorpay failure handler writes into it
           without checking, so dropping it here would turn a declined card into a crash. */
        '<div id="pwMsg"></div></div>';
    } else {

    /* UPI block */
    h += '<div class="pw-pay"><div class="pw-qrwrap">' +
      qrSvg(B.upiUri(selected), 210) +
      '<p class="pw-qrcap">Scan with any UPI app</p></div>' +
      '<div class="pw-payinfo">' +
      "<h3>Pay " + B.rupees(plan.inr) + " by UPI</h3>" +
      "<dl class=\"pw-dl\">" +
      "<div><dt>UPI ID</dt><dd><code>" + esc(B.CFG.upiVpa || "") + "</code></dd></div>" +
      "<div><dt>Amount</dt><dd>" + B.rupees(plan.inr) + "</dd></div>" +
      "<div><dt>Plan</dt><dd>" + esc(plan.label) + " · " + plan.months + " month" +
        (plan.months > 1 ? "s" : "") + "</dd></div></dl>" +
      '<p class="pw-hint">On a phone, <a href="' + esc(B.upiUri(selected)) +
      '">tap here to open your UPI app</a> with the amount already filled in.</p>' +
      "</div></div>";

    /* Claim form */
    h += '<div class="pw-claim"><h3>After paying, enter your UPI reference</h3>' +
      '<p class="pw-sub">Your UPI app shows a transaction ID or UTR once the payment ' +
      "succeeds — usually 12 digits. Paste it here so the payment can be matched " +
      "against the bank statement and your access switched on.</p>" +
      '<div class="pw-claimrow">' +
      '<input type="text" id="pwTxn" placeholder="UPI transaction ID / UTR" autocomplete="off">' +
      '<button type="button" class="btn btn-accent" id="pwSubmit">Submit for confirmation</button>' +
      "</div><div id=\"pwMsg\"></div></div>";

    }

    h += '<p class="pw-foot">Questions or a payment that has not been picked up: ' +
      '<a href="mailto:' + esc(B.CFG.supportEmail || "") + '">' +
      esc(B.CFG.supportEmail || "") + "</a></p></div>";

    host.innerHTML = h;

    var jb = host.querySelector('[data-pw="justify"]');
    if (jb) jb.addEventListener("click", function () {
      var box = host.querySelector(".pw-justify");
      if (!box) return;
      if (box.querySelector("textarea")) { showingJustify = false; render(); return; }
      showingJustify = true;
      var ta = document.createElement("textarea");
      ta.className = "pw-justify-text";
      ta.rows = 14;
      ta.readOnly = true;
      ta.value = justifyText(B.planOf(selected));
      box.appendChild(ta);

      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn btn-accent btn-sm";
      copy.textContent = "Copy to clipboard";
      copy.addEventListener("click", function () {
        ta.select();
        /* execCommand rather than the clipboard API: this runs inside a modal on hospital
           desktops that are often old, and a copy button that silently fails is worse than
           one that uses a deprecated call which still works everywhere. */
        try { document.execCommand("copy"); copy.textContent = "Copied ✓"; }
        catch (e) { copy.textContent = "Select the text and copy it"; }
        setTimeout(function () { copy.textContent = "Copy to clipboard"; }, 2200);
      });
      box.appendChild(copy);
      jb.textContent = "Hide";
      ta.focus();
    });

    host.querySelectorAll("[data-plan]").forEach(function (b) {
      b.addEventListener("click", function () {
        selected = b.getAttribute("data-plan");
        render(host, user, st);
      });
    });

    var sub = host.querySelector("#pwSubmit");
    if (sub) sub.addEventListener("click", async function () {
      var txn = (host.querySelector("#pwTxn").value || "").trim();
      var msg = host.querySelector("#pwMsg");
      if (txn.length < 6) {
        msg.innerHTML = '<div class="pw-note bad">Enter the transaction ID exactly as your ' +
          "UPI app shows it — it is usually 12 digits.</div>";
        return;
      }
      sub.disabled = true; sub.textContent = "Submitting…";
      try {
        await B.submitClaim(user, selected, txn, "");
        msg.innerHTML = '<div class="pw-note ok"><b>Submitted.</b> Your payment will be ' +
          "matched against the bank statement and access switched on, usually the same day. " +
          "You do not need to pay again.</div>";
      } catch (e) {
        sub.disabled = false; sub.textContent = "Submit for confirmation";
        msg.innerHTML = '<div class="pw-note bad">Could not submit: ' + esc(e.message || e) +
          "</div>";
      }
    });

    var rz = host.querySelector("#pwRzp");
    if (rz) rz.addEventListener("click", function () {
      rz.disabled = true;
      B.payWithRazorpay(user, selected,
        function () { location.reload(); },
        function (err) {
          rz.disabled = false;
          host.querySelector("#pwMsg").innerHTML =
            '<div class="pw-note bad">' + esc(err.message || err) + "</div>";
        });
    });
  }

  /* --------------------------- owner panel ---------------------------- */

  /* What the DATABASE thinks of this session, which is the only opinion that decides
     whether an approval is allowed to land. The browser has its own owner check in
     billing-config.js, and when the two lists disagree the panel renders Approve buttons
     that row-level security then silently refuses — the row stays pending and the owner
     clicks in a loop with nothing on screen to explain it. This strip makes the
     disagreement visible. Do not remove it: the Supabase SQL editor cannot answer this
     question, because it carries no JWT and so always reports "not owner". */
  async function ownerDiagnostics() {
    try {
      // AQStore owns the adapter. AQWorkspace is the page shell (nav, gate) and has no
      // data layer on it — reaching for .adapter there throws before any query is made.
      var store = window.AQStore;
      if (!store || !store.adapter || !store.adapter.rpc) return "";
      var w = await store.adapter.rpc("aq_whoami");
      if (!w) return "";                                  // local mode: no server opinion
      if (w.is_owner) {
        return '<details class="pw-note"><summary>Database recognises you as owner ' +
          "— approvals will save.</summary><p class=\"pw-tech\">" +
          esc(w.resolved_email || "") + " → " + esc(w.normalised || "") +
          "</p></details>";
      }
      return '<div class="pw-note bad"><b>The database does not recognise you as an owner.</b>' +
        "<p>Approvals will be refused until this is fixed. Your browser thinks you are the " +
        "owner (that is why this panel opened), but row-level security disagrees, so every " +
        "write is rejected.</p><p>The database sees your address as <code>" +
        esc(w.resolved_email || "(none)") + "</code>, normalised to <code>" +
        esc(w.normalised || "(none)") + "</code>. Add that exact normalised address to the " +
        "owner list by running this in the Supabase SQL editor:</p>" +
        "<p><code>insert into public.aq_owners (email_norm) values ('" +
        esc(w.normalised || "") + "') on conflict do nothing;</code></p></div>";
    } catch (e) {
      // aq_whoami() missing means schema.sql predates it. Say so rather than failing.
      return '<div class="pw-note warn"><b>Could not check owner status with the database.</b>' +
        "<p>Re-run <code>workspace/schema.sql</code> in Supabase to install the " +
        "<code>aq_whoami()</code> diagnostic.</p><p class=\"pw-tech\">" +
        esc(String(e && e.message || e)) + "</p></div>";
    }
  }

  async function renderAdmin(host, user) {
    var rows = await B.list();
    var diag = await ownerDiagnostics();
    var pending = rows.filter(function (r) { return r.status === "pending"; });

    var h = '<div class="pw-admin"><h2>Access &amp; subscriptions</h2>' + diag +
      '<div id="pwAdminMsg"></div>' +
      '<p class="pw-sub">Every UPI payment is a claim until you match it against your bank ' +
      "statement. Approve only what you can actually see credited — a transaction ID " +
      "typed into a box is not proof that money arrived.</p>";

    if (!rows.length) {
      h += '<p class="pw-sub">No subscription requests yet.</p></div>';
      host.innerHTML = h;
      return;
    }

    if (pending.length) {
      h += "<h3>Awaiting your approval (" + pending.length + ")</h3>" +
        '<div class="pw-tablewrap"><table class="pw-table"><thead><tr>' +
        "<th>User</th><th>Plan</th><th>Amount</th><th>UPI reference</th><th>Requested</th><th></th>" +
        "</tr></thead><tbody>" +
        pending.map(function (r) {
          return "<tr><td>" + esc(r.name || r.email) + "<br><small>" + esc(r.email) + "</small></td>" +
            "<td>" + esc((B.planOf(r.plan) || {}).label || r.plan) + "</td>" +
            "<td>" + B.rupees(r.amount_paise || 0) + "</td>" +
            "<td><code>" + esc(r.txn_ref || "—") + "</code></td>" +
            "<td>" + B.fmtDate(r.requested_at) + "</td>" +
            '<td class="pw-acts">' +
            '<button type="button" class="btn btn-accent btn-sm" data-ok="' + esc(r.id) + '">Approve</button> ' +
            '<button type="button" class="btn btn-ghost btn-sm" data-no="' + esc(r.id) + '">Reject</button>' +
            "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    var others = rows.filter(function (r) { return r.status !== "pending"; });
    if (others.length) {
      h += "<h3>All subscriptions</h3>" +
        '<div class="pw-tablewrap"><table class="pw-table"><thead><tr>' +
        "<th>User</th><th>Plan</th><th>Status</th><th>Expires</th><th>Approved by</th>" +
        "</tr></thead><tbody>" +
        others.map(function (r) {
          var live = r.status === "active" && r.expires_at &&
            new Date(r.expires_at) > new Date();
          return "<tr><td>" + esc(r.name || r.email) + "</td>" +
            "<td>" + esc((B.planOf(r.plan) || {}).label || r.plan) + "</td>" +
            '<td><span class="pw-badge ' + (live ? "ok" : r.status === "rejected" ? "bad" : "warn") +
              '">' + (live ? "Active" : r.status === "active" ? "Expired" : esc(r.status)) + "</span></td>" +
            "<td>" + B.fmtDate(r.expires_at) + "</td>" +
            "<td>" + esc(r.approved_by || "—") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    h += "</div>";
    host.innerHTML = h;

    /* Both handlers verify the write actually landed rather than assuming it did.
       An earlier version awaited the save and re-rendered regardless; when row-level
       security silently refused the update, the row simply reappeared as pending and the
       owner was left clicking Approve in a loop with nothing on screen to explain why.
       A write that cannot be confirmed must say so. */
    async function act(rec, fn, verb) {
      var msg = host.querySelector("#pwAdminMsg");
      try {
        await fn();
        var after = await B.list();
        var now = after.filter(function (r) { return r.id === rec.id; })[0];
        if (!now || now.status === "pending") {
          msg.innerHTML = '<div class="pw-note bad"><b>The ' + verb + " did not save.</b>" +
            "<p>The database accepted the request but the row is still pending, which " +
            "normally means a row-level security policy refused the write. Re-run " +
            "<code>workspace/schema.sql</code> in Supabase and try again.</p></div>";
          // The table can be long enough to push this note off-screen, which reads as
          // "nothing happened" — the exact confusion this message exists to end.
          msg.scrollIntoView({ behavior: "smooth", block: "center" });
          return false;
        }
        msg.innerHTML = "";
        return true;
      } catch (e) {
        msg.innerHTML = '<div class="pw-note bad"><b>The ' + verb + " failed.</b>" +
          '<p class="pw-tech">' + esc(String(e && e.message || e)) + "</p></div>";
        msg.scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
      }
    }

    host.querySelectorAll("[data-ok]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var rec = rows.filter(function (r) { return r.id === b.getAttribute("data-ok"); })[0];
        if (!confirm("Approve " + (rec.email || "this user") + "?\n\nConfirm the payment is " +
          "actually credited in your bank or GPay statement first.")) return;
        b.disabled = true;
        var ok = await act(rec, function () { return B.approve(rec, user); }, "approval");
        if (ok) renderAdmin(host, user); else b.disabled = false;
      });
    });
    host.querySelectorAll("[data-no]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var rec = rows.filter(function (r) { return r.id === b.getAttribute("data-no"); })[0];
        var why = prompt("Reason for rejecting (shown in the record):", "Payment not found");
        if (why === null) return;
        b.disabled = true;
        var ok = await act(rec, function () { return B.reject(rec, user, why); }, "rejection");
        if (ok) renderAdmin(host, user); else b.disabled = false;
      });
    });
  }

  return { render: render, renderAdmin: renderAdmin, qrSvg: qrSvg, qrMatrix: qrMatrix };
})();
