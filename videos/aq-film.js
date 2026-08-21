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
    var armTimer = null, endTimer = null;
    var catcher = host.querySelector(".aqf-catch");
    var endCard = host.querySelector(".aqf-end");
    var ended = false;

    endCard.querySelector("[data-cta]").href   = base() + "workspace/workspace.html";
    endCard.querySelector("[data-costs]").href = base() + "plans.html";

    function showEnd() {
      if (ended) return;
      ended = true;
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

      /* Match the button wording to the film's own, so the two never drift apart. */
      try {
        if (win.AQ_TWEAKS && win.AQ_TWEAKS.cta) {
          endCard.querySelector("[data-cta]").textContent = win.AQ_TWEAKS.cta;
        }
      } catch (e) {}

      /* THE NARRATION ELEMENT DOES NOT EXIST YET AT load, and assuming it did was a bug.
         OM_SCENES and AQ_TWEAKS are inline in the bundle's <head>, so they are readable
         the moment the frame loads — but the <video> carrying the voice-over is created
         later, by the scene itself, once it mounts. Querying for it here found nothing,
         so the accurate clock was never attached and only the crude wall-clock fallback
         below was left running. Poll for it instead, briefly and then give up. */
      var waited = 0;
      (function findMedia() {
        var media = null;
        try { media = doc.querySelector("video, audio"); } catch (e) { return; }
        if (!media) {
          if ((waited += 250) < 15000) setTimeout(findMedia, 250);
          return;
        }
        /* The narration is the truest clock available: if the audio stalls on a slow
           connection the visuals wait for it, and a wall clock would not — it would
           bring the end card up over a film that is still playing. Once this is
           attached the fallback timers are redundant, and are cleared. */
        clearTimeout(armTimer);
        clearTimeout(endTimer);
        if (!total || !isFinite(total)) total = media.duration || 0;
        media.addEventListener("timeupdate", function () {
          if (total && media.currentTime >= total - closeDur) armCatcher();
        });
        media.addEventListener("ended", showEnd);
      })();

      /* Belt and braces, and it runs until the clock above replaces it. If the narration
         never arrives — a decode failure, a browser that refused the audio, a future cut
         with no voice-over — the film still finishes on screen and the end card must
         still come up. setTimeout, not rAF, so it keeps counting if the tab is put in
         the background part-way through. */
      if (total) {
        armTimer = setTimeout(armCatcher, Math.max(0, total - closeDur) * 1000);
        endTimer = setTimeout(showEnd, (total + 0.6) * 1000);
      }
    }
    frame.addEventListener("load", watchFilm);

    host.querySelector(".aqf-again").addEventListener("click", function () {
      clearTimeout(armTimer); clearTimeout(endTimer);
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
