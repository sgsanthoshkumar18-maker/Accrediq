/* AQcredix — the branded overlay that sits over a video.
 *
 * A corner logo bug, and a lower-third naming the speaker that slides in, holds, and
 * leaves. The look a broadcast interview has, built in CSS rather than burned into the
 * file — so the text is edited by changing a line here rather than by re-rendering and
 * re-uploading two hundred megabytes.
 *
 * WORKS OVER ANY PLAYER. A YouTube iframe, a Vimeo iframe, an HTML5 <video>: the overlay
 * never touches the player, it sits above it in its own layer. That is deliberate — a
 * YouTube iframe is another origin and its insides are not reachable, so anything that
 * depended on reading them would work until Google changed something.
 *
 * TIMED FROM OUR OWN PLAY BUTTON, NOT FROM THE PLAYER'S CLOCK.
 * The obvious approach is to poll the player for its current time and show the caption at
 * 00:03. It is also how the film's end card came to appear before the film had played a
 * frame: the picture and the clock you are reading can be two different things, and when
 * they disagree the overlay is wrong in the most visible way possible. Here the sequence
 * starts when the visitor presses play — an event this file owns — so it cannot drift
 * from what is on screen.
 *
 * pointer-events IS none ON EVERYTHING VISIBLE.
 * Learned the hard way on the film: a layer over a video that accepts pointer events
 * swallows scrolls and clicks meant for the page beneath it. Nothing here is interactive,
 * so nothing here takes input.
 */
