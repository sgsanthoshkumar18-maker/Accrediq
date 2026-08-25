/* AQcredix — Standards Galaxy
   Every one of the 639 real NABH elements as a point in 3D space, clustered
   into 10 chapter "constellations", colored by category. Click a star to open
   the exact same explain modal used on the flat Standards Explorer. */

(function () {
  /* Scene colours come from theme/scene-palette.js when it is present; every
     lookup below falls back to the value this scene shipped with. */
  var P = window.AQScenePalette || { name: function () { return "default"; },
    chapters: function (f) { return f; }, categories: function (f) { return f; },
    cycle: function (f) { return f; }, accent: function (f) { return f; },
    dim: function (f) { return f; }, ambient: function (f) { return f; },
    key: function (f) { return f; }, link: function (f) { return f; },
    deep: function (f) { return f; }, onChange: function () {} };
  const section = document.getElementById("galaxySection");
  const toggleBtn = document.getElementById("galaxyToggleBtn");
  if (!section || !toggleBtn) return;

  let initialized = false;

  toggleBtn.addEventListener("click", () => {
    const isOpen = section.style.display !== "none";
    section.style.display = isOpen ? "none" : "block";
    toggleBtn.innerHTML = isOpen
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="10" ry="4.2"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(120 12 12)"/></svg> Explore in 3D — Standards Galaxy`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg> Close 3D Galaxy`;
    if (!isOpen) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      if (!initialized) { initGalaxy(); initialized = true; }
    }
  });

  function initGalaxy() {
    if (typeof THREE === "undefined" || !window.NABH_DATA) {
      document.getElementById("galaxyLoading").textContent = "3D engine unavailable — showing the flat explorer above instead.";
      return;
    }

    const CODES = Object.keys(window.NABH_DATA.official);
    const CHAPTERS = window.NABH_DATA.chapters;

    const wrapEl = document.querySelector(".galaxy-canvas-wrap");
    const canvas = document.getElementById("galaxyCanvas");
    const overlay = document.getElementById("galaxyOverlay");
    const loadingEl = document.getElementById("galaxyLoading");
    const tooltip = document.getElementById("galaxyTooltip");
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    let camDistance = 26;

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

    const CAT_COLOR = P.categories({ CORE: 0xc42e42, Commitment: 0xb0590a, Achievement: 0x0eA5A0, Excellence: 0x3554d1 });

    // 10 cluster anchor points arranged on a large sphere
    const clusterAnchors = {};
    CODES.forEach((code, i) => {
      const phi = Math.acos(1 - 2 * (i + 0.5) / CODES.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      const R = 9;
      clusterAnchors[code] = new THREE.Vector3(
        R * Math.sin(phi) * Math.cos(theta),
        R * Math.sin(phi) * Math.sin(theta),
        R * Math.cos(phi)
      );
    });

    // Build every element as a small glowing sphere near its cluster anchor
    const stars = []; // {mesh, code, std, letter}
    function glowTexture(hexColor) {
      const c = document.createElement("canvas"); c.width = c.height = 32;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, hexColor); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill();
      return new THREE.CanvasTexture(c);
    }
    const spriteMaterials = {};
    Object.keys(CAT_COLOR).forEach(cat => {
      const hex = "#" + CAT_COLOR[cat].toString(16).padStart(6, "0");
      spriteMaterials[cat] = new THREE.SpriteMaterial({ map: glowTexture(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    });

    CODES.forEach(code => {
      const anchor = clusterAnchors[code];
      const chapter = CHAPTERS[code];
      chapter.standards.forEach(std => {
        std.elements.forEach(el => {
          const spread = 2.1;
          const pos = anchor.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2,
            (Math.random() - 0.5) * spread * 2
          ));
          const sprite = new THREE.Sprite(spriteMaterials[el.category]);
          sprite.scale.setScalar(0.34);
          sprite.position.copy(pos);
          rig.add(sprite);
          stars.push({ mesh: sprite, code, std, letter: el.letter, category: el.category, text: el.text });
        });
      });

      // faint chapter label sprite at cluster center (rendered as HTML overlay, projected each frame)
    });

    // ---------- Interaction: orbit drag + momentum + zoom, hover/click to inspect ----------
    let rotX = 0.25, rotY = 0.4, velX = 0, velY = 0, dragging = false, lastX = 0, lastY = 0;
    const MIN_D = 12, MAX_D = 40;

    canvas.addEventListener("mousedown", e => { dragging = true; lastX = e.clientX; lastY = e.clientY; velX = 0; velY = 0; });
    window.addEventListener("mousemove", e => {
      if (!dragging) { handleHover(e.clientX, e.clientY); return; }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      rotY += dx * 0.005; rotX += dy * 0.005;
      velY = dx * 0.005; velX = dy * 0.005;
      lastX = e.clientX; lastY = e.clientY;
      tooltip.classList.remove("show");
    });
    window.addEventListener("mouseup", () => { dragging = false; });
    canvas.addEventListener("click", e => {
      if (Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01) return; // avoid click-after-drag
      const hit = pickStar(e.clientX, e.clientY);
      if (hit && window.openStandardModal) window.openStandardModal(hit.std.code, hit.letter);
    });
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      camDistance = Math.max(MIN_D, Math.min(MAX_D, camDistance + e.deltaY * 0.02));
    }, { passive: false });

    canvas.addEventListener("touchstart", e => { const t = e.touches[0]; dragging = true; lastX = t.clientX; lastY = t.clientY; }, { passive: true });
    canvas.addEventListener("touchmove", e => {
      const t = e.touches[0];
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      rotY += dx * 0.005; rotX += dy * 0.005;
      lastX = t.clientX; lastY = t.clientY;
    }, { passive: true });
    canvas.addEventListener("touchend", () => { dragging = false; });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Sprite = { threshold: 0.3 };
    const ndc = new THREE.Vector2();

    function pickStar(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(stars.map(s => s.mesh));
      return hits.length ? stars.find(s => s.mesh === hits[0].object) : null;
    }

    function handleHover(clientX, clientY) {
      const hit = pickStar(clientX, clientY);
      if (!hit) { tooltip.classList.remove("show"); return; }
      const rect = wrapEl.getBoundingClientRect();
      tooltip.style.left = (clientX - rect.left + 14) + "px";
      tooltip.style.top = (clientY - rect.top - 6) + "px";
      tooltip.innerHTML = `<b>${hit.std.code}.${hit.letter} · ${hit.category}</b>${hit.text.slice(0, 90)}${hit.text.length > 90 ? "…" : ""}`;
      tooltip.classList.add("show");
    }

    // ---------- Chapter labels (HTML overlay) ----------
    function renderChapterLabels() {
      overlay.querySelectorAll(".galaxy-chip-label").forEach(n => n.remove());
      const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
      CODES.forEach(code => {
        const world = clusterAnchors[code].clone().applyMatrix4(rig.matrixWorld);
        const p = world.clone().project(camera);
        if (p.z > 1) return;
        const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
        const el = document.createElement("div");
        el.className = "galaxy-chip-label";
        el.style.left = sx + "px"; el.style.top = sy + "px";
        el.textContent = code;
        overlay.appendChild(el);
      });
    }

    function animate() {
      requestAnimationFrame(animate);
      if (!dragging && !reduceMotion) {
        rotY += velY * 0.4; rotX += velX * 0.4;
        velY *= 0.94; velX *= 0.94;
        rotY += 0.0009;
      }
      rig.rotation.set(rotX, rotY, 0);
      camera.position.set(0, 0, camDistance);
      camera.lookAt(0, 0, 0);
      rig.updateMatrixWorld();
      renderer.render(scene, camera);
      renderChapterLabels();
    }

    requestAnimationFrame(() => {
      sizeRenderer();
      animate();
      setTimeout(() => loadingEl && loadingEl.classList.add("hidden"), 400);
    });
  }
})();
