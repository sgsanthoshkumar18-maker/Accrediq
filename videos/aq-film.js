/* AQcredix — host for the film at videos/aqcredix-film.html.
 *
 * WHAT CHANGED. The film is no longer built here. It is a self-contained bundle produced
 * separately, and this file's whole job is to put it on the page correctly and keep the
 * interface the rest of the site already calls — window.AQFilm.mount() and .open(), the
 * aqf-mount / is-full classes that aq-scroll-lock.js watches, and the poster.
 *
 * WHY AN IFRAME AND NOT AN INLINE MOUNT. The bundle unpacks itself at runtime into blob
 * URLs and writes its own <html>. Dropped into a div it would fight this page for the
 * document — its styles are unscoped, and its own reset would reach our header. An iframe
 * gives it the document it expects and gives us a clean boundary.
 *
 * WHY IT LOADS ONLY AFTER A CLICK. Two reasons, and both matter. The bundle is 2.3MB
 * because the narration is embedded as base64 audio, and nobody visiting the home page to
 * read the standards should pay for that download. And the film has sound with
 * autoplay:false — every browser blocks unmuted audio until a real user gesture, so
 * loading it early would only produce a film that refuses to start. Clicking the poster
 * IS the gesture, and allow="autoplay" passes it through to the frame.
 *
 * WHY THE IFRAME IS 1280x720 AND SCALED. The film composes at a fixed 1280x720 and does
 * not scale itself. Sizing the iframe to the container would crop it. Giving the iframe
 * its native size and scaling the element keeps the whole composition — every transition
 * and mask — intact from a phone to a projector.
 */
