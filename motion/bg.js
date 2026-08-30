/* AQcredix — page background motion.
 *
 * One module, three effects, chosen by data-bg on <body>:
 *     vortex  home            particles on a flow field, cursor swirls them
 *     cells   standards       a drifting Voronoi cell field
 *     signal  dashboard       nodes that link when they meet, cursor pushes them apart
 *
 * NO DEPENDENCIES, DELIBERATELY. The cells effect is the one people reach for Vanta to get,
 * and Vanta needs three.js r134 plus vanta.cells.min.js — roughly 600KB to draw a pattern,
 * pinned to a three.js version this site does not otherwise use. Rebuilt here in 2D canvas
 * at a fraction of the weight, and with the colours read from the theme rather than passed
 * in as fixed hex, so it follows light and dark without being told twice.
 *
 * IT SITS BEHIND EVERYTHING AND CATCHES NOTHING. The canvas is fixed, z-index -1 and
 * pointer-events:none; the pointer is tracked on the window, so no element on the page ever
 * loses a click or a scroll to it. That matters after the globe, which swallowed the wheel.
 */
(function () {
  "use strict";

  var body = document.body;
  var KIND = (body && body.dataset && body.dataset.bg) || "";
  if (!KIND) return;

  var REDUCED = false;
  try { REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var root = document.documentElement;
  function tok(n, f) {
    try { var v = getComputedStyle(root).getPropertyValue(n).trim(); return v || f; }
    catch (e) { return f; }
  }
  function isDark() { return tok("--bg", "#000000").toUpperCase() !== "#FFFFFF"; }

  var cv = document.createElement("canvas");
  cv.className = "aq-bg";
  cv.setAttribute("aria-hidden", "true");
  body.insertBefore(cv, body.firstChild);

  var m = { x: 0, y: 0, has: false };
  window.addEventListener("pointermove", function (e) {
    m.x = e.clientX; m.y = e.clientY; m.has = true;
  }, { passive: true });
  window.addEventListener("pointerleave", function () { m.has = false; });

  var W = 0, H = 0, DPR = 1, ctx = cv.getContext("2d");
  function size() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    if (W === w && H === h) return false;
    W = w; H = h;
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
    cv.style.width = w + "px"; cv.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return true;
  }
  size();

  /* ---------------- vortex ---------------- */
  var vp = [], vFresh = true;   /* vFresh is kept for size changes; there is no trail now */
  for (var i = 0; i < 380; i++) vp.push({ x: 0, y: 0, life: 0, max: 0, seed: Math.random() });
  function vortex(t) {
    /* Clear, do not wash. A translucent wash leaves a tail behind every particle, and a few
       hundred tails on black accumulate into grey smoke — which is exactly what the trails
       version produced. Dots only. */
    ctx.clearRect(0, 0, W, H);
    var dark = isDark();
    /* One colour, from the theme. No hue sweep: a rainbow fights a two-colour palette. */
    var col = dark ? "108,140,255" : "39,67,201";
    for (var i = 0; i < vp.length; i++) {
      var p = vp[i];
      if (p.life <= 0) {
        p.x = Math.random() * W; p.y = Math.random() * H;
        p.max = 260 + Math.random() * 320; p.life = p.max; p.seed = Math.random();
      }
      var a = Math.sin(p.x * 0.0042 + t * 0.00012) * Math.cos(p.y * 0.0051 - t * 0.00009)
            + Math.sin((p.x + p.y) * 0.0026 + t * 0.00016);
      var ang = a * Math.PI;
      /* SPEED. Was 1.45px per frame plus a 2.6 swirl — fast enough to pull the eye off the
         copy, which was the complaint. Roughly half that now: present, not distracting. */
      var vx = Math.cos(ang) * 0.62, vy = Math.sin(ang) * 0.62;
      if (m.has) {
        var dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        if (d < 190 && d > 1) { var f = (190 - d) / 190 * 1.15; vx += (-dy / d) * f; vy += (dx / d) * f; }
      }
      p.x += vx; p.y += vy; p.life--;
      /* Fade in and out at the ends of a life so dots arrive and leave rather than blink. */
      var k = p.life / p.max;
      var al = (k > 0.85 ? (1 - k) / 0.15 : k < 0.2 ? k / 0.2 : 1) * (dark ? 0.85 : 0.55);
      ctx.fillStyle = "rgba(" + col + "," + al.toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.15 + p.seed * 0.7, 0, 6.2832);
      ctx.fill();
      if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) p.life = 0;
    }
  }


  /* ---------------- cells ----------------
     A Voronoi field. Computing nearest-seed per screen pixel is far too expensive, so it is
     computed on a small offscreen buffer — about a tenth of each axis — and drawn back up
     with smoothing on. The upscale IS the soft organic edge; a full-resolution version looks
     harder and costs a hundred times more. */
  var SEEDS = [], off = document.createElement("canvas"), octx = off.getContext("2d");
  for (var s = 0; s < 22; s++) SEEDS.push({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - .5) * 0.00022, vy: (Math.random() - .5) * 0.00022
  });
  function cells(t) {
    var dark = isDark();
    var ow = Math.max(24, Math.round(W / 10)), oh = Math.max(24, Math.round(H / 10));
    if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
    var img = octx.createImageData(ow, oh), D = img.data;

    /* speed 2.10 in the original; this is the same pace expressed as drift per ms. */
    for (var i = 0; i < SEEDS.length; i++) {
      var p = SEEDS[i];
      p.x += p.vx * 2.1; p.y += p.vy * 2.1;
      if (p.x < -0.1) p.x = 1.1; if (p.x > 1.1) p.x = -0.1;
      if (p.y < -0.1) p.y = 1.1; if (p.y > 1.1) p.y = -0.1;
      if (m.has) {
        var dx = p.x * W - m.x, dy = p.y * H - m.y, d = Math.hypot(dx, dy);
        if (d < 260 && d > 1) { var f = (260 - d) / 260 * 0.55; p.x += (dx / d) * f / W; p.y += (dy / d) * f / H; }
      }
    }
    /* Two cobalt stops, light or dark. color1/color2 in the original were 0x1822ab and
       0x2348db — the same family, which is why this palette suits the effect. */
    var c1 = dark ? [16, 26, 96]  : [232, 237, 251];
    var c2 = dark ? [44, 76, 210] : [198, 212, 245];
    for (var y = 0; y < oh; y++) {
      for (var x = 0; x < ow; x++) {
        var d1 = 1e9, d2 = 1e9;
        for (var k = 0; k < SEEDS.length; k++) {
          var sx = SEEDS[k].x * ow, sy = SEEDS[k].y * oh;
          var dd = (sx - x) * (sx - x) + (sy - y) * (sy - y);
          if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
        }
        /* Distance to the CELL WALL, not to the seed: that is what draws membranes rather
           than blobs. */
        var edge = Math.sqrt(d2) - Math.sqrt(d1);
        var f = Math.max(0, Math.min(1, edge / 9));
        var o = (y * ow + x) * 4;
        D[o]     = c1[0] + (c2[0] - c1[0]) * (1 - f);
        D[o + 1] = c1[1] + (c2[1] - c1[1]) * (1 - f);
        D[o + 2] = c1[2] + (c2[2] - c1[2]) * (1 - f);
        D[o + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    /* RESTRAINED ON PURPOSE. Vanta CELLS fills the screen with colour; here the ground has
       to stay readable as pitch black, so the field is dropped to a texture. At .55 the page
       ground averaged rgb(36,61,177) — cobalt, not black, which is the opposite of the brief. */
    ctx.globalAlpha = dark ? 0.20 : 0.34;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(off, 0, 0, ow, oh, 0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  /* ---------------- signal ---------------- */
  var sp = [];
  for (var j = 0; j < 78; j++) sp.push({
    x: Math.random(), y: Math.random(),
    vx: (Math.random() - .5) * 0.00040, vy: (Math.random() - .5) * 0.00040
  });
  function signal() {
    var dark = isDark();
    ctx.clearRect(0, 0, W, H);
    var line = dark ? "120,150,255" : "39,67,201";
    var dot = dark ? "rgba(165,192,255,.8)" : "rgba(39,67,201,.62)";
    for (var i = 0; i < sp.length; i++) {
      var p = sp[i]; p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > 1) p.vx *= -1;
      if (p.y < 0 || p.y > 1) p.vy *= -1;
      if (m.has) {
        var dx = p.x * W - m.x, dy = p.y * H - m.y, d = Math.hypot(dx, dy);
        if (d < 150 && d > 0.01) { var f = (150 - d) / 150 * 0.9; p.x += (dx / d) * f / W; p.y += (dy / d) * f / H; }
      }
      p.x = Math.min(1, Math.max(0, p.x)); p.y = Math.min(1, Math.max(0, p.y));
    }
    for (var a = 0; a < sp.length; a++) for (var b = a + 1; b < sp.length; b++) {
      var A = sp[a], B = sp[b];
      var ddx = (A.x - B.x) * W, ddy = (A.y - B.y) * H, dd = Math.hypot(ddx, ddy);
      if (dd > 110) continue;
      ctx.strokeStyle = "rgba(" + line + "," + ((dark ? 0.24 : 0.18) * (1 - dd / 110)).toFixed(3) + ")";
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(A.x * W, A.y * H); ctx.lineTo(B.x * W, B.y * H); ctx.stroke();
    }
    ctx.fillStyle = dot;
    for (var k = 0; k < sp.length; k++) {
      ctx.beginPath(); ctx.arc(sp[k].x * W, sp[k].y * H, 1.4, 0, 6.2832); ctx.fill();
    }
  }

  var DRAW = { vortex: vortex, cells: cells, signal: signal }[KIND];
  if (!DRAW) return;

  /* Cells is the expensive one; half rate is indistinguishable for a slow drift and halves
     the work on a laptop. */
  var EVERY = KIND === "cells" ? 2 : 1, tick = 0, hidden = false;
  document.addEventListener("visibilitychange", function () { hidden = document.hidden; });

  function frame(t) {
    requestAnimationFrame(frame);
    if (hidden) return;
    if (size()) vFresh = true;
    if (++tick % EVERY) return;
    DRAW(t);
  }
  /* Paint one frame immediately rather than waiting for the first animation frame. Two
     reasons: there is no empty flash on load, and the background still appears in any
     context where requestAnimationFrame is throttled or never fires — a background tab
     opened with a middle click, a headless render, a preview pane that is not compositing. */
  size();
  DRAW(2400);
  if (!REDUCED) requestAnimationFrame(frame);

  /* Repaint on a theme change — the canvas cannot read a CSS variable the way SVG can. */
  try {
    /* Repaint straight away rather than waiting for the next animation frame: rAF can be
       throttled or paused, and a background left on the previous theme's colours is worse
       than one that never animated. */
    new MutationObserver(function () { vFresh = true; DRAW(performance.now()); })
      .observe(root, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
  } catch (e) {}
})();
