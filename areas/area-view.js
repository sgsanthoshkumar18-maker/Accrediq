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


  // ---- icons -------------------------------------------------------------
  // Inline stroke SVGs so the cards match the department tiles without a font
  // or sprite dependency. currentColor lets the theme drive the colour.
  var I = {
    heart:  '<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9Z"/>',
    pulse:  '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    bed:    '<path d="M3 18V7M3 12h13a4 4 0 0 1 4 4v2M7 11h.01"/>',
    truck:  '<path d="M3 16V7h11v9M14 10h4l3 3v3h-7M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>',
    door:   '<path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M4 21h16M11 12h.01"/>',
    baby:   '<path d="M12 3a5 5 0 0 1 5 5v1a5 5 0 0 1-10 0V8a5 5 0 0 1 5-5ZM9 20l1-4h4l1 4"/>',
    hand:   '<path d="M12 21a6 6 0 0 0 6-6V8M12 21a6 6 0 0 1-6-6V8M9 8V5a1.5 1.5 0 0 1 3 0v3M12 8V4a1.5 1.5 0 0 1 3 0v4"/>',
    sun:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    drop:   '<path d="M12 3s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10Z"/>',
    scissors:'<path d="m6 4 12 12M18 4 6 16M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
    monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    scope:  '<circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
    walk:   '<path d="M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM9 21l2-6 3-2-1-5-4 2-1 3M14 13l2 3 1 5"/>',
    scan:   '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3M7 12h10"/>',
    atom:   '<circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="4"/><ellipse cx="12" cy="12" rx="4" ry="9"/>',
    flask:  '<path d="M9 3v6l-5 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-5-9V3M8 3h8"/>',
    vial:   '<path d="M8 3h8M10 3v12a2 2 0 0 0 4 0V3M8 12h8"/>',
    plate:  '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    radiate:'<path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 20a9 9 0 0 1 14 0M8 16a5 5 0 0 1 8 0"/>',
    apple:  '<path d="M12 7c-3 0-5 2-5 6s2 8 5 8 5-4 5-8-2-6-5-6ZM12 7V3"/>',
    shieldc:'<path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    link:   '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
    tooth:  '<path d="M12 3c-2 0-3 1-5 1S4 6 4 9c0 5 2 12 4 12s2-5 4-5 2 5 4 5 4-7 4-12c0-3-1-5-3-5s-3-1-5-1Z"/>',
    file:   '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    chart:  '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    users:  '<path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.9"/>',
    brief:  '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 8h.01M7 17h.01"/>',
    box:    '<path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5M12 12v10"/>',
    cpu:    '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    pill:   '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7l7-7ZM7 7l10 10"/>',
    wrench: '<path d="M14 7a4 4 0 0 1 5 5l-8 8-4-4 8-8a4 4 0 0 1-1-1Z"/><path d="m6 20-2-2"/>',
    alert:  '<path d="M12 3 2 20h20L12 3ZM12 10v4M12 17h.01"/>',
    broom:  '<path d="M14 3 10 7M12 5l7 7M10 9l-6 6 5 5 6-6M8 15l-3 3"/>',
    shirt:  '<path d="M8 3 4 6v5h3v10h10V11h3V6l-4-3-4 2-4-2Z"/>',
    chef:   '<path d="M7 21h10M6 17h12v4H6zM6 17a5 5 0 0 1-1-9 4 4 0 0 1 7-2 4 4 0 0 1 7 2 5 5 0 0 1-1 9"/>',
    moon:   '<path d="M20 14a8 8 0 1 1-9.9-9.9A7 7 0 0 0 20 14Z"/>',
    steam:  '<path d="M5 20h14M7 16V9a5 5 0 0 1 10 0v7M9 5V3M15 5V3"/>',
    talk:   '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>'
  };

  var ICON_FOR = {
    emergency:"pulse", ambulance:"truck", opd:"door", wards:"bed",
    "special-wards":"baby", palliative:"hand", daycare:"sun", dialysis:"drop",
    icu:"monitor", ot:"scissors", recovery:"bed", endoscopy:"scope",
    rehab:"walk", radiology:"scan", "nuclear-medicine":"atom", cathlab:"heart",
    "collection-centre":"vial", laboratory:"flask", bloodbank:"drop",
    radiotherapy:"radiate", nutrition:"apple", hic:"shieldc",
    "organ-transplant":"link", dental:"tooth", "nursing-area":"heart",
    "document-review":"file", "quality-management":"chart", management:"brief",
    committees:"users", hr:"users", mrd:"file", his:"server",
    frontoffice:"door", biomedical:"cpu", "pharmacy-area":"pill",
    "purchase-area":"box", facility:"wrench", "safety-programme":"alert",
    "housekeeping-area":"broom", "laundry-area":"shirt", kitchen:"chef",
    mortuary:"moon", "cssd-area":"steam",
    "patient-family-interview":"talk", "staff-interview-cop":"talk",
    "staff-interview-hr":"talk", "staff-interview-safety":"talk"
  };

  function icon(id) {
    var g = I[ICON_FOR[id] || "file"] || I.file;
    return '<span class="ar-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + g + "</svg></span>";
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
      return '<button type="button" class="ar-card" data-id="' + esc(a.id) + '">' +
        '<span class="ar-card-n">' + a.n + "</span>" +
        icon(a.id) +
        "<h4>" + esc(a.name) + "</h4>" +
        '<span class="ar-count">' + n + " element group" + (n === 1 ? "" : "s") + "</span></button>";
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
