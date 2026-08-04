/* AQcredix — procedural organ point clouds, rebuilt from reference observation.
 *
 * Shapes were corrected against reference imagery. Key fixes over the first
 * version: the brain is a LATERAL profile (frontal lobe forward, cerebellum
 * posterior-inferior, brain stem descending) rather than a front-on pair of
 * hemispheres; the kidney has a genuine concave medial hilum with a descending
 * ureter; the lungs carry a central trachea with a branching bronchial tree.
 *
 * Every organ returns the same point count so particle i in one shape becomes
 * particle i in the next — that 1:1 mapping is what makes the morph continuous.
 *
 * Each shape also declares:
 *   pulseFrom : where an electrical impulse enters (normalised coords)
 *   motion    : which functional animation applies
 */
window.OrganShapes = (function () {

  function hash(x, y, z) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  }
  const noise = (x, y, z) => hash(x, y, z) * 0.6 + hash(x * 2.1, y * 2.1, z * 2.1) * 0.3 + hash(x * 4.3, y * 4.3, z * 4.3) * 0.1;
  const ell = (p, rx, ry, rz, cx, cy, cz) =>
    ((p.x - (cx || 0)) / rx) ** 2 + ((p.y - (cy || 0)) / ry) ** 2 + ((p.z - (cz || 0)) / rz) ** 2;
  const tube = (p, ax, ay, bx, by, r, zr) => {
    const dx = bx - ax, dy = by - ay;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((p.x - ax) * dx + (p.y - ay) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + dx * t, cy = ay + dy * t;
    return Math.hypot(p.x - cx, p.y - cy) < r && Math.abs(p.z) < (zr || r * 1.2);
  };

  const SHAPES = {

    // Front-facing head: cranium, tapering jaw, ears, and recessed features.
    face: {
      box: [1.15, 1.5, 1.0], motion: "face", pulseFrom: [0, 1.2, 0],
      inside(p) {
        let rx;
        if (p.y > 0.55)      rx = 0.90 - (p.y - 0.55) * 0.82;   // cranium curves in
        else if (p.y > -0.3) rx = 0.95;                          // temples / cheekbones
        else                 rx = 0.95 * (1 - (p.y + 0.3) / 1.25) + 0.20; // jaw to chin
        const head = ell(p, rx, 1.08, 0.80 - Math.abs(p.y) * 0.07, 0, 0.06, 0) < 1;
        // ears sit on the lateral surface, roughly eye-to-nose height
        const ear = ell({ x: Math.abs(p.x), y: p.y, z: p.z }, 0.13, 0.26, 0.13, 0.90, 0.06, -0.10) < 1;
        // neck below
        const neck = Math.abs(p.x) < 0.36 && p.y < -0.95 && Math.abs(p.z) < 0.34;
        return head || ear || neck;
      }
    },

    // LATERAL brain profile — this is the view in the reference image.
    brain: {
      box: [1.45, 1.15, 0.95], motion: "brain", pulseFrom: [-0.9, 0.2, 0],
      inside(p) {
        // cerebrum: egg tilted with the frontal pole forward (-x) and higher
        const q = { x: p.x, y: p.y - 0.12, z: p.z };
        let d = ell(q, 1.12, 0.72, 0.62, 0.02, 0, 0);
        d -= Math.abs(noise(p.x * 3.6, p.y * 3.6, p.z * 3.6)) * 0.16;  // gyri and sulci
        const cerebrum = d < 1 && p.y > -0.36;
        // temporal lobe bulges forward-down under the lateral fissure
        const temporal = ell(p, 0.62, 0.3, 0.5, -0.28, -0.42, 0) < 1;
        // cerebellum: posterior and inferior
        const cerebellum = ell(p, 0.44, 0.3, 0.42, 0.78, -0.52, 0) < 1;
        // brain stem descending from the centre-base
        const stem = tube(p, 0.34, -0.5, 0.22, -1.02, 0.15, 0.2);
        // lateral fissure separating temporal lobe from the rest
        const fissure = Math.abs(p.y + 0.2 + p.x * 0.12) < 0.045 && p.x < 0.35 && p.x > -0.85;
        return ((cerebrum || temporal) && !fissure) || cerebellum || stem;
      }
    },

    // Anatomical heart: ventricular cone, atria, aortic arch and great vessels.
    heart: {
      box: [1.1, 1.45, 0.9], motion: "heart", pulseFrom: [0.25, 0.55, 0],
      inside(p) {
        const c = Math.cos(0.28), s = Math.sin(0.28);
        const q = { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
        // ventricular mass tapering to an apex
        const taper = q.y < 0 ? 1 + q.y * 0.55 : 1;
        const vent = ell(q, 0.82 * Math.max(0.15, taper), 0.85, 0.66 * Math.max(0.2, taper), 0, -0.02, 0) < 1 && q.y > -0.92;
        const atriaR = ell(q, 0.40, 0.30, 0.40, 0.34, 0.72, 0) < 1;
        const atriaL = ell(q, 0.34, 0.27, 0.36, -0.32, 0.74, -0.04) < 1;
        // aortic arch — the loop over the top in the reference
        const ar = Math.hypot(q.x + 0.02, (q.y - 0.92) * 1.25);
        const arch = Math.abs(ar - 0.34) < 0.11 && q.y > 0.88 && Math.abs(q.z) < 0.18;
        const ascend = tube(q, 0.30, 0.72, 0.30, 1.05, 0.13, 0.16);
        const pulmTrunk = tube(q, -0.16, 0.74, -0.30, 1.18, 0.12, 0.15);
        const svc = tube(q, 0.52, 0.80, 0.56, 1.30, 0.10, 0.13);
        return vent || atriaR || atriaL || arch || ascend || pulmTrunk || svc;
      }
    },

    // Two lungs with trachea and a branching bronchial tree.
    lungs: {
      box: [1.45, 1.4, 0.75], motion: "lungs", pulseFrom: [0, 1.25, 0],
      inside(p) {
        const side = p.x >= 0 ? 1 : -1;
        const ax = Math.abs(p.x);
        // lung body: narrower apex, broad base, slight medial flattening
        const width = 0.30 + 0.24 * Math.max(0, 1 - Math.abs((p.y - 0.05) / 1.0) ** 2);
        const body = ((ax - 0.62) / width) ** 2 + ((p.y - 0.02) / 0.96) ** 2 + (p.z / 0.44) ** 2 < 1;
        const medialFlat = ax < 0.24;
        // cardiac notch on the left lung (viewer's left = negative x)
        const notch = side < 0 && ell(p, 0.34, 0.44, 0.6, -0.34, -0.22, 0) < 1;
        const trachea = tube(p, 0, 1.28, 0, 0.52, 0.085, 0.11);
        const bronchus = tube(p, 0, 0.52, side * 0.55, 0.10, 0.065, 0.09) && ax > 0.02;
        const branch1 = tube(p, side * 0.5, 0.16, side * 0.78, 0.42, 0.045, 0.07);
        const branch2 = tube(p, side * 0.5, 0.16, side * 0.80, -0.30, 0.045, 0.07);
        const branch3 = tube(p, side * 0.55, -0.18, side * 0.72, -0.62, 0.04, 0.06);
        return (body && !medialFlat && !notch) || trachea || bronchus || branch1 || branch2 || branch3;
      }
    },

    // Liver: large right lobe, smaller left, sharp inferior border.
    liver: {
      box: [1.6, 0.9, 0.95], motion: "impulse", pulseFrom: [-1.1, 0.2, 0],
      inside(p) {
        const right = ell(p, 0.94, 0.60, 0.68, 0.40, 0.02, 0) < 1;
        const left  = ell(p, 0.60, 0.38, 0.48, -0.66, 0.10, 0.04) < 1;
        const inferior = p.y < 0.40 - Math.max(0, p.x) * 0.30;   // wedge edge
        const falciform = Math.abs(p.x + 0.10) < 0.028 && p.y > -0.05;
        return (right || left) && inferior && !falciform;
      }
    },

    // Paired kidneys: deep medial hilum, renal vessels, descending ureter.
    kidney: {
      box: [1.4, 1.25, 0.8], motion: "impulse", pulseFrom: [0, 0.9, 0],
      inside(p) {
        const side = p.x >= 0 ? 1 : -1;
        const ax = Math.abs(p.x);
        const q = { x: ax - 0.66, y: p.y, z: p.z };
        const body = (q.x / 0.40) ** 2 + (q.y / 0.82) ** 2 + (q.z / 0.32) ** 2 < 1;
        // hilum: concave bite out of the MEDIAL side (facing the midline)
        const hilum = ((q.x + 0.30) / 0.34) ** 2 + (q.y / 0.30) ** 2 < 1;
        // renal artery and vein entering the hilum
        const vessels = Math.abs(p.y) < 0.12 && ax > 0.16 && ax < 0.52 && Math.abs(p.z) < 0.09;
        // ureter descending from the hilum
        const ureter = tube(p, side * 0.34, -0.10, side * 0.30, -1.02, 0.055, 0.075);
        return (body && !hilum) || vessels || ureter;
      }
    },

    // Outer ear: helix spiral, antihelix, concha bowl, tragus, lobule.
    ear: {
      box: [0.95, 1.35, 0.55], motion: "impulse", pulseFrom: [0.2, 0.9, 0],
      inside(p) {
        const cx = -0.05, cy = 0.12;
        const ang = Math.atan2(p.y - cy, p.x - cx);
        const rad = Math.hypot(p.x - cx, p.y - cy);
        const helixR = 0.74 - ((ang + Math.PI) / (2 * Math.PI)) * 0.18;
        const helix = Math.abs(rad - helixR) < 0.11 && p.y > -0.5 && Math.abs(p.z) < 0.22;
        const antihelix = Math.abs(rad - helixR * 0.58) < 0.09 && p.y > -0.26 && p.x < 0.30 && Math.abs(p.z) < 0.18;
        const concha = ell(p, 0.24, 0.30, 0.18, 0.02, -0.04, 0) < 1;
        const tragus = ell(p, 0.11, 0.17, 0.13, 0.32, -0.26, 0.03) < 1;
        const lobule = ell(p, 0.24, 0.26, 0.18, 0.02, -0.76, 0) < 1;
        return helix || antihelix || concha || tragus || lobule;
      }
    }
  };

  function sample(name, N) {
    const S = SHAPES[name];
    const [bx, by, bz] = S.box;
    const pts = [];
    let seed = name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) * 7919;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let guard = 0;
    while (pts.length < N && guard < N * 300) {
      guard++;
      const p = { x: (rnd() * 2 - 1) * bx, y: (rnd() * 2 - 1) * by, z: (rnd() * 2 - 1) * bz };
      if (!S.inside(p)) continue;
      const out = { x: p.x * 1.06, y: p.y * 1.06, z: p.z * 1.06 };
      if (!S.inside(out) || rnd() < 0.16) pts.push([p.x, p.y, p.z]);
    }
    while (pts.length < N) pts.push(pts[pts.length % Math.max(1, pts.length)] || [0, 0, 0]);
    return pts;
  }

  function normalise(pts, target) {
    let maxR = 0;
    pts.forEach(([x, y, z]) => { const r = Math.hypot(x, y, z); if (r > maxR) maxR = r; });
    const k = maxR ? target / maxR : 1;
    return pts.map(([x, y, z]) => [x * k, y * k, z * k]);
  }

  const ORDER = ["face", "brain", "heart", "lungs", "liver", "kidney", "ear"];
  const LABELS = { face:"Face", brain:"Brain", heart:"Heart", lungs:"Lungs", liver:"Liver", kidney:"Kidneys", ear:"Ear" };

  function buildAll(N, radius) {
    const out = {}, meta = {};
    ORDER.forEach(name => {
      out[name] = normalise(sample(name, N), radius || 1.55);
      meta[name] = { motion: SHAPES[name].motion, pulseFrom: SHAPES[name].pulseFrom };
    });
    return { shapes: out, meta };
  }

  return { buildAll, ORDER, LABELS, SHAPES };
})();
