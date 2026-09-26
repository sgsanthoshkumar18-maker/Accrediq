/* AQcredix — the founder hero. He types until you arrive, then watches you.
 *
 * WHY THIS DRAWS TO A CANVAS INSTEAD OF STACKING ELEMENTS.
 * The previous build stacked a <video>, an <img> and another <video> and
 * cross-faded their CSS opacity. Two things go wrong with that and both of them
 * show as a black flash:
 *
 *   - While two layers are each partly transparent, whatever is behind them
 *     shows through the middle of the blend. Behind them is the page, which on
 *     this theme is black.
 *   - Assigning a new src to an <img> can leave it with nothing to paint for a
 *     frame or two, even when the file is already cached. A blank <img> at full
 *     opacity is a black rectangle.
 *
 * On a canvas neither can happen, because compositing stops being the browser's
 * decision. Every animation frame this draws the outgoing picture at full
 * opacity and then the incoming one over the top of it at a rising alpha. There
 * is never a moment when the canvas is showing less than one complete image, so
 * there is nothing for the background to show through.
 *
 * HOW HE KNOWS WHERE TO LOOK.
 * The turn is 21 stills ordered by measured head angle, not by timestamp — the
 * source clip's yaw does not rise monotonically with time, so ordering by time
 * produced a strip that wandered back and forth. For each frame the horizontal
 * centre of the face was compared with the horizontal centre of the whole head:
 * they coincide when he faces the camera and separate as he turns, and because
 * it is a difference, him leaning or shifting in the seat cancels out. Frames
 * were then taken at even steps of that measure.
 *
 * The strip is NOT symmetrical — the clip sweeps from his full left profile
 * round to the front and only barely past it, so "facing the camera" sits at
 * index 14 of 20 rather than in the middle. That index is stored in the
 * manifest and the cursor is mapped to it piecewise, which is what makes him
 * actually look at the pointer instead of somewhere near it.
 *
 * The angle is measured from HIS HEAD, not from the middle of the window. The
 * picture is letterboxed inside the stage, so the two are not the same place,
 * and using the window's centre is what made his gaze sit off to one side.
 */
