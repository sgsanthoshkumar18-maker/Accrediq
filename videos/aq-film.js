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

  /* WHY THE FILM HAS TO BE TOLD TO START, AND WHY IT HAS TO BE TOLD TO GO TO ZERO.
   *
   * Loaded on its own the bundle comes up PAUSED ON ITS LAST FRAME — the closing card
   * with the price on it — and stays there. Measured on a completely fresh document, with
   * and without a cache-busting URL, in the real frame and in a throwaway one: the
   * narration reports currentTime 42.11 of 42.1 and paused true, before anything on this
   * page has touched it. That is why pressing play showed the ending, and why dragging
   * the scrubber back to 0:00 by hand was the only way to watch it. Nothing on our side
   * was seeking it there; that is simply how the bundle mounts.
   *
   * An earlier guess — that our own ?r= cache-buster was being read as a seek position —
   * was wrong, and reloading harder was never going to fix it.
   *
   * THE TWO CONTROLS USED HERE ARE CHOSEN TO SURVIVE A RE-EXPORT. They are found by
   * aria-label, which is written for screen readers and is stable, rather than by class
   * name or coordinates, which are compiled output and change on every export. The film
   * also documents the same two actions as keyboard shortcuts in those labels — "0" and
   * "space" — so there is a second way in if the buttons are ever restructured.
   *
   * If neither can be found, nothing is pressed and the film behaves exactly as it does
   * today. The failure mode is the current behaviour, never a worse one. */
  /* THE EDITING BAR HAS NO PLACE IN FRONT OF A CUSTOMER.
   *
   * The bundle draws a strip across the bottom of every frame: play/pause, return to
   * start, a timecode, a scrubber, and — worst of the lot — "Export video", which offers
   * any visitor a download of the film. That is a working tool for whoever cut it and an
   * editing timeline to everybody else, on the one page meant to look finished.
   *
   * It is removed only AFTER the two buttons above have been pressed, because they are
   * inside it. It is found by walking up from a button whose title we matched, so it is
   * anchored to something meaningful rather than to a compiled class name or a position;
   * and every step is guarded so the worst outcome is that the bar stays. Nothing here
   * touches the film itself. */
  function hideEditorBar(doc, toStart, playPause) {
    try {
      var seed = toStart || playPause;
      if (!seed) return;
      var bar = seed.parentElement;
      /* Climb until the box is as wide as the frame — the strip — but no further, or we
         would hide the film along with it. */
      for (var i = 0; i < 6 && bar; i++) {
        var r = bar.getBoundingClientRect();
        if (r.width >= 640 && r.height > 0 && r.height <= 70 && r.top >= 720 * 0.8) {
          /* HIDDEN WITH opacity, NOT display, AND THE DIFFERENCE MATTERS.
             display:none takes the strip out of layout, and with it the seek track's
             width — and the width is what our own scrubber needs to convert "62% along"
             into a coordinate to click. Kept laid out but invisible and inert, the strip
             is still measurable while being neither seen nor touchable. */
          bar.style.opacity = "0";
          bar.style.pointerEvents = "none";
          return;
        }
        if (r.height > 70) return;                 // gone past it; leave well alone
        bar = bar.parentElement;
      }
    } catch (e) { /* the film matters more than the tidying */ }
  }

  /* ------------------------------------------------------------------ *
   * TALKING TO THE FILM'S OWN TRANSPORT.
   *
   * The bundle carries a working transport — play/pause, return to start, a live
   * timecode and a seek track — laid out as one strip. We hide the strip (it is an
   * editing timeline, and it offers a download of the film) and drive it from a control
   * bar of our own that belongs to this site.
   *
   * Everything is located by title text and by SHAPE, never by class name or coordinate:
   * the strip is the row holding the two labelled buttons, the readouts are its children
   * that look like a timecode, and the track is the child with three parts and a pointer
   * cursor. Compiled class names change on every export; this description does not.
   *
   * Seeking uses MouseEvent built from the FRAME'S OWN window. PointerEvents do not move
   * it — the track listens for mouse events — and an event constructed from the parent
   * window is not accepted either. That is the one non-obvious detail here, and it was
   * found by trying all three and watching the readout.
   * ------------------------------------------------------------------ */
  function filmParts(doc) {
    try {
      var seed = doc.querySelector('[title^="Return to start"],[aria-label^="Return to start"]');
      if (!seed || !seed.parentElement) return null;
      var bar = seed.parentElement;
      var kids = [].slice.call(bar.children);
      var TIME = /^\d+:\d\d\.\d\d$/;
      var times = kids.filter(function (e) { return TIME.test((e.textContent || "").trim()); });
      var track = kids.filter(function (e) {
        return e.tagName === "DIV" && e.children.length === 3;
      })[0];
      return {
        bar: bar,
        track: track || null,
        cur: times[0] || null,          // left readout: where the film is now
        dur: times[1] || null,          // right readout: how long it runs
        play: bar.querySelector('[title^="Play/pause"],[aria-label^="Play/pause"]'),
        toStart: seed
      };
    } catch (e) { return null; }
  }

  /* "0:21.60" -> 21.6 */
  function parseClock(el) {
    if (!el) return null;
    var m = /^(\d+):(\d\d)\.(\d\d)$/.exec((el.textContent || "").trim());
    if (!m) return null;
    return (+m[1]) * 60 + (+m[2]) + (+m[3]) / 100;
  }

  function startFromZero(doc) {
    var waited = 0;
    (function attempt() {
      var toStart = null, playPause = null;
      try {
        /* title first, because that is what the bundle actually uses — it labels these
           "Return to start (0)" and "Play/pause (space)". aria-label is checked too so
           this keeps working if a later export moves to the more correct attribute. */
        toStart   = doc.querySelector('[title^="Return to start"],[aria-label^="Return to start"]');
        playPause = doc.querySelector('[title^="Play/pause"],[aria-label^="Play/pause"]');
      } catch (e) { return; }

      if (!toStart && !playPause) {
        /* The control bar is drawn by the scene, so it is not there at load. */
        if ((waited += 200) < 12000) setTimeout(attempt, 200);
        return;
      }

      try { if (toStart) toStart.click(); } catch (e) {}

      /* Press play only if it is actually stopped. Pressing a play/pause toggle blindly
         would stop a film that had already started. */
      setTimeout(function () {
        var m = null;
        try { m = doc.querySelector("video, audio"); } catch (e) {}
        var stopped = m ? m.paused : true;
        if (stopped && playPause) { try { playPause.click(); } catch (e) {} }
        hideEditorBar(doc, toStart, playPause);
      }, 90);
    })();
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
      /* Our own transport. The film's is hidden; this one belongs to the site, sits
         outside the frame so it cannot interfere with scrolling, and is sized for a
         thumb as readily as a mouse. */
      '<div class="aqf-bar">' +
        '<button type="button" data-pp aria-label="Play or pause" title="Play / pause (space)">' +
          '<span data-pp-ic>&#10074;&#10074;</span></button>' +
        '<button type="button" data-back aria-label="Back 10 seconds" title="Back 10 seconds">&#8630;10</button>' +
        '<button type="button" data-fwd aria-label="Forward 10 seconds" title="Forward 10 seconds">10&#8631;</button>' +
        '<div class="aqf-seek" data-seek role="slider" tabindex="0" aria-label="Seek"' +
          ' aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
          '<div class="aqf-seek-track"><div class="aqf-seek-fill" data-fill></div></div>' +
        '</div>' +
        '<span class="aqf-time" data-time>0:00 / 0:43</span>' +
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
    var tries = 0, lastScale = -1;
    function fit() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) {
        if (tries++ < 120) setTimeout(fit, 100);
        return;
      }
      tries = 0;
      var s = Math.min(w / W, h / H);
      /* Only write when the number actually changes. On a phone, scrolling shows and
         hides the address bar, which fires resize on every flick; each write to this
         style attribute wakes the site-wide MutationObserver in aq-scroll-lock.js, which
         then re-examines every overlay on the page. Doing that repeatedly during a scroll
         is exactly the wrong moment to be doing it. */
      if (s === lastScale) return;
      lastScale = s;
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
      finished = true;
      endCard.hidden = false;
      host.classList.add("ended");
    }

    /* WHAT DECIDES THAT THE FILM HAS FINISHED — and what used to get it wrong.
     *
     * This used to count seconds itself and call the film over when the count reached
     * its running time. Three things made that count run ahead of the picture: the
     * bundle takes a second or two to boot after the frame loads, the count kept running
     * while the film was paused for being scrolled off screen, and it kept running if
     * the film stalled. Each one brought "Watch it again" up over a film that was still
     * playing — which is what you saw.
     *
     * It now reads the film's OWN timecode, the same number its transport shows. That is
     * the picture's position by definition, so it cannot drift from it. The counter
     * survives only as a fallback for the case where that readout cannot be found, and
     * in that case it keeps its old floor so it can still never fire early. */
    function tick() {
      var P = parts();
      if (P && P.cur && parseClock(P.cur) !== null) { paintTransport(); return; }
      if (!document.hidden) elapsed += 0.25;
      if (elapsed >= total && elapsed >= Math.min(total, 8)) showEnd();
    }

    /* ---------------- our transport, wired to the film's ---------------- */

    var ppIcon  = host.querySelector("[data-pp-ic]");
    var fillEl  = host.querySelector("[data-fill]");
    var seekEl  = host.querySelector("[data-seek]");
    var timeEl  = host.querySelector("[data-time]");

    function doc0() {
      try { return frame.contentDocument; } catch (e) { return null; }
    }
    /* Cached per document. This is consulted four times a second to repaint the bar, and
       re-walking the frame's DOM each time would be needless work on the main thread —
       which is the thread the page scrolls on. Re-resolved whenever the frame loads a new
       document, or if the strip we found has been detached. */
    var partsCache = null, partsDoc = null;
    function parts() {
      var d = doc0();
      if (!d) return null;
      if (d !== partsDoc || !partsCache || !partsCache.bar || !partsCache.bar.isConnected) {
        partsDoc = d;
        partsCache = filmParts(d);
      }
      return partsCache;
    }

    function isPlaying() {
      var m = mediaEl();
      if (m) return !m.paused;
      return host.classList.contains("playing") && !finished;
    }

    function togglePlay() {
      var P = parts();
      if (!P || !P.play) return;
      try { P.play.click(); } catch (e) {}
      pausedByScroll = false;              // a deliberate press overrides the auto-pause
      setTimeout(paintTransport, 60);
    }

    /* Seek by clicking the film's own track at the right fraction along it. The film
       listens for mouse events, and only for ones built from its own window — see
       filmParts() above. */
    function seekFraction(frac) {
      var P = parts(), d = doc0(), w;
      try { w = frame.contentWindow; } catch (e) { return false; }
      if (!P || !P.track || !d || !w || !w.MouseEvent) return false;
      var r = P.track.getBoundingClientRect();
      if (!r.width) return false;
      frac = Math.max(0, Math.min(1, frac));
      var x = r.left + r.width * frac, y = r.top + r.height / 2;
      var o = { bubbles: true, cancelable: true, composed: true,
                clientX: x, clientY: y, button: 0, buttons: 1, view: w };
      ["mousedown", "mousemove", "mouseup", "click"].forEach(function (t) {
        try { P.track.dispatchEvent(new w.MouseEvent(t, o)); } catch (e) {}
      });
      finished = false;                    // seeking backwards un-ends the film
      endCard.hidden = true;
      host.classList.remove("ended");
      setTimeout(paintTransport, 60);
      return true;
    }

    function nudge(seconds) {
      var P = parts();
      var now = P ? parseClock(P.cur) : null;
      var len = P ? parseClock(P.dur) : null;
      if (now === null || !len) return;
      seekFraction((now + seconds) / len);
    }

    function fmt(s) {
      s = Math.max(0, Math.floor(s || 0));
      return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
    }

    /* Repaint the bar from the film's own readout, which is the truth for the PICTURE.
       Everything else — the narration clock, a wall clock — can drift away from what is
       actually on screen. */
    function paintTransport() {
      var P = parts();
      var now = P ? parseClock(P.cur) : null;
      var len = (P ? parseClock(P.dur) : null) || total;
      if (now !== null && len) {
        var pct = Math.max(0, Math.min(100, (now / len) * 100));
        fillEl.style.width = pct + "%";
        seekEl.setAttribute("aria-valuenow", Math.round(pct));
        timeEl.textContent = fmt(now) + " / " + fmt(len);
        if (now >= len - 0.12) showEnd();
      }
      ppIcon.innerHTML = isPlaying() ? "&#10074;&#10074;" : "&#9654;";
    }

    host.querySelector("[data-pp]").addEventListener("click", togglePlay);
    host.querySelector("[data-back]").addEventListener("click", function () { nudge(-10); });
    host.querySelector("[data-fwd]").addEventListener("click", function () { nudge(10); });

    function seekFromEvent(e) {
      var r = seekEl.getBoundingClientRect();
      if (!r.width) return;
      var cx = (e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX);
      seekFraction((cx - r.left) / r.width);
    }
    seekEl.addEventListener("click", seekFromEvent);
    seekEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft")  { e.preventDefault(); nudge(-5); }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(5); }
    });

    /* SPACE PAUSES THE FILM INSTEAD OF SCROLLING THE PAGE — but only while the film is
       on screen and running, and never while someone is typing. Swallowing the space bar
       site-wide would break every form on it. */
    addEventListener("keydown", function (e) {
      if (e.key !== " " && e.key !== "Spacebar" && e.code !== "Space") return;
      if (!host.isConnected || !host.classList.contains("playing")) return;
      var t = e.target;
      if (t && (t.isContentEditable ||
                /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName))) return;
      var r = host.getBoundingClientRect();
      var onScreen = r.bottom > 0 && r.top < innerHeight && r.height > 0;
      if (!onScreen) return;
      e.preventDefault();                  // this is what stops the page jumping
      togglePlay();
    });

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

      startFromZero(doc);

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

    /* HOLD THE FILM STILL WHILE IT IS OFF SCREEN.
     *
     * The scene animates on requestAnimationFrame and does not stop when it scrolls out
     * of view — so once someone had pressed play, a 1280x720 animation kept running for
     * the rest of their visit, behind whatever they were reading. That is wasted battery
     * on a phone and wasted frames everywhere, and it is paid for exactly when the page
     * is being scrolled.
     *
     * Only what we paused do we resume, and only if the film has not finished, so this
     * can never start a film nobody asked for. If the player's button cannot be found
     * nothing happens and the old behaviour stands. */
    var pausedByScroll = false;

    function filmButton(sel) {
      try {
        var d = frame.contentDocument;
        return d ? d.querySelector(sel) : null;
      } catch (e) { return null; }
    }
    function mediaEl() {
      try { var d = frame.contentDocument; return d ? d.querySelector("video, audio") : null; }
      catch (e) { return null; }
    }
    function setPlaying(want) {
      var btn = filmButton('[title^="Play/pause"],[aria-label^="Play/pause"]');
      if (!btn) return false;
      var m = mediaEl();
      var isPlaying = m ? !m.paused : null;
      if (isPlaying === null || isPlaying === want) return false;
      try { btn.click(); } catch (e) {}
      return true;
    }

    try {
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        if (!e) return;
        if (!e.isIntersecting) {
          if (!finished && host.classList.contains("playing")) {
            pausedByScroll = setPlaying(false) || pausedByScroll;
          }
        } else if (pausedByScroll && !finished) {
          if (setPlaying(true)) pausedByScroll = false;
        }
      }, { threshold: 0.01 }).observe(host);
    } catch (e) {}

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
