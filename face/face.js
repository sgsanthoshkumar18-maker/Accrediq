/* AQcredix — Neural Brain
   A procedural 3D brain-shaped particle network (vanilla Three.js — this
   project has no React/build step). Two lobed point clouds with organic
   surface noise approximate a brain silhouette; nearest-neighbor edges form
   the connective web. Ten larger, brighter nodes are the real NABH chapters
   — hover/click them exactly like the previous globe nodes did. */

(function () {
  const stage = document.getElementById("faceStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".face-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="face-fallback">AQcredix<br>Accreditation &amp; Quality Excellence</div>`;
    return;
  }

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("faceCanvas");
  const overlay = document.getElementById("faceNodeOverlay");
  const loadingEl = document.getElementById("faceLoading");
  const tooltip = document.getElementById("faceTooltip");

  // ---------- Real chapter data (same as before) ----------
  const CHAPTER_NAMES = {
    AAC: "Access, Assessment & Continuity", COP: "Care of Patients", MOM: "Management of Medication",
    PRE: "Patient Rights & Education", IPC: "Infection Prevention & Control", PSQ: "Patient Safety & Quality",
    ROM: "Responsibility of Management", FMS: "Facility Management & Safety",
    HRM: "Human Resource Management", IMS: "Information Management System"
  };
  const CHAPTER_ACCENT = {
    AAC: "#5eead4", COP: "#818cf8", MOM: "#f472b6", PRE: "#60a5fa", IPC: "#f87171",
    PSQ: "#fbbf24", ROM: "#a78bfa", FMS: "#34d399", HRM: "#fb923c", IMS: "#38bdf8"
  };
  const heroEl = document.querySelector(".hero");
  function setHeroTint(hex) { if (heroEl) heroEl.style.setProperty("--hero-tint", hex); }
  function resetHeroTint() { if (heroEl) heroEl.style.setProperty("--hero-tint", "#0EA5A0"); }
  let chapterStats = null;
  if (window.NABH_DATA) {
    chapterStats = {};
    Object.keys(window.NABH_DATA.official).forEach(code => {
      const o = window.NABH_DATA.official[code];
      const ncCodes = [];
      const chapter = window.NABH_DATA.chapters[code];
      if (chapter) chapter.standards.forEach(std => std.elements.forEach(el => {
        if (el.category === "CORE" || el.category === "Commitment") ncCodes.push(`${std.code}.${el.letter}`);
      }));
      chapterStats[code] = { name: CHAPTER_NAMES[code] || code, possibleNC: o.core + o.commitment, ncCodes };
    });
  }
  const CODES = chapterStats ? Object.keys(chapterStats) : Object.keys(CHAPTER_NAMES);

  // ---------- Renderer / scene / camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.05, 3.4);
  camera.lookAt(0, 0, 0);

  function sizeRenderer() {
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  sizeRenderer();
  window.addEventListener("resize", sizeRenderer);

  scene.add(new THREE.AmbientLight(0x9db4ff, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(3, 3, 5); scene.add(key);

  const rig = new THREE.Group();
  scene.add(rig);

  // ---------- Procedural face-shaped point cloud ----------
  // Cheap deterministic pseudo-noise (avoids an external noise-library dependency)
  function hashNoise(x, y, z) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  }
  function fractalNoise(x, y, z) {
    return hashNoise(x, y, z) * 0.6 + hashNoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + hashNoise(x * 4.3, y * 4.3, z * 4.3) * 0.1;
  }

  // Head silhouette: an egg-taper — wide at the cheekbones, narrowing to the chin below
  // and rounding at the forehead above. y: +1 = crown, -1 = chin.
  function headRadiusX(y) {
    if (y > 0.55) return 0.92 - (y - 0.55) * 0.9;      // forehead curves in toward the crown
    if (y > -0.35) return 0.98 + (0.55 - Math.abs(y - 0.1)) * 0.06; // cheekbone bulge
    return 0.98 * (1 - (y + 0.35) / 1.15) + 0.18;        // taper down to the chin
  }
  function insideFace(p) {
    const maxX = headRadiusX(p.y) * 1.0;
    const maxZ = 0.82 - Math.abs(p.y) * 0.08;
    const lx = p.x / maxX, lz = p.z / maxZ, ly = (p.y - 0.05) / 1.05;
    let d = lx * lx + ly * ly + lz * lz;
    d -= fractalNoise(p.x * 2.8, p.y * 2.8, p.z * 2.8) * 0.09;
    return d < 1.0;
  }

  const N_POINTS = 620; // general shell — features below add the recognizable detail
  const points = [];
  let attempts = 0;
  while (points.length < N_POINTS && attempts < N_POINTS * 40) {
    attempts++;
    const p = new THREE.Vector3((Math.random() * 2 - 1) * 1.0, (Math.random() * 2 - 1) * 1.15 + 0.05, (Math.random() * 2 - 1) * 0.85);
    if (insideFace(p)) {
      const shellTest = new THREE.Vector3(p.x * 1.07, (p.y - 0.05) * 1.07 + 0.05, p.z * 1.07);
      if (!insideFace(shellTest) || Math.random() < 0.22) points.push(p);
    }
  }

  // ---------- Structured facial features — what makes it actually read as a face ----------
  function arc(cx, cy, cz, rx, ry, startDeg, endDeg, count, jitter) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const a = THREE.MathUtils.degToRad(startDeg + (endDeg - startDeg) * t);
      pts.push(new THREE.Vector3(
        cx + Math.cos(a) * rx + (Math.random() - 0.5) * jitter,
        cy + Math.sin(a) * ry + (Math.random() - 0.5) * jitter,
        cz + (Math.random() - 0.5) * jitter
      ));
    }
    return pts;
  }
  function line(x1, y1, z1, x2, y2, z2, count, jitter) {
    const pts = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      pts.push(new THREE.Vector3(
        x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter,
        y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter,
        z1 + (z2 - z1) * t + (Math.random() - 0.5) * jitter
      ));
    }
    return pts;
  }

  const FRONT_Z = 0.74;
  const eyeRanges = []; // [{start,end,side}] — indices into `points`, used later to animate blinking
  let mouthRange = null;
  [1, -1].forEach(side => {
    // eyebrow
    points.push(...arc(side * 0.42, 0.32, FRONT_Z + 0.02, 0.19, 0.05, side > 0 ? 195 : -15, side > 0 ? 345 : 165, 6, 0.015));
    // eye outline — track its index range for blinking
    const eyeStart = points.length;
    points.push(...arc(side * 0.42, 0.15, FRONT_Z, 0.15, 0.08, 0, 360, 14, 0.012));
    eyeRanges.push({ start: eyeStart, end: points.length, side, cx: side * 0.42, cy: 0.15, cz: FRONT_Z });
    // cheek accent
    points.push(...arc(side * 0.72, -0.15, FRONT_Z - 0.12, 0.14, 0.18, 0, 360, 8, 0.02));
  });
  // nose bridge + tip
  points.push(...line(0, 0.2, FRONT_Z + 0.03, 0, -0.18, FRONT_Z + 0.14, 9, 0.012));
  points.push(...arc(0, -0.2, FRONT_Z + 0.13, 0.09, 0.05, 200, 340, 6, 0.012));
  // mouth — track its index range for the smile animation
  const mouthStart = points.length;
  points.push(...arc(0, -0.58, FRONT_Z + 0.02, 0.26, 0.09, 200, 340, 12, 0.014));
  mouthRange = { start: mouthStart, end: points.length, cx: 0, cy: -0.58, cz: FRONT_Z + 0.02 };
  // jawline (both sides, cheek down to chin)
  [1, -1].forEach(side => {
    points.push(...line(side * 0.9, -0.15, FRONT_Z - 0.25, side * 0.22, -0.92, FRONT_Z - 0.02, 10, 0.02));
  });
  // forehead crest
  points.push(...arc(0, 0.62, FRONT_Z - 0.1, 0.55, 0.18, 200, 340, 9, 0.02));


  const COLORS = [0x5eead4, 0x818cf8, 0x38bdf8, 0xa78bfa, 0xf472b6];
  function glowTexture(hex) {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, hex); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }
  const colorTex = {};
  COLORS.forEach(c => { colorTex[c] = glowTexture("#" + c.toString(16).padStart(6, "0")); });

  const particles = points.map((p, i) => {
    const color = COLORS[i % COLORS.length];
    const mat = new THREE.SpriteMaterial({ map: colorTex[color], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.75 });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.028 + Math.random() * 0.03;
    sprite.scale.setScalar(scale);
    sprite.position.copy(p);
    rig.add(sprite);
    return { mesh: sprite, basePos: p.clone(), baseScale: scale, phase: Math.random() * Math.PI * 2 };
  });

  const eyeParticles = eyeRanges.map(r => ({ ...r, list: particles.slice(r.start, r.end) }));
  const mouthParticles = mouthRange ? particles.slice(mouthRange.start, mouthRange.end) : [];

  // ---------- Nearest-neighbor connective edges (kept sparse for an elegant, non-cluttered look) ----------
  const edgePositions = [];
  const K = 3; // connect each point to its ~3 nearest neighbors
  for (let i = 0; i < points.length; i++) {
    const dists = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      dists.push([points[i].distanceToSquared(points[j]), j]);
    }
    dists.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < K; k++) {
      const [distSq, j] = dists[k];
      if (distSq < 0.16) { // only connect genuinely nearby points
        edgePositions.push(points[i].x, points[i].y, points[i].z, points[j].x, points[j].y, points[j].z);
      }
    }
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.16 });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  rig.add(edgeLines);

  // ---------- 10 real chapter nodes — larger, brighter, placed across the face surface ----------
  const nodeGlowTex = glowTexture("#e0f2fe");
  const nodeMat = new THREE.SpriteMaterial({ map: nodeGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const chapterNodes = [];
  // Landmark positions spread across the face — forehead, temples, cheeks, jaw — front-facing.
  const FACE_LANDMARKS = [
    [0, 0.68, 0.66], [0.55, 0.5, 0.5], [-0.55, 0.5, 0.5],
    [0.75, 0.02, 0.42], [-0.75, 0.02, 0.42],
    [0.55, -0.35, 0.6], [-0.55, -0.35, 0.6],
    [0.28, -0.85, 0.5], [-0.28, -0.85, 0.5],
    [0, -0.42, 0.78]
  ];
  for (let i = 0; i < CODES.length; i++) {
    const [px, py, pz] = FACE_LANDMARKS[i % FACE_LANDMARKS.length];
    const pos = new THREE.Vector3(px, py, pz);

    const sprite = new THREE.Sprite(nodeMat);
    sprite.scale.setScalar(0.11);
    sprite.position.copy(pos);
    rig.add(sprite);

    const code = CODES[i];
    const stat = chapterStats ? chapterStats[code] : { name: CHAPTER_NAMES[code] || code, possibleNC: null, ncCodes: [] };
    chapterNodes.push({ code, mesh: sprite, basePos: pos, stat, phase: Math.random() * Math.PI * 2 });
  }

  // ---------- Cursor interaction: nearby particles brighten + nudge toward cursor ----------
  const raycastPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let cursor3D = null;

  wrapEl.addEventListener("mousemove", e => {
    const rect = wrapEl.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(raycastPlane, pt);
    cursor3D = pt;
  });
  wrapEl.addEventListener("mouseleave", () => { cursor3D = null; hideTooltip(); });

  // ---------- Accessible hit-targets for the 10 real chapter nodes ----------
  const hitEls = chapterNodes.map(n => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "face-node-hit";
    btn.setAttribute("aria-label", `${n.stat.name} chapter${n.stat.possibleNC != null ? `, ${n.stat.possibleNC} possible non-conformities` : ""}`);
    btn.addEventListener("mouseenter", () => { showTooltip(n, btn); setHeroTint(CHAPTER_ACCENT[n.code] || "#0EA5A0"); });
    btn.addEventListener("focus", () => { showTooltip(n, btn); setHeroTint(CHAPTER_ACCENT[n.code] || "#0EA5A0"); });
    btn.addEventListener("mouseleave", () => { hideTooltip(); resetHeroTint(); });
    btn.addEventListener("blur", () => { hideTooltip(); resetHeroTint(); });
    btn.addEventListener("click", () => { window.location.href = `standards.html?ch=${n.code}`; });
    overlay.appendChild(btn);
    return btn;
  });

  function showTooltip(n, el) {
    const rect = wrapEl.getBoundingClientRect();
    const btnRect = el.getBoundingClientRect();
    let ncLine = "";
    if (n.stat.ncCodes && n.stat.ncCodes.length) {
      const shown = n.stat.ncCodes.slice(0, 10).join(", ");
      const extra = n.stat.ncCodes.length - 10;
      ncLine = `<em>${shown}${extra > 0 ? ` +${extra} more` : ""}</em>`;
    }
    tooltip.innerHTML = `<b>${n.stat.name}</b>${n.stat.possibleNC != null ? `<span>Possible NCs: ${n.stat.possibleNC}</span>` : ""}${ncLine}`;
    tooltip.style.left = (btnRect.left - rect.left + btnRect.width / 2) + "px";
    tooltip.style.top = (btnRect.top - rect.top - 8) + "px";
    tooltip.classList.add("show");
  }
  function hideTooltip() { tooltip.classList.remove("show"); }

  function updateHitPositions() {
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    chapterNodes.forEach((n, i) => {
      const world = n.mesh.getWorldPosition(new THREE.Vector3());
      const p = world.clone().project(camera);
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const el = hitEls[i];
      el.style.left = sx + "px"; el.style.top = sy + "px";
      el.style.opacity = p.z > 1 ? "0" : "1";
      el.style.pointerEvents = p.z > 1 ? "none" : "auto";
    });
  }

  // ---------- Animate: left-right sway (not full rotation) + breathing + blink + smile + cursor reaction ----------
  const SWAY_AMPLITUDE = THREE.MathUtils.degToRad(18); // gentle head turn, not a spin
  const SWAY_SPEED = 0.22;
  let t0 = performance.now();
  let nextBlinkAt = 2 + Math.random() * 2.5;
  let blinkT = -1; // -1 = not blinking; else elapsed time into the blink

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    const tt = now / 1000;

    if (!reduceMotion) {
      rig.rotation.y = Math.sin(tt * SWAY_SPEED) * SWAY_AMPLITUDE;
      const breathe = 1 + Math.sin(tt * 0.35) * 0.02;
      rig.scale.setScalar(breathe);
    }

    if (!reduceMotion) {
      particles.forEach(p => {
        let target = p.basePos;
        let scaleMul = 1;
        if (cursor3D) {
          const worldBase = p.basePos.clone().applyMatrix4(rig.matrixWorld);
          const d = worldBase.distanceTo(new THREE.Vector3(cursor3D.x, cursor3D.y, worldBase.z));
          if (d < 0.9) {
            const pull = (1 - d / 0.9) * 0.06;
            const dir = cursor3D.clone().sub(worldBase).normalize();
            target = p.basePos.clone().add(dir.multiplyScalar(pull));
            scaleMul = 1 + (1 - d / 0.9) * 0.8;
          }
        }
        p.mesh.position.lerp(target, 0.15);
        const pulse = 1 + Math.sin(tt * 1.2 + p.phase) * 0.15;
        p.mesh.scale.setScalar(p.baseScale * pulse * scaleMul);
      });
      chapterNodes.forEach(n => {
        const pulse = 1 + Math.sin(tt * 1.5 + n.phase) * 0.18;
        n.mesh.scale.setScalar(0.11 * pulse);
      });

      // ---------- Blinking: periodically compress the eye outlines vertically, then release ----------
      if (blinkT < 0 && tt > nextBlinkAt) blinkT = 0;
      if (blinkT >= 0) {
        blinkT += dt;
        const BLINK_DUR = 0.22;
        const bp = Math.min(1, blinkT / BLINK_DUR);
        const close = bp < 0.5 ? bp * 2 : (1 - bp) * 2; // close then reopen, 0..1..0
        eyeParticles.forEach(eye => {
          eye.list.forEach(p => {
            const closedY = eye.cy + (p.basePos.y - eye.cy) * (1 - close * 0.92);
            p.mesh.position.y = THREE.MathUtils.lerp(p.mesh.position.y, closedY, 0.9);
          });
        });
        if (blinkT >= BLINK_DUR) {
          blinkT = -1;
          nextBlinkAt = tt + 2.5 + Math.random() * 3.5;
        }
      }

      // ---------- Smiling: a slow, continuous gentle smile breathing at the mouth corners ----------
      const smileAmount = (Math.sin(tt * 0.28) * 0.5 + 0.5) * 0.55 + 0.15; // 0.15..0.7, never fully flat
      mouthParticles.forEach(p => {
        const dx = p.basePos.x - mouthRange.cx;
        const curve = Math.abs(dx) * Math.abs(dx) * 0.55; // corners lift more than the center
        const smileY = p.basePos.y + curve * smileAmount;
        p.mesh.position.y = THREE.MathUtils.lerp(p.mesh.position.y, smileY, 0.06);
      });
    }

    rig.updateMatrixWorld();
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    updateHitPositions();
  }

  requestAnimationFrame(() => {
    sizeRenderer();
    animate();
    setTimeout(() => loadingEl && loadingEl.classList.add("hidden"), 500);
  });
})();
