/* AQcredix Workspace — Team seats and roles. */
(function () {
  "use strict";
  var S = window.AQStore, W = window.AQWorkspace, esc;

  var ROLES = [
    { k: "owner",  label: "Owner",  desc: "Full control, including billing and removing admins" },
    { k: "admin",  label: "Admin",  desc: "Manages the team and every record" },
    { k: "editor", label: "Editor", desc: "Records status, findings and documents" },
    { k: "viewer", label: "Viewer", desc: "Reads everything, changes nothing" }
  ];
  var rows = [];

  function render() {
    var seats = (window.AQ_CONFIG || {}).includedSeats || 5;
    var active = rows.filter(function (r) { return r.status !== "removed"; });

    document.getElementById("teamStats").innerHTML =
      '<div class="ws-stat"><span class="n">' + active.length + " / " + seats + '</span><span class="l">Seats used</span></div>' +
      '<div class="ws-stat"><span class="n">' +
        active.filter(function (r) { return r.status === "invited"; }).length + '</span><span class="l">Invitations pending</span></div>' +
      '<div class="ws-stat"><span class="n">' +
        new Set(active.map(function (r) { return r.department; }).filter(Boolean)).size +
        '</span><span class="l">Departments covered</span></div>';

    var host = document.getElementById("teamList");
    var admin = W.isAdmin();
    if (!active.length) {
      host.innerHTML = '<p class="ws-empty">No team members yet.</p>';
    } else {
      host.innerHTML = '<table class="ws-table"><thead><tr><th>Name</th><th>Email</th>' +
        "<th>Role</th><th>Department</th><th>Status</th>" + (admin ? "<th></th>" : "") + "</tr></thead><tbody>" +
        active.map(function (r) {
          return '<tr data-id="' + esc(r.id) + '"><td><b>' + esc(r.name || "—") + "</b></td>" +
            "<td>" + esc(r.email || "—") + "</td>" +
            '<td><span class="role-pill role-' + esc(r.role) + '">' + esc(r.role) + "</span></td>" +
            "<td>" + esc(r.department || "—") + "</td>" +
            '<td>' + (r.status === "invited" ? '<span class="capa-over">Invited</span>' : "Active") + "</td>" +
            (admin ? '<td class="nowrap"><button type="button" class="btn btn-sm" data-act="edit">Edit</button>' +
              (r.role === "owner" ? "" : '<button type="button" class="btn btn-sm btn-danger" data-act="del">×</button>') +
              "</td>" : "") + "</tr>";
        }).join("") + "</tbody></table>";

      if (admin) host.querySelectorAll("tr[data-id]").forEach(function (tr) {
        var id = tr.getAttribute("data-id");
        var row = rows.filter(function (r) { return r.id === id; })[0];
        tr.querySelectorAll("[data-act]").forEach(function (b) {
          b.addEventListener("click", async function () {
            if (b.getAttribute("data-act") === "edit") return openForm(row);
            if (!confirm("Remove " + (row.name || row.email) + " from the workspace?")) return;
            await S.deleteMember(id);
            rows = rows.filter(function (r) { return r.id !== id; });
            render(); W.toast("Removed");
          });
        });
      });
    }

    document.getElementById("roleGuide").innerHTML =
      '<h3>What each role can do</h3><div class="role-grid">' +
      ROLES.map(function (r) {
        return '<div class="role-card"><span class="role-pill role-' + r.k + '">' + r.label + "</span>" +
          "<p>" + esc(r.desc) + "</p></div>";
      }).join("") + "</div>" +
      (S.mode === "local"
        ? '<p class="ws-auth-msg">In local mode these roles are illustrative only — there is no second user to apply them to. They become real once the workspace is connected to a backend, where they are enforced by database policy rather than by the browser.</p>'
        : '<p class="ws-auth-msg">Roles are enforced by row-level security in the database, so a viewer cannot write records even by calling the API directly.</p>');
  }

  function openForm(row) {
    row = row || { role: "editor", status: "invited" };
    var m = document.getElementById("teamModal");
    m.innerHTML = '<div class="ws-modal-in"><h3>' + (row.id ? "Edit member" : "Invite member") + "</h3>" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label>Name</label><input data-k="name" type="text" value="' + esc(row.name || "") + '"></div>' +
        '<div class="ws-f ws-f-wide"><label>Work email *</label><input data-k="email" type="email" value="' + esc(row.email || "") + '"></div>' +
        '<div class="ws-f"><label>Role</label><select data-k="role">' +
          ROLES.map(function (r) {
            return '<option value="' + r.k + '"' + (row.role === r.k ? " selected" : "") + ">" + r.label + "</option>";
          }).join("") + "</select></div>" +
        '<div class="ws-f"><label>Department</label><select data-k="department"><option value=""></option>' +
          W.DEPARTMENTS.map(function (d) {
            return '<option value="' + esc(d) + '"' + (row.department === d ? " selected" : "") + ">" + esc(d) + "</option>";
          }).join("") + "</select></div>" +
      "</div>" +
      (S.mode === "supabase"
        ? '<p class="ws-auth-msg">This records the seat. The person still needs to create an account with the same email address — sending the invitation email itself needs a server-side function, which is noted in the setup guide.</p>'
        : "") +
      '<div class="ws-modal-actions"><button type="button" class="btn" id="tmCancel">Cancel</button>' +
      '<button type="button" class="btn btn-accent" id="tmSave">Save</button></div></div>';
    m.classList.add("open");
    m.querySelector("#tmCancel").addEventListener("click", function () { m.classList.remove("open"); });
    m.querySelector("#tmSave").addEventListener("click", async function () {
      var data = Object.assign({}, row);
      m.querySelectorAll("[data-k]").forEach(function (i) { data[i.getAttribute("data-k")] = i.value; });
      if (!data.email) { W.toast("An email address is needed", "bad"); return; }
      var saved = await S.saveMember(data);
      var i = rows.findIndex(function (r) { return r.id === saved.id; });
      if (i >= 0) rows[i] = saved; else rows.push(saved);
      m.classList.remove("open"); render(); W.toast("Saved");
    });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    document.getElementById("wsBody").style.display = "";
    W.renderNav("team"); W.renderModeNotice();
    rows = await S.members();
    if (W.isAdmin()) {
      document.getElementById("teamActions").innerHTML =
        '<button type="button" class="btn btn-accent" id="tNew">Invite member</button>';
      document.getElementById("tNew").addEventListener("click", function () { openForm(null); });
    }
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
