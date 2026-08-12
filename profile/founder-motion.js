/* AQcredix — founder page motion, beyond the site-wide layer.
 *
 * The site already provides smooth scroll, split-text headings, reveals, page transitions
 * and card tilt. These four are the ones that were missing, and each is scroll- or
 * pointer-LINKED rather than a one-shot animation: progress is driven continuously by
 * input, which is what separates a portfolio from a page with fade-ins on it.
 *
 *   1. mouse-parallax on the hero      — layers drift against the pointer
 *   2. scroll-linked timeline spine    — the line draws as you read down it
 *   3. staggered list entrance         — publications and certs arrive in sequence
 *   4. magnetic buttons                — the pointer pulls the button toward it
 *
 * All four are pointer-and-motion gated: nothing binds on a coarse pointer or under
 * reduced motion, so a phone gets the content with none of the cost.
 */
(function () {
  "use strict";

  var reduce = false, coarse = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  try { coarse = matchMedia("(pointer: coarse)").matches; } catch (e) {}

  /* Read at most once per frame. pointermove and scroll both fire far faster than the
     screen refreshes, and writing a transform per event is wasted work that shows up as
     jank on exactly the machines this site is used on. */
  function throttled(fn) {
    var queued = false, last = null;
    return function (arg) {
      last = arg;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn(last); });
    };
  }

  /* ------------------------- 1. hero mouse-parallax ------------------------- */

  function heroParallax() {
    var hero = document.querySelector(".fp-hero");
    if (!hero) return;
    var layers = hero.querySelectorAll("[data-depth]");
    if (!layers.length) return;

    var move = throttled(function (e) {
      var r = hero.getBoundingClientRect();
      // -0.5..0.5 from the centre, so the rest position is the authored position.
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      [].forEach.call(layers, function (el) {
        var d = parseFloat(el.getAttribute("data-depth")) || 0;
        el.style.transform = "translate3d(" + (-x * d * 34).toFixed(1) + "px," +
                             (-y * d * 24).toFixed(1) + "px,0)";
      });
    });

    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", function () {
      [].forEach.call(layers, function (el) { el.style.transform = ""; });
    });
  }

  /* ---------------------- 2. scroll-linked timeline spine ----------------------
     The vertical line fills as the section scrolls past, and each dot lights when its
     entry reaches the reading line. Scroll POSITION drives it, so stopping halfway
     leaves it halfway — that continuous link is the effect, not the fade. */

  function timelineSpine() {
    var lines = document.querySelectorAll(".fp-timeline");
    if (!lines.length) return;

    [].forEach.call(lines, function (tl) {
      var fill = document.createElement("span");
      fill.className = "fp-spine";
      tl.appendChild(fill);
      var items = tl.querySelectorAll(".fp-item");

      var update = throttled(function () {
        var r = tl.getBoundingClientRect();
        var vh = window.innerHeight;
        /* Measured against a line 45% down the viewport — where the eye actually sits
           when reading — rather than the top edge, which fills the spine well before the
           reader has got there. */
        var read = vh * 0.45;
        var p = (read - r.top) / r.height;
        fill.style.transform = "scaleY(" + Math.max(0, Math.min(1, p)).toFixed(4) + ")";

        [].forEach.call(items, function (it) {
          var ir = it.getBoundingClientRect();
          it.classList.toggle("is-lit", ir.top < read && ir.bottom > 0);
        });
      });

      window.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update, { passive: true });
      update();
    });
  }

  /* ------------------------- 3. staggered list entrance -------------------------
     Cards arrive one after another rather than as a block. The delay is capped and
     resets per container, so a long list does not end with a card waiting two seconds
     after the reader reached it. */

  function stagger() {
    var groups = document.querySelectorAll(".fp-pubs, .fp-certs, .fp-certs-top, .fp-skills");
    if (!groups.length || !("IntersectionObserver" in window)) return;

    [].forEach.call(groups, function (g) {
      [].forEach.call(g.children, function (child, i) {
        child.style.setProperty("--fp-stagger", Math.min(i, 7) * 70 + "ms");
      });
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("fp-stagger-in");
          io.unobserve(en.target);
        });
      }, { threshold: 0.08 });
      io.observe(g);
    });
  }

  /* ---------------------------- 4. magnetic buttons ----------------------------
     The button leans toward the pointer while it is near, then springs back. Capped at a
     few pixels: past that the button stops feeling responsive and starts feeling like it
     is dodging the cursor. */

  function magnetic() {
    var els = document.querySelectorAll(".fp-links .btn, .fp-cta .btn");
    [].forEach.call(els, function (el) {
      var rect = null;
      var move = throttled(function (e) {
        if (!rect) return;
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.transform = "translate3d(" + (x * 12).toFixed(1) + "px," +
                             (y * 8).toFixed(1) + "px,0)";
      });
      el.addEventListener("pointerenter", function () {
        rect = el.getBoundingClientRect();
        el.classList.add("is-magnetic");
      });
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", function () {
        el.classList.remove("is-magnetic");
        el.style.transform = "";
        rect = null;
      });
      /* A cached rect goes stale the moment the page scrolls; clearing it forces a
         re-measure on the next enter rather than pulling toward the wrong origin. */
      window.addEventListener("scroll", function () { rect = null; }, { passive: true });
    });
  }

  /* ------------------- 5. horizontal reel (publications) -------------------
     Cards run left-to-right as you scroll DOWN, like a film reel. Scroll position drives
     translateX directly, so stopping halfway leaves the reel halfway — the link is the
     effect. The section is made tall and the rail pinned inside it; that is what converts
     vertical scroll distance into horizontal travel without hijacking the wheel. */

  function reel() {
    var sec = document.querySelector("[data-reel]");
    if (!sec) return;
    var rail = sec.querySelector(".fp-reel-rail");
    if (!rail) return;

    /* The section must be tall enough for the whole rail to pass. Computed from the
       actual overflow rather than a guessed height, so adding a publication lengthens the
       scroll automatically instead of cutting the last card off. */
    function measure() {
      var over = Math.max(0, rail.scrollWidth - sec.clientWidth);
      sec.style.setProperty("--fp-reel-h", (window.innerHeight + over) + "px");
      return over;
    }
    var over = measure();

    var update = throttled(function () {
      var r = sec.getBoundingClientRect();
      var span = sec.offsetHeight - window.innerHeight;
      if (span <= 0) { rail.style.transform = ""; return; }
      var p = Math.max(0, Math.min(1, -r.top / span));
      rail.style.transform = "translate3d(" + (-p * over).toFixed(1) + "px,0,0)";
      var bar = sec.querySelector(".fp-reel-bar span");
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    });

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", function () { over = measure(); update(); }, { passive: true });
    update();
  }

  function init() {
    /* Stagger is the one effect that still runs on a phone: it costs a CSS transition
       and nothing else, and it is what makes a long list of certifications feel composed
       rather than dumped. The three pointer-linked effects need a pointer. */
    if (!reduce) stagger();
    if (reduce || coarse) return;
    heroParallax();
    timelineSpine();
    magnetic();
    reel();
  }

  /* founder.js renders the timeline and card lists from data, so none of this markup
     exists at DOMContentLoaded. Waiting for its signal rather than the DOM event is what
     makes these bind to real elements instead of an empty page. */
  document.addEventListener("aq:content", init);
})();
