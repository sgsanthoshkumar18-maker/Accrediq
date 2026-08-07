/* AQcredix — Departments Galaxy
   A procedural spiral galaxy (vanilla Three.js) where each bright star is a
   real department from window.DEPT_DATA. Labels cycle automatically every
   few seconds (no hover needed) the way the Moffett reference calls out
   info without a click; hovering/clicking a star opens that department's
   real card in the grid below it. */

(function () {
  const stage = document.getElementById("galaxyStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".gx-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="gx-fallback">AQcredix<br>Accreditation &amp; Quality Implementation Guidance</div>`;
    return;
  }
  if (!window.DEPT_DATA) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("galaxyCanvas");
  const overlay = document.getElementById("galaxyNodeOverlay");
  const loadingEl = document.getElementById("galaxyLoading");
  const autoLabel = document.getElementById("galaxyAutoLabel");
  const tooltip = document.getElementById("galaxyTooltip");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 5.2, 8.8);
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

  const rig = new THREE.Group();
  scene.add(rig);

  function glowTexture(hex) {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, hex); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  // ---------- Background star dust (ambient, not clickable) ----------
  const DUST_COLORS = ["rgba(224,242,254,1)", "rgba(94,234,212,1)", "rgba(129,140,248,1)"];
  const dustTex = DUST_COLORS.map(glowTexture);
  const ARMS = 3, DUST_COUNT = 900;
  for (let i = 0; i < DUST_COUNT; i++) {
    const arm = i % ARMS;
    const t = Math.random();
    const radius = t * 3.6;
    const angle = t * Math.PI * 4 + (arm * (Math.PI * 2 / ARMS)) + (Math.random() - 0.5) * 0.5;
    const spread = (1 - t) * 0.5 + 0.08;
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * spread;
    const y = (Math.random() - 0.5) * 0.22 * (1 - t * 0.6);

    const mat = new THREE.SpriteMaterial({ map: dustTex[i % dustTex.length], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 + Math.random() * 0.3 });
    const sprite = new THREE.Sprite(mat);
    const s = 0.02 + Math.random() * 0.035;
    sprite.scale.setScalar(s);
    sprite.position.set(x, y, z);
    rig.add(sprite);
  }

  // galactic core glow
  const coreMat = new THREE.SpriteMaterial({ map: glowTexture("rgba(199,210,254,1)"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
  const core = new THREE.Sprite(coreMat);
  core.scale.setScalar(1.1);
  rig.add(core);

  // ---------- Department stars — one per real department ----------
  const DEPTS = window.DEPT_DATA;
  const starTex = glowTexture("rgba(255,255,255,1)");
  const deptStars = DEPTS.map((d, i) => {
    const t = (i + 0.5) / DEPTS.length;
    const arm = i % ARMS;
    const radius = 0.55 + t * 3.0;
    const angle = t * Math.PI * 4 + (arm * (Math.PI * 2 / ARMS));
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = (Math.random() - 0.5) * 0.12;

    const mat = new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(0.1);
    sprite.position.set(x, y, z);
    rig.add(sprite);

    return { dept: d, mesh: sprite, basePos: sprite.position.clone(), phase: Math.random() * Math.PI * 2 };
  });

  // ---------- Accessible hit-targets ----------
  const hitEls = deptStars.map(s => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gx-node-hit";
    btn.setAttribute("aria-label", `${s.dept.name} department`);
    btn.addEventListener("mouseenter", () => showTooltip(s, btn));
    btn.addEventListener("focus", () => showTooltip(s, btn));
    btn.addEventListener("mouseleave", hideTooltip);
    btn.addEventListener("blur", hideTooltip);
    btn.addEventListener("click", () => {
      if (typeof window.openDeptFromGalaxy === "function") window.openDeptFromGalaxy(s.dept.id);
    });
    overlay.appendChild(btn);
    return btn;
  });

  function showTooltip(s, el) {
    const rect = wrapEl.getBoundingClientRect();
    const btnRect = el.getBoundingClientRect();
    tooltip.innerHTML = `<b>${s.dept.name}</b><span>Click to open</span>`;
    tooltip.style.left = (btnRect.left - rect.left + btnRect.width / 2) + "px";
    tooltip.style.top = (btnRect.top - rect.top - 8) + "px";
    tooltip.classList.add("show");
  }
  function hideTooltip() { tooltip.classList.remove("show"); }

  function updateHitPositions() {
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    deptStars.forEach((s, i) => {
      const world = s.mesh.getWorldPosition(new THREE.Vector3());
      const p = world.clone().project(camera);
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const el = hitEls[i];
      el.style.left = sx + "px"; el.style.top = sy + "px";
      el.style.opacity = p.z > 1 ? "0" : "1";
      el.style.pointerEvents = p.z > 1 ? "none" : "auto";

      if (autoLabelIndex === i && autoLabel) {
        autoLabel.style.left = sx + "px";
        autoLabel.style.top = sy + "px";
      }
    });
  }

  // ---------- Auto-cycling labels (no hover needed) ----------
  let autoLabelIndex = -1;
  function cycleAutoLabel() {
    autoLabelIndex = (autoLabelIndex + 1) % deptStars.length;
    const s = deptStars[autoLabelIndex];
    if (autoLabel) {
      autoLabel.textContent = s.dept.name;
      autoLabel.classList.remove("show");
      void autoLabel.offsetWidth; // restart animation
      autoLabel.classList.add("show");
    }
  }
  let cycleTimer = null;
  if (!reduceMotion) {
    cycleAutoLabel();
    cycleTimer = setInterval(cycleAutoLabel, 3200);
  }

  // ---------- Slow rotation + gentle drag-orbit ----------
  let rotY = 0, velY = 0, dragging = false, lastX = 0;
  const ROT_SPEED = (Math.PI * 2) / 140;

  wrapEl.addEventListener("mousedown", e => { dragging = true; lastX = e.clientX; velY = 0; });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    rotY += dx * 0.005; velY = dx * 0.005; lastX = e.clientX;
  });
  window.addEventListener("mouseup", () => { dragging = false; });
  wrapEl.addEventListener("touchstart", e => { dragging = true; lastX = e.touches[0].clientX; }, { passive: true });
  wrapEl.addEventListener("touchmove", e => {
    const dx = e.touches[0].clientX - lastX;
    rotY += dx * 0.005; lastX = e.touches[0].clientX;
  }, { passive: true });
  wrapEl.addEventListener("touchend", () => { dragging = false; });

  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    const tt = now / 1000;

    if (!reduceMotion) {
      if (!dragging) { rotY += ROT_SPEED * dt + velY * 0.3 * dt * 10; velY *= 0.95; }
      deptStars.forEach(s => {
        const pulse = 1 + Math.sin(tt * 1.4 + s.phase) * 0.25;
        s.mesh.scale.setScalar(0.1 * pulse);
      });
      core.scale.setScalar(1.1 + Math.sin(tt * 0.6) * 0.08);
    }

    rig.rotation.y = rotY;
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
