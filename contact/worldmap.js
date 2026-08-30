/* AQcredix — the dotted world map with travelling arcs, for the contact page.
 *
 * NO DEPENDENCIES. The reference implementation people know is React plus a dotted-map npm
 * package plus a build step; this site is static HTML and vanilla JS by design. The dots
 * come from contact/worldmap-dots.js (generated from the same country polygons the 3D
 * globes use, so the coastlines agree) and the arcs are plain SVG.
 *
 * TWO LAYERS, FOR A REASON.
 *   canvas  - 3,717 dots. As SVG that is 3,717 DOM nodes or ~200KB of path data; on canvas
 *             it is one element and a loop that finishes in a millisecond.
 *   svg     - the arcs and city markers. Few nodes, and SVG gets CSS transitions and
 *             stroke-dashoffset animation for free, which is the whole effect.
 *
 * IT FOLLOWS THE THEME, INCLUDING A LIVE SWITCH.
 * The arcs take their colour from CSS variables and need no help. The canvas cannot, so a
 * MutationObserver on <html> repaints the dots when data-theme or data-palette changes.
 * The 3D scenes on this site do NOT do that — they pick colours once at construction and
 * only re-tint on the next page load — so this is the one piece of artwork here that turns
 * with the page.
 */
(function () {
  "use strict";

  /* Where the lines run. Home is India — that is where the product and its author are —
     and the destinations are places an Indian hospital group actually deals with, not a
     random scatter. Each is a real capital from hglobe/capitals-data.js. */
  var HOME = { city: "New Delhi", lat: 28.6139, lon: 77.209 };
  var ROUTES = ["London", "Singapore", "Abu Dhabi", "Washington DC", "Tokyo", "Nairobi"];

  function byCity(name) {
    var list = window.WORLD_CAPITALS || [];
    for (var i = 0; i < list.length; i++) if (list[i].city === name) return list[i];
    return null;
  }

  function cssVar(el, name, fallback) {
    try {
      var v = getComputedStyle(el).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function init() {
    var host = document.getElementById("aqWorldMap");
    if (!host || host.dataset.ready) return;
    var D = window.AQ_WORLD_DOTS;
    if (!D) return;                       /* data file missing: leave the box empty rather than half-drawn */
    host.dataset.ready = "1";

    var bits = atob(D.bits);
    function isLand(c, r) {
      var i = r * D.cols + c;
      return (bits.charCodeAt(i >> 3) >> (i & 7)) & 1;
    }

    /* The drawing surface is the dot grid's own aspect, so nothing is stretched. */
    var VB_W = D.cols, VB_H = D.rows;

    var canvas = document.createElement("canvas");
    canvas.className = "wm-dots";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "wm-arcs");
    svg.setAttribute("viewBox", "0 0 " + VB_W + " " + VB_H);
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label",
      "World map showing AQcredix support reaching hospitals from India to " +
      ROUTES.join(", ") + ".");
    host.appendChild(svg);

    /* ---------- the dots ---------- */
    function paintDots() {
      var rect = host.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(w * (VB_H / VB_W)));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.height = h + "px";

      var ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = cssVar(host, "--wm-dot", "rgba(128,128,128,.45)");

      var cw = w / D.cols, ch = h / D.rows;
      /* Dots stay round and never touch: a hair under half the smaller cell. */
      var r = Math.max(0.55, Math.min(cw, ch) * 0.30);
      for (var row = 0; row < D.rows; row++) {
        for (var col = 0; col < D.cols; col++) {
          if (!isLand(col, row)) continue;
          ctx.beginPath();
          ctx.arc((col + 0.5) * cw, (row + 0.5) * ch, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    /* ---------- projection ---------- */
    function project(lat, lon) {
      return {
        x: ((lon - D.lonMin) / (D.lonMax - D.lonMin)) * VB_W,
        y: ((D.latMax - lat) / (D.latMax - D.latMin)) * VB_H
      };
    }

    /* ---------- the arcs ---------- */
    var home = project(HOME.lat, HOME.lon);
    var made = 0;

    ROUTES.forEach(function (name, i) {
      var c = byCity(name);
      if (!c) return;
      var p = project(c.lat, c.lon);

      /* Lift the curve perpendicular to the chord, scaled by how far it travels, so a
         short hop stays flat and a long one bows the way a flight path does. Always
         upward: arcs that dip below the line read as falling rather than travelling. */
      var mx = (home.x + p.x) / 2, my = (home.y + p.y) / 2;
      var dist = Math.hypot(p.x - home.x, p.y - home.y);
      var lift = Math.min(dist * 0.30, VB_H * 0.55);

      var g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "wm-route");
      g.style.setProperty("--i", i);          /* drives the stagger in CSS */

      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("class", "wm-arc");
      path.setAttribute("d", "M" + home.x.toFixed(2) + "," + home.y.toFixed(2) +
        " Q" + mx.toFixed(2) + "," + (my - lift).toFixed(2) +
        " " + p.x.toFixed(2) + "," + p.y.toFixed(2));
      g.appendChild(path);

      var dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "wm-city");
      dot.setAttribute("cx", p.x.toFixed(2));
      dot.setAttribute("cy", p.y.toFixed(2));
      dot.setAttribute("r", "1.1");
      g.appendChild(dot);

      svg.appendChild(g);
      made++;
    });

    /* Home last so it sits above every arc that leaves it. */
    var hg = document.createElementNS(svgNS, "g");
    hg.setAttribute("class", "wm-home");
    var pulse = document.createElementNS(svgNS, "circle");
    pulse.setAttribute("class", "wm-home-pulse");
    pulse.setAttribute("cx", home.x.toFixed(2));
    pulse.setAttribute("cy", home.y.toFixed(2));
    pulse.setAttribute("r", "1.4");
    var core = document.createElementNS(svgNS, "circle");
    core.setAttribute("class", "wm-home-core");
    core.setAttribute("cx", home.x.toFixed(2));
    core.setAttribute("cy", home.y.toFixed(2));
    core.setAttribute("r", "1.5");
    hg.appendChild(pulse);
    hg.appendChild(core);
    svg.appendChild(hg);

    /* The label. Positioned in viewBox units so it tracks the marker at every size. */
    var label = document.createElement("span");
    label.className = "wm-label";
    label.textContent = "We are here";
    label.style.left = ((home.x / VB_W) * 100).toFixed(2) + "%";
    label.style.top = ((home.y / VB_H) * 100).toFixed(2) + "%";
    host.appendChild(label);

    paintDots();

    /* Repaint on resize, and when the theme turns. The canvas cannot read a CSS variable
       the way the SVG can, so this is what keeps the dots in step with everything else. */
    var t = 0;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(paintDots, 140);
    });
    try {
      new MutationObserver(paintDots).observe(document.documentElement,
        { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
    } catch (e) {}

    if (!made) host.classList.add("wm-no-routes");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
