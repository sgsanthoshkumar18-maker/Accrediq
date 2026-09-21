/* AQcredix — printable blank audit checklist.
 *
 * Reads ?dept=<key> from the URL, resolves the department scope from AUDIT_SCOPE,
 * looks up each element's text and tier from NABH_DATA, and lays out a
 * blank checklist ready for Ctrl/Cmd+P → Save as PDF. Every field the auditor
 * would fill in is present, empty, and dimensionally sized for handwriting.
 */
(function () {
  "use strict";

  var TIER_SHORT = { Core: "CO", Commitment: "CM", Achievement: "AC", Excellence: "EX" };
  var SCORES = [
    { k: "C",  cls: "bc-score-c" },
    { k: "PC", cls: "bc-score-pc" },
    { k: "NC", cls: "bc-score-nc" },
    { k: "NA", cls: "bc-score-na" },
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  function lookupElement(code) {
    /* code = CHAP.N.letter, e.g. MOM.1.a */
    var parts = code.split(".");
    var chap = parts[0], sNum = parts[1], letter = parts[2];
    var chapObj = (window.NABH_DATA && window.NABH_DATA.chapters) ? window.NABH_DATA.chapters[chap] : null;
    if (!chapObj) return null;
    var stdCode = chap + "." + sNum;
    var st = null;
    for (var i = 0; i < chapObj.standards.length; i++) {
      if (chapObj.standards[i].code === stdCode) { st = chapObj.standards[i]; break; }
    }
    if (!st) return null;
    var el = null;
    for (var j = 0; j < (st.elements || []).length; j++) {
      if (st.elements[j].letter === letter) { el = st.elements[j]; break; }
    }
    if (!el) return null;
    return {
      chapter: chap, chapterName: chapObj.name,
      stdCode: st.code, stdText: st.text || "",
      letter: letter, tier: el.category || "", eltText: el.text || "",
    };
  }

  function groupByStandard(codes) {
    var out = [], map = {};
    codes.forEach(function (c) {
      var info = lookupElement(c);
      if (!info) return;
      if (!map[info.stdCode]) {
        map[info.stdCode] = { info: info, elements: [] };
        out.push(map[info.stdCode]);
      }
      map[info.stdCode].elements.push({
        letter: info.letter, tier: info.tier, text: info.eltText,
      });
    });
    return out;
  }

  function scoreCells() {
    return SCORES.map(function (s) {
      return '<div class="bc-elt-cell bc-score ' + s.cls + '">' + s.k + "</div>";
    }).join("");
  }

  function renderElement(g, el) {
    var tier = TIER_SHORT[el.tier] || (el.tier || "").slice(0, 2).toUpperCase();
    return '<div class="bc-elt">' +
      '<div class="bc-elt-row">' +
        '<div class="bc-elt-cell bc-elt-code">' + esc(g.info.stdCode + "." + el.letter) + "</div>" +
        '<div class="bc-elt-cell bc-elt-tier">' + esc(tier) + "</div>" +
        '<div class="bc-elt-cell bc-elt-text">' + esc(el.text) + "</div>" +
        scoreCells() +
      "</div>" +
      '<div class="bc-elt-comment">Auditor comments / evidence reviewed</div>' +
      "</div>";
  }

  function renderStandard(g) {
    return '<section class="bc-std">' +
      '<div class="bc-std-head">' + esc(g.info.stdCode) + " · " + esc(g.info.chapterName) + "</div>" +
      '<div class="bc-std-text">' + esc(g.info.stdText) + "</div>" +
      g.elements.map(function (el) { return renderElement(g, el); }).join("") +
      "</section>";
  }

  function renderChecklist(dept, groups) {
    var quickHtml = "";
    if (dept.quickList && dept.quickList.length) {
      quickHtml =
        '<section class="bc-section">' +
          '<h2>Quick review items</h2>' +
          '<ul class="bc-quick-list">' +
            dept.quickList.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") +
          "</ul>" +
        "</section>";
    }
    var kpisHtml = "";
    if (dept.kpis && dept.kpis.length) {
      kpisHtml =
        '<section class="bc-section">' +
          '<h2>KPIs to review</h2>' +
          '<ul class="bc-kpi-list">' +
            dept.kpis.map(function (k) { return "<li>" + esc(k) + "</li>"; }).join("") +
          "</ul>" +
        "</section>";
    }

    var totalElts = 0;
    groups.forEach(function (g) { totalElts += g.elements.length; });

    var todayStr = new Date().toLocaleDateString();

    return (
      '<header class="bc-sheet-head">' +
        '<div class="bc-sheet-head-l">' +
          '<h1>Internal audit checklist</h1>' +
          '<div class="bc-dept-name">' + esc(dept.name) + "</div>" +
          '<div class="bc-scope-note">Scope: ' + totalElts + " elements from the NABH 5th Edition assessor checklist for this area.</div>" +
        "</div>" +
        '<div class="bc-sheet-head-r">' +
          '<div class="bc-hospital-line"><label>Hospital / facility</label></div>' +
          '<div style="margin-top:6px">Printed ' + esc(todayStr) + "</div>" +
        "</div>" +
      "</header>" +

      '<section class="bc-meta">' +
        '<div class="bc-meta-cell"><label>Auditor name</label></div>' +
        '<div class="bc-meta-cell"><label>Department / area audited</label></div>' +
        '<div class="bc-meta-cell"><label>Date</label></div>' +
        '<div class="bc-meta-cell"><label>Auditee(s) present</label></div>' +
        '<div class="bc-meta-cell"><label>Start time</label></div>' +
        '<div class="bc-meta-cell"><label>End time</label></div>' +
        '<div class="bc-meta-cell bc-meta-full"><label>Auditor’s signature</label>' +
          '<div class="bc-meta-hint">Sign and date on completion.</div></div>' +
      "</section>" +

      '<section class="bc-scoring">' +
        "<h3>Scoring key</h3>" +
        '<div class="bc-key-row">' +
          '<span class="bc-key-chip"><span class="bc-key-box bc-key-c">C</span> Compliant</span>' +
          '<span class="bc-key-chip"><span class="bc-key-box bc-key-pc">PC</span> Partially compliant</span>' +
          '<span class="bc-key-chip"><span class="bc-key-box bc-key-nc">NC</span> Non-compliant</span>' +
          '<span class="bc-key-chip"><span class="bc-key-box bc-key-na">NA</span> Not applicable</span>' +
        "</div>" +
        '<div class="bc-tier-note">Tier abbreviations shown against each element: [CO] Core &nbsp; [CM] Commitment &nbsp; [AC] Achievement &nbsp; [EX] Excellence.</div>' +
        '<div class="bc-disclaim">Standard and element wording is AQcredix’s restatement written by Dr Santhoshkumar; it is not the NABH standard itself.</div>' +
      "</section>" +

      groups.map(renderStandard).join("") +

      quickHtml +
      kpisHtml +

      '<section class="bc-section">' +
        '<h2>Overall findings and CAPA</h2>' +
        '<div class="bc-findings">Findings, agreed corrective actions, owners, and target dates.</div>' +
      "</section>" +

      '<section class="bc-sign">' +
        '<div class="bc-sign-box"><label>Auditor’s signature &amp; date</label></div>' +
        '<div class="bc-sign-box"><label>Auditee acknowledgement (signature &amp; date)</label></div>' +
      "</section>"
    );
  }

  function renderError(msg) {
    var page = document.getElementById("bcPage");
    page.innerHTML =
      '<div style="padding:40px 20px;color:#B02A2A;font-size:14px">' +
        "<strong>Cannot render checklist:</strong> " + esc(msg) +
        '<p style="margin-top:14px;color:#556E7B"><a href="../workspace/audit.html">Back to audits</a></p>' +
      "</div>";
    document.title = "Blank checklist — error";
  }

  function boot() {
    var deptKey = qs("dept");
    if (!deptKey) { renderError('No department specified. Add "?dept=<key>" to the URL.'); return; }
    if (!window.AUDIT_SCOPE) { renderError("Scope data not loaded."); return; }
    if (!window.NABH_DATA) { renderError("Standards data not loaded."); return; }
    var dept = window.AUDIT_SCOPE[deptKey];
    if (!dept) { renderError('Unknown department "' + deptKey + '".'); return; }
    var groups = groupByStandard(dept.codes || []);
    var page = document.getElementById("bcPage");
    page.innerHTML = renderChecklist(dept, groups);
    document.title = "Blank checklist — " + dept.name;

    var pb = document.getElementById("bcPrint");
    if (pb) pb.addEventListener("click", function () { window.print(); });

    /* If ?print=1, kick off the browser print dialog once the page has laid out. */
    if (qs("print") === "1") {
      requestAnimationFrame(function () { setTimeout(function () { window.print(); }, 200); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
