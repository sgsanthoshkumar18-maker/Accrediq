/* AQcredix — 3D tilt on the hero mark, and on the mark ONLY.
 *
 * WHAT THIS IS. The effect people know from Aceternity's 3D card: the thing tilts toward
 * the pointer, and its parts sit at different depths so they slide against each other as
 * it turns. That library is React + Tailwind + a build step. This site is static HTML with
 * vanilla JS and no dependencies, which is deliberate, so the effect is rebuilt natively.
 *
 * ONLY THE LOGO MOVES. The headline beside it is left alone: a mark that tilts reads as a
 * physical object you could pick up, while a whole tilting section reads as a gimmick and
 * makes text harder to read at exactly the moment someone is trying to read it.
 *
 * WHY IT CLONES THE SVG INSTEAD OF USING ONE.
 * The depth is the whole point, and translateZ on children INSIDE a single <svg> is not
 * reliably supported — SVG has its own coordinate system and preserve-3d does not
 * propagate into it across engines. So the mark is split into three stacked copies, each
 * showing one part, each at its own Z. Cloning happens here rather than in the HTML so the
 * page still renders the normal mark with JS off, and index.html keeps one <svg>.
 *
 * The ring's rotation animation is untouched: it lives on .hero-logo-arc, and only the
 * clone that keeps the arc still carries it, so nothing animates invisibly.
 */
(function () {
  "use strict";

  var MAX_TILT = 13;        /* degrees. Past ~15 the letterform starts to look bent. */
  var LAYERS = [
    { keep: "circle", z: 0 },              /* the static ring sits on the base plane */
    { keep: ".hero-logo-arc", z: 22 },     /* the travelling arc lifts off it */
    { keep: "path:not(.hero-logo-arc)", z: 42 }  /* the A stands proudest */
  ];

  function init() {
    var svg = document.querySelector(".hero-headline .hero-logo");
    if (!svg || svg.closest(".aq3d")) return;

    /* Hover is the entire interaction, so a device without it gets nothing — and a tilt
       that never resets because there was no pointerleave is worse than no tilt. Reduced
       motion opts out for the obvious reason. */
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    } catch (e) { return; }

    var wrap = document.createElement("span");
    wrap.className = "aq3d";
    var stack = document.createElement("span");
    stack.className = "aq3d-stack";
    wrap.appendChild(stack);
    svg.parentNode.insertBefore(wrap, svg);

    LAYERS.forEach(function (layer, i) {
      var copy = svg.cloneNode(true);
      copy.classList.add("aq3d-layer");
      copy.style.setProperty("--z", layer.z + "px");
      /* Strip everything this layer is not responsible for, so the arc animation exists
         once and screen readers meet one label rather than three. */
      Array.prototype.forEach.call(copy.querySelectorAll("circle, path"), function (el) {
        if (!el.matches(layer.keep)) el.remove();
      });
      if (i === 0) { copy.classList.add("aq3d-base"); }
      else { copy.setAttribute("aria-hidden", "true"); copy.removeAttribute("role"); copy.removeAttribute("aria-label"); }
      stack.appendChild(copy);
    });
    svg.remove();

    var raf = 0, tx = 0, ty = 0;

    function apply() {
      raf = 0;
      stack.style.transform = "rotateX(" + ty.toFixed(2) + "deg) rotateY(" + tx.toFixed(2) + "deg)";
    }

    wrap.addEventListener("pointermove", function (e) {
      var r = wrap.getBoundingClientRect();
      if (!r.width || !r.height) return;
      /* -0.5 .. 0.5 from the centre, so the tilt is symmetrical and zero in the middle. */
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      tx = px * MAX_TILT * 2;
      ty = -py * MAX_TILT * 2;   /* negative: pointer above centre should tip the top back */
      wrap.classList.add("is-live");
      /* One write per frame. Setting transform straight from pointermove fires far more
         often than the screen refreshes and makes the tilt feel gritty rather than smooth. */
      if (!raf) raf = requestAnimationFrame(apply);
    });

    wrap.addEventListener("pointerleave", function () {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      /* Dropping is-live restores the transition, so it eases home instead of snapping. */
      wrap.classList.remove("is-live");
      tx = ty = 0;
      stack.style.transform = "";
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
