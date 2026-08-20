/* AQcredix — a minimal .docx writer, for the apex manual.
 *
 * A subset of OOXML sufficient for a real document: headings, paragraphs, bullet lists and
 * simple two-column tables. Same reasoning as the xlsx writers elsewhere on this site —
 * raw OOXML through JSZip, no new dependency, and the output is a genuine editable Word
 * document rather than a flattened PDF a hospital would have to retype.
 */
window.AQDocx = (function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  /* A run of text preserves line breaks within one paragraph — a multi-line answer typed
     into a textarea must not collapse onto one line in the manual. */
  function runs(text) {
    return String(text || "").split("\n").map(function (line, i) {
      return (i ? '<w:br/>' : "") + '<w:t xml:space="preserve">' + esc(line) + "</w:t>";
    }).join("");
  }

  function heading(text, level) {
    var style = level === 1 ? "Heading1" : level === 2 ? "Heading2" : "Heading3";
    return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/></w:pPr>' +
      '<w:r>' + runs(text) + "</w:r></w:p>";
  }

  function para(text) {
    return '<w:p><w:r>' + runs(text) + "</w:r></w:p>";
  }

  function bullet(text) {
    return '<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr>' +
      '<w:r>' + runs(text) + "</w:r></w:p>";
  }

  function spacer() { return "<w:p/>"; }

  /* rows: array of [label, value] pairs, rendered as a two-column table. This is what the
     committee list and the cross-reference matrix use. */
  function table(rows) {
    var tr = rows.map(function (r) {
      return "<w:tr>" + r.map(function (c, i) {
        return '<w:tc><w:tcPr><w:tcW w:w="' + (i === 0 ? 3000 : 6500) + '" w:type="dxa"/></w:tcPr>' +
          '<w:p><w:r>' + runs(c) + "</w:r></w:p></w:tc>";
      }).join("") + "</w:tr>";
    }).join("");
    return '<w:tbl><w:tblPr><w:tblW w:w="9500" w:type="dxa"/>' +
      '<w:tblBorders>' +
        '<w:top w:val="single" w:sz="4" w:color="CCCCCC"/>' +
        '<w:left w:val="single" w:sz="4" w:color="CCCCCC"/>' +
        '<w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>' +
        '<w:right w:val="single" w:sz="4" w:color="CCCCCC"/>' +
        '<w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>' +
        '<w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/>' +
      "</w:tblBorders></w:tblPr>" + tr + "</w:tbl>" + spacer();
  }

  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>' +
      '<w:pPr><w:spacing w:after="180"/></w:pPr><w:rPr><w:sz w:val="22"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>' +
      '<w:pPr><w:spacing w:before="480" w:after="200"/></w:pPr>' +
      '<w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="0E2233"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>' +
      '<w:pPr><w:spacing w:before="320" w:after="160"/></w:pPr>' +
      '<w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="0EA5A0"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>' +
      '<w:pPr><w:spacing w:before="220" w:after="120"/></w:pPr>' +
      '<w:rPr><w:b/><w:sz w:val="23"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/>' +
      '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' +
      '<w:spacing w:after="80"/></w:pPr></w:style>' +
    "</w:styles>";

  var NUMBERING = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0">' +
      '<w:numFmt w:val="bullet"/><w:lvlText w:val="•"/>' +
      '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
    '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
    "</w:numbering>";

  async function build(title, blocks) {
    if (!window.JSZip) throw new Error("The document engine is still loading — try again in a moment.");

    var body = blocks.map(function (b) {
      if (b.type === "h1") return heading(b.text, 1);
      if (b.type === "h2") return heading(b.text, 2);
      if (b.type === "h3") return heading(b.text, 3);
      if (b.type === "p") return para(b.text);
      if (b.type === "bullets") return b.items.map(bullet).join("");
      if (b.type === "table") return table(b.rows);
      if (b.type === "space") return spacer();
      return "";
    }).join("") + '<w:sectPr><w:pgSz w:w="11907" w:h="16840"/>' +
      '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>';

    var documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      "<w:body>" + body + "</w:body></w:document>";

    var zip = new window.JSZip();
    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      "</Types>");
    zip.folder("_rels").file(".rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      "</Relationships>");
    zip.folder("docProps").file("core.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      "<dc:title>" + esc(title) + "</dc:title><dc:creator>AQcredix</dc:creator></cp:coreProperties>");
    var word = zip.folder("word");
    word.file("document.xml", documentXml);
    word.file("styles.xml", STYLES);
    word.file("numbering.xml", NUMBERING);
    word.folder("_rels").file("document.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' +
      "</Relationships>");

    return zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  async function download(title, blocks, filename) {
    var blob = await build(title, blocks);
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  return { build: build, download: download };
})();
