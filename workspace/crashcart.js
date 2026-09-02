/* AQcredix — Short expiry calendar: crash cart medicines.
 *
 * WHY A CRASH CART IS NOT AN EQUIPMENT REGISTER.
 * A defibrillator is calibrated and goes on being that defibrillator. An adrenaline ampoule
 * is CONSUMED — and the moment it is used, the thing that replaces it has a different expiry
 * and a different batch. A register that treats that as an unusual edit is wrong about the
 * normal case, because the normal case is a cart opened at three in the morning followed by
 * nobody updating a spreadsheet.
 *
 * ONE ROW PER BATCH.
 * Ten ampoules of adrenaline in a trolley are usually two deliveries with two printed dates.
 * Storing the item once forces somebody to choose which date to type, and the batch they did
 * not type is the one that expires unnoticed. So a row here is a BATCH, several rows sharing
 * a name are one item, and shortexpiry.js already judges each row separately — which is what
 * a pharmacist means by short expiry.
 *
 * OPENING A CART IS AN EVENT; A CODE BLUE IS ONE KIND OF IT.
 * Drills, monthly checks and broken seals open carts too. Filing them all under "code blue"
 * makes the count useless for the audit this register exists to survive.
 *
 * THE RESTOCK IS A STOCK ADJUSTMENT, NOT A NOTE.
 * What was used is decremented — the row disappears if the batch is finished — and the
 * replacement batch is added. So the register is always what is in the trolley now, and the
 * export never needs reconciling against the event log.
 */
