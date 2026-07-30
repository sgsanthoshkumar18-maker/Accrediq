/* AQcredix — shared site behaviour: header/footer injection, nav, quiz, hero badge */

(function () {
  const NAV = [
    { href: "standards.html", label: "Standards" },
    { href: "departments.html", label: "Departments" },
    { href: "dashboard.html", label: "Quality Dashboard", hot: true },
    { href: "kpi.html", label: "KPI Library" },
    { href: "tools.html", label: "Tools" },
    { href: "videos.html", label: "Videos" },
    { href: "learn.html", label: "Learn" },
    { href: "about.html", label: "About" }
  ];

  const PAGE_KEY = {
    standards: "standards.html",
    departments: "departments.html",
    dashboard: "dashboard.html",
    kpi: "kpi.html",
    tools: "tools.html",
    videos: "videos.html",
    learn: "learn.html",
    about: "about.html"
  };

  const shieldMark = `<svg width="30" height="34" viewBox="0 0 26 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 1 24 5v10c0 7-5 12-11 14C7 27 2 22 2 15V5L13 1Z" fill="url(#qgrad)"/>
      <path d="M8.2 14.6l3.1 3.2 6.5-7" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
      <defs><linearGradient id="qgrad" x1="2" y1="1" x2="24" y2="29" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4F46E5"/><stop offset="1" stop-color="#0EA5A0"/>
      </linearGradient></defs>
    </svg>`;

  function buildHeader(current) {
    const links = NAV.map(n => {
      const active = current === n.href ? " active" : "";
      const hot = n.hot ? " hot" : "";
      return `<a href="${n.href}" class="${active || hot}">${n.label}</a>`;
    }).join("");

    return `
    <header class="site-header">
      <div class="bar wrap">
        <a href="index.html" class="brand">
          ${shieldMark}
          <span class="brand-stack">AQcredix<span class="full-name">Accreditation & Quality Excellence</span></span>
        </a>
        <nav class="main-nav" id="mainNav">${links}</nav>
        <div class="nav-actions">
          <a class="btn btn-primary btn-sm" href="dashboard.html">Quality Dashboard</a>
          <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </div>
    </header>`;
  }

  function buildFooter() {
    return `
    <footer class="site-footer">
      <div class="wrap">
        <div class="footer-grid">
          <div class="footer-brand">
            <a href="index.html" class="brand">${shieldMark}<span class="brand-stack">AQcredix<span class="full-name">Accreditation & Quality Excellence</span></span></a>
            <p>NABH accreditation, actually understood — every standard explained the way an assessor reads it.</p>
          </div>
          <div class="footer-col"><h4>Learn</h4>
            <a href="standards.html">Standards</a>
            <a href="departments.html">Departments</a>
            <a href="dashboard.html">Quality Dashboard</a>
            <a href="kpi.html">KPI Library</a>
          </div>
          <div class="footer-col"><h4>Practice</h4>
            <a href="tools.html">Quality Tools</a>
            <a href="videos.html">Assessor Videos</a>
            <a href="learn.html">Learn &amp; Test</a>
          </div>
          <div class="footer-col"><h4>AQcredix</h4>
            <a href="about.html">About &amp; vision</a>
            <a href="about.html#roadmap">Roadmap</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 AQcredix — Accreditation & Quality Excellence. An independent healthcare education forum.</span>
          <span>Built the way an assessor reads a standard.</span>
        </div>
      </div>
    </footer>`;
  }

  function initHeaderFooter() {
    const page = document.body.getAttribute("data-page");
    const current = PAGE_KEY[page] || "";
    const headerMount = document.getElementById("site-header");
    const footerMount = document.getElementById("site-footer");
    if (headerMount) headerMount.innerHTML = buildHeader(current);
    if (footerMount) footerMount.innerHTML = buildFooter();

    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("mainNav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
      nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }));
    }
  }

  function initQuiz() {
    document.querySelectorAll(".quiz").forEach(quiz => {
      const opts = quiz.querySelectorAll(".opt");
      const feedback = quiz.querySelector(".feedback");
      opts.forEach(btn => {
        btn.addEventListener("click", () => {
          if (quiz.dataset.answered === "true") return;
          quiz.dataset.answered = "true";
          const correct = btn.dataset.correct === "true";
          btn.classList.add(correct ? "correct" : "wrong");
          if (feedback) {
            feedback.textContent = correct ? (btn.dataset.ok || "Correct.") : (btn.dataset.no || "Not quite.");
            feedback.style.color = correct ? "var(--ok)" : "var(--nc)";
          }
          if (!correct) {
            opts.forEach(o => { if (o.dataset.correct === "true") o.classList.add("correct"); });
          }
          opts.forEach(o => o.style.cursor = "default");
        });
      });
    });
  }

  function initVideoPlay() {
    document.querySelectorAll(".video-embed .play").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.closest(".video-embed").style.outline = "2px solid var(--accent-bright)";
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
      });
    });
  }

  function initShieldCanvas() {
    const canvas = document.getElementById("shield");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    let t = 0;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      const wobble = reduce ? 0 : Math.sin(t) * 0.05;
      ctx.rotate(wobble);

      const R = W * 0.34;
      // outer ring
      const grad = ctx.createLinearGradient(-R, -R, R, R);
      grad.addColorStop(0, "#4F46E5");
      grad.addColorStop(1, "#0EA5A0");

      ctx.beginPath();
      const pts = 18;
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * Math.PI * 2;
        const rr = R + Math.sin(a * 3 + t * 1.2) * (reduce ? 0 : 6);
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(79,70,229,0.08)";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = grad;
      ctx.stroke();

      // shield
      ctx.beginPath();
      const s = R * 0.62;
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.8, s, -s * 0.2, s, s * 0.05);
      ctx.bezierCurveTo(s, s * 0.9, s * 0.4, s * 1.25, 0, s * 1.45);
      ctx.bezierCurveTo(-s * 0.4, s * 1.25, -s, s * 0.9, -s, s * 0.05);
      ctx.bezierCurveTo(-s, -s * 0.2, -s * 0.9, -s * 0.8, 0, -s);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // check
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, s * 0.06);
      ctx.lineTo(-s * 0.05, s * 0.34);
      ctx.lineTo(s * 0.4, -s * 0.28);
      ctx.lineWidth = s * 0.13;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#fff";
      ctx.stroke();

      // tick marks around ring (gauge feel)
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const inner = R + 14, outer = R + (i % 5 === 0 ? 26 : 20);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.strokeStyle = i % 5 === 0 ? "rgba(14,165,160,.7)" : "rgba(255,255,255,.18)";
        ctx.lineWidth = i % 5 === 0 ? 2 : 1;
        ctx.stroke();
      }

      ctx.restore();
      t += 0.01;
      if (!reduce) requestAnimationFrame(draw);
    }
    draw();
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHeaderFooter();
    initQuiz();
    initVideoPlay();
    initShieldCanvas();
  });
})();
