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

  function latLon(lat, lon, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }

  // ---------- Dotted continent outlines ("outlines = real borders", stylized) ----------
  const CONTINENTS = {
    "North America": [[70,-160],[60,-141],[50,-125],[32,-117],[18,-105],[19,-97],[29,-95],[25,-80],[35,-76],[44,-67],[50,-60],[58,-65],[63,-78],[68,-95],[71,-130],[70,-160]],
    "South America": [[12,-72],[4,-77],[-8,-79],[-18,-70],[-30,-71],[-45,-73],[-54,-68],[-46,-65],[-34,-58],[-23,-43],[-8,-35],[0,-50],[8,-60],[12,-72]],
    "Africa": [[37,10],[31,-9],[21,-17],[8,-13],[5,0],[-4,9],[-15,12],[-29,17],[-34,25],[-20,35],[-4,39],[10,44],[20,38],[31,32],[37,10]],
    "Europe": [[71,25],[63,14],[57,8],[51,3],[44,-2],[41,3],[37,-8],[43,10],[41,16],[40,20],[41,29],[47,29],[54,20],[60,25],[71,25]],
    "Asia": [[70,60],[73,105],[64,178],[53,158],[42,131],[35,129],[23,113],[10,106],[-8,115],[5,95],[22,90],[30,79],[34,71],[25,61],[19,57],[13,44],[27,34],[36,36],[45,48],[60,55],[70,60]],
    "Australia": [[-11,131],[-16,145],[-24,153],[-33,151],[-38,141],[-32,127],[-26,113],[-16,122],[-11,131]],
  };
  (function buildContinents() {
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
    Object.values(CONTINENTS).forEach(ring => {
      for (let i = 0; i < ring.length - 1; i++) {
        const [lat1, lon1] = ring[i], [lat2, lon2] = ring[i + 1];
        const STEPS = 14; // denser interpolation so the outline reads as a continuous coastline, not scattered dots
        let prev = null;
        for (let s = 0; s <= STEPS; s++) {
          const t = s / STEPS;
          const v = latLon(lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t, RADIUS * 1.006);
          if (prev) linePositions.push(prev.x, prev.y, prev.z, v.x, v.y, v.z);
          if (s % 3 === 0) dotPositions.push(v.x, v.y, v.z);
          prev = v;
        }
      }
    });

    // Continuous glowing outline — this is what actually reads as "a world map"
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.85 });
    rig.add(new THREE.LineSegments(lineGeo, lineMat));

    // Soft glow dots along the same coastline for a luminous, premium feel
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute("position", new THREE.Float32BufferAttribute(dotPositions, 3));
    const dotMat = new THREE.PointsMaterial({ size: 0.028, map: glowTex("rgba(224,255,250,1)"), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    rig.add(new THREE.Points(dotGeo, dotMat));
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
  const arcCurve = new THREE.EllipseCurve(0, 0, RADIUS * 1.7, RADIUS * 1.35, 0, Math.PI * 2, false, 0);
  const arcPts3D = arcCurve.getPoints(80).map(p => new THREE.Vector3(p.x, p.y * 0.3, p.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6));
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts3D);
  const arcLine = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.18 }));
  rig.add(arcLine);
  const travelDotMat = new THREE.SpriteMaterial({ map: dotTexture("#e0f2fe"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const travelDot = new THREE.Sprite(travelDotMat);
  travelDot.scale.setScalar(0.05);
  rig.add(travelDot);

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

  // ---------- Interaction: drag orbit + momentum + zoom + click ----------
  let rotX = 0.15, rotY = -0.3, velX = 0, velY = 0, dragging = false, lastX = 0, lastY = 0;
  const MIN_D = 1.6, MAX_D = 4.2;

  function onDown(x, y) { dragging = true; lastX = x; lastY = y; velX = 0; velY = 0; }
  function onMove(x, y) {
    if (!dragging) return;
    const dx = x - lastX, dy = y - lastY;
    rotY += dx * 0.005; rotX += dy * 0.005;
    rotX = Math.max(-1.3, Math.min(1.3, rotX));
    velX = dx * 0.005; velY = dy * 0.005;
    lastX = x; lastY = y;
  }
  function onUp() { dragging = false; }

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
    if (Math.abs(velX) > 0.01 || Math.abs(velY) > 0.01) return;
    const hit = pickHub(e.clientX, e.clientY);
    if (hit) selectDept(hit.dept);
  });

  // ---------- Accessible hit-targets ----------
  const hitEls = hubs.map(h => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "qg-hub-hit";
    btn.setAttribute("aria-label", `${h.dept.name} department`);
    btn.addEventListener("click", () => selectDept(h.dept));
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
      el.style.opacity = p.z > 1 ? "0" : "1";
      el.style.pointerEvents = p.z > 1 ? "none" : "auto";
    });
  }

  // ---------- Right-side intelligence panel ----------
  function statusWord(s) { return s === "ok" ? "On track" : s === "watch" ? "Needs attention" : s; }

  function selectDept(d) {
    hubs.forEach(h => h.mesh.scale.setScalar(h.dept.id === d.id ? 0.15 : 0.1));
    panelEmpty.style.display = "none";
    panel.style.display = "block";

    const committees = deptCommittees(d);
    const sops = deptSopElements(d);
    const o = OFFICIAL[d.short];

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

      <div class="qg-metric-grid">
        <div class="qg-metric-card"><div class="qg-metric-val" style="color:#5eead4;">${d.kra.length}<span class="dot" style="background:#5eead4;"></span></div><div class="qg-metric-lbl">KEY RESULT AREAS</div></div>
        <div class="qg-metric-card"><div class="qg-metric-val" style="color:#818cf8;">${d.kpi.length}<span class="dot" style="background:#818cf8;"></span></div><div class="qg-metric-lbl">KPIs TRACKED</div></div>
        <div class="qg-metric-card"><div class="qg-metric-val" style="color:#fbbf24;">${sops.length}<span class="dot" style="background:#fbbf24;"></span></div><div class="qg-metric-lbl">SOPs REQUIRED (${d.short})</div></div>
        <div class="qg-metric-card"><div class="qg-metric-val" style="color:#f472b6;">${committees.length}<span class="dot" style="background:#f472b6;"></span></div><div class="qg-metric-lbl">COMMITTEES</div></div>
        <div class="qg-metric-card"><div class="qg-metric-val" style="color:#c42e42;">${o ? o.core : "—"}<span class="dot" style="background:#c42e42;"></span></div><div class="qg-metric-lbl">CORE ELEMENTS (${d.short})</div></div>
        <div class="qg-metric-card"><div class="qg-metric-val" style="color:#b0590a;">${o ? o.commitment : "—"}<span class="dot" style="background:#b0590a;"></span></div><div class="qg-metric-lbl">COMMITMENT ELEMENTS</div></div>
      </div>

      <div class="qg-block">
        <h3>SOP-required elements — Chapter ${d.short}</h3>
        <p class="qg-block-note">Every asterisked element in ${d.short} requires a written, documented SOP. Not every one is specific to ${d.name}, but these are the ones the chapter mandates.</p>
        <div class="qg-sop-list">
          ${sops.length ? sops.slice(0, 12).map(s => `<span class="qg-sop-chip" title="${s.text.replace(/"/g,'&quot;')}">✱ ${s.code}</span>`).join("") + (sops.length > 12 ? `<span class="qg-sop-chip qg-sop-more">+${sops.length - 12} more</span>` : "") : `<span class="qg-sop-empty">No asterisked elements in this chapter.</span>`}
        </div>
      </div>

      <div class="qg-block">
        <h3>Mandatory committee membership</h3>
        <div class="qg-committee-list">
          ${committees.length ? committees.map((c, i) => `<span class="qg-committee-chip" style="border-color:${COMMITTEE_COLORS[i % COMMITTEE_COLORS.length]};color:${COMMITTEE_COLORS[i % COMMITTEE_COLORS.length]};">${c.short}</span>`).join("") : `<span class="qg-sop-empty">Not a mandatory member of the 12 modeled committees.</span>`}
        </div>
      </div>

      <a class="qg-panel-cta" href="departments.html${DEPT_ID_ALIAS[d.id] ? '?d=' + encodeURIComponent(DEPT_ID_ALIAS[d.id]) : ''}">Open full department profile →</a>
    `;
    document.getElementById("qgPanelClose").addEventListener("click", () => {
      panel.style.display = "none";
      panelEmpty.style.display = "block";
      hubs.forEach(h => h.mesh.scale.setScalar(0.1));
    });
  }
  const COMMITTEE_COLORS = ["#5eead4", "#818cf8", "#f472b6", "#60a5fa", "#fbbf24", "#a78bfa", "#34d399", "#fb923c", "#38bdf8", "#c084fc", "#f87171", "#4ade80"];

  // ---------- Animate ----------
  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const tt = now / 1000;

    if (!dragging && !reduceMotion) {
      rotY += velX; rotX += velY;
      velX *= 0.94; velY *= 0.94;
      rotY += 0.0006;
    }

    rig.rotation.set(rotX, rotY, 0);
    camera.position.set(0, 0, camDistance);
    camera.lookAt(0, 0, 0);
    rig.updateMatrixWorld();

    if (!reduceMotion) {
      const t = (tt * 0.05) % 1;
      const p = arcCurve.getPointAt(t);
      travelDot.position.set(p.x, p.y * 0.3, p.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.6);
      hubs.forEach(h => {
        const pulse = 1 + Math.sin(tt * 1.4 + h.phase) * 0.12;
        if (h.mesh.scale.x < 0.13) h.mesh.scale.setScalar(0.1 * pulse);
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
