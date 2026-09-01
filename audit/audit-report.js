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

    /* ------------------------------------------------------------- analysis
       A score tells a quality manager where they are. It does not tell them what to do on
       Monday. This block answers the two questions that actually drive that: what is holding
       up, and what is most likely to cost them on the day.

       Everything below is computed from findings that were actually recorded — no ranking is
       invented, and where there is nothing to say the block says so. */
    if (window.AQCharts) {
      var C = window.AQCharts;
      var chapters = Object.keys(sc.byChapter).map(function (k) { return sc.byChapter[k]; })
        .filter(function (c) { return c.applicable > 0; });
      var ranked = chapters.slice().sort(function (a, b) { return b.pct - a.pct; });
      var best = ranked[0], worst = ranked[ranked.length - 1];

      /* What would actually cost accreditation: open findings on Core elements, worst first.
         sc.open is already sorted by severity, so taking from the front is taking the most
         serious. */
      var coreRisk = sc.open.filter(function (r) {
        return /^core$/i.test(r.category || "");
      });

      h += '<div class="aud-analysis">';

      h += '<div class="aqc-cards">' +
        C.card({ label: "Readiness (weighted)", value: sc.weighted, unit: "%",
                 note: sc.band.label }) +
        C.card({ label: "Elements assessed", value: sc.assessed + " / " + sc.applicable,
                 note: sc.counts.unassessed ? sc.counts.unassessed + " left unassessed"
                                            : "Every applicable element was assessed" }) +
        C.card({ label: "Findings to close", value: sc.open.length,
                 note: sc.open.length ? "Non-conformities and partial compliances" : "Nothing open" }) +
        C.card({ label: "Core elements open", value: sc.coreOpen,
                 note: sc.coreOpen ? "These carry the most weight" : "No Core element is open" }) +
        "</div>";

      h += '<div class="aqc-grid-2" style="margin-top:16px">';

      h += '<div class="aqc-panel"><h3>Where the result comes from</h3>' +
        C.rings([
          { label: "Compliant", pct: sc.applicable ? Math.round(sc.counts.compliant / sc.applicable * 100) : 0, tone: "var(--ok)" },
          { label: "Partially compliant", pct: sc.applicable ? Math.round(sc.counts.partial / sc.applicable * 100) : 0, tone: "var(--warn)" },
          { label: "Non-compliant", pct: sc.applicable ? Math.round(sc.counts.nc / sc.applicable * 100) : 0, tone: "var(--nc)" }
        ], { centre: { value: sc.weighted + "%", label: "Readiness" }, label: "Status mix" }) +
        "</div>";

      h += '<div class="aqc-panel"><h3>Readiness by chapter</h3>' +
        C.bars(ranked.map(function (c) {
          return { label: c.code, sub: c.pct + "%", v: c.pct,
                   tone: c.pct >= 85 ? "var(--ok)" : c.pct >= 60 ? "var(--warn)" : "var(--nc)" };
        }), { max: 100, pct: true, label: "Readiness by chapter",
              empty: "No chapter had an applicable element in this scope." }) +
        '<p class="aud-sub" style="margin-top:10px">Weighted within each chapter, so a Core ' +
        "failure pulls its chapter down further than an Excellence one.</p></div>";

      h += "</div>";

      /* The two sentences worth acting on. */
      h += '<div class="aqc-grid-2" style="margin-top:16px">';
      if (best) {
        h += C.callout({
          tone: "good", kicker: "Strongest area",
          title: best.name + " — " + best.pct + "%",
          body: "This chapter is the most complete in this department: " +
            best.counts.compliant + " of " + best.applicable +
            " applicable elements fully compliant. It is the part of this department worth " +
            "showing an assessor first, and the practice worth copying into the weaker areas."
        });
      }
      if (coreRisk.length) {
        h += C.callout({
          tone: "bad", kicker: "What would cost you",
          title: coreRisk.length + " Core element" + (coreRisk.length === 1 ? "" : "s") + " still open",
          body: "Core elements carry the heaviest weight in an assessment and are not offset " +
            "by strong performance elsewhere. Close these before anything else on the list:",
          items: coreRisk.slice(0, 5).map(function (r) {
            return r.code + " — " + r.text.slice(0, 96) + (r.text.length > 96 ? "…" : "") +
              (r.finding.owner ? "  (" + r.finding.owner +
                (r.finding.due_date ? ", due " + r.finding.due_date : "") + ")" : "");
          })
        });
      } else if (worst && worst.pct < 100) {
        h += C.callout({
          tone: "warn", kicker: "Weakest area",
          title: worst.name + " — " + worst.pct + "%",
          body: "No Core element is open, so nothing here is an immediate threat to the " +
            "result. This chapter is where the remaining ground is: " +
            (worst.counts.nc + worst.counts.partial) + " element" +
            ((worst.counts.nc + worst.counts.partial) === 1 ? " is" : "s are") + " still short."
        });
      } else {
        h += C.callout({
          tone: "good", kicker: "Nothing open",
          title: "Every applicable element was met",
          body: "No non-conformities or partial compliances were recorded in this department. " +
            "Re-audit on the schedule below rather than treating this as settled."
        });
      }
      h += "</div></div>";
    }

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

    /* THE QUICK LIST AS A RESULT, NOT A CHECKLIST.
       What the department physically has is the first thing an assessor establishes, and it
       is the part a spreadsheet audit usually loses. Absent items are listed by name rather
       than summarised, because "9 of 13 present" tells nobody what to go and fix. */
    var ql = A.quickSummary(session);
    if (ql.total) {
      /* Scored, not counted. "9 of 13 present" overstates a department where four of those
         nine exist with gaps — and that gap is exactly what an assessor opens first. */
      var qgroups = [
        ["Fully in place", ql.present, "ok"],
        ["In place, with gaps", ql.partial, "warn"],
        ["Missing or not working",
          ql.rows.filter(function (r) { return r.status === "nc"; })
                 .map(function (r) { return r.item; }), "bad"],
        ["Not scored",
          ql.rows.filter(function (r) { return r.status === "unassessed"; })
                 .map(function (r) { return r.item; }), "un"],
        ["Not applicable here", ql.na, "na"]
      ].filter(function (g) { return g[1].length; });

      h += '<div class="aud-card aud-quickrep"><h3>What the department has — walked, not ' +
        "read off a file</h3>" +
        '<div class="aud-qbar" role="img" aria-label="' + ql.pct +
        '% compliance on the walk-the-floor list"><span style="width:' + ql.pct +
        '%"></span></div>' +
        '<p class="aud-sub"><b>' + ql.pct + "%</b> across " + ql.applicable +
        " applicable item" + (ql.applicable === 1 ? "" : "s") +
        " — full credit for fully in place, half for in place with gaps, and Not Applicable " +
        "excluded from the denominator." +
        (ql.unassessed ? " <b>" + ql.unassessed + " item" +
          (ql.unassessed === 1 ? " was" : "s were") + " left unscored</b> and counts against " +
          "the figure: an item nobody looked at is not evidence of compliance." : "") +
        '</p><div class="aud-qcols">';
      qgroups.forEach(function (g) {
        h += "<div><h4>" + esc(g[0]) + " (" + g[1].length + ")</h4>" +
          '<ul class="aud-qlist ' + g[2] + '">' +
          g[1].map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("") + "</ul></div>";
      });
      h += "</div></div>";
    }

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
