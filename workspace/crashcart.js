/* AQcredix — Short expiry calendar: crash cart medicines.
 *
 * WHY A CRASH CART IS NOT AN EQUIPMENT REGISTER.
 * A defibrillator is calibrated and goes on being that defibrillator. An adrenaline
 * ampoule is CONSUMED — and the moment it is used, the thing that replaces it has a
 * different expiry date and usually a different batch. A register that treats that as an
 * unusual edit is wrong about the normal case, because the normal case is a code blue at
 * three in the morning followed by nobody updating a spreadsheet.
 *
 * So restocking is a first-class action here, not a correction: "there was a code blue"
 * asks which trolley, which items, and what the new dates are, writes them into the cart,
 * and re-judges them against the hospital's short-expiry rule immediately.
 *
 * THE RULE ITSELF IS IN shortexpiry.js AND IS SHARED WITH THE ALERT EMAIL.
 * Whatever this screen calls short, the monthly mail calls short. A second copy of that
 * arithmetic would drift, and a pharmacist shown four ampoules on screen and three in the
 * inbox stops trusting both.
 */
(function () {
  "use strict";
  var S = window.AQStore, W = window.AQWorkspace, E = window.AQShortExpiry, esc;

  var CARTS = "crash_carts", ITEMS = "crash_cart_items";
  var SETTINGS = "crash_cart_settings", EVENTS = "code_blue_events";

  var carts = [], items = [], settings = { months: 3 }, tab = "action";

  function id(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 11); }
  function today() { return new Date().toISOString().slice(0, 10); }

  function months() { return E.normaliseMonths(settings && settings.months); }
  function review() { return E.review(carts, items, { today: today(), months: months() }); }

  /* ---------------- rendering ---------------- */

  function stats(r) {
    function box(cls, n, label) {
      return '<div class="reg-stat' + (cls ? " " + cls : "") + '"><b>' + n +
             "</b><span>" + label + "</span></div>";
    }
    return '<div class="reg-stats">' +
      box(r.expired.length ? "bad" : "", r.expired.length, "Expired &mdash; remove now") +
      box(r.short.length ? "warn" : "ok", r.short.length, "Short expiry") +
      box("", items.length, "Items tracked") +
      box("", carts.length, "Crash carts") +
      "</div>";
  }

  function itemRow(f) {
    var left = f.daysLeft < 0
      ? '<span class="tr-tag bad">Expired ' + Math.abs(f.daysLeft) + "d ago</span>"
      : '<span class="tr-tag ' + (f.state === "short" ? "warn" : "ok") + '">' +
        f.daysLeft + " days left</span>";
    return "<tr>" +
      "<td><b>" + esc(f.name) + "</b>" +
        (f.strength ? " " + esc(f.strength) : "") +
        (f.batch ? '<span class="tr-sub">batch ' + esc(f.batch) + "</span>" : "") + "</td>" +
      "<td>" + esc(f.cart) + (f.department ? '<span class="tr-sub">' + esc(f.department) +
        "</span>" : "") + "</td>" +
      "<td>" + esc(f.quantity) + "</td>" +
      "<td>" + esc(f.expiry) + "</td>" +
      "<td>" + left + "</td>" +
      '<td><button class="tr-edit" data-edit="' + esc(f.id) + '">Edit</button></td></tr>';
  }

  function table(list) {
    if (!list.length) return "";
    return '<div class="ws-tablewrap"><table class="ws-table">' +
      "<tr><th>Item</th><th>Crash cart</th><th>Qty</th><th>Expires</th>" +
      "<th>&nbsp;</th><th>&nbsp;</th></tr>" +
      list.map(itemRow).join("") + "</table></div>";
  }

  function actionPanel(r) {
    if (r.empty) {
      return '<div class="ws-empty"><p>Nothing is expiring inside your ' + r.months +
        "-month window. Everything in " + carts.length + " crash cart" +
        (carts.length === 1 ? "" : "s") + " is in date.</p></div>";
    }
    var out = "";
    if (r.expired.length) {
      out += '<div class="ev-summary none"><b>' + r.expired.length + " item" +
        (r.expired.length === 1 ? " has" : "s have") + " already expired.</b> " +
        "Remove from the trolley now &mdash; this is not a reorder.</div>" +
        '<div class="ev-block"><h3>Expired</h3>' + table(r.expired) + "</div>";
    }
    if (r.short.length) {
      out += '<div class="ev-block"><h3>Short expiry &mdash; within ' + r.months +
        " months<span class=\"ev-count\">" + r.short.length + "</span></h3>" +
        table(r.short) + "</div>";
    }
    return out;
  }

  function monthPanel(r) {
    var groups = E.byMonth(r.all);
    if (!groups.length) return '<div class="ws-empty"><p>Nothing to show.</p></div>';
    return groups.map(function (g) {
      return '<div class="ev-block"><h3>' + esc(E.monthLabel(g.month)) +
        '<span class="ev-count">' + g.items.length + "</span></h3>" +
        table(g.items) + "</div>";
    }).join("");
  }

  function cartPanel() {
    if (!carts.length) {
      return '<div class="ws-empty"><p>No crash carts yet. Add the first one &mdash; ' +
        "name it the way the ward does, so somebody can walk to it.</p></div>";
    }
    return carts.map(function (c) {
      var own = items.filter(function (i) { return i.cart_id === c.id; });
      var flagged = E.review([c], own, { today: today(), months: months() });
      return '<div class="ev-block"><h3>' + esc(c.name) +
        (c.department ? " &middot; " + esc(c.department) : "") +
        '<span class="ev-count">' + own.length + " item" + (own.length === 1 ? "" : "s") +
        "</span>" +
        (flagged.all.length ? '<span class="ev-count">' + flagged.all.length +
          " need attention</span>" : "") + "</h3>" +
        '<div class="cc-cartactions">' +
          '<button class="btn btn-ghost btn-sm" data-additem="' + esc(c.id) + '">Add item</button> ' +
          '<button class="btn btn-ghost btn-sm" data-editcart="' + esc(c.id) + '">Rename</button>' +
        "</div>" +
        (own.length
          ? '<div class="ws-tablewrap"><table class="ws-table">' +
            "<tr><th>Item</th><th>Qty</th><th>Expires</th><th>Status</th><th>&nbsp;</th></tr>" +
            own.map(function (i) {
              var c2 = E.classify(i, { today: today(), months: months() });
              var tag = c2.state === "expired" ? '<span class="tr-tag bad">Expired</span>'
                : c2.state === "short" ? '<span class="tr-tag warn">Short</span>'
                : c2.state === "unknown" ? '<span class="tr-tag">No date</span>'
                : '<span class="tr-tag ok">In date</span>';
              return "<tr><td><b>" + esc(i.name) + "</b>" +
                (i.strength ? " " + esc(i.strength) : "") + "</td>" +
                "<td>" + esc(i.quantity) + "</td><td>" + esc(i.expires_on || "&mdash;") +
                "</td><td>" + tag + "</td>" +
                '<td><button class="tr-edit" data-edit="' + esc(i.id) + '">Edit</button></td></tr>';
            }).join("") + "</table></div>"
          : '<p class="tr-hint">No items recorded in this cart yet.</p>') +
        "</div>";
    }).join("");
  }

  function render() {
    var r = review();
    document.getElementById("ccStats").innerHTML = stats(r);
    document.getElementById("ccPolicy").innerHTML =
      '<label class="cc-policy">Short expiry protocol' +
      '<select id="ccMonths">' +
        E.ALLOWED_MONTHS.map(function (m) {
          return '<option value="' + m + '"' + (m === r.months ? " selected" : "") + ">" +
                 m + " months</option>";
        }).join("") + "</select></label>" +
      '<span class="tr-hint">Anything expiring on or before <b>' + esc(r.windowEnds) +
      "</b> is flagged. Applies to every item in every cart.</span>";

    var panel = document.getElementById("ccPanel");
    panel.innerHTML = tab === "action" ? actionPanel(r)
                    : tab === "month" ? monthPanel(r)
                    : cartPanel();

    [].forEach.call(document.querySelectorAll("#ccTabs .cal-tab"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-tab") === tab);
    });
  }

  /* ---------------- forms ---------------- */

  function modal(html) {
    var m = document.getElementById("ccModal");
    m.innerHTML = '<div class="ws-modal-in">' + html + "</div>";
    m.classList.add("open");
    m.addEventListener("click", function (e) { if (e.target === m) close(); });
    return m;
  }
  function close() { document.getElementById("ccModal").classList.remove("open"); }

  function cartForm(cart) {
    var c = cart || {};
    modal("<h3>" + (cart ? "Rename crash cart" : "Add a crash cart") + "</h3>" +
      '<form id="ccCartForm" class="ws-form"' + (cart ? ' data-id="' + esc(c.id) + '"' : "") + '>' +
      '<div class="ws-f ws-f-wide"><label>Location *</label>' +
        '<input name="name" required value="' + esc(c.name || "") +
        '" placeholder="ICU bed 4, Casualty resus bay"></div>' +
      '<div class="ws-f"><label>Department</label><input name="department" value="' +
        esc(c.department || "") + '"></div>' +
      '<p class="tr-hint">Name it the way the ward says it out loud. Somebody reading the ' +
        "alert at 7am has to walk to this trolley.</p>" +
      '<div class="ws-modal-actions">' +
        (cart ? '<button type="button" class="btn btn-ghost" id="ccCartDel">Delete cart</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Save</button></div></form>');
  }

  function itemForm(item, cartId) {
    var i = item || {};
    modal("<h3>" + (item ? "Edit item" : "Add an item") + "</h3>" +
      '<form id="ccItemForm" class="ws-form"' + (item ? ' data-id="' + esc(i.id) + '"' : "") + '>' +
      '<div class="ws-f ws-f-wide"><label>Crash cart *</label><select name="cart_id" required>' +
        carts.map(function (c) {
          var sel = (i.cart_id || cartId) === c.id ? " selected" : "";
          return '<option value="' + esc(c.id) + '"' + sel + ">" + esc(c.name) + "</option>";
        }).join("") + "</select></div>" +
      '<div class="ws-f ws-f-wide"><label>Item *</label><input name="name" required value="' +
        esc(i.name || "") + '" placeholder="Adrenaline 1mg/ml"></div>' +
      '<div class="ws-f"><label>Strength / form</label><input name="strength" value="' +
        esc(i.strength || "") + '"></div>' +
      '<div class="ws-f"><label>Quantity *</label><input name="quantity" type="number" min="0" ' +
        'required value="' + esc(i.quantity == null ? 1 : i.quantity) + '"></div>' +
      '<div class="ws-f"><label>Expiry *</label><input name="expires_on" type="date" required ' +
        'value="' + esc(i.expires_on || "") + '"></div>' +
      '<div class="ws-f"><label>Batch</label><input name="batch" value="' +
        esc(i.batch || "") + '"></div>' +
      '<p class="tr-hint">If the pack shows only a month, use the LAST day of it &mdash; ' +
        "stock printed 11/2026 is usable to 30 November.</p>" +
      '<div class="ws-modal-actions">' +
        (item ? '<button type="button" class="btn btn-ghost" id="ccItemDel">Delete</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Save</button></div></form>');
  }

  /* THE CODE BLUE FLOW.
     Asked as a question rather than presented as a form, because the person opening this
     has just been told "we used the cart" and is not yet thinking in fields. Answering
     yes narrows to one trolley, then to the items actually used, and asks only for what
     changed: how many were used, and the new expiry of what replaced them. */
  function codeBlueForm() {
    if (!carts.length) { W.toast("Add a crash cart first", "bad"); return; }
    modal("<h3>Was there a code blue?</h3>" +
      '<p class="tr-hint">Recording it here replaces the expiry dates of the items you ' +
        "used, so the short-expiry window is applied to the new stock rather than to the " +
        "stock that has gone.</p>" +
      '<form id="ccBlueForm" class="ws-form">' +
      '<div class="ws-f"><label>Date of the event *</label>' +
        '<input name="happened_on" type="date" required value="' + today() + '"></div>' +
      '<div class="ws-f"><label>Which crash cart *</label><select name="cart_id" required id="ccBlueCart">' +
        carts.map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(c.name) + "</option>";
        }).join("") + "</select></div>" +
      '<div class="ws-f ws-f-wide"><label>Items used</label>' +
        '<div id="ccBlueItems" class="cc-used"></div></div>' +
      '<div class="ws-f ws-f-wide"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>' +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Record and restock</button>' +
      "</div></form>");

    function fillItems() {
      var cartId = document.getElementById("ccBlueCart").value;
      var own = items.filter(function (i) { return i.cart_id === cartId; });
      var box = document.getElementById("ccBlueItems");
      box.innerHTML = own.length
        ? own.map(function (i) {
            return '<label class="cc-used-row">' +
              '<input type="checkbox" data-used="' + esc(i.id) + '">' +
              '<span class="cc-used-name">' + esc(i.name) +
                '<small>' + esc(i.quantity) + " in cart &middot; expires " +
                esc(i.expires_on || "—") + "</small></span>" +
              '<span class="cc-used-fields">' +
                '<input type="number" min="1" max="' + esc(i.quantity) +
                  '" value="1" data-qty="' + esc(i.id) + '" disabled title="How many were used">' +
                '<input type="date" data-newexp="' + esc(i.id) +
                  '" disabled title="Expiry of the replacement">' +
              "</span></label>";
          }).join("")
        : '<p class="tr-hint">This cart has no items recorded yet.</p>';

      /* The two fields only wake up once the item is ticked. Enabled from the start they
         invite someone to fill in a date for stock nobody touched. */
      [].forEach.call(box.querySelectorAll("[data-used]"), function (cb) {
        cb.addEventListener("change", function () {
          var k = cb.getAttribute("data-used");
          box.querySelector('[data-qty="' + k + '"]').disabled = !cb.checked;
          var d = box.querySelector('[data-newexp="' + k + '"]');
          d.disabled = !cb.checked;
          if (cb.checked) d.required = true; else { d.required = false; d.value = ""; }
        });
      });
    }
    document.getElementById("ccBlueCart").addEventListener("change", fillItems);
    fillItems();
  }

  /* ---------------- saving ---------------- */

  async function refresh() {
    try {
      carts = (await S.adapter.list(CARTS)) || [];
      items = (await S.adapter.list(ITEMS)) || [];
      var s = (await S.adapter.list(SETTINGS)) || [];
      settings = s[0] || { months: 3 };
    } catch (e) {
      carts = carts || []; items = items || [];
    }
    carts.sort(function (a, b) { return String(a.name) < String(b.name) ? -1 : 1; });
    render();
  }

  function wire() {
    document.getElementById("ccAddCart").addEventListener("click", function () { cartForm(); });
    document.getElementById("ccAddItem").addEventListener("click", function () {
      if (!carts.length) { W.toast("Add a crash cart first", "bad"); return; }
      itemForm();
    });
    document.getElementById("ccCodeBlue").addEventListener("click", codeBlueForm);

    document.getElementById("ccTabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]");
      if (!b) return;
      tab = b.getAttribute("data-tab");
      render();
    });

    document.getElementById("ccPolicy").addEventListener("change", async function (e) {
      if (e.target.id !== "ccMonths") return;
      var next = E.normaliseMonths(e.target.value);
      try {
        settings = await S.adapter.put(SETTINGS,
          Object.assign({}, settings, { months: next })) || settings;
        settings.months = next;
        W.toast("Short expiry set to " + next + " months");
      } catch (err) { W.toast("Could not save that", "bad"); }
      render();
    });

    document.getElementById("ccPanel").addEventListener("click", function (e) {
      var ed = e.target.closest("[data-edit]");
      if (ed) {
        var it = items.filter(function (i) { return i.id === ed.getAttribute("data-edit"); })[0];
        if (it) itemForm(it);
        return;
      }
      var ai = e.target.closest("[data-additem]");
      if (ai) { itemForm(null, ai.getAttribute("data-additem")); return; }
      var ec = e.target.closest("[data-editcart]");
      if (ec) {
        var c = carts.filter(function (x) { return x.id === ec.getAttribute("data-editcart"); })[0];
        if (c) cartForm(c);
      }
    });

    /* One submit handler for all three forms: they live in the same modal and only one is
       ever open, so three listeners would be three chances to leak one. */
    document.getElementById("ccModal").addEventListener("submit", async function (e) {
      e.preventDefault();
      var f = e.target;
      try {
        if (f.id === "ccCartForm") await saveCart(f);
        else if (f.id === "ccItemForm") await saveItem(f);
        else if (f.id === "ccBlueForm") await saveCodeBlue(f);
      } catch (err) {
        W.toast("Could not save: " + (err && err.message || err), "bad");
        return;
      }
      close();
      await refresh();
    });

    document.getElementById("ccModal").addEventListener("click", async function (e) {
      if (e.target.id === "ccCancel") { close(); return; }
      if (e.target.id === "ccItemDel") {
        var f = document.getElementById("ccItemForm");
        var rid = f.getAttribute("data-id");
        if (rid && confirm("Delete this item from the cart?")) {
          await S.adapter.remove(ITEMS, rid); close(); await refresh();
        }
        return;
      }
      if (e.target.id === "ccCartDel") {
        var cf = document.getElementById("ccCartForm");
        var cid = cf.getAttribute("data-id");
        if (!cid) return;
        var n = items.filter(function (i) { return i.cart_id === cid; }).length;
        if (!confirm(n ? "Delete this cart and its " + n + " item" + (n === 1 ? "" : "s") + "?"
                       : "Delete this cart?")) return;
        await S.adapter.remove(CARTS, cid); close(); await refresh();
      }
    });
  }

  async function saveCart(f) {
    var fd = new FormData(f);
    var rid = f.getAttribute("data-id");
    var row = { id: rid || id("cart"),
                name: String(fd.get("name") || "").trim(),
                department: String(fd.get("department") || "").trim() || null };
    if (!row.name) throw new Error("a location is needed");
    await S.adapter.put(CARTS, row);
  }

  async function saveItem(f) {
    var fd = new FormData(f);
    var rid = f.getAttribute("data-id");
    var row = { id: rid || id("cci"),
                cart_id: fd.get("cart_id"),
                name: String(fd.get("name") || "").trim(),
                strength: String(fd.get("strength") || "").trim() || null,
                quantity: Math.max(0, Number(fd.get("quantity")) || 0),
                expires_on: String(fd.get("expires_on") || "").trim() || null,
                batch: String(fd.get("batch") || "").trim() || null };
    if (!row.name) throw new Error("an item name is needed");
    if (!row.expires_on) throw new Error("an expiry date is needed");
    await S.adapter.put(ITEMS, row);
  }

  /* The restock. Each ticked item has its expiry replaced with the new stock's date, and
     the event is logged with both dates — "why did this change" is a question an assessor
     asks, and the item row alone cannot answer it. */
  async function saveCodeBlue(f) {
    var fd = new FormData(f);
    var cartId = fd.get("cart_id");
    var box = document.getElementById("ccBlueItems");
    var used = [];

    var boxes = [].slice.call(box.querySelectorAll("[data-used]"));
    for (var n = 0; n < boxes.length; n++) {
      var cb = boxes[n];
      if (!cb.checked) continue;
      var key = cb.getAttribute("data-used");
      var it = items.filter(function (i) { return i.id === key; })[0];
      if (!it) continue;
      var newExp = box.querySelector('[data-newexp="' + key + '"]').value;
      var qty = Number(box.querySelector('[data-qty="' + key + '"]').value) || 0;
      if (!newExp) throw new Error("give the replacement expiry for " + it.name);
      used.push({ item_id: it.id, name: it.name, qty: qty,
                  old_expiry: it.expires_on, new_expiry: newExp });
    }
    if (!used.length) throw new Error("tick the items that were used");

    for (var u = 0; u < used.length; u++) {
      var t = items.filter(function (i) { return i.id === used[u].item_id; })[0];
      await S.adapter.put(ITEMS, Object.assign({}, t, { expires_on: used[u].new_expiry }));
    }
    await S.adapter.put(EVENTS, {
      id: id("cb"), cart_id: cartId,
      happened_on: fd.get("happened_on") || today(),
      items_used: used,
      notes: String(fd.get("notes") || "").trim() || null
    });
    W.toast(used.length + " item" + (used.length === 1 ? "" : "s") + " restocked");
  }

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("crashcart"); W.renderModeNotice();
    wire();
    await refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
