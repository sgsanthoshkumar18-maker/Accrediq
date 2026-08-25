/* AQcredix — the colours the 3D scenes draw with.
 *
 * WHY THIS EXISTS.
 * Nine WebGL scenes — the hero organs, the brain, both globes, the galaxy, the helix, the
 * DNA strand, the radar, the KPI network — each picked their own hex values at the time
 * they were written. That was fine while there was one dark palette. It stopped being fine
 * the moment the site had three: the page turns and the artwork in the middle of it does
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

  /* THE BIOLUMINESCENT MEDICAL-TECH FAMILIES.
     Kept under the key "BLOOD" because that is the palette name the site publishes, the
     word the owner types and the value every test asserts — renaming it would churn the
     plumbing to no benefit. */
  var BLOOD = {
    /* The chart/scene sequence the theme specifies, in order: cyan, blue, violet, orange,
       red, gold. A scene taking the first three gets the three that carry the identity, and
       nothing has to reach for a seventh colour and invent one. */
    chapters: {
      AAC: 0x36CFDB,   // cyan   — quality, technology
      COP: 0x298BB0,   // blue   — clinical data
      MOM: 0x8262AF,   // violet — analytics
      PRE: 0xEB9345,   // orange — attention
      IPC: 0xC94437,   // red    — critical
      PSQ: 0xECB749,   // gold   — achievement
      ROM: 0xB75B71,   // magenta
      FMS: 0x335685,   // deep blue
      HRM: 0xF5D69B,   // hot gold
      IMS: 0x2C3355    // navy
    },
    cycle: [0x36CFDB, 0x298BB0, 0x8262AF, 0xEB9345, 0xC94437, 0xECB749, 0xB75B71, 0x335685],
    /* Category colours keep the semantic mapping the CSS uses, so a CORE element is the
       same red in the galaxy as it is in a table. */
    categories: { CORE: 0xC94437, Commitment: 0xEB9345,
                  Achievement: 0xECB749, Excellence: 0x8262AF },
    accent: 0x36CFDB,
    dim:    0x298BB0,
    /* Cool ambient, near-white key. A warm key would wash the cyan out and cost half the
       palette; the warmth in this theme comes from the accents, not from the lighting. */
    ambient: 0x8FB8D9,
    key:     0xF5F5F2,
    link:    0x2C3355,
    deep:    0x10110E
  };

  var NEON = {
    accent: 0x5EEAD4,
    dim:    0x2DD4BF,
    ambient: 0x9DB4FF,
    key:     0xFFFFFF,
    link:    0x3D4A8A,
    deep:    0x06322C
  };

  function isBlood() { return name() === "blood"; }

  /* Each of these answers "what should this scene use", and falls back to what the scene
     already had. Only blood overrides today; neon and default keep their own values, which
     is why there is no NEON.chapters — nothing about those two changed. */
  function chapters(fallback) { return isBlood() ? BLOOD.chapters : fallback; }
  function categories(fallback) { return isBlood() ? BLOOD.categories : fallback; }
  function cycle(fallback) { return isBlood() ? BLOOD.cycle : fallback; }
  function accent(fallback) { return isBlood() ? BLOOD.accent : (fallback != null ? fallback : NEON.accent); }
  function dim(fallback) { return isBlood() ? BLOOD.dim : (fallback != null ? fallback : NEON.dim); }
  function ambient(fallback) { return isBlood() ? BLOOD.ambient : (fallback != null ? fallback : NEON.ambient); }
  function keyLight(fallback) { return isBlood() ? BLOOD.key : (fallback != null ? fallback : NEON.key); }
  function link(fallback) { return isBlood() ? BLOOD.link : (fallback != null ? fallback : NEON.link); }
  function deep(fallback) { return isBlood() ? BLOOD.deep : (fallback != null ? fallback : NEON.deep); }

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
