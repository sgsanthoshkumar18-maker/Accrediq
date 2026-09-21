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

  var HOSPITAL_STORAGE_KEY = "aq-blank-checklist-hospital";
  function loadHospital() {
    try { return localStorage.getItem(HOSPITAL_STORAGE_KEY) || ""; } catch (e) { return ""; }
  }
  function saveHospital(name) {
    try { localStorage.setItem(HOSPITAL_STORAGE_KEY, name || ""); } catch (e) {}
  }

  /* Prompt the auditor for the hospital name. Returns a Promise that resolves to
   * the trimmed name (may be empty if they skipped). A one-shot modal is used
   * instead of window.prompt() because the native prompt includes "This page
   * says:" and the site URL, which reads amateurish for a document that goes
   * back to a hospital board. */
  function askHospitalName(initial) {
    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "bc-modal-overlay no-print";
      overlay.innerHTML =
        '<div class="bc-modal" role="dialog" aria-modal="true" aria-labelledby="bcModalTitle">' +
          '<h3 id="bcModalTitle">Prepare checklist</h3>' +
          '<p>Enter the hospital or facility name. It will appear as the header on every page of the printed checklist so the document belongs to your records.</p>' +
          '<label for="bcHospitalInput">Hospital / facility name</label>' +
          '<input id="bcHospitalInput" type="text" autocomplete="organization" placeholder="e.g. Voluntary Health Services" value="' + esc(initial || "") + '" />' +
          '<div class="bc-modal-actions">' +
            '<button type="button" class="bc-btn bc-ghost" id="bcModalSkip">Skip &mdash; leave blank</button>' +
            '<button type="button" class="bc-btn bc-primary" id="bcModalOk">Download PDF</button>' +
          "</div>" +
        "</div>";
      document.body.appendChild(overlay);
      var input = overlay.querySelector("#bcHospitalInput");
      var ok = overlay.querySelector("#bcModalOk");
      var skip = overlay.querySelector("#bcModalSkip");
      setTimeout(function () { input.focus(); input.select(); }, 30);
      function close(val) { overlay.remove(); resolve(val); }
      ok.addEventListener("click", function () { close(String(input.value || "").trim()); });
      skip.addEventListener("click", function () { close(""); });
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); ok.click(); }
        if (e.key === "Escape") { e.preventDefault(); skip.click(); }
      });
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) skip.click();
      });
    });
  }

  function applyHospitalName(name) {
    var box = document.querySelector(".bc-hospital-line");
    if (!box) return;
    if (name) {
      box.innerHTML =
        '<label>Hospital / facility</label>' +
        '<div class="bc-hospital-name">' + esc(name) + '</div>';
      box.classList.add("bc-hospital-filled");
    } else {
      box.innerHTML = '<label>Hospital / facility</label>';
      box.classList.remove("bc-hospital-filled");
    }
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
      "</section>" +
      /* Small trailing credit line: this checklist is the hospital’s own record;
       * AQcredix is credited but the header identifies the hospital. */
      '<div class="bc-credit">Internal audit checklist prepared using AQcredix — aqcredix.com</div>'
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

    /* Client-side PDF export.
     *
     * The site's Hobby plan on Vercel is capped at 12 serverless functions and it is
     * already at that limit, so PDF generation happens in the browser instead. html2pdf
     * (html2canvas + jsPDF) rasterises the sheet exactly as it appears here, so the PDF
     * matches the preview one-for-one. The library is ~800 KB compressed and only
     * loaded when the user clicks Download PDF, or once on auto-open (?auto=1). */
    var LIB_SRCS = [
      "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js",
      "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.2/dist/html2pdf.bundle.min.js"
    ];
    var libPromise = null;
    function loadLib() {
      if (libPromise) return libPromise;
      libPromise = new Promise(function (resolve, reject) {
        var tried = 0;
        function next() {
          if (tried >= LIB_SRCS.length) { reject(new Error("Could not load PDF library")); return; }
          var s = document.createElement("script");
          s.src = LIB_SRCS[tried++];
          s.onload = function () { resolve(window.html2pdf); };
          s.onerror = function () { s.remove(); next(); };
          document.head.appendChild(s);
        }
        next();
      });
      return libPromise;
    }

    function slug(s) {
      return String(s || "checklist").replace(/[^A-Za-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "").slice(0, 60) || "checklist";
    }

    var busy = false;
    function renderAndSave() {
      var btn = document.getElementById("bcPrint");
      var origLabel = btn ? btn.textContent : null;
      if (btn) { btn.textContent = "Preparing PDF…"; btn.disabled = true; }
      var page = document.getElementById("bcPage");
      return loadLib().then(function (html2pdf) {
        var deptName = (dept && dept.name) || "Checklist";
        var hospital = loadHospital();
        var hSlug = hospital ? slug(hospital) + "-" : "";
        var fileName = "Audit-Checklist-" + hSlug + slug(deptName) + ".pdf";
        /* html2canvas needs allowTaint/useCORS off for local paint; scale 2 for
         * a crisp raster. jsPDF page break rule uses .bc-std and .bc-elt from
         * the print stylesheet so standards and elements never split. */
        return html2pdf().set({
          margin:      [8, 10, 8, 10],
          filename:    fileName,
          image:       { type: "jpeg", quality: 0.95 },
          html2canvas: { scale: 1.5, useCORS: true, logging: false, backgroundColor: "#FFFFFF" },
          jsPDF:       { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak:   { mode: ["css", "legacy"], avoid: [".bc-std", ".bc-elt", ".bc-section", ".bc-sign"] }
        }).from(page).save();
      }).then(function () {
        if (btn) { btn.textContent = origLabel || "Download PDF"; btn.disabled = false; }
      }).catch(function (e) {
        console.error(e);
        alert("Could not generate the PDF. Try clicking again, or use Print this page as a fallback.");
        if (btn) { btn.textContent = origLabel || "Download PDF"; btn.disabled = false; }
      });
    }

    function downloadPdf() {
      if (busy) return; busy = true;
      askHospitalName(loadHospital()).then(function (name) {
        saveHospital(name);
        applyHospitalName(name);
        return renderAndSave();
      }).then(function () { busy = false; }, function () { busy = false; });
    }

    var pb = document.getElementById("bcPrint");
    if (pb) pb.addEventListener("click", downloadPdf);
    var pp = document.getElementById("bcPrintPage");
    if (pp) pp.addEventListener("click", function () { window.print(); });

    /* If ?auto=1, offer the download automatically after layout settles so the
     * picker's link works as one-click download-and-save. The prompt still
     * appears — the auditor confirms the hospital name and hits Download. */
    if (qs("auto") === "1") {
      requestAnimationFrame(function () { setTimeout(downloadPdf, 400); });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
