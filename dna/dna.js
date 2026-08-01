/* AQcredix — Standards DNA
   A clean, premium glass double-helix — ten base pairs, one per real NABH
   chapter, colour-matched to the chapter accent. Deliberately minimal (not
   all 639 elements) per the "minimalist, premium, no clutter" brief.
   Clicking a pair opens that chapter directly in the flat explorer above. */

(function () {
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
    AAC: 0x5eead4, COP: 0x818cf8, MOM: 0xf472b6, PRE: 0x60a5fa, IPC: 0xf87171,
    PSQ: 0xfbbf24, ROM: 0xa78bfa, FMS: 0x34d399, HRM: 0xfb923c, IMS: 0x38bdf8
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

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
  const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5eead4, 0.5); rim.position.set(-3, -2, -4); scene.add(rim);

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

  // ten base pairs — one per real chapter, evenly spaced along the strand
  const pairs = [];
  CODES.forEach((code, i) => {
    const t = (i + 0.5) / CODES.length;
    const p1 = railPoint(t, 0), p2 = railPoint(t, Math.PI);
    const color = CHAPTER_ACCENT[code] || 0x5eead4;

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
      pairs.push({ mesh: node, code });
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
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  canvas.addEventListener("click", e => {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pairs.map(p => p.mesh));
    if (hits.length) {
      const hit = pairs.find(p => p.mesh === hits[0].object);
      if (hit && typeof window.openChapterFromDNA === "function") window.openChapterFromDNA(hit.code);
    }
  });
  canvas.style.cursor = "pointer";

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
