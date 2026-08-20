/* AQcredix Workspace — the forms, checklists and registers library.
 *
 * Every document a department maintains for NABH, browsable by category then filtered by
 * department, with what the document must contain and a blank template to download.
 *
 * Field lists are written from general clinical documentation practice — not transcribed
 * from any NABH publication — for the reason `nabh-summary.js` exists: reproducing NABH's
 * own text is a copyright and accuracy problem this platform is deliberately avoiding.
 */
(function () {
  "use strict";

  var W = window.AQWorkspace;
  var esc;
  var LIB = window.DOC_LIBRARY || [];

  var cat = "checklist";
  var dept = "";

  var CAT_LABEL = { checklist: "Checklists", form: "Forms & Consents", register: "Registers" };

  function departments() {
    var seen = {};
    LIB.filter(function (i) { return i.category === cat; }).forEach(function (i) {
      seen[i.department] = (seen[i.department] || 0) + 1;
    });
    return Object.keys(seen).sort().map(function (d) { return [d, seen[d]]; });
  }

  function visible() {
    return LIB.filter(function (i) {
      return i.category === cat && (!dept || i.department === dept);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function render() {
    document.getElementById("libCatTabs").innerHTML = Object.keys(CAT_LABEL).map(function (c) {
      var n = LIB.filter(function (i) { return i.category === c; }).length;
      return '<button class="cal-tab' + (c === cat ? " is-on" : "") + '" data-cat="' + c + '">' +
        esc(CAT_LABEL[c]) + ' <span class="lib-n">' + n + "</span></button>";
    }).join("");

    var depts = departments();
    document.getElementById("libDept").innerHTML =
      '<option value="">All departments (' +
        LIB.filter(function (i) { return i.category === cat; }).length + ")</option>" +
      depts.map(function (d) {
        return '<option value="' + esc(d[0]) + '"' + (d[0] === dept ? " selected" : "") +
               ">" + esc(d[0]) + " (" + d[1] + ")</option>";
      }).join("");

    var list = visible();
    var byDept = {};
    list.forEach(function (i) { (byDept[i.department] = byDept[i.department] || []).push(i); });

    document.getElementById("libList").innerHTML = Object.keys(byDept).sort().map(function (d) {
      return '<div class="lib-group"><h3>' + esc(d) + '<span class="lib-n">' +
        byDept[d].length + "</span></h3>" +
        '<div class="lib-grid">' + byDept[d].map(function (i) {
          return '<button class="lib-card' + (i.detailed ? " is-detailed" : "") +
            '" data-id="' + esc(i.id) + '">' +
            "<b>" + esc(i.name) + "</b>" +
            (i.subtype ? '<span class="lib-tag">' + esc(i.subtype) + "</span>" : "") +
            (i.detailed
              ? '<span class="lib-ready">Full detail \\u00b7 downloadable</span>'
              : '<span class="lib-soon">Standard template</span>') +
          "</button>";
        }).join("") + "</div></div>";
    }).join("") || '<div class="cal-empty"><h3>No documents in this view</h3></div>';

    document.getElementById("libDept").onchange = function () { dept = this.value; render(); };
    document.querySelectorAll(".lib-card").forEach(function (b) {
      b.addEventListener("click", function () { openDetail(b.dataset.id); });
    });
  }

  function openDetail(id) {
    var item = LIB.filter(function (i) { return i.id === id; })[0];
    if (!item) return;
    var m = document.getElementById("libModal");
    m.innerHTML = '<div class="ws-modal-in lib-detail">' +
      '<div class="lib-detail-head">' +
        '<span class="eyebrow">' + esc(item.department) + " \\u00b7 " + esc(CAT_LABEL[item.category]) +
          (item.subtype ? " \\u00b7 " + esc(item.subtype) : "") + "</span>" +
        "<h3>" + esc(item.name) + "</h3>" +
      "</div>" +
      (item.why ? '<p class="lib-why">' + esc(item.why) + "</p>" : "") +
      '<div class="lib-sub">What it must contain</div>' +
      '<ol class="lib-fields">' + item.fields.map(function (f) {
        return "<li>" + esc(f) + "</li>";
      }).join("") + "</ol>" +
      (item.analytics
        ? '<div class="lib-analytics"><b>Analytics</b><p>' + esc(item.analytics) + "</p></div>" : "") +
      (!item.detailed
        ? '<p class="lib-note">This uses the standard template for a ' + esc(item.category) +
          " \\u2014 the fields every one of this type needs. A version specific to this " +
          "document is not written yet.</p>" : "") +
      '<div class="ws-modal-actions"><span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Close</button>' +
        '<button class="btn btn-accent" data-act="dl" data-id="' + esc(item.id) + '">Download blank template (Excel)</button>' +
      "</div></div>";
    m.classList.add("open");
  }

  function close() { document.getElementById("libModal").classList.remove("open"); }

  /* ------------------------------ the download ------------------------------
     A blank template as a spreadsheet: a form lays out label:value rows, a register or
     checklist lays out the fields as columns with blank rows to fill in. Uses the same
     raw-OOXML approach as data-export.js — no new dependency, and it is genuinely
     editable rather than a flattened PDF. */

  function xmlEsc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function colName(n) {
    var s = "";
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
    return s;
  }
  function cell(col, row, v, bold) {
    var ref = colName(col) + row;
    if (v === "" || v == null) return '<c r="' + ref + '"/>';
    return '<c r="' + ref + '"' + (bold ? ' s="1"' : "") + ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlEsc(v) + "</t></is></c>";
  }
  function sheetXml(rows) {
    var body = rows.map(function (r, i) {
      return '<row r="' + (i + 1) + '">' + r.map(function (c, j) {
        return (c && typeof c === "object") ? cell(j + 1, i + 1, c.v, c.b) : cell(j + 1, i + 1, c);
      }).join("") + "</row>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<cols><col min="1" max="1" width="34" customWidth="1"/>' +
      '<col min="2" max="8" width="20" customWidth="1"/></cols>' +
      "<sheetData>" + body + "</sheetData></worksheet>";
  }
  function styles() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><sz val="11"/><name val="Calibri"/><b/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>";
  }

  async function download(id) {
    var item = LIB.filter(function (i) { return i.id === id; })[0];
    if (!item || !window.JSZip) return;

    var rows;
    if (item.category === "form") {
      rows = [[{ v: item.name, b: true }], [{ v: item.department, b: true }], []];
      item.fields.forEach(function (f) { rows.push([f, ""]); });
    } else {
      rows = [[{ v: item.name, b: true }], [{ v: item.department, b: true }], [],
        item.fields.map(function (f) { return { v: f, b: true }; })];
      for (var i = 0; i < 30; i++) rows.push(item.fields.map(function () { return ""; }));
    }

    var zip = new window.JSZip();
    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>");
    zip.folder("_rels").file(".rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>");
    var xl = zip.folder("xl");
    var safeName = item.name.replace(/[:\\\/?*\[\]]/g, " ").slice(0, 31);
    xl.file("workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="' + xmlEsc(safeName) + '" sheetId="1" r:id="rId1"/></sheets></workbook>');
    xl.folder("_rels").file("workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>");
    xl.file("styles.xml", styles());
    xl.folder("worksheets").file("sheet1.xml", sheetXml(rows));

    var blob = await zip.generateAsync({
      type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = item.name.replace(/[^a-z0-9]+/gi, "_") + "_template.xlsx";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function wire() {
    document.getElementById("libCatTabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      cat = b.dataset.cat; dept = "";
      render();
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "close") close();
      else if (b.dataset.act === "dl") download(b.dataset.id);
    });
    document.getElementById("libModal").addEventListener("click", function (e) {
      if (e.target.id === "libModal") close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("library"); W.renderModeNotice();
    wire();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
