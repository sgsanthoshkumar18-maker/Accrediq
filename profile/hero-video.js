/* AQcredix — the founder hero. He works at his laptop. Move the cursor over the
 * copy to his left or right and he turns his head to look at it; click him or
 * his name and he waves, points to what is below, and goes back to work.
 *
 * ================= WHY THIS IS BUILT OUT OF SIX SHORT CLIPS =================
 *
 * An earlier build turned his head by swapping between 28 stills chosen by
 * measured head angle. It never read as a person looking at you: the poses came
 * from a clip never shot for it, only the HEAD had been matched, so his
 * shoulders and hands jumped between neighbouring frames. It was removed.
 *
 * What replaced it is not a pose lookup at all. Every movement on this stage is
 * a continuous run of real frames, and the only decision the code makes is
 * which run to play next. Three clips were generated from ONE reference image —
 * he turns to the right in one, to the left in another, and waves in the third
 * — which is what makes them cuttable together at all. Measured on the encoded
 * files, a rest frame from one clip differs from a rest frame of another by
 * about as much as two rest frames from inside a single clip, so the joins cost
 * no more than an ordinary cut.
 *
 * THE TURNS ARE THE RETURNS, PLAYED BACKWARDS. Each source clip runs
 * rest -> turn -> hold -> return -> rest. Cutting the turn out of the FRONT of
 * the clip does not work: between roughly 0.3s and 1.1s he settles his hands
 * into a different resting posture and stays there, so the frame the turn
 * begins from is nowhere near the frame the idle loop sits on — it measured
 * about seventeen times an ordinary frame step, which is a visible jump of his
 * hands. The tail does not have that problem, because the return lands back on
 * the pose every clip shares. So turn-right.mp4 is the right clip's RETURN
 * reversed, and back-right.mp4 is that same run forwards. They are exact
 * mirrors of each other, so however far he turns, coming back lands precisely
 * where he started and the state closes on itself.
 *
 * THE IDLE IS A PING-PONG, so it cannot have a seam: the same run of frames
 * forwards then backwards. A plain loop has to jump from its last frame to its
 * first, and at rest that jump was twice an ordinary frame step; a ping-pong
 * has no jump at all by construction.
 *
 * THE HELD POSE IS A FROZEN LAST FRAME, and that is faithful rather than lazy —
 * during the hold the source footage moves less than anywhere else in it.
 *
 * WHY THE DISSOLVE LENGTH IS NOT ONE NUMBER. Blending a join over N frames makes
 * it read as motion at (join cost / N) of normal speed, so a bigger join needs a
 * longer dissolve to stay natural. Returning from the greeting is the largest
 * join on the stage and gets a correspondingly longer one. Everything else is
 * within about five frame-steps and takes the default.
 *
 * WHY THIS DRAWS TO A CANVAS INSTEAD OF STACKING ELEMENTS.
 * Cross-fading the CSS opacity of stacked <video> elements shows as a black
 * flash: while two layers are each partly transparent, whatever is behind them
 * shows through the middle of the blend, and behind them is the page. On a
 * canvas that cannot happen, because compositing stops being the browser's
 * decision. Every frame draws the outgoing picture at full opacity and the
 * incoming one over the top of it at a rising alpha, so the surface is never
 * showing less than one complete image.
 */
