/* AQcredix — select many rows, delete them once.
 *
 * WHY THIS EXISTS. Every record list on the site had exactly one way to remove
 * something: a Delete button on the row, guarded by a confirm(). That is right
 * for one row and wrong for ten. Clearing a pilot run of ten audits meant ten
 * clicks and ten confirmations, and a dialog answered ten times in a row stops
 * being read by the third — which is the opposite of what a confirmation is
 * for. One checkbox column and one confirmation that names the count is both
 * faster AND safer.
 *
 * ATTACHES TO WHAT IS ALREADY THERE. Pages differ in how they mark a row: some
 * put data-id on the row, others only on the Delete button inside it. Rather
 * than rewriting every list, this reads whichever is present. Existing
 * per-row Delete buttons keep working untouched — this is an addition, not a
 * replacement, because deleting one row should stay a one-click job.
 *
 * USAGE
 *   AQBulk.attach({
 *     root:     containerElement,     // the table or card grid
 *     rows:     "tbody tr",           // selector for one record, within root
 *     label:    "audit record",       // singular, for the confirm text
 *     onDelete: async function (ids) { ... }   // called once with every id
 *   });
 *
 * Call attach() again after a re-render; it is idempotent per element.
 */
(function (root) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* The id for a row, wherever the page happens to keep it. Ordered from most
     explicit to least so a page that sets data-id wins over one that only
     marks the button. */
  function idOf(rowEl) {
    if (rowEl.hasAttribute && rowEl.hasAttribute("data-id")) return rowEl.getAttribute("data-id");
    var byDel = rowEl.querySelector && rowEl.querySelector("[data-del]");
    if (byDel) return byDel.getAttribute("data-del");
    var named = rowEl.querySelector && rowEl.querySelector("[data-open],[data-edit]");
    if (named) return named.getAttribute("data-open") || named.getAttribute("data-edit");
    return null;
  }

  function isTableRow(el) { return el.tagName === "TR"; }

  function makeBar() {
    var bar = document.createElement("div");
    bar.className = "aqbulk-bar";
    bar.setAttribute("role", "status");
    bar.innerHTML =
      '<span class="aqbulk-count"></span>' +
      '<span class="aqbulk-sp"></span>' +
      '<button type="button" class="aqbulk-clear">Clear selection</button>' +
      '<button type="button" class="aqbulk-del">Delete selected</button>';
    return bar;
  }

  function attach(opts) {
    var rootEl = opts.root;
    if (!rootEl) return null;
    var rowSel = opts.rows || "tbody tr";
    var label = opts.label || "record";
    var onDelete = opts.onDelete;
    if (typeof onDelete !== "function") return null;

    var rows = Array.prototype.slice.call(rootEl.querySelectorAll(rowSel))
      .filter(function (r) { return idOf(r) != null; });
    if (!rows.length) return null;

    /* Guard against double-attach after a re-render that reused the node. */
    if (rootEl.getAttribute("data-aqbulk") === "1") return null;
    rootEl.setAttribute("data-aqbulk", "1");

    var selected = Object.create(null);
    var lastIndex = null;

    /* ---- the checkbox cell, shaped to whatever the list is ---- */
    function addBox(rowEl, index) {
      var box = document.createElement("input");
      box.type = "checkbox";
      box.className = "aqbulk-box";
      box.setAttribute("aria-label", "Select this " + label);
      box.addEventListener("click", function (e) {
        /* Shift-click selects the range. The whole point of this feature is
           clearing a run of rows, and a run is what shift-click is for. */
        if (e.shiftKey && lastIndex != null) {
          var a = Math.min(lastIndex, index), b = Math.max(lastIndex, index);
          for (var i = a; i <= b; i++) setRow(i, box.checked);
        } else {
          setRow(index, box.checked);
        }
        lastIndex = index;
        paint();
      });
      if (isTableRow(rowEl)) {
        var td = document.createElement("td");
        td.className = "aqbulk-cell";
        td.appendChild(box);
        rowEl.insertBefore(td, rowEl.firstChild);
      } else {
        rowEl.classList.add("aqbulk-host");
        var wrap = document.createElement("label");
        wrap.className = "aqbulk-float";
        wrap.appendChild(box);
        rowEl.insertBefore(wrap, rowEl.firstChild);
      }
      return box;
    }

    var boxes = rows.map(addBox);

    function setRow(i, on) {
      var id = idOf(rows[i]);
      if (id == null) return;
      boxes[i].checked = on;
      rows[i].classList.toggle("aqbulk-on", on);
      if (on) selected[id] = true; else delete selected[id];
    }

    /* ---- header "select all" ---- */
    var allBox = null;
    var headRow = rootEl.querySelector("thead tr");
    if (headRow) {
      var th = document.createElement("th");
      th.className = "aqbulk-cell";
      allBox = document.createElement("input");
      allBox.type = "checkbox";
      allBox.className = "aqbulk-box";
      allBox.setAttribute("aria-label", "Select every " + label + " shown");
      allBox.addEventListener("change", function () {
        for (var i = 0; i < rows.length; i++) setRow(i, allBox.checked);
        paint();
      });
      th.appendChild(allBox);
      headRow.insertBefore(th, headRow.firstChild);
    }

    /* ---- the action bar ---- */
    var bar = makeBar();
    document.body.appendChild(bar);
    var countEl = bar.querySelector(".aqbulk-count");
    var delBtn = bar.querySelector(".aqbulk-del");

    bar.querySelector(".aqbulk-clear").addEventListener("click", function () {
      for (var i = 0; i < rows.length; i++) setRow(i, false);
      if (allBox) { allBox.checked = false; allBox.indeterminate = false; }
      paint();
    });

    delBtn.addEventListener("click", async function () {
      var ids = Object.keys(selected);
      if (!ids.length) return;
      var noun = label + (ids.length === 1 ? "" : "s");
      /* ONE confirmation, and it names the number. A per-row confirm answered
         ten times is read once; a single dialog saying "Delete 10 audit
         records?" is read every time, because the number is the thing that
         changes. */
      if (!confirm(
        "Delete " + ids.length + " " + noun + "?\n\n" +
        "This cannot be undone."
      )) return;

      delBtn.disabled = true;
      var was = delBtn.textContent;
      delBtn.textContent = "Deleting…";
      try {
        await onDelete(ids);
      } catch (err) {
        alert("Could not delete: " + ((err && err.message) || err));
        delBtn.disabled = false;
        delBtn.textContent = was;
        return;
      }
      /* The caller re-renders, which drops this bar's rows. Remove the bar so
         it cannot outlive the list it belonged to. */
      destroy();
    });

    function paint() {
      var n = Object.keys(selected).length;
      countEl.textContent = n + " " + label + (n === 1 ? "" : "s") + " selected";
      bar.classList.toggle("on", n > 0);
      if (allBox) {
        allBox.checked = n > 0 && n === rows.length;
        allBox.indeterminate = n > 0 && n < rows.length;
      }
    }

    function destroy() {
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
      rootEl.removeAttribute("data-aqbulk");
    }

    /* If the list is replaced under us, take the bar with it. */
    var mo = null;
    try {
      mo = new MutationObserver(function () {
        if (!document.body.contains(rootEl)) { destroy(); mo.disconnect(); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (e) {}

    paint();
    return { destroy: destroy };
  }

  root.AQBulk = { attach: attach, idOf: idOf };
})(window);
