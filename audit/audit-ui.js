/* AQcredix — internal audit UI.
 *
 * Three views on one page: pick a department, work the checklist, read the result.
 * State lives in audit-engine.js; this file only renders and wires events.
 */
(function () {
  "use strict";

  var A = window.AQAudit, W = window.AQWorkspace, S = window.AQStore;
  var esc = function (s) { return A.esc(s); };

  var session = null;
  var rows = [];
  var filter = { status: "all", chapter: "all", q: "" };
  var timerHandle = null;

  function el(id) { return document.getElementById(id); }

  /* ------------------------------- picker ------------------------------- */

  function renderPicker() {
    var host = el("audPicker");
    var depts = A.departments();
    var groups = { clinical: [], nonclinical: [] };
    depts.forEach(function (d) { (groups[d.group] || groups.clinical).push(d); });

    function grid(list) {
      return '<div class="aud-grid">' + list.map(function (d) {
        return '<button type="button" class="aud-dept" data-dept="' + esc(d.key) + '">' +
          "<span class=\"n\">" + esc(d.name) + "</span>" +
          '<span class="m">' + d.codes.length + " elements in scope</span></button>";
      }).join("") + "</div>";
    }

    host.innerHTML =
      "<h2>Start an audit</h2>" +
      '<p class="aud-sub">Scope for each area is taken from the NABH 5th Edition assessor ' +
      "checklist, so you only see the elements an assessor would actually check there.</p>" +
      '<h3 class="aud-gh">Clinical areas</h3>' + grid(groups.clinical) +
      '<h3 class="aud-gh">Non-clinical areas</h3>' + grid(groups.nonclinical);

    host.querySelectorAll(".aud-dept").forEach(function (b) {
      b.addEventListener("click", function () { start(b.getAttribute("data-dept")); });
    });
  }

  /* ------------------------------- records ------------------------------ */

  function sparkline(vals) {
    if (vals.length < 2) return "";
    var w = 70, h = 20, max = 100;
    var pts = vals.map(function (v, i) {
      return (i / (vals.length - 1) * w).toFixed(1) + "," + (h - (v / max) * h).toFixed(1);
    }).join(" ");
    return '<svg class="aud-spark" viewBox="0 0 ' + w + " " + h + '" width="' + w +
      '" height="' + h + '"><polyline points="' + pts +
      '" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
  }

  async function renderRecords() {
    var host = el("audRecords");
    var all = await A.list();
    if (!all.length) {
      host.innerHTML = "<h2>Your audit records</h2>" +
        '<p class="aud-empty">No audits yet. Pick a department above to run the first one. ' +
        "Every audit you finish is kept here \u2014 you can audit the same department as " +
        "many times as you like, and the second audit is the one that tells you whether " +
        "anything actually changed.</p>";
      return;
    }

    var trend = {};
    all.slice().reverse().forEach(function (r) {
      if (r.status !== "completed") return;
      (trend[r.department_id] = trend[r.department_id] || []).push(r.readiness_score || 0);
    });

    host.innerHTML = "<h2>Your audit records <span class=\"aud-count\">" + all.length + "</span></h2>" +
      '<div class="aud-tablewrap"><table class="aud-table aud-records"><thead><tr>' +
      "<th>Department</th><th>Auditor</th><th>Date</th><th>Duration</th>" +
      "<th>C</th><th>PC</th><th>NC</th><th>Readiness</th><th>Trend</th><th></th>" +
      "</tr></thead><tbody>" +
      all.map(function (r) {
        var t = trend[r.department_id] || [];
        return "<tr>" +
          "<td><b>" + esc(r.department_name) + "</b>" +
            (r.status !== "completed" ? ' <span class="aud-inprog">in progress</span>' : "") + "</td>" +
          "<td>" + esc(r.auditor_name) + "</td>" +
          "<td>" + W.fmtDate(r.started_at) + "</td>" +
          "<td>" + A.fmtDuration(r.duration_seconds) + "</td>" +
          '<td class="aud-n aud-compliant">' + (r.compliant || 0) + "</td>" +
          '<td class="aud-n aud-partial">' + (r.partial || 0) + "</td>" +
          '<td class="aud-n aud-nc">' + (r.nc || 0) + "</td>" +
          "<td><b>" + (r.readiness_score || 0) + "%</b></td>" +
          "<td>" + sparkline(t) + "</td>" +
          '<td class="aud-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-open="' + esc(r.id) + '">Open</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-xl="' + esc(r.id) + '">Excel</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-dup="' + esc(r.id) + '">Re-audit</button>' +
            '<button type="button" class="btn btn-ghost btn-sm aud-del" data-del="' + esc(r.id) + '">Delete</button>' +
          "</td></tr>";
      }).join("") + "</tbody></table></div>";

    function find(id) { return all.filter(function (r) { return r.id === id; })[0]; }

    host.querySelectorAll("[data-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        session = A.hydrate(find(b.getAttribute("data-open")));
        session.status === "completed" ? showReport() : showChecklist();
      });
    });
    host.querySelectorAll("[data-xl]").forEach(function (b) {
      b.addEventListener("click", function () {
        window.AQAuditExcel.download(A.hydrate(find(b.getAttribute("data-xl"))))
          .catch(function (e) { W.toast("Export failed: " + (e.message || e), "bad"); });
      });
    });
    host.querySelectorAll("[data-dup]").forEach(function (b) {
      b.addEventListener("click", function () { start(find(b.getAttribute("data-dup")).department_id); });
    });
    host.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("Delete this audit record permanently?")) return;
        await A.remove(b.getAttribute("data-del"));
        W.toast("Audit deleted");
        renderRecords();
      });
    });
  }

  /* ------------------------------ checklist ----------------------------- */

  function start(deptKey) {
    session = A.create(deptKey, W.user);
    A.save(session, true);
    showChecklist();
  }

  function view(name) {
    ["audHome", "audWork", "audDone"].forEach(function (id) {
      el(id).style.display = (id === name) ? "" : "none";
    });
    window.scrollTo(0, 0);
  }

  function statusButtons(code, cur) {
    return ["compliant", "partial", "nc", "na"].map(function (k) {
      return '<button type="button" class="aud-sb aud-' + k + (cur === k ? " on" : "") +
        '" data-set="' + k + '" data-code="' + esc(code) + '" title="' + esc(A.STATUS[k].label) +
        '">' + A.STATUS[k].short + "</button>";
    }).join("");
  }

  function rowHtml(r) {
    var f = A.finding(session, r.code);
    var st = f.status || "unassessed";
    var open = (st === "nc" || st === "partial");
    var h = '<div class="aud-row" data-row="' + esc(r.code) + '" data-status="' + st + '" tabindex="0">';
    h += '<div class="aud-row-main"><div class="aud-row-meta">' +
      '<span class="aud-code">' + esc(r.code) + "</span>" +
      '<span class="aud-ch">' + esc(r.chapter) + "</span>" +
      (r.category ? '<span class="aud-cat">' + esc(r.category) + "</span>" : "") +
      (r.sop ? '<span class="aud-sop">SOP</span>' : "") +
      (r.block === "interview" ? '<span class="aud-iv">' + esc(r.blockLabel) + "</span>" : "") +
      "</div>" +
      '<p class="aud-el">' + esc(r.text) + "</p>" +
      '<p class="aud-std">' + esc(r.standard) + " \u2014 " + esc(r.standardText) + "</p></div>";

    h += '<div class="aud-row-act"><div class="aud-seg">' + statusButtons(r.code, st) + "</div>" +
      '<textarea class="aud-note" data-note="' + esc(r.code) +
      '" rows="2" placeholder="' +
      (st === "na" ? "Why is this not applicable? (required)" : "Evidence seen / observation") +
      '">' + esc(st === "na" ? (f.justification || "") : (f.evidence || "")) + "</textarea>";

    h += '<div class="aud-fix" style="display:' + (open ? "" : "none") + '">' +
      '<select data-sev="' + esc(r.code) + '"><option value="">Severity\u2026</option>' +
      A.SEVERITY.map(function (s) {
        return '<option value="' + s + '"' + (f.severity === s ? " selected" : "") + ">" +
          s.charAt(0).toUpperCase() + s.slice(1) + "</option>";
      }).join("") + "</select>" +
      '<input type="text" data-owner="' + esc(r.code) + '" placeholder="Responsible person" value="' +
      esc(f.owner || "") + '">' +
      '<input type="date" data-due="' + esc(r.code) + '" value="' + esc(f.due_date || "") + '">' +
      "</div></div></div>";
    return h;
  }

  function visibleRows() {
    var q = filter.q.toLowerCase();
    return rows.filter(function (r) {
      if (filter.chapter !== "all" && r.chapter !== filter.chapter) return false;
      var st = A.finding(session, r.code).status || "unassessed";
      if (filter.status !== "all" && st !== filter.status) return false;
      if (q && (r.code + " " + r.text + " " + r.standardText).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function renderList() {
    var host = el("audList");
    var vis = visibleRows();
    host.innerHTML = vis.length
      ? vis.map(rowHtml).join("")
      : '<p class="aud-empty">Nothing matches these filters.</p>';
    wireRows(host);
    renderProgress();
  }

  function renderProgress() {
    var sc = A.score(session);
    el("audProgress").innerHTML =
      '<div class="aud-bar"><i style="width:' + sc.assessedPct + '%"></i></div>' +
      '<div class="aud-tallies">' +
      '<span class="aud-compliant">C ' + sc.counts.compliant + "</span>" +
      '<span class="aud-partial">PC ' + sc.counts.partial + "</span>" +
      '<span class="aud-nc">NC ' + sc.counts.nc + "</span>" +
      '<span class="aud-na">NA ' + sc.counts.na + "</span>" +
      '<span class="aud-un">Left ' + sc.counts.unassessed + "</span>" +
      "</div>";
  }

  function refreshRow(code) {
    var node = el("audList").querySelector('[data-row="' + CSS.escape(code) + '"]');
    if (!node) return;
    var r = rows.filter(function (x) { return x.code === code; })[0];
    var tmp = document.createElement("div");
    tmp.innerHTML = rowHtml(r);
    node.replaceWith(tmp.firstChild);
    wireRows(el("audList"));
  }

  function wireRows(host) {
    host.querySelectorAll("[data-set]").forEach(function (b) {
      if (b._w) return; b._w = 1;
      b.addEventListener("click", function () {
        var code = b.getAttribute("data-code");
        A.setFinding(session, code, { status: b.getAttribute("data-set") });
        A.save(session);
        refreshRow(code);
        renderProgress();
      });
    });
    host.querySelectorAll("[data-note]").forEach(function (t) {
      if (t._w) return; t._w = 1;
      t.addEventListener("input", function () {
        var code = t.getAttribute("data-note");
        var st = A.finding(session, code).status;
        A.setFinding(session, code, st === "na" ? { justification: t.value } : { evidence: t.value });
        A.save(session);
      });
    });
    [["data-sev", "severity"], ["data-owner", "owner"], ["data-due", "due_date"]].forEach(function (p) {
      host.querySelectorAll("[" + p[0] + "]").forEach(function (i) {
        if (i._w) return; i._w = 1;
        i.addEventListener("change", function () {
          var patch = {}; patch[p[1]] = i.value;
          A.setFinding(session, i.getAttribute(p[0]), patch);
          A.save(session);
        });
      });
    });
  }

  function renderFilters() {
    var chapters = [];
    rows.forEach(function (r) { if (chapters.indexOf(r.chapter) < 0) chapters.push(r.chapter); });
    chapters.sort(function (a, b) { return A.CH_ORDER.indexOf(a) - A.CH_ORDER.indexOf(b); });

    var sts = [["all", "All"], ["unassessed", "Unassessed"], ["compliant", "C"],
               ["partial", "PC"], ["nc", "NC"], ["na", "NA"]];
    el("audFilters").innerHTML =
      '<div class="aud-chips">' + sts.map(function (s) {
        return '<button type="button" class="aud-chip' + (filter.status === s[0] ? " on" : "") +
          '" data-fs="' + s[0] + '">' + s[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="aud-chips">' +
        '<button type="button" class="aud-chip' + (filter.chapter === "all" ? " on" : "") +
        '" data-fc="all">All chapters</button>' +
        chapters.map(function (c) {
          return '<button type="button" class="aud-chip' + (filter.chapter === c ? " on" : "") +
            '" data-fc="' + c + '">' + c + "</button>";
        }).join("") + "</div>" +
      '<input type="search" id="audQ" placeholder="Search elements\u2026" value="' + esc(filter.q) + '">';

    el("audFilters").querySelectorAll("[data-fs]").forEach(function (b) {
      b.addEventListener("click", function () { filter.status = b.getAttribute("data-fs"); renderFilters(); renderList(); });
    });
    el("audFilters").querySelectorAll("[data-fc]").forEach(function (b) {
      b.addEventListener("click", function () { filter.chapter = b.getAttribute("data-fc"); renderFilters(); renderList(); });
    });
    var q = el("audQ");
    q.addEventListener("input", function () { filter.q = q.value; renderList(); });
  }

  function renderKpis() {
    var sc = (window.AUDIT_SCOPE || {})[session.department_id] || {};
    var host = el("audKpis");
    if (!sc.kpis || !sc.kpis.length) { host.innerHTML = ""; return; }
    host.innerHTML = "<h3>Quality indicators to verify</h3>" +
      '<p class="aud-sub">The assessor checklist expects data for these in this area. ' +
      "Tick what you could actually produce on the day.</p><ul class=\"aud-kpis\">" +
      sc.kpis.map(function (k, i) {
        return "<li><label><input type=\"checkbox\" data-kpi=\"" + i + "\"" +
          (session.kpi_checks[k] ? " checked" : "") + "> " + esc(k) + "</label></li>";
      }).join("") + "</ul>";
    host.querySelectorAll("[data-kpi]").forEach(function (c) {
      c.addEventListener("change", function () {
        session.kpi_checks[sc.kpis[+c.getAttribute("data-kpi")]] = c.checked;
        A.save(session);
      });
    });
  }

  function showChecklist() {
    rows = A.scopeRows(session.department_id);
    var sc = (window.AUDIT_SCOPE || {})[session.department_id] || {};
    view("audWork");

    el("audHead").innerHTML =
      "<div><h2>" + esc(session.department_name) + "</h2>" +
      '<p class="aud-sub">Auditor <b>' + esc(session.auditor_name) + "</b> \u00B7 " +
      rows.length + " elements \u00B7 " + esc(session.standard_edition) +
      ' \u00B7 <span id="audClock">0s</span></p></div>' +
      '<div class="aud-headact">' +
      '<button type="button" class="btn btn-ghost" id="audBack">Save &amp; close</button> ' +
      '<button type="button" class="btn btn-accent" id="audFinish">Finish audit</button></div>';

    el("audQuick").innerHTML = (sc.quickList && sc.quickList.length)
      ? '<details class="aud-quick" open><summary>Quick list \u2014 what to walk the floor with (' +
        sc.quickList.length + ")</summary><ul>" +
        sc.quickList.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul></details>"
      : "";

    renderFilters();
    renderList();
    renderKpis();
    startClock();

    el("audBack").addEventListener("click", async function () {
      await A.save(session, true);
      W.toast("Audit saved. You can pick it up from your records.");
      goHome();
    });
    el("audFinish").addEventListener("click", finish);
  }

  function startClock() {
    stopClock();
    timerHandle = setInterval(function () {
      A.tick(session);
      var c = el("audClock");
      if (c) c.textContent = A.fmtDuration(A.elapsedSeconds(session));
    }, 1000);
  }
  function stopClock() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  /* ------------------------------- finish ------------------------------- */

  async function finish() {
    var blocks = A.blockers(session);
    if (blocks.length) {
      W.toast(blocks.length + " finding" + (blocks.length === 1 ? "" : "s") +
        " still need an owner, a date or a reason.", "bad");
      // Show only the offending rows rather than making the user hunt for them.
      filter = { status: "all", chapter: "all", q: "" };
      renderFilters();
      renderList();
      var first = null;
      blocks.forEach(function (b) {
        var n = el("audList").querySelector('[data-row="' + CSS.escape(b.code) + '"]');
        if (n) { n.classList.add("aud-blocked"); if (!first) first = n; }
      });
      if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
      el("audBlockers").innerHTML =
        '<div class="aud-blockmsg"><b>Finish is blocked.</b> Every non-conformity and partial ' +
        "compliance needs a responsible person and a target closure date, and every Not " +
        "Applicable needs a reason. This is the step internal audits usually skip, which is " +
        "exactly why it is enforced here.<ul>" +
        blocks.slice(0, 12).map(function (b) {
          return "<li><b>" + esc(b.code) + "</b> " + esc(b.why) + "</li>";
        }).join("") +
        (blocks.length > 12 ? "<li>\u2026and " + (blocks.length - 12) + " more</li>" : "") +
        "</ul></div>";
      return;
    }

    A.tick(session);
    session.finished_at = new Date().toISOString();
    session.duration_seconds = A.elapsedSeconds(session);
    session.status = "completed";
    stopClock();

    await A.save(session, true);
    try {
      var n = await A.pushToCapa(session);
      if (n) W.toast(n + " finding" + (n === 1 ? "" : "s") + " sent to NC & CAPA");
    } catch (e) {
      W.toast("Audit saved, but writing to CAPA failed: " + (e.message || e), "bad");
    }
    showReport();
  }

  function showReport() {
    view("audDone");
    window.AQAuditReport.render(el("audReportHost"), session);
    var b = el("audDoneBack");
    if (b) b.onclick = goHome;
  }

  function goHome() {
    stopClock();
    session = null;
    view("audHome");
    renderRecords();
  }

  /* ------------------------------ keyboard ------------------------------ */

  function keys(e) {
    if (!session || el("audWork").style.display === "none") return;
    var t = e.target.tagName;
    if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
    var focused = document.activeElement.closest ? document.activeElement.closest(".aud-row") : null;
    var all = Array.prototype.slice.call(el("audList").querySelectorAll(".aud-row"));
    var i = focused ? all.indexOf(focused) : -1;

    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault(); if (all[i + 1]) all[i + 1].focus();
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault(); if (all[i - 1]) all[i - 1].focus();
    } else if (focused && "1234".indexOf(e.key) >= 0) {
      e.preventDefault();
      var code = focused.getAttribute("data-row");
      A.setFinding(session, code, { status: ["compliant", "partial", "nc", "na"][+e.key - 1] });
      A.save(session);
      refreshRow(code);
      renderProgress();
      var again = el("audList").querySelector('[data-row="' + CSS.escape(code) + '"]');
      if (again) again.focus();
    }
  }

  /* -------------------------------- boot -------------------------------- */

  async function boot() {
    if (!(await W.gate())) return;
    W.renderNav("audits");
    el("wsBody").style.display = "";

    if (!W.user || !(W.user.name || W.user.email)) {
      el("audNotice").innerHTML =
        '<div class="ws-notice">Your account has no display name yet, so audits would be ' +
        'signed with your email address. Set a name in <a href="team.html">Team</a> first.</div>';
    }

    renderPicker();
    await renderRecords();
    view("audHome");
    document.addEventListener("keydown", keys);
    document.addEventListener("visibilitychange", function () {
      if (session) A.tick(session);
    });
    window.addEventListener("beforeunload", function () {
      if (session && session.status === "in_progress") A.save(session, true);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