(function () {
  "use strict";

  var SOUND_KEY = "aq-hero-sound";
  var FADE = 200;                     // ms, source-to-source dissolve

  function init() {
    var hero = document.getElementById("fpHero");
    var root = document.getElementById("fpVideo");
    if (!root) return;

    /* How far down the page the hero starts. The notice and header sit above
       it, and how tall the notice wraps to is a fact about rendered text that
       CSS cannot ask for. Without it a 100svh hero hangs off the bottom. */
    function measureTop() {
      if (!hero) return;
      var t = hero.getBoundingClientRect().top + (window.scrollY || 0);
      document.documentElement.style.setProperty("--fpv-top", Math.max(0, Math.round(t)) + "px");
    }
    measureTop();
    var rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt); rt = setTimeout(measureTop, 120);
    }, { passive: true });
    window.addEventListener("load", measureTop);
    document.addEventListener("aq:content", measureTop);

    var base = (document.body && document.body.getAttribute("data-base")) || "";
    var dir = base + "profile/hero/";

    var canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced || !canHover) {
      root.classList.add("fpv-still");
      root.style.backgroundImage = "url(" + dir + "poster.webp)";
      return;
    }

    /* The poster sits under the canvas as a plain background. Until the first
       real frame is drawn there is still a picture there, so the stage is never
       an empty rectangle even for one frame. */
    root.style.backgroundImage = "url(" + dir + "poster.webp)";

    /* ---------------- sources ---------------- */

    var canvas = document.createElement("canvas");
    canvas.className = "fpv-canvas";
    canvas.setAttribute("aria-hidden", "true");
    root.appendChild(canvas);
    /* alpha:true, deliberately. An {alpha:false} canvas starts as opaque BLACK,
       so in the moment before the first draw — and anywhere the draw loop does
       not run at all — the stage would be a black rectangle. That is the exact
       thing this rewrite exists to remove. Transparent means the poster
       underneath shows instead, which is a picture of him. */
    var ctx = canvas.getContext("2d");

    function mkVideo(name, loop) {
      var v = document.createElement("video");
      v.className = "fpv-src";
      v.src = dir + name + ".mp4";
      v.loop = !!loop;
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.setAttribute("aria-hidden", "true");
      v.setAttribute("tabindex", "-1");
      v.preload = "auto";
      root.appendChild(v);
      return v;
    }
    var idle = mkVideo("idle", true);
    var wave = mkVideo("wave", false);

    var frames = [], nFrames = 0, neutral = 0, ready = false;

    /* ---------------- drawing ---------------- */

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = 0, cssH = 0;

    function resize() {
      var r = root.getBoundingClientRect();
      cssW = Math.max(1, Math.round(r.width));
      cssH = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
    }
    resize();
    /* MEASURE WHEN THE BOX ACTUALLY CHANGES, not when the script happens to run.
       Reading getBoundingClientRect() during init caught the stage mid-layout
       and pinned the canvas at one pixel wide — and because nothing resized the
       window afterwards, it stayed that way. A ResizeObserver fires on the
       first real layout and on every change after it, including the ones no
       resize event is raised for: fonts arriving, the notice above wrapping to
       a different height, a scrollbar appearing. */
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { measureTop(); resize(); });
      ro.observe(root);
      if (hero) ro.observe(hero);
    }
    window.addEventListener("resize", function () {
      clearTimeout(rt); rt = setTimeout(function () { measureTop(); resize(); }, 120);
    }, { passive: true });

    function dims(src) {
      if (src && src.tagName === "VIDEO") return { w: src.videoWidth, h: src.videoHeight };
      return { w: src ? src.naturalWidth : 0, h: src ? src.naturalHeight : 0 };
    }

    /* Replicates object-fit in canvas, because the fit has to be identical for
       every source or he jumps size between the typing clip and the stills.
       contain on a landscape screen keeps his head and the whole desk in shot;
       a portrait screen fills instead, anchored high on him, because containing
       a 16:9 frame in a tall window leaves him a strip across the middle. */
    var portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
    function rectFor(src) {
      var d = dims(src);
      if (!d.w || !d.h) return null;
      var sa = d.w / d.h, ca = cssW / cssH, w, h;
      if (portrait.matches ? (sa < ca) : (sa > ca)) { w = cssW; h = cssW / sa; }
      else { h = cssH; w = cssH * sa; }
      var ox = (cssW - w) / 2;
      var oy = portrait.matches ? (cssH - h) * 0.30 : (cssH - h) / 2;
      return { x: ox, y: oy, w: w, h: h };
    }

    function paint(src, alpha) {
      if (!src) return;
      var d = dims(src);
      if (!d.w || !d.h) return;
      if (src.tagName === "VIDEO" && src.readyState < 2) return;
      var r = rectFor(src);
      if (!r) return;
      ctx.globalAlpha = alpha;
      try { ctx.drawImage(src, r.x * dpr, r.y * dpr, r.w * dpr, r.h * dpr); } catch (e) {}
      ctx.globalAlpha = 1;
    }

    /* ---------------- state ---------------- */

    /* The poster is what the canvas starts on, so the first painted frame is a
       real picture rather than an empty surface waiting on a video to decode. */
    var poster = new Image();
    poster.src = dir + "poster.webp";

    var shown = poster;                // what is on screen
    var incoming = null;               // what is dissolving in
    var mixStart = 0;
    var mode = "rest";                 // rest | track | greet

    function switchTo(src) {
      if (src === shown && !incoming) return;
      if (src === incoming) return;
      /* Mid-dissolve: let the one that is arriving become the one that is here,
         so the new dissolve starts from a complete picture rather than from a
         half-finished blend. */
      if (incoming) { shown = incoming; }
      incoming = src;
      mixStart = performance.now();
    }

    var trackIdx = 0, targetIdx = 0;

    function currentTrackImage() {
      var i = Math.max(0, Math.min(nFrames - 1, Math.round(trackIdx)));
      return frames[i] && frames[i].complete ? frames[i] : null;
    }

    function frame(now) {
      /* Ease toward the pointer. A head does not teleport, and this is also
         what turns a fast flick across the screen into a turn. */
      trackIdx += (targetIdx - trackIdx) * 0.16;

      if (mode === "track") {
        var im = currentTrackImage();
        if (im) {
          /* Within tracking the frames are not dissolved — consecutive stills
             are a few degrees apart and a dissolve would only smear them. */
          if (shown !== im && !incoming) shown = im;
          else if (incoming && incoming.tagName !== "VIDEO") incoming = im;
        }
      }

      var fill = shown && shown.tagName === "VIDEO" ? null : null;
      ctx.globalAlpha = 1;

      /* THE ORDER MATTERS. The outgoing picture is laid down whole, then the
         incoming one is drawn over it. The canvas is never showing less than
         one complete image, which is the entire reason there is no flash. */
      paint(shown, 1);

      if (incoming) {
        var t = (now - mixStart) / FADE;
        if (t >= 1) { shown = incoming; incoming = null; paint(shown, 1); }
        else { paint(incoming, t < 0 ? 0 : t); }
      }

      window.requestAnimationFrame(frame);
    }

    /* ---------------- boot the sources ---------------- */

    function startIdle() {
      var p = idle.play();
      if (p && p.catch) p.catch(arm);
    }
    var armed = false;
    function arm() {
      if (armed) return;
      armed = true;
      ["pointerdown", "pointermove", "keydown", "touchstart"].forEach(function (e) {
        window.addEventListener(e, function () { armed = false; startIdle(); },
                                { once: true, passive: true });
      });
    }
    startIdle();
    /* Hand the resting state from the poster to the moving clip only once the
       clip actually has a frame to give. Switching first and waiting for the
       decode is what puts an empty rectangle on screen. */
    if (idle.readyState >= 2) switchTo(idle);
    else idle.addEventListener("loadeddata", function () {
      if (mode === "rest") switchTo(idle);
    }, { once: true });
    window.requestAnimationFrame(frame);

    fetch(dir + "track/frames.json").then(function (r) { return r.json(); }).then(function (m) {
      nFrames = m.n; neutral = m.neutral;
      trackIdx = targetIdx = neutral;
      var pending = nFrames;
      for (var i = 0; i < nFrames; i++) {
        (function (k) {
          var im = new Image();
          im.decoding = "async";
          im.onload = im.onerror = function () { if (--pending === 0) ready = true; };
          im.src = dir + "track/t" + (k < 10 ? "0" : "") + k + ".webp";
          frames[k] = im;
        })(i);
      }
    }).catch(function () { /* no manifest: he simply keeps typing */ });

    /* ---------------- the pointer ---------------- */

    var stage = root.closest(".fpv-stage") || root;

    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (mode === "greet" || !ready || !nFrames) return;

      /* WHERE HE IS, not where the window is. The picture is letterboxed inside
         the stage, so his head is at the middle of the DRAWN rect — which on a
         wide screen is nowhere near the middle of the page. */
      var r = rectFor(frames[neutral] || idle);
      var box = root.getBoundingClientRect();
      var headX = box.left + (r ? r.x + r.w / 2 : box.width / 2);

      var dx = e.clientX - headX;
      var reach = Math.max(240, box.width * 0.45);
      var t = Math.max(-1, Math.min(1, dx / reach));

      /* Piecewise, because the strip is not symmetrical about the front. To his
         left there are 14 frames of turn; to his right only 6. Mapping linearly
         across all 21 would put "facing the camera" at the wrong place and his
         gaze would sit permanently off to one side. */
      targetIdx = t < 0 ? neutral + t * neutral
                        : neutral + t * (nFrames - 1 - neutral);

      if (mode !== "track") { mode = "track"; switchTo(currentTrackImage() || frames[neutral]); }
    }, { passive: true });

    stage.addEventListener("pointerleave", function () {
      if (mode === "greet") return;
      mode = "rest";
      targetIdx = neutral;
      switchTo(idle);
      startIdle();
    }, { passive: true });

    /* ---------------- the greeting ---------------- */

    function soundOn() {
      try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { return true; }
    }

    var greetTimer = null;
    function greet(e) {
      if (e) e.preventDefault();
      if (mode === "greet") return;
      mode = "greet";
      wave.muted = !soundOn();
      try { wave.currentTime = 0; } catch (err) {}

      /* Show it only once there is a frame to show. Switching first and waiting
         for the decode is what used to put a blank rectangle on screen. */
      function reveal() { switchTo(wave); }
      if (wave.readyState >= 2) reveal();
      else wave.addEventListener("loadeddata", reveal, { once: true });

      var p = wave.play();
      if (p && p.catch) p.catch(function () {
        wave.muted = true;
        var q = wave.play();
        if (q && q.catch) q.catch(done);
      });

      function done() {
        wave.removeEventListener("ended", done);
        if (greetTimer) { clearTimeout(greetTimer); greetTimer = null; }
        mode = "rest";
        switchTo(idle);
        startIdle();
      }
      wave.addEventListener("ended", done);
      var ms = ((wave.duration && isFinite(wave.duration)) ? wave.duration * 1000 : 4300) + 700;
      if (greetTimer) clearTimeout(greetTimer);
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
      var paintBtn = function () {
        var on = soundOn();
        btn.querySelector("svg").innerHTML = on ? ON : OFF;
        if (label) label.textContent = on ? "Sound on" : "Sound off";
        btn.setAttribute("aria-pressed", String(on));
        btn.setAttribute("aria-label", on ? "Turn the greeting's sound off"
                                          : "Turn the greeting's sound on");
      };
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        try { localStorage.setItem(SOUND_KEY, soundOn() ? "off" : "on"); } catch (err) {}
        paintBtn();
        if (mode === "greet") wave.muted = !soundOn();
      });
      paintBtn();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        try { idle.pause(); } catch (e) {}
        try { wave.pause(); } catch (e) {}
      } else if (mode === "rest") startIdle();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
