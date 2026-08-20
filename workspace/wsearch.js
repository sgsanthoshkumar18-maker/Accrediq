/* AQcredix Workspace — global search.
 *
 * One field across everything: standards, the 114-document library, equipment, tasks,
 * committees, checklists, findings, incidents, gate passes. With this much in the system,
 * "where was that narcotic register" should not require remembering which page it lives on.
 *
 * Opens on Ctrl/Cmd-K or by clicking the field. Results are grouped by what they are and
 * link straight to the page that holds them.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace;
  var index = null, building = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Built once per page load, lazily — on first open, not at start-up. Nobody should pay
     nine requests for a search they may never use, and the first keystroke is a natural
     moment to spend them. */
  async function build() {
    if (index || building) return;
    building = true;
    var out = [];

    function add(kind, label, name, sub, href, dept) {
      if (!name) return;
      out.push({ kind: kind, label: label, name: String(name), sub: sub || "",
                 href: href, dept: dept || "", hay: (name + " " + (sub || "") + " " + (dept || "")).toLowerCase() });
    }

    /* The standards ship with the page, so they cost nothing and are the single most
       searched thing on the site. */
    if (window.NABH_DATA) {
      Object.keys(window.NABH_DATA.chapters).forEach(function (ch) {
        var c = window.NABH_DATA.chapters[ch];
        (c.standards || []).forEach(function (std) {
          add("standard", "Standard", std.code, c.name, "../standards.html#" + std.code, ch);
          (std.elements || []).forEach(function (e) {
            var code = std.code + "." + e.letter;
            /* Own summary when reviewed, stored wording otherwise — the same accessor the
               rest of the site uses, so search cannot leak text the pages are hiding. */
            var text = window.AQText ? window.AQText.element(code, e.text) : e.text;
            add("element", "Element", code, text, "../standards.html#" + code, ch);
          });
        });
      });
    }

    if (window.DOC_LIBRARY) {
      window.DOC_LIBRARY.forEach(function (d) {
        add("library", d.category === "form" ? "Form" : d.category === "register" ? "Register" : "Checklist",
            d.name, d.why || "", "library.html", d.department);
      });
    }

    var sets = [
      ["assets", "Equipment", function (r) { return [r.name, r.identifier, "register.html", r.department]; }],
      ["compliance_tasks", "Obligation", function (r) { return [r.title, r.category, "calendar.html", r.department]; }],
      ["committees", "Committee", function (r) { return [r.name, r.chairperson, "calendar.html", ""]; }],
      ["checklists", "Checklist", function (r) { return [r.name, r.frequency, "rounds.html", r.department]; }],
      ["capa", "Finding", function (r) { return [r.title, r.status, "capa.html", r.department]; }],
      ["incidents", "Incident", function (r) { return [r.type, r.description, "incidents.html", r.department]; }],
      ["gate_passes", "Gate pass", function (r) { return [r.particulars, "Pass #" + (r.pass_no || ""), "gatepass.html", r.department]; }],
      ["documents", "Document", function (r) { return [r.title, r.doc_code, "documents.html", r.department]; }]
    ];

    await Promise.all(sets.map(async function (set) {
      /* A table that fails must not empty the whole index — partial search beats none. */
      var rows = await S.adapter.list(set[0]).catch(function () { return []; });
      (rows || []).forEach(function (r) {
        var f = set[2](r);
        add(set[0], set[1], f[0], f[1], f[2], f[3]);
      });
    }));

    index = out;
    building = false;
  }

  /* All terms must match, in any field and any order — someone typing "biomedical
     calibration" means both, not the phrase. */
  function search(q) {
    if (!index) return [];
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return index.filter(function (i) {
      return terms.every(function (t) { return i.hay.indexOf(t) >= 0; });
    }).sort(function (a, b) {
      /* A name match beats a match buried in the description: someone searching "narcotic"
         wants the Narcotic Form, not every element that mentions narcotics. */
      var an = a.name.toLowerCase().indexOf(terms[0]) >= 0 ? 0 : 1;
      var bn = b.name.toLowerCase().indexOf(terms[0]) >= 0 ? 0 : 1;
      return an - bn || a.name.length - b.name.length;
    }).slice(0, 40);
  }

  function render(q) {
    var host = document.getElementById("wsqResults");
    if (!host) return;

    if (building) { host.innerHTML = '<div class="wsq-empty">Building the index…</div>'; return; }
    if (!q.trim()) {
      host.innerHTML = '<div class="wsq-empty">Search standards, equipment, forms, ' +
        "committees, findings — everything in the workspace.</div>";
      return;
    }

    var hits = search(q);
    if (!hits.length) {
      host.innerHTML = '<div class="wsq-empty">Nothing matches “' + esc(q) + "”.</div>";
      return;
    }

    var groups = {};
    hits.forEach(function (h) { (groups[h.label] = groups[h.label] || []).push(h); });

    host.innerHTML = Object.keys(groups).map(function (g) {
      return '<div class="wsq-group"><span>' + esc(g) + "</span>" +
        groups[g].slice(0, 8).map(function (h) {
          return '<a class="wsq-row" href="' + esc(h.href) + '">' +
            "<b>" + esc(h.name) + "</b>" +
            (h.sub ? "<span>" + esc(h.sub.slice(0, 90)) + "</span>" : "") +
            (h.dept ? '<em>' + esc(h.dept) + "</em>" : "") +
          "</a>";
        }).join("") + "</div>";
    }).join("");
  }

  function open() {
    var m = document.getElementById("wsqModal");
    if (!m) return;
    m.classList.add("open");
    var input = document.getElementById("wsqInput");
    input.value = "";
    render("");
    input.focus();
    build().then(function () { render(input.value); });
  }
  function close() {
    var m = document.getElementById("wsqModal");
    if (m) m.classList.remove("open");
  }

  function mount() {
    if (document.getElementById("wsqModal")) return;
    var host = document.getElementById("wsSearch");
    if (!host) return;

    host.innerHTML = '<button class="wsq-open" id="wsqOpen" type="button">' +
      '<span aria-hidden="true">\u2315</span> Search… <kbd>Ctrl K</kbd></button>';

    var m = document.createElement("div");
    m.className = "ws-modal wsq";
    m.id = "wsqModal";
    m.innerHTML = '<div class="ws-modal-in wsq-in">' +
      '<input id="wsqInput" placeholder="Search everything…" autocomplete="off">' +
      '<div id="wsqResults"></div></div>';
    document.body.appendChild(m);

    document.getElementById("wsqOpen").addEventListener("click", open);
    document.getElementById("wsqInput").addEventListener("input", function () {
      render(this.value);
    });
    m.addEventListener("click", function (e) { if (e.target === m) close(); });

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      else if (e.key === "Escape") close();
    });
  }

  document.addEventListener("aq:ready", mount);
  if (window.AQWorkspace && window.AQWorkspace.user) mount();

  window.AQSearch = { build: build, search: search };
})();
