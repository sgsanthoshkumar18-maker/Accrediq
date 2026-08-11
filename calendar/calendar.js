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

  var MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
  var DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

  /* Status is measured against the PREFERRED date — the day the meeting will actually be
     held — because that is what the hospital is working towards. The exact date is still
     shown alongside so the compliance interval is never hidden. */
  function committeeStatus(c) {
    var d = K.nextDates(lastMet(c), c.frequency, c.pref_dow);
    return K.status(lastMet(c), c.frequency, null, d.preferred);
  }
  function taskStatus(t) {
    var d = K.nextDates(t.last_done_on, t.frequency, t.pref_dow);
    return K.status(t.last_done_on, t.frequency, null, d.preferred);
  }

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
      K.inMonth(lastMet(c), c.frequency, y, m, c.pref_dow).forEach(function (iso) {
        push(iso, { kind: "committee", name: c.short_name || c.name, full: c.name, ref: c });
      });
    });
    tasks.forEach(function (t) {
      K.inMonth(t.last_done_on, t.frequency, y, m, t.pref_dow).forEach(function (iso) {
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
        var nd = K.nextDates(lastMet(c), c.frequency, c.pref_dow);
        return '<div class="cal-row st-' + s.state + '" data-id="' + esc(c.id) + '">' +
          '<div class="cal-row-main">' +
            "<h4>" + esc(c.name) + (c.short_name ? ' <span class="cal-abbr">' + esc(c.short_name) + "</span>" : "") + "</h4>" +
            '<div class="cal-meta">' + esc(K.label(c.frequency)) +
              (lastMet(c) ? " \u00b7 last met " + esc(lastMet(c)) : " \u00b7 never met") +
              (c.chairperson ? " \u00b7 chair: " + esc(c.chairperson) : "") +
              (c.secretary ? " \u00b7 convener: " + esc(c.secretary) : "") + "</div>" +
            (nd.preferred ? '<div class="cal-next">Next: <b>' + esc(nd.preferred) + "</b> (" +
                esc(K.dowName(K.dayOfWeek(K.parse(nd.preferred)))) + ")" +
                (nd.shifted ? ' <span class="cal-exact">compliance date ' + esc(nd.exact) + "</span>" : "") +
              "</div>" : "") +
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
        (ro ? "" : '<button class="btn btn-accent" data-act="add-task">Add a task</button>') +
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
        var nd = K.nextDates(t.last_done_on, t.frequency, t.pref_dow);
        return '<div class="cal-row st-' + s.state + '" data-id="' + esc(t.id) + '">' +
          '<div class="cal-row-main"><h4>' + esc(t.title) + "</h4>" +
            '<div class="cal-meta">' + esc(K.label(t.frequency)) +
              (t.category ? " \u00b7 " + esc(t.category) : "") +
              (t.element_code ? " \u00b7 " + esc(t.element_code) : "") +
              (t.owner ? " \u00b7 " + esc(t.owner) : "") +
              (t.last_done_on ? " \u00b7 last done " + esc(t.last_done_on) : " \u00b7 never recorded") +
            "</div>" +
            (nd.preferred ? '<div class="cal-next">Next due: <b>' + esc(nd.preferred) + "</b> (" +
                esc(K.dowName(K.dayOfWeek(K.parse(nd.preferred)))) + ")" +
                (nd.shifted ? ' <span class="cal-exact">exact ' + esc(nd.exact) + "</span>" : "") +
              "</div>"
              : '<div class="cal-next">Record when it was last done to start the schedule</div>') +
          "</div>" +
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

  function dowOptions(sel) {
    /* Sunday last: a hospital committee week runs Monday to Saturday, and putting Sunday
       first is a US calendar convention that reads as an error here. */
    var order = [1, 2, 3, 4, 5, 6, 0];
    return '<option value="">No preference \u2014 use the exact date</option>' +
      order.map(function (n) {
        return '<option value="' + n + '"' + (String(sel) === String(n) ? " selected" : "") +
               ">" + K.dowName(n) + "</option>";
      }).join("");
  }

  function openCommittee(existing) {
    var c = existing || {};
    var m = document.getElementById("calModal");
    m.innerHTML =
      '<div class="ws-modal-in"><h3>' + (existing ? "Edit committee" : "Add a committee") + "</h3>" +
      committeeSuggestions() +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label for="fName">Committee name</label>' +
          '<input id="fName" list="cmteNames" value="' + esc(c.name || "") +
          '" placeholder="e.g. Infection Control Committee"></div>' +
        '<div class="ws-f"><label for="fShort">Short name</label>' +
          '<input id="fShort" value="' + esc(c.short_name || "") + '" placeholder="ICC"></div>' +
        '<div class="ws-f"><label for="fChair">Chairperson</label>' +
          '<input id="fChair" value="' + esc(c.chairperson || "") + '" placeholder="Who chairs it"></div>' +
        '<div class="ws-f"><label for="fSec">Convener / member secretary</label>' +
          '<input id="fSec" value="' + esc(c.secretary || "") + '" placeholder="Who convenes it"></div>' +
        '<div class="ws-f"><label for="fFreq">How often must it meet?</label>' +
          '<select id="fFreq">' + freqOptions(c.frequency || "quarterly") + "</select></div>" +
        '<div class="ws-f"><label for="fLast">When did it last meet?</label>' +
          '<input id="fLast" type="date" value="' + esc(c.last_met_on || "") + '"></div>' +
        '<div class="ws-f"><label for="fDow">Preferred day of the week</label>' +
          '<select id="fDow">' + dowOptions(c.pref_dow) + "</select></div>" +
        '<div class="ws-f ws-f-wide"><label>&nbsp;</label>' +
          '<p class="cal-hint" id="fHint"></p></div>' +
      "</div>" +
      '<div class="ws-modal-actions">' +
        (existing ? '<button class="btn btn-ghost btn-sm" data-act="del-cmte" data-id="' + esc(c.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-cmte" data-id="' + esc(c.id || "") + '">Save</button>' +
      "</div></div>";
    m.classList.add("open");
    ["fFreq", "fLast", "fDow"].forEach(function (elId) {
      var el = document.getElementById(elId);
      if (el) el.addEventListener("change", hint);
    });
    hint();
    setTimeout(function () { var el = document.getElementById("fName"); if (el) el.focus(); }, 30);
  }

  /* Show the consequence of the choices while they are being made, rather than after
     saving. The exact/preferred split is the surprising part of this form and a hospital
     should see both dates before committing to a weekday preference. */
  function hint() {
    var h = document.getElementById("fHint");
    if (!h) return;
    var last = val("fLast");
    if (!last) {
      h.innerHTML = "Leave the last-met date blank if the committee has never sat \u2014 " +
        "it will show as <b>never recorded</b> until you log a meeting.";
      return;
    }
    var d = K.nextDates(last, val("fFreq"), val("fDow"));
    h.innerHTML = d.shifted
      ? "Next sitting is due <b>" + esc(d.exact) + "</b> (" + esc(K.dowName(K.dayOfWeek(K.parse(d.exact)))) +
        "). The nearest " + esc(K.dowName(Number(val("fDow")))) + " is <b>" + esc(d.preferred) +
        "</b>, which is what the calendar will show. The exact date is kept as the compliance date."
      : "Next sitting is due <b>" + esc(d.exact) + "</b> (" +
        esc(K.dowName(K.dayOfWeek(K.parse(d.exact)))) + ").";
  }

  function openTask(existing) {
    var t = existing || {};
    var m = document.getElementById("calModal");
    m.innerHTML =
      '<div class="ws-modal-in"><h3>' + (existing ? "Edit task" : "Add a recurring task") + "</h3>" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label for="fTitle">What is it?</label>' +
          '<input id="fTitle" value="' + esc(t.title || "") + '" placeholder="e.g. Fire drill"></div>' +
        '<div class="ws-f"><label for="fFreq">How often?</label>' +
          '<select id="fFreq">' + freqOptions(t.frequency || "quarterly") + "</select></div>" +
        '<div class="ws-f"><label for="fLast">When was it last done?</label>' +
          '<input id="fLast" type="date" value="' + esc(t.last_done_on || "") + '"></div>' +
        '<div class="ws-f"><label for="fDow">Preferred day of the week</label>' +
          '<select id="fDow">' + dowOptions(t.pref_dow) + "</select></div>" +
        '<div class="ws-f"><label for="fOwner">Who is responsible?</label>' +
          '<input id="fOwner" value="' + esc(t.owner || "") + '"></div>' +
        '<div class="ws-f"><label for="fDept">Department</label>' +
          '<input id="fDept" value="' + esc(t.department || "") + '"></div>' +
        '<div class="ws-f"><label for="fEl">NABH element</label>' +
          '<input id="fEl" value="' + esc(t.element_code || "") + '" placeholder="e.g. HIC.4"></div>' +
        '<div class="ws-f ws-f-wide"><label>&nbsp;</label><p class="cal-hint" id="fHint"></p></div>' +
      "</div>" +
      '<div class="ws-modal-actions">' +
        (existing ? '<button class="btn btn-ghost btn-sm" data-act="del-task" data-id="' + esc(t.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-task" data-id="' + esc(t.id || "") + '">Save</button>' +
      "</div></div>";
    m.classList.add("open");
    ["fFreq", "fLast", "fDow"].forEach(function (elId) {
      var el = document.getElementById(elId);
      if (el) el.addEventListener("change", hint);
    });
    hint();
    setTimeout(function () { var el = document.getElementById("fTitle"); if (el) el.focus(); }, 30);
  }

  function openLog(c) {
    var m = document.getElementById("calModal");
    var s = committeeStatus(c);
    m.innerHTML =
      '<div class="ws-modal-in"><h3>Record a meeting</h3>' +
      '<p class="cal-hint">' + esc(c.name) + " \u00b7 " + esc(K.label(c.frequency)) +
        (s.due ? " \u00b7 was due " + esc(s.due) : "") + "</p>" +
      '<div class="ws-form">' +
        '<div class="ws-f"><label for="fHeld">Date held</label>' +
          '<input id="fHeld" type="date" value="' + esc(K.fmt(K.today())) + '"></div>' +
        '<div class="ws-f"><label for="fAtt">Members present</label>' +
          '<input id="fAtt" type="number" min="0" placeholder="e.g. 8"></div>' +
        '<div class="ws-f ws-f-wide"><label for="fQuorum">Quorum</label>' +
          '<label class="cal-check"><input id="fQuorum" type="checkbox" checked>' +
          "<span>Quorum was met</span></label></div>" +
        '<div class="ws-f ws-f-wide"><label for="fMin">Key decisions / where the minutes are filed</label>' +
          '<textarea id="fMin" rows="4"></textarea></div>' +
      "</div>" +
      '<div class="ws-modal-actions"><span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-log" data-id="' + esc(c.id) + '">Save meeting</button>' +
      "</div></div>";
    m.classList.add("open");
  }

  function close() { document.getElementById("calModal").classList.remove("open"); }

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
      pref_dow: val("fDow") === "" ? null : Number(val("fDow")),
      active: true,
      updated_at: new Date().toISOString()
    };
    await S.adapter.upsert("committees", row);
    if (window.AQActivity) window.AQActivity.record("committee_saved", { name: name });
    close();
    var nd = K.nextDates(row.last_met_on, row.frequency, row.pref_dow);
    await load();
    showOnCalendar(nd.preferred);
    render();
    W.toast(nd.preferred
      ? name + " added \u2014 next sitting " + nd.preferred
      : name + " added \u2014 record a meeting to start the schedule", "ok");
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
      owner: val("fOwner") || null,
      pref_dow: val("fDow") === "" ? null : Number(val("fDow")),
      active: true,
      updated_at: new Date().toISOString()
    });
    close();
    var nd = K.nextDates(val("fLast") || null, val("fFreq"), val("fDow"));
    await load();
    showOnCalendar(nd.preferred);
    render();
    W.toast(nd.preferred
      ? title + " added \u2014 next due " + nd.preferred
      : title + " added \u2014 record when it was last done to start the schedule", "ok");
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
    close();
    await load();
    var cc = committees.filter(function (x) { return x.id === cid; })[0];
    var nd2 = cc ? K.nextDates(lastMet(cc), cc.frequency, cc.pref_dow) : { preferred: held };
    showOnCalendar(nd2.preferred || held);
    render();
    W.toast("Meeting recorded \u2014 next sitting " + (nd2.preferred || "\u2014"), "ok");
  }

  async function markDone(tid) {
    var t = tasks.filter(function (x) { return x.id === tid; })[0];
    if (!t) return;
    t.last_done_on = K.fmt(K.today());
    t.updated_at = new Date().toISOString();
    await S.adapter.upsert("compliance_tasks", t);
    await load();
    var nd = K.nextDates(t.last_done_on, t.frequency, t.pref_dow);
    showOnCalendar(nd.preferred);
    render();
    W.toast("Marked done \u2014 next due " + (nd.preferred || "\u2014"), "ok");
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

  /* After a save, switch to the calendar and show the month the new date falls in. The
     whole point of adding a committee is to see it land on a date; leaving the user on
     the register makes them hunt for confirmation that anything happened. */
  function showOnCalendar(iso) {
    var p = K.parse(iso);
    if (p) view = { y: p.y, m: p.m, d: 1 };
    tab = "calendar";
    [].forEach.call(document.querySelectorAll(".cal-tab"), function (x) {
      x.classList.toggle("is-on", x.dataset.tab === "calendar");
    });
  }

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
