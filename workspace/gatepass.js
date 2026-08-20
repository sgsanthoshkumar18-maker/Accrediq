/* AQcredix Workspace — material gate pass.
 *
 * The security desk already runs this on paper: what left the building, why, whether it
 * comes back, and whether it did. This is the same form (VHS Material Gate Pass,
 * VHS/QRF/MAT/01, is the one it was modelled on) with one thing paper cannot do — "what is
 * still outstanding" becomes a query instead of a search through a register book.
 *
 * Returnable and non-returnable are the two real states a gate pass can be in, and they
 * are tracked differently: a non-returnable pass is closed the moment it is issued, a
 * returnable one stays open until someone records it coming back.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace;
  var esc;

  var passes = [];
  var tab = "open";
  var deptFilter = "";

  function id() { return "gp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function nextPassNo() {
    var nums = passes.map(function (p) {
      return p.pass_no && /^\d+$/.test(p.pass_no) ? Number(p.pass_no) : 0;
    });
    var max = nums.length ? Math.max.apply(null, nums) : 0;
    return String(max + 1).padStart(3, "0");
  }

  async function load() {
    passes = (await S.adapter.list("gate_passes").catch(function () { return []; })) || [];
  }

  /* A returnable pass is open until returned_on is set, then closed. There is no
     recurrence here — unlike the calendar and register, a gate pass is a single event,
     not a cycle — so status is a straight date comparison, not the schedule engine. */
  function statusOf(p) {
    if (!p.returnable) return { state: "closed", text: "Non-returnable" };
    if (p.returned_on) return { state: "ok", text: "Returned " + p.returned_on };
    if (p.expected_return_on) {
      var today = new Date().toISOString().slice(0, 10);
      if (p.expected_return_on < today) {
        var days = Math.round((new Date(today) - new Date(p.expected_return_on)) / 86400000);
        return { state: "overdue", text: days + " day" + (days === 1 ? "" : "s") + " overdue" };
      }
      return { state: "soon", text: "Due " + p.expected_return_on };
    }
    return { state: "warn", text: "No return date set" };
  }

  function departments() {
    var seen = {};
    passes.forEach(function (p) { if (p.department) seen[p.department] = 1; });
    return Object.keys(seen).sort();
  }

  function visible() {
    return passes.filter(function (p) { return !deptFilter || p.department === deptFilter; });
  }

  /* --------------------------------- stats --------------------------------- */

  function stats() {
    var v = visible();
    var returnable = v.filter(function (p) { return p.returnable; });
    var open = returnable.filter(function (p) { return !p.returned_on; });
    var overdue = open.filter(function (p) { return statusOf(p).state === "overdue"; });
    var thisMonth = v.filter(function (p) {
      return (p.created_at || "").slice(0, 7) === new Date().toISOString().slice(0, 7);
    });

    document.getElementById("gpStats").innerHTML =
      '<div class="ws-stat ws-stat-bad"><span class="n">' + overdue.length + '</span>' +
        '<span class="l">Returnable overdue</span></div>' +
      '<div class="ws-stat ws-stat-warn"><span class="n">' + open.length + '</span>' +
        '<span class="l">Currently out</span></div>' +
      '<div class="ws-stat"><span class="n">' + v.length + '</span>' +
        '<span class="l">Total passes</span></div>' +
      '<div class="ws-stat"><span class="n">' + thisMonth.length + '</span>' +
        '<span class="l">Issued this month</span></div>';
  }

  /* --------------------------------- views --------------------------------- */

  function row(p, ro) {
    var st = statusOf(p);
    return '<div class="cal-row st-' + (st.state === "closed" ? "ok" : st.state) + '">' +
      '<div class="cal-row-main">' +
        '<h4>Pass #' + esc(p.pass_no) + " — " + esc(p.particulars.split("\n")[0]) + "</h4>" +
        '<div class="cal-meta">' + esc(p.department || "—") +
          (p.reason ? " · " + esc(p.reason) : "") +
          (p.asset_code ? " · " + esc(p.asset_code) : "") +
          " · " + (p.returnable ? "Returnable" : "Non-returnable") + "</div>" +
        (p.taken_by ? '<div class="cal-next">Taken by ' + esc(p.taken_by) +
          (p.vehicle_no ? " · " + esc(p.vehicle_no) : "") + "</div>" : "") +
      "</div>" +
      '<div class="cal-row-side"><span class="cal-pill st-' +
        (st.state === "closed" ? "ok" : st.state) + '">' + esc(st.text) + "</span>" +
        (ro ? "" :
          (p.returnable && !p.returned_on
            ? '<button class="btn btn-accent btn-sm" data-act="return" data-id="' + esc(p.id) + '">Record return</button>'
            : "") +
          '<button class="cal-x" data-act="edit" data-id="' + esc(p.id) + '" aria-label="Edit">\u270e</button>') +
      "</div></div>";
  }

  function render() {
    stats();
    var ro = !W.canEdit();
    var v = visible().slice().sort(function (a, b) {
      return String(b.created_at || "").localeCompare(String(a.created_at || ""));
    });

    var open = v.filter(function (p) { return p.returnable && !p.returned_on; });
    var closed = v.filter(function (p) { return !p.returnable || p.returned_on; });
    var list = tab === "open" ? open : tab === "closed" ? closed : v;

    document.getElementById("gpFilters").innerHTML =
      '<select id="gpDept" class="ws-select"><option value="">All departments</option>' +
        departments().map(function (d) {
          return '<option value="' + esc(d) + '"' + (d === deptFilter ? " selected" : "") +
                 ">" + esc(d) + "</option>";
        }).join("") + "</select>" +
      (ro ? "" : '<button class="btn btn-accent btn-sm" data-act="add">New gate pass</button>');

    var dd = document.getElementById("gpDept");
    if (dd) dd.addEventListener("change", function () { deptFilter = this.value; render(); });

    document.getElementById("gpPanel").innerHTML = list.length
      ? '<div class="cal-rows">' + list.map(function (p) { return row(p, ro); }).join("") + "</div>"
      : '<div class="cal-empty"><h3>Nothing here</h3>' +
        "<p>Every material leaving the building through security — for repair, on loan, " +
        "for disposal — is recorded here, returnable or not.</p>" +
        (ro ? "" : '<button class="btn btn-accent" data-act="add">New gate pass</button>') + "</div>";
  }

  /* --------------------------------- forms --------------------------------- */

  function modal(h) {
    var m = document.getElementById("gpModal");
    m.innerHTML = '<div class="ws-modal-in">' + h + "</div>";
    m.classList.add("open");
  }
  function close() { document.getElementById("gpModal").classList.remove("open"); }
  function val(i) { var e = document.getElementById(i); return e ? String(e.value || "").trim() : ""; }

  function openForm(p) {
    p = p || {};
    var isNew = !p.id;
    modal("<h3>" + (isNew ? "New material gate pass" : "Edit gate pass") + "</h3>" +
      (isNew ? '<p class="cal-hint">Pass #' + esc(nextPassNo()) + " · " +
        new Date().toISOString().slice(0, 10) + "</p>" : "") +
      '<div class="ws-form">' +
        '<div class="ws-f"><label for="gDept">Department</label>' +
          '<input id="gDept" value="' + esc(p.department || "") + '" placeholder="e.g. IT, Biomedical"></div>' +
        '<div class="ws-f"><label for="gAsset">Asset code (if applicable)</label>' +
          '<input id="gAsset" value="' + esc(p.asset_code || "") + '"></div>' +
        '<div class="ws-f ws-f-wide"><label for="gPart">Particulars — with asset code, make and serial as applicable</label>' +
          '<textarea id="gPart" rows="2">' + esc(p.particulars || "") + "</textarea></div>" +
        '<div class="ws-f ws-f-wide"><label for="gReason">Reason / purpose</label>' +
          '<input id="gReason" value="' + esc(p.reason || "") + '" placeholder="e.g. Service, motherboard issue"></div>' +
        '<div class="ws-f"><label for="gType">Type</label><select id="gType">' +
          '<option value="yes"' + (p.returnable !== false ? " selected" : "") + ">Returnable</option>" +
          '<option value="no"' + (p.returnable === false ? " selected" : "") + ">Non-returnable</option>" +
          "</select></div>" +
        '<div class="ws-f"><label for="gExp">Expected date of return</label>' +
          '<input id="gExp" type="date" value="' + esc(p.expected_return_on || "") + '"></div>' +
        '<div class="ws-f"><label for="gQty">Quantity sent</label>' +
          '<input id="gQty" type="number" min="0" value="' + esc(p.quantity_sent || "") + '"></div>' +
        '<div class="ws-f"><label for="gVeh">Vehicle number</label>' +
          '<input id="gVeh" value="' + esc(p.vehicle_no || "") + '"></div>' +
        '<div class="ws-f"><label for="gMode">Mode of transport</label>' +
          '<input id="gMode" value="' + esc(p.mode_of_transport || "") + '"></div>' +
        '<div class="ws-f"><label for="gPrep">Prepared by</label>' +
          '<input id="gPrep" value="' + esc(p.prepared_by || "") + '"></div>' +
        '<div class="ws-f"><label for="gInch">Department in-charge</label>' +
          '<input id="gInch" value="' + esc(p.dept_incharge || "") + '"></div>' +
        '<div class="ws-f"><label for="gTaken">Taken by</label>' +
          '<input id="gTaken" value="' + esc(p.taken_by || "") + '"></div>' +
        '<div class="ws-f"><label for="gSecOut">Security check (outward)</label>' +
          '<input id="gSecOut" value="' + esc(p.security_out_by || "") + '"></div>' +
      "</div>" +
      '<div class="ws-modal-actions">' +
        (p.id ? '<button class="btn btn-ghost btn-sm" data-act="del" data-id="' + esc(p.id) + '">Remove</button>' : "") +
        '<span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save" data-id="' + esc(p.id || "") + '">Save</button>' +
      "</div>");
    setTimeout(function () { var e = document.getElementById("gDept"); if (e) e.focus(); }, 30);
  }

  function openReturn(p) {
    modal("<h3>Record return</h3>" +
      '<p class="cal-hint">Pass #' + esc(p.pass_no) + " — " + esc(p.particulars.split("\n")[0]) + "</p>" +
      '<div class="ws-form">' +
        '<div class="ws-f"><label for="rOn">Date returned</label>' +
          '<input id="rOn" type="date" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
        '<div class="ws-f"><label for="rQty">Quantity returned</label>' +
          '<input id="rQty" type="number" min="0" value="' + esc(p.quantity_sent || "") + '"></div>' +
        '<div class="ws-f"><label for="rBy">Received by</label><input id="rBy"></div>' +
        '<div class="ws-f"><label for="rSec">Security check (inward)</label><input id="rSec"></div>' +
      "</div>" +
      '<div class="ws-modal-actions"><span style="flex:1"></span>' +
        '<button class="btn btn-ghost" data-act="close">Cancel</button>' +
        '<button class="btn btn-accent" data-act="save-return" data-id="' + esc(p.id) + '">Save</button>' +
      "</div>");
  }

  /* --------------------------------- actions --------------------------------- */

  async function save(existing) {
    var particulars = val("gPart");
    if (!particulars) { W.toast("Describe what is being taken out", "bad"); return; }
    var returnable = val("gType") !== "no";
    if (returnable && !val("gExp")) {
      W.toast("A returnable pass needs an expected return date", "bad"); return;
    }
    var row = {
      id: existing || id(),
      pass_no: existing ? undefined : nextPassNo(),
      department: val("gDept") || null,
      asset_code: val("gAsset") || null,
      particulars: particulars,
      reason: val("gReason") || null,
      returnable: returnable,
      expected_return_on: returnable ? (val("gExp") || null) : null,
      quantity_sent: val("gQty") === "" ? null : Number(val("gQty")),
      vehicle_no: val("gVeh") || null,
      mode_of_transport: val("gMode") || null,
      prepared_by: val("gPrep") || null,
      dept_incharge: val("gInch") || null,
      taken_by: val("gTaken") || null,
      security_out_by: val("gSecOut") || null,
      updated_at: new Date().toISOString()
    };
    /* pass_no is only assigned on creation. Sending `undefined` on an edit would ask
       Supabase to overwrite it with null, and a gate pass losing its number defeats the
       one thing the paper register was good at — a number nobody can dispute. */
    if (existing) delete row.pass_no;
    await S.adapter.upsert("gate_passes", row);
    close(); await refresh();
    W.toast(existing ? "Saved" : "Gate pass #" + row.pass_no + " created", "ok");
  }

  async function saveReturn(pid) {
    var p = passes.filter(function (x) { return x.id === pid; })[0];
    if (!p) return;
    p.returned_on = val("rOn") || new Date().toISOString().slice(0, 10);
    p.quantity_returned = val("rQty") === "" ? null : Number(val("rQty"));
    p.received_by = val("rBy") || null;
    p.security_in_by = val("rSec") || null;
    p.updated_at = new Date().toISOString();
    await S.adapter.upsert("gate_passes", p);
    close(); await refresh();
    W.toast("Return recorded", "ok");
  }

  async function remove(pid) {
    if (!confirm("Remove this gate pass permanently?")) return;
    try { await S.adapter.remove("gate_passes", pid); } catch (e) {}
    close(); await refresh();
    W.toast("Removed", "ok");
  }

  async function refresh() { await load(); render(); }

  function wire() {
    document.getElementById("gpTabs").addEventListener("click", function (e) {
      var b = e.target.closest(".cal-tab");
      if (!b) return;
      tab = b.dataset.tab;
      [].forEach.call(document.querySelectorAll(".cal-tab"), function (x) {
        x.classList.toggle("is-on", x === b);
      });
      render();
    });

    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.dataset.act, rid = b.dataset.id;
      var find = function () { return passes.filter(function (x) { return x.id === rid; })[0]; };
      if (act === "close") close();
      else if (act === "add") openForm(null);
      else if (act === "edit") openForm(find());
      else if (act === "save") save(rid || null);
      else if (act === "del") remove(rid);
      else if (act === "return") openReturn(find());
      else if (act === "save-return") saveReturn(rid);
    });

    document.getElementById("gpModal").addEventListener("click", function (e) {
      if (e.target.id === "gpModal") close();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("gatepass"); W.renderModeNotice();
    wire();
    await refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.AQGatePass = { statusOf: statusOf };
})();
