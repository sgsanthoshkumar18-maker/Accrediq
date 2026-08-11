/* AQcredix — standards export workbook.
 *
 * Raw OOXML through JSZip, the same pattern audit/audit-excel.js and sop-docx.js already
 * use. No spreadsheet library is introduced: the no-build-step architecture holds, and
 * JSZip is already a known quantity here.
 *
 * The SOP-required export carries a Departments column filled from AQSopDepts, so a
 * quality manager can hand the sheet to each department head and the accountability is
 * already assigned. That column is the point of the export; without it the sheet is just
 * a list the book already contains.
 */
window.AQStandardsExcel = (function () {
  "use strict";

  var FILLS = [
    { key: "head",  bg: "FF0E2233", fg: "FFFFFFFF", bold: true },   // xf 1
    { key: "band",  bg: "FFE8F4F7", fg: "FF0E2233", bold: true },   // xf 2
    { key: "label", bg: "FFF5F7F8", fg: "FF5A6C7A", bold: true },   // xf 3
    { key: "sop",   bg: "FFFFF3C4", fg: "FF7A5200", bold: true },   // xf 4
    { key: "core",  bg: "FFFFCDD2", fg: "FFB3261E", bold: true }    // xf 5
  ];
  var XF = { plain: 0, head: 1, band: 2, label: 3, sop: 4, core: 5, wrap: 6 };

  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
      // Excel rejects most control characters outright; strip rather than corrupt the file.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }

  function colName(n) {
    var s = "";
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
    return s;
  }

  function cell(col, row, v, style, isNum) {
    var ref = colName(col) + row;
    var s = style ? ' s="' + style + '"' : "";
    if (v === "" || v == null) return '<c r="' + ref + '"' + s + "/>";
    if (isNum) return '<c r="' + ref + '"' + s + "><v>" + Number(v) + "</v></c>";
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlEsc(v) + "</t></is></c>";
  }

  function sheetXml(rows, opts) {
    opts = opts || {};
    var body = rows.map(function (r, i) {
      var rn = i + 1;
      var cells = r.map(function (c, j) {
        if (c && typeof c === "object") return cell(j + 1, rn, c.v, c.s, c.n);
        return cell(j + 1, rn, c, 0, false);
      }).join("");
      return '<row r="' + rn + '">' + cells + "</row>";
    }).join("");

    var cols = "";
    if (opts.widths) {
      cols = "<cols>" + opts.widths.map(function (w, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      }).join("") + "</cols>";
    }
    var pane = opts.freeze
      ? '<sheetView workbookViewId="0"><pane ySplit="' + opts.freeze +
        '" topLeftCell="A' + (opts.freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView>'
      : '<sheetView workbookViewId="0"/>';
    var af = opts.autoFilter ? '<autoFilter ref="' + opts.autoFilter + '"/>' : "";

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      "<sheetViews>" + pane + "</sheetViews>" + cols +
      "<sheetData>" + body + "</sheetData>" + af + "</worksheet>";
  }

  function buildStyles() {
    var fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'];
    var fills = ['<fill><patternFill patternType="none"/></fill>',
                 '<fill><patternFill patternType="gray125"/></fill>'];
    FILLS.forEach(function (f) {
      fonts.push('<font><sz val="11"/><name val="Calibri"/>' + (f.bold ? "<b/>" : "") +
        '<color rgb="' + f.fg + '"/></font>');
      fills.push('<fill><patternFill patternType="solid"><fgColor rgb="' + f.bg +
        '"/><bgColor indexed="64"/></patternFill></fill>');
    });

    var xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>'];
    FILLS.forEach(function (f, i) {
      xfs.push('<xf numFmtId="0" fontId="' + (i + 1) + '" fillId="' + (i + 2) +
        '" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
        '<alignment vertical="top" wrapText="1"/></xf>');
    });
    xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">' +
      '<alignment vertical="top" wrapText="1"/></xf>');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + fonts.length + '">' + fonts.join("") + "</fonts>" +
      '<fills count="' + fills.length + '">' + fills.join("") + "</fills>" +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFD8E0E6"/></left>' +
      '<right style="thin"><color rgb="FFD8E0E6"/></right>' +
      '<top style="thin"><color rgb="FFD8E0E6"/></top>' +
      '<bottom style="thin"><color rgb="FFD8E0E6"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>";
  }

  function H(v) { return { v: v, s: XF.head }; }
  function L(v) { return { v: v, s: XF.label }; }
  function B(v) { return { v: v, s: XF.band }; }
  function W(v) { return { v: v, s: XF.wrap }; }

  /* ------------------------------ selection ------------------------------ */

  /* The rows currently on screen, in screen order. The export must mirror exactly what
     the filter shows — an export that quietly returns more than the page displays is a
     different document from the one the user thinks they are downloading. */
  function collect(chapterCode, filter) {
    var DATA = window.NABH_DATA;
    var chapter = DATA.chapters[chapterCode];
    var out = [];
    chapter.standards.forEach(function (std) {
      std.elements.forEach(function (e) {
        if (filter === "sop" && !e.sop) return;
        if (filter !== "sop" && filter !== "all" && e.category !== filter) return;
        out.push({
          code: std.code + "." + e.letter,
          stdCode: std.code,
          stdText: std.text,
          letter: e.letter,
          category: e.category,
          text: e.text,
          sop: !!e.sop
        });
      });
    });
    return out;
  }

  function filterLabel(filter) {
    return filter === "all" ? "All elements"
      : filter === "sop" ? "SOP required only"
      : filter;
  }

  /* -------------------------------- sheets -------------------------------- */

  function coverSheet(chapterCode, filter, rows) {
    var DATA = window.NABH_DATA;
    var o = DATA.official[chapterCode];
    var name = DATA.chapters[chapterCode].name;
    var sopCount = rows.filter(function (r) { return r.sop; }).length;

    var out = [
      [B("AQcredix \u2014 NABH Standards Export")],
      [],
      [L("Chapter"), chapterCode + " \u2014 " + name],
      [L("Filter applied"), filterLabel(filter)],
      [L("Elements in this export"), { v: rows.length, n: true }],
      [L("Of which SOP required"), { v: sopCount, n: true }],
      [L("Chapter totals"), o.standards + " standards \u00b7 " + o.elements + " elements"],
      [L("Exported"), new Date().toLocaleString()],
      [],
      [W("Elements marked SOP required are asterisked in the NABH book: the hospital must " +
          "hold a written Standard Operating Procedure, documented, implemented and on file " +
          "for the assessor.")],
      []
    ];

    if (filter === "sop") {
      out.push([W("The Departments column names every area the NABH assessor checklist " +
                  "scopes that element to \u2014 the departments that must hold and follow " +
                  "the SOP. Where an element is not scoped to any single area it is marked " +
                  "hospital-wide, which usually means it belongs to governance or a " +
                  "committee rather than a department.")]);
    }
    out.push([]);
    out.push([W("Reference copy generated by AQcredix. The NABH standard itself remains " +
                "the authority for assessment.")]);

    return sheetXml(out, { widths: [30, 86] });
  }

  function elementsSheet(chapterCode, filter, rows) {
    var withDepts = filter === "sop";
    var head = [H("Element"), H("Standard"), H("Standard text"), H("Category"),
                H("Objective Element"), H("SOP required")];
    if (withDepts) head.push(H("Departments that must maintain this SOP"), H("No. of departments"));

    var out = [head];
    rows.forEach(function (r) {
      var line = [
        r.code,
        r.stdCode,
        W(r.stdText),
        { v: r.category, s: r.category === "CORE" ? XF.core : XF.plain },
        W(r.text),
        { v: r.sop ? "Yes" : "\u2014", s: r.sop ? XF.sop : XF.plain }
      ];
      if (withDepts) {
        var d = window.AQSopDepts.forCode(r.code);
        line.push(W(d.length ? d.join(", ") : window.AQSopDepts.UNSCOPED));
        /* Count zero rather than blank for hospital-wide elements: a numeric column that
           is sometimes text cannot be sorted or summed in Excel, and this column exists
           to be sorted on. */
        line.push({ v: d.length, n: true });
      }
      out.push(line);
    });

    var widths = withDepts ? [14, 12, 46, 14, 68, 13, 60, 13] : [14, 12, 46, 14, 74, 13];
    return sheetXml(out, {
      widths: widths, freeze: 1,
      autoFilter: "A1:" + colName(head.length) + out.length
    });
  }

  /* One row per department per element. A pivot of the same facts, so a department head
     can filter to their own name and see only their SOPs — the sheet above is organised
     for the quality manager, this one for the department. */
  function byDepartmentSheet(rows) {
    var out = [[H("Department"), H("Element"), H("Standard"), H("Category"), H("Objective Element")]];
    var pairs = [];
    rows.forEach(function (r) {
      if (!r.sop) return;
      var d = window.AQSopDepts.forCode(r.code);
      if (!d.length) d = [window.AQSopDepts.UNSCOPED];
      d.forEach(function (name) { pairs.push({ dept: name, r: r }); });
    });
    pairs.sort(function (a, b) {
      if (a.dept !== b.dept) return a.dept < b.dept ? -1 : 1;
      return a.r.code < b.r.code ? -1 : 1;
    });
    if (!pairs.length) {
      out.push([W("No SOP-required elements in this selection.")]);
    }
    pairs.forEach(function (p) {
      out.push([W(p.dept), p.r.code, p.r.stdCode,
        { v: p.r.category, s: p.r.category === "CORE" ? XF.core : XF.plain },
        W(p.r.text)]);
    });
    return sheetXml(out, { widths: [46, 14, 12, 14, 74], freeze: 1,
                           autoFilter: "A1:E" + out.length });
  }

  /* How many SOPs each department is carrying — the number a quality manager wants when
     deciding where to start. */
  function summarySheet(rows) {
    var counts = {};
    rows.forEach(function (r) {
      if (!r.sop) return;
      var d = window.AQSopDepts.forCode(r.code);
      if (!d.length) d = [window.AQSopDepts.UNSCOPED];
      d.forEach(function (n) { counts[n] = (counts[n] || 0) + 1; });
    });
    var names = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var out = [[B("SOPs per department in this chapter")],
               [H("Department"), H("SOP-required elements")]];
    if (!names.length) out.push([W("No SOP-required elements in this selection.")]);
    names.forEach(function (n) { out.push([W(n), { v: counts[n], n: true }]); });
    return sheetXml(out, { widths: [56, 24], freeze: 2 });
  }

  /* -------------------------------- package -------------------------------- */

  function sheetNames(filter) {
    return filter === "sop"
      ? ["Cover", "SOP Elements", "By Department", "Department Summary"]
      : ["Cover", "Elements"];
  }

  function build(chapterCode, filter) {
    if (!window.JSZip) {
      throw new Error("The spreadsheet engine is still loading \u2014 wait a moment and try again.");
    }
    var rows = collect(chapterCode, filter);
    var names = sheetNames(filter);
    var zip = new window.JSZip();

    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      names.map(function (s, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join("") +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>");

    zip.folder("_rels").file(".rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>");

    var xl = zip.folder("xl");
    xl.file("workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map(function (s, i) {
        return '<sheet name="' + xmlEsc(s) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join("") + "</sheets></workbook>");

    xl.folder("_rels").file("workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      names.map(function (s, i) {
        return '<Relationship Id="rId' + (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
          (i + 1) + '.xml"/>';
      }).join("") +
      '<Relationship Id="rId' + (names.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>");

    xl.file("styles.xml", buildStyles());
    var ws = xl.folder("worksheets");
    ws.file("sheet1.xml", coverSheet(chapterCode, filter, rows));
    ws.file("sheet2.xml", elementsSheet(chapterCode, filter, rows));
    if (filter === "sop") {
      ws.file("sheet3.xml", byDepartmentSheet(rows));
      ws.file("sheet4.xml", summarySheet(rows));
    }

    return zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      compression: "DEFLATE"
    });
  }

  function filename(chapterCode, filter) {
    var f = filter === "all" ? "All" : filter === "sop" ? "SOP-Required" : filter;
    return "AQcredix_" + chapterCode + "_" + f + "_" +
      new Date().toISOString().slice(0, 10) + ".xlsx";
  }

  function download(chapterCode, filter) {
    return build(chapterCode, filter).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename(chapterCode, filter);
      /* The anchor must be in the document for the click to be honoured on mobile
         Safari and Android Chrome; a detached anchor silently does nothing there. */
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  return { build: build, download: download, filename: filename,
           collect: collect, sheetNames: sheetNames };
})();