(function () {
  "use strict";

  var W = 1280, H = 720;   // the bundle's native composition size

  function base() {
    return (document.body && document.body.getAttribute("data-base")) || "";
  }
  function filmSrc() { return base() + "videos/aqcredix-film.html"; }

  /* THE FILM SHIPS WITH A DEVELOPER'S SCRUBBER ACROSS THE BOTTOM OF EVERY FRAME —
   * a progress bar with "0:00.00" and "0:43.20" at either end, 37px tall, fully opaque.
   * It belongs to whoever was cutting the film. A hospital director watching the pitch
   * should not be looking at an editing timeline.
   *
   * Setting AQ_TWEAKS.motionEditor to false in the bundle turns off the tweaks PANEL but
   * leaves this, so it has to go from here. It is found by SHAPE, not by class name or
   * position: the element whose only text is two timecodes. Compiled class names change
   * on every re-export; "the box containing exactly two timecodes" survives that.
   *
   * Every step is guarded and the whole thing is wrapped, because the cost of getting it
   * wrong must stay at "the scrubber is still there" and never reach "part of the film
   * is missing". If the shape stops matching, nothing is hidden and the bar comes back —
   * visible, and obvious to whoever looks next. */
  function hideScrubber(doc) {
    try {
      var TIME = /^\d+:\d\d\.\d\d$/;
      var stamps = [];
      var all = doc.querySelectorAll("div,span,p");
      for (var i = 0; i < all.length; i++) {
        if (!all[i].children.length && TIME.test((all[i].textContent || "").trim())) {
          stamps.push(all[i]);
        }
      }
      if (stamps.length !== 2) return false;         // not the shape we know

      var bar = stamps[0].parentElement;
      while (bar && !bar.contains(stamps[1])) bar = bar.parentElement;
      if (!bar || bar === doc.body || bar === doc.documentElement) return false;

      var r = bar.getBoundingClientRect();
      if (r.height > 60) return false;               // too tall to be a control bar
      if (r.top < 720 * 0.85) return false;          // not sitting at the foot of the frame
      /* The bar holds two timecodes and nothing else. Anything wordier is not it. */
      if (bar.textContent.trim().length > 40) return false;

      bar.style.display = "none";
      return true;
    } catch (e) { /* the film is more important than the tidying */ }
    return false;
  }

  function mount(host, opts) {
    opts = opts || {};
    host.classList.add("aqf-mount");
    host.innerHTML =
      '<div class="aqf-stage">' +
        '<div class="aqf-scaler"><iframe class="aqf-frame-el" title="AQcredix — the film" ' +
          'allow="autoplay; fullscreen" loading="lazy"></iframe></div>' +
      '</div>' +
      '<button class="aqf-close" aria-label="Close">&#10005;</button>' +
      '<div class="aqf-poster">' +
        '<div class="pl">&#9654;</div>' +
        '<h3>Wanna know about AQcredix?</h3>' +
        '<p>43 seconds &middot; narrated, so turn the sound on</p>' +
      '</div>' +
      '<div class="aqf-ui"><button data-full aria-label="Full screen">&#9974;</button></div>' +
      /* Sits over the frame for the closing card only — see armCatcher(). An iframe
         swallows its own clicks, so without this the parent page never hears about
         someone pressing the painted buttons. */
      '<div class="aqf-catch" hidden></div>' +
      '<div class="aqf-end" hidden>' +
        '<p class="aqf-end-k">Ready when you are</p>' +
        '<h3 class="aqf-end-h">&#8377;500 a month for the whole hospital.</h3>' +
        '<div class="aqf-end-b">' +
          '<a class="btn btn-accent" data-cta href="#">Start the 7-day trial</a>' +
          '<a class="btn btn-ghost" data-costs href="#">See what it costs</a>' +
        '</div>' +
        '<button type="button" class="aqf-again">&#8635; Watch it again</button>' +
      '</div>';

    var stage  = host.querySelector(".aqf-stage");
    var scaler = host.querySelector(".aqf-scaler");
    var frame  = host.querySelector(".aqf-frame-el");
    var poster = host.querySelector(".aqf-poster");
    var loaded = false;

    /* Measure, never guess. Layout reports 0 for a frame or two while the section above
       settles; clamping that to a "safe" minimum locks the film at a wrong scale that
       looks deliberate rather than broken. Ask again instead.

       THE RETRY USES setTimeout, NOT requestAnimationFrame. A page opened into a
       BACKGROUND tab — middle-click, "open in new tab", a restored session — does no
       layout at all, so every measurement is 0, and rAF does not run in a hidden tab.
       An rAF retry therefore parks forever and the film sits at scale 1, cropped, until
       something resizes the window. setTimeout keeps running while hidden, and the
       visibility listener below re-measures the moment the tab is actually shown. */
    var tries = 0;
    function fit() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) {
        if (tries++ < 120) setTimeout(fit, 100);
        return;
      }
      tries = 0;
      var s = Math.min(w / W, h / H);
      scaler.style.transform = "translate(-50%,-50%) scale(" + s + ")";
    }
    addEventListener("resize", fit);
    addEventListener("orientationchange", fit);
    document.addEventListener("visibilitychange", fit);
    try { new ResizeObserver(fit).observe(stage); } catch (e) {}
    fit(); setTimeout(fit, 120); setTimeout(fit, 600);

    /* ------------------------------------------------------------------ *
     * THE CALLS TO ACTION AT THE END OF THE FILM.
     *
     * The film paints "Start the 7-day trial" and "See what it costs" on its closing
     * card. They are pixels — drawn inside a compiled scene in another document — so
     * pressing them does nothing, which is the worst possible moment for nothing to
     * happen: someone has just watched the whole thing and is reaching for the screen.
     *
     * WHY NOT REACH INTO THE FILM AND MAKE ITS OWN BUTTONS CLICKABLE. The frame is
     * same-origin, so it is technically possible. It would also be a promise this file
     * cannot keep: the scene is compiled output that is regenerated wholesale whenever
     * the film is re-cut, so any selector or coordinate written here is one re-export
     * away from pointing at nothing — and an invisible dead link is worse than a
     * visible one, because nobody notices it broke.
     *
     * So the host draws its own end card instead, with REAL anchors. They can be
     * focused with a keyboard, opened in a new tab, read by a screen reader and
     * middle-clicked. A painted rectangle can do none of that.
     *
     * TIMINGS ARE READ FROM THE FILM, NOT COPIED FROM IT. The bundle publishes its own
     * scene table on OM_SCENES, so the closing card's start is computed from whatever
     * the film currently is. Re-cut it and this follows. The fallbacks below only apply
     * if that table is unreadable. */
    var CLOSE_FALLBACK = 9.8;      // seconds the closing card runs, if unknown
    var clocks = [];               // stop functions for any running playback clock
    var catcher = host.querySelector(".aqf-catch");
    var endCard = host.querySelector(".aqf-end");
    var ended = false;

    endCard.querySelector("[data-cta]").href   = base() + "workspace/workspace.html";
    endCard.querySelector("[data-costs]").href = base() + "plans.html";

    function showEnd() {
      if (ended) return;
      ended = true;
      clocks.forEach(function (stop) { stop(); });
      catcher.hidden = true;
      endCard.hidden = false;
      host.classList.add("ended");
      /* Focus the primary action so a keyboard visitor is already on it. preventScroll
         keeps the page from jumping to the film if it is only half in view. */
      try { endCard.querySelector("[data-cta]").focus({ preventScroll: true }); } catch (e) {}
    }

    /* During the closing card, put a transparent sheet over the frame. A press anywhere
       on it — which is what pressing a painted button IS, from out here — brings up the
       real card straight away rather than making them wait out the last few seconds. */
    function armCatcher() {
      if (ended) return;
      catcher.hidden = false;
    }
    catcher.addEventListener("click", showEnd);

    function watchFilm() {
      var doc, win;
      try { win = frame.contentWindow; doc = frame.contentDocument; } catch (e) { return; }
      if (!doc) return;

      var total = 0, closeDur = CLOSE_FALLBACK;
      try {
        var scenes = JSON.parse(win.OM_SCENES);
        for (var i = 0; i < scenes.length; i++) total += scenes[i].dur;
        closeDur = scenes[scenes.length - 1].dur;
      } catch (e) { total = 0; }

      /* Polled, because the scrubber is drawn by the scene and so is not in the
         document when the frame fires load — the same trap the narration element set.
         Give up after a few seconds rather than watching for ever. */
      var scrubWait = 0;
      (function killScrubber() {
        if (hideScrubber(doc)) return;
        if ((scrubWait += 250) < 8000) setTimeout(killScrubber, 250);
      })();

      /* Match the button wording to the film's own, so the two never drift apart. */
      try {
        if (win.AQ_TWEAKS && win.AQ_TWEAKS.cta) {
          endCard.querySelector("[data-cta]").textContent = win.AQ_TWEAKS.cta;
        }
      } catch (e) {}

      /* WHAT DRIVES THIS, AND THE MISTAKE THAT CAME FIRST.
       *
       * The first version hung everything on the narration: arm on its timeupdate, show
       * the end card on its "ended". That looked right and was wrong, because THE FILM'S
       * PICTURE AND ITS SOUND ARE TWO INDEPENDENT CLOCKS. The scene animates on its own
       * requestAnimationFrame loop and never consults the audio element. So when a
       * browser refuses to play the unmuted narration — which it will, because autoplay
       * policy varies by browser, by device and by how often that person has visited —
       * the film still plays through perfectly in silence, parks on its painted buttons,
       * and the end card never arrives. Pressing the buttons does nothing. That is
       * precisely the fault this whole end card exists to fix, so hanging it on the one
       * component that is allowed to silently not start was exactly backwards.
       *
       * It is now driven by elapsed time, and the narration only refines it.
       *
       * The clock ticks ONLY WHILE THE PAGE IS VISIBLE, because rAF — and therefore the
       * picture — stops when the tab goes to the background. A plain wall clock would
       * keep running and throw the end card up over a film frozen mid-sentence.
       * Whichever signal arrives first wins: arming early costs nothing, and an end card
       * a moment early is far better than one that never comes. */
      var elapsed = 0, ticking = null;
      function tick() { if (!document.hidden) elapsed += 0.2; check(); }
      function check() {
        if (!total) return;
        if (elapsed >= total - closeDur) armCatcher();
        if (elapsed >= total + 0.4) { stopClock(); showEnd(); }
      }
      function startClock() {
        if (ticking) return;
        ticking = setInterval(tick, 200);   // setInterval, not rAF: see fit() above
      }
      function stopClock() { clearInterval(ticking); ticking = null; }
      clocks.push(stopClock);
      startClock();

      /* THE NARRATION ELEMENT DOES NOT EXIST YET AT load, and assuming it did was the
         second bug here. OM_SCENES and AQ_TWEAKS are inline in the bundle's <head>, so
         they are readable the moment the frame loads — but the <video> carrying the
         voice-over is created later, by the scene itself, once it mounts. Poll for it,
         briefly, and carry on without it if it never comes. */
      var waited = 0;
      (function findMedia() {
        var media = null;
        try { media = doc.querySelector("video, audio"); } catch (e) { return; }
        if (!media) {
          if ((waited += 250) < 15000) setTimeout(findMedia, 250);
          return;
        }
        if (!total || !isFinite(total)) total = media.duration || 0;
        /* Only trust the audio clock while the page is VISIBLE. Audio does not stop
           when a tab goes to the background, but rAF does — so in a hidden tab the
           voice-over runs on while the picture is frozen on one frame. Taking the audio
           position then would race the clock ahead of the film and bring the end card up
           over a still image.

           There is deliberately no listener on the media's "ended" either. The narration
           is 42.1s and the film is 43.2s, so ending on the audio would cut the last
           second of the closing card — the beat the whole film builds to. The picture
           decides when it is over. */
        media.addEventListener("timeupdate", function () {
          if (!document.hidden && media.currentTime > elapsed) elapsed = media.currentTime;
          check();
        });
      })();
    }
    frame.addEventListener("load", watchFilm);

    host.querySelector(".aqf-again").addEventListener("click", function () {
      clocks.forEach(function (stop) { stop(); });
      clocks.length = 0;
      ended = false;
      endCard.hidden = true;
      catcher.hidden = true;
      host.classList.remove("ended");
      frame.src = filmSrc();          // reload is the only way to restart a compiled scene
      fit();
    });

    function play() {
      if (!loaded) { frame.src = filmSrc(); loaded = true; }
      poster.classList.add("gone");
      host.classList.add("playing");
      fit();
    }

    poster.addEventListener("click", play);

    function setFull(on) {
      host.classList.toggle("is-full", on);
      /* aq-scroll-lock.js watches .aqf-mount.is-full, so the page holds still by itself. */
      fit();
    }
    host.querySelector("[data-full]").addEventListener("click", function () {
      setFull(!host.classList.contains("is-full"));
    });
    host.querySelector(".aqf-close").addEventListener("click", function () {
      if (opts.onClose) opts.onClose(); else setFull(false);
    });
    addEventListener("keydown", function (e) {
      if (e.key === "Escape" && host.classList.contains("is-full")) {
        host.querySelector(".aqf-close").click();
      }
    });

    /* Anyone who has asked for less motion gets the poster and a choice, never an
       autoplaying film with sound. */
    var reduce = false;
    try { reduce = matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) {}
    if (opts.autoplay && !reduce) play();

    return { play: play, fit: fit, full: setFull };
  }

  /* Opens the film over whatever page you are on. Used by the header link when the page
     has no film section of its own. */
  function open() {
    var back = document.createElement("div");
    back.className = "aqf-mount is-full";
    document.body.appendChild(back);
    return mount(back, {
      autoplay: true,
      onClose: function () { back.remove(); }
    });
  }

  window.AQFilm = { mount: mount, open: open };
})();
