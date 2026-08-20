/* AQcredix Workspace — Non-conformity & CAPA tracker. */
(function () {
  "use strict";
  var S = window.AQStore, W = window.AQWorkspace, esc;

  var SEVERITY = ["observation", "minor", "major", "critical"];
  var STATUS = ["open", "in_progress", "completed", "verified", "closed"];

  /* Segregation of duties. A CAPA verified or closed by the person who raised it defeats
     the purpose of verification, and an assessor asks about exactly this. The database
     refuses it outright (aq_guard_capa_closure in schema.sql) — this is the courtesy
     layer, so a user is told before filling a form rather than after pressing save. */
  var myUid = null;

  function isMine(row) {
    return !!(myUid && row && row.created_by && row.created_by === myUid);
  }
  /* Admins and owners may close their own: in a small hospital the quality manager who
     raised the finding is sometimes the only person able to verify it, and a rule that
     cannot be satisfied gets worked around rather than followed. The database agrees. */
  function mayClose(row) {
    return !isMine(row) || W.isAdmin();
  }
  var SOD_MSG = "A finding cannot be verified or closed by the person who raised it. " +
                "Ask a colleague, or an admin, to verify it.";
  var SOURCE = ["Internal audit", "Mock survey", "Gap analysis", "Incident", "Patient complaint", "External assessment"];
  var LABEL = { in_progress: "In progress", nc: "Non-compliant" };
  var rows = [], filters = { status: "", severity: "", dept: "", q: "" };

  function lbl(s) { return LABEL[s] || (s.charAt(0).toUpperCase() + s.slice(1)); }

  function visible() {
    return rows.filter(function (r) {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.severity && r.severity !== filters.severity) return false;
      if (filters.dept && r.department !== filters.dept) return false;
      if (filters.q) {
        var q = filters.q.toLowerCase();
        if ((r.title || "").toLowerCase().indexOf(q) < 0 &&
            (r.element_code || "").toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      var rank = { critical: 0, major: 1, minor: 2, observation: 3 };
      var open = { open: 0, in_progress: 1, completed: 2, verified: 3, closed: 4 };
      return (open[a.status] - open[b.status]) || (rank[a.severity] - rank[b.severity]) ||
             String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
    });
  }

  function stats() {
    var open = rows.filter(function (r) { return r.status !== "closed" && r.status !== "verified"; });
    var overdue = open.filter(function (r) { return W.isOverdue(r.due_date, r.status); });
    var crit = open.filter(function (r) { return r.severity === "critical" || r.severity === "major"; });
    var awaiting = rows.filter(function (r) { return r.status === "completed"; });
    document.getElementById("capaStats").innerHTML =
      '<div class="ws-stat"><span class="n">' + open.length + '</span><span class="l">Open findings</span></div>' +
      '<div class="ws-stat ws-stat-bad"><span class="n">' + overdue.length + '</span><span class="l">Overdue</span></div>' +
      '<div class="ws-stat ws-stat-warn"><span class="n">' + crit.length + '</span><span class="l">Major or critical</span></div>' +
      '<div class="ws-stat"><span class="n">' + awaiting.length + '</span><span class="l">Awaiting verification</span>' +
        '<span class="s">Action done, effectiveness unproven</span></div>' +
      '<div class="ws-stat ws-stat-ok"><span class="n">' +
        rows.filter(function (r) { return r.status === "closed"; }).length + '</span><span class="l">Closed</span></div>';
  }

  function render() {
    stats();
    var host = document.getElementById("capaList");
    var list = visible();
    var ro = !W.canEdit();
    if (!list.length) {
      host.innerHTML = '<p class="ws-empty">No findings recorded yet. Add one, or raise them from a gap in the Readiness page.</p>';
      return;
    }
    host.innerHTML = list.map(function (r) {
      var over = W.isOverdue(r.due_date, r.status);
      return '<div class="capa-card sev-' + esc(r.severity || "minor") + '" data-id="' + esc(r.id) + '">' +
        '<div class="capa-top">' +
          '<span class="capa-sev sev-' + esc(r.severity) + '">' + esc(lbl(r.severity || "minor")) + "</span>" +
          '<span class="capa-status st-' + esc(r.status) + '">' + esc(lbl(r.status || "open")) + "</span>" +
          (r.element_code ? '<span class="capa-el">' + esc(r.element_code) + "</span>" : "") +
          (over ? '<span class="capa-over">Overdue</span>' : "") +
          '<span class="capa-due">Due ' + esc(W.fmtDate(r.due_date)) + "</span>" +
        "</div>" +
        "<h4>" + esc(r.title) + "</h4>" +
        '<div class="capa-sub">' + esc(r.department || "—") + " · " + esc(r.source || "—") +
          " · Owner: " + esc(r.owner || "unassigned") + "</div>" +
        (r.root_cause ? '<p class="capa-line"><b>Root cause:</b> ' + esc(r.root_cause) + "</p>" : "") +
        (r.corrective ? '<p class="capa-line"><b>Corrective:</b> ' + esc(r.corrective) + "</p>" : "") +
        (r.preventive ? '<p class="capa-line"><b>Preventive:</b> ' + esc(r.preventive) + "</p>" : "") +
        (r.verification ? '<p class="capa-line"><b>Verification:</b> ' + esc(r.verification) + "</p>" : "") +
        (ro ? "" : '<div class="capa-actions">' +
          '<button type="button" class="btn btn-sm" data-act="edit">Edit</button>' +
          (r.status !== "closed"
            ? (function () {
                var nxt = STATUS[Math.min(STATUS.indexOf(r.status) + 1, STATUS.length - 1)];
                /* Shown disabled with the reason in the tooltip rather than hidden: a
                   missing button reads as a bug, whereas a disabled one with an
                   explanation teaches the rule before the form is filled in. */
                var blocked = (nxt === "verified" || nxt === "closed") && !mayClose(r);
                return '<button type="button" class="btn btn-sm' + (blocked ? " is-off" : "") +
                  '" data-act="advance"' +
                  (blocked ? ' title="' + esc(SOD_MSG) + '"' : "") +
                  ">Move to " + esc(lbl(nxt)) + "</button>";
              })()
            : "") +
          '<button type="button" class="btn btn-sm btn-danger" data-act="del">Delete</button></div>') +
      "</div>";
    }).join("");

    if (ro) return;
    host.querySelectorAll(".capa-card").forEach(function (c) {
      var id = c.getAttribute("data-id");
      var row = rows.filter(function (r) { return r.id === id; })[0];
      c.querySelectorAll("[data-act]").forEach(function (b) {
        b.addEventListener("click", async function () {
          var a = b.getAttribute("data-act");
          if (a === "edit") return openForm(row);
          if (a === "del") {
            if (!confirm("Delete this finding? This cannot be undone.")) return;
            await S.deleteCapa(id);
            rows = rows.filter(function (r) { return r.id !== id; });
            render(); W.toast("Deleted");
          }
          if (a === "advance") {
            var i = Math.min(STATUS.indexOf(row.status) + 1, STATUS.length - 1);
            if ((STATUS[i] === "verified" || STATUS[i] === "closed") && !mayClose(row)) {
              W.toast(SOD_MSG, "bad");
              return;
            }
            // Verification is the point of CAPA — don't let it be skipped silently.
            if (STATUS[i] === "verified" && !row.verification) {
              openForm(row, "Record how effectiveness was verified before marking this verified.");
              return;
            }
            row.status = STATUS[i];
            await S.saveCapa(row); render(); W.toast("Moved to " + lbl(row.status));
          }
        });
      });
    });
  }

  function openForm(row, note) {
    row = row || { severity: "minor", status: "open" };
    var m = document.getElementById("capaModal");
    m.innerHTML =
      '<div class="ws-modal-in"><h3>' + (row.id ? "Edit finding" : "New finding") + "</h3>" +
      (note ? '<p class="ws-auth-msg">' + esc(note) + "</p>" : "") +
      '<div class="ws-form">' +
        f("Title", "title", "text", row.title, true) +
        sel("Severity", "severity", SEVERITY, row.severity) +
        sel("Status", "status", STATUS, row.status) +
        sel("Source", "source", SOURCE, row.source) +
        sel("Department", "department", W.DEPARTMENTS, row.department) +
        f("NABH element code", "element_code", "text", row.element_code) +
        f("Owner", "owner", "text", row.owner) +
        f("Due date", "due_date", "date", row.due_date) +
        ta("Root cause", "root_cause", row.root_cause) +
        ta("Corrective action — fixes this occurrence", "corrective", row.corrective) +
        ta("Preventive action — stops recurrence", "preventive", row.preventive) +
        ta("Verification of effectiveness", "verification", row.verification) +
      "</div>" +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="cmCancel">Cancel</button>' +
        '<button type="button" class="btn btn-accent" id="cmSave">Save</button></div></div>';
    m.classList.add("open");

    function f(l, k, t, v, req) {
      return '<div class="ws-f' + (t === "date" ? "" : " ws-f-wide") + '"><label>' + l +
        (req ? " *" : "") + '</label><input data-k="' + k + '" type="' + t + '" value="' + esc(v || "") + '"></div>';
    }
    function ta(l, k, v) {
      return '<div class="ws-f ws-f-wide"><label>' + l + '</label><textarea data-k="' + k +
        '" rows="2">' + esc(v || "") + "</textarea></div>";
    }
    function sel(l, k, opts, v) {
      return '<div class="ws-f"><label>' + l + '</label><select data-k="' + k + '"><option value=""></option>' +
        opts.map(function (o) {
          return '<option value="' + esc(o) + '"' + (v === o ? " selected" : "") + ">" + esc(lbl(o)) + "</option>";
        }).join("") + "</select></div>";
    }

    m.querySelector("#cmCancel").addEventListener("click", function () { m.classList.remove("open"); });
    m.querySelector("#cmSave").addEventListener("click", async function () {
      var data = Object.assign({}, row);
      m.querySelectorAll("[data-k]").forEach(function (i) { data[i.getAttribute("data-k")] = i.value; });
      if (!data.title) { W.toast("A title is needed", "bad"); return; }
      if (data.status === "verified" && !data.verification) {
        W.toast("Record the verification before marking it verified", "bad"); return;
      }
      /* Checked against the SAVED status, not the form's: re-saving an already-closed
         record must not be refused, only the transition into a closing state. */
      if ((data.status === "verified" || data.status === "closed") &&
          row.status !== "verified" && row.status !== "closed" && !mayClose(row)) {
        W.toast(SOD_MSG, "bad"); return;
      }
      var saved = await S.saveCapa(data);
      var i = rows.findIndex(function (r) { return r.id === saved.id; });
      /* Only a CAPA that was not already in the list is a new one. Editing an existing
         record repeatedly must not read as raising a dozen CAPAs. */
      if (i < 0 && window.AQActivity) {
        window.AQActivity.record("capa_created", {
          id: saved.id, title: saved.title, department: saved.department
        });
      }
      if (i >= 0) rows[i] = saved; else rows.push(saved);
      m.classList.remove("open"); render(); W.toast("Saved");
    });
  }

  function renderFilters() {
    document.getElementById("capaFilters").innerHTML =
      '<div class="ws-filters">' +
        '<input type="search" id="cq" placeholder="Search findings…">' +
        '<select id="cs"><option value="">Any status</option>' +
          STATUS.map(function (s) { return '<option value="' + s + '">' + lbl(s) + "</option>"; }).join("") + "</select>" +
        '<select id="cv"><option value="">Any severity</option>' +
          SEVERITY.map(function (s) { return '<option value="' + s + '">' + lbl(s) + "</option>"; }).join("") + "</select>" +
        '<select id="cd"><option value="">Any department</option>' +
          W.DEPARTMENTS.map(function (d) { return '<option value="' + esc(d) + '">' + esc(d) + "</option>"; }).join("") + "</select>" +
        (W.canEdit() ? '<button type="button" class="btn btn-accent" id="cNew">New finding</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="cExport">Export (.docx)</button>' +
      "</div>";
    var b = function (id, k) {
      var e = document.getElementById(id);
      e.addEventListener("input", function () { filters[k] = e.value; render(); });
    };
    b("cq", "q"); b("cs", "status"); b("cv", "severity"); b("cd", "dept");
    var n = document.getElementById("cNew");
    if (n) n.addEventListener("click", function () { openForm(null); });
    document.getElementById("cExport").addEventListener("click", function () { exportDocx(this); });
  }

  async function exportDocx(btn) {
    if (typeof JSZip === "undefined" || !window.SopDocx) { W.toast("Still loading — try again", "bad"); return; }
    var old = btn.textContent; btn.disabled = true; btn.textContent = "Building…";
    try {
      var list = visible(), b = [];
      b.push({ type: "title", text: "Non-Conformity and CAPA Register" });
      b.push({ type: "p", text: "Generated " + W.today() + " · AQcredix Workspace" });
      b.push({ type: "table", header: ["Title", "Severity", "Element", "Dept", "Owner", "Due", "Status"],
        rows: list.map(function (r) {
          return [r.title, lbl(r.severity || ""), r.element_code || "—", r.department || "—",
                  r.owner || "—", r.due_date || "—", lbl(r.status || "")];
        })});
      list.forEach(function (r) {
        b.push({ type: "h1", text: r.title });
        b.push({ type: "table", header: ["Field", "Detail"], rows: [
          ["Severity", lbl(r.severity || "")], ["Status", lbl(r.status || "")],
          ["Source", r.source || "—"], ["Element", r.element_code || "—"],
          ["Department", r.department || "—"], ["Owner", r.owner || "—"],
          ["Due", r.due_date || "—"], ["Root cause", r.root_cause || "—"],
          ["Corrective action", r.corrective || "—"], ["Preventive action", r.preventive || "—"],
          ["Verification of effectiveness", r.verification || "—"]
        ]});
      });
      await window.SopDocx.download(b, "capa-register-" + W.today() + ".docx");
      btn.textContent = "Downloaded ✓";
    } catch (e) { btn.textContent = "Failed"; console.error(e); }
    finally { setTimeout(function () { btn.disabled = false; btn.textContent = old; }, 2000); }
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    /* Who am I, for the segregation-of-duties check. Read once at start-up: the value
       cannot change within a session, and asking per row would be a request per finding. */
    try {
      var me = await S.currentUser();
      myUid = me && me.id ? me.id : null;
    } catch (e) { myUid = null; }
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("capa"); W.renderModeNotice();
    rows = await S.capaList();
    renderFilters(); render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
