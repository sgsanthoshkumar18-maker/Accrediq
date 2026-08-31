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

  /* LIGHT DRAWS EXACTLY WHAT DARK DRAWS.
     The scenes sit on one stage in both themes (styles.css, "THE SCENES KEEP ONE STAGE"), so
     there is no longer a second ground to tune a second palette against. Two palettes here
     only meant the meshwork, the globes and the helix came out a different blue depending on
     the theme, for no reason a viewer could see — and a lighter blue picked for a navy stage
     is simply wrong on black.

     Keeping LIGHT as its own object rather than aliasing NEON is deliberate: it is the hook a
     future theme would use, and it documents that the sameness is a decision, not an oversight. */
  var LIGHT = {
    accent: 0x4C6FFF,
    dim:    0x2E4AC8,
    ambient: 0x9DB4FF,
    key:     0xFFFFFF,
    link:    0x3D4A8A,
    deep:    0x000000
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
  /* THE DECORATIVE PARTICLE RAMP.
     On a dark page this is a spread of hues — blues, violets, a pink — and it reads as a
     living surface. On white the same spread reads as coloured speckle, and the request was
     for the artwork to be the one blue the primary button uses. So in the light theme the
     ramp collapses onto that blue: eight steps around #2743C9, which keeps the depth the
     varying colours were providing without introducing a second hue. */
  var LIGHT_RAMP = [0x2743C9, 0x3A57E4, 0x1B2F94, 0x4362F0, 0x2743C9, 0x3350DA, 0x243C9E, 0x4C6FFF];
  function cycle(fallback) {
    if (!isLight()) return fallback;
    if (!fallback || !fallback.length) return LIGHT_RAMP;
    /* Match the caller's length so index arithmetic downstream is unchanged. */
    var out = [];
    for (var i = 0; i < fallback.length; i++) out.push(LIGHT_RAMP[i % LIGHT_RAMP.length]);
    return out;
  }

  /* ---- how a scene should DRAW on this theme's ground ----
     These exist because the light page is white and every scene was written for black.
     Additive blending adds to what is behind it, so on white it washes out; normal blending
     with a dark ink is what actually puts a line on paper. Each takes the value the scene
     already used, so a scene that does not call them is unaffected. */
  function blending(THREE, fallback) {
    if (!THREE) return fallback;
    return isLight() ? THREE.NormalBlending : (fallback != null ? fallback : THREE.AdditiveBlending);
  }
  /* The mesh lines: the button's blue on white, the brand blue on black. */
  function lineColor(fallback) { return pick(0x2743C9, 0x4C6FFF, fallback); }
  /* Additive strokes on black can be faint and still read, because they accumulate. A single
     normal-blended stroke on white cannot, so it needs more opacity to carry. */
  function lineOpacity(fallback) {
    var v = fallback == null ? 0.34 : fallback;
    return isLight() ? Math.min(1, v * 1.75) : v;
  }
  /* Glow sprites bake their colour in at creation, so the hex has to be decided here. A
     near-white glow is right over black and invisible over white. */
  function glowHex(fallback) { return isLight() ? "#2743C9" : (fallback || "#e0f2fe"); }
  /* The travelling impulse reads as light on a dark organ and as ink on a pale one. */
  function impulseHex(fallback) { return isLight() ? "#1B2F94" : (fallback || "#ffffff"); }
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
  /* A theme flip matters more than a palette flip for anything drawn in WebGL: the palette
     only changes which blues are used, while the theme changes the GROUND those blues are
     drawn on, and with it the blending mode and the baked glow colours. Scenes register the
     same way for both. */
  var themeWatchers = [];
  function onTheme(fn) {
    if (typeof fn === "function") themeWatchers.push(fn);
  }
  try {
    window.addEventListener("aq:theme", function () {
      themeWatchers.forEach(function (fn) { try { fn(isLight()); } catch (err) {} });
    });
  } catch (e) {}

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
    blending: blending, lineColor: lineColor, lineOpacity: lineOpacity,
    glowHex: glowHex, impulseHex: impulseHex,
    isLight: isLight,
    onChange: onChange,
    onTheme: onTheme
  };
})();
