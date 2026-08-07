/* AQcredix — certificate renderer.
 *
 * Drawn directly on a 2D canvas rather than serialised from SVG, because SVG -> canvas
 * conversion drops web fonts unpredictably across browsers and a certificate set in
 * fallback fonts looks cheap. Canvas text uses whatever font actually resolved, so what
 * is previewed is what downloads.
 *
 * Output: 2400 x 1697 px (A4 landscape proportion at ~200dpi). Large enough for LinkedIn
 * without visible softness, small enough to attach to an email.
 *
 * Layout notes, since the arrangement is deliberate rather than decorative:
 *   - A single accent hairline and four corner brackets do the framing. Heavy ornate
 *     borders read as novelty-certificate; restraint reads as corporate.
 *   - The recipient's name is the largest thing on the page by a wide margin. Everything
 *     else is support.
 *   - A three-cell metric strip (score / assessment / date) sits under the body, because
 *     the facts a reader scans for should be findable without reading the sentence.
 *   - The countersignature sits bottom-right and the serial bottom-left, which is the
 *     conventional reading order for a signed document.
 *
 * MARK: change MARK to switch the logo concept. See drawMark().
 */
window.AQCert = (function () {
  "use strict";

  var MARK = "ring";           // "ring" | "seal" | "shield" | "ascent"

  var INK = "#0E2233";
  var INK_SOFT = "#5A6C7A";
  var ACCENT = "#17A2B8";
  var ACCENT_DEEP = "#0E6B7A";
  var PAPER = "#FFFFFF";
  var RULE = "#D8E0E6";
  var FAINT = "#8B99A4";

  var TAGLINE = "ACCREDITATION & QUALITY IMPLEMENTATION GUIDANCE PLATFORM";

  /* The countersignature. One person signs this platform's certificates; it is his
   * platform. Kept as data so the drawing code never has to guess. */
  var SIGNATORY = {
    name: "Dr Santhoshkumar SG",
    title: "Founder & Chief Quality Officer",
    image: "assets/signature.png"
  };

  /* Signature preload. render() is synchronous by design — the quiz draws the canvas and
   * reads it back in one turn — so the image is fetched at script load and render() uses
   * whatever has arrived. ready() lets a caller wait rather than race it. */
  var sigImg = null, sigReady = false;
  var sigPromise = new Promise(function (resolve) {
    try {
      var base = (document.body && document.body.getAttribute("data-base")) || "";
      var img = new Image();
      img.onload = function () { sigImg = img; sigReady = true; resolve(true); };
      // A missing signature file must not break certificate issuance. The block degrades
      // to a ruled line, which is what an unsigned original looks like anyway.
      img.onerror = function () { resolve(false); };
      img.src = base + SIGNATORY.image;
    } catch (e) { resolve(false); }
  });

  /* Serial number.
   * Deterministic from name + date, so the same person on the same day always
   * regenerates the identical serial. That makes a certificate checkable against a
   * re-run rather than being a random string. It is a checksum, not a security token —
   * see the note rendered on the certificate itself. */
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

  /* Letter-spaced text, drawn character by character. ctx.letterSpacing is unavailable on
   * older Safari, and the tagline is the most heavily tracked element on the page — losing
   * the tracking there would be immediately visible. */
  function tracked(ctx, text, x, y, track, align) {
    var chars = String(text).split("");
    var i, total = 0;
    for (i = 0; i < chars.length; i++) total += ctx.measureText(chars[i]).width + track;
    total -= track;
    var cur = align === "center" ? x - total / 2 : x;
    var prev = ctx.textAlign;
    ctx.textAlign = "left";
    for (i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cur, y);
      cur += ctx.measureText(chars[i]).width + track;
    }
    ctx.textAlign = prev;
    return total;
  }

  /* The mark. Four concepts, one active. Each draws inside a square box whose top-left is
   * (x, y), so swapping MARK changes nothing else. */
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
      ctx.textBaseline = "alphabetic";
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

  /* Faint diagonal security lattice. Deliberately subtle — it reads as texture at full
   * size and disappears at thumbnail size, which is what you want. */
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

  /* Corner brackets: four short L-rules set inside the frame. The detail that separates a
   * corporate document from a school award, at a fraction of an ornate border's weight. */
  function drawCorners(ctx, x, y, w, h, len) {
    ctx.save();
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 5;
    ctx.lineCap = "square";
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]
      .forEach(function (p) {
        ctx.beginPath();
        ctx.moveTo(p[0] + p[2] * len, p[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.lineTo(p[0], p[1] + p[3] * len);
        ctx.stroke();
      });
    ctx.restore();
  }

  /* A rule broken at its centre by a small rotated square. Used once, under the wordmark. */
  function drawDividerDiamond(ctx, cx, y, half) {
    ctx.save();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.lineTo(cx - 24, y);
    ctx.moveTo(cx + 24, y);
    ctx.lineTo(cx + half, y);
    ctx.stroke();
    ctx.fillStyle = ACCENT;
    ctx.translate(cx, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
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

  /* Three metric cells divided by hairlines. */
  function drawMetrics(ctx, cx, y, cells) {
    var cellW = 350;
    var x0 = cx - (cells.length * cellW) / 2;
    ctx.textAlign = "center";
    cells.forEach(function (c, i) {
      var cxx = x0 + i * cellW + cellW / 2;
      ctx.fillStyle = INK_SOFT;
      ctx.font = "400 20px Helvetica, Arial, sans-serif";
      tracked(ctx, c.label, cxx, y, 3.5, "center");
      ctx.fillStyle = INK;
      ctx.font = "500 38px Georgia, 'Times New Roman', serif";
      ctx.fillText(c.value, cxx, y + 54);
      if (i) {
        ctx.strokeStyle = RULE;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0 + i * cellW, y - 28);
        ctx.lineTo(x0 + i * cellW, y + 70);
        ctx.stroke();
      }
    });
  }

  /* Signature block: the ink if it loaded, then a hairline, the signatory's name and the
   * position beneath it. */
  function drawSignature(ctx, cx, ruleY) {
    var lineW = 470;

    if (sigReady && sigImg && sigImg.width) {
      var scale = Math.min(470 / sigImg.width, 180 / sigImg.height);
      var w = sigImg.width * scale, h = sigImg.height * scale;
      // Sit the ink on the rule the way a real signature does — slightly crossing it,
      // never floating above it in its own invisible box.
      ctx.drawImage(sigImg, cx - w / 2, ruleY - h + 26, w, h);
    }

    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - lineW / 2, ruleY);
    ctx.lineTo(cx + lineW / 2, ruleY);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "500 34px Georgia, 'Times New Roman', serif";
    ctx.fillText(SIGNATORY.name, cx, ruleY + 50);

    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 20px Helvetica, Arial, sans-serif";
    tracked(ctx, SIGNATORY.title.toUpperCase(), cx, ruleY + 88, 2.4, "center");

    ctx.fillStyle = FAINT;
    ctx.font = "400 19px Helvetica, Arial, sans-serif";
    ctx.fillText("AQcredix", cx, ruleY + 122);
  }

  /* Public: render(opts) -> { canvas, serial, issued, expires }
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

    /* Frame */
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 6;
    roundRect(ctx, 62, 62, W - 124, H - 124, 4);
    ctx.stroke();
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    roundRect(ctx, 88, 88, W - 176, H - 176, 3);
    ctx.stroke();
    drawCorners(ctx, 122, 122, W - 244, H - 244, 54);

    var cx = W / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    /* --- masthead --- */
    drawMark(ctx, cx - 72, 148, 144);

    ctx.fillStyle = INK;
    ctx.font = "500 60px Georgia, 'Times New Roman', serif";
    ctx.fillText("AQcredix", cx, 364);

    ctx.fillStyle = ACCENT_DEEP;
    ctx.font = "400 19px Helvetica, Arial, sans-serif";
    tracked(ctx, TAGLINE, cx, 404, 4, "center");

    drawDividerDiamond(ctx, cx, 452, 340);

    /* --- award --- */
    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 23px Helvetica, Arial, sans-serif";
    tracked(ctx, "THIS IS TO CERTIFY THAT", cx, 528, 4, "center");

    ctx.fillStyle = INK;
    ctx.font = "500 102px Georgia, 'Times New Roman', serif";
    var nm = (opts.name || "").trim() || "Participant";
    if (ctx.measureText(nm).width > W - 620) {
      ctx.font = "500 72px Georgia, 'Times New Roman', serif";
    }
    ctx.fillText(nm, cx, 646);

    /* Tapered underline: solid at the centre, vanishing at both ends. Reads as engraved
       rather than as a plain box rule. */
    var uw = 350;
    var g = ctx.createLinearGradient(cx - uw, 0, cx + uw, 0);
    g.addColorStop(0, "rgba(23,162,184,0)");
    g.addColorStop(0.5, ACCENT);
    g.addColorStop(1, "rgba(23,162,184,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - uw, 678, uw * 2, 4);

    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 28px Helvetica, Arial, sans-serif";
    var endY = wrapCentered(ctx,
      "has completed Today\u2019s Quiz for Quality Managers, a scenario-based assessment of " +
      "NABH standards, achieving a perfect score in",
      cx, 762, W - 620, 44);

    ctx.fillStyle = ACCENT_DEEP;
    ctx.font = "500 48px Georgia, 'Times New Roman', serif";
    ctx.fillText(opts.department, cx, endY + 62);

    /* --- metric strip --- */
    drawMetrics(ctx, cx, endY + 200, [
      { label: "SCORE", value: opts.score + " / " + opts.total },
      { label: "ASSESSMENT", value: "Scenario-based" },
      { label: "AWARDED", value: fmtDate(issued) }
    ]);

    /* --- footer --- */
    var fy = H - 430;
    ctx.strokeStyle = RULE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, fy);
    ctx.lineTo(W - 200, fy);
    ctx.stroke();

    /* Left: serial and validity. */
    ctx.textAlign = "left";
    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 19px Helvetica, Arial, sans-serif";
    tracked(ctx, "CERTIFICATE SERIAL", 200, fy + 56, 2.6, "left");
    ctx.fillStyle = INK;
    ctx.font = "500 31px 'Courier New', Courier, monospace";
    ctx.fillText(serial, 200, fy + 100);

    ctx.fillStyle = INK_SOFT;
    ctx.font = "400 19px Helvetica, Arial, sans-serif";
    tracked(ctx, "ISSUED " + fmtDate(issued).toUpperCase(), 200, fy + 158, 2.6, "left");
    ctx.fillStyle = INK;
    ctx.font = "400 27px Helvetica, Arial, sans-serif";
    ctx.fillText("Valid until " + fmtDate(expires), 200, fy + 200);

    /* Right: the countersignature. */
    drawSignature(ctx, W - 200 - 220, fy + 150);

    /* Honesty line. This stays. A certificate scored entirely in the participant's own
     * browser cannot claim to be invigilated, and printing that on the face of it is what
     * keeps the thing credible. */
    ctx.textAlign = "center";
    ctx.fillStyle = FAINT;
    ctx.font = "400 20px Helvetica, Arial, sans-serif";
    ctx.fillText(
      "Self-administered assessment completed on aqcredix. Recognises participation and performance; " +
      "not an invigilated examination or a licensing credential.",
      cx, H - 118);

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

  return {
    render: render,
    download: download,
    serialFor: serialFor,
    ready: function () { return sigPromise; },
    mark: MARK,
    signatory: SIGNATORY,
    tagline: TAGLINE
  };
})();
