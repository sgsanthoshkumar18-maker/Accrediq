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

    // Lateral head profile: forehead, brow ridge, nose, lips, chin, jaw, ear.
    face: {
      box: [1.2, 1.5, 0.85], motion: "face", pulseFrom: [-0.2, 1.15, 0],
      inside(p) {
        // cranium mass, slightly back of centre
        const cranium = ell(p, 0.86, 0.80, 0.62, 0.10, 0.52, 0) < 1;
        // face mass below, tapering to the chin
        const faceMass = ell(p, 0.72, 0.62, 0.55, 0.02, -0.22, 0) < 1 && p.y > -0.86;
        // profile line: brow -> nose bridge -> tip -> philtrum -> lips -> chin
        const prof = [
          [-0.52, 0.72], [-0.62, 0.46], [-0.60, 0.28], [-0.72, 0.10],
          [-0.86, -0.06], [-0.70, -0.14], [-0.66, -0.28], [-0.76, -0.40],
          [-0.72, -0.52], [-0.58, -0.68], [-0.36, -0.82]
        ];
        let onProfile = false;
        for (let i = 0; i < prof.length - 1 && !onProfile; i++) {
          if (tube(p, prof[i][0], prof[i][1], prof[i+1][0], prof[i+1][1], 0.11, 0.34)) onProfile = true;
        }
        // jawline sweeping back from chin to below the ear
        const jaw = tube(p, -0.34, -0.84, 0.66, -0.30, 0.12, 0.30);
        // ear, set back on the side of the head
        const ear = ell(p, 0.22, 0.28, 0.13, 0.52, 0.02, 0.30) < 1;
        // neck
        const neck = p.y < -0.88 && p.x > -0.28 && p.x < 0.62 && Math.abs(p.z) < 0.34;
        return cranium || faceMass || onProfile || jaw || ear || neck;
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

    // Lateral heart: one compact muscular mass, apex pointing forward and down,
    // with the aortic arch and great vessels rising from the base.
    heart: {
      box: [1.05, 1.35, 0.85], motion: "heart", pulseFrom: [0.2, 0.75, 0],
      inside(p) {
        const c = Math.cos(0.30), s = Math.sin(0.30);
        const q = { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
        // single solid ventricular cone — no medial gap, so it cannot read as a pair
        const t = q.y < 0.35 ? Math.max(0.16, 1 + (q.y - 0.35) * 0.78) : 1;
        const mass = ((q.x + 0.04) / (0.74 * t)) ** 2 + ((q.y - 0.05) / 0.80) ** 2
                   + (q.z / (0.60 * t)) ** 2 < 1 && q.y > -0.90;
        // atrial base sitting on top of the ventricles
        const base = ell(q, 0.64, 0.30, 0.52, -0.02, 0.74, 0) < 1;
        // aortic arch looping over the base
        const ar = Math.hypot(q.x + 0.06, (q.y - 0.98) * 1.3);
        const arch = Math.abs(ar - 0.30) < 0.10 && q.y > 0.94 && Math.abs(q.z) < 0.17;
        const ascend = tube(q, 0.22, 0.76, 0.24, 1.04, 0.12, 0.15);
        const pulm   = tube(q, -0.24, 0.78, -0.36, 1.14, 0.11, 0.14);
        const svc    = tube(q, 0.44, 0.82, 0.48, 1.24, 0.09, 0.12);
        return mass || base || arch || ascend || pulm || svc;
      }
    },

    // Lateral lung: a single lung in side profile — narrow apex, broad base,
    // domed diaphragmatic surface, with the bronchial tree entering at the hilum.
    lungs: {
      box: [1.1, 1.4, 0.9], motion: "lungs", pulseFrom: [0.1, 1.25, 0],
      inside(p) {
        // taper toward the apex, widen toward the base
        const w = 0.34 + 0.44 * Math.max(0, 1 - ((p.y - 0.55) / 1.5) ** 2);
        const body = ((p.x - 0.02) / w) ** 2 + ((p.y + 0.05) / 0.96) ** 2 + (p.z / 0.52) ** 2 < 1;
        // concave diaphragmatic base
        const diaphragm = p.y < -0.62 && ell(p, 0.9, 0.42, 0.62, 0.02, -1.22, 0) < 1;
        // oblique fissure running down and forward
        const fissure = Math.abs(p.y - 0.10 + p.x * 0.55) < 0.05 && Math.abs(p.x) < 0.72;
        const trachea = tube(p, 0.16, 1.30, 0.10, 0.62, 0.075, 0.10);
        const hilum   = tube(p, 0.10, 0.62, -0.10, 0.34, 0.06, 0.09);
        const br1 = tube(p, -0.10, 0.34, -0.48, 0.52, 0.042, 0.07);
        const br2 = tube(p, -0.10, 0.34, -0.44, -0.10, 0.042, 0.07);
        const br3 = tube(p, -0.10, 0.34, -0.20, -0.52, 0.038, 0.06);
        const br4 = tube(p, -0.44, -0.10, -0.66, -0.34, 0.032, 0.05);
        return (body && !diaphragm && !fissure) || trachea || hilum || br1 || br2 || br3 || br4;
      }
    },

    // Lateral liver: the characteristic wedge — thick and rounded posteriorly,
    // tapering to a sharp inferior border anteriorly.
    liver: {
      box: [1.5, 1.0, 0.9], motion: "impulse", pulseFrom: [-1.05, 0.1, 0],
      inside(p) {
        const mass = ell(p, 1.02, 0.62, 0.66, 0.24, 0.06, 0) < 1;
        // sharp anterior/inferior border: cut away below a sloping plane
        const wedge = p.y > -0.30 - (p.x + 0.9) * 0.42;
        // rounded superior (diaphragmatic) surface
        const dome = p.y < 0.52 + Math.max(0, 0.3 - Math.abs(p.x - 0.2)) * 0.35;
        // gallbladder tucked under the inferior surface
        const gall = ell(p, 0.17, 0.24, 0.15, -0.30, -0.44, 0.04) < 1;
        return (mass && wedge && dome) || gall;
      }
    },

    // Lateral kidney: a single bean in side profile, concave hilum facing
    // forward, renal vessels entering and the ureter descending.
    kidney: {
      box: [0.95, 1.35, 0.7], motion: "impulse", pulseFrom: [-0.4, 0.7, 0],
      inside(p) {
        const body = ((p.x - 0.10) / 0.52) ** 2 + (p.y / 0.98) ** 2 + (p.z / 0.40) ** 2 < 1;
        // hilum: deep concave bite out of the anterior (left) border
        const hilum = ((p.x + 0.46) / 0.42) ** 2 + (p.y / 0.34) ** 2 < 1;
        const artery = tube(p, -0.72, 0.06, -0.16, 0.02, 0.055, 0.08);
        const vein   = tube(p, -0.74, -0.12, -0.18, -0.10, 0.05, 0.075);
        const ureter = tube(p, -0.26, -0.16, -0.16, -1.16, 0.05, 0.07);
        return (body && !hilum) || artery || vein || ureter;
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
