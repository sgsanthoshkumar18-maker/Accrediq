/* AQcredix — Kamishibai audit workbook.
 *
 * Writes the .xlsx as raw OOXML through JSZip rather than pulling in a spreadsheet
 * library. Two reasons: sop-docx.js already establishes that pattern in this codebase and
 * already loads JSZip, so there is nothing new to bundle; and cell fills are the entire
 * point of this export, so hand-writing styles.xml means the colours are guaranteed
 * rather than dependent on whatever a library's community build happens to support.
 *
 * Accessibility: colour never carries the meaning alone. Every coloured cell also holds
 * its letter (C / PC / NC / NA), so the sheet survives greyscale printing and colour
 * vision deficiency, which a Kamishibai board otherwise does not.
 */
window.AQAuditExcel = (function () {
  "use strict";

  var A = window.AQAudit;

  /* Kamishibai palette. Index into styles.xml cellXfs, set up in buildStyles(). */
  var FILLS = [
    { key: "head",       bg: "FF0E2233", fg: "FFFFFFFF", bold: true },   // 0 -> xf 1
    { key: "compliant",  bg: "FFC8E6C9", fg: "FF1B5E20", bold: true },   // 1 -> xf 2
    { key: "partial",    bg: "FFFFF3C4", fg: "FF7A5200", bold: true },   // 2 -> xf 3
    { key: "nc",         bg: "FFFFCDD2", fg: "FFB3261E", bold: true },   // 3 -> xf 4
    { key: "na",         bg: "FFECEFF1", fg: "FF5A6C7A", bold: false },  // 4 -> xf 5
    { key: "unassessed", bg: "FFFFFFFF", fg: "FF8B99A4", bold: false },  // 5 -> xf 6
    { key: "band",       bg: "FFE8F4F7", fg: "FF0E2233", bold: true },   // 6 -> xf 7
    { key: "label",      bg: "FFF5F7F8", fg: "FF5A6C7A", bold: true }    // 7 -> xf 8
  ];
  // xf 0 = plain, xf 9 = wrapped plain, xf 10 = wrapped small
  var XF = { plain: 0, head: 1, compliant: 2, partial: 3, nc: 4, na: 5,
             unassessed: 6, band: 7, label: 8, wrap: 9 };

  function xmlEsc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
      // Excel rejects most control characters outright; strip rather than corrupt the file.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }

  function colName(n) {                     // 1 -> A
    var s = "";
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
    return s;
  }

  /* A cell. v may be string or number; style is an XF index. */
  function cell(col, row, v, style, isNum) {
    var ref = colName(col) + row;
    var s = style ? ' s="' + style + '"' : "";
    if (v === "" || v == null) return '<c r="' + ref + '"' + s + '/>';
    if (isNum) return '<c r="' + ref + '"' + s + '><v>' + Number(v) + "</v></c>";
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlEsc(v) + "</t></is></c>";
  }

  /* rows: array of arrays of { v, s, n } or plain values. */
  function sheetXml(rows, opts) {
    opts = opts || {};
    var body = rows.map(function (r, i) {
      var rn = i + 1;
      var cells = r.map(function (c, j) {
        if (c && typeof c === "object") return cell(j + 1, rn, c.v, c.s, c.n);
        return cell(j + 1, rn, c, 0, false);
      }).join("");
      var ht = opts.rowHeights && opts.rowHeights[i] ? ' ht="' + opts.rowHeights[i] + '" customHeight="1"' : "";
      return '<row r="' + rn + '"' + ht + ">" + cells + "</row>";
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
    var merges = opts.merges && opts.merges.length
      ? '<mergeCells count="' + opts.merges.length + '">' +
        opts.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join("") + "</mergeCells>"
      : "";

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      "<sheetViews>" + pane + "</sheetViews>" +
      '<sheetFormatPr defaultRowHeight="15"/>' + cols +
      "<sheetData>" + body + "</sheetData>" + af + merges +
      "</worksheet>";
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

    var xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top"/></xf>'];
    FILLS.forEach(function (f, i) {
      xfs.push('<xf numFmtId="0" fontId="' + (i + 1) + '" fillId="' + (i + 2) +
        '" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
        '<alignment vertical="center" horizontal="center" wrapText="1"/></xf>');
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

  function styleFor(status) {
    return XF[status] != null && status !== "plain" ? XF[status] : XF.unassessed;
  }
  function shortOf(status) {
    return (A.STATUS[status] || A.STATUS.unassessed).short;
  }

  function H(v) { return { v: v, s: XF.head }; }
  function L(v) { return { v: v, s: XF.label }; }
  function B(v) { return { v: v, s: XF.band }; }
  function W(v) { return { v: v, s: XF.wrap }; }

  /* ------------------------------- sheets ------------------------------- */

  function coverSheet(session, sc) {
    var rows = [
      [B("AQcredix \u2014 Internal Audit Record")],
      [],
      [L("Department"), session.department_name],
      [L("Auditor"), session.auditor_name],
      [L("Standard"), session.standard_edition],
      [L("Audit started"), new Date(session.started_at).toLocaleString()],
      [L("Audit finished"), session.finished_at ? new Date(session.finished_at).toLocaleString() : "\u2014"],
      [L("Duration"), A.fmtDuration(session.duration_seconds != null ? session.duration_seconds : A.elapsedSeconds(session))],
      [L("Paused (idle) excluded"), A.fmtDuration(session.paused_seconds || 0)],
      [],
      [L("Elements in scope"), { v: sc.total, n: true }],
      [L("Applicable (excl. NA)"), { v: sc.applicable, n: true }],
      [L("Compliant"), { v: sc.counts.compliant, n: true, s: XF.compliant }],
      [L("Partially compliant"), { v: sc.counts.partial, n: true, s: XF.partial }],
      [L("Non-compliant"), { v: sc.counts.nc, n: true, s: XF.nc }],
      [L("Not applicable"), { v: sc.counts.na, n: true, s: XF.na }],
      [L("Unassessed"), { v: sc.counts.unassessed, n: true, s: XF.unassessed }],
      [],
      [L("Readiness (weighted)"), { v: sc.weighted + "%", s: XF.band }],
      [L("Readiness (unweighted)"), sc.plain + "%"],
      [L("Verdict"), B(sc.band.label)],
      [L("Open Core-category findings"), { v: sc.coreOpen, n: true }],
      [],
      [B("Legend")],
      [{ v: "C", s: XF.compliant }, W("Compliant \u2014 requirement met, evidence seen")],
      [{ v: "PC", s: XF.partial }, W("Partially compliant \u2014 requirement met in part, or met without evidence")],
      [{ v: "NC", s: XF.nc }, W("Non-compliant \u2014 requirement not met")],
      [{ v: "NA", s: XF.na }, W("Not applicable \u2014 out of this department's scope, with a stated reason")],
      [{ v: "\u2014", s: XF.unassessed }, W("Unassessed")],
      [],
      [W("Internal self-assessment of one department against the NABH 5th Edition assessor " +
         "checklist. It is not an NABH opinion and will not reproduce an assessor's score.")]
    ];
    return sheetXml(rows, { widths: [30, 62], merges: ["A1:B1"] });
  }

  /* The board. Elements as coloured tiles grouped into chapter bands, so the whole
     department reads at a glance the way a physical Kamishibai board does. */
  function boardSheet(session, rows) {
    var PER = 10;
    var out = [[B("Kamishibai Board \u2014 " + session.department_name)], []];
    var merges = ["A1:J1"];
    var byChapter = {};
    rows.forEach(function (r) { (byChapter[r.chapter] = byChapter[r.chapter] || []).push(r); });

    A.CH_ORDER.forEach(function (ck) {
      var list = byChapter[ck];
      if (!list || !list.length) return;
      out.push([H(ck + " \u2014 " + list[0].chapterName)]);
      merges.push("A" + out.length + ":J" + out.length);
      for (var i = 0; i < list.length; i += PER) {
        var slice = list.slice(i, i + PER);
        out.push(slice.map(function (r) {
          var st = A.finding(session, r.code).status || "unassessed";
          return { v: r.code + "\n" + shortOf(st), s: styleFor(st) };
        }));
      }
      out.push([]);
    });

    return sheetXml(out, {
      widths: [13, 13, 13, 13, 13, 13, 13, 13, 13, 13],
      freeze: 2, merges: merges
    });
  }

  function findingsSheet(session, rows) {
    var out = [[H("Chapter"), H("Code"), H("Standard"), H("Element"), H("Category"),
                H("SOP"), H("Status"), H("Evidence / observation"), H("Severity"),
                H("Responsible person"), H("Target closure")]];
    rows.forEach(function (r) {
      var f = A.finding(session, r.code);
      var st = f.status || "unassessed";
      out.push([
        r.chapter, r.code, W(r.standardText), W(r.text), r.category, r.sop ? "Yes" : "",
        { v: shortOf(st), s: styleFor(st) },
        W(f.evidence || f.justification || ""),
        f.severity || "", f.owner || "", f.due_date || ""
      ]);
    });
    return sheetXml(out, {
      widths: [9, 11, 40, 60, 13, 6, 9, 44, 12, 20, 14],
      freeze: 1, autoFilter: "A1:K" + out.length
    });
  }

  function ncSheet(session, sc) {
    var out = [[H("Severity"), H("Status"), H("Code"), H("Element"),
                H("Observation"), H("Responsible person"), H("Target closure")]];
    if (!sc.open.length) {
      out.push([W("No non-conformities or partial compliances were recorded in this audit.")]);
    }
    sc.open.forEach(function (r) {
      var f = r.finding;
      out.push([
        (f.severity || "observation"), { v: shortOf(f.status), s: styleFor(f.status) },
        r.code, W(r.text), W(f.evidence || ""), f.owner || "", f.due_date || ""
      ]);
    });
    return sheetXml(out, { widths: [13, 9, 11, 62, 44, 22, 14], freeze: 1 });
  }

  function kpiSheet(session) {
    var sc = (window.AUDIT_SCOPE || {})[session.department_id] || {};
    var out = [[H("Quality indicator to verify"), H("Data available")]];
    (sc.kpis || []).forEach(function (k) {
      var ok = !!session.kpi_checks[k];
      out.push([W(k), { v: ok ? "Yes" : "No", s: ok ? XF.compliant : XF.nc }]);
    });
    if ((sc.kpis || []).length === 0) {
      out.push([W("The assessor checklist lists no department-specific indicators for this area.")]);
    }
    return sheetXml(out, { widths: [74, 16], freeze: 1 });
  }

  function analysisSheet(session, sc) {
    var out = [[B("Chapter readiness")], [H("Chapter"), H("Name"), H("Applicable"),
      H("C"), H("PC"), H("NC"), H("NA"), H("Readiness %")]];
    A.CH_ORDER.forEach(function (ck) {
      var c = sc.byChapter[ck];
      if (!c) return;
      out.push([c.code, W(c.name), { v: c.applicable, n: true },
        { v: c.counts.compliant, n: true, s: XF.compliant },
        { v: c.counts.partial, n: true, s: XF.partial },
        { v: c.counts.nc, n: true, s: XF.nc },
        { v: c.counts.na, n: true, s: XF.na },
        { v: c.pct, n: true, s: c.pct >= 90 ? XF.compliant : c.pct >= 75 ? XF.partial : XF.nc }]);
    });

    out.push([]);
    out.push([B("Training needs derived from the findings")]);
    out.push([H("Standard"), H("Topic"), H("Open findings"), H("Worst severity"), H("Recommended mode")]);
    var tn = A.trainingNeeds(sc);
    if (!tn.length) out.push([W("No training need is implied by this audit's findings.")]);
    tn.forEach(function (t) {
      out.push([t.standard, W(t.topic), { v: t.count, n: true }, t.worst, W(t.mode)]);
    });

    out.push([]);
    out.push([B("Responsible persons")]);
    out.push([H("Person"), H("Open findings"), H("Earliest due"), H("Worst severity"), H("Elements")]);
    A.ownerMatrix(sc).forEach(function (o) {
      out.push([o.owner, { v: o.count, n: true }, o.earliest || "\u2014", o.worst, W(o.codes.join(", "))]);
    });

    out.push([]);
    var days = A.reauditDays(sc);
    var next = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    out.push([L("Suggested re-audit"), B(next + "  (" + days + " days)")]);

    return sheetXml(out, { widths: [16, 52, 14, 16, 46] });
  }

  /* ------------------------------- package ------------------------------- */

  var SHEETS = ["Cover", "Kamishibai Board", "Findings", "Non-Conformities",
                "Quality Indicators", "Analysis"];

  function build(session) {
    if (!window.JSZip) throw new Error("JSZip is not loaded yet \u2014 wait a moment and try again.");
    var rows = A.scopeRows(session.department_id);
    var sc = A.score(session);
    var zip = new window.JSZip();

    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      SHEETS.map(function (s, i) {
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
      SHEETS.map(function (s, i) {
        return '<sheet name="' + xmlEsc(s) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join("") + "</sheets></workbook>");

    xl.folder("_rels").file("workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      SHEETS.map(function (s, i) {
        return '<Relationship Id="rId' + (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
          (i + 1) + '.xml"/>';
      }).join("") +
      '<Relationship Id="rId' + (SHEETS.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>");

    xl.file("styles.xml", buildStyles());
    var ws = xl.folder("worksheets");
    ws.file("sheet1.xml", coverSheet(session, sc));
    ws.file("sheet2.xml", boardSheet(session, rows));
    ws.file("sheet3.xml", findingsSheet(session, rows));
    ws.file("sheet4.xml", ncSheet(session, sc));
    ws.file("sheet5.xml", kpiSheet(session));
    ws.file("sheet6.xml", analysisSheet(session, sc));

    return zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      compression: "DEFLATE"
    });
  }

  function filename(session) {
    var d = (session.finished_at || session.started_at || "").slice(0, 10);
    var dept = String(session.department_name).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return "AQcredix-Internal-Audit_" + dept + "_" + d + "_" + session.id + ".xlsx";
  }

  function download(session) {
    return build(session).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename(session);
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  return { build: build, download: download, filename: filename };
})();
