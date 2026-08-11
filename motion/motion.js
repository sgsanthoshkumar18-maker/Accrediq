/* AQcredix — motion layer.
 *
 * Four effects, one file, no library and no build step:
 *   1. inertial scroll   — the page glides instead of stepping
 *   2. parallax          — marked elements drift against the scroll
 *   3. scroll reveals    — sections rise into place as they enter the viewport
 *   4. page transitions  — a fade between pages rather than a white flash
 *
 * DESIGN CONSTRAINTS, each learned from something on this site:
 *
 * - The scroll is driven by window.scrollTo on the REAL scroll position, not by
 *   transforming a wrapper element. A transform wrapper is the usual shortcut and it
 *   would break two things here: `.site-header` is sticky, and it carries
 *   backdrop-filter, which makes it the containing block for fixed descendants — the
 *   same property that collapsed the mobile menu. Native scroll keeps the header,
 *   the scrollbar, Ctrl+F, and anchor links behaving normally.
 *
 * - Everything is off by default on touch devices. Phone scrolling is already inertial
 *   in hardware; intercepting it makes a page feel laggy rather than smooth, and this
 *   site is used on wards.
 *
 * - prefers-reduced-motion disables all four outright. Vestibular disorders are real
 *   and this is a healthcare product.
 *
 * - The reveal sets a class, never inline styles, so all colour and easing stay in
 *   tokens and light/dark/neon keep following automatically.
 *
 * Deliberately NOT built: scroll-jacking / full-page snap panels. AQcredix is a
 * reference tool — a quality manager is usually hunting for one element inside a long
 * chapter, and snapping fights that. It is the one effect that would make the site
 * look modern and work worse.
 */
