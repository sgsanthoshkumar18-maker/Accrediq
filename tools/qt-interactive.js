/* AQcredix — Quality Tools interactive add-ons
   1) 5 Why Analyser  — guided root-cause worksheet, exports a real .docx
   2) Internal Audit Checklist — pick a department/area, download its NABH element
      checklist as a .docx, built from area-data.js and verified against nabh-data.js.
   Both reuse window.SopDocx (the site's existing OOXML writer) and JSZip. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  }
  async function save(blocks, filename, btn) {
    var old = btn ? btn.textContent : "";
    try {
      if (btn) { btn.disabled = true; btn.textContent = "Building…"; }
      if (typeof JSZip === "undefined") throw new Error("JSZip not loaded");
      await window.SopDocx.download(blocks, filename);
      if (btn) btn.textContent = "Downloaded ✓";
    } catch (e) {
      if (btn) btn.textContent = "Couldn't build the file";
      console.error(e);
    } finally {
      if (btn) setTimeout(function () { btn.disabled = false; btn.textContent = old; }, 2200);
    }
  }

  /* =====================================================================
     1) FIVE WHY ANALYSER
     ===================================================================== */

  // Prompts shown under each Why to stop the chain collapsing into blame.
  var WHY_HINTS = [
    "Why did this happen? Stay with the immediate, observable cause — what actually occurred, not who was involved.",
    "Why was that possible? Look at the step before: what allowed the first cause to occur?",
    "Why wasn't it caught? Now you are into checks and barriers — what should have detected this and didn't?",
    "Why did that barrier fail? Ask about the process, staffing, training or system behind the missing check.",
    "Why does the system permit it? This should land on a policy, design or resourcing decision — something the organisation controls."
  ];

  function fiveWhyBlocks(d) {
    var b = [];
    b.push({ type: "title", text: "5 Why Root Cause Analysis" });
    b.push({ type: "p", text: "Prepared using AQcredix · " + today() });
    b.push({ type: "h1", text: "1. Incident / problem statement" });
    b.push({ type: "p", text: d.problem });

    b.push({ type: "table", header: ["Field", "Detail"], rows: [
      ["Department / area", d.dept || "—"],
      ["Date of incident", d.date || "—"],
      ["Date of analysis", today()],
      ["Analysis led by", d.owner || "—"],
      ["Team members", d.team || "—"]
    ]});

    b.push({ type: "h1", text: "2. The five whys" });
    var rows = [];
    d.whys.forEach(function (w, i) {
      rows.push(["Why " + (i + 1), w || "—"]);
    });
    b.push({ type: "table", header: ["Level", "Answer"], rows: rows });

    b.push({ type: "h1", text: "3. Root cause identified" });
    b.push({ type: "p", text: d.root || "—" });

    b.push({ type: "h1", text: "4. Corrective and preventive action (CAPA)" });
    b.push({ type: "table", header: ["Action", "Type", "Responsible", "Target date"], rows: [
      [d.corrective || "—", "Corrective", d.capaOwner || "—", d.capaDate || "—"],
      [d.preventive || "—", "Preventive", d.capaOwner || "—", d.capaDate || "—"]
    ]});

    b.push({ type: "h1", text: "5. Verification of effectiveness" });
    b.push({ type: "p", text: d.verify || "—" });
    b.push({ type: "p", text: "Effectiveness must be re-checked after implementation. An action that was completed but did not change the indicator is not a closed CAPA." });

    if (d.elements) {
      b.push({ type: "h1", text: "6. Related NABH elements" });
      b.push({ type: "p", text: d.elements });
    }

    b.push({ type: "h1", text: "7. Sign-off" });
    b.push({ type: "table", header: ["Role", "Name", "Signature", "Date"], rows: [
      ["Analysis lead", d.owner || "", "", ""],
      ["Department head", "", "", ""],
      ["Quality / patient safety officer", "", "", ""]
    ]});

    b.push({ type: "p", text: "Note: this worksheet records the team's own analysis. AQcredix does not generate or validate the causal chain — the reasoning above is the analysis team's, and remains their responsibility." });
    return b;
  }

  function initFiveWhy() {
    var root = document.getElementById("fiveWhy");
    if (!root) return;

    var whyFields = WHY_HINTS.map(function (h, i) {
      return '<div class="fw-why">' +
        '<label for="fwWhy' + i + '"><span class="fw-n">Why ' + (i + 1) + '</span></label>' +
        '<p class="fw-hint">' + esc(h) + "</p>" +
        '<textarea id="fwWhy' + i + '" rows="2" placeholder="Because…"></textarea></div>';
    }).join("");

    root.innerHTML =
      '<div class="fw-grid">' +
        '<div class="fw-field fw-wide"><label for="fwProblem">Describe the error or incident in detail</label>' +
          '<textarea id="fwProblem" rows="4" placeholder="What happened, where, when, and what was the actual or potential harm? Describe the event, not the person."></textarea></div>' +
        '<div class="fw-field"><label for="fwDept">Department / area</label><input id="fwDept" type="text" placeholder="e.g. ICU"></div>' +
        '<div class="fw-field"><label for="fwDate">Date of incident</label><input id="fwDate" type="date"></div>' +
        '<div class="fw-field"><label for="fwOwner">Analysis led by</label><input id="fwOwner" type="text" placeholder="Name and role"></div>' +
        '<div class="fw-field"><label for="fwTeam">Team members</label><input id="fwTeam" type="text" placeholder="Comma separated"></div>' +
      "</div>" +
      '<div class="fw-whys">' + whyFields + "</div>" +
      '<div class="fw-grid">' +
        '<div class="fw-field fw-wide"><label for="fwRoot">Root cause</label>' +
          '<textarea id="fwRoot" rows="2" placeholder="State the system-level cause the chain arrived at."></textarea></div>' +
        '<div class="fw-field fw-wide"><label for="fwCorrective">Corrective action — fixes this occurrence</label>' +
          '<textarea id="fwCorrective" rows="2"></textarea></div>' +
        '<div class="fw-field fw-wide"><label for="fwPreventive">Preventive action — stops recurrence</label>' +
          '<textarea id="fwPreventive" rows="2"></textarea></div>' +
        '<div class="fw-field"><label for="fwCapaOwner">CAPA responsible</label><input id="fwCapaOwner" type="text"></div>' +
        '<div class="fw-field"><label for="fwCapaDate">CAPA target date</label><input id="fwCapaDate" type="date"></div>' +
        '<div class="fw-field fw-wide"><label for="fwVerify">How will effectiveness be verified?</label>' +
          '<textarea id="fwVerify" rows="2" placeholder="Which indicator, measured when, and what result would show this worked?"></textarea></div>' +
        '<div class="fw-field fw-wide"><label for="fwElements">Related NABH elements (optional)</label>' +
          '<input id="fwElements" type="text" placeholder="e.g. PSQ.7.a, MOM.8.b"></div>' +
      "</div>" +
      '<div class="fw-actions">' +
        '<button type="button" class="btn btn-accent" id="fwDownload">Download as Word (.docx)</button>' +
        '<button type="button" class="btn btn-ghost" id="fwClear">Clear</button>' +
        '<span class="fw-msg" id="fwMsg"></span>' +
      "</div>";

    var msg = root.querySelector("#fwMsg");

    function read() {
      var v = function (id) { var el = root.querySelector("#" + id); return el ? el.value.trim() : ""; };
      return {
        problem: v("fwProblem"), dept: v("fwDept"), date: v("fwDate"),
        owner: v("fwOwner"), team: v("fwTeam"),
        whys: WHY_HINTS.map(function (_, i) { return v("fwWhy" + i); }),
        root: v("fwRoot"), corrective: v("fwCorrective"), preventive: v("fwPreventive"),
        capaOwner: v("fwCapaOwner"), capaDate: v("fwCapaDate"),
        verify: v("fwVerify"), elements: v("fwElements")
      };
    }

    root.querySelector("#fwDownload").addEventListener("click", function () {
      var d = read();
      if (!d.problem) {
        msg.textContent = "Describe the incident first — that's the top of the chain.";
        root.querySelector("#fwProblem").focus();
        return;
      }
      var filled = d.whys.filter(Boolean).length;
      msg.textContent = filled < 5
        ? "Exported with " + filled + " of 5 whys filled in — the blanks are left for the team to complete."
        : "";
      save(fiveWhyBlocks(d), "5-why-analysis-" + (slug(d.dept) || "incident") + "-" + today() + ".docx", this);
    });

    root.querySelector("#fwClear").addEventListener("click", function () {
      root.querySelectorAll("input, textarea").forEach(function (el) { el.value = ""; });
      msg.textContent = "";
    });
  }

  /* =====================================================================
     2) INTERNAL AUDIT CHECKLIST
     ===================================================================== */

  function allAreas() {
    var out = [];
    if (!window.AREA_DATA) return out;
    [["clinical", "Clinical area"], ["nonclinical", "Non-clinical area"], ["interviews", "Interview"]]
      .forEach(function (pair) {
        (window.AREA_DATA[pair[0]] || []).forEach(function (a) {
          out.push({ id: a.id, name: a.name, group: pair[1], data: a });
        });
      });
    return out;
  }

  // Index of real 6th-Edition elements, so the checklist carries the book wording.
  function elementIndex() {
    var idx = {};
    if (!window.NABH_DATA) return idx;
    Object.keys(window.NABH_DATA.chapters).forEach(function (ck) {
      window.NABH_DATA.chapters[ck].standards.forEach(function (st) {
        st.elements.forEach(function (el) {
          idx[st.code + "." + el.letter] = {
            code: st.code + "." + el.letter, text: el.text,
            category: el.category, sop: el.sop, standardText: st.text
          };
        });
      });
    });
    return idx;
  }

  function checklistBlocks(area, idx) {
    var b = [];
    b.push({ type: "title", text: "Internal Audit Checklist — " + area.name });
    b.push({ type: "p", text: area.group + " · Generated " + today() + " · AQcredix" });
    b.push({ type: "table", header: ["Field", "Detail"], rows: [
      ["Department / area", area.name],
      ["Auditor", ""], ["Date of audit", ""], ["Auditee / department head", ""]
    ]});

    if (area.data.quick && area.data.quick.length) {
      b.push({ type: "h1", text: "Quick list — what to scan for" });
      area.data.quick.forEach(function (q) { b.push({ type: "bullet", text: q }); });
    }

    b.push({ type: "h1", text: "Element checklist" });
    b.push({ type: "p", text: "C = Compliant · PC = Partially compliant · NC = Non-compliant · NA = Not applicable. Record objective evidence for every finding." });

    var rows = [];
    var groups = (area.data.rows || []).slice();
    (area.data.sub || []).forEach(function (s) {
      groups = groups.concat(s.rows.map(function (r) {
        return { src: s.h + " — " + r.src, codes: r.codes, points: r.points };
      }));
    });

    groups.forEach(function (r) {
      // One row per "what to check" point, with the code alongside.
      (r.points || []).forEach(function (p, i) {
        rows.push([i === 0 ? r.src : "", p, "", ""]);
      });
      // Then the verified book wording, so the auditor reads the actual standard.
      (r.codes || []).forEach(function (c) {
        var el = idx[c];
        if (el) {
          rows.push(["", el.code + " — " + el.text + (el.sop ? " [SOP required]" : "") +
            " (" + el.category + ")", "", ""]);
        }
      });
    });

    b.push({ type: "table", header: ["Code (as printed)", "What to verify", "C / PC / NC / NA", "Evidence & remarks"], rows: rows });

    if (area.data.indicators && area.data.indicators.length) {
      b.push({ type: "h1", text: "Quality indicators to verify" });
      area.data.indicators.forEach(function (i) { b.push({ type: "bullet", text: i }); });
    }

    b.push({ type: "h1", text: "Summary of findings" });
    b.push({ type: "table", header: ["Finding", "Severity", "Element", "CAPA owner", "Target date"], rows: [
      ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]
    ]});

    b.push({ type: "h1", text: "Sign-off" });
    b.push({ type: "table", header: ["Role", "Name", "Signature", "Date"], rows: [
      ["Auditor", "", "", ""], ["Department head", "", "", ""], ["Quality officer", "", "", ""]
    ]});

    b.push({ type: "p", text: "Source: NABH assessor checklist (5th Edition), cross-referenced against the NABH 6th Edition objective elements. The 6th Edition renamed HIC to IPC and CQI to PSQ, and renumbered some elements; where a printed code has no 6th Edition equivalent, only the checklist line is shown. Educational use — verify against the official standard before relying on this for a real assessment." });
    return b;
  }

  function initAuditChecklist() {
    var root = document.getElementById("auditChecklist");
    if (!root) return;

    var areas = allAreas();
    if (!areas.length) {
      root.innerHTML = '<p class="fw-hint">Area data could not be loaded.</p>';
      return;
    }
    var idx = elementIndex();

    var groups = {};
    areas.forEach(function (a) { (groups[a.group] = groups[a.group] || []).push(a); });

    root.innerHTML =
      '<div class="ac-step"><label for="acSelect">Which department or area are you auditing?</label>' +
      '<select id="acSelect"><option value="">— Select a department or area —</option>' +
      Object.keys(groups).map(function (g) {
        return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (a) {
          return '<option value="' + esc(a.id) + '">' + esc(a.name) + "</option>";
        }).join("") + "</optgroup>";
      }).join("") +
      "</select></div>" +
      '<div class="ac-preview" id="acPreview"></div>';

    var sel = root.querySelector("#acSelect");
    var prev = root.querySelector("#acPreview");

    sel.addEventListener("change", function () {
      var a = areas.filter(function (x) { return x.id === sel.value; })[0];
      if (!a) { prev.innerHTML = ""; return; }

      var groupsCount = (a.data.rows || []).length +
        (a.data.sub || []).reduce(function (t, s) { return t + s.rows.length; }, 0);
      var checks = 0, verified = 0;
      var all = (a.data.rows || []).concat((a.data.sub || []).flatMap(function (s) { return s.rows; }));
      all.forEach(function (r) {
        checks += (r.points || []).length;
        (r.codes || []).forEach(function (c) { if (idx[c]) verified++; });
      });

      prev.innerHTML =
        '<div class="ac-card"><h4>' + esc(a.name) + "</h4>" +
        '<p class="fw-hint">' + esc(a.group) + " · " + groupsCount + " element groups · " +
        checks + " verification points · " + verified + " elements with 6th Edition wording included</p>" +
        (a.data.quick && a.data.quick.length
          ? '<div class="chk-grid">' + a.data.quick.slice(0, 8).map(function (q) {
              return "<span>" + esc(q) + "</span>"; }).join("") +
            (a.data.quick.length > 8 ? '<span class="ac-more">+' + (a.data.quick.length - 8) + " more</span>" : "") +
            "</div>"
          : "") +
        '<div class="fw-actions"><button type="button" class="btn btn-accent" id="acDownload">' +
        "Download checklist as Word (.docx)</button></div></div>";

      prev.querySelector("#acDownload").addEventListener("click", function () {
        save(checklistBlocks(a, idx), "internal-audit-checklist-" + slug(a.name) + "-" + today() + ".docx", this);
      });
    });
  }

  function init() { initFiveWhy(); initAuditChecklist(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
