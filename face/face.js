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

  // ---------- Morphing organ point cloud ----------
  // All organs share one particle set; only their TARGET positions change, so
  // particles physically travel between shapes rather than vanishing.
  const N_POINTS = 850;
  // Overall size of the organ in world units. Kept below the framing limit so the
  // wireframe never clips against the canvas edge while breathing or beating.
  const ORGAN_RADIUS = 1.24;
  const _built = window.OrganShapes ? window.OrganShapes.buildAll(N_POINTS, ORGAN_RADIUS) : null;
  const ORGANS = _built ? _built.shapes : null;
  const META = _built ? _built.meta : {};
  const ORDER = window.OrganShapes ? window.OrganShapes.ORDER : ["face"];
  const LABELS = window.OrganShapes ? window.OrganShapes.LABELS : { face: "Face" };

  // Fallback: if the shape module failed to load, keep a simple sphere so the
  // hero still renders rather than showing nothing.
  const points = [];
  if (ORGANS) {
    ORGANS[ORDER[0]].forEach(([x, y, z]) => points.push(new THREE.Vector3(x, y, z)));
  } else {
    for (let i = 0; i < N_POINTS; i++) {
      const y = 1 - (i / (N_POINTS - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963;
      points.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r).multiplyScalar(ORGAN_RADIUS));
    }
  }

  const COLORS = [0x5eead4, 0x38bdf8, 0x818cf8, 0xa78bfa, 0xf472b6, 0x34d399, 0x60a5fa, 0xc084fc];
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

  // ---------- Wireframe mesh edges ----------
  // When the real organ meshes are loaded (OrganShapes.source === "mesh"), the web is
  // the organ's own surface wireframe: edges come from the mesh geometry, and the set
  // swaps as the cloud morphs from one organ to the next. Without the mesh data this
  // falls back to the original nearest-neighbour web, so the hero still renders.
  const MESH_MODE = !!(window.OrganShapes && window.OrganShapes.source === "mesh" && window.OrganShapes.edgesFor);

  const SHAPE_EDGES = {};
  if (MESH_MODE) {
    ORDER.forEach(name => { SHAPE_EDGES[name] = window.OrganShapes.edgesFor(name, N_POINTS) || []; });
  }

  function nearestNeighbourEdges() {
    const K = 3, pairs = [];
    for (let i = 0; i < points.length; i++) {
      const dists = [];
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        dists.push([points[i].distanceToSquared(points[j]), j]);
      }
      dists.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < K; k++) if (dists[k][0] < 0.20) pairs.push([i, dists[k][1]]);
    }
    return pairs;
  }

  let edgePairs = MESH_MODE ? (SHAPE_EDGES[ORDER[0]] || []) : nearestNeighbourEdges();

  // Buffer sized to the largest edge set so the shape swap never reallocates.
  const MAX_EDGES = MESH_MODE
    ? ORDER.reduce((m, n) => Math.max(m, (SHAPE_EDGES[n] || []).length), 0)
    : edgePairs.length;

  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(MAX_EDGES * 6), 3));
  // Brighter and denser than the old connective web — this is the organ's skin now,
  // so it should read as a living surface rather than a faint scaffold.
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: MESH_MODE ? 0.34 : 0.15,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  rig.add(edgeLines);

  // Swap the wireframe to a different organ's edge set.
  function setEdgeShape(name) {
    if (!MESH_MODE) return;
    edgePairs = SHAPE_EDGES[name] || [];
  }

  // Only draw a link while its two particles are still close — during a morph
  // some pairs fly apart, and stretching a line across the shape looks wrong.
  function refreshEdges() {
    const arr = edgeGeo.attributes.position.array;
    for (let e = 0; e < edgePairs.length; e++) {
      const a = particles[edgePairs[e][0]].mesh.position;
      const b = particles[edgePairs[e][1]].mesh.position;
      const o = e * 6;
      if (a.distanceToSquared(b) > 0.5) {
        arr[o] = arr[o+1] = arr[o+2] = arr[o+3] = arr[o+4] = arr[o+5] = 0;
      } else {
        arr[o] = a.x; arr[o+1] = a.y; arr[o+2] = a.z;
        arr[o+3] = b.x; arr[o+4] = b.y; arr[o+5] = b.z;
      }
    }
    // Blank any leftover slots from a previously larger edge set.
    for (let e = edgePairs.length; e < MAX_EDGES; e++) {
      const o = e * 6;
      arr[o] = arr[o+1] = arr[o+2] = arr[o+3] = arr[o+4] = arr[o+5] = 0;
    }
    edgeGeo.attributes.position.needsUpdate = true;
  }

  // ---------- 10 real chapter nodes, anchored to the morphing cloud ----------
  const nodeGlowTex = glowTexture("#e0f2fe");
  const nodeMat = new THREE.SpriteMaterial({ map: nodeGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // Each chapter node rides a fixed particle index, so it travels with the
  // shape through every morph and always sits on the current organ.
  const chapterNodes = [];
  for (let i = 0; i < CODES.length; i++) {
    const anchor = Math.floor((i + 0.5) * (points.length / CODES.length)) % points.length;
    const sprite = new THREE.Sprite(nodeMat);
    sprite.scale.setScalar(0.11);
    sprite.position.copy(points[anchor]);
    rig.add(sprite);
    const code = CODES[i];
    const stat = chapterStats ? chapterStats[code]
      : { name: CHAPTER_NAMES[code] || code, possibleNC: null, ncCodes: [] };
    chapterNodes.push({ code, mesh: sprite, anchor, stat, phase: Math.random() * Math.PI * 2 });
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

  // ---------- Morph state ----------
  const HOLD_MS = 3000;                 // each organ is shown for 3s
  const MORPH_MS = 1500;                // and takes 1.5s to travel to the next
  let organIdx = 0, nextIdx = 1, morphT = 1, lastSwitch = performance.now();
  let edgesSwapped = true;   // true once the wireframe has moved to the incoming organ
  const from = points.map(p => p.clone());
  const to = points.map(p => p.clone());

  function setTargets(nameA, nameB) {
    if (!ORGANS) return;
    ORGANS[nameA].forEach((v, i) => from[i].set(v[0], v[1], v[2]));
    ORGANS[nameB].forEach((v, i) => to[i].set(v[0], v[1], v[2]));
  }
  if (ORGANS) setTargets(ORDER[0], ORDER[1 % ORDER.length]);

  // Organ names are deliberately not shown — the shapes read as an evolving
  // anatomical network rather than a labelled slideshow.

  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // ---------- Functional motion + electrical impulse ----------
  // Each organ does something real while it is held: the brain fires an impulse
  // outward from the frontal pole, the heart beats, the lungs breathe, the face
  // blinks and smiles. Everything else carries a travelling impulse wave.
  //
  // Timing note: the impulse is tuned to complete its sweep inside the 3s hold,
  // so a shape never changes mid-function.
  const impulseTex = glowTexture("#ffffff");
  let impulseT = 0;                 // 0..1 sweep across the organ
  let currentMotion = "impulse";
  let pulseOrigin = new THREE.Vector3(0, 1.2, 0);

  // Distance of each particle from the impulse origin, recomputed per organ so
  // the wave travels through the shape rather than across the screen.
  const impulseDist = new Float32Array(points.length);
  let maxImpulseDist = 1;
  function recomputeImpulse(name) {
    const m = META[name] || {};
    currentMotion = m.motion || "impulse";
    const o = m.pulseFrom || [0, 1.2, 0];
    pulseOrigin.set(o[0], o[1], o[2]).multiplyScalar(1.0);
    maxImpulseDist = 0.0001;
    for (let i = 0; i < points.length; i++) {
      const d = to[i].distanceTo(pulseOrigin);
      impulseDist[i] = d;
      if (d > maxImpulseDist) maxImpulseDist = d;
    }
    impulseT = 0;
  }

  // Face features, used for the blink and smile.
  const faceEyes = new Set(), faceMouth = new Set();
  function indexFaceFeatures() {
    faceEyes.clear(); faceMouth.clear();
    if (!ORGANS) return;
    // Thresholds are expressed as a fraction of the organ radius so the eye and
    // mouth regions stay correct if ORGAN_RADIUS changes.
    const u = ORGAN_RADIUS / 1.55;
    ORGANS.face.forEach(([x, y, z], i) => {
      if (z > 0.35 * u && y > 0.05 * u && y < 0.42 * u && Math.abs(x) > 0.18 * u && Math.abs(x) < 0.62 * u) faceEyes.add(i);
      if (z > 0.30 * u && y > -0.62 * u && y < -0.30 * u && Math.abs(x) < 0.46 * u) faceMouth.add(i);
    });
  }
  indexFaceFeatures();

  let beatPhase = 0, breathPhase = 0, blinkAt = 1.2, blinkT = -1;

  // Safe to call now: every const it depends on is initialised above.
  if (ORGANS) recomputeImpulse(ORDER[Math.min(1, ORDER.length - 1)]);

  // ---------- Animate ----------
  const SWAY = THREE.MathUtils.degToRad(16);
  const SWAY_SPEED = 0.2;
  let t0 = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    const tt = now / 1000;

    // advance the morph
    if (ORGANS && !reduceMotion) {
      if (morphT >= 1 && now - lastSwitch > HOLD_MS) {
        organIdx = nextIdx;
        nextIdx = (nextIdx + 1) % ORDER.length;
        setTargets(ORDER[organIdx], ORDER[nextIdx]);
        // The morph runs from organIdx TO nextIdx, so the shape that settles on
        // screen — and therefore the one whose motion should play — is nextIdx.
        recomputeImpulse(ORDER[nextIdx]);
        setEdgeShape(ORDER[organIdx]);       // wireframe of the shape we are leaving
        edgesSwapped = false;
        morphT = 0;
        lastSwitch = now;
      }
      if (morphT < 1) {
        morphT = Math.min(1, morphT + dt * (1000 / MORPH_MS));
        // Swap the wireframe at the midpoint, where the cloud stops reading as the
        // old organ and starts reading as the new one.
        if (!edgesSwapped && morphT >= 0.5) { setEdgeShape(ORDER[nextIdx]); edgesSwapped = true; }
        if (morphT >= 1) lastSwitch = now;   // start the hold once travel completes
      }
    }
    const k = easeInOut(morphT);

    if (!reduceMotion) {
      rig.rotation.y = Math.sin(tt * SWAY_SPEED) * SWAY;
      rig.scale.setScalar(1 + Math.sin(tt * 0.35) * 0.02);
    }

    // --- functional motion, only once the shape has settled ---
    const settled = morphT >= 1 ? 1 : 0;
    if (!reduceMotion && settled) {
      impulseT = Math.min(1.35, impulseT + dt * 0.85);   // completes well inside the 3s hold
      beatPhase += dt * 5.6;                              // ~2.7 beats during the 3s hold
      breathPhase += dt * 2.1;                            // ~1 full breath in / out
      if (currentMotion === "face") {
        if (blinkT < 0 && tt > blinkAt) blinkT = 0;
        if (blinkT >= 0) { blinkT += dt; if (blinkT > 0.22) { blinkT = -1; blinkAt = tt + 1.6 + Math.random() * 2; } }
      }
    } else { impulseT = 0; }

    // heartbeat: sharp contraction then elastic recoil
    const beat = currentMotion === "heart" && settled
      ? 1 - Math.max(0, Math.sin(beatPhase)) ** 8 * 0.13 : 1;
    // breathing: slow sinusoidal expansion
    const breath = currentMotion === "lungs" && settled
      ? 1 + Math.sin(breathPhase) * 0.085 : 1;

    particles.forEach((p, i) => {
      // where this particle should be, mid-morph
      let tx = from[i].x + (to[i].x - from[i].x) * k;
      let ty = from[i].y + (to[i].y - from[i].y) * k;
      let tz = from[i].z + (to[i].z - from[i].z) * k;

      if (settled && !reduceMotion) {
        if (currentMotion === "heart") { tx *= beat; ty *= beat; tz *= beat; }
        else if (currentMotion === "lungs") {
          // expand outward from the midline, as a chest actually does
          tx *= breath; tz *= breath; ty *= 1 + (breath - 1) * 0.35;
        }
        else if (currentMotion === "face") {
          if (blinkT >= 0 && faceEyes.size) {
            const close = blinkT < 0.11 ? blinkT / 0.11 : (0.22 - blinkT) / 0.11;
            if (faceEyes.has(i)) ty += (0.22 - ty) * close * 0.85;
          }
          if (faceMouth.has(i)) {
            const smile = (Math.sin(tt * 0.5) * 0.5 + 0.5) * 0.5 + 0.2;
            ty += Math.abs(tx) * Math.abs(tx) * 0.55 * smile;
          }
        }
      }
      p.basePos.set(tx, ty, tz);

      // impulse wave: a bright band sweeping outward from the origin
      let impulse = 0;
      if (settled && !reduceMotion) {
        const front = impulseT * maxImpulseDist * 1.15;
        const band = Math.abs(impulseDist[i] - front);
        if (band < 0.28) impulse = 1 - band / 0.28;
      }

      let target = p.basePos, scaleMul = 1 + impulse * 1.4;
      if (cursor3D && !reduceMotion) {
        const world = p.basePos.clone().applyMatrix4(rig.matrixWorld);
        const d = world.distanceTo(new THREE.Vector3(cursor3D.x, cursor3D.y, world.z));
        if (d < 0.9) {
          const pull = (1 - d / 0.9) * 0.06;
          target = p.basePos.clone().add(cursor3D.clone().sub(world).normalize().multiplyScalar(pull));
          scaleMul = 1 + (1 - d / 0.9) * 0.8;
        }
      }
      p.mesh.position.lerp(target, morphT < 1 ? 0.35 : 0.15);
      const pulse = reduceMotion ? 1 : 1 + Math.sin(tt * 1.2 + p.phase) * 0.15;
      p.mesh.scale.setScalar(p.baseScale * pulse * scaleMul);
      p.mesh.material.opacity = Math.min(1, 0.75 + impulse * 0.85);
    });

    if (!reduceMotion) {
      chapterNodes.forEach(n => {
        n.mesh.position.copy(particles[n.anchor].mesh.position);
        const pulse = 1 + Math.sin(tt * 1.5 + n.phase) * 0.18;
        n.mesh.scale.setScalar(0.11 * pulse);
      });
    }

    refreshEdges();
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
