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
  var ZOOM_FROM = 0.80, ZOOM_TO = 1.16;
  /* Where the frame settles vertically, as a fraction of the stage height. Positive moves
     the image down, which lifts the framing towards the head and shoulders — the crane
     half of the move, and what stops a straight zoom feeling like a slide projector. */
  var PAN_TO = 0.085;

  /* Ease-out. A linear push-in reads as mechanical: it arrives at the close-up at the same
     speed it left the wide, and the shot never appears to settle. */
  function ease(t) { return 1 - Math.pow(1 - t, 2.2); }

  /* One copy beat's opacity: ramp in, hold, ramp out. Written as four stops rather than a
     duration so the beats can overlap deliberately — a cross-fade rather than a blink. */
  function beatAlpha(p, a, b, c, d) {
    if (p <= a || p >= d) return 0;
    if (p < b) return (p - a) / (b - a);
    if (p <= c) return 1;
    return 1 - (p - c) / (d - c);
  }
  /* The first beat starts BEFORE the section does — negative stops — so it is already at
     full opacity the instant the section pins rather than fading up from nothing over the
     first few pixels of scroll. A headline that is invisible exactly when the reader
     arrives is the one moment it most needs to be readable. The last one runs past 1 for
     the same reason at the other end. */
  var BEATS = [
    [-0.30, -0.10, 0.26, 0.35],
    [ 0.33,  0.42, 0.60, 0.69],
    [ 0.66,  0.75, 1.10, 1.20]
  ];

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

    /* Contain, then scale and offset by the camera move. Contain rather than cover because
       the figure is a cut-out on transparency: cropping it to fill would cut the shoulders
       off on a wide window. */
    function draw(i, p) {
      var img = imgs[i];
      if (!img) return;
      if (drawn === i && Math.abs(drawnAt - p) < 0.0015) return;
      if (!size()) return;

      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;

      var k = reduce ? 1 : ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * ease(p);
      var s = Math.min(cw / iw, ch / ih) * k;
      var w = iw * s, h = ih * s;
      var dy = reduce ? 0 : ch * PAN_TO * ease(p);

      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2 + dy, w, h);
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

      for (var i = 0; i < beats.length; i++) {
        var b = BEATS[i] || BEATS[BEATS.length - 1];
        var a = reduce ? (i === 0 ? 1 : 0) : beatAlpha(prog, b[0], b[1], b[2], b[3]);
        beats[i].style.opacity = a.toFixed(3);
        /* Lifted slightly as it arrives and again as it leaves. Kept small: a copy block
           that travels far reads as a slideshow rather than a camera settling. */
        beats[i].style.transform = "translate3d(0," + ((1 - a) * 16).toFixed(1) + "px,0)";
        beats[i].style.visibility = a < 0.01 ? "hidden" : "visible";
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
