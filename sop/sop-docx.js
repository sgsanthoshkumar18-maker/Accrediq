/* AQcredix — .docx writer
 * Builds a genuine Office Open XML .docx (a ZIP of XML parts) in the browser
 * using JSZip. No server round-trip, no conversion service.
 *
 * Input is a simple block list so the SOP engine stays independent of OOXML:
 *   { type: "title"|"h1"|"h2"|"p"|"bullet"|"numbered"|"pagebreak", text }
 *   { type: "table", header: [..], rows: [[..],[..]] }
 */
window.SopDocx = (function () {

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  // A run of text, optionally bold. Word needs xml:space="preserve" to keep spacing.
  function run(text, opts = {}) {
    const rPr = [];
    if (opts.bold) rPr.push("<w:b/>");
    if (opts.color) rPr.push(`<w:color w:val="${opts.color}"/>`);
    if (opts.size) rPr.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
    const props = rPr.length ? `<w:rPr>${rPr.join("")}</w:rPr>` : "";
    return `<w:r>${props}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  }

  function para(content, opts = {}) {
    const pPr = [];
    if (opts.style) pPr.push(`<w:pStyle w:val="${opts.style}"/>`);
    if (opts.numId) pPr.push(`<w:numPr><w:ilvl w:val="${opts.ilvl || 0}"/><w:numId w:val="${opts.numId}"/></w:numPr>`);
    if (opts.align) pPr.push(`<w:jc w:val="${opts.align}"/>`);
    if (opts.spaceAfter != null) pPr.push(`<w:spacing w:after="${opts.spaceAfter}"/>`);
    if (opts.pageBreakBefore) pPr.push("<w:pageBreakBefore/>");
    const props = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
    return `<w:p>${props}${content}</w:p>`;
  }

  function tableXml(header, rows) {
    const border = '<w:tblBorders>' +
      ["top", "left", "bottom", "right", "insideH", "insideV"]
        .map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="C9CEE0"/>`).join("") +
      '</w:tblBorders>';
    const grid = `<w:tblGrid>${header.map(() => '<w:gridCol w:w="2900"/>').join("")}</w:tblGrid>`;

    const headRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${header.map(h =>
      `<w:tc><w:tcPr><w:shd w:val="clear" w:fill="EEF0F8"/></w:tcPr>${para(run(h, { bold: true }))}</w:tc>`
    ).join("")}</w:tr>`;

    const bodyRows = rows.map(r =>
      `<w:tr>${r.map(cell => `<w:tc>${para(run(cell))}</w:tc>`).join("")}</w:tr>`
    ).join("");

    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr>${grid}${headRow}${bodyRows}</w:tbl>`;
  }

  function blocksToXml(blocks) {
    return blocks.map(b => {
      switch (b.type) {
        case "title":    return para(run(b.text, { bold: true, size: 40 }), { style: "Title", spaceAfter: 240 });
        case "h1":       return para(run(b.text, { bold: true, size: 30 }), { style: "Heading1", spaceAfter: 160 });
        case "h2":       return para(run(b.text, { bold: true, size: 26 }), { style: "Heading2", spaceAfter: 120 });
        case "p":        return para(run(b.text), { spaceAfter: 120 });
        case "small":    return para(run(b.text, { size: 18, color: "6A6F8A" }), { spaceAfter: 120 });
        case "bullet":   return para(run(b.text), { numId: 1, spaceAfter: 60 });
        case "numbered": return para(run(b.text), { numId: 2, spaceAfter: 60 });
        case "pagebreak":return para("", { pageBreakBefore: true });
        case "table":    return tableXml(b.header || [], b.rows || []);
        default:         return para(run(b.text || ""));
      }
    }).join("");
  }

  // ---- Static OOXML parts ----
  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

  const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

  const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr>
<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/>
</w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>
<w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="1F2A5C"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
<w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="1F2A5C"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
<w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="33487F"/></w:rPr></w:style>
</w:styles>`;

  // numId 1 = bullets, numId 2 = decimal
  const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0">
<w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr>
</w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">
<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
</w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

  function documentXml(blocks) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${blocksToXml(blocks)}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;
  }

  /** Build the .docx and return a Blob. Requires JSZip on the page. */
  async function build(blocks) {
    if (typeof JSZip === "undefined") throw new Error("JSZip not loaded");
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES);
    zip.folder("_rels").file(".rels", ROOT_RELS);
    const word = zip.folder("word");
    word.file("document.xml", documentXml(blocks));
    word.file("styles.xml", STYLES);
    word.file("numbering.xml", NUMBERING);
    word.folder("_rels").file("document.xml.rels", DOC_RELS);
    return zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  async function download(blocks, filename) {
    const blob = await build(blocks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".docx") ? filename : filename + ".docx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { build, download, documentXml, CONTENT_TYPES, ROOT_RELS, DOC_RELS, STYLES, NUMBERING };
})();
