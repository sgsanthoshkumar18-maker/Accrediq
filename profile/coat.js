/* AQcredix — the scroll-scrubbed founder sequence.
 *
 * THE TECHNIQUE, PLAINLY. A tall section pins its contents with position:sticky while the
 * page keeps scrolling past it. How far through that section you are, 0 to 1, drives three
 * things at once: which frame of a numbered image sequence is drawn, how far the "camera"
 * has pushed in, and which line of copy is on screen. Scroll down and it advances; scroll
 * back up and it reverses, because the position is read from the scrollbar rather than
 * played on a timer.
 *
 * THE PUSH-IN IS DONE HERE, NOT IN BLENDER, AND THAT IS DELIBERATE.
 * A camera move baked into the render costs a full re-render every time the framing is
 * judged wrong — and it is always judged wrong the first three times. Done at draw time it
 * is two numbers that can be changed and reloaded in a second. The constraint that keeps it
 * honest is that it must never magnify beyond the source: the sequence is rendered at
 * 1100px and the push ends at a scale that still fits inside that on any ordinary screen,
 * so this is a crop, never an upscale.
 *
 * BUILT ON position:sticky AND A rAF-THROTTLED MEASURE, exactly as motion/scrolly.js does
 * it, and for the same reasons: the browser does the pinning, so the scrollbar stays
 * honest, Ctrl+F still works, and the inertial scroller in motion.js needs no special case.
 * Intercepting the wheel to fake a pin is what earns this technique its bad name.
 *
 * NO LIBRARY. The reference implementation drives this with GSAP ScrollTrigger, which is
 * seventy kilobytes to do what one getBoundingClientRect and a division do here. This site
 * has no build step and no node_modules.
 *
 * IT MUST SURVIVE HAVING NO FRAMES AT ALL.
 * The renders are produced separately and may not be deployed yet. A canvas that stays
 * black in the middle of a portfolio is worse than no section, so nothing is revealed until
 * the first frame has actually decoded.
 */
