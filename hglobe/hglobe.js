/* AQcredix — Homepage World Globe
   Visually identical to the Quality Dashboard globe (same sphere, borders,
   graticule, six orbital arcs and travelling dots). The only difference is
   what the nodes represent: here each glowing hub is a world capital, placed
   at its true latitude/longitude.

   DATA: capital names and coordinates are verified geographic facts. Health
   indicators come live from the WHO Global Health Observatory OData API via
   the /api/who proxy, with indicator names as published by WHO. Hospital
   names and locations come from OpenStreetMap. Where WHO has no value for a
   country the field shows "No data" rather than an estimate. */

(function () {
  const stage = document.getElementById("hgStage");
  if (!stage) return;
  const wrapEl = stage.querySelector(".hg-globe-wrap");

  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="hg-fallback">AQcredix<br>Accreditation &amp; Quality Implementation Guidance Platform</div>`;
    return;
  }
  if (!window.WORLD_CAPITALS) return;

  // Each capital gets a stable id so the existing selection logic works unchanged.
  const DEPTS = window.WORLD_CAPITALS.map((c, i) => ({ ...c, id: "cap" + i, name: c.city }));
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;


  const canvas = document.getElementById("hgCanvas");
  const overlay = document.getElementById("hgOverlay");
  const loadingEl = document.getElementById("hgLoading");
  const panel = document.getElementById("hgPanel");
  const panelEmpty = document.getElementById("hgPanelEmpty");

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

  /* OPENING VIEW — applied to the rig, not to the camera.
   *
   * Chosen by scoring every degree of rotation against the 74 capitals, counting how many
   * land near the CENTRE of the disc (dot > 0.6) rather than merely on the near
   * hemisphere — a capital on the limb is visible but not invitingly clickable.
   * -0.611 rad (-35 degrees) with a 0.262 pitch (15 degrees) puts 51 capitals centre
   * screen: London, Paris, Berlin, Rome, Madrid, Lisbon, New Delhi and the African and
   * Middle Eastern group. The old default opened on the Atlantic.
   *
   * The scoring must use three.js\'s XYZ Euler order (X applied before Y), which is what
   * rotation.set() uses. Scoring with the axes composed the other way suggested -74
   * degrees, which is a different view entirely — the order is not a detail.
   *
   * WHY HERE AND NOT ON rotX/rotY. Those two variables only drive the camera on the
   * MANUAL fallback path, taken when OrbitControls fails to load. OrbitControls does
   * load, so it owns the camera and the render loop never calls rig.rotation.set() —
   * setting them was correct-looking code that could not possibly have an effect.
   * Rotating the rig itself works on both paths, because the fallback composes its own
   * rotation on top of a rig that is already turned to face the right way. */
  const START_ROT_Y = -0.611, START_ROT_X = 0.262;
  rig.rotation.set(START_ROT_X, START_ROT_Y, 0);

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
    // Capitals sit at their true geographic position on the globe.
    const pos = latLon(d.lat, d.lon, RADIUS * 1.035);

    const color = STATUS_COLOR[d.status] || "#5eead4";
    const sprite = new THREE.Sprite(hubMat(color));
    sprite.scale.setScalar(0.1);
    sprite.position.copy(pos);
    rig.add(sprite);

    return { dept: d, mesh: sprite, basePos: pos, phase: Math.random() * Math.PI * 2 };
  });

  // ---------- Camera interaction: real OrbitControls when available, manual drag as fallback ----------
  const MIN_D = 1.6, MAX_D = 4.2;
  // Rotation pauses only while the cursor is actually over the globe, and
  // resumes the moment it leaves — no idle timer, so it starts spinning on load
  // and never sits still after the pointer has gone.
  let cursorOverGlobe = false;
  let dragging_ = false;
  let controls = null;
  /* Seeded from the same constants as the rig above, so the manual fallback path starts
     from the identical view rather than snapping elsewhere on the first frame. */
  let rotX = START_ROT_X, rotY = START_ROT_Y, velX = 0, velY = 0, manualDragging = false;

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
    controls.autoRotateSpeed = 0.95;   // decent pace: clearly moving, not distracting
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
      /* Same rule as the wrapper handler below: release the page at the limits. */
      if ((e.deltaY > 0 && camDistance >= MAX_D - 0.001) ||
          (e.deltaY < 0 && camDistance <= MIN_D + 0.001)) return;
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
    /* At the end of travel, let the page have the scroll. Without this the section is a
       trap: the globe is already as far out as it goes, the wheel does nothing visible,
       and the page underneath refuses to move. */
    const atDist = controls ? camera.position.distanceTo(controls.target) : camDistance;
    const EDGE = 0.001;
    if ((e.deltaY > 0 && atDist >= MAX_D - EDGE) ||
        (e.deltaY < 0 && atDist <= MIN_D + EDGE)) return;

    e.preventDefault();   // still ours while there is zoom left to give
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
      rotX = START_ROT_X; rotY = START_ROT_Y; camDistance = 2.6;
      // The rig carries the view under OrbitControls, so reset has to turn it back too.
      rig.rotation.set(START_ROT_X, START_ROT_Y, 0);
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

  const zoomInBtn = document.getElementById("hgZoomIn");
  const zoomOutBtn = document.getElementById("hgZoomOut");
  const zoomResetBtn = document.getElementById("hgZoomReset");
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
  hubTip.className = "hg-hub-tip";
  hubTip.setAttribute("role", "tooltip");
  wrapEl.appendChild(hubTip);
  let hoveredIndex = -1;
  let selectedDeptId = null;

  function showHubTip(i) {
    hoveredIndex = i;
    hubTip.textContent = hubs[i].dept.city + " · " + hubs[i].dept.country;
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
    btn.className = "hg-hub-hit";
    btn.setAttribute("aria-label", `${h.dept.city}, ${h.dept.country}`);
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

    const esc = s => String(s).replace(/[&<>"]/g, ch =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

    // Shell renders immediately; each live section fills in as its API responds.
    panel.innerHTML = `
      <div class="hg-panel-head">
        <span class="eyebrow">CAPITAL PROFILE</span>
        <button type="button" class="hg-panel-close" id="hgPanelClose" aria-label="Close">✕</button>
      </div>
      <h2>${esc(d.city)}</h2>
      <div class="hg-panel-sub">Capital of ${esc(d.country)}</div>

      <div class="hg-coord-row">
        <div><span class="hg-coord-lbl">Latitude</span><span class="hg-coord-val">${d.lat.toFixed(3)}°</span></div>
        <div><span class="hg-coord-lbl">Longitude</span><span class="hg-coord-val">${d.lon.toFixed(3)}°</span></div>
      </div>

      <div class="hg-block">
        <h3>WHO health indicators · ${esc(d.country)}</h3>
        <div id="hgIndicators"><p class="hg-note">Loading WHO data…</p></div>
      </div>

      <div class="hg-block">
        <h3>Life expectancy trend</h3>
        <div id="hgTrend"><p class="hg-note">Loading…</p></div>
      </div>

      <div class="hg-block">
        <h3>Hospitals near ${esc(d.city)}</h3>
        <div id="hgHospitals"><p class="hg-note">Searching OpenStreetMap…</p></div>
      </div>

      <p class="hg-source-note" id="hgSources"></p>
    `;

    document.getElementById("hgPanelClose").addEventListener("click", () => {
      panel.style.display = "none";
      panelEmpty.style.display = "block";
      selectedDeptId = null;
      hubs.forEach(h => h.mesh.scale.setScalar(0.1));
    });

    if (!window.HealthData || !d.iso3) return;
    const HD = window.HealthData;
    const token = d.id;                       // guards against a slower earlier request overwriting a newer selection
    const still = () => selectedDeptId === token;

    /* ---- WHO Global Health Observatory indicators ----
       DRAWN FIRST, FILLED AS THEY ARRIVE. The list used to be built in one go after every
       indicator had answered, so one slow request among eleven held the whole panel on
       "Loading WHO data…" — sometimes for a minute or more, because WHO's service is
       intermittently slow and a failure is never cached at the edge the way a success is.
       The rows now appear immediately with their labels, and each value lands in its own
       line as soon as it comes back. Most arrive in well under a second. */
    (function () {
      const host = document.getElementById("hgIndicators");
      const metas = HD.WHO_INDICATORS || [];
      host.innerHTML = '<ul class="hg-field-list">' + metas.map((m, n) =>
        `<li data-ind="${n}">
            <span class="hg-field-lbl">${esc(m.fallback)}</span>
            <span class="hg-field-val is-loading" aria-busy="true">Loading&#8230;</span>
          </li>`).join("") + "</ul>";

      HD.fetchIndicatorsProgressive(d.iso3, function (n, item) {
        if (!still()) return;
        const li = host.querySelector('[data-ind="' + n + '"]');
        if (!li) return;
        const val = HD.format(item);
        /* Three states, not two. "No data" is a claim ABOUT WHO — that they publish no
           figure for this country — and it must only be made when WHO actually answered
           and had nothing. When the request itself failed, say so instead, or an outage
           on their side gets reported to a hospital as a gap in WHO's data. */
        const empty = val ? "" : (item.unavailable ? "Unavailable" : "No data");
        /* A stored figure is shown as the number it is, with a mark saying it was not
           fetched just now. Four states in total: fresh, stored, genuinely-no-data, and
           service-down — collapsing any two of them tells the reader something untrue. */
        const when = item.storedAt ? new Date(item.storedAt).toLocaleDateString() : "";
        const title = item.unavailable
          ? ' title="WHO&#39;s data service did not respond. Close the panel and open it again — it usually works on the second try."'
          : (item.stale
              ? ' title="WHO&#39;s service is not responding, so this is the figure they last gave us' +
                (when ? ", saved on " + when : "") + '."'
              : "");
        li.innerHTML =
          `<span class="hg-field-lbl">${esc(item.label)}</span>
           <span class="hg-field-val ${val ? "" : "is-empty"}${item.stale ? " is-stored" : ""}"${title}>${
             val ? esc(val) : empty}${
             val && item.year ? ` <em class="hg-yr">${esc(item.year)}</em>` : ""}${
             item.stale ? ' <em class="hg-stored">stored</em>' : ""}</span>`;
      }).catch(() => { /* individual rows already report their own state */ });
    })();

    // ---- WHO life-expectancy trend ----
    HD.fetchSeries(d.iso3, "WHOSIS_000001", 2000, 2024).then(series => {
      if (!still()) return;
      const el = document.getElementById("hgTrend");
      if (!series.length) { el.innerHTML = `<p class="hg-note">No trend data available for this country.</p>`; return; }
      const vals = series.map(p => p.value);
      const min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
      const W = 260, H = 60;
      const pts = series.map((p, i) => {
        const x = (i / (series.length - 1 || 1)) * W;
        const y = H - ((p.value - min) / span) * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
      const first = series[0], last = series[series.length - 1];
      el.innerHTML = `
        <svg class="hg-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
             aria-label="Life expectancy at birth, ${first.year} to ${last.year}">
          <polyline points="${pts}" fill="none" stroke="#5eead4" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
        <div class="hg-spark-meta">
          <span>${first.year}: ${first.value.toFixed(1)}</span>
          <span>${last.year}: ${last.value.toFixed(1)}</span>
        </div>
        <p class="hg-note">Life expectancy at birth, years · WHO Global Health Observatory</p>`;
    }).catch(() => {
      if (still()) document.getElementById("hgTrend").innerHTML =
        `<p class="hg-note">Trend data unavailable.</p>`;
    });

    // ---- OpenStreetMap hospitals (names and locations only) ----
    HD.fetchHospitals(d.lat, d.lon).then(list => {
      if (!still()) return;
      const el = document.getElementById("hgHospitals");
      if (!list.length) { el.innerHTML = `<p class="hg-note">No hospitals tagged in OpenStreetMap near this point.</p>`; return; }
      /* THE NAME BECOMES A LINK ONLY WHERE OSM HOLDS A REAL ADDRESS FOR IT.
         About one hospital in seven is tagged with a website, so most stay plain text —
         which is correct. Nothing is guessed and no search-engine fallback is offered: a
         link that sends somebody to the wrong hospital is worse than no link.
         nofollow because this is a map listing, not a recommendation, and we should not
         be passing ranking signal to whoever happens to be tagged. noopener noreferrer
         because target=_blank without them hands the opened page a handle on ours. */
      el.innerHTML = `<ul class="hg-hosp-list">${list.map(h => `
        <li>
          <div class="hg-hosp-name">${h.website
            ? `<a href="${esc(h.website)}" target="_blank" rel="noopener noreferrer nofollow"
                  title="Opens ${esc(h.website)} in a new tab">${esc(h.name)}<span class="hg-ext" aria-hidden="true">&#8599;</span></a>`
            : esc(h.name)}</div>
          ${h.operator ? `<div class="hg-hosp-meta">${esc(h.operator)}</div>` : ""}
          <div class="hg-hosp-stats">
            ${h.type ? `<span>${esc(h.type)}</span>` : ""}
            ${h.beds ? `<span>${esc(h.beds)} beds</span>` : ""}
          </div>
        </li>`).join("")}</ul>
        <p class="hg-note">Listings from OpenStreetMap, not recommendations &mdash; AQcredix does
          not rate, endorse or accredit these hospitals. A name links out only where
          contributors recorded a website; OpenStreetMap has no ratings, and bed counts
          appear only where somebody tagged them.</p>`;
      const s = document.getElementById("hgSources");
      if (s) s.textContent = "Health indicators: WHO Global Health Observatory (ghoapi.azureedge.net). Indicator names are as published by WHO. Hospital locations: OpenStreetMap contributors (ODbL). Year shown per figure.";
    }).catch(() => {
      if (still()) document.getElementById("hgHospitals").innerHTML =
        `<p class="hg-note">OpenStreetMap lookup unavailable right now.</p>`;
    });
  }

  // ---------- Animate ----------
  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const tt = now / 1000;

    if (controls) {
      controls.autoRotate = !reduceMotion && !cursorOverGlobe && !dragging_;
      controls.update();
    } else {
      if (!manualDragging && !reduceMotion) {
        rotY += velX; rotX += velY;
        velX *= 0.94; velY *= 0.94;
        // Same rule as the OrbitControls path: spin unless the cursor is on it.
        if (!cursorOverGlobe) rotY += 0.0075;
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

  // Auto-rotate pauses while the cursor is over the globe. Registered for both
  // the OrbitControls path and the manual fallback.
  {
    // registered regardless of which control path is active
    wrapEl.addEventListener("pointerenter", () => { cursorOverGlobe = true; });
    wrapEl.addEventListener("pointerleave", () => { cursorOverGlobe = false; dragging_ = false; });
    wrapEl.addEventListener("pointerdown", () => { dragging_ = true; });
    window.addEventListener("pointerup", () => { dragging_ = false; });
    // Touch devices have no hover, so a touch pauses and lifting resumes.
    wrapEl.addEventListener("touchstart", () => { cursorOverGlobe = true; }, { passive: true });
    wrapEl.addEventListener("touchend", () => { cursorOverGlobe = false; });
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
