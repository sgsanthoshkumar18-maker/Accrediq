/* AQcredix — wireframe signal network for the founder portfolio.
 *
 * A slowly rotating 3-D lattice of nodes joined by wireframe edges, with pulses of light
 * travelling along the edges. It fills the empty column beside the experience timeline.
 *
 * WHY THIS AND NOT THREE.JS. The homepage already carries a WebGL hero and a WebGL globe.
 * Adding a third context on a page that also runs tilt, reveals and scrollytelling would
 * compete for the same frame budget on exactly the machines this site is used on. This is
 * plain canvas 2D with a hand-rolled projection: a few hundred lines of arithmetic, no
 * library, no shader compile, and it degrades to a static frame instead of a black box.
 *
 * NOT the organ meshes — those belong to the hero and reusing them here would make the
 * portfolio look like a duplicate of the homepage rather than its own page.
 *
 * The metaphor is deliberate: nodes are findings, edges are the paths between them, and
 * the pulses are information moving through a system. It reads as a network rather than
 * as decoration.
 */
(function () {
  "use strict";

  var canvas = document.getElementById("fpNet");
  if (!canvas) return;

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var W = 0, H = 0, DPR = 1;
  var nodes = [], edges = [], pulses = [];
  var rot = 0, targetRot = 0;
  var pointer = { x: 0, y: 0, active: false };
  var raf = null, running = false;

  /* ------------------------------- geometry -------------------------------
     An icosahedron-ish shell plus an inner ring. Points are placed with the golden-angle
     spiral, which distributes them evenly over a sphere without the clustering at the
     poles that naive lat/long spacing produces. */

  var OUTER = 26, INNER = 10;

  function buildNodes() {
    nodes = [];
    var phi = Math.PI * (3 - Math.sqrt(5));   // golden angle

    for (var i = 0; i < OUTER; i++) {
      var y = 1 - (i / (OUTER - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var th = phi * i;
      nodes.push({
        x: Math.cos(th) * r, y: y, z: Math.sin(th) * r,
        s: 1, ring: 0,
        // A slow individual drift so the lattice breathes instead of looking rigid.
        ph: Math.random() * Math.PI * 2
      });
    }
    for (var j = 0; j < INNER; j++) {
      var a = (j / INNER) * Math.PI * 2;
      nodes.push({
        x: Math.cos(a) * 0.45, y: Math.sin(a * 2) * 0.18, z: Math.sin(a) * 0.45,
        s: 0.62, ring: 1, ph: Math.random() * Math.PI * 2
      });
    }
  }

  /* Join every node to its nearest few. A distance threshold alone leaves some nodes
     orphaned and others in a dense clump; nearest-k keeps the mesh even. */
  function buildEdges() {
    edges = [];
    var K = 3;
    for (var i = 0; i < nodes.length; i++) {
      var d = [];
      for (var j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        d.push({ j: j, v: dist(nodes[i], nodes[j]) });
      }
      d.sort(function (a, b) { return a.v - b.v; });
      for (var k = 0; k < K && k < d.length; k++) {
        var a = Math.min(i, d[k].j), b = Math.max(i, d[k].j);
        // Undirected: skip the duplicate when the pair is found from the other end.
        if (!edges.some(function (e) { return e.a === a && e.b === b; })) {
          edges.push({ a: a, b: b, len: d[k].v });
        }
      }
    }
  }

  function dist(p, q) {
    var dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /* -------------------------------- pulses --------------------------------
     A pulse walks one edge, then hops to a connected edge, so light appears to travel
     through the network rather than blinking on unrelated segments. */

  function spawnPulse() {
    if (!edges.length) return;
    var e = Math.floor(Math.random() * edges.length);
    pulses.push({
      e: e,
      t: 0,
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: 0.006 + Math.random() * 0.010,
      life: 0
    });
  }

  function stepPulses() {
    for (var i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += p.speed;
      p.life += 1;
      if (p.t >= 1) {
        /* Hop to an edge sharing the node we just arrived at. Failing that the pulse
           dies rather than teleporting across the shell. */
        var e = edges[p.e];
        var at = p.dir > 0 ? e.b : e.a;
        var next = [];
        for (var k = 0; k < edges.length; k++) {
          if (k === p.e) continue;
          if (edges[k].a === at || edges[k].b === at) next.push(k);
        }
        if (!next.length || p.life > 600) { pulses.splice(i, 1); continue; }
        var nk = next[Math.floor(Math.random() * next.length)];
        p.e = nk;
        p.dir = edges[nk].a === at ? 1 : -1;
        p.t = 0;
      }
    }
    // Keep a steady population without a burst at start-up.
    if (pulses.length < 7 && Math.random() < 0.05) spawnPulse();
  }

  /* ------------------------------- projection ------------------------------- */

  function project(n, time) {
    // Individual breathing, then a whole-shell rotation about Y and a fixed tilt about X.
    var br = 1 + Math.sin(time * 0.0006 + n.ph) * 0.035;
    var x = n.x * br, y = n.y * br, z = n.z * br;

    var c = Math.cos(rot), s = Math.sin(rot);
    var rx = x * c - z * s;
    var rz = x * s + z * c;

    var TILT = 0.42;
    var ct = Math.cos(TILT), st = Math.sin(TILT);
    var ry = y * ct - rz * st;
    var rz2 = y * st + rz * ct;

    /* Perspective divide. The camera sits at z = 2.6; anything nearer than the near plane
       would invert, which is why the divisor is clamped rather than left free. */
    var CAM = 2.6;
    var d = Math.max(0.35, CAM - rz2);
    var k = 1 / d;

    var R = Math.min(W, H) * 0.36;
    return {
      x: W / 2 + rx * R * k * 1.9,
      y: H / 2 + ry * R * k * 1.9,
      k: k,
      depth: rz2
    };
  }

  /* --------------------------------- draw --------------------------------- */

  function colours() {
    /* Read from the theme rather than hardcoded, so light, dark and neon all follow.
       getComputedStyle is called once per frame at most and only reads two properties. */
    var cs = getComputedStyle(document.documentElement);
    var accent = (cs.getPropertyValue("--accent-bright") || "#5EEAD4").trim();
    var brand = (cs.getPropertyValue("--brand-2") || accent).trim();
    return { accent: accent, brand: brand };
  }

  var COL = null;

  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    if (!COL) COL = colours();

    var pts = nodes.map(function (n) { return project(n, time); });

    // Edges first, dimmer with depth so the far side of the shell recedes.
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      var a = pts[e.a], b = pts[e.b];
      var far = (a.depth + b.depth) / 2;
      var alpha = 0.10 + Math.max(0, (far + 1) / 2) * 0.26;
      ctx.strokeStyle = hexA(COL.accent, alpha);
      ctx.lineWidth = 0.6 + Math.max(0, far) * 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Pulses.
    for (var p = 0; p < pulses.length; p++) {
      var pu = pulses[p];
      var ed = edges[pu.e];
      if (!ed) continue;
      var from = pu.dir > 0 ? pts[ed.a] : pts[ed.b];
      var to = pu.dir > 0 ? pts[ed.b] : pts[ed.a];
      var t = pu.t;
      var px = from.x + (to.x - from.x) * t;
      var py = from.y + (to.y - from.y) * t;

      // A short trail behind the head reads as motion at low frame rates too.
      var tx = from.x + (to.x - from.x) * Math.max(0, t - 0.22);
      var ty = from.y + (to.y - from.y) * Math.max(0, t - 0.22);
      var g = ctx.createLinearGradient(tx, ty, px, py);
      g.addColorStop(0, hexA(COL.accent, 0));
      g.addColorStop(1, hexA(COL.accent, 0.85));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.fillStyle = hexA(COL.accent, 0.95);
      ctx.beginPath();
      ctx.arc(px, py, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nodes on top.
    for (var n = 0; n < nodes.length; n++) {
      var q = pts[n];
      var nd = nodes[n];
      var size = (nd.ring ? 1.6 : 2.6) * q.k * 1.5;
      var a2 = 0.35 + Math.max(0, (q.depth + 1) / 2) * 0.6;
      ctx.fillStyle = hexA(nd.ring ? COL.brand : COL.accent, a2);
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(0.8, size), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* #RRGGBB plus alpha. The theme tokens are hex, and canvas needs rgba to fade them. */
  function hexA(hex, a) {
    var h = String(hex).replace("#", "").trim();
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6) return "rgba(94,234,212," + a + ")";
    var r = parseInt(h.slice(0, 2), 16),
        g = parseInt(h.slice(2, 4), 16),
        b = parseInt(h.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return "rgba(94,234,212," + a + ")";
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /* --------------------------------- loop --------------------------------- */

  function frame(time) {
    // Ease toward the pointer-influenced target so dragging feels weighted, not twitchy.
    rot += (targetRot - rot) * 0.06 + 0.0016;
    targetRot += 0.0016;
    stepPulses();
    draw(time);
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    var box = canvas.parentNode.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(200, box.width);
    H = Math.max(220, box.height);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  /* ------------------------------- start-up ------------------------------- */

  buildNodes();
  buildEdges();
  resize();
  for (var i = 0; i < 5; i++) spawnPulse();

  if (reduce) {
    // One static frame: the structure is the point, the motion is the flourish.
    draw(0);
    return;
  }

  window.addEventListener("resize", function () { resize(); COL = null; }, { passive: true });

  /* The palette can change under us — the owner publishes neon, or the header toggles
     light. Clearing the cache makes the next frame re-read the tokens. */
  new MutationObserver(function () { COL = null; })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });

  // Drag to spin.
  canvas.addEventListener("pointerdown", function (e) {
    pointer.active = true;
    pointer.x = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!pointer.active) return;
    targetRot += (e.clientX - pointer.x) * 0.006;
    pointer.x = e.clientX;
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
    canvas.addEventListener(ev, function () { pointer.active = false; });
  });

  /* Only animate while on screen and while the tab is visible. A canvas running behind a
     hidden tab burns battery for nobody, and this page is long enough that the network is
     off screen most of the time. */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.isIntersecting ? start() : stop(); });
    }, { threshold: 0.02 }).observe(canvas);
  } else start();

  document.addEventListener("visibilitychange", function () {
    document.hidden ? stop() : start();
  });
})();
