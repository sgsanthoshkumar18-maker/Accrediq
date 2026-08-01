/* AQcredix — Quality Dashboard Globe
   A dotted-continent 3D globe (vanilla Three.js) where every glowing hub is a
   real department. Click a hub and the right-side intelligence panel shows
   real, derived data: the department's existing score, its real KRA/KPI
   counts, the actual asterisked (SOP-required) NABH element codes linked to
   its primary chapter, and which of the 12 real committees it's a mandatory
   member of. No fabricated "growth %" or fake financial data — everything
   shown is either already on this page or pulled straight from nabh-data.js
   / committee-data.js. */

(function () {
  const stage = document.getElementById("qgStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".qg-globe-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="qg-fallback">AQcredix<br>Accreditation &amp; Quality Excellence</div>`;
    return;
  }
  if (!window.DASH_DEPTS || !window.NABH_DATA) return;

  const DEPTS = window.DASH_DEPTS;
  const NABH = window.NABH_DATA.chapters;
  const OFFICIAL = window.NABH_DATA.official;
  const COMMITTEES = window.COMMITTEE_DATA || [];
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Alias map: dashboard department name -> the exact wording used in committee-data.js mandatoryMembers
  // Dashboard ids occasionally differ from department-data.js ids — alias the ones that do.
  const DEPT_ID_ALIAS = { hic: "housekeeping", mom: "pharmacy" }; // "obg" has no direct match; falls back to the plain page

  const COMMITTEE_ALIAS = {
    "Infection Control": "Infection Control", "Pharmacy": "Pharmacy", "Nursing": "Nursing",
    "Emergency": "Emergency Department", "ICU": "ICU", "Operation Theatre": "Operation Theatre",
    "Laboratory": "Laboratory", "Blood Bank": "Blood Bank", "Housekeeping": "Housekeeping",
    "Human Resources": "Human Resources", "Biomedical": "Biomedical Engineering", "CSSD": "CSSD",
    "Medical Records": "Medical Records Department", "Dietary": "Dietetics",
    "Maintenance": "Maintenance/Engineering", "Administration": "Hospital Administration",
    "Quality Department": "Quality Department"
  };

  function deptCommittees(dept) {
    const alias = COMMITTEE_ALIAS[dept.name];
    if (!alias) return [];
    return COMMITTEES.filter(c => c.mandatoryMembers.includes(alias));
  }
  function deptSopElements(dept) {
    const chapter = NABH[dept.short];
    if (!chapter) return [];
    const out = [];
    chapter.standards.forEach(std => std.elements.forEach(el => {
      if (el.sop) out.push({ code: `${std.code}.${el.letter}`, text: el.text });
    }));
    return out;
  }

  const canvas = document.getElementById("qgCanvas");
  const overlay = document.getElementById("qgOverlay");
  const loadingEl = document.getElementById("qgLoading");
  const panel = document.getElementById("qgPanel");
  const panelEmpty = document.getElementById("qgPanelEmpty");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  let camDistance = 2.6;
  camera.position.set(0, 0, camDistance);
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

  // ---------- Globe sphere + atmosphere glow ----------
  const RADIUS = 1;
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x060814, transparent: true, opacity: 0.94 })
  );
  rig.add(sphere);

  const atmoMat = new THREE.ShaderMaterial({
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    vertexShader: `varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vNormal; void main(){
      float intensity = pow(0.6 - dot(vNormal, vec3(0.0,0.0,1.0)), 2.2);
      vec3 glow = mix(vec3(0.31,0.27,0.90), vec3(0.055,0.65,0.63), 0.5) * intensity;
      gl_FragColor = vec4(glow, intensity * 0.85);
    }`
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.12, 64, 64), atmoMat));

  // ---------- Starfield — thousands of randomly distributed points, BufferGeometry ----------
  (function buildStarfield() {
    const STAR_COUNT = 2600;
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    for (let i = 0; i < STAR_COUNT; i++) {
      // random point on a large shell around the scene (not inside the globe)
      const r = 6 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = Math.random() * 0.018 + 0.004;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));
    const starTexCanvas = document.createElement("canvas");
    starTexCanvas.width = starTexCanvas.height = 16;
    const sctx = starTexCanvas.getContext("2d");
    const sg = sctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    sg.addColorStop(0, "rgba(255,255,255,1)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = sg; sctx.beginPath(); sctx.arc(8, 8, 8, 0, Math.PI * 2); sctx.fill();
    const starTex = new THREE.CanvasTexture(starTexCanvas);
    const starMat = new THREE.PointsMaterial({
      size: 0.05, map: starTex, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true, vertexColors: false
    });
    scene.add(new THREE.Points(geo, starMat));
  })();

  function latLon(lat, lon, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }

  // ---------- Dotted continent outlines ("outlines = real borders", stylized) ----------
  // ---------- Real country borders, rendered from Natural Earth GeoJSON ----------
  // window.WORLD_BORDERS is an array of rings; each ring is a flat [lon,lat,lon,lat,...] array.
  // Simplified offline (Douglas-Peucker) from Natural Earth Admin-0 data: 403 outlines, ~6.6k points.
  (function buildBorders() {
    const RINGS = window.WORLD_BORDERS;
    if (!RINGS || !RINGS.length) return; // graceful no-op if the border data failed to load

    function glowTex(hex) {
      const c = document.createElement("canvas"); c.width = c.height = 16;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      g.addColorStop(0, hex); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(8, 8, 8, 0, Math.PI * 2); ctx.fill();
      return new THREE.CanvasTexture(c);
    }

    const linePositions = [];
    const dotPositions = [];

    RINGS.forEach(ring => {
      const n = ring.length / 2;
      let prev = null;
      for (let i = 0; i < n; i++) {
        const lon = ring[i * 2], lat = ring[i * 2 + 1];
        const v = latLon(lat, lon, RADIUS * 1.006);
        if (prev) {
          // Skip the seam segment when a ring wraps the antimeridian, so no line
          // shoots straight across the globe.
          const prevLon = ring[(i - 1) * 2];
          if (Math.abs(lon - prevLon) < 180) {
            linePositions.push(prev.x, prev.y, prev.z, v.x, v.y, v.z);
          }
        }
        if (i % 4 === 0) dotPositions.push(v.x, v.y, v.z);
        prev = v;
      }
    });

    // Continuous glowing border outline
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    rig.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
      color: 0x5eead4, transparent: true, opacity: 0.55
    })));

    // Soft glow dots along the borders for a luminous, premium feel
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(dotPositions, 3));
    rig.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({
      size: 0.014, map: glowTex("rgba(224,255,250,1)"), transparent: true, opacity: 0.6,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    })));
  })();

  // ---------- Graticule (lat/lon grid) — subtle technical texture like the reference ----------
  (function buildGraticule() {
    const pts = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 4) {
        pts.push(latLon(lat, lon, RADIUS * 1.001), latLon(lat, lon + 4, RADIUS * 1.001));
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -90; lat < 90; lat += 4) {
        pts.push(latLon(lat, lon, RADIUS * 1.001), latLon(lat + 4, lon, RADIUS * 1.001));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x1f2a5c, transparent: true, opacity: 0.35 });
    rig.add(new THREE.LineSegments(geo, mat));
  })();

  // ---------- Orbital arc with a traveling dot (decorative, matches the reference's data-flow feel) ----------
  function dotTexture(hex) {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, hex); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }
  // Maps a 2D point on an EllipseCurve onto a tilted 3D orbital plane.
  // Applying pitch (X axis) then tilt (Y axis) lets rings sit in genuinely
  // different orientations instead of all sharing one plane.
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  function arcPoint(p, tilt, pitch) {
    return new THREE.Vector3(p.x, p.y * 0.3, p.y)
      .applyAxisAngle(AXIS_X, pitch)
      .applyAxisAngle(AXIS_Y, tilt);
  }

  // Six orbital rings. `tilt` spins the ring around Y, `pitch` tips it around X —
  // using both axes is what spreads them across genuinely different planes rather
  // than stacking them all in roughly the same orientation.
  const orbitalArcs = [
    { rx: 1.70, ry: 1.35, tilt: 0.60, pitch: 0.15, speed: 0.050, color: 0x5eead4 },
    { rx: 1.55, ry: 1.50, tilt: -0.90, pitch: 0.85, speed: 0.037, color: 0x818cf8 },
    { rx: 1.85, ry: 1.15, tilt: 1.50, pitch: -0.55, speed: 0.063, color: 0xe0f2fe },
    { rx: 1.62, ry: 1.62, tilt: 2.40, pitch: 1.25, speed: 0.044, color: 0x38bdf8 },
    { rx: 1.78, ry: 1.28, tilt: -2.10, pitch: -1.10, speed: 0.056, color: 0xa78bfa },
    { rx: 1.48, ry: 1.72, tilt: 0.15, pitch: 1.55, speed: 0.031, color: 0x7dd3fc }
  ].map(cfg => {
    const curve = new THREE.EllipseCurve(0, 0, RADIUS * cfg.rx, RADIUS * cfg.ry, 0, Math.PI * 2, false, 0);
    const pts3D = curve.getPoints(96).map(p => arcPoint(p, cfg.tilt, cfg.pitch));
    const geo = new THREE.BufferGeometry().setFromPoints(pts3D);
    const hexStr = "#" + cfg.color.toString(16).padStart(6, "0");
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.15 }));
    rig.add(line);
    const dotMat = new THREE.SpriteMaterial({ map: dotTexture(hexStr), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const dot = new THREE.Sprite(dotMat);
    dot.scale.setScalar(0.05);
    rig.add(dot);
    return { curve, tilt: cfg.tilt, pitch: cfg.pitch, speed: cfg.speed, dot };
  });

  // ---------- Department hub dots ----------
  const STATUS_COLOR = { ok: "#5eead4", watch: "#fbbf24" };
  const hubMatCache = {};
  function hubMat(hex) {
    if (!hubMatCache[hex]) hubMatCache[hex] = new THREE.SpriteMaterial({ map: dotTexture(hex), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return hubMatCache[hex];
  }

  const hubs = DEPTS.map((d, i) => {
    const offset = 2 / DEPTS.length;
    const y = ((i * offset) - 1) + (offset / 2);
    const r = Math.sqrt(1 - y * y);
    const theta = i * Math.PI * (3 - Math.sqrt(5));
    const x = Math.cos(theta) * r, z = Math.sin(theta) * r;
    const pos = new THREE.Vector3(x, y, z).multiplyScalar(RADIUS * 1.035);

    const color = STATUS_COLOR[d.status] || "#5eead4";
    const sprite = new THREE.Sprite(hubMat(color));
    sprite.scale.setScalar(0.1);
    sprite.position.copy(pos);
    rig.add(sprite);

    return { dept: d, mesh: sprite, basePos: pos, phase: Math.random() * Math.PI * 2 };
  });

  // ---------- Camera interaction: real OrbitControls when available, manual drag as fallback ----------
  const MIN_D = 1.6, MAX_D = 4.2;
  const IDLE_RESUME_MS = 2200; // how long the globe sits still before drifting again
  let lastInteractionAt = -Infinity;
  let controls = null;
  let rotX = 0.15, rotY = -0.3, velX = 0, velY = 0, manualDragging = false;

  if (typeof THREE.OrbitControls !== "undefined") {
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enableRotate = true;   // drag to rotate
    controls.enableZoom = false;    // we handle wheel zoom ourselves (normalized for trackpads, and prevents page scroll)
    controls.minDistance = MIN_D;
    controls.maxDistance = MAX_D;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.22;   // gentle, unobtrusive drift
    controls.rotateSpeed = 0.5;
  } else {
    // Manual fallback (no OrbitControls loaded) — same drag/zoom feel as before.
    let lastX = 0, lastY = 0;
    function onDown(x, y) { manualDragging = true; lastX = x; lastY = y; velX = 0; velY = 0; }
    function onMove(x, y) {
      if (!manualDragging) return;
      const dx = x - lastX, dy = y - lastY;
      rotY += dx * 0.005; rotX += dy * 0.005;
      rotX = Math.max(-1.3, Math.min(1.3, rotX));
      velX = dx * 0.005; velY = dy * 0.005;
      lastX = x; lastY = y;
    }
    function onUp() { manualDragging = false; }
    canvas.addEventListener("mousedown", e => onDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchstart", e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
    canvas.addEventListener("touchmove", e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
    canvas.addEventListener("touchend", onUp);
    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      camDistance = Math.max(MIN_D, Math.min(MAX_D, camDistance + e.deltaY * 0.0025));
    }, { passive: false });
  }

  // ---------- Trackpad / wheel zoom, scoped strictly to the globe ----------
  // Whether OrbitControls is driving or the manual fallback is, we intercept the
  // wheel on the globe wrapper so the page behind never scrolls while the cursor
  // is over it. Deltas are normalized because trackpads report pixel-mode deltas
  // while mice report line-mode, which otherwise makes trackpads feel dead.
  wrapEl.addEventListener("wheel", (e) => {
    e.preventDefault();   // keep the dashboard page still
    e.stopPropagation();

    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;        // DOM_DELTA_LINE  -> approx px
    else if (e.deltaMode === 2) delta *= 100;  // DOM_DELTA_PAGE  -> approx px
    // Generous clamp — lets a fast swipe move a lot while still bounding one frame.
    delta = Math.max(-140, Math.min(140, delta));

    // Proportional (multiplicative) zoom: the step scales with how close you already
    // are, which is what makes it feel like it tracks your finger at every distance
    // instead of crawling when zoomed in and lurching when zoomed out.
    const ZOOM_SENSITIVITY = 0.0022;
    const factor = Math.exp(delta * ZOOM_SENSITIVITY);

    if (controls) {
      const dir = camera.position.clone().sub(controls.target);
      const dist = THREE.MathUtils.clamp(dir.length() * factor, MIN_D, MAX_D);
      dir.setLength(dist);
      camera.position.copy(controls.target.clone().add(dir));
    } else {
      camDistance = Math.max(MIN_D, Math.min(MAX_D, camDistance * factor));
    }
  }, { passive: false });

  // ---------- Pinch-to-zoom (touch screens and trackpad two-finger pinch) ----------
  let pinchStartDist = null, pinchStartCamDist = null;
  function currentCamDistance() {
    return controls ? camera.position.distanceTo(controls.target) : camDistance;
  }
  function applyCamDistance(dist) {
    const clamped = THREE.MathUtils.clamp(dist, MIN_D, MAX_D);
    if (controls) {
      const dir = camera.position.clone().sub(controls.target).setLength(clamped);
      camera.position.copy(controls.target.clone().add(dir));
    } else {
      camDistance = clamped;
    }
  }
  wrapEl.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      pinchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartCamDist = currentCamDistance();
    }
  }, { passive: true });
  wrapEl.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && pinchStartDist) {
      e.preventDefault(); // don't let the page pan while pinching the globe
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (d > 0) applyCamDistance(pinchStartCamDist * (pinchStartDist / d));
    }
  }, { passive: false });
  wrapEl.addEventListener("touchend", () => { pinchStartDist = null; });

  // Reset the camera to its default framing.
  function resetView() {
    if (controls) {
      if (window.gsap) {
        gsap.to(camera.position, { x: 0, y: 0, z: 2.6, duration: 0.9, ease: "power2.inOut" });
      } else {
        camera.position.set(0, 0, 2.6);
      }
      controls.target.set(0, 0, 0);
    } else {
      rotX = 0.15; rotY = -0.3; camDistance = 2.6;
    }
  }

  // Step the camera in or out. Works with OrbitControls (moves along the view
  // vector) and with the manual fallback (adjusts camDistance directly).
  function stepZoom(delta) {
    if (controls) {
      const dir = camera.position.clone().sub(controls.target);
      const dist = THREE.MathUtils.clamp(dir.length() + delta, MIN_D, MAX_D);
      dir.setLength(dist);
      const dest = controls.target.clone().add(dir);
      if (window.gsap) {
        gsap.to(camera.position, { x: dest.x, y: dest.y, z: dest.z, duration: 0.4, ease: "power2.out" });
      } else {
        camera.position.copy(dest);
      }
    } else {
      camDistance = Math.max(MIN_D, Math.min(MAX_D, camDistance + delta));
    }
  }

  // Note: no double-click reset — it conflicted with double-click-and-drag rotation.
  // Use the ⟳ reset button instead.

  const zoomInBtn = document.getElementById("qgZoomIn");
  const zoomOutBtn = document.getElementById("qgZoomOut");
  const zoomResetBtn = document.getElementById("qgZoomReset");
  if (zoomInBtn) zoomInBtn.addEventListener("click", () => stepZoom(-0.45));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => stepZoom(0.45));
  if (zoomResetBtn) zoomResetBtn.addEventListener("click", resetView);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickHub(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(hubs.map(h => h.mesh));
    return hits.length ? hubs.find(h => h.mesh === hits[0].object) : null;
  }
  canvas.addEventListener("click", e => {
    if (!controls && (Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01)) return;
    const hit = pickHub(e.clientX, e.clientY);
    if (hit) selectDept(hit.dept);
  });

  // ---------- Hover tooltip: shows the department name for whichever node you point at ----------
  const hubTip = document.createElement("div");
  hubTip.className = "qg-hub-tip";
  hubTip.setAttribute("role", "tooltip");
  wrapEl.appendChild(hubTip);
  let hoveredIndex = -1;
  let selectedDeptId = null;

  function showHubTip(i) {
    hoveredIndex = i;
    hubTip.textContent = hubs[i].dept.name;
    hubTip.classList.add("show");
    hubs[i].mesh.scale.setScalar(0.15);
  }
  function hideHubTip() {
    if (hoveredIndex >= 0) {
      const hub = hubs[hoveredIndex];
      // don't shrink the currently-selected hub back down
      if (!selectedDeptId || hub.dept.id !== selectedDeptId) hub.mesh.scale.setScalar(0.1);
    }
    hoveredIndex = -1;
    hubTip.classList.remove("show");
  }

  // ---------- Accessible hit-targets ----------
  const hitEls = hubs.map((h, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qg-hub-hit";
    btn.setAttribute("aria-label", `${h.dept.name} department`);
    btn.addEventListener("click", () => selectDept(h.dept));
    btn.addEventListener("mouseenter", () => showHubTip(i));
    btn.addEventListener("mouseleave", hideHubTip);
    btn.addEventListener("focus", () => showHubTip(i));   // keyboard users get it too
    btn.addEventListener("blur", hideHubTip);
    overlay.appendChild(btn);
    return btn;
  });
  function updateHitPositions() {
    const w = wrapEl.clientWidth, h = wrapEl.clientHeight;
    hubs.forEach((hub, i) => {
      const world = hub.mesh.getWorldPosition(new THREE.Vector3());
      const p = world.clone().project(camera);
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const el = hitEls[i];
      el.style.left = sx + "px"; el.style.top = sy + "px";
      const behind = p.z > 1;
      el.style.opacity = behind ? "0" : "1";
      el.style.pointerEvents = behind ? "none" : "auto";

      // Keep the tooltip pinned to its node as the globe rotates.
      if (i === hoveredIndex) {
        if (behind) {
          hideHubTip();
        } else {
          hubTip.style.left = sx + "px";
          hubTip.style.top = (sy - 16) + "px";
        }
      }
    });
  }

  // ---------- Right-side intelligence panel ----------
  function statusWord(s) { return s === "ok" ? "On track" : s === "watch" ? "Needs attention" : s; }

  function selectDept(d) {
    selectedDeptId = d.id;
    hubs.forEach(h => h.mesh.scale.setScalar(h.dept.id === d.id ? 0.15 : 0.1));
    panelEmpty.style.display = "none";
    panel.style.display = "block";

    const committees = deptCommittees(d);
    const sops = deptSopElements(d);
    const o = OFFICIAL[d.short];
    const chapter = NABH[d.short];
    const coreEls = [], commitEls = [];
    if (chapter) chapter.standards.forEach(std => std.elements.forEach(el => {
      const entry = { code: `${std.code}.${el.letter}`, text: el.text };
      if (el.category === "CORE") coreEls.push(entry);
      else if (el.category === "Commitment") commitEls.push(entry);
    }));

    function esc(s) { return String(s).replace(/"/g, "&quot;"); }

    // Each metric is clickable — data-metric identifies which detail panel to reveal below.
    const metrics = [
      { key: "kra", color: "#5eead4", val: d.kra.length, lbl: "KEY RESULT AREAS" },
      { key: "kpi", color: "#818cf8", val: d.kpi.length, lbl: "KPIs TRACKED" },
      { key: "sop", color: "#fbbf24", val: sops.length, lbl: `SOPs REQUIRED (${d.short})` },
      { key: "committee", color: "#f472b6", val: committees.length, lbl: "COMMITTEES" },
      { key: "core", color: "#c42e42", val: o ? o.core : "—", lbl: `CORE ELEMENTS (${d.short})` },
      { key: "commit", color: "#b0590a", val: o ? o.commitment : "—", lbl: "COMMITMENT ELEMENTS" }
    ];

    const detailHtml = {
      kra: `<h3>Key Result Areas</h3><ul class="qg-detail-list">${d.kra.map((k, i) => `<li><b>KRA-${i + 1}</b> ${esc(k)}</li>`).join("")}</ul>`,
      kpi: `<h3>KPIs tracked</h3><table class="qg-detail-table"><thead><tr><th>KPI</th><th>Current</th><th>Target</th></tr></thead><tbody>${d.kpi.map(([name, val, target]) => `<tr><td>${esc(name)}</td><td class="mono">${esc(val)}</td><td class="mono">${esc(target)}</td></tr>`).join("")}</tbody></table>`,
      sop: `<h3>SOP-required elements — Chapter ${d.short}</h3><p class="qg-block-note">Every asterisked element in ${d.short} requires a written, documented SOP.</p><ul class="qg-detail-list">${sops.length ? sops.map(s => `<li><b>✱ ${s.code}</b> ${esc(s.text)}</li>`).join("") : `<li class="qg-sop-empty">No asterisked elements in this chapter.</li>`}</ul>`,
      committee: `<h3>Mandatory committee membership</h3><ul class="qg-detail-list">${committees.length ? committees.map(c => `<li><b>${esc(c.short)}</b> ${esc(c.name)} — chaired by ${esc(c.chairperson)}, meets ${esc(c.frequency.split(",")[0])}</li>`).join("") : `<li class="qg-sop-empty">Not a mandatory member of the 12 modeled committees.</li>`}</ul>`,
      core: `<h3>Core elements — Chapter ${d.short}</h3><p class="qg-block-note">Core elements are assessed at every survey, no exceptions.</p><ul class="qg-detail-list">${coreEls.length ? coreEls.map(e => `<li><b>${e.code}</b> ${esc(e.text)}</li>`).join("") : `<li class="qg-sop-empty">None in this chapter.</li>`}</ul>`,
      commit: `<h3>Commitment elements — Chapter ${d.short}</h3><p class="qg-block-note">Commitment elements are the baseline, assessed at final assessment.</p><ul class="qg-detail-list">${commitEls.length ? commitEls.map(e => `<li><b>${e.code}</b> ${esc(e.text)}</li>`).join("") : `<li class="qg-sop-empty">None in this chapter.</li>`}</ul>`
    };

    panel.innerHTML = `
      <div class="qg-panel-head">
        <span class="eyebrow">DEPARTMENT INTELLIGENCE</span>
        <button type="button" class="qg-panel-close" id="qgPanelClose" aria-label="Close">✕</button>
      </div>
      <h2>${d.name}</h2>
      <div class="qg-panel-sub">${d.persona} · Chapter ${d.short}</div>

      <div class="qg-score-row">
        <div class="qg-score-label">Department Score</div>
        <div class="qg-score-val" style="color:${STATUS_COLOR[d.status] || '#5eead4'};">${d.score}<span>/100</span></div>
      </div>
      <div class="qg-score-bar"><div class="qg-score-bar-fill" style="width:${d.score}%;background:${STATUS_COLOR[d.status] || '#5eead4'};"></div></div>
      <div class="qg-score-status">${statusWord(d.status)}</div>

      <p class="qg-block-note" style="margin-top:16px;">Tap any card below for the full, real detail behind that number.</p>
      <div class="qg-metric-grid">
        ${metrics.map(m => `
          <button type="button" class="qg-metric-card" data-metric="${m.key}">
            <div class="qg-metric-val" style="color:${m.color};">${m.val}<span class="dot" style="background:${m.color};"></span></div>
            <div class="qg-metric-lbl">${m.lbl}</div>
          </button>`).join("")}
      </div>

      <div class="qg-detail-panel" id="qgDetailPanel"></div>

      <a class="qg-panel-cta" href="departments.html${DEPT_ID_ALIAS[d.id] ? '?d=' + encodeURIComponent(DEPT_ID_ALIAS[d.id]) : ''}">Open full department profile →</a>
    `;

    const detailPanel = document.getElementById("qgDetailPanel");
    panel.querySelectorAll(".qg-metric-card").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.metric;
        const isOpen = btn.classList.contains("is-active");
        panel.querySelectorAll(".qg-metric-card").forEach(b => b.classList.remove("is-active"));
        if (isOpen) {
          detailPanel.classList.remove("show");
          detailPanel.innerHTML = "";
        } else {
          btn.classList.add("is-active");
          detailPanel.innerHTML = detailHtml[key];
          detailPanel.classList.add("show");
        }
      });
    });

    document.getElementById("qgPanelClose").addEventListener("click", () => {
      panel.style.display = "none";
      panelEmpty.style.display = "block";
      selectedDeptId = null;
      hubs.forEach(h => h.mesh.scale.setScalar(0.1));
    });
  }

  // ---------- Animate ----------
  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const tt = now / 1000;

    if (controls) {
      controls.autoRotate = !reduceMotion && (performance.now() - lastInteractionAt > IDLE_RESUME_MS);
      controls.update();
    } else {
      if (!manualDragging && !reduceMotion) {
        rotY += velX; rotX += velY;
        velX *= 0.94; velY *= 0.94;
        rotY += 0.0006;
      }
      rig.rotation.set(rotX, rotY, 0);
      camera.position.set(0, 0, camDistance);
      camera.lookAt(0, 0, 0);
      rig.updateMatrixWorld();
    }

    if (!reduceMotion) {
      orbitalArcs.forEach(arc => {
        const t = (tt * arc.speed) % 1;
        const p = arc.curve.getPointAt(t);
        arc.dot.position.copy(arcPoint(p, arc.tilt, arc.pitch));
      });
      hubs.forEach(h => {
        const pulse = 1 + Math.sin(tt * 1.4 + h.phase) * 0.12;
        if (h.mesh.scale.x < 0.13) h.mesh.scale.setScalar(0.1 * pulse);
      });
    }

    renderer.render(scene, camera);
    updateHitPositions();
  }

  // Auto-rotate pauses while you're interacting, then resumes once the globe has
  // been left alone. Tracked on the wrapper so drags, wheel zoom and pinch all count.
  if (controls) {
    const markInteraction = () => { lastInteractionAt = performance.now(); };
    ["pointerdown", "pointermove", "wheel", "touchstart", "touchmove"].forEach(evt => {
      wrapEl.addEventListener(evt, markInteraction, { passive: true });
    });
  }

  requestAnimationFrame(() => {
    sizeRenderer();

    // GSAP intro camera fly-in when available; otherwise the camera simply starts at its resting position.
    if (window.gsap) {
      camera.position.set(0, 0, 6.5);
      gsap.to(camera.position, { z: camDistance, duration: 1.6, ease: "power3.out" });
    }

    animate();
    setTimeout(() => loadingEl && loadingEl.classList.add("hidden"), 400);
  });
})();