(function () {
  "use strict";

  var SOUND_KEY = "aq-hero-sound";
  var FADE = 220;                     // ms, the ordinary source-to-source dissolve
  var FADE_LONG = 360;                // ms, for the one join that needs more

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
       so before the first draw — and anywhere the draw loop does not run — the
       stage would be a black rectangle. Transparent means the poster underneath
       shows instead, which is a picture of him. */
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
    /* Keyed by the posture each one arrives at, which is what the state machine
       below reasons about. TURN takes him from work to looking that way; BACK
       is the identical run of frames played forwards, bringing him home. */
    var TURN = { left: mkVideo("turn-left", false), right: mkVideo("turn-right", false) };
    var BACK = { left: mkVideo("back-left", false), right: mkVideo("back-right", false) };

    /* ---------------- drawing ---------------- */

    /* 1.5, not 2. At devicePixelRatio 2 a full-screen MacBook canvas is around
       3400x2000 device pixels, and drawing across all of them every frame is the
       most expensive thing on this page. The source is 1280 wide and is upscaled
       either way, so the extra device pixels buy nothing. */
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
       Reading getBoundingClientRect() during init caught the stage mid-layout and
       pinned the canvas at one pixel wide, and nothing resized afterwards to
       correct it. A ResizeObserver fires on the first real layout and on every
       change after it, including ones no resize event is raised for: fonts
       arriving, the notice above wrapping, a scrollbar appearing. */
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
       every clip or he changes size the moment he starts to turn. contain on a
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
       to know: a source that cannot be drawn yet must not be allowed to leave
       the surface empty. */
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

    /* ---------------- the canvas loop ---------------- */

    var poster = new Image();
    poster.src = dir + "poster.webp";

    var shown = poster;                // what is on screen
    var incoming = null;               // what is dissolving in
    var mixStart = 0, mixLen = FADE;
    /* DRAW ONLY WHEN SOMETHING CHANGED. Redrawing a full-screen picture sixty
       times a second regardless is what made this hang. A clip that is running
       or a dissolve mid-way marks it dirty; a clip frozen on his held pose does
       not, and costs nothing. */
    var dirty = true, lastDrawn = null;

    function switchTo(src, ms) {
      if (src === incoming) return;
      if (src === shown && !incoming) return;
      /* Mid-dissolve: let the one arriving become the one that is here, so the
         new dissolve starts from a complete picture rather than a half blend. */
      if (incoming) shown = incoming;
      incoming = src;
      mixStart = performance.now();
      mixLen = ms || FADE;
      dirty = true;
    }

    var tick30 = 0;
    function frame(now) {
      if (incoming) dirty = true;
      if (shown && shown.tagName === "VIDEO" && !shown.paused) dirty = true;
      if (shown !== lastDrawn) dirty = true;

      if (!dirty) { window.requestAnimationFrame(frame); return; }
      dirty = false;
      lastDrawn = shown;

      ctx.globalAlpha = 1;
      /* Wipe first. The picture is letterboxed, so the bands either side are
         never painted over — without this they keep whatever was drawn there
         before and smear as the window changes shape. */
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      /* THE ORDER MATTERS. The outgoing picture is laid down whole, then the
         incoming one over it, so the canvas never shows less than one complete
         image. WHATEVER HAPPENS, SOMETHING GETS DRAWN: if the picture that
         should be on screen cannot be drawn this instant, the last one that
         could is drawn instead. Without this the greeting failed to appear at
         all — the switch happened while the clip was still decoding. */
      if (!paint(shown, 1)) paint(lastGood, 1);

      if (incoming) {
        var t = (now - mixStart) / mixLen;
        if (t >= 1) {
          if (paint(incoming, 1)) { shown = incoming; incoming = null; }
          else if (now - mixStart > 2500) { incoming = null; }
        } else {
          paint(incoming, t < 0 ? 0 : t);
        }
      }

      /* RE-MEASURE WHERE THE HERO STARTS, PERIODICALLY. A ResizeObserver fires
         when an element changes SIZE, not when it MOVES. The notice above wraps
         to a second line at some widths, which shifts the hero down without
         resizing it, and the offset went stale. Twice a second is far below
         anything perceptible and measureTop() writes nothing unless the number
         actually changed. */
      if ((tick30 = (tick30 + 1) % 30) === 0) measureTop();

      window.requestAnimationFrame(frame);
    }

    /* ---------------- playing one run of frames ---------------- */

    /* Autoplay can be refused outright. Rather than leave him frozen, wait for
       the first thing the visitor does and start on the back of it. */
    var armed = false;
    function arm() {
      if (armed) return;
      armed = true;
      ["pointerdown", "pointermove", "keydown", "touchstart"].forEach(function (e) {
        window.addEventListener(e, function () { armed = false; goIdle(); },
                                { once: true, passive: true });
      });
    }

    function goIdle(ms) {
      switchTo(idle, ms);
      var p = idle.play();
      if (p && p.catch) p.catch(arm);
    }

    /* Plays one clip through and calls back when it is done, leaving it frozen
       on its last frame. ONE LISTENER PER PLAY, REMOVED WHEN IT FIRES: adding a
       fresh 'ended' handler each time without taking the old ones off meant a
       later play was cut short by an earlier one's listener. The timer is a
       backstop for when 'ended' never arrives — a decode error, or the tab
       backgrounded mid-clip — which would otherwise strand him mid-gesture. */
    var busy = false;
    function playOnce(v, ms, done) {
      busy = true;
      var over = false, timer = null;
      function finish() {
        if (over) return;
        over = true;
        v.removeEventListener("ended", finish);
        if (timer) clearTimeout(timer);
        busy = false;
        if (done) done();
      }
      v.addEventListener("ended", finish);
      try { v.currentTime = 0; } catch (e) {}
      switchTo(v, ms);
      var p = v.play();
      if (p && p.catch) p.catch(function () { finish(); });
      var dur = (v.duration && isFinite(v.duration)) ? v.duration * 1000 : 2000;
      timer = window.setTimeout(finish, dur + 900);
    }

    /* ---------------- where he is looking ---------------- */

    /* posture is where his head actually is; want is where the cursor says it
       should be. step() moves one clip closer and re-runs when that clip ends,
       so a cursor that crosses the stage mid-turn never interrupts a movement —
       it is simply read again once the current one finishes. That is why he
       never snaps or reverses halfway. */
    var posture = "home";
    var want = "home";
    var greeting = false;

    function step() {
      if (busy || greeting) return;
      if (want === posture) {
        if (posture === "home" && shown !== idle) goIdle();
        return;
      }
      if (posture !== "home") {
        var from = posture;
        playOnce(BACK[from], FADE, function () { posture = "home"; goIdle(); step(); });
        return;
      }
      var to = want;
      playOnce(TURN[to], FADE, function () { posture = to; step(); });
    }

    var stage = root.closest(".fpv-stage") || root;

    /* ONLY THE HORIZONTAL POSITION IS READ, and only which SIDE of him it falls
       on. He is not tracking the pointer — he looks at the column of copy on
       that side and holds there, however far up or down the cursor goes.
       The split is his own centre, not the middle of the window: the picture is
       letterboxed inside the stage, so on a wide screen those are far apart. The
       dead band in the middle is what stops him flip-flopping when the cursor
       sits near the parting line. */
    function zoneAt(clientX) {
      var r = rectFor(idle) || rectFor(poster);
      var box = root.getBoundingClientRect();
      var cx = box.left + (r ? r.x + r.w / 2 : box.width / 2);
      var dead = (r ? r.w : box.width) * 0.07;
      if (clientX < cx - dead) return "left";
      if (clientX > cx + dead) return "right";
      return "home";
    }

    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var z = zoneAt(e.clientX);
      if (z === want) return;
      want = z;
      step();
    }, { passive: true });

    stage.addEventListener("pointerleave", function () {
      if (want === "home") return;
      want = "home";
      step();
    }, { passive: true });

    /* ---------------- the greeting ---------------- */

    function soundOn() {
      try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch (e) { return true; }
    }

    function greet(e) {
      if (e) e.preventDefault();
      if (greeting) return;
      greeting = true;

      function run() {
        wave.muted = !soundOn();
        /* No readiness gate here. An earlier build waited for readyState to
           reach 2 and otherwise listened for 'loadeddata', which is a trap: the
           seek to 0 briefly drops readyState back to 1, and 'loadeddata' has
           already fired during preload and never fires twice. The greeting then
           played to the end with sound and no picture. paint() reports when a
           source cannot be drawn and the loop holds the last good picture until
           it can. */
        playOnce(wave, FADE, function () {
          greeting = false;
          /* The largest join on the stage — he ends the greeting mid-smile and
             the idle sits on a neutral face — so it gets the longer dissolve. */
          goIdle(FADE_LONG);
          step();
        });
      }

      /* If he is turned away, bring him back before he greets. Dissolving
         straight from a profile to a front-on wave would read as a morph rather
         than a movement. In practice this is rare: clicking him means the cursor
         is over him, which is the middle zone. */
      if (posture !== "home" && !busy) {
        var from = posture;
        playOnce(BACK[from], FADE, function () { posture = "home"; run(); });
      } else {
        run();
      }
    }

    root.addEventListener("click", greet);
    root.style.cursor = "pointer";
    var hit = document.getElementById("fpvNameHit");
    if (hit) {
      hit.addEventListener("click", greet);
      hit.addEventListener("focusin", function () { greet(); });
    }

    /* ---------------- boot ---------------- */

    goIdle();
    if (idle.readyState < 2) {
      idle.addEventListener("loadeddata", function () {
        if (!greeting && posture === "home") switchTo(idle);
      }, { once: true });
    }
    window.requestAnimationFrame(frame);

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
        [idle, wave, TURN.left, TURN.right, BACK.left, BACK.right]
          .forEach(function (v) { try { v.pause(); } catch (e) {} });
      } else if (!greeting && !busy && posture === "home") {
        goIdle();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
