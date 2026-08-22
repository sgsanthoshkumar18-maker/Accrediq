/* AQcredix — host for the film at videos/aqcredix-film.html.
 *
 * The film is a self-contained bundle produced separately. This file's whole job is to
 * put it on the page correctly and keep the interface the rest of the site already
 * calls — window.AQFilm.mount() and .open(), the aqf-mount / is-full classes that
 * aq-scroll-lock.js watches, and the poster.
 *
 * WHY AN IFRAME AND NOT AN INLINE MOUNT. The bundle unpacks itself at runtime and writes
 * its own <html>. Dropped into a div it would fight this page for the document — its
 * styles are unscoped and its reset would reach our header. An iframe gives it the
 * document it expects and gives us a clean boundary.
 *
 * WHY IT LOADS ONLY AFTER A CLICK. The bundle is 2.3MB because the narration is embedded
 * as base64 audio, and nobody visiting the home page to read the standards should pay for
 * that download. The film also has sound, and every browser blocks unmuted audio until a
 * real user gesture — clicking the poster IS that gesture, and allow="autoplay" passes it
 * through to the frame.
 *
 * WHY THE IFRAME IS 1280x720 AND SCALED. The film composes at a fixed 1280x720 and does
 * not scale itself. Sizing the iframe to the container would crop it. Giving the iframe
 * its native size and scaling the ELEMENT keeps the whole composition — every transition
 * and mask — intact from a phone to a projector.
 *
 * WHAT IS DELIBERATELY NOT DONE HERE. The film paints its own "Start the 7-day trial" and
 * "See what it costs" onto its closing card. Those are pixels inside a compiled scene in
 * another document. Two attempts to make them pressable — overlaying the frame, and
 * timing a card off the narration — both broke the film, because the picture and the
 * sound run on separate clocks and neither belongs to us. The real, pressable versions of
 * those buttons live in the page underneath the film (.aqf-cta in index.html), where they
 * work before it starts, while it plays, after it ends, and if it never loads at all.
 */
