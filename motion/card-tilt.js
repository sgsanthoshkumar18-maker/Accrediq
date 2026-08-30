/* AQcredix — 3D tilt on flat cards (video thumbnails today).
 *
 * WHY CARDS AND NOT THE 3D SCENES. A CSS tilt works on anything flat: it rotates the
 * element's own box. The globes, brain and DNA are WebGL scenes with their own camera and
 * drag controls, so a CSS rotation on top means two transforms fighting and a drag that
 * both spins the globe and tips its container. Those need camera parallax inside the scene
 * instead. A video card has no such conflict, which is why the effect belongs here.
 *
 * IT MUST NOT EAT THE CLICK. The tilt lives on a wrapper and never calls preventDefault,
 * so play still fires on the first press. It also releases the moment playback starts —
 * a video that tips while you are watching it is an irritation, not an effect.
 */
(function () {
  "use strict";
  var MAX = 9;   /* degrees. A card is wider than a logo, so it needs less angle to read. */

  function init() {
    var cards = document.querySelectorAll(".video-embed");
    if (!cards.length) return;
    try {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    } catch (e) { return; }

    Array.prototype.forEach.call(cards, function (card) {
      if (card.dataset.tilt3d) return;
      card.dataset.tilt3d = "1";
      card.classList.add("aq-tilt");

      var raf = 0, rx = 0, ry = 0, playing = false;

      function apply() {
        raf = 0;
        card.style.transform =
          "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) +
          "deg) translateZ(14px)";
      }
      card.addEventListener("pointermove", function (e) {
        if (playing) return;
        var r = card.getBoundingClientRect();
        if (!r.width || !r.height) return;
        ry = ((e.clientX - r.left) / r.width - 0.5) * MAX * 2;
        rx = -((e.clientY - r.top) / r.height - 0.5) * MAX * 2;
        card.classList.add("is-tilting");
        if (!raf) raf = requestAnimationFrame(apply);
      });
      function rest() {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        card.classList.remove("is-tilting");
        card.style.transform = "";
      }
      card.addEventListener("pointerleave", rest);
      /* Any real video inside settles the card as soon as it starts. */
      card.addEventListener("play", function () { playing = true; rest(); }, true);
      card.addEventListener("pause", function () { playing = false; }, true);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
