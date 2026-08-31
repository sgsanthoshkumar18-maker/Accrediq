/* AQcredix — Neural Brain
   A procedural 3D brain-shaped particle network (vanilla Three.js — this
   project has no React/build step). Two lobed point clouds with organic
   surface noise approximate a brain silhouette; nearest-neighbor edges form
   the connective web. Ten larger, brighter nodes are the real NABH chapters
   — hover/click them exactly like the previous globe nodes did. */

(function () {
  /* Scene colours come from theme/scene-palette.js when it is present; every
     lookup below falls back to the value this scene shipped with. */
  var P = window.AQScenePalette || { name: function () { return "default"; },
    chapters: function (f) { return f; }, categories: function (f) { return f; },
    cycle: function (f) { return f; }, accent: function (f) { return f; },
    dim: function (f) { return f; }, ambient: function (f) { return f; },
    key: function (f) { return f; }, link: function (f) { return f; },
    deep: function (f) { return f; }, onChange: function () {} };
  const stage = document.getElementById("brainStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".brain-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="brain-fallback">AQcredix<br>Accreditation &amp; Quality Implementation Guidance Platform</div>`;
    return;
  }

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("brainCanvas");
  const overlay = document.getElementById("brainNodeOverlay");
  const loadingEl = document.getElementById("brainLoading");
  const tooltip = document.getElementById("brainTooltip");

  // ---------- Real chapter data (same as before) ----------
  const CHAPTER_NAMES = {
    AAC: "Access, Assessment & Continuity", COP: "Care of Patients", MOM: "Management of Medication",
    PRE: "Patient Rights & Education", IPC: "Infection Prevention & Control", PSQ: "Patient Safety & Quality",
    ROM: "Responsibility of Management", FMS: "Facility Management & Safety",
    HRM: "Human Resource Management", IMS: "Information Management System"
  };
  const CHAPTER_ACCENT = {
    AAC: "#4c6fff", COP: "#818cf8", MOM: "#f472b6", PRE: "#60a5fa", IPC: "#f87171",
    PSQ: "#fbbf24", ROM: "#a78bfa", FMS: "#d946ef", HRM: "#fb923c", IMS: "#7d9bff"
  };
  const heroEl = document.querySelector(".hero");
  /* A chapter colour chosen for a dark stage can be far too pale for white paper. Darken
     toward ink until it carries — the hue survives, the contrast becomes real. Large text
     needs 3:1, and the hero headline and the metric numbers are the only consumers. */
  function tintFor(hex) {
    try {
      if (document.documentElement.getAttribute("data-theme") === "dark") return hex;
      var n = parseInt(String(hex).replace("#", ""), 16);
      var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      function lum(c) {
        var f = [c[0], c[1], c[2]].map(function (v) {
          v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
      }
      for (var k = 0; k < 24 && (1.05) / (lum([r, g, b]) + 0.05) < 3.4; k++) {
        r = Math.round(r * 0.9); g = Math.round(g * 0.9); b = Math.round(b * 0.9);
      }
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) { return hex; }
  }

  function setHeroTint(hex) { if (heroEl) heroEl.style.setProperty("--hero-tint", tintFor(hex)); }
  function resetHeroTint() { if (heroEl) heroEl.style.setProperty("--hero-tint", tintFor("#4C6FFF")); }
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
  camera.position.set(0, 0.1, 4.3);
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

  scene.add(new THREE.AmbientLight(P.ambient(0x9db4ff), 0.5));
  const key = new THREE.DirectionalLight(P.key(0xffffff), 0.8); key.position.set(3, 3, 5); scene.add(key);

  const rig = new THREE.Group();
  scene.add(rig);

  // ---------- Procedural brain-shaped point cloud ----------
  // Cheap deterministic pseudo-noise (avoids an external noise-library dependency)
  function hashNoise(x, y, z) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  }
  function fractalNoise(x, y, z) {
    return hashNoise(x, y, z) * 0.6 + hashNoise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + hashNoise(x * 4.3, y * 4.3, z * 4.3) * 0.1;
  }

  // brain "signed-distance-ish" test: two overlapping lobes, flattened + a central fissure gap + lumpy surface
  function insideBrain(p) {
    const lobeSign = p.x >= 0 ? 1 : -1;
    const lx = (Math.abs(p.x) - 0.42) / 1.05;
    const ly = p.y / 0.78;
    const lz = p.z / 0.95;
    let d = lx * lx + ly * ly + lz * lz;
    const bump = fractalNoise(p.x * 2.6, p.y * 2.6, p.z * 2.6) * 0.11;
    d -= bump;
    const fissureGap = Math.abs(p.x) < 0.05 && p.y > -0.1 ? 999 : 0; // thin central longitudinal fissure
    return d < 1.0 && !fissureGap;
  }

  const N_POINTS = 850;
  const points = []; // THREE.Vector3
  let attempts = 0;
  while (points.length < N_POINTS && attempts < N_POINTS * 40) {
    attempts++;
    const p = new THREE.Vector3((Math.random() * 2 - 1) * 1.6, (Math.random() * 2 - 1) * 0.95, (Math.random() * 2 - 1) * 1.15);
    if (insideBrain(p)) {
      // bias toward the surface shell for a cortex-like look, not a filled blob
      const shellTest = new THREE.Vector3(p.x * 1.06, p.y * 1.06, p.z * 1.06);
      if (!insideBrain(shellTest) || Math.random() < 0.35) points.push(p);
    }
  }

  const COLORS = P.cycle([0x4c6fff, 0x818cf8, 0x7d9bff, 0xa78bfa, 0xf472b6]);
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
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x4c6fff, transparent: true, opacity: 0.16 });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  rig.add(edgeLines);

  // ---------- 10 real chapter nodes — larger, brighter, placed on the brain surface ----------
  const nodeGlowTex = glowTexture("#e0f2fe");
  const nodeMat = new THREE.SpriteMaterial({ map: nodeGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const chapterNodes = [];
  for (let i = 0; i < CODES.length; i++) {
    // place along the golden-angle spiral projected onto the brain surface for even spread
    const t = i / CODES.length;
    const theta = i * 2.399963;
    const lobe = i % 2 === 0 ? 1 : -1;
    const px = lobe * (0.55 + 0.5 * Math.cos(theta * 0.6));
    const py = 0.35 * Math.sin(theta) - 0.05;
    const pz = 0.55 * Math.cos(theta * 1.3);
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
    btn.className = "brain-node-hit";
    btn.setAttribute("aria-label", `${n.stat.name} chapter${n.stat.possibleNC != null ? `, ${n.stat.possibleNC} possible non-conformities` : ""}`);
    btn.addEventListener("mouseenter", () => { showTooltip(n, btn); setHeroTint(CHAPTER_ACCENT[n.code] || "#4C6FFF"); });
    btn.addEventListener("focus", () => { showTooltip(n, btn); setHeroTint(CHAPTER_ACCENT[n.code] || "#4C6FFF"); });
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

  // ---------- Animate: slow rotation + breathing + cursor reaction ----------
  let baseRotY = 0.3;
  const ROT_SPEED = (Math.PI * 2) / 130;
  let t0 = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    const tt = now / 1000;

    if (!reduceMotion) {
      baseRotY += ROT_SPEED * dt;
      const breathe = 1 + Math.sin(tt * 0.35) * 0.025;
      rig.scale.setScalar(breathe);
    }
    rig.rotation.y = baseRotY;

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