(function () {
  "use strict";

  var reduce = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  var coarse = false;
  try {
    coarse = window.matchMedia("(pointer: coarse)").matches;
  } catch (e) {}

  var root = document.documentElement;

  /* ============================ 1. inertial scroll ============================ */

  var Smooth = (function () {
    var target = 0, current = 0, running = false, raf = null;
    var EASE = 0.11;          // per-frame approach; higher is snappier, lower is looser
    var SETTLE = 0.4;         // px below which we snap and stop, so we never idle-spin

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function frame() {
      var diff = target - current;
      if (Math.abs(diff) < SETTLE) {
        current = target;
        window.scrollTo(0, Math.round(current));
        running = false;
        raf = null;
        Parallax.update(current);
        return;
      }
      current += diff * EASE;
      window.scrollTo(0, Math.round(current));
      Parallax.update(current);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }

    function onWheel(e) {
      /* Leave pinch-zoom and browser zoom alone, and leave any scrollable panel alone —
         a modal body or a wide table scrolls itself, and stealing that wheel event traps
         the user inside a box they cannot move. */
      if (e.ctrlKey || e.metaKey) return;
      if (closestScrollable(e.target)) return;

      e.preventDefault();

      /* deltaMode 1 is lines, 2 is pages. Firefox reports lines, so a raw deltaY there
         is ~3 instead of ~100 and the page would barely move. */
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 18;
      else if (e.deltaMode === 2) d *= window.innerHeight;

      target = clamp(target + d, 0, maxScroll());
      start();
    }

    function closestScrollable(node) {
      while (node && node !== document.body && node.nodeType === 1) {
        var s = getComputedStyle(node);
        var oy = s.overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 2) {
          return node;
        }
        node = node.parentNode;
      }
      return null;
    }

    function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

    /* Anything that moves the page by other means — a keyboard PageDown, a scrollbar
       drag, an anchor jump, a browser restore — must resync the target, or the next
       wheel tick would yank the page back to where the engine last thought it was. */
    function resync() {
      if (running) return;
      target = current = window.scrollY || window.pageYOffset || 0;
    }

    function scrollToY(y, instant) {
      y = clamp(y, 0, maxScroll());
      if (instant || reduce) {
        window.scrollTo(0, y);
        target = current = y;
        Parallax.update(y);
        return;
      }
      target = y;
      current = window.scrollY || 0;
      start();
    }

    function init() {
      target = current = window.scrollY || 0;
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("scroll", resync, { passive: true });
      window.addEventListener("resize", function () {
        target = clamp(target, 0, maxScroll());
      }, { passive: true });

      /* In-page anchors glide too, and the sticky header height is subtracted so the
         target heading does not land underneath it. */
      document.addEventListener("click", function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute("href");
        if (!id || id === "#") return;
        var el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        var head = document.querySelector(".site-header");
        var off = head ? head.offsetHeight + 12 : 12;
        scrollToY(el.getBoundingClientRect().top + (window.scrollY || 0) - off);
        history.replaceState(null, "", id);
      });
    }

    return { init: init, scrollToY: scrollToY, resync: resync };
  })();

  /* ================================ 2. parallax ================================ */

  var Parallax = (function () {
    var items = [];

    function collect() {
      items = [].slice.call(document.querySelectorAll("[data-parallax]")).map(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax"));
        return { el: el, speed: isNaN(speed) ? 0.15 : speed, top: 0, h: 0 };
      });
      measure();
    }

    function measure() {
      var y = window.scrollY || 0;
      items.forEach(function (it) {
        var r = it.el.getBoundingClientRect();
        it.top = r.top + y;
        it.h = r.height;
      });
    }

    function update(y) {
      if (!items.length) return;
      var vh = window.innerHeight;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        // Skip anything off screen: transforming it costs a composite for nothing.
        if (it.top + it.h < y - vh || it.top > y + vh * 2) continue;
        /* Measured from the element's own centre crossing the viewport centre, so the
           element sits at its authored position when centred and drifts either side.
           Anchoring to raw scrollY instead would push every element progressively out
           of place the further down the page it sits. */
        var rel = (y + vh / 2) - (it.top + it.h / 2);
        it.el.style.transform = "translate3d(0," + (rel * it.speed).toFixed(2) + "px,0)";
      }
    }

    return {
      init: function () {
        collect();
        window.addEventListener("resize", measure, { passive: true });
        update(window.scrollY || 0);
      },
      update: update,
      measure: measure
    };
  })();

  /* ============================== 3. scroll reveals ============================== */

  var Reveal = (function () {
    function init() {
      var els = document.querySelectorAll(
        ".section, .card, .std-block, .ch-card, .dept-card, .kpi-card, " +
        ".acc-band, .lens-strip, .humor, [data-reveal]"
      );
      if (!els.length) return;

      if (!("IntersectionObserver" in window)) {
        // No observer: show everything rather than leaving the page blank.
        [].forEach.call(els, function (el) { el.classList.add("aq-in"); });
        return;
      }

      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("aq-in");
          /* Reveal once. Re-hiding on scroll-up makes a long standards page flicker
             every time someone scrolls back to re-read something. */
          io.unobserve(en.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.04 });

      [].forEach.call(els, function (el, i) {
        el.classList.add("aq-reveal");
        /* A small stagger within a row reads as considered; beyond a few items it reads
           as slow, so it is capped rather than multiplied by index indefinitely. */
        var d = Math.min(i, 4) * 55;
        if (d) el.style.setProperty("--aq-delay", d + "ms");
        io.observe(el);
      });
    }
    return { init: init };
  })();

  /* ============================= 4. page transitions ============================= */

  var Transition = (function () {
    function isInternal(a) {
      if (!a || !a.href) return false;
      if (a.target && a.target !== "_self") return false;
      if (a.hasAttribute("download")) return false;
      if (a.getAttribute("href").charAt(0) === "#") return false;
      if (/^(mailto:|tel:|javascript:)/i.test(a.getAttribute("href"))) return false;
      try {
        var u = new URL(a.href, location.href);
        if (u.origin !== location.origin) return false;
        // Same page, different hash — that is an anchor jump, not a navigation.
        if (u.pathname === location.pathname && u.hash) return false;
        return true;
      } catch (e) { return false; }
    }

    function init() {
      root.classList.add("aq-page-enter");
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.remove("aq-page-enter"); });
      });

      document.addEventListener("click", function (e) {
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest && e.target.closest("a");
        if (!isInternal(a)) return;

        e.preventDefault();
        root.classList.add("aq-page-leave");
        var href = a.href;
        /* A hard timeout, not a transitionend listener. If the fade is interrupted —
           a background tab, a dropped frame — transitionend never fires and the click
           would simply do nothing, which is far worse than an unfaded navigation. */
        setTimeout(function () { location.href = href; }, 190);
      });

      /* Coming back via the Back button restores from cache with the leave class still
         applied, which would leave the page faded out and apparently blank. */
      window.addEventListener("pageshow", function (ev) {
        if (ev.persisted) root.classList.remove("aq-page-leave");
      });
    }

    return { init: init };
  })();

  /* ================================== start-up ================================== */

  function start() {
    if (reduce) {
      /* Everything visible, nothing moving. The reveal class is what hides content
         before it animates, so it must never be applied here. */
      root.classList.add("aq-motion-off");
      return;
    }

    Reveal.init();
    Transition.init();
    Parallax.init();

    // Inertial scroll on pointer devices only; a phone already has momentum in hardware.
    if (!coarse) {
      Smooth.init();
      root.classList.add("aq-smooth");
    }

    /* Late-loading content — the injected footer, the standards list, a chapter render —
       changes the document height and the parallax anchors. Re-measure rather than
       trusting the positions captured at load. */
    window.addEventListener("load", function () {
      Parallax.measure();
      Smooth.resync();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  window.AQMotion = {
    scrollTo: function (y) { Smooth.scrollToY(y); },
    refresh: function () { Parallax.measure(); Smooth.resync(); },
    reduced: reduce
  };
})();
