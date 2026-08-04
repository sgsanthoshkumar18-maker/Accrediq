/* AQcredix — Know Your Hospital UI (standard-level) */
(function () {
  const $ = id => document.getElementById(id);
  if (!$("kyhInput") || !window.NABH_DATA || !window.KnowEngine) return;

  const NAMES = {
    AAC:"Access, Assessment & Continuity of Care", COP:"Care of Patients",
    MOM:"Management of Medication", PRE:"Patient Rights & Education",
    IPC:"Infection Prevention & Control", PSQ:"Patient Safety & Quality Improvement",
    ROM:"Responsibility of Management", FMS:"Facility Management & Safety",
    HRM:"Human Resource Management", IMS:"Information Management System"
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));

  const chSel = $("kyhChapter"), stdSel = $("kyhStandard");

  chSel.innerHTML = '<option value="">— Select a chapter —</option>' +
    Object.keys(NAMES).map(c => `<option value="${c}">${c} — ${NAMES[c]}</option>`).join("");

  chSel.addEventListener("change", () => {
    const code = chSel.value;
    if (!code) {
      stdSel.innerHTML = '<option value="">— Select a chapter first —</option>';
      stdSel.disabled = true; $("kyhStdText").textContent = ""; return;
    }
    const ch = window.NABH_DATA.chapters[code];
    stdSel.disabled = false;
    stdSel.innerHTML = '<option value="">— Select a standard —</option>' +
      ch.standards.map(s => {
        const short = s.text.length > 82 ? s.text.slice(0, 79) + "…" : s.text;
        return `<option value="${s.code}">${s.code} — ${esc(short)}</option>`;
      }).join("");
    $("kyhStdText").textContent = "";
  });

  stdSel.addEventListener("change", () => {
    const ch = window.NABH_DATA.chapters[chSel.value];
    const std = ch && ch.standards.find(s => s.code === stdSel.value);
    const box = $("kyhStdText");
    if (!std) { box.textContent = ""; return; }
    box.innerHTML = `
      <div class="kyh-stdcard">
        <div class="kyh-stdcode">${esc(std.code)}</div>
        <p class="kyh-stdtext">${esc(std.text)}</p>
        <p class="kyh-stdmeta">${std.elements.length} Objective Element${std.elements.length===1?"":"s"} ·
          ${std.elements.filter(e=>e.category==="CORE").length} Core ·
          ${std.elements.filter(e=>e.sop).length} requiring a written SOP</p>
      </div>`;
  });

  $("kyhRun").addEventListener("click", () => {
    const out = $("kyhResult");
    const text = $("kyhInput").value.trim();
    out.style.display = "block";

    if (!chSel.value || !stdSel.value) {
      out.innerHTML = `<p class="kyh-warn">Please choose a chapter and a standard first.</p>`; return;
    }
    if (text.split(/\s+/).length < 12) {
      out.innerHTML = `<p class="kyh-warn">Please describe your practice in a few full sentences. A brief phrase gives the comparison too little to work with, and will under-report what you actually do.</p>`; return;
    }

    const a = window.KnowEngine.analyseStandard(chSel.value, stdSel.value, text);
    if (!a) { out.innerHTML = `<p class="kyh-warn">Could not load that standard.</p>`; return; }

    const band = a.pct >= 75 ? ["Largely aligned","ok"] : a.pct >= 45 ? ["Partially aligned","warn"] : ["Significant gaps","bad"];
    const EX = window.KnowEngine.EXAMPLES;

    const card = r => {
      const cls = r.status === "addressed" ? "ok" : r.status === "partial" ? "warn" : "bad";
      const label = r.status === "addressed" ? "Appears addressed"
                  : r.status === "partial" ? "Partially addressed" : "Not evident in your description";
      const primary = r.missing[0] || r.obligations[0];
      return `
      <div class="kyh-el kyh-el-${cls}">
        <div class="kyh-el-head">
          <span class="kyh-code">${esc(r.code)}</span>
          <span class="kyh-cat c-${esc(r.category)}">${esc(r.category)}</span>
          ${r.sop ? '<span class="kyh-sop">✱ SOP required</span>' : ""}
          <span class="kyh-status s-${cls}">${label}</span>
        </div>
        <p class="kyh-el-text">${esc(r.text)}</p>

        <div class="kyh-el-body">
          <p class="kyh-el-line"><b>What this is really asking for:</b> ${esc(primary.name)} — ${esc(primary.asks)}.</p>
          ${EX[primary.id] ? `<p class="kyh-el-eg"><b>In everyday terms:</b> ${esc(EX[primary.id])}</p>` : ""}
          ${r.status !== "addressed" ? `
            <p class="kyh-el-do"><b>To close this:</b> ${esc(primary.fix)}</p>
            ${r.missing.length > 1 ? `<p class="kyh-el-also">Also not evident: ${r.missing.slice(1).map(m => esc(m.name.toLowerCase())).join("; ")}.</p>` : ""}
          ` : `<p class="kyh-el-good">Your description shows ${r.obligations.filter(o=>o.met).map(o=>esc(o.name.toLowerCase())).join(" and ")}. Be ready to show the evidence.</p>`}
        </div>
      </div>`;
    };

    out.innerHTML = `
      <div class="kyh-score-card">
        <div class="kyh-score ${band[1]}">${a.pct}<span>%</span></div>
        <div>
          <h3>${band[0]}</h3>
          <p class="kyh-sub">${esc(a.standard.code)} · ${esc(a.chapter)} — assessed across ${a.results.length} Objective Element${a.results.length===1?"":"s"}.</p>
          <div class="kyh-tally">
            <span class="t-met">${a.addressed.length} addressed</span>
            <span class="t-partial">${a.partial.length} partial</span>
            <span class="t-gap">${a.missing.length} not evident</span>
          </div>
        </div>
      </div>
      <div class="kyh-bar"><div class="kyh-bar-fill ${band[1]}" style="width:${a.pct}%"></div></div>

      <div class="kyh-block">
        <h3>Element by element</h3>
        <p class="kyh-sub">Ordered as they appear in the standard. Core elements are assessed at every survey.</p>
        ${a.results.map(card).join("")}
      </div>

      <p class="kyh-note"><b>How this works, and what it cannot do.</b> Each element is classified by the <em>kind</em> of control it demands — a written procedure, a measurement loop, demonstrated competence, physical availability, defined criteria, a contemporaneous record, or an escalation route. Your description is then checked for evidence of that control, not merely for matching words. This means "we do hand hygiene" will not satisfy an element that asks you to <em>monitor</em> hand hygiene. What it cannot do is judge whether your practice is good — only whether you have described the ingredients the element asks for. Use it to structure your own review, then verify against the official standard.</p>`;

    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
