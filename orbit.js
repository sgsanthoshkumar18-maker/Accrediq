/* AQcredix — orbiting mark.
 *
 * The ring logo with the department icons circling it. Used in the hero and on the About
 * page from one implementation, so the two can't drift apart.
 *
 * Everything is sized in percentages of the host element, so the component fills whatever
 * box it is given rather than carrying fixed pixel values that only look right in the
 * place they were designed. Drop it in a 90px slot or a 420px one and it composes itself
 * correctly either way.
 *
 * Motion:
 *   - The ring's accent arc spins on its own (CSS, in styles.css).
 *   - The orbit rotates as a single group, and each icon counter-rotates by the same
 *     amount so the symbols stay upright instead of tumbling. A tumbling pill icon reads
 *     as a glitch; an upright one reads as deliberate.
 *   - Two rings at different radii and opposite directions give depth without needing
 *     any 3D.
 *
 * Everything respects prefers-reduced-motion — a perpetual rotation is a genuine problem
 * for people with vestibular disorders, and this is a healthcare site.
 */
window.AQOrbit = (function () {
  "use strict";

  /* Which department symbols orbit, and in what order. Deliberately curated rather than
   * "all 25": at small sizes more than about a dozen icons becomes a smear, and these
   * read clearly as distinct shapes at 16px. */
  var INNER = ["heart", "activity", "flask", "droplet", "pill", "scissors"];
  var OUTER = ["shield", "users", "scan", "cpu", "file", "utensils", "briefcase", "spray"];

  function iconSvg(name) {
    var d = (window.DEPT_ICONS || {})[name];
    if (!d) return "";
    return '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + d + "</svg>";
  }

  /* One ring of icons. radius/iconSize are percentages of the host box so the whole thing
     scales with its container.

     The arm is a full-size layer rotated about the stage centre; the icon is positioned
     up the arm using a `top` percentage, which resolves against the arm's height. An
     earlier version used a zero-size arm with a percentage translate — percentages there
     resolve against the element's own box, so every icon collapsed onto the centre. */
  function ring(names, opts) {
    var cells = names.map(function (n, i) {
      var a = (360 / names.length) * i;
      return '<span class="aqo-arm" style="transform:rotate(' + a + 'deg);">' +
        '<span class="aqo-ico" style="top:' + (50 - opts.radius) + "%;" +
        "animation-duration:" + opts.spin + "s;" +
        "animation-direction:" + (opts.reverse ? "normal" : "reverse") + ";" +
        // Cancel this icon's own arm rotation so the glyph sits upright, then let the
        // counter-spin animation cancel the group rotation on top of it.
        "--aqo-a:" + (-a) + "deg;" +
        "width:var(" + opts.sizeVar + ");height:var(" + opts.sizeVar + ');">' +
        iconSvg(n) + "</span></span>";
    }).join("");

    return '<span class="aqo-ring" style="animation-duration:' + opts.spin + "s;" +
      "animation-direction:" + (opts.reverse ? "reverse" : "normal") + ';">' + cells + "</span>";
  }

  /* The AQcredix mark itself: grey circle, accent three-quarter arc, serif A.
     Identical geometry to the certificate and the favicon. */
  function markSvg() {
    return '<svg class="aqo-mark" viewBox="0 0 40 40" fill="none" ' +
      'xmlns="http://www.w3.org/2000/svg" role="img" aria-label="AQcredix">' +
      '<circle cx="20" cy="20" r="16" stroke="var(--aqo-ring-dim)" stroke-width="2.6"/>' +
      '<path class="hero-logo-arc" d="M20 4a16 16 0 1 1-11.31 4.69" ' +
      'stroke="var(--accent-bright)" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M13.6 26.6L20 13.4L26.4 26.6M16.15 21.5H23.85" fill="none" stroke="var(--accent-bright)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  /* mount(el, opts)
   *   markSize  – mark diameter as a % of the box (default 46)
   *   inner/outer – orbit radii as % (default 34 / 46)
   *   iconInner/iconOuter – icon px size
   *   speed     – seconds for the inner ring; outer runs slower
   *   icons     – false to render the mark alone
   */
  function mount(el, opts) {
    if (!el) return;
    opts = opts || {};
    var markSize = opts.markSize || 46;
    var speed = opts.speed || 28;

    /* Ring count is a real setting, not decoration. Two rings need roughly 200px of box
       before the icons stop reading as a smear; in the hero the mark is only as tall as
       two lines of the headline, so one sparse ring is the honest answer there. */
    var rings = opts.rings == null ? 2 : opts.rings;

    var html = '<span class="aqo-stage">';
    if (opts.icons !== false && window.DEPT_ICONS) {
      var innerSet = rings < 2 ? INNER.slice(0, 5) : INNER;
      html += ring(innerSet, {
        radius: opts.inner || 34, sizeVar: "--aqo-in",
        spin: speed, reverse: false
      });
      if (rings >= 2) {
        html += ring(OUTER, {
          radius: opts.outer || 46, sizeVar: "--aqo-out",
          spin: Math.round(speed * 1.55), reverse: true
        });
      }
    }
    html += '<span class="aqo-core" style="width:' + markSize + "%;height:" + markSize + '%;">' +
      markSvg() + "</span></span>";

    el.classList.add("aq-orbit");
    el.innerHTML = html;

    /* Icon size is a percentage of the host box, so one component works at 90px in the
       hero and 380px on About without fixed values that suit only one of them. It has to
       be measured after layout — reading the width during mount returns 0, which is what
       silently pinned every icon to the fallback size in the first version. Clamped
       because below ~11px a stroke icon stops being legible, and above ~34px it starts
       competing with the mark it is meant to orbit. */
    var pin = opts.iconInner || 8, pout = opts.iconOuter || 9;
    function size() {
      var box = el.getBoundingClientRect().width;
      if (!box) return;
      var clamp = function (v) { return Math.max(11, Math.min(34, Math.round(v))) + "px"; };
      el.style.setProperty("--aqo-in", clamp(box * pin / 100));
      el.style.setProperty("--aqo-out", clamp(box * pout / 100));
    }
    requestAnimationFrame(size);
    if (window.ResizeObserver) new ResizeObserver(size).observe(el);
    else window.addEventListener("resize", size);
  }

  /* Auto-mount anything carrying data-aq-orbit, so a page only needs the markup. */
  function init() {
    var nodes = document.querySelectorAll("[data-aq-orbit]");
    Array.prototype.forEach.call(nodes, function (n) {
      var o = {};
      ["markSize", "inner", "outer", "iconInner", "iconOuter", "speed", "rings"].forEach(function (k) {
        var v = n.getAttribute("data-" + k.toLowerCase());
        if (v != null && v !== "") o[k] = parseFloat(v);
      });
      if (n.getAttribute("data-icons") === "false") o.icons = false;
      mount(n, o);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { mount: mount, init: init, INNER: INNER, OUTER: OUTER };
})();
