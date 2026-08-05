/* AQcredix — ICD-11 search, browse and ICD-10 -> ICD-11 converter.
 * All calls go through /api/icd, which holds the credentials server-side.
 */
(function () {
  const $ = id => document.getElementById(id);
  if (!$("icdStage")) return;

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  // ICD titles come back with <em class='found'> highlight markup — strip it.
  const clean = s => String(s == null ? "" : s).replace(/<[^>]*>/g, "").trim();
  const idFromUri = u => { const m = String(u || "").match(/\/(\d+)$/); return m ? m[1] : null; };

  async function api(params) {
    const r = await fetch("/api/icd?" + new URLSearchParams(params));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
    return j;
  }

  // ---------- tabs ----------
  document.querySelectorAll(".icd-tab").forEach(t =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".icd-tab").forEach(x => x.classList.toggle("is-on", x === t));
      document.querySelectorAll(".icd-panel").forEach(p =>
        p.style.display = p.dataset.panel === t.dataset.tab ? "block" : "none");
    }));

  // ---------- search ----------
  let searchTimer = null;
  const searchInput = $("icdQ"), searchOut = $("icdResults");

  function runSearch() {
    const q = searchInput.value.trim();
    if (q.length < 2) { searchOut.innerHTML = `<p class="icd-hint">Type at least two characters.</p>`; return; }
    searchOut.innerHTML = `<p class="icd-hint">Searching ICD-11…</p>`;
    api({ action: "search", q })
      .then(j => {
        const items = j.destinationEntities || [];
        if (!items.length) { searchOut.innerHTML = `<p class="icd-hint">No ICD-11 entity matched "${esc(q)}".</p>`; return; }
        searchOut.innerHTML = items.slice(0, 25).map(it => {
          const eid = idFromUri(it.id);
          return `<button type="button" class="icd-res" data-id="${esc(eid)}">
            <span class="icd-code">${esc(it.theCode || "—")}</span>
            <span class="icd-res-main">
              <b>${esc(clean(it.title))}</b>
              ${it.chapter ? `<em>Chapter ${esc(it.chapter)}</em>` : ""}
            </span>
          </button>`;
        }).join("");
        searchOut.querySelectorAll(".icd-res").forEach(b =>
          b.addEventListener("click", () => openEntity(b.dataset.id)));
      })
      .catch(e => { searchOut.innerHTML = `<p class="icd-err">${esc(e.message)}</p>`; });
  }
  searchInput.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 350); });
  searchInput.addEventListener("keydown", e => { if (e.key === "Enter") { clearTimeout(searchTimer); runSearch(); } });
  $("icdSearchBtn").addEventListener("click", () => { clearTimeout(searchTimer); runSearch(); });
  document.querySelectorAll(".icd-chip").forEach(b =>
    b.addEventListener("click", () => { searchInput.value = b.textContent.trim(); runSearch(); }));

  // ---------- entity detail ----------
  function openEntity(eid) {
    if (!eid) return;
    const box = $("icdDetail");
    box.style.display = "block";
    box.innerHTML = `<p class="icd-hint">Loading entity…</p>`;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
    api({ action: "entity", id: eid })
      .then(j => {
        const title = clean(j.title && j.title["@value"]);
        const def = clean(j.definition && j.definition["@value"]);
        const code = j.code || "—";
        const list = (arr, label) => {
          const v = (arr || []).map(x => clean(x.label && x.label["@value"])).filter(Boolean);
          return v.length ? `<div class="icd-block"><h4>${label}</h4><ul>${v.slice(0,12).map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>` : "";
        };
        const kids = (j.child || []).map(idFromUri).filter(Boolean);
        box.innerHTML = `
          <div class="icd-detail-head">
            <span class="icd-code big">${esc(code)}</span>
            <button type="button" class="icd-copy" data-copy="${esc(code)}">Copy code</button>
          </div>
          <h3>${esc(title)}</h3>
          ${def ? `<p class="icd-def">${esc(def)}</p>` : `<p class="icd-hint">WHO publishes no definition text for this entity.</p>`}
          ${list(j.inclusion, "Inclusions")}
          ${list(j.exclusion, "Exclusions")}
          ${list(j.indexTerm, "Index terms")}
          ${kids.length ? `<div class="icd-block"><h4>Narrower categories (${kids.length})</h4>
            <div class="icd-kids">${kids.slice(0,20).map(k=>`<button type="button" class="icd-kid" data-id="${esc(k)}">Open ${esc(k)}</button>`).join("")}</div></div>` : ""}
          <p class="icd-src">Source: WHO ICD-11 (${esc(j.releaseId || "2024-01")}) · id.who.int</p>`;
        box.querySelectorAll(".icd-kid").forEach(b => b.addEventListener("click", () => openEntity(b.dataset.id)));
        wireCopy(box);
      })
      .catch(e => { box.innerHTML = `<p class="icd-err">${esc(e.message)}</p>`; });
  }

  function wireCopy(scope) {
    scope.querySelectorAll(".icd-copy").forEach(b =>
      b.addEventListener("click", () => {
        const txt = b.dataset.copy;
        const done = () => { const o = b.textContent; b.textContent = "Copied ✓"; setTimeout(() => b.textContent = o, 1400); };
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done).catch(done);
        else done();
      }));
  }

  // ---------- ICD-10 -> ICD-11 converter ----------
  $("icdConvBtn").addEventListener("click", convert);
  $("icdCode").addEventListener("keydown", e => { if (e.key === "Enter") convert(); });

  function convert() {
    const code = $("icdCode").value.trim().toUpperCase();
    const out = $("icdConvOut");
    if (!code) return;
    out.style.display = "block";
    out.innerHTML = `<p class="icd-hint">Looking up ${esc(code)} in ICD-10…</p>`;

    api({ action: "icd10", code })
      .then(j => {
        const title = clean(j.title && j.title["@value"]);
        if (!title) throw new Error("No title returned for that ICD-10 code.");
        out.innerHTML = `
          <div class="icd-conv-from">
            <span class="icd-tagline">ICD-10</span>
            <span class="icd-code">${esc(code)}</span>
            <b>${esc(title)}</b>
          </div>
          <p class="icd-hint">Finding the closest ICD-11 entities…</p>`;
        // WHO exposes no direct 1:1 mapping endpoint on this API, so we resolve
        // by searching ICD-11 for the ICD-10 title. Candidates are ranked by WHO's
        // own search relevance — this is a guided suggestion, not an official map.
        return api({ action: "search", q: title }).then(s => ({ title, s }));
      })
      .then(({ title, s }) => {
        const items = (s.destinationEntities || []).slice(0, 8);
        const from = out.querySelector(".icd-conv-from").outerHTML;
        out.innerHTML = from + (items.length ? `
          <div class="icd-conv-arrow">↓ closest ICD-11 matches</div>
          ${items.map(it => {
            const eid = idFromUri(it.id);
            return `<button type="button" class="icd-res" data-id="${esc(eid)}">
              <span class="icd-code">${esc(it.theCode || "—")}</span>
              <span class="icd-res-main"><b>${esc(clean(it.title))}</b></span>
            </button>`;
          }).join("")}
          <p class="icd-warn"><b>Please read:</b> WHO's public API does not expose an official ICD-10 to ICD-11 crosswalk. These are ICD-11 entities matched on the ICD-10 term "${esc(title)}", ranked by WHO's own search. Treat them as candidates to verify against the official ICD-11 browser — not as a certified mapping.</p>`
          : `<p class="icd-hint">No ICD-11 candidates found for that term.</p>`);
        out.querySelectorAll(".icd-res").forEach(b => b.addEventListener("click", () => openEntity(b.dataset.id)));
      })
      .catch(e => { out.innerHTML = `<p class="icd-err">${esc(e.message)}</p>`; });
  }

  // ---------- ICD-11 code lookup ----------
  $("icdCode11Btn").addEventListener("click", lookup11);
  $("icdCode11").addEventListener("keydown", e => { if (e.key === "Enter") lookup11(); });
  function lookup11() {
    const code = $("icdCode11").value.trim().toUpperCase();
    const out = $("icdCode11Out");
    if (!code) return;
    out.style.display = "block";
    out.innerHTML = `<p class="icd-hint">Resolving ${esc(code)}…</p>`;
    api({ action: "lookup11", code })
      .then(j => {
        const eid = idFromUri(j.stemId || j.entityId);
        if (!eid) throw new Error("No entity returned for that code.");
        out.innerHTML = `<p class="icd-hint">Found — opening details.</p>`;
        openEntity(eid);
      })
      .catch(e => { out.innerHTML = `<p class="icd-err">${esc(e.message)}</p>`; });
  }
})();
