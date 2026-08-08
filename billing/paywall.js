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
      "The workspace \u2014 readiness scoring, internal audit, incidents, CAPA and documents " +
      "\u2014 needs an active subscription.</p></div>";

    if (st && st.reason === "expired") {
      h += '<div class="pw-note warn">Your subscription ended on ' +
        B.fmtDate(st.record && st.record.expires_at) +
        ". Your data is untouched and comes straight back when you renew.</div>";
    }
    if (st && st.reason === "pending") {
      h += '<div class="pw-note ok"><b>Payment submitted \u2014 awaiting confirmation.</b>' +
        "<p>Reference <code>" + esc(st.record.txn_ref || "\u2014") + "</code>, submitted " +
        B.fmtDate(st.record.requested_at) + ". Each UPI payment is checked by hand against " +
        "the bank statement, so this is usually same-day rather than instant. You will not " +
        "need to pay again.</p></div>";
    }
    if (st && st.reason === "unavailable") {
      h += '<div class="pw-note bad"><b>Subscription status could not be checked.</b>' +
        "<p>Access is held rather than opened while this is unresolved. If you have an " +
        "active subscription, nothing has been lost \u2014 reload in a moment, or contact " +
        esc(B.CFG.supportEmail || "support") + ".</p>" +
        '<p class="pw-tech">' + esc(st.error || "") + "</p></div>";
    }

    h += planCards();

    /* UPI block */
    h += '<div class="pw-pay"><div class="pw-qrwrap">' +
      qrSvg(B.upiUri(selected), 210) +
      '<p class="pw-qrcap">Scan with any UPI app</p></div>' +
      '<div class="pw-payinfo">' +
      "<h3>Pay " + B.rupees(plan.inr) + " by UPI</h3>" +
      "<dl class=\"pw-dl\">" +
      "<div><dt>UPI ID</dt><dd><code>" + esc(B.CFG.upiVpa || "") + "</code></dd></div>" +
      "<div><dt>Amount</dt><dd>" + B.rupees(plan.inr) + "</dd></div>" +
      "<div><dt>Plan</dt><dd>" + esc(plan.label) + " \u00B7 " + plan.months + " month" +
        (plan.months > 1 ? "s" : "") + "</dd></div></dl>" +
      '<p class="pw-hint">On a phone, <a href="' + esc(B.upiUri(selected)) +
      '">tap here to open your UPI app</a> with the amount already filled in.</p>' +
      "</div></div>";

    /* Claim form */
    h += '<div class="pw-claim"><h3>After paying, enter your UPI reference</h3>' +
      '<p class="pw-sub">Your UPI app shows a transaction ID or UTR once the payment ' +
      "succeeds \u2014 usually 12 digits. Paste it here so the payment can be matched " +
      "against the bank statement and your access switched on.</p>" +
      '<div class="pw-claimrow">' +
      '<input type="text" id="pwTxn" placeholder="UPI transaction ID / UTR" autocomplete="off">' +
      '<button type="button" class="btn btn-accent" id="pwSubmit">Submit for confirmation</button>' +
      "</div><div id=\"pwMsg\"></div></div>";

    if (B.razorpayReady()) {
      h += '<div class="pw-alt"><h3>Or pay by card, netbanking or UPI, confirmed instantly</h3>' +
        '<button type="button" class="btn btn-accent" id="pwRzp">Pay ' + B.rupees(plan.inr) +
        " securely</button></div>";
    }

    h += '<p class="pw-foot">Questions or a payment that has not been picked up: ' +
      '<a href="mailto:' + esc(B.CFG.supportEmail || "") + '">' +
      esc(B.CFG.supportEmail || "") + "</a></p></div>";

    host.innerHTML = h;

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
          "UPI app shows it \u2014 it is usually 12 digits.</div>";
        return;
      }
      sub.disabled = true; sub.textContent = "Submitting\u2026";
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

  async function renderAdmin(host, user) {
    var rows = await B.list();
    var pending = rows.filter(function (r) { return r.status === "pending"; });

    var h = '<div class="pw-admin"><h2>Access &amp; subscriptions</h2>' +
      '<p class="pw-sub">Every UPI payment is a claim until you match it against your bank ' +
      "statement. Approve only what you can actually see credited \u2014 a transaction ID " +
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
            "<td><code>" + esc(r.txn_ref || "\u2014") + "</code></td>" +
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
            "<td>" + esc(r.approved_by || "\u2014") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }

    h += "</div>";
    host.innerHTML = h;

    host.querySelectorAll("[data-ok]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var rec = rows.filter(function (r) { return r.id === b.getAttribute("data-ok"); })[0];
        if (!confirm("Approve " + (rec.email || "this user") + "?\n\nConfirm the payment is " +
          "actually credited in your bank or GPay statement first.")) return;
        await B.approve(rec, user);
        renderAdmin(host, user);
      });
    });
    host.querySelectorAll("[data-no]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var rec = rows.filter(function (r) { return r.id === b.getAttribute("data-no"); })[0];
        var why = prompt("Reason for rejecting (shown in the record):", "Payment not found");
        if (why === null) return;
        await B.reject(rec, user, why);
        renderAdmin(host, user);
      });
    });
  }

  return { render: render, renderAdmin: renderAdmin, qrSvg: qrSvg, qrMatrix: qrMatrix };
})();
