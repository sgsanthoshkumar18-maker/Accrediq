/* AQcredix — scrollytelling.
 *
 * A section pins while the page keeps scrolling, and scroll position advances it through
 * a set of stages. Markup drives everything:
 *
 *   <section data-scrolly>
 *     <div data-scrolly-sticky>   the thing that stays put and changes
 *     <div data-scrolly-step>     one per stage; entering it activates that stage
 *
 * Active step gets .is-active; the sticky element gets data-stage="N" so CSS can react.
 * Progress within the section is published as --scrolly-p (0..1) for anything continuous.
 *
 * BUILT ON position:sticky, NOT on transforms or scroll interception. The browser does
 * the pinning natively, which means the scrollbar stays honest, Ctrl+F still works, and
 * the inertial scroll engine in motion.js needs no special case. Intercepting the wheel
 * to fake a pin is what earns scrollytelling its bad name.
 */
(function () {
  "use strict";

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  /* Phones AND tablets. 1024px covers an iPad in portrait (768) and in landscape (1024),
     plus every Android tablet in common use. Pinning on a touch device fights the address
     bar resizing as you scroll, and a tablet held in portrait has too little height for a
     pinned card and its text to share. Touch is checked as well as width, so a small
     laptop window still gets the effect while a large tablet does not. */
  var narrow = false;
  try {
    narrow = window.matchMedia("(max-width: 1024px)").matches ||
             window.matchMedia("(pointer: coarse)").matches;
  } catch (e) {}

  function init() {
    var sections = document.querySelectorAll("[data-scrolly]");
    if (!sections.length) return;

    /* Reduced motion, or a phone: show every stage stacked and readable, and never pin.
       Pinning on a small screen fights the address bar resizing on scroll, and the whole
       point of the section is the content, which stacking preserves in full. */
    if (reduce || narrow) {
      document.documentElement.classList.add("scrolly-off");
      return;
    }

    [].forEach.call(sections, function (sec) {
      if (sec.hasAttribute("data-scrolly-wired")) return;
      var steps = sec.querySelectorAll("[data-scrolly-step]");
      var sticky = sec.querySelector("[data-scrolly-sticky]");
      if (!steps.length || !sticky) return;
      sec.setAttribute("data-scrolly-wired", "1");

      var current = -1;

      function setStage(n) {
        if (n === current) return;
        current = n;
        sticky.setAttribute("data-stage", String(n));
        [].forEach.call(steps, function (s, i) {
          s.classList.toggle("is-active", i === n);
        });
      }

      /* A step is active when it crosses the middle of the viewport. Using the middle
         rather than the top means the text a reader is actually looking at is the one
         driving the visual — anchoring to the top activates the next stage while the
         previous paragraph is still being read. */
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          var i = [].indexOf.call(steps, en.target);
          if (i >= 0) setStage(i);
        });
      }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

      [].forEach.call(steps, function (s) { io.observe(s); });
      setStage(0);

      /* Continuous progress for anything that should move smoothly rather than snap.
         Read in a rAF on scroll rather than computed per frame regardless: this runs on
         every scroll event on the homepage and getBoundingClientRect forces layout. */
      var ticking = false;
      function measure() {
        ticking = false;
        var r = sec.getBoundingClientRect();
        var total = r.height - window.innerHeight;
        if (total <= 0) return;
        var p = Math.min(1, Math.max(0, -r.top / total));
        sec.style.setProperty("--scrolly-p", p.toFixed(4));
      }
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(measure);
      }, { passive: true });
      window.addEventListener("resize", measure, { passive: true });
      measure();
    });
  }

  /* Same reason as the reveal re-scan: the founder page renders its steps from data, so
     the observers must be built again once that markup exists. `wired` stops a second
     pass from double-observing the same steps. */
  document.addEventListener("aq:content", init);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
