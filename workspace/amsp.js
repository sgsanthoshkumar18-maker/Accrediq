/* AQcredix — high-end antimicrobial tracker.
 *
 * Two tools sharing one drug catalogue:
 *   1. Track monthly usage of a high-end drug (vials, combinations, patients
 *      received, cultures sent, justification forms).
 *   2. Calculate Defined Daily Dose (DDD) per 1000 patient days from the WHO
 *      DDD reference and this month's dispensing figures.
 *
 * Both flows are the same shape: pick a drug from the antibiotic / antifungal
 * catalogue, fill in the form for a specific month, save. The chart on the drug
 * page then plots one point per month the auditor has entered, so the trend is
 * visible after the second month and grows every month after that. Data lives
 * in the shared AQStore (IndexedDB locally, Supabase when configured), so it
 * follows the user's account across devices.
 */
(function () {
  "use strict";

  var W = window.AQWorkspace, S = window.AQStore;
  var DRUGS = window.AMSP_DRUGS || [];
  var esc;

  /* Storage lives in localStorage rather than the shared IndexedDB / Supabase
   * schema. AMSP tracking data is per-user and does not need to sync across
   * committee members the way incidents or CAPAs do, so a lightweight local
   * store keeps the feature working without a schema migration. The two keys
   * are namespaced with the current user's email (if any) so a shared machine
   * does not commingle two auditors' figures. */
  var STORE_USAGE = "amsp_usage";
  var STORE_DDD   = "amsp_ddd";
  function scopeKey(store) {
    var uid = (W && W.user && (W.user.email || W.user.id)) || "anonymous";
    return "aq-" + store + ":" + uid;
  }
  function readStore(store) {
    try { return JSON.parse(localStorage.getItem(scopeKey(store)) || "[]") || []; }
    catch (e) { return []; }
  }
  function writeStore(store, rows) {
    try { localStorage.setItem(scopeKey(store), JSON.stringify(rows)); } catch (e) {}
  }

  var state = {
    tool: "usage",        /* "usage" | "ddd" */
    drug: null,           /* current drug object, or null when on the picker */
    usage: [],            /* all usage rows from the store */
    ddd: [],              /* all DDD rows from the store */
  };

  /* -------------------------------- utilities -------------------------------- */

  function id(prefix) { return prefix + "_" + Math.random().toString(36).slice(2, 11); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function fmt(v, dp) {
    if (v == null || !isFinite(v)) return "—";
    var pow = Math.pow(10, dp == null ? 2 : dp);
    return String(Math.round(v * pow) / pow);
  }
  function monthLabel(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    var names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return names[+m[2] - 1] + " " + m[1];
  }
  function monthShort(iso) {
    var m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
    if (!m) return String(iso || "");
    var names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return names[+m[2] - 1] + " " + m[1].slice(2);
  }
  function thisMonth() {
    var d = new Date();
    return d.toISOString().slice(0, 7) + "-01";
  }
  function monthInputFrom(iso) {
    return String(iso || "").slice(0, 7);
  }
  function isoFromMonthInput(v) {
    return /^\d{4}-\d{2}$/.test(v) ? v + "-01" : "";
  }
  function drugById(id) {
    for (var i = 0; i < DRUGS.length; i++) if (DRUGS[i].id === id) return DRUGS[i];
    return null;
  }

  /* --------------------------------- storage -------------------------------- */

  async function refresh() {
    state.usage = readStore(STORE_USAGE);
    state.ddd   = readStore(STORE_DDD);
  }

  async function saveRow(store, row) {
    row.updated_at = new Date().toISOString();
    var rows = readStore(store);
    var idx = -1;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === row.id) { idx = i; break; }
    if (idx >= 0) rows[idx] = row; else rows.push(row);
    writeStore(store, rows);
    return row;
  }
  async function removeRow(store, rowId) {
    var rows = readStore(store).filter(function (r) { return r.id !== rowId; });
    writeStore(store, rows);
  }

  function rowsFor(store, drugId) {
    return (store === STORE_DDD ? state.ddd : state.usage)
      .filter(function (r) { return r.drug_id === drugId; })
      .sort(function (a, b) { return String(a.month) < String(b.month) ? -1 : 1; });
  }

  /* ---------------------------------- render -------------------------------- */

  function h(container, html) { container.innerHTML = html; }

  function tabsBar() {
    document.querySelectorAll(".amsp-tab").forEach(function (b) {
      var tool = b.getAttribute("data-tool");
      b.classList.toggle("active", tool === state.tool);
      b.setAttribute("aria-selected", tool === state.tool ? "true" : "false");
    });
  }

  function renderPicker() {
    var host = document.getElementById("amspHost");
    var byGroup = { antibiotic: [], antifungal: [] };
    DRUGS.forEach(function (d) { byGroup[d.group].push(d); });
    var toolCopy = state.tool === "ddd"
      ? "Choose the high-end antimicrobial to calculate the Defined Daily Dose for. The WHO reference DDD is shown against each drug so you know before opening the calculator."
      : "Choose the high-end antimicrobial to record this month's usage against. The card carries a running chart of every month you have entered.";

    function grid(list, cls) {
      return '<div class="amsp-grid">' + list.map(function (d) {
        var count = rowsFor(state.tool === "ddd" ? STORE_DDD : STORE_USAGE, d.id).length;
        return '<button type="button" class="amsp-drug-card ' + cls + '" data-drug="' + esc(d.id) + '">' +
          '<span class="n">' + esc(d.name) + '</span>' +
          '<span class="m"><span class="tag">' + (d.group === "antibiotic" ? "Antibiotic" : "Antifungal") + '</span>' +
            (count ? "  ·  " + count + " month" + (count === 1 ? "" : "s") + " on record" : "") + '</span>' +
          '<span class="who">WHO DDD: ' + fmt(d.whoDdd, 3) + " " + esc(d.unit) + '</span>' +
        '</button>';
      }).join("") + "</div>";
    }

    h(host,
      '<p class="amsp-panel-sub" style="margin:0 0 18px;color:var(--fg-muted)">' + esc(toolCopy) + '</p>' +
      '<div class="amsp-groups">' +
        '<div><h2 class="amsp-group-h">Antibacterials</h2>' + grid(byGroup.antibiotic, "abx") + '</div>' +
        '<div><h2 class="amsp-group-h">Antifungals</h2>'  + grid(byGroup.antifungal, "afg") + '</div>' +
      '</div>');
    host.querySelectorAll("[data-drug]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.drug = drugById(b.getAttribute("data-drug"));
        render();
      });
    });
  }

  /* -------------------------- Track monthly usage -------------------------- */

  function comboRow(combos, idx, value, vials) {
    return '<div class="amsp-combo-row">' +
      '<select data-combo-name="' + idx + '">' +
        combos.map(function (c) {
          return '<option value="' + esc(c) + '"' + (value === c ? " selected" : "") + '>' + esc(c) + "</option>";
        }).join("") +
        '<option value="__custom">Other combination…</option>' +
      "</select>" +
      '<input type="number" min="0" step="1" data-combo-vials="' + idx + '" ' +
        'placeholder="Vials" value="' + (vials == null ? "" : esc(vials)) + '">' +
      '<button type="button" class="amsp-combo-x" data-combo-x="' + idx + '" aria-label="Remove combination">×</button>' +
      "</div>";
  }

  function drugDetailUsage() {
    var d = state.drug;
    var rows = rowsFor(STORE_USAGE, d.id);
    var editingId = state.editUsageId || null;
    var editing = editingId ? rows.filter(function (r) { return r.id === editingId; })[0] : null;
    var combos = editing && editing.combinations && editing.combinations.length
      ? editing.combinations.slice()
      : [{ name: d.combos[0] || d.name, vials: null }];

    return (
      '<div class="amsp-detail">' +

        /* header */
        '<div class="amsp-detail-h">' +
          '<button type="button" class="back" data-back="1">&larr; Back to drug list</button>' +
          '<h2>' + esc(d.name) + '</h2>' +
          '<span class="tag ' + (d.group === "antibiotic" ? "abx" : "afg") + '">' +
            (d.group === "antibiotic" ? "Antibiotic" : "Antifungal") + '</span>' +
          '<span class="who-badge">WHO DDD: <b>' + fmt(d.whoDdd, 3) + " " + esc(d.unit) + '</b></span>' +
        '</div>' +

        /* form */
        '<div class="amsp-panel">' +
          '<h3>' + (editing ? "Edit month" : "Record a month’s usage") + '</h3>' +
          '<p class="amsp-panel-sub">Number of vials and the split by combination, plus AMSP compliance for that month. All fields are per-month; the chart below fills in as you add months.</p>' +

          '<div class="amsp-form-grid">' +
            '<div class="amsp-field"><label>Month</label>' +
              '<input type="month" id="amspU_month" value="' +
                esc(monthInputFrom(editing ? editing.month : thisMonth())) + '" required></div>' +
            '<div class="amsp-field"><label>Total patients who received this drug</label>' +
              '<input type="number" min="0" step="1" id="amspU_patients" value="' +
                esc(editing ? editing.patients_received : "") + '" placeholder="e.g. 30"></div>' +
          '</div>' +

          '<h4 class="amsp-group-h" style="margin-top:20px">Vials used, by combination</h4>' +
          '<div class="amsp-combos" id="amspU_combos">' +
            combos.map(function (c, i) { return comboRow(d.combos, i, c.name, c.vials); }).join("") +
          '</div>' +
          '<button type="button" class="amsp-combo-add" id="amspU_addCombo">+ Add another combination</button>' +

          '<h4 class="amsp-group-h" style="margin-top:20px">AMSP compliance</h4>' +
          '<div class="amsp-form-grid">' +
            '<div class="amsp-field"><label>Patients for whom culture was sent before starting</label>' +
              '<input type="number" min="0" step="1" id="amspU_cultures" value="' +
                esc(editing ? editing.cultures_sent : "") + '" placeholder="e.g. 27">' +
              '<span class="hint">Of the total above.</span></div>' +
            '<div class="amsp-field"><label>Patients with justification form filled &amp; acknowledged by AMSP chair</label>' +
              '<input type="number" min="0" step="1" id="amspU_justif" value="' +
                esc(editing ? editing.justifications : "") + '" placeholder="e.g. 24">' +
              '<span class="hint">Of the total above.</span></div>' +
          '</div>' +

          '<div class="amsp-actions">' +
            '<button type="button" class="btn btn-accent" id="amspU_save">' + (editing ? "Update month" : "Save month") + '</button>' +
            (editing ? '<button type="button" class="btn btn-ghost" id="amspU_cancel">Cancel edit</button>' : "") +
            '<span class="amsp-sp"></span>' +
            (rows.length ? '<button type="button" class="btn btn-ghost qd-danger" id="amspU_reset">Reset all months for this drug</button>' : "") +
          '</div>' +
        '</div>' +

        /* history + chart */
        '<div class="amsp-history">' +
          '<h3>Monthly trend</h3>' +
          '<p class="amsp-history-sub">One point per month you have entered, per combination. Combinations are stacked in the legend so a change in combo mix is visible alongside the total.</p>' +
          (rows.length
            ? '<div class="amsp-chart-card">' + renderUsageChart(rows) + renderUsageTable(rows) + "</div>"
            : '<div class="amsp-empty">No months on record yet. Fill in the form above and press Save month to start the chart.</div>') +
        '</div>' +

      '</div>'
    );
  }

  function renderUsageChart(rows) {
    /* One series per combination-name encountered across the months. */
    var seriesMap = {};
    rows.forEach(function (r) {
      (r.combinations || []).forEach(function (c) {
        seriesMap[c.name] = seriesMap[c.name] || {};
        seriesMap[c.name][r.month] = (seriesMap[c.name][r.month] || 0) + (num(c.vials) || 0);
      });
    });
    var seriesNames = Object.keys(seriesMap);
    if (!seriesNames.length) {
      return '<div class="amsp-empty">Enter the vial counts to start the chart.</div>';
    }
    var months = rows.map(function (r) { return r.month; });
    return svgLineChart({
      months: months,
      series: seriesNames.map(function (name, i) {
        return { name: name, values: months.map(function (m) { return seriesMap[name][m] || 0; }) };
      }),
      yLabel: "Vials used"
    });
  }

  function renderUsageTable(rows) {
    return '<table class="amsp-months-table"><thead><tr>' +
      '<th>Month</th><th>Total vials</th><th>Patients</th>' +
      '<th>Culture sent</th><th>Justification</th><th></th></tr></thead><tbody>' +
      rows.slice().reverse().map(function (r) {
        var totalVials = (r.combinations || []).reduce(function (n, c) { return n + (num(c.vials) || 0); }, 0);
        var comp = (function (a, b) { if (!num(b)) return "—"; return Math.round(num(a) / num(b) * 100) + "%"; });
        return '<tr>' +
          '<td>' + esc(monthLabel(r.month)) + '</td>' +
          '<td class="num">' + totalVials + '</td>' +
          '<td class="num">' + (r.patients_received == null ? "—" : r.patients_received) + '</td>' +
          '<td class="num">' + (r.cultures_sent == null ? "—" : r.cultures_sent) + ' <small style="color:var(--fg-muted)">(' + comp(r.cultures_sent, r.patients_received) + ')</small></td>' +
          '<td class="num">' + (r.justifications == null ? "—" : r.justifications) + ' <small style="color:var(--fg-muted)">(' + comp(r.justifications, r.patients_received) + ')</small></td>' +
          '<td><button type="button" class="amsp-row-del" data-edit-usage="' + esc(r.id) + '" title="Edit">✎</button>' +
              '<button type="button" class="amsp-row-del" data-del-usage="' + esc(r.id) + '" title="Delete">×</button></td>' +
        '</tr>';
      }).join("") + "</tbody></table>";
  }

  /* ------------------------------ Calculate DDD ---------------------------- */

  function doseRow(idx, dose, quantity, options) {
    var opts = options || [];
    var optionsHtml = opts.map(function (o) {
      return '<option value="' + o + '"' + (+dose === +o ? " selected" : "") + '>' + o + '</option>';
    }).join("");
    return '<div class="amsp-dose-row">' +
      '<div><span class="lg">Strength</span><select data-dose-strength="' + idx + '">' +
        optionsHtml +
        '<option value="__custom">Other…</option>' +
      '</select></div>' +
      '<div><span class="lg">Custom dose</span><input type="number" min="0" step="any" data-dose-custom="' + idx + '" ' +
        'placeholder="Only if Other" ' + (opts.indexOf(+dose) === -1 && dose != null ? 'value="' + esc(dose) + '"' : "") + '></div>' +
      '<div><span class="lg">Vials at this strength</span><input type="number" min="0" step="1" data-dose-qty="' + idx + '" ' +
        'value="' + (quantity == null ? "" : esc(quantity)) + '"></div>' +
      '<button type="button" class="amsp-combo-x" data-dose-x="' + idx + '" aria-label="Remove row">×</button>' +
    '</div>';
  }

  function drugDetailDdd() {
    var d = state.drug;
    var rows = rowsFor(STORE_DDD, d.id);
    var editingId = state.editDddId || null;
    var editing = editingId ? rows.filter(function (r) { return r.id === editingId; })[0] : null;

    var doses = editing && editing.doses && editing.doses.length
      ? editing.doses.slice()
      : [{ dose: d.strengths[0] || 0, qty: null }];

    return (
      '<div class="amsp-detail">' +

        '<div class="amsp-detail-h">' +
          '<button type="button" class="back" data-back="1">&larr; Back to drug list</button>' +
          '<h2>' + esc(d.name) + '</h2>' +
          '<span class="tag ' + (d.group === "antibiotic" ? "abx" : "afg") + '">' +
            (d.group === "antibiotic" ? "Antibiotic" : "Antifungal") + '</span>' +
          '<span class="who-badge">WHO DDD: <b>' + fmt(d.whoDdd, 3) + " " + esc(d.unit) + '</b></span>' +
        '</div>' +

        '<div class="amsp-panel">' +
          '<h3>' + (editing ? "Edit month" : "Calculate DDD for a month") + '</h3>' +
          '<p class="amsp-panel-sub">Enter the month, the in-patient days, and one row per strength dispensed. The Total dose in grams, DDD and DDD per 1000 patient days are computed for you, using WHO ' +
          esc(fmt(d.whoDdd, 3)) + " " + esc(d.unit) + ' as the reference.</p>' +

          '<div class="amsp-form-grid">' +
            '<div class="amsp-field"><label>Month</label>' +
              '<input type="month" id="amspD_month" value="' +
                esc(monthInputFrom(editing ? editing.month : thisMonth())) + '"></div>' +
            '<div class="amsp-field"><label>In-patient days that month</label>' +
              '<input type="number" min="1" step="1" id="amspD_ipDays" value="' +
                esc(editing ? editing.ip_days : "") + '" placeholder="e.g. 4273"></div>' +
          '</div>' +

          '<h4 class="amsp-group-h" style="margin-top:20px">Vials dispensed by strength</h4>' +
          '<div class="amsp-doses" id="amspD_doses">' +
            doses.map(function (dz, i) { return doseRow(i, dz.dose, dz.qty, d.strengths); }).join("") +
          '</div>' +
          '<button type="button" class="amsp-combo-add" id="amspD_addDose">+ Add another strength</button>' +

          '<div class="amsp-computed" id="amspD_computed"></div>' +

          '<div class="amsp-actions">' +
            '<button type="button" class="btn btn-accent" id="amspD_save">' + (editing ? "Update month" : "Save month") + '</button>' +
            (editing ? '<button type="button" class="btn btn-ghost" id="amspD_cancel">Cancel edit</button>' : "") +
            '<span class="amsp-sp"></span>' +
            (rows.length ? '<button type="button" class="btn btn-ghost qd-danger" id="amspD_reset">Reset all months for this drug</button>' : "") +
          '</div>' +
        '</div>' +

        '<div class="amsp-history">' +
          '<h3>DDD over months</h3>' +
          '<p class="amsp-history-sub">DDD per 1000 patient days, tracked over every month you have entered.</p>' +
          (rows.length
            ? '<div class="amsp-chart-card">' + renderDddChart(rows) + renderDddTable(rows) + "</div>"
            : '<div class="amsp-empty">No months on record yet. Save this month’s figures to start the trend.</div>') +
        '</div>' +

      '</div>'
    );
  }

  function computeDdd(state_) {
    var d = state.drug;
    var totalGrams = (state_.doses || []).reduce(function (n, dz) {
      var dose = num(dz.dose), qty = num(dz.qty);
      if (dose == null || qty == null) return n;
      return n + dose * qty;
    }, 0);
    var ddd = d.whoDdd ? totalGrams / d.whoDdd : null;
    var per1000 = (ddd != null && num(state_.ip_days))
      ? ddd / num(state_.ip_days) * 1000 : null;
    return { totalGrams: totalGrams, ddd: ddd, per1000: per1000 };
  }

  function renderDddChart(rows) {
    var months = rows.map(function (r) { return r.month; });
    var series = [
      { name: "DDD / 1000 patient days", values: rows.map(function (r) { return num(r.ddd_per_1000) || 0; }) },
      { name: "Total DDD", values: rows.map(function (r) { return num(r.ddd) || 0; }) },
    ];
    return svgLineChart({ months: months, series: series, yLabel: "Value" });
  }

  function renderDddTable(rows) {
    return '<table class="amsp-months-table"><thead><tr>' +
      '<th>Month</th><th>Total g</th><th>DDD</th><th>DDD / 1000 pt-days</th><th>IP days</th><th></th>' +
      '</tr></thead><tbody>' +
      rows.slice().reverse().map(function (r) {
        return '<tr>' +
          '<td>' + esc(monthLabel(r.month)) + '</td>' +
          '<td class="num">' + fmt(r.total_grams, 2) + '</td>' +
          '<td class="num">' + fmt(r.ddd, 2) + '</td>' +
          '<td class="num">' + fmt(r.ddd_per_1000, 2) + '</td>' +
          '<td class="num">' + esc(r.ip_days) + '</td>' +
          '<td><button type="button" class="amsp-row-del" data-edit-ddd="' + esc(r.id) + '" title="Edit">✎</button>' +
              '<button type="button" class="amsp-row-del" data-del-ddd="' + esc(r.id) + '" title="Delete">×</button></td>' +
        '</tr>';
      }).join("") + "</tbody></table>";
  }

  /* ------------------------------- SVG chart ------------------------------ */

  function svgLineChart(opts) {
    var months = opts.months;
    var series = opts.series || [];
    var W = 720, H = 220, PAD_L = 46, PAD_R = 14, PAD_T = 18, PAD_B = 36;
    var colours = ["#4C6FFF", "#20A39E", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981"];
    var allVals = [];
    series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) allVals.push(v); }); });
    var hi = Math.max.apply(null, allVals.length ? allVals : [1]);
    var lo = 0;
    if (hi <= 0) hi = 1;
    /* Round hi up to a nice number */
    var step = Math.pow(10, Math.floor(Math.log10(hi)));
    hi = Math.ceil(hi / step) * step;

    function xFor(i) {
      if (months.length === 1) return PAD_L + (W - PAD_L - PAD_R) / 2;
      return PAD_L + (i / (months.length - 1)) * (W - PAD_L - PAD_R);
    }
    function yFor(v) { return H - PAD_B - ((v - lo) / (hi - lo)) * (H - PAD_T - PAD_B); }

    /* gridlines and y labels */
    var yTicks = 4;
    var gridHtml = "";
    for (var t = 0; t <= yTicks; t++) {
      var y = PAD_T + (t / yTicks) * (H - PAD_T - PAD_B);
      var val = hi - (t / yTicks) * (hi - lo);
      gridHtml += '<line class="grid" x1="' + PAD_L + '" x2="' + (W - PAD_R) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text class="lbl lbl-y" x="' + (PAD_L - 6) + '" y="' + (y + 4) + '">' + fmt(val, val < 10 ? 1 : 0) + '</text>';
    }
    /* x labels */
    var xLabels = months.map(function (m, i) {
      return '<text class="lbl lbl-x" x="' + xFor(i) + '" y="' + (H - PAD_B + 18) + '">' + esc(monthShort(m)) + '</text>';
    }).join("");
    /* series */
    var lines = series.map(function (s, sIdx) {
      var colour = colours[sIdx % colours.length];
      var pts = s.values.map(function (v, i) {
        if (v == null) return null;
        return { x: xFor(i), y: yFor(v) };
      }).filter(Boolean);
      if (!pts.length) return "";
      var path = "M" + pts.map(function (p) { return p.x.toFixed(1) + "," + p.y.toFixed(1); }).join(" L");
      var dots = pts.map(function (p) {
        return '<circle class="dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" stroke="' + colour + '"/>';
      }).join("");
      return '<path class="series" d="' + path + '" stroke="' + colour + '"/>' + dots;
    }).join("");

    var legend = series.map(function (s, sIdx) {
      var colour = colours[sIdx % colours.length];
      return '<span class="lg-item"><span class="lg-dot" style="background:' + colour + '"></span>' + esc(s.name) + '</span>';
    }).join("");

    return '<svg class="amsp-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      gridHtml +
      '<line class="axis" x1="' + PAD_L + '" y1="' + PAD_T + '" x2="' + PAD_L + '" y2="' + (H - PAD_B) + '"/>' +
      '<line class="axis" x1="' + PAD_L + '" y1="' + (H - PAD_B) + '" x2="' + (W - PAD_R) + '" y2="' + (H - PAD_B) + '"/>' +
      xLabels + lines +
      '</svg><div class="amsp-chart-legend">' + legend + '</div>';
  }

  /* -------------------------------- event wiring -------------------------- */

  function wireDetailUsage() {
    var host = document.getElementById("amspHost");
    if (!host) return;
    host.querySelector("[data-back]")?.addEventListener("click", function () {
      state.drug = null; state.editUsageId = null; render();
    });
    host.querySelector("#amspU_addCombo")?.addEventListener("click", function () {
      var container = host.querySelector("#amspU_combos");
      var idx = container.querySelectorAll(".amsp-combo-row").length;
      container.insertAdjacentHTML("beforeend", comboRow(state.drug.combos, idx, "", null));
    });
    host.addEventListener("click", function (e) {
      var x = e.target.closest("[data-combo-x]");
      if (x) {
        var rows = host.querySelectorAll("#amspU_combos .amsp-combo-row");
        if (rows.length <= 1) return;
        x.closest(".amsp-combo-row").remove();
      }
      var editBtn = e.target.closest("[data-edit-usage]");
      if (editBtn) { state.editUsageId = editBtn.getAttribute("data-edit-usage"); render(); }
      var delBtn = e.target.closest("[data-del-usage]");
      if (delBtn) {
        if (!confirm("Delete this month?")) return;
        removeRow(STORE_USAGE, delBtn.getAttribute("data-del-usage"))
          .then(refresh).then(render);
      }
    });
    host.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-combo-name]");
      if (sel && sel.value === "__custom") {
        var custom = prompt("Enter the custom combination name:");
        if (custom) {
          var opt = document.createElement("option");
          opt.value = custom; opt.textContent = custom;
          sel.insertBefore(opt, sel.querySelector('[value="__custom"]'));
          sel.value = custom;
        } else {
          sel.value = state.drug.combos[0];
        }
      }
    });
    host.querySelector("#amspU_save")?.addEventListener("click", async function () {
      var month = isoFromMonthInput(host.querySelector("#amspU_month").value);
      if (!month) { alert("Pick the month."); return; }
      var combos = [];
      host.querySelectorAll("#amspU_combos .amsp-combo-row").forEach(function (row, i) {
        var name = row.querySelector("[data-combo-name]").value;
        var vials = num(row.querySelector("[data-combo-vials]").value);
        if (name && vials != null) combos.push({ name: name, vials: vials });
      });
      if (!combos.length) { alert("Enter at least one combination with vial count."); return; }
      var patients = num(host.querySelector("#amspU_patients").value);
      var cultures = num(host.querySelector("#amspU_cultures").value);
      var justif   = num(host.querySelector("#amspU_justif").value);
      var editing = state.editUsageId;
      var existing = editing
        ? state.usage.filter(function (r) { return r.id === editing; })[0]
        : state.usage.filter(function (r) { return r.drug_id === state.drug.id && r.month === month; })[0];
      var row = existing ? Object.assign({}, existing) : { id: id("u"), drug_id: state.drug.id };
      row.month = month;
      row.combinations = combos;
      row.patients_received = patients;
      row.cultures_sent = cultures;
      row.justifications = justif;
      await saveRow(STORE_USAGE, row);
      state.editUsageId = null;
      await refresh();
      render();
    });
    host.querySelector("#amspU_cancel")?.addEventListener("click", function () {
      state.editUsageId = null; render();
    });
    host.querySelector("#amspU_reset")?.addEventListener("click", async function () {
      if (!confirm("Delete every month saved for " + state.drug.name + "?\n\nThis cannot be undone.")) return;
      var rows = rowsFor(STORE_USAGE, state.drug.id);
      for (var i = 0; i < rows.length; i++) await removeRow(STORE_USAGE, rows[i].id);
      await refresh(); render();
    });
  }

  function recomputeDddPreview() {
    var host = document.getElementById("amspHost");
    if (!host) return;
    var doses = [];
    host.querySelectorAll("#amspD_doses .amsp-dose-row").forEach(function (row) {
      var strengthEl = row.querySelector("[data-dose-strength]");
      var customEl = row.querySelector("[data-dose-custom]");
      var qtyEl = row.querySelector("[data-dose-qty]");
      var dose = strengthEl.value === "__custom" ? num(customEl.value) : num(strengthEl.value);
      var qty = num(qtyEl.value);
      doses.push({ dose: dose, qty: qty });
    });
    var ipDays = num(host.querySelector("#amspD_ipDays").value);
    var out = computeDdd({ doses: doses, ip_days: ipDays });
    var box = host.querySelector("#amspD_computed");
    if (box) {
      box.innerHTML =
        '<div><span class="k">Total dose used</span>' +
          '<span class="v">' + fmt(out.totalGrams, 3) + ' <small>' + esc(state.drug.unit) + '</small></span></div>' +
        '<div><span class="k">DDD</span>' +
          '<span class="v">' + fmt(out.ddd, 2) + '</span></div>' +
        '<div><span class="k">DDD / 1000 patient days</span>' +
          '<span class="v">' + (out.per1000 == null ? "—" : fmt(out.per1000, 2)) + '</span></div>';
    }
    return { doses: doses, ipDays: ipDays, out: out };
  }

  function wireDetailDdd() {
    var host = document.getElementById("amspHost");
    if (!host) return;
    host.querySelector("[data-back]")?.addEventListener("click", function () {
      state.drug = null; state.editDddId = null; render();
    });
    host.querySelector("#amspD_addDose")?.addEventListener("click", function () {
      var container = host.querySelector("#amspD_doses");
      var idx = container.querySelectorAll(".amsp-dose-row").length;
      container.insertAdjacentHTML("beforeend", doseRow(idx, state.drug.strengths[0] || 0, null, state.drug.strengths));
      recomputeDddPreview();
    });
    host.addEventListener("click", function (e) {
      var x = e.target.closest("[data-dose-x]");
      if (x) {
        var rows = host.querySelectorAll("#amspD_doses .amsp-dose-row");
        if (rows.length <= 1) return;
        x.closest(".amsp-dose-row").remove();
        recomputeDddPreview();
      }
      var editBtn = e.target.closest("[data-edit-ddd]");
      if (editBtn) { state.editDddId = editBtn.getAttribute("data-edit-ddd"); render(); }
      var delBtn = e.target.closest("[data-del-ddd]");
      if (delBtn) {
        if (!confirm("Delete this month?")) return;
        removeRow(STORE_DDD, delBtn.getAttribute("data-del-ddd")).then(refresh).then(render);
      }
    });
    host.addEventListener("input", function (e) {
      if (e.target.matches("[data-dose-strength], [data-dose-custom], [data-dose-qty], #amspD_ipDays")) {
        recomputeDddPreview();
      }
    });
    host.addEventListener("change", function (e) {
      if (e.target.matches("[data-dose-strength]")) recomputeDddPreview();
    });
    host.querySelector("#amspD_save")?.addEventListener("click", async function () {
      var vals = recomputeDddPreview();
      var month = isoFromMonthInput(host.querySelector("#amspD_month").value);
      if (!month) { alert("Pick the month."); return; }
      if (!vals || !vals.ipDays) { alert("Enter the in-patient days."); return; }
      var validDoses = vals.doses.filter(function (dz) { return dz.dose != null && dz.qty != null; });
      if (!validDoses.length) { alert("Enter at least one strength with a vial count."); return; }
      var editing = state.editDddId;
      var existing = editing
        ? state.ddd.filter(function (r) { return r.id === editing; })[0]
        : state.ddd.filter(function (r) { return r.drug_id === state.drug.id && r.month === month; })[0];
      var row = existing ? Object.assign({}, existing) : { id: id("d"), drug_id: state.drug.id };
      row.month = month;
      row.doses = validDoses;
      row.ip_days = vals.ipDays;
      row.total_grams = vals.out.totalGrams;
      row.ddd = vals.out.ddd;
      row.ddd_per_1000 = vals.out.per1000;
      row.who_ddd = state.drug.whoDdd;
      await saveRow(STORE_DDD, row);
      state.editDddId = null;
      await refresh();
      render();
    });
    host.querySelector("#amspD_cancel")?.addEventListener("click", function () {
      state.editDddId = null; render();
    });
    host.querySelector("#amspD_reset")?.addEventListener("click", async function () {
      if (!confirm("Delete every month saved for " + state.drug.name + "?\n\nThis cannot be undone.")) return;
      var rows = rowsFor(STORE_DDD, state.drug.id);
      for (var i = 0; i < rows.length; i++) await removeRow(STORE_DDD, rows[i].id);
      await refresh(); render();
    });
    recomputeDddPreview();
  }

  /* ---------------------------------- render -------------------------------- */

  function render() {
    tabsBar();
    var host = document.getElementById("amspHost");
    if (!state.drug) { renderPicker(); return; }
    if (state.tool === "usage") { h(host, drugDetailUsage()); wireDetailUsage(); }
    else                       { h(host, drugDetailDdd());   wireDetailDdd(); }
  }

  /* ---------------------------------- boot -------------------------------- */

  async function init() {
    esc = W.esc;
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("amsp");
    if (W.renderModeNotice) W.renderModeNotice();

    /* tab switching */
    document.querySelectorAll(".amsp-tab").forEach(function (b) {
      b.addEventListener("click", function () {
        state.tool = b.getAttribute("data-tool");
        state.drug = null;
        state.editUsageId = null; state.editDddId = null;
        render();
      });
    });

    await refresh();
    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