(function () {
  "use strict";

  var F = window.AQCoatFrames;
  if (!F) return;

  var reduce = false, coarse = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    coarse = window.matchMedia("(max-width: 1024px)").matches ||
             window.matchMedia("(pointer: coarse)").matches;
  } catch (e) {}

  /* THE CAMERA MOVE, as two numbers.
     Starts wide with air around the figure and ends closer on the upper body. ZOOM_TO is
     the one to be careful with: at 1.16 the drawn height on a 900px stage is about 1044px
     against an 1100px source, so it is still a crop rather than a magnification. Raising it
     much past 1.2 starts to soften the image on tall screens. */
  var ZOOM_FROM = 0.86, ZOOM_TO = 1.20;
  /* Where the frame settles vertically, as a fraction of the stage height. Positive moves
     the image down, so the push crops from the BOTTOM — the trousers, which the model cuts
     off at the shin anyway — and ends framed on the coat and the face. That is the crane
     half of the move, and what stops a straight zoom feeling like a slide projector. */
  var PAN_TO = 0.10;

  /* MEASURED FROM THE FRAMES THEMSELVES, not guessed.
     Sampling eight frames across the rotation: the figure fills 97.6% of the frame's HEIGHT
     — there is essentially no vertical margin to crop — and at its widest, face-on with the
     coat flared, spans 59.5% of the WIDTH. Across every frame the union of his extents runs
     from 15.8% to 77.6%, so he is centred at 46.7% rather than 50%.

     Both numbers earn their keep. The height figure says the image must be fitted to the
     stage height, never "contained": contain in a narrow column would fit to width and
     leave him small with air above and below. The width figure is what lets the push-in be
     clamped so the column can crop the empty margins away without ever clipping him. */
  var FIG_W = 0.62, FIG_CX = 0.467;

  /* Ease-out. A linear push-in reads as mechanical: it arrives at the close-up at the same
     speed it left the wide, and the shot never appears to settle. */
  function ease(t) { return 1 - Math.pow(1 - t, 2.2); }

  /* ======================== THE ENERGY FIELD ========================
   *
   * WHY THE FIRST VERSION LOOKED CHEAP, since it is the whole reason this one is different.
   * It drew lightning as vector strokes over a photoreal render: hard-edged, evenly
   * coloured lines laid on top of a lit, textured, three-dimensional figure. Two visual
   * languages in one frame. Thinning the lines or dropping their opacity does not fix that,
   * because the mismatch is not weight — it is that DRAWN MARKS SIT ON A PICTURE while
   * light BELONGS TO IT.
   *
   * The single thing that sells energy near a person is that it lights them. So most of the
   * work here is not bolts at all:
   *
   *   1. A HALO taken from his own silhouette. His alpha is blurred and tinted, and painted
   *      behind him, so the glow hugs the real outline of his coat and hair rather than
   *      being a circle he happens to stand in. This is what makes it read as belonging to
   *      the scene, and it is the reason the figure now looks lit rather than pasted.
   *   2. SPILL painted back ONTO him with source-atop, so the colour lands on the fabric
   *      and falls off across his body. Light that never touches the subject is the tell
   *      that gives away every cheap overlay.
   *   3. ARCS, finally — but few, soft, white-hot at the core and coloured only in their
   *      falloff, which is how an electrical arc actually photographs. They are a detail on
   *      top of the lighting, not the effect itself.
   *
   * Everything is still a pure function of scroll position, so it all unwinds exactly.
   */
  var BOLTS = 4;        // few. They are seasoning, not the dish.
  var SEGS = 11;
  var TICKS = 70;
  var HALO = [
    /* blur, spread, alpha — three passes make a falloff; one makes a sticker */
    { blur: 46, alpha: 0.34 },
    { blur: 18, alpha: 0.26 },
    { blur: 7,  alpha: 0.20 }
  ];

  /* Deterministic integer hash, -1..1. The same input always gives the same output, which
     is the entire reason the field can be scrubbed backwards.

     Math.imul IS THE POINT, AND LEAVING IT OUT PRODUCED A BUG WITH NO ERROR MESSAGE.
     The textbook version is written for C, where integer multiplication wraps. In
     JavaScript every number is a double, so at n around 2^31 the product reaches 2^76 —
     past the 2^53 a double holds exactly — and the low bits, where a hash keeps all its
     entropy, are rounded away before the mask sees them. Measured with the naive version:
     258 distinct values from 4000 inputs, every bolt handed the same coordinates, and the
     jitter returning exactly 1.000 every time. With Math.imul: 3606 from 4000. */
  function nz(n) {
    n = n | 0;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = n ^ (n >>> 16);
    return ((n >>> 0) / 4294967295) * 2 - 1;
  }

  /* A point on the sphere around him, turned by the same angle the figure has turned. */
  function orbitPoint(u, v, rad, ang, cx, cy, R) {
    var theta = u * Math.PI, phi = v * Math.PI * 2 + ang;
    var sy = Math.cos(theta), sr = Math.sin(theta);
    return { x: cx + Math.sin(phi) * sr * rad * R,
             y: cy + sy * rad * R * 1.05,
             z: Math.cos(phi) * sr };
  }

  /* THE HALO. His own alpha, blurred and tinted, painted behind him.
     Rebuilt only when the FRAME changes, not on every scroll pixel: the blur is the one
     expensive operation here and the silhouette cannot have changed while the frame has
     not. */
  var silh = null, silhCtx = null, silhKey = "";
  function haloFor(img, w, h, rgb) {
    /* THE SOURCE IS SOMETIMES A CANVAS, NOT AN IMAGE. While he is assembling, the halo has
       to hug the part of him that exists so far, so what arrives here is the masked canvas
       rather than the frame — and a canvas has no .src to key a cache on. Keying on the
       mask's own threshold instead is not just a guard against a crash: caching the halo
       across two different assembly steps would draw the glow of a body he has not grown
       yet, which is the exact thing the masking exists to prevent. */
    var id = img.src ? img.src.slice(-24) : "part" + maskAt;
    var key = id + "|" + Math.round(w) + "x" + Math.round(h) + "|" + rgb;
    if (silhKey === key && silh) return silh;
    if (!silh) { silh = document.createElement("canvas"); silhCtx = silh.getContext("2d"); }
    silh.width = Math.max(1, Math.round(w));
    silh.height = Math.max(1, Math.round(h));
    var s = silhCtx;
    s.clearRect(0, 0, silh.width, silh.height);
    s.drawImage(img, 0, 0, silh.width, silh.height);
    /* Keep the shape, throw away the picture: everything inside his outline becomes one
       flat colour, which is what a light source shining from behind him would look like. */
    s.globalCompositeOperation = "source-in";
    s.fillStyle = "rgb(" + rgb + ")";
    s.fillRect(0, 0, silh.width, silh.height);
    s.globalCompositeOperation = "source-over";
    silhKey = key;
    return silh;
  }

  function drawField(ctx, img, x0, y0, w, h, cx, cy, R, ang, rgb, strength, p, phase) {
    if (strength <= 0) return;
    var tick = Math.floor(p * TICKS);

    if (phase === "halo") {
      var sil = haloFor(img, w, h, rgb);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var g = 0; g < HALO.length; g++) {
        /* A gentle pulse tied to the strike tick, so the halo brightens with the arcs
           rather than sitting at one level while they flash — which is what would give
           away that the two are unrelated layers. */
        var pulse = 0.82 + 0.18 * Math.abs(nz(tick * 31 + g));
        ctx.globalAlpha = HALO[g].alpha * strength * pulse;
        /* filter is not universal; without it the halo simply becomes a soft double of the
           silhouette, which still reads as glow rather than as nothing. */
        try { ctx.filter = "blur(" + HALO[g].blur + "px)"; } catch (e) {}
        var grow = HALO[g].blur * 0.35;
        ctx.drawImage(sil, x0 - grow, y0 - grow, w + grow * 2, h + grow * 2);
        try { ctx.filter = "none"; } catch (e) {}
      }
      ctx.restore();
      return;
    }

    if (phase === "spill") {
      /* LIGHT LANDING ON HIM. source-atop paints only where the figure already is, so this
         is colour on fabric rather than a wash floating over the scene. Angled from the
         side the field is currently strongest on, so it travels as he turns. */
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      var lx = x0 + w * (0.5 + 0.42 * Math.cos(ang));
      var ly = y0 + h * 0.42;
      var gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * 0.78);
      gr.addColorStop(0, "rgba(" + rgb + "," + (0.26 * strength).toFixed(3) + ")");
      gr.addColorStop(0.45, "rgba(" + rgb + "," + (0.10 * strength).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = gr;
      ctx.fillRect(x0, y0, w, h);
      ctx.restore();
      return;
    }

    /* ---- the arcs ---- */
    var front = phase === "front";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (var b = 0; b < BOLTS; b++) {
      var seed = tick * 977 + b * 3571;
      /* Not every bolt fires on every tick. Constant strikes read as a texture; gaps read
         as electricity. */
      if (nz(seed + 91) < -0.15) continue;
      var fade = 0.55 + 0.45 * Math.abs(nz(seed + 61));

      var a0 = orbitPoint(0.18 + Math.abs(nz(seed)) * 0.64, nz(seed + 1) * 0.5,
                          0.66 + Math.abs(nz(seed + 7)) * 0.26, ang, cx, cy, R);
      var a1 = orbitPoint(0.18 + Math.abs(nz(seed + 2)) * 0.64, nz(seed + 3) * 0.5 + 0.5,
                          0.66 + Math.abs(nz(seed + 8)) * 0.26, ang, cx, cy, R);
      var bow = nz(seed + 11) * 0.5;

      var pts = [], i, t;
      for (i = 0; i <= SEGS; i++) {
        t = i / SEGS;
        var bell = Math.sin(t * Math.PI);
        pts.push({
          x: a0.x + (a1.x - a0.x) * t + nz(seed + i * 31 + 5) * 0.13 * bell * R,
          y: a0.y + (a1.y - a0.y) * t + nz(seed + i * 31 + 6) * 0.13 * bell * R,
          z: a0.z + (a1.z - a0.z) * t + bow * bell
        });
      }

      for (i = 0; i < SEGS; i++) {
        var m = (pts[i].z + pts[i + 1].z) / 2;
        if ((m >= 0) !== front) continue;
        var d = (m + 1) / 2;
        /* Ends taper to nothing. A bolt with squared-off ends is a drawn line; one that
           fades out at both ends is a discharge. */
        var taper = Math.sin((i / SEGS) * Math.PI);
        var al = (0.10 + 0.34 * d) * fade * strength * taper;
        var wd = (0.5 + 1.0 * d) * (R / 300) * taper;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        /* Wide coloured bloom, then a narrow near-white core. An arc photographs as white
           in the middle with the colour only in its falloff; a uniformly coloured line is
           the single most artificial-looking part of drawn lightning. */
        ctx.strokeStyle = "rgba(" + rgb + "," + (al * 0.16).toFixed(3) + ")";
        ctx.lineWidth = wd * 7;
        ctx.stroke();
        ctx.strokeStyle = "rgba(" + rgb + "," + (al * 0.42).toFixed(3) + ")";
        ctx.lineWidth = wd * 2.6;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255," + (al * 0.5).toFixed(3) + ")";
        ctx.lineWidth = wd * 0.7;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* "#7C9CFF" -> "124,156,255". Canvas gradients need channels, and the colour is authored
     in CSS so it can be changed without touching this file. */
  function toRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return "124,156,255";
    var n = parseInt(m[1], 16);
    return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
  }

  /* ====================== THE ASSEMBLY ======================
   *
   * He builds himself out of the middle of his own coat. A patch of chest appears first,
   * the coat grows down and out of it, then the arms, then the head — and it all runs
   * backwards on the way up, like everything else on this stage.
   *
   * HOW IT WORKS, AND WHAT IT HONESTLY IS.
   * Every pixel is given a REVEAL ORDER — a number from 0 to 1 saying how early it appears.
   * Scroll position is a threshold across that field: pixels whose order is below it are
   * drawn, pixels above it are not, and the narrow band either side of the threshold is
   * painted as a glowing edge so the boundary crackles rather than being a clean wipe.
   *
   * The order is distance from a seed at his chest, deliberately squashed so it travels
   * DOWN the coat faster than it travels sideways, with the head paying an extra penalty so
   * it arrives last. Plus noise, which is what turns a growing ellipse into something that
   * looks like it is being assembled.
   *
   * This is a screen-space dissolve, not per-limb 3D assembly: the frames are flat images
   * of a complete figure and carry no knowledge of where an arm ends. It follows the
   * anatomy closely because the coat really is his middle and the head really is furthest
   * from it — but it is worth being clear that the edge is following a distance field, not
   * a sleeve. True limb-by-limb would mean rendering the coat, arms and head as separate
   * passes in Blender.
   *
   * DONE AT LOW RESOLUTION ON PURPOSE. Thresholding a 600x900 canvas per scroll frame is
   * half a million pixels of JavaScript. The field is built once at 132x198, thresholded
   * there, and scaled up with the browser's own smoothing — which costs nothing and gives
   * a softer edge than a per-pixel version would anyway.
   */
  var ASSEMBLE_END = 0.42;   // fully formed by this point in the scroll
  var MW = 132, MH = 198;    // resolution of the reveal field

  var field = null, fieldKey = "";
  function revealField() {
    if (field && fieldKey === MW + "x" + MH) return field;
    var f = new Float32Array(MW * MH);
    /* The seed: the middle of his chest, in the frame's own coordinates. FIG_CX is where he
       actually is horizontally; 0.34 is chest height given he fills the frame top to bottom. */
    var sx = FIG_CX, sy = 0.34;
    var max = 0, i, x, y;
    for (y = 0; y < MH; y++) {
      for (x = 0; x < MW; x++) {
        var u = x / MW, v = y / MH;
        var dx = (u - sx) * 1.45;          // sideways is expensive: arms wait
        var dy = (v - sy) * 0.72;          // downwards is cheap: the coat grows first
        /* The head pays a surcharge so it is last, which is the order that reads as a body
           assembling rather than a stain spreading. */
        var head = v < 0.20 ? (0.20 - v) * 1.9 : 0;
        var d = Math.sqrt(dx * dx + dy * dy) + head;
        /* Two octaves of value noise. Without it the boundary is a clean ellipse and the
           whole thing reads as a wipe; with it the edge breaks into fingers and flecks. */
        var n = nz(((x * 3) | 0) + ((y * 7) | 0) * 131) * 0.055 +
                nz(((x >> 2) | 0) * 17 + ((y >> 2) | 0) * 971) * 0.085;
        var val = d + n;
        f[y * MW + x] = val;
        /* NORMALISE AGAINST THE BODY, NOT THE RECTANGLE — measured, and it matters.
           The largest reveal order in the frame belongs to a far corner, which is empty
           transparent space that never draws anything. Dividing by that squashed every
           value a body pixel actually has into the bottom half of the range, so he finished
           assembling at 20% of the scroll and the remaining 22% of the runway animated
           nothing. The bounds here are the ones sampled from the frames: he spans 15.8% to
           77.6% across and 2.2% to 99.8% down. */
        if (u >= 0.158 && u <= 0.776 && v >= 0.022 && val > max) max = val;
      }
    }
    for (i = 0; i < f.length; i++) f[i] = Math.min(1, f[i] / max);
    field = f; fieldKey = MW + "x" + MH;
    return field;
  }

  /* The mask for one threshold, plus the glowing shell just outside it. Cached on a
     quantised threshold so a slow scroll does not rebuild it for every pixel of movement. */
  var maskCv = null, maskCtx2 = null, maskAt = -1;
  var edgeCv = null, edgeCtx = null;
  function buildMask(t, rgb) {
    var q = Math.round(t * 120);
    if (maskAt === q) return;
    if (!maskCv) {
      maskCv = document.createElement("canvas"); maskCv.width = MW; maskCv.height = MH;
      maskCtx2 = maskCv.getContext("2d");
      edgeCv = document.createElement("canvas"); edgeCv.width = MW; edgeCv.height = MH;
      edgeCtx = edgeCv.getContext("2d");
    }
    var f = revealField();
    var m = maskCtx2.createImageData(MW, MH);
    var e = edgeCtx.createImageData(MW, MH);
    var col = rgb.split(",");
    var cr = +col[0], cg = +col[1], cb = +col[2];
    var soft = 0.055;               // width of the fade at the boundary
    var shell = 0.075;              // how far the glowing shell reaches past it
    for (var i = 0; i < f.length; i++) {
      var v = f[i], o = i * 4;
      /* Inside: fully drawn. Across the boundary: fading. Beyond: absent. */
      var a = v <= t - soft ? 1 : v >= t ? 0 : (t - v) / soft;
      m.data[o] = 255; m.data[o + 1] = 255; m.data[o + 2] = 255;
      m.data[o + 3] = (a * 255) | 0;
      /* The shell is brightest exactly at the frontier and dies away on both sides — the
         line of light where the next part of him is about to arrive. */
      var dEdge = Math.abs(v - t);
      var ea = dEdge < shell ? (1 - dEdge / shell) : 0;
      ea = ea * ea;
      e.data[o] = cr; e.data[o + 1] = cg; e.data[o + 2] = cb;
      e.data[o + 3] = (ea * 235) | 0;
    }
    maskCtx2.putImageData(m, 0, 0);
    edgeCtx.putImageData(e, 0, 0);
    maskAt = q;
  }

  /* The figure, masked to however much of him has formed. Returns a canvas to draw in place
     of the frame — or null once he is whole, so the finished state costs nothing extra. */
  var partCv = null, partCtx = null;
  function assembled(img, w, h, t, rgb) {
    if (t >= 1) return null;
    buildMask(t, rgb);
    var W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
    if (!partCv) { partCv = document.createElement("canvas"); partCtx = partCv.getContext("2d"); }
    if (partCv.width !== W || partCv.height !== H) { partCv.width = W; partCv.height = H; }
    var c = partCtx;
    c.clearRect(0, 0, W, H);
    c.drawImage(img, 0, 0, W, H);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(maskCv, 0, 0, W, H);
    /* The frontier, drawn onto the figure itself so the light sits on the forming edge
       rather than hovering in front of it. */
    c.globalCompositeOperation = "lighter";
    c.drawImage(edgeCv, 0, 0, W, H);
    c.globalCompositeOperation = "source-over";
    return partCv;
  }

  /* THE COPY SCROLLS PAST; IT IS NOT PAINTED OVER THE FIGURE.
     It was, and it was unreadable — a serif headline sitting across a white coat, with the
     eyebrow lost against his chest. The figure now holds one column and the words flow up
     the other, so neither is ever competing with the other for the same pixels.

     Which beat is emphasised is therefore a question about where each BLOCK is, not about
     how far through the section the scroll is: the block nearest the middle of the viewport
     is the one being read. That is the same rule scrolly.js uses for its steps, deliberately
     — two sections on one page that decide "active" differently would drift apart the first
     time either was edited. */
  function activeBeat(beats) {
    var mid = window.innerHeight / 2, best = -1, bestD = Infinity;
    for (var i = 0; i < beats.length; i++) {
      var r = beats[i].getBoundingClientRect();
      var d = Math.abs((r.top + r.height / 2) - mid);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function init() {
    var host = document.querySelector("[data-coat]");
    if (!host || host.getAttribute("data-coat-on") === "1") return;
    host.setAttribute("data-coat-on", "1");

    var total = parseInt(host.getAttribute("data-frames"), 10);
    var pattern = host.getAttribute("data-src");
    if (!(total > 0) || !pattern) return;

    var canvas = host.querySelector("canvas");
    var stage = host.querySelector("[data-coat-stage]");
    if (!canvas || !stage) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    var beats = [].slice.call(host.querySelectorAll("[data-beat]"));

    /* AUTHORED IN CSS, NOT HERE. The aura colour is a design decision that will be
       argued about, and a design decision that lives in a script is one nobody can change
       without a deploy. Read once at start-up from --coat-aura, with the accent as the
       fallback if the variable is ever removed. */
    var auraRgb = toRgb(
      (getComputedStyle(host).getPropertyValue("--coat-aura") || "").trim() || "#7C9CFF");

    /* On a phone the sequence is thinned rather than dropped: the figure still turns all
       the way round, in fewer steps nobody can pick out on a 390px screen, for a quarter of
       the bytes. Reduced motion takes one frame — the pose, and none of the movement. */
    var indices = reduce ? [0] : F.subset(total, coarse ? Math.min(total, 96) : total);
    var n = indices.length;

    var imgs = new Array(n), ready = new Array(n), got = 0;
    var want = 0, drawn = -1, drawnAt = -1, prog = 0, ticking = false, revealed = false;

    function size() {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      /* Capped at 2: a phone reporting devicePixelRatio 3 would allocate a canvas nine
         times the CSS area for a difference nobody can see, on the device least able to
         afford the memory. */
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        drawn = -1;
      }
      return true;
    }

    /* FITTED TO HEIGHT AND CLAMPED BY THE FIGURE, not "contained".
       Contain fits to whichever side is tighter, which in a half-width column is the width
       — and that would draw him small with empty air above and below, in a column whose
       whole purpose is to make him bigger. Fitting to height fills the stage and lets the
       column crop the frame's empty side margins, which the measurements say are 38% of its
       width and contain nothing.

       The clamp is what makes that safe. He is never wider than FIG_W of the frame, so the
       largest scale at which he still fits the column is cw / (iw * FIG_W). The push-in
       grows towards that and stops, so a narrow window crops empty pixels and never his
       shoulders. */
    function draw(i, p) {
      var img = imgs[i];
      if (!img) return;
      if (drawn === i && Math.abs(drawnAt - p) < 0.0015) return;
      if (!size()) return;

      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;

      var k = reduce ? 1 : ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * ease(p);
      var s = (ch / ih) * k;
      var fits = cw / (iw * FIG_W);
      if (s > fits) s = fits;

      var w = iw * s, h = ih * s;
      /* He sits left of the frame's centre, so centring the IMAGE would leave him visibly
         off-centre in the column. Shifted by the measured difference instead. */
      var dx = (0.5 - FIG_CX) * w;
      var dy = reduce ? 0 : ch * PAN_TO * ease(p);
      var x0 = (cw - w) / 2 + dx, y0 = (ch - h) / 2 + dy;

      ctx.clearRect(0, 0, cw, ch);

      /* The orbit is centred on his CHEST, not on the canvas: measured, he fills 97.6% of
         the frame from the top down, so the middle of his torso sits at roughly 45% of the
         drawn height. Centring on the canvas would hang the ring around his knees. */
      var acx = x0 + w * FIG_CX, acy = y0 + h * 0.45;
      var aR = h * 0.30;
      /* The same angle the figure has turned through, so the ring and the man are locked
         together — and both unwind when the reader scrolls back up. */
      var ang = p * Math.PI * 2;
      /* Faded up over the first tenth of the section rather than snapping on at the top
         edge, which reads as a glitch on the first pixel of scroll. */
      var lift = reduce ? 0 : Math.min(1, p / 0.10);

      /* HOW MUCH OF HIM EXISTS YET. 0 at the top of the section, 1 once assembled — after
         which `assembled` returns null and the finished state costs nothing extra. */
      var built = Math.min(1, p / ASSEMBLE_END);
      var shown = assembled(img, w, h, built, auraRgb) || img;

      /* Arcs behind, then the halo hugging his outline, then the man, then the light
         landing on him, then the arcs that pass in front. The halo takes its shape from
         `shown`, so while he is forming the glow hugs only the part of him that is
         there — a halo around the finished silhouette would give the whole thing away. */
      drawField(ctx, img, x0, y0, w, h, acx, acy, aR, ang, auraRgb, lift, p, "back");
      drawField(ctx, shown, x0, y0, w, h, acx, acy, aR, ang, auraRgb, lift, p, "halo");
      ctx.drawImage(shown, x0, y0, w, h);
      drawField(ctx, shown, x0, y0, w, h, acx, acy, aR, ang, auraRgb, lift, p, "spill");
      drawField(ctx, img, x0, y0, w, h, acx, acy, aR, ang, auraRgb, lift, p, "front");

      drawn = i; drawnAt = p;
    }

    /* THE REVEAL CANNOT WAIT FOR THE FIRST PAINT, AND FINDING THAT OUT COST A DEADLOCK.
       The section is display:none until it has something to show, so the stage measures
       zero by zero, so size() refuses, so nothing is drawn, so it is never revealed. A
       decoded image is proof enough that there is something to show. */
    function reveal() {
      if (revealed) return;
      revealed = true;
      host.setAttribute("data-coat-ready", "1");
    }

    function paint() {
      var i = F.nearestLoaded(want, ready);
      if (i >= 0) draw(i, prog);
    }

    /* LOAD DECIDES, DECODE ONLY OPTIMISES — and getting that backwards hid the whole
       section once already.

       decode() is worth calling: without it the first paint of a large image happens inside
       drawImage on the scroll handler, which is exactly where a dropped frame is most
       visible. But a decode() REJECTION does not mean the image is unusable. It rejects in
       backgrounded and hidden documents, and on some browsers for reasons that have nothing
       to do with the bytes. Treating that as failure meant the first frame "failed", the
       section was never revealed, and a portfolio silently lost a section on any browser
       that happened to reject — with a 200 OK sitting in the network panel saying the image
       was fine all along.

       So the load event is the authority on whether we have an image, and decode is an
       optimisation attempted afterwards whose outcome is ignored. */
    function load(slot) {
      return new Promise(function (done) {
        var img = new Image();
        img.decoding = "async";
        var settled = false;
        function ok() {
          if (settled) return;
          settled = true;
          imgs[slot] = img; ready[slot] = true; got++;
          done(true);
        }
        img.onload = function () {
          /* MARK IT READY FIRST, THEN WARM THE DECODE — never the other way round.
             decode() does not merely reject in a hidden or backgrounded document: its
             promise NEVER SETTLES. It does not resolve and it does not reject, so anything
             awaiting it waits forever. Gating readiness on it meant that a visitor whose
             tab was in the background while the page loaded lost this section
             permanently — the frames arrived 200 OK and were never drawn, and no error
             was logged anywhere because nothing had failed. It was found by watching the
             network panel show success while the section stayed hidden.

             The load event is the authority: it means we have the bytes and drawImage will
             work. decode() is only an optimisation that moves rasterisation off the scroll
             handler, so it is fired and forgotten. */
          ok();
          if (img.decode) { try { img.decode().catch(function () {}); } catch (e) {} }
        };
        img.onerror = function () {
          if (settled) return;
          settled = true;
          done(false);
        };
        img.src = F.fileFor(pattern, indices[slot]);
      });
    }

    async function run() {
      var first = await load(0);
      if (!first) return;
      reveal();
      measure();
      if (n === 1) return;

      /* Subdivision order: ends, then middles. Twenty images in, the whole scroll already
         animates coarsely and nothing is ever blank. Sequential rather than parallel so the
         coarse pass arrives fast and never competes with the rest of the page for sockets. */
      var order = F.loadOrder(n);
      for (var k = 0; k < order.length; k++) {
        var slot = order[k];
        if (ready[slot]) continue;
        await load(slot);
        if (slot === want || !ready[want]) paint();
        host.setAttribute("data-coat-progress", Math.round((got / n) * 100));
      }
    }

    function measure() {
      ticking = false;
      var r = host.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      if (span <= 0) { prog = 0; }
      else prog = Math.min(1, Math.max(0, -r.top / span));

      /* Published for CSS as well, so the vignette and the progress rail move against the
         same measurement that picks the frame rather than a second, slightly different one. */
      host.style.setProperty("--coat-p", prog.toFixed(4));
      want = F.frameAt(prog, n);

      /* A class, with the fade in CSS — not an inline opacity written every scroll frame.
         The transition then belongs to the stylesheet like every other state on the site,
         and the handler is not touching style on three elements sixty times a second. */
      if (beats.length) {
        var on = reduce ? 0 : activeBeat(beats);
        for (var i = 0; i < beats.length; i++) {
          beats[i].classList.toggle("is-on", i === on);
        }
      }
      paint();
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    }

    if (!reduce) window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { drawn = -1; onScroll(); }, { passive: true });

    measure();
    run();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  /* The founder page builds most of itself from data, so anything rendering markup late
     fires this. data-coat-on stops a second pass starting a second loader. */
  document.addEventListener("aq:content", init);
})();
