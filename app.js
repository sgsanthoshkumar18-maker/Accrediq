/* AQcredix — shared site behaviour: header/footer injection, nav, quiz, hero badge */

(function () {
  // Flat items + one dropdown group ("Tools"). hrefs are ROOT-RELATIVE (no leading base) —
  // resolved against each page's data-base attribute at render time, so this file works
  // unmodified whether the page lives at the site root or inside /tools/ or /tools/committees/.
  const NAV = [
    { key: "standards", href: "standards.html", label: "Standards" },
    { key: "departments", href: "departments.html", label: "Departments" },
    {
      key: "toolsgroup", label: "Tools", dropdown: [
        { key: "qualitytools", href: "tools/quality-tools.html", label: "Quality Tools" },
        { key: "kpilibrary", href: "tools/kpi-library.html", label: "KPI Library" },
        { key: "codealerts", href: "tools/code-alerts.html", label: "Code Alerts" },
        { key: "committees", href: "tools/committees.html", label: "Committees" },
      ]
    },
    { key: "videos", href: "videos.html", label: "Videos" },
    { key: "learn", href: "learn.html", label: "Learn" },
    { key: "about", href: "about.html", label: "About" }
  ];

  // Keys that count as "inside Tools" for top-level highlighting purposes.
  const TOOLS_GROUP_KEYS = ["qualitytools", "kpilibrary", "codealerts", "committees", "committeedetail"];

  const shieldMark = `<svg width="30" height="34" viewBox="0 0 26 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 1 24 5v10c0 7-5 12-11 14C7 27 2 22 2 15V5L13 1Z" fill="url(#qgrad)"/>
      <path d="M8.2 14.6l3.1 3.2 6.5-7" stroke="#fff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
      <defs><linearGradient id="qgrad" x1="2" y1="1" x2="24" y2="29" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4F46E5"/><stop offset="1" stop-color="#0EA5A0"/>
      </linearGradient></defs>
    </svg>`;

  function getBase() {
    return document.body.getAttribute("data-base") || "";
  }

  function buildHeader(currentKey, base) {
    const links = NAV.map(n => {
      if (n.dropdown) {
        const groupActive = TOOLS_GROUP_KEYS.includes(currentKey);
        const items = n.dropdown.map(d => {
          const active = currentKey === d.key ? " active" : "";
          return `<a href="${base}${d.href}" class="nav-dd-item${active}" role="menuitem">${d.label}</a>`;
        }).join("");
        return `<div class="nav-dropdown" id="toolsDropdown">
          <button type="button" class="nav-dd-trigger${groupActive ? " active" : ""}" aria-haspopup="true" aria-expanded="false" id="toolsDropdownTrigger">
            ${n.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="nav-dd-panel" role="menu" aria-label="Tools">${items}</div>
        </div>`;
      }
      const active = currentKey === n.key ? " active" : "";
      return `<a href="${base}${n.href}" class="${active}">${n.label}</a>`;
    }).join("");

    return `
    <header class="site-header">
      <div class="bar wrap">
        <a href="${base}index.html" class="brand">
          ${shieldMark}
          <span class="brand-stack">AQcredix<span class="full-name">Accreditation & Quality Excellence</span></span>
        </a>
        <nav class="main-nav" id="mainNav">${links}</nav>
        <div class="nav-actions">
          <a class="btn btn-primary btn-sm" href="${base}dashboard.html">Quality Dashboard</a>
          <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </div>
      </div>
    </header>`;
  }

  function buildFooter(base) {
    return `
    <footer class="site-footer">
      <div class="wrap">
        <div class="footer-grid">
          <div class="footer-brand">
            <a href="${base}index.html" class="brand">${shieldMark}<span class="brand-stack">AQcredix<span class="full-name">Accreditation & Quality Excellence</span></span></a>
            <p>NABH accreditation, actually understood — every standard explained the way an assessor reads it.</p>
          </div>
          <div class="footer-col"><h4>Learn</h4>
            <a href="${base}standards.html">Standards</a>
            <a href="${base}departments.html">Departments</a>
            <a href="${base}dashboard.html">Quality Dashboard</a>
            <a href="${base}tools/kpi-library.html">KPI Library</a>
          </div>
          <div class="footer-col"><h4>Practice</h4>
            <a href="${base}tools/quality-tools.html">Quality Tools</a>
            <a href="${base}tools/committees.html">Committees</a>
            <a href="${base}tools/code-alerts.html">Code Alerts</a>
            <a href="${base}videos.html">Assessor Videos</a>
            <a href="${base}learn.html">Learn &amp; Test</a>
          </div>
          <div class="footer-col"><h4>AQcredix</h4>
            <a href="${base}about.html">About &amp; vision</a>
            <a href="${base}about.html#roadmap">Roadmap</a>
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
    const currentKey = document.body.getAttribute("data-page") || "";
    const base = getBase();
    const headerMount = document.getElementById("site-header");
    const footerMount = document.getElementById("site-footer");
    if (headerMount) headerMount.innerHTML = buildHeader(currentKey, base);
    if (footerMount) footerMount.innerHTML = buildFooter(base);


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

    // Tools dropdown — click/keyboard toggle, works identically on desktop and the mobile slide-out.
    const ddWrap = document.getElementById("toolsDropdown");
    const ddTrigger = document.getElementById("toolsDropdownTrigger");
    if (ddWrap && ddTrigger) {
      const closeDropdown = () => {
        ddWrap.classList.remove("open");
        ddTrigger.setAttribute("aria-expanded", "false");
      };
      ddTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !ddWrap.classList.contains("open");
        ddWrap.classList.toggle("open", willOpen);
        ddTrigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
      document.addEventListener("click", (e) => {
        if (!ddWrap.contains(e.target)) closeDropdown();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDropdown();
      });
      ddWrap.querySelectorAll(".nav-dd-item").forEach(item => {
        item.addEventListener("click", closeDropdown);
      });
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

  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    if (isDark) {
      html.removeAttribute("data-theme");
      try { localStorage.setItem("aq-theme", "light"); } catch (err) {}
    } else {
      html.setAttribute("data-theme", "dark");
      try { localStorage.setItem("aq-theme", "dark"); } catch (err) {}
    }
  }

  function initOwnerThemeToggle() {
    // Hidden, owner-only dark-mode switch — no visible UI.
    // Trigger: type the word "dark" anywhere on the page (not while focused in a field).
    let typed = "";
    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-4);
      if (typed === "dark") {
        toggleTheme();
        typed = "";
      }
    });
  }

  function initScrollReveal() {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return; // respect reduced-motion — content just shows normally, no animation needed

    // Structural content blocks across every page — headings, cards, tiles, sections.
    // Deliberately excludes generic h3/p tags since those also appear inside dynamically
    // injected modals/tooltips/detail-panels, which already manage their own show/hide.
    const REVEAL_SELECTOR = [
      "h1", "h2", ".lead", ".tile", ".kpi-card", ".cta-band", ".section-head",
      ".dl", ".acc", ".joke", ".dept-card", ".chapter-card", ".cm-card", ".dt-card",
      ".dept-tile", ".code-item", ".video-embed", ".quiz", ".fc", ".std-block",
      ".gx-stage", ".qg-shell", ".tl-card", ".steps"
    ].join(",");

    // Skip anything inside a panel that already has its own open/close animation —
    // avoids fighting with modals, detail drill-downs, and tooltips.
    const EXCLUDE_ANCESTOR = ".modal, .modal-back, .globe-card, .dept-detail, .explorer, .tdx, .cdx, .ddx, .dna-tooltip, .qg-panel, .gx-tooltip, .brain-tooltip, .face-tooltip";

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        entry.target.classList.toggle("revealed", entry.isIntersecting);
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });

    function attach(el) {
      if (el.dataset.revealBound) return;
      if (el.closest(EXCLUDE_ANCESTOR)) return;
      el.dataset.revealBound = "1";
      el.classList.add("reveal-el");
      io.observe(el);
    }

    document.querySelectorAll(REVEAL_SELECTOR).forEach(attach);

    // Watch for content rendered later by page-specific scripts (chapter grids,
    // department cards, committee lists, etc.) so the effect covers everywhere.
    const mo = new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches(REVEAL_SELECTOR)) attach(node);
        if (node.querySelectorAll) node.querySelectorAll(REVEAL_SELECTOR).forEach(attach);
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initHeaderFooter();
    initQuiz();
    initVideoPlay();
    initOwnerThemeToggle();
    initScrollReveal();
  });
})();
