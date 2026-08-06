/* AQcredix — certificate renderer.
 *
 * Draws directly on a 2D canvas rather than serialising an SVG, because
 * SVG -> canvas conversion drops web fonts unpredictably across browsers and
 * a certificate with fallback fonts looks cheap. Canvas text is drawn with
 * whatever font is actually resolved, so what you see is what downloads.
 *
 * Output: 2400 x 1697 px (A4 landscape proportion at ~200dpi). Big enough for
 * LinkedIn without visible softness, small enough to attach to an email.
 *
 * MARK: change AQ_CERT_MARK to switch the logo concept. See drawMark().
 */
window.AQCert = (function () {
  "use strict";

  var MARK = "ring";           // "ring" | "seal" | "shield" | "ascent"
  var INK = "#0E2233";
  var INK_SOFT = "#5A6C7A";
  var ACCENT = "#17A2B8";
  var PAPER = "#FFFFFF";
  var RULE = "#D8E0E6";

  /* Serial number.
   * Deterministic from name + date, so the same person on the same day always
   * regenerates the identical serial. That makes a certificate checkable
   * against a re-run rather than being a random string. It is a checksum, not
   * a security token — see the note rendered on the certificate itself. */
  function serialFor(name, dateISO) {
    var basis = (name || "").trim().toUpperCase().replace(/\s+/g, " ") + "|" + dateISO;
    var h = 0x811c9dc5;
    for (var i = 0; i < basis.length; i++) {
      h ^= basis.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    var alphabet = "ACDEFGHJKLMNPQRTUVWXY3479";
    var out = "";
    var v = h;
    for (var k = 0; k < 6; k++) {
      out += alphabet.charAt(v % alphabet.length);
      v = Math.floor(v / alphabet.length) + 7;
    }
    return "AQX-" + dateISO.replace(/-/g, "") + "-" + out;
  }

  function fmtDate(d) {
    var months = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* The mark. Four concepts, one active. Each draws inside a 200x200 box
   * whose top-left is (x, y), so swapping MARK changes nothing else. */
  function drawMark(ctx, x, y, s) {
    var cx = x + s / 2, cy = y + s / 2;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (MARK === "ring") {
      var r = s * 0.42;
      ctx.strokeStyle = RULE;
      ctx.lineWidth = s * 0.075;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = ACCENT;
      ctx.font = "500 " + Math.round(s * 0.42) + "px Georgia, 'Times New Roman', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("A", cx, cy + s * 0.02);
    } else if (MARK === "seal") {
      var R = s * 0.44;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      for (var i = 0; i < 6; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 3;
        var px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = s * 0.085;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.16, cy);
      ctx.lineTo(cx - s * 0.04, cy + s * 0.13);
      ctx.lineTo(cx + s * 0.18, cy - s * 0.13);
      ctx.stroke();
    } else if (MARK === "shield") {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = s * 0.055;
      ctx.beginPath();
      ctx.moveTo(cx, y + s * 0.06);
      ctx.lineTo(x + s * 0.9, y + s * 0.22);
      ctx.lineTo(x + s * 0.9, y + s * 0.58);
      ctx.quadraticCurveTo(x + s * 0.9, y + s * 0.82, cx, y + s * 0.95);
      ctx.quadraticCurveTo(x + s * 0.1, y + s * 0.82, x + s * 0.1, y + s * 0.58);
      ctx.lineTo(x + s * 0.1, y + s * 0.22);
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.22, cy);
      ctx.lineTo(x + s * 0.36, cy);
      ctx.lineTo(x + s * 0.43, cy - s * 0.14);
      ctx.lineTo(x + s * 0.55, cy + s * 0.16);
      ctx.lineTo(x + s * 0.62, cy);
      ctx.lineTo(x + s * 0.8, cy);
      ctx.stroke();
    } else {
      var bw = s * 0.13, base = y + s * 0.88;
      var hs = [0.26, 0.44, 0.62, 0.86];
      for (var b = 0; b < 4; b++) {
        ctx.fillStyle = b < 2 ? RULE : ACCENT;
        roundRect(ctx, x + s * 0.14 + b * (bw + s * 0.07), base - s * hs[b], bw, s * hs[b], s * 0.025);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Faint diagonal security lattice. Deliberately subtle — it reads as texture
   * at full size and disappears at thumbnail size, which is what you want. */
  function drawLattice(ctx, W, H) {
    ctx.save();
    ctx.strokeStyle = "rgba(23,162,184,0.045)";
    ctx.lineWidth = 1.5;
    for (var i = -H; i < W; i += 26) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + H, H);
      ctx.stroke();
    }
    ctx.restore();
  }

  function wrapCentered(ctx, text, cx, y, maxW, lineH) {
    var words = String(text).split(" "), line = "", lines = [];
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
      } else line = test;
    }
    if (line) lines.push(line);
    for (var k = 0; k < lines.length; k++) ctx.fillText(lines[k], cx, y + k * lineH);
    return y + lines.length * lineH;
  }

  /* Public: render(opts) -> canvas
   * opts = { name, department, dateISO, score, total } */
  function render(opts) {
    var W = 2400, H = 1697;
    var c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    var ctx = c.getContext("2d");

    var issued = new Date(opts.dateISO + "T00:00:00");
    var expires = new Date(issued.getTime());
    expires.setFullYear(expires.getFullYear() + 1);
    var serial = serialFor(opts.name, opts.dateISO);

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    drawLattice(ctx, W, H);

    /* Border: a heavy accent hairline inset, plus a thin inner rule. */
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 10;
    roundRect(ctx, 70, 70, W - 140, H - 140, 8);
    ctx.stroke();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    roundRect(ctx, 100, 100, W - 200, H - 200, 4);
    ctx.stroke();

    var cx = W / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    drawMark(ctx, cx - 90, 175, 180);

    ctx.fillStyle = INK;
    ctx.font = "500 62px Georgia, 'Times New Roman', serif";
    ctx.fillText("AQcredix", cx, 425);

    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 25px Helvetica, Arial, sans-serif";
    ctx.letterSpacing && (ctx.letterSpacing = "6px");
    ctx.fillText("N A B H   R E A D I N E S S   P L A T F O R M", cx, 470);
    ctx.letterSpacing && (ctx.letterSpacing = "0px");

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 380, 520);
    ctx.lineTo(cx + 380, 520);
    ctx.stroke();

    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 30px Helvetica, Arial, sans-serif";
    ctx.fillText("This certifies that", cx, 605);

    ctx.fillStyle = INK;
    ctx.font = "500 96px Georgia, 'Times New Roman', serif";
    var nm = (opts.name || "").trim() || "Participant";
    if (ctx.measureText(nm).width > W - 500) ctx.font = "500 68px Georgia, 'Times New Roman', serif";
    ctx.fillText(nm, cx, 720);

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 300, 758);
    ctx.lineTo(cx + 300, 758);
    ctx.stroke();

    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 31px Helvetica, Arial, sans-serif";
    var endY = wrapCentered(ctx,
      "achieved a perfect score of " + opts.score + " out of " + opts.total +
      " in Today's Quiz for Quality Managers, a scenario-based assessment in",
      cx, 830, W - 700, 48);

    ctx.fillStyle = INK;
    ctx.font = "500 46px Georgia, 'Times New Roman', serif";
    ctx.fillText(opts.department, cx, endY + 62);

    ctx.fillStyle = ACCENT;
    ctx.font = "500 27px Helvetica, Arial, sans-serif";
    ctx.fillText("W I N N E R   \u00B7   " + fmtDate(issued).toUpperCase(), cx, endY + 130);

    /* Footer band: serial left, validity right, both small and quiet. */
    var fy = H - 300;
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, fy);
    ctx.lineTo(W - 180, fy);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 22px Helvetica, Arial, sans-serif";
    ctx.fillText("CERTIFICATE SERIAL", 180, fy + 52);
    ctx.fillStyle = INK;
    ctx.font = "500 32px 'Courier New', Courier, monospace";
    ctx.fillText(serial, 180, fy + 98);

    ctx.textAlign = "right";
    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 22px Helvetica, Arial, sans-serif";
    ctx.fillText("ISSUED " + fmtDate(issued).toUpperCase(), W - 180, fy + 52);
    ctx.fillStyle = INK;
    ctx.font = "500 32px Helvetica, Arial, sans-serif";
    ctx.fillText("Valid until " + fmtDate(expires), W - 180, fy + 98);

    /* Honesty line. This stays. A certificate scored entirely in the
     * participant's own browser cannot claim to be invigilated, and printing
     * that on the face of it is what keeps the thing credible. */
    ctx.textAlign = "center";
    ctx.fillStyle = "#8B99A4";
    ctx.font = "400 21px Helvetica, Arial, sans-serif";
    ctx.fillText(
      "Self-administered assessment completed on aqcredix. Recognises participation and performance; not an invigilated examination or a licensing credential.",
      cx, H - 150);

    return { canvas: c, serial: serial, issued: issued, expires: expires };
  }

  function download(result, name) {
    try {
      var a = document.createElement("a");
      a.download = "AQcredix-Certificate-" + result.serial + ".png";
      a.href = result.canvas.toDataURL("image/png");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return true;
    } catch (e) {
      return false;
    }
  }

  return { render: render, download: download, serialFor: serialFor, mark: MARK };
})();
