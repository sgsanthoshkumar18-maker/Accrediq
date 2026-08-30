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
    accent: 0x4C6FFF,
    dim:    0x2E4AC8,
    ambient: 0x9DB4FF,
    key:     0xFFFFFF,
    link:    0x3D4A8A,
    deep:    0x000000
  };

  /* THE LIGHT THEME STILL DRAWS ON A DARK GROUND.
     Every scene here uses THREE.AdditiveBlending, which adds to what is behind it — over
     white it saturates to white and the artwork vanishes outright. So in the light theme
     the canvases keep a dark stage (styles.css, "3D SCENES IN THE LIGHT THEME"), and these
     values are tuned for THAT stage, not for paper.

     The shift from neon's teal to a blue is what ties the artwork to a page whose accent is
     #17558C: same hue family, lifted until it reads against navy. --deep-accent in the CSS
     is the same colour, so the stage wash and the particles on it agree by construction.

     NOTE what this does NOT do: it never lightens the scene toward the page. Trying to make
     these scenes genuinely light-mode means changing every material to NormalBlending and
     regenerating the glow textures, whose colour is baked in at creation — twelve files of
     change for something no test can check. */
  var LIGHT = {
    accent: 0x6E8CFF,   /* cobalt, lifted so it reads on a dark stage */
    dim:    0x3C58D8,
    ambient: 0xC3CEEA,  /* cool fill, so the blues stay blue */
    key:     0xFFFFFF,
    link:    0x1E2A5A,
    deep:    0x000000   /* the ground is black now, not a navy stage */
  };

  /* Light is the ABSENCE of the attribute, not a value — see the boot snippet, which
     removes it rather than writing "light". Reading it the other way round would make every
     scene think a fresh page was light. */
  function isLight() {
    try { return document.documentElement.getAttribute("data-theme") !== "dark"; }
    catch (e) { return false; }
  }
  function pick(light, dark, fallback) {
    if (isLight()) return light;
    return fallback != null ? fallback : dark;
  }

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
  function accent(fallback) { return pick(LIGHT.accent, NEON.accent, fallback); }
  function dim(fallback) { return pick(LIGHT.dim, NEON.dim, fallback); }
  function ambient(fallback) { return pick(LIGHT.ambient, NEON.ambient, fallback); }
  function keyLight(fallback) { return pick(LIGHT.key, NEON.key, fallback); }
  function link(fallback) { return pick(LIGHT.link, NEON.link, fallback); }
  function deep(fallback) { return pick(LIGHT.deep, NEON.deep, fallback); }

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
