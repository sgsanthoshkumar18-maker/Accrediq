/* AQcredix Workspace — asset register, preventive maintenance and calibration.
 *
 * One engine for every "thing with an expiry date" a department keeps: equipment for
 * biomedical, licences for facilities, contracts for IT, credentials for HR, reagents for
 * the lab. Ten department modules would be ten things to maintain and ten chances to get
 * a hospital's local practice wrong.
 *
 * All due-date maths comes from calendar/schedule.js. Nothing here does date arithmetic,
 * so there is exactly one place where "overdue" is decided across the whole platform.
 *
 * Every control writes to Supabase and every read comes back from it, so a record created
 * on a ward tablet is there on the office desktop after signing in. Nothing is kept only
 * in the browser.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, K = window.AQSchedule;
  var esc;

  var assets = [], schedules = [], events = [];
  var tab = "due";
  var deptFilter = "";
  var kindFilter = "";

  var KINDS = {
    equipment:  "Equipment",
    licence:    "Licence",
    contract:   "AMC / contract",
    credential: "Credential",
    reagent:    "Reagent / consumable",
    software:   "Software / IT"
  };

  var SCHED_KINDS = {
    calibration: "Calibration",
    preventive:  "Preventive maintenance",
    amc:         "AMC renewal",
    renewal:     "Licence renewal",
    inspection:  "Inspection"
  };

  var RESULTS = { pass: "Pass", pass_with_observation: "Pass with observation", fail: "Fail" };

  function id(p) {
    return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* --------------------------------- data --------------------------------- */

  async function load() {
    var r = await Promise.all([
      S.adapter.list("assets").catch(function () { return []; }),
      S.adapter.list("asset_schedules").catch(function () { return []; }),
      S.adapter.list("asset_events").catch(function () { return []; })
    ]);
    assets = (r[0] || []).filter(function (a) { return a.status !== "condemned"; });
    schedules = (r[1] || []).filter(function (x) { return x.active !== false; });
    events = r[2] || [];
  }

  function assetOf(sid) {
    var sc = schedules.filter(function (x) { return x.id === sid; })[0];
    if (!sc) return null;
    return assets.filter(function (a) { return a.id === sc.asset_id; })[0] || null;
  }

  /* The last event actually recorded beats the stored last_done_on. The stored field is
     what was typed when the schedule was created; once real events exist they are the
     better truth, and letting the two disagree on screen is how a hospital ends up
     arguing with its own record in front of an assessor. */
  function lastDone(sc) {
    var done = events
      .filter(function (e) { return e.schedule_id === sc.id && e.performed_on; })
      .map(function (e) { return e.performed_on; })
      .sort();
    return done.length ? done[done.length - 1] : (sc.last_done_on || null);
  }

  function statusOf(sc) {
    var last = lastDone(sc);
    var d = K.nextDates(last, sc.frequency, sc.pref_dow);
    return K.status(last, sc.frequency, null, d.preferred);
  }

  function visibleSchedules() {
    return schedules.filter(function (sc) {
      var a = assetOf(sc.id);
      if (!a) return false;
      if (deptFilter && a.department !== deptFilter) return false;
      if (kindFilter && sc.kind !== kindFilter) return false;
      return true;
    });
  }

  function departments() {
    var out = {};
    assets.forEach(function (a) { if (a.department) out[a.department] = 1; });
    return Object.keys(out).sort();
  }

  /* --------------------------------- stats --------------------------------- */

  function stats() {
    var all = visibleSchedules().map(statusOf);
    var overdue = all.filter(function (x) { return x.state === "overdue"; }).length;
    var soon = all.filter(function (x) { return x.state === "due" || x.state === "soon"; }).length;
    var never = all.filter(function (x) { return x.state === "never"; }).length;

    document.getElementById("regStats").innerHTML =
      '<div class="ws-stat ws-stat-bad"><span class="n">' + overdue + '</span>' +
        '<span class="l">Overdue</span></div>' +
      '<div class="ws-stat ws-stat-warn"><span class="n">' + soon + '</span>' +
        '<span class="l">Due now or soon</span></div>' +
      '<div class="ws-stat"><span class="n">' + assets.length + '</span>' +
        '<span class="l">Items on the register</span></div>' +
      '<div class="ws-stat"><span class="n">' + events.length + '</span>' +
        '<span class="l">Records held</span></div>' +
      (never ? '<div class="ws-stat ws-stat-warn"><span class="n">' + never + '</span>' +
        '<span class="l">Never recorded</span><span class="s">No date to schedule from</span></div>' : "");
  }

  /* --------------------------------- views --------------------------------- */

  function pill(st) {
    return '<span class="cal-pill st-' + st.state + '">' + esc(st.text) + "</span>";
  }

  function dueView() {
    var ro = !W.canEdit();
    var list = visibleSchedules().slice().sort(function (a, b) {
      var rank = { overdue: 0, never: 1, due: 2, soon: 3, ok: 4 };
      var sa = statusOf(a), sb = statusOf(b);
      return (rank[sa.state] - rank[sb.state]) || String(sa.due).localeCompare(String(sb.due));
    });

    if (!list.length) {
      return '<div class="cal-empty"><h3>Nothing scheduled yet</h3>' +
        "<p>Add the equipment, licences and contracts your department is answerable for, " +
        "then attach a calibration or maintenance cycle to each. Every date after that is " +
        "worked out for you.</p>" +
        (ro ? "" : '<button class="btn btn-accent" data-act="add-asset">Add an item</button>') +
        "</div>";
    }

    return '<div class="cal-rows">' + list.map(function (sc) {
      var a = assetOf(sc.id);
      var st = statusOf(sc);
      var nd = K.nextDates(lastDone(sc), sc.frequency, sc.pref_dow);
      return '<div class="cal-row st-' + st.state + '">' +
        '<div class="cal-row-main">' +
          "<h4>" + esc(a.name) +
            (a.identifier ? ' <span class="cal-abbr">' + esc(a.identifier) + "</span>" : "") +
          "</h4>" +
          '<div class="cal-meta">' + esc(SCHED_KINDS[sc.kind] || sc.kind) + " · " +
            esc(K.label(sc.frequency)) +
            (a.department ? " · " + esc(a.department) : "") +
            (a.location ? " · " + esc(a.location) : "") +
            (sc.vendor ? " · " + esc(sc.vendor) : "") + "</div>" +
          (nd.preferred
            ? '<div class="cal-next">Next: <b>' + esc(nd.preferred) + "</b>" +
              (nd.shifted ? ' <span class="cal-exact">exact ' + esc(nd.exact) + "</span>" : "") +
              "</div>"
            : '<div class="cal-next">Record when it was last done to start the schedule</div>') +
        "</div>" +
        '<div class="cal-row-side">' + pill(st) +
          (ro ? "" :
            '<button class="btn btn-ghost btn-sm" data-act="log" data-id="' + esc(sc.id) + '">Record it</button>' +
            '<button class="cal-x" data-act="edit-sched" data-id="' + esc(sc.id) + '" aria-label="Edit">\u270e</button>') +
        "</div></div>";
    }).join("") + "</div>";
  }

  function registerView() {
    var ro = !W.canEdit();
    var list = assets.filter(function (a) {
      return !deptFilter || a.department === deptFilter;
    }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });

    if (!list.length) {
      return '<div class="cal-empty"><h3>The register is empty</h3>' +
        "<p>Every item an assessor may ask about — an analyser, a fire NOC, an AMC, a " +
        "nurse's licence — belongs here with its number and its renewal cycle.</p>" +
        (ro ? "" : '<button class="btn btn-accent" data-act="add-asset">Add an item</button>') +
        "</div>";
    }

    return '<div class="cal-bar"><h3>Register</h3>' +
      (ro ? "" : '<button class="btn btn-accent btn-sm" data-act="add-asset">Add an item</button>') +
      "</div>" +
      '<div class="cal-rows">' + list.map(function (a) {
        var mine = schedules.filter(function (sc) { return sc.asset_id === a.id; });
        return '<div class="cal-row">' +
          '<div class="cal-row-main"><h4>' + esc(a.name) +
            (a.identifier ? ' <span class="cal-abbr">' + esc(a.identifier) + "</span>" : "") + "</h4>" +
            '<div class="cal-meta">' + esc(KINDS[a.kind] || a.kind) +
              (a.department ? " · " + esc(a.department) : "") +
              (a.location ? " · " + esc(a.location) : "") +
              (a.manufacturer ? " · " + esc(a.manufacturer) : "") +
              (a.element_code ? " · " + esc(a.element_code) : "") + "</div>" +
            '<div class="cal-next">' +
              (mine.length
                ? mine.length + (mine.length === 1 ? " cycle" : " cycles") + ": " +
                  esc(mine.map(function (sc) { return SCHED_KINDS[sc.kind] || sc.kind; }).join(", "))
                : "No cycle attached — it will never appear on the calendar") +
            "</div>" +
          "</div>" +
          '<div class="cal-row-side">' +
            (ro ? "" :
              '<button class="btn btn-ghost btn-sm" data-act="add-sched" data-id="' + esc(a.id) + '">Add a cycle</button>' +
              '<button class="cal-x" data-act="edit-asset" data-id="' + esc(a.id) + '" aria-label="Edit">\u270e</button>') +
          "</div></div>";
      }).join("") + "</div>";
  }

  function historyView() {
    var list = events.slice().sort(function (a, b) {
      return String(b.performed_on).localeCompare(String(a.performed_on));
    }).filter(function (e) {
      if (!deptFilter) return true;
      var a = assets.filter(function (x) { return x.id === e.asset_id; })[0];
      return a && a.department === deptFilter;
    });

    if (!list.length) {
      return '<div class="cal-empty"><h3>No records yet</h3>' +
        "<p>Every calibration and service recorded here keeps its certificate number and " +
        "its result — which is what an assessor asks to see for a named machine.</p></div>";
    }

    return '<div class="cal-bar"><h3>' + list.length + " record" + (list.length === 1 ? "" : "s") +
      "</h3></div>" +
      '<div class="cal-rows">' + list.map(function (e) {
        var a = assets.filter(function (x) { return x.id === e.asset_id; })[0];
        return '<div class="cal-row' + (e.result === "fail" ? " st-overdue" : "") + '">' +
          '<div class="cal-row-main"><h4>' + esc(a ? a.name : "Removed item") + "</h4>" +
            '<div class="cal-meta">' + esc(SCHED_KINDS[e.kind] || e.kind) + " · " +
              esc(e.performed_on) +
              (e.vendor ? " · " + esc(e.vendor) : "") +
              (e.certificate_no ? ' · cert ' + esc(e.certificate_no) : "") +
              (e.downtime_hours ? " · " + esc(e.downtime_hours) + "h downtime" : "") +
            "</div>" +
            (e.notes ? '<div class="cal-next">' + esc(e.notes) + "</div>" : "") +
          "</div>" +
          '<div class="cal-row-side"><span class="cal-pill st-' +
            (e.result === "fail" ? "overdue" : e.result === "pass" ? "ok" : "soon") + '">' +
            esc(RESULTS[e.result] || e.result) + "</span></div>" +
        "</div>";
      }).join("") + "</div>";
  }

  /* --------------------------------- render --------------------------------- */

  function render() {
    stats();

    var depts = departments();
    document.getElementById("regFilters").innerHTML =
      '<select id="regDept" class="ws-select"><option value="">All departments</option>' +
        depts.map(function (d) {
          return '<option value="' + esc(d) + '"' + (d === deptFilter ? " selected" : "") +
                 ">" + esc(d) + "</option>";
        }).join("") + "</select>" +
      '<select id="regKind" class="ws-select"><option value="">All cycles</option>' +
        Object.keys(SCHED_KINDS).map(function (k) {
          return '<option value="' + k + '"' + (k === kindFilter ? " selected" : "") +
                 ">" + esc(SCHED_KINDS[k]) + "</option>";
        }).join("") + "</select>";

    document.getElementById("regPanel").innerHTML =
      tab === "due" ? dueView() : tab === "register" ? registerView() : historyView();

    var dd = document.getElementById("regDept");
    if (dd) dd.addEventListener("change", function () { deptFilter = this.value; render(); });
    var kk = document.getElementById("regKind");
    if (kk) kk.addEventListener("change", function () { kindFilter = this.value; render(); });
  }

  /* --------------------------------- forms --------------------------------- */

  function opts(map, sel) {
    return Object.keys(map).map(function (k) {
      return '<option value="' + k + '"' + (k === String(sel) ? " selected" : "") + ">" +
             esc(map[k]) + "</option>";
    }).join("");
  }

  function freqOpts(sel) {
    return K.all().map(function (f) {
      return '<option value="' + f + '"' + (f === sel ? " selected" : "") + ">" +
             esc(K.label(f)) + "</option>";
    }).join("");
  }

  function dowOpts(sel) {
    var order = [1, 2, 3, 4, 5, 6, 0];
    return '<option value="">No preference</option>' + order.map(function (n) {
      return '<option value="' + n + '"' + (String(sel) === String(n) ? " selected" : "") +
             ">" + K.dowName(n) + "</option>";
    }).join("");
  }

  function modal(html) {
    var m = document.getElementById("regModal");
    m.innerHTML = '<div class="ws-modal-in">' + html + "</div>";
    m.classList.add("open");
    return m;
  }
  function close() { document.getElementById("regModal").classList.remove("open"); }
  function val(i) { var e = document.getElementById(i); return e ? String(e.value || "").trim() : ""; }

  function openAsset(a) {
    a = a || {};
    modal("<h3>" + (a.id ? "Edit item" : "Add an item") + "</h3>" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label for="aName">What is it?</label>' +
          '<input id="aName" value="' + esc(a.name || "") + '" placeholder="e.g. Defibrillator — ICU bed 4"></div>' +
        '<div class="ws-f"><label for="aKind">Type</label><select id="aKind">' + opts(KINDS, a.kind || "equipment") + "</select></div>" +
        '<div class="ws-f"><label for="aId">Serial / number</label><input id="aId" value="' + esc(a.identifier || "") + '"></div>' +
        '<div class="ws-f"><label for="aDept">Department</label><input id="aDept" value="' + esc(a.department || "") + '" placeholder="e.g. Biomedical"></div>' +
        '<div class="ws-f"><label for="aLoc">Location</label><input id="aLoc" value="' + esc(a.location || "") + '"></div>' +
        '<div class="ws-f"><label for="aMan">Manufacturer</label><input id="aMan" value="' + esc(a.manufacturer || "") + '"></div>' +
        '<div class="ws-f"><label for="aModel">Model</label><input id="aModel" value="' + esc(a.model || "") + '"></div>' +
        '<div class="ws-f"><label for="aOwner">Responsible person</label><input id="aOwner" value="' + esc(a.owner || "") + '"></div>' +
        '<div class="ws-f"><label for="aEl">NABH element</label><input id="aEl" value="' + esc(a.element_code || "") + '" placeholder="e.g. FMS.4"></div>' +
      "</div>" +
      '<div class="ws-modal-actions">' +
        (a.id ? '<button class="btn btn-ghost btn-sm" data-act="del-asset" data-id="' + esc(a.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-asset" data-id="' + esc(a.id || "") + '">Save</button>' +
      "</div>");
    setTimeout(function () { var e = document.getElementById("aName"); if (e) e.focus(); }, 30);
  }

  function openSched(sc, assetId) {
    sc = sc || {};
    var aId = sc.asset_id || assetId;
    var a = assets.filter(function (x) { return x.id === aId; })[0];
    modal("<h3>" + (sc.id ? "Edit cycle" : "Add a cycle") + "</h3>" +
      (a ? '<p class="cal-hint">' + esc(a.name) + "</p>" : "") +
      '<div class="ws-form">' +
        '<div class="ws-f"><label for="sKind">What kind?</label><select id="sKind">' + opts(SCHED_KINDS, sc.kind || "calibration") + "</select></div>" +
        '<div class="ws-f"><label for="sFreq">How often?</label><select id="sFreq">' + freqOpts(sc.frequency || "yearly") + "</select></div>" +
        '<div class="ws-f"><label for="sLast">When was it last done?</label><input id="sLast" type="date" value="' + esc(sc.last_done_on || "") + '"></div>' +
        '<div class="ws-f"><label for="sDow">Preferred day</label><select id="sDow">' + dowOpts(sc.pref_dow) + "</select></div>" +
        '<div class="ws-f"><label for="sVendor">Vendor / engineer</label><input id="sVendor" value="' + esc(sc.vendor || "") + '"></div>' +
        '<div class="ws-f"><label for="sOwner">Responsible person</label><input id="sOwner" value="' + esc(sc.owner || "") + '"></div>' +
      "</div>" +
      '<div class="ws-modal-actions">' +
        (sc.id ? '<button class="btn btn-ghost btn-sm" data-act="del-sched" data-id="' + esc(sc.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-sched" data-id="' + esc(sc.id || "") +
          '" data-asset="' + esc(aId || "") + '">Save</button>' +
      "</div>");
  }

  function openLog(sc) {
    var a = assetOf(sc.id);
    var st = statusOf(sc);
    modal("<h3>Record it</h3>" +
      '<p class="cal-hint">' + esc(a ? a.name : "") + " · " +
        esc(SCHED_KINDS[sc.kind] || sc.kind) +
        (st.due ? " · was due " + esc(st.due) : "") + "</p>" +
      '<div class="ws-form">' +
        '<div class="ws-f"><label for="eOn">Date performed</label>' +
          '<input id="eOn" type="date" value="' + esc(K.fmt(K.today())) + '"></div>' +
        '<div class="ws-f"><label for="eResult">Result</label><select id="eResult">' + opts(RESULTS, "pass") + "</select></div>" +
        '<div class="ws-f"><label for="eBy">Performed by</label><input id="eBy" value="' + esc(sc.vendor || "") + '"></div>' +
        '<div class="ws-f"><label for="eCert">Certificate number</label><input id="eCert" placeholder="An assessor will ask for this"></div>' +
        '<div class="ws-f"><label for="eDown">Downtime (hours)</label><input id="eDown" type="number" min="0" step="0.5"></div>' +
        '<div class="ws-f ws-f-wide"><label for="eNotes">Notes</label><textarea id="eNotes" rows="3"></textarea></div>' +
      "</div>" +
      '<div class="ws-modal-actions"><span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-log" data-id="' + esc(sc.id) + '">Save record</button>' +
      "</div>");
  }

  /* --------------------------------- actions --------------------------------- */

  async function saveAsset(existing) {
    var name = val("aName");
    if (!name) { W.toast("The item needs a name", "bad"); return; }
    await S.adapter.upsert("assets", {
      id: existing || id("asset"),
      name: name,
      kind: val("aKind") || "equipment",
      identifier: val("aId") || null,
      department: val("aDept") || null,
      location: val("aLoc") || null,
      manufacturer: val("aMan") || null,
      model: val("aModel") || null,
      owner: val("aOwner") || null,
      element_code: val("aEl") || null,
      status: "active",
      updated_at: new Date().toISOString()
    });
    close(); await refresh();
    W.toast(existing ? "Saved" : name + " added — attach a cycle so it appears on the calendar", "ok");
  }

  async function saveSched(existing, assetId) {
    if (!assetId) { W.toast("No item selected", "bad"); return; }
    var row = {
      id: existing || id("sched"),
      asset_id: assetId,
      kind: val("sKind") || "calibration",
      frequency: val("sFreq") || "yearly",
      last_done_on: val("sLast") || null,
      pref_dow: val("sDow") === "" ? null : Number(val("sDow")),
      vendor: val("sVendor") || null,
      owner: val("sOwner") || null,
      active: true,
      updated_at: new Date().toISOString()
    };
    await S.adapter.upsert("asset_schedules", row);
    close(); await load();
    tab = "due";
    setTab("due");
    render();
    var nd = K.nextDates(row.last_done_on, row.frequency, row.pref_dow);
    W.toast(nd.preferred ? "Next due " + nd.preferred
                         : "Record when it was last done to start the schedule", "ok");
  }

  async function saveLog(sid) {
    var on = val("eOn");
    if (!on) { W.toast("Pick the date it was performed", "bad"); return; }
    var sc = schedules.filter(function (x) { return x.id === sid; })[0];
    if (!sc) return;
    var down = val("eDown");
    await S.adapter.upsert("asset_events", {
      id: id("aev"),
      asset_id: sc.asset_id,
      schedule_id: sid,
      kind: sc.kind,
      performed_on: on,
      performed_by: val("eBy") || null,
      vendor: val("eBy") || sc.vendor || null,
      certificate_no: val("eCert") || null,
      result: val("eResult") || "pass",
      downtime_hours: down ? Number(down) : null,
      notes: val("eNotes") || null
    });
    /* Keep last_done_on in step. lastDone() prefers recorded events, but the stored field
       is what a fresh device sees before events load, and letting the two drift shows an
       item as overdue that plainly is not. */
    if (!sc.last_done_on || sc.last_done_on < on) {
      sc.last_done_on = on;
      await S.adapter.upsert("asset_schedules", sc);
    }
    if (window.AQActivity) window.AQActivity.record("asset_event_logged", { id: sid, kind: sc.kind });
    close(); await refresh();
    var nd = K.nextDates(on, sc.frequency, sc.pref_dow);
    W.toast("Recorded — next due " + (nd.preferred || "—"), "ok");
  }

  async function removeRow(table, rid) {
    if (!confirm("Remove this permanently?")) return;
    var list = table === "assets" ? assets : schedules;
    var row = list.filter(function (x) { return x.id === rid; })[0];
    if (!row) return;
    /* Soft delete. Records already logged against a condemned machine still have to be
       produceable — an assessor may ask about equipment that was taken out of service. */
    if (table === "assets") row.status = "condemned"; else row.active = false;
    await S.adapter.upsert(table, row);
    close(); await refresh();
    W.toast("Removed", "ok");
  }

  async function refresh() { await load(); render(); }

  function setTab(t) {
    tab = t;
    [].forEach.call(document.querySelectorAll(".cal-tab"), function (x) {
      x.classList.toggle("is-on", x.dataset.tab === t);
    });
  }

  /* --------------------------------- events --------------------------------- */

  function wire() {
    document.getElementById("regTabs").addEventListener("click", function (e) {
      var b = e.target.closest(".cal-tab");
      if (!b) return;
      setTab(b.dataset.tab);
      render();
    });

    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.dataset.act, rid = b.dataset.id;
      var find = function (l) { return l.filter(function (x) { return x.id === rid; })[0]; };

      if (act === "close") close();
      else if (act === "add-asset") openAsset(null);
      else if (act === "edit-asset") openAsset(find(assets));
      else if (act === "save-asset") saveAsset(rid || null);
      else if (act === "del-asset") removeRow("assets", rid);
      else if (act === "add-sched") openSched(null, rid);
      else if (act === "edit-sched") openSched(find(schedules));
      else if (act === "save-sched") saveSched(rid || null, b.dataset.asset);
      else if (act === "del-sched") removeRow("asset_schedules", rid);
      else if (act === "log") openLog(find(schedules));
      else if (act === "save-log") saveLog(rid);
    });

    document.getElementById("regModal").addEventListener("click", function (e) {
      if (e.target.id === "regModal") close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("register"); W.renderModeNotice();
    wire();
    await refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
