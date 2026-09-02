/* AQcredix — the cinematic reveal system.
 *
 * WHAT IT IS. One IntersectionObserver, and one call to element.animate() per element. The
 * LOOK still lives in cinematic.css — every distance, duration and easing below is read out
 * of the custom properties in that file's tuning block, so retuning the whole system is still
 * a matter of changing five numbers in one place and touching no JavaScript.
 *
 * WHY THE WEB ANIMATIONS API AND NOT A CLASS THAT STARTS A TRANSITION.
 * This is the third attempt at this file, and the first two failed the same way: a CSS
 * transition only runs if the browser resolved the START value in one style change event and
 * the END value in a LATER one. Flipping a class is therefore not a request to animate — it is
 * a request to animate *if the timing happens to work out*. On this page it kept not working
 * out, for reasons that are all invisible from the outside:
 *
 *   - founder.js renders the hero from data on DOMContentLoaded, so the elements do not exist
 *     at their final size when this module first measures them;
 *   - the portrait's <img> is injected on load, later still;
 *   - motion.js puts aq-page-enter (a transform and opacity:0 on <body>) over the first two
 *     frames, which is the same frame boundary the reveal was trying to use;
 *   - and a hidden or prerendered tab creates no transitions at all.
 *
 * Any one of those can collapse the two style change events into one, and the element then
 * simply appears at its end state. That is exactly the reported symptom: one element animates,
 * its neighbours do not, and nothing in the computed styles looks wrong — because nothing IS
 * wrong declaratively. The race is the bug.
 *
 * element.animate() has no such precondition. It is handed both keyframes explicitly, so it
 * cannot be skipped, cannot be defeated by an inline transform or by a competing `transition`
 * shorthand elsewhere in the cascade, and does not care whether the element was in the
 * document at parse time or was injected a second ago. The class is still added — it is what
 * the CSS resting state hangs off — but the class no longer has to do the animating.
 *
 * THE FAILURE MODE IS NOW THE SAFE ONE. If element.animate is missing or throws, the class is
 * applied on its own and the content is simply visible, immediately. Nothing can be left
 * hidden waiting on a frame that never comes.
 *
 * WHY NOT GSAP, SCROLLTRIGGER OR LENIS. Three reasons, in order of weight:
 *
 *   1. motion.js already runs an inertial scroll on the real scroll position. Lenis would be
 *      a second controller competing with it for the same property — not a style choice, a
 *      bug. The existing one is also tuned: its ease was moved from 0.11 to 0.22 because the
 *      page kept gliding after the wheel stopped.
 *   2. There is no build step and no node_modules, so these would be CDN tags — roughly 80KB
 *      to schedule animations the platform now schedules natively.
 *   3. Everything asked for here is transform, opacity, clip-path or filter over a curve.
 *      That is what element.animate() is for. A library earns its weight when you need
 *      timeline scrubbing or physics; none of this does.
 *
 * WHAT IT DOES NOT TOUCH. Page transitions, parallax, split-text headings, the automatic
 * .section reveal and the smooth scroll all live in motion.js and are left alone. This is
 * additive and opt-in: an element with no data-cine attribute is never selected, never
 * hidden, and never observed.
 *
 * ------------------------------------------------------------------ how to use
 *   data-cine="rise"     quiet lift and fade         — body copy, lists, cards
 *   data-cine="wipe"     clip-path reveal from below — headings, editorial statements
 *   data-cine="image"    blur-to-sharp behind a mask — portraits, screenshots, posters
 *   data-cine="drop"     arrives from above          — one per page at most
 *   data-cine="riseslow" long rise from below        — the thing that lands last
 *   data-cine="letters"  word-by-word rise           — one short heading per page, at most
 *
 *   data-cine-seq        on a PARENT: its data-cine children arrive in order
 *   data-cine-delay="n"  extra delay in ms, on any of the above
 *   data-cine-hover      subtle lift on hover
 *   data-cine-underline  underline that draws from the left
 */
