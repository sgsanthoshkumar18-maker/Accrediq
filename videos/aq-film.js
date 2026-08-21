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
      '<div class="aqf-ui"><button data-full aria-label="Full screen">&#9974;</button></div>';

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
