/* AQcredix — procedural organ point clouds for the morphing hero.
 *
 * Every organ returns EXACTLY the same number of points, so particle i in the
 * face becomes particle i in the brain. That 1:1 correspondence is what lets
 * the network travel between shapes instead of dissolving and reforming.
 *
 * Shapes are built by rejection-sampling an implicit volume, then biased to the
 * surface shell so the result reads as a wireframe organ rather than a blob.
 */
window.OrganShapes = (function () {

  function hash(x, y, z) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  }
  function noise(x, y, z) {
    return hash(x, y, z) * 0.6 + hash(x * 2.1, y * 2.1, z * 2.1) * 0.3 + hash(x * 4.3, y * 4.3, z * 4.3) * 0.1;
  }
  const ell = (p, rx, ry, rz, cx, cy, cz) =>
    ((p.x - (cx || 0)) / rx) ** 2 + ((p.y - (cy || 0)) / ry) ** 2 + ((p.z - (cz || 0)) / rz) ** 2;

  // ---------- implicit volume tests, each roughly filling a 2.4-unit box ----------
  const SHAPES = {
    face: {
      box: [1.15, 1.45, 1.0],
      inside(p) {
        let rx;
        if (p.y > 0.55) rx = 0.92 - (p.y - 0.55) * 0.9;
        else if (p.y > -0.35) rx = 0.98 + (0.55 - Math.abs(p.y - 0.1)) * 0.06;
        else rx = 0.98 * (1 - (p.y + 0.35) / 1.15) + 0.18;
        const d = ell(p, rx, 1.05, 0.82 - Math.abs(p.y) * 0.08, 0, 0.05, 0);
        return d - noise(p.x * 2.8, p.y * 2.8, p.z * 2.8) * 0.09 < 1;
      }
    },
    brain: {
      box: [1.5, 1.05, 1.15],
      inside(p) {
        // two hemispheres with a longitudinal fissure and a cerebellum lobe
        const lx = (Math.abs(p.x) - 0.34) / 1.02;
        let d = lx * lx + (p.y / 0.82) ** 2 + (p.z / 0.95) ** 2;
        d -= noise(p.x * 3.4, p.y * 3.4, p.z * 3.4) * 0.13;   // gyri
        const fissure = Math.abs(p.x) < 0.045 && p.y > -0.1;
        const cerebellum = ell(p, 0.55, 0.3, 0.42, 0, -0.7, -0.35) < 1;
        return (d < 1 && !fissure) || cerebellum;
      }
    },
    heart: {
      box: [1.15, 1.35, 1.0],
      inside(p) {
        // ventricular mass plus atria, tilted as the heart sits in the chest
        const c = Math.cos(0.35), s = Math.sin(0.35);
        const x = p.x * c - p.y * s, y = p.x * s + p.y * c;
        const q = { x, y, z: p.z };
        const ventricles = ell(q, 0.86, 1.0, 0.72, 0, 0.05, 0) < 1 && y > -0.95;
        const apexTaper = y < -0.35 ? Math.abs(x) < 0.62 * (1 + (y + 0.35)) : true;
        const atriaL = ell(q, 0.42, 0.36, 0.4, -0.34, 0.82, 0) < 1;
        const atriaR = ell(q, 0.46, 0.38, 0.42, 0.36, 0.8, 0) < 1;
        const aorta = ell(q, 0.17, 0.42, 0.17, -0.02, 1.15, -0.05) < 1;
        return (ventricles && apexTaper) || atriaL || atriaR || aorta;
      }
    },
    lungs: {
      box: [1.5, 1.3, 0.9],
      inside(p) {
        const side = p.x > 0 ? 1 : -1;
        const ax = Math.abs(p.x);
        // each lung: tall lobed sac, hollowed on the medial side for the heart
        const lung = ((ax - 0.72) / 0.52) ** 2 + ((p.y - 0.02) / 1.0) ** 2 + (p.z / 0.6) ** 2 < 1;
        const cardiacNotch = side < 0 && ell(p, 0.42, 0.5, 0.7, -0.34, -0.28, 0) < 1;
        const fissure = Math.abs(p.y - 0.15 - side * 0.1) < 0.035 && ax > 0.35;
        const trachea = ax < 0.09 && p.y > 0.55 && Math.abs(p.z) < 0.12;
        const bronchi = Math.abs(Math.abs(p.y - 0.5) - ax * 0.55) < 0.07 && ax < 0.5 && p.y > 0.1 && Math.abs(p.z) < 0.12;
        return (lung && !cardiacNotch && !fissure) || trachea || bronchi;
      }
    },
    liver: {
      box: [1.6, 0.95, 1.0],
      inside(p) {
        // large right lobe, smaller left, separated by the falciform ligament
        const right = ell(p, 0.95, 0.62, 0.72, 0.42, 0, 0) < 1;
        const left = ell(p, 0.62, 0.4, 0.52, -0.62, 0.06, 0.06) < 1;
        const wedge = p.y < 0.42 - Math.max(0, p.x) * 0.22;      // inferior taper
        const falciform = Math.abs(p.x + 0.12) < 0.03 && p.y > -0.1;
        const lumpy = noise(p.x * 3, p.y * 3, p.z * 3) * 0.08;
        return ((right || left) && wedge && !falciform) || (right && lumpy > 0.06);
      }
    },
    kidney: {
      box: [1.35, 1.2, 0.85],
      inside(p) {
        // a pair of beans, each with a medial hilum indentation
        const side = p.x > 0 ? 1 : -1;
        const q = { x: Math.abs(p.x) - 0.62, y: p.y, z: p.z };
        const body = (q.x / 0.42) ** 2 + (q.y / 0.78) ** 2 + (q.z / 0.36) ** 2 < 1;
        const hilum = ((q.x + 0.34) / 0.3) ** 2 + (q.y / 0.28) ** 2 + (q.z / 0.34) ** 2 < 1;
        const ureter = Math.abs(Math.abs(p.x) - 0.28 + p.y * 0.12) < 0.06 && p.y < -0.3 && p.y > -1.05 && Math.abs(p.z) < 0.08;
        return (body && !hilum) || ureter;
      }
    },
    ear: {
      box: [1.0, 1.4, 0.7],
      inside(p) {
        // helix spiral + concha bowl + lobule
        const ang = Math.atan2(p.y - 0.1, p.x);
        const rad = Math.hypot(p.x, p.y - 0.1);
        const helixR = 0.78 - (ang + Math.PI) * 0.055;
        const helix = Math.abs(rad - helixR) < 0.13 && p.y > -0.55 && Math.abs(p.z) < 0.3;
        const antihelix = Math.abs(rad - helixR * 0.6) < 0.1 && p.y > -0.3 && p.x < 0.35 && Math.abs(p.z) < 0.22;
        const concha = ell(p, 0.3, 0.34, 0.24, 0.05, -0.05, 0) < 1;
        const lobule = ell(p, 0.28, 0.3, 0.22, 0.02, -0.78, 0) < 1;
        const tragus = ell(p, 0.13, 0.2, 0.16, 0.34, -0.3, 0.05) < 1;
        return helix || antihelix || concha || lobule || tragus;
      }
    }
  };

  /** Sample N points on/near the surface of a shape. Deterministic per shape. */
  function sample(name, N) {
    const S = SHAPES[name];
    const [bx, by, bz] = S.box;
    const pts = [];
    // deterministic PRNG so a shape looks identical every cycle
    let seed = name.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) * 7919;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

    let guard = 0;
    while (pts.length < N && guard < N * 220) {
      guard++;
      const p = { x: (rnd() * 2 - 1) * bx, y: (rnd() * 2 - 1) * by, z: (rnd() * 2 - 1) * bz };
      if (!S.inside(p)) continue;
      // shell bias: keep it if a slightly scaled copy falls outside (i.e. near the surface)
      const out = { x: p.x * 1.07, y: p.y * 1.07, z: p.z * 1.07 };
      if (!S.inside(out) || rnd() < 0.18) pts.push([p.x, p.y, p.z]);
    }
    // top up if the volume was too thin to reach N
    while (pts.length < N) pts.push(pts[pts.length % Math.max(1, pts.length)] || [0, 0, 0]);
    return pts;
  }

  /** Normalise so every organ fills the same visual envelope. */
  function normalise(pts, target) {
    let maxR = 0;
    pts.forEach(([x, y, z]) => { const r = Math.hypot(x, y, z); if (r > maxR) maxR = r; });
    const k = maxR ? target / maxR : 1;
    return pts.map(([x, y, z]) => [x * k, y * k, z * k]);
  }

  const ORDER = ["face", "brain", "heart", "lungs", "liver", "kidney", "ear"];
  const LABELS = { face:"Face", brain:"Brain", heart:"Heart", lungs:"Lungs", liver:"Liver", kidney:"Kidneys", ear:"Ear" };

  function buildAll(N, radius) {
    const out = {};
    ORDER.forEach(name => { out[name] = normalise(sample(name, N), radius || 1.55); });
    return out;
  }

  return { buildAll, ORDER, LABELS, SHAPES };
})();
