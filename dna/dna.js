/* AQcredix — Standards DNA
   A clean, premium glass double-helix — ten base pairs, one per real NABH
   chapter, colour-matched to the chapter accent. Deliberately minimal (not
   all 639 elements) per the "minimalist, premium, no clutter" brief.
   Clicking a pair opens that chapter directly in the flat explorer above. */

(function () {
  /* Scene colours come from theme/scene-palette.js when it is present; every
     lookup below falls back to the value this scene shipped with. */
  var P = window.AQScenePalette || { name: function () { return "default"; },
    chapters: function (f) { return f; }, categories: function (f) { return f; },
    cycle: function (f) { return f; }, accent: function (f) { return f; },
    dim: function (f) { return f; }, ambient: function (f) { return f; },
    key: function (f) { return f; }, link: function (f) { return f; },
    deep: function (f) { return f; }, onChange: function () {} };
  const stage = document.getElementById("dnaStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".dna-wrap");

  if (typeof THREE === "undefined") {
    stage.style.display = "none";
    return;
  }
  if (!window.NABH_DATA) return;

  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("dnaCanvas");

  const CODES = Object.keys(window.NABH_DATA.official);
  const CHAPTER_ACCENT = {
    AAC: 0x4c6fff, COP: 0x818cf8, MOM: 0xf472b6, PRE: 0x60a5fa, IPC: 0xf87171,
    PSQ: 0xfbbf24, ROM: 0xa78bfa, FMS: 0x34d399, HRM: 0xfb923c, IMS: 0x7d9bff
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 11);
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
  const key = new THREE.DirectionalLight(P.key(0xffffff), 1.0); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(P.accent(0x4c6fff), 0.5); rim.position.set(-3, -2, -4); scene.add(rim);

  const rig = new THREE.Group();
  scene.add(rig);

  const HEIGHT = 8, TURNS = 2.2, RADIUS = 1.3;
  const railMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e1440, transmission: 0.6, roughness: 0.2, thickness: 0.4,
    ior: 1.3, clearcoat: 0.6, transparent: true, opacity: 0.9
  });

  function railPoint(t, strandOffset) {
    const angle = t * Math.PI * 2 * TURNS + strandOffset;
    const y = (t - 0.5) * HEIGHT;
    return new THREE.Vector3(Math.cos(angle) * RADIUS, y, Math.sin(angle) * RADIUS);
  }

  // two glass rails (tubes along the helix curve)
  [0, Math.PI].forEach(offset => {
    const pts = [];
    for (let i = 0; i <= 100; i++) pts.push(railPoint(i / 100, offset));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 120, 0.045, 8, false);
    rig.add(new THREE.Mesh(geo, railMat));
  });

  const CHAPTER_NAMES = {
    AAC: "Access, Assessment & Continuity", COP: "Care of Patients", MOM: "Management of Medication",
    PRE: "Patient Rights & Education", IPC: "Infection Prevention & Control", PSQ: "Patient Safety & Quality",
    ROM: "Responsibility of Management", FMS: "Facility Management & Safety",
    HRM: "Human Resource Management", IMS: "Information Management System"
  };
  const OFFICIAL = window.NABH_DATA.official;

  // ten base pairs — one per real chapter, evenly spaced along the strand
  const pairs = [];
  CODES.forEach((code, i) => {
    const t = (i + 0.5) / CODES.length;
    const p1 = railPoint(t, 0), p2 = railPoint(t, Math.PI);
    const color = CHAPTER_ACCENT[code] || 0x4c6fff;
    const o = OFFICIAL[code];
    const stat = { code, name: CHAPTER_NAMES[code] || code, standards: o.standards, elements: o.elements, core: o.core, commitment: o.commitment, achievement: o.achievement, excellence: o.excellence };

    const rungGeo = new THREE.CylinderGeometry(0.02, 0.02, p1.distanceTo(p2), 6);
    const rungMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 });
    const rung = new THREE.Mesh(rungGeo, rungMat);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    rung.position.copy(mid);
    rung.lookAt(p2);
    rung.rotateX(Math.PI / 2);
    rig.add(rung);

    [p1, p2].forEach(p => {
      const nodeGeo = new THREE.SphereGeometry(0.09, 16, 16);
      const nodeMat = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.1 });
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.copy(p);
      node.userData = { code };
      rig.add(node);
      pairs.push({ mesh: node, code, stat, baseScale: 1 });
    });
  });

  // ---------- Cursor tilt (max 8°) + slow auto rotation + gentle float ----------
  let baseRotY = 0, tiltX = 0, tiltY = 0, targetTiltX = 0, targetTiltY = 0, floatY = 0;
  const MAX_TILT = THREE.MathUtils.degToRad(8);
  const ROT_SPEED = (Math.PI * 2) / 100;

  wrapEl.addEventListener("mousemove", e => {
    const rect = wrapEl.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    targetTiltY = THREE.MathUtils.clamp(nx, -1, 1) * MAX_TILT;
    targetTiltX = THREE.MathUtils.clamp(ny, -1, 1) * MAX_TILT;
  });
  wrapEl.addEventListener("mouseleave", () => { targetTiltX = 0; targetTiltY = 0; });

  // click a base-pair node -> open that chapter in the explorer above
  // hover a base-pair node -> show real chapter stats (standards, elements, category breakdown)
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tooltip = document.getElementById("dnaTooltip");

  function pickPair(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pairs.map(p => p.mesh));
    return hits.length ? pairs.find(p => p.mesh === hits[0].object) : null;
  }

  canvas.addEventListener("click", e => {
    const hit = pickPair(e.clientX, e.clientY);
    if (hit && typeof window.openChapterFromDNA === "function") window.openChapterFromDNA(hit.code);
  });

  canvas.addEventListener("mousemove", e => {
    const hit = pickPair(e.clientX, e.clientY);
    if (!hit || !tooltip) { if (tooltip) tooltip.classList.remove("show"); canvas.style.cursor = "grab"; return; }
    canvas.style.cursor = "pointer";
    const s = hit.stat;
    const rect = wrapEl.getBoundingClientRect();
    tooltip.innerHTML = `
      <b>${s.name}</b>
      <span class="dna-tt-sub">${s.standards} standards · ${s.elements} elements</span>
      <span class="dna-tt-row"><i style="background:#c42e42;"></i>Core <b>${s.core}</b></span>
      <span class="dna-tt-row"><i style="background:#b0590a;"></i>Commitment <b>${s.commitment}</b></span>
      <span class="dna-tt-row"><i style="background:#4C6FFF;"></i>Achievement <b>${s.achievement}</b></span>
      <span class="dna-tt-row"><i style="background:#3554d1;"></i>Excellence <b>${s.excellence}</b></span>
    `;
    tooltip.style.left = (e.clientX - rect.left + 16) + "px";
    tooltip.style.top = (e.clientY - rect.top - 10) + "px";
    tooltip.classList.add("show");
  });
  canvas.addEventListener("mouseleave", () => { if (tooltip) tooltip.classList.remove("show"); });
  canvas.style.cursor = "grab";

  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;

    if (!reduceMotion) {
      baseRotY += ROT_SPEED * dt;
      floatY = Math.sin(now / 1400) * 0.12;
    }
    tiltX += (targetTiltX - tiltX) * 0.06;
    tiltY += (targetTiltY - tiltY) * 0.06;

    rig.rotation.set(tiltX, baseRotY + tiltY, 0);
    rig.position.y = floatY;

    renderer.render(scene, camera);
  }

  requestAnimationFrame(() => { sizeRenderer(); animate(); });
})();
