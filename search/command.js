/* AQcredix — command bar. Ctrl+K (or Cmd+K) anywhere.
 *
 * Jumps to any of ~700 things the site already knows about: NABH elements, standards,
 * chapters, departments, committees, KPIs and the workspace pages. Built entirely from
 * datasets already loaded on the page — no index to maintain, nothing to keep in step.
 *
 * The index is built LAZILY, on first open. Walking 640 elements at load time on every
 * page would tax the many visits that never press the shortcut, and on a low-end hospital
 * desktop that cost lands on first paint where it is most visible.
 */
(function () {
  "use strict";

  var idx = null, open = false, results = [], sel = 0, box, input, list;

  function base() {
    var b = document.body.getAttribute("data-base");
    return b || "";
  }

  /* -------------------------------- the index -------------------------------- */

  function build() {
    var out = [], b = base();

    var D = window.NABH_DATA;
    if (D && D.chapters) {
      Object.keys(D.chapters).forEach(function (code) {
        var ch = D.chapters[code];
        out.push({ t: code + " — " + ch.name, s: "Chapter", k: code + " " + ch.name,
                   u: b + "standards.html?chapter=" + code });
        (ch.standards || []).forEach(function (std) {
          out.push({ t: std.code + " — " + std.text, s: "Standard", k: std.code + " " + std.text,
                     u: b + "standards.html?chapter=" + code + "#" + std.code });
          (std.elements || []).forEach(function (e) {
            var c = std.code + "." + e.letter;
            out.push({
              t: c + " — " + e.text,
              s: e.sop ? "Element · SOP required" : "Element",
              k: c + " " + e.text + (e.sop ? " sop" : ""),
              u: b + "standards.html?chapter=" + code + "#" + c
            });
          });
        });
      });
    }

    (window.DEPARTMENT_DATA || []).forEach(function (d) {
      out.push({ t: d.name, s: "Department", k: d.name + " " + (d.short || ""),
                 u: b + "department.html?d=" + encodeURIComponent(d.slug || d.name) });
    });

    (window.COMMITTEE_DATA || []).forEach(function (c) {
      out.push({ t: c.name, s: "Committee · " + (c.frequency || ""),
                 k: c.name + " " + (c.short || ""),
                 u: b + "committee.html?c=" + encodeURIComponent(c.slug) });
    });

    [
      ["Readiness", "workspace/workspace.html"], ["Internal Audit", "workspace/audit.html"],
      ["Calendar — committees and recurring tasks", "workspace/calendar.html"],
      ["Incidents", "workspace/incidents.html"], ["NC & CAPA", "workspace/capa.html"],
      ["Documents", "workspace/documents.html"], ["Team", "workspace/team.html"],
      ["Standards browser", "standards.html"], ["Departments", "departments.html"],
      ["KPI library", "kpi.html"], ["Committees", "committees.html"],
      ["ICD-11 search", "icd.html"], ["My progress", "profile.html"]
    ].forEach(function (p) {
      out.push({ t: p[0], s: "Page", k: p[0], u: b + p[1] });
    });

    out.forEach(function (r) { r.k = r.k.toLowerCase(); });
    return out;
  }

  /* -------------------------------- searching -------------------------------- */

  /* Scored, not merely filtered. "COP.8" should put the element COP.8.a above a standard
     whose body text happens to contain "cop", and an exact code match should win
     outright — a code typed in full is an unambiguous request. */
  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) {
      return idx.filter(function (r) { return r.s === "Page"; }).slice(0, 8);
    }
    var terms = q.split(/\s+/);
    var hits = [];
    for (var i = 0; i < idx.length; i++) {
      var r = idx[i], score = 0, ok = true;
      for (var j = 0; j < terms.length; j++) {
        var p = r.k.indexOf(terms[j]);
        if (p < 0) { ok = false; break; }
        score += p === 0 ? 100 : (p < 12 ? 40 : 10);
      }
      if (!ok) continue;
      if (r.k.indexOf(q) === 0) score += 220;
      // Shorter titles are more specific for the same match quality.
      score -= Math.min(30, r.t.length / 8);
      hits.push({ r: r, score: score });
    }
    hits.sort(function (a, b) { return b.score - a.score; });
    return hits.slice(0, 24).map(function (h) { return h.r; });
  }

  /* --------------------------------- the UI --------------------------------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ensure() {
    if (box) return;
    box = document.createElement("div");
    box.className = "cmdk";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Search AQcredix");
    box.innerHTML =
      '<div class="cmdk-box">' +
        '<input class="cmdk-input" type="text" autocomplete="off" spellcheck="false" ' +
          'placeholder="Search elements, departments, committees, KPIs…" ' +
          'aria-label="Search" role="combobox" aria-expanded="true" aria-controls="cmdkList">' +
        '<div class="cmdk-list" id="cmdkList" role="listbox"></div>' +
        '<div class="cmdk-foot"><span><kbd>\u2191</kbd><kbd>\u2193</kbd> move</span>' +
          "<span><kbd>\u21b5</kbd> open</span><span><kbd>esc</kbd> close</span></div>" +
      "</div>";
    document.body.appendChild(box);
    input = box.querySelector(".cmdk-input");
    list = box.querySelector(".cmdk-list");

    input.addEventListener("input", function () { run(input.value); });
    box.addEventListener("click", function (e) { if (e.target === box) hide(); });
    list.addEventListener("click", function (e) {
      var row = e.target.closest(".cmdk-row");
      if (row) go(Number(row.dataset.i));
    });
  }

  function run(q) {
    results = search(q);
    sel = 0;
    paint();
  }

  function paint() {
    if (!results.length) {
      list.innerHTML = '<div class="cmdk-none">Nothing matched. Try an element code like ' +
        "<b>COP.8.d</b>, a department, or a committee.</div>";
      return;
    }
    list.innerHTML = results.map(function (r, i) {
      return '<div class="cmdk-row' + (i === sel ? " is-sel" : "") + '" data-i="' + i +
        '" role="option" aria-selected="' + (i === sel) + '">' +
        '<span class="cmdk-t">' + esc(r.t) + "</span>" +
        '<span class="cmdk-s">' + esc(r.s) + "</span></div>";
    }).join("");
    var cur = list.querySelector(".is-sel");
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
  }

  function go(i) {
    var r = results[i];
    if (!r) return;
    hide();
    location.href = r.u;
  }

  function show() {
    ensure();
    if (!idx) idx = build();
    open = true;
    box.classList.add("is-open");
    /* Lock the page behind the dialog. Without this the list scrolls the page underneath
       once it reaches its end, which on a long standards page loses the reader's place. */
    document.documentElement.style.overflow = "hidden";
    input.value = "";
    run("");
    setTimeout(function () { input.focus(); }, 20);
  }

  function hide() {
    if (!open) return;
    open = false;
    box.classList.remove("is-open");
    document.documentElement.style.overflow = "";
  }

  /* -------------------------------- shortcuts -------------------------------- */

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      open ? hide() : show();
      return;
    }
    if (!open) {
      /* "/" is the other conventional search key, but only when the person is not
         already typing — otherwise it hijacks every slash in an incident description. */
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) &&
          !document.activeElement.isContentEditable) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); hide(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); paint(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); }
    else if (e.key === "Enter") { e.preventDefault(); go(sel); }
  });

  window.AQCommand = { open: show, close: hide };
})();
