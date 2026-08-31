/* AQcredix — Quality Dashboard, department analytics and editing.
 *
 * WHAT A QUALITY MANAGER NEEDS FROM THIS SCREEN, in order: which KPIs are off target, by how
 * much, which way they are moving, and the ability to put their own hospital's numbers in.
 * The previous drill-down answered only the first, and only by reading a table.
 *
 * ON NOT INVENTING DATA. The KPI figures shipped with the site are illustrative, and the
 * trend chart is the honest test of that: there is no historical series to draw, so rather
 * than generating a plausible-looking line the chart stays empty until someone enters real
 * monthly values. A fabricated trend on a quality dashboard is worse than no trend — it is
 * the kind of number that ends up in an assessor's hands.
 *
 * PERSISTENCE. Edits are written to localStorage, keyed by organisation when the workspace
 * knows one, so a hospital's numbers survive a reload and stay separate from the demo data.
 * If AQStore is running against Supabase and a dept_overrides table exists, the same payload
 * is mirrored there so the whole team sees it; the mirror failing never blocks the save.
 */
window.AQDeptAnalytics = (function () {
  "use strict";

  var LS = "aq-dept-overrides";

  /* ---------------------------------------------------------------- storage */

  function orgKey() {
    try {
      var u = window.AQStore && window.AQStore.currentUser && window.AQStore.currentUser();
      if (u && typeof u.then === "function") return LS;          /* a promise: fall back */
      if (u && u.org_id) return LS + ":" + u.org_id;
    } catch (e) {}
    return LS;
  }
  function readAll() {
    try { return JSON.parse(window.localStorage.getItem(orgKey()) || "{}") || {}; } catch (e) { return {}; }
  }
  function writeAll(o) {
    try { window.localStorage.setItem(orgKey(), JSON.stringify(o)); } catch (e) {}
    /* Best-effort share with the rest of the hospital. A missing table is not an error the
       user should ever see — their save already succeeded locally. */
    try {
      if (window.AQStore && window.AQStore.adapter &&
          window.AQStore.isConfigured && window.AQStore.isConfigured()) {
        var p = window.AQStore.adapter.put("dept_overrides", { id: orgKey(), data: o });
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }
  /* A department as the dashboard should show it: shipped content with this hospital's
     edits laid over the top. Never mutates the source array. */
  function merged(d) {
    var ov = readAll()[d.id];
    if (!ov) return d;
    var out = {};
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) out[k] = d[k];
    if (ov.score != null) out.score = ov.score;
    if (ov.kra) out.kra = ov.kra;
    if (ov.kpi) out.kpi = ov.kpi;
    if (ov.trend) out.trend = ov.trend;
    out.edited = true;
    return out;
  }
  function save(id, patch) {
    var all = readAll();
    all[id] = all[id] || {};
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) all[id][k] = patch[k];
    writeAll(all);
    /* Everything else on the site that shows a department score listens for this. */
    try { window.dispatchEvent(new CustomEvent("aq:dept-updated", { detail: { id: id } })); } catch (e) {}
  }
  function resetDept(id) {
    var all = readAll(); delete all[id]; writeAll(all);
    try { window.dispatchEvent(new CustomEvent("aq:dept-updated", { detail: { id: id } })); } catch (e) {}
  }

  /* ------------------------------------------------------------ permissions */

  /* Who may edit. In local mode the data lives in this browser and belongs to whoever is
     sitting at it, so editing is open. Against a real backend it is the roles that own
     quality: the hospital's owner/admin and the quality manager. */
  function canEdit() {
    try {
      if (!window.AQStore || !window.AQStore.isConfigured || !window.AQStore.isConfigured()) return true;
      var u = window.AQStore.currentUser();
      if (!u || typeof u.then === "function") return false;
      return ["owner", "admin", "quality", "quality_manager", "director"].indexOf(u.role) >= 0;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ maths */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(s) {
    var m = String(s).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  /* A target reads like "≥ 80%", "< 2.0" or "100%". The comparator is what decides whether
     bigger is better, which is what decides whether a bar is doing well. */
  function parseTarget(t) {
    var s = String(t), v = num(s);
    var higher = /[≥>]/.test(s) ? true : /[≤<]/.test(s) ? false : null;
    return { value: v, higherIsBetter: higher };
  }
  /* Attainment as a fraction of target, clamped so one wild outlier cannot flatten the rest
     of the chart. Returns null when the pair cannot be read as numbers — a KPI measured in
     words still belongs in the table, just not in the bars. */
  function attainment(val, target) {
    var v = num(val), t = parseTarget(target);
    if (v == null || t.value == null || t.value === 0) return null;
    var frac = t.higherIsBetter === false ? t.value / v : v / t.value;
    if (!isFinite(frac) || frac < 0) return null;
    return Math.min(frac, 1.5);
  }
  function statusOf(s) { return s === "ok" ? "ok" : s === "watch" ? "watch" : "risk"; }
  function statusLabel(s) {
    return s === "ok" ? "On target" : s === "watch" ? "Needs attention" : "At risk";
  }

  /* ----------------------------------------------------------------- charts */

  /* A ring rather than a bar: a score out of 100 is a proportion of a whole, and a ring says
     that without needing an axis. */
  function gauge(score) {
    var R = 46, C = 2 * Math.PI * R, pct = Math.max(0, Math.min(100, score)) / 100;
    var tone = score >= 85 ? "var(--ok)" : score >= 70 ? "var(--warn)" : "var(--nc)";
    return '<svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label="Department score ' + score + ' out of 100">' +
      '<circle cx="56" cy="56" r="' + R + '" fill="none" stroke="var(--surface-2)" stroke-width="10"/>' +
      '<circle cx="56" cy="56" r="' + R + '" fill="none" stroke="' + tone + '" stroke-width="10" ' +
        'stroke-linecap="round" stroke-dasharray="' + (C * pct).toFixed(2) + ' ' + C.toFixed(2) + '" ' +
        'transform="rotate(-90 56 56)"/></svg>';
  }

  function bars(kpi) {
    var rows = kpi.map(function (k) {
      var name = k[0], val = k[1], target = k[2], st = statusOf(k[3]);
      var a = attainment(val, target);
      /* The track is scaled so the target sits at two-thirds across: a bar can then overshoot
         visibly instead of pinning at 100% and hiding how far ahead it is. */
      var pct = a == null ? 0 : Math.min(a / 1.5, 1) * 100;
      return '<div class="da-bar-row">' +
        '<div class="da-bar-name">' + esc(name) + '</div>' +
        '<div class="da-bar-val">' + esc(val) + ' <span style="opacity:.6">vs ' + esc(target) + '</span></div>' +
        '<div class="da-bar-track">' +
          (a == null ? '' : '<div class="da-bar-fill ' + st + '" style="width:' + pct.toFixed(1) + '%"></div>') +
          '<div class="da-bar-target" style="left:66.6%" title="target"></div>' +
        '</div></div>';
    }).join("");
    return '<div class="da-bars">' + rows + '</div>' +
      '<p class="da-sub">The upright mark is the target. A bar past it is ahead of target; short of it is behind.</p>';
  }

  /* The trend is drawn only from values someone actually entered. */
  function trend(series) {
    if (!series || series.length < 2) {
      return '<p class="da-trend-empty">No monthly history entered yet. Open <strong>Edit figures</strong> and add ' +
        'this department&#39;s score month by month — the trend line appears once there are two or more points. ' +
        'Nothing is generated for you here: a quality trend has to be your hospital&#39;s real numbers.</p>';
    }
    var W = 560, H = 150, PAD = 8;
    var vals = series.map(function (p) { return p.v; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) { hi = lo + 1; lo = lo - 1; }
    var pad = (hi - lo) * 0.18; lo -= pad; hi += pad;
    var X = function (i) { return PAD + (i / (series.length - 1)) * (W - PAD * 2); };
    var Y = function (v) { return H - PAD - ((v - lo) / (hi - lo)) * (H - PAD * 2 - 16); };
    var d = series.map(function (p, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1); }).join(" ");
    var area = d + " L" + X(series.length - 1).toFixed(1) + " " + (H - PAD) + " L" + X(0).toFixed(1) + " " + (H - PAD) + " Z";
    var dots = series.map(function (p, i) {
      return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="' +
        (i === series.length - 1 ? 4 : 2.6) + '" fill="var(--accent-bright)"/>';
    }).join("");
    var labels = series.map(function (p, i) {
      if (series.length > 8 && i % 2) return "";
      return '<text x="' + X(i).toFixed(1) + '" y="' + (H - 1) + '" text-anchor="middle" ' +
        'font-size="9" font-family="var(--font-mono)" fill="var(--fg-faint)">' + esc(p.m) + '</text>';
    }).join("");
    var first = series[0], last = series[series.length - 1];
    return '<div class="da-trend"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Department score by month">' +
      '<defs><linearGradient id="daFill" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="var(--accent-bright)" stop-opacity=".26"/>' +
        '<stop offset="100%" stop-color="var(--accent-bright)" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#daFill)"/>' +
      '<path d="' + d + '" fill="none" stroke="var(--accent-bright)" stroke-width="2.2" ' +
        'stroke-linejoin="round" stroke-linecap="round"/>' + dots + labels + '</svg></div>' +
      '<p class="da-sub">Latest ' + esc(last.v) + ' · ' + (last.v >= first.v ? "up" : "down") + ' ' +
        Math.abs(last.v - first.v).toFixed(1) + ' since ' + esc(first.m) + '.</p>';
  }

  function mix(kpi) {
    var c = { ok: 0, watch: 0, risk: 0 };
    kpi.forEach(function (k) { c[statusOf(k[3])]++; });
    var total = kpi.length || 1, R = 42, C = 2 * Math.PI * R, off = 0;
    var segs = [["ok", "var(--ok)"], ["watch", "var(--warn)"], ["risk", "var(--nc)"]].map(function (s) {
      var len = (c[s[0]] / total) * C;
      var el = '<circle cx="52" cy="52" r="' + R + '" fill="none" stroke="' + s[1] + '" stroke-width="14" ' +
        'stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" ' +
        'transform="rotate(-90 52 52)"/>';
      off += len; return len > 0.5 ? el : "";
    }).join("");
    var legend = [["On target", c.ok, "var(--ok)"], ["Needs attention", c.watch, "var(--warn)"], ["At risk", c.risk, "var(--nc)"]]
      .map(function (l) {
        return '<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--fg-muted)">' +
          '<i style="width:9px;height:9px;border-radius:50%;background:' + l[2] + ';flex-shrink:0"></i>' +
          esc(l[0]) + ' <b style="margin-left:auto;color:var(--fg);font-variant-numeric:tabular-nums">' + l[1] + '</b></div>';
      }).join("");
    return '<div class="da-gauge"><svg width="104" height="104" viewBox="0 0 104 104" role="img" ' +
      'aria-label="KPI status mix">' + segs + '</svg>' +
      '<div style="display:grid;gap:7px;flex:1;min-width:0">' + legend + '</div></div>';
  }

  /* ------------------------------------------------------------------ view */

  /* Counts pulled from the real element and committee data when those files are on the page,
     so the tiles show this department's actual chapter footprint rather than decoration. */
  function chapterFacts(d) {
    var out = {};
    try {
      var codes = (d.chapters && d.chapters.length ? d.chapters : [String(d.short || "").toUpperCase()]);
      /* NABH_DATA is chapter-keyed — { chapters: { AAC: { standards:[ { elements:[…] } ] } } } —
         so the counts come from walking it, not from filtering a flat list. */
      var ch = window.NABH_DATA && window.NABH_DATA.chapters;
      if (ch) {
        var core = 0, commitment = 0, total = 0, seen = false;
        codes.forEach(function (code) {
          var c = ch[String(code).toUpperCase()];
          if (!c || !c.standards) return;
          seen = true;
          c.standards.forEach(function (s) {
            (s.elements || []).forEach(function (e) {
              total++;
              var cat = String(e.category || "");
              if (/^core$/i.test(cat)) core++;
              else if (/^commitment$/i.test(cat)) commitment++;
            });
          });
        });
        if (seen) { out.core = core; out.commitment = commitment; out.elements = total; }
      }
      /* Committees declare the chapters they answer to, so this is a real link rather than a
         string search across the whole record. */
      if (window.COMMITTEE_DATA && Array.isArray(window.COMMITTEE_DATA)) {
        var cm = window.COMMITTEE_DATA.filter(function (c) {
          var refs = (c.refChapters || []).map(function (r) { return String(r).toUpperCase(); });
          return codes.some(function (code) { return refs.indexOf(String(code).toUpperCase()) >= 0; });
        });
        if (cm.length) out.committees = cm.length;
      }
    } catch (e) {}
    return out;
  }

  function tiles(d, extra) {
    var onTarget = d.kpi.filter(function (k) { return statusOf(k[3]) === "ok"; }).length;
    var t = [["Key result areas", d.kra.length], ["KPIs tracked", d.kpi.length],
             ["On target", onTarget + " / " + d.kpi.length]];
    if (extra.elements != null) t.push(["Elements in scope", extra.elements]);
    if (extra.core != null) t.push(["Core elements", extra.core]);
    if (extra.commitment != null) t.push(["Commitment elements", extra.commitment]);
    if (extra.committees != null) t.push(["Committees", extra.committees]);
    return '<div class="da-tiles">' + t.map(function (x) {
      return '<div class="da-tile"><div class="v">' + esc(x[1]) + '</div><div class="l">' + esc(x[0]) + '</div></div>';
    }).join("") + '</div>';
  }

  function readView(d) {
    var facts = chapterFacts(d);
    return '' +
      '<div class="da-wrap">' +
        '<div class="da-head">' +
          '<div class="da-title">' +
            '<span class="eyebrow">' + esc(d.short) + ' · Department</span>' +
            '<h2>' + esc(d.name) + '</h2>' +
            '<div class="da-persona">' + esc(d.persona || "") +
              (d.edited ? ' · <span style="color:var(--accent-text)">your hospital&#39;s figures</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="da-head-actions">' +
            (canEdit() ? '<button class="btn btn-ghost btn-sm" data-da="edit">Edit figures</button>' : '') +
            '<button class="dd-close" data-da="close" aria-label="Close department detail">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
              'stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
          '</div>' +
        '</div>' +
        tiles(d, facts) +
        '<div class="da-charts">' +
          '<div class="da-card"><h3>Department score</h3>' +
            '<div class="da-gauge">' + gauge(d.score) +
              '<div><div class="da-gauge-n">' + esc(d.score) +
                '<span style="font-size:17px;color:var(--fg-faint)">/100</span></div>' +
              '<div class="da-gauge-l">' + esc(statusLabel(d.status)) + '</div></div></div>' +
          '</div>' +
          '<div class="da-card"><h3>KPI performance against target</h3>' + bars(d.kpi) + '</div>' +
          '<div class="da-card"><h3>KPI status mix</h3>' + mix(d.kpi) + '</div>' +
          '<div class="da-card"><h3>Score by month</h3>' + trend(d.trend) + '</div>' +
        '</div>' +
        '<div class="da-card"><h3>KPIs tracked</h3>' +
          '<table class="da-table"><thead><tr><th>KPI</th><th>Current</th><th>Target</th><th>Status</th></tr></thead><tbody>' +
          d.kpi.map(function (k) {
            return '<tr><td data-l="KPI">' + esc(k[0]) + '</td>' +
              '<td data-l="Current" class="mono">' + esc(k[1]) + '</td>' +
              '<td data-l="Target" class="mono">' + esc(k[2]) + '</td>' +
              '<td data-l="Status"><span class="da-status ' + statusOf(k[3]) + '">' +
                esc(statusLabel(k[3])) + '</span></td></tr>';
          }).join("") + '</tbody></table></div>' +
        '<div class="da-card"><h3>Key result areas</h3><ul class="da-kra">' +
          d.kra.map(function (k, i) {
            return '<li><span class="kn">KRA-' + (i + 1) + '</span><span>' + esc(k) + '</span></li>';
          }).join("") + '</ul></div>' +
      '</div>';
  }

  function kpiRow(k) {
    var opts = [["ok", "On target"], ["watch", "Needs attention"], ["risk", "At risk"]].map(function (o) {
      return '<option value="' + o[0] + '"' + (statusOf(k[3]) === o[0] ? " selected" : "") + '>' + o[1] + '</option>';
    }).join("");
    return '<tr class="da-kpi-row">' +
      '<td data-l="KPI"><input class="da-edit-in" data-k="name" value="' + esc(k[0]) + '"></td>' +
      '<td data-l="Current"><input class="da-edit-in mono" data-k="val" value="' + esc(k[1]) + '"></td>' +
      '<td data-l="Target"><input class="da-edit-in mono" data-k="target" value="' + esc(k[2]) + '"></td>' +
      '<td data-l="Status"><select class="da-edit-in" data-k="status">' + opts + '</select></td>' +
      '<td><button class="da-row-del" data-da="del-kpi" aria-label="Remove this KPI">&times;</button></td></tr>';
  }
  function kraRow(text) {
    return '<div class="da-kra-row" style="margin-bottom:8px">' +
      '<input class="da-edit-in" data-k="kra" value="' + esc(text) + '">' +
      '<button class="da-row-del" data-da="del-kra" aria-label="Remove this KRA">&times;</button></div>';
  }

  function editView(d) {
    var months = (d.trend || []).map(function (p) { return p.m + ":" + p.v; }).join(", ");
    return '' +
      '<div class="da-wrap">' +
        '<div class="da-edit-bar">' +
          '<strong>Editing ' + esc(d.name) + '</strong> — these are your hospital&#39;s figures. ' +
          'They stay on this device unless your workspace is connected.' +
          '<span class="sp">' +
            '<button class="btn btn-ghost btn-sm" data-da="reset">Reset to sample</button>' +
            '<button class="btn btn-ghost btn-sm" data-da="cancel">Cancel</button>' +
            '<button class="btn btn-accent btn-sm" data-da="save">Save changes</button>' +
          '</span>' +
        '</div>' +
        '<div class="da-card"><h3>Department score</h3>' +
          '<input class="da-edit-in mono" type="number" min="0" max="100" step="1" data-f="score" value="' + esc(d.score) + '">' +
          '<p class="da-hint">0–100. This is what the tile, the globe and this page all show.</p>' +
        '</div>' +
        '<div class="da-card"><h3>KPIs</h3>' +
          '<table class="da-table"><thead><tr><th>KPI</th><th>Current</th><th>Target</th><th>Status</th><th></th></tr></thead>' +
          '<tbody id="daKpiBody">' + d.kpi.map(function (k) { return kpiRow(k); }).join("") + '</tbody></table>' +
          '<p class="da-hint" style="margin-top:10px">Write the target the way you measure it — ' +
            '<code>&ge; 80%</code>, <code>&lt; 2.0</code>, <code>100%</code>. The comparator tells the chart ' +
            'which direction is good.</p>' +
          '<button class="btn btn-ghost btn-sm" data-da="add-kpi" style="margin-top:10px">+ Add a KPI</button>' +
        '</div>' +
        '<div class="da-card"><h3>Key result areas</h3><div id="daKraBody">' +
          d.kra.map(function (k) { return kraRow(k); }).join("") + '</div>' +
          '<button class="btn btn-ghost btn-sm" data-da="add-kra" style="margin-top:10px">+ Add a KRA</button>' +
        '</div>' +
        '<div class="da-card"><h3>Score by month</h3>' +
          '<input class="da-edit-in mono" data-f="trend" value="' + esc(months) + '" placeholder="Apr:78, May:81, Jun:84">' +
          '<p class="da-hint">Month and score, comma separated. Leave it empty for no trend line — an empty ' +
            'chart is honest, an invented one is not.</p>' +
        '</div>' +
      '</div>';
  }

  /* ---------------------------------------------------------------- wiring */

  function parseTrend(s) {
    return String(s || "").split(",").map(function (part) {
      var bits = part.split(":");
      if (bits.length < 2) return null;
      var v = parseFloat(bits[1]);
      if (!isFinite(v)) return null;
      return { m: bits[0].trim().slice(0, 8), v: v };
    }).filter(Boolean);
  }

  function render(host, dept, editing) {
    var d = merged(dept);
    host.innerHTML = editing ? editView(d) : readView(d);
    host.classList.add("is-open");

    host.querySelectorAll("[data-da]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var a = btn.getAttribute("data-da");
        if (a === "close") {
          host.classList.remove("is-open");
          document.querySelectorAll(".dept-tile").forEach(function (t) { t.classList.remove("is-active"); });
        } else if (a === "edit") {
          render(host, dept, true);
          host.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (a === "cancel") {
          render(host, dept, false);
        } else if (a === "reset") {
          resetDept(dept.id); render(host, dept, false);
        } else if (a === "del-kpi") {
          btn.closest("tr").remove();
        } else if (a === "del-kra") {
          btn.closest(".da-kra-row").remove();
        } else if (a === "add-kpi") {
          host.querySelector("#daKpiBody").insertAdjacentHTML("beforeend", kpiRow(["", "", "", "ok"]));
        } else if (a === "add-kra") {
          host.querySelector("#daKraBody").insertAdjacentHTML("beforeend", kraRow(""));
        } else if (a === "save") {
          var score = parseInt(host.querySelector('[data-f="score"]').value, 10);
          var kpi = [].slice.call(host.querySelectorAll(".da-kpi-row")).map(function (tr) {
            var g = function (key) {
              var el = tr.querySelector('[data-k="' + key + '"]');
              return el ? el.value.trim() : "";
            };
            return [g("name"), g("val"), g("target"), g("status")];
          }).filter(function (r) { return r[0]; });
          var kra = [].slice.call(host.querySelectorAll('[data-k="kra"]'))
            .map(function (i) { return i.value.trim(); }).filter(Boolean);
          save(dept.id, {
            score: isFinite(score) ? Math.max(0, Math.min(100, score)) : dept.score,
            kpi: kpi,
            kra: kra,
            trend: parseTrend(host.querySelector('[data-f="trend"]').value)
          });
          render(host, dept, false);
          host.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  return { render: render, merged: merged, canEdit: canEdit, reset: resetDept };
})();
