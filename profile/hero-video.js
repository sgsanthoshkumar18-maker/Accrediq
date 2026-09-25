/* AQcredix — the founder hero: a character who answers the cursor.
 *
 * WHY THIS IS NOT A CROSSFADE ANY MORE, AND WHY THAT WAS THE BUG.
 * The first version faded one <video> out while fading another in. Two clips
 * at 50% opacity do not add back up to one picture — they wash out, and
 * whatever the container is painted with shows through the gap between them.
 * That is the white blink: for a few frames you are looking at half a video,
 * half another video and a bit of the page, which is exactly the "a video just
 * started" tell this is supposed to hide.
 *
 * So there is no crossfade. THE IDLE CLIP IS A BASE LAYER THAT NEVER STOPS AND
 * NEVER FADES. Reactions are opaque overlays that appear ON TOP of it. At every
 * instant the screen is showing one fully opaque video and nothing else. An
 * overlay is only revealed once its first frame is decoded and painted, so it
 * can never flash an empty element, and it is only hidden after the base has
 * been confirmed running underneath.
 *
 * Every clip opens and closes on the same seated working pose, so an overlay
 * appearing or leaving lands on a near-identical frame. With no opacity ramp to
 * betray it, the switch reads as the man simply moving.
 *
 *   pointer left of him   -> he looks left
 *   pointer right of him  -> he looks right
 *   click him, or his name -> he waves and gestures down the page
 *
 * He does not track the cursor. The cursor chooses a take. That is the only
 * thing four fixed clips can honestly do, and it is also the thing that reads
 * as a person noticing you rather than a puppet on a string.
 *
 * Decoration, and it behaves like one: silent, aria-hidden, and replaced by a
 * still for anyone on a touch screen or asking for reduced motion.
 */
(function () {
  "use strict";

  function init() {
    var root = document.getElementById("fpVideo");
    if (!root) return;

    var base = (document.body && document.body.getAttribute("data-base")) || "";
    var dir = base + "profile/hero/";

    var canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !canHover) {
      root.classList.add("fpv-still");
      root.style.backgroundImage = "url(" + dir + "poster.webp)";
      return;
    }

    function make(name, isBase) {
      var v = document.createElement("video");
      v.className = "fpv-clip" + (isBase ? " fpv-base" : "");
      v.src = dir + name + ".mp4";
      v.muted = true;
      v.defaultMuted = true;
      v.loop = !!isBase;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.setAttribute("aria-hidden", "true");
      v.setAttribute("tabindex", "-1");
      v.preload = "auto";
      /* NO poster attribute. A poster is painted before the first frame and
         removed after it, which is one more visible swap on a surface whose
         entire job is to have no visible swaps. The still underneath the
         element does that job instead, and it never moves. */
      root.appendChild(v);
      return v;
    }

    var idle = make("idle", true);
    var over = {
      left: make("left", false),
      right: make("right", false),
      wave: make("wave", false)
    };

    /* One decoded frame, for real.
       requestVideoFrameCallback fires when a frame has actually been presented,
       which is the only reliable "there is now a picture in this element"
       signal. Without it, revealing on 'playing' shows an element that has
       started but not yet painted — a single blank frame, and a blank frame at
       full opacity is a flash. */
    function onFirstFrame(v, cb) {
      var done = false;
      function fire() { if (!done) { done = true; cb(); } }
      if (typeof v.requestVideoFrameCallback === "function") {
        v.requestVideoFrameCallback(fire);
        /* Belt and braces: some builds never fire it for a looping muted clip. */
        window.setTimeout(fire, 400);
      } else {
        v.addEventListener("timeupdate", function h() {
          v.removeEventListener("timeupdate", h); fire();
        });
        window.setTimeout(fire, 400);
      }
    }

    var playing = null;      // which overlay is up, or null for the base
    var queued = null;
    var endTimer = null;

    function startBase() {
      var p = idle.play();
      if (p && p.catch) p.catch(function () { armFirstGesture(); });
    }

    var armed = false;
    function armFirstGesture() {
      if (armed) return;
      armed = true;
      ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"].forEach(function (e) {
        window.addEventListener(e, function once() { armed = false; startBase(); }, { once: true, passive: true });
      });
    }
    startBase();

    function hideOverlay(v) {
      v.classList.remove("is-on");
      /* Pause a beat later. Pausing while it is still the visible layer freezes
         a frame; by the time this runs the base is what is on screen. */
      window.setTimeout(function () {
        if (playing !== v) { try { v.pause(); v.currentTime = 0; } catch (e) {} }
      }, 60);
    }

    function play(name) {
      var v = over[name];
      if (!v) return;

      /* Already showing this one: let it finish rather than restarting, which
         would be a visible jump back to the first frame. */
      if (playing === v) return;

      if (playing) { queued = name; return; }

      playing = v;
      try { v.currentTime = 0; } catch (e) {}
      var p = v.play();
      if (p && p.catch) p.catch(function () { playing = null; });

      onFirstFrame(v, function () {
        if (playing === v) v.classList.add("is-on");
      });

      if (endTimer) { clearTimeout(endTimer); endTimer = null; }
      function finish() {
        v.removeEventListener("ended", finish);
        if (endTimer) { clearTimeout(endTimer); endTimer = null; }
        playing = null;
        hideOverlay(v);
        if (queued) { var q = queued; queued = null; play(q); }
      }
      v.addEventListener("ended", finish);
      /* If the clip stalls, 'ended' never comes and he would be frozen
         mid-gesture for good. */
      var ms = ((v.duration && isFinite(v.duration)) ? v.duration * 1000 : 4200) + 800;
      endTimer = window.setTimeout(finish, ms);
    }

    /* ---------------- what the pointer means ----------------
       Measured against the CHARACTER, not the window. He is centred in the
       frame, so "left of him" is the left of the stage — but on a wide screen
       the stage is much wider than he is, and a band either side of centre
       should count as "at him" rather than "to one side". */
    var stage = root.closest(".fpv-stage") || root;
    var lastSide = "";
    var sideTimer = null;

    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / (r.width || 1);
      var side = x < 0.38 ? "left" : (x > 0.62 ? "right" : "centre");
      if (side === lastSide) return;
      lastSide = side;
      if (sideTimer) clearTimeout(sideTimer);
      if (side === "centre") return;
      /* A short settle. Crossing the stage on the way to the navigation passes
         through both sides in under 200ms, and answering each one makes him
         look twitchy rather than attentive. */
      sideTimer = window.setTimeout(function () { play(side); }, 130);
    }, { passive: true });

    stage.addEventListener("pointerleave", function () {
      lastSide = "";
      if (sideTimer) { clearTimeout(sideTimer); sideTimer = null; }
    }, { passive: true });

    /* ---------------- the greeting ----------------
       Click, not hover: hovering the name fires it on the way past, and a
       greeting that happens by accident stops being a greeting. Clicking him
       does the same thing, because that is what people try. */
    function greet(e) { if (e) e.preventDefault(); play("wave"); }

    var hit = document.getElementById("fpvNameHit");
    if (hit) {
      hit.addEventListener("click", greet);
      hit.addEventListener("focusin", function () { play("wave"); });
    }
    root.addEventListener("click", greet);
    root.style.cursor = "pointer";

    document.addEventListener("visibilitychange", function () {
      var v = playing || idle;
      if (document.hidden) { try { v.pause(); } catch (e) {} }
      else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
