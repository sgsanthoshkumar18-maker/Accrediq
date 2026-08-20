/* AQcredix — post-audit analysis.
 *
 * Renders what the audit means: how ready the department actually is, where the gaps
 * cluster, what training the findings imply, and who owes what by when. Printable via
 * the browser's own print path — a print stylesheet beats bundling a PDF library for a
 * document this simple.
 */
window.AQAuditReport = (function () {
  "use strict";

  var A = window.AQAudit;
  var esc = function (s) { return A.esc(s); };

  function donut(sc) {
    var segs = [
      { k: "compliant", n: sc.counts.compliant, c: "var(--ok)" },
      { k: "partial", n: sc.counts.partial, c: "var(--warn)" },
      { k: "nc", n: sc.counts.nc, c: "var(--nc)" },
      { k: "na", n: sc.counts.na, c: "var(--fg-faint)" },
      { k: "unassessed", n: sc.counts.unassessed, c: "var(--border)" }
    ];
    var total = segs.reduce(function (n, s) { return n + s.n; }, 0) || 1;
    var C = 2 * Math.PI * 54, off = 0;
    var arcs = segs.filter(function (s) { return s.n; }).map(function (s) {
      var len = (s.n / total) * C;
      var el = '<circle cx="70" cy="70" r="54" fill="none" stroke="' + s.c +
        '" stroke-width="22" stroke-dasharray="' + len.toFixed(2) + " " + (C - len).toFixed(2) +
        '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 70 70)"/>';
      off += len;
      return el;
    }).join("");
    return '<svg viewBox="0 0 140 140" width="150" height="150" role="img" aria-label="Compliance breakdown">' +
      arcs +
      '<text x="70" y="66" text-anchor="middle" font-size="26" font-weight="600" fill="currentColor">' +
      sc.weighted + '%</text>' +
      '<text x="70" y="86" text-anchor="middle" font-size="10" fill="currentColor" opacity=".55">READINESS</text></svg>';
  }

  function chapterStrip(sc) {
    return '<div class="aud-heat">' + A.CH_ORDER.map(function (ck) {
      var c = sc.byChapter[ck];
      if (!c) return "";
      var tone = c.pct >= 90 ? "ok" : c.pct >= 75 ? "warn" : "bad";
      return '<div class="aud-heat-cell ' + tone + '" title="' + esc(c.name) + '">' +
        '<span class="ch">' + esc(ck) + '</span><span class="pc">' + c.pct + '%</span>' +
        '<span class="ct">' + c.applicable + ' applicable</span></div>';
    }).join("") + "</div>";
  }

  function render(host, session) {
    var sc = A.score(session);
    var training = A.trainingNeeds(sc);
    var owners = A.ownerMatrix(sc);
    var days = A.reauditDays(sc);
    var next = new Date(Date.now() + days * 86400000);
    var dur = session.duration_seconds != null ? session.duration_seconds : A.elapsedSeconds(session);

    var h = "";
    h += '<div class="aud-report" id="audReport">';

    h += '<div class="aud-rep-head">' +
      "<div><h2>" + esc(session.department_name) + " — internal audit result</h2>" +
      '<p class="aud-sub">' + esc(session.auditor_name) + " · " +
      new Date(session.started_at).toLocaleString() + " · " + A.fmtDuration(dur) +
      " · " + esc(session.standard_edition) + "</p></div>" +
      '<div class="aud-rep-actions no-print">' +
      '<button type="button" class="btn btn-accent" id="audXlsx">Download Excel</button> ' +
      '<button type="button" class="btn btn-ghost" id="audPrint">Print / save as PDF</button>' +
      "</div></div>";

    h += '<div class="aud-rep-grid">' +
      '<div class="aud-card aud-score">' + donut(sc) +
      '<div class="aud-band aud-band-' + sc.band.key + '">' + esc(sc.band.label) + "</div>" +
      "<p>" + esc(sc.band.note) + "</p>" +
      '<dl class="aud-mini">' +
      "<div><dt>Weighted</dt><dd>" + sc.weighted + "%</dd></div>" +
      "<div><dt>Unweighted</dt><dd>" + sc.plain + "%</dd></div>" +
      "<div><dt>Applicable</dt><dd>" + sc.applicable + " of " + sc.total + "</dd></div>" +
      "</dl></div>";

    h += '<div class="aud-card"><h3>Breakdown</h3><ul class="aud-legend">' +
      '<li><i class="sw ok"></i>Compliant<b>' + sc.counts.compliant + "</b></li>" +
      '<li><i class="sw warn"></i>Partially compliant<b>' + sc.counts.partial + "</b></li>" +
      '<li><i class="sw bad"></i>Non-compliant<b>' + sc.counts.nc + "</b></li>" +
      '<li><i class="sw na"></i>Not applicable<b>' + sc.counts.na + "</b></li>" +
      '<li><i class="sw un"></i>Unassessed<b>' + sc.counts.unassessed + "</b></li>" +
      "</ul>" +
      (sc.coreOpen ? '<p class="aud-flag">' + sc.coreOpen +
        " Core-category element" + (sc.coreOpen === 1 ? " is" : "s are") +
        " still open. Core failures carry the most weight in an assessment.</p>" : "") +
      (sc.sopOpen ? '<p class="aud-flag">' + sc.sopOpen +
        " open element" + (sc.sopOpen === 1 ? "" : "s") + " require a documented procedure.</p>" : "") +
      "</div></div>";

    h += '<div class="aud-card"><h3>How this score is calculated</h3>' +
      "<p>Unweighted readiness is <code>(C + 0.5 × PC) \u00F7 applicable elements</code>, " +
      "where applicable excludes anything marked Not Applicable. The weighted figure applies " +
      "the same category weights the Readiness page uses — Core counts for more than " +
      "Excellence — so a Core non-conformity cannot be diluted by a run of easy wins. " +
      "Both are shown because the unweighted number is the one people expect and the " +
      "weighted one is the more honest.</p>" +
      '<p class="aud-caveat">This is an internal self-assessment of one department against ' +
      "the NABH 5th Edition assessor checklist. It is not an NABH opinion, and an assessor " +
      "will not reproduce this number.</p></div>";

    h += '<div class="aud-card"><h3>Where the gaps sit</h3>' + chapterStrip(sc) + "</div>";

    h += '<div class="aud-card"><h3>Findings to close (' + sc.open.length + ")</h3>";
    if (!sc.open.length) {
      h += "<p>No non-conformities or partial compliances were recorded.</p>";
    } else {
      h += '<table class="aud-table"><thead><tr><th>Severity</th><th></th><th>Element</th>' +
        "<th>Responsible</th><th>Due</th></tr></thead><tbody>";
      sc.open.forEach(function (r) {
        var f = r.finding;
        h += "<tr><td><span class=\"aud-sev aud-sev-" + esc(f.severity || "observation") + '">' +
          esc(f.severity || "observation") + "</span></td>" +
          '<td><span class="aud-chip aud-' + esc(f.status) + '">' +
          esc(A.STATUS[f.status].short) + "</span></td>" +
          "<td><b>" + esc(r.code) + "</b> " + esc(r.text) +
          (f.evidence ? '<div class="aud-ev">' + esc(f.evidence) + "</div>" : "") + "</td>" +
          "<td>" + esc(f.owner || "—") + "</td><td>" + esc(f.due_date || "—") + "</td></tr>";
      });
      h += "</tbody></table>";
    }
    h += "</div>";

    h += '<div class="aud-card"><h3>Training implied by these findings</h3>';
    if (!training.length) {
      h += "<p>Nothing in this audit points to a specific training need.</p>";
    } else {
      h += '<table class="aud-table"><thead><tr><th>Standard</th><th>Topic</th>' +
        "<th>Findings</th><th>Recommended</th></tr></thead><tbody>";
      training.forEach(function (t) {
        h += "<tr><td><b>" + esc(t.standard) + "</b></td><td>" + esc(t.topic) + "</td>" +
          "<td>" + t.count + " (" + esc(t.worst) + ")</td><td>" + esc(t.mode) + "</td></tr>";
      });
      h += "</tbody></table>";
    }
    h += "</div>";

    h += '<div class="aud-card"><h3>Who owes what</h3>';
    if (!owners.length) {
      h += "<p>Nothing outstanding.</p>";
    } else {
      h += '<table class="aud-table"><thead><tr><th>Person</th><th>Open</th>' +
        "<th>Earliest due</th><th>Worst</th><th>Elements</th><th></th></tr></thead><tbody>";
      owners.forEach(function (o) {
        var sub = "Internal audit findings — " + session.department_name;
        var body = "Findings assigned to you from the internal audit of " +
          session.department_name + " on " + new Date(session.started_at).toLocaleDateString() +
          ":\n\n" + o.codes.join("\n") + "\n\nEarliest target closure: " + (o.earliest || "not set");
        h += "<tr><td>" + esc(o.owner) + "</td><td>" + o.count + "</td>" +
          "<td>" + esc(o.earliest || "—") + "</td><td>" + esc(o.worst) + "</td>" +
          '<td class="aud-codes">' + esc(o.codes.join(", ")) + "</td>" +
          '<td class="no-print"><a class="btn btn-ghost btn-sm" href="mailto:?subject=' +
          encodeURIComponent(sub) + "&body=" + encodeURIComponent(body) +
          '">Notify</a></td></tr>';
      });
      h += "</tbody></table>" +
        '<p class="aud-caveat">Notify opens your own mail client with the list. ' +
        "Nothing is sent from here on your behalf.</p>";
    }
    h += "</div>";

    h += '<div class="aud-card"><h3>Next steps</h3><ol class="aud-next">' +
      "<li>Every non-conformity and partial compliance above has been written into " +
      '<a href="capa.html">NC &amp; CAPA</a> with source “internal audit”. ' +
      "Root cause and verification are recorded there, not here.</li>" +
      "<li>Suggested re-audit date: <b>" + next.toISOString().slice(0, 10) + "</b> (" +
      days + " days), set by the worst severity present.</li>" +
      "<li>Keep the exported workbook with the department file — an assessor will ask " +
      "to see your internal audit records, and the dated Excel is that evidence.</li>" +
      "</ol></div>";

    h += "</div>";
    host.innerHTML = h;

    var xb = host.querySelector("#audXlsx");
    if (xb) xb.addEventListener("click", function () {
      xb.disabled = true; xb.textContent = "Building…";
      window.AQAuditExcel.download(session).then(function () {
        xb.disabled = false; xb.textContent = "Download Excel";
      }, function (e) {
        xb.disabled = false; xb.textContent = "Download Excel";
        alert("Could not build the workbook: " + (e.message || e));
      });
    });
    var pb = host.querySelector("#audPrint");
    if (pb) pb.addEventListener("click", function () { window.print(); });
  }

  return { render: render };
})();
