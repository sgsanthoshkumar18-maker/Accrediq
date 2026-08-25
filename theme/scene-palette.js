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

  /* THE VIOLET FAMILIES — black and dark purple.
     Kept under the key "BLOOD" because that is the palette name the site publishes, the
     word the owner types and the value every test asserts. The name is historical; it is
     the key, not a description.

     These have to agree with the CSS. A scene sits inside a shell whose background comes
     from styles.css, so if the particles drift from the surround the artwork and its frame
     meet at the canvas edge as two different pictures. */
  var BLOOD = {
    /* The scene sequence: the three purples first, then the accents. A scene that takes
       only the first three gets the whole identity and nothing has to invent a colour. */
    chapters: {
      AAC: 0x8B5CF6,   // purple        — brand identity
      COP: 0xA78BFA,   // bright purple — action, clinical data
      MOM: 0xC4B0F5,   // light purple  — structure
      PRE: 0xE879F9,   // orchid        — CORE
      IPC: 0xF2C14E,   // gold          — achievement
      PSQ: 0xF2A93B,   // amber         — attention
      ROM: 0x6D40CC,   // deep purple
      FMS: 0x3B1F6B,   // deepest purple
      HRM: 0xF7DEA0,   // pale gold
      IMS: 0x241A3D    // panel violet
    },
    cycle: [0x8B5CF6, 0xA78BFA, 0xC4B0F5, 0xE879F9, 0xF2C14E, 0xF2A93B, 0x6D40CC, 0x3B1F6B],
    /* Category colours keep the semantic mapping the CSS uses, so a CORE element is the
       same orchid in the galaxy as it is in a table. */
    categories: { CORE: 0xE879F9, Commitment: 0xF2A93B,
                  Achievement: 0xF2C14E, Excellence: 0xA78BFA },
    accent: 0x8B5CF6,
    dim:    0xA78BFA,
    /* A near-white key with a faint violet cast. A warm key would push the purples toward
       brown, which is the failure the palette before this one was rebuilt to escape. */
    ambient: 0xB0A4D6,
    key:     0xF5F2FB,
    link:    0x241A3D,
    deep:    0x07050C
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
