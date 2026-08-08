/* AQcredix — incident reporting UI.
 *
 * Three views on one page: the register, the report form, and one incident in full.
 * State lives in incident-engine.js; this file renders and wires.
 */
(function () {
  "use strict";

  var I = window.AQIncident, W = window.AQWorkspace;
  var esc = function (s) { return I.esc(s); };

  var current = null;
  var rows = [];
  var filter = { status: "all", cls: "all", q: "" };

  function el(id) { return document.getElementById(id); }
  function view(name) {
    ["incHome", "incForm", "incDetail"].forEach(function (id) {
      el(id).style.display = (id === name) ? "" : "none";
    });
    window.scrollTo(0, 0);
  }

  /* ------------------------------ register ------------------------------ */

  function statChip(label, value, tone) {
    return '<div class="inc-stat' + (tone ? " " + tone : "") + '">' +
      '<span class="v">' + value + '</span><span class="l">' + esc(label) + "</span></div>";
  }

  function renderStats() {
    var s = I.stats(rows);
    var host = el("incStats");
    if (!rows.length) { host.innerHTML = ""; return; }

    host.innerHTML =
      '<div class="inc-stats">' +
      statChip("Total reported", s.total) +
      statChip("Open", s.open, s.open ? "warn" : "") +
      statChip("Closed", s.closed, "ok") +
      statChip("Sentinel", s.byClass.sentinel || 0, (s.byClass.sentinel ? "bad" : "")) +
      statChip("Near-miss share", s.nearMissPct + "%", s.nearMissPct < 30 ? "warn" : "ok") +
      statChip("Reported late", s.late, s.late ? "warn" : "") +
      "</div>" +
      // The near-miss ratio is the one number that says whether people trust the system.
      (s.total >= 5 && s.nearMissPct < 30
        ? '<p class="inc-insight">Near misses are only ' + s.nearMissPct + "% of your register. " +
          "In a healthy reporting culture they are usually the largest category by some " +
          "distance \u2014 a low share normally means near misses are going unreported, not " +
          "that they are not happening.</p>"
        : "");
  }

  function visibleRows() {
    var q = filter.q.toLowerCase();
    return rows.filter(function (r) {
      if (filter.status !== "all") {
        if (filter.status === "open" && r.status === "closed") return false;
        if (filter.status === "closed" && r.status !== "closed") return false;
      }
      if (filter.cls !== "all" && r.classification !== filter.cls) return false;
      if (q && (r.reference + " " + r.department + " " + r.reporter_name).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function clsChip(key) {
    var c = I.classOf(key);
    if (!c) return "";
    return '<span class="inc-cls inc-sev-' + c.severity + '">' + esc(c.label) + "</span>";
  }

  function renderRegister() {
    var host = el("incList");
    var vis = visibleRows();

    if (!rows.length) {
      host.innerHTML = '<p class="inc-empty">No incidents recorded yet. That is not the same ' +
        "as none happening \u2014 an empty register usually means reporting has not started. " +
        "Use the button above to file the first one.</p>";
      return;
    }
    if (!vis.length) { host.innerHTML = '<p class="inc-empty">Nothing matches these filters.</p>'; return; }

    host.innerHTML = '<div class="inc-tablewrap"><table class="inc-table"><thead><tr>' +
      "<th>Reference</th><th>Occurred</th><th>Department</th><th>Classification</th>" +
      "<th>Reported by</th><th>Status</th><th></th></tr></thead><tbody>" +
      vis.map(function (r) {
        var late = r.occurred_at && r.submitted_at &&
          (new Date(r.submitted_at) - new Date(r.occurred_at)) / 60000 > I.REPORT_WINDOW_MIN;
        return "<tr><td><b>" + esc(r.reference) + "</b></td>" +
          "<td>" + I.fmtDateTime(r.occurred_at) +
            (late ? ' <span class="inc-late" title="Reported outside the one-hour window">late</span>' : "") + "</td>" +
          "<td>" + esc(r.department || "\u2014") + "</td>" +
          "<td>" + clsChip(r.classification) + "</td>" +
          "<td>" + esc(r.reporter_name || "\u2014") + "</td>" +
          '<td><span class="inc-status inc-st-' + esc(r.status) + '">' +
            esc((I.STATUSES.filter(function (s) { return s.key === r.status; })[0] || {}).label || r.status) +
          "</span></td>" +
          '<td class="inc-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-open="' + esc(r.id) + '">Open</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-doc="' + esc(r.id) + '">Form</button>' +
            '<button type="button" class="btn btn-ghost btn-sm inc-del" data-del="' + esc(r.id) + '">Delete</button>' +
          "</td></tr>";
      }).join("") + "</tbody></table></div>";

    host.querySelectorAll("[data-open]").forEach(function (b) {
      b.addEventListener("click", function () { openOne(b.getAttribute("data-open")); });
    });
    host.querySelectorAll("[data-doc]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var inc = I.hydrate(rows.filter(function (x) { return x.id === b.getAttribute("data-doc"); })[0]);
        try { await window.AQIncidentDoc.download(inc); }
        catch (e) { W.toast("Could not build the form: " + (e.message || e), "bad"); }
      });
    });
    host.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!confirm("Delete this incident record permanently?")) return;
        await I.remove(b.getAttribute("data-del"));
        W.toast("Incident deleted");
        refresh();
      });
    });
  }

  function renderFilters() {
    el("incFilters").innerHTML =
      '<div class="inc-chips">' +
      [["all", "All"], ["open", "Open"], ["closed", "Closed"]].map(function (s) {
        return '<button type="button" class="inc-chip' + (filter.status === s[0] ? " on" : "") +
          '" data-fs="' + s[0] + '">' + s[1] + "</button>";
      }).join("") + "</div>" +
      '<div class="inc-chips">' +
      '<button type="button" class="inc-chip' + (filter.cls === "all" ? " on" : "") +
      '" data-fc="all">All types</button>' +
      I.CLASSES.map(function (c) {
        return '<button type="button" class="inc-chip' + (filter.cls === c.key ? " on" : "") +
          '" data-fc="' + c.key + '">' + esc(c.label) + "</button>";
      }).join("") + "</div>" +
      '<input type="search" id="incQ" placeholder="Search reference, department, reporter\u2026" value="' + esc(filter.q) + '">';

    el("incFilters").querySelectorAll("[data-fs]").forEach(function (b) {
      b.addEventListener("click", function () { filter.status = b.getAttribute("data-fs"); renderFilters(); renderRegister(); });
    });
    el("incFilters").querySelectorAll("[data-fc]").forEach(function (b) {
      b.addEventListener("click", function () { filter.cls = b.getAttribute("data-fc"); renderFilters(); renderRegister(); });
    });
    el("incQ").addEventListener("input", function (e) { filter.q = e.target.value; renderRegister(); });
  }

  /* -------------------------------- form -------------------------------- */

  function field(label, id, type, value, opts) {
    opts = opts || {};
    var input;
    if (type === "textarea") {
      input = '<textarea id="' + id + '" rows="' + (opts.rows || 4) + '" placeholder="' +
        esc(opts.ph || "") + '">' + esc(value || "") + "</textarea>";
    } else {
      input = '<input type="' + type + '" id="' + id + '" value="' + esc(value || "") +
        '" placeholder="' + esc(opts.ph || "") + '">';
    }
    return '<label class="inc-field' + (opts.wide ? " wide" : "") + '"><span>' + esc(label) +
      (opts.req ? ' <i class="req">required</i>' : "") + "</span>" + input +
      (opts.hint ? '<i class="hint">' + esc(opts.hint) + "</i>" : "") + "</label>";
  }

  function renderForm() {
    var inc = current;
    var h = "";

    h += '<div class="inc-formhead"><div>' +
      "<h2>" + (inc.submitted_at ? "Incident " + esc(inc.reference) : "Report an incident") + "</h2>" +
      '<p class="inc-sub">Reporter <b>' + esc(inc.reporter_name || "\u2014") + "</b>" +
      (inc.reference ? " \u00B7 " + esc(inc.reference) : "") + "</p></div>" +
      '<div><button type="button" class="btn btn-ghost" id="incCancel">Back</button> ' +
      '<button type="button" class="btn btn-accent" id="incSubmit">' +
      (inc.submitted_at ? "Save changes" : "Submit report") + "</button></div></div>";

    h += '<div id="incErrors"></div>';
    h += '<div id="incWindow"></div>';

    h += '<section class="inc-block"><h3>1 \u00B7 What happened</h3><div class="inc-grid">' +
      field("Date & time of occurrence", "f_occurred", "datetime-local", inc.occurred_at ? inc.occurred_at.slice(0, 16) : "", { req: true }) +
      field("Department where it occurred", "f_dept", "text", inc.department, { req: true, ph: "e.g. Emergency" }) +
      field("Specific location", "f_loc", "text", inc.location, { ph: "e.g. Triage bay 2" }) +
      "</div>";

    h += '<div class="inc-sub2">Incident occurred to <i class="req">required</i></div><div class="inc-checks">' +
      I.AFFECTED.map(function (a) {
        return '<label class="inc-check"><input type="checkbox" data-aff="' + a.key + '"' +
          (inc.affected.indexOf(a.key) >= 0 ? " checked" : "") + "> " + esc(a.label) + "</label>";
      }).join("") + "</div>";

    h += '<div class="inc-grid">' +
      field("Name of individual involved", "f_pname", "text", inc.person_name) +
      field("Age", "f_page", "text", inc.person_age) +
      field("Gender", "f_pgender", "text", inc.person_gender) +
      field("UHID / employee number", "f_pid", "text", inc.person_id) +
      "</div></section>";

    h += '<section class="inc-block"><h3>2 \u00B7 Classification <i class="req">required</i></h3>' +
      '<p class="inc-sub">These four definitions are the standard patient-safety ladder. ' +
      "Read them before choosing \u2014 consistent classification is what makes the register " +
      "worth analysing later.</p><div class=\"inc-classes\">" +
      I.CLASSES.map(function (c) {
        return '<label class="inc-classopt' + (inc.classification === c.key ? " on" : "") +
          '"><input type="radio" name="cls" value="' + c.key + '"' +
          (inc.classification === c.key ? " checked" : "") + ">" +
          '<span class="t">' + esc(c.label) + '</span><span class="d">' + esc(c.def) + "</span></label>";
      }).join("") + "</div></section>";

    h += '<section class="inc-block"><h3>3 \u00B7 Details</h3><div class="inc-grid one">' +
      field("Details of the event", "f_details", "textarea", inc.details,
        { req: true, rows: 6, wide: true,
          ph: "Describe the sequence of events factually \u2014 what happened, in what order, and what was observed.",
          hint: "Facts and sequence only. Naming who is at fault here makes people stop reporting; the analysis below is where cause belongs." }) +
      field("Immediate action taken", "f_immediate", "textarea", inc.immediate_action,
        { rows: 4, wide: true, ph: "What was done straight away to make the patient and the area safe?" }) +
      field("Witnesses", "f_witness", "text", inc.witnesses, { wide: true, ph: "Names, if any" }) +
      "</div></section>";

    h += '<section class="inc-block"><h3>4 \u00B7 Reported by</h3><div class="inc-grid">' +
      field("Staff name", "f_rname", "text", inc.reporter_name, { req: true }) +
      field("Department", "f_rdept", "text", inc.reporter_dept) +
      "</div></section>";

    el("incFormBody").innerHTML = h;

    // wiring
    var map = [["f_occurred", "occurred_at"], ["f_dept", "department"], ["f_loc", "location"],
      ["f_pname", "person_name"], ["f_page", "person_age"], ["f_pgender", "person_gender"],
      ["f_pid", "person_id"], ["f_details", "details"], ["f_immediate", "immediate_action"],
      ["f_witness", "witnesses"], ["f_rname", "reporter_name"], ["f_rdept", "reporter_dept"]];
    map.forEach(function (m) {
      var n = el(m[0]);
      if (!n) return;
      n.addEventListener("input", function () {
        inc[m[1]] = n.value;
        if (m[1] === "occurred_at") renderWindow();
        I.save(inc);
      });
    });
    el("incFormBody").querySelectorAll("[data-aff]").forEach(function (c) {
      c.addEventListener("change", function () {
        var k = c.getAttribute("data-aff");
        var i = inc.affected.indexOf(k);
        if (c.checked && i < 0) inc.affected.push(k);
        if (!c.checked && i >= 0) inc.affected.splice(i, 1);
        I.save(inc);
      });
    });
    el("incFormBody").querySelectorAll('input[name="cls"]').forEach(function (r) {
      r.addEventListener("change", function () {
        inc.classification = r.value;
        I.save(inc);
        renderForm();
      });
    });
    el("incCancel").addEventListener("click", function () { I.save(inc, true).then(goHome); });
    el("incSubmit").addEventListener("click", submit);
    renderWindow();
  }

  /* The one-hour clock from the template, shown rather than assumed. */
  function renderWindow() {
    var host = el("incWindow");
    if (!host || !current) return;
    var w = I.reportWindow(current);
    if (!w) { host.innerHTML = ""; return; }
    if (w.late) {
      host.innerHTML = '<div class="inc-note warn"><b>Outside the one-hour window.</b> ' +
        "This report is " + Math.abs(w.minutesLeft) + " minutes past the " +
        I.REPORT_WINDOW_MIN + "-minute deadline. File it anyway \u2014 a late report is far " +
        "better than none, and the delay is recorded so the pattern can be addressed.</div>";
    } else {
      host.innerHTML = '<div class="inc-note ok"><b>' + w.minutesLeft + " minutes remaining</b> " +
        "to reach the Quality department within the " + I.REPORT_WINDOW_MIN + "-minute window.</div>";
    }
  }

  async function submit() {
    var errs = I.validate(current);
    var host = el("incErrors");
    if (errs.length) {
      host.innerHTML = '<div class="inc-note bad"><b>Not yet complete.</b><ul>' +
        errs.map(function (e) { return "<li>" + esc(e.msg) + "</li>"; }).join("") + "</ul></div>";
      host.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    host.innerHTML = "";
    if (!current.submitted_at) current.submitted_at = new Date().toISOString();
    current.status = current.status === "reported" ? "under_review" : current.status;
    await I.save(current, true);
    W.toast("Incident " + current.reference + " recorded");
    await refresh();
    openOne(current.id);
  }

  /* ------------------------------- detail ------------------------------- */

  function openOne(id) {
    var r = rows.filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    current = I.hydrate(r);
    renderDetail();
    view("incDetail");
  }

  function renderDetail() {
    var inc = current;
    var c = I.classOf(inc.classification);
    var w = I.reportWindow(inc);
    var h = "";

    h += '<div class="inc-formhead"><div><h2>' + esc(inc.reference) + " " + clsChip(inc.classification) + "</h2>" +
      '<p class="inc-sub">' + esc(inc.department || "\u2014") + " \u00B7 occurred " +
      I.fmtDateTime(inc.occurred_at) + " \u00B7 reported by " + esc(inc.reporter_name) + "</p></div>" +
      '<div class="no-print"><button type="button" class="btn btn-ghost" id="incBack">Back</button> ' +
      '<button type="button" class="btn btn-ghost" id="incEdit">Edit report</button> ' +
      '<button type="button" class="btn btn-accent" id="incDoc">Download form</button></div></div>';

    h += '<div class="inc-cards">';
    h += '<div class="inc-card"><h3>What happened</h3>' +
      '<dl class="inc-dl">' +
      "<div><dt>Occurred</dt><dd>" + I.fmtDateTime(inc.occurred_at) + "</dd></div>" +
      "<div><dt>Reported</dt><dd>" + I.fmtDateTime(inc.submitted_at || inc.reported_at) +
        (w && w.late ? ' <span class="inc-late">late</span>' : "") + "</dd></div>" +
      "<div><dt>Location</dt><dd>" + esc(inc.location || "\u2014") + "</dd></div>" +
      "<div><dt>Affected</dt><dd>" + (inc.affected.map(function (a) {
        return (I.AFFECTED.filter(function (x) { return x.key === a; })[0] || {}).label || a;
      }).join(", ") || "\u2014") + "</dd></div>" +
      "<div><dt>Individual</dt><dd>" + esc([inc.person_name, inc.person_age, inc.person_gender]
        .filter(Boolean).join(", ") || "\u2014") + "</dd></div>" +
      "</dl>" +
      "<h4>Details</h4><p>" + esc(inc.details || "\u2014") + "</p>" +
      "<h4>Immediate action</h4><p>" + esc(inc.immediate_action || "\u2014") + "</p>" +
      (inc.witnesses ? "<h4>Witnesses</h4><p>" + esc(inc.witnesses) + "</p>" : "") +
      "</div>";

    if (c) {
      h += '<div class="inc-card"><h3>Classification</h3><p><b>' + esc(c.label) + "</b></p>" +
        '<p class="inc-sub">' + esc(c.def) + "</p></div>";
    }
    h += "</div>";

    /* Analysis */
    h += '<div class="inc-card"><h3>Analysis</h3>' +
      '<p class="inc-sub">Root cause, corrective and preventive action \u2014 the three blocks ' +
      "the incident form requires before an incident can be closed.</p>" +
      '<div class="inc-sub2">Contributing factors</div><div class="inc-checks">' +
      I.FACTORS.map(function (f) {
        return '<label class="inc-check"><input type="checkbox" data-fac="' + esc(f) + '"' +
          (inc.contributing.indexOf(f) >= 0 ? " checked" : "") + "> " + esc(f) + "</label>";
      }).join("") + "</div>" +
      '<div class="inc-grid one">' +
      field("Root cause analysis", "a_rca", "textarea", inc.root_cause,
        { rows: 5, wide: true,
          ph: "Why did this happen? Keep asking why until you reach a system cause.",
          hint: "\u201CHuman error\u201D is where an analysis stops, not where it ends. Ask why the system allowed the error." }) +
      field("Corrective action", "a_ca", "textarea", inc.corrective,
        { rows: 4, wide: true, ph: "What fixes this specific occurrence?" }) +
      field("Preventive action", "a_pa", "textarea", inc.preventive,
        { rows: 4, wide: true, ph: "What stops it recurring anywhere else?" }) +
      "</div></div>";

    /* Sign-off chain */
    h += '<div class="inc-card"><h3>Acknowledgement</h3>' +
      '<p class="inc-sub">Recorded electronically with the signer\u2019s name and a timestamp. ' +
      "The downloadable form still carries ruled signature lines for a wet-ink copy where " +
      "your policy requires one.</p><div class=\"inc-signs\">" +
      I.SIGNOFFS.map(function (s) {
        var got = inc.signoffs[s.key];
        return '<div class="inc-sign' + (got ? " done" : "") + '">' +
          "<span class=\"l\">" + esc(s.label) + "</span>" +
          (got
            ? '<span class="n">' + esc(got.name) + "</span><span class=\"t\">" + I.fmtDateTime(got.at) + "</span>"
            : '<button type="button" class="btn btn-ghost btn-sm" data-sign="' + s.key + '">Acknowledge</button>') +
          "</div>";
      }).join("") + "</div></div>";

    /* Status and closure */
    var blockers = I.closeBlockers(inc);
    h += '<div class="inc-card"><h3>Status</h3><div class="inc-statusrow">' +
      '<select id="incStatus">' + I.STATUSES.map(function (s) {
        return '<option value="' + s.key + '"' + (inc.status === s.key ? " selected" : "") + ">" + esc(s.label) + "</option>";
      }).join("") + "</select>" +
      '<button type="button" class="btn btn-accent" id="incClose">Close incident</button></div>' +
      (blockers.length
        ? '<div class="inc-note warn"><b>Not ready to close.</b><ul>' +
          blockers.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul></div>"
        : '<div class="inc-note ok">All closure requirements are met.</div>') +
      "</div>";

    el("incDetailBody").innerHTML = h;

    // wiring
    [["a_rca", "root_cause"], ["a_ca", "corrective"], ["a_pa", "preventive"]].forEach(function (m) {
      var n = el(m[0]);
      n.addEventListener("input", function () { inc[m[1]] = n.value; I.save(inc); });
    });
    el("incDetailBody").querySelectorAll("[data-fac]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var f = cb.getAttribute("data-fac");
        var i = inc.contributing.indexOf(f);
        if (cb.checked && i < 0) inc.contributing.push(f);
        if (!cb.checked && i >= 0) inc.contributing.splice(i, 1);
        I.save(inc);
      });
    });
    el("incDetailBody").querySelectorAll("[data-sign]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var who = prompt("Name of the person acknowledging this incident:",
          (W.user && (W.user.name || W.user.email)) || "");
        if (!who || !who.trim()) return;
        inc.signoffs[b.getAttribute("data-sign")] = { name: who.trim(), at: new Date().toISOString() };
        await I.save(inc, true);
        await refresh();
        renderDetail();
      });
    });
    el("incStatus").addEventListener("change", async function (e) {
      inc.status = e.target.value;
      await I.save(inc, true);
      await refresh();
    });
    el("incClose").addEventListener("click", async function () {
      var b = I.closeBlockers(inc);
      if (b.length) { W.toast("Closure is blocked: " + b[0], "bad"); return; }
      inc.status = "closed";
      inc.closed_at = new Date().toISOString();
      await I.save(inc, true);
      try { await I.pushToCapa(inc); W.toast("Closed, and the actions are in NC & CAPA"); }
      catch (e) { W.toast("Closed, but writing to CAPA failed", "bad"); }
      await refresh();
      renderDetail();
    });
    el("incBack").addEventListener("click", goHome);
    el("incEdit").addEventListener("click", function () { renderForm(); view("incForm"); });
    el("incDoc").addEventListener("click", async function () {
      try { await window.AQIncidentDoc.download(inc); }
      catch (e) { W.toast("Could not build the form: " + (e.message || e), "bad"); }
    });
  }

  /* -------------------------------- boot -------------------------------- */

  async function refresh() {
    rows = await I.list();
    renderStats();
    renderFilters();
    renderRegister();
  }

  function goHome() { current = null; view("incHome"); refresh(); }

  async function boot() {
    if (!(await W.gate())) return;
    W.renderNav("incidents");
    el("wsBody").style.display = "";

    el("incNew").addEventListener("click", function () {
      current = I.create(W.user);
      renderForm();
      view("incForm");
    });
    el("incBlank").addEventListener("click", async function () {
      try { await window.AQIncidentDoc.download(I.create(W.user), true); }
      catch (e) { W.toast("Could not build the form: " + (e.message || e), "bad"); }
    });

    await refresh();
    view("incHome");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
