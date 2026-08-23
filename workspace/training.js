/* AQcredix — training and competency register.
 *
 * Human Resource Management is one of the ten NABH chapters and had no module here at
 * all, so induction, fire safety, BLS validity and competency assessment lived in a
 * spreadsheet that comes apart on assessment day.
 *
 * WHY THIS LOOKS LIKE THE EQUIPMENT REGISTER.
 * Because it is the same problem. A BLS certificate expires exactly as a calibration
 * certificate does: someone holds it, it was issued on a date, it lapses on a date, and
 * an assessor asks to see the ones that have not. Modelling training as its own novel
 * thing would have meant re-inventing the expiry maths, the amber window and the sorting,
 * and getting one of them subtly different.
 *
 * WHY ONE ROW PER PERSON PER TRAINING, NOT PER PERSON.
 * A nurse holds induction, fire safety, BLS and hand hygiene, each with its own date and
 * its own validity. One row per person forces a wide table with a column per course,
 * which breaks the first time a hospital runs a course this one did not predict.
 */
(function () {
  "use strict";

  var W = window.AQWorkspace, S = window.AQStore;
  if (!W || !S) return;

  var TABLE = "training_records";
  var rows = [];
  var tab = "due";
  var filters = { department: "", training_type: "" };
  var esc;

  /* The courses NABH actually asks about, so the common case is a pick rather than a
     typed string — which is also what makes the "By training" view meaningful. `other`
     exists because a hospital will always run something this list did not predict. */
  var TYPES = [
    ["induction",         "Induction"],
    ["fire_safety",       "Fire safety"],
    ["bls",               "BLS"],
    ["acls",              "ACLS"],
    ["infection_control", "Infection control"],
    ["bmw",               "Biomedical waste"],
    ["hand_hygiene",      "Hand hygiene"],
    ["code_blue",         "Code blue / emergency codes"],
    ["patient_safety",    "Patient safety"],
    ["competency",        "Competency assessment"],
    ["other",             "Other"]
  ];
  function typeLabel(k) {
    var hit = TYPES.filter(function (t) { return t[0] === k; })[0];
    return hit ? hit[1] : (k || "—");
  }

  var DAY = 86400000;
  /* Thirty days of amber. Short enough that it means something, long enough to book a
     course and get people onto it — which is the whole point of warning at all. */
  var SOON = 30;

  function fmtDate(d) {
    if (!d) return "—";
    var x = new Date(d);
    return isNaN(x) ? String(d) : x.toLocaleDateString("en-IN",
      { day: "2-digit", month: "short", year: "numeric" });
  }
  function daysLeft(d) {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / DAY);
  }
  /* Four states, and the fourth matters: "no expiry" is not "valid for ever pending
     review" — induction genuinely does not lapse, and colouring it amber would train
     people to ignore the colour. */
  function state(r) {
    if (r.status === "waived") return "waived";
    if (!r.valid_until) return "noexpiry";
    var d = daysLeft(r.valid_until);
    if (d < 0) return "expired";
    if (d <= SOON) return "soon";
    return "valid";
  }

  function uniq(list) {
    return list.filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort();
  }

  /* ---------------------------------------------------------------- stats */
  function renderStats() {
    var counts = { expired: 0, soon: 0, valid: 0, noexpiry: 0, waived: 0 };
    rows.forEach(function (r) { counts[state(r)]++; });
    var people = uniq(rows.map(function (r) { return r.person_name; })).length;

    document.getElementById("trStats").innerHTML =
      '<div class="reg-stats">' +
        stat(counts.expired, "expired", counts.expired ? "bad" : "") +
        stat(counts.soon, "due within " + SOON + " days", counts.soon ? "warn" : "") +
        stat(counts.valid + counts.noexpiry, "in date", "ok") +
        stat(people, "people on the register", "") +
      "</div>";
  }
  function stat(n, label, cls) {
    return '<div class="reg-stat ' + cls + '"><b>' + n + "</b><span>" + esc(label) + "</span></div>";
  }

  /* ---------------------------------------------------------------- filters */
  function renderFilters() {
    var depts = uniq(rows.map(function (r) { return r.department; }));
    document.getElementById("trFilters").innerHTML =
      '<select id="trDept"><option value="">All departments</option>' +
        depts.map(function (d) {
          return '<option value="' + esc(d) + '"' +
            (filters.department === d ? " selected" : "") + ">" + esc(d) + "</option>";
        }).join("") + "</select>" +
      '<select id="trType"><option value="">All training</option>' +
        TYPES.map(function (t) {
          return '<option value="' + t[0] + '"' +
            (filters.training_type === t[0] ? " selected" : "") + ">" + esc(t[1]) + "</option>";
        }).join("") + "</select>" +
      '<button type="button" class="btn btn-accent btn-sm" id="trAdd">Add a record</button>';

    document.getElementById("trDept").addEventListener("change", function () {
      filters.department = this.value; renderPanel();
    });
    document.getElementById("trType").addEventListener("change", function () {
      filters.training_type = this.value; renderPanel();
    });
    document.getElementById("trAdd").addEventListener("click", function () { openForm(null); });
  }

  function visible() {
    return rows.filter(function (r) {
      if (filters.department && r.department !== filters.department) return false;
      if (filters.training_type && r.training_type !== filters.training_type) return false;
      if (tab === "due") { var s = state(r); return s === "expired" || s === "soon"; }
      return true;
    });
  }

  /* ---------------------------------------------------------------- panel */
  function renderPanel() {
    var host = document.getElementById("trPanel");
    var list = visible();

    if (tab === "matrix") { host.innerHTML = matrixHtml(); return; }

    if (!list.length) {
      host.innerHTML = '<p class="ws-empty">' +
        (tab === "due"
          ? "Nothing expired and nothing due in the next " + SOON + " days."
          : "No records yet. Add the first, or bring a spreadsheet in through Bulk Import.") +
        "</p>";
      return;
    }

    /* Soonest first. Somebody opening this page is looking for what to act on, and that
       is always the thing closest to lapsing. Records with no expiry sort last rather
       than first, which is what a null would otherwise do. */
    list = list.slice().sort(function (a, b) {
      var x = a.valid_until ? new Date(a.valid_until).getTime() : Infinity;
      var y = b.valid_until ? new Date(b.valid_until).getTime() : Infinity;
      return x - y;
    });

    host.innerHTML =
      '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
        "<th>Person</th><th>Training</th><th>Department</th><th>Completed</th>" +
        "<th>Valid until</th><th>Status</th><th></th>" +
      "</tr></thead><tbody>" +
      list.map(function (r) {
        var s = state(r), d = daysLeft(r.valid_until);
        var badge =
          s === "expired"  ? '<span class="tr-tag bad">Expired ' + Math.abs(d) + "d ago</span>" :
          s === "soon"     ? '<span class="tr-tag warn">' + d + " days left</span>" :
          s === "noexpiry" ? '<span class="tr-tag">No expiry</span>' :
          s === "waived"   ? '<span class="tr-tag">Waived</span>' :
                             '<span class="tr-tag ok">Valid</span>';
        return "<tr>" +
          "<td><b>" + esc(r.person_name || "—") + "</b>" +
            (r.designation ? '<span class="tr-sub">' + esc(r.designation) + "</span>" : "") + "</td>" +
          "<td>" + esc(r.training_name || typeLabel(r.training_type)) + "</td>" +
          "<td>" + esc(r.department || "—") + "</td>" +
          "<td>" + esc(fmtDate(r.completed_on)) + "</td>" +
          "<td>" + esc(fmtDate(r.valid_until)) + "</td>" +
          "<td>" + badge + "</td>" +
          '<td><button type="button" class="tr-edit" data-id="' + esc(r.id) + '">Edit</button></td>' +
        "</tr>";
      }).join("") + "</tbody></table></div>";

    [].forEach.call(host.querySelectorAll(".tr-edit"), function (b) {
      b.addEventListener("click", function () {
        openForm(rows.filter(function (r) { return r.id === b.getAttribute("data-id"); })[0]);
      });
    });
  }

  /* Coverage by course. The question a director asks is not "who is trained" but "how
     much of fire safety is covered", and that is a different shape from the list. */
  function matrixHtml() {
    var byType = {};
    rows.forEach(function (r) {
      var k = r.training_type || "other";
      byType[k] = byType[k] || { total: 0, expired: 0, soon: 0 };
      byType[k].total++;
      var s = state(r);
      if (s === "expired") byType[k].expired++;
      if (s === "soon") byType[k].soon++;
    });
    var keys = Object.keys(byType);
    if (!keys.length) return '<p class="ws-empty">No records yet.</p>';

    return '<div class="ws-tablewrap"><table class="ws-table"><thead><tr>' +
      "<th>Training</th><th>Records</th><th>Expired</th><th>Due soon</th><th>In date</th>" +
      "</tr></thead><tbody>" +
      keys.sort().map(function (k) {
        var v = byType[k], ok = v.total - v.expired - v.soon;
        return "<tr><td><b>" + esc(typeLabel(k)) + "</b></td>" +
          "<td>" + v.total + "</td>" +
          '<td>' + (v.expired ? '<span class="tr-tag bad">' + v.expired + "</span>" : "0") + "</td>" +
          '<td>' + (v.soon ? '<span class="tr-tag warn">' + v.soon + "</span>" : "0") + "</td>" +
          '<td><span class="tr-tag ok">' + ok + "</span></td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  /* ---------------------------------------------------------------- form */
  function openForm(rec) {
    var m = document.getElementById("trModal");
    var r = rec || {};
    /* .ws-modal-in and the .open class are the house modal, the same one register.js and
       capa.js use. Inventing a second modal shape would have meant a second thing to keep
       in step every time the shared one changed. */
    m.innerHTML =
      '<div class="ws-modal-in">' +
      "<h3>" + (rec ? "Edit record" : "Add a training record") + "</h3>" +
      '<form id="trForm" class="ws-form">' +
        f("Person", "person_name", "text", r.person_name, true) +
        f("Employee ID", "employee_id", "text", r.employee_id) +
        f("Designation", "designation", "text", r.designation) +
        f("Department", "department", "text", r.department) +
        '<div class="ws-f"><label>Training</label><select name="training_type">' +
          TYPES.map(function (t) {
            return '<option value="' + t[0] + '"' +
              (r.training_type === t[0] ? " selected" : "") + ">" + esc(t[1]) + "</option>";
          }).join("") + "</select></div>" +
        f("Course name (if other)", "training_name", "text", r.training_name) +
        f("Provider", "provider", "text", r.provider) +
        f("Completed on", "completed_on", "date", r.completed_on) +
        f("Valid until", "valid_until", "date", r.valid_until) +
        f("Score or grade", "score", "text", r.score) +
        f("Assessed by", "assessed_by", "text", r.assessed_by) +
        f("NABH element", "element_code", "text", r.element_code) +
        '<p class="ws-f-wide tr-hint">Leave <b>valid until</b> empty for training that does not ' +
          "lapse — induction, for instance. An element code makes this record show up on " +
          "the Evidence page when an assessor asks about that element.</p>" +
        '<div class="ws-f-wide ws-modal-actions">' +
          '<button type="submit" class="btn btn-accent">Save</button>' +
          (rec ? '<button type="button" class="btn btn-ghost" id="trDel">Delete</button>' : "") +
        "</div>" +
      "</form></div>";
    m.classList.add("open");
    m.addEventListener("click", function (e) { if (e.target === m) close(); });

    document.getElementById("trForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      var out = rec ? Object.assign({}, rec) : { id: "trn_" + Math.random().toString(36).slice(2, 11) };
      ["person_name", "employee_id", "designation", "department", "training_type",
       "training_name", "provider", "completed_on", "valid_until", "score",
       "assessed_by", "element_code"].forEach(function (k) {
        var v = (fd.get(k) || "").toString().trim();
        /* Empty date strings must become null, not "". Postgres rejects "" for a date and
           the save would fail with a message nobody could act on. */
        out[k] = v === "" ? null : v;
      });
      if (!out.person_name) return;
      try {
        await S.adapter.put(TABLE, out);
        close();
        await refresh();
      } catch (err) {
        alert("Could not save: " + (err && err.message || err));
      }
    });

    var del = document.getElementById("trDel");
    if (del) del.addEventListener("click", async function () {
      if (!confirm("Delete this training record?")) return;
      try { await S.adapter.remove(TABLE, rec.id); close(); await refresh(); }
      catch (err) { alert("Could not delete: " + (err && err.message || err)); }
    });
  }

  function f(label, name, type, val, req) {
    return '<div class="ws-f"><label>' + esc(label) + "</label>" +
      '<input type="' + type + '" name="' + name + '" value="' + esc(val == null ? "" : val) +
      '"' + (req ? " required" : "") + "></div>";
  }
  function close() { document.getElementById("trModal").classList.remove("open"); }

  /* ---------------------------------------------------------------- */
  async function refresh() {
    try { rows = await S.adapter.list(TABLE) || []; }
    catch (e) {
      document.getElementById("trPanel").innerHTML =
        '<p class="ws-empty">Could not load the register: ' + esc(String(e && e.message || e)) +
        "</p>";
      return;
    }
    renderStats(); renderFilters(); renderPanel();
  }

  function wire() {
    [].forEach.call(document.querySelectorAll("#trTabs .cal-tab"), function (b) {
      b.addEventListener("click", function () {
        [].forEach.call(document.querySelectorAll("#trTabs .cal-tab"), function (x) {
          x.classList.remove("is-on");
        });
        b.classList.add("is-on");
        tab = b.getAttribute("data-tab");
        renderPanel();
      });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("training");
    if (W.renderModeNotice) W.renderModeNotice();
    wire();
    await refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
