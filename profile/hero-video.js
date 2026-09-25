/* AQcredix — the founder hero, as a character that answers the cursor.
 *
 * WHAT IT DOES. Four short clips of the same figure at the same desk, stacked
 * and crossfaded. One loops while nothing is happening; the other three are
 * reactions, each played once and then handed back to the loop. Which one
 * plays is decided by where the pointer is:
 *
 *     left third of the hero    -> he glances left
 *     right third               -> he glances right
 *     over the NAME             -> he waves and gestures down the page
 *     anywhere else, or idle    -> back to working
 *
 * HE DOES NOT FOLLOW THE CURSOR. The pointer picks a clip; it does not drive a
 * head angle. That is the difference between a character that feels like it
 * noticed you and one that feels like a puppet nailed to your mouse, and it is
 * also the only version that can be built from four fixed takes.
 *
 * WHY CROSSFADE AND NOT ONE SEEKING <video>. Seeking a single file to a
 * timestamp is exact only on keyframes; between them browsers land wherever
 * they like, and iOS Safari is the worst of them. Four files played from zero
 * are frame-accurate everywhere, and together they are smaller than one file
 * long enough to hold all four actions.
 *
 * EVERY CLIP STARTS AND ENDS IN THE WORKING POSE. That is what makes a 320ms
 * opacity crossfade read as a continuous performance rather than a cut — the
 * two frames either side of the fade are nearly the same picture.
 *
 * IT IS DECORATION, AND IT BEHAVES LIKE IT. Silent, aria-hidden, and replaced
 * by a still the moment a visitor says they do not want motion or arrives on a
 * device with no pointer. Nothing on this page depends on it.
 */
