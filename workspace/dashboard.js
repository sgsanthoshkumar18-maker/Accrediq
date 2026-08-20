/* AQcredix Workspace — the department dashboard.
 *
 * Everything already in the platform, filtered to ONE department: what is overdue here,
 * which equipment needs calibrating, which rounds are due, which findings are open, which
 * SOPs this department must hold.
 *
 * WHY THIS MATTERS MORE THAN IT LOOKS. Every other page answers the quality manager's
 * question — how is the hospital doing. A department head has a different question: what
 * do I have to do. Until they can answer it in one screen, the quality manager forwards
 * PDFs and the platform has one user instead of twenty.
 *
 * No new tables. This is a view, not a feature, which is why it is worth building first.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, K = window.AQSchedule;
  var esc;

  var dept = "";
  var data = {
    tasks: [], committees: [], meetings: [],
    assets: [], schedules: [], events: [],
    lists: [], rounds: [], capa: [], incidents: []
  };

  async function load() {
    var names = ["compliance_tasks", "committees", "committee_meetings",
                 "assets", "asset_schedules", "asset_events",
                 "checklists", "rounds", "capa", "incidents"];
    var keys = ["tasks", "committees", "meetings",
                "assets", "schedules", "events",
                "lists", "rounds", "capa", "incidents"];
    var got = await Promise.all(names.map(function (n) {
      /* One missing table must not blank the whole dashboard. A department head opening
         this page to find out what is overdue is the worst moment to show an error. */
      return S.adapter.list(n).catch(function () { return []; });
    }));
    keys.forEach(function (k, i) { data[k] = got[i] || []; });
  }

  /* Departments the hospital actually uses, gathered from what has been entered rather
     than from a fixed list — a hospital's own naming is the naming its staff recognise. */
  function departments() {
    var seen = {};
    function add(v) { if (v) seen[v] = 1; }
    data.tasks.forEach(function (x) { add(x.department); });
    data.assets.forEach(function (x) { add(x.department); });
    data.lists.forEach(function (x) { add(x.department); });
    data.capa.forEach(function (x) { add(x.department); });
    data.incidents.forEach(function (x) { add(x.department); });
    return Object.keys(seen).sort();
  }

  /* ------------------------------ what is due ------------------------------ */

  function lastOf(rows, key, matchKey, matchVal, fallback) {
    var d = rows.filter(function (r) { return r[matchKey] === matchVal && r[key]; })
                .map(function (r) { return r[key]; }).sort();
    return d.length ? d[d.length - 1] : (fallback || null);
  }

  /* Every recurring obligation this department owns, from all three engines, in one list
     sorted by how late it is. The three engines store different things; a department head
     does not care which table a job came from, only when it was due. */
  function dueItems() {
    var out = [];

    data.tasks.filter(function (t) {
      return t.active !== false && (!dept || t.department === dept);
    }).forEach(function (t) {
      var d = K.nextDates(t.last_done_on, t.frequency, t.pref_dow);
      out.push({ kind: "Task", name: t.title, meta: K.label(t.frequency),
                 el: t.element_code, due: d.preferred,
                 st: K.status(t.last_done_on, t.frequency, null, d.preferred),
                 href: "calendar.html" });
    });

    data.schedules.filter(function (sc) { return sc.active !== false; }).forEach(function (sc) {
      var a = data.assets.filter(function (x) { return x.id === sc.asset_id; })[0];
      if (!a || a.status === "condemned") return;
      if (dept && a.department !== dept) return;
      var last = lastOf(data.events, "performed_on", "schedule_id", sc.id, sc.last_done_on);
      var d = K.nextDates(last, sc.frequency, sc.pref_dow);
      out.push({ kind: "Equipment", name: a.name,
                 meta: (sc.kind || "").replace(/_/g, " ") + " · " + K.label(sc.frequency),
                 el: a.element_code, due: d.preferred,
                 st: K.status(last, sc.frequency, null, d.preferred),
                 href: "register.html" });
    });

    data.lists.filter(function (l) {
      return l.active !== false && (!dept || l.department === dept);
    }).forEach(function (l) {
      var last = lastOf(data.rounds, "performed_on", "checklist_id", l.id, l.last_done_on);
      var d = K.nextDates(last, l.frequency, l.pref_dow);
      out.push({ kind: "Round", name: l.name, meta: K.label(l.frequency),
                 el: l.element_code, due: d.preferred,
                 st: K.status(last, l.frequency, null, d.preferred),
                 href: "rounds.html" });
    });

    /* Committees are hospital-wide, not departmental, so they appear only in the
       all-departments view. Showing every committee to the pharmacy would bury the four
       things the pharmacy actually owns. */
    if (!dept) {
      data.committees.filter(function (c) { return c.active !== false; }).forEach(function (c) {
        var last = lastOf(data.meetings, "held_on", "committee_id", c.id, c.last_met_on);
        var d = K.nextDates(last, c.frequency, c.pref_dow);
        out.push({ kind: "Committee", name: c.name, meta: K.label(c.frequency),
                   el: null, due: d.preferred,
                   st: K.status(last, c.frequency, null, d.preferred),
                   href: "calendar.html" });
      });
    }

    var rank = { overdue: 0, never: 1, due: 2, soon: 3, ok: 4 };
    return out.sort(function (a, b) {
      return (rank[a.st.state] - rank[b.st.state]) ||
             ((a.st.days == null ? 0 : a.st.days) - (b.st.days == null ? 0 : b.st.days));
    });
  }

  function openFindings() {
    return data.capa.filter(function (c) {
      if (c.status === "closed") return false;
      return !dept || c.department === dept;
    });
  }

  function recentIncidents() {
    return data.incidents.filter(function (i) {
      return !dept || i.department === dept;
    }).sort(function (a, b) {
      return String(b.occurred_on || "").localeCompare(String(a.occurred_on || ""));
    }).slice(0, 5);
  }

  /* SOPs this department must hold, from the assessor checklist scope. Free elsewhere on
     the site and free here: knowing what you are answerable for is not the paid part. */
  function sopsFor(name) {
    if (!name || !window.AUDIT_SCOPE || !window.NABH_DATA) return [];
    var scope = window.AUDIT_SCOPE;
    var key = Object.keys(scope).filter(function (k) {
      return scope[k].name && scope[k].name.toLowerCase() === name.toLowerCase();
    })[0];
    if (!key) return [];
    var codes = {};
    (scope[key].codes || []).forEach(function (c) { codes[c] = 1; });

    var out = [];
    var D = window.NABH_DATA;
    Object.keys(D.chapters).forEach(function (ch) {
      (D.chapters[ch].standards || []).forEach(function (std) {
        (std.elements || []).forEach(function (e) {
          var code = std.code + "." + e.letter;
          if (e.sop && codes[code]) out.push({ code: code, text: e.text, chapter: ch });
        });
      });
    });
    return out;
  }

  /* --------------------------------- render --------------------------------- */

  function render() {
    var due = dueItems();
    var overdue = due.filter(function (d) { return d.st.state === "overdue"; });
    var soon = due.filter(function (d) { return d.st.state === "due" || d.st.state === "soon"; });
    var never = due.filter(function (d) { return d.st.state === "never"; });
    var findings = openFindings();
    var sops = dept ? sopsFor(dept) : [];

    document.getElementById("dashStats").innerHTML =
      '<div class="ws-stat ws-stat-bad"><span class="n">' + overdue.length + '</span>' +
        '<span class="l">Overdue</span></div>' +
      '<div class="ws-stat ws-stat-warn"><span class="n">' + soon.length + '</span>' +
        '<span class="l">Due now or soon</span></div>' +
      '<div class="ws-stat"><span class="n">' + findings.length + '</span>' +
        '<span class="l">Open findings</span></div>' +
      (dept
        ? '<div class="ws-stat"><span class="n">' + sops.length + '</span>' +
          '<span class="l">SOPs to hold</span></div>'
        : '<div class="ws-stat"><span class="n">' + due.length + '</span>' +
          '<span class="l">Tracked obligations</span></div>') +
      (never.length ? '<div class="ws-stat ws-stat-warn"><span class="n">' + never.length +
        '</span><span class="l">Never recorded</span></div>' : "");

    var host = document.getElementById("dashPanel");

    if (!due.length && !findings.length) {
      host.innerHTML = '<div class="cal-empty"><h3>' +
        (dept ? "Nothing tracked for " + esc(dept) + " yet" : "Nothing tracked yet") + "</h3>" +
        "<p>Add this department's recurring obligations, equipment and rounds, and they " +
        "will all appear here — sorted by how late they are.</p>" +
        '<a class="btn btn-accent" href="calendar.html">Compliance calendar</a> ' +
        '<a class="btn btn-ghost" href="register.html">Equipment register</a></div>';
      return;
    }

    var html = "";

    /* Overdue first, and separated rather than merely sorted. A department head scanning
       this page should not have to read a status column to find the things that are late. */
    if (overdue.length || never.length) {
      html += section("Needs attention now", overdue.concat(never));
    }
    if (soon.length) html += section("Coming up", soon);

    var ok = due.filter(function (d) { return d.st.state === "ok"; });
    if (ok.length) html += section("On track", ok, true);

    if (findings.length) {
      html += '<h3 class="dash-h">Open findings</h3><div class="cal-rows">' +
        findings.map(function (c) {
          return '<div class="cal-row st-overdue"><div class="cal-row-main">' +
            "<h4>" + esc(c.title) + "</h4>" +
            '<div class="cal-meta">' + esc(c.status || "open") +
              (c.owner ? " · " + esc(c.owner) : "") +
              (c.element_code ? " · " + esc(c.element_code) : "") + "</div></div>" +
            '<div class="cal-row-side"><a class="btn btn-ghost btn-sm" href="capa.html">Open</a></div>' +
          "</div>";
        }).join("") + "</div>";
    }

    var inc = recentIncidents();
    if (inc.length) {
      html += '<h3 class="dash-h">Recent incidents</h3><div class="cal-rows">' +
        inc.map(function (i) {
          return '<div class="cal-row"><div class="cal-row-main">' +
            "<h4>" + esc(i.type || "Incident") + "</h4>" +
            '<div class="cal-meta">' + esc(i.occurred_on || "") +
              (i.severity ? " · " + esc(i.severity) : "") +
              (i.status ? " · " + esc(i.status) : "") + "</div></div>" +
            '<div class="cal-row-side"><a class="btn btn-ghost btn-sm" href="incidents.html">Open</a></div>' +
          "</div>";
        }).join("") + "</div>";
    }

    if (dept && sops.length) {
      html += '<h3 class="dash-h">SOPs ' + esc(dept) + " must hold</h3>" +
        '<p class="dash-sub">From the NABH assessor checklist. The same written procedure ' +
        "can serve several departments.</p>" +
        '<div class="dash-sops">' + sops.map(function (s) {
          return '<a class="dash-sop" href="../standards.html?chapter=' + esc(s.chapter) +
            "#" + esc(s.code) + '"><b>' + esc(s.code) + "</b><span>" + esc(s.text) + "</span></a>";
        }).join("") + "</div>";
    }

    host.innerHTML = html;
  }

  function section(title, items, quiet) {
    return '<h3 class="dash-h' + (quiet ? " is-quiet" : "") + '">' + esc(title) +
      ' <span class="dash-n">' + items.length + "</span></h3>" +
      '<div class="cal-rows">' + items.map(function (d) {
        return '<div class="cal-row st-' + d.st.state + '">' +
          '<div class="cal-row-main">' +
            '<span class="dash-kind">' + esc(d.kind) + "</span>" +
            "<h4>" + esc(d.name) + "</h4>" +
            '<div class="cal-meta">' + esc(d.meta) +
              (d.el ? " · " + esc(d.el) : "") + "</div>" +
            (d.due ? '<div class="cal-next">Due <b>' + esc(d.due) + "</b></div>" : "") +
          "</div>" +
          '<div class="cal-row-side"><span class="cal-pill st-' + d.st.state + '">' +
            esc(d.st.text) + "</span>" +
            '<a class="btn btn-ghost btn-sm" href="' + esc(d.href) + '">Open</a></div>' +
        "</div>";
      }).join("") + "</div>";
  }

  function paintPicker() {
    var list = departments();
    document.getElementById("dashPicker").innerHTML =
      '<select id="dashDept" class="ws-select">' +
        '<option value="">Whole hospital</option>' +
        list.map(function (d) {
          return '<option value="' + esc(d) + '"' + (d === dept ? " selected" : "") +
                 ">" + esc(d) + "</option>";
        }).join("") + "</select>" +
      (dept ? '<span class="dash-showing">Showing ' + esc(dept) + "</span>" : "");

    document.getElementById("dashDept").addEventListener("change", function () {
      dept = this.value;
      /* Remembered per person, server-side, so a department head lands on their own
         department every time rather than re-picking it each morning. */
      saveDept(dept);
      paintPicker();
      render();
    });
  }

  async function saveDept(v) {
    try { localStorage.setItem("aq-dash-dept", v || ""); } catch (e) {}
    try {
      var me = await S.currentUser();
      if (!me || !me.id) return;
      await S.adapter.upsert("user_prefs", {
        user_id: me.id,
        prefs: { department: v || null },
        updated_at: new Date().toISOString()
      });
    } catch (e) {}
  }

  async function loadDept() {
    /* The cache answers instantly so the page does not render the wrong department and
       then swap under the reader. The server is still the record. */
    try { dept = localStorage.getItem("aq-dash-dept") || ""; } catch (e) {}
    try {
      var rows = await S.adapter.list("user_prefs");
      var p = (rows || [])[0];
      if (p && p.prefs && p.prefs.department) {
        dept = p.prefs.department;
        try { localStorage.setItem("aq-dash-dept", dept); } catch (e) {}
      }
    } catch (e) {}
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("dashboard"); W.renderModeNotice();

    await load();
    await loadDept();
    /* A department stored from a previous session may no longer exist — a hospital
       renames a unit, or the last item in it was removed. Falling back to the whole
       hospital is better than an empty page that looks broken. */
    if (dept && departments().indexOf(dept) < 0) dept = "";
    paintPicker();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
