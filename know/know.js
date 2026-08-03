/* AQcredix — Know Your Hospital (NABH gap analysis)
 *
 * HONEST SCOPE: this is concept-coverage matching, not language understanding.
 * It reads what you describe, extracts the meaningful terms, and checks them
 * against the real text of every NABH 6th-edition Objective Element in the
 * area you selected. It can tell you an element looks unaddressed because you
 * never mentioned its subject. It cannot judge whether what you do describe is
 * done WELL. Treat the result as a structured prompt for your own review.
 */
(function () {
  const $ = id => document.getElementById(id);
  if (!$("kyhInput")) return;

  const AREAS = [
    ["", "— Whole hospital (all 10 chapters) —", null],
    ["IPC", "Infection Prevention & Control", "IPC"],
    ["MOM", "Management of Medication", "MOM"],
    ["COP", "Care of Patients", "COP"],
    ["AAC", "Access, Assessment & Continuity of Care", "AAC"],
    ["PRE", "Patient Rights & Education", "PRE"],
    ["PSQ", "Patient Safety & Quality Improvement", "PSQ"],
    ["ROM", "Responsibility of Management", "ROM"],
    ["FMS", "Facility Management & Safety", "FMS"],
    ["HRM", "Human Resource Management", "HRM"],
    ["IMS", "Information Management System", "IMS"]
  ];

  const STOP = new Set(("we have has our a an the is are and or of to in on at for with that this it as by from " +
    "there their they i us do does done also been be being was were will shall can could would should " +
    "all any some every each hospital ward staff patient patients").split(" "));

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function terms(text) {
    return [...new Set(String(text).toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 3 && !STOP.has(w)))];
  }

  /** Meaningful subject words of an element — what it is actually about. */
  function elementTerms(t) {
    return [...new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 4 && !STOP.has(w) &&
        !["organisation","organization","shall","which","where","there","those","these","other","appropriate","documented"].includes(w)))];
  }

  function analyse(userText, chapterCode) {
    const NABH = window.NABH_DATA.chapters;
    const uTerms = terms(userText);
    const codes = chapterCode ? [chapterCode] : Object.keys(NABH);
    const rows = [];

    codes.forEach(code => {
      const ch = NABH[code];
      if (!ch) return;
      ch.standards.forEach(std => std.elements.forEach(el => {
        const eTerms = elementTerms(el.text + " " + std.text);
        if (!eTerms.length) return;
        // how much of the element's subject matter did the user actually mention?
        let hit = 0;
        eTerms.forEach(t => {
          if (uTerms.some(u => u === t || (u.length > 5 && t.startsWith(u.slice(0, 5))) ||
                               (t.length > 5 && u.startsWith(t.slice(0, 5))))) hit++;
        });
        const cover = hit / eTerms.length;
        rows.push({
          chapter: code, code: `${std.code}.${el.letter}`,
          text: el.text, standard: std.text,
          category: el.category, sop: !!el.sop,
          cover, hit,
          // Thresholds tuned against real chapter data so results discriminate:
          // the looser original values pushed almost everything into "partial".
          status: cover >= 0.30 ? "met" : cover >= 0.22 ? "partial" : "gap"
        });
      }));
    });

    // Core elements carry more weight — they are assessed at every survey.
    const w = r => (r.category === "CORE" ? 3 : r.category === "Commitment" ? 2 : 1);
    const total = rows.reduce((s, r) => s + w(r), 0);
    const earned = rows.reduce((s, r) => s + w(r) * (r.status === "met" ? 1 : r.status === "partial" ? 0.5 : 0), 0);
    const pct = total ? Math.round((earned / total) * 100) : 0;

    return {
      pct, rows,
      met: rows.filter(r => r.status === "met"),
      partial: rows.filter(r => r.status === "partial"),
      gaps: rows.filter(r => r.status === "gap"),
      wordCount: (userText.match(/\b[a-z]{2,}\b/gi) || []).length
    };
  }

  function actionFor(r) {
    const t = r.text.toLowerCase();
    if (r.sop) return "Write and implement an SOP for this, and keep it retrievable — this element is asterisked in the book, so documentation is explicitly required.";
    if (/monitor|audit|surveillance|review|indicator/.test(t)) return "Define how you measure this, who reviews it, and what happens when it falls below target.";
    if (/train|orient|aware|educat|competen/.test(t)) return "Train the relevant staff and record a competency check, not just attendance.";
    if (/document|record|register|report/.test(t)) return "Create the record or register, and show it is completed routinely rather than retrospectively.";
    if (/available|access|adequate|provide|maintain|facilit/.test(t)) return "Provide this and prove it stays available — a named owner and a periodic check.";
    if (/identif|assess|screen|evaluat/.test(t)) return "Define the criteria, apply them consistently, and record what you found.";
    return "Describe your current practice for this, write it down, and be ready to show evidence it happens.";
  }

  // ---------- UI ----------
  const sel = $("kyhArea");
  sel.innerHTML = AREAS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

  document.querySelectorAll(".kyh-chip").forEach(b =>
    b.addEventListener("click", () => { $("kyhInput").value = b.dataset.text; $("kyhInput").focus(); }));

  $("kyhRun").addEventListener("click", () => {
    const text = $("kyhInput").value.trim();
    const out = $("kyhResult");
    if (text.split(/\s+/).length < 8) {
      out.innerHTML = `<p class="kyh-warn">Please describe your practice in a few full sentences — a short phrase gives the comparison too little to work with.</p>`;
      out.style.display = "block"; return;
    }
    if (!window.NABH_DATA) {
      out.innerHTML = `<p class="kyh-warn">Standards data failed to load. Refresh and try again.</p>`;
      out.style.display = "block"; return;
    }

    const r = analyse(text, sel.value || null);
    const band = r.pct >= 75 ? ["Largely aligned", "ok"]
              : r.pct >= 45 ? ["Partial alignment", "warn"]
              : ["Significant gaps", "bad"];

    const gapList = r.gaps
      .sort((a, b) => (b.category === "CORE") - (a.category === "CORE") || b.sop - a.sop)
      .slice(0, 25);

    out.innerHTML = `
      <div class="kyh-score-card">
        <div class="kyh-score ${band[1]}">${r.pct}<span>%</span></div>
        <div>
          <h3>${band[0]}</h3>
          <p class="kyh-sub">Compared against ${r.rows.length} Objective Elements${sel.value ? " in " + esc(sel.value) : " across all 10 chapters"}.</p>
          <div class="kyh-tally">
            <span class="t-met">${r.met.length} addressed</span>
            <span class="t-partial">${r.partial.length} partially</span>
            <span class="t-gap">${r.gaps.length} not mentioned</span>
          </div>
        </div>
      </div>

      <div class="kyh-bar"><div class="kyh-bar-fill ${band[1]}" style="width:${r.pct}%"></div></div>

      <div class="kyh-block">
        <h3>To reach full alignment</h3>
        <p class="kyh-sub">The elements below were not evident in what you described. Core elements are listed first — those are assessed at every survey. Elements marked ✱ require a written SOP.</p>
        ${gapList.length ? gapList.map(g => `
          <div class="kyh-gap">
            <div class="kyh-gap-head">
              <span class="kyh-code">${esc(g.code)}</span>
              <span class="kyh-cat c-${g.category}">${esc(g.category)}</span>
              ${g.sop ? '<span class="kyh-sop">✱ SOP required</span>' : ""}
            </div>
            <p class="kyh-gap-text">${esc(g.text)}</p>
            <p class="kyh-gap-do"><b>What to do:</b> ${esc(actionFor(g))}</p>
          </div>`).join("") + (r.gaps.length > gapList.length
            ? `<p class="kyh-sub">…and ${r.gaps.length - gapList.length} more. Narrow to a single chapter above for a focused list.</p>` : "")
          : `<p class="kyh-sub">Nothing flagged as unaddressed in this area.</p>`}
      </div>

      ${r.met.length ? `<div class="kyh-block">
        <h3>Appears addressed (${r.met.length})</h3>
        <div class="kyh-met-list">${r.met.slice(0, 40).map(m =>
          `<span class="kyh-met-chip" title="${esc(m.text)}">${esc(m.code)}</span>`).join("")}</div>
      </div>` : ""}

      <p class="kyh-note"><b>How to read this.</b> This compares the <em>topics</em> you mentioned against what each element covers. It cannot judge whether your practice is good, only whether you appear to have addressed the subject. A low score often just means you described briefly. Use it as a checklist for your own review, not as an assessment result.</p>`;
    out.style.display = "block";
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
