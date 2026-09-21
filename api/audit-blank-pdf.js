/* AQcredix — blank audit checklist as a downloadable PDF.
 *
 * Serves /api/audit-blank-pdf?dept=<key>. Reads scope from audit/scope-data.js and
 * element wording from nabh-data.js (both bundled with this function via
 * vercel.json → includeFiles), draws a printable A4 checklist with pdfkit, and
 * returns it as application/pdf with a Content-Disposition attachment so the
 * browser saves a real file instead of opening its own print dialog.
 *
 * WHY A SERVER FUNCTION AND NOT window.print(). The print dialog opens the browser's
 * own PDF writer, which the user reasonably reads as "print", not "download". A real
 * .pdf attachment is unambiguously a file — it lands in Downloads, can be re-opened,
 * emailed to a colleague, or sent to a physical printer offline. That is what
 * "download the blank checklist" means to the hospital using this. */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const PDFDocument = require("pdfkit");

/* ------------------------------- data ------------------------------- */

/* Data files are static and identical across every request, so evaluate them once
 * at cold start and reuse. On Vercel the working directory is /var/task and the
 * includeFiles glob has copied them alongside this handler. */
let DATA = null;
function loadData() {
  if (DATA) return DATA;
  const root = process.cwd();
  const sb = { window: {}, console };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(root, "nabh-data.js"), "utf8"), sb);
  vm.runInContext(fs.readFileSync(path.join(root, "audit", "scope-data.js"), "utf8"), sb);
  DATA = { NABH: sb.window.NABH_DATA, SCOPE: sb.window.AUDIT_SCOPE };
  return DATA;
}

function lookup(NABH, code) {
  const parts = code.split(".");
  const chap = parts[0], sNum = parts[1], letter = parts[2];
  const ch = NABH.chapters[chap];
  if (!ch) return null;
  const st = ch.standards.find(s => s.code === chap + "." + sNum);
  if (!st) return null;
  const el = (st.elements || []).find(e => e.letter === letter);
  if (!el) return null;
  return {
    chapter: chap, chapterName: ch.name,
    stdCode: st.code, stdText: st.text || "",
    letter, eltText: el.text || "", tier: el.category || "",
  };
}

function groupByStandard(NABH, codes) {
  const out = [], map = new Map();
  codes.forEach(c => {
    const info = lookup(NABH, c);
    if (!info) return;
    if (!map.has(info.stdCode)) {
      const g = { info, elements: [] };
      map.set(info.stdCode, g); out.push(g);
    }
    map.get(info.stdCode).elements.push({ letter: info.letter, text: info.eltText, tier: info.tier });
  });
  return out;
}

