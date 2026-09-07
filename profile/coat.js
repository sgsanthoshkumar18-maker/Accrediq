/* AQcredix — the scroll-scrubbed lab coat on the founder page.
 *
 * THE TECHNIQUE, PLAINLY. A tall section pins its contents with position:sticky while the
 * page keeps scrolling past it. How far through that section you are, 0 to 1, picks one
 * image out of a numbered sequence and draws it to a canvas. Scroll down and the coat
 * turns; scroll back up and it turns back, because the position is read from the scrollbar
 * rather than played on a timer. That is the entire effect — there is no video, no 3D in
 * the browser, and nothing that keeps running when the reader has moved on.
 *
 * BUILT ON position:sticky AND A rAF-THROTTLED MEASURE, exactly as motion/scrolly.js does
 * it, and for the same reasons: the browser does the pinning, so the scrollbar stays
 * honest, Ctrl+F still works, and the inertial scroller in motion.js needs no special
 * case. Intercepting the wheel to fake a pin is what earns this technique its bad name.
 *
 * NO LIBRARY. The reference implementation drives this with GSAP ScrollTrigger, which is
 * seventy kilobytes to do what one getBoundingClientRect and a division do here. This site
 * has no build step and no node_modules, and adding a dependency to avoid sixty lines of
 * arithmetic would be the wrong trade twice over.
 *
 * IT MUST SURVIVE HAVING NO FRAMES AT ALL.
 * The renders are produced separately and may not be deployed yet, or may fail to load on
 * a bad connection. A canvas that stays black in the middle of a portfolio is worse than
 * no section, so nothing is revealed until the first frame has actually decoded. Until
 * then — and forever, if the frames never arrive — the section is not in the page.
 */
(function () {
  "use strict";

  var F = window.AQCoatFrames;
  if (!F) return;

  /* Phones and tablets, matching scrolly.js so the page does not pin in one place and not
     in another. A pinned section fights the address bar resizing as you scroll on touch,
     and the sequence is the one thing here that costs megabytes. */
  var reduce = false, coarse = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    coarse = window.matchMedia("(max-width: 1024px)").matches ||
             window.matchMedia("(pointer: coarse)").matches;
  } catch (e) {}

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

    /* WHICH FRAMES THIS DEVICE WILL EVER FETCH. On a phone the sequence is thinned to a
       quarter rather than dropped: the coat still turns all the way round, in fewer steps
       nobody looking at a 390px screen can pick out, for a quarter of the bytes.
       Reduced motion takes exactly one frame — the pose, and none of the movement. */
    var indices = reduce ? [0] : F.subset(total, coarse ? Math.min(total, 96) : total);
    var n = indices.length;

    var imgs = new Array(n), ready = new Array(n), got = 0;
    var want = 0, drawn = -1, ticking = false, revealed = false;

    /* ---- drawing ---- */

    function size() {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      /* Capped at 2. A phone reporting devicePixelRatio 3 would otherwise allocate a
         canvas nine times the CSS area for a difference nobody can see, on the device
         least able to afford the memory. */
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        drawn = -1;          // the buffer was cleared by the resize; force a redraw
      }
      return true;
    }

    /* Contain, not cover. The coat is a single object on transparent ground and cropping
       it to fill the box would cut the shoulders off on a wide window. */
    function draw(i) {
      var img = imgs[i];
      if (!img || drawn === i) return;
      if (!size()) return;
      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      var s = Math.min(cw / iw, ch / ih);
      var w = iw * s, h = ih * s;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      drawn = i;
    }

    /* THE REVEAL CANNOT WAIT FOR THE FIRST PAINT, AND FINDING THAT OUT COST A DEADLOCK.
       The section is display:none until it has something to show, so the stage measures
       zero by zero, so size() refuses, so nothing is ever drawn, so it is never revealed.
       Hidden until it draws, unable to draw because it is hidden.

       A decoded image is proof enough. decode() resolving means the bytes arrived and the
       browser can paint them — everything the hidden-until-usable rule was protecting
       against. So the reveal happens on that, and the paint happens immediately after,
       against a stage that now has a size. */
    function reveal() {
      if (revealed) return;
      revealed = true;
      host.setAttribute("data-coat-ready", "1");
    }

    function paint() {
      var i = F.nearestLoaded(want, ready);
      if (i >= 0) draw(i);
    }

    /* ---- loading ---- */

    function load(slot) {
      return new Promise(function (done) {
        var img = new Image();
        img.decoding = "async";
        img.src = F.fileFor(pattern, indices[slot]);
        function ok() {
          imgs[slot] = img; ready[slot] = true; got++;
          done(true);
        }
        /* decode() before we ever draw it. Without it the first paint of a large image
           happens inside drawImage on the scroll handler, which is exactly where a jank
           frame is most visible. Not every browser has it; the load event is the
           fallback and is correct, just later. */
        if (img.decode) {
          img.decode().then(ok, function () { done(false); });
        } else {
          img.onload = ok;
        }
        img.onerror = function () { done(false); };
      });
    }

    async function run() {
      /* The first frame decides whether this section exists at all. If it cannot be
         fetched — not deployed yet, wrong path, offline — nothing is revealed and the
         page reads as though the section was never written. */
      var first = await load(0);
      if (!first) return;
      /* Reveal, THEN measure and paint. In that order: the stage has no size until the
         section is in the layout, and measure() reads it. */
      reveal();
      measure();
      if (n === 1) return;

      /* Everything else, in subdivision order, one at a time. Firing four hundred
         requests at once would saturate the connection and delay the very frames a
         reader is about to scroll into; sequential keeps the coarse pass arriving fast
         and never competes with the rest of the page for sockets. */
      var order = F.loadOrder(n);
      for (var k = 0; k < order.length; k++) {
        var slot = order[k];
        if (ready[slot]) continue;
        await load(slot);
        /* Redraw as soon as a better frame for where the reader already is arrives. */
        if (slot === want || !ready[want]) paint();
        host.setAttribute("data-coat-progress", Math.round((got / n) * 100));
      }
    }

    /* ---- scroll ---- */

    function measure() {
      ticking = false;
      var r = host.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      if (span <= 0) return;
      var p = Math.min(1, Math.max(0, -r.top / span));
      /* Published for CSS too, so captions can fade against the same progress rather
         than against a second, slightly different measurement of it. */
      host.style.setProperty("--coat-p", p.toFixed(4));
      want = F.frameAt(p, n);
      paint();
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    }

    if (!reduce) {
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("resize", function () {
      drawn = -1;
      onScroll();
    }, { passive: true });

    measure();
    run();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  /* The founder page builds most of itself from data, so anything that renders markup
     late fires this. `data-coat-on` stops a second pass from starting a second loader. */
  document.addEventListener("aq:content", init);
})();