(function () {
  "use strict";

  /* Timings in milliseconds, from the moment play is pressed. Three seconds in, because
     a caption that appears at 00:00 competes with the opening frame and is usually read
     as part of the video's own titles. Out at nine, because a name left on screen for a
     whole talk stops being information and becomes furniture. */
  var DEFAULTS = { showAt: 3000, hideAt: 9000, logo: true };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* The mark, as a path rather than an image file. It is the same geometry the header and
     the favicon use, so it can never drift out of step with them, and being vector it is
     sharp on a projector as well as a phone. */
  function markSvg(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 40 40" ' +
      'fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="3.4" opacity=".55"/>' +
      '<path d="M20 4a16 16 0 1 1-11.31 4.69" fill="none" stroke="currentColor" ' +
        'stroke-width="3.4" stroke-linecap="round"/>' +
      '<path d="M19.15 14.05H20.85L25.61 25.015H26.97V25.95H22.21V25.015H23.315L22 22H18L16.685 ' +
        '25.015H17.79V25.95H13.03V25.015H14.39ZM20 16.26L22.027 20.935H17.973Z" ' +
        'fill="currentColor" fill-rule="evenodd"/></svg>';
  }

  /* Builds the overlay inside `host`, which must be positioned. Returns a handle so the
     page can start it when the visitor presses play. */
  function attach(host, opts) {
    if (!host) return null;

    /* NOT Object.assign, which copies undefined values straight over the defaults it is
       supposed to be falling back to. A caller passing {showAt: undefined} — which is
       exactly what autoAttach does for a host with no data-aqv-show-at — ended up with
       showAt undefined, setTimeout read that as 0, and the caption was added and removed
       in the same tick. It never appeared on screen once. */
    var o = Object.assign({}, DEFAULTS), src = opts || {};
    for (var k in src) if (src[k] !== undefined) o[k] = src[k];

    var el = document.createElement("div");
    el.className = "aqv-overlay";
    el.setAttribute("aria-hidden", "true");   // the same words are in the page text
    el.innerHTML =
      (o.logo
        ? '<div class="aqv-bug">' + markSvg(26) +
          '<span class="aqv-bug-word">AQcredix</span></div>'
        : "") +
      (o.name
        ? '<div class="aqv-third">' +
            '<span class="aqv-rule" aria-hidden="true"></span>' +
            '<div class="aqv-third-text">' +
              '<span class="aqv-name">' + esc(o.name) +
                (o.creds
                  ? '<span class="aqv-creds">' + esc(o.creds) + "</span>" : "") +
              "</span>" +
              (o.designation
                ? '<span class="aqv-role">' + esc(o.designation) + "</span>" : "") +
              /* A second line, because a speaker's standing is often two facts rather than
                 one — where they have been, and where they are now. Same weight as the
                 first so neither reads as a footnote to the other. */
              (o.designation2
                ? '<span class="aqv-role aqv-role2">' + esc(o.designation2) + "</span>" : "") +
              (o.org ? '<span class="aqv-org">' + esc(o.org) + "</span>" : "") +
            "</div>" +
          "</div>"
        : "");

    host.appendChild(el);

    var timers = [];
    function clear() { timers.forEach(clearTimeout); timers = []; }

    var reduce = false;
    try { reduce = matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) {}

    function start() {
      clear();
      el.classList.add("is-live");           // the bug appears with the video
      var third = el.querySelector(".aqv-third");
      if (!third) return;

      if (reduce) {
        /* Someone who has asked for less motion still needs to know who is speaking.
           They get the caption without the slide, held a little longer because there is
           no movement to draw the eye to it. */
        third.classList.add("in", "no-motion");
        timers.push(setTimeout(function () { third.classList.remove("in"); },
                               o.hideAt + 2000));
        return;
      }
      timers.push(setTimeout(function () { third.classList.add("in"); }, o.showAt));
      timers.push(setTimeout(function () { third.classList.remove("in"); }, o.hideAt));
    }

    function stop() {
      clear();
      el.classList.remove("is-live");
      var third = el.querySelector(".aqv-third");
      if (third) third.classList.remove("in");
    }

    /* ---------- driving it from the video's own clock ----------
       start()/stop() above run on a wall clock, which is right for a player whose insides
       we cannot read — a YouTube iframe, the film's bundle. It is wrong for a real <video>,
       and visibly so: the timer keeps counting while the video is PAUSED, so the caption
       appears and leaves over a still frame; and dragging the scrubber does not resync it,
       so it turns up in the middle of the video with no relation to anything.

       showCaption() and live() let the caller hold the overlay against the video's actual
       currentTime instead. Then the caption belongs to a MOMENT IN THE FILM rather than to
       a moment in the viewer's afternoon: pause and it holds, scrub past and it is gone,
       scrub back and it returns. */
    function live(on) {
      el.classList.toggle("is-live", !!on);
      if (!on) {
        var t = el.querySelector(".aqv-third");
        if (t) t.classList.remove("in");
      }
    }
    function showCaption(on) {
      var third = el.querySelector(".aqv-third");
      if (!third) return;
      if (on && reduce) third.classList.add("no-motion");
      third.classList.toggle("in", !!on);
    }

    return { start: start, stop: stop, live: live, showCaption: showCaption, el: el };
  }

  /* ---------- wiring it up from the markup ----------
     So that putting the overlay on a video is a block of HTML and nothing else. Any element
     carrying data-aqv-name gets an overlay built from its data- attributes; if it contains a
     real <video>, the sequence is driven by that element's own play/pause/ended events, which
     is the closest thing to the truth available — the caption cannot appear over a video that
     is not running, and it resets when the video does.

     For a player we cannot see inside (a YouTube or Vimeo iframe, or the film's bundle), leave
     the host without a <video> and call start() yourself from whatever your play button does:

       var ov = window.AQVideoOverlay.attach(host, {name:"…", designation:"…"});
       myPlayButton.addEventListener("click", ov.start);
  */
  function autoAttach(root) {
    /* Any video gets the branding; only a video with a name gets the caption.
       This used to select [data-aqv-name] alone, which meant a video whose speaker we had
       not been told about carried no logo either — the mark is about whose platform this
       is, not about who is talking, and it belongs on every frame regardless. */
    var hosts = (root || document).querySelectorAll("[data-aqv-name], [data-video-key]");
    [].forEach.call(hosts, function (host) {
      if (host.__aqvDone) return;          // never build two overlays on one host
      host.__aqvDone = true;
      host.classList.add("aqv-host");

      var d = host.dataset;
      var ov = attach(host, {
        name: d.aqvName,
        creds: d.aqvCreds || "",
        designation: d.aqvRole || "",
        designation2: d.aqvRole2 || "",
        org: d.aqvOrg || "",
        logo: d.aqvLogo !== "off",
        /* Set ONLY when the markup actually carries a timing. Passing `undefined` here
           instead looks harmless and is not: Object.assign copies an undefined value over
           the default rather than skipping it, so both timings became undefined, and
           setTimeout treats undefined as zero. The caption was added and removed in the
           same instant and never appeared at all — while the logo, which is a separate
           class, kept working and made it look like the overlay was fine. */
        showAt: d.aqvShowAt ? +d.aqvShowAt : DEFAULTS.showAt,
        hideAt: d.aqvHideAt ? +d.aqvHideAt : DEFAULTS.hideAt
      });
      if (!ov) return;
      host.__aqv = ov;                      // reachable later without re-querying

      var video = host.querySelector("video");
      if (!video) return;                   // caller drives it; nothing more to do here

      /* ---------- fullscreen ----------
         The native fullscreen button fullscreens the VIDEO ELEMENT, and nothing outside
         that element is rendered while it is up — so the overlay, which is the video's
         sibling rather than its child, simply vanishes. Logo and caption both disappear
         the moment the visitor goes fullscreen.

         The fix is to fullscreen the HOST instead, which contains both. We cannot stop the
         browser's own button, so we let it fire, then hand fullscreen over to the host.

         iOS IS THE EXCEPTION AND CANNOT BE FIXED. iPhone hands fullscreen video to the
         operating system's own player, which no web page can draw on top of. The overlay
         is correct inline and absent in fullscreen there, and that is the platform. */
      document.addEventListener("fullscreenchange", function () {
        if (document.fullscreenElement !== video) return;      // already right, or exiting
        if (!host.requestFullscreen) return;
        Promise.resolve(document.exitFullscreen())
          .then(function () { return host.requestFullscreen(); })
          .catch(function () { /* browser refused the handover; native fullscreen stands */ });
      });

      video.addEventListener("play", ov.start);
      video.addEventListener("ended", ov.stop);
      /* A pause is not a stop. Someone who pauses to look at something and then resumes
         should not have the introduction played at them a second time, so the caption is
         left exactly where it was and the timers keep their own counsel. */
      if (!video.paused && !video.ended) ov.start();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { autoAttach(); });
  } else {
    autoAttach();
  }

  window.AQVideoOverlay = { attach: attach, autoAttach: autoAttach };
})();