(function () {
  "use strict";

  var W = 1280, H = 720;      // the bundle's native composition size
  var RUNTIME = 43.2;         // fallback if the film does not publish its scene table

  function base() {
    return (document.body && document.body.getAttribute("data-base")) || "";
  }

  /* EVERY PLAY GETS A BRAND-NEW DOCUMENT, and the query string is what guarantees it.
   *
   * Without it the film reopened wherever it had stopped — press play and you were
   * looking at the closing card, and the only way back to the start was to drag the
   * scrubber to 0:00 by hand. Re-pointing an iframe at a URL it already holds does not
   * reliably tear the old document down; the browser is free to hand back the one it has,
   * scene state, audio position and all. A URL it has never seen leaves it no choice.
   *
   * This is also what makes the end detection below trustworthy. While the film could
   * resume at 0:43, a freshly mounted player was already "finished" the moment it
   * appeared — which is exactly how an earlier attempt at an end card managed to cover
   * the film before it had played a single frame. */
  function filmSrc() {
    return base() + "videos/aqcredix-film.html?r=" + Date.now();
  }

  /* ---------------------------------------------------------------- *
   * Full screen.
   *
   * The CSS-only version this replaces just pinned the element over the page. It looked
   * right on a laptop and was wrong on a phone: the browser chrome stayed, and a 16:9
   * film in a portrait window is a letterboxed sliver across the middle. The real
   * Fullscreen API is what makes it behave the way a video is expected to.
   *
   * iOS Safari does not implement it for arbitrary elements — only for <video> — so the
   * old CSS behaviour is kept as the fallback and used automatically when the request is
   * refused. It is a worse full screen, but it is never a broken one.
   * ---------------------------------------------------------------- */
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement ||
           document.msFullscreenElement || null;
  }
  function requestFull(el) {
    var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (!fn) return Promise.reject(new Error("no fullscreen api"));
    try { return Promise.resolve(fn.call(el)); }
    catch (e) { return Promise.reject(e); }
  }
  function exitFull() {
    var fn = document.exitFullscreen || document.webkitExitFullscreen ||
             document.msExitFullscreen;
    if (fn) { try { fn.call(document); } catch (e) {} }
  }

  /* Rotate only on a handset. A laptop screen is already wider than it is tall, so
     turning the picture sideways there would be absurd — full screen simply means the
     whole screen at its own shape, which is what the scaler already produces. */
  function isHandset() {
    try {
      return matchMedia("(max-width: 900px)").matches &&
             matchMedia("(pointer: coarse)").matches;
    } catch (e) { return false; }
  }
  function lockLandscape() {
    if (!isHandset()) return;
    try {
      if (screen.orientation && screen.orientation.lock) {
        var p = screen.orientation.lock("landscape");
        /* Refused on iOS, and on a device the owner has locked to portrait. Nothing to
           do about it and nothing to report — the film still fills what it is given. */
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }
  function unlockOrientation() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }
    catch (e) {}
  }

  function mount(host, opts) {
    opts = opts || {};
    host.classList.add("aqf-mount");
    host.innerHTML =
      '<div class="aqf-stage">' +
        '<div class="aqf-scaler"><iframe class="aqf-frame-el" title="AQcredix — the film" ' +
          'allow="autoplay; fullscreen" allowfullscreen></iframe></div>' +
      '</div>' +
      '<div class="aqf-poster">' +
        '<div class="pl">&#9654;</div>' +
        '<h3>Wanna know about AQcredix?</h3>' +
        '<p>43 seconds &middot; narrated, so turn the sound on</p>' +
      '</div>' +
      '<div class="aqf-end" hidden>' +
        '<button type="button" class="aqf-again">' +
          '<span class="aqf-again-ic" aria-hidden="true">&#8635;</span>' +
          '<span>Watch it again</span>' +
        '</button>' +
      '</div>' +
      '<div class="aqf-ui">' +
        '<button type="button" data-restart aria-label="Start again" title="Start again">&#8635;</button>' +
        '<button type="button" data-full aria-label="Full screen" title="Full screen">&#9974;</button>' +
      '</div>' +
      '<button type="button" class="aqf-close" aria-label="Exit full screen" title="Exit full screen">&#10005;</button>';

    var stage   = host.querySelector(".aqf-stage");
    var scaler  = host.querySelector(".aqf-scaler");
    var frame   = host.querySelector(".aqf-frame-el");
    var poster  = host.querySelector(".aqf-poster");
    var endCard = host.querySelector(".aqf-end");

    /* ---------------- scaling ---------------- */

    /* Measure, never guess. Layout reports 0 for a frame or two while the section above
       settles; clamping that to a "safe" minimum locks the film at a wrong scale that
       looks deliberate rather than broken. Ask again instead.

       THE RETRY USES setTimeout, NOT requestAnimationFrame. A page opened into a
       BACKGROUND tab does no layout at all, so every measurement is 0 — and rAF does not
       run in a hidden tab, so an rAF retry parks for ever and the film sits unscaled
       until something happens to resize the window. */
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

    /* ---------------- playing, and ending ---------------- */

    var clock = null;         // interval handle for the elapsed count
    var elapsed = 0;          // seconds of VISIBLE playback since this load
    var total = RUNTIME;
    var finished = false;

    function stopClock() { clearInterval(clock); clock = null; }

    function showEnd() {
      if (finished) return;
      /* THE FLOOR THAT MAKES THIS SAFE. An end card that can appear early is worse than
         no end card at all, because it hides a film that is still running. Whatever the
         clocks claim, nothing is shown until the film has genuinely had time to play. */
      if (elapsed < Math.min(total, 8)) return;
      finished = true;
      stopClock();
      endCard.hidden = false;
      host.classList.add("ended");
    }

    /* Ticks only while the page is VISIBLE, because the film animates on
       requestAnimationFrame and that stops in a background tab. A plain wall clock would
       run on and call the film finished while its picture sat frozen on one frame. */
    function tick() {
      if (!document.hidden) elapsed += 0.25;
      if (elapsed >= total) showEnd();
    }

    function watchFilm() {
      var doc, win;
      try { win = frame.contentWindow; doc = frame.contentDocument; } catch (e) { return; }
      if (!doc || !win) return;

      /* Read the running time from the film rather than copying it here, so a re-cut
         does not silently leave this file describing the previous edit. */
      try {
        var scenes = JSON.parse(win.OM_SCENES), t = 0;
        for (var i = 0; i < scenes.length; i++) t += scenes[i].dur;
        if (t > 1) total = t;
      } catch (e) { total = RUNTIME; }

      stopClock();
      clock = setInterval(tick, 250);

      /* The narration element is created by the scene and is not in the document at
         load, so it has to be waited for. It is a refinement, never a gate: if the
         browser refuses to play unmuted audio the film still runs in silence, and the
         clock above still ends it. */
      var waited = 0;
      (function findMedia() {
        var m = null;
        try { m = doc.querySelector("video, audio"); } catch (e) { return; }
        if (!m) { if ((waited += 250) < 15000) setTimeout(findMedia, 250); return; }
        m.addEventListener("timeupdate", function () {
          if (!document.hidden && m.currentTime > elapsed) elapsed = m.currentTime;
        });
      })();
    }
    frame.addEventListener("load", watchFilm);

    /* Start, or start over. Everything goes through here, so there is exactly one way the
       film can begin and it always begins at zero. */
    function play() {
      finished = false;
      elapsed = 0;
      stopClock();
      endCard.hidden = true;
      host.classList.remove("ended");
      host.classList.add("playing");
      poster.classList.add("gone");
      frame.src = filmSrc();          // a URL it has never seen — see filmSrc()
      fit();
    }

    poster.addEventListener("click", play);
    host.querySelector(".aqf-again").addEventListener("click", play);
    host.querySelector("[data-restart]").addEventListener("click", play);

    /* ---------------- full screen ---------------- */

    function cssFullFallback(on) {
      host.classList.toggle("is-full", on);
      fit();
    }

    function enterFull() {
      requestFull(host).then(function () {
        lockLandscape();
        fit();
      }).catch(function () {
        cssFullFallback(true);        // iOS Safari, or a browser that refused
      });
    }

    function leaveFull() {
      unlockOrientation();
      if (fsElement() === host) exitFull();
      cssFullFallback(false);
    }

    function isFull() {
      return fsElement() === host || host.classList.contains("is-full");
    }

    host.querySelector("[data-full]").addEventListener("click", function () {
      if (isFull()) leaveFull(); else enterFull();
    });

    /* CLOSE MEANS TWO DIFFERENT THINGS AND HAS TO HANDLE BOTH.
       For a film mounted in the page it means "come out of full screen" — the film stays
       where it was. For the overlay that AQFilm.open() builds over another page, the
       whole thing has to go: onClose removes the element, which is the only way the
       narration stops. Treating that case as merely leaving full screen left an invisible
       div on the page with the film still talking inside it. */
    host.querySelector(".aqf-close").addEventListener("click", function () {
      if (fsElement() === host) exitFull();
      unlockOrientation();
      if (opts.onClose) { opts.onClose(); return; }
      cssFullFallback(false);
    });

    /* Keep the class in step with the browser's own state, so the close button and the
       page's scroll lock stay right even when full screen is left with Escape, with the
       system back gesture, or by the browser itself rather than by our button. */
    function onFsChange() {
      var mine = fsElement() === host;
      host.classList.toggle("is-full", mine);
      if (!mine) unlockOrientation();
      fit();
      setTimeout(fit, 120);
    }
    ["fullscreenchange", "webkitfullscreenchange", "MSFullscreenChange"].forEach(function (e) {
      document.addEventListener(e, onFsChange);
    });

    /* Escape is handled by the browser in real full screen. This is for the CSS fallback,
       and for the overlay opened by AQFilm.open() where nothing else would close it. */
    addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !host.isConnected) return;
      if (fsElement() === host) return;          // the browser closes its own full screen
      if (opts.onClose) { unlockOrientation(); opts.onClose(); return; }
      if (host.classList.contains("is-full")) leaveFull();
    });

    /* Anyone who has asked for less motion gets the poster and a choice, never an
       autoplaying film with sound. */
    var reduce = false;
    try { reduce = matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) {}
    if (opts.autoplay && !reduce) play();

    return { play: play, fit: fit, full: enterFull, exit: leaveFull };
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
