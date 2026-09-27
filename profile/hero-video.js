/* AQcredix — the founder hero. He works at his laptop. Click him and he waves,
 * points to what is below, and goes back to work.
 *
 * THERE IS NO CURSOR TRACKING HERE, AND THAT IS DELIBERATE.
 * An earlier build turned his head toward the pointer by swapping between 28
 * stills chosen by measured head angle. It never read as a person looking at
 * you. The poses were sampled from a clip that was never shot for it, so the
 * reachable angles were narrow and unevenly spread, and between any two of them
 * his shoulders and hands jumped, because only the head had been matched.
 * Every attempt to smooth that — weighting the axes, easing toward the target,
 * dissolving neighbours — traded one artefact for another, and the honest
 * summary is that the footage could not support the effect. It is gone: the
 * pointer now does nothing at all, and he simply keeps working.
 *
 * WHY THIS DRAWS TO A CANVAS INSTEAD OF STACKING ELEMENTS.
 * The clips still have to hand over to one another when he greets you, and
 * cross-fading the CSS opacity of stacked <video> elements shows as a black
 * flash: while two layers are each partly transparent, whatever is behind them
 * shows through the middle of the blend, and behind them is the page.
 *
 * On a canvas that cannot happen, because compositing stops being the browser's
 * decision. Every animation frame draws the outgoing picture at full opacity
 * and then the incoming one over the top of it at a rising alpha. The canvas is
 * never showing less than one complete image, so there is nothing for the
 * background to show through.
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
    var lastTop = -1;
    function measureTop() {
      if (!hero) return;
      var t = Math.max(0, Math.round(hero.getBoundingClientRect().top + (window.scrollY || 0)));
      if (t === lastTop) return;                 // nothing to write, no layout thrash
      lastTop = t;
      document.documentElement.style.setProperty("--fpv-top", t + "px");
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

    /* REDUCED MOTION IS THE ONLY THING THAT STOPS THE CLIPS LOADING NOW.
       This used to bail out for coarse pointers as well, because the effect it
       was protecting was a hover effect there was no way to drive by touch. The
       greeting is a TAP, so a phone can have it — there is nothing left on this
       stage that a touch device cannot do. */
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
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
       thing the canvas was adopted to remove. Transparent means the poster
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

    /* ---------------- drawing ---------------- */

    /* 1.5, not 2. At devicePixelRatio 2 a full-screen MacBook canvas is around
       3400x2000 device pixels, and drawing a picture across all of them every
       frame is the single most expensive thing on this page. The source is 1280
       wide and is being upscaled either way, so the extra device pixels were
       buying nothing. */
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var cssW = 0, cssH = 0;

    function resize() {
      var r = root.getBoundingClientRect();
      cssW = Math.max(1, Math.round(r.width));
      cssH = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      dirty = true;                      // a resized canvas is a blank one
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
       both clips or he jumps size the moment he starts waving. contain on a
       landscape screen keeps his head and the whole desk in shot; a portrait
       screen fills instead, anchored high on him, because containing a 16:9
       frame in a tall window leaves him a strip across the middle. */
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

    /* Returns whether it actually put anything on the canvas. The caller needs
       to know: a source that cannot be drawn yet — a clip still decoding, the
       poster not yet loaded — must not be allowed to leave the surface empty. */
    var lastGood = null;
    function paint(src, alpha) {
      if (!src) return false;
      var d = dims(src);
      if (!d.w || !d.h) return false;
      if (src.tagName === "VIDEO" && src.readyState < 2) return false;
      var r = rectFor(src);
      if (!r) return false;
      ctx.globalAlpha = alpha;
      try { ctx.drawImage(src, r.x * dpr, r.y * dpr, r.w * dpr, r.h * dpr); }
      catch (e) { ctx.globalAlpha = 1; return false; }
      ctx.globalAlpha = 1;
      if (alpha >= 1) lastGood = src;
      return true;
    }

    /* ---------------- state ---------------- */

    /* The poster is what the canvas starts on, so the first painted frame is a
       real picture rather than an empty surface waiting on a video to decode. */
    var poster = new Image();
    poster.src = dir + "poster.webp";

    var shown = poster;                // what is on screen
    var incoming = null;               // what is dissolving in
    /* DRAW ONLY WHEN SOMETHING CHANGED.
       Redrawing a full-screen picture sixty times a second regardless is what
       made this hang. A clip that is running or a dissolve that is mid-way
       marks it dirty; a paused clip in a background tab does not, and costs
       nothing at all. */
    var dirty = true;
    var lastDrawn = null;
    var mixStart = 0;
    var greeting = false;

    function switchTo(src) {
      if (src === shown && !incoming) return;
      if (src === incoming) return;
      /* Mid-dissolve: let the one that is arriving become the one that is here,
         so the new dissolve starts from a complete picture rather than from a
         half-finished blend. */
      if (incoming) { shown = incoming; }
      incoming = src;
      mixStart = performance.now();
      dirty = true;
    }

    var tick30 = 0;
    function frame(now) {
      /* A clip that is running has a new picture every frame; the poster does
         not. Anything mid-dissolve is changing by definition. */
      if (incoming) dirty = true;
      if (shown && shown.tagName === "VIDEO" && !shown.paused) dirty = true;
      if (shown !== lastDrawn) dirty = true;

      if (!dirty) { window.requestAnimationFrame(frame); return; }
      dirty = false;
      lastDrawn = shown;

      ctx.globalAlpha = 1;
      /* Wipe first. The picture is letterboxed, so the bands either side of it
         are never painted over — without this they keep whatever was drawn
         there before and smear as the window changes shape. Clearing and
         redrawing inside one frame leaves no gap; the gap that caused the
         flash was one spread across frames. */
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      /* THE ORDER MATTERS. The outgoing picture is laid down whole, then the
         incoming one is drawn over it. The canvas is never showing less than
         one complete image, which is the entire reason there is no flash. */
      /* WHATEVER HAPPENS, SOMETHING GETS DRAWN. If the picture that is supposed
         to be on screen cannot be drawn this instant, the last one that could
         is drawn instead. Without this the greeting simply failed to appear:
         the switch happened while the clip was still decoding, the draw was
         skipped, and a cleared canvas showed the poster behind it. */
      if (!paint(shown, 1)) paint(lastGood, 1);

      if (incoming) {
        var t = (now - mixStart) / FADE;
        if (t >= 1) {
          /* Only hand over once the newcomer can actually be drawn, or the
             handover throws away a good picture for a blank one. */
          if (paint(incoming, 1)) { shown = incoming; incoming = null; }
          else if (now - mixStart > 2500) { incoming = null; }
        } else {
          paint(incoming, t < 0 ? 0 : t);
        }
      }

      /* RE-MEASURE WHERE THE HERO STARTS, PERIODICALLY.
         A ResizeObserver fires when an element changes SIZE, not when it moves.
         The notice above the hero wraps to a second line at some widths, which
         shifts the hero down without resizing it — so the offset went stale and
         the hero hung past the bottom of the screen. Twice a second is far
         below anything perceptible, and measureTop() writes nothing unless the
         number actually changed. */
      if ((tick30 = (tick30 + 1) % 30) === 0) measureTop();

      window.requestAnimationFrame(frame);
    }

    /* ---------------- he gets to work ---------------- */

    function startIdle() {
      var p = idle.play();
      if (p && p.catch) p.catch(arm);
    }
    /* Autoplay can be refused outright. Rather than leave him frozen, wait for
       the first thing the visitor does and start on the back of it — by then
       the page counts as interacted with and the same play() is allowed. */
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
      if (!greeting) switchTo(idle);
    }, { once: true });
    window.requestAnimationFrame(frame);

    /* ---------------- the greeting ---------------- */

    function soundOn() {
      try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { return true; }
    }

    var greetTimer = null;
    function greet(e) {
      if (e) e.preventDefault();
      if (greeting) return;
      greeting = true;
      wave.muted = !soundOn();
      try { wave.currentTime = 0; } catch (err) {}

      /* SWITCH UNCONDITIONALLY. This used to wait for readyState to reach 2 and
         otherwise listen for 'loadeddata' — which is a trap, because the
         currentTime = 0 above starts a seek that briefly drops readyState back
         to 1, and 'loadeddata' has already fired during preload and never fires
         twice. The greeting then played through to the end with nothing on
         screen at all: audio, no picture.
         There is no need to gate it. paint() reports when a source cannot be
         drawn yet, the loop keeps the last good picture up until it can, and
         the handover above only completes once the clip genuinely paints. */
      switchTo(wave);

      var p = wave.play();
      if (p && p.catch) p.catch(function () {
        /* Refused, almost certainly over the sound. Try again silent rather
           than leave him frozen mid-gesture. */
        wave.muted = true;
        var q = wave.play();
        if (q && q.catch) q.catch(done);
      });

      /* ONE LISTENER PER GREETING, TAKEN OFF WHEN IT FIRES. Adding a fresh
         'ended' handler on every click without removing the old ones meant the
         second greeting was cut short by the first one's handler. */
      function done() {
        wave.removeEventListener("ended", done);
        if (greetTimer) { clearTimeout(greetTimer); greetTimer = null; }
        greeting = false;
        switchTo(idle);
        startIdle();
      }
      wave.addEventListener("ended", done);
      /* A backstop, for when 'ended' never arrives — a decode error, or the tab
         backgrounded mid-clip. Without it he would be left waving for good. */
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
      /* The switch sits inside the stage, and the stage is the greeting's own
         hit area — without this, changing the sound would also set him waving. */
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        try { localStorage.setItem(SOUND_KEY, soundOn() ? "off" : "on"); } catch (err) {}
        paintBtn();
        if (greeting) wave.muted = !soundOn();
      });
      paintBtn();
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        try { idle.pause(); } catch (e) {}
        try { wave.pause(); } catch (e) {}
      } else if (!greeting) startIdle();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
