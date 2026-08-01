/* AQcredix — Standards Helix
   All 639 real NABH elements coiled into a double helix (DNA-like macro shape),
   colour-coded by category, each node drifting independently (particle feel),
   with faint neural-web links between same-category neighbours. Hover a node
   for a quick preview; click one to jump straight into the real Standards
   Explorer for that chapter. */

(function () {
  const stage = document.getElementById("helixStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".helix-canvas-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="helix-fallback">AQcredix<br>Accreditation &amp; Quality Excellence</div>`;
    return;
  }
  if (!window.NABH_DATA) return;

  const CHAPTERS = window.NABH_DATA.chapters;
  const CODES = Object.keys(window.NABH_DATA.official);
  const CAT_COLOR = { CORE: 0xc42e42, Commitment: 0xb0590a, Achievement: 0x0eA5A0, Excellence: 0x3554d1 };

  const canvas = document.getElementById("helixCanvas");
  const overlay = document.getElementById("helixOverlay");
  const loadingEl = document.getElementById("helixLoading");
  const tooltip = document.getElementById("helixTooltip");
  const statEl = document.getElementById("helixStat");
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  let camDistance = 14;
  let camPanY = 0;

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

  // ---------- Flatten all 639 elements in book order ----------
  const flatElements = [];
  CODES.forEach(code => {
    CHAPTERS[code].standards.forEach(std => {
      std.elements.forEach(el => {
        flatElements.push({ chapter: code, std: std.code, letter: el.letter, category: el.category, text: el.text });
      });
    });
  });

  // ---------- Build the double helix ----------
  const HEIGHT = 16, TURNS = 5, RADIUS = 2.6;
  const N = flatElements.length;

  function glowTexture(hex) {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, hex); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }
  const spriteMat = {};
  Object.keys(CAT_COLOR).forEach(cat => {
    const hex = "#" + CAT_COLOR[cat].toString(16).padStart(6, "0");
    spriteMat[cat] = new THREE.SpriteMaterial({ map: glowTexture(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  });

  const nodes = []; // {mesh, basePos, phase, data}
  flatElements.forEach((data, i) => {
    const t = i / N;
    const strand = i % 2; // alternate between the two strands
    const angle = t * Math.PI * 2 * TURNS + (strand === 0 ? 0 : Math.PI);
    const y = (t - 0.5) * HEIGHT;
    const x = Math.cos(angle) * RADIUS;
    const z = Math.sin(angle) * RADIUS;
    const basePos = new THREE.Vector3(x, y, z);

    const sprite = new THREE.Sprite(spriteMat[data.category] || spriteMat.Commitment);
    sprite.scale.setScalar(0.16);
    sprite.position.copy(basePos);
    rig.add(sprite);

    nodes.push({ mesh: sprite, basePos, phase: Math.random() * Math.PI * 2, data, strand });
  });

  // ---------- Neural web: backbone rungs (DNA base-pair lines) + sparse same-category cross-links ----------
  const linkPositions = [];
  for (let i = 0; i < N - 1; i += 2) {
    // rung connecting the two strands at roughly the same height
    if (nodes[i] && nodes[i + 1]) {
      linkPositions.push(nodes[i].basePos.x, nodes[i].basePos.y, nodes[i].basePos.z);
      linkPositions.push(nodes[i + 1].basePos.x, nodes[i + 1].basePos.y, nodes[i + 1].basePos.z);
    }
  }
  // sparse same-category cross-links for a "neural web" texture (short-range, kept light for performance)
  for (let i = 0; i < N; i += 9) {
    for (let j = i + 1; j < Math.min(i + 14, N); j++) {
      if (nodes[i].data.category === nodes[j].data.category) {
        linkPositions.push(nodes[i].basePos.x, nodes[i].basePos.y, nodes[i].basePos.z);
        linkPositions.push(nodes[j].basePos.x, nodes[j].basePos.y, nodes[j].basePos.z);
        break;
      }
    }
  }
  const linkGeo = new THREE.BufferGeometry();
  linkGeo.setAttribute("position", new THREE.Float32BufferAttribute(linkPositions, 3));
  const linkMat = new THREE.LineBasicMaterial({ color: 0x3d4a8a, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending });
  const linkLines = new THREE.LineSegments(linkGeo, linkMat);
  rig.add(linkLines);

  if (statEl) {
    const total = N, chapters = CODES.length;
    statEl.textContent = `${total} elements · ${chapters} chapters · live from the NABH 6th Edition`;
  }

  // ---------- Interaction: orbit drag (horizontal) + pan along helix (vertical) + zoom ----------
  let rotY = 0.3, velY = 0, dragging = false, lastX = 0, lastY = 0;
  const MIN_D = 8, MAX_D = 26;

  canvas.addEventListener("mousedown", e => { dragging = true; lastX = e.clientX; lastY = e.clientY; velY = 0; });
  window.addEventListener("mousemove", e => {
    if (!dragging) { handleHover(e.clientX, e.clientY); return; }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    rotY += dx * 0.006;
    camPanY = Math.max(-HEIGHT * 0.4, Math.min(HEIGHT * 0.4, camPanY + dy * 0.02));
    velY = dx * 0.006;
    lastX = e.clientX; lastY = e.clientY;
    tooltip.classList.remove("show");
  });
  window.addEventListener("mouseup", () => { dragging = false; });
  canvas.addEventListener("click", e => {
    if (Math.abs(velY) > 0.008) return; // ignore click-after-drag
    const hit = pickNode(e.clientX, e.clientY);
    if (hit) window.location.href = `standards.html?ch=${hit.data.chapter}`;
  });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    camDistance = Math.max(MIN_D, Math.min(MAX_D, camDistance + e.deltaY * 0.01));
  }, { passive: false });

  canvas.addEventListener("touchstart", e => { const t = e.touches[0]; dragging = true; lastX = t.clientX; lastY = t.clientY; }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    const t = e.touches[0];
    const dx = t.clientX - lastX, dy = t.clientY - lastY;
    rotY += dx * 0.006;
    camPanY = Math.max(-HEIGHT * 0.4, Math.min(HEIGHT * 0.4, camPanY + dy * 0.02));
    lastX = t.clientX; lastY = t.clientY;
  }, { passive: true });
  canvas.addEventListener("touchend", () => { dragging = false; });

  const raycaster = new THREE.Raycaster();
  raycaster.params.Sprite = { threshold: 0.22 };
  const ndc = new THREE.Vector2();

  function pickNode(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(nodes.map(n => n.mesh));
    return hits.length ? nodes.find(n => n.mesh === hits[0].object) : null;
  }

  function handleHover(clientX, clientY) {
    const hit = pickNode(clientX, clientY);
    if (!hit) { tooltip.classList.remove("show"); canvas.style.cursor = "grab"; return; }
    canvas.style.cursor = "pointer";
    const rect = wrapEl.getBoundingClientRect();
    tooltip.style.left = (clientX - rect.left + 14) + "px";
    tooltip.style.top = (clientY - rect.top - 6) + "px";
    tooltip.innerHTML = `<b>${hit.data.std}.${hit.data.letter} · ${hit.data.category}</b>${hit.data.text.slice(0, 80)}${hit.data.text.length > 80 ? "…" : ""}`;
    tooltip.classList.add("show");
  }

  // ---------- Animate: rigid helix + organic per-node drift ----------
  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const t = (performance.now() - t0) / 1000;

    if (!reduceMotion) {
      nodes.forEach(n => {
        const drift = 0.045;
        n.mesh.position.set(
          n.basePos.x + Math.sin(t * 0.6 + n.phase) * drift,
          n.basePos.y + Math.cos(t * 0.5 + n.phase * 1.3) * drift,
          n.basePos.z + Math.sin(t * 0.7 + n.phase * 0.8) * drift
        );
      });
      if (!dragging) rotY += 0.0016 + velY * 0.02;
      velY *= 0.9;
    }

    rig.rotation.y = rotY;
    camera.position.set(0, camPanY, camDistance);
    camera.lookAt(0, camPanY, 0);
    rig.updateMatrixWorld();
    renderer.render(scene, camera);
  }

  requestAnimationFrame(() => {
    sizeRenderer();
    animate();
    setTimeout(() => loadingEl && loadingEl.classList.add("hidden"), 400);
  });
})();
