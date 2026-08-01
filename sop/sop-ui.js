/* AQcredix — SOP generator UI controller */
(function () {
  const topicEl = document.getElementById("sopTopic");
  if (!topicEl) return;
  const deptEl = document.getElementById("sopDept");
  const orgEl  = document.getElementById("sopOrg");
  const sizeEl = document.getElementById("sopSize");
  const langEl = document.getElementById("sopLang");
  const genBtn = document.getElementById("sopGenerate");
  const emptyEl = document.getElementById("sopEmpty");
  const docEl  = document.getElementById("sopDoc");

  // Department list, with the NABH chapter each maps to so matches can be weighted.
  const DEPTS = [
    ["", "— Select a department —", ""],
    ["Pharmacy", "Pharmacy", "MOM"],
    ["Nursing", "Nursing", "COP"],
    ["Infection Control", "Infection Control", "IPC"],
    ["Emergency", "Emergency", "COP"],
    ["ICU", "ICU / Critical Care", "COP"],
    ["Operation Theatre", "Operation Theatre", "COP"],
    ["Laboratory", "Laboratory", "AAC"],
    ["Radiology", "Radiology / Imaging", "AAC"],
    ["Blood Bank", "Blood Bank", "COP"],
    ["CSSD", "CSSD", "IPC"],
    ["Housekeeping", "Housekeeping", "IPC"],
    ["Biomedical", "Biomedical Engineering", "FMS"],
    ["Maintenance", "Maintenance / Engineering", "FMS"],
    ["Human Resources", "Human Resources", "HRM"],
    ["Medical Records", "Medical Records (MRD)", "IMS"],
    ["Quality Department", "Quality Department", "PSQ"],
    ["Administration", "Administration", "ROM"],
    ["Dietary", "Dietary", "COP"],
    ["Front Office", "Front Office", "AAC"],
    ["Patient Relations", "Patient Rights & Education", "PRE"]
  ];
  deptEl.innerHTML = DEPTS.map(([v, label]) => `<option value="${v}">${label}</option>`).join("");
  const chapterFor = name => (DEPTS.find(d => d[0] === name) || [])[2] || "";

  // Quick-fill example chips
  document.querySelectorAll(".sop-chip").forEach(btn => {
    btn.addEventListener("click", () => { topicEl.value = btn.textContent.trim(); topicEl.focus(); });
  });

  let current = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  /** Render the generated blocks as an on-screen preview of the Word document. */
  function renderPreview(result) {
    const html = result.blocks.map(b => {
      switch (b.type) {
        case "title":    return `<h2 class="sd-title">${esc(b.text)}</h2>`;
        case "h1":       return `<h3 class="sd-h1">${esc(b.text)}</h3>`;
        case "h2":       return `<h4 class="sd-h2">${esc(b.text)}</h4>`;
        case "p":        return `<p class="sd-p">${esc(b.text)}</p>`;
        case "small":    return `<p class="sd-small">${esc(b.text)}</p>`;
        case "bullet":   return `<li class="sd-li">${esc(b.text)}</li>`;
        case "numbered": return `<li class="sd-li sd-num">${esc(b.text)}</li>`;
        case "table":
          return `<table class="sd-table"><thead><tr>${
            (b.header || []).map(h => `<th>${esc(h)}</th>`).join("")
          }</tr></thead><tbody>${
            (b.rows || []).map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")
          }</tbody></table>`;
        default: return "";
      }
    }).join("");

    docEl.innerHTML = `
      <div class="sop-toolbar">
        <div class="sop-meta">
          <span class="sop-badge">${esc(result.meta.sopCode)}</span>
          <span class="sop-matchcount">${result.meta.matchCount} NABH element${result.meta.matchCount === 1 ? "" : "s"} matched</span>
          ${result.meta.curated ? "" : '<span class="sop-skeleton-flag">skeleton steps — complete before use</span>'}
        </div>
        <button type="button" class="btn btn-accent" id="sopDownload">Download .docx</button>
      </div>
      <div class="sop-page">${html}</div>`;

    emptyEl.style.display = "none";
    docEl.style.display = "block";

    document.getElementById("sopDownload").addEventListener("click", async () => {
      const btn = document.getElementById("sopDownload");
      if (typeof JSZip === "undefined") {
        btn.textContent = "Word export unavailable offline";
        btn.disabled = true;
        return;
      }
      const original = btn.textContent;
      btn.textContent = "Building…"; btn.disabled = true;
      try {
        const safe = result.meta.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
        await window.SopDocx.download(result.blocks, "SOP-" + safe);
        btn.textContent = "Downloaded ✓";
        setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1800);
      } catch (err) {
        btn.textContent = "Export failed — try again";
        btn.disabled = false;
      }
    });
  }

  genBtn.addEventListener("click", () => {
    const topic = topicEl.value.trim();
    if (!topic) { topicEl.focus(); topicEl.classList.add("is-error");
      setTimeout(() => topicEl.classList.remove("is-error"), 1200); return; }
    if (!window.SopEngine || !window.NABH_DATA) {
      docEl.innerHTML = `<p class="sop-error">SOP engine or NABH data failed to load. Refresh the page and try again.</p>`;
      emptyEl.style.display = "none"; docEl.style.display = "block"; return;
    }
    const dept = deptEl.value;
    current = window.SopEngine.generate({
      topic,
      department: dept,
      deptChapter: chapterFor(dept),
      hospitalSize: sizeEl.value,
      language: langEl.value,
      orgName: orgEl.value.trim()
    });
    renderPreview(current);
    docEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Ctrl/Cmd+Enter generates
  topicEl.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") genBtn.click();
  });
})();
