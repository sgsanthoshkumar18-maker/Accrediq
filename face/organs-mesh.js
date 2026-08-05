/* AQcredix — organ shapes sourced from the real scanned meshes.
 *
 * Drop-in replacement for the procedural window.OrganShapes. Exposes the identical
 * API (buildAll / ORDER / LABELS), so face.js needs no change to its morph logic:
 * same 850 points per shape, same 1:1 index mapping between shapes, same morph
 * timing. The only difference is that the coordinates now come from the actual
 * OBJ surfaces rather than from procedural implicit functions, and each shape
 * carries a real wireframe edge list derived from its own geometry.
 *
 * Load order: organ-mesh-data.js -> organs.js -> organs-mesh.js -> face.js
 * If the mesh data fails to load, the procedural OrganShapes is left untouched
 * and the hero keeps working exactly as before.
 */
(function () {
  "use strict";

  var D = window.ORGAN_MESH;
  if (!D || !D.points) return;                   // no data -> keep procedural shapes

  var prev = window.OrganShapes || null;

  // Shapes we have real geometry for, in the order they should morph through.
  var MESH_ORDER = ["face", "brain", "heart", "lungs", "kidney"];
  var ORDER = MESH_ORDER.filter(function (k) { return D.points[k] && D.points[k].length; });
  if (!ORDER.length) return;

  var LABELS = { face: "Head", brain: "Brain", heart: "Heart", lungs: "Lungs", kidney: "Kidneys" };

  // Motion + impulse origin per organ, carried over from the procedural module so the
  // "alive" behaviour (heartbeat, breathing, filtration) is unchanged.
  var META = {
    face:   { motion: "face",   pulseFrom: [-0.2, 1.15, 0] },
    brain:  { motion: "brain",  pulseFrom: [-0.35, 0.6, 0] },
    heart:  { motion: "heart",  pulseFrom: [0.15, 0.75, 0] },
    lungs:  { motion: "lungs",  pulseFrom: [0, 1.1, 0] },
    kidney: { motion: "kidney", pulseFrom: [0, 0.9, 0] }
  };
  // Prefer whatever the procedural module declared, if it is present and agrees.
  if (prev && prev.SHAPES) {
    ORDER.forEach(function (k) {
      var s = prev.SHAPES[k];
      if (s && s.motion) META[k] = { motion: s.motion, pulseFrom: s.pulseFrom || META[k].pulseFrom };
    });
  }

  // Resample a shape to exactly N points. The generator emits 850 (matching
  // N_POINTS in face.js); this keeps things correct if that constant ever changes.
  function fit(src, N) {
    var out = [], i;
    if (src.length === N) {
      for (i = 0; i < N; i++) out.push(src[i].slice());
      return out;
    }
    for (i = 0; i < N; i++) out.push(src[Math.floor(i * src.length / N)].slice());
    return out;
  }

  function rescale(pts, radius) {
    var maxR = 0;
    pts.forEach(function (p) {
      var r = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
      if (r > maxR) maxR = r;
    });
    var k = maxR ? radius / maxR : 1;
    return pts.map(function (p) { return [p[0] * k, p[1] * k, p[2] * k]; });
  }

  function buildAll(N, radius) {
    var shapes = {}, meta = {};
    ORDER.forEach(function (k) {
      shapes[k] = rescale(fit(D.points[k], N), radius || 1.55);
      meta[k] = META[k] || { motion: "brain", pulseFrom: [0, 1, 0] };
    });
    return { shapes: shapes, meta: meta };
  }

  /* Wireframe edges for a given shape, as [i, j] index pairs into the point list.
     These come from the mesh itself, so the web follows the organ's real surface
     instead of being recomputed from point proximity. */
  function edgesFor(name, N) {
    var e = D.edges && D.edges[name];
    if (!e) return [];
    var src = D.points[name];
    if (!src || src.length === N) return e;
    // Remap indices if the point count was resampled.
    var scale = src.length / N, seen = {}, out = [];
    e.forEach(function (pair) {
      var a = Math.round(pair[0] / scale), b = Math.round(pair[1] / scale);
      if (a === b || a >= N || b >= N) return;
      var key = a < b ? a + ":" + b : b + ":" + a;
      if (seen[key]) return;
      seen[key] = 1; out.push([a, b]);
    });
    return out;
  }

  window.OrganShapes = {
    buildAll: buildAll,
    edgesFor: edgesFor,
    ORDER: ORDER,
    LABELS: LABELS,
    SHAPES: META,
    source: "mesh"
  };
})();
