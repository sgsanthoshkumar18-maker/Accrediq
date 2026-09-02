/* AQcredix — the cinematic reveal system.
 *
 * WHAT IT IS. One IntersectionObserver, a class, and a CSS custom property for the delay.
 * The animation itself lives entirely in cinematic.css; this file decides only WHEN each
 * element arrives and IN WHAT ORDER. Keeping the motion in CSS is what lets the whole system
 * be retuned from five numbers at the top of that file without touching any JavaScript.
 *
 * WHY NOT GSAP, SCROLLTRIGGER OR LENIS. Three reasons, in order of weight:
 *
 *   1. motion.js already runs an inertial scroll on the real scroll position. Lenis would be
 *      a second controller competing with it for the same property — not a style choice, a
 *      bug. The existing one is also tuned: its ease was moved from 0.11 to 0.22 because the
 *      page kept gliding after the wheel stopped.
 *   2. There is no build step and no node_modules, so these would be CDN tags — roughly 80KB
 *      to schedule transitions a 40-line observer already schedules.
 *   3. Everything asked for here is a transition on transform, opacity, clip-path or filter.
 *      That is what a browser is already good at. A library earns its weight when you need
 *      timeline scrubbing or physics; none of this does.
 *
 * WHAT IT DOES NOT TOUCH. Page transitions, parallax, split-text headings, the automatic
 * .section reveal and the smooth scroll all live in motion.js and are left alone. This is
 * additive and opt-in: an element with no data-cine attribute is never selected, never
 * hidden, and never observed.
 *
 * ------------------------------------------------------------------ how to use
 *   data-cine="rise"     quiet lift and fade         — body copy, lists, cards
 *   data-cine="wipe"     clip-path reveal from below — headings, editorial statements
 *   data-cine="image"    blur-to-sharp behind a mask — portraits, screenshots, posters
 *   data-cine="letters"  word-by-word rise           — one short heading per page, at most
 *
 *   data-cine-seq        on a PARENT: its data-cine children arrive in order
 *   data-cine-delay="n"  extra delay in ms, on any of the above
 *   data-cine-hover      subtle lift on hover
 *   data-cine-underline  underline that draws from the left
 */
