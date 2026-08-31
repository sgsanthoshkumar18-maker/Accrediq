/* AQcredix — shared site behaviour: header/footer injection, nav, quiz, hero badge */

(function () {
  // Flat items + one dropdown group ("Tools"). hrefs are ROOT-RELATIVE (no leading base) —
  // resolved against each page's data-base attribute at render time, so this file works
  // unmodified whether the page lives at the site root or inside /tools/ or /tools/committees/.
  const NAV = [
    { key: "standards", href: "standards.html", label: "Standards" },
    {
      key: "deptgroup", label: "Departments", dropdown: [
        { key: "departments", href: "departments.html", label: "Administrative Departments" },
        { key: "clinicalareas", href: "clinical-areas.html", label: "Clinical Areas" },
        { key: "nonclinicalareas", href: "nonclinical-areas.html", label: "Non-Clinical Areas" },
        /* Free page, sits with the departments rather than under Plans: a department head
           sent this link is answering "what do I get", not "what does it cost". */
        { key: "value", href: "value.html", label: "What Your Department Gets" },
      ]
    },
    /* "Enter your hospital" is NOT in this list any more, though it was, and the label is
       still the right one — it describes what the person is about to do rather than naming
       the software. The problem was the shape: three words among single-word items, in a
       nav that lays out horizontally, so it wrapped onto three stacked lines and dragged
       the whole bar out of true. It is now a button in the actions group to the right,
       where a multi-word label is normal, plus a prominent one on the home page. It also
       remains in the mobile nav and the footer, so it is reachable from every page. */
    {
      key: "toolsgroup", label: "Tools", dropdown: [
        { key: "todaysquiz", href: "quiz.html", label: "Today's Quiz" },
        { key: "qualitytools", href: "tools/quality-tools.html", label: "Quality Tools" },
        { key: "kpilibrary", href: "tools/kpi-library.html", label: "KPI Library" },
        { key: "codealerts", href: "tools/code-alerts.html", label: "Code Alerts" },
        { key: "committees", href: "tools/committees.html", label: "Committees" },
        { key: "sop", href: "sop.html", label: "SOP Generator" },
        { key: "surveyor", href: "surveyor.html", label: "Mock Surveyor" },
        { key: "internalaudit", href: "workspace/audit.html", label: "Internal Audit" },
        { key: "incidents", href: "workspace/incidents.html", label: "Incident Reporting" },
        { key: "know", href: "know.html", label: "Gap Analysis" },
        { key: "icd", href: "icd.html", label: "ICD-11 Codes" },
      ]
    },
    { key: "videos", href: "videos.html", label: "Videos" },
    { key: "learn", href: "learn.html", label: "Learn" },
    { key: "about", href: "about.html", label: "About" }
  ];

  // Extra keys that belong to a group for top-level highlighting but have no nav entry
  // of their own (e.g. an individual committee detail page sits under Tools).
  const EXTRA_GROUP_KEYS = { toolsgroup: ["committeedetail"] };

  // True when currentKey lives inside the given dropdown group.
  function inGroup(group, currentKey) {
    if (group.dropdown.some(d => d.key === currentKey)) return true;
    return (EXTRA_GROUP_KEYS[group.key] || []).includes(currentKey);
  }

  /* The ring mark: a three-quarter accent arc closing on a serif A. The open quarter
   is the point — accreditation readiness is a cycle that is never quite finished.
   Matches the mark drawn on the certificate, so the two read as one brand. */
  const shieldMark = `<svg width="46" height="46" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="20" cy="20" r="16" stroke="#D8E0E6" stroke-width="3.4"/>
      <path d="M20 4a16 16 0 1 1-11.31 4.69" stroke="#4C6FFF" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M19.15 14.05H20.85L25.61 25.015H26.97V25.95H22.21V25.015H23.315L22 22H18L16.685 25.015H17.79V25.95H13.03V25.015H14.39ZM20 16.26L22.027 20.935H17.973Z" fill="#4C6FFF" fill-rule="evenodd"/>
    </svg>`;

  /* If the film is already on this page, the button plays it instead of navigating.
     Anywhere else it falls through to its href and lands on the home page section. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#aqFilmBtn');
    if (!b || !window.AQFilm) return;
    e.preventDefault();
    var host = document.getElementById('aqFilmHost');
    if (host) { host.scrollIntoView({ block: 'center' }); host.querySelector('.aqf-poster') && host.querySelector('.aqf-poster').click(); }
    else window.AQFilm.open();
  });

  function getBase() {
    return document.body.getAttribute("data-base") || "";
  }

  function buildHeader(currentKey, base) {
    const links = NAV.map(n => {
      if (n.dropdown) {
        const groupActive = inGroup(n, currentKey);
        const items = n.dropdown.map(d => {
          const active = currentKey === d.key ? " active" : "";
          return `<a href="${base}${d.href}" class="nav-dd-item${active}" role="menuitem">${d.label}</a>`;
        }).join("");
        return `<div class="nav-dropdown" data-dd="${n.key}">
          <button type="button" class="nav-dd-trigger${groupActive ? " active" : ""}" aria-haspopup="true" aria-expanded="false">
            ${n.label}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="nav-dd-panel" role="menu" aria-label="${n.label}">${items}</div>
        </div>`;
      }
      const active = currentKey === n.key ? " active" : "";
      return `<a href="${base}${n.href}" class="${active}">${n.label}</a>`;
    }).join("");

    return `
    <a class="aq-skip" href="#aq-main">Skip to main content</a>
    <!-- The link is the point of this line, not decoration. Naming NABH as the source and
         sending the reader to buy the standard from NABH themselves is what separates
         commentary from substitution: we are not offering an alternative to the book, we
         are telling every visitor where the book is. It also means nobody can claim they
         mistook this site for the official text. rel="noopener" because target=_blank
         without it hands the new tab a reference back to this window. -->
    <div class="aq-edition">Element codes follow the <b>NABH Hospital Accreditation Standards, 6th Edition</b> — effective 1 January 2025. The descriptions are AQcredix&rsquo;s own wording, not the official text. For exact wording see <a href="https://nabh.co/programmes/hospitals-accreditation-programme-hco/" target="_blank" rel="noopener noreferrer">NABH</a>.</div>
    <header class="site-header">
      <div class="bar wrap">
        <a href="${base}index.html" class="brand brand-nomark">
          <span class="brand-stack">AQcredix<span class="full-name">Accreditation &amp; Quality Implementation Guidance Platform</span></span>
        </a>
        <nav class="main-nav" id="mainNav">${links}<a href="${base}workspace/start.html" class="nav-workspace-menu">Enter your hospital</a><a href="${base}dashboard.html" class="nav-mobile-only">Quality Dashboard</a></nav>
        <div class="nav-actions">
          <button type="button" class="aq-search-btn" id="aqSearchBtn" aria-label="Search the site">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
            <span>Search</span><kbd>Ctrl K</kbd>
          </button>
          <!-- Secondary to the dashboard, not equal to it: two filled buttons side by side
               argue with each other and neither reads as the main action. Hidden on narrow
               screens by nav-wide-only, where the mobile nav carries it instead. -->
          <a class="btn btn-ghost btn-sm nav-wide-only" href="${base}workspace/start.html">Enter your hospital</a>
          <a class="btn btn-primary btn-sm" href="${base}dashboard.html">Quality Dashboard</a>
          <a class="profile-btn" id="profileBtn" href="${base}profile.html" aria-label="My progress and subscription" title="My progress">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>
          </a>
          <!-- A flag, not a question mark: this is for reporting something wrong, and the
               icon should say so. Sits beside the theme toggle so it is reachable from
               every page without competing with the primary actions. -->
          <button type="button" class="aq-support-btn" data-aq-support aria-label="Report a problem" title="Report a problem">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </button>
          <button type="button" class="theme-toggle" id="themeToggle" aria-label="Switch between dark and light" title="Switch theme">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
          </button>
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
            <a href="${base}index.html" class="brand">${shieldMark}<span class="brand-stack">AQcredix<span class="full-name">Accreditation &amp; Quality Implementation Guidance Platform</span></span></a>
            <p>NABH accreditation, actually understood — every standard explained the way an assessor reads it.</p>
          </div>
          <div class="footer-col"><h4>Learn</h4>
            <a href="${base}plans.html">Plans &amp; pricing</a><a href="${base}index.html#aqFilmHome" id="aqFilmBtn">Wanna know about AQcredix?</a><a href="${base}value.html">What your department gets</a><a href="${base}standards.html">Standards</a>
            <a href="${base}departments.html">Departments</a>
            <a href="${base}workspace/start.html">Enter your hospital</a>
            <a href="${base}clinical-areas.html">Clinical Areas</a>
            <a href="${base}nonclinical-areas.html">Non-Clinical Areas</a>
            <a href="${base}dashboard.html">Quality Dashboard</a>
            <a href="${base}tools/kpi-library.html">KPI Library</a>
          </div>
          <div class="footer-col"><h4>Practice</h4>
            <a href="${base}quiz.html">Today's Quiz</a>
            <a href="${base}tools/quality-tools.html">Quality Tools</a>
            <a href="${base}tools/committees.html">Committees</a>
            <a href="${base}sop.html">SOP Generator</a>
            <a href="${base}surveyor.html">Mock Surveyor</a>
            <a href="${base}know.html">Gap Analysis</a>
            <a href="${base}icd.html">ICD-11 Codes</a>
            <a href="${base}tools/code-alerts.html">Code Alerts</a>
            <a href="${base}videos.html">Assessor Videos</a>
            <a href="${base}learn.html">Learn &amp; Test</a>
          </div>
          <div class="footer-col"><h4>AQcredix</h4>
            <a href="${base}about.html">About &amp; vision</a>
            <a href="${base}about.html#roadmap">Roadmap</a>
            <a href="${base}contact.html">Contact</a>
            <a href="${base}privacy.html">Privacy Policy</a>
            <a href="${base}terms.html">Terms of Service</a>
            <a href="${base}refunds.html">Refunds &amp; Cancellation</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 AQcredix. All rights reserved. Accreditation &amp; Quality Implementation Guidance Platform. An independent healthcare education forum. Not affiliated with NABH, QCI, JCI or any accreditation body. Explanatory content on this site is original work; the published standards remain the property of their respective bodies.</span>
          <span><a href="${base}contact.html" style="color:inherit;text-decoration:underline;">Found an error on this page? Tell us.</a></span>
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


    /* The mobile menu is positioned from the bottom of the header, whose height varies:
       the edition banner wraps to two or three lines on a narrow screen, and the phone
       address bar changes the viewport as it collapses. A hardcoded offset left the top
       of the menu hidden behind the header. Measure it instead, and re-measure whenever
       the layout can change. */
    /* Until now the only way to change theme was to type the word "dark" or "neon", which
       no phone user can do — a visitor on a handset was permanently stuck on whatever the
       default was. This button flips the whole look at once: neon dark is the house style,
       so the pair moves together rather than exposing two separate switches. */
    // Matches how nav links mark themselves current, using the page's data-page value.
    if (document.body.getAttribute("data-page") === "profile") {
      const pb = document.getElementById("profileBtn");
      if (pb) pb.classList.add("is-active");
    }

    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const html = document.documentElement;
        const goingLight = html.getAttribute("data-theme") === "dark";
        if (goingLight) {
          html.removeAttribute("data-theme");
          /* Neon is a true-black palette and is unreadable over a light theme, so it
             steps aside while light is on. The stored preference is left alone, so the
             owner's neon comes back when they switch to dark again. */
          html.removeAttribute("data-palette");
          try { localStorage.setItem("aq-theme", "light"); } catch (err) {}
        } else {
          html.setAttribute("data-theme", "dark");
          try {
            localStorage.setItem("aq-theme", "dark");
            /* Restore whatever palette is published. This button gives everyone dark
               and light and nothing else — it never CHANGES the palette — but coming
               back to dark must return the visitor to the look the owner published.
               Gating the restore on ownership meant a subscriber who tried light once
               was stranded on blue for good, because nothing else ever re-applies the
               attribute within a page's life. Absence of a stored value means the
               shipped default, which is neon. */
            if (localStorage.getItem("aq-palette") !== "default") {
              html.setAttribute("data-palette", "neon");
            }
          } catch (err) {}
        }
      });
    }

    /* The panel is anchored in CSS with top:100%, so its position needs no measurement.
       This value only caps its height, so a long menu scrolls inside itself instead of
       running off the bottom of the screen. */
    const header = document.querySelector(".site-header");
    const edition = document.querySelector(".aq-edition");
    function measureHeader() {
      const h = (header ? header.getBoundingClientRect().height : 0) +
                (edition ? edition.getBoundingClientRect().height : 0);
      if (h > 0) document.documentElement.style.setProperty("--aq-header-h", Math.round(h) + "px");
    }
    measureHeader();
    // Fonts land after first paint and change the header height, so measure again once.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureHeader);
    window.addEventListener("resize", measureHeader);
    window.addEventListener("orientationchange", () => setTimeout(measureHeader, 200));

    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("mainNav");
    if (toggle && nav) {
      const setNav = (open) => {
        nav.classList.toggle("open", open);
        // Locking the body stops the page scrolling under the open menu, which on a phone
        // reads as the menu itself refusing to scroll.
        document.body.classList.toggle("aq-nav-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      };
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();          // otherwise the document handler below reads the
                                      // same tap and closes the menu as it opens
        measureHeader();
        setNav(!nav.classList.contains("open"));
      });
      nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => setNav(false)));
      // Escape and taps outside — a menu with no visible way out traps the reader.
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") setNav(false); });
      document.addEventListener("click", (e) => {
        if (nav.classList.contains("open") && !nav.contains(e.target) && !toggle.contains(e.target)) {
          setNav(false);
        }
      });
    }

    // Nav dropdowns (Departments, Tools) — click/keyboard toggle, works identically
    // on desktop and the mobile slide-out. Opening one closes the others.
    const dropdowns = Array.prototype.slice.call(document.querySelectorAll(".nav-dropdown"));
    const closeAllDropdowns = (except) => {
      dropdowns.forEach(dd => {
        if (dd === except) return;
        dd.classList.remove("open");
        const t = dd.querySelector(".nav-dd-trigger");
        if (t) t.setAttribute("aria-expanded", "false");
      });
    };
    dropdowns.forEach(ddWrap => {
      const ddTrigger = ddWrap.querySelector(".nav-dd-trigger");
      if (!ddTrigger) return;
      ddTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !ddWrap.classList.contains("open");
        closeAllDropdowns(ddWrap);
        ddWrap.classList.toggle("open", willOpen);
        ddTrigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });
      ddWrap.querySelectorAll(".nav-dd-item").forEach(item => {
        item.addEventListener("click", () => closeAllDropdowns());
      });
    });
    if (dropdowns.length) {
      document.addEventListener("click", (e) => {
        if (!dropdowns.some(dd => dd.contains(e.target))) closeAllDropdowns();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAllDropdowns();
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

  /* Is this browser the owner's?
   *
   * The neon palette is the owner's own control, not a user-facing setting: subscribers
   * choose only dark or light. This is a presentation decision, not a security boundary
   * — a determined person can set the attribute by hand in dev tools, and that is fine,
   * because all it does is change colours. Anything that actually matters is enforced by
   * row-level security in the database, never here.
   *
   * billing.js already resolves ownership from the signed-in account, with the Gmail
   * dot/+tag normalisation. Reusing it keeps one definition of "owner" rather than a
   * second one that could drift. The cached flag is written by the gate once the user is
   * known, because this runs on every page including ones that never resolve a session. */
  function isOwnerBrowser() {
    try {
      if (window.AQBilling && window.AQ_CURRENT_USER) {
        return !!window.AQBilling.isOwner(window.AQ_CURRENT_USER);
      }
      return localStorage.getItem("aq-is-owner") === "1";
    } catch (err) { return false; }
  }

  /* The site-wide palette, published by the owner and read by everyone.
   *
   * The owner's choice is a decision about how the product looks to all subscribers, so
   * it is stored server-side rather than in the owner's browser. Visitors pick it up on
   * their next page load. The local copy is a cache so the palette is correct on first
   * paint — waiting for a network round trip before styling would flash the wrong colours
   * on every page. */
  async function publishPalette(palette) {
    try {
      const S = window.AQStore;
      if (!S || S.mode !== "supabase" || !S.adapter) return false;
      await S.adapter.put("site_settings", { key: "palette", value: { palette: palette } });
      return true;
    } catch (e) { return false; }
  }

  async function loadSitePalette() {
    try {
      const S = window.AQStore;
      if (!S || S.mode !== "supabase" || !S.adapter) return;
      const rows = await S.adapter.list("site_settings");
      if (!Array.isArray(rows)) return;
      const row = rows.filter(r => r && r.key === "palette")[0];
      /* No published row means the owner has never chosen, and the answer to that is
         the shipped default — neon — not whatever happens to be cached. Returning early
         here let a stale "default" written by an earlier bug survive indefinitely: the
         boot snippet read it, nothing ever corrected it, and the device stayed blue.
         The published row is the only thing allowed to say "default". */
      /* Two palettes: default and neon. Anything unrecognised becomes neon, which is the
         shipped default — the same reasoning as before, and the reason a stale "default"
         written by an old bug could not survive: only a published row may say it.
         This also self-heals every device left holding the removed third palette: the row
         may still publish it, but it is no longer recognised, so it resolves to neon. */
      const raw = row && row.value && row.value.palette;
      const want = raw === "default" ? raw : "neon";
      try { localStorage.setItem("aq-palette", want); } catch (err) {}
      const html = document.documentElement;
      /* Neon may not sit over the light theme: it is a near-black palette whose
         foregrounds were measured against black, and on white they are unreadable. */
      if (want !== "default" && html.getAttribute("data-theme") === "dark") {
        html.setAttribute("data-palette", want);
      } else {
        html.removeAttribute("data-palette");
      }
    } catch (e) { /* offline: the cached palette from boot stands */ }
  }
  window.AQLoadSitePalette = loadSitePalette;

  /* Set the palette outright rather than cycling.
   *
   * Each word names its palette, and typing the one already showing turns it OFF back to
   * default. The word is always either "this" or "not this", never "the other one". That
   * mattered when a third palette existed and is kept now that it does not, because it is
   * the behaviour that stays correct if another is ever added.
   *
   * Silently ignored for anyone but the owner: no message, because a subscriber typing the
   * word by accident should not learn that a hidden switch exists.
   */
  function setPalette(name) {
    if (!isOwnerBrowser()) return;
    const html = document.documentElement;
    const current = html.getAttribute("data-palette") || "default";
    const next = current === name ? "default" : name;

    if (next === "default") html.removeAttribute("data-palette");
    else html.setAttribute("data-palette", next);
    try { localStorage.setItem("aq-palette", next); } catch (err) {}

    /* The 3D scenes pick their colours once, at construction. Tell them the palette moved
       so they can re-tint without a reload — otherwise the page turns and the artwork in
       the middle of it does not, which looks broken rather than partial. */
    try {
      window.dispatchEvent(new CustomEvent("aq:palette", { detail: { palette: next } }));
    } catch (err) {}

    // Publish to every user. Fire and forget: the owner's own view has already changed,
    // and a failed write only means subscribers keep the previous palette until the next
    // successful toggle — never a broken page.
    publishPalette(next);
  }
  function togglePalette() { setPalette("neon"); }

  function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.getAttribute("data-theme") === "dark";
    if (isDark) {
      html.removeAttribute("data-theme");
      try { localStorage.setItem("aq-theme", "light"); } catch (err) {}
    } else {
      html.setAttribute("data-theme", "dark");
      try {
        localStorage.setItem("aq-theme", "dark");
        // Mirrors the header button: returning to dark returns the published palette.
        if (localStorage.getItem("aq-palette") !== "default") {
          html.setAttribute("data-palette", "neon");
        }
      } catch (err) {}
    }
  }

  function initOwnerThemeToggle() {
    // Hidden, owner-only dark-mode switch — no visible UI.
    // Trigger: type the word "dark" anywhere on the page (not while focused in a field).
    /* The buffer is as long as the longest word, not four characters. It was once sliced
       to 4, which is fine for "dark" and "neon" and silently makes any longer word
       unmatchable — a five-letter word could only ever have been seen as its last four. */
    let typed = "";
    document.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-8);
      if (typed.endsWith("dark")) {
        toggleTheme();
        typed = "";
      } else if (typed.endsWith("neon")) {
        setPalette("neon");
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

/* ---------------------------------------------------------------------------
 * PHONE TIP — "the full layout is on a larger screen".
 *
 * A NOTE ON THE WORDING, because the obvious phrasing would cost more than it gains.
 * "Turn on desktop view for the best experience" tells a visitor two things: that the
 * site does not work properly on their phone, and that the fix is their problem. Neither
 * is true — every page here is responsive and has been checked at 375px — and desktop
 * view on a phone renders 15px body text at about 5px, which is worse, not better. A
 * hospital director who reads that on their commute concludes the product is unfinished.
 *
 * So it says what is actually true: the mesh diagrams, the globe and the film are built
 * for a wide screen and are worth coming back to on one. That is an invitation rather
 * than an apology, and it does not ask anyone to fight their browser settings.
 *
 * Shown once per device, dismissible, and never on a page the person is trying to read
 * in a hurry — it waits until they have been on the page for a moment.
 * --------------------------------------------------------------------------- */
(function () {
  "use strict";
  /* sessionStorage, NOT localStorage, and the difference is the whole behaviour.
     localStorage remembered the dismissal for ever, so a visitor saw the tip once in
     their life and never again — including on the visit three weeks later when they had
     forgotten. sessionStorage lives exactly as long as the browser tab: the tip appears
     once when the site is opened, stays quiet while they move from page to page, and
     comes back the next time they open the site fresh. That is what was asked for, and
     it is also the right shape for a tip — it is advice for a visit, not a setting. */
  var KEY = "aq-phone-tip-visit";

  function isPhone() {
    try {
      return matchMedia("(max-width: 820px)").matches &&
             matchMedia("(pointer: coarse)").matches;
    } catch (e) { return false; }
  }

  function show() {
    if (document.getElementById("aqPhoneTip")) return;
    var el = document.createElement("div");
    el.id = "aqPhoneTip";
    el.className = "aq-tip";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<span class="aq-tip-ic" aria-hidden="true">&#128421;</span>' +
      /* The route is spelled out because advice nobody can act on is just noise —
         most people have never opened that menu and will not go looking for it. Chrome
         is named specifically since it is what almost every Android visitor is holding;
         the same item exists in Safari under "aA", but naming two browsers in one line
         costs more clarity than it buys. */
      '<span class="aq-tip-t"><b>Turn on Desktop view for the best experience.</b> ' +
        'In Chrome, tap the three dots <b>&#8942;</b> and switch on <b>Desktop site</b>. ' +
        'The standards mesh, the globe and the film are built for a wide screen.</span>' +
      '<button type="button" class="aq-tip-x" aria-label="Dismiss">&#10005;</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add("in"); });

    function close() {
      el.classList.remove("in");
      try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
      setTimeout(function () { el.remove(); }, 300);
    }
    el.querySelector(".aq-tip-x").addEventListener("click", close);
    /* Goes away on its own. A notice that has to be dismissed is a notice that gets in
       the way of the thing it was recommending. */
    setTimeout(close, 9000);
  }

  function init() {
    if (!isPhone()) return;
    try { if (sessionStorage.getItem(KEY) === "1") return; } catch (e) {}
    /* Clear the old per-device flag, so anyone who dismissed the previous version is not
       silenced for ever by a key that is no longer read. */
    try { localStorage.removeItem("aq-phone-tip-v1"); } catch (e) {}
    setTimeout(show, 2200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* ============================================================
   STANDARDS SOURCE NOTICE
   A modal shown when a page that presents objective-element content is opened, saying
   plainly that the wording here is ours and not NABH's, and sending the reader to NABH
   for the actual text.

   WHY A MODAL AND NOT JUST THE HEADER LINE.
   The .aq-edition strip at the top of every page already names the source and links to
   NABH. That is the right thing for a visitor skimming the site. It is not enough for the
   pages where somebody is about to READ our wording of an element and could mistake it for
   the standard: on those, the notice has to be acknowledged rather than scrolled past.

   EVERY TIME the standards area is entered, not once per session. A statement about whose
   words the reader is about to read is worth nothing if it appears once and never again.
   What keeps that from being punishing is WHERE it fires: the entry pages only, never the
   639 individual element pages.
   ============================================================ */
(function () {
  "use strict";

  /* WHICH PAGES, AND WHY NOT ALL OF THEM.
     The notice fires on the Standards explorer and the gap-analysis page — the two places
     somebody arrives at from the nav intending to read standards. It deliberately does NOT
     fire on standard.html, the single-element page: those share data-page="standards", and
     showing it on all 639 of them would train people to dismiss it unread, which is the one
     outcome that makes a disclaimer worthless. Entering the area is the moment that counts. */
  var ENTRY = /(^|\/)(standards|know)\.html$/i;

  function isEntryPage() {
    try {
      var p = location.pathname;
      if (ENTRY.test(p)) return true;
      /* a directory URL that resolves to standards.html */
      return /\/standards\/?$/i.test(p);
    } catch (e) { return false; }
  }
  var NABH_URL = "https://nabh.co/programmes/hospitals-accreditation-programme-hco/";


  function show() {
    var last = document.activeElement;

    var back = document.createElement("div");
    back.className = "aq-notice";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.setAttribute("aria-labelledby", "aqNoticeTitle");
    back.innerHTML =
      '<div class="aq-notice-in">' +
        '<button type="button" class="aq-notice-x" aria-label="Close">&times;</button>' +
        '<h2 id="aqNoticeTitle">Before you read these standards</h2>' +
        '<p>The official NABH wording is <b>not reproduced here</b>. Because that text is ' +
          'copyright, what you are about to read is <b>AQcredix&rsquo;s own reworded version</b> ' +
          '&mdash; our description of the system capability each element asks a hospital to have. ' +
          'Wording, emphasis and detail will differ from the official objective elements.</p>' +
        '<p>The <b>element codes</b> and their <b>Core / Commitment / Achievement / Excellence</b> ' +
          'tiers are the real ones, so you can still work element by element with an assessor.</p>' +
        '<p>For the <b>exact wording</b>, use the official NABH 6th Edition &mdash; on the NABH ' +
          'website, or a printed copy bought from them.</p>' +
        '<a class="aq-notice-link" href="' + NABH_URL + '" target="_blank" rel="noopener noreferrer">' +
          'Open the NABH standards page' +
          '<svg viewBox="0 0 16 16" aria-hidden="true" width="13" height="13">' +
          '<path d="M6 2h8v8M14 2 6.5 9.5M11 9v4H3V5h4" fill="none" stroke="currentColor" ' +
          'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
        '<p class="aq-notice-fine">AQcredix is an independent platform. It is not affiliated ' +
          'with, endorsed by, or accredited by NABH. Always verify against the official ' +
          'standard before relying on anything here for an assessment.</p>' +
        '<div class="aq-notice-foot"><button type="button" class="btn btn-primary aq-notice-ok">' +
          'OK, I understand</button></div>' +
      '</div>';

    document.body.appendChild(back);
    document.body.classList.add("aq-notice-open");
    requestAnimationFrame(function () { back.classList.add("in"); });

    var ok = back.querySelector(".aq-notice-ok");
    var x = back.querySelector(".aq-notice-x");
    if (ok) ok.focus();

    function close() {
      back.classList.remove("in");
      document.body.classList.remove("aq-notice-open");
      document.removeEventListener("keydown", onKey, true);
      setTimeout(function () { back.remove(); }, 220);
      try { if (last && last.focus) last.focus(); } catch (e) {}
    }

    /* Focus stays inside while it is open: a dialog you can Tab out of is a dialog a screen
       reader wanders away from, and the notice is the one thing on screen that matters. */
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = back.querySelectorAll("button, a[href]");
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }

    if (ok) ok.addEventListener("click", close);
    if (x) x.addEventListener("click", close);
    /* Clicking the backdrop dismisses it too — but only the backdrop itself, never a click
       that started inside the panel and drifted out while selecting text. */
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });
    document.addEventListener("keydown", onKey, true);
  }

  function init() {
    /* No "already seen" gate. Every arrival at the standards area shows it: this is a
       statement about whose words the reader is about to read, and it is worth nothing if
       it only ever appeared once. Scoping it to the entry pages is what keeps that from
       being punishing. */
    if (!isEntryPage()) return;
    show();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
