/* AQcredix — blank care bundle audit form, for the clipboard.
 *
 * Reads ?bundle=<id> and lays out a grid the ward can carry on a round: one
 * COLUMN per patient, one ROW per element, so a nurse works down the sheet for
 * each bed rather than carrying one page per patient. Twelve patient columns
 * fits an A4 landscape sheet without the boxes becoming too small to tick.
 *
 * The all-or-none rule is printed on the sheet, in red, because this form will
 * outlive anybody's memory of being told, and a paper bundle audit that gets
 * scored 4/5 is the exact failure the digital version exists to prevent.
 */
(function () {
  "use strict";

  var BUNDLES = window.AQ_BUNDLES || [];
  var SHIFTS = window.AQ_BUNDLE_SHIFTS || [];
  var PATIENT_COLS = 12;

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function qs(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  function cols(cls) {
    var out = "";
    for (var i = 0; i < PATIENT_COLS; i++) out += '<td class="' + cls + '"></td>';
    return out;
  }

  function render(b) {
    var headCols = "";
    for (var i = 1; i <= PATIENT_COLS; i++) headCols += '<th class="pt">' + i + "</th>";

    return (
      '<header class="bc-sheet-head">' +
        '<div class="bc-sheet-head-l">' +
          "<h1>Care bundle audit</h1>" +
          '<div class="bc-dept-name">' + esc(b.name) + " · " + esc(b.short) + "</div>" +
          '<div class="bc-scope-note">' + esc(b.target) + " — one column per patient, one sheet per shift.</div>" +
        "</div>" +
        '<div class="bc-sheet-head-r">' +
          '<div class="bc-hospital-line"><label>Hospital / facility</label></div>' +
        "</div>" +
      "</header>" +

      '<section class="bnp-meta">' +
        "<div><label>Ward</label></div>" +
        "<div><label>Date</label></div>" +
        '<div><label>Shift</label><div class="bnp-shift">' +
          SHIFTS.map(function (s) { return "<span>" + esc(s.label) + "</span>"; }).join("") +
        "</div></div>" +
        "<div><label>Recorded by</label></div>" +
      "</section>" +

      '<table class="bnp-grid">' +
        "<thead><tr>" +
          '<th class="bnp-el">Bundle element</th>' + headCols +
        "</tr></thead><tbody>" +
          '<tr><td class="bnp-el bnp-rowhead">Bed / patient reference</td>' + cols("") + "</tr>" +
          b.elements.map(function (el, i) {
            return '<tr><td class="bnp-el">' + (i + 1) + ". " + esc(el.text) + "</td>" +
              cols("bnp-tick") + "</tr>";
          }).join("") +
          '<tr><td class="bnp-el bnp-rowhead">Bundle met? (all-or-none) — Y / N</td>' +
            cols("bnp-verdict") + "</tr>" +
        "</tbody>" +
      "</table>" +

      '<div class="bnp-rule">' +
        "<b>Scoring is all-or-none.</b> Mark each element Y, N or NA. The bundle is met " +
        "only if every <i>applicable</i> element is Y. Four out of five is <b>not</b> 80% — " +
        "it is a bundle not met. Elements marked NA are left out of the count." +
      "</div>" +

      '<section class="bc-section" style="margin-top:14px">' +
        "<h2>Notes and actions</h2>" +
        '<div class="bc-findings">Anything the next shift should know; actions taken for elements marked N.</div>' +
      "</section>" +

      '<section class="bc-sign">' +
        '<div class="bc-sign-box"><label>Nurse signature &amp; time</label></div>' +
        '<div class="bc-sign-box"><label>Verified by (IPC nurse / ward in-charge)</label></div>' +
      "</section>" +

      '<div class="bc-credit">' + esc(b.source) +
        " &nbsp;·&nbsp; Care bundle audit form prepared using AQcredix — aqcredix.com</div>"
    );
  }

  function boot() {
    var page = document.getElementById("bnpPage");
    var key = qs("bundle");
    var b = BUNDLES.filter(function (x) { return x.id === key; })[0];
    if (!b) {
      page.innerHTML = '<div style="padding:40px 20px;color:#B02A2A;font-size:14px">' +
        "<strong>Unknown bundle.</strong> Open this form from the bundle page so it knows " +
        'which one to print. <p style="margin-top:14px"><a href="bundles">Back to bundles</a></p></div>';
      return;
    }
    page.innerHTML = render(b);
    document.title = "Blank audit form — " + b.name;
    var btn = document.getElementById("bnpPrint");
    if (btn) btn.addEventListener("click", function () { window.print(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
