/* AQcredix — Healthcare Globe engine
   Three.js sphere + graticule + stylized continent dots, with an HTML overlay
   layer for hospital markers (clustering, hover/tap cards, tel: links, search) —
   this hybrid approach keeps interaction simple, accessible, and fast. */

(function () {
  const DATA = window.GLOBE_DATA;
  if (!DATA) return;

  const stage = document.getElementById("globeStage");
  if (!stage) return;

  // ---------- Graceful fallback if Three.js failed to load (no network, blocked CDN, etc.) ----------
  if (typeof THREE === "undefined") {
    stage.innerHTML = `<div class="globe-fallback">AQcredix<br>Accreditation &amp; Quality Excellence</div>`;
    return;
  }

  const canvas = document.getElementById("globeCanvas");
  const overlay = document.getElementById("globeOverlay");
  const loadingEl = document.getElementById("globeLoading");
  const cardEl = document.getElementById("globeCard");
  const backBtn = document.getElementById("globeBackBtn");
  const crumbEl = document.getElementById("globeBreadcrumb");
  const searchInput = document.getElementById("globeSearchInput");
  const searchResults = document.getElementById("globeSearchResults");
  const zoomInBtn = document.getElementById("globeZoomIn");
  const zoomOutBtn = document.getElementById("globeZoomOut");

  const RADIUS = 1;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function latLonToVector3(lat, lon, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // ---------- Renderer / scene / camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  let camDistance = 2.7;
  camera.position.set(0, 0, camDistance);

  function sizeRenderer() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  sizeRenderer();
  window.addEventListener("resize", sizeRenderer);

  // ---------- Globe sphere ----------
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const sphereGeo = new THREE.SphereGeometry(RADIUS, 48, 48);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x0b1030, transparent: true, opacity: 0.92 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  globeGroup.add(sphere);

  // Fresnel-style atmosphere glow (rim light), teal/indigo blend matching the theme.
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
        vec3 glow = mix(vec3(0.31, 0.27, 0.90), vec3(0.055, 0.65, 0.63), 0.5) * intensity;
        gl_FragColor = vec4(glow, intensity * 0.9);
      }`
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.14, 48, 48), atmoMat);
  scene.add(atmosphere);

  // ---------- Graticule (lat/lon grid) ----------
  (function buildGraticule() {
    const pts = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 4) {
        pts.push(latLonToVector3(lat, lon, RADIUS * 1.001));
        pts.push(latLonToVector3(lat, lon + 4, RADIUS * 1.001));
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -90; lat < 90; lat += 4) {
        pts.push(latLonToVector3(lat, lon, RADIUS * 1.001));
        pts.push(latLonToVector3(lat + 4, lon, RADIUS * 1.001));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x1f2a5c, transparent: true, opacity: 0.55 });
    globeGroup.add(new THREE.LineSegments(geo, mat));
  })();

  // ---------- Continent dot outlines (stylized) ----------
  function glowDotTexture(hex) {
    const c = document.createElement("canvas"); c.width = c.height = 32;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, hex); grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(16, 16, 16, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  (function buildContinents() {
    const positions = [];
    Object.values(DATA.CONTINENTS).forEach(ring => {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lat1, lon1] = ring[i], [lat2, lon2] = ring[i + 1];
        const steps = 6;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const lat = lat1 + (lat2 - lat1) * t;
          const lon = lon1 + (lon2 - lon1) * t;
          const v = latLonToVector3(lat, lon, RADIUS * 1.003);
          positions.push(v.x, v.y, v.z);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.028, map: glowDotTexture("rgba(94,234,212,1)"), transparent: true,
      opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    globeGroup.add(new THREE.Points(geo, mat));
  })();

  // ---------- Interaction: drag rotate + momentum + wheel/pinch zoom + cursor parallax ----------
  let rotX = 0.15, rotY = -0.4;      // current rotation (radians)
  let velX = 0, velY = 0;             // momentum
  let dragging = false, lastX = 0, lastY = 0;
  let pinchStartDist = null, pinchStartDistance = camDistance;
  let parallaxX = 0, parallaxY = 0;

  const MIN_DIST = 1.5, MAX_DIST = 4.5;

  function onPointerDown(x, y) {
    dragging = true; lastX = x; lastY = y; velX = 0; velY = 0;
  }
  function onPointerMove(x, y) {
    if (!dragging) {
      // subtle cursor parallax when idle
      const rect = canvas.getBoundingClientRect();
      parallaxX = ((x - rect.left) / rect.width - 0.5) * 0.12;
      parallaxY = ((y - rect.top) / rect.height - 0.5) * 0.12;
      return;
    }
    const dx = x - lastX, dy = y - lastY;
    rotY += dx * 0.005;
    rotX += dy * 0.005;
    rotX = Math.max(-1.3, Math.min(1.3, rotX));
    velX = dx * 0.005; velY = dy * 0.005;
    lastX = x; lastY = y;
  }
  function onPointerUp() { dragging = false; }

  canvas.addEventListener("mousedown", e => onPointerDown(e.clientX, e.clientY));
  window.addEventListener("mousemove", e => onPointerMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", onPointerUp);

  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 1) onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
    else if (e.touches.length === 2) {
      pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchStartDistance = camDistance;
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (e.touches.length === 1) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
    else if (e.touches.length === 2 && pinchStartDist) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      camDistance = Math.max(MIN_DIST, Math.min(MAX_DIST, pinchStartDistance * (pinchStartDist / d)));
    }
  }, { passive: true });
  canvas.addEventListener("touchend", () => { dragging = false; pinchStartDist = null; });

  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    camDistance = Math.max(MIN_DIST, Math.min(MAX_DIST, camDistance + e.deltaY * 0.0025));
  }, { passive: false });

  zoomInBtn && zoomInBtn.addEventListener("click", () => { camDistance = Math.max(MIN_DIST, camDistance - 0.4); });
  zoomOutBtn && zoomOutBtn.addEventListener("click", () => { camDistance = Math.min(MAX_DIST, camDistance + 0.4); });

  // ---------- Camera "look at" target for country/state fly-to ----------
  let targetRotX = null, targetRotY = null, targetDistance = null;
  function flyTo(lat, lon, distance) {
    // rotate globe so that lat/lon faces the camera (+Z)
    const theta = (lon + 180) * (Math.PI / 180);
    const phi = (90 - lat) * (Math.PI / 180);
    targetRotY = (Math.PI * 1.5 - theta);
    targetRotX = (phi - Math.PI / 2) * -1;
    targetDistance = distance;
  }

  // ---------- Marker overlay (HTML/CSS layer, projected each frame) ----------
  const markers = DATA.HOSPITALS.map(h => ({
    ...h,
    vec: latLonToVector3(h.lat, h.lon, RADIUS * 1.02)
  }));

  // Navigation state
  const navStack = []; // {level:'world'|'country'|'state', name}
  let currentLevel = "world", currentCountry = null, currentState = null;

  function visibleMarkers() {
    return markers.filter(m => {
      if (currentLevel === "world") return true;
      if (currentLevel === "country") return m.country === currentCountry;
      if (currentLevel === "state") return m.country === currentCountry && m.state === currentState;
      return true;
    });
  }

  function updateBreadcrumb() {
    const parts = ["World"];
    if (currentCountry) parts.push(currentCountry);
    if (currentState) parts.push(currentState);
    crumbEl.textContent = parts.join(" / ");
    backBtn.classList.toggle("show", navStack.length > 0);
  }

  function pushNav(level, name) {
    navStack.push({ level: currentLevel, country: currentCountry, state: currentState });
    currentLevel = level;
    if (level === "country") { currentCountry = name; currentState = null; }
    if (level === "state") { currentState = name; }
    updateBreadcrumb();
    clearCard();
  }

  backBtn && backBtn.addEventListener("click", () => {
    const prev = navStack.pop();
    if (!prev) return;
    currentLevel = prev.level; currentCountry = prev.country; currentState = prev.state;
    if (currentLevel === "world") flyTo(15, 20, 2.7);
    else if (currentLevel === "country") {
      const c = DATA.COUNTRIES[currentCountry];
      if (c) flyTo(c[0], c[1], 2.1);
    }
    updateBreadcrumb();
    clearCard();
  });

  function selectCountry(name) {
    const c = DATA.COUNTRIES[name];
    pushNav("country", name);
    if (c) flyTo(c[0], c[1], 2.05);
  }
  function selectState(stateObj) {
    pushNav("state", stateObj.name);
    flyTo(stateObj.lat, stateObj.lon, 1.75);
  }

  // Country hub markers (world view) — one glowing hub per country centroid, click drills in.
  const countryHubs = Object.keys(DATA.COUNTRIES).map(name => ({
    name, isHub: true,
    lat: DATA.COUNTRIES[name][0], lon: DATA.COUNTRIES[name][1],
    vec: latLonToVector3(DATA.COUNTRIES[name][0], DATA.COUNTRIES[name][1], RADIUS * 1.02)
  }));
  // India state hubs — shown only once India is selected.
  const stateHubs = DATA.INDIA_STATES.map(s => ({
    ...s, isStateHub: true,
    vec: latLonToVector3(s.lat, s.lon, RADIUS * 1.02)
  }));

  // ---------- Card ----------
  function statusLabel(type) {
    return { Government: "Government", Private: "Private", Trust: "Trust" }[type] || type;
  }

  function showCard(hospital, screenX, screenY) {
    const acc = (hospital.accreditations || []).map(a => `<span class="gc-tag">${a}</span>`).join("");
    const cert = (hospital.certifications || []).map(c => `<span class="gc-tag jci">${c}</span>`).join("");
    let stockHtml = "";
    if (hospital.listed) {
      stockHtml = `<div class="gc-stock"><span class="gc-stock-badge">Sample data</span><br>Ticker ${hospital.ticker} — live price feed not connected. Illustrative placeholder only.</div>`;
    } else {
      stockHtml = `<div class="gc-stock"><span class="gc-stock-badge">Ownership</span><br>Not Publicly Listed</div>`;
    }
    cardEl.innerHTML = `
      <button class="gc-close" aria-label="Close">✕</button>
      <h4>${hospital.name}</h4>
      <div class="gc-loc">${hospital.city}, ${hospital.state}, ${hospital.country}</div>
      <div class="gc-row"><span class="gc-k">Type</span><span class="gc-v">${statusLabel(hospital.type)}</span></div>
      ${hospital.rating ? `<div class="gc-row"><span class="gc-k">Google Rating</span><span class="gc-v">★ ${hospital.rating.toFixed(1)}</span></div>` : ""}
      ${hospital.beds ? `<div class="gc-row"><span class="gc-k">Beds</span><span class="gc-v">${hospital.beds}</span></div>` : ""}
      <div class="gc-row"><span class="gc-k">Contact</span><span class="gc-v"><a class="gc-phone" href="tel:${hospital.phone.replace(/\s+/g,'')}">${hospital.phone}</a></span></div>
      ${(acc || cert) ? `<div class="gc-tags">${acc}${cert}</div>` : ""}
      ${stockHtml}
    `;
    cardEl.querySelector(".gc-close").addEventListener("click", clearCard);
    positionCard(screenX, screenY);
    cardEl.classList.add("show");
  }
  function positionCard(x, y) {
    const w = stage.clientWidth, h = stage.clientHeight;
    let left = x + 14, top = y - 10;
    if (left + 250 > w) left = x - 264;
    if (top + 220 > h) top = h - 230;
    cardEl.style.left = Math.max(6, left) + "px";
    cardEl.style.top = Math.max(6, top) + "px";
  }
  function clearCard() { cardEl.classList.remove("show"); cardEl.innerHTML = ""; }

  // ---------- DOM marker pool (reused each frame to avoid GC churn) ----------
  function makeEl(cls) { const d = document.createElement("div"); d.className = cls; return d; }

  const CLUSTER_PX = 34;

  function render2DMarkers() {
    overlay.querySelectorAll(".gm-dot, .globe-cluster").forEach(n => n.remove());

    const w = stage.clientWidth, h = stage.clientHeight;
    const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);

    function project(vecLocal) {
      const world = vecLocal.clone().applyMatrix4(globeGroup.matrixWorld);
      const normal = world.clone().normalize();
      const toCam = camera.position.clone().sub(world).normalize();
      const front = normal.dot(toCam) > 0.05;
      if (!front) return null;
      const p = world.clone().project(camera);
      return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h };
    }

    // World-level: country hubs
    if (currentLevel === "world") {
      const projected = countryHubs.map(hub => ({ hub, p: project(hub.vec) })).filter(x => x.p);
      renderClusterable(projected, (item) => selectCountry(item.hub.name), (item) => item.hub.name, true);
      return;
    }

    // Country-level in India: state hubs
    if (currentLevel === "country" && currentCountry === "India" && !currentState) {
      const projected = stateHubs.map(hub => ({ hub, p: project(hub.vec) })).filter(x => x.p);
      renderClusterable(projected, (item) => selectState(item.hub), (item) => item.hub.name, true);
      return;
    }

    // Otherwise: individual hospital markers
    const list = visibleMarkers();
    const projected = list.map(m => ({ hospital: m, p: project(m.vec) })).filter(x => x.p);
    renderClusterable(projected, (item) => {
      const rect = canvas.getBoundingClientRect();
      showCard(item.hospital, item.p.x, item.p.y);
    }, (item) => item.hospital.name, false);
  }

  function renderClusterable(items, onClick, labelFn, isHub) {
    // simple greedy clustering by screen-space distance
    const used = new Array(items.length).fill(false);
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;
      const group = [items[i]]; used[i] = true;
      for (let j = i + 1; j < items.length; j++) {
        if (used[j]) continue;
        const dx = items[i].p.x - items[j].p.x, dy = items[i].p.y - items[j].p.y;
        if (Math.hypot(dx, dy) < CLUSTER_PX) { group.push(items[j]); used[j] = true; }
      }
      const cx = group.reduce((s, g) => s + g.p.x, 0) / group.length;
      const cy = group.reduce((s, g) => s + g.p.y, 0) / group.length;

      if (group.length === 1) {
        const dot = makeEl("gm-dot");
        dot.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${isHub ? 12 : 9}px;height:${isHub ? 12 : 9}px;border-radius:50%;
          background:radial-gradient(circle,#5EEAD4,rgba(14,165,160,.15));box-shadow:0 0 10px rgba(14,165,160,.9);
          transform:translate(-50%,-50%);cursor:pointer;pointer-events:auto;border:1px solid rgba(255,255,255,.5);`;
        dot.title = labelFn(group[0]);
        dot.addEventListener("click", (e) => { e.stopPropagation(); onClick(group[0]); });
        overlay.appendChild(dot);
      } else {
        const badge = makeEl("globe-cluster");
        badge.style.left = cx + "px"; badge.style.top = cy + "px";
        badge.textContent = group.length;
        badge.title = group.map(g => labelFn(g)).join(", ");
        badge.addEventListener("click", (e) => {
          e.stopPropagation();
          // zoom in toward the cluster's average lat/lon
          camDistance = Math.max(MIN_DIST, camDistance - 0.6);
        });
        overlay.appendChild(badge);
      }
    }
  }

  // ---------- Search ----------
  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { searchResults.classList.remove("show"); searchResults.innerHTML = ""; return; }
    const matches = DATA.HOSPITALS.filter(h =>
      h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q) ||
      h.state.toLowerCase().includes(q) || h.country.toLowerCase().includes(q)
    ).slice(0, 8);
    if (!matches.length) { searchResults.innerHTML = `<div class="globe-search-result">No matches</div>`; searchResults.classList.add("show"); return; }
    searchResults.innerHTML = matches.map(h => `
      <div class="globe-search-result" data-id="${h.id}">${h.name}<span class="gsr-sub">${h.city}, ${h.state}, ${h.country}</span></div>
    `).join("");
    searchResults.classList.add("show");
    searchResults.querySelectorAll(".globe-search-result[data-id]").forEach(el => {
      el.addEventListener("click", () => {
        const h = DATA.HOSPITALS.find(x => x.id === el.dataset.id);
        if (!h) return;
        navStack.length = 0;
        currentLevel = h.country === "India" ? "state" : "country";
        currentCountry = h.country; currentState = h.country === "India" ? h.state : null;
        updateBreadcrumb();
        flyTo(h.lat, h.lon, 1.7);
        searchResults.classList.remove("show"); searchInput.value = "";
        setTimeout(() => {
          const rect = stage.getBoundingClientRect();
          showCard(h, rect.width / 2, rect.height / 2);
        }, 650);
      });
    });
  }
  searchInput && searchInput.addEventListener("input", () => runSearch(searchInput.value));

  // ---------- Animate loop ----------
  function animate() {
    requestAnimationFrame(animate);

    if (targetRotX !== null) {
      rotX += (targetRotX - rotX) * 0.06;
      rotY += (targetRotY - rotY) * 0.06;
      if (Math.abs(targetRotX - rotX) < 0.001) targetRotX = null;
    } else if (!dragging && !reduceMotion) {
      rotY += velX; rotX += velY;
      velX *= 0.94; velY *= 0.94;
      rotY += 0.0007; // slow idle spin
    }

    if (targetDistance !== null) {
      camDistance += (targetDistance - camDistance) * 0.06;
      if (Math.abs(targetDistance - camDistance) < 0.002) targetDistance = null;
    }

    globeGroup.rotation.set(rotX + parallaxY, rotY + parallaxX, 0);
    atmosphere.rotation.copy(globeGroup.rotation);
    camera.position.set(0, 0, camDistance);
    camera.lookAt(0, 0, 0);
    globeGroup.updateMatrixWorld();

    renderer.render(scene, camera);
    render2DMarkers();
  }

  // initial fly-in for a premium first-load feel
  flyTo(15, 20, 2.7);
  camDistance = reduceMotion ? 2.7 : 3.6;
  updateBreadcrumb();

  requestAnimationFrame(() => {
    sizeRenderer();
    animate();
    setTimeout(() => loadingEl && loadingEl.classList.add("hidden"), 400);
  });
})();
