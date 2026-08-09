/* AQcredix Workspace — Readiness tracker.
   The persistent record of where a hospital stands against all 640 objective elements. */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, esc;
  var STATUS = [
    { k: "compliant",  label: "Compliant",   short: "C"  },
    { k: "partial",    label: "Partial",     short: "PC" },
    { k: "nc",         label: "Non-compliant", short: "NC" },
    { k: "na",         label: "Not applicable", short: "NA" },
    { k: "unassessed", label: "Not assessed", short: "—" }
  ];

  var statusMap = {}, filters = { chapter: "", status: "", category: "", dept: "", q: "", sopOnly: false };

  function flat() {
    var D = window.NABH_DATA, out = [];
    Object.keys(D.chapters).forEach(function (ck) {
      var ch = D.chapters[ck];
      ch.standards.forEach(function (st) {
        st.elements.forEach(function (el) {
          out.push({
            code: st.code + "." + el.letter, chapter: ck, chapterName: ch.name,
            standard: st.code, standardText: st.text,
            letter: el.letter, category: el.category, text: el.text, sop: !!el.sop
          });
        });
      });
    });
    return out;
  }
  var ALL = [];

  function visible() {
    return ALL.filter(function (e) {
      var row = statusMap[e.code] || {};
      var s = row.status || "unassessed";
      if (filters.chapter && e.chapter !== filters.chapter) return false;
      if (filters.status && s !== filters.status) return false;
      if (filters.category && e.category !== filters.category) return false;
      if (filters.dept && (row.department || "") !== filters.dept) return false;
      if (filters.sopOnly && !e.sop) return false;
      if (filters.q) {
        var q = filters.q.toLowerCase();
        if (e.text.toLowerCase().indexOf(q) < 0 && e.code.toLowerCase().indexOf(q) < 0 &&
            e.standardText.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  /* ---------------- summary ---------------- */
  function renderSummary() {
    var r = S.readiness(statusMap);
    var host = document.getElementById("wsSummary");

    var ring = (function () {
      var c = 2 * Math.PI * 52;
      var off = c * (1 - r.pct / 100);
      return '<svg viewBox="0 0 120 120" class="ws-ring">' +
        '<circle cx="60" cy="60" r="52" class="ws-ring-bg"/>' +
        '<circle cx="60" cy="60" r="52" class="ws-ring-fg" stroke-dasharray="' + c +
          '" stroke-dashoffset="' + off + '"/>' +
        '<text x="60" y="56" class="ws-ring-n">' + r.pct + "%</text>" +
        '<text x="60" y="76" class="ws-ring-l">ready</text></svg>';
    })();

    host.innerHTML =
      '<div class="ws-summary">' +
        '<div class="ws-sum-ring">' + ring +
          '<p class="ws-sum-note">Weighted score. Core elements count triple, Commitment double, ' +
          "Achievement 1.5×, Excellence single — because a Core gap is not the same as an " +
          "Excellence gap. Not-applicable elements are excluded.</p></div>" +
        '<div class="ws-sum-stats">' +
          '<div class="ws-stat"><span class="n">' + r.assessedPct + '%</span><span class="l">Assessed</span>' +
            '<span class="s">' + r.scored + " of " + r.total + " elements reviewed</span></div>" +
          '<div class="ws-stat ws-stat-ok"><span class="n">' + r.byStatus.compliant + '</span><span class="l">Compliant</span></div>' +
          '<div class="ws-stat ws-stat-warn"><span class="n">' + r.byStatus.partial + '</span><span class="l">Partial</span></div>' +
          '<div class="ws-stat ws-stat-bad"><span class="n">' + r.byStatus.nc + '</span><span class="l">Non-compliant</span></div>' +
          '<div class="ws-stat ws-stat-core"><span class="n">' + r.coreOpen + '</span><span class="l">Core elements open</span>' +
            '<span class="s">These block accreditation</span></div>' +
          '<div class="ws-stat"><span class="n">' + r.sopOpen + '</span><span class="l">SOPs outstanding</span>' +
            '<span class="s">Elements needing a written SOP</span></div>' +
        "</div>" +
      "</div>" +
      '<div class="ws-chapters">' +
        Object.keys(r.byChapter).map(function (ck) {
          var c = r.byChapter[ck];
          return '<button type="button" class="ws-chapter" data-ch="' + esc(ck) + '">' +
            '<div class="ws-ch-top"><span class="ws-ch-code">' + esc(c.code) + "</span>" +
            '<span class="ws-ch-pct">' + c.pct + "%</span></div>" +
            '<div class="ws-ch-name">' + esc(c.name) + "</div>" +
            '<div class="ws-ch-bar"><i style="width:' + c.pct + '%"></i></div>' +
            '<div class="ws-ch-sub">' + c.assessed + " of " + c.total + " assessed</div></button>";
        }).join("") +
      "</div>";

    host.querySelectorAll(".ws-chapter").forEach(function (b) {
      b.addEventListener("click", function () {
        filters.chapter = filters.chapter === b.getAttribute("data-ch") ? "" : b.getAttribute("data-ch");
        document.getElementById("fChapter").value = filters.chapter;
        renderList(); renderSummary();
      });
    });
  }

  /* ---------------- filters ---------------- */
  function renderFilters() {
    var D = window.NABH_DATA;
    var host = document.getElementById("wsFilters");
    host.innerHTML =
      '<div class="ws-filters">' +
        '<input type="search" id="fQ" placeholder="Search elements…">' +
        '<select id="fChapter"><option value="">All chapters</option>' +
          Object.keys(D.chapters).map(function (k) {
            return '<option value="' + esc(k) + '">' + esc(D.chapters[k].code) + " — " + esc(D.chapters[k].name) + "</option>";
          }).join("") + "</select>" +
        '<select id="fStatus"><option value="">Any status</option>' +
          STATUS.map(function (s) { return '<option value="' + s.k + '">' + s.label + "</option>"; }).join("") + "</select>" +
        '<select id="fCategory"><option value="">Any category</option>' +
          ["CORE", "Commitment", "Achievement", "Excellence"].map(function (c) {
            return '<option value="' + c + '">' + c + "</option>"; }).join("") + "</select>" +
        '<select id="fDept"><option value="">Any department</option>' +
          W.DEPARTMENTS.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + "</option>"; }).join("") + "</select>" +
        '<label class="ws-check"><input type="checkbox" id="fSop"> SOP required only</label>' +
        '<button type="button" class="btn" id="fReset">Reset</button>' +
      "</div>";

    function bind(id, key, isCheck) {
      var el = document.getElementById(id);
      el.addEventListener(isCheck ? "change" : "input", function () {
        filters[key] = isCheck ? el.checked : el.value;
        renderList();
      });
    }
    bind("fQ", "q"); bind("fChapter", "chapter"); bind("fStatus", "status");
    bind("fCategory", "category"); bind("fDept", "dept"); bind("fSop", "sopOnly", true);
    document.getElementById("fReset").addEventListener("click", function () {
      filters = { chapter: "", status: "", category: "", dept: "", q: "", sopOnly: false };
      ["fQ", "fChapter", "fStatus", "fCategory", "fDept"].forEach(function (i) { document.getElementById(i).value = ""; });
      document.getElementById("fSop").checked = false;
      renderList(); renderSummary();
    });
  }

  /* ---------------- element list ---------------- */
  function renderList() {
    var host = document.getElementById("wsList");
    var rows = visible();
    var readOnly = !W.canEdit();

    document.getElementById("wsCount").textContent =
      rows.length + " of " + ALL.length + " elements";

    if (!rows.length) {
      host.innerHTML = '<p class="ws-empty">No elements match these filters.</p>';
      return;
    }

    // Grouped by standard so the context of each element is visible.
    var groups = {}, order = [];
    rows.forEach(function (e) {
      if (!groups[e.standard]) { groups[e.standard] = []; order.push(e.standard); }
      groups[e.standard].push(e);
    });

    host.innerHTML = order.map(function (sc) {
      var els = groups[sc];
      return '<div class="ws-std"><div class="ws-std-h"><span class="ws-std-code">' + esc(sc) +
        "</span><span>" + esc(els[0].standardText) + "</span></div>" +
        els.map(function (e) {
          var row = statusMap[e.code] || {};
          var st = row.status || "unassessed";
          return '<div class="ws-el" data-code="' + esc(e.code) + '">' +
            '<div class="ws-el-main">' +
              '<div class="ws-el-head">' +
                '<span class="ws-el-code">' + esc(e.code) + "</span>" +
                '<span class="cat-pill cat-' + esc(e.category) + '">' + esc(e.category) + "</span>" +
                (e.sop ? '<span class="ws-sop">SOP required</span>' : "") +
              "</div>" +
              '<p class="ws-el-text">' + esc(e.text) + "</p>" +
              '<div class="ws-el-meta">' +
                '<input class="ws-in ws-ev" placeholder="Evidence / reference" value="' + esc(row.evidence || "") + '"' + (readOnly ? " disabled" : "") + ">" +
                '<input class="ws-in ws-owner" placeholder="Owner" value="' + esc(row.owner || "") + '"' + (readOnly ? " disabled" : "") + ">" +
                '<select class="ws-in ws-dept"' + (readOnly ? " disabled" : "") + '><option value="">Department…</option>' +
                  W.DEPARTMENTS.map(function (d) {
                    return '<option value="' + esc(d) + '"' + (row.department === d ? " selected" : "") + ">" + esc(d) + "</option>";
                  }).join("") + "</select>" +
                '<input class="ws-in ws-due" type="date" value="' + esc(row.due_date || "") + '"' + (readOnly ? " disabled" : "") + ">" +
              "</div>" +
            "</div>" +
            '<div class="ws-el-status">' +
              STATUS.map(function (s) {
                return '<button type="button" class="ws-sbtn s-' + s.k + (st === s.k ? " on" : "") +
                  '" data-s="' + s.k + '" title="' + s.label + '"' + (readOnly ? " disabled" : "") + ">" +
                  s.short + "</button>";
              }).join("") +
            "</div></div>";
        }).join("") + "</div>";
    }).join("");

    if (readOnly) return;

    host.querySelectorAll(".ws-el").forEach(function (el) {
      var code = el.getAttribute("data-code");
      el.querySelectorAll(".ws-sbtn").forEach(function (b) {
        b.addEventListener("click", async function () {
          var s = b.getAttribute("data-s");
          el.querySelectorAll(".ws-sbtn").forEach(function (x) { x.classList.remove("on"); });
          b.classList.add("on");
          statusMap[code] = statusMap[code] || { id: code };
          statusMap[code].status = s;
          await S.setElement(code, { status: s });
          /* One gap analysis means a session of assessment work, not a single element.
             Scoring fires on every button press — hundreds in one sitting — so this is
             stamped with the day and the profile counts distinct days. Counting raw
             presses would show "247 gap analyses" after one afternoon, which nobody
             would believe or find useful. */
          if (window.AQActivity) {
            window.AQActivity.record("gap_saved", {
              day: new Date().toISOString().slice(0, 10), element: code
            });
          }
          renderSummary();
        });
      });
      function save(sel, field) {
        var i = el.querySelector(sel);
        if (!i) return;
        i.addEventListener("change", async function () {
          statusMap[code] = statusMap[code] || { id: code };
          statusMap[code][field] = i.value;
          var p = {}; p[field] = i.value;
          await S.setElement(code, p);
          W.toast("Saved");
        });
      }
      save(".ws-ev", "evidence"); save(".ws-owner", "owner");
      save(".ws-dept", "department"); save(".ws-due", "due_date");
    });
  }

  /* ---------------- bulk actions + export ---------------- */
  function renderActions() {
    var host = document.getElementById("wsActions");
    host.innerHTML =
      '<button type="button" class="btn" id="wsExport">Export data (JSON)</button>' +
      '<button type="button" class="btn" id="wsImportBtn">Import</button>' +
      '<input type="file" id="wsImport" accept="application/json" hidden>' +
      '<button type="button" class="btn btn-accent" id="wsReport">Download readiness report (.docx)</button>';

    document.getElementById("wsExport").addEventListener("click", async function () {
      var data = await S.exportAll();
      var b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "aqcredix-workspace-" + W.today() + ".json";
      a.click(); URL.revokeObjectURL(a.href);
    });
    document.getElementById("wsImportBtn").addEventListener("click", function () {
      document.getElementById("wsImport").click();
    });
    document.getElementById("wsImport").addEventListener("change", async function (e) {
      var f = e.target.files[0]; if (!f) return;
      try {
        var data = JSON.parse(await f.text());
        await S.importAll(data);
        W.toast("Imported — reloading");
        setTimeout(function () { location.reload(); }, 700);
      } catch (err) { W.toast("That file could not be read", "bad"); }
    });
    document.getElementById("wsReport").addEventListener("click", function () { report(this); });
  }

  async function report(btn) {
    if (typeof JSZip === "undefined" || !window.SopDocx) {
      W.toast("Document builder still loading — try again in a moment", "bad"); return;
    }
    var old = btn.textContent; btn.disabled = true; btn.textContent = "Building…";
    try {
      var r = S.readiness(statusMap);
      var b = [];
      b.push({ type: "title", text: "NABH Accreditation Readiness Report" });
      b.push({ type: "p", text: "Generated " + W.today() + " · AQcredix Workspace" });

      b.push({ type: "h1", text: "1. Overall position" });
      b.push({ type: "table", header: ["Measure", "Value"], rows: [
        ["Weighted readiness", r.pct + "%"],
        ["Elements assessed", r.scored + " of " + r.total + " (" + r.assessedPct + "%)"],
        ["Compliant", String(r.byStatus.compliant)],
        ["Partially compliant", String(r.byStatus.partial)],
        ["Non-compliant", String(r.byStatus.nc)],
        ["Not applicable", String(r.byStatus.na)],
        ["Not yet assessed", String(r.byStatus.unassessed)],
        ["Core elements not compliant", String(r.coreOpen)],
        ["Elements requiring an SOP, not compliant", String(r.sopOpen)]
      ]});

      b.push({ type: "h1", text: "2. Chapter breakdown" });
      b.push({ type: "table", header: ["Chapter", "Readiness", "Assessed"],
        rows: Object.keys(r.byChapter).map(function (k) {
          var c = r.byChapter[k];
          return [c.code + " — " + c.name, c.pct + "%", c.assessed + " / " + c.total];
        })});

      var gaps = ALL.filter(function (e) {
        var s = (statusMap[e.code] || {}).status;
        return s === "nc" || s === "partial";
      });
      b.push({ type: "h1", text: "3. Open gaps (" + gaps.length + ")" });
      if (gaps.length) {
        b.push({ type: "table", header: ["Code", "Category", "Element", "Status", "Owner", "Due"],
          rows: gaps.map(function (e) {
            var row = statusMap[e.code] || {};
            return [e.code, e.category + (e.sop ? " · SOP" : ""), e.text,
              row.status === "nc" ? "Non-compliant" : "Partial",
              row.owner || "—", row.due_date || "—"];
          })});
      } else {
        b.push({ type: "p", text: "No partial or non-compliant elements recorded." });
      }

      var un = ALL.filter(function (e) { return !(statusMap[e.code] || {}).status || (statusMap[e.code] || {}).status === "unassessed"; });
      b.push({ type: "h1", text: "4. Not yet assessed (" + un.length + ")" });
      b.push({ type: "p", text: un.length
        ? "These elements carry no recorded position and are the immediate priority for internal audit."
        : "Every element has been assessed." });
      if (un.length && un.length <= 250) {
        b.push({ type: "table", header: ["Code", "Category", "Element"],
          rows: un.map(function (e) { return [e.code, e.category, e.text]; })});
      }

      b.push({ type: "p", text: "This report reflects the organisation's own self-assessment recorded in AQcredix. It is a preparation aid and carries no accreditation status. The official NABH standard governs in all cases." });

      await window.SopDocx.download(b, "nabh-readiness-report-" + W.today() + ".docx");
      btn.textContent = "Downloaded ✓";
    } catch (e) {
      console.error(e); btn.textContent = "Couldn't build the report";
    } finally {
      setTimeout(function () { btn.disabled = false; btn.textContent = old; }, 2200);
    }
  }

  /* ---------------- boot ---------------- */
  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    document.getElementById("wsBody").style.display = "";
    W.renderNav("readiness");
    W.renderModeNotice();

    ALL = flat();
    statusMap = await S.elements();
    renderFilters(); renderSummary(); renderList(); renderActions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
