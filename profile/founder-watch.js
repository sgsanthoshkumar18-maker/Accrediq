/* AQcredix — the hero mark watches the cursor.
 *
 * The reference site does this with a rigged 3-D character whose head turns to follow the
 * pointer. That is a modelled asset, not code. What IS code is the behaviour, and the
 * behaviour is what makes the page feel alive: something on screen is aware of you.
 *
 * So the ring mark does the watching instead — the arc rotates toward the pointer, an
 * iris tracks it, and the whole mark leans on two axes. It is the platform's own brand
 * doing the looking, which is better than a stock avatar that says nothing about the
 * hospital-quality work this page is about.
 */
(function () {
  "use strict";

  var stage = document.getElementById("fpWatch");
  if (!stage) return;

  var reduce = false, coarse = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  try { coarse = matchMedia("(pointer: coarse)").matches; } catch (e) {}

  var iris = stage.querySelector(".fpw-iris");
  var arc = stage.querySelector(".fpw-arc");
  var mark = stage.querySelector(".fpw-mark");
  if (!iris || !arc || !mark) return;

  /* On a phone there is no pointer to follow. Rather than sitting dead, the mark drifts
     on a slow figure-of-eight so the page still reads as alive — the same intent, driven
     by time instead of input. */
  if (coarse && !reduce) {
    var t0 = performance.now();
    (function drift(now) {
      var t = (now - t0) / 1000;
      apply(Math.cos(t * 0.55) * 0.42, Math.sin(t * 0.8) * 0.30);
      requestAnimationFrame(drift);
    })(t0);
    return;
  }
  if (reduce || coarse) return;

  var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

  function apply(x, y) {
    /* The iris travels furthest, the arc rotates, the mark leans least. Three different
       amounts from one input is what sells it as one object looking rather than three
       elements sliding. */
    iris.style.transform = "translate(" + (x * 13).toFixed(1) + "px," + (y * 13).toFixed(1) + "px)";
    arc.style.transform = "rotate(" + (x * 26).toFixed(1) + "deg)";
    mark.style.transform =
      "perspective(600px) rotateY(" + (x * 13).toFixed(1) + "deg) rotateX(" +
      (-y * 11).toFixed(1) + "deg)";
  }

  function frame() {
    // Ease toward the target so the mark has weight instead of snapping to the cursor.
    cx += (tx - cx) * 0.10;
    cy += (ty - cy) * 0.10;
    apply(cx, cy);
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
      raf = requestAnimationFrame(frame);
    } else raf = null;
  }

  /* Tracked on the WINDOW, not the mark. Watching only its own box means the mark stares
     straight ahead until the cursor is already on it, which is the opposite of the
     effect — it should notice you crossing the page. */
  window.addEventListener("pointermove", function (e) {
    var r = stage.getBoundingClientRect();
    var mx = r.left + r.width / 2, my = r.top + r.height / 2;
    // Normalised and clamped, so a cursor at the far edge does not push the eye out.
    tx = Math.max(-1, Math.min(1, (e.clientX - mx) / (window.innerWidth / 2)));
    ty = Math.max(-1, Math.min(1, (e.clientY - my) / (window.innerHeight / 2)));
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });

  // Looking straight ahead again when the pointer leaves reads as attention ending.
  document.addEventListener("pointerleave", function () {
    tx = 0; ty = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  });
})();
