/* AQcredix — KPI library: per-card edit.
 *
 * The KPI cards on this page ship with a plausible-looking sample: a target,
 * a benchmark, and seven months of made-up figures. The library was hard to
 * make useful without the reader plugging their own numbers in — the sample
 * is decorative, and the whole point of a KPI page is to look at your own
 * KPI. This adds a small Edit button per card, opens a form asking for the
 * details needed to draw that particular graph, redraws the big value, the
 * delta, the sparkline, the colour, and the status badge with the entered
 * numbers, and keeps them in localStorage so they survive a reload.
 *
 * Only the reader's browser sees the numbers. Nothing is uploaded.
 */
(function () {
  "use strict";

  var STORAGE_PREFIX = "aq-kpi-lib-";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function readValues(card) {
    var raw = card.getAttribute("data-values") || "";
    return raw.split(",").map(function (v) { return num(v); }).filter(function (v) { return v != null; });
  }
  function fmt(v, digits) {
    if (v == null || !isFinite(v)) return "—";
    return (Math.round(v * Math.pow(10, digits || 0)) / Math.pow(10, digits || 0)).toString();
  }

  /* Load a saved override, if any, and merge onto the card's DOM defaults. */
  function loadOverride(id) {
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveOverride(id, data) {
    try { localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data)); } catch (e) {}
  }
  function clearOverride(id) {
    try { localStorage.removeItem(STORAGE_PREFIX + id); } catch (e) {}
  }

  /* Turn the seven monthly values into an SVG polyline path scaled to the
   * card's sparkline viewBox (320 x 60). A little vertical padding keeps the
   * peak and trough off the edges. */
  function sparkPath(values) {
    if (!values || values.length < 2) return "";
    var W = 320, H = 60, pad = 8;
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    var span = (hi - lo) || 1;
    var pts = values.map(function (v, i) {
      var x = (i / (values.length - 1)) * W;
      var y = H - pad - ((v - lo) / span) * (H - pad * 2);
      return x.toFixed(1) + "," + y.toFixed(1);
    });
    return "M" + pts.join(" L");
  }

  /* The final tone of the sparkline and the status badge is a function of two
   * things: is the last value on the right side of the target, and is the
   * trend heading toward the target or away from it? */
  function statusOf(state) {
    var vals = state.values || [];
    var last = vals.length ? vals[vals.length - 1] : null;
    var prev = vals.length > 1 ? vals[vals.length - 2] : null;
    var target = num(state.target);
    var higher = state.direction !== "lower";
    var onSide = last != null && target != null &&
      (higher ? last >= target : last <= target);
    var trendUp = last != null && prev != null && last > prev;
    var trendDown = last != null && prev != null && last < prev;
    var trendGood = higher ? trendUp : trendDown;
    var trendBad  = higher ? trendDown : trendUp;

    var band, label;
    if (onSide && trendGood) { band = "ok";   label = higher ? "Above benchmark" : "Within target"; }
    else if (onSide && trendBad) { band = "ok"; label = "Within target"; }
    else if (onSide) { band = "ok"; label = higher ? "Above benchmark" : "Within target"; }
    else if (trendGood) { band = "ok"; label = "Improving"; }
    else { band = "warn"; label = "Watch trend"; }
    return { band: band, label: label, last: last, prev: prev, trendGood: trendGood };
  }

  /* Repaint everything downstream of a change to state, in place, without
   * touching the parts of the card that describe what the KPI IS (title,
   * formula, chapter code). */
  function repaint(card, state) {
    var s = statusOf(state);
    var digits = state.digits != null ? state.digits : (String(state.values[0] || "").indexOf(".") > -1 ? 1 : 0);
    var unit = state.unit || "";
    var bigEl = $(".kpi-metric .big", card);
    var deltaEl = $(".kpi-metric .delta", card);
    var benchEl = $(".kpi-metric .kpi-bench", card);
    var sparkPath_ = sparkPath(state.values);
    var sparkPathEl = $(".kpi-spark path", card);
    var sparkDotEl = $(".kpi-spark circle", card);
    var footBadges = card.querySelectorAll(".kpi-foot .badge");

    if (bigEl) {
      bigEl.innerHTML = fmt(s.last, digits) + (unit
        ? '<span style="font-size:20px;">' + esc(unit) + '</span>'
        : "");
    }
    if (deltaEl) {
      var d = (s.last != null && s.prev != null) ? (s.last - s.prev) : null;
      if (d == null) {
        deltaEl.textContent = "—";
        deltaEl.style.color = "";
      } else {
        var arrow = d > 0 ? "▲" : (d < 0 ? "▼" : "─");
        var deltaSuffix = state.deltaSuffix || (unit === "%" ? " pts" : "");
        deltaEl.innerHTML = arrow + " " + fmt(Math.abs(d), digits) + esc(deltaSuffix);
        var good = state.direction === "lower" ? d < 0 : d > 0;
        var same = d === 0;
        deltaEl.style.color = same ? "var(--fg-faint)" : (good ? "var(--ok)" : "var(--warn)");
      }
    }
    if (benchEl && state.benchLabel != null) benchEl.textContent = state.benchLabel;

    var lineTone = (s.band === "warn") ? "var(--warn)" : "var(--accent-bright)";
    if (sparkPathEl && sparkPath_) {
      sparkPathEl.setAttribute("d", sparkPath_);
      sparkPathEl.setAttribute("stroke", lineTone);
    }
    if (sparkDotEl && state.values && state.values.length) {
      /* Match the endpoint of the recomputed path. */
      var pts = sparkPath_.split(" ");
      var last = pts[pts.length - 1].replace(/^L/, "").split(",");
      sparkDotEl.setAttribute("cx", last[0]);
      sparkDotEl.setAttribute("cy", last[1]);
      sparkDotEl.setAttribute("fill", lineTone);
    }
    if (footBadges && footBadges.length) {
      /* The first badge is the status one; the second is the chapter code
       * chip we do not touch. */
      var badge = footBadges[0];
      badge.textContent = s.label;
      badge.className = "badge " + (s.band === "warn" ? "badge-soon" : "badge-ok");
    }

    /* Persist the data attributes so a re-render starts from the same state. */
    card.setAttribute("data-values", state.values.join(","));
    card.setAttribute("data-target", state.target == null ? "" : String(state.target));
    card.setAttribute("data-direction", state.direction || "higher");
    if (state.unit != null) card.setAttribute("data-unit", state.unit);
    if (state.benchLabel != null) card.setAttribute("data-bench", state.benchLabel);
    if (state.digits != null) card.setAttribute("data-digits", String(state.digits));
    if (state.deltaSuffix != null) card.setAttribute("data-delta-suffix", state.deltaSuffix);
  }

  /* Read the current state off the card's data-attributes plus any saved
   * override. This is the model the edit modal opens with. */
  function stateFor(card) {
    var id = card.getAttribute("data-kpi-id");
    var over = loadOverride(id);
    var state = {
      values: readValues(card),
      target: num(card.getAttribute("data-target")),
      direction: card.getAttribute("data-direction") || "higher",
      unit: card.getAttribute("data-unit") || "",
      benchLabel: card.getAttribute("data-bench") || $(".kpi-metric .kpi-bench", card).textContent,
      digits: num(card.getAttribute("data-digits")),
      deltaSuffix: card.getAttribute("data-delta-suffix") || "",
    };
    if (state.digits == null) state.digits = state.unit === "%" ? 0 : 1;
    if (over) {
      if (over.values) state.values = over.values;
      if (over.target != null) state.target = over.target;
      if (over.direction) state.direction = over.direction;
      if (over.unit != null) state.unit = over.unit;
      if (over.benchLabel != null) state.benchLabel = over.benchLabel;
      if (over.digits != null) state.digits = over.digits;
      if (over.deltaSuffix != null) state.deltaSuffix = over.deltaSuffix;
    }
    return state;
  }

  /* Modal — asks only for the fields it needs to draw the graph. The unit,
   * benchmark label and value formatting are pre-filled from what the card
   * shipped with, so the reader normally just types their seven months and
   * their target and presses Save. */
  function openEditor(card) {
    var id = card.getAttribute("data-kpi-id");
    var title = ($(".kpi-top h3", card) || {}).textContent || "KPI";
    var state = stateFor(card);
    var monthLabels = ["6 months ago", "5 months ago", "4 months ago", "3 months ago",
                       "2 months ago", "Last month", "This month"];
    /* Ensure exactly seven slots for the seven months shown on the sparkline. */
    var padded = state.values.slice(0, 7);
    while (padded.length < 7) padded.unshift(null);

    var overlay = document.createElement("div");
    overlay.className = "aq-modal-overlay";
    overlay.innerHTML =
      '<div class="aq-modal" role="dialog" aria-modal="true" aria-labelledby="kpiEdTitle">' +
        '<h3 id="kpiEdTitle">Enter your figures</h3>' +
        '<p>Update the seven months and the target for <b>' + esc(title) + '</b>. The card redraws with your numbers and the values stay in your browser — nothing is uploaded.</p>' +
        '<div class="aq-modal-grid">' +
          '<label class="aq-modal-field aq-span-2"><span>Target / benchmark</span>' +
            '<input type="number" step="any" id="kpiEdTarget" value="' + esc(state.target == null ? "" : state.target) + '" required></label>' +
          '<label class="aq-modal-field"><span>Unit shown after the number</span>' +
            '<input type="text" id="kpiEdUnit" maxlength="6" value="' + esc(state.unit) + '" placeholder="% or blank"></label>' +
          '<label class="aq-modal-field"><span>Benchmark label</span>' +
            '<input type="text" id="kpiEdBench" maxlength="24" value="' + esc(state.benchLabel) + '" placeholder="e.g. ≥ 80% or per 1000"></label>' +
          '<label class="aq-modal-field aq-span-2"><span>Better direction</span>' +
            '<select id="kpiEdDir">' +
              '<option value="higher"' + (state.direction === "higher" ? " selected" : "") + '>Higher is better (e.g. compliance)</option>' +
              '<option value="lower"'  + (state.direction === "lower"  ? " selected" : "") + '>Lower is better (e.g. error rate)</option>' +
            '</select></label>' +
        '</div>' +
        '<h4 class="aq-modal-subhead">Monthly values</h4>' +
        '<div class="aq-modal-grid aq-modal-months">' +
          padded.map(function (v, i) {
            return '<label class="aq-modal-field"><span>' + esc(monthLabels[i]) + '</span>' +
              '<input type="number" step="any" data-month="' + i + '" value="' + (v == null ? "" : esc(v)) + '"></label>';
          }).join("") +
        '</div>' +
        '<div class="aq-modal-actions">' +
          '<button type="button" class="btn btn-ghost" id="kpiEdReset">Reset to sample</button>' +
          '<span style="flex:1"></span>' +
          '<button type="button" class="btn btn-ghost" id="kpiEdCancel">Cancel</button>' +
          '<button type="button" class="btn btn-accent" id="kpiEdSave">Save</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    /* Focus and select the first field for quick typing. */
    setTimeout(function () {
      var f = $("#kpiEdTarget", overlay); if (f) { f.focus(); f.select(); }
    }, 30);

    function close() { overlay.remove(); }
    $("#kpiEdCancel", overlay).addEventListener("click", close);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    overlay.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    $("#kpiEdReset", overlay).addEventListener("click", function () {
      if (!confirm("Restore the sample figures for this KPI?")) return;
      clearOverride(id);
      /* Rebuild state from just the DOM defaults. */
      var pristine = {
        values: readValues(card),
        target: num(card.getAttribute("data-target-default") || card.getAttribute("data-target")),
        direction: card.getAttribute("data-direction") || "higher",
        unit: card.getAttribute("data-unit-default") || card.getAttribute("data-unit") || "",
        benchLabel: card.getAttribute("data-bench-default") || card.getAttribute("data-bench") || "",
        digits: num(card.getAttribute("data-digits")),
        deltaSuffix: card.getAttribute("data-delta-suffix") || "",
      };
      /* If we saved 'default' snapshots, restore them; otherwise the DOM
       * defaults ARE the sample. */
      var pristineValues = card.getAttribute("data-values-default");
      if (pristineValues) pristine.values = pristineValues.split(",").map(num).filter(function (v) { return v != null; });
      repaint(card, pristine);
      close();
    });

    $("#kpiEdSave", overlay).addEventListener("click", function () {
      var target = num($("#kpiEdTarget", overlay).value);
      if (target == null) { alert("Please enter a target."); return; }
      var vals = [];
      overlay.querySelectorAll("[data-month]").forEach(function (inp) {
        var v = num(inp.value);
        if (v != null) vals.push(v);
      });
      if (vals.length < 2) { alert("Enter at least two months so the trend can be drawn."); return; }
      var unit = $("#kpiEdUnit", overlay).value.trim();
      var benchLabel = $("#kpiEdBench", overlay).value.trim();
      var direction = $("#kpiEdDir", overlay).value;
      var digits = String(vals[vals.length - 1]).indexOf(".") > -1 ? 1 : 0;
      var next = {
        values: vals, target: target, unit: unit, direction: direction,
        benchLabel: benchLabel, digits: digits,
        deltaSuffix: unit === "%" ? " pts" : "",
      };
      saveOverride(id, next);
      repaint(card, next);
      close();
    });
  }

  /* Snapshot the DOM defaults on first run so a Reset can restore them even
   * after we overwrite the card. */
  function snapshotDefaults(card) {
    if (card.hasAttribute("data-values-default")) return;
    card.setAttribute("data-values-default", card.getAttribute("data-values") || "");
    card.setAttribute("data-target-default", card.getAttribute("data-target") || "");
    card.setAttribute("data-unit-default", card.getAttribute("data-unit") || "");
    card.setAttribute("data-bench-default", card.getAttribute("data-bench") ||
      (($(".kpi-metric .kpi-bench", card) || {}).textContent || ""));
  }

  function decorate(card) {
    if (card.hasAttribute("data-kpi-ready")) return;
    card.setAttribute("data-kpi-ready", "1");
    snapshotDefaults(card);
    /* Inject an Edit button next to the metric block. */
    var top = $(".kpi-top", card);
    var metric = $(".kpi-metric", card);
    if (top && metric && !$(".kpi-edit-btn", card)) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kpi-edit-btn";
      btn.setAttribute("aria-label", "Edit this KPI's figures");
      btn.innerHTML = '<span class="kpi-edit-ico" aria-hidden="true">✎</span> Edit';
      btn.addEventListener("click", function (e) { e.stopPropagation(); openEditor(card); });
      metric.appendChild(btn);
    }
    /* Apply any saved override from a previous visit. */
    var over = loadOverride(card.getAttribute("data-kpi-id"));
    if (over) repaint(card, stateFor(card));
  }

  function boot() {
    document.querySelectorAll(".kpi-card[data-kpi-id]").forEach(decorate);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