(function () {
  "use strict";
  var S = window.AQStore, W = window.AQWorkspace, E = window.AQShortExpiry, esc;

  var CARTS = "crash_carts", ITEMS = "crash_cart_items";
  var SETTINGS = "crash_cart_settings", EVENTS = "code_blue_events";

  var carts = [], items = [], events = [], settings = { months: 3 }, tab = "action";

  function id(p) { return p + "_" + Math.random().toString(36).slice(2, 11); }
  /* IST, not the browser's own clock. The window is decided by which MONTH it is, so a
     laptop left on a foreign timezone — or simply on UTC — would put a hospital in Chennai a
     month out on the 1st. The rule is the same one the server uses, from the same module. */
  function today() { return E.todayIST(); }
  function months() { return E.normaliseMonths(settings && settings.months); }
  function review() { return E.review(carts, items, { today: today(), months: months() }); }
  function cartById(cid) { return carts.filter(function (c) { return c.id === cid; })[0]; }
  function itemsOf(cid) { return items.filter(function (i) { return i.cart_id === cid; }); }

  /* An "item" is a name plus a strength; its batches are the rows that share both. */
  function groupItems(list) {
    var g = {}, order = [];
    list.forEach(function (i) {
      var k = (i.name || "") + "|" + (i.strength || "");
      if (!g[k]) { g[k] = { key: k, name: i.name, strength: i.strength, batches: [] }; order.push(k); }
      g[k].batches.push(i);
    });
    order.sort();
    return order.map(function (k) {
      g[k].batches.sort(function (a, b) {
        return String(a.expires_on) < String(b.expires_on) ? -1 : 1;
      });
      g[k].total = g[k].batches.reduce(function (n, b) { return n + (Number(b.quantity) || 0); }, 0);
      return g[k];
    });
  }

  /* ---------------- rendering ---------------- */

  function stats(r) {
    function box(cls, n, label) {
      return '<div class="reg-stat' + (cls ? " " + cls : "") + '"><b>' + n +
             "</b><span>" + label + "</span></div>";
    }
    return '<div class="reg-stats">' +
      box(r.expired.length ? "bad" : "", r.expired.length, "Expired &mdash; remove now") +
      box(r.short.length ? "warn" : "ok", r.short.length, "Short expiry") +
      box("", items.length, "Batches tracked") +
      box("", carts.length, "Crash carts") + "</div>";
  }

  function flaggedRow(f) {
    var left = f.daysLeft < 0
      ? '<span class="tr-tag bad">Expired ' + Math.abs(f.daysLeft) + "d ago</span>"
      : '<span class="tr-tag ' + (f.state === "short" ? "warn" : "ok") + '">' +
        f.daysLeft + " days left</span>";
    return "<tr><td><b>" + esc(f.name) + "</b>" +
      (f.strength ? " " + esc(f.strength) : "") +
      (f.batch ? '<span class="tr-sub">batch ' + esc(f.batch) + "</span>" : "") + "</td>" +
      "<td>" + esc(f.cart) + "</td><td>" + esc(f.quantity) + "</td>" +
      "<td>" + esc(f.expiry) + "</td><td>" + left + "</td>" +
      '<td><button class="tr-edit" data-edit="' + esc(f.id) + '">Edit</button></td></tr>';
  }

  function flaggedTable(list) {
    if (!list.length) return "";
    return '<div class="ws-tablewrap"><table class="ws-table">' +
      "<tr><th>Item &amp; batch</th><th>Crash cart</th><th>Qty</th><th>Expires</th>" +
      "<th>&nbsp;</th><th>&nbsp;</th></tr>" + list.map(flaggedRow).join("") + "</table></div>";
  }

  function actionPanel(r) {
    if (r.empty) {
      return '<div class="ws-empty"><p>Nothing is expiring inside your ' + r.months +
        "-month window. Every batch in " + carts.length + " crash cart" +
        (carts.length === 1 ? "" : "s") + " is in date.</p></div>";
    }
    var out = "";
    if (r.expired.length) {
      out += '<div class="ev-summary none"><b>' + r.expired.length + " batch" +
        (r.expired.length === 1 ? " has" : "es have") + " already expired.</b> " +
        "Remove from the trolley now &mdash; this is not a reorder.</div>" +
        '<div class="ev-block"><h3>Expired</h3>' + flaggedTable(r.expired) + "</div>";
    }
    if (r.short.length) {
      out += '<div class="ev-block"><h3>Short expiry &mdash; within ' + r.months +
        ' months<span class="ev-count">' + r.short.length + "</span></h3>" +
        flaggedTable(r.short) + "</div>";
    }
    return out;
  }

  function monthPanel(r) {
    var groups = E.byMonth(r.all);
    if (!groups.length) return '<div class="ws-empty"><p>Nothing to show.</p></div>';
    return groups.map(function (g) {
      return '<div class="ev-block"><h3>' + esc(E.monthLabel(g.month)) +
        '<span class="ev-count">' + g.items.length + "</span></h3>" +
        flaggedTable(g.items) + "</div>";
    }).join("");
  }

  function cartPanel() {
    if (!carts.length) {
      return '<div class="ws-empty"><p>No crash carts yet. Add the first one &mdash; name it ' +
        "the way the ward does, so somebody can walk to it.</p></div>";
    }
    return carts.map(function (c) {
      var own = itemsOf(c.id);
      var groups = groupItems(own);
      var flagged = E.review([c], own, { today: today(), months: months() });
      var evs = events.filter(function (e) { return e.cart_id === c.id; });
      return '<div class="ev-block"><h3>' + esc(c.name) +
        (c.department ? " &middot; " + esc(c.department) : "") +
        (c.tag_number ? '<span class="cc-tag">Tag ' + esc(c.tag_number) + "</span>" : "") +
        '<span class="ev-count">' + groups.length + " item" + (groups.length === 1 ? "" : "s") +
        "</span>" +
        (flagged.all.length ? '<span class="ev-count">' + flagged.all.length +
          " need attention</span>" : "") +
        (evs.length ? '<span class="ev-count">' + evs.length + " opening" +
          (evs.length === 1 ? "" : "s") + "</span>" : "") + "</h3>" +
        '<div class="cc-cartactions">' +
          '<button class="btn btn-ghost btn-sm" data-additem="' + esc(c.id) + '">Add item</button> ' +
          '<button class="btn btn-ghost btn-sm" data-editcart="' + esc(c.id) + '">Edit cart</button>' +
        "</div>" +
        (groups.length
          ? '<div class="ws-tablewrap"><table class="ws-table">' +
            "<tr><th>Item</th><th>Batch</th><th>Qty</th><th>Expires</th><th>Status</th><th>&nbsp;</th></tr>" +
            groups.map(function (g) {
              return g.batches.map(function (i, n) {
                var c2 = E.classify(i, { today: today(), months: months() });
                var tag = c2.state === "expired" ? '<span class="tr-tag bad">Expired</span>'
                  : c2.state === "short" ? '<span class="tr-tag warn">Short</span>'
                  : c2.state === "unknown" ? '<span class="tr-tag">No date</span>'
                  : '<span class="tr-tag ok">In date</span>';
                return "<tr" + (n ? ' class="cc-batchrow"' : "") + "><td>" +
                  (n === 0 ? "<b>" + esc(g.name) + "</b>" +
                    (g.strength ? " " + esc(g.strength) : "") +
                    (g.batches.length > 1 ? '<span class="tr-sub">' + g.batches.length +
                      " batches &middot; " + g.total + " in cart</span>" : "")
                   : "") + "</td>" +
                  "<td>" + esc(i.batch || "—") + "</td>" +
                  "<td>" + esc(i.quantity) + "</td>" +
                  "<td>" + esc(i.expires_on || "—") + "</td><td>" + tag + "</td>" +
                  '<td><button class="tr-edit" data-edit="' + esc(i.id) + '">Edit</button></td></tr>';
              }).join("");
            }).join("") + "</table></div>"
          : '<p class="tr-hint">No items recorded in this cart yet.</p>') + "</div>";
    }).join("");
  }

  function openingsPanel() {
    if (!events.length) {
      return '<div class="ws-empty"><p>No cart has been recorded as opened yet.</p></div>';
    }
    return events.slice().sort(function (a, b) {
      return String(a.happened_on) < String(b.happened_on) ? 1 : -1;
    }).map(function (ev) {
      var c = cartById(ev.cart_id) || {};
      var used = Array.isArray(ev.items_used) ? ev.items_used : [];
      return '<div class="ev-block"><h3>' + esc(c.name || "Unknown cart") +
        '<span class="ev-count">' + esc(ev.happened_on) + "</span>" +
        '<span class="ev-count">' + (ev.reason === "other"
          ? esc(ev.other_reason || "Other") : "Code Blue") + "</span></h3>" +
        '<p class="tr-hint">Tag ' + esc(ev.tag_before || "—") + " &rarr; " +
        esc(ev.tag_after || "—") + "</p>" +
        (used.length
          ? '<div class="ws-tablewrap"><table class="ws-table">' +
            "<tr><th>Item</th><th>Batch used</th><th>Qty</th><th>Replaced with</th></tr>" +
            used.map(function (u) {
              return "<tr><td>" + esc(u.name || "") + "</td><td>" + esc(u.old_batch || "—") +
                "</td><td>" + esc(u.qty || 0) + "</td><td>" +
                (u.new_batch ? esc(u.new_batch) + " &middot; exp " + esc(u.new_expiry || "—") +
                  (u.new_qty ? " (" + esc(u.new_qty) + ")" : "") : "not replaced") +
                "</td></tr>";
            }).join("") + "</table></div>"
          : '<p class="tr-hint">Opened, nothing taken.</p>') +
        (ev.notes ? '<p class="tr-hint">' + esc(ev.notes) + "</p>" : "") + "</div>";
    }).join("");
  }

  function render() {
    var r = review();
    document.getElementById("ccStats").innerHTML = stats(r);
    document.getElementById("ccPolicy").innerHTML =
      '<label class="cc-policy">Short expiry protocol<select id="ccMonths">' +
        E.ALLOWED_MONTHS.map(function (m) {
          return '<option value="' + m + '"' + (m === r.months ? " selected" : "") + ">" +
                 m + " months</option>";
        }).join("") + "</select></label>" +
      '<span class="tr-hint">Every batch expiring in <b>' + esc(E.monthLabel(r.windowMonth)) +
      "</b> or earlier is flagged &mdash; the whole month, whatever the day printed on the " +
      "pack. Applies to every batch in every cart.</span>";

    document.getElementById("ccPanel").innerHTML =
        tab === "action" ? actionPanel(r)
      : tab === "month"  ? monthPanel(r)
      : tab === "open"   ? openingsPanel()
      : cartPanel();

    [].forEach.call(document.querySelectorAll("#ccTabs .cal-tab"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-tab") === tab);
    });
  }

  /* ---------------- modal plumbing ---------------- */

  function modal(html) {
    var m = document.getElementById("ccModal");
    m.innerHTML = '<div class="ws-modal-in">' + html + "</div>";
    m.classList.add("open");
    return m;
  }
  function close() { document.getElementById("ccModal").classList.remove("open"); }

  function cartOptions(sel) {
    return carts.map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (sel === c.id ? " selected" : "") + ">" +
             esc(c.name) + "</option>";
    }).join("");
  }

  /* ---------------- cart form ---------------- */

  function cartForm(cart) {
    var c = cart || {};
    modal("<h3>" + (cart ? "Edit crash cart" : "Add a crash cart") + "</h3>" +
      '<form id="ccCartForm" class="ws-form"' + (cart ? ' data-id="' + esc(c.id) + '"' : "") + ">" +
      '<div class="ws-f ws-f-wide"><label>Location *</label>' +
        '<input name="name" required value="' + esc(c.name || "") +
        '" placeholder="ICU bed 4, Casualty resus bay"></div>' +
      '<div class="ws-f"><label>Department</label><input name="department" value="' +
        esc(c.department || "") + '"></div>' +
      /* Optional on purpose: plenty of hospitals seal a cart and plenty do not, and a
         required field would have the ones that do not typing "NA" forever. */
      '<div class="ws-f"><label>Tag / seal number</label><input name="tag_number" value="' +
        esc(c.tag_number || "") + '" placeholder="leave blank if not used"></div>' +
      '<p class="tr-hint">Name it the way the ward says it out loud. Somebody reading the ' +
        "alert at 7am has to walk to this trolley.</p>" +
      '<div class="ws-modal-actions">' +
        (cart ? '<button type="button" class="btn btn-ghost" id="ccCartDel">Delete cart</button>' : "") +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Save</button></div></form>');
  }

  /* ---------------- item form, with batches ---------------- */

  function batchFields(n, b) {
    b = b || {};
    return '<div class="cc-batch" data-batch>' +
      '<span class="cc-batch-n">Batch ' + n + "</span>" +
      '<div class="ws-f"><label>Batch number</label><input data-b="batch" value="' +
        esc(b.batch || "") + '"></div>' +
      '<div class="ws-f"><label>Quantity *</label><input data-b="quantity" type="number" ' +
        'min="0" required value="' + esc(b.quantity == null ? 1 : b.quantity) + '"></div>' +
      '<div class="ws-f"><label>Expiry *</label><input data-b="expires_on" type="date" ' +
        'required value="' + esc(b.expires_on || "") + '"></div>' +
      (n > 1 ? '<button type="button" class="cc-batch-x" data-rmbatch>Remove</button>' : "") +
      "</div>";
  }

  function itemForm(item, cartId) {
    var i = item || {};
    /* Editing touches ONE batch row. Adding offers as many as the pharmacist has in hand,
       because a delivery arrives as several batches and closing the dialog between each is
       the difference between a five-minute job and a half-hour one. */
    modal("<h3>" + (item ? "Edit batch" : "Add an item") + "</h3>" +
      '<form id="ccItemForm" class="ws-form"' + (item ? ' data-id="' + esc(i.id) + '"' : "") + ">" +
      '<div class="ws-f ws-f-wide"><label>Crash cart *</label><select name="cart_id" required>' +
        cartOptions(i.cart_id || cartId) + "</select></div>" +
      '<div class="ws-f ws-f-wide"><label>Item *</label><input name="name" required value="' +
        esc(i.name || "") + '" placeholder="Adrenaline"></div>' +
      '<div class="ws-f ws-f-wide"><label>Strength / form</label><input name="strength" value="' +
        esc(i.strength || "") + '" placeholder="1mg/ml ampoule"></div>' +
      '<div id="ccBatches">' + batchFields(1, item ? i : null) + "</div>" +
      (item ? "" : '<button type="button" class="btn btn-ghost btn-sm" id="ccAddBatch">' +
                   "+ Add another batch</button>") +
      '<p class="tr-hint">One item, one strength, and a row for each batch you hold. ' +
        "If the pack shows only a month, use the LAST day of it &mdash; stock printed " +
        "11/2026 is usable to 30 November.</p>" +
      '<p class="cc-added" id="ccAdded" hidden></p>' +
      '<div class="ws-modal-actions">' +
        (item ? '<button type="button" class="btn btn-ghost" id="ccItemDel">Delete batch</button>' : "") +
        (item ? "" : '<button type="submit" class="btn btn-ghost" id="ccItemAgain">' +
                     "Save &amp; add another item</button>") +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Save</button></div></form>');

    var box = document.getElementById("ccBatches");
    var add = document.getElementById("ccAddBatch");
    if (add) {
      add.addEventListener("click", function () {
        var n = box.querySelectorAll("[data-batch]").length + 1;
        box.insertAdjacentHTML("beforeend", batchFields(n));
        var last = box.lastElementChild;
        last.querySelector('[data-b="batch"]').focus();
      });
    }
    box.addEventListener("click", function (e) {
      if (!e.target.closest("[data-rmbatch]")) return;
      e.target.closest("[data-batch]").remove();
      [].forEach.call(box.querySelectorAll(".cc-batch-n"), function (el, n) {
        el.textContent = "Batch " + (n + 1);
      });
    });
  }


  /* ============ copying an item list from one cart to another ============
   *
   * WHY THIS EXISTS. Every crash cart in a hospital holds the SAME list of drugs — that is
   * the point of a crash cart. What differs between the trolley in Deluxe Ward and the one in
   * Tag Ward is the batch numbers and the expiry dates, not the contents. Typing thirty drug
   * names and quantities again for each ward is the single longest job in this module, and
   * every retype is a chance to leave a drug out of one trolley.
   *
   * WHAT IS COPIED, AND WHAT IS NOT. The item, its strength, and the QUANTITY — and quantity
   * is the total held for that drug, added up across however many batches it happens to be
   * split into. Two ampoules of adrenaline in one batch and two in two batches are both
   * "two adrenaline"; the split is an accident of delivery, not part of the cart's design.
   * Batch and expiry are deliberately NOT copied. They are the two things that genuinely
   * differ, and carrying them over would put a wrong expiry into a crash cart, which is the
   * worst outcome this whole module exists to prevent. They are typed here, once per row.
   */
  function cartsWithItems(exceptId) {
    return carts.filter(function (c) {
      return c.id !== exceptId && itemsOf(c.id).length;
    }).sort(function (a, b) { return itemsOf(b.id).length - itemsOf(a.id).length; });
  }

  /* The offer. Raised when a cart is empty and another one is not — which is exactly the
     moment someone is about to retype a list that already exists. It is a choice, never an
     action: nothing is written until the next form is filled in and saved. */
  function offerCopy(targetId) {
    var target = cartById(targetId);
    var sources = cartsWithItems(targetId);
    if (!target || !sources.length) { itemForm(null, targetId); return; }
    var src = sources[0];
    var n = groupItems(itemsOf(src.id)).length;

    modal("<h3>Copy the list from " + esc(src.name) + "?</h3>" +
      '<p class="tr-hint">' + esc(src.name) + " already has <b>" + n + " item" +
        (n === 1 ? "" : "s") + "</b> on it, and " + esc(target.name) +
        " has none yet. Crash carts normally carry the same drugs in the same quantities, so " +
        "the list can be brought across and you fill in only the batch and expiry for " +
        esc(target.name) + ".</p>" +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="ccCopyNo" data-target="' +
          esc(targetId) + '">Type it myself</button>' +
        '<button type="button" class="btn btn-accent" id="ccCopyYes" data-src="' + esc(src.id) +
          '" data-target="' + esc(targetId) + '">Copy the list</button></div>');
  }

  function copyRow(g, n) {
    return '<div class="cc-batch" data-copyrow>' +
      '<span class="cc-batch-n">' + n + "</span>" +
      '<label class="cc-copy-take"><input type="checkbox" data-c="take" checked> Include</label>' +
      '<div class="ws-f"><label>Item</label><input data-c="name" readonly value="' +
        esc(g.name || "") + '"></div>' +
      '<div class="ws-f"><label>Strength / form</label><input data-c="strength" readonly value="' +
        esc(g.strength || "") + '"></div>' +
      '<div class="ws-f"><label>Quantity *</label><input data-c="quantity" type="number" min="0" ' +
        'required value="' + esc(g.total) + '"></div>' +
      '<div class="ws-f"><label>Batch number</label><input data-c="batch" value=""></div>' +
      '<div class="ws-f"><label>Expiry *</label><input data-c="expires_on" type="date" required ' +
        'value=""></div>' +
      "</div>";
  }

  function copyForm(targetId, sourceId) {
    var target = cartById(targetId);
    var groups = groupItems(itemsOf(sourceId));
    if (!target || !groups.length) { itemForm(null, targetId); return; }

    modal("<h3>Copy " + groups.length + " item" + (groups.length === 1 ? "" : "s") +
        " into " + esc(target.name) + "</h3>" +
      '<form id="ccCopyForm" class="ws-form" data-target="' + esc(targetId) + '">' +
      '<div class="ws-f ws-f-wide"><label>Copy from</label><select name="source_id">' +
        cartsWithItems(targetId).map(function (c) {
          return '<option value="' + esc(c.id) + '"' + (c.id === sourceId ? " selected" : "") +
                 ">" + esc(c.name) + " (" + groupItems(itemsOf(c.id)).length + " items)</option>";
        }).join("") + "</select></div>" +

      /* One expiry, applied down the column. A delivery usually lands as one batch with one
         expiry, so typing it thirty times is thirty chances to fat-finger a year. It only
         ever FILLS the rows — each one stays editable, because a cart restocked twice will
         genuinely hold two expiries. */
      '<div class="ws-f ws-f-wide cc-copy-all"><label>Set every expiry to</label>' +
        '<input type="date" id="ccCopyAllExp">' +
        '<button type="button" class="btn btn-ghost btn-sm" id="ccCopyApply">Apply to all</button>' +
        '<input type="text" id="ccCopyAllBatch" placeholder="and batch (optional)">' +
        "</div>" +

      '<div id="ccCopyRows">' +
        groups.map(function (g, i) { return copyRow(g, i + 1); }).join("") + "</div>" +

      '<p class="tr-hint">Names and quantities come from ' +
        esc((cartById(sourceId) || {}).name || "the other cart") +
        ". Batch and expiry are left blank on purpose &mdash; they are what differs between " +
        "trolleys, and copying them across would put a wrong expiry into a crash cart. " +
        "Untick anything this cart does not carry.</p>" +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Add to ' + esc(target.name) +
        "</button></div></form>");

    document.getElementById("ccCopyApply").addEventListener("click", function () {
      var d = document.getElementById("ccCopyAllExp").value;
      var b = document.getElementById("ccCopyAllBatch").value;
      [].forEach.call(document.querySelectorAll("#ccCopyRows [data-copyrow]"), function (row) {
        if (!row.querySelector('[data-c="take"]').checked) return;
        if (d) row.querySelector('[data-c="expires_on"]').value = d;
        if (b) row.querySelector('[data-c="batch"]').value = b;
      });
    });

    document.querySelector('#ccCopyForm [name="source_id"]')
      .addEventListener("change", function (e) { copyForm(targetId, e.target.value); });
  }

  async function saveCopied(f) {
    var targetId = f.getAttribute("data-target");
    var rows = [].slice.call(f.querySelectorAll("[data-copyrow]")).filter(function (r) {
      return r.querySelector('[data-c="take"]').checked;
    });
    if (!rows.length) throw new Error("nothing was ticked");

    /* Validated BEFORE anything is written. A half-copied list is worse than none: the cart
       would look stocked while missing whatever came after the bad row. */
    rows.forEach(function (r) {
      if (!r.querySelector('[data-c="expires_on"]').value) {
        throw new Error("every item needs an expiry — use the “Set every expiry to” box if they share one");
      }
    });

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      await S.adapter.put(ITEMS, {
        id: id("cci"),
        cart_id: targetId,
        name: String(r.querySelector('[data-c="name"]').value || "").trim(),
        strength: String(r.querySelector('[data-c="strength"]').value || "").trim() || null,
        batch: String(r.querySelector('[data-c="batch"]').value || "").trim() || null,
        quantity: Math.max(0, Number(r.querySelector('[data-c="quantity"]').value) || 0),
        expires_on: r.querySelector('[data-c="expires_on"]').value
      });
    }
    W.toast(rows.length + " item" + (rows.length === 1 ? "" : "s") + " copied across");
  }


  /* ============ the receipt that proves the alerting works ============
   *
   * A weekly alert is a PROMISE. Somebody typing thirty ampoules into a trolley register has
   * no way to tell a working alert from a broken one until a Monday arrives and something
   * happens to be expiring — which, in a well-run hospital, may be months away. Until then
   * the feature is indistinguishable from one that is quietly dead, and nobody trusts it.
   *
   * So the moment stock goes in, the server mails a receipt to the address that entered it:
   * what is short right now, or that nothing is, plus the window the policy puts them in.
   * It is the only moment the hospital can check the claim against something they know.
   *
   * ONE MAIL PER SITTING, NOT PER ROW. "Save and add another" is the normal way a delivery is
   * entered, so firing on each save would send thirty mails for one afternoon's work and
   * teach the hospital to filter us. The timer is reset by every save and only fires once the
   * typing has actually stopped, which is also the moment the register is worth reporting. */
  var receiptTimer = null;

  function scheduleReceipt() {
    if (receiptTimer) clearTimeout(receiptTimer);
    receiptTimer = setTimeout(sendReceipt, 6000);
  }

  async function sendReceipt() {
    receiptTimer = null;
    /* Only where there is a server and a signed-in session to prove who is asking. On the
       local adapter there is no account and no address to send to, and that is not a failure
       worth reporting to anyone. */
    if (!S.isConfigured || !S.isConfigured()) return;
    var token = null;
    try {
      var sess = JSON.parse(localStorage.getItem("aq-sb-session") || "null");
      token = sess && sess.access_token;
    } catch (e) { /* no session */ }
    if (!token) return;

    try {
      var r = await fetch("/api/digest?scope=entry", {
        method: "POST",
        headers: { Authorization: "Bearer " + token }
      });
      var j = await r.json().catch(function () { return {}; });
      /* Said out loud, because the whole point is that the hospital can SEE it happen. A
         silent success here would be the same unverifiable promise this exists to replace. */
      if (j && j.ok) {
        W.toast("Emailed you a summary of what is short" +
          (j.short || j.expired ? "" : " — nothing is, in this data"));
      } else if (j && j.configured === false) {
        W.toast("Saved. Email alerts are not switched on for this site yet", "bad");
      }
    } catch (e) { /* the save already succeeded; a failed receipt must never undo it */ }
  }

  /* ---------------- "was the crash cart opened?" ---------------- */

  function usedItemBlock(n, cartId) {
    var groups = groupItems(itemsOf(cartId));
    return '<div class="cc-used-item" data-useditem>' +
      '<div class="cc-used-head"><b>Item ' + n + "</b>" +
        (n > 1 ? '<button type="button" class="cc-batch-x" data-rmitem>Remove</button>' : "") +
      "</div>" +
      '<div class="ws-f ws-f-wide"><label>Item used *</label>' +
        '<select data-u="key" required><option value="">Choose an item&hellip;</option>' +
        groups.map(function (g) {
          return '<option value="' + esc(g.key) + '">' + esc(g.name) +
                 (g.strength ? " " + esc(g.strength) : "") +
                 " &mdash; " + g.total + " in cart</option>";
        }).join("") + "</select></div>" +
      '<div class="cc-stockshow" data-stock hidden></div>' +
      '<div class="cc-usedbatches" data-usedbatches></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-addusedbatch hidden>' +
        "+ Another batch of this item</button>" +
      '<div class="cc-repl" data-repl hidden>' +
        '<div class="cc-repl-head">Replaced with</div>' +
        '<div class="cc-replbatches" data-replbatches></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-addreplbatch>' +
          "+ Another replacement batch</button>" +
      "</div></div>";
  }

  function usedBatchRow(g) {
    return '<div class="cc-usedrow" data-usedrow>' +
      '<div class="ws-f"><label>Batch used *</label><select data-u="batch" required>' +
        '<option value="">Choose&hellip;</option>' +
        g.batches.map(function (b) {
          return '<option value="' + esc(b.id) + '">' + esc(b.batch || "no batch number") +
                 " &middot; exp " + esc(b.expires_on) + " &middot; " + b.quantity +
                 " in cart</option>";
        }).join("") + "</select></div>" +
      '<div class="ws-f"><label>Quantity used *</label>' +
        '<input data-u="qty" type="number" min="1" value="1" required></div>' +
      '<button type="button" class="cc-batch-x" data-rmusedrow>Remove</button></div>';
  }

  function replBatchRow() {
    return '<div class="cc-usedrow" data-replrow>' +
      '<div class="ws-f"><label>New batch</label><input data-r="batch"></div>' +
      '<div class="ws-f"><label>Quantity *</label>' +
        '<input data-r="qty" type="number" min="1" value="1" required></div>' +
      '<div class="ws-f"><label>New expiry *</label>' +
        '<input data-r="expiry" type="date" required></div>' +
      '<button type="button" class="cc-batch-x" data-rmreplrow>Remove</button></div>';
  }

  function openedForm() {
    if (!carts.length) { W.toast("Add a crash cart first", "bad"); return; }
    modal("<h3>Was the crash cart opened?</h3>" +
      '<p class="tr-hint">Recording it here adjusts the stock: what was taken comes off, ' +
        "what replaced it goes on with its own batch and expiry. The register then stays " +
        "what is actually in the trolley.</p>" +
      '<form id="ccOpenForm" class="ws-form">' +
      '<div class="ws-f"><label>Date opened *</label>' +
        '<input name="happened_on" type="date" required value="' + today() + '"></div>' +
      '<div class="ws-f"><label>Which crash cart *</label>' +
        '<select name="cart_id" required id="ccOpenCart">' + cartOptions() + "</select></div>" +
      '<p class="cc-tagline" id="ccTagLine"></p>' +
      '<div class="ws-f ws-f-wide"><label>Reason for opening *</label>' +
        '<select name="reason" required id="ccReason">' +
          '<option value="code_blue">Code Blue event</option>' +
          '<option value="other">Other</option></select></div>' +
      '<div class="ws-f ws-f-wide" id="ccOtherWrap" hidden><label>What was the reason? *</label>' +
        '<input name="other_reason" placeholder="Mock drill, monthly check, seal found broken"></div>' +
      '<div class="ws-f ws-f-wide" id="ccUsedWrap" hidden><label>Was anything used? *</label>' +
        '<select name="items_used_flag"><option value="yes">Yes</option>' +
        '<option value="no">No — opened, nothing taken</option></select></div>' +

      '<div id="ccUsedSection">' +
        '<div class="cc-section">Items used</div>' +
        '<div id="ccUsedItems"></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="ccAddUsedItem">' +
          "+ Add another item</button>" +
      "</div>" +

      '<div class="ws-f"><label>Tag / seal broken</label>' +
        '<input name="tag_before" id="ccTagBefore" placeholder="the seal you cut"></div>' +
      '<div class="ws-f"><label>New tag / seal applied</label>' +
        '<input name="tag_after" placeholder="the seal on closing"></div>' +
      '<div class="ws-f ws-f-wide"><label>Notes</label>' +
        '<textarea name="notes" rows="2"></textarea></div>' +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Record and restock</button>' +
      "</div></form>");

    var cartSel = document.getElementById("ccOpenCart");
    var reason = document.getElementById("ccReason");
    var otherWrap = document.getElementById("ccOtherWrap");
    var usedWrap = document.getElementById("ccUsedWrap");
    var usedSection = document.getElementById("ccUsedSection");
    var usedItems = document.getElementById("ccUsedItems");

    function showTag() {
      var c = cartById(cartSel.value) || {};
      document.getElementById("ccTagLine").innerHTML = c.tag_number
        ? "Current tag on this cart: <b>" + esc(c.tag_number) + "</b>"
        : '<span class="cc-tagline-none">No tag recorded for this cart.</span>';
      /* Pre-filled, because the seal being broken is almost always the one on the cart —
         and a field that is right by default is one nobody mistypes. */
      var tb = document.getElementById("ccTagBefore");
      if (tb && !tb.dataset.touched) tb.value = c.tag_number || "";
      usedItems.innerHTML = "";
      addUsedItem();
    }
    function addUsedItem() {
      var n = usedItems.querySelectorAll("[data-useditem]").length + 1;
      usedItems.insertAdjacentHTML("beforeend", usedItemBlock(n, cartSel.value));
    }
    function syncReason() {
      var other = reason.value === "other";
      otherWrap.hidden = !other;
      usedWrap.hidden = !other;
      otherWrap.querySelector("input").required = other;
      var anyUsed = !other || usedWrap.querySelector("select").value === "yes";
      usedSection.hidden = !anyUsed;
    }
    cartSel.addEventListener("change", showTag);
    reason.addEventListener("change", syncReason);
    usedWrap.querySelector("select").addEventListener("change", syncReason);
    document.getElementById("ccTagBefore").addEventListener("input", function () {
      this.dataset.touched = "1";
    });
    document.getElementById("ccAddUsedItem").addEventListener("click", addUsedItem);

    /* One delegated listener for the whole repeating structure. Binding per row would leak
       a listener every time somebody added and removed a batch. */
    usedItems.addEventListener("change", function (e) {
      var sel = e.target.closest('[data-u="key"]');
      if (!sel) return;
      var block = sel.closest("[data-useditem]");
      var g = groupItems(itemsOf(cartSel.value)).filter(function (x) {
        return x.key === sel.value;
      })[0];
      var stock = block.querySelector("[data-stock]");
      var ub = block.querySelector("[data-usedbatches]");
      var addUB = block.querySelector("[data-addusedbatch]");
      var repl = block.querySelector("[data-repl]");
      if (!g) { stock.hidden = true; ub.innerHTML = ""; addUB.hidden = true; repl.hidden = true; return; }

      /* What is in the trolley right now, shown BEFORE anything is chosen — the question a
         nurse is answering is "which of these did we use", and they cannot answer it from
         a dropdown they have to open to read. */
      stock.hidden = false;
      stock.innerHTML = "<b>In the cart now:</b><ul>" + g.batches.map(function (b) {
        var c2 = E.classify(b, { today: today(), months: months() });
        return "<li>" + esc(b.batch || "no batch number") + " &middot; " + b.quantity +
               " &middot; expires " + esc(b.expires_on) +
               (c2.state === "expired" ? ' <span class="tr-tag bad">expired</span>'
                : c2.state === "short" ? ' <span class="tr-tag warn">short</span>' : "") +
               "</li>";
      }).join("") + "</ul>";
      ub.innerHTML = usedBatchRow(g);
      addUB.hidden = false;
      repl.hidden = false;
      if (!repl.querySelector("[data-replrow]")) {
        repl.querySelector("[data-replbatches]").innerHTML = replBatchRow();
      }
    });

    usedItems.addEventListener("click", function (e) {
      var block = e.target.closest("[data-useditem]");
      if (e.target.closest("[data-rmitem]")) { block.remove(); return; }
      if (e.target.closest("[data-addusedbatch]")) {
        var sel = block.querySelector('[data-u="key"]');
        var g = groupItems(itemsOf(cartSel.value)).filter(function (x) { return x.key === sel.value; })[0];
        if (g) block.querySelector("[data-usedbatches]").insertAdjacentHTML("beforeend", usedBatchRow(g));
        return;
      }
      if (e.target.closest("[data-rmusedrow]")) { e.target.closest("[data-usedrow]").remove(); return; }
      if (e.target.closest("[data-addreplbatch]")) {
        block.querySelector("[data-replbatches]").insertAdjacentHTML("beforeend", replBatchRow());
        return;
      }
      if (e.target.closest("[data-rmreplrow]")) { e.target.closest("[data-replrow]").remove(); }
    });

    showTag();
    syncReason();
  }

  /* ---------------- download ---------------- */

  function downloadForm() {
    if (!carts.length) { W.toast("There is nothing to download yet", "bad"); return; }
    modal("<h3>Download the crash cart register</h3>" +
      '<p class="tr-hint">An Excel workbook. Each cart gets a sheet of its own contents, ' +
        "followed by a sheet of every time it was opened and what changed.</p>" +
      '<form id="ccDlForm" class="ws-form">' +
      '<div class="ws-f ws-f-wide"><label>Which carts?</label>' +
        '<label class="tm-check"><input type="radio" name="scope" value="all" checked> ' +
          "All " + carts.length + " crash cart" + (carts.length === 1 ? "" : "s") + "</label>" +
        '<label class="tm-check"><input type="radio" name="scope" value="some"> ' +
          "Choose which ones</label></div>" +
      '<div class="tm-modgrid" id="ccDlPick" hidden>' +
        carts.map(function (c) {
          return '<label class="tm-check"><input type="checkbox" data-cart="' + esc(c.id) +
                 '"> ' + esc(c.name) + "</label>";
        }).join("") + "</div>" +
      '<div class="ws-modal-actions">' +
        '<button type="button" class="btn btn-ghost" id="ccCancel">Cancel</button>' +
        '<button class="btn btn-accent" type="submit">Download</button></div></form>');

    var pick = document.getElementById("ccDlPick");
    [].forEach.call(document.querySelectorAll('#ccDlForm [name="scope"]'), function (r) {
      r.addEventListener("change", function () { pick.hidden = r.value !== "some" || !r.checked; });
    });
  }

  /* ---------------- saving ---------------- */

  async function refresh() {
    try {
      carts = (await S.adapter.list(CARTS)) || [];
      items = (await S.adapter.list(ITEMS)) || [];
      events = (await S.adapter.list(EVENTS)) || [];
      var s = (await S.adapter.list(SETTINGS)) || [];
      settings = s[0] || { months: 3 };
    } catch (e) { /* keep whatever we had rather than blanking the screen */ }
    carts.sort(function (a, b) { return String(a.name) < String(b.name) ? -1 : 1; });
    render();
  }

  async function saveCart(f) {
    var fd = new FormData(f);
    var rid = f.getAttribute("data-id");
    var row = { id: rid || id("cart"),
                name: String(fd.get("name") || "").trim(),
                department: String(fd.get("department") || "").trim() || null,
                tag_number: String(fd.get("tag_number") || "").trim() || null };
    if (!row.name) throw new Error("a location is needed");
    await S.adapter.put(CARTS, row);
  }

  async function saveItem(f) {
    var fd = new FormData(f);
    var rid = f.getAttribute("data-id");
    var name = String(fd.get("name") || "").trim();
    var strength = String(fd.get("strength") || "").trim() || null;
    var cartId = fd.get("cart_id");
    if (!name) throw new Error("an item name is needed");

    var rows = [].slice.call(f.querySelectorAll("[data-batch]"));
    if (!rows.length) throw new Error("at least one batch is needed");
    for (var n = 0; n < rows.length; n++) {
      var b = rows[n];
      var expiry = b.querySelector('[data-b="expires_on"]').value;
      if (!expiry) throw new Error("every batch needs an expiry date");
      await S.adapter.put(ITEMS, {
        id: rid && rows.length === 1 ? rid : id("cci"),
        cart_id: cartId, name: name, strength: strength,
        batch: String(b.querySelector('[data-b="batch"]').value || "").trim() || null,
        quantity: Math.max(0, Number(b.querySelector('[data-b="quantity"]').value) || 0),
        expires_on: expiry
      });
    }
  }

  /* THE STOCK ADJUSTMENT.
     Used quantity comes off the batch it came from; a batch reduced to nothing is removed
     rather than left as a zero row, because a zero row is stock that reads as present. The
     replacement is added as its own batch, merged if that exact batch and expiry is already
     in the cart — two deliveries of the same batch are one batch. */
  async function saveOpened(f) {
    var fd = new FormData(f);
    var cartId = fd.get("cart_id");
    var cart = cartById(cartId) || {};
    var reason = fd.get("reason");
    var anyUsed = reason !== "other" || fd.get("items_used_flag") === "yes";

    var used = [];
    if (anyUsed) {
      var blocks = [].slice.call(f.querySelectorAll("[data-useditem]"));
      for (var n = 0; n < blocks.length; n++) {
        var block = blocks[n];
        var key = block.querySelector('[data-u="key"]').value;
        if (!key) continue;
        var g = groupItems(itemsOf(cartId)).filter(function (x) { return x.key === key; })[0];
        if (!g) continue;

        var repls = [].slice.call(block.querySelectorAll("[data-replrow]")).map(function (r) {
          return { batch: String(r.querySelector('[data-r="batch"]').value || "").trim() || null,
                   qty: Math.max(0, Number(r.querySelector('[data-r="qty"]').value) || 0),
                   expiry: r.querySelector('[data-r="expiry"]').value };
        }).filter(function (r) { return r.expiry; });

        var rows = [].slice.call(block.querySelectorAll("[data-usedrow]"));
        for (var k = 0; k < rows.length; k++) {
          var batchId = rows[k].querySelector('[data-u="batch"]').value;
          var qty = Math.max(0, Number(rows[k].querySelector('[data-u="qty"]').value) || 0);
          if (!batchId || !qty) continue;
          var src = items.filter(function (i) { return i.id === batchId; })[0];
          if (!src) continue;
          if (qty > (Number(src.quantity) || 0)) {
            throw new Error("only " + src.quantity + " of batch " +
                            (src.batch || "that item") + " are in the cart");
          }
          var left = (Number(src.quantity) || 0) - qty;
          if (left > 0) await S.adapter.put(ITEMS, Object.assign({}, src, { quantity: left }));
          else await S.adapter.remove(ITEMS, src.id);

          var r0 = repls[k] || repls[0] || null;
          used.push({ item_id: src.id, name: (g.name || "") + (g.strength ? " " + g.strength : ""),
                      qty: qty, old_batch: src.batch, old_expiry: src.expires_on,
                      new_batch: r0 && r0.batch, new_expiry: r0 && r0.expiry,
                      new_qty: r0 && r0.qty });
        }

        for (var r = 0; r < repls.length; r++) {
          var rep = repls[r];
          if (!rep.qty) continue;
          var same = itemsOf(cartId).filter(function (i) {
            return i.name === g.name && (i.strength || null) === (g.strength || null) &&
                   (i.batch || null) === rep.batch && i.expires_on === rep.expiry;
          })[0];
          if (same) {
            await S.adapter.put(ITEMS, Object.assign({}, same,
              { quantity: (Number(same.quantity) || 0) + rep.qty }));
          } else {
            await S.adapter.put(ITEMS, { id: id("cci"), cart_id: cartId, name: g.name,
              strength: g.strength || null, batch: rep.batch, quantity: rep.qty,
              expires_on: rep.expiry });
          }
        }
      }
      if (!used.length) throw new Error("choose what was used, or set 'Was anything used' to No");
    }

    var tagAfter = String(fd.get("tag_after") || "").trim() || null;
    await S.adapter.put(EVENTS, {
      id: id("cb"), cart_id: cartId,
      happened_on: fd.get("happened_on") || today(),
      reason: reason,
      other_reason: reason === "other" ? String(fd.get("other_reason") || "").trim() || null : null,
      items_used_flag: anyUsed,
      items_used: used,
      tag_before: String(fd.get("tag_before") || "").trim() || null,
      tag_after: tagAfter,
      notes: String(fd.get("notes") || "").trim() || null
    });
    /* The new seal becomes the cart's tag, so the register shows the seal that is on it. */
    if (tagAfter) await S.adapter.put(CARTS, Object.assign({}, cart, { tag_number: tagAfter }));

    W.toast(anyUsed ? used.length + " batch" + (used.length === 1 ? "" : "es") + " adjusted"
                    : "Opening recorded");
  }

  async function doDownload(f) {
    var scope = f.querySelector('[name="scope"]:checked').value;
    var chosen = carts;
    if (scope === "some") {
      var ids = [].slice.call(f.querySelectorAll("[data-cart]:checked"))
                  .map(function (c) { return c.getAttribute("data-cart"); });
      if (!ids.length) throw new Error("choose at least one crash cart");
      chosen = carts.filter(function (c) { return ids.indexOf(c.id) > -1; });
    }
    var name = await window.AQCrashCartExcel.download(chosen, items, events,
      { today: today(), months: months() });
    W.toast("Downloaded " + name);
  }

  /* ---------------- wiring ---------------- */

  function wire() {
    document.getElementById("ccAddCart").addEventListener("click", function () { cartForm(); });
    document.getElementById("ccAddItem").addEventListener("click", function () {
      if (!carts.length) { W.toast("Add a crash cart first", "bad"); return; }
      itemForm();
    });
    document.getElementById("ccCodeBlue").addEventListener("click", openedForm);
    document.getElementById("ccDownload").addEventListener("click", downloadForm);

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
      if (ai) {
        /* An empty cart beside a stocked one is the moment the list is about to be retyped.
           Offer to bring it across instead; itemForm() is still one click away. */
        var tid = ai.getAttribute("data-additem");
        if (!itemsOf(tid).length && cartsWithItems(tid).length) offerCopy(tid);
        else itemForm(null, tid);
        return;
      }
      var ec = e.target.closest("[data-editcart]");
      if (ec) {
        var c = cartById(ec.getAttribute("data-editcart"));
        if (c) cartForm(c);
      }
    });

    var addedThisSitting = 0;

    document.getElementById("ccModal").addEventListener("submit", async function (e) {
      e.preventDefault();
      var f = e.target;
      var again = (e.submitter && e.submitter.id === "ccItemAgain");
      try {
        if (f.id === "ccCartForm") await saveCart(f);
        else if (f.id === "ccItemForm") { await saveItem(f); scheduleReceipt(); }
        else if (f.id === "ccOpenForm") { await saveOpened(f); scheduleReceipt(); }
        else if (f.id === "ccCopyForm") { await saveCopied(f); scheduleReceipt(); }
        else if (f.id === "ccDlForm") { await doDownload(f); close(); return; }
      } catch (err) {
        W.toast("Could not save: " + (err && err.message || err), "bad");
        return;
      }

      if (again && f.id === "ccItemForm") {
        addedThisSitting++;
        var cartSel = f.querySelector('[name="cart_id"]');
        var cartName = cartSel.options[cartSel.selectedIndex].textContent;
        f.querySelector('[name="name"]').value = "";
        f.querySelector('[name="strength"]').value = "";
        document.getElementById("ccBatches").innerHTML = batchFields(1);
        var note = document.getElementById("ccAdded");
        note.hidden = false;
        note.textContent = addedThisSitting + " item" + (addedThisSitting === 1 ? "" : "s") +
          " added to " + cartName + ". Add the next one, or press Cancel when the cart is done.";
        await refresh();
        f.querySelector('[name="name"]').focus();
        return;
      }

      addedThisSitting = 0;
      close();
      await refresh();
    });

    document.getElementById("ccModal").addEventListener("click", async function (e) {
      if (e.target === e.currentTarget) { close(); return; }
      if (e.target.id === "ccCancel") { close(); return; }
      if (e.target.id === "ccCopyNo") {
        itemForm(null, e.target.getAttribute("data-target"));
        return;
      }
      if (e.target.id === "ccCopyYes") {
        copyForm(e.target.getAttribute("data-target"), e.target.getAttribute("data-src"));
        return;
      }
      if (e.target.id === "ccItemDel") {
        var f = document.getElementById("ccItemForm");
        var rid = f.getAttribute("data-id");
        if (rid && confirm("Delete this batch from the cart?")) {
          await S.adapter.remove(ITEMS, rid); scheduleReceipt(); close(); await refresh();
        }
        return;
      }
      if (e.target.id === "ccCartDel") {
        var cf = document.getElementById("ccCartForm");
        var cid = cf.getAttribute("data-id");
        if (!cid) return;
        var n = itemsOf(cid).length;
        if (!confirm(n ? "Delete this cart and its " + n + " batch" + (n === 1 ? "" : "es") + "?"
                       : "Delete this cart?")) return;
        await S.adapter.remove(CARTS, cid); close(); await refresh();
      }
    });
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
