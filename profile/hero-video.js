/* AQcredix — the founder hero: he types until you arrive, then watches you.
 *
 * THREE STATES, AND ONLY ONE IS A VIDEO PLAYING FREELY.
 *
 *   resting   the idle clip loops — he is working, head down
 *   tracking  a still frame chosen by where your cursor is, updated per frame
 *   greeting  the wave clip plays once, with sound if sound is on
 *
 * WHY TRACKING IS STILLS AND NOT VIDEO. Following a cursor means the head angle
 * has to be a function of pointer position — not of time. A video can only be
 * scrubbed by seeking, and seeking is frame-exact only on keyframes; between
 * them browsers land where they like, and on iOS Safari that is anywhere at
 * all. So the turn was measured, sliced, and shipped as 19 stills. Choosing an
 * image by index is instant and exact on every browser there is, which is why
 * this responds the moment you move rather than a beat later.
 *
 * HOW THE 19 WERE CHOSEN. Not by time — by measured head angle. Every frame of
 * the source had the horizontal centroid of its skin pixels computed, which
 * rises monotonically as he turns from his left to his right. Frames were then
 * picked at even steps of THAT, inside the one stretch of the clip where the
 * measure never went backwards. Even time steps would have bunched the stills
 * where he paused and starved them where he actually moved.
 *
 * THE POSITION IS SMOOTHED, NOT SNAPPED. The pointer jumps in pixels; a head
 * does not. Each frame the index eases toward the target by a fraction of the
 * remaining distance, so a fast flick across the screen becomes a turn rather
 * than a teleport. The easing runs on requestAnimationFrame and stops itself
 * when it arrives, so an idle page costs nothing.
 *
 * SOUND IS OFF UNLESS ASKED FOR, AND ONLY EVER ON A CLICK. The greeting is the
 * only clip with audio and it only plays when somebody clicks him or his name —
 * a gesture, so no browser blocks it and nobody is ambushed by noise. The
 * choice is remembered.
 */
