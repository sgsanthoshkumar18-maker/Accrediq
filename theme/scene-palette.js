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

  /* THE BLOOD FAMILIES, taken from the same picture the CSS palette came from.
     Arterial gold and orange for the lit vessels, venous blue for the great arteries,
     capillary magenta, and an oxygenated green — five families that read as one body
     rather than as a rainbow. Ordered so that a scene taking the first three colours gets
     the three that carry the picture. */
  var BLOOD = {
    chapters: {
      AAC: 0xFFB84D,   // arterial gold — the impulse
      COP: 0xFF7A18,   // artery
      MOM: 0xF472B6,   // capillary
      PRE: 0x38BDF8,   // vein
      IPC: 0xFF5C6E,   // arterial red
      PSQ: 0xFFD166,   // plasma
      ROM: 0xC084FC,   // deep vessel
      FMS: 0x34D399,   // oxygenated
      HRM: 0xFF9E2C,   // arteriole
      IMS: 0x60A5FA    // venule
    },
    cycle: [0xFFB84D, 0xFF7A18, 0xF472B6, 0x38BDF8, 0xFF5C6E,
            0xFFD166, 0xC084FC, 0x34D399, 0xFF9E2C, 0x60A5FA],
    categories: { CORE: 0xFF5C6E, Commitment: 0xFF7A18,
                  Achievement: 0xFFB84D, Excellence: 0x38BDF8 },
    accent: 0xFFB84D,
    dim:    0xFF7A18,
    /* Light, not paint. The picture is lit from within, so the ambient carries warmth and
       the key light stays close to white — a warm key would wash the cyan vessels out and
       lose half the palette. */
    ambient: 0xFFB499,
    key:     0xFFF3E6,
    link:    0x7A2230,
    deep:    0x1A060B
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
