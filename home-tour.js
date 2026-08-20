/* AQcredix — the homepage tour.
 *
 * Every workspace page is behind the paywall, so a visitor cannot see the thing they are
 * being asked to pay for. This plays through them like a short film: eight frames,
 * advancing on a timer, with a progress bar and manual controls.
 *
 * WHY SKETCHES AND NOT SCREENSHOTS. Screenshots of a real workspace would either show
 * invented hospital data as though it were real, or show an empty demo account that makes
 * the product look unused. Sketches drawn from the actual page structure say "this is what
 * it does" without either lie. Each is labelled, and the label is not decoration.
 *
 * It plays on its own because a visitor will not press play on something they have not
 * been given a reason to want yet — but it stops the moment they take control, and it
 * never plays under reduced motion.
 */
(function () {
  "use strict";

  var host = document.getElementById("tourStage");
  if (!host) return;

  var reduce = false;
  try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var FRAMES = [
    {
      key: "dashboard",
      label: "My department",
      caption: "Each department opens one screen and sees only what it owns.",
      html:
        '<div class="tr-head"><b>Biomedical</b><span class="tr-chip">1 overdue · 1 finding</span></div>' +
        row("Defibrillator — ICU bed 4", "Calibration · yearly", "59 days overdue", "bad") +
        row("Autoclave — CSSD 1", "Preventive · quarterly", "Due 10 Nov", "") +
        row("Ventilator AMC", "Renewal · yearly", "Due 20 Jan", "") +
        '<div class="tr-note">Committees and other departments are hidden here on purpose — ' +
          "showing everything would bury the four things this department actually owns.</div>"
    },
    {
      key: "readiness",
      label: "Readiness",
      caption: "Every Objective Element, scored. Where you stand today, chapter by chapter.",
      html:
        '<div class="tr-head"><b>Accreditation readiness</b><span class="tr-chip">NABH 5th Edition</span></div>' +
        '<div class="tr-score"><div class="tr-ring"><span>68<i>%</i></span></div>' +
          '<div class="tr-legend">' +
            '<div><b>437</b><span>Met</span></div>' +
            '<div><b>121</b><span>Partial</span></div>' +
            '<div><b>82</b><span>Not met</span></div>' +
          "</div></div>" +
        '<div class="tr-bars">' +
          bar("AAC", 74) + bar("COP", 61) + bar("MOM", 80) + bar("IPC", 55) + bar("PSQ", 72) +
        "</div>"
    },
    {
      key: "standards",
      label: "Standards",
      caption: "All 640 elements, with what an assessor looks for and the gap that becomes an NC.",
      html:
        '<div class="tr-head"><b>IPC.2.c</b><span class="tr-chip warn">\u2726 SOP required</span></div>' +
        '<div class="tr-quote">“Adequate and appropriate facilities for hand hygiene in all ' +
          'patient-care areas are accessible.”</div>' +
        '<div class="tr-sub">What the assessor looks for</div>' +
        '<ul class="tr-list"><li>Rub within reach at the point of care</li>' +
          "<li>Your own audit data, not an assertion</li>" +
          "<li>Staff able to name the five moments</li></ul>"
    },
    {
      key: "departments",
      label: "SOP by department",
      caption: "188 SOP-required elements, each with the departments answerable for it.",
      html:
        '<div class="tr-head"><b>Which departments hold this SOP?</b></div>' +
        '<div class="tr-tags"><span>Emergency Room</span><span>ICU</span><span>Wards</span>' +
          "<span>Operation Theatre</span><span>Laboratory</span><span>Dialysis</span></div>" +
        '<div class="tr-sub">Export</div>' +
        '<div class="tr-sheet"><div class="tr-sh tr-sh-h"><span>Element</span><span>Departments</span></div>' +
          '<div class="tr-sh"><span>IPC.2.c</span><span>6 departments</span></div>' +
          '<div class="tr-sh"><span>COP.5.a</span><span>ICU, ER, Wards</span></div>' +
          '<div class="tr-sh"><span>MOM.6.a</span><span>Pharmacy</span></div></div>'
    },
    {
      key: "calendar",
      label: "Compliance calendar",
      caption: "Committees and recurring obligations, with what is overdue today.",
      html:
        '<div class="tr-head"><b>This week</b></div>' +
        row("Hand hygiene audit", "Monthly · Infection Control", "14 days overdue", "bad") +
        row("Crash cart check", "Monthly · every ward", "6 days overdue", "bad") +
        row("Infection Control Committee", "Quarterly", "Due Monday", "warn") +
        row("Fire drill", "Half-yearly · Facilities", "Due 4 Nov", "")
    },
    {
      key: "register",
      label: "Equipment register",
      caption: "Calibration, maintenance, AMCs and licences — per machine, with certificates.",
      html:
        '<div class="tr-head"><b>Biomedical</b><span class="tr-chip">42 items</span></div>' +
        row("Defibrillator — ICU bed 4", "Calibration · yearly", "58 days overdue", "bad") +
        row("Autoclave — CSSD 1", "Preventive · quarterly", "Due 10 Aug", "warn") +
        row("Ventilator AMC", "Renewal · yearly", "Due 20 Jan", "") +
        row("Blood gas analyser", "Calibration · half-yearly", "Due in 2 days", "warn")
    },
    {
      key: "rounds",
      label: "Rounds & checklists",
      caption: "Any recurring check that produces a score — trended against your own target.",
      html:
        '<div class="tr-head"><b>Hand hygiene compliance round</b><span class="tr-chip">Target 90%</span></div>' +
        '<div class="tr-run"><span>Rub available at the point of care</span><em class="ok">Yes</em></div>' +
        '<div class="tr-run"><span>Five moments known when asked</span><em class="no">No</em></div>' +
        '<div class="tr-run"><span>Training record matches roster</span><em class="ok">Yes</em></div>' +
        '<div class="tr-live">67% · below target — raise a CAPA against it</div>'
    },
    {
      key: "capa",
      label: "NC & CAPA",
      caption: "Findings tracked to closure — and never closed by whoever raised them.",
      html:
        '<div class="tr-head"><b>Open findings</b><span class="tr-chip warn">3 overdue</span></div>' +
        row("Hand hygiene below target", "IPC.2.c · Dr Menon", "Verification due", "warn") +
        row("Crash cart drug expired", "COP.5.a · ICU", "Corrective action", "bad") +
        '<div class="tr-note">A finding cannot be verified or closed by the person who ' +
          "raised it. The database refuses it.</div>"
    },
    {
      key: "bell",
      label: "Notifications",
      caption: "It tells people, rather than waiting for them to look.",
      html:
        '<div class="tr-head"><b>\u2691 1 overdue · 1 open finding in Biomedical</b></div>' +
        '<div class="tr-sub">Overdue</div>' +
        row("Defibrillator — ICU bed 4", "Equipment · 59 days overdue", "", "bad") +
        '<div class="tr-sub">Weekly email</div>' +
        '<div class="tr-run"><span>Email me a weekly summary</span><em class="ok">On</em></div>' +
        '<div class="tr-run"><span>Overdue only</span><em>Off</em></div>' +
        '<div class="tr-note">Nobody is ever emailed to be told nothing is wrong.</div>'
    },
    {
      key: "onboarding",
      label: "Guided setup",
      caption: "A new hospital is walked through setup in about ten minutes.",
      html:
        '<div class="tr-head"><b>Getting set up</b><span class="tr-chip">1 of 6 · 10 min left</span></div>' +
        '<div class="tr-bars"><div class="tr-bar"><span></span><i><b style="width:17%"></b></i><em>17%</em></div></div>' +
        '<div class="tr-run"><span>✓ Add your departments and people</span><em class="ok">4 on the team</em></div>' +
        '<div class="tr-run"><span>Enter your committees</span><em>Next</em></div>' +
        '<div class="tr-run"><span>Build the equipment register</span><em></em></div>' +
        '<div class="tr-run"><span>Set up your rounds</span><em></em></div>' +
        '<div class="tr-note">Each step marks itself done by detecting real records — never ' +
          "by ticking a box.</div>"
    },
    {
      key: "evidence",
      label: "Evidence files",
      caption: "The certificate itself, attached to the record it proves.",
      html:
        '<div class="tr-head"><b>Defibrillator — ICU bed 4</b>' +
          '<span class="tr-chip">Calibration · 13 Aug 2026</span></div>' +
        '<div class="tr-run"><span>Certificate ZL/CAL/2026/4471 · Pass</span><em class="ok">Recorded</em></div>' +
        '<div class="tr-sub">Evidence</div>' +
        '<div class="tr-run"><span>ZOLL-calibration-2026.pdf</span><em>412 KB</em></div>' +
        '<div class="tr-run"><span>crash-cart-photo.jpg</span><em>1.2 MB</em></div>' +
        '<div class="tr-note">Private storage, links expire in two minutes, and each ' +
          "hospital can reach only its own files.</div>"
    },
    {
      key: "library",
      label: "Forms & registers",
      caption: "Every checklist, form and register a department must maintain, in one place.",
      html:
        '<div class="tr-head"><b>Biomedical</b><span class="tr-chip">16 documents</span></div>' +
        row("Planned Preventive Maintenance", "Register · detailed", "Downloadable", "") +
        row("Material Gate Pass", "Checklist · detailed", "Downloadable", "") +
        row("Work Permit", "Register · detailed", "Downloadable", "") +
        '<div class="tr-note">What each document must contain, why it matters, and a blank ' +
          "template — segregated by department.</div>"
    },
    {
      key: "gatepass",
      label: "Gate pass",
      caption: "What left the building, why, and whether it comes back.",
      html:
        '<div class="tr-head"><b>Security</b><span class="tr-chip warn">1 overdue return</span></div>' +
        row("Pass #050 — Dell Optiplex 3020 MT", "Service · IT", "Due back – 12 days overdue", "bad") +
        row("Pass #049 — UPS battery", "Disposal · Facilities", "Non-returnable", "") +
        '<div class="tr-note">Returnable and non-returnable, the way security already runs ' +
          "it — with what is still outstanding answered in one screen.</div>"
    },
    {
      key: "apex",
      label: "Apex manual",
      caption: "Nine guided sections, and a Word document your hospital owns.",
      html:
        '<div class="tr-head"><b>Quality Manual</b><span class="tr-chip">62% complete</span></div>' +
        '<div class="tr-bars"><div class="tr-bar"><span></span><i><b style="width:62%"></b></i><em>62%</em></div></div>' +
        '<div class="tr-run"><span>Committees</span><em class="ok">Pulled from your calendar</em></div>' +
        '<div class="tr-run"><span>Chapter-by-chapter coverage</span><em>7 of 10</em></div>' +
        '<div class="tr-note">Answers save as you type; the download can never be older than ' +
          "what is on screen.</div>"
    },
    {
      key: "export",
      label: "Assessment day",
      caption: "Every SOP, committee and cycle with its record. Exported in one press.",
      html:
        '<div class="tr-head"><b>Export</b><span class="tr-chip">Excel · 4 sheets</span></div>' +
        '<div class="tr-sheet"><div class="tr-sh tr-sh-h"><span>Element</span><span>Departments</span></div>' +
          '<div class="tr-sh"><span>IPC.2.c</span><span>All clinical areas</span></div>' +
          '<div class="tr-sh"><span>COP.5.a</span><span>ICU, Wards, ER</span></div>' +
          '<div class="tr-sh"><span>FMS.5.a</span><span>Facilities, Security</span></div>' +
          '<div class="tr-sh"><span>MOM.6.a</span><span>Pharmacy</span></div></div>' +
        '<div class="tr-note">188 SOP-required elements, each with the departments ' +
          "answerable for it.</div>"
    }
  ];

  function bar(code, pct) {
    return '<div class="tr-bar"><span>' + code + '</span>' +
      '<i><b style="width:' + pct + '%"></b></i><em>' + pct + "%</em></div>";
  }

  function row(title, meta, pill, kind) {
    return '<div class="tr-row' + (kind ? " is-" + kind : "") + '">' +
      "<div><b>" + title + "</b><span>" + meta + "</span></div>" +
      '<em class="' + (kind || "") + '">' + pill + "</em></div>";
  }

  /* --------------------------------- playback --------------------------------- */

  var DWELL = 4200;          // long enough to read a caption, short enough not to stall
  var i = 0, timer = null, playing = false, touched = false;

  function paint() {
    host.innerHTML = FRAMES.map(function (f, n) {
      return '<div class="tr-frame' + (n === i ? " is-on" : "") + '">' + f.html + "</div>";
    }).join("");

    document.getElementById("tourCaption").innerHTML =
      '<span class="tr-label">' + FRAMES[i].label + "</span>" + FRAMES[i].caption;

    document.getElementById("tourDots").innerHTML = FRAMES.map(function (f, n) {
      return '<button class="tr-dot' + (n === i ? " is-on" : "") + '" data-n="' + n +
        '" type="button" aria-label="' + f.label + '"><i></i></button>';
    }).join("");

    var bar = document.querySelector(".tr-dot.is-on i");
    if (bar && playing) {
      /* Restarting the animation requires it to be removed and re-added; setting the same
         class again does nothing, so the bar would freeze on the second frame. */
      bar.style.animation = "none";
      void bar.offsetWidth;
      bar.style.animation = "trFill " + DWELL + "ms linear forwards";
    }
  }

  function go(n) {
    i = (n + FRAMES.length) % FRAMES.length;
    paint();
  }

  function tick() { go(i + 1); }

  function play() {
    if (playing) return;
    playing = true;
    document.getElementById("tourPlay").textContent = "Pause";
    paint();
    timer = setInterval(tick, DWELL);
  }

  function pause() {
    playing = false;
    document.getElementById("tourPlay").textContent = "Play";
    clearInterval(timer);
    timer = null;
    var bar = document.querySelector(".tr-dot.is-on i");
    if (bar) bar.style.animation = "none";
  }

  function manual(n) {
    /* Once someone takes control, autoplay stops for good. Resuming after a manual choice
       yanks the frame away mid-read, which is the single most irritating thing a carousel
       does. */
    touched = true;
    pause();
    go(n);
  }

  document.getElementById("tourDots").addEventListener("click", function (e) {
    var d = e.target.closest(".tr-dot");
    if (d) manual(Number(d.dataset.n));
  });
  document.getElementById("tourPrev").addEventListener("click", function () { manual(i - 1); });
  document.getElementById("tourNext").addEventListener("click", function () { manual(i + 1); });
  document.getElementById("tourPlay").addEventListener("click", function () {
    if (playing) { touched = true; pause(); } else play();
  });

  paint();

  if (reduce) {
    // No autoplay, and the controls still work. The content is the point.
    document.getElementById("tourPlay").textContent = "Play";
    return;
  }

  /* Only play while on screen, and never in a hidden tab. A carousel cycling behind a
     background tab burns battery to show nobody anything. */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (touched) return;
        en.isIntersecting ? play() : pause();
      });
    }, { threshold: 0.35 }).observe(host);
  } else play();

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause();
    else if (!touched) play();
  });
})();
