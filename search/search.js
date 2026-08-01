/* AQcredix — site-wide search.
 * Builds an index in the browser from the real data files already on the site
 * (NABH elements, departments, committees, tools, KPIs) plus a static page list.
 * No server, no external service. Opens with Ctrl/Cmd+K or the header button.
 */
(function () {
  const PAGES = [
    { t: "NABH Standards Explorer", u: "standards.html", d: "All 10 chapters, 100 standards and 639 Objective Elements", k: "standards chapters elements core commitment" },
    { t: "Departments", u: "departments.html", d: "Every department's role, licensing, checklists and matched elements", k: "department role checklist licence" },
    { t: "Quality Dashboard", u: "dashboard.html", d: "Department scorecards, KRAs, KPIs, SOPs and committee membership", k: "dashboard score kra kpi" },
    { t: "KPI Library", u: "tools/kpi-library.html", d: "Quality indicators with formulas and reference targets", k: "kpi indicator formula benchmark target" },
    { t: "Quality Tools", u: "tools/quality-tools.html", d: "RCA, PDCA, FMEA, Fishbone, CAPA, Lean, Six Sigma and more", k: "rca pdca fmea fishbone capa lean six sigma tools" },
    { t: "Code Alerts", u: "tools/code-alerts.html", d: "Code Blue, Red, Orange and more — RACE, PASS, HAZMAT, MSDS", k: "code blue red orange race pass hazmat msds emergency fire" },
    { t: "Committees", u: "tools/committees.html", d: "The 12 mandatory hospital committees and their terms of reference", k: "committee chairperson member secretary" },
    { t: "SOP Generator", u: "sop.html", d: "Generate a NABH-aligned SOP draft and download it as Word", k: "sop generator word docx procedure" },
    { t: "Mock Surveyor", u: "surveyor.html", d: "Sit a realistic NABH-style mock assessment and get scored findings", k: "mock assessment audit surveyor test scenario" },
    { t: "Learn & Test", u: "learn.html", d: "Flashcards and quizzes to turn reading into recall", k: "learn quiz flashcard test revision" },
    { t: "Assessor Videos", u: "videos.html", d: "What assessors check and what they find", k: "video assessor" },
    { t: "About AQcredix", u: "about.html", d: "Why AQcredix exists, who is behind it, and the roadmap", k: "about vision roadmap founder" },
    { t: "Contact", u: "contact.html", d: "Enquiries, corrections and data requests", k: "contact email support" },
    { t: "Privacy Policy", u: "privacy.html", d: "What data AQcredix collects and how it is handled", k: "privacy data cookies gdpr" },
    { t: "Terms of Service", u: "terms.html", d: "Terms governing use of AQcredix", k: "terms legal disclaimer" }
  ];

  let INDEX = null;
  function base() { return document.body.getAttribute("data-base") || ""; }

  function buildIndex() {
    if (INDEX) return INDEX;
    const ix = [];
    const b = base();
    PAGES.forEach(p => ix.push({ type: "Page", title: p.t, sub: p.d, url: b + p.u, hay: (p.t + " " + p.d + " " + p.k).toLowerCase() }));

    if (window.NABH_DATA) {
      const names = { AAC:"Access, Assessment & Continuity", COP:"Care of Patients", MOM:"Management of Medication",
        PRE:"Patient Rights & Education", IPC:"Infection Prevention & Control", PSQ:"Patient Safety & Quality",
        ROM:"Responsibility of Management", FMS:"Facility Management & Safety", HRM:"Human Resource Management",
        IMS:"Information Management System" };
      Object.entries(window.NABH_DATA.chapters).forEach(([code, ch]) => {
        ch.standards.forEach(std => std.elements.forEach(el => {
          const c = `${std.code}.${el.letter}`;
          ix.push({ type: "Element", badge: el.category, sop: el.sop, title: c,
            sub: el.text, url: `${b}standards.html?ch=${code}`,
            hay: (c + " " + el.text + " " + std.text + " " + (names[code] || code)).toLowerCase() });
        }));
      });
    }
    if (window.DEPT_DATA) window.DEPT_DATA.forEach(d => ix.push({
      type: "Department", title: d.name, sub: d.intro || "",
      url: `${b}departments.html?d=${encodeURIComponent(d.id)}`,
      hay: (d.name + " " + (d.intro || "") + " " + (d.chapters || []).join(" ")).toLowerCase() }));
    if (window.COMMITTEE_DATA) window.COMMITTEE_DATA.forEach(c => ix.push({
      type: "Committee", title: c.name, sub: c.purpose,
      url: `${b}tools/committees.html?c=${c.slug}`,
      hay: (c.name + " " + c.short + " " + c.purpose).toLowerCase() }));
    if (window.TOOLS_DATA) window.TOOLS_DATA.forEach(t => ix.push({
      type: "Tool", title: t.name, sub: t.summary,
      url: `${b}tools/quality-tools.html?t=${t.id}`,
      hay: (t.name + " " + t.summary + " " + (t.cat || "")).toLowerCase() }));
    if (window.KPI_NETWORK) window.KPI_NETWORK.forEach(k => ix.push({
      type: "KPI", title: k.name, sub: `${k.dept} · target ${k.target}`,
      url: `${b}tools/kpi-library.html`,
      hay: (k.name + " " + k.dept + " " + k.formula).toLowerCase() }));
    return (INDEX = ix);
  }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

  function run(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    if (!terms.length) return [];
    const weight = { Page: 6, Department: 5, Committee: 4, Tool: 4, KPI: 4, Element: 2 };
    return buildIndex().map(it => {
      let s = 0;
      terms.forEach(t => {
        if (!it.hay.includes(t)) return;
        s += 2;
        if (it.title.toLowerCase().includes(t)) s += 6;      // title hits matter most
        if (it.title.toLowerCase().startsWith(t)) s += 4;
      });
      if (!s) return null;
      return { ...it, score: s + (weight[it.type] || 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
  }

  // ---------- overlay UI ----------
  function open() {
    if (document.getElementById("aqSearchOverlay")) return;
    const el = document.createElement("div");
    el.id = "aqSearchOverlay";
    el.className = "aq-search-overlay";
    el.innerHTML = `
      <div class="aq-search-box" role="dialog" aria-modal="true" aria-label="Search AQcredix">
        <div class="aq-search-input-row">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
          <input type="text" id="aqSearchInput" placeholder="Search standards, departments, committees, tools, KPIs…" autocomplete="off" aria-label="Search query">
          <kbd>Esc</kbd>
        </div>
        <div class="aq-search-results" id="aqSearchResults">
          <p class="aq-search-empty">Type to search across every page and all 639 NABH elements.</p>
        </div>
      </div>`;
    document.body.appendChild(el);
    const input = document.getElementById("aqSearchInput");
    const out = document.getElementById("aqSearchResults");
    let sel = -1, items = [];

    function render(list) {
      items = list; sel = -1;
      if (!list.length) { out.innerHTML = `<p class="aq-search-empty">No matches. Try a different term.</p>`; return; }
      out.innerHTML = list.map((r, i) => `
        <a class="aq-search-item" href="${esc(r.url)}" data-i="${i}">
          <span class="aq-search-type t-${r.type.toLowerCase()}">${esc(r.type)}</span>
          <span class="aq-search-main">
            <b>${esc(r.title)}${r.sop ? ' <em class="aq-sop">✱ SOP</em>' : ""}</b>
            <em>${esc((r.sub || "").slice(0, 120))}${(r.sub || "").length > 120 ? "…" : ""}</em>
          </span>
        </a>`).join("");
    }
    input.addEventListener("input", () => render(run(input.value.trim())));
    input.focus();

    el.addEventListener("keydown", e => {
      if (e.key === "Escape") return close();
      if (!items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sel = e.key === "ArrowDown" ? Math.min(sel + 1, items.length - 1) : Math.max(sel - 1, 0);
        out.querySelectorAll(".aq-search-item").forEach((n, i) => n.classList.toggle("is-sel", i === sel));
        const node = out.querySelector(".is-sel"); if (node) node.scrollIntoView({ block: "nearest" });
      }
      if (e.key === "Enter" && sel >= 0) { e.preventDefault(); location.href = items[sel].url; }
    });
    el.addEventListener("click", e => { if (e.target === el) close(); });
  }
  function close() { const el = document.getElementById("aqSearchOverlay"); if (el) el.remove(); }

  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
  });
  document.addEventListener("click", e => { if (e.target.closest("#aqSearchBtn")) { e.preventDefault(); open(); } });
  window.AQSearch = { open, close };
})();
