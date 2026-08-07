/* AQcredix — NABH Readiness Radar
   A real, usable tool: 10 glowing towers, one per NABH chapter, arranged in a
   circle. Drag any tower up/down to set your self-assessed readiness for that
   chapter (0-100). The overall score is a genuine weighted average — chapters
   with more Core elements (the ones assessed every time) count for more,
   since that's how NABH actually weights risk. Saved to this browser only. */

(function () {
  const stage = document.getElementById("radarStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".radar-canvas-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="radar-fallback">AQcredix<br>Accreditation &amp; Quality Implementation Guidance Platform</div>`;
    return;
  }
  if (!window.NABH_DATA) return;

  const OFFICIAL = window.NABH_DATA.official;
  const CHAPTERS = window.NABH_DATA.chapters;
  const CODES = Object.keys(OFFICIAL); // 10 chapters, real order from the book

  const STORE_KEY = "aq-readiness-scores";
  function loadScores() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      const scores = {};
      CODES.forEach(c => { scores[c] = typeof saved[c] === "number" ? saved[c] : 60; });
      return scores;
    } catch (e) {
      const scores = {}; CODES.forEach(c => scores[c] = 60); return scores;
    }
  }
  function saveScores(scores) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(scores)); } catch (e) {}
  }
  let scores = loadScores();

  function weightedOverall() {
    let weightedSum = 0, totalWeight = 0;
    CODES.forEach(c => {
      const weight = OFFICIAL[c].core * 2 + OFFICIAL[c].commitment; // Core counts double — matches real audit risk weighting
      weightedSum += scores[c] * weight;
      totalWeight += weight;
    });
    return totalWeight ? weightedSum / totalWeight : 0;
  }

  function scoreColor(v) {
    if (v < 50) return 0xf87171;      // red
    if (v < 75) return 0xfbbf24;      // amber
    return 0x5eead4;                   // teal — matches theme accent
  }

  // ---------- Renderer / scene / camera ----------
  const canvas = document.getElementById("radarCanvas");
  const overlay = document.getElementById("radarOverlay");
  const loadingEl = document.getElementById("radarLoading");
  const overallEl = document.getElementById("radarOverall");
  const resetBtn = document.getElementById("radarResetBtn");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  let camDistance = 6.2;

  function sizeRenderer() {
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  sizeRenderer();
  window.addEventListener("resize", sizeRenderer);

  const rig = new THREE.Group();
  scene.add(rig);

  // Base ring (ground plane reference)
  const RADIUS = 2.2, MAX_H = 2.6;
  const ringGeo = new THREE.RingGeometry(RADIUS - 0.02, RADIUS + 0.02, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x1f2a5c, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  rig.add(ring);

  // Base disc glow
  const discGeo = new THREE.CircleGeometry(RADIUS, 64);
  const discMat = new THREE.MeshBasicMaterial({ color: 0x0b1030, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.01;
  rig.add(disc);

  // Vertical guide beams (added per-tower below) mark the height scale — cleaner than flat rings.

  // ---------- Towers ----------
  const towers = []; // {code, angle, mesh, glowMesh, labelEl, valueEl}
  function towerColor(v) { return new THREE.Color(scoreColor(v)); }

  function buildTowers() {
    towers.forEach(t => rig.remove(t.mesh, t.beam));
    towers.length = 0;

    CODES.forEach((code, i) => {
      const angle = (i / CODES.length) * Math.PI * 2;
      const x = Math.cos(angle) * RADIUS, z = Math.sin(angle) * RADIUS;
      const v = scores[code];
      const h = Math.max(0.08, (v / 100) * MAX_H);

      const geo = new THREE.CylinderGeometry(0.16, 0.2, h, 12);
      const mat = new THREE.MeshBasicMaterial({ color: towerColor(v), transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, h / 2, z);
      mesh.userData = { code, angle };
      rig.add(mesh);

      // faint vertical guide beam to max height
      const beamGeo = new THREE.CylinderGeometry(0.008, 0.008, MAX_H, 6);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0x2a3568, transparent: true, opacity: 0.25 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, MAX_H / 2, z);
      rig.add(beam);

      towers.push({ code, angle, mesh, beam, x, z });
    });
  }
  buildTowers();

  // connecting polygon line at current heights (the "radar" silhouette)
  let polyLine = null;
  function rebuildPolyLine() {
    if (polyLine) { rig.remove(polyLine); polyLine.geometry.dispose(); }
    const pts = towers.map(t => {
      const h = Math.max(0.08, (scores[t.code] / 100) * MAX_H);
      return new THREE.Vector3(t.x, h, t.z);
    });
    pts.push(pts[0]);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.55 });
    polyLine = new THREE.Line(geo, mat);
    rig.add(polyLine);
  }
  rebuildPolyLine();

  function updateOverallDisplay() {
    const overall = weightedOverall();
    if (overallEl) {
      overallEl.querySelector(".radar-overall-num").textContent = Math.round(overall) + "%";
      const label = overall < 50 ? "Needs focus" : overall < 75 ? "Building readiness" : "Audit-ready";
      overallEl.querySelector(".radar-overall-label").textContent = label;
      overallEl.querySelector(".radar-overall-num").style.color =
        overall < 50 ? "#f87171" : overall < 75 ? "#fbbf24" : "#5eead4";
    }
  }
  updateOverallDisplay();

  function refreshTower(code) {
    const t = towers.find(x => x.code === code);
    if (!t) return;
    const v = scores[code];
    const h = Math.max(0.08, (v / 100) * MAX_H);
    t.mesh.geometry.dispose();
    t.mesh.geometry = new THREE.CylinderGeometry(0.16, 0.2, h, 12);
    t.mesh.position.y = h / 2;
    t.mesh.material.color.set(towerColor(v));
    rebuildPolyLine();
    updateOverallDisplay();
  }

  // ---------- Labels (HTML overlay, projected each frame) ----------
  function renderLabels() {
    overlay.innerHTML = "";
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    towers.forEach(t => {
      const v = scores[t.code];
      const topY = Math.max(0.08, (v / 100) * MAX_H) + 0.35;
      const worldPos = new THREE.Vector3(t.x, topY, t.z).applyMatrix4(rig.matrixWorld);
      const p = worldPos.clone().project(camera);
      if (p.z > 1) return;
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const lbl = document.createElement("div");
      lbl.className = "radar-label";
      lbl.style.left = sx + "px"; lbl.style.top = sy + "px";
      lbl.innerHTML = `<b>${t.code}</b><span>${Math.round(v)}%</span>`;
      lbl.title = CHAPTERS[t.code].name + " — drag the tower to adjust";
      overlay.appendChild(lbl);
    });
  }

  // ---------- Interaction: orbit-drag empty space, vertical-drag on a tower to change score ----------
  let rotY = 0.5, rotX = 0.28, velY = 0;
  let dragging = false, draggingTower = null, lastX = 0, lastY = 0, dragStartValue = 0;

  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();

  function pickTower(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    const hit = raycaster.intersectObjects(towers.map(t => t.mesh));
    return hit.length ? towers.find(t => t.mesh === hit[0].object) : null;
  }

  function onDown(x, y) {
    const hitTower = pickTower(x, y);
    if (hitTower) {
      draggingTower = hitTower;
      dragStartValue = scores[hitTower.code];
      lastY = y;
    } else {
      dragging = true; lastX = x; lastY = y; velY = 0;
    }
  }
  function onMove(x, y) {
    if (draggingTower) {
      const deltaY = lastY - y; // drag up = increase
      const newVal = Math.max(0, Math.min(100, dragStartValue + deltaY * 0.45));
      scores[draggingTower.code] = newVal;
      refreshTower(draggingTower.code);
      return;
    }
    if (!dragging) return;
    const dx = x - lastX;
    rotY += dx * 0.006;
    velY = dx * 0.006;
    lastX = x; lastY = y;
  }
  function onUp() {
    if (draggingTower) { saveScores(scores); draggingTower = null; }
    dragging = false;
  }

  canvas.addEventListener("mousedown", e => onDown(e.clientX, e.clientY));
  window.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener("touchmove", e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
  canvas.addEventListener("touchend", onUp);
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    camDistance = Math.max(4, Math.min(9, camDistance + e.deltaY * 0.003));
  }, { passive: false });

  resetBtn && resetBtn.addEventListener("click", () => {
    CODES.forEach(c => scores[c] = 60);
    saveScores(scores);
    buildTowers();
    rebuildPolyLine();
    updateOverallDisplay();
  });

  // ---------- Animate ----------
  function animate() {
    requestAnimationFrame(animate);
    if (!dragging && !draggingTower && !reduceMotion) {
      rotY += velY; velY *= 0.94;
      rotY += 0.0012;
    }
    rig.rotation.set(rotX, rotY, 0);
    camera.position.set(Math.sin(0) * 0, camDistance * 0.42, camDistance);
    camera.lookAt(0, MAX_H * 0.35, 0);
    rig.updateMatrixWorld();
    renderer.render(scene, camera);
    renderLabels();
  }

  requestAnimationFrame(() => {
    sizeRenderer();
    animate();
    setTimeout(() => loadingEl && loadingEl.classList.add("hidden"), 350);
  });
})();
