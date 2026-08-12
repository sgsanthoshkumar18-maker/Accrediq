/* AQcredix Workspace — Document control register (IMS.6.a).
   Tracks version, approval state, effective and review dates for every controlled
   document, and flags the ones that have gone past their review date. */
(function () {
  "use strict";
  var S = window.AQStore, W = window.AQWorkspace, esc;

  var TYPES = ["Policy", "SOP", "Manual", "Form", "Plan", "Record", "Checklist"];
  var STATUS = ["draft", "under_review", "approved", "obsolete"];
  var LBL = { under_review: "Under review" };
  var rows = [], filters = { status: "", type: "", dept: "", q: "", dueOnly: false };

  function lbl(s) { return LBL[s] || (String(s).charAt(0).toUpperCase() + String(s).slice(1)); }
  function reviewDue(r) {
    if (!r.review_date || r.status === "obsolete") return false;
    return new Date(r.review_date) < new Date(new Date().toDateString());
  }
  function reviewSoon(r) {
    if (!r.review_date || r.status === "obsolete") return false;
    var d = new Date(r.review_date), n = new Date();
    return d >= n && (d - n) / 86400000 <= 30;
  }

  function visible() {
    return rows.filter(function (r) {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.type && r.doc_type !== filters.type) return false;
      if (filters.dept && r.department !== filters.dept) return false;
      if (filters.dueOnly && !reviewDue(r)) return false;
      if (filters.q) {
        var q = filters.q.toLowerCase();
        if ((r.title || "").toLowerCase().indexOf(q) < 0 &&
            (r.doc_code || "").toLowerCase().indexOf(q) < 0 &&
            (r.elements || "").toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      return (reviewDue(b) - reviewDue(a)) || String(a.doc_code || "").localeCompare(String(b.doc_code || ""));
    });
  }

  function render() {
    var overdue = rows.filter(reviewDue), soon = rows.filter(reviewSoon);
    document.getElementById("docStats").innerHTML =
      '<div class="ws-stat"><span class="n">' + rows.length + '</span><span class="l">Documents</span></div>' +
      '<div class="ws-stat ws-stat-ok"><span class="n">' +
        rows.filter(function (r) { return r.status === "approved"; }).length + '</span><span class="l">Approved</span></div>' +
      '<div class="ws-stat ws-stat-warn"><span class="n">' +
        rows.filter(function (r) { return r.status === "draft" || r.status === "under_review"; }).length +
        '</span><span class="l">Draft or in review</span></div>' +
      '<div class="ws-stat ws-stat-bad"><span class="n">' + overdue.length + '</span><span class="l">Review overdue</span>' +
        '<span class="s">Past the date they should have been reviewed</span></div>' +
      '<div class="ws-stat"><span class="n">' + soon.length + '</span><span class="l">Review within 30 days</span></div>';

    var host = document.getElementById("docList");
    var list = visible(), ro = !W.canEdit();
    if (!list.length) {
      host.innerHTML = '<p class="ws-empty">No documents in the register yet.</p>';
      return;
    }
    host.innerHTML =
      '<table class="ws-table"><thead><tr>' +
      "<th>Code</th><th>Title</th><th>Type</th><th>Dept</th><th>Ver</th><th>Status</th>" +
      "<th>Effective</th><th>Review</th><th>Elements</th>" + (ro ? "" : "<th></th>") +
      "</tr></thead><tbody>" +
      list.map(function (r) {
        var due = reviewDue(r), soonf = reviewSoon(r);
        return "<tr" + (due ? ' class="row-overdue"' : soonf ? ' class="row-soon"' : "") + ' data-id="' + esc(r.id) + '">' +
          "<td class=\"mono\">" + esc(r.doc_code || "—") + "</td>" +
          "<td><b>" + esc(r.title) + "</b>" + (r.notes ? '<div class="td-sub">' + esc(r.notes) + "</div>" : "") + "</td>" +
          "<td>" + esc(r.doc_type || "—") + "</td>" +
          "<td>" + esc(r.department || "—") + "</td>" +
          "<td class=\"mono\">" + esc(r.version || "1.0") + "</td>" +
          '<td><span class="doc-st st-' + esc(r.status) + '">' + esc(lbl(r.status || "draft")) + "</span></td>" +
          "<td>" + esc(W.fmtDate(r.effective_date)) + "</td>" +
          "<td>" + esc(W.fmtDate(r.review_date)) + (due ? ' <span class="capa-over">due</span>' : "") + "</td>" +
          "<td class=\"mono small\">" + esc(r.elements || "—") + "</td>" +
          (ro ? "" : '<td class="nowrap"><button type="button" class="btn btn-sm" data-act="edit">Edit</button>' +
            '<button type="button" class="btn btn-sm btn-danger" data-act="del">×</button></td>') +
          "</tr>";
      }).join("") + "</tbody></table>";

    if (ro) return;
    host.querySelectorAll("tr[data-id]").forEach(function (tr) {
      var id = tr.getAttribute("data-id");
      var row = rows.filter(function (r) { return r.id === id; })[0];
      tr.querySelectorAll("[data-act]").forEach(function (b) {
        b.addEventListener("click", async function () {
          if (b.getAttribute("data-act") === "edit") return openForm(row);
          if (!confirm("Remove this document from the register?")) return;
          await S.deleteDocument(id);
          rows = rows.filter(function (r) { return r.id !== id; });
          render(); W.toast("Removed");
        });
      });
    });
  }

  function openForm(row) {
    row = row || { status: "draft", version: "1.0" };
    var m = document.getElementById("docModal");
    function f(l, k, t, v) {
      return '<div class="ws-f"><label>' + l + '</label><input data-k="' + k + '" type="' + t +
        '" value="' + esc(v || "") + '"></div>';
    }
    function sel(l, k, opts, v) {
      return '<div class="ws-f"><label>' + l + '</label><select data-k="' + k + '"><option value=""></option>' +
        opts.map(function (o) {
          return '<option value="' + esc(o) + '"' + (v === o ? " selected" : "") + ">" + esc(lbl(o)) + "</option>";
        }).join("") + "</select></div>";
    }
    m.innerHTML = '<div class="ws-modal-in"><h3>' + (row.id ? "Edit document" : "Add document") + "</h3>" +
      '<div class="ws-form">' +
        f("Document code", "doc_code", "text", row.doc_code) +
        '<div class="ws-f ws-f-wide"><label>Title *</label><input data-k="title" type="text" value="' + esc(row.title || "") + '"></div>' +
        sel("Type", "doc_type", TYPES, row.doc_type) +
        sel("Department", "department", W.DEPARTMENTS, row.department) +
        f("Version", "version", "text", row.version) +
        sel("Status", "status", STATUS, row.status) +
        f("Author", "author", "text", row.author) +
        f("Approver", "approver", "text", row.approver) +
        f("Effective date", "effective_date", "date", row.effective_date) +
        f("Next review date", "review_date", "date", row.review_date) +
        '<div class="ws-f ws-f-wide"><label>NABH elements this document evidences</label>' +
          '<input data-k="elements" type="text" placeholder="e.g. IMS.6.a, MOM.1.a" value="' + esc(row.elements || "") + '"></div>' +
        '<div class="ws-f ws-f-wide"><label>Notes</label><textarea data-k="notes" rows="2">' + esc(row.notes || "") + "</textarea></div>" +
      "</div>" +
      '<p class="ws-auth-msg">Changing the version or status writes a row to the version history, which is what document control (IMS.6.a) expects.</p>' +
      '<div class="ws-modal-actions"><button type="button" class="btn btn-ghost" id="dmCancel">Cancel</button>' +
      '<button type="button" class="btn btn-accent" id="dmSave">Save</button></div></div>';
    m.classList.add("open");
    m.querySelector("#dmCancel").addEventListener("click", function () { m.classList.remove("open"); });
    m.querySelector("#dmSave").addEventListener("click", async function () {
      var data = Object.assign({}, row);
      m.querySelectorAll("[data-k]").forEach(function (i) { data[i.getAttribute("data-k")] = i.value; });
      if (!data.title) { W.toast("A title is needed", "bad"); return; }
      var saved = await S.saveDocument(data);
      var i = rows.findIndex(function (r) { return r.id === saved.id; });
      if (i >= 0) rows[i] = saved; else rows.push(saved);
      m.classList.remove("open"); render(); W.toast("Saved");
    });
  }

  function renderFilters() {
    document.getElementById("docFilters").innerHTML =
      '<div class="ws-filters">' +
        '<input type="search" id="dq" placeholder="Search title, code or element…">' +
        '<select id="dst"><option value="">Any status</option>' +
          STATUS.map(function (s) { return '<option value="' + s + '">' + lbl(s) + "</option>"; }).join("") + "</select>" +
        '<select id="dty"><option value="">Any type</option>' +
          TYPES.map(function (s) { return '<option value="' + s + '">' + s + "</option>"; }).join("") + "</select>" +
        '<select id="dde"><option value="">Any department</option>' +
          W.DEPARTMENTS.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + "</option>"; }).join("") + "</select>" +
        '<label class="ws-check"><input type="checkbox" id="ddue"> Review overdue only</label>' +
        (W.canEdit() ? '<button type="button" class="btn btn-accent" id="dNew">Add document</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="dExport">Export (.docx)</button>' +
      "</div>";
    var b = function (id, k, chk) {
      var e = document.getElementById(id);
      e.addEventListener(chk ? "change" : "input", function () {
        filters[k] = chk ? e.checked : e.value; render();
      });
    };
    b("dq", "q"); b("dst", "status"); b("dty", "type"); b("dde", "dept"); b("ddue", "dueOnly", true);
    var n = document.getElementById("dNew");
    if (n) n.addEventListener("click", function () { openForm(null); });
    document.getElementById("dExport").addEventListener("click", async function () {
      if (typeof JSZip === "undefined" || !window.SopDocx) { W.toast("Still loading", "bad"); return; }
      var old = this.textContent; this.disabled = true; this.textContent = "Building…";
      try {
        var list = visible();
        await window.SopDocx.download([
          { type: "title", text: "Controlled Document Register" },
          { type: "p", text: "Generated " + W.today() + " · AQcredix Workspace" },
          { type: "table", header: ["Code", "Title", "Type", "Dept", "Version", "Status", "Effective", "Review", "Elements"],
            rows: list.map(function (r) {
              return [r.doc_code || "—", r.title, r.doc_type || "—", r.department || "—",
                      r.version || "1.0", lbl(r.status || ""), r.effective_date || "—",
                      r.review_date || "—", r.elements || "—"];
            })},
          { type: "p", text: "Documents past their review date must be reviewed and either reissued at a new version or marked obsolete." }
        ], "document-register-" + W.today() + ".docx");
        this.textContent = "Downloaded ✓";
      } catch (e) { this.textContent = "Failed"; }
      finally { var t = this; setTimeout(function () { t.disabled = false; t.textContent = old; }, 2000); }
    });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    document.getElementById("wsBody").style.display = "";
    W.renderNav("documents"); W.renderModeNotice();
    rows = await S.documents();
    renderFilters(); render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
