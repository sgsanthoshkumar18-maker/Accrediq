/* AQcredix — Enterprise Globe
   Vanilla Three.js (this project has no build step / React, so this uses
   the same rendering engine React Three Fiber sits on top of, without
   introducing a bundler). Ten glowing nodes = the ten real NABH chapters,
   connected by slow orbital data-flow arcs. Node counts are real, derived
   from window.NABH_DATA — "Possible NCs" = Core + Commitment elements per
   chapter, since those are the categories that generate a Non-Conformity
   if unmet (Achievement/Excellence are assessed at later survey stages). */

(function () {
  const stage = document.getElementById("globeStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".ent-globe-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="ent-globe-fallback">AQcredix<br>Accreditation &amp; Quality Implementation Guidance</div>`;
    return;
  }

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("globeCanvas");
  const overlay = document.getElementById("globeNodeOverlay");
  const loadingEl = document.getElementById("globeLoading");
  const tooltip = document.getElementById("globeTooltip");

  // ---------- Chapter data (real) ----------
  const CHAPTER_NAMES = {
    AAC: "Access, Assessment & Continuity", COP: "Care of Patients", MOM: "Management of Medication",
    PRE: "Patient Rights & Education", IPC: "Infection Prevention & Control", PSQ: "Patient Safety & Quality",
    ROM: "Responsibility of Management", FMS: "Facility Management & Safety",
    HRM: "Human Resource Management", IMS: "Information Management System"
  };
  let chapterStats = null;
  if (window.NABH_DATA) {
    chapterStats = {};
    Object.keys(window.NABH_DATA.official).forEach(code => {
      const o = window.NABH_DATA.official[code];
      const ncCodes = [];
      const chapter = window.NABH_DATA.chapters[code];
      if (chapter) {
        chapter.standards.forEach(std => {
          std.elements.forEach(el => {
            if (el.category === "CORE" || el.category === "Commitment") ncCodes.push(`${std.code}.${el.letter}`);
          });
        });
      }
      chapterStats[code] = { name: CHAPTER_NAMES[code] || code, possibleNC: o.core + o.commitment, ncCodes };
    });
  }
  const CODES = chapterStats ? Object.keys(chapterStats) : Object.keys(CHAPTER_NAMES);

  // ---------- Renderer / scene / camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace || renderer.outputColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 5.4);

  function sizeRenderer() {
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  sizeRenderer();
  window.addEventListener("resize", sizeRenderer);

  // ---------- Lighting: ambient + directional key + rim/hemisphere ----------
  scene.add(new THREE.AmbientLight(0x9db4ff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(4, 3, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x5eead4, 0.6);
  rimLight.position.set(-4, -2, -3);
  scene.add(rimLight);
  scene.add(new THREE.HemisphereLight(0x4f46e5, 0x060814, 0.4));

  const rig = new THREE.Group();
  scene.add(rig);

  // ---------- Glass sphere (real PBR via MeshPhysicalMaterial) ----------
  const RADIUS = 1.6;
  const sphereGeo = new THREE.SphereGeometry(RADIUS, 96, 96);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a1236,
    metalness: 0.15,
    roughness: 0.28,
    transmission: 0.55,
    thickness: 0.9,
    ior: 1.3,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
    transparent: true,
    opacity: 0.96
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  rig.add(sphere);

  // Fresnel rim-glow "atmosphere" shell
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vNormal; void main(){
      float intensity = pow(0.62 - dot(vNormal, vec3(0.0,0.0,1.0)), 2.4);
      vec3 glow = mix(vec3(0.31,0.27,0.90), vec3(0.37,0.92,0.85), 0.5) * intensity;
      gl_FragColor = vec4(glow, intensity * 0.85);
    }`
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.12, 64, 64), atmoMat);
  scene.add(atmosphere);

  // Thin glowing "boundary zone" lattice — stylized, not political borders (per spec)
  (function buildLattice() {
    const pts = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = 0; lon < 360; lon += 3) {
        const p1 = latLon(lat, lon, RADIUS * 1.004), p2 = latLon(lat, lon + 3, RADIUS * 1.004);
        pts.push(p1, p2);
      }
    }
    for (let lon = 0; lon < 360; lon += 36) {
      for (let lat = -90; lat < 90; lat += 3) {
        const p1 = latLon(lat, lon, RADIUS * 1.004), p2 = latLon(lat + 3, lon, RADIUS * 1.004);
        pts.push(p1, p2);
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xc7d2fe, transparent: true, opacity: 0.16 });
    rig.add(new THREE.LineSegments(geo, mat));
  })();

  function latLon(lat, lon, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }

  // ---------- 10 chapter nodes, evenly distributed (Fibonacci sphere) ----------
  function glowTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(224,242,254,1)");
    g.addColorStop(0.4, "rgba(94,234,212,0.9)");
    g.addColorStop(1, "rgba(94,234,212,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }
  const nodeGlowTex = glowTexture();
  const nodeMat = new THREE.SpriteMaterial({ map: nodeGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  const nodes = [];
  const NR = RADIUS * 1.03;
  for (let i = 0; i < CODES.length; i++) {
    const offset = 2 / CODES.length;
    const y = ((i * offset) - 1) + (offset / 2);
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5)); // golden angle — even distribution
    const x = Math.cos(phi) * r, z = Math.sin(phi) * r;
    const pos = new THREE.Vector3(x, y, z).multiplyScalar(NR);

    const sprite = new THREE.Sprite(nodeMat);
    sprite.scale.setScalar(0.16);
    sprite.position.copy(pos);
    rig.add(sprite);

    const code = CODES[i];
    const stat = chapterStats ? chapterStats[code] : { name: CHAPTER_NAMES[code] || code, possibleNC: null };
    nodes.push({ code, mesh: sprite, basePos: pos, stat, phase: Math.random() * Math.PI * 2 });
  }

  // ---------- Orbital data-flow arcs: HIGH parabolic, rendered as a dotted trail of glow-dots
  // (static Line geometry reads as near-invisible on most GPUs at this opacity — dots read clearly) ----------
  const arcs = [];
  const staticDotMat = new THREE.SpriteMaterial({ map: nodeGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 });

  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i], b = nodes[(i + 1) % nodes.length];
    const mid = a.basePos.clone().add(b.basePos).multiplyScalar(0.5);
    const elevated = mid.clone().normalize().multiplyScalar(NR * 1.68); // higher arc, clearly parabolic
    const curve = new THREE.QuadraticBezierCurve3(a.basePos, elevated, b.basePos);

    // static dotted trail along the arc
    const dotPositions = curve.getSpacedPoints(26);
    dotPositions.slice(1, -1).forEach(p => {
      const dot = new THREE.Sprite(staticDotMat);
      dot.scale.setScalar(0.028);
      dot.position.copy(p);
      rig.add(dot);
    });

    // brighter traveling particles riding the same path
    const travelers = [0, 1].map(k => {
      const dotMat = new THREE.SpriteMaterial({ map: nodeGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 });
      const dot = new THREE.Sprite(dotMat);
      dot.scale.setScalar(0.055);
      rig.add(dot);
      return { sprite: dot, phase: k * 0.5 + Math.random() * 0.3 };
    });
    arcs.push({ curve, travelers });
  }

  // ---------- Cursor tilt + auto rotation ----------
  let baseRotY = 0;
  let tiltX = 0, tiltY = 0, targetTiltX = 0, targetTiltY = 0;
  const MAX_TILT = THREE.MathUtils.degToRad(9);
  const ROT_SPEED = (Math.PI * 2) / 100; // ~100s per full rotation

  wrapEl.addEventListener("mousemove", e => {
    const rect = wrapEl.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    targetTiltY = THREE.MathUtils.clamp(nx, -1, 1) * MAX_TILT;
    targetTiltX = THREE.MathUtils.clamp(ny, -1, 1) * MAX_TILT;
  });
  wrapEl.addEventListener("mouseleave", () => { targetTiltX = 0; targetTiltY = 0; hideTooltip(); });

  // ---------- Accessible hit-targets (DOM overlay buttons, focusable, ARIA) ----------
  const hitEls = nodes.map(n => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "globe-node-hit";
    btn.setAttribute("aria-label", `${n.stat.name} chapter${n.stat.possibleNC != null ? `, ${n.stat.possibleNC} possible non-conformities` : ""}`);
    btn.addEventListener("mouseenter", () => showTooltip(n, btn));
    btn.addEventListener("focus", () => showTooltip(n, btn));
    btn.addEventListener("mouseleave", hideTooltip);
    btn.addEventListener("blur", hideTooltip);
    btn.addEventListener("click", () => { window.location.href = `standards.html?ch=${n.code}`; });
    overlay.appendChild(btn);
    return btn;
  });

  function showTooltip(n, el) {
    const rect = wrapEl.getBoundingClientRect();
    const btnRect = el.getBoundingClientRect();
    let ncLine = "";
    if (n.stat.ncCodes && n.stat.ncCodes.length) {
      const cap = 10;
      const shown = n.stat.ncCodes.slice(0, cap).join(", ");
      const extra = n.stat.ncCodes.length - cap;
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
    nodes.forEach((n, i) => {
      const world = n.mesh.getWorldPosition(new THREE.Vector3());
      const p = world.clone().project(camera);
      const behind = p.z > 1;
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const el = hitEls[i];
      el.style.left = sx + "px"; el.style.top = sy + "px";
      el.style.opacity = behind ? "0" : "1";
      el.style.pointerEvents = behind ? "none" : "auto";
    });
  }

  // ---------- Animate ----------
  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;

    if (!reduceMotion) {
      baseRotY += ROT_SPEED * dt;
    }
    tiltX += (targetTiltX - tiltX) * 0.06;
    tiltY += (targetTiltY - tiltY) * 0.06;

    rig.rotation.set(tiltX, baseRotY + tiltY, 0);
    atmosphere.rotation.copy(rig.rotation);
    rig.updateMatrixWorld();

    if (!reduceMotion) {
      const tt = now / 1000;
      arcs.forEach(arc => {
        arc.travelers.forEach(tr => {
          const t = (tt * 0.06 + tr.phase) % 1;
          const p = arc.curve.getPointAt(t).applyMatrix4(rig.matrixWorld);
          tr.sprite.position.copy(p);
        });
      });
      nodes.forEach(n => {
        const pulse = 1 + Math.sin(tt * 1.6 + n.phase) * 0.12;
        n.mesh.scale.setScalar(0.16 * pulse);
      });
    }

    renderer.render(scene, camera);
    updateHitPositions();
  }

  requestAnimationFrame(() => {
    sizeRenderer();
    animate();
    setTimeout(() => loadingEl && loadingEl.classList.add("hidden"), 400);
  });
})();
