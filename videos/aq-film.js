/* AQcredix — "The Gap". A 52-second film in three acts.
 *
 *   ACT I   BROADCAST  0–16s   the market fact, with news-bulletin urgency
 *   ACT II  THE WARD  16–34s   one quality manager at 02:14, as narrative
 *   ACT III PRODUCT   34–52s   the platform, as a launch film
 *
 * WHY A WEB ANIMATION AND NOT AN MP4. A video has one resolution and one aspect ratio.
 * This has to play on a phone, a laptop, a boardroom projector and a theatre screen, and
 * a 1080p file would be soft on the big ones and heavy on the small ones. The film is
 * composed once at 1920x1080 and the whole stage is scaled to whatever box it is given,
 * so the composition — every crop, every mask, every transition — is identical
 * everywhere. It is also a few kilobytes rather than a hundred megabytes, which matters
 * on hospital wifi, and the words can be corrected in a text editor.
 *
 * ONE CLOCK. Every beat is a timestamp in BEATS below, not a chain of setTimeouts. A
 * chain drifts, cannot be scrubbed, and cannot be paused honestly. A single clock means
 * seeking to 31s produces exactly the state the film has at 31s.
 *
 * EVERY NUMBER IS REAL. 639 objective elements, 45 audit departments, the PMJAY 10%
 * uplift, ₹500/month — all verified against the codebase and public sources. A film that
 * inflates its own figures is the one thing a hospital will actually check.
 */
