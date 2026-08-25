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

  /* THE ARTERIAL FAMILIES — the anatomical heart the palette is taken from.
     Kept under the key "BLOOD" because that is the palette name the site publishes, the
     word the owner types and the value every test asserts — renaming it would churn the
     plumbing to no benefit. Here the name is also literally right.

     These have to agree with the CSS. A scene sits inside a shell whose background comes
     from styles.css, so if the particles drift from the surround the artwork and its frame
     meet at the canvas edge as two different pictures. */
  var BLOOD = {
    /* The scene sequence, in order: red, blue, gold, magenta, violet, amber. A scene taking
       only the first three gets red, blue and gold — which is the whole identity — and
       nothing has to reach for a seventh colour and invent one. */
    chapters: {
      AAC: 0xE23E4E,   // arterial red — brand identity
      COP: 0x3FA9E0,   // venous blue  — clinical data
      MOM: 0xF2C14E,   // gold         — achievement
      PRE: 0xE0637F,   // magenta      — capillary
      IPC: 0xA78BD0,   // violet       — analytics
      PSQ: 0xF2A93B,   // amber        — attention
      ROM: 0x1F5F8B,   // deep blue
      FMS: 0x8E1B2C,   // burgundy
      HRM: 0xF7DEA0,   // pale gold
      IMS: 0x1E2A3A    // navy
    },
    cycle: [0xE23E4E, 0x3FA9E0, 0xF2C14E, 0xE0637F, 0xA78BD0, 0xF2A93B, 0x1F5F8B, 0x8E1B2C],
    /* Category colours keep the semantic mapping the CSS uses, so a CORE element is the
       same red in the galaxy as it is in a table. */
    categories: { CORE: 0xE23E4E, Commitment: 0xF2A93B,
                  Achievement: 0xF2C14E, Excellence: 0xA78BD0 },
    /* Red leads here, unlike in the CSS where blue is the action colour. A scene has no
       controls to be mistaken for, so the identity colour is free to be the dominant one —
       and red particles on black are the picture this palette came from. */
    accent: 0xE23E4E,
    dim:    0x3FA9E0,
    /* Cool ambient against warm accents. A warm key would pull the red toward orange, which
       is the exact failure the CSS field was rebuilt to avoid. */
    ambient: 0x9AB4CC,
    key:     0xF7F5F6,
    link:    0x1E2A3A,
    deep:    0x08070A
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