(function () {
  "use strict";

  var root = document.documentElement;

  /* Marking the html element is what arms the CSS. If this script fails to load or throws
     before this line, every [data-cine] element simply renders normally — the page can never
     be left with content hidden waiting for an observer that will never run. */
  root.classList.add("aq-cine");

  var REDUCED = false;
  try { REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var all = [].slice.call(document.querySelectorAll("[data-cine]"));
  if (!all.length) return;

  /* Reduced motion, or a browser without IntersectionObserver: show everything now. Leaving
     content hidden because a capability is missing is the worst possible failure here. */
  if (REDUCED || !("IntersectionObserver" in window)) {
    all.forEach(function (el) { el.classList.add("is-cine-in"); });
    return;
  }

  /* Can this browser animate? Everything since 2016 can, but the answer decides whether this
     module animates or merely reveals, so it is asked once rather than assumed. */
  var CAN_ANIMATE = typeof Element !== "undefined" &&
    Element.prototype && typeof Element.prototype.animate === "function";

  /* --------------------------------------------------- the numbers, read from the CSS
     cinematic.css remains the single place these are defined. Reading them here means the
     tuning block still governs the motion even though the motion now runs in JavaScript —
     including its mobile overrides, because getComputedStyle resolves the media query first. */
  function num(name, fallback) {
    try {
      var v = getComputedStyle(root).getPropertyValue(name).trim();
      var f = parseFloat(v);
      return isFinite(f) ? f : fallback;
    } catch (e) { return fallback; }
  }
  function str(name, fallback) {
    try {
      var v = getComputedStyle(root).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  var DUR   = num("--cine-dur", 900);
  var STEP  = num("--cine-stagger", 90);
  var SHIFT = num("--cine-shift", 26);
  var BLUR  = num("--cine-blur", 12);
  var SCALE = num("--cine-scale", 1.06);
  var EASE  = str("--cine-ease", "cubic-bezier(.16, 1, .3, 1)");

  /* --------------------------------------------------- the vocabulary
     One entry per variant, each a list of TRACKS. A track is one element.animate() call, so a
     variant whose properties move at different speeds — "wipe" fades in half the time it takes
     to uncover — is expressed as two tracks rather than being flattened to one duration. This
     mirrors cinematic.css line for line: the CSS keeps the resting state and the fallback,
     this keeps the movement. */
  var TRACKS = {
    rise: [
      { mul: 1, ease: EASE, keys: function () {
        return [{ opacity: 0, transform: "translate3d(0," + SHIFT + "px,0)" },
                { opacity: 1, transform: "none" }];
      } }
    ],
    wipe: [
      { mul: 1.15, ease: EASE, keys: function () {
        return [{ clipPath: "inset(0 0 100% 0)",
                  transform: "translate3d(0," + (SHIFT * 0.5) + "px,0)" },
                { clipPath: "inset(0 0 0 0)", transform: "none" }];
      } },
      { mul: 0.6, ease: "linear", keys: function () {
        return [{ opacity: 0 }, { opacity: 1 }];
      } }
    ],
    image: [
      { mul: 1.25, ease: EASE, keys: function () {
        return [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }];
      } },
      { mul: 1.4, ease: EASE, keys: function () {
        return [{ transform: "scale(" + SCALE + ")" }, { transform: "none" }];
      } },
      { mul: 1.1, ease: EASE, keys: function () {
        return [{ filter: "blur(" + BLUR + "px)" }, { filter: "none" }];
      } },
      { mul: 0.5, ease: "linear", keys: function () {
        return [{ opacity: 0 }, { opacity: 1 }];
      } }
    ],
    /* Arrives from above, uncovering downward. Used for the thing that should feel like it is
       coming to rest rather than joining the sequence. */
    drop: [
      { mul: 1.2, ease: EASE, keys: function () {
        return [{ transform: "translate3d(0," + (SHIFT * -1.4) + "px,0)",
                  clipPath: "inset(100% 0 0 0)" },
                { transform: "none", clipPath: "inset(0 0 0 0)" }];
      } },
      { mul: 0.8, ease: "linear", keys: function () {
        return [{ opacity: 0 }, { opacity: 1 }];
      } }
    ],
    /* The portrait. It travels further and takes twice as long as anything else, because it is
       the last thing to settle and the eye should follow it up rather than notice it arrived.
       The distance is a percentage of the figure's own height, so it scales with the layout. */
    riseslow: [
      { mul: 2, ease: EASE, keys: function () {
        return [{ transform: "translate3d(0,26%,0)" }, { transform: "none" }];
      } },
      { mul: 1.1, ease: EASE, keys: function () {
        return [{ opacity: 0 }, { opacity: 1 }];
      } }
    ]
  };

  /* --------------------------------------------------- word splitting for "letters"
     Each word is wrapped in a clipping span with the moving part inside it, so the words
     rise out from behind their own edge rather than sliding over the text above. Done once,
     at start-up, and only for elements that ask for it. */
  function splitWords(el) {
    if (el.dataset.cineSplit === "1") return;
    var text = el.textContent.replace(/\s+/g, " ").trim();
    if (!text) return;
    var words = text.split(" ");
    var html = "";
    for (var i = 0; i < words.length; i++) {
      /* The index rides on a custom property so the stagger is available to the CSS fallback
         as well as to the code below. */
      html += '<span class="cine-w" style="--cine-i:' + i + '"><i>' +
        words[i].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
        "</i></span>";
      if (i < words.length - 1) html += " ";
    }
    el.innerHTML = html;
    el.dataset.cineSplit = "1";
  }

  all.forEach(function (el) {
    if (el.getAttribute("data-cine") === "letters") splitWords(el);
  });

  /* --------------------------------------------------- sequencing
     A section marked data-cine-seq gives its children an increasing delay, so the heading
     lands, then the subtitle, then the image, then the details. That order is the whole
     point: things arriving together read as a page loading, things arriving in sequence read
     as a page being presented. */
  [].slice.call(document.querySelectorAll("[data-cine-seq]")).forEach(function (parent) {
    var kids = [].slice.call(parent.querySelectorAll("[data-cine]"));
    kids.forEach(function (el, i) {
      /* An explicit per-element delay wins, so one item in a sequence can be held back. */
      var own = parseInt(el.getAttribute("data-cine-delay") || "", 10);
      var d = isFinite(own) ? own : i * STEP;
      el.style.setProperty("--cine-delay", d + "ms");
    });
  });

  /* Elements outside a sequence may still carry their own delay. */
  all.forEach(function (el) {
    if (el.style.getPropertyValue("--cine-delay")) return;
    var own = parseInt(el.getAttribute("data-cine-delay") || "", 10);
    if (isFinite(own)) el.style.setProperty("--cine-delay", own + "ms");
  });

  function delayOf(el) {
    var d = parseFloat(el.style.getPropertyValue("--cine-delay"));
    return isFinite(d) ? d : 0;
  }

  function cancelCine(node) {
    try {
      node.getAnimations().forEach(function (a) { if (a.id === "cine") a.cancel(); });
    } catch (e) {}
  }

  function cancelWords(el) {
    [].forEach.call(el.querySelectorAll(".cine-w i"), cancelCine);
  }

  /* --------------------------------------------------- running one element
     fill:"backwards" is what holds the element at its first keyframe during its delay, which
     is how the stagger reads without the CSS having to keep it hidden — and it is why the
     class can go on first without the element flashing into view before its turn.

     Every animation is tagged so a replay can cancel exactly its own and nothing else. */
  /* A TRANSITION ANYWHERE ELSE IN THE CASCADE WOULD WIN THIS FIGHT.
     Transitions outrank animations in the cascade, so any `transition` an element already
     carries for its own reasons silently takes the property over. That is not hypothetical:
     .fp-photo has `transition: transform 220ms ease` from its days as a small circular avatar,
     and it was overriding the portrait's 1800ms rise with a 220ms snap — the reason the figure
     was the one element that never appeared to animate at all.

     is-cine-run sets transition:none !important for as long as the reveal is playing, so no
     transition can be created to shadow it, and it is removed afterwards so hover effects and
     anything else the element owns go back to working normally. */
  function endRun(el) { el.classList.remove("is-cine-run"); }

  function animateIn(el) {
    var variant = el.getAttribute("data-cine") || "rise";
    var delay = delayOf(el);
    var last = null, lastEnd = -1;

    function track(node, keys, dur, ease, d) {
      var a = node.animate(keys, { duration: dur, delay: d, easing: ease, fill: "backwards" });
      a.id = "cine";
      if (d + dur > lastEnd) { lastEnd = d + dur; last = a; }
      return a;
    }

    if (variant === "letters") {
      cancelWords(el);
      [].forEach.call(el.querySelectorAll(".cine-w i"), function (part, i) {
        track(part,
          [{ transform: "translate3d(0,105%,0)" }, { transform: "translate3d(0,0,0)" }],
          DUR * 0.95, EASE, delay + i * STEP);
      });
    } else {
      cancelCine(el);
      (TRACKS[variant] || TRACKS.rise).forEach(function (t) {
        track(el, t.keys(), DUR * t.mul, t.ease, delay);
      });
    }

    /* Whichever track finishes last hands the element back to the stylesheet. Cancel counts
       too: the backstop and a replay both cancel, and neither should leave the guard on.

       AND A TIMER, FOR THE SAME REASON rAF NEEDED ONE. Animation events are dispatched during
       the rendering lifecycle, which a hidden or heavily throttled tab does not run — so the
       finish event is not something that can be relied on to arrive. If it never did, the
       guard would stay on and that element's own transitions (the portrait's hover tilt, a
       card's lift) would be dead for the rest of the visit. Whichever lands first wins;
       removing a class twice is free. The slack covers the gap between an animation's nominal
       end and the frame that reports it. */
    if (last) {
      var done = function () { endRun(el); };
      last.onfinish = done;
      last.oncancel = done;
      setTimeout(done, lastEnd + 400);
    } else {
      endRun(el);
    }
  }

  /* The one entry point. The class goes on and STAYS on: it is the resting state — opacity 1,
     no transform, no clip — so if the animation below never starts, or is cancelled halfway by
     a resize or a theme change, what is left behind is the finished element, not a hidden one.
     Reveal first, animate second, so a thrown animation never costs the visitor the content. */
  function runIn(el) {
    if (el.classList.contains("is-cine-in")) return;
    /* The guard goes on BEFORE the state change, so the browser resolves style once, sees
       transition:none, and never creates a competing transition in the first place. */
    if (CAN_ANIMATE) el.classList.add("is-cine-run");
    el.classList.add("is-cine-in");
    if (!CAN_ANIMATE) return;
    try { animateIn(el); } catch (e) { endRun(el); }
  }

  /* --------------------------------------------------- the observer
     rootMargin pulls the trigger line up from the bottom of the viewport so an element has
     begun arriving by the time it is properly in view, rather than starting the moment its
     first pixel appears and finishing well below the fold.

     Each element is unobserved once it has arrived: these are entrances, not scroll-linked
     effects, and an observer still watching a hundred settled elements is pure cost. */
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!e.isIntersecting) continue;
      runIn(e.target);
      io.unobserve(e.target);
    }
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });

  /* showAll is the escape hatch, so it must SHOW, not ask. is-cine-in is the resting state,
     but an animation with fill:"backwards" still sitting in its delay would be holding the
     element at its first keyframe — so the animations are cancelled too. */
  function showAll() {
    all.forEach(function (el) {
      cancelCine(el);
      cancelWords(el);
      el.classList.remove("is-cine-run");
      el.classList.add("is-cine-in");
      el.classList.add("is-cine-shown");
    });
    try { io.disconnect(); } catch (e) {}
  }

  /* Is this element actually rendered, or only claiming to be? "drop" starts clipped to
     inset(100% 0 0 0), which is invisible at any opacity, so both have to be asked. */
  function looksHidden(el) {
    var cs;
    try { cs = getComputedStyle(el); } catch (e) { return false; }
    if (parseFloat(cs.opacity) < 0.99) return true;
    var cp = cs.clipPath || cs.webkitClipPath || "";
    /* inset(100%…) and anything near it still hides the element outright. */
    return /inset\(\s*(?:9\d(?:\.\d+)?|100)%/.test(cp);
  }

  function forceShown(el) {
    el.classList.add("is-cine-in");
    if (looksHidden(el)) {
      cancelCine(el);
      cancelWords(el);
      el.classList.remove("is-cine-run");
      el.classList.add("is-cine-shown");
    }
  }

  /* NO VIEWPORT, NO ANIMATION. A page can be laid out with zero height — a hidden or
     prerendered tab, an offscreen embed. An entrance animation has no meaning there, and an
     IntersectionObserver has nothing to intersect against, so every element would sit hidden
     until something resized. Showing the content is always the right failure. */
  if (!window.innerHeight || !window.innerWidth) {
    showAll();
    /* If it later gains a viewport it is already visible, which is correct: the visitor did
       not watch it arrive, and revealing content twice is not a thing. */
    return;
  }

  /* SCAN, PLAY, AND BE ABLE TO SCAN AGAIN.
     A deferred script runs BEFORE DOMContentLoaded fires. Pages that render their content in
     a DOMContentLoaded handler — founder.js is one — therefore populate the DOM *after* this
     module has already measured it. The hero was being measured while it was still an empty
     zero-height box at a negative offset, so it failed the on-screen test and went to the
     observer instead of playing.

     refresh() is the answer, and it is exported: a page that renders late calls it when its
     content is in, and anything now on screen plays properly. */
  function scan() {
    all.forEach(function (el) {
      if (el.classList.contains("is-cine-in")) return;      /* already dealt with */
      var r = el.getBoundingClientRect();
      /* A zero-height box is not evidence of anything — it usually means the content has not
         been rendered yet. Leave it for the next scan rather than deciding on nothing. */
      if (!r.height && !r.width) return;
      if (r.top < window.innerHeight * 0.92 && r.bottom > 0) { runIn(el); return; }
      io.observe(el);
    });
  }

  scan();

  /* Belt and braces for pages this module does not know about: re-scan once the document is
     fully parsed and again after load, so late-rendered content is never left to the backstop.
     scan() skips anything already arrived, so repeating it is free. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  }
  window.addEventListener("load", scan);

  /* REPLAY ONE ELEMENT FROM THE BEGINNING.
     For content that arrives after its container was revealed — the portrait is injected on
     img.onload, which lands after the reveal has already run, so the box animated while it was
     empty and the photograph simply appeared inside it afterwards. Dropping the class and the
     in-flight animation puts the element back to square one; runIn then plays it properly. */
  function play(el) {
    if (!el) return;
    if (REDUCED || !CAN_ANIMATE) { el.classList.add("is-cine-in"); return; }
    cancelCine(el);
    cancelWords(el);
    el.classList.remove("is-cine-in", "is-cine-shown", "is-cine-run");
    runIn(el);
  }

  /* Exported so a page that builds its own DOM can say when it is ready, and so a late
     image can restart its own reveal. */
  window.AQCine = { refresh: scan, play: play };

  /* LAST RESORT. If something has gone wrong — an observer that never fires, a layout that
     settles late, a browser quirk — content must not stay hidden. After a few seconds,
     anything still waiting is simply shown.

     THE QUESTION IS "IS IT VISIBLE", NOT "DOES IT HAVE THE CLASS". This previously looked for
     elements MISSING is-cine-in, which meant the one failure that matters — the class applied
     but the movement never run, leaving the element at its hidden start state — was the single
     case the backstop could not see. Ask the rendered result instead.

     With element.animate() driving the reveal this should now be unreachable: the class alone
     leaves the element visible. It is kept because the cost of it firing is a missed
     animation, and the cost of it not existing is a blank section. */
  setTimeout(function () {
    all.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) forceShown(el);
    });
  }, 6000);

  /* A tab backgrounded during load runs no animations, so an element can be told to arrive
     and simply never move. When the visitor comes back, anything still hidden is shown
     outright — they have missed the animation either way, and a blank headline is not a
     lesser failure than a missing one. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    all.forEach(function (el) {
      if (el.classList.contains("is-cine-in") && looksHidden(el)) {
        cancelCine(el);
        cancelWords(el);
        el.classList.remove("is-cine-run");
        el.classList.add("is-cine-shown");
      }
    });
  });

  /* A page restored from the back/forward cache keeps the classes it had, which is correct.
     Nothing to undo — recorded here because the absence of a pageshow handler is deliberate. */
})();