(function () {
  "use strict";

  var DUR = 52;   // seconds

  /* -------------------------------------------------------------------------
     THE BEAT SHEET. [time, act, beat] — beat n turns on every [data-b="n"] in
     that act. Kept as data so the edit can be retimed without touching logic.
     ------------------------------------------------------------------------- */
  var BEATS = [
    // ACT I — broadcast
    [0.2,  1, 0], [0.9,  1, 1], [2.2,  1, 2], [4.0,  1, 3],
    [6.2,  1, 4], [8.0,  1, 5], [10.2, 1, 6], [12.4, 1, 7],
    // ACT II — the ward
    [16.0, 2, 0], [17.0, 2, 1], [18.4, 2, 2], [19.8, 2, 3],
    [21.2, 2, 4], [24.5, 2, 5], [26.5, 2, 6], [29.0, 2, 7], [31.0, 2, 8],
    // ACT III — product
    [34.0, 3, 0], [35.4, 3, 1], [37.0, 3, 2], [38.4, 3, 3], [39.8, 3, 4],
    [42.0, 3, 5], [43.6, 3, 6], [45.0, 3, 7], [46.6, 3, 8], [48.4, 3, 9]
  ];
  var RAMP = [[14.6, 15.6], [32.4, 33.4]];   // speed-ramp out of acts I and II
  var DIVE = [31.6, 33.2];                    // phone transition window

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------------------------------------------------------------- markup */
  function markup() {
    return '' +
    '<div class="aqf-stage"><div class="aqf-frame"><div class="aqf-film" data-act="1">' +

    /* ============================ ACT I ============================ */
    '<div class="aqf-act aqf-act-1">' +
      '<div class="aqf-scan"></div>' +
      '<div class="aqf-live" data-b="0" data-fx="wipe"><i></i>Live · Indian healthcare</div>' +
      '<div class="aqf-a1">' +
        '<div class="aqf-kicker" data-b="1" data-fx="wipe">The gap nobody reports</div>' +
        '<h2 class="aqf-head aqf-serif" data-b="1">India has <em>43,500</em> private hospitals.</h2>' +
        '<div class="aqf-figs">' +
          '<div class="aqf-fig" data-b="2" data-fx="slam">' +
            '<div class="n aqf-mono hot" data-count="4200">0</div>' +
            '<div class="l">are NABH accredited</div></div>' +
          '<div class="aqf-fig" data-b="3" data-fx="slam">' +
            '<div class="n aqf-mono dim" data-count="39300">0</div>' +
            '<div class="l">are not</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="aqf-bars" data-b="5">' +
        '<div class="aqf-bar" data-bar><div class="t"><span>Accredited</span><b>4,200</b></div>' +
          '<div class="track"><div class="fill fill-teal" style="--w:10%"></div></div></div>' +
        '<div class="aqf-bar" data-bar><div class="t"><span>Not accredited</span><b>39,300</b></div>' +
          '<div class="track"><div class="fill fill-red" style="--w:100%"></div></div></div>' +
      '</div>' +
      '<div class="aqf-lower" data-b="4" data-fx="wipe">' +
        '<div class="bar"></div><div class="txt aqf-serif">And the rules just changed.</div></div>' +
      '<div class="aqf-a1" style="top:auto;bottom:260px">' +
        '<h2 class="aqf-head aqf-serif" data-b="6" data-fx="land" style="font-size:78px">' +
          'PM-JAY now pays <em>+10%</em><br>on every claim you make.</h2>' +
        '<p data-b="7" style="font-size:28px;color:#8FA39D;margin:14px 0 0;max-width:44ch;line-height:1.45">' +
          'For the full two-year validity of an Entry Level certificate. Accreditation ' +
          'stopped being a plaque and became a line in the revenue.</p>' +
      '</div>' +
      '<div class="aqf-tick" data-b="0"><div class="run">' +
        '<span><b>NABH 6th Edition</b> · effective 1 January 2025</span>' +
        '<span><b>639</b> objective elements across 10 chapters</span>' +
        '<span>Entry Level required for insurer empanelment · <b>IRDA</b></span>' +
        '<span>Consultant engagement <b>₹3–25 lakh</b>, ends at certification</span>' +
        '<span><b>+10%</b> on every PM-JAY claim, for two years</span>' +
      '</div></div>' +
    '</div>' +

    /* ============================ ACT II ============================ */
    '<div class="aqf-act aqf-act-2">' +
      '<canvas class="aqf-field" data-field></canvas>' +
      '<div class="aqf-phone">' +
        '<div class="aqf-lock">' +
          '<div class="time aqf-mono" data-b="0">02:14</div>' +
          '<div class="date" data-b="0">Tuesday, 3 November</div>' +
          '<div class="aqf-notifs">' +
            '<div class="aqf-note" data-b="1"><div class="h">Biomedical</div>' +
              '<div class="m">Defibrillator calibration overdue — 9 days</div></div>' +
            '<div class="aqf-note" data-b="2"><div class="h">Quality</div>' +
              '<div class="m">IPC committee minutes not filed</div></div>' +
            '<div class="aqf-note" data-b="3"><div class="h">Licence</div>' +
              '<div class="m">Blood bank licence expires in 6 days</div></div>' +
            '<div class="aqf-note" data-b="4"><div class="h">Assessment</div>' +
              '<div class="m">Surveillance visit — 21 days</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="aqf-cap aqf-serif" data-b="6" data-fx="wipe-up">Evidence lives in eleven places.</div>' +
      '<div class="aqf-cap sm" data-b="6">A drive, a drawer, an inbox, and one person&#8217;s memory.</div>' +
      '<div class="aqf-cap aqf-serif" data-b="8" data-fx="wipe" style="bottom:auto;top:46%">' +
        'One place. <em style="color:#5EEAD4;font-style:italic">One system.</em></div>' +
    '</div>' +

    /* ============================ ACT III ============================ */
    '<div class="aqf-act aqf-act-3">' +
      '<canvas class="aqf-mesh" data-mesh></canvas>' +
      '<div class="aqf-card" data-b="1" data-fx="wipe">' +
        '<div class="code aqf-mono"><span class="chip">CORE</span> IPC.2.c</div>' +
        '<div class="q aqf-serif">&#8220;Adequate and appropriate facilities for hand hygiene in ' +
        'all patient-care areas are accessible to healthcare providers.&#8221;</div></div>' +
      '<div class="aqf-steps">' +
        '<div class="aqf-step" data-b="2"><div class="n aqf-mono">01 READ</div>' +
          '<div><h4>What it requires</h4><p>In plain language anyone on the floor can follow.</p></div></div>' +
        '<div class="aqf-step" data-b="3"><div class="n aqf-mono">02 SEE</div>' +
          '<div><h4>What the assessor checks</h4><p>The evidence, named — the part the book does not print.</p></div></div>' +
        '<div class="aqf-step" data-b="4"><div class="n aqf-mono">03 CLOSE</div>' +
          '<div><h4>Before it is an NC</h4><p>The common mistake, and the fix, for every department that owns it.</p></div></div>' +
      '</div>' +
      '<div class="aqf-ledger" data-b="6">' +
        '<div class="aqf-lrow"><div class="k">A hospital&#8217;s annual PM-JAY claims</div>' +
          '<div class="v aqf-mono">&#8377;2,00,00,000</div></div>' +
        '<div class="aqf-lrow"><div class="k">Entry Level uplift, at 10%</div>' +
          '<div class="v aqf-mono plus">+ &#8377;20,00,000</div></div>' +
        '<div class="aqf-lrow"><div class="k">AQcredix, whole hospital, one year</div>' +
          '<div class="v aqf-mono minus">&#8722; &#8377;5,000</div></div>' +
        '<div class="aqf-lrow tot"><div class="k">The platform costs this much of the uplift it protects</div>' +
          '<div class="v aqf-mono">0.25%</div></div>' +
      '</div>' +
      '<div class="aqf-end" data-b="8">' +
        '<svg viewBox="0 0 40 40" aria-hidden="true">' +
          '<circle cx="20" cy="20" r="16" fill="none" stroke="rgba(244,242,236,.26)" stroke-width="3.4"/>' +
          '<path d="M20 4a16 16 0 1 1-11.31 4.69" fill="none" stroke="#5EEAD4" stroke-width="3.4" stroke-linecap="round"/>' +
          '<path d="M19.15 14.05H20.85L25.61 25.015H26.97V25.95H22.21V25.015H23.315L22 22H18L16.685 25.015H17.79V25.95H13.03V25.015H14.39ZM20 16.26L22.027 20.935H17.973Z" fill="#F4F2EC" fill-rule="evenodd"/>' +
        '</svg>' +
        '<div class="wm aqf-serif">AQcredix</div>' +
        '<div class="tag aqf-serif">Know it before the <em>assessor</em> does.</div>' +
        '<div class="sub" data-b="9">639 objective elements, 45 departments, and the calendar, ' +
          'evidence and audits that prove them. ₹500 a month for the whole hospital. Seven days free.</div>' +
        '<div class="aqf-cta" data-b="9">' +
          '<a href="plans.html">See what it costs</a>' +
          '<a class="ghost" href="standards.html">Explore the standards</a></div>' +
      '</div>' +
    '</div>' +

    '</div></div></div>' +
    '<button class="aqf-close" aria-label="Close">&#10005;</button>' +
    '<div class="aqf-poster"><div class="pl">&#9654;</div>' +
      '<h3>Wanna know about AQcredix?</h3><p>52 seconds &#183; no sound needed</p></div>' +
    '<div class="aqf-ui">' +
      '<button data-play aria-label="Play or pause">&#9654;</button>' +
      '<div class="aqf-prog"><i></i></div>' +
      '<span class="aqf-time aqf-mono">0:00 / 0:52</span>' +
      '<button data-full aria-label="Full screen">&#9974;</button>' +
    '</div>';
  }

  /* ------------------------------------------------------- canvas: act II */
  /* Chaos then order. Dots scatter at random, then a sweep snaps them onto a grid — the
     whole argument of the product in one move, made with position rather than words. */
  function field(cv, getT) {
    var ctx = cv.getContext("2d"), pts = [], W = 0, H = 0;
    function size() {
      W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight;
      pts = [];
      var cols = 14, rows = 8, i = 0;
      for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++, i++) {
        pts.push({
          rx: Math.random() * W, ry: Math.random() * H,
          gx: (W * 0.18) + c * (W * 0.64 / (cols - 1)),
          gy: (H * 0.26) + r * (H * 0.46 / (rows - 1)),
          d: Math.random() * 0.5
        });
      }
    }
    size();
    addEventListener("resize", size);
    return function draw() {
      var t = getT();
      if (t < 22 || t > 34) { ctx.clearRect(0, 0, W, H); return; }
      /* 22–27 scattered · 27–30 the sweep orders them · 30+ held */
      var p = t < 27 ? 0 : Math.min(1, (t - 27) / 2.6);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var o = pts[i];
        var k = Math.max(0, Math.min(1, (p - o.d * 0.35) / 0.65));
        var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        var x = o.rx + (o.gx - o.rx) * e, y = o.ry + (o.gy - o.ry) * e;
        ctx.fillStyle = e > 0.6 ? "rgba(94,234,212,.95)" : "rgba(224,133,113,.85)";
        ctx.beginPath(); ctx.arc(x, y, e > 0.6 ? 4 : 5.5, 0, 6.284); ctx.fill();
      }
      if (p > 0 && p < 1) {   // the sweep itself
        var sx = W * p;
        var g = ctx.createLinearGradient(sx - 130, 0, sx + 40, 0);
        g.addColorStop(0, "rgba(94,234,212,0)"); g.addColorStop(1, "rgba(94,234,212,.5)");
        ctx.fillStyle = g; ctx.fillRect(sx - 130, 0, 170, H);
      }
    };
  }

  /* ------------------------------------------------------ canvas: act III */
  function mesh(cv, getT) {
    var ctx = cv.getContext("2d"), pts = [], W = 0, H = 0;
    function size() {
      W = cv.width = cv.offsetWidth; H = cv.height = cv.offsetHeight;
      pts = [];
      var n = Math.round(Math.min(90, (W * H) / 16000));
      for (var i = 0; i < n; i++) pts.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .22, vy: (Math.random() - .5) * .22
      });
    }
    size();
    addEventListener("resize", size);
    return function draw() {
      var t = getT();
      if (t < 33) { ctx.clearRect(0, 0, W, H); return; }
      var a = Math.min(1, (t - 33) / 1.6);
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = dx * dx + dy * dy;
          if (d < 26000) {
            ctx.strokeStyle = "rgba(94,234,212," + ((1 - d / 26000) * .30 * a) + ")";
            ctx.lineWidth = 1; ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(94,234,212," + (.8 * a) + ")";
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.284); ctx.fill();
      }
    };
  }

  /* -------------------------------------------------------------- the film */
  function mount(host, opts) {
    opts = opts || {};
    host.classList.add("aqf-mount");
    host.innerHTML = markup();

    var frame = host.querySelector(".aqf-frame");
    var film  = host.querySelector(".aqf-film");
    var stage = host.querySelector(".aqf-stage");
    var poster = host.querySelector(".aqf-poster");
    var prog  = host.querySelector(".aqf-prog");
    var progI = prog.querySelector("i");
    var timeEl = host.querySelector(".aqf-time");
    var playBtn = host.querySelector("[data-play]");

    var t = 0, playing = false, last = 0, reduce = false;
    try { reduce = matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) {}

    /* Scale the composed 1920x1080 frame into whatever box we were given. Measure, never
       guess: a zero reading means layout has not settled, so ask again next frame rather
       than locking in a wrong scale. */
    function fit() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) { requestAnimationFrame(fit); return; }
      var s = Math.min(w / 1920, h / 1080);
      frame.style.transform = "translate(-50%,-50%) scale(" + s + ")";
    }
    addEventListener("resize", fit);
    try { new ResizeObserver(fit).observe(stage); } catch (e) {}
    fit(); setTimeout(fit, 120); setTimeout(fit, 600);

    var drawField = field(host.querySelector("[data-field]"), function () { return t; });
    var drawMesh  = mesh(host.querySelector("[data-mesh]"),  function () { return t; });

    function fmt(s) {
      s = Math.max(0, Math.floor(s));
      return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    }

    /* Apply the exact state for time t. Called every frame AND on seek, so scrubbing
       backwards is as correct as playing forwards — beats are re-derived, never assumed. */
    function apply() {
      var act = t < 16 ? 1 : (t < 34 ? 2 : 3);
      film.setAttribute("data-act", String(act));

      for (var i = 0; i < BEATS.length; i++) {
        var b = BEATS[i], on = t >= b[0];
        var sel = ".aqf-act-" + b[1] + ' [data-b="' + b[2] + '"]';
        var nodes = film.querySelectorAll(sel);
        for (var j = 0; j < nodes.length; j++) nodes[j].classList.toggle("on", on);
      }
      /* bars grow with their own beat */
      var bars = film.querySelectorAll("[data-bar]");
      for (var k = 0; k < bars.length; k++) bars[k].classList.toggle("on", t >= 10.2);

      /* counters */
      var cs = film.querySelectorAll("[data-count]");
      for (var c = 0; c < cs.length; c++) {
        var node = cs[c], to = +node.getAttribute("data-count");
        var startAt = node.closest('[data-b="2"]') ? 2.2 : 4.0;
        var p = Math.max(0, Math.min(1, (t - startAt) / 1.3));
        var e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        node.textContent = Math.round(to * e).toLocaleString("en-IN");
      }

      film.classList.toggle("scan", t > 0.15 && t < 1.6);
      film.classList.toggle("ramp",
        (t >= RAMP[0][0] && t <= RAMP[0][1]) || (t >= RAMP[1][0] && t <= RAMP[1][1]));
      film.classList.toggle("dive", t >= DIVE[0] && t <= DIVE[1]);

      progI.style.width = (t / DUR * 100) + "%";
      timeEl.textContent = fmt(t) + " / " + fmt(DUR);
    }

    function tick(now) {
      if (!playing) return;
      if (!last) last = now;
      t += (now - last) / 1000; last = now;
      if (t >= DUR) { t = DUR; playing = false; playBtn.innerHTML = "&#8635;"; }
      apply(); drawField(); drawMesh();
      if (playing) requestAnimationFrame(tick);
    }

    function play() {
      if (t >= DUR) t = 0;
      poster.classList.add("gone");
      host.classList.add("show-ui");
      playing = true; last = 0;
      playBtn.innerHTML = "&#10073;&#10073;";
      requestAnimationFrame(tick);
    }
    function pause() { playing = false; playBtn.innerHTML = "&#9654;"; }

    poster.addEventListener("click", play);
    playBtn.addEventListener("click", function () { playing ? pause() : play(); });
    prog.addEventListener("click", function (e) {
      var r = prog.getBoundingClientRect();
      t = Math.max(0, Math.min(DUR, (e.clientX - r.left) / r.width * DUR));
      poster.classList.add("gone");
      apply(); drawField(); drawMesh();
    });

    function toggleFull() {
      host.classList.toggle("is-full");
      document.body.classList.toggle("aq-locked", host.classList.contains("is-full"));
      fit();
    }
    host.querySelector("[data-full]").addEventListener("click", toggleFull);
    host.querySelector(".aqf-close").addEventListener("click", function () {
      if (opts.onClose) opts.onClose();
      else { host.classList.remove("is-full"); document.body.classList.remove("aq-locked"); fit(); }
    });
    addEventListener("keydown", function (e) {
      if (!host.isConnected) return;
      if (e.key === " " && host.classList.contains("is-full")) { e.preventDefault(); playing ? pause() : play(); }
      if (e.key === "Escape" && host.classList.contains("is-full")) host.querySelector(".aqf-close").click();
    });

    /* ?aqft=<seconds> jumps straight to a moment. Written for verification — a film you
       cannot seek is a film you cannot check — and useful in its own right for linking
       someone to the part of the story that answers their question. */
    try {
      var q = new URLSearchParams(location.search).get("aqft");
      if (q !== null) { t = Math.max(0, Math.min(DUR, parseFloat(q) || 0)); poster.classList.add("gone"); host.classList.add("show-ui"); }
    } catch (e) {}

    if (reduce) { t = DUR; apply(); poster.classList.add("gone"); }
    else { apply(); drawField(); drawMesh(); }

    if (opts.autoplay) play();
    return { play: play, pause: pause, fit: fit };
  }

  /* Opens the film over the whole page, from anywhere on the site. */
  function open() {
    var back = el("div", "aqf-mount is-full");
    document.body.appendChild(back);
    document.body.classList.add("aq-locked");
    var api = mount(back, {
      autoplay: true,
      onClose: function () {
        document.body.classList.remove("aq-locked");
        back.remove();
      }
    });
    return api;
  }

  window.AQFilm = { mount: mount, open: open };
})();
