/* AQcredix — incident report form (.docx).
 *
 * Rebuilds the supplied hospital form as an AQcredix-branded document: same sections,
 * same classification definitions, same three-signature chain, but set in the platform's
 * ink/accent palette with the ring mark on the letterhead instead of one hospital's
 * letterhead and internal form number.
 *
 * Two modes:
 *   download(inc)        – filled from a recorded incident
 *   download(inc, true)  – a blank form to print and keep on the ward trolley, because
 *                          the moment of an incident is not the moment to find a laptop
 *
 * OOXML is written directly through JSZip, the same approach as sop-docx.js.
 */
window.AQIncidentDoc = (function () {
  "use strict";

  var I = window.AQIncident;

  var INK = "0E2233";
  var ACCENT = "17A2B8";
  var ACCENT_DEEP = "0E6B7A";
  var MUTED = "5A6C7A";
  var RULE = "D8E0E6";
  var TINT = "F2F8FA";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  }

  function run(text, o) {
    o = o || {};
    var p = [];
    if (o.bold) p.push("<w:b/>");
    if (o.italic) p.push("<w:i/>");
    if (o.caps) p.push("<w:caps/>");
    if (o.color) p.push('<w:color w:val="' + o.color + '"/>');
    if (o.size) p.push('<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>');
    if (o.spacing) p.push('<w:spacing w:val="' + o.spacing + '"/>');
    if (o.font) p.push('<w:rFonts w:ascii="' + o.font + '" w:hAnsi="' + o.font + '"/>');
    var pr = p.length ? "<w:rPr>" + p.join("") + "</w:rPr>" : "";
    // Multi-line values must become real breaks or the whole description lands on one line.
    var parts = String(text == null ? "" : text).split("\n");
    var body = parts.map(function (t, i) {
      return (i ? "<w:br/>" : "") + '<w:t xml:space="preserve">' + esc(t) + "</w:t>";
    }).join("");
    return "<w:r>" + pr + body + "</w:r>";
  }

  function para(content, o) {
    o = o || {};
    var p = [];
    if (o.align) p.push('<w:jc w:val="' + o.align + '"/>');
    if (o.before != null || o.after != null) {
      p.push('<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 60 : o.after) + '"/>');
    }
    if (o.shade) p.push('<w:shd w:val="clear" w:fill="' + o.shade + '"/>');
    if (o.border) {
      p.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="4" w:color="' + o.border + '"/></w:pBdr>');
    }
    if (o.indent) p.push('<w:ind w:left="' + o.indent + '"/>');
    if (o.keepNext) p.push("<w:keepNext/>");
    var pr = p.length ? "<w:pPr>" + p.join("") + "</w:pPr>" : "";
    return "<w:p>" + pr + content + "</w:p>";
  }

  function spacer(h) { return '<w:p><w:pPr><w:spacing w:after="' + (h || 80) + '"/></w:pPr></w:p>'; }

  function cell(content, o) {
    o = o || {};
    var pr = '<w:tcPr><w:tcW w:w="' + (o.w || 0) + '" w:type="' + (o.w ? "dxa" : "auto") + '"/>' +
      (o.shade ? '<w:shd w:val="clear" w:fill="' + o.shade + '"/>' : "") +
      (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : "") +
      '<w:vAlign w:val="' + (o.valign || "top") + '"/>' +
      '<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/>' +
      '<w:left w:w="110" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tcMar></w:tcPr>';
    return "<w:tc>" + pr + content + "</w:tc>";
  }

  function table(rowsXml, o) {
    o = o || {};
    var b = ["top", "left", "bottom", "right", "insideH", "insideV"].map(function (s) {
      return "<w:" + s + ' w:val="single" w:sz="6" w:space="0" w:color="' + RULE + '"/>';
    }).join("");
    return '<w:tbl><w:tblPr><w:tblW w:w="' + (o.width || 9360) + '" w:type="dxa"/>' +
      "<w:tblBorders>" + b + "</w:tblBorders>" +
      '<w:tblLayout w:type="fixed"/></w:tblPr>' + rowsXml + "</w:tbl>";
  }

  /* A label above a ruled area — the paper-form idiom, kept because these forms get
     printed and filled by hand at least as often as they are typed. */
  function labelCell(label, value, w, opts) {
    opts = opts || {};
    var body = para(run(label.toUpperCase(), { bold: true, size: 15, color: MUTED, spacing: 16 }), { after: 30 });
    var lines = opts.lines || 1;
    if (value) {
      body += para(run(value, { size: 20, color: INK }), { after: 0 });
    } else {
      for (var i = 0; i < lines; i++) body += para(run("", { size: 20 }), { after: 0, border: RULE });
    }
    return cell(body, { w: w, span: opts.span });
  }

  function sectionHead(n, title) {
    return para(
      run(n + "  ", { bold: true, size: 20, color: ACCENT }) +
      run(title.toUpperCase(), { bold: true, size: 19, color: INK, spacing: 20 }),
      { before: 180, after: 70, border: ACCENT, keepNext: true });
  }

  /* Letterhead: the ring mark as a drawn shape would need a media part and a relationship;
     a text-set mark in the accent colour reproduces the identity at a fraction of the
     complexity and always prints cleanly. */
  function letterhead() {
    var left = cell(
      para(run("A", { bold: true, size: 44, color: ACCENT, font: "Georgia" }), { after: 0 }),
      { w: 620, valign: "center" });
    var mid = cell(
      para(run("AQcredix", { bold: true, size: 34, color: INK, font: "Georgia" }), { after: 20 }) +
      para(run("Accreditation & Quality Implementation Guidance Platform",
        { size: 14, color: MUTED, caps: true, spacing: 14 }), { after: 0 }),
      { w: 5600, valign: "center" });
    var right = cell(
      para(run("INCIDENT REPORTING FORM", { bold: true, size: 19, color: ACCENT_DEEP, spacing: 16 }),
        { align: "right", after: 20 }) +
      para(run("AQX/QLY/FORM/01", { size: 15, color: MUTED }), { align: "right", after: 0 }),
      { w: 3140, valign: "center" });
    return table("<w:tr>" + left + mid + right + "</w:tr>", { width: 9360 });
  }

  function noticeBar() {
    return table("<w:tr>" + cell(
      para(run("This form should reach the Quality department within " + I.REPORT_WINDOW_MIN +
        " minutes of the incident, after signature in section 5.",
        { bold: true, size: 17, color: ACCENT_DEEP }), { after: 0 }),
      { w: 9360, shade: TINT }) + "</w:tr>", { width: 9360 });
  }

  function classificationBlock(inc, blank) {
    var xml = sectionHead("2", "Classification of incident");
    I.CLASSES.forEach(function (c) {
      var chosen = !blank && inc.classification === c.key;
      var box = chosen ? "\u2612" : "\u2610";
      xml += para(
        run(box + "  ", { size: 24, color: chosen ? ACCENT : MUTED }) +
        run(c.label, { bold: true, size: 19, color: chosen ? ACCENT_DEEP : INK }),
        { after: 10, indent: 60 });
      xml += para(run(c.def, { size: 16, color: MUTED, italic: true }), { after: 70, indent: 400 });
    });
    return xml;
  }

  function signBlock(inc, blank) {
    var cells = I.SIGNOFFS.map(function (s) {
      var got = !blank && inc.signoffs && inc.signoffs[s.key];
      var body = para(run(s.label.toUpperCase(), { bold: true, size: 14, color: MUTED, spacing: 14 }), { after: 50 });
      body += para(run("Name: " + (got ? got.name : ""), { size: 17, color: INK }), { after: 40, border: RULE });
      body += para(run("Date & time: " + (got ? I.fmtDateTime(got.at) : ""), { size: 17, color: INK }), { after: 40, border: RULE });
      body += para(run("Signature:", { size: 17, color: INK }), { after: 60, border: RULE });
      return cell(body, { w: 3120 });
    }).join("");
    return sectionHead("6", "Information to \u2014 acknowledgement") +
      table("<w:tr>" + cells + "</w:tr>", { width: 9360 });
  }

  function buildBody(inc, blank) {
    var x = "";
    x += letterhead();
    x += spacer(60);
    x += noticeBar();
    x += spacer(60);

    if (!blank && inc.reference) {
      x += para(
        run("Reference  ", { size: 16, color: MUTED, caps: true, spacing: 14 }) +
        run(inc.reference, { bold: true, size: 20, color: INK }),
        { after: 80 });
    }

    /* 1 — occurrence */
    x += sectionHead("1", "What happened");
    x += table(
      "<w:tr>" +
        labelCell("Date & time of occurrence", blank ? "" : I.fmtDateTime(inc.occurred_at), 3120) +
        labelCell("Department", blank ? "" : inc.department, 3120) +
        labelCell("Specific location", blank ? "" : inc.location, 3120) +
      "</w:tr>" +
      "<w:tr>" +
        labelCell("Name of individual involved", blank ? "" : inc.person_name, 3120) +
        labelCell("Age", blank ? "" : inc.person_age, 3120) +
        labelCell("Gender", blank ? "" : inc.person_gender, 3120) +
      "</w:tr>", { width: 9360 });

    var affLine = I.AFFECTED.map(function (a) {
      var on = !blank && inc.affected && inc.affected.indexOf(a.key) >= 0;
      return (on ? "\u2612" : "\u2610") + "  " + a.label;
    }).join("        ");
    x += spacer(50);
    x += table("<w:tr>" + cell(
      para(run("INCIDENT OCCURRED TO", { bold: true, size: 14, color: MUTED, spacing: 14 }), { after: 40 }) +
      para(run(affLine, { size: 20, color: INK }), { after: 0 }),
      { w: 9360 }) + "</w:tr>", { width: 9360 });

    /* 2 — classification */
    x += classificationBlock(inc, blank);

    /* 3 — details */
    x += sectionHead("3", "Details of the event");
    x += table("<w:tr>" + cell(
      blank
        ? Array(7).join("|").split("|").map(function () { return para(run(""), { after: 60, border: RULE }); }).join("")
        : para(run(inc.details || "", { size: 19, color: INK }), { after: 0 }),
      { w: 9360 }) + "</w:tr>", { width: 9360 });

    x += spacer(50);
    x += para(run("IMMEDIATE ACTION TAKEN", { bold: true, size: 15, color: MUTED, spacing: 16 }), { after: 40 });
    x += table("<w:tr>" + cell(
      blank
        ? Array(5).join("|").split("|").map(function () { return para(run(""), { after: 60, border: RULE }); }).join("")
        : para(run(inc.immediate_action || "", { size: 19, color: INK }), { after: 0 }),
      { w: 9360 }) + "</w:tr>", { width: 9360 });

    /* 4 — analysis */
    x += sectionHead("4", "Analysis");
    if (!blank && inc.contributing && inc.contributing.length) {
      x += para(run("Contributing factors: ", { bold: true, size: 17, color: MUTED }) +
        run(inc.contributing.join("; "), { size: 17, color: INK }), { after: 70 });
    }
    [["Root cause analysis", inc.root_cause], ["Corrective action", inc.corrective],
     ["Preventive action", inc.preventive]].forEach(function (b) {
      x += para(run(b[0].toUpperCase(), { bold: true, size: 15, color: MUTED, spacing: 16 }),
        { before: 90, after: 40, keepNext: true });
      x += table("<w:tr>" + cell(
        blank || !b[1]
          ? Array(4).join("|").split("|").map(function () { return para(run(""), { after: 60, border: RULE }); }).join("")
          : para(run(b[1], { size: 19, color: INK }), { after: 0 }),
        { w: 9360 }) + "</w:tr>", { width: 9360 });
    });

    /* 5 — reporter */
    x += sectionHead("5", "Reported by");
    x += table("<w:tr>" +
      labelCell("Staff name", blank ? "" : inc.reporter_name, 3120) +
      labelCell("Department", blank ? "" : inc.reporter_dept, 3120) +
      labelCell("Date & time / signature", blank ? "" : I.fmtDateTime(inc.submitted_at || inc.reported_at), 3120) +
      "</w:tr>", { width: 9360 });

    /* 6 — sign-off chain */
    x += signBlock(inc, blank);

    /* Footer note. The honesty line: this is a form, not a legal instrument, and how it is
       used is governed by the organisation's own policy. */
    x += spacer(140);
    x += para(run(
      "Generated by AQcredix. Adapt the wording to your organisation\u2019s incident policy " +
      "before use. Reporting is intended to be non-punitive \u2014 the purpose of this form is " +
      "to understand how the system allowed the event, not to attribute blame.",
      { size: 14, color: MUTED, italic: true }), { after: 0 });

    return x;
  }

  function docXml(inc, blank) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:body>" + buildBody(inc, blank) +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="900" w:right="1080" w:bottom="900" w:left="1080" ' +
      'w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>' +
      "</w:body></w:document>";
  }

  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:docDefaults><w:rPrDefault><w:rPr>" +
      '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
      '<w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="' + INK + '"/>' +
      "</w:rPr></w:rPrDefault>" +
      '<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
      "</w:docDefaults></w:styles>";
  }

  function build(inc, blank) {
    if (!window.JSZip) throw new Error("JSZip has not finished loading \u2014 try again in a moment.");
    var zip = new window.JSZip();

    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      "</Types>");

    zip.folder("_rels").file(".rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>");

    var w = zip.folder("word");
    w.file("document.xml", docXml(inc, blank));
    w.file("styles.xml", stylesXml());
    w.folder("_rels").file("document.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>");

    return zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE"
    });
  }

  function download(inc, blank) {
    return build(inc, blank).then(function (blob) {
      var name = blank
        ? "AQcredix-Incident-Report-Form-BLANK.docx"
        : "AQcredix-Incident-" + (inc.reference || inc.id) + ".docx";
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  return { build: build, download: download };
})();
