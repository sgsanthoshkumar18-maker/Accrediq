/* AQcredix Workspace — the apex (quality) manual.
 *
 * A guided form, not a blank page: nine sections covering what a quality manual actually
 * needs. Committees are pulled in automatically from the calendar, because that data
 * already exists and typing it twice is how the manual and the calendar quietly drift
 * apart. Answers are saved as you type; the download is generated from them, so the
 * downloaded manual can never be older than what is on screen.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, DX = window.AQDocx;
  var esc;

  var answers = {};
  var committees = [];

  var SECTIONS = [
    { key: "org", title: "About the organisation",
      fields: [
        ["legal_name", "Legal name of the hospital", "text"],
        ["services", "Clinical services offered", "textarea"],
        ["not_offered", "Services deliberately not offered", "textarea"],
        ["bed_strength", "Bed strength", "text"],
        ["departments", "Departments / clinical services", "textarea"]
      ] },
    { key: "vision", title: "Vision, mission and quality policy",
      fields: [
        ["vision", "Vision", "textarea"],
        ["mission", "Mission", "textarea"],
        ["quality_policy", "Quality policy — measurable, and the one displayed in the hospital", "textarea"]
      ] },
    { key: "structure", title: "Organisational structure",
      fields: [
        ["reporting", "Reporting structure — who reports to whom", "textarea"],
        ["quality_lead", "Who is accountable for quality, and to whom", "textarea"]
      ] },
    { key: "committees", title: "Committees",
      note: "Pulled automatically from your compliance calendar — add or edit committees " +
            "there and this section updates on its own." },
    { key: "programme", title: "Quality and patient safety programme",
      fields: [
        ["objectives", "Programme objectives", "textarea"],
        ["kpis", "Key indicators tracked, and their targets", "textarea"],
        ["review_cycle", "How often the programme is reviewed, and by whom", "text"]
      ] },
    { key: "system", title: "How the system works",
      fields: [
        ["doc_control", "Document control — how a document is approved and revised", "textarea"],
        ["incident", "Incident reporting — how an incident becomes a finding", "textarea"],
        ["capa", "CAPA — how a finding is tracked to closure", "textarea"],
        ["audit", "Internal audit — frequency and scope", "textarea"],
        ["risk", "Risk management approach", "textarea"]
      ] },
    { key: "coverage", title: "Chapter-by-chapter coverage",
      fields: [
        ["AAC", "AAC — Access, Assessment and Continuity of Care", "textarea"],
        ["COP", "COP — Care of Patients", "textarea"],
        ["MOM", "MOM — Management of Medication", "textarea"],
        ["PRE", "PRE — Patient Rights and Education", "textarea"],
        ["IPC", "IPC — Infection Prevention and Control", "textarea"],
        ["PSQ", "PSQ — Patient Safety and Quality Improvement", "textarea"],
        ["ROM", "ROM — Responsibility of Management", "textarea"],
        ["FMS", "FMS — Facility Management and Safety", "textarea"],
        ["HRM", "HRM — Human Resource Management", "textarea"],
        ["IMS", "IMS — Information Management System", "textarea"]
      ] },
    { key: "crossref", title: "Cross-reference matrix",
      note: "AQcredix already generates an element-by-department matrix from your standards " +
            "and SOP data — export it from Standards → Departments and attach it as an " +
            "appendix, rather than retyping it here." },
    { key: "review", title: "Review and revision",
      fields: [
        ["review_by", "Who reviews this manual", "text"],
        ["review_freq", "Review frequency", "text"],
        ["approval", "Who approves changes to it", "text"]
      ] }
  ];

  function esc2(s) { return esc(s); }

  async function load() {
    try {
      var rows = await S.adapter.list("apex_manual");
      answers = (rows && rows[0] && rows[0].answers) || {};
    } catch (e) { answers = {}; }
    try {
      committees = (await S.adapter.list("committees")) || [];
    } catch (e) { committees = []; }
  }

  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 900);
  }
  async function save() {
    try {
      await S.adapter.upsert("apex_manual", {
        org_id: (W.user && W.user.org_id) || null,
        answers: answers,
        updated_at: new Date().toISOString()
      });
      var el = document.getElementById("apexSaved");
      if (el) { el.textContent = "Saved"; setTimeout(function () { el.textContent = ""; }, 1500); }
    } catch (e) {}
  }

  function progress() {
    var total = 0, done = 0;
    SECTIONS.forEach(function (s) {
      (s.fields || []).forEach(function (f) {
        total++;
        if (answers[f[0]] && answers[f[0]].trim()) done++;
      });
    });
    return { done: done, total: total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function render() {
    var p = progress();
    document.getElementById("apexProgress").innerHTML =
      "<b>" + p.pct + "% complete</b><span>" + p.done + " of " + p.total + " fields answered</span>" +
      '<div class="ob-track"><i style="width:' + p.pct + '%"></i></div>';

    document.getElementById("apexBody").innerHTML = SECTIONS.map(function (s, i) {
      return '<section class="apex-sec" id="apex-' + s.key + '">' +
        "<h2>" + (i + 1) + ". " + esc2(s.title) + "</h2>" +
        (s.note ? '<p class="apex-note">' + esc2(s.note) + "</p>" : "") +
        (s.key === "committees" ? committeesBlock() : "") +
        (s.fields || []).map(function (f) {
          var val = answers[f[0]] || "";
          return '<div class="apex-f"><label for="a_' + f[0] + '">' + esc2(f[1]) + "</label>" +
            (f[2] === "textarea"
              ? '<textarea id="a_' + f[0] + '" rows="3" data-key="' + f[0] + '">' + esc2(val) + "</textarea>"
              : '<input id="a_' + f[0] + '" data-key="' + f[0] + '" value="' + esc2(val) + '">');
        }).join("") +
        "</section>";
    }).join("");

    document.getElementById("apexJump").innerHTML = SECTIONS.map(function (s, i) {
      return '<a href="#apex-' + s.key + '">' + (i + 1) + ". " + esc2(s.title) + "</a>";
    }).join("");

    document.querySelectorAll("[data-key]").forEach(function (el) {
      el.addEventListener("input", function () {
        answers[el.dataset.key] = el.value;
        scheduleSave();
        var pr = progress();
        var bar = document.querySelector("#apexProgress i");
        var lbl = document.querySelector("#apexProgress b");
        if (bar) bar.style.width = pr.pct + "%";
        if (lbl) lbl.textContent = pr.pct + "% complete";
      });
    });
  }

  function committeesBlock() {
    if (!committees.length) {
      return '<p class="apex-note">No committees entered yet — add them on the ' +
        '<a href="calendar.html">calendar</a> and they will appear here.</p>';
    }
    return '<div class="apex-committees">' + committees.map(function (c) {
      return '<div class="apex-c"><b>' + esc2(c.name) + "</b>" +
        '<span>' + esc2(c.frequency || "") +
          (c.chairperson ? " · Chair: " + esc2(c.chairperson) : "") +
          (c.secretary ? " · Convener: " + esc2(c.secretary) : "") + "</span></div>";
    }).join("") + "</div>";
  }

  /* --------------------------------- download --------------------------------- */

  function fieldValue(key) { return (answers[key] || "").trim() || "— not yet completed"; }

  async function generate() {
    var blocks = [
      { type: "h1", text: (answers.legal_name || "Hospital") + " — Quality (Apex) Manual" },
      { type: "p", text: "Generated by AQcredix on " + new Date().toLocaleDateString() +
        ". This manual is authored and owned by the hospital; AQcredix provides the " +
        "structure and pulls in data already entered elsewhere in the workspace." },
      { type: "space" }
    ];

    SECTIONS.forEach(function (s) {
      blocks.push({ type: "h2", text: s.title });
      if (s.note) blocks.push({ type: "p", text: s.note });

      if (s.key === "committees") {
        if (committees.length) {
          blocks.push({ type: "table", rows: [["Committee", "Frequency / chair / convener"]].concat(
            committees.map(function (c) {
              return [c.name, (c.frequency || "") +
                (c.chairperson ? " · Chair: " + c.chairperson : "") +
                (c.secretary ? " · Convener: " + c.secretary : "")];
            })
          )});
        } else {
          blocks.push({ type: "p", text: "No committees entered yet." });
        }
      } else {
        (s.fields || []).forEach(function (f) {
          blocks.push({ type: "h3", text: f[1] });
          blocks.push({ type: "p", text: fieldValue(f[0]) });
        });
      }
      blocks.push({ type: "space" });
    });

    var name = (answers.legal_name || "Hospital").replace(/[^a-z0-9]+/gi, "_");
    await DX.download("Quality Manual", blocks, name + "_Apex_Quality_Manual.docx");

    try {
      await S.adapter.upsert("apex_manual", {
        org_id: (W.user && W.user.org_id) || null,
        answers: answers,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (e) {}
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("apex"); W.renderModeNotice();

    await load();
    render();

    document.getElementById("apexDownload").addEventListener("click", async function () {
      var btn = this;
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = "Building…";
      try {
        await generate();
        btn.textContent = "Downloaded ✓";
      } catch (e) {
        console.error(e);
        btn.textContent = "Could not build";
      }
      setTimeout(function () { btn.textContent = label; btn.disabled = false; }, 2200);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
