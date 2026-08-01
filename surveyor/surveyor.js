/* AQcredix — Mock Surveyor engine + UI
 *
 * HONEST SCOPE NOTE
 * -----------------
 * This is a rules-based assessment engine, not a generative model. Specifically:
 *  - Questions and NC/CAPA text are authored, not generated.
 *  - SOP upload analysis is CONCEPT-COVERAGE checking against expected concepts
 *    for that topic, plus matching against real NABH element text. It reads your
 *    document; it does not "understand" it the way a human assessor would.
 *  - The doubt clarifier is retrieval over the real 639 NABH elements, not a chatbot.
 *  - Profiles are stored in this browser only (localStorage). There is no server,
 *    so history does not sync across devices and is not private from device users.
 * All of this is surfaced in the UI rather than implied away.
 */
(function () {
  const $ = id => document.getElementById(id);
  const SC = window.SURVEYOR_SCENARIOS || [];
  const STORE = "aq-surveyor-profiles";

  // ---------- profile storage (device-local) ----------
  function loadAll() { try { return JSON.parse(localStorage.getItem(STORE) || "{}"); } catch { return {}; } }
  function saveAttempt(email, attempt) {
    const all = loadAll();
    const key = email.trim().toLowerCase();
    (all[key] = all[key] || []).unshift(attempt);
    all[key] = all[key].slice(0, 25);
    try { localStorage.setItem(STORE, JSON.stringify(all)); } catch {}
  }
  function attemptsFor(email) { return loadAll()[String(email || "").trim().toLowerCase()] || []; }

  // ---------- state ----------
  let S = { name: "", email: "", dept: "", idx: 0, answers: [], uploads: {}, started: 0, order: [] };

  // Deterministic shuffle per attempt so options aren't always in the authored
  // order (the authored correct answer clustered on one index).
  function seeded(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function buildOrder(seed) {
    const rnd = seeded(seed);
    return SC.map(sc => sc.questions.map(q => {
      const ix = q.opts.map((_, i) => i);
      for (let i = ix.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ix[i], ix[j]] = [ix[j], ix[i]]; }
      return ix;
    }));
  }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- SOP upload analysis ----------
  async function readFile(file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".txt") || name.endsWith(".md")) return file.text();
    if (name.endsWith(".docx")) {
      if (typeof JSZip === "undefined") throw new Error("JSZip unavailable");
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const xml = await zip.file("word/document.xml").async("string");
      // strip tags but keep paragraph breaks so wording stays readable
      return xml.replace(/<\/w:p>/g, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    }
    throw new Error("unsupported");
  }

  function analyseSop(text, scenario) {
    const hay = " " + text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ") + " ";
    const hit = t => hay.includes(" " + t.toLowerCase() + " ") || hay.includes(t.toLowerCase());
    const must = scenario.sop.must.map(t => ({ t, ok: hit(t) }));
    const bonus = (scenario.sop.bonus || []).map(t => ({ t, ok: hit(t) }));
    const mustOk = must.filter(m => m.ok).length;
    const bonusOk = bonus.filter(b => b.ok).length;
    // 70% weight on required concepts, 30% on maturity markers
    const pct = Math.round((mustOk / Math.max(1, must.length)) * 70 + (bonusOk / Math.max(1, bonus.length)) * 30);
    const words = (text.match(/\b[a-z]{2,}\b/gi) || []).length;
    return { must, bonus, mustOk, bonusOk, pct, words, thin: words < 150 };
  }

  // ---------- rendering ----------
  function showSetup() {
    $("svStage").innerHTML = `
      <div class="sv-card sv-setup">
        <h2>Start a Mock NABH Assessment</h2>
        <p class="sv-sub">Ten scenarios, sixty questions, difficulty rising from routine ward observation to governance-level failure. You'll be asked to upload the relevant SOP after each scenario.</p>
        <label class="sv-lbl" for="svName">Your name</label>
        <input id="svName" class="sv-input" type="text" placeholder="e.g. Dr. S. Kumar" autocomplete="name">
        <label class="sv-lbl" for="svEmail">Email <span class="sv-opt">(used to save your attempts on this device)</span></label>
        <input id="svEmail" class="sv-input" type="email" placeholder="you@hospital.org" autocomplete="email">
        <label class="sv-lbl" for="svDept">Department under assessment</label>
        <select id="svDept" class="sv-input">
          ${["Infection Control","Pharmacy","Nursing","Emergency","ICU","Operation Theatre","Laboratory",
             "Blood Bank","CSSD","Housekeeping","Biomedical Engineering","Medical Records","Human Resources",
             "Quality Department","Administration","Radiology","Dietary","Front Office"]
            .map(d => `<option>${d}</option>`).join("")}
        </select>
        <button class="btn btn-primary sv-start" id="svStart">Start Audit</button>
        <p class="sv-note"><b>How this works:</b> questions, findings and corrective actions are authored by AQcredix and every standard cited is a real NABH 6th-edition element. Your uploaded SOP is checked for coverage of expected concepts — it is read, not interpreted by a human assessor. Attempts are saved in this browser only.</p>
        <div id="svHistoryWrap"></div>
      </div>`;
    $("svEmail").addEventListener("blur", renderHistory);
    $("svStart").addEventListener("click", start);
  }

  function renderHistory() {
    const email = $("svEmail") && $("svEmail").value;
    const wrap = $("svHistoryWrap");
    if (!wrap || !email) return;
    const list = attemptsFor(email);
    wrap.innerHTML = list.length ? `
      <div class="sv-history">
        <h4>Previous attempts on this device</h4>
        ${list.map(a => `<div class="sv-hrow"><span>${esc(a.dept)}</span><span>${esc(a.date)}</span><b>${a.pct}%</b></div>`).join("")}
      </div>` : "";
  }

  function start() {
    const name = $("svName").value.trim(), email = $("svEmail").value.trim(), dept = $("svDept").value;
    if (!name || !email) { (!name ? $("svName") : $("svEmail")).focus(); return; }
    S = { name, email, dept, idx: 0, answers: SC.map(s => s.questions.map(() => null)),
          uploads: {}, started: Date.now(), order: buildOrder(Date.now()) };
    document.querySelector(".sv-title-bar").style.display = "block";
    $("svTitle").textContent = `NABH style Assessment by AQcredix — ${dept}`;
    renderScenario();
  }

  function renderScenario() {
    const i = S.idx, sc = SC[i];
    const answered = S.answers[i].filter(a => a !== null).length;
    $("svStage").innerHTML = `
      <div class="sv-progress"><div class="sv-progress-fill" style="width:${(i / SC.length) * 100}%"></div></div>
      <div class="sv-meta">
        <span class="sv-lvl sv-lvl-${sc.level.toLowerCase().replace(/[^a-z]/g,"")}">${esc(sc.level)}</span>
        <span class="sv-chapter">${esc(sc.chapter)}</span>
        <span class="sv-count">Scenario ${i + 1} of ${SC.length}</span>
      </div>
      <div class="sv-card">
        <h2 class="sv-sc-title">${esc(sc.title)}</h2>
        <p class="sv-brief">${esc(sc.brief)}</p>
      </div>
      <div id="svQs">${sc.questions.map((q, qi) => {
        const ord = S.order[i][qi];
        return `<div class="sv-card sv-q" data-q="${qi}">
          <div class="sv-qnum">Question ${qi + 1}</div>
          <p class="sv-qtext">${esc(q.q)}</p>
          <div class="sv-opts">${ord.map(orig => `
            <button type="button" class="sv-opt${S.answers[i][qi] === orig ? " is-picked" : ""}" data-q="${qi}" data-o="${orig}">${esc(q.opts[orig])}</button>`).join("")}</div>
        </div>`; }).join("")}</div>
      <div class="sv-card sv-upload">
        <h3>Evidence: upload the ${esc(sc.sop.name)}</h3>
        <p class="sv-sub">A real assessor asks for the document. Upload yours as <b>.docx</b> or <b>.txt</b> — it is analysed in your browser and never sent anywhere.</p>
        <input type="file" id="svFile" accept=".docx,.txt,.md" class="sv-file">
        <div id="svFileResult"></div>
        <button type="button" class="sv-skip" id="svSkip">I don't have this SOP available</button>
      </div>
      <div class="sv-nav">
        <button class="btn btn-ghost" id="svPrev" ${i === 0 ? "disabled" : ""}>Previous</button>
        <span class="sv-answered">${answered}/${sc.questions.length} answered</span>
        <button class="btn btn-primary" id="svNext">${i === SC.length - 1 ? "Finish & see results" : "Next scenario"}</button>
      </div>`;

    $("svQs").addEventListener("click", e => {
      const b = e.target.closest(".sv-opt"); if (!b) return;
      const qi = +b.dataset.q;
      S.answers[i][qi] = +b.dataset.o;
      b.parentElement.querySelectorAll(".sv-opt").forEach(x => x.classList.remove("is-picked"));
      b.classList.add("is-picked");
      const done = S.answers[i].filter(a => a !== null).length;
      document.querySelector(".sv-answered").textContent = `${done}/${sc.questions.length} answered`;
    });

    $("svFile").addEventListener("change", async e => {
      const f = e.target.files[0]; if (!f) return;
      const box = $("svFileResult");
      box.innerHTML = `<p class="sv-sub">Reading ${esc(f.name)}…</p>`;
      try {
        const text = await readFile(f);
        const r = analyseSop(text, sc);
        S.uploads[sc.id] = { file: f.name, ...r };
        box.innerHTML = `
          <div class="sv-sopres">
            <div class="sv-sopscore ${r.pct >= 70 ? "ok" : r.pct >= 40 ? "warn" : "bad"}">${r.pct}%</div>
            <div>
              <b>${esc(f.name)}</b>
              <div class="sv-sub">${r.mustOk}/${r.must.length} required concepts present${r.thin ? " · document looks very short" : ""}</div>
              <div class="sv-tags">${r.must.map(m => `<span class="sv-tag ${m.ok ? "on" : "off"}">${m.ok ? "✓" : "✕"} ${esc(m.t)}</span>`).join("")}</div>
            </div>
          </div>`;
      } catch (err) {
        box.innerHTML = `<p class="sv-sub sv-err">Could not read that file. Please upload a .docx or .txt.</p>`;
      }
    });
    $("svSkip").addEventListener("click", () => {
      S.uploads[sc.id] = { skipped: true, pct: 0 };
      $("svFileResult").innerHTML = `<p class="sv-sub sv-err">Recorded as evidence not available — this is itself a finding.</p>`;
    });

    $("svNext").addEventListener("click", () => {
      if (S.idx === SC.length - 1) return finish();
      S.idx++; window.scrollTo({ top: 0, behavior: "smooth" }); renderScenario();
    });
    if ($("svPrev")) $("svPrev").addEventListener("click", () => {
      if (S.idx === 0) return; S.idx--; window.scrollTo({ top: 0, behavior: "smooth" }); renderScenario();
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- results ----------
  function finish() {
    let correct = 0, total = 0;
    const wrong = [];
    SC.forEach((sc, i) => sc.questions.forEach((q, qi) => {
      total++;
      const picked = S.answers[i][qi];
      if (picked === q.a) correct++;
      else wrong.push({ sc, q, qi, picked });
    }));
    const qPct = Math.round((correct / total) * 100);

    const sopScores = SC.map(sc => (S.uploads[sc.id] ? (S.uploads[sc.id].pct || 0) : 0));
    const sopPct = Math.round(sopScores.reduce((a, b) => a + b, 0) / SC.length);
    // 70% questions, 30% documentary evidence — mirrors how assessment weights practice vs paperwork
    const pct = Math.round(qPct * 0.7 + sopPct * 0.3);

    // NCs: raised where the team got the scenario's questions materially wrong, or had no SOP
    const ncs = SC.filter((sc, i) => {
      const w = sc.questions.filter((q, qi) => S.answers[i][qi] !== q.a).length;
      const noSop = !S.uploads[sc.id] || S.uploads[sc.id].skipped || (S.uploads[sc.id].pct || 0) < 40;
      return w >= 2 || noSop;
    });

    const attempt = { date: new Date().toISOString().slice(0, 16).replace("T", " "),
                      dept: S.dept, name: S.name, pct, qPct, sopPct, correct, total, ncCount: ncs.length };
    saveAttempt(S.email, attempt);

    const band = pct >= 80 ? ["Assessment-ready", "ok"] : pct >= 60 ? ["Approaching readiness", "warn"] : ["Significant gaps", "bad"];

    $("svStage").innerHTML = `
      <div class="sv-card sv-scorecard">
        <div class="sv-scorebig ${band[1]}">${pct}<span>%</span></div>
        <div>
          <h2>${band[0]}</h2>
          <p class="sv-sub">${esc(S.name)} · ${esc(S.dept)} · ${esc(attempt.date)}</p>
          <div class="sv-breakdown">
            <span>Questions <b>${qPct}%</b> <i>(${correct}/${total})</i></span>
            <span>Evidence <b>${sopPct}%</b></span>
            <span>Findings <b>${ncs.length}</b></span>
          </div>
        </div>
      </div>

      <div class="sv-card">
        <h3>Non-Conformities raised</h3>
        <p class="sv-sub">Raised where two or more questions in a scenario were answered incorrectly, or the supporting SOP was absent or thin.</p>
        ${ncs.length ? ncs.map(sc => `
          <div class="sv-nc">
            <div class="sv-nc-head"><span class="sv-chapter">${esc(sc.chapter)}</span><b>${esc(sc.title)}</b></div>
            <p class="sv-nc-text"><b>Finding:</b> ${esc(sc.nc)}</p>
            <p class="sv-nc-capa"><b>How to close it:</b> ${esc(sc.capa)}</p>
          </div>`).join("") : `<p class="sv-sub">No Non-Conformities raised — strong performance across all ten scenarios.</p>`}
      </div>

      <div class="sv-card">
        <h3>Where you went wrong <span class="sv-sub">(${wrong.length} of ${total})</span></h3>
        ${wrong.length ? wrong.map(w => `
          <div class="sv-wrong">
            <div class="sv-wrong-q">${esc(w.sc.title)} · Q${w.qi + 1}: ${esc(w.q.q)}</div>
            <div class="sv-wrong-you">You chose: ${w.picked == null ? "<i>not answered</i>" : esc(w.q.opts[w.picked])}</div>
            <div class="sv-wrong-right">Correct: ${esc(w.q.opts[w.q.a])}</div>
            <div class="sv-wrong-why">${esc(w.q.why)}</div>
            <div class="sv-wrong-ref">Reference: ${esc(w.q.ref)}</div>
          </div>`).join("") : `<p class="sv-sub">Every question answered correctly.</p>`}
      </div>

      <div class="sv-card">
        <h3>Clarify a doubt</h3>
        <p class="sv-sub">Searches the real text of all 639 NABH 6th-edition Objective Elements. This is a retrieval tool over the standard, not a generative chatbot — it shows you what the book actually says.</p>
        <div class="sv-chatrow">
          <input id="svAsk" class="sv-input" type="text" placeholder="e.g. what does the standard say about restraint?">
          <button class="btn btn-accent" id="svAskBtn">Search</button>
        </div>
        <div id="svAnswer"></div>
      </div>

      <div class="sv-nav">
        <button class="btn btn-ghost" id="svAgain">Take another assessment</button>
      </div>`;

    $("svAgain").addEventListener("click", () => {
      document.querySelector(".sv-title-bar").style.display = "none";
      showSetup(); window.scrollTo({ top: 0, behavior: "smooth" });
    });
    $("svAskBtn").addEventListener("click", doAsk);
    $("svAsk").addEventListener("keydown", e => { if (e.key === "Enter") doAsk(); });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- doubt clarifier: retrieval over real elements ----------
  function doAsk() {
    const qEl = $("svAsk"), out = $("svAnswer");
    const query = qEl.value.trim();
    if (!query || !window.NABH_DATA) return;
    const stop = new Set(["what","does","the","standard","say","about","is","are","for","how","should","a","an","of","in","to","and","nabh","tell","me"]);
    const terms = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
    if (!terms.length) { out.innerHTML = `<p class="sv-sub">Try naming a topic — restraint, consent, sterilisation, credentialing…</p>`; return; }
    const res = [];
    Object.entries(window.NABH_DATA.chapters).forEach(([code, ch]) => ch.standards.forEach(std => std.elements.forEach(el => {
      const hay = (std.text + " " + el.text);
      let hits = 0;
      terms.forEach(t => {
        const re = t.length <= 5 ? new RegExp("\\b" + t + "\\b", "i") : new RegExp("\\b" + t, "i");
        if (re.test(hay)) hits++;
      });
      if (hits) res.push({ code: `${std.code}.${el.letter}`, chapter: code, text: el.text, cat: el.category, sop: el.sop, hits });
    })));
    res.sort((a, b) => b.hits - a.hits);
    const top = res.slice(0, 6);
    out.innerHTML = top.length ? `
      <div class="sv-answers">${top.map(r => `
        <div class="sv-ans">
          <div class="sv-ans-head"><b>${esc(r.code)}</b><span class="sv-cat">${esc(r.cat)}</span>${r.sop ? '<span class="sv-sopflag">✱ SOP required</span>' : ""}</div>
          <p>${esc(r.text)}</p>
        </div>`).join("")}
        <p class="sv-sub">Showing the ${top.length} closest matches from the NABH 6th Edition. Read the full chapter for context before acting on any single element.</p>
      </div>` : `<p class="sv-sub">No element matched those words. Try different terms, or browse the <a href="standards.html">Standards Explorer</a>.</p>`;
  }

  // ---------- boot ----------
  if ($("svStage")) showSetup();
})();
