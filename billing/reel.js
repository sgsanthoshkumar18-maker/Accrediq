/* AQcredix — the animated preview reel.
 *
 * A static sample table shows what a page contains. It does not show what the page DOES,
 * and "does" is what someone weighing ₹500 a month is actually buying. So each gated page
 * gets a short auto-playing presentation: three or four scenes with real motion, showing
 * the problem, the product working on it, and the outcome.
 *
 * WHY NOT ACTUAL VIDEO. A video file for eighteen pages is a hundred megabytes to host, it
 * cannot be edited without re-recording, it is unreadable on a slow hospital connection,
 * and it cannot adapt to a phone. Animated SVG and CSS give the same effect at a few
 * kilobytes, stay sharp at any size, and can be corrected in a text editor. The visitor
 * cannot tell the difference; you can, every time you want to change a word.
 *
 * It plays automatically because a visitor will not press play on something they have not
 * yet been given a reason to want. It stops the moment they take control, never plays
 * under reduced motion, and never runs in a background tab.
 */
window.AQReel = (function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* Each scene: a caption, and an SVG or markup stage. Scenes are written to tell one
     small story in order — the pain, the mechanism, the result — because a sequence of
     unrelated screenshots persuades nobody. */
  var REELS = {

    dashboard: {
      title: "My department",
      line: "Every team sees only what it owns.",
      scenes: [
        { cap: "Monday morning. Nobody knows what is overdue.",
          svg: sceneQuestion() },
        { cap: "One screen, filtered to Biomedical.",
          svg: sceneFilter() },
        { cap: "Three things overdue. Named, dated, owned.",
          svg: sceneList([
            ["Defibrillator \u2014 ICU bed 4", "59 days overdue", "bad"],
            ["Hand hygiene round", "43 days overdue", "bad"],
            ["Gas pipeline check", "24 days overdue", "bad"]
          ]) },
        { cap: "The quality manager stops forwarding PDFs.",
          svg: sceneDone("Each department opens its own screen") }
      ]
    },

    register: {
      title: "Equipment & licence register",
      line: "The calibration history an assessor asks for, per machine.",
      scenes: [
        { cap: "An assessor points at one machine and asks for its history.",
          svg: sceneQuestion("Show me this defibrillator's calibration record") },
        { cap: "Every item carries its own cycle and certificates.",
          svg: sceneAsset() },
        { cap: "Overdue surfaces before the assessor finds it.",
          svg: sceneList([
            ["Defibrillator \u2014 ICU bed 4", "Calibration \u00b7 59 days overdue", "bad"],
            ["Autoclave \u2014 CSSD 1", "Preventive \u00b7 due 10 Nov", "ok"],
            ["Fire NOC", "Renewal \u00b7 due 2 Nov", "warn"]
          ]) },
        { cap: "Certificate ZL/CAL/2026/4471 attached to the record.",
          svg: sceneDone("Evidence, not a promise that evidence exists") }
      ]
    },

    rounds: {
      title: "Rounds & checklists",
      line: "Any recurring check that produces a score.",
      scenes: [
        { cap: "Walk the round on a phone. Tap yes, no, N/A.",
          svg: sceneTap() },
        { cap: "The score updates as you go.",
          svg: sceneScore(67) },
        { cap: "Below target, so it cannot quietly pass.",
          svg: sceneList([
            ["Hand hygiene round \u00b7 ICU", "67% against a 90% target", "bad"],
            ["A critical item failed", "Fails outright, whatever the average", "bad"]
          ]) },
        { cap: "Raise a CAPA, linked to the round that found it.",
          svg: sceneDone("Findings that trace back to their evidence") }
      ]
    },

    capa: {
      title: "NC & CAPA",
      line: "Findings tracked to closure \u2014 properly.",
      scenes: [
        { cap: "A finding is raised.",
          svg: sceneQuestion("Hand hygiene 67%, below target") },
        { cap: "The person who raised it tries to close it.",
          svg: sceneBlocked() },
        { cap: "The database refuses. A colleague verifies instead.",
          svg: sceneList([
            ["Raised by", "Dr Menon", "ok"],
            ["Verified by", "Sister Lakshmi", "ok"]
          ]) },
        { cap: "Self-closure is a finding in itself. Not here.",
          svg: sceneDone("Segregation of duties, enforced in the database") }
      ]
    },

    calendar: {
      title: "Compliance calendar",
      line: "Committees and recurring obligations, worked out for you.",
      scenes: [
        { cap: "Tell it when the committee last met, and how often it must.",
          svg: sceneForm() },
        { cap: "Every date after that is calculated.",
          svg: sceneDates() },
        { cap: "Overdue first, so nothing waits to be remembered.",
          svg: sceneList([
            ["Hand hygiene audit", "43 days overdue", "bad"],
            ["Infection Control Committee", "Due Monday", "warn"],
            ["Fire drill", "Due 4 Nov", "ok"]
          ]) },
        { cap: "A weekly email reaches the people who never log in.",
          svg: sceneDone("It tells them, rather than waiting to be asked") }
      ]
    },

    readiness: {
      title: "Accreditation readiness",
      line: "Where you actually stand, element by element.",
      scenes: [
        { cap: "640 Objective Elements. Which ones are you weak on?",
          svg: sceneQuestion("We think we're ready. We're not sure.") },
        { cap: "Score each one. The picture builds as you go.",
          svg: sceneScore(68) },
        { cap: "Chapter by chapter, so effort goes where it is needed.",
          svg: sceneBars() },
        { cap: "Walk into assessment knowing the answer.",
          svg: sceneDone("No surprises on the day") }
      ]
    },

    sop: {
      title: "SOPs by department",
      line: "Who is answerable for which written procedure.",
      scenes: [
        { cap: "188 elements require an SOP. Which department owns each?",
          svg: sceneQuestion("Who writes this one?") },
        { cap: "Every element mapped to the departments that hold it.",
          svg: sceneList([
            ["IPC.2.c", "All clinical areas", "ok"],
            ["MOM.6.a", "Pharmacy", "ok"],
            ["FMS.5.a", "Facilities, Security", "ok"]
          ]) },
        { cap: "Export the whole matrix in one press.",
          svg: sceneDone("A spreadsheet an assessor accepts") }
      ]
    },

    kpi: {
      title: "KPI library",
      line: "The indicators expected, and how each is calculated.",
      scenes: [
        { cap: "Which indicators must we report, and how exactly?",
          svg: sceneQuestion("What counts as the denominator?") },
        { cap: "Each one defined, with its formula and frequency.",
          svg: sceneList([
            ["Hand hygiene compliance", "Taken \u00f7 observed \u00d7 100 \u00b7 monthly", "ok"],
            ["Medication error rate", "Errors \u00f7 patient days \u00d7 1000", "ok"],
            ["Return to ICU < 48h", "Unplanned \u00f7 discharges \u00d7 100", "ok"]
          ]) },
        { cap: "Consistent numbers, month after month.",
          svg: sceneDone("Trends that mean something") }
      ]
    },

    tools: {
      title: "Quality tools",
      line: "Working tools, not diagrams to look at.",
      scenes: [
        { cap: "Hand hygiene fell to 67%. Why?",
          svg: sceneQuestion("Nobody knows the root cause") },
        { cap: "Five Why, worked through and recorded.",
          svg: sceneWhy() },
        { cap: "The cause found: nobody was named to check rub levels.",
          svg: sceneDone("A cause you can actually act on") }
      ]
    },

    videos: {
      title: "Video library",
      line: "Short explainers on the elements teams find hardest.",
      scenes: [
        { cap: "Some elements are genuinely hard to interpret.",
          svg: sceneQuestion("What does reconciliation actually require?") },
        { cap: "Short, specific, tied to the element.",
          svg: sceneList([
            ["Medication reconciliation", "MOM.4.e \u00b7 6 min", "ok"],
            ["What an assessor asks on hand hygiene", "IPC.2.c \u00b7 8 min", "ok"],
            ["Writing a CAPA that closes", "PSQ \u00b7 5 min", "ok"]
          ]) },
        { cap: "Train a new nurse in an afternoon.",
          svg: sceneDone("Understanding, not memorising") }
      ]
    },

    standards: {
      title: "The standards, explained",
      line: "Every element in plain terms.",
      scenes: [
        { cap: "The published standard is dense, and now costs ₹6,000.",
          svg: sceneQuestion("What does this element actually require?") },
        { cap: "Each one explained by a practising pharmacist.",
          svg: sceneExplain() },
        { cap: "With what an assessor looks for, and the gap that becomes an NC.",
          svg: sceneDone("Written to be understood, not recited") }
      ]
    },

    committees: {
      title: "Committees",
      line: "Which committees, how often, and who sits on them.",
      scenes: [
        { cap: "Which committees must a hospital actually run?",
          svg: sceneQuestion("And how often must each meet?") },
        { cap: "Each one, with frequency, chair and quorum.",
          svg: sceneList([
            ["Infection Control Committee", "Quarterly \u00b7 Microbiologist", "ok"],
            ["Pharmacy & Therapeutics", "Quarterly \u00b7 Medical Superintendent", "ok"],
            ["Quality Assurance", "Monthly \u00b7 Quality Manager", "ok"]
          ]) },
        { cap: "Feeding straight into the calendar.",
          svg: sceneDone("Sittings tracked, not remembered") }
      ]
    },

    codealerts: {
      title: "Code alerts",
      line: "The colour codes, the response, and the drill record.",
      scenes: [
        { cap: "Code Blue is called. Who responds, and how?",
          svg: sceneQuestion("Does everyone know their part?") },
        { cap: "Each code defined, with the team and the protocol.",
          svg: sceneList([
            ["Code Blue", "Cardiopulmonary arrest \u00b7 drilled half-yearly", "ok"],
            ["Code Red", "Fire \u00b7 drilled half-yearly", "ok"],
            ["Code Pink", "Abduction \u00b7 not yet drilled", "warn"]
          ]) },
        { cap: "With the drill record an assessor asks to see.",
          svg: sceneDone("Rehearsed, not just written down") }
      ]
    },

    audit: {
      title: "Internal audit",
      line: "Department-scoped, timed, findings straight to CAPA.",
      scenes: [
        { cap: "Internal audit due. Where do you even start?",
          svg: sceneQuestion("Which elements apply to Pharmacy?") },
        { cap: "Scope built from the assessor checklist, per department.",
          svg: sceneList([
            ["Pharmacy", "34 elements in scope", "ok"],
            ["Intensive Care", "41 elements in scope", "ok"],
            ["CSSD", "28 elements in scope", "ok"]
          ]) },
        { cap: "Every finding needs an owner and a date before you can finish.",
          svg: sceneDone("Audits that produce action, not paper") }
      ]
    },

    incidents: {
      title: "Incident reporting",
      line: "Four levels, one-hour window, RCA built in.",
      scenes: [
        { cap: "An incident happens. It gets written on paper, then lost.",
          svg: sceneQuestion("Was it reported within the hour?") },
        { cap: "Classified, timed, and tracked from the moment it is entered.",
          svg: sceneList([
            ["Level 3 \u00b7 Patient fall", "Reported in 22 min \u00b7 RCA complete", "ok"],
            ["Level 2 \u00b7 Wrong strength, intercepted", "Near miss \u00b7 in review", "warn"]
          ]) },
        { cap: "No patient identifiers stored. By design.",
          svg: sceneDone("The printed form carries them, in pen") }
      ]
    },

    icd: {
      title: "ICD-11 lookup",
      line: "Search the classification without leaving the platform.",
      scenes: [
        { cap: "Coding a diagnosis means leaving to search elsewhere.",
          svg: sceneQuestion("What is the ICD-11 code for this?") },
        { cap: "Search by term or code, in place.",
          svg: sceneList([
            ["5A11", "Type 2 diabetes mellitus", "ok"],
            ["BA00", "Essential hypertension", "ok"],
            ["CA40", "Pneumonia", "ok"]
          ]) },
        { cap: "Coding accuracy an assessor can check.",
          svg: sceneDone("One place, one workflow") }
      ]
    },

    quiz: {
      title: "Today\u2019s quiz",
      line: "Free with an account. No subscription needed.",
      scenes: [
        { cap: "Ten questions a day, drawn from the standards.",
          svg: sceneQuestion("Which evidence would an assessor accept?") },
        { cap: "Answer, and find out why \u2014 not just whether.",
          svg: sceneList([
            ["Your own observed audit data", "Correct \u00b7 evidence, not assertion", "ok"],
            ["A signed policy document", "A policy is not proof it happens", "bad"]
          ]) },
        { cap: "Your score history builds, and the certificate carries your name.",
          svg: sceneDone("Free \u2014 an account is all it takes") }
      ]
    },

    gap: {
      title: "Gap analysis",
      line: "What is missing, and what closing it takes.",
      scenes: [
        { cap: "Where are we actually short?",
          svg: sceneQuestion("And what would close it?") },
        { cap: "Every element, judged and recorded.",
          svg: sceneList([
            ["MOM.4.e", "Not met \u00b7 no defined process", "bad"],
            ["IPC.2.c", "Partially met \u00b7 audit data missing", "warn"],
            ["FMS.5.a", "Met \u00b7 drill records current", "ok"]
          ]) },
        { cap: "A plan, not an anxiety.",
          svg: sceneDone("Effort where it changes the score") }
      ]
    }
  };

  /* --------------------------- scene builders ---------------------------
     Plain SVG with CSS animation. Each returns markup only; the timing classes are added
     by the player so a scene animates when it becomes visible, not on page load. */

  function sceneQuestion(q) {
    return '<svg viewBox="0 0 400 200" class="rl-svg" role="img" aria-label="' +
      esc(q || "An open question") + '">' +
      '<circle class="rl-pulse" cx="200" cy="88" r="34" />' +
      '<text class="rl-q" x="200" y="98" text-anchor="middle">?</text>' +
      '<text class="rl-cap-svg" x="200" y="160" text-anchor="middle">' +
        esc(q || "") + "</text></svg>";
  }

  function sceneFilter() {
    return '<svg viewBox="0 0 400 200" class="rl-svg" aria-hidden="true">' +
      [0, 1, 2, 3, 4, 5].map(function (i) {
        var y = 26 + i * 27;
        var keep = i === 1 || i === 3;
        return '<rect class="rl-bar ' + (keep ? "rl-keep" : "rl-drop") + '" ' +
          'style="animation-delay:' + (i * 90) + 'ms" x="60" y="' + y +
          '" width="280" height="18" rx="5"/>';
      }).join("") +
      '<text class="rl-cap-svg" x="200" y="192" text-anchor="middle">Biomedical only</text>' +
      "</svg>";
  }

  function sceneList(items) {
    return '<div class="rl-rows">' + items.map(function (it, i) {
      return '<div class="rl-row rl-' + it[2] + '" style="animation-delay:' + (i * 220) + 'ms">' +
        "<b>" + esc(it[0]) + "</b><span>" + esc(it[1]) + "</span></div>";
    }).join("") + "</div>";
  }

  function sceneAsset() {
    return '<div class="rl-card">' +
      '<div class="rl-card-h">Defibrillator \u2014 ICU bed 4</div>' +
      '<div class="rl-kv"><span>Serial</span><b>ZOLL-R-88213</b></div>' +
      '<div class="rl-kv"><span>Cycle</span><b>Calibration \u00b7 yearly</b></div>' +
      '<div class="rl-kv"><span>Last done</span><b>15 June 2025</b></div>' +
      '<div class="rl-kv rl-late"><span>Status</span><b>59 days overdue</b></div>' +
      "</div>";
  }

  function sceneTap() {
    return '<div class="rl-tap">' +
      '<div class="rl-tap-q">Alcohol rub available at the point of care</div>' +
      '<div class="rl-tap-btns">' +
        '<span class="rl-tap-b rl-hit" style="animation-delay:200ms">Yes</span>' +
        '<span class="rl-tap-b">No</span><span class="rl-tap-b">N/A</span>' +
      "</div>" +
      '<div class="rl-tap-q">Five moments known when asked</div>' +
      '<div class="rl-tap-btns">' +
        '<span class="rl-tap-b">Yes</span>' +
        '<span class="rl-tap-b rl-hit rl-no" style="animation-delay:900ms">No</span>' +
        '<span class="rl-tap-b">N/A</span>' +
      "</div></div>";
  }

  function sceneScore(pct) {
    return '<div class="rl-score">' +
      '<div class="rl-ring" style="--pct:' + pct + '"><span>' + pct + '<i>%</i></span></div>' +
      "</div>";
  }

  function sceneBars() {
    return '<div class="rl-bars">' +
      [["AAC", 74], ["COP", 61], ["MOM", 80], ["IPC", 55], ["PSQ", 72], ["FMS", 58]]
      .map(function (c, i) {
        return '<div class="rl-barrow"><span>' + c[0] + '</span>' +
          '<i><b style="--w:' + c[1] + '%;animation-delay:' + (i * 120) + 'ms"></b></i>' +
          "<em>" + c[1] + "%</em></div>";
      }).join("") + "</div>";
  }

  function sceneBlocked() {
    return '<div class="rl-blocked">' +
      '<div class="rl-btn-dead">Move to verified</div>' +
      '<div class="rl-tip">A finding cannot be verified or closed by the person who ' +
      "raised it.</div></div>";
  }

  function sceneForm() {
    return '<div class="rl-card">' +
      '<div class="rl-kv"><span>Committee</span><b>Infection Control</b></div>' +
      '<div class="rl-kv"><span>How often</span><b>Quarterly</b></div>' +
      '<div class="rl-kv"><span>Last met</span><b>12 May 2026</b></div>' +
      '<div class="rl-kv"><span>Prefers</span><b>Monday</b></div></div>';
  }

  function sceneDates() {
    return '<div class="rl-dates">' +
      '<div class="rl-date" style="animation-delay:120ms"><b>12 Aug</b><span>exact interval</span></div>' +
      '<div class="rl-arrow">\u2192</div>' +
      '<div class="rl-date rl-on" style="animation-delay:420ms"><b>10 Aug</b><span>nearest Monday</span></div>' +
      "</div>";
  }

  function sceneWhy() {
    return '<div class="rl-why">' +
      ["Rub was empty in three of six bays",
       "Nobody was named to check levels each shift",
       "The task was never written into the handover"]
      .map(function (t, i) {
        return '<div class="rl-why-r" style="animation-delay:' + (i * 260) + 'ms">' +
          "<span>" + (i + 1) + "</span>" + esc(t) + "</div>";
      }).join("") + "</div>";
  }

  function sceneExplain() {
    return '<div class="rl-card rl-quote">' +
      '<div class="rl-card-h">MOM.4.e</div>' +
      "<p>Reconcile medicines at every transition in care \u2014 to confirm what the patient " +
      "is taking still matches the current picture, and that nothing carried over is now " +
      "working against it.</p></div>";
  }

  function sceneDone(text) {
    return '<div class="rl-done">' +
      '<svg viewBox="0 0 60 60" class="rl-check" aria-hidden="true">' +
      '<circle cx="30" cy="30" r="26"/>' +
      '<path d="M18 31l8 8 16-17"/></svg>' +
      "<div>" + esc(text) + "</div></div>";
  }

  /* --------------------------------- player --------------------------------- */

  var DWELL = 3400;

  function render(key, baseHref) {
    var reel = REELS[key];
    if (!reel) return "";
    var b = baseHref || "";

    return '<div class="rl" data-reel-key="' + esc(key) + '">' +
      '<div class="rl-head">' +
        '<span class="rl-tag">A short look</span>' +
        "<h2>" + esc(reel.title) + "</h2>" +
        "<p>" + esc(reel.line) + "</p>" +
      "</div>" +
      '<div class="rl-stage">' +
        reel.scenes.map(function (s, i) {
          return '<div class="rl-scene' + (i === 0 ? " is-on" : "") + '" data-i="' + i + '">' +
            '<div class="rl-art">' + s.svg + "</div>" +
            '<div class="rl-cap">' + esc(s.cap) + "</div></div>";
        }).join("") +
      "</div>" +
      '<div class="rl-bar-row">' +
        '<button class="rl-ctl" data-rl="play" type="button" aria-label="Pause">\u2016</button>' +
        '<div class="rl-dots">' + reel.scenes.map(function (s, i) {
          return '<button class="rl-dot' + (i === 0 ? " is-on" : "") + '" data-rl-i="' + i +
            '" type="button" aria-label="Scene ' + (i + 1) + '"><i></i></button>';
        }).join("") + "</div>" +
      "</div>" +
      '<div class="rl-cta">' +
        '<a class="btn btn-accent" href="' + b + 'plans.html">See plans and pricing</a> ' +
        '<a class="btn btn-ghost" href="' + b + 'workspace/workspace.html">Sign in</a>' +
      "</div></div>";
  }

  /* Wiring is separate from rendering so the markup can be produced server-side or in a
     test without a DOM. */
  function attach(root) {
    var host = (root || document).querySelector(".rl");
    if (!host) return;

    var scenes = [].slice.call(host.querySelectorAll(".rl-scene"));
    var dots = [].slice.call(host.querySelectorAll(".rl-dot"));
    var ctl = host.querySelector('[data-rl="play"]');
    var i = 0, timer = null, playing = false, touched = false;

    var reduce = false;
    try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

    function show(n) {
      i = (n + scenes.length) % scenes.length;
      scenes.forEach(function (s, k) { s.classList.toggle("is-on", k === i); });
      dots.forEach(function (d, k) { d.classList.toggle("is-on", k === i); });
      var fill = dots[i] && dots[i].querySelector("i");
      if (fill && playing && !reduce) {
        /* Restarting a CSS animation needs the property removed and the element reflowed;
           setting the same value again does nothing and the bar freezes on scene two. */
        fill.style.animation = "none";
        void fill.offsetWidth;
        fill.style.animation = "rlFill " + DWELL + "ms linear forwards";
      }
    }

    function play() {
      if (playing || reduce) return;
      playing = true;
      if (ctl) { ctl.textContent = "\u2016"; ctl.setAttribute("aria-label", "Pause"); }
      show(i);
      timer = setInterval(function () { show(i + 1); }, DWELL);
    }

    function pause() {
      playing = false;
      if (ctl) { ctl.textContent = "\u25B6"; ctl.setAttribute("aria-label", "Play"); }
      clearInterval(timer); timer = null;
      var fill = dots[i] && dots[i].querySelector("i");
      if (fill) fill.style.animation = "none";
    }

    /* Once someone takes control, autoplay stops for good. Resuming after a manual choice
       pulls the scene away mid-read, which is the most irritating thing a carousel does. */
    function manual(n) { touched = true; pause(); show(n); }

    dots.forEach(function (d) {
      d.addEventListener("click", function () { manual(Number(d.dataset.rlI)); });
    });
    if (ctl) ctl.addEventListener("click", function () {
      if (playing) { touched = true; pause(); } else play();
    });

    if (reduce) { pause(); return; }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (touched) return;
          en.isIntersecting ? play() : pause();
        });
      }, { threshold: 0.4 }).observe(host);
    } else play();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else if (!touched) play();
    });
  }

  return { render: render, attach: attach, REELS: REELS, DWELL: DWELL };
})();