(function () {
  "use strict";

  var FRAMES = 19;                       // profile/hero/track/t00..t18.webp
  var SOUND_KEY = "aq-hero-sound";

  /* HOW FAR DOWN THE PAGE THE HERO STARTS.
     The standards notice and the site header sit above it, and how tall the
     notice wraps to depends on the viewport — a fact about rendered text that
     CSS has no way to ask for. Without this the hero is a full viewport tall
     but begins below them, so its lower edge and everything pinned to it hangs
     off the bottom of the screen. Runs on load and on resize, and is cheap:
     one measurement and one custom property. */
  function measureTop() {
    var hero = document.getElementById("fpHero");
    if (!hero) return;
    var top = hero.getBoundingClientRect().top + (window.scrollY || 0);
    document.documentElement.style.setProperty("--fpv-top", Math.max(0, Math.round(top)) + "px");
  }

  function init() {
    measureTop();
    var resizeT = null;
    window.addEventListener("resize", function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(measureTop, 120);
    }, { passive: true });
    /* The notice is injected by app.js after this runs, so measure again once
       the page has settled — otherwise the offset is taken before the thing it
       is measuring exists. */
    window.addEventListener("load", measureTop);
    document.addEventListener("aq:content", measureTop);

    var root = document.getElementById("fpVideo");
    if (!root) return;

    var base = (document.body && document.body.getAttribute("data-base")) || "";
    var dir = base + "profile/hero/";

    var canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* No cursor means nothing to follow, and reduced motion means don't. One
       still, and none of the clips or frames are fetched at all. */
    if (reduced || !canHover) {
      root.classList.add("fpv-still");
      root.style.backgroundImage = "url(" + dir + "poster.webp)";
      return;
    }

    /* ---------------- the layers ---------------- */

    function video(name, loop) {
      var v = document.createElement("video");
      v.className = "fpv-clip";
      v.src = dir + name + ".mp4";
      v.loop = !!loop;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.setAttribute("aria-hidden", "true");
      v.setAttribute("tabindex", "-1");
      v.preload = "auto";
      root.appendChild(v);
      return v;
    }

    var idle = video("idle", true);
    idle.muted = true; idle.defaultMuted = true;
    idle.classList.add("is-on");

    var wave = video("wave", false);      // muted state is decided at play time

    /* The tracking layer is one <img> whose src is swapped. One element, not
       nineteen: nineteen stacked images is nineteen composited layers on every
       frame, and the browser will happily drop frames over it. */
    var track = document.createElement("img");
    track.className = "fpv-clip fpv-track";
    track.alt = "";
    track.setAttribute("aria-hidden", "true");
    track.decoding = "async";
    root.appendChild(track);

    /* Preload every frame, so the first cursor move does not land on a blank
       element while the browser fetches. They are ~17KB each. */
    var loaded = 0, srcs = [];
    for (var i = 0; i < FRAMES; i++) {
      var n = (i < 10 ? "0" : "") + i;
      srcs.push(dir + "track/t" + n + ".webp");
      (function (u) {
        var im = new Image();
        im.onload = im.onerror = function () { loaded++; };
        im.src = u;
      })(srcs[i]);
    }
    track.src = srcs[Math.floor(FRAMES / 2)];   // facing front

    /* ---------------- state ---------------- */

    var MODE_REST = 0, MODE_TRACK = 1, MODE_GREET = 2;
    var mode = MODE_REST;
    var greetTimer = null;

    function startIdle() {
      var p = idle.play();
      if (p && p.catch) p.catch(armGesture);
    }
    var armed = false;
    function armGesture() {
      if (armed) return;
      armed = true;
      ["pointerdown", "pointermove", "keydown", "touchstart"].forEach(function (e) {
        window.addEventListener(e, function once() { armed = false; startIdle(); },
                                { once: true, passive: true });
      });
    }
    startIdle();

    function layerFor(m) {
      return m === MODE_REST ? idle : (m === MODE_TRACK ? track : wave);
    }

    function setMode(next) {
      if (mode === next) return;
      mode = next;

      /* SHOW THE NEW LAYER FIRST AND LEAVE THE OLD ONE UP.
         The CSS lifts whatever carries is-on above the rest, so the incoming
         layer dissolves in over a picture. Switching the outgoing one off in
         the same tick is what produced a dip to the page colour between the
         two — it is only dropped once it is completely covered. */
      layerFor(next).classList.add("is-on");

      if (next === MODE_REST) startIdle();

      window.setTimeout(function () {
        if (mode !== next) return;                 // it changed again mid-fade
        [idle, track, wave].forEach(function (el) {
          if (el !== layerFor(mode)) el.classList.remove("is-on");
        });
        if (mode !== MODE_REST) { try { idle.pause(); } catch (e) {} }
        if (mode !== MODE_GREET) { try { wave.pause(); wave.currentTime = 0; } catch (e) {} }
      }, 180);
    }

    /* ---------------- the cursor drives the head ---------------- */

    var stage = root.closest(".fpv-stage") || root;
    var targetIdx = (FRAMES - 1) / 2;
    var currentIdx = targetIdx;
    var raf = null;
    var shownIdx = -1;

    function show(idx) {
      var i = Math.max(0, Math.min(FRAMES - 1, Math.round(idx)));
      if (i === shownIdx) return;
      shownIdx = i;
      track.src = srcs[i];
    }

    function tick() {
      /* Ease a fraction of the remaining distance each frame: fast when far,
         slow as it arrives, which is how a head actually moves. */
      currentIdx += (targetIdx - currentIdx) * 0.18;
      show(currentIdx);
      if (Math.abs(targetIdx - currentIdx) > 0.02) {
        raf = window.requestAnimationFrame(tick);
      } else {
        currentIdx = targetIdx;
        show(currentIdx);
        raf = null;                       // arrived: stop burning frames
      }
    }
    function aim(idx) {
      targetIdx = idx;
      /* TAKE A STEP RIGHT NOW, don't only schedule one.
         requestAnimationFrame is throttled to nothing in a background tab, and
         some browsers throttle it under battery saver and inside embedded web
         views too. Relying on it alone means that in those cases the head never
         moves at all — which reads as broken rather than as less smooth. This
         immediate step keeps him following the cursor on pointer events alone;
         rAF, when it runs, just makes the motion continuous between them. */
      currentIdx += (targetIdx - currentIdx) * 0.35;
      show(currentIdx);
      if (raf == null) raf = window.requestAnimationFrame(tick);
    }

    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (mode === MODE_GREET) return;    // let the greeting finish uninterrupted
      if (mode !== MODE_TRACK) setMode(MODE_TRACK);
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / (r.width || 1);
      x = Math.max(0, Math.min(1, x));
      aim(x * (FRAMES - 1));
    }, { passive: true });

    stage.addEventListener("pointerleave", function () {
      if (mode === MODE_GREET) return;
      /* Back to work. He returns to the front-facing frame first so the cut to
         the typing clip is between two similar pictures. */
      aim((FRAMES - 1) / 2);
      setMode(MODE_REST);
    }, { passive: true });

    /* ---------------- the greeting ---------------- */

    function soundOn() {
      try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { return true; }
    }

    function greet(e) {
      if (e) e.preventDefault();
      if (mode === MODE_GREET) return;
      setMode(MODE_GREET);
      wave.muted = !soundOn();
      try { wave.currentTime = 0; } catch (err) {}
      var p = wave.play();
      if (p && p.catch) p.catch(function () {
        /* Sound refused for some reason — show it silently rather than not at
           all. Never leave the visitor with a click that did nothing. */
        wave.muted = true;
        var q = wave.play(); if (q && q.catch) q.catch(function () { setMode(MODE_REST); });
      });

      if (greetTimer) clearTimeout(greetTimer);
      function done() {
        wave.removeEventListener("ended", done);
        if (greetTimer) { clearTimeout(greetTimer); greetTimer = null; }
        setMode(MODE_REST);
      }
      wave.addEventListener("ended", done);
      var ms = ((wave.duration && isFinite(wave.duration)) ? wave.duration * 1000 : 4300) + 700;
      greetTimer = window.setTimeout(done, ms);
    }

    root.addEventListener("click", greet);
    root.style.cursor = "pointer";
    var hit = document.getElementById("fpvNameHit");
    if (hit) {
      hit.addEventListener("click", greet);
      hit.addEventListener("focusin", function () { greet(); });
    }

    /* ---------------- the sound switch ---------------- */

    var btn = document.getElementById("fpvSound");
    if (btn) {
      var label = btn.querySelector(".fpv-sound-label");
      var ON = '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>';
      var OFF = '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/>';
      function paint() {
        var on = soundOn();
        btn.querySelector("svg").innerHTML = on ? ON : OFF;
        if (label) label.textContent = on ? "Sound on" : "Sound off";
        btn.setAttribute("aria-pressed", String(on));
        btn.setAttribute("aria-label", on ? "Turn the greeting's sound off"
                                          : "Turn the greeting's sound on");
      }
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        try { localStorage.setItem(SOUND_KEY, soundOn() ? "off" : "on"); } catch (err) {}
        paint();
        /* If he is mid-greeting, honour it immediately rather than next time. */
        if (mode === MODE_GREET) wave.muted = !soundOn();
      });
      paint();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        try { idle.pause(); } catch (e) {}
        try { wave.pause(); } catch (e) {}
      } else if (mode === MODE_REST) { startIdle(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
