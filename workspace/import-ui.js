/* AQcredix Workspace — the bulk import screen.
 *
 * Preview before write, always. A bad import is worse than no import: a hospital cannot
 * easily tell which of two hundred rows are duplicates, and "undo" across four tables is
 * not something to promise casually. So every row is validated and shown with its errors,
 * and nothing is written until the person has pressed Import knowing what will happen.
 */
(function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, I = window.AQImport;
  var esc;
  var typeKey = "assets";
  var parsed = null;

  function render() {
    var spec = I.TYPES[typeKey];

    document.getElementById("impTabs").innerHTML = Object.keys(I.TYPES).map(function (k) {
      return '<button class="cal-tab' + (k === typeKey ? " is-on" : "") + '" data-t="' + k + '">' +
        esc(I.TYPES[k].label) + "</button>";
    }).join("");

    document.getElementById("impIntro").innerHTML =
      (spec.help ? "<p>" + esc(spec.help) + "</p>" : "") +
      "<p>Expected columns — headers are matched loosely, so capitalisation and spacing " +
      "do not have to match:</p>" +
      '<div class="imp-cols">' + spec.cols.map(function (c) {
        return '<span class="imp-col' + (c[2] ? " is-req" : "") + '">' + esc(c[1]) +
          (c[2] ? " *" : "") + "</span>";
      }).join("") + "</div>" +
      '<button class="btn btn-ghost btn-sm" data-act="template">Download a template (CSV)</button>';

    document.getElementById("impPreview").innerHTML = parsed ? previewHtml() : "";
  }

  function previewHtml() {
    if (parsed.error) {
      return '<div class="imp-error"><b>That file cannot be imported</b><p>' +
        esc(parsed.error) + "</p></div>";
    }
    var good = parsed.rows.filter(function (r) { return !r.errs.length; });
    var bad = parsed.rows.filter(function (r) { return r.errs.length; });
    var spec = parsed.spec;
    var show = spec.cols.filter(function (c) { return c[2]; })
      .concat(spec.cols.filter(function (c) { return !c[2]; }).slice(0, 3));

    return '<div class="imp-summary">' +
        '<div class="ws-stat"><span class="n">' + good.length + '</span>' +
          '<span class="l">Ready to import</span></div>' +
        '<div class="ws-stat' + (bad.length ? " ws-stat-bad" : "") + '"><span class="n">' +
          bad.length + '</span><span class="l">Will be skipped</span></div>' +
      "</div>" +
      (bad.length
        ? '<div class="imp-bad"><b>These rows have problems and will not be imported</b>' +
          '<div class="imp-bad-rows">' + bad.slice(0, 12).map(function (r) {
            return '<div><span class="imp-line">Line ' + r.line + "</span>" +
              esc(r.errs.join(" · ")) + "</div>";
          }).join("") +
          (bad.length > 12 ? "<div>and " + (bad.length - 12) + " more</div>" : "") +
          "</div></div>"
        : "") +
      (good.length
        ? '<div class="imp-sub">First few rows, as they will be saved</div>' +
          '<div class="imp-table"><table><thead><tr>' +
            show.map(function (c) { return "<th>" + esc(c[1]) + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          good.slice(0, 6).map(function (r) {
            return "<tr>" + show.map(function (c) {
              return "<td>" + esc(r.rec[c[0]] || "—") + "</td>";
            }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>" +
          '<div class="imp-actions">' +
            '<button class="btn btn-ghost" data-act="cancel">Choose a different file</button>' +
            '<button class="btn btn-accent" data-act="commit">Import ' + good.length +
              " row" + (good.length === 1 ? "" : "s") + "</button>" +
          "</div>"
        : '<div class="imp-actions"><button class="btn btn-ghost" data-act="cancel">' +
          "Choose a different file</button></div>");
  }

  async function onFile(file) {
    var host = document.getElementById("impPreview");
    host.innerHTML = '<p class="muted">Reading ' + esc(file.name) + "…</p>";
    try {
      var rows = await I.parseFile(file);
      parsed = I.validate(typeKey, rows);
    } catch (e) {
      parsed = { error: e.message || String(e) };
    }
    render();
  }

  async function commit() {
    var btn = document.querySelector('[data-act="commit"]');
    if (btn) { btn.disabled = true; btn.textContent = "Importing…"; }
    var res = await I.commit(typeKey, parsed.rows, function (n, total) {
      if (btn) btn.textContent = "Importing " + n + " of " + total + "…";
    });
    parsed = null;
    render();
    document.getElementById("impPreview").innerHTML =
      '<div class="imp-done"><b>' + res.written + " row" + (res.written === 1 ? "" : "s") +
      " imported</b><p>" +
      (res.skipped ? res.skipped + " skipped for errors. " : "") +
      (res.failed ? res.failed + " could not be saved. " : "") +
      "Open the relevant page to see them.</p></div>";
    W.toast(res.written + " imported", "ok");
  }

  function wire() {
    document.getElementById("impTabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-t]");
      if (!b) return;
      typeKey = b.dataset.t; parsed = null; render();
    });

    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      if (b.dataset.act === "template") I.downloadTemplate(typeKey);
      else if (b.dataset.act === "cancel") { parsed = null; render(); }
      else if (b.dataset.act === "commit") commit();
    });

    var input = document.getElementById("impFile");
    input.addEventListener("change", function () {
      if (this.files && this.files[0]) onFile(this.files[0]);
      this.value = "";
    });

    var drop = document.getElementById("impDrop");
    ["dragover", "dragenter"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
    });
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("import"); W.renderModeNotice();
    wire();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
