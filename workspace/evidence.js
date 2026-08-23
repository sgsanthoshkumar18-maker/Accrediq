/* AQcredix — evidence for an element.
 *
 * THE PROBLEM THIS SOLVES.
 * On assessment day the assessor names an element — "show me IPC.2.c" — and the quality
 * manager has to produce the proof while somebody watches. The proof exists: the SOP is
 * in Documents, the audit finding is in Audits, the walk is in Rounds, the corrective
 * action is in CAPA, the calibration certificate is on an asset, the training is in the
 * training register. Six places, four tabs, and a silence that reads as unpreparedness.
 *
 * Nothing new is collected here. Every record already carries the element it evidences —
 * capa.element_code, assets.element_code, checklists.element_code, documents.elements,
 * training_records.element_code, incidents.element_code, and audits keep their per-element
 * findings inside payload->findings. This page is the join nobody had written.
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 * It does not score, judge or claim the element is met. Whether the evidence is sufficient
 * is the assessor's decision, and a platform that told a hospital "you are compliant" on
 * the strength of a document existing would be doing them real harm. It shows what is
 * there, says plainly when nothing is, and leaves the conclusion to the person qualified
 * to draw it.
 */
(function () {
  "use strict";

  var W = window.AQWorkspace, S = window.AQStore;
  if (!W || !S) return;

  var CACHE = {};
  var current = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function fmtDate(d) {
    if (!d) return "—";
    var x = new Date(d);
    return isNaN(x) ? String(d) : x.toLocaleDateString("en-IN",
      { day: "2-digit", month: "short", year: "numeric" });
  }

  /* Element codes are written many ways in the wild — "IPC 2 c", "ipc.2.c", "IPC-2-C".
     A quality manager typing what the assessor just said out loud should not have to
     match our punctuation. */
  function normCode(raw) {
    return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
  function sameCode(a, b) { return normCode(a) === normCode(b) && normCode(a) !== ""; }

  /* documents.elements is a comma-separated list rather than a single code, because one
     SOP legitimately evidences several elements. */
  function docMatches(doc, code) {
    return String(doc.elements || "").split(",").some(function (c) { return sameCode(c, code); });
  }

  function elementMeta(code) {
    var out = { code: code, text: null, chapter: null, standard: null, category: null };
    var D = window.NABH_DATA;
    if (!D || !D.chapters) return out;
    Object.keys(D.chapters).forEach(function (ch) {
      (D.chapters[ch].standards || []).forEach(function (std) {
        (std.elements || []).forEach(function (el) {
          if (sameCode(std.code + "." + el.letter, code)) {
            out.text = el.text;
            out.category = el.category;
            out.chapter = D.chapters[ch].name;
            out.standard = std.code + " — " + std.text;
            out.code = std.code + "." + el.letter;
          }
        });
      });
    });
    return out;
  }

  /* ---------------------------------------------------------------- *
   * Loading. Every table is fetched once and reused, because someone
   * answering an assessor works through several elements in a row and
   * must not wait for a round trip on each.
   * ---------------------------------------------------------------- */
  function loadAll() {
    var wanted = ["documents", "capa", "assets", "rounds", "checklists",
                  "incidents", "training_records", "audits"];
    return Promise.all(wanted.map(function (t) {
      return S.adapter.list(t).catch(function () { return []; });
    })).then(function (sets) {
      wanted.forEach(function (t, i) { CACHE[t] = sets[i] || []; });
      return CACHE;
    });
  }

  /* ---------------------------------------------------------------- *
   * The gather. One function per record type so each can explain what
   * it is looking at, and so a table that is empty or fails to load
   * removes only its own section.
   * ---------------------------------------------------------------- */
  function gather(code) {
    var g = {};

    g.documents = (CACHE.documents || []).filter(function (d) { return docMatches(d, code); });

    g.capa = (CACHE.capa || []).filter(function (c) { return sameCode(c.element_code, code); });

    g.assets = (CACHE.assets || []).filter(function (a) { return sameCode(a.element_code, code); });

    g.training = (CACHE.training_records || []).filter(function (t) {
      return sameCode(t.element_code, code);
    });

    g.incidents = (CACHE.incidents || []).filter(function (i) { return sameCode(i.element_code, code); });

    /* Rounds reach an element through the checklist they were performed against, which is
       where the element code lives — a round is evidence for whatever it was checking. */
    var lists = (CACHE.checklists || []).filter(function (c) { return sameCode(c.element_code, code); });
    var ids = lists.map(function (c) { return c.id; });
    g.rounds = (CACHE.rounds || []).filter(function (r) { return ids.indexOf(r.checklist_id) > -1; });
    g.checklists = lists;

    /* Audits store per-element findings inside payload.findings, keyed by element code.
       Pulled out here so a finding recorded during a departmental audit is visible from
       the element rather than only from the audit it happened to be part of. */
    g.audits = [];
    (CACHE.audits || []).forEach(function (a) {
      var f = a.payload && a.payload.findings;
      if (!f) return;
      Object.keys(f).forEach(function (k) {
        if (!sameCode(k, code)) return;
        g.audits.push({ audit: a, finding: f[k] });
      });
    });

    g.total = g.documents.length + g.capa.length + g.assets.length + g.training.length +
              g.incidents.length + g.rounds.length + g.audits.length;
    return g;
  }

  /* ---------------------------------------------------------------- *
   * Rendering
   * ---------------------------------------------------------------- */
  function section(title, count, rowsHtml, emptyText) {
    return '<div class="ev-block">' +
      '<h3>' + esc(title) + ' <span class="ev-count">' + count + '</span></h3>' +
      (count ? '<div class="ev-rows">' + rowsHtml + "</div>"
             : '<p class="ev-none">' + esc(emptyText) + "</p>") +
      "</div>";
  }

  function row(main, meta, tag) {
    return '<div class="ev-row">' +
      '<div class="ev-main">' + main + "</div>" +
      '<div class="ev-meta">' + meta + "</div>" +
      (tag ? '<span class="ev-tag ' + tag.cls + '">' + esc(tag.text) + "</span>" : "") +
      "</div>";
  }

  function render(code) {
    var host = document.getElementById("evPanel");
    var meta = elementMeta(code);
    var g = gather(code);
    current = code;

    var head =
      '<div class="ev-head">' +
        '<span class="eyebrow">' + esc(meta.code) +
          (meta.category ? ' &middot; <span class="cat-badge cat-' + esc(meta.category) + '">' +
            esc(meta.category) + "</span>" : "") + "</span>" +
        (meta.text ? "<h2>" + esc(meta.text) + "</h2>"
                   : '<h2 class="ev-unknown">No element with that code</h2>') +
        (meta.chapter ? '<p class="ev-ctx">' + esc(meta.chapter) +
            (meta.standard ? " &middot; " + esc(meta.standard) : "") + "</p>" : "") +
      "</div>";

    if (!meta.text) {
      host.innerHTML = head +
        '<p class="ev-none">Check the code and try again — the explorer lists all 639. ' +
        "Codes look like AAC.1.a or IPC.2.c.</p>";
      return;
    }

    var summary =
      '<div class="ev-summary ' + (g.total ? "has" : "none") + '">' +
        (g.total
          ? "<b>" + g.total + "</b> record" + (g.total === 1 ? "" : "s") +
            " held against this element."
          : "<b>Nothing recorded yet against this element.</b> That is not the same as " +
            "non-compliance — it means nothing here has been tagged with this code.") +
      "</div>";

    var body = "";

    body += section("Documents", g.documents.length,
      g.documents.map(function (d) {
        return row(esc(d.title || d.doc_code || "Untitled"),
          [d.doc_code, d.doc_type, d.department, "v" + (d.version || "1.0")]
            .filter(Boolean).map(esc).join(" &middot; "),
          d.status === "approved" ? { cls: "ok", text: "Approved" }
                                  : { cls: "warn", text: d.status || "draft" });
      }).join(""),
      "No SOP, policy or manual is tagged with this element.");

    body += section("Audit findings", g.audits.length,
      g.audits.map(function (x) {
        var f = x.finding || {};
        var v = String(f.result || f.status || f.verdict || "").toLowerCase();
        var tag = v.indexOf("nc") > -1 || v.indexOf("non") > -1 ? { cls: "nc", text: "NC" }
                : v.indexOf("part") > -1 ? { cls: "warn", text: "Partial" }
                : v ? { cls: "ok", text: v } : null;
        return row(esc(x.audit.department_name || x.audit.department_id || "Audit"),
          esc(fmtDate(x.audit.started_at)) + " &middot; " + esc(x.audit.auditor_name || "—") +
            (f.note ? " &middot; " + esc(f.note) : ""),
          tag);
      }).join(""),
      "This element has not been covered in a recorded internal audit.");

    body += section("Rounds", g.rounds.length,
      g.rounds.map(function (r) {
        return row(esc(r.area || "Round"),
          esc(fmtDate(r.performed_on)) + " &middot; " + esc(r.performed_by || "—"),
          r.passed === true ? { cls: "ok", text: "Passed" }
            : r.passed === false ? { cls: "nc", text: "Failed" } : null);
      }).join(""),
      g.checklists.length
        ? "A checklist covers this element but no round has been walked yet."
        : "No checklist is tagged with this element.");

    body += section("Corrective actions", g.capa.length,
      g.capa.map(function (c) {
        return row(esc(c.title || "CAPA"),
          [c.department, c.owner, c.due_date ? "due " + fmtDate(c.due_date) : null]
            .filter(Boolean).map(esc).join(" &middot; "),
          c.status === "closed" ? { cls: "ok", text: "Closed" }
                                : { cls: "warn", text: c.status || "open" });
      }).join(""),
      "No CAPA has been raised against this element.");

    body += section("Equipment, licences &amp; certificates", g.assets.length,
      g.assets.map(function (a) {
        return row(esc(a.name || "Asset"),
          [a.identifier, a.department, a.location].filter(Boolean).map(esc).join(" &middot; "),
          a.status === "active" ? { cls: "ok", text: "Active" }
                                : { cls: "warn", text: a.status || "—" });
      }).join(""),
      "No equipment, licence or certificate is tagged with this element.");

    body += section("Training", g.training.length,
      g.training.map(function (t) {
        var lapsed = t.valid_until && new Date(t.valid_until) < new Date();
        return row(esc(t.person_name || "—") +
            ' <span class="ev-sub">' + esc(t.training_name || t.training_type || "") + "</span>",
          [t.department, t.completed_on ? "done " + fmtDate(t.completed_on) : null,
           t.valid_until ? "valid to " + fmtDate(t.valid_until) : "no expiry"]
            .filter(Boolean).map(esc).join(" &middot; "),
          lapsed ? { cls: "nc", text: "Expired" } : { cls: "ok", text: "Valid" });
      }).join(""),
      "No training record is tagged with this element.");

    body += section("Incidents", g.incidents.length,
      g.incidents.map(function (i) {
        return row(esc(i.reference || "Incident"),
          [i.department, i.classification, i.occurred_at ? fmtDate(i.occurred_at) : null]
            .filter(Boolean).map(esc).join(" &middot; "),
          i.status === "closed" ? { cls: "ok", text: "Closed" }
                                : { cls: "warn", text: i.status || "open" });
      }).join(""),
      "No incident is linked to this element.");

    host.innerHTML = head + summary +
      '<div class="ev-actions"><button type="button" class="btn btn-ghost btn-sm" id="evPrint">' +
      "Print this page</button></div>" + body;

    var p = document.getElementById("evPrint");
    if (p) p.addEventListener("click", function () { window.print(); });
  }

  /* ---------------------------------------------------------------- *
   * The picker
   * ---------------------------------------------------------------- */
  function mountPicker() {
    var host = document.getElementById("evPick");
    host.innerHTML =
      '<form class="ev-form" id="evForm">' +
        '<label for="evCode">Element code</label>' +
        '<input id="evCode" type="text" placeholder="IPC.2.c" autocomplete="off" ' +
          'autocapitalize="characters" spellcheck="false">' +
        '<button type="submit" class="btn btn-accent">Show evidence</button>' +
      "</form>" +
      '<p class="ev-hint">Type it the way the assessor says it &mdash; IPC 2 c, ipc.2.c and ' +
        "IPC-2-C all find the same element.</p>";

    document.getElementById("evForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = document.getElementById("evCode").value.trim();
      if (!code) return;
      render(code);
      /* Put it in the address bar so a quality manager can keep a tab open per element,
         or send a colleague straight to one. */
      try { history.replaceState(null, "", "?el=" + encodeURIComponent(code)); } catch (e2) {}
    });
  }

  function start() {
    mountPicker();
    var host = document.getElementById("evPanel");
    host.innerHTML = '<p class="ev-none">Enter an element code above.</p>';

    loadAll().then(function () {
      var q = new URLSearchParams(location.search).get("el");
      if (q) {
        document.getElementById("evCode").value = q;
        render(q);
      }
    }).catch(function (e) {
      host.innerHTML = '<p class="ev-none">Could not load your records: ' +
        esc(String(e && e.message || e)) + "</p>";
    });
  }

  /* The same start-up every workspace module uses: pass the gate, hide it, clear the
     shimmer, show the body, draw the nav. Copied rather than invented so a change to the
     shell reaches this page too. */
  async function init() {
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("evidence");
    if (W.renderModeNotice) W.renderModeNotice();
    start();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
