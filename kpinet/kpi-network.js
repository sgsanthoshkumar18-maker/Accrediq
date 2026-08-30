/* AQcredix — 3D KPI network
 * Nodes are quality indicators, sized by domain, connected to the other KPIs
 * that share their department or domain. Slowly rotates; expands and contracts
 * with cursor proximity. Hover a node for its formula, reference target and the
 * real NABH element that makes it relevant.
 */
(function () {
  const stage = document.getElementById("knStage");
  if (!stage) return;
  const wrap = stage.querySelector(".kn-wrap");
  const canvas = document.getElementById("knCanvas");
  const overlay = document.getElementById("knOverlay");
  const tip = document.getElementById("knTip");
  const loading = document.getElementById("knLoading");

  if (typeof THREE === "undefined" || !window.KPI_NETWORK) {
    if (loading) loading.textContent = "3D view unavailable — the KPI cards below carry the same data.";
    return;
  }
  const DATA = window.KPI_NETWORK;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Domain palette, drawn from the site's own accent colours.
  const COLORS = {
    infection:   { hex: 0x4c6fff, css: "#4c6fff" },
    medication:  { hex: 0xf87171, css: "#f87171" },
    safety:      { hex: 0x34d399, css: "#34d399" },
    operational: { hex: 0x60a5fa, css: "#60a5fa" }
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const rig = new THREE.Group();
  scene.add(rig);

  // Glow sprite texture per colour
  const texCache = {};
  function glowTex(css) {
    if (texCache[css]) return texCache[css];
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, css); g.addColorStop(0.45, css); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill();
    return (texCache[css] = new THREE.CanvasTexture(c));
  }

  // Distribute nodes on a sphere shell (Fibonacci) then jitter so it reads organic.
  const R = 3.6;
  const nodes = DATA.map((k, i) => {
    const off = 2 / DATA.length;
    const y = ((i * off) - 1) + (off / 2);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    const jitter = 0.82 + Math.random() * 0.36;
    const base = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(R * jitter);

    const col = COLORS[k.domain] || COLORS.operational;
    const mat = new THREE.SpriteMaterial({ map: glowTex(col.css), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(mat);
    // Size carries meaning: zero-tolerance / 100% targets render larger.
    const critical = /^0$|100%/.test(k.target);
    const scale = critical ? 0.46 : 0.26 + Math.random() * 0.18;
    sprite.scale.setScalar(scale);
    sprite.position.copy(base);
    rig.add(sprite);
    return { data: k, mesh: sprite, base, baseScale: scale, phase: Math.random() * Math.PI * 2 };
  });

  // Edges: connect KPIs sharing a department (strong) or a domain (sparse), like the reference.
  const edges = [];
  const pos = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i].data, b = nodes[j].data;
      const sameDept = a.dept === b.dept;
      const sameDomain = a.domain === b.domain;
      if (sameDept || (sameDomain && Math.random() < 0.22) || Math.random() < 0.035) {
        edges.push([i, j]);
        pos.push(0, 0, 0, 0, 0, 0);
      }
    }
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const edgeLines = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
    color: 0x4a6bb5, transparent: true, opacity: 0.30
  }));
  rig.add(edgeLines);

  function refreshEdges() {
    const arr = edgeGeo.attributes.position.array;
    edges.forEach(([i, j], e) => {
      const p = nodes[i].mesh.position, q = nodes[j].mesh.position;
      const o = e * 6;
      arr[o] = p.x; arr[o+1] = p.y; arr[o+2] = p.z;
      arr[o+3] = q.x; arr[o+4] = q.y; arr[o+5] = q.z;
    });
    edgeGeo.attributes.position.needsUpdate = true;
  }

  // ---- interaction: cursor drives expansion + parallax tilt ----
  let expand = 1, targetExpand = 1, tiltX = 0, tiltY = 0, tX = 0, tY = 0, inside = false, spin = 1;
  wrap.addEventListener("pointerenter", () => { inside = true; targetExpand = 1.18; });
  wrap.addEventListener("pointerleave", () => { inside = false; targetExpand = 1; tX = 0; tY = 0; hideTip(); });
  wrap.addEventListener("pointermove", e => {
    const r = wrap.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    tY = nx * 0.5; tX = ny * 0.35;
    // closer to centre = more expansion, so the web "breathes" with the cursor
    targetExpand = 1.10 + (1 - Math.min(1, Math.hypot(nx, ny))) * 0.22;
  });

  // ---- accessible hit targets + tooltip ----
  const hits = nodes.map((n, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kn-hit";
    b.setAttribute("aria-label", `${n.data.name}, ${n.data.dept}`);
    const show = () => showTip(i, b);
    b.addEventListener("mouseenter", show);
    b.addEventListener("focus", show);
    b.addEventListener("mouseleave", hideTip);
    b.addEventListener("blur", hideTip);
    overlay.appendChild(b);
    return b;
  });

  let hovered = -1;
  function showTip(i, el) {
    hovered = i;
    const k = nodes[i].data;
    const col = (COLORS[k.domain] || COLORS.operational).css;
    tip.innerHTML = `
      <div class="kn-tip-head" style="border-color:${col}">
        <b>${esc(k.name)}</b>
        <span class="kn-tip-dept">${esc(k.dept)}</span>
      </div>
      <div class="kn-tip-row"><span>Formula</span><code>${esc(k.formula)}</code></div>
      <div class="kn-tip-row"><span>Reference target</span><b style="color:${col}">${esc(k.target)}</b></div>
      <div class="kn-tip-row"><span>Direction</span>${k.dir === "higher" ? "Higher is better" : "Lower is better"}</div>
      <div class="kn-tip-ref">Relevant NABH element: <b>${esc(k.ref)}</b></div>
      <div class="kn-tip-note">NABH requires each hospital to set its own indicators and targets (PSQ.3). The value above is a commonly used reference point, not an official NABH figure.</div>`;
    tip.classList.add("show");
  }
  function hideTip() { hovered = -1; tip.classList.remove("show"); }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function placeHits() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    nodes.forEach((n, i) => {
      const p = n.mesh.getWorldPosition(new THREE.Vector3()).project(camera);
      const sx = (p.x * 0.5 + 0.5) * w, sy = (-p.y * 0.5 + 0.5) * h;
      const el = hits[i];
      const behind = p.z > 1;
      el.style.left = sx + "px"; el.style.top = sy + "px";
      el.style.opacity = behind ? "0" : "1";
      el.style.pointerEvents = behind ? "none" : "auto";
      if (i === hovered) {
        // Keep the whole tooltip inside the canvas. Measure it, then decide
        // whether to sit above or below the node, and clamp horizontally —
        // otherwise nodes near an edge push the text out of view.
        const box = tip.getBoundingClientRect();
        const tw = box.width || 290, th = box.height || 180;
        const PAD = 10, GAP = 16;

        // Vertical: prefer above; flip below if there isn't room up top.
        let top = sy - GAP - th;
        if (top < PAD) {
          top = sy + GAP;                          // flip below the node
          if (top + th > h - PAD) {                // no room either side: clamp
            top = Math.max(PAD, h - th - PAD);
          }
        }

        // Horizontal: centre on the node, then clamp to the canvas.
        let left = sx - tw / 2;
        left = Math.max(PAD, Math.min(left, w - tw - PAD));

        tip.style.transform = "none";              // position directly, no offset transform
        tip.style.left = left + "px";
        tip.style.top = top + "px";
      }
    });
  }

  let t0 = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now(), tt = now / 1000;
    t0 = now;

    expand += (targetExpand - expand) * 0.07;
    tiltX += (tX - tiltX) * 0.06;
    tiltY += (tY - tiltY) * 0.06;

    // Rotation eases to a stop while the cursor is over the network, so nodes
    // hold still long enough to read, then eases back up on leave.
    const spinTarget = (reduce || inside) ? 0 : 1;
    spin += (spinTarget - spin) * 0.08;
    rig.rotation.y += 0.0016 * spin;
    rig.rotation.x = tiltX;
    rig.rotation.z = tiltY * 0.12;

    nodes.forEach((n, i) => {
      const drift = reduce ? 0 : Math.sin(tt * 0.7 + n.phase) * 0.05;
      n.mesh.position.copy(n.base).multiplyScalar(expand + drift);
      const pulse = reduce ? 1 : 1 + Math.sin(tt * 1.5 + n.phase) * 0.12;
      n.mesh.scale.setScalar(n.baseScale * pulse * (i === hovered ? 1.6 : 1));
    });

    refreshEdges();
    rig.updateMatrixWorld();
    renderer.render(scene, camera);
    placeHits();
  }

  requestAnimationFrame(() => {
    resize(); animate();
    setTimeout(() => loading && loading.classList.add("hidden"), 400);
  });
})();
