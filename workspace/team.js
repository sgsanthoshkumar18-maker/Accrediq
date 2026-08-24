/* AQcredix Workspace — Team seats and roles. */
(function () {
  "use strict";
  var S = window.AQStore, W = window.AQWorkspace, esc;

  /* TWO ROLES SEE THE WHOLE HOSPITAL, AND ONLY ONE PERSON MAY HOLD EACH.
     A hospital has one quality manager and one director. Letting several accounts hold
     either would quietly turn "sees every department" into "everybody sees everything",
     which is the isolation the hospital was sold. The limit is a unique index in the
     database — checked here too, but only so the refusal is polite rather than a raw
     Postgres error. */
  var ROLES = [
    { k: "quality_manager", label: "Quality Manager", solo: true,
      desc: "Sees and edits every department. One per hospital." },
    { k: "director", label: "Director", solo: true,
      desc: "Sees and edits every department. One per hospital." },
    { k: "admin",  label: "Admin",  desc: "Manages the team and every record" },
    { k: "editor", label: "Editor", desc: "Records status, findings and documents in their own department" },
    { k: "viewer", label: "Viewer", desc: "Reads their own department, changes nothing" }
  ];

  /* The parts of the workspace a member may open. Empty means all of it, which is what
     the two master roles get. Biomedical has no use for Gate Pass; Security has none for
     the Apex manual. */
  var MODULES = [
    ["readiness","Readiness"], ["evidence","Evidence"], ["audits","Internal Audit"],
    ["incidents","Incidents"], ["calendar","Calendar"], ["register","Register"],
    ["training","Training"], ["rounds","Rounds"], ["capa","NC & CAPA"],
    ["library","Forms & Registers"], ["apex","Apex Manual"], ["gatepass","Gate Pass"],
    ["accreditation","Accreditation"], ["documents","Documents"], ["import","Bulk Import"]
  ];

  var SEATS = 15;
  var rows = [];

  function render() {
    /* Fifteen, and enforced by a trigger in the database rather than by this number —
       a cap the browser checks is a cap anybody lifts with developer tools, and this one
       is what a subscription actually buys. */
    var seats = SEATS;
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
            "<td>" + esc(r.department || "—") +
              /* Say it in the table, not just in the edit dialog. An admin reviewing who
                 can see what should not have to open six rows to find out. */
              (r.role === "owner" || r.role === "admin"
                ? ' <span class="tm-scope">all departments</span>'
                : r.all_departments ? ' <span class="tm-scope">all departments</span>' : "") +
              "</td>" +
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

  /* Same normalisation the server uses, so "A.Nair+ward@gmail.com" and "anair@gmail.com"
     are recognised as one mailbox on both sides and an edit that only changes the spelling
     does not trigger a fresh account check. */
  function normalise(raw) {
    var e = String(raw || "").trim().toLowerCase();
    var at = e.lastIndexOf("@");
    if (at < 1) return e;
    var local = e.slice(0, at), domain = e.slice(at + 1);
    var plus = local.indexOf("+");
    if (plus > -1) local = local.slice(0, plus);
    if (domain === "gmail.com" || domain === "googlemail.com") local = local.split(".").join("");
    return local + "@" + domain;
  }

  /* "here" | "missing" | "unknown" — three answers, not two. Treating a failed check as
     "missing" would tell a Quality Manager their colleague has no account when in fact we
     simply could not reach the server, and they would go and chase that person for
     nothing. In local mode there is no server and no second user, so nothing to check. */
  async function accountCheck(email) {
    if (S.mode === "local") return "here";
    var s = null;
    try { s = JSON.parse(localStorage.getItem("aq-sb-session") || "null"); } catch (e) {}
    if (!s || !s.access_token) return "unknown";
    try {
      var r = await fetch("/api/account-exists?email=" + encodeURIComponent(email), {
        headers: { Authorization: "Bearer " + s.access_token }
      });
      if (!r.ok) return "unknown";
      var j = await r.json();
      return j && j.exists === true ? "here" : "missing";
    } catch (e) { return "unknown"; }
  }

  var originalEmail = "";

  function openForm(row) {
    row = row || { role: "editor", status: "invited", modules: [] };
    originalEmail = row.email || "";       // so an edit that leaves the address alone is not re-checked
    var m = document.getElementById("teamModal");
    m.innerHTML = '<div class="ws-modal-in"><h3>' + (row.id ? "Edit member" : "Invite member") + "</h3>" +
      '<div class="ws-form">' +
        '<div class="ws-f ws-f-wide"><label>Name</label><input data-k="name" type="text" value="' + esc(row.name || "") + '"></div>' +
        '<div class="ws-f ws-f-wide"><label>Work email *</label><input data-k="email" type="email" value="' + esc(row.email || "") + '"></div>' +
        '<div class="ws-f"><label>Role</label><select data-k="role">' +
          ROLES.map(function (r) {
            return '<option value="' + r.k + '"' + (row.role === r.k ? " selected" : "") + ">" + r.label + "</option>";
          }).join("") + "</select></div>" +
        /* Required, and chosen by the admin rather than by the person joining.
           Department decides what data this account can see, so it cannot be
           self-selected at sign-up: everyone would simply pick the one that sees
           everything. The admin who is paying decides. */
        '<div class="ws-f"><label>Department *</label><select data-k="department"><option value="">Choose a department</option>' +
          W.DEPARTMENTS.map(function (d) {
            return '<option value="' + esc(d) + '"' + (row.department === d ? " selected" : "") + ">" + esc(d) + "</option>";
          }).join("") + "</select></div>" +
        /* What they are called on the ward. Kept separate from role because a hospital's
           own words for a job and this software's permission model are different things —
           "Biomedical Engineer" is a designation, "editor" is what they may change. */
        '<div class="ws-f ws-f-wide"><label>Designation</label>' +
          '<input data-k="designation" type="text" placeholder="e.g. Biomedical Engineer, Nursing Superintendent" value="' +
          esc(row.designation || "") + '"></div>' +

        /* WHICH PARTS OF THE WORKSPACE THIS PERSON OPENS.
           Department scoping answers "whose records may I see". This answers a different
           question the hospital actually asks: which sections they need at all. Ticking
           nothing means everything, so an existing member's access is unchanged until
           somebody deliberately narrows it — a default that silently locked people out of
           modules they used yesterday would be the wrong one by a long way. */
        '<div class="ws-f ws-f-wide tm-modules" id="tmModules"><label>Sections they can open</label>' +
          '<p class="tm-modhint">Leave all unticked for full access. The Quality Manager ' +
          "and Director always see everything, whatever is ticked here.</p>" +
          '<div class="tm-modgrid">' +
          MODULES.map(function (m) {
            var on = (row.modules || []).indexOf(m[0]) > -1;
            return '<label class="tm-check"><input type="checkbox" data-mod="' + m[0] + '"' +
              (on ? " checked" : "") + "><span>" + esc(m[1]) + "</span></label>";
          }).join("") +
          "</div></div>" +

        /* The visibility flag, kept apart from role.
           Role says what you may DO; this says what you may SEE. A biomedical editor and
           a biomedical viewer look at the same records and one can change them. Quality
           needs this because their job is auditing the other departments. */
        '<div class="ws-f ws-f-wide"><label class="tm-check">' +
          '<input type="checkbox" data-k="all_departments"' +
            (row.all_departments ? " checked" : "") + ">" +
          "<span>Can see every department" +
          '<small>For quality and anyone auditing across the hospital. Leave unticked and ' +
          "this person sees only their own department's records. Owners and admins always " +
          "see everything.</small></span></label></div>" +
      "</div>" +
      (S.mode === "supabase"
        /* Says the requirement BEFORE they fill the form in, not only when the save is
           refused. Being told the order of operations up front is guidance; being told it
           after typing six fields is a telling-off. */
        ? '<p class="ws-auth-msg">The person must already have an AQcredix account under this exact email address. Ask them to sign up first — the seat is then matched to them the next time they sign in.</p>'
        : "") +
      '<div class="ws-modal-actions"><button type="button" class="btn btn-ghost" id="tmCancel">Cancel</button>' +
      '<button type="button" class="btn btn-accent" id="tmSave">Save</button></div></div>';
    m.classList.add("open");
    m.querySelector("#tmCancel").addEventListener("click", function () { m.classList.remove("open"); });
    m.querySelector("#tmSave").addEventListener("click", async function () {
      var data = Object.assign({}, row);
      m.querySelectorAll("[data-k]").forEach(function (i) {
        data[i.getAttribute("data-k")] = i.type === "checkbox" ? i.checked : i.value;
      });
      data.modules = [].slice.call(m.querySelectorAll("[data-mod]"))
        .filter(function (c) { return c.checked; })
        .map(function (c) { return c.getAttribute("data-mod"); });

      if (!data.email) { W.toast("An email address is needed", "bad"); return; }

      /* Refused here as well as by the unique index, so the message is one a person can
         act on rather than a raw constraint violation. The index is still what makes it
         true — two browsers saving at the same moment both pass this check. */
      var solo = ROLES.filter(function (r) { return r.k === data.role && r.solo; })[0];
      if (solo) {
        var taken = rows.filter(function (r) {
          return r.role === data.role && r.id !== data.id && r.status !== "removed";
        })[0];
        if (taken) {
          W.toast("Only one " + solo.label + " per hospital — " +
                  (taken.name || taken.email) + " holds it. Change theirs first.", "bad");
          return;
        }
      }

      /* The cap, said plainly before the database says it rudely. */
      if (!data.id) {
        var used = rows.filter(function (r) { return r.status !== "removed"; }).length;
        if (used >= SEATS) {
          W.toast("All " + SEATS + " accounts are in use. Remove someone first.", "bad");
          return;
        }
      }
      /* Refused rather than defaulted. A seat with no department would be invisible to
         the department filter, and the tempting default -- show them everything -- is
         exactly the leak this whole feature exists to prevent. */
      if (!data.department) { W.toast("Choose a department for this person", "bad"); return; }

      /* A seat is matched to a person when they sign in with this address. Creating one
         for an address that has never signed up saves a row, says "Saved", and does
         nothing — the colleague is never let in and nobody finds out for weeks. So the
         account is confirmed to exist first, and only when the address is new to this
         hospital: an existing seat being edited has already been through this. */
      if (!data.id || normalise(data.email) !== normalise(originalEmail)) {
        var check = await accountCheck(data.email);
        if (check === "missing") {
          W.toast(data.email + " has not created an AQcredix account yet. Ask them to sign " +
                  "up with this exact address first, then add them here.", "bad");
          return;
        }
        if (check === "unknown") {
          W.toast("We could not confirm that account just now. Please try again in a moment.",
                  "bad");
          return;
        }
      }

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
    if (W.clearSkeleton) W.clearSkeleton();
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