function safeFileName(name) {
  return String(name || "checklist").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/* ------------------------------- draw ------------------------------- */

const CLR = {
  primary: "#0B4F6C",
  accent:  "#20A39E",
  band:    "#E6F4F1",
  ink:     "#111111",
  muted:   "#555555",
  hair:    "#B3D4CF",
  score: { C: "#1B7F3A", PC: "#B37700", NC: "#B02A2A", NA: "#555555" },
};
const TIER_SHORT = { Core: "CO", Commitment: "CM", Achievement: "AC", Excellence: "EX" };
const SCORES = ["C", "PC", "NC", "NA"];

function buildPdf(dept, groups) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 46, bottom: 46, left: 42, right: 42 },
    bufferPages: true,
    info: {
      Title: "Blank internal audit checklist — " + dept.name,
      Author: "AQcredix",
      Subject: "NABH 5th Edition — " + dept.name,
    },
  });

  const M = doc.page.margins;
  const PW = doc.page.width;
  const CW = PW - M.left - M.right;
  const bottom = () => doc.page.height - M.bottom - 20;

  let y;

  function drawHeader() {
    const hy = M.top - 22;
    /* Simple AQcredix mark drawn as vector — no font/image assets needed. */
    doc.save().lineWidth(2).strokeColor(CLR.accent).circle(M.left + 14, hy + 14, 12).stroke().restore();
    doc.font("Helvetica-Bold").fontSize(12).fillColor(CLR.primary).text("AQcredix", M.left + 34, hy + 4);
    doc.font("Helvetica").fontSize(8).fillColor(CLR.muted)
       .text("Blank internal audit checklist — for printing", M.left + 34, hy + 18);
    doc.font("Helvetica").fontSize(8).fillColor(CLR.muted)
       .text(dept.name, M.left, hy + 4, { width: CW, align: "right" });
    doc.moveTo(M.left, hy + 32).lineTo(PW - M.right, hy + 32).lineWidth(1).strokeColor(CLR.accent).stroke();
    doc.strokeColor(CLR.hair).lineWidth(0.5);
    doc.fillColor(CLR.ink);
  }
  function newPage(first) {
    if (!first) doc.addPage();
    drawHeader();
    y = M.top + 18;
  }
  newPage(true);

  /* Title + meta */
  doc.font("Helvetica-Bold").fontSize(18).fillColor(CLR.primary)
     .text("Internal audit checklist", M.left, y);
  y = doc.y + 2;
  doc.font("Helvetica-Bold").fontSize(13).fillColor(CLR.ink)
     .text(dept.name, M.left, y);
  y = doc.y + 4;
  const totalElts = groups.reduce((n, g) => n + g.elements.length, 0);
  doc.font("Helvetica").fontSize(9.5).fillColor(CLR.muted)
     .text("Scope: " + totalElts + " elements from the NABH 5th Edition assessor checklist for this area.",
           M.left, y);
  y = doc.y + 10;

  /* Auditor / meta grid */
  function cell(x, w, yy, h, label, hint) {
    doc.rect(x, yy, w, h).lineWidth(0.7).strokeColor(CLR.accent).stroke();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CLR.primary)
       .text(label, x + 6, yy + 4, { width: w - 12, lineBreak: false, height: 10 });
    if (hint) {
      doc.font("Helvetica").fontSize(7).fillColor(CLR.muted)
         .text(hint, x + 6, yy + h - 12, { width: w - 12, lineBreak: false, height: 9 });
    }
  }
  const half = CW / 2;
  cell(M.left, half, y, 34, "Hospital / facility");
  cell(M.left + half, half, y, 34, "Auditor name");
  cell(M.left, half, y + 34, 34, "Date");
  cell(M.left + half, half, y + 34, 34, "Auditee(s) present");
  cell(M.left, half, y + 68, 30, "Start time");
  cell(M.left + half, half, y + 68, 30, "End time");
  cell(M.left, CW, y + 98, 42, "Auditor’s signature", "Sign and date on completion.");
  y += 148;

  /* Scoring key */
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CLR.primary)
     .text("Scoring key", M.left, y);
  y = doc.y + 4;
  let kx = M.left;
  SCORES.forEach(k => {
    const clr = CLR.score[k];
    const boxW = 22, labels = { C: "Compliant", PC: "Partially compliant", NC: "Non-compliant", NA: "Not applicable" };
    const labelText = " " + labels[k];
    doc.font("Helvetica").fontSize(9);
    const lw = doc.widthOfString(labelText);
    doc.rect(kx, y, boxW, 16).lineWidth(1).strokeColor(clr).stroke();
    doc.font("Helvetica-Bold").fontSize(10).fillColor(clr)
       .text(k, kx, y + 3, { width: boxW, align: "center", lineBreak: false, height: 12 });
    doc.font("Helvetica").fontSize(9).fillColor(CLR.ink)
       .text(labelText, kx + boxW + 2, y + 3, { width: lw + 4, lineBreak: false, height: 12 });
    kx += boxW + lw + 16;
  });
  y += 22;
  doc.font("Helvetica").fontSize(8).fillColor(CLR.muted)
     .text("Tier abbreviations: [CO] Core   [CM] Commitment   [AC] Achievement   [EX] Excellence.",
           M.left, y);
  y = doc.y + 2;
  doc.text("Standard and element texts are AQcredix’s restatements written by Dr Santhoshkumar; they are not the NABH standard itself.",
           M.left, y, { width: CW });
  y = doc.y + 10;

  /* Element rows */
  const COL_CODE = 62, COL_TIER = 30;
  const SCORE_W = 22, SCORE_TOTAL = SCORE_W * SCORES.length;
  const COL_ELT = CW - COL_CODE - COL_TIER - SCORE_TOTAL;
  const COMMENT_H = 44;

  function measureElt(text) {
    doc.font("Helvetica").fontSize(9.5);
    return Math.max(doc.heightOfString(text, { width: COL_ELT - 10 }) + 12, 26);
  }

  function drawStdHeader(g) {
    const hh = 24;
    doc.save().rect(M.left, y, CW, hh).fillColor(CLR.primary).fill().restore();
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#FFFFFF")
       .text(g.info.stdCode + "  ·  " + g.info.chapterName, M.left + 8, y + 6,
             { width: CW - 16, lineBreak: false, height: 14 });
    y += hh;
    const stdH = Math.max(doc.heightOfString(g.info.stdText, { width: CW - 12 }) + 8, 18);
    doc.rect(M.left, y, CW, stdH).lineWidth(0.5).strokeColor(CLR.hair).stroke();
    doc.font("Helvetica-Oblique").fontSize(9.2).fillColor(CLR.ink)
       .text(g.info.stdText, M.left + 6, y + 4, { width: CW - 12 });
    y += stdH;
  }

  function drawRow(code, tier, text) {
    const rowH = measureElt(text);
    const x = M.left;
    doc.lineWidth(0.5).strokeColor(CLR.hair);
    doc.rect(x, y, COL_CODE, rowH).stroke();
    doc.rect(x + COL_CODE, y, COL_TIER, rowH).stroke();
    doc.rect(x + COL_CODE + COL_TIER, y, COL_ELT, rowH).stroke();
    for (let i = 0; i < SCORES.length; i++) {
      const bx = x + COL_CODE + COL_TIER + COL_ELT + i * SCORE_W;
      const clr = CLR.score[SCORES[i]];
      doc.rect(bx, y, SCORE_W, rowH).lineWidth(0.8).strokeColor(clr).stroke();
      doc.font("Helvetica-Bold").fontSize(9).fillColor(clr)
         .text(SCORES[i], bx, y + rowH / 2 - 5, { width: SCORE_W, align: "center", lineBreak: false, height: 12 });
    }
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(CLR.primary)
       .text(code, x + 4, y + 5, { width: COL_CODE - 8, lineBreak: false, height: 12 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(CLR.accent)
       .text(TIER_SHORT[tier] || (tier || "").slice(0, 2).toUpperCase(),
             x + COL_CODE, y + rowH / 2 - 5,
             { width: COL_TIER, align: "center", lineBreak: false, height: 12 });
    doc.font("Helvetica").fontSize(9.5).fillColor(CLR.ink)
       .text(text, x + COL_CODE + COL_TIER + 5, y + 5, { width: COL_ELT - 10 });
    /* Comment box */
    const cy = y + rowH;
    doc.save().rect(x, cy, CW, COMMENT_H).fillColor("#FBFDFC").fill().restore();
    doc.rect(x, cy, CW, COMMENT_H).lineWidth(0.5).strokeColor(CLR.hair).stroke();
    doc.font("Helvetica-Oblique").fontSize(7.5).fillColor(CLR.muted)
       .text("Auditor comments / evidence reviewed", x + 5, cy + 3,
             { width: CW - 10, lineBreak: false, height: 9 });
    doc.strokeColor("#DDECE8").lineWidth(0.3);
    for (let i = 1; i <= 3; i++) {
      doc.moveTo(x + 5, cy + 12 + i * 9).lineTo(x + CW - 5, cy + 12 + i * 9).stroke();
    }
    doc.strokeColor(CLR.hair).lineWidth(0.5);
    y = cy + COMMENT_H + 3;
  }

  /* Paginate without stranding a standard header */
  groups.forEach(g => {
    const firstH = measureElt(g.elements[0].text) + COMMENT_H;
    const stdH = Math.max(doc.heightOfString(g.info.stdText, { width: CW - 12 }) + 8, 18);
    const minFit = 24 + stdH + firstH + 6;
    if (y + minFit > bottom()) newPage(false);
    drawStdHeader(g);
    g.elements.forEach(el => {
      const need = measureElt(el.text) + COMMENT_H;
      if (y + need > bottom()) newPage(false);
      drawRow(g.info.stdCode + "." + el.letter, el.tier, el.text);
    });
    y += 6;
  });

  /* Section helper */
  function sectionHead(title) {
    if (y + 40 > bottom()) newPage(false);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(CLR.primary).text(title, M.left, y);
    y = doc.y + 3;
    doc.moveTo(M.left, y).lineTo(M.left + 60, y).lineWidth(1.4).strokeColor(CLR.accent).stroke();
    y += 6;
    doc.strokeColor(CLR.hair).lineWidth(0.5);
  }

  if (dept.quickList && dept.quickList.length) {
    sectionHead("Quick review items");
    doc.font("Helvetica").fontSize(9.5).fillColor(CLR.ink);
    dept.quickList.forEach(item => {
      const h = Math.max(doc.heightOfString(item, { width: CW - 20 }) + 4, 14);
      if (y + h > bottom()) newPage(false);
      doc.rect(M.left, y + 2, 10, 10).lineWidth(0.7).strokeColor(CLR.accent).stroke();
      doc.text(item, M.left + 16, y + 1, { width: CW - 20 });
      y += h + 2;
    });
  }

  if (dept.kpis && dept.kpis.length) {
    y += 4;
    sectionHead("KPIs to review");
    dept.kpis.forEach(k => {
      doc.font("Helvetica").fontSize(9.5);
      const h = Math.max(doc.heightOfString(k, { width: CW - 16 }) + 2, 14);
      if (y + h > bottom()) newPage(false);
      doc.fillColor(CLR.accent).text("▸", M.left, y + 1, { width: 10, lineBreak: false, height: 12 });
      doc.fillColor(CLR.ink).text(k, M.left + 14, y + 1, { width: CW - 16 });
      y += h + 2;
    });
  }

  /* Findings + signature */
  y += 6;
  if (y + 160 > bottom()) newPage(false);
  sectionHead("Overall findings and CAPA");
  doc.save().rect(M.left, y, CW, 90).fillColor("#FBFDFC").fill().restore();
  doc.rect(M.left, y, CW, 90).lineWidth(0.6).strokeColor(CLR.hair).stroke();
  doc.strokeColor("#DDECE8").lineWidth(0.3);
  for (let i = 1; i <= 7; i++) {
    doc.moveTo(M.left + 5, y + i * 12).lineTo(M.left + CW - 5, y + i * 12).stroke();
  }
  doc.strokeColor(CLR.hair);
  y += 100;

  if (y + 60 > bottom()) newPage(false);
  const halfW = CW / 2 - 6;
  doc.rect(M.left, y, halfW, 54).lineWidth(0.7).strokeColor(CLR.accent).stroke();
  doc.rect(M.left + halfW + 12, y, halfW, 54).stroke();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(CLR.primary)
     .text("Auditor’s signature & date", M.left + 6, y + 4,
           { width: halfW - 12, lineBreak: false, height: 12 });
  doc.text("Auditee acknowledgement (signature & date)", M.left + halfW + 18, y + 4,
           { width: halfW - 12, lineBreak: false, height: 12 });

  /* Footers */
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const fy = doc.page.height - M.bottom + 14;
    doc.font("Helvetica").fontSize(8).fillColor(CLR.muted);
    doc.text("AQcredix — " + dept.name, M.left, fy,
             { width: CW / 2, lineBreak: false, height: 12 });
    doc.text("Page " + (i + 1) + " of " + range.count, M.left + CW / 2, fy,
             { width: CW / 2, align: "right", lineBreak: false, height: 12 });
  }

  return doc;
}

/* --------------------------- handler --------------------------- */

module.exports = async function handler(req, res) {
  const deptKey = String(req.query && req.query.dept || "").trim();
  if (!deptKey) return res.status(400).json({ error: "dept query parameter is required" });

  let data;
  try { data = loadData(); }
  catch (e) { return res.status(500).json({ error: "checklist data failed to load: " + e.message }); }

  const dept = data.SCOPE && data.SCOPE[deptKey];
  if (!dept) return res.status(404).json({ error: "unknown department: " + deptKey });

  const groups = groupByStandard(data.NABH, dept.codes || []);
  const doc = buildPdf(dept, groups);

  /* Buffer to a Buffer so the response Content-Length is correct and the client
   * downloads a complete file rather than a chunked stream. */
  const chunks = [];
  doc.on("data", c => chunks.push(c));
  doc.on("end", () => {
    const buf = Buffer.concat(chunks);
    const fileName = "AQcredix-Blank-" + safeFileName(dept.name) + ".pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Content-Disposition", 'attachment; filename="' + fileName + '"');
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).end(buf);
  });
  doc.on("error", e => {
    if (!res.headersSent) res.status(500).json({ error: "pdf generation failed: " + e.message });
  });
  doc.end();
};
