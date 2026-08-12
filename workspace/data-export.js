/* AQcredix — customer data export.
 *
 * Everything a hospital has put into the platform, in one workbook: audits, incidents,
 * CAPAs, committee meetings, recurring obligations, the equipment register with its
 * calibration history, and every round with its score.
 *
 * WHY THIS EXISTS. A hospital that cannot get its own compliance records out is a
 * hospital that cannot leave — and a product that relies on that is relying on the wrong
 * thing. It is also a procurement question: an IT review asks "can we extract our data"
 * before it asks anything about features. The answer should be one button.
 *
 * Raw OOXML through JSZip, the same pattern as audit/audit-excel.js and
 * standards/standards-excel.js. No new dependency.
 */
window.AQDataExport = (function () {
  "use strict";

  var S = window.AQStore, K = window.AQSchedule;

  /* Every org-scoped table, with the columns worth reading. Driven by data rather than
     eight near-identical functions, so a new table is one entry here and appears in the
     export automatically instead of being silently left out. */
  var SHEETS = [
    { table: "incidents", name: "Incidents",
      cols: [["id", "Reference"], ["occurred_on", "Occurred"], ["type", "Type"],
             ["department", "Department"], ["severity", "Severity"], ["status", "Status"],
             ["description", "What happened"], ["immediate_action", "Immediate action"],
             ["element_code", "NABH element"], ["created_at", "Recorded"]] },

    { table: "capa", name: "NC and CAPA",
      cols: [["id", "Reference"], ["title", "Finding"], ["status", "Status"],
             ["department", "Department"], ["source", "Source"], ["owner", "Owner"],
             ["due_on", "Due"], ["root_cause", "Root cause"], ["corrective", "Corrective"],
             ["preventive", "Preventive"], ["verification", "Verification"],
             ["element_code", "NABH element"], ["created_at", "Raised"]] },

    { table: "audits", name: "Internal audits",
      cols: [["id", "Reference"], ["department", "Department"], ["started_on", "Started"],
             ["status", "Status"], ["score_pct", "Score %"], ["auditor", "Auditor"],
             ["created_at", "Created"]] },

    { table: "committees", name: "Committees",
      cols: [["name", "Committee"], ["short_name", "Short name"], ["frequency", "Frequency"],
             ["chairperson", "Chairperson"], ["secretary", "Convener"],
             ["last_met_on", "Last met"], ["pref_dow", "Preferred day"]] },

    { table: "committee_meetings", name: "Committee meetings",
      cols: [["committee_id", "Committee"], ["held_on", "Held"], ["status", "Status"],
             ["attendance", "Present"], ["quorum_met", "Quorum"], ["minutes", "Minutes"]] },

    { table: "compliance_tasks", name: "Recurring obligations",
      cols: [["title", "Task"], ["category", "Category"], ["frequency", "Frequency"],
             ["department", "Department"], ["owner", "Owner"], ["last_done_on", "Last done"],
             ["element_code", "NABH element"]] },

    { table: "assets", name: "Register",
      cols: [["name", "Item"], ["kind", "Type"], ["identifier", "Serial / number"],
             ["department", "Department"], ["location", "Location"],
             ["manufacturer", "Manufacturer"], ["model", "Model"], ["owner", "Responsible"],
             ["status", "Status"], ["element_code", "NABH element"]] },

    { table: "asset_events", name: "Calibration history",
      cols: [["asset_id", "Item"], ["kind", "Kind"], ["performed_on", "Performed"],
             ["performed_by", "By"], ["vendor", "Vendor"],
             ["certificate_no", "Certificate"], ["result", "Result"],
             ["downtime_hours", "Downtime (h)"], ["notes", "Notes"]] },

    { table: "checklists", name: "Checklists",
      cols: [["name", "Checklist"], ["department", "Department"], ["frequency", "Frequency"],
             ["target_pct", "Target %"], ["owner", "Owner"], ["last_done_on", "Last done"],
             ["element_code", "NABH element"]] },

    { table: "rounds", name: "Rounds",
      cols: [["checklist_id", "Checklist"], ["performed_on", "Performed"],
             ["area", "Area"], ["performed_by", "By"], ["score_pct", "Score %"],
             ["passed", "Passed"], ["notes", "Notes"]] },

    { table: "documents", name: "Documents",
      cols: [["title", "Document"], ["doc_code", "Code"], ["version", "Version"],
             ["department", "Department"], ["owner", "Owner"], ["status", "Status"],
             ["review_on", "Review due"]] }
  ];

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

  /* Values are written as INLINE STRINGS, including numbers. A hospital reference like
     "2026-001" is not a number, and letting Excel decide would turn some of them into
     dates and others into scientific notation — silently, and differently per locale. */
  function cell(col, row, v, style) {
    var ref = colName(col) + row;
    var s = style ? ' s="' + style + '"' : "";
    if (v === "" || v == null) return '<c r="' + ref + '"' + s + "/>";
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
      xmlEsc(v) + "</t></is></c>";
  }

  function sheetXml(rows, widths) {
    var body = rows.map(function (r, i) {
      var rn = i + 1;
      return '<row r="' + rn + '">' + r.map(function (c, j) {
        return (c && typeof c === "object")
          ? cell(j + 1, rn, c.v, c.s)
          : cell(j + 1, rn, c, i === 0 ? 1 : 0);
      }).join("") + "</row>";
    }).join("");

    var cols = widths ? "<cols>" + widths.map(function (w, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    }).join("") + "</cols>" : "";

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" ' +
        'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' + cols +
      "<sheetData>" + body + "</sheetData>" +
      (rows.length > 1 ? '<autoFilter ref="A1:' + colName(rows[0].length) + rows.length + '"/>' : "") +
      "</worksheet>";
  }

  function styles() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><sz val="11"/><name val="Calibri"/><b/><color rgb="FFFFFFFF"/></font>' +
        '<font><sz val="11"/><name val="Calibri"/><b/><color rgb="FF0E2233"/></font></fonts>' +
      '<fills count="4"><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FF0E2233"/><bgColor indexed="64"/></patternFill></fill>' +
        '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F4F7"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
        '<border><left style="thin"><color rgb="FFD8E0E6"/></left>' +
        '<right style="thin"><color rgb="FFD8E0E6"/></right>' +
        '<top style="thin"><color rgb="FFD8E0E6"/></top>' +
        '<bottom style="thin"><color rgb="FFD8E0E6"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
        '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
      "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>";
  }

  /* --------------------------------- gathering --------------------------------- */

  /* One table failing must not lose the other ten. A hospital exporting its records
     because it is unhappy, or because IT asked, is exactly when a half-failure is least
     forgivable — so a missing table becomes an empty sheet with a note, not an error. */
  async function gather() {
    var out = [];
    for (var i = 0; i < SHEETS.length; i++) {
      var spec = SHEETS[i];
      var rows = [];
      var failed = false;
      try {
        rows = (await S.adapter.list(spec.table)) || [];
      } catch (e) {
        failed = true;
      }
      out.push({ spec: spec, rows: rows, failed: failed });
    }
    return out;
  }

  /* Human-readable names in place of internal ids. An export full of "cmte_m8x2p1" is
     technically complete and practically useless. */
  function resolver(all) {
    var map = {};
    all.forEach(function (s) {
      s.rows.forEach(function (r) {
        if (r && r.id) map[r.id] = r.name || r.title || r.short_name || null;
      });
    });
    return function (v) {
      if (v == null) return "";
      return map[v] || v;
    };
  }

  function fmt(v, resolve) {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (typeof v === "number") return String(v);
    if (typeof v === "object") {
      /* jsonb columns — a round's answers, for example. Flattened rather than dumped as
         JSON, so the sheet is readable by the person who filled the round in. */
      try {
        return Object.keys(v).map(function (k) { return resolve(k) + ": " + v[k]; }).join("; ");
      } catch (e) { return ""; }
    }
    var s = String(v);
    // Timestamps are long and the date is the part anyone reads.
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
    return resolve(s);
  }

  function coverSheet(all, org) {
    var rows = [
      [{ v: "AQcredix \u2014 complete data export", s: 2 }],
      [],
      [{ v: "Organisation", s: 2 }, org || "\u2014"],
      [{ v: "Exported", s: 2 }, new Date().toLocaleString()],
      [{ v: "Sheets", s: 2 }, String(all.length)],
      [],
      [{ v: "Sheet", s: 1 }, { v: "Records", s: 1 }, { v: "Note", s: 1 }]
    ];
    all.forEach(function (s) {
      rows.push([s.spec.name, String(s.rows.length),
        s.failed ? "Could not be read \u2014 try again, or ask for help" : ""]);
    });
    rows.push([]);
    rows.push([{ v: "This is your hospital's own data, exported in full. Every record you " +
      "have entered is here, in open format. Nothing is held back.", s: 0 }]);
    return sheetXml(rows, [34, 16, 58]);
  }

  function dataSheet(s, resolve) {
    var head = s.spec.cols.map(function (c) { return { v: c[1], s: 1 }; });
    var rows = [head];

    if (s.failed) {
      rows.push([{ v: "This table could not be read at the time of export.", s: 0 }]);
    } else if (!s.rows.length) {
      rows.push([{ v: "No records yet.", s: 0 }]);
    } else {
      s.rows.forEach(function (r) {
        rows.push(s.spec.cols.map(function (c) { return fmt(r[c[0]], resolve); }));
      });
    }

    var widths = s.spec.cols.map(function (c) {
      return Math.min(60, Math.max(14, c[1].length + 6));
    });
    return sheetXml(rows, widths);
  }

  /* --------------------------------- package --------------------------------- */

  async function build(org) {
    if (!window.JSZip) {
      throw new Error("The spreadsheet engine is still loading \u2014 wait a moment and try again.");
    }
    var all = await gather();
    var resolve = resolver(all);
    var names = ["Cover"].concat(all.map(function (s) { return s.spec.name; }));
    var zip = new window.JSZip();

    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      names.map(function (n, i) {
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
      names.map(function (n, i) {
        /* Excel refuses sheet names over 31 characters or containing : \ / ? * [ ].
           Trimming here rather than trusting the labels keeps the file openable. */
        var safe = String(n).replace(/[:\\\/?*\[\]]/g, " ").slice(0, 31);
        return '<sheet name="' + xmlEsc(safe) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join("") + "</sheets></workbook>");

    xl.folder("_rels").file("workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      names.map(function (n, i) {
        return '<Relationship Id="rId' + (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
          (i + 1) + '.xml"/>';
      }).join("") +
      '<Relationship Id="rId' + (names.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>");

    xl.file("styles.xml", styles());
    var ws = xl.folder("worksheets");
    ws.file("sheet1.xml", coverSheet(all, org));
    all.forEach(function (s, i) { ws.file("sheet" + (i + 2) + ".xml", dataSheet(s, resolve)); });

    return zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      compression: "DEFLATE"
    });
  }

  function filename() {
    return "AQcredix_data_export_" + new Date().toISOString().slice(0, 10) + ".xlsx";
  }

  async function download(org) {
    var blob = await build(org);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename();
    /* The anchor must be in the document for the click to be honoured on mobile Safari
       and Android Chrome; a detached anchor silently does nothing there. */
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* A JSON copy alongside the workbook. Excel is what a quality manager opens; JSON is
     what another system imports, and "export" that only produces a spreadsheet is not a
     real answer to a migration question. */
  async function downloadJson() {
    var all = await gather();
    var out = { exported_at: new Date().toISOString(), tables: {} };
    all.forEach(function (s) { out.tables[s.spec.table] = s.failed ? null : s.rows; });
    var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "AQcredix_data_export_" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  return { build: build, download: download, downloadJson: downloadJson,
           filename: filename, SHEETS: SHEETS };
})();
