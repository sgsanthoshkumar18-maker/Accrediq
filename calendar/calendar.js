/* AQcredix Workspace — committee and compliance calendar.
 *
 * Three views over two tables: a month grid, a committee register, and a recurring-task
 * register. All due-date logic lives in calendar/schedule.js; nothing here does date
 * arithmetic of its own, so there is exactly one place where "overdue" is decided.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, K = window.AQSchedule;
  var esc;

  var committees = [], meetings = [], tasks = [];
  var tab = "calendar";
  var view = K.today();          // the month currently shown in the grid
  var seeded = false;

  var MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  /* A starting set of recurring obligations, offered once. Every one is a real NABH
     expectation with the element it evidences, so a hospital is not staring at an empty
     page wondering what belongs here. They are suggestions the hospital then owns —
     frequency and ownership differ between hospitals and only they can decide. */
  var SEED = [
    { title: "Fire drill / mock evacuation", category: "drill", frequency: "half_yearly", element_code: "FMS.5" },
    { title: "Mock code blue drill", category: "drill", frequency: "quarterly", element_code: "COP.5" },
    { title: "Disaster / mass casualty mock drill", category: "drill", frequency: "yearly", element_code: "FMS.6" },
    { title: "Internal quality audit (all departments)", category: "audit", frequency: "half_yearly", element_code: "IMS.2" },
    { title: "Medical record review", category: "audit", frequency: "monthly", element_code: "IMS.4" },
    { title: "Hand hygiene compliance audit", category: "surveillance", frequency: "monthly", element_code: "HIC.4" },
    { title: "HAI surveillance data review", category: "surveillance", frequency: "monthly", element_code: "HIC.7" },
    { title: "Biomedical equipment calibration", category: "calibration", frequency: "yearly", element_code: "FMS.4" },
    { title: "Crash cart and emergency drug check", category: "review", frequency: "monthly", element_code: "COP.5" },
    { title: "Patient satisfaction survey analysis", category: "review", frequency: "quarterly", element_code: "PRE.7" },
    { title: "Policy and SOP review cycle", category: "review", frequency: "yearly", element_code: "IMS.6" },
    { title: "Staff induction and safety training", category: "training", frequency: "quarterly", element_code: "HRM.5" },
    { title: "BMW handling training", category: "training", frequency: "half_yearly", element_code: "FMS.7" },
    { title: "Fire NOC / statutory licence review", category: "statutory", frequency: "yearly", element_code: "FMS.1" },
    { title: "Water and air quality testing", category: "surveillance", frequency: "quarterly", element_code: "HIC.9" }
  ];

  /* ------------------------------- data ------------------------------- */

  function id(p) {
    return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function load() {
    var res = await Promise.all([
      S.adapter.list("committees").catch(function () { return []; }),
      S.adapter.list("committee_meetings").catch(function () { return []; }),
      S.adapter.list("compliance_tasks").catch(function () { return []; })
    ]);
    committees = (res[0] || []).filter(function (c) { return c.active !== false; });
    meetings = res[1] || [];
    tasks = (res[2] || []).filter(function (t) { return t.active !== false; });
    seeded = tasks.length > 0;
  }

  /* The last meeting actually held beats the stored last_met_on. The stored field is what
     the user typed when adding the committee; once real meetings are recorded, they are
     the better truth and the two must not disagree on screen. */
  function lastMet(c) {
    var held = meetings
      .filter(function (m) { return m.committee_id === c.id && m.held_on; })
      .map(function (m) { return m.held_on; })
      .sort();
    return held.length ? held[held.length - 1] : (c.last_met_on || null);
  }

  function committeeStatus(c) { return K.status(lastMet(c), c.frequency); }
  function taskStatus(t) { return K.status(t.last_done_on, t.frequency); }

  /* ------------------------------- stats ------------------------------- */

  function stats() {
    var all = committees.map(committeeStatus).concat(tasks.map(taskStatus));
    var overdue = all.filter(function (s) { return s.state === "overdue"; }).length;
    var never = all.filter(function (s) { return s.state === "never"; }).length;
    var soon = all.filter(function (s) { return s.state === "due" || s.state === "soon"; }).length;

    document.getElementById("calStats").innerHTML =
      '<div class="ws-stat ws-stat-bad"><span class="n">' + overdue + '</span>' +
        '<span class="l">Overdue</span></div>' +
      '<div class="ws-stat ws-stat-warn"><span class="n">' + soon + '</span>' +
        '<span class="l">Due now or soon</span></div>' +
      '<div class="ws-stat"><span class="n">' + committees.length + '</span>' +
        '<span class="l">Committees tracked</span></div>' +
      '<div class="ws-stat"><span class="n">' + tasks.length + '</span>' +
        '<span class="l">Recurring tasks</span></div>' +
      (never ? '<div class="ws-stat ws-stat-warn"><span class="n">' + never + '</span>' +
        '<span class="l">Never recorded</span><span class="s">No date to schedule from</span></div>' : "");
  }

  /* ------------------------------ month grid ------------------------------ */

  /* Everything falling on a given day, from both sources. */
  function eventsForMonth(y, m) {
    var map = {};
    function push(iso, ev) { (map[iso] = map[iso] || []).push(ev); }

    committees.forEach(function (c) {
      K.inMonth(lastMet(c), c.frequency, y, m).forEach(function (iso) {
        push(iso, { kind: "committee", name: c.short_name || c.name, full: c.name, ref: c });
      });
    });
    tasks.forEach(function (t) {
      K.inMonth(t.last_done_on, t.frequency, y, m).forEach(function (iso) {
        push(iso, { kind: "task", name: t.title, full: t.title, ref: t });
      });
    });
    // Meetings actually held or planned are facts, not projections, so they show too.
    meetings.forEach(function (mt) {
      var iso = mt.held_on || mt.scheduled_on;
      var p = K.parse(iso);
      if (!p || p.y !== y || p.m !== m) return;
      var c = committees.filter(function (x) { return x.id === mt.committee_id; })[0];
      push(iso, { kind: mt.held_on ? "held" : "planned",
                  name: (c ? (c.short_name || c.name) : "Meeting"), full: (c ? c.name : "Meeting"), ref: mt });
    });
    return map;
  }

  function monthGrid() {
    var y = view.y, m = view.m;
    var map = eventsForMonth(y, m);
    var t = K.today();

    /* Monday-first. getDay() is Sunday-based, so shift it; a hospital week starts Monday
       and a Sunday-first grid puts the weekend in the middle of the working week. */
    var firstDow = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    var days = K.daysInMonth(y, m);
    var cells = [];

    for (var i = 0; i < firstDow; i++) cells.push('<div class="cal-cell is-blank"></div>');

    for (var d = 1; d <= days; d++) {
      var iso = K.fmt({ y: y, m: m, d: d });
      var evs = map[iso] || [];
      var isToday = (t.y === y && t.m === m && t.d === d);
      var past = K.cmp({ y: y, m: m, d: d }, t) < 0;

      var chips = evs.slice(0, 3).map(function (e) {
        /* A projected date in the past with nothing recorded against it is a missed
           sitting, and is coloured as such rather than left looking scheduled. */
        var cls = e.kind === "held" ? "is-held"
                : e.kind === "planned" ? "is-planned"
                : (past ? "is-missed" : (e.kind === "committee" ? "is-cmte" : "is-task"));
        return '<span class="cal-chip ' + cls + '" title="' + esc(e.full) + '">' +
               esc(e.name) + "</span>";
      }).join("");
      if (evs.length > 3) chips += '<span class="cal-more">+' + (evs.length - 3) + "</span>";

      cells.push('<div class="cal-cell' + (isToday ? " is-today" : "") +
        (past ? " is-past" : "") + '"><span class="cal-d">' + d + "</span>" + chips + "</div>");
    }

    return '<div class="cal-head">' +
      '<button class="cal-nav" data-go="-1" aria-label="Previous month">\u2039</button>' +
      '<h3>' + MONTHS[m - 1] + " " + y + "</h3>" +
      '<button class="cal-nav" data-go="1" aria-label="Next month">\u203a</button>' +
      '<button class="btn btn-ghost btn-sm" data-go="0">Today</button>' +
      "</div>" +
      '<div class="cal-dow">' + DOW.map(function (d) { return "<span>" + d + "</span>"; }).join("") + "</div>" +
      '<div class="cal-grid">' + cells.join("") + "</div>" +
      '<div class="cal-key">' +
        '<span><i class="k is-cmte"></i>Committee due</span>' +
        '<span><i class="k is-task"></i>Task due</span>' +
        '<span><i class="k is-held"></i>Held</span>' +
        '<span><i class="k is-missed"></i>Missed</span>' +
      "</div>";
  }

  /* ------------------------------ registers ------------------------------ */

  function statusPill(s) {
    return '<span class="cal-pill st-' + s.state + '">' + esc(s.text) + "</span>";
  }

  function committeeList() {
    if (!committees.length) {
      return '<div class="cal-empty"><h3>No committees yet</h3>' +
        "<p>Add the committees your hospital actually runs. You will be asked for the name, " +
        "how often it must meet, and when it last met \u2014 that is enough to work out every " +
        "date from here on.</p>" +
        '<button class="btn btn-accent" data-act="add-cmte">Add a committee</button></div>';
    }
    var ro = !W.canEdit();
    return '<div class="cal-bar"><h3>Committees</h3>' +
      (ro ? "" : '<button class="btn btn-accent btn-sm" data-act="add-cmte">Add a committee</button>') +
      "</div>" +
      '<div class="cal-rows">' + committees.map(function (c) {
        var s = committeeStatus(c);
        var missed = K.missedCount(lastMet(c), c.frequency);
        return '<div class="cal-row st-' + s.state + '" data-id="' + esc(c.id) + '">' +
          '<div class="cal-row-main">' +
            "<h4>" + esc(c.name) + (c.short_name ? ' <span class="cal-abbr">' + esc(c.short_name) + "</span>" : "") + "</h4>" +
            '<div class="cal-meta">' + esc(K.label(c.frequency)) +
              (lastMet(c) ? " \u00b7 last met " + esc(lastMet(c)) : " \u00b7 never met") +
              (c.chairperson ? " \u00b7 chair: " + esc(c.chairperson) : "") + "</div>" +
            (missed > 1 ? '<div class="cal-warn">' + missed + " sittings missed since the last recorded meeting</div>" : "") +
          "</div>" +
          '<div class="cal-row-side">' + statusPill(s) +
            (ro ? "" :
              '<button class="btn btn-ghost btn-sm" data-act="log" data-id="' + esc(c.id) + '">Record a meeting</button>' +
              '<button class="cal-x" data-act="edit-cmte" data-id="' + esc(c.id) + '" aria-label="Edit">\u270e</button>') +
          "</div></div>";
      }).join("") + "</div>";
  }

  function taskList() {
    var ro = !W.canEdit();
    if (!tasks.length) {
      return '<div class="cal-empty"><h3>No recurring tasks yet</h3>' +
        "<p>Drills, audits, calibration, surveillance and training all recur on a cycle an " +
        "assessor will ask about. Start from a standard NABH set and adjust it, or add your own.</p>" +
        (ro ? "" :
          '<button class="btn btn-accent" data-act="seed">Start from the standard set (' + SEED.length + ")</button> " +
          '<button class="btn btn-ghost" data-act="add-task">Add one myself</button>') +
        "</div>";
    }
    return '<div class="cal-bar"><h3>Recurring tasks</h3>' +
      (ro ? "" : '<button class="btn btn-accent btn-sm" data-act="add-task">Add a task</button>') +
      "</div>" +
      '<div class="cal-rows">' + tasks.slice().sort(function (a, b) {
        var sa = taskStatus(a), sb = taskStatus(b);
        var rank = { overdue: 0, never: 1, due: 2, soon: 3, ok: 4 };
        return (rank[sa.state] - rank[sb.state]) || String(a.title).localeCompare(b.title);
      }).map(function (t) {
        var s = taskStatus(t);
        return '<div class="cal-row st-' + s.state + '" data-id="' + esc(t.id) + '">' +
          '<div class="cal-row-main"><h4>' + esc(t.title) + "</h4>" +
            '<div class="cal-meta">' + esc(K.label(t.frequency)) +
              (t.category ? " \u00b7 " + esc(t.category) : "") +
              (t.element_code ? " \u00b7 " + esc(t.element_code) : "") +
              (t.last_done_on ? " \u00b7 last done " + esc(t.last_done_on) : " \u00b7 never recorded") +
            "</div></div>" +
          '<div class="cal-row-side">' + statusPill(s) +
            (ro ? "" :
              '<button class="btn btn-ghost btn-sm" data-act="done" data-id="' + esc(t.id) + '">Mark done</button>' +
              '<button class="cal-x" data-act="edit-task" data-id="' + esc(t.id) + '" aria-label="Edit">\u270e</button>') +
          "</div></div>";
      }).join("") + "</div>";
  }

  /* ------------------------------- render ------------------------------- */

  function render() {
    stats();
    var host = document.getElementById("calPanel");
    host.innerHTML = tab === "calendar" ? monthGrid()
                   : tab === "committees" ? committeeList()
                   : taskList();
  }

  /* ------------------------------- forms ------------------------------- */

  function freqOptions(sel) {
    return K.all().map(function (f) {
      return '<option value="' + f + '"' + (f === sel ? " selected" : "") + ">" +
             esc(K.label(f)) + "</option>";
    }).join("");
  }

  /* Known committees offer a datalist rather than a dropdown: a hospital may run a
     committee that is not on any standard list, and forcing a choice would make them
     record something untrue. */
  function committeeSuggestions() {
    var list = (window.COMMITTEE_DATA || []).map(function (c) { return c.name; });
    return '<datalist id="cmteNames">' + list.map(function (n) {
      return '<option value="' + esc(n) + '">';
    }).join("") + "</datalist>";
  }

  function openCommittee(existing) {
    var c = existing || {};
    var m = document.getElementById("calModal");
    m.innerHTML = '<div class="ws-modal-box"><button class="ws-modal-x" data-act="close">\u2715</button>' +
      "<h3>" + (existing ? "Edit committee" : "Add a committee") + "</h3>" +
      committeeSuggestions() +
      '<label class="ws-f"><span>Committee name</span>' +
        '<input id="fName" list="cmteNames" value="' + esc(c.name || "") + '" placeholder="e.g. Infection Control Committee"></label>' +
      '<label class="ws-f"><span>Short name (optional)</span>' +
        '<input id="fShort" value="' + esc(c.short_name || "") + '" placeholder="ICC"></label>' +
      '<label class="ws-f"><span>How often must it meet?</span>' +
        '<select id="fFreq">' + freqOptions(c.frequency || "quarterly") + "</select></label>" +
      '<label class="ws-f"><span>When did it last meet?</span>' +
        '<input id="fLast" type="date" value="' + esc(c.last_met_on || "") + '">' +
        '<small>Leave blank if it has never met. Every future date is worked out from this.</small></label>' +
      '<label class="ws-f"><span>Chairperson (optional)</span>' +
        '<input id="fChair" value="' + esc(c.chairperson || "") + '"></label>' +
      '<label class="ws-f"><span>Member secretary (optional)</span>' +
        '<input id="fSec" value="' + esc(c.secretary || "") + '"></label>' +
      '<div class="ws-modal-foot">' +
        (existing ? '<button class="btn btn-ghost btn-sm" data-act="del-cmte" data-id="' + esc(c.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button> ' +
        '<button class="btn btn-accent" data-act="save-cmte" data-id="' + esc(c.id || "") + '">Save</button>' +
      "</div></div>";
    m.classList.add("is-open");
    setTimeout(function () { var el = document.getElementById("fName"); if (el) el.focus(); }, 30);
  }

  function openTask(existing) {
    var t = existing || {};
    var m = document.getElementById("calModal");
    m.innerHTML = '<div class="ws-modal-box"><button class="ws-modal-x" data-act="close">\u2715</button>' +
      "<h3>" + (existing ? "Edit task" : "Add a recurring task") + "</h3>" +
      '<label class="ws-f"><span>What is it?</span>' +
        '<input id="fTitle" value="' + esc(t.title || "") + '" placeholder="e.g. Fire drill"></label>' +
      '<label class="ws-f"><span>How often?</span>' +
        '<select id="fFreq">' + freqOptions(t.frequency || "quarterly") + "</select></label>" +
      '<label class="ws-f"><span>When was it last done?</span>' +
        '<input id="fLast" type="date" value="' + esc(t.last_done_on || "") + '"></label>' +
      '<label class="ws-f"><span>Department (optional)</span>' +
        '<input id="fDept" value="' + esc(t.department || "") + '"></label>' +
      '<label class="ws-f"><span>NABH element (optional)</span>' +
        '<input id="fEl" value="' + esc(t.element_code || "") + '" placeholder="e.g. HIC.4"></label>' +
      '<div class="ws-modal-foot">' +
        (existing ? '<button class="btn btn-ghost btn-sm" data-act="del-task" data-id="' + esc(t.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button> ' +
        '<button class="btn btn-accent" data-act="save-task" data-id="' + esc(t.id || "") + '">Save</button>' +
      "</div></div>";
    m.classList.add("is-open");
  }

  function openLog(c) {
    var m = document.getElementById("calModal");
    var s = committeeStatus(c);
    m.innerHTML = '<div class="ws-modal-box"><button class="ws-modal-x" data-act="close">\u2715</button>' +
      "<h3>Record a meeting</h3>" +
      '<p class="ws-sub">' + esc(c.name) + " \u00b7 " + esc(K.label(c.frequency)) +
        (s.due ? " \u00b7 was due " + esc(s.due) : "") + "</p>" +
      '<label class="ws-f"><span>Date held</span>' +
        '<input id="fHeld" type="date" value="' + esc(K.fmt(K.today())) + '"></label>' +
      '<label class="ws-f"><span>Members present (optional)</span>' +
        '<input id="fAtt" type="number" min="0" placeholder="e.g. 8"></label>' +
      '<label class="ws-f cal-check"><input id="fQuorum" type="checkbox" checked>' +
        "<span>Quorum was met</span></label>" +
      '<label class="ws-f"><span>Key decisions / minutes reference (optional)</span>' +
        '<textarea id="fMin" rows="4" placeholder="Action points, or where the signed minutes are filed."></textarea></label>' +
      '<div class="ws-modal-foot"><span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button> ' +
        '<button class="btn btn-accent" data-act="save-log" data-id="' + esc(c.id) + '">Save meeting</button>' +
      "</div></div>";
    m.classList.add("is-open");
  }

  function close() { document.getElementById("calModal").classList.remove("is-open"); }

  function val(elId) {
    var el = document.getElementById(elId);
    return el ? String(el.value || "").trim() : "";
  }

  /* ------------------------------- actions ------------------------------- */

  async function saveCommittee(existingId) {
    var name = val("fName");
    if (!name) { alert("A committee needs a name."); return; }
    var row = {
      id: existingId || id("cmte"),
      name: name,
      short_name: val("fShort") || null,
      frequency: val("fFreq") || "quarterly",
      last_met_on: val("fLast") || null,
      chairperson: val("fChair") || null,
      secretary: val("fSec") || null,
      active: true,
      updated_at: new Date().toISOString()
    };
    await S.adapter.upsert("committees", row);
    if (window.AQActivity) window.AQActivity.record("committee_saved", { name: name });
    close(); await refresh();
  }

  async function saveTask(existingId) {
    var title = val("fTitle");
    if (!title) { alert("A task needs a name."); return; }
    await S.adapter.upsert("compliance_tasks", {
      id: existingId || id("task"),
      title: title,
      frequency: val("fFreq") || "quarterly",
      last_done_on: val("fLast") || null,
      department: val("fDept") || null,
      element_code: val("fEl") || null,
      active: true,
      updated_at: new Date().toISOString()
    });
    close(); await refresh();
  }

  async function saveLog(cid) {
    var held = val("fHeld");
    if (!held) { alert("Pick the date the meeting was held."); return; }
    var att = val("fAtt");
    await S.adapter.upsert("committee_meetings", {
      id: id("mtg"),
      committee_id: cid,
      scheduled_on: held,
      held_on: held,
      status: "held",
      attendance: att ? Number(att) : null,
      quorum_met: !!document.getElementById("fQuorum").checked,
      minutes: val("fMin") || null,
      updated_at: new Date().toISOString()
    });
    /* last_met_on is updated too. lastMet() prefers recorded meetings, but the stored
       field is what a fresh device sees before meetings load, and leaving the two to
       drift would show a committee as overdue that plainly is not. */
    var c = committees.filter(function (x) { return x.id === cid; })[0];
    if (c && (!c.last_met_on || c.last_met_on < held)) {
      c.last_met_on = held;
      await S.adapter.upsert("committees", c);
    }
    if (window.AQActivity) window.AQActivity.record("committee_meeting_logged", { id: cid });
    close(); await refresh();
  }

  async function markDone(tid) {
    var t = tasks.filter(function (x) { return x.id === tid; })[0];
    if (!t) return;
    t.last_done_on = K.fmt(K.today());
    t.updated_at = new Date().toISOString();
    await S.adapter.upsert("compliance_tasks", t);
    await refresh();
  }

  async function seed() {
    for (var i = 0; i < SEED.length; i++) {
      var s = SEED[i];
      await S.adapter.upsert("compliance_tasks", {
        id: id("task"),
        title: s.title, category: s.category, frequency: s.frequency,
        element_code: s.element_code, last_done_on: null, active: true
      });
    }
    await refresh();
  }

  async function removeRow(table, rid) {
    if (!confirm("Remove this permanently?")) return;
    /* Soft delete. A hospital that removes a committee still has meetings recorded
       against it, and an assessor may ask about a committee that was stood down. */
    var list = table === "committees" ? committees : tasks;
    var row = list.filter(function (x) { return x.id === rid; })[0];
    if (!row) return;
    row.active = false;
    await S.adapter.upsert(table, row);
    close(); await refresh();
  }

  async function refresh() { await load(); render(); }

  /* ------------------------------- events ------------------------------- */

  function wire() {
    document.getElementById("calTabs").addEventListener("click", function (e) {
      var b = e.target.closest(".cal-tab");
      if (!b) return;
      tab = b.dataset.tab;
      [].forEach.call(document.querySelectorAll(".cal-tab"), function (x) {
        x.classList.toggle("is-on", x === b);
      });
      render();
    });

    document.addEventListener("click", function (e) {
      var go = e.target.closest("[data-go]");
      if (go) {
        var n = Number(go.dataset.go);
        view = n === 0 ? K.today() : K.addMonths({ y: view.y, m: view.m, d: 1 }, n);
        render();
        return;
      }
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.dataset.act, rid = b.dataset.id;
      var find = function (list) { return list.filter(function (x) { return x.id === rid; })[0]; };

      if (act === "close") close();
      else if (act === "add-cmte") openCommittee(null);
      else if (act === "edit-cmte") openCommittee(find(committees));
      else if (act === "save-cmte") saveCommittee(rid || null);
      else if (act === "del-cmte") removeRow("committees", rid);
      else if (act === "log") openLog(find(committees));
      else if (act === "save-log") saveLog(rid);
      else if (act === "add-task") openTask(null);
      else if (act === "edit-task") openTask(find(tasks));
      else if (act === "save-task") saveTask(rid || null);
      else if (act === "del-task") removeRow("compliance_tasks", rid);
      else if (act === "done") markDone(rid);
      else if (act === "seed") seed();
    });

    document.getElementById("calModal").addEventListener("click", function (e) {
      if (e.target.id === "calModal") close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  /* The same start-up shape every workspace page uses: gate first, then reveal the body.
     There is no onReady helper — gate() is the hook. */
  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    document.getElementById("wsBody").style.display = "";
    W.renderNav("calendar"); W.renderModeNotice();
    wire();
    await refresh();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
