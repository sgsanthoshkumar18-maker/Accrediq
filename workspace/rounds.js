/* AQcredix Workspace — rounds and checklists.
 *
 * The third shape a department keeps: a recurring check that produces a SCORE. Hand
 * hygiene rounds for IPC, cleaning audits for housekeeping, record review for medical
 * records, crash cart checks for every ward, BMW segregation for facilities.
 *
 * Distinct from the compliance calendar, which asks only "was it done". Here the number
 * is the point: an assessor asks what your compliance rate is and, more pointedly,
 * whether it moved after you found it was low.
 *
 * Due dates come from calendar/schedule.js. Scoring is the only maths here, and it is
 * kept in one pure function so the trend, the badge and the stored value cannot disagree.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, K = window.AQSchedule;
  var esc;

  var lists = [], items = [], rounds = [];
  var tab = "due";
  var deptFilter = "";

  function id(p) {
    return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function load() {
    var r = await Promise.all([
      S.adapter.list("checklists").catch(function () { return []; }),
      S.adapter.list("checklist_items").catch(function () { return []; }),
      S.adapter.list("rounds").catch(function () { return []; })
    ]);
    lists = (r[0] || []).filter(function (x) { return x.active !== false; });
    items = r[1] || [];
    rounds = r[2] || [];
  }

  function itemsOf(lid) {
    return items.filter(function (i) { return i.checklist_id === lid; })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
  }

  function roundsOf(lid) {
    return rounds.filter(function (r) { return r.checklist_id === lid; })
      .sort(function (a, b) { return String(b.performed_on).localeCompare(String(a.performed_on)); });
  }

  function lastDone(l) {
    var rs = roundsOf(l.id);
    return rs.length ? rs[0].performed_on : (l.last_done_on || null);
  }

  function statusOf(l) {
    var last = lastDone(l);
    var d = K.nextDates(last, l.frequency, l.pref_dow);
    return K.status(last, l.frequency, null, d.preferred);
  }

  /* ------------------------------- scoring -------------------------------
     One pure function, so the badge, the trend and the stored value cannot disagree.
     'na' is EXCLUDED from the denominator rather than counted as a pass: a crash cart
     with no paediatric drawer should not score 100% for having nothing to check, and it
     should not be punished for a drawer it is not required to have either. */

  function score(answers, list) {
    var qs = itemsOf(list.id);
    var yes = 0, applicable = 0, criticalFail = false;
    qs.forEach(function (q) {
      var a = answers[q.id];
      if (a === "na" || a == null) return;
      applicable++;
      if (a === "yes") yes++;
      else if (q.critical) criticalFail = true;
    });
    var pct = applicable ? Math.round((yes / applicable) * 1000) / 10 : null;
    /* A critical item failing fails the round outright. You cannot average away a missing
       resuscitation drug, and a hospital that scores 95% with a dead defibrillator has
       learned nothing from the round. */
    var passed = pct == null ? null
      : (!criticalFail && pct >= (Number(list.target_pct) || 0));
    return { pct: pct, passed: passed, criticalFail: criticalFail,
             answered: applicable, total: qs.length };
  }

  function trend(l) {
    var rs = roundsOf(l.id).filter(function (r) { return r.score_pct != null; }).slice(0, 6).reverse();
    if (rs.length < 2) return null;
    return { points: rs.map(function (r) { return Number(r.score_pct); }),
             delta: Number(rs[rs.length - 1].score_pct) - Number(rs[0].score_pct) };
  }

  /* --------------------------------- stats --------------------------------- */

  function visible() {
    return lists.filter(function (l) { return !deptFilter || l.department === deptFilter; });
  }

  function stats() {
    var v = visible();
    var st = v.map(statusOf);
    var overdue = st.filter(function (x) { return x.state === "overdue"; }).length;
    var below = v.filter(function (l) {
      var rs = roundsOf(l.id);
      return rs.length && rs[0].passed === false;
    }).length;

    document.getElementById("rdStats").innerHTML =
      '<div class="ws-stat ws-stat-bad"><span class="n">' + overdue + '</span>' +
        '<span class="l">Rounds overdue</span></div>' +
      '<div class="ws-stat ws-stat-warn"><span class="n">' + below + '</span>' +
        '<span class="l">Below target</span>' +
        (below ? '<span class="s">Each needs an action recorded</span>' : "") + "</div>" +
      '<div class="ws-stat"><span class="n">' + v.length + '</span>' +
        '<span class="l">Checklists</span></div>' +
      '<div class="ws-stat"><span class="n">' + rounds.length + '</span>' +
        '<span class="l">Rounds recorded</span></div>';
  }

  /* --------------------------------- views --------------------------------- */

  function spark(t) {
    if (!t) return "";
    var max = 100, w = 62, h = 20;
    var step = w / Math.max(1, t.points.length - 1);
    var d = t.points.map(function (p, i) {
      return (i ? "L" : "M") + (i * step).toFixed(1) + " " + (h - (p / max) * h).toFixed(1);
    }).join(" ");
    var up = t.delta >= 0;
    return '<svg class="rd-spark' + (up ? " is-up" : " is-down") + '" viewBox="0 0 ' + w +
      " " + h + '" aria-hidden="true"><path d="' + d + '"/></svg>' +
      '<span class="rd-delta' + (up ? " is-up" : " is-down") + '">' +
      (up ? "\u2191" : "\u2193") + Math.abs(t.delta).toFixed(1) + "</span>";
  }

  function dueView() {
    var ro = !W.canEdit();
    var v = visible().slice().sort(function (a, b) {
      var rank = { overdue: 0, never: 1, due: 2, soon: 3, ok: 4 };
      return rank[statusOf(a).state] - rank[statusOf(b).state];
    });

    if (!v.length) {
      return '<div class="cal-empty"><h3>No checklists yet</h3>' +
        "<p>A round is a recurring check that produces a score \u2014 hand hygiene, cleaning, " +
        "record review, crash cart. Write the questions once, set how often, and every " +
        "round after that is scored and trended for you.</p>" +
        (ro ? "" : '<button class="btn btn-accent" data-act="add-list">Create a checklist</button>') +
        "</div>";
    }

    return '<div class="cal-rows">' + v.map(function (l) {
      var st = statusOf(l);
      var rs = roundsOf(l.id);
      var last = rs[0];
      var nd = K.nextDates(lastDone(l), l.frequency, l.pref_dow);
      var t = trend(l);
      return '<div class="cal-row st-' + st.state + '">' +
        '<div class="cal-row-main">' +
          "<h4>" + esc(l.name) + "</h4>" +
          '<div class="cal-meta">' + esc(K.label(l.frequency)) +
            (l.department ? " \u00b7 " + esc(l.department) : "") +
            (l.element_code ? " \u00b7 " + esc(l.element_code) : "") +
            " \u00b7 " + itemsOf(l.id).length + " questions" +
            " \u00b7 target " + esc(l.target_pct || 0) + "%" + "</div>" +
          (last
            ? '<div class="cal-next">Last round ' + esc(last.performed_on) + ": " +
              '<b class="' + (last.passed === false ? "rd-bad" : "rd-good") + '">' +
              (last.score_pct != null ? esc(last.score_pct) + "%" : "\u2014") + "</b> " +
              spark(t) +
              (last.passed === false
                ? ' <span class="rd-flag">below target \u2014 record an action</span>' : "") +
              "</div>"
            : '<div class="cal-next">No round recorded yet</div>') +
          (nd.preferred ? '<div class="cal-next">Next due <b>' + esc(nd.preferred) + "</b></div>" : "") +
        "</div>" +
        '<div class="cal-row-side"><span class="cal-pill st-' + st.state + '">' + esc(st.text) + "</span>" +
          (ro ? "" :
            '<button class="btn btn-accent btn-sm" data-act="run" data-id="' + esc(l.id) + '">Do the round</button>' +
            '<button class="cal-x" data-act="edit-list" data-id="' + esc(l.id) + '" aria-label="Edit">\u270e</button>') +
        "</div></div>";
    }).join("") + "</div>";
  }

  function listsView() {
    var ro = !W.canEdit();
    return '<div class="cal-bar"><h3>Checklists</h3>' +
      (ro ? "" : '<button class="btn btn-accent btn-sm" data-act="add-list">Create a checklist</button>') +
      "</div>" +
      (visible().length
        ? '<div class="cal-rows">' + visible().map(function (l) {
            var qs = itemsOf(l.id);
            return '<div class="cal-row">' +
              '<div class="cal-row-main"><h4>' + esc(l.name) + "</h4>" +
                '<div class="cal-meta">' + esc(K.label(l.frequency)) +
                  (l.department ? " \u00b7 " + esc(l.department) : "") +
                  " \u00b7 " + qs.length + " questions \u00b7 " +
                  qs.filter(function (q) { return q.critical; }).length + " critical</div>" +
                (qs.length
                  ? '<ol class="rd-qs">' + qs.slice(0, 4).map(function (q) {
                      return "<li>" + esc(q.text) +
                        (q.critical ? ' <span class="rd-crit">critical</span>' : "") + "</li>";
                    }).join("") +
                    (qs.length > 4 ? "<li>\u2026 and " + (qs.length - 4) + " more</li>" : "") + "</ol>"
                  : '<div class="cal-next">No questions yet \u2014 a round cannot be scored</div>') +
              "</div>" +
              '<div class="cal-row-side">' +
                (ro ? "" :
                  '<button class="btn btn-ghost btn-sm" data-act="edit-items" data-id="' + esc(l.id) + '">Questions</button>' +
                  '<button class="cal-x" data-act="edit-list" data-id="' + esc(l.id) + '" aria-label="Edit">\u270e</button>') +
              "</div></div>";
          }).join("") + "</div>"
        : '<div class="cal-empty"><h3>No checklists yet</h3><p>Create one to get started.</p></div>');
  }

  function historyView() {
    var rs = rounds.slice().filter(function (r) {
      if (!deptFilter) return true;
      var l = lists.filter(function (x) { return x.id === r.checklist_id; })[0];
      return l && l.department === deptFilter;
    }).sort(function (a, b) {
      return String(b.performed_on).localeCompare(String(a.performed_on));
    });

    if (!rs.length) {
      return '<div class="cal-empty"><h3>No rounds recorded</h3>' +
        "<p>Every round kept here carries its score and its answers \u2014 which is what an " +
        "assessor asks to see, alongside what you did when the score was low.</p></div>";
    }

    return '<div class="cal-bar"><h3>' + rs.length + " round" + (rs.length === 1 ? "" : "s") + "</h3></div>" +
      '<div class="cal-rows">' + rs.map(function (r) {
        var l = lists.filter(function (x) { return x.id === r.checklist_id; })[0];
        return '<div class="cal-row' + (r.passed === false ? " st-overdue" : "") + '">' +
          '<div class="cal-row-main"><h4>' + esc(l ? l.name : "Removed checklist") + "</h4>" +
            '<div class="cal-meta">' + esc(r.performed_on) +
              (r.area ? " \u00b7 " + esc(r.area) : "") +
              (r.performed_by ? " \u00b7 " + esc(r.performed_by) : "") + "</div>" +
            (r.notes ? '<div class="cal-next">' + esc(r.notes) + "</div>" : "") +
            /* A failed round with no finding against it is exactly what an assessor looks
               for, so say so on the row rather than leaving it to be noticed. */
            (r.passed === false
              ? (r.capa_id
                  ? '<div class="cal-next"><a href="capa.html">Finding raised \u2192</a></div>'
                  : '<div class="cal-next rd-flag">No action recorded against this round</div>')
              : "") +
          "</div>" +
          '<div class="cal-row-side"><span class="cal-pill st-' +
            (r.passed === false ? "overdue" : "ok") + '">' +
            (r.score_pct != null ? esc(r.score_pct) + "%" : "\u2014") + "</span></div>" +
        "</div>";
      }).join("") + "</div>";
  }

  function render() {
    stats();
    var depts = {};
    lists.forEach(function (l) { if (l.department) depts[l.department] = 1; });
    document.getElementById("rdFilters").innerHTML =
      '<select id="rdDept" class="ws-select"><option value="">All departments</option>' +
        Object.keys(depts).sort().map(function (d) {
          return '<option value="' + esc(d) + '"' + (d === deptFilter ? " selected" : "") +
                 ">" + esc(d) + "</option>";
        }).join("") + "</select>";
    var dd = document.getElementById("rdDept");
    if (dd) dd.addEventListener("change", function () { deptFilter = this.value; render(); });

    document.getElementById("rdPanel").innerHTML =
      tab === "due" ? dueView() : tab === "lists" ? listsView() : historyView();
  }

  /* --------------------------------- forms --------------------------------- */

  function modal(h) {
    var m = document.getElementById("rdModal");
    m.innerHTML = '<div class="ws-modal-in">' + h + "</div>";
    m.classList.add("open");
    return m;
  }
  function close() { document.getElementById("rdModal").classList.remove("open"); }
  function val(i) { var e = document.getElementById(i); return e ? String(e.value || "").trim() : ""; }

  function freqOpts(sel) {
    return K.all().map(function (f) {
      return '<option value="' + f + '"' + (f === sel ? " selected" : "") + ">" + esc(K.label(f)) + "</option>";
    }).join("");
  }
  function dowOpts(sel) {
    return '<option value="">No preference</option>' + [1,2,3,4,5,6,0].map(function (n) {
      return '<option value="' + n + '"' + (String(sel) === String(n) ? " selected" : "") +
             ">" + K.dowName(n) + "</option>";
    }).join("");
  }

  function openList(l) {
    l = l || {};
    modal("<h3>" + (l.id ? "Edit checklist" : "Create a checklist") + "</h3>" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label for="lName">What is being checked?</label>' +
          '<input id="lName" value="' + esc(l.name || "") + '" placeholder="e.g. Hand hygiene compliance round"></div>' +
        '<div class="ws-f"><label for="lDept">Department</label><input id="lDept" value="' + esc(l.department || "") + '"></div>' +
        '<div class="ws-f"><label for="lEl">NABH element</label><input id="lEl" value="' + esc(l.element_code || "") + '" placeholder="e.g. IPC.2.c"></div>' +
        '<div class="ws-f"><label for="lFreq">How often?</label><select id="lFreq">' + freqOpts(l.frequency || "monthly") + "</select></div>" +
        '<div class="ws-f"><label for="lDow">Preferred day</label><select id="lDow">' + dowOpts(l.pref_dow) + "</select></div>" +
        '<div class="ws-f"><label for="lTarget">Target score (%)</label>' +
          '<input id="lTarget" type="number" min="0" max="100" value="' + esc(l.target_pct == null ? 90 : l.target_pct) + '"></div>' +
        '<div class="ws-f"><label for="lOwner">Responsible person</label><input id="lOwner" value="' + esc(l.owner || "") + '"></div>' +
        '<div class="ws-f ws-f-wide"><label>&nbsp;</label><p class="cal-hint">' +
          "A round scoring below target is flagged until an action is recorded against it. " +
          "An audit that cannot fail produces nothing for an assessor to look at.</p></div>" +
      "</div>" +
      '<div class="ws-modal-actions">' +
        (l.id ? '<button class="btn btn-ghost btn-sm" data-act="del-list" data-id="' + esc(l.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-list" data-id="' + esc(l.id || "") + '">Save</button>' +
      "</div>");
    setTimeout(function () { var e = document.getElementById("lName"); if (e) e.focus(); }, 30);
  }

  function openItems(l) {
    var qs = itemsOf(l.id);
    modal("<h3>Questions</h3>" +
      '<p class="cal-hint">' + esc(l.name) + "</p>" +
      '<div id="rdItemList" class="rd-edit">' + qs.map(function (q, i) {
        return itemRow(q, i);
      }).join("") + "</div>" +
      '<button class="btn btn-ghost btn-sm" data-act="add-item" style="margin-top:10px">Add a question</button>' +
      '<div class="ws-modal-actions"><span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Close</button>' +
        '<button class="btn btn-accent" data-act="save-items" data-id="' + esc(l.id) + '">Save questions</button>' +
      "</div>");
  }

  function itemRow(q, i) {
    q = q || {};
    return '<div class="rd-edit-row" data-qid="' + esc(q.id || "") + '">' +
      '<input class="rd-q" value="' + esc(q.text || "") + '" placeholder="e.g. Alcohol rub available at the point of care">' +
      '<label class="rd-crit-box"><input type="checkbox" class="rd-c"' + (q.critical ? " checked" : "") +
        "><span>Critical</span></label>" +
      '<button class="cal-x" data-act="rm-item" aria-label="Remove">\u2715</button>' +
    "</div>";
  }

  function openRun(l) {
    var qs = itemsOf(l.id);
    if (!qs.length) { W.toast("Add some questions first", "bad"); openItems(l); return; }
    modal("<h3>" + esc(l.name) + "</h3>" +
      '<div class="ws-form">' +
        '<div class="ws-f"><label for="rOn">Date</label><input id="rOn" type="date" value="' + esc(K.fmt(K.today())) + '"></div>' +
        '<div class="ws-f"><label for="rArea">Area / unit</label><input id="rArea" placeholder="e.g. ICU"></div>' +
        '<div class="ws-f"><label for="rBy">Performed by</label><input id="rBy" value="' + esc(l.owner || "") + '"></div>' +
      "</div>" +
      '<div class="rd-run" id="rdRun">' + qs.map(function (q) {
        return '<div class="rd-run-row" data-qid="' + esc(q.id) + '">' +
          "<span>" + esc(q.text) +
            (q.critical ? ' <span class="rd-crit">critical</span>' : "") + "</span>" +
          '<span class="rd-ans">' +
            ["yes", "no", "na"].map(function (a) {
              return '<button type="button" class="rd-a" data-a="' + a + '">' +
                (a === "na" ? "N/A" : a === "yes" ? "Yes" : "No") + "</button>";
            }).join("") +
          "</span></div>";
      }).join("") + "</div>" +
      '<div class="rd-live" id="rdLive">Answer the questions to see the score</div>' +
      '<div class="ws-form"><div class="ws-f ws-f-wide"><label for="rNotes">Notes</label>' +
        '<textarea id="rNotes" rows="2"></textarea></div></div>' +
      '<div class="ws-modal-actions"><span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-round" data-id="' + esc(l.id) + '">Save round</button>' +
      "</div>");

    /* The score updates as answers are given, so whoever is walking the round knows where
       they stand before they finish rather than after they save. */
    var run = document.getElementById("rdRun");
    run.addEventListener("click", function (e) {
      var b = e.target.closest(".rd-a");
      if (!b) return;
      var row = b.closest(".rd-run-row");
      [].forEach.call(row.querySelectorAll(".rd-a"), function (x) { x.classList.toggle("is-on", x === b); });
      paintLive(l);
    });
  }

  function collectAnswers() {
    var out = {};
    [].forEach.call(document.querySelectorAll("#rdRun .rd-run-row"), function (row) {
      var on = row.querySelector(".rd-a.is-on");
      if (on) out[row.dataset.qid] = on.dataset.a;
    });
    return out;
  }

  function paintLive(l) {
    var sc = score(collectAnswers(), l);
    var el = document.getElementById("rdLive");
    if (!el) return;
    if (sc.pct == null) { el.textContent = "Answer the questions to see the score"; el.className = "rd-live"; return; }
    el.className = "rd-live " + (sc.passed ? "is-pass" : "is-fail");
    el.innerHTML = "<b>" + sc.pct + "%</b> \u00b7 " + sc.answered + " of " + sc.total + " applicable" +
      (sc.criticalFail ? " \u00b7 <b>a critical item failed</b>" : "") +
      " \u00b7 target " + (l.target_pct || 0) + "% \u00b7 " +
      (sc.passed ? "pass" : "below target");
  }

  /* --------------------------------- actions --------------------------------- */

  async function saveList(existing) {
    var name = val("lName");
    if (!name) { W.toast("The checklist needs a name", "bad"); return; }
    var row = {
      id: existing || id("chk"),
      name: name,
      department: val("lDept") || null,
      element_code: val("lEl") || null,
      frequency: val("lFreq") || "monthly",
      pref_dow: val("lDow") === "" ? null : Number(val("lDow")),
      target_pct: val("lTarget") === "" ? 90 : Number(val("lTarget")),
      owner: val("lOwner") || null,
      active: true,
      updated_at: new Date().toISOString()
    };
    await S.adapter.upsert("checklists", row);
    close(); await refresh();
    if (!existing) {
      W.toast("Created \u2014 now add the questions", "ok");
      var made = lists.filter(function (x) { return x.id === row.id; })[0];
      if (made) openItems(made);
    } else W.toast("Saved", "ok");
  }

  async function saveItems(lid) {
    var l = lists.filter(function (x) { return x.id === lid; })[0];
    if (!l) return;
    var rows = [].slice.call(document.querySelectorAll("#rdItemList .rd-edit-row"));
    var existing = itemsOf(lid);
    var keep = {};

    for (var i = 0; i < rows.length; i++) {
      var text = String(rows[i].querySelector(".rd-q").value || "").trim();
      if (!text) continue;
      var qid = rows[i].dataset.qid || id("q");
      keep[qid] = 1;
      await S.adapter.upsert("checklist_items", {
        id: qid,
        checklist_id: lid,
        position: i,
        text: text,
        critical: !!rows[i].querySelector(".rd-c").checked
      });
    }
    /* Questions removed from the form are deleted outright, unlike everything else here,
       which soft-deletes. A question is not evidence — the ROUND is, and a round stores
       its own answers, so removing a question cannot orphan a past score. */
    for (var j = 0; j < existing.length; j++) {
      if (!keep[existing[j].id]) {
        try { await S.adapter.remove("checklist_items", existing[j].id); } catch (e) {}
      }
    }
    close(); await refresh();
    W.toast("Questions saved", "ok");
  }

  async function saveRound(lid) {
    var l = lists.filter(function (x) { return x.id === lid; })[0];
    if (!l) return;
    var on = val("rOn");
    if (!on) { W.toast("Pick the date", "bad"); return; }
    var answers = collectAnswers();
    var sc = score(answers, l);
    if (sc.pct == null) { W.toast("Answer at least one question", "bad"); return; }

    var roundId = id("rnd");
    await S.adapter.upsert("rounds", {
      id: roundId,
      checklist_id: lid,
      performed_on: on,
      performed_by: val("rBy") || null,
      area: val("rArea") || null,
      answers: answers,
      score_pct: sc.pct,
      passed: sc.passed,
      notes: val("rNotes") || null
    });
    if (!l.last_done_on || l.last_done_on < on) {
      l.last_done_on = on;
      await S.adapter.upsert("checklists", l);
    }
    if (window.AQActivity) window.AQActivity.record("round_recorded", { id: lid, score: sc.pct });

    close(); await refresh();

    if (!sc.passed) {
      /* Offering the CAPA immediately is the whole point: a low score with no action
         recorded against it is the single most common assessor finding. Offered rather
         than created automatically — a finding nobody chose to raise is a finding nobody
         owns, and an auto-generated CAPA queue is the fastest way to teach a hospital to
         ignore its own findings. */
      offerCapa(l, roundId, sc, on);
    } else {
      W.toast("Scored " + sc.pct + "% \u2014 pass", "ok");
    }
  }

  /* The round and the finding it caused must reference each other, or a hospital ends up
     with a low score on one page and an action on another and no way to show an assessor
     they are the same event. */
  function offerCapa(l, roundId, sc, on) {
    modal("<h3>Below target</h3>" +
      '<p class="cal-hint">' + esc(l.name) + " scored <b>" + sc.pct +
        "%</b> against a target of " + esc(l.target_pct || 0) + "%" +
        (sc.criticalFail ? ", and a critical item failed" : "") + ".</p>" +
      "<p>A round that falls below target with no action recorded against it is the most " +
      "common finding an assessor raises. Raise one now and it will be linked to this round.</p>" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label for="cpTitle">Finding</label>' +
          '<input id="cpTitle" value="' + esc(l.name + " scored " + sc.pct + "%, below target") + '"></div>' +
        '<div class="ws-f"><label for="cpOwner">Owner</label>' +
          '<input id="cpOwner" value="' + esc(l.owner || "") + '"></div>' +
        '<div class="ws-f"><label for="cpDue">Due by</label>' +
          '<input id="cpDue" type="date"></div>' +
      "</div>" +
      '<div class="ws-modal-actions">' +
        '<button class="btn btn-ghost" data-act="close">Not now</button>' +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-accent" data-act="make-capa" data-id="' + esc(roundId) +
          '" data-list="' + esc(l.id) + '">Raise a CAPA</button>' +
      "</div>");
  }

  async function makeCapa(roundId, lid) {
    var l = lists.filter(function (x) { return x.id === lid; })[0];
    var r = rounds.filter(function (x) { return x.id === roundId; })[0];
    var title = val("cpTitle");
    if (!title) { W.toast("The finding needs a title", "bad"); return; }
    var capaId = "capa_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    await S.adapter.upsert("capa", {
      id: capaId,
      title: title,
      status: "open",
      source: "Round",
      department: l ? l.department : null,
      owner: val("cpOwner") || null,
      due_on: val("cpDue") || null,
      element_code: l ? l.element_code : null,
      /* Both directions. The CAPA names the round in its own words for a reader, and the
         round stores the id so the link survives the title being edited later. */
      root_cause: "Raised from the round recorded on " +
        (r ? r.performed_on : "\u2014") + (r && r.area ? " in " + r.area : "") + ".",
      updated_at: new Date().toISOString()
    });

    if (r) {
      r.capa_id = capaId;
      await S.adapter.upsert("rounds", r);
    }

    close(); await refresh();
    W.toast("CAPA raised and linked to this round", "ok");
  }

  async function removeList(lid) {
    if (!confirm("Remove this checklist? Rounds already recorded are kept.")) return;
    var l = lists.filter(function (x) { return x.id === lid; })[0];
    if (!l) return;
    l.active = false;
    await S.adapter.upsert("checklists", l);
    close(); await refresh();
    W.toast("Removed", "ok");
  }

  async function refresh() { await load(); render(); }

  function wire() {
    document.getElementById("rdTabs").addEventListener("click", function (e) {
      var b = e.target.closest(".cal-tab");
      if (!b) return;
      tab = b.dataset.tab;
      [].forEach.call(document.querySelectorAll(".cal-tab"), function (x) {
        x.classList.toggle("is-on", x === b);
      });
      render();
    });

    document.addEventListener("click", function (e) {
      var rm = e.target.closest('[data-act="rm-item"]');
      if (rm) { rm.closest(".rd-edit-row").remove(); return; }

      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.dataset.act, rid = b.dataset.id;
      var find = function () { return lists.filter(function (x) { return x.id === rid; })[0]; };

      if (act === "close") close();
      else if (act === "add-list") openList(null);
      else if (act === "edit-list") openList(find());
      else if (act === "save-list") saveList(rid || null);
      else if (act === "del-list") removeList(rid);
      else if (act === "edit-items") openItems(find());
      else if (act === "add-item") {
        var host = document.getElementById("rdItemList");
        if (host) host.insertAdjacentHTML("beforeend", itemRow(null, 0));
      }
      else if (act === "save-items") saveItems(rid);
      else if (act === "run") openRun(find());
      else if (act === "save-round") saveRound(rid);
      else if (act === "make-capa") makeCapa(rid, b.dataset.list);
    });

    document.getElementById("rdModal").addEventListener("click", function (e) {
      if (e.target.id === "rdModal") close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("rounds"); W.renderModeNotice();
    wire();
    await refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  /* Exposed for tests: the scoring rule is the one piece of real logic here. */
  window.AQRounds = { score: score };
})();
