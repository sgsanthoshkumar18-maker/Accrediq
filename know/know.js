/* AQcredix — Gap Analysis UI (two modes) */
(function () {
  const $ = id => document.getElementById(id);
  if (!$("gaStage") || !window.NABH_DATA || !window.KnowEngine) return;

  const NAMES = {
    AAC:"Access, Assessment & Continuity of Care", COP:"Care of Patients",
    MOM:"Management of Medication", PRE:"Patient Rights & Education",
    IPC:"Infection Prevention & Control", PSQ:"Patient Safety & Quality Improvement",
    ROM:"Responsibility of Management", FMS:"Facility Management & Safety",
    HRM:"Human Resource Management", IMS:"Information Management System"
  };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
  const EX = window.KnowEngine.EXAMPLES;

  // ---------- Mode chooser ----------
  function showChooser() {
    $("gaStage").innerHTML = `
      <div class="ga-choose">
        <h2>How would you like to check?</h2>
        <p class="kyh-sub">Both compare what you do against the real NABH 6th Edition Objective Elements. Pick whichever suits what you already know.</p>
        <div class="ga-modes">
          <button type="button" class="ga-mode" data-mode="targeted">
            <span class="ga-mode-n">1</span>
            <h3>I know the standard I'm checking</h3>
            <p>Choose a chapter, then the specific standard. You get element-by-element feedback for exactly that standard.</p>
            <span class="ga-mode-go">Choose a standard →</span>
          </button>
          <button type="button" class="ga-mode" data-mode="freeform">
            <span class="ga-mode-n">2</span>
            <h3>I'll just describe what we do</h3>
            <p>Write your practice in plain words. AQcredix searches all 639 elements and tells you which chapter, standard and elements it falls under.</p>
            <span class="ga-mode-go">Describe our practice →</span>
          </button>
        </div>
      </div>`;
    document.querySelectorAll(".ga-mode").forEach(b =>
      b.addEventListener("click", () => b.dataset.mode === "targeted" ? showTargeted() : showFreeform()));
  }

  const backBtn = `<button type="button" class="ga-back" id="gaBack">← Change method</button>`;
  function wireBack() { const b = $("gaBack"); if (b) b.addEventListener("click", showChooser); }

  const disclaimer = `<p class="kyh-disclaimer"><b>What this is.</b> A structured self-check. It tells you whether your description contains the ingredients an element asks for — it cannot judge whether your practice is done well. Not an assessment, not an audit result, and not a substitute for the official standard.</p>`;

  // ---------- Mode 1: targeted ----------
  function showTargeted() {
    $("gaStage").innerHTML = `
      ${backBtn}
      <div class="kyh-form">
        <label class="kyh-lbl" for="kyhChapter">1 · Which chapter?</label>
        <select id="kyhChapter" class="kyh-select"></select>
        <label class="kyh-lbl" for="kyhStandard">2 · Which standard within it?</label>
        <p class="kyh-hint">Working one standard at a time gives specific, element-by-element feedback.</p>
        <select id="kyhStandard" class="kyh-select" disabled><option value="">— Select a chapter first —</option></select>
        <div id="kyhStdText"></div>
        <label class="kyh-lbl" for="kyhInput">3 · What does your hospital currently do for this standard?</label>
        <p class="kyh-hint">Write full sentences, as if explaining to a colleague. Brief answers under-report what you actually do.</p>
        <textarea id="kyhInput" class="kyh-input" rows="8" placeholder="e.g. We follow a written hand hygiene SOP based on the WHO five moments. Dispensers are at every bedside and housekeeping refills them twice daily and signs a log. The infection control nurse audits compliance monthly and reports to the committee…"></textarea>
        <button type="button" class="btn btn-primary kyh-run" id="kyhRun">Compare with this standard</button>
        ${disclaimer}
      </div>
      <div class="kyh-result" id="kyhResult"></div>`;
    wireBack();

    const chSel = $("kyhChapter"), stdSel = $("kyhStandard");
    chSel.innerHTML = '<option value="">— Select a chapter —</option>' +
      Object.keys(NAMES).map(c => `<option value="${c}">${c} — ${NAMES[c]}</option>`).join("");

    chSel.addEventListener("change", () => {
      const code = chSel.value;
      $("kyhStdText").innerHTML = "";
      if (!code) { stdSel.innerHTML = '<option value="">— Select a chapter first —</option>'; stdSel.disabled = true; return; }
      const ch = window.NABH_DATA.chapters[code];
      stdSel.disabled = false;
      stdSel.innerHTML = '<option value="">— Select a standard —</option>' + ch.standards.map(s => {
        const short = s.text.length > 82 ? s.text.slice(0, 79) + "…" : s.text;
        return `<option value="${s.code}">${s.code} — ${esc(short)}</option>`;
      }).join("");
    });

    stdSel.addEventListener("change", () => {
      const ch = window.NABH_DATA.chapters[chSel.value];
      const std = ch && ch.standards.find(s => s.code === stdSel.value);
      $("kyhStdText").innerHTML = std ? `
        <div class="kyh-stdcard">
          <div class="kyh-stdcode">${esc(std.code)}</div>
          <p class="kyh-stdtext">${esc(std.text)}</p>
          <p class="kyh-stdmeta">${std.elements.length} Objective Element${std.elements.length===1?"":"s"} ·
            ${std.elements.filter(e=>e.category==="CORE").length} Core ·
            ${std.elements.filter(e=>e.sop).length} requiring a written SOP</p>
        </div>` : "";
    });

    $("kyhRun").addEventListener("click", () => {
      const out = $("kyhResult"); out.style.display = "block";
      const text = $("kyhInput").value.trim();
      if (!chSel.value || !stdSel.value) { out.innerHTML = `<p class="kyh-warn">Please choose a chapter and a standard first.</p>`; return; }
      if (text.split(/\s+/).length < 12) { out.innerHTML = `<p class="kyh-warn">Please describe your practice in a few full sentences — a brief phrase gives too little to compare and will under-report what you do.</p>`; return; }
      const a = window.KnowEngine.analyseStandard(chSel.value, stdSel.value, text);
      if (!a) { out.innerHTML = `<p class="kyh-warn">Could not load that standard.</p>`; return; }
      const band = a.pct >= 75 ? ["Largely aligned","ok"] : a.pct >= 45 ? ["Partially aligned","warn"] : ["Significant gaps","bad"];
      out.innerHTML = scoreCard(a.pct, band, `${esc(a.standard.code)} · ${esc(a.chapter)} — ${a.results.length} Objective Element${a.results.length===1?"":"s"}`,
          [[a.addressed.length,"addressed","t-met"],[a.partial.length,"partial","t-partial"],[a.missing.length,"not evident","t-gap"]])
        + `<div class="kyh-block"><h3>Element by element</h3>
             <p class="kyh-sub">In the order they appear in the standard. Core elements are assessed at every survey.</p>
             ${a.results.map(r => elementCard(r, false)).join("")}</div>` + methodNote();
      out.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  }

  // ---------- Mode 2: freeform ----------
  function showFreeform() {
    $("gaStage").innerHTML = `
      ${backBtn}
      <div class="kyh-form">
        <label class="kyh-lbl" for="gaText">Describe what your hospital does</label>
        <p class="kyh-hint">Write freely about any practice — a process, a department, something you have just set up. AQcredix searches all 639 Objective Elements and tells you which chapter, standard and elements it falls under, and how well your description covers them.</p>
        <textarea id="gaText" class="kyh-input" rows="9" placeholder="e.g. We store high alert medications separately with red labels. Look alike sound alike drugs are kept apart. A registered pharmacist verifies every prescription before dispensing, and we record fridge temperatures twice daily for vaccines…"></textarea>
        <div class="kyh-chips">
          <button type="button" class="kyh-chip" data-t="We store high alert medications separately with red labels and keep look alike sound alike drugs apart. A registered pharmacist verifies every prescription before dispensing. We record fridge temperatures twice daily for vaccines and narcotics are kept in a double lock cupboard with a register.">Example: pharmacy practice</button>
          <button type="button" class="kyh-chip" data-t="Every patient arriving in casualty is triaged by a trained nurse within five minutes using a colour coded scale. We document the triage category and the time seen by a doctor. Patients who need admission are shifted after the duty consultant reviews them and we record the handover.">Example: emergency practice</button>
        </div>
        <button type="button" class="btn btn-primary kyh-run" id="gaRun">Find which standards this maps to</button>
        ${disclaimer}
      </div>
      <div class="kyh-result" id="gaResult"></div>`;
    wireBack();
    document.querySelectorAll(".kyh-chip").forEach(b =>
      b.addEventListener("click", () => { $("gaText").value = b.dataset.t; $("gaText").focus(); }));

    $("gaRun").addEventListener("click", () => {
      const out = $("gaResult"); out.style.display = "block";
      const text = $("gaText").value.trim();
      if (text.split(/\s+/).length < 12) { out.innerHTML = `<p class="kyh-warn">Please describe your practice in a few full sentences so there is enough to match against.</p>`; return; }
      const a = window.KnowEngine.analyseFreeform(text, 15);
      if (!a.results.length) {
        out.innerHTML = `<p class="kyh-warn">No Objective Element matched closely enough. Try describing the process in more detail, or use method 1 and pick the standard directly.</p>`; return;
      }
      const chapters = Object.entries(a.byChapter).sort((x,y)=>y[1]-x[1]);
      const avg = Math.round(a.results.reduce((s,r)=>s+r.match,0)/a.results.length);
      const band = avg >= 70 ? ["Strong coverage","ok"] : avg >= 45 ? ["Partial coverage","warn"] : ["Early stage","bad"];

      out.innerHTML = `
        <div class="ga-mapcard">
          <h3>This maps to ${chapters.map(([c,n]) => `<span class="ga-chip">${esc(c)} <em>${n}</em></span>`).join(" ")}</h3>
          <p class="kyh-sub">${a.total} Objective Element${a.total===1?"":"s"} across the standard have some overlap with what you described. The closest ${a.results.length} are shown below, strongest first.</p>
        </div>
        ${scoreCard(avg, band, `Average coverage across the ${a.results.length} closest elements`,
          [[a.addressed.length,"well covered","t-met"],[a.partial.length,"partially","t-partial"]])}
        <div class="kyh-block">
          <h3>Which elements your practice falls under</h3>
          ${a.results.map(r => elementCard(r, true)).join("")}
        </div>` + methodNote();
      out.scrollIntoView({ behavior:"smooth", block:"start" });
    });
  }

  // ---------- shared renderers ----------
  function scoreCard(pct, band, sub, tallies) {
    return `<div class="kyh-score-card">
        <div class="kyh-score ${band[1]}">${pct}<span>%</span></div>
        <div><h3>${band[0]}</h3><p class="kyh-sub">${sub}</p>
          <div class="kyh-tally">${tallies.map(([n,l,c]) => `<span class="${c}">${n} ${l}</span>`).join("")}</div>
        </div>
      </div>
      <div class="kyh-bar"><div class="kyh-bar-fill ${band[1]}" style="width:${pct}%"></div></div>`;
  }

  function elementCard(r, showWhere) {
    const cls = r.status === "addressed" ? "ok" : r.status === "partial" ? "warn" : "bad";
    const label = r.status === "addressed" ? "Appears addressed"
                : r.status === "partial" ? "Partially addressed" : "Not evident";
    const primary = (r.missing && r.missing[0]) || r.obligations[0];
    return `
      <div class="kyh-el kyh-el-${cls}">
        <div class="kyh-el-head">
          <span class="kyh-code">${esc(r.code)}</span>
          <span class="kyh-cat c-${esc(r.category)}">${esc(r.category)}</span>
          ${r.sop ? '<span class="kyh-sop">✱ SOP required</span>' : ""}
          ${showWhere && r.match != null ? `<span class="ga-match">${r.match}% match</span>` : ""}
          <span class="kyh-status s-${cls}">${label}</span>
        </div>
        ${showWhere ? `<p class="ga-where">${esc(r.chapter)} → ${esc(r.standardCode)} — ${esc((r.standardText||"").slice(0,110))}${(r.standardText||"").length>110?"…":""}</p>` : ""}
        <p class="kyh-el-text">${esc(r.text)}</p>
        <div class="kyh-el-body">
          <p class="kyh-el-line"><b>What this is really asking for:</b> ${esc(primary.name)} — ${esc(primary.asks)}.</p>
          ${EX[primary.id] ? `<p class="kyh-el-eg"><b>In everyday terms:</b> ${esc(EX[primary.id])}</p>` : ""}
          ${r.status !== "addressed"
            ? `<p class="kyh-el-do"><b>To close this:</b> ${esc(primary.fix)}</p>
               ${r.missing && r.missing.length > 1 ? `<p class="kyh-el-also">Also not evident: ${r.missing.slice(1).map(m=>esc(m.name.toLowerCase())).join("; ")}.</p>` : ""}`
            : `<p class="kyh-el-good">Your description shows ${r.obligations.filter(o=>o.met).map(o=>esc(o.name.toLowerCase())).join(" and ")}. Be ready to show the evidence.</p>`}
        </div>
      </div>`;
  }

  function methodNote() {
    return `<p class="kyh-note"><b>How this works, and what it cannot do.</b> Each element is classified by the <em>kind</em> of control it demands — a written procedure, a measurement loop, demonstrated competence, physical availability, defined criteria, a contemporaneous record, or an escalation route. Your description is then checked for evidence of that control, not merely for matching words. So "we do hand hygiene" will not satisfy an element asking you to <em>monitor</em> hand hygiene. What it cannot do is judge whether your practice is good — only whether you described the ingredients the element asks for. Use it to structure your own review, then verify against the official standard.</p>`;
  }

  showChooser();
})();
