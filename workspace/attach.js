/* AQcredix — file attachments.
 *
 * A calibration certificate recorded as a number, with the PDF itself in someone's inbox,
 * is not evidence an assessor can be shown. This attaches the file to the record it
 * evidences.
 *
 * Files live in Supabase Storage; `attachments` holds the metadata that makes them
 * findable. The bucket is PRIVATE and every link is a short-lived signed URL — a public
 * bucket would make every hospital's incident photographs and credential scans readable by
 * anyone who guessed a path, which is the worst possible failure for this product.
 *
 * Usage from any workspace page:
 *   AQAttach.mount(hostEl, "asset_events", eventId)
 */
window.AQAttach = (function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace;
  var BUCKET = "evidence";

  /* Deliberately narrow. A hospital attaching evidence needs documents and photographs;
     anything else is either a mistake or something that has no business in a compliance
     record. Executables and archives are excluded outright rather than filtered later. */
  var ALLOWED = {
    "application/pdf": "PDF",
    "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "Image", "image/heic": "Image",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/vnd.ms-excel": "Excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel"
  };
  var MAX = 10 * 1024 * 1024;   // 10 MB: a scanned certificate is well under this

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function human(n) {
    if (!n) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  function cfg() {
    return (window.AQ_CONFIG || window.AQConfig || {});
  }

  function base() {
    var c = cfg();
    return c.supabaseUrl || c.SUPABASE_URL || "";
  }

  function token() {
    try {
      var raw = localStorage.getItem("aq-sb-session");
      return raw ? (JSON.parse(raw).access_token || "") : "";
    } catch (e) { return ""; }
  }

  /* A safe storage path. The filename is NOT used as the path: two people uploading
     "certificate.pdf" would collide, and a name containing a slash would escape the
     folder. The original name is kept in the row for display. */
  function pathFor(table, entityId, filename) {
    var ext = (String(filename).match(/\.([a-z0-9]{1,6})$/i) || [, "bin"])[1].toLowerCase();
    var stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return table.replace(/[^a-z_]/gi, "") + "/" +
           String(entityId).replace(/[^a-z0-9_-]/gi, "") + "/" + stamp + "." + ext;
  }

  async function list(table, entityId) {
    try {
      var rows = await S.adapter.list("attachments");
      return (rows || []).filter(function (a) {
        return a.entity_table === table && a.entity_id === entityId;
      });
    } catch (e) { return []; }
  }

  async function upload(file, table, entityId) {
    if (!ALLOWED[file.type]) {
      throw new Error("That file type is not accepted. Attach a PDF, an image, or an " +
                      "Office document.");
    }
    if (file.size > MAX) {
      throw new Error("That file is " + human(file.size) + ". The limit is 10 MB \u2014 " +
                      "a scanned certificate is usually well under it.");
    }
    var url = base();
    if (!url) throw new Error("Storage is not configured on this deployment.");

    var path = pathFor(table, entityId, file.name);
    var r = await fetch(url + "/storage/v1/object/" + BUCKET + "/" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token(),
        "Content-Type": file.type,
        "x-upsert": "false"
      },
      body: file
    });
    if (!r.ok) {
      var t = await r.text().catch(function () { return ""; });
      /* Named plainly, because this is the one failure a hospital will hit on first use
         and "upload failed" sends them nowhere. */
      if (r.status === 404 || /bucket/i.test(t)) {
        throw new Error("The 'evidence' storage bucket does not exist yet. Create it in " +
                        "Supabase \u2192 Storage, and keep it private.");
      }
      throw new Error("Upload failed (" + r.status + ").");
    }

    await S.adapter.upsert("attachments", {
      id: "att_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      entity_table: table,
      entity_id: entityId,
      bucket: BUCKET,
      path: path,
      filename: file.name,
      mime: file.type,
      size_bytes: file.size
    });
  }

  /* Signed, short-lived, and requested only when someone actually clicks. A stored public
     URL would outlive the person's access to the record. */
  async function open(att) {
    var url = base();
    var r = await fetch(url + "/storage/v1/object/sign/" + att.bucket + "/" + att.path, {
      method: "POST",
      headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 120 })
    });
    if (!r.ok) throw new Error("Could not open that file.");
    var j = await r.json();
    window.open(url + "/storage/v1" + j.signedURL, "_blank", "noopener");
  }

  async function remove(att) {
    if (!confirm("Remove " + att.filename + "?")) return;
    try {
      await fetch(base() + "/storage/v1/object/" + att.bucket + "/" + att.path, {
        method: "DELETE", headers: { Authorization: "Bearer " + token() }
      });
    } catch (e) {}
    /* The row goes even if the object delete failed. A row pointing at a file that is not
       there shows a broken link in an evidence list, which is worse than an orphaned
       object nobody can reach. */
    try { await S.adapter.remove("attachments", att.id); } catch (e) {}
  }

  /* ---------------------------------- UI ---------------------------------- */

  async function mount(host, table, entityId) {
    if (!host) return;
    var ro = W && W.canEdit ? !W.canEdit() : false;

    async function paint() {
      var rows = await list(table, entityId);
      host.innerHTML =
        '<div class="att">' +
          '<div class="att-head">Evidence' +
            (rows.length ? ' <span class="att-n">' + rows.length + "</span>" : "") + "</div>" +
          (rows.length
            ? '<div class="att-rows">' + rows.map(function (a) {
                return '<div class="att-row" data-id="' + esc(a.id) + '">' +
                  '<span class="att-kind">' + esc(ALLOWED[a.mime] || "File") + "</span>" +
                  '<button class="att-name" data-att="open">' + esc(a.filename) + "</button>" +
                  '<span class="att-size">' + esc(human(a.size_bytes)) + "</span>" +
                  (ro ? "" : '<button class="att-x" data-att="del" aria-label="Remove">\u2715</button>') +
                "</div>";
              }).join("") + "</div>"
            : '<div class="att-empty">Nothing attached yet.</div>') +
          (ro ? "" :
            '<label class="att-add"><input type="file" hidden>' +
              "<span>+ Attach a certificate or photo</span></label>") +
        "</div>";

      var input = host.querySelector('input[type="file"]');
      if (input) {
        input.addEventListener("change", async function () {
          var f = this.files && this.files[0];
          if (!f) return;
          var label = host.querySelector(".att-add span");
          label.textContent = "Uploading\u2026";
          try {
            await upload(f, table, entityId);
            await paint();
            if (W && W.toast) W.toast("Attached", "ok");
          } catch (e) {
            label.textContent = "+ Attach a certificate or photo";
            if (W && W.toast) W.toast(e.message, "bad");
            else alert(e.message);
          }
          this.value = "";
        });
      }

      host.querySelectorAll("[data-att]").forEach(function (b) {
        b.addEventListener("click", async function () {
          var id = b.closest(".att-row").dataset.id;
          var att = rows.filter(function (x) { return x.id === id; })[0];
          if (!att) return;
          try {
            if (b.dataset.att === "open") await open(att);
            else { await remove(att); await paint(); }
          } catch (e) {
            if (W && W.toast) W.toast(e.message, "bad");
          }
        });
      });
    }

    await paint();
  }

  return { mount: mount, list: list, upload: upload, open: open, remove: remove,
           ALLOWED: ALLOWED, MAX: MAX, pathFor: pathFor };
})();
