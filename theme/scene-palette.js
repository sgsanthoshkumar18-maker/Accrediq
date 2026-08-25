/* AQcredix — the colours the 3D scenes draw with.
 *
 * WHY THIS EXISTS.
 * Nine WebGL scenes — the hero organs, the brain, both globes, the galaxy, the helix, the
 * DNA strand, the radar, the KPI network — each picked their own hex values at the time
 * they were written. That was fine while there was one dark palette. It stopped being fine
 * the moment a second was added: the page turns and the artwork in the middle of it does
 * not, which reads as broken rather than as partial.
 *
 * A canvas cannot inherit a CSS variable, so the palette has to be handed to it. This is
 * that hand-off, and it is deliberately the ONLY place a scene colour is decided.
 *
 * EVERY LOOKUP TAKES A FALLBACK.
 * A scene that loads before this file, or on a page that does not include it, must go on
 * working exactly as it did. So the shape is always palette(fallback) and never
 * palette() — a missing module degrades to the colours the scene shipped with rather than
 * to black.
 */
window.AQScenePalette = (function () {
  "use strict";

  function name() {
    try {
      return document.documentElement.getAttribute("data-palette") || "default";
    } catch (e) { return "default"; }
  }

  var NEON = {
    accent: 0x5EEAD4,
    dim:    0x2DD4BF,
    ambient: 0x9DB4FF,
    key:     0xFFFFFF,
    link:    0x3D4A8A,
    deep:    0x06322C
  };

  /* Each of these answers "what should this scene use", and falls back to what the scene
     already had. No palette overrides the chapter, category or cycle colours any more — a
     third palette used to, and was removed — so those three hand the scene's own values
     straight back. They are kept rather than deleted because every scene calls them, and
     because this is where a future palette would hook in.

     NOTE the asymmetry: the lighting helpers below fall back to NEON rather than to the
     caller's value when none is passed. That is deliberate and predates the third palette. */
  function chapters(fallback) { return fallback; }
  function categories(fallback) { return fallback; }
  function cycle(fallback) { return fallback; }
  function accent(fallback) { return fallback != null ? fallback : NEON.accent; }
  function dim(fallback) { return fallback != null ? fallback : NEON.dim; }
  function ambient(fallback) { return fallback != null ? fallback : NEON.ambient; }
  function keyLight(fallback) { return fallback != null ? fallback : NEON.key; }
  function link(fallback) { return fallback != null ? fallback : NEON.link; }
  function deep(fallback) { return fallback != null ? fallback : NEON.deep; }

  /* A scene registers here to be told the palette moved. The owner switching palettes is
     rare enough that a full reload would be acceptable — but a reload loses the camera,
     the morph position and any node the visitor had open, so scenes that can re-tint
     themselves should. Those that cannot simply do not subscribe. */
  var watchers = [];
  function onChange(fn) {
    if (typeof fn !== "function") return;
    watchers.push(fn);
  }
  try {
    window.addEventListener("aq:palette", function (e) {
      var p = (e && e.detail && e.detail.palette) || name();
      watchers.forEach(function (fn) { try { fn(p); } catch (err) {} });
    });
  } catch (e) {}

  return {
    name: name,
    chapters: chapters, categories: categories, cycle: cycle,
    accent: accent, dim: dim, ambient: ambient, key: keyLight,
    link: link, deep: deep,
    onChange: onChange
  };
})();