(function () {
  "use strict";

  var ROOT_ID = "fpVideo";
  var FADE_MS = 320;

  function init() {
    var root = document.getElementById(ROOT_ID);
    if (!root) return;

    var base = (document.body && document.body.getAttribute("data-base")) || "";
    var dir = base + "profile/hero/";

    /* A pointer that cannot hover is a finger. There is no "cursor is on the
       left" on a phone, so the whole interaction is meaningless there — and
       playing four videos to express nothing is just battery. */
    var canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var stillOnly = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!canHover || stillOnly) {
      root.classList.add("fpv-still");
      root.style.backgroundImage = "url(" + dir + "poster.webp)";
      return;
    }

    var CLIPS = ["idle", "left", "right", "wave"];
    var vids = {};

    CLIPS.forEach(function (name) {
      var v = document.createElement("video");
      v.className = "fpv-clip" + (name === "idle" ? " is-on" : "");
      v.src = dir + name + ".mp4";
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.setAttribute("aria-hidden", "true");
      v.preload = "auto";
      v.loop = (name === "idle");
      /* The poster stands in until the first frame is decoded, so the panel is
         never an empty black rectangle while the page is settling. */
      v.poster = dir + "poster.webp";
      vids[name] = v;
      root.appendChild(v);
    });

    var current = "idle";
    var busy = false;
    var pending = null;
    var settleTimer = null;

    /* AUTOPLAY MAY BE REFUSED, AND THAT IS NOT A REASON TO GIVE UP.
       A muted video is normally allowed to start by itself, but some browsers
       and some settings still say no on first load. Treating that as fatal —
       tearing the clips out and leaving a still forever — throws the whole
       feature away over a policy that lifts the moment the visitor does
       anything at all. So the poster covers the gap and the first real
       interaction starts it, which is exactly when somebody is looking. */
    function kick() {
      var p = vids[current].play();
      if (p && p.catch) {
        p.catch(function () {
          if (armed) return;
          armed = true;
          ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"].forEach(function (evt) {
            window.addEventListener(evt, onFirstGesture, { once: true, passive: true });
          });
        });
      }
    }
    var armed = false;
    function onFirstGesture() {
      armed = false;
      var p = vids[current].play();
      if (p && p.catch) p.catch(function () {});
    }
    kick();

    function show(name) {
      if (name === current) return;
      var next = vids[name], prev = vids[current];
      next.currentTime = 0;
      var p = next.play();
      if (p && p.catch) p.catch(function () {});
      next.classList.add("is-on");
      prev.classList.remove("is-on");
      /* Pause the outgoing clip only once it is invisible. Pausing it on the
         same tick freezes a frame that is still half-opaque, which reads as a
         stutter at the start of every reaction. */
      window.setTimeout(function () {
        if (prev !== vids[current]) { try { prev.pause(); } catch (e) {} }
      }, FADE_MS + 40);
      current = name;
    }

    function toIdle() {
      busy = false;
      show("idle");
      if (pending) { var q = pending; pending = null; react(q); }
    }

    /* One reaction at a time. Without this, sweeping the cursor across the hero
       fires left, right and wave within a few hundred milliseconds and the
       figure twitches between three half-played takes. A request that arrives
       mid-reaction is remembered, not dropped — dropping it means the pointer
       ends up somewhere the figure never acknowledged. */
    function react(name) {
      if (busy) { pending = (name === current) ? null : name; return; }
      if (name === "idle") { show("idle"); return; }
      busy = true;
      show(name);

      var v = vids[name];
      if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }

      function done() {
        v.removeEventListener("ended", done);
        toIdle();
      }
      v.addEventListener("ended", done);

      /* A safety net: if the clip stalls on a slow connection, 'ended' never
         fires and the figure would be stuck mid-gesture forever. */
      var ms = ((v.duration && isFinite(v.duration)) ? v.duration * 1000 : 4500) + 900;
      settleTimer = window.setTimeout(function () {
        v.removeEventListener("ended", done);
        toIdle();
      }, ms);
    }

    /* ---- what the pointer means ---- */

    var hero = root.closest(".fp-hero") || root.parentElement;
    var zoneTimer = null;
    var lastZone = "";

    function zoneFor(clientX) {
      var r = hero.getBoundingClientRect();
      var x = (clientX - r.left) / (r.width || 1);
      if (x < 0.34) return "left";
      if (x > 0.66) return "right";
      return "idle";
    }

    hero.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      var z = zoneFor(e.clientX);
      if (z === lastZone) return;
      lastZone = z;
      /* A short settle before acting. Crossing the hero on the way to the
         navigation passes through every zone in under 200ms, and reacting to
         each one makes the page feel nervous. */
      if (zoneTimer) clearTimeout(zoneTimer);
      zoneTimer = window.setTimeout(function () {
        if (z === "idle") { if (!busy) show("idle"); }
        else react(z);
      }, 140);
    }, { passive: true });

    hero.addEventListener("pointerleave", function () {
      lastZone = "";
      if (zoneTimer) { clearTimeout(zoneTimer); zoneTimer = null; }
      if (!busy) show("idle");
    }, { passive: true });

    /* THE NAME IS THE TRIGGER THAT MATTERS. Everything else is ambient; this
       one is the greeting, so it overrides the zone the pointer happens to be
       in and it is wired to focus as well as hover — a keyboard visitor
       reaching the name should get the same greeting a mouse does. */
    var nameTargets = [];
    ["fpvNameHit", "fName"].forEach(function (id) {
      var n = document.getElementById(id);
      if (n) nameTargets.push(n);
    });
    var giant = document.querySelector(".fp-stage-name");
    if (giant) nameTargets.push(giant);

    var nameArmed = true;
    nameTargets.forEach(function (n) {
      n.addEventListener("pointerenter", function () {
        if (!nameArmed) return;
        nameArmed = false;
        lastZone = "name";
        if (zoneTimer) { clearTimeout(zoneTimer); zoneTimer = null; }
        react("wave");
      }, { passive: true });
      n.addEventListener("pointerleave", function () { nameArmed = true; }, { passive: true });
      n.addEventListener("focusin", function () { react("wave"); });
      /* It is a real <button>, so Enter and Space arrive here as a click. That
         is the conventional keyboard route and, unlike focusin, it also works
         for anyone who simply clicks the name. */
      n.addEventListener("click", function (e) { e.preventDefault(); react("wave"); });
    });

    /* Nothing should be playing while the page is in a background tab. */
    document.addEventListener("visibilitychange", function () {
      var v = vids[current];
      if (!v) return;
      if (document.hidden) { try { v.pause(); } catch (e) {} }
      else { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
