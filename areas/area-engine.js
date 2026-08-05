/* AQcredix — Clinical / Non-Clinical area renderer.
   Verifies every checklist code against window.NABH_DATA before rendering, so a code that
   does not exist in the 6th Edition is labelled as such rather than silently shown as valid. */
(function () {
  "use strict";

  var GROUP = document.body.getAttribute("data-area-group") || "clinical";

  // ---- element index built from the real 6th-Edition data ------------------
  var INDEX = {};      // "AAC.1.a" -> {code, letter, category, text, sop, standardText}
  var STD = {};        // "AAC.1"   -> standard text

  function buildIndex() {
    if (!window.NABH_DATA || !window.NABH_DATA.chapters) return false;
    Object.keys(window.NABH_DATA.chapters).forEach(function (ck) {
      window.NABH_DATA.chapters[ck].standards.forEach(function (st) {
        STD[st.code] = st.text;
        st.elements.forEach(function (el) {
          INDEX[st.code + "." + el.letter] = {
            code: st.code + "." + el.letter,
            letter: el.letter,
            category: el.category,
            text: el.text,
            sop: el.sop,
            standard: st.code,
            standardText: st.text
          };
        });
      });
    });
    return true;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---- rendering -----------------------------------------------------------
  function renderRow(row) {
    var resolved = [], missing = [];
    (row.codes || []).forEach(function (c) {
      if (INDEX[c]) resolved.push(INDEX[c]); else missing.push(c);
    });

    var html = '<div class="ar-row">';
    html += '<div class="ar-row-head">';
    html += '<span class="ar-src">' + esc(row.src) + "</span>";
    if (resolved.length) {
      html += '<span class="ar-verified" title="Matched against the NABH 6th Edition data on this site">' +
        resolved.length + " verified</span>";
    }
    if (missing.length) {
      html += '<span class="ar-unverified" title="Printed in the 5th-Edition checklist but no element with this code exists in the 6th Edition data">' +
        missing.length + " not in 6th Ed</span>";
    }
    html += "</div>";

    // What the checklist says to look for
    html += '<ul class="ar-points">';
    (row.points || []).forEach(function (p) { html += "<li>" + esc(p) + "</li>"; });
    html += "</ul>";

    // The actual book wording of every element that resolved
    if (resolved.length) {
      html += '<details class="ar-book"><summary>Book wording — ' + resolved.length +
        " element" + (resolved.length === 1 ? "" : "s") + "</summary><div class=\"ar-book-in\">";
      var byStd = {};
      resolved.forEach(function (el) { (byStd[el.standard] = byStd[el.standard] || []).push(el); });
      Object.keys(byStd).forEach(function (sc) {
        html += '<div class="ar-std"><div class="ar-std-h"><span class="sc">' + esc(sc) +
          "</span> " + esc(STD[sc] || "") + "</div>";
        byStd[sc].forEach(function (el) {
          html += '<div class="ar-el">' +
            '<span class="ar-el-l">' + esc(el.letter) + "</span>" +
            '<span class="cat-badge cat-' + esc(el.category) + '">' + esc(el.category) + "</span>" +
            '<span class="ar-el-t">' + esc(el.text) +
            (el.sop ? ' <span class="sop-flag" title="Written SOP explicitly required">SOP*</span>' : "") +
            "</span></div>";
        });
        html += "</div>";
      });
      html += "</div></details>";
    }

    if (missing.length) {
      html += '<p class="ar-missing">Printed in the checklist as ' +
        missing.map(function (m) { return "<code>" + esc(m) + "</code>"; }).join(", ") +
        " — no element with that code exists in the 6th Edition data on this site. " +
        "The 6th Edition renumbered and merged several elements, so treat these as pointers to the " +
        "standard, not to a specific lettered element.</p>";
    }

    html += "</div>";
    return html;
  }

  function renderArea(a) {
    var h = '<div class="ar-head"><span class="ar-n">' + a.n + '</span><h2>' + esc(a.name) + "</h2>";
    if (a.intro) h += "<p>" + esc(a.intro) + "</p>";
    h += "</div>";

    if (a.quick && a.quick.length) {
      h += '<div class="ar-sec"><h3>Quick list — what the assessor scans for</h3><div class="chk-grid">';
      a.quick.forEach(function (q) { h += "<span>" + esc(q) + "</span>"; });
      h += "</div></div>";
    }

    var rowCount = (a.rows || []).length + (a.sub || []).reduce(function (n, s) { return n + s.rows.length; }, 0);
    if (rowCount) {
      h += '<div class="ar-sec"><h3>NABH elements for this area</h3>' +
        '<p class="ar-note">Left column shows the code exactly as printed in the assessor checklist. ' +
        'Expand any row to read the real 6th-Edition wording of each element, its category, and whether ' +
        'a written SOP is required.</p>';
      (a.rows || []).forEach(function (r) { h += renderRow(r); });
      (a.sub || []).forEach(function (s) {
        h += '<h4 class="ar-sub">' + esc(s.h) + "</h4>";
        s.rows.forEach(function (r) { h += renderRow(r); });
      });
      h += "</div>";
    }

    if (a.indicators && a.indicators.length) {
      h += '<div class="ar-sec"><h3>Data collection for quality indicators to be verified</h3><ul class="ddx-list">';
      a.indicators.forEach(function (i) { h += "<li>" + esc(i) + "</li>"; });
      h += "</ul></div>";
    }
    return h;
  }

  // ---- boot ----------------------------------------------------------------
  function init() {
    var tiles = document.getElementById("arTiles");
    var panel = document.getElementById("arPanel");
    if (!tiles || !panel) return;

    if (!buildIndex()) {
      tiles.innerHTML = '<p class="ar-note">Could not load the NABH element data.</p>';
      return;
    }
    var list = (window.AREA_DATA && window.AREA_DATA[GROUP]) || [];
    if (!list.length) {
      tiles.innerHTML = '<p class="ar-note">No areas found for this section.</p>';
      return;
    }

    tiles.innerHTML = list.map(function (a) {
      var n = (a.rows || []).length + (a.sub || []).reduce(function (t, s) { return t + s.rows.length; }, 0);
      return '<button type="button" class="dt-card ar-card" data-id="' + esc(a.id) + '">' +
        '<span class="ar-card-n">' + a.n + "</span>" +
        "<h4>" + esc(a.name) + "</h4>" +
        '<span class="dt-count">' + n + " element group" + (n === 1 ? "" : "s") + "</span></button>";
    }).join("");

    function open(id) {
      var a = list.filter(function (x) { return x.id === id; })[0];
      if (!a) return;
      panel.innerHTML = renderArea(a);
      panel.classList.add("is-open");
      Array.prototype.forEach.call(tiles.querySelectorAll(".ar-card"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-id") === id);
      });
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      if (history.replaceState) history.replaceState(null, "", "#" + id);
    }

    tiles.addEventListener("click", function (e) {
      var b = e.target.closest(".ar-card");
      if (b) open(b.getAttribute("data-id"));
    });

    var hash = (location.hash || "").replace("#", "");
    if (hash && list.some(function (x) { return x.id === hash; })) open(hash);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