(function () {
  "use strict";

  var root = document.documentElement;

  /* Marking the html element is what arms the CSS. If this script fails to load or throws
     before this line, every [data-cine] element simply renders normally — the page can never
     be left with content hidden waiting for an observer that will never run. */
  root.classList.add("aq-cine");

  var REDUCED = false;
  try { REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var all = [].slice.call(document.querySelectorAll("[data-cine]"));
  if (!all.length) return;

  /* Reduced motion, or a browser without IntersectionObserver: show everything now. Leaving
     content hidden because a capability is missing is the worst possible failure here. */
  if (REDUCED || !("IntersectionObserver" in window)) {
    all.forEach(function (el) { el.classList.add("is-cine-in"); });
    return;
  }

  /* --------------------------------------------------- word splitting for "letters"
     Each word is wrapped in a clipping span with the moving part inside it, so the words
     rise out from behind their own edge rather than sliding over the text above. Done once,
     at start-up, and only for elements that ask for it. */
  function splitWords(el) {
    if (el.dataset.cineSplit === "1") return;
    var text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text) return;
    var words = text.split(" ");
    var html = "";
    for (var i = 0; i < words.length; i++) {
      /* The index rides on a custom property so the stagger is computed in CSS. Writing a
         transition-delay per word here would put the timing in two places. */
      html += '<span class="cine-w" style="--cine-i:' + i + '"><i>' +
        words[i].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
        "</i></span>";
      if (i < words.length - 1) html += " ";
    }
    el.innerHTML = html;
    el.dataset.cineSplit = "1";
  }

  all.forEach(function (el) {
    if (el.getAttribute("data-cine") === "letters") splitWords(el);
  });

  /* --------------------------------------------------- sequencing
     A section marked data-cine-seq gives its children an increasing delay, so the heading
     lands, then the subtitle, then the image, then the details. That order is the whole
     point: things arriving together read as a page loading, things arriving in sequence read
     as a page being presented.

     The delay is written once here rather than recomputed on every intersection — the value
     never changes, and setting a style property during a scroll callback is exactly the kind
     of write that causes a frame to be dropped. */
  var STEP = 90;
  try {
    var s = getComputedStyle(root).getPropertyValue("--cine-stagger").trim();
    if (/^\d+(\.\d+)?ms$/.test(s)) STEP = parseFloat(s);
  } catch (e) {}

  [].slice.call(document.querySelectorAll("[data-cine-seq]")).forEach(function (parent) {
    var kids = [].slice.call(parent.querySelectorAll("[data-cine]"));
    kids.forEach(function (el, i) {
      /* An explicit per-element delay wins, so one item in a sequence can be held back. */
      var own = parseInt(el.getAttribute("data-cine-delay") || "", 10);
      var d = isFinite(own) ? own : i * STEP;
      el.style.setProperty("--cine-delay", d + "ms");
    });
  });

  /* Elements outside a sequence may still carry their own delay. */
  all.forEach(function (el) {
    if (el.style.getPropertyValue("--cine-delay")) return;
    var own = parseInt(el.getAttribute("data-cine-delay") || "", 10);
    if (isFinite(own)) el.style.setProperty("--cine-delay", own + "ms");
  });

  /* --------------------------------------------------- the observer
     rootMargin pulls the trigger line up from the bottom of the viewport so an element has
     begun arriving by the time it is properly in view, rather than starting the moment its
     first pixel appears and finishing well below the fold.

     Each element is unobserved once it has arrived: these are entrances, not scroll-linked
     effects, and an observer still watching a hundred settled elements is pure cost. */
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e.isIntersecting) continue;
      e.target.classList.add("is-cine-in");
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

  /* showAll is the escape hatch, so it must SHOW, not ask. is-cine-in only starts a
     transition; in exactly the situations this function exists for — no viewport, no
     observer, a prerendered tab — that transition may never run, and the element would keep
     its hidden start state while carrying the class that claims it arrived. */
  function showAll() {
    all.forEach(function (el) {
      el.classList.add("is-cine-in");
      el.classList.add("is-cine-shown");
    });
    try { io.disconnect(); } catch (e) {}
  }

  /* Is this element actually rendered, or only claiming to be? "drop" starts clipped to
     inset(100% 0 0 0), which is invisible at any opacity, so both have to be asked. */
  function looksHidden(el) {
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (parseFloat(cs.opacity) < 0.99) return true;
    var cp = cs.clipPath || cs.webkitClipPath || "";
    /* inset(100%…) and anything near it still hides the element outright. */
    return /inset\(\s*(?:9\d(?:\.\d+)?|100)%/.test(cp);
  }

  function forceShown(el) {
    el.classList.add("is-cine-in");
    if (looksHidden(el)) el.classList.add("is-cine-shown");
  }

  /* NO VIEWPORT, NO ANIMATION. A page can be laid out with zero height — a hidden or
     prerendered tab, an offscreen embed. An entrance animation has no meaning there, and an
     IntersectionObserver has nothing to intersect against, so every element would sit hidden
     until something resized. Showing the content is always the right failure. */
  if (!window.innerHeight || !window.innerWidth) {
    showAll();
    /* If it later gains a viewport it is already visible, which is correct: the visitor did
       not watch it arrive, and revealing content twice is not a thing. */
    return;
  }

  all.forEach(function (el) {
    /* Anything already on screen at load arrives immediately rather than waiting for a
       scroll that may never come — on a short page, or when a visitor lands mid-document. */
    var r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) {
      el.classList.add("is-cine-in");
      return;
    }
    io.observe(el);
  });

  /* LAST RESORT. If something has gone wrong — an observer that never fires, a layout that
     settles late, a browser quirk — content must not stay hidden. After a few seconds,
     anything still waiting is simply shown. This should never fire; it exists because the
     cost of it firing is a missed animation, and the cost of it not existing is a blank
     section. */
  /* THE QUESTION IS "IS IT VISIBLE", NOT "DOES IT HAVE THE CLASS". This previously looked for
     elements MISSING is-cine-in, which meant the one failure that matters — the class applied
     but the transition never run, leaving the element at its hidden start state — was the
     single case the backstop could not see. Ask the rendered result instead. */
  setTimeout(function () {
    all.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) forceShown(el);
    });
  }, 4000);

  /* A tab backgrounded during load runs no transitions, so an element can be told to arrive
     and simply never move. When the visitor comes back, anything still hidden is shown
     outright — they have missed the animation either way, and a blank headline is not a
     lesser failure than a missing one. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    all.forEach(function (el) {
      if (el.classList.contains("is-cine-in") && looksHidden(el)) {
        el.classList.add("is-cine-shown");
      }
    });
  });

  /* A page restored from the back/forward cache keeps the classes it had, which is correct.
     Nothing to undo — recorded here because the absence of a pageshow handler is deliberate. */
})();
