/* AQcredix — the chart vocabulary shared by the dashboard and the audit analysis.
 *
 * WHY A TOOLKIT RATHER THAN CHARTS PER SCREEN. The department profile and the post-audit
 * analysis answer different questions from the same shapes: a ring for a proportion, bars for
 * a comparison, an area for a trend, a card for a single figure with its direction of travel.
 * Writing them once means the two screens read as one product, and a fix to the maths lands
 * in both.
 *
 * NO LIBRARY, BY HOUSE RULE. Everything here is inline SVG built from strings. That keeps the
 * site buildless and means a chart cannot fail to render because a CDN is slow.
 *
 * EVERY COLOUR IS A TOKEN. Charts follow light, dark and neon with no per-theme branch.
 * Status colour (--ok / --warn / --nc) is deliberately separate from the accent: "on target"
 * must never be the same blue as "this is a link".
 *
 * HONESTY RULES, because these render clinical numbers:
 *   - a value axis starts at zero unless the caller opts out, so a small change cannot be
 *     drawn as a cliff;
 *   - nothing is invented to fill a gap — an empty series returns an empty state that says so;
 *   - colour never carries meaning alone, so every series is labelled.
 */
window.AQCharts = (function () {
  "use strict";

  var uid = 0;
  function nid(p) { return p + (++uid); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }

  /* ------------------------------------------------------------------ card */

  /* A single figure with its direction of travel. The delta is the point: a number without a
     trend tells you where you are and not whether it is working. */
  function card(o) {
    o = o || {};
    var d = o.delta;
    var dir = d == null ? null : (d > 0 ? "up" : d < 0 ? "down" : "flat");
    /* Up is not automatically good. An infection rate rising is bad; compliance rising is
       good. The caller says which, and the arrow and the colour follow that, not the sign. */
    var good = dir == null ? null
      : (o.higherIsBetter === false ? dir === "down" : dir === "up");
    var badge = d == null ? "" :
      '<span class="aqc-delta ' + (dir === "flat" ? "flat" : good ? "good" : "bad") + '">' +
      (dir === "flat" ? "—" : dir === "up" ? "↗" : "↘") + " " +
      esc(Math.abs(d)) + (o.deltaSuffix || "%") + "</span>";
    return '<div class="aqc-card">' +
      '<div class="aqc-card-top">' +
        '<span class="aqc-card-label">' + esc(o.label || "") + "</span>" + badge +
      "</div>" +
      '<div class="aqc-card-val">' + esc(o.value) +
        (o.unit ? '<span class="aqc-card-unit">' + esc(o.unit) + "</span>" : "") + "</div>" +
      (o.spark && o.spark.length > 1 ? sparkline(o.spark, o.sparkTone) : "") +
      (o.note ? '<div class="aqc-card-note">' + esc(o.note) + "</div>" : "") +
      "</div>";
  }

  function sparkline(values, tone) {
    var W = 120, H = 30, pad = 2;
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    var X = function (i) { return pad + (i / (values.length - 1)) * (W - pad * 2); };
    var Y = function (v) { return H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2); };
    var dd = values.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); }).join(" ");
    var col = tone || "var(--accent-bright)";
    return '<svg class="aqc-spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + dd + '" fill="none" stroke="' + col + '" stroke-width="1.8" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="' + X(values.length - 1).toFixed(1) + '" cy="' + Y(values[values.length - 1]).toFixed(1) +
      '" r="2.4" fill="' + col + '"/></svg>';
  }

  /* ------------------------------------------------------------------ area */

  /* A trend over time. Only ever drawn from points the caller actually has — the empty state
     says so rather than showing a flat line, which reads as "no change" and is a lie. */
  function area(points, o) {
    o = o || {};
    if (!points || points.length < 2) {
      return '<p class="aqc-empty">' + esc(o.empty || "Not enough history to draw a trend yet.") + "</p>";
    }
    var W = 640, H = o.height || 190, L = 34, R = 8, T = 10, B = 22;
    var vals = points.map(function (p) { return p.v; });
    var hi = Math.max.apply(null, vals);
    var lo = o.zeroBased === false ? Math.min.apply(null, vals) : 0;
    if (hi === lo) hi = lo + 1;
    var pad = (hi - lo) * 0.12; hi += pad;
    var X = function (i) { return L + (i / (points.length - 1)) * (W - L - R); };
    var Y = function (v) { return H - B - ((v - lo) / (hi - lo)) * (H - T - B); };
    var id = nid("aqcArea");

    var line = points.map(function (p, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1); }).join(" ");
    var fill = line + " L" + X(points.length - 1).toFixed(1) + " " + (H - B) +
               " L" + X(0).toFixed(1) + " " + (H - B) + " Z";

    /* Four gridlines and their values, so the shape can be read as numbers. */
    var grid = "", ticks = 4;
    for (var g = 0; g <= ticks; g++) {
      var v = lo + ((hi - lo) * g) / ticks, y = Y(v);
      grid += '<line class="aqc-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) +
        '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="aqc-axis" x="' + (L - 6) + '" y="' + (y + 3.5).toFixed(1) +
        '" text-anchor="end">' + Math.round(v) + "</text>";
    }
    var labels = points.map(function (p, i) {
      if (points.length > 9 && i % 2) return "";
      return '<text class="aqc-axis" x="' + X(i).toFixed(1) + '" y="' + (H - 6) +
        '" text-anchor="middle">' + esc(p.m) + "</text>";
    }).join("");
    var dots = points.map(function (p, i) {
      return '<circle class="aqc-dot" cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) +
        '" r="' + (i === points.length - 1 ? 4.2 : 2.6) + '"><title>' + esc(p.m) + ": " +
        esc(p.v) + "</title></circle>";
    }).join("");

    return '<div class="aqc-area"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' +
      esc(o.label || "Trend over time") + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="var(--accent-bright)" stop-opacity=".30"/>' +
      '<stop offset="100%" stop-color="var(--accent-bright)" stop-opacity="0"/></linearGradient></defs>' +
      grid +
      '<path d="' + fill + '" fill="url(#' + id + ')"/>' +
      '<path class="aqc-line" d="' + line + '" fill="none" stroke="var(--accent-bright)" ' +
      'stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' +
      dots + labels + "</svg></div>";
  }

  /* ------------------------------------------------------------------ bars */

  /* Comparison across categories. Stacked when a row carries several parts, which is how a
     status mix per chapter is read: the height is the total, the colours are the split. */
  function bars(rows, o) {
    o = o || {};
    if (!rows || !rows.length) {
      return '<p class="aqc-empty">' + esc(o.empty || "Nothing to compare yet.") + "</p>";
    }
    var W = 640, H = o.height || 210, L = 30, R = 8, T = 10, B = 34;
    var totals = rows.map(function (r) {
      return (r.parts || [{ v: r.v }]).reduce(function (n, p) { return n + (num(p.v) || 0); }, 0);
    });
    var hi = Math.max.apply(null, totals) || 1;
    if (o.max != null) hi = o.max;
    var bw = (W - L - R) / rows.length;
    var barW = Math.min(bw * 0.6, 42);

    var grid = "", ticks = 4;
    for (var g = 0; g <= ticks; g++) {
      var v = (hi * g) / ticks, y = T + (H - T - B) * (1 - g / ticks);
      grid += '<line class="aqc-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) +
        '" y2="' + y.toFixed(1) + '"/>' +
        '<text class="aqc-axis" x="' + (L - 6) + '" y="' + (y + 3.5).toFixed(1) +
        '" text-anchor="end">' + Math.round(v) + (o.pct ? "%" : "") + "</text>";
    }

    var body = rows.map(function (r, i) {
      var cx = L + bw * i + bw / 2;
      var parts = r.parts || [{ v: r.v, tone: r.tone }];
      var acc = 0, seg = "";
      parts.forEach(function (p) {
        var pv = num(p.v) || 0;
        if (pv <= 0) return;
        var h = ((pv / hi) * (H - T - B));
        var y = T + (H - T - B) - acc - h;
        acc += h;
        seg += '<rect class="aqc-bar" x="' + (cx - barW / 2).toFixed(1) + '" y="' + y.toFixed(1) +
          '" width="' + barW.toFixed(1) + '" height="' + Math.max(h, 0).toFixed(1) +
          '" rx="3" fill="' + (p.tone || "var(--accent-bright)") + '">' +
          "<title>" + esc(r.label) + " — " + esc(p.label || "") + " " + esc(p.v) +
          (o.pct ? "%" : "") + "</title></rect>";
      });
      return seg +
        '<text class="aqc-axis" x="' + cx.toFixed(1) + '" y="' + (H - 16) +
        '" text-anchor="middle">' + esc(r.label) + "</text>" +
        (r.sub ? '<text class="aqc-axis aqc-axis-sub" x="' + cx.toFixed(1) + '" y="' + (H - 4) +
          '" text-anchor="middle">' + esc(r.sub) + "</text>" : "");
    }).join("");

    return '<div class="aqc-bars"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' +
      esc(o.label || "Comparison") + '">' + grid + body + "</svg></div>" +
      (o.legend ? legend(o.legend) : "");
  }

  /* ----------------------------------------------------------------- rings */

  /* Concentric rings — the shape from the reference dashboard. Each ring is one series, so
     several proportions can be compared at a glance without three separate donuts. */
  function rings(segments, o) {
    o = o || {};
    if (!segments || !segments.length) {
      return '<p class="aqc-empty">' + esc(o.empty || "No data yet.") + "</p>";
    }
    var size = 168, cx = size / 2, cy = size / 2;
    var band = 13, gap = 6, r0 = cx - 10;
    var svg = segments.map(function (s, i) {
      var r = r0 - i * (band + gap);
      if (r < 14) return "";
      var C = 2 * Math.PI * r;
      var pct = Math.max(0, Math.min(100, num(s.pct) || 0)) / 100;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" fill="none" ' +
        'stroke="var(--surface-2)" stroke-width="' + band + '"/>' +
        '<circle class="aqc-ring" cx="' + cx + '" cy="' + cy + '" r="' + r.toFixed(1) + '" fill="none" ' +
        'stroke="' + (s.tone || "var(--accent-bright)") + '" stroke-width="' + band + '" ' +
        'stroke-linecap="round" stroke-dasharray="' + (C * pct).toFixed(2) + " " + C.toFixed(2) + '" ' +
        'transform="rotate(-90 ' + cx + " " + cy + ')"><title>' + esc(s.label) + " " +
        esc(s.pct) + "%</title></circle>";
    }).join("");

    var mid = o.centre
      ? '<div class="aqc-ring-centre"><b>' + esc(o.centre.value) + "</b><span>" +
        esc(o.centre.label || "") + "</span></div>"
      : "";

    return '<div class="aqc-rings"><div class="aqc-ring-wrap">' +
      '<svg viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' +
      esc(o.label || "Proportions") + '">' + svg + "</svg>" + mid + "</div>" +
      '<div class="aqc-ring-legend">' + segments.map(function (s) {
        return '<div class="aqc-legend-row"><i style="background:' + (s.tone || "var(--accent-bright)") +
          '"></i><span>' + esc(s.label) + "</span><b>" + esc(s.pct) + "%</b></div>";
      }).join("") + "</div></div>";
  }

  function legend(items) {
    return '<div class="aqc-legend">' + items.map(function (l) {
      return '<span class="aqc-legend-item"><i style="background:' + (l.tone || "var(--accent-bright)") +
        '"></i>' + esc(l.label) + (l.value != null ? " <b>" + esc(l.value) + "</b>" : "") + "</span>";
    }).join("") + "</div>";
  }

  /* --------------------------------------------------------------- callout */

  /* The two sentences a manager actually acts on: what is working, and what is about to cost
     them. Deliberately a component rather than free text so it cannot be skipped. */
  function callout(o) {
    return '<div class="aqc-callout aqc-callout-' + (o.tone || "info") + '">' +
      '<div class="aqc-callout-k">' + esc(o.kicker || "") + "</div>" +
      '<div class="aqc-callout-h">' + esc(o.title || "") + "</div>" +
      (o.body ? '<p>' + esc(o.body) + "</p>" : "") +
      (o.items && o.items.length
        ? "<ul>" + o.items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"
        : "") + "</div>";
  }

  return { card: card, sparkline: sparkline, area: area, bars: bars, rings: rings,
           legend: legend, callout: callout, esc: esc };
})();
