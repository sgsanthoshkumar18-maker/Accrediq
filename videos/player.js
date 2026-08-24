/* AQcredix — plays a video that lives in a private bucket.
 *
 * The markup carries a data-video-key and a poster. Nothing else. There is no video address
 * anywhere in the page, because the whole point of the private bucket is that no such
 * address exists until somebody who has paid asks for one. Pressing play is what asks.
 *
 * WHAT HAPPENS ON PLAY
 *   1. ask /api/video-url for a link, sending the visitor's own session token
 *   2. the server checks has_access() and either signs a link or refuses
 *   3. a <video> is built with that link and played
 *
 * A REFUSAL IS AN ANSWER, NOT AN ERROR.
 * Someone who is not signed in, and someone whose hospital has not paid, are two different
 * people who need two different sentences and two different places to go. Showing either of
 * them "something went wrong" would be both untrue and useless.
 *
 * THE LINK EXPIRES AND THAT IS HANDLED.
 * Signed links last two hours. Someone can leave a paused video open for longer than that,
 * come back, press play and be met with a dead file — the browser reports it as a decode
 * error with no explanation. So a playback error is treated as a probably-expired link:
 * fetch a fresh one, put the picture back where they left it, and carry on. They see a
 * half-second pause rather than a broken video.
 */
(function () {
  "use strict";

  var API = "/api/video-url";
  var SESSION_KEY = "aq-sb-session";     // the same key workspace/store.js writes

  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch (e) { return null; }
  }
  function setSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  /* Access tokens last an hour, so somebody who left the tab open yesterday has a stale one
     in hand. Rather than telling them to sign in again — which they would reasonably read
     as being logged out — spend the refresh token once and retry. */
  async function refreshToken() {
    var s = session();
    var cfg = window.AQ_CONFIG || {};
    if (!s || !s.refresh_token || !cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    try {
      var r = await fetch(cfg.supabaseUrl.replace(/\/$/, "") +
                          "/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: s.refresh_token })
      });
      if (!r.ok) { setSession(null); return null; }
      var ns = await r.json();
      setSession(ns);
      return ns.access_token || null;
    } catch (e) { return null; }
  }

  async function fetchLink(key) {
    var s = session();
    var token = s && s.access_token;
    if (!token) return { status: 401 };

    async function ask(tok) {
      return fetch(API + "?key=" + encodeURIComponent(key), {
        headers: { Authorization: "Bearer " + tok }
      });
    }
    var r;
    try { r = await ask(token); } catch (e) { return { status: 0 }; }

    if (r.status === 401) {
      var fresh = await refreshToken();
      if (!fresh) return { status: 401 };
      try { r = await ask(fresh); } catch (e) { return { status: 0 }; }
    }
    if (!r.ok) return { status: r.status };
    try {
      var j = await r.json();
      return j && j.url ? { status: 200, url: j.url } : { status: 0 };
    } catch (e) { return { status: 0 }; }
  }

  /* Turn the phone, but only a phone. A laptop is already wider than it is tall, so
     rotating there would be absurd — fullscreen just means the whole screen at its own
     shape. Same two tests the film uses, for the same reason: a narrow window on a desktop
     is not a handset, and a coarse pointer alone is not either. */
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
        /* Refused on iOS, and on a phone its owner has locked to portrait. Nothing to do
           and nothing to report — the video still fills whatever it is given, and the
           caption is sized against the frame rather than the screen, so it stays right. */
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
  }
  function unlockOrientation() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }
    catch (e) {}
  }

  var MESSAGES = {
    401: ["Sign in to watch this.", "Sign in", "dashboard.html"],
    403: ["This video comes with a subscription.", "See what it costs", "plans.html"],
    /* Deliberately not "you need to subscribe". A 503 means WE could not check — the
       database was unreachable or the subscription function is missing — and telling a
       paying customer to go and pay again over our own fault is the worst thing this
       screen could say. "Try again" is honest and costs them nothing. */
    503: ["We could not check your access just now. Please try again in a moment.", "", ""],
    0:   ["The video could not be loaded. Please try again.", "", ""]
  };

  function showMessage(host, status) {
    var m = MESSAGES[status] || MESSAGES[0];
    var box = document.createElement("div");
    box.className = "vp-msg";
    box.setAttribute("role", "status");
    var p = document.createElement("p");
    p.textContent = m[0];
    box.appendChild(p);
    if (m[1]) {
      var a = document.createElement("a");
      a.className = "btn btn-accent"; a.href = m[2]; a.textContent = m[1];
      box.appendChild(a);
    }
    host.appendChild(box);
    host.classList.remove("vp-loading");
  }

  function mount(host) {
    var key = host.getAttribute("data-video-key");
    if (!key || host.__vpBusy) return;
    host.__vpBusy = true;
    host.classList.add("vp-loading");

    var btn = host.querySelector(".play");
    if (btn) btn.disabled = true;

    fetchLink(key).then(function (res) {
      if (res.status !== 200) {
        host.__vpBusy = false;
        if (btn) { btn.disabled = false; btn.remove(); }
        showMessage(host, res.status);
        return;
      }

      var poster = host.getAttribute("data-poster") || "";
      var v = document.createElement("video");
      v.className = "vp-video";
      v.controls = true;
      v.playsInline = true;
      v.setAttribute("playsinline", "");        // older iOS reads the attribute, not the property
      /* Takes the FULLSCREEN button out of the browser's own control bar, so the video can
         never become the fullscreen element and there is nothing to correct afterwards.
         Our own button below fullscreens the whole frame instead, from a real click, which
         is the only way the browser reliably grants it. Chrome, Edge and Android honour
         this; Firefox and Safari ignore it, which is what the swap further down is for. */
      v.setAttribute("controlsList", "nofullscreen");
      v.disablePictureInPicture = true;        // picture-in-picture strips the overlay too
      if (poster) v.poster = poster;
      v.preload = "auto";
      v.src = res.url;

      /* The poster and the play button have done their job; leaving them behind the video
         means a stale first frame flashing back on every seek. */
      var img = host.querySelector(".vp-poster");
      if (img) img.remove();
      if (btn) btn.remove();
      var cap = host.querySelector(".cap");
      if (cap) cap.remove();

      host.insertBefore(v, host.firstChild);
      host.classList.remove("vp-loading");
      host.classList.add("vp-playing");

      /* THE FRAME MUST BE THE PICTURE, NOT THE SCREEN.
         Fullscreen hands us the whole display, and phones today are 19.5:9 or 20:9 while
         this video is 16:9 — so the picture is letterboxed with black down either side. The
         overlay is positioned against its host, so if the host were the screen, the caption
         would sit out on the black bar with the speaker's face somewhere off to the right.
         Telling the host to take the video's own aspect ratio keeps the two the same shape,
         so the caption lands on the picture on any display. Read from the file rather than
         assumed, so a portrait or 4:3 video would work the same way. */
      function noteAspect() {
        if (!v.videoWidth || !v.videoHeight) return;
        host.style.setProperty("--vp-ar", v.videoWidth + " / " + v.videoHeight);
        /* The same ratio as a plain number. The fullscreen rule has to multiply and divide
           by it, and calc() cannot do that with a "1920 / 1080" ratio token. */
        host.style.setProperty("--vp-arn", String(v.videoWidth / v.videoHeight));
      }
      v.addEventListener("loadedmetadata", noteAspect);
      /* Called directly as well: if the browser already had the metadata — a cached file,
         or a re-mount — loadedmetadata has fired before this listener existed and the frame
         would keep the 16:9 fallback for a video that is not 16:9. */
      noteAspect();

      /* The overlay was attached at page load but has no video to listen to, because there
         was none until now. Drive it from here. */
      /* ONE VIDEO AT A TIME.
         The page carries several players and each was minding its own business, so pressing
         play on a second one left the first still running — two people talking over each
         other out of the same page, and no obvious way to tell which control belonged to
         which voice. Starting any video therefore pauses every other one.

         Bound to the ELEMENT rather than tracked in a shared variable, because a variable
         holding "the video that is playing" has to be kept correct through pause, ended,
         removal and error, and gets it wrong the first time one of those is missed. Asking
         the document what is actually playing cannot go stale. */
      v.addEventListener("play", function () {
        [].forEach.call(document.querySelectorAll("video"), function (other) {
          if (other !== v && !other.paused) { try { other.pause(); } catch (e) {} }
        });
      });

      /* THE CAPTION FOLLOWS THE VIDEO'S CLOCK, NOT A TIMER.
         It used to be set going by a pair of setTimeouts when play was pressed. That is the
         only option for a player we cannot see inside, and it is wrong here in two ways a
         viewer notices immediately: the timers keep running while the video is PAUSED, so
         the introduction slides over a frozen frame and leaves again; and dragging the
         scrubber does not resync anything, so the caption appears halfway through the video
         out of nowhere. Held against currentTime instead, it belongs to a moment in the
         film — pause and it holds, scrub past and it is gone, scrub back and it returns. */
      var ov = host.__aqv;
      var SHOW_AT = 3, HIDE_AT = 9;                 // seconds into the video
      var captionOn = null;                         // only touch the DOM when it changes
      function syncCaption() {
        if (!ov) return;
        var t = v.currentTime || 0;
        var want = t >= SHOW_AT && t < HIDE_AT;
        if (want === captionOn) return;
        captionOn = want;
        ov.showCaption(want);
      }
      if (ov) {
        /* timeupdate fires about four times a second, which is close enough for a caption
           and costs nothing; seeked covers the jump the scrubber makes, which timeupdate
           can otherwise report a beat late. */
        v.addEventListener("timeupdate", syncCaption);
        v.addEventListener("seeked", syncCaption);
        v.addEventListener("play", function () { ov.live(true); syncCaption(); });
        v.addEventListener("loadedmetadata", function () { ov.live(true); syncCaption(); });
        v.addEventListener("ended", function () { ov.showCaption(false); captionOn = false; });
        ov.live(true);
        syncCaption();
      }

      /* FULLSCREEN HAS TO BE THE WHOLE FRAME, NOT THE VIDEO.
         The browser's own fullscreen button promotes the <video> element alone. Our overlay
         is a sibling of it, so it is simply not part of what gets shown — which is why the
         logo disappeared the moment anyone went fullscreen. There is no way to stop the
         native button doing that, so catch it afterwards: step back out and promote the
         host instead, which contains both the video and the overlay.

         On an iPhone this cannot be fixed. Safari there hands video fullscreen to the
         operating system's own player, which no web page can draw on top of. The video
         plays correctly; it just plays without the caption. */
      /* OUR OWN FULLSCREEN BUTTON.
         It lives in the frame rather than in the video's control bar, because a control in
         the video's bar can only ever fullscreen the video. This one fullscreens the frame,
         which contains the video AND the overlay — so the logo and the speaker's name are
         part of what goes fullscreen instead of being left behind on the page.

         It is the only thing in this layer that takes a click. Everything else stays
         pointer-events:none, because a transparent layer over a video that accepts input
         swallows the page's scrolling — a bug this codebase has already paid for once. */
      var fsBtn = document.createElement("button");
      fsBtn.type = "button";
      fsBtn.className = "vp-fs";
      fsBtn.setAttribute("aria-label", "Full screen");
      fsBtn.title = "Full screen";
      fsBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3' +
        'M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';
      host.appendChild(fsBtn);

      function inFullscreen() {
        return document.fullscreenElement === host ||
               document.webkitFullscreenElement === host;
      }
      fsBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();                    // the frame's own click starts playback
        if (inFullscreen()) {
          try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
          catch (err) {}
          return;
        }
        /* An iPhone cannot fullscreen anything but a video: Safari there hands the job to
           the operating system's own player, and no page can draw on top of it. So on that
           one device the video goes fullscreen bare rather than not at all — a caption
           missing is better than a button that does nothing. Everywhere else, including
           iPad and Android, the whole frame goes and the overlay comes with it. */
        var req = host.requestFullscreen || host.webkitRequestFullscreen;
        if (req) {
          try { var p = req.call(host); if (p && p.catch) p.catch(function () {}); return; }
          catch (err) {}
        }
        if (v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch (err) {} }
      });

      /* SPACE PAUSES THE VIDEO INSTEAD OF SCROLLING THE PAGE.
         Same guards as the film in videos/aq-film.js, deliberately, so the two players
         behave identically — a visitor who learns the habit on one should not find it
         missing on the other.

         The guards are the whole job here. Space is the page-down key and it is also how a
         keyboard user activates a focused button or link, so swallowing it site-wide would
         break every form and every control on it. It is taken only when this video is
         actually the thing being watched: mounted, playing, on screen, and with the focus
         somewhere that is not expecting a space of its own. */
      addEventListener("keydown", function (e) {
        if (e.key !== " " && e.key !== "Spacebar" && e.code !== "Space") return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (!host.isConnected || !host.classList.contains("vp-playing")) return;
        var t = e.target;
        if (t && (t.isContentEditable ||
                  /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName))) return;
        var r = host.getBoundingClientRect();
        if (!(r.height > 0 && r.bottom > 0 && r.top < innerHeight)) return;
        e.preventDefault();                 // this is what stops the page jumping down
        if (v.paused) { v.play().catch(function () {}); } else { v.pause(); }
      });

      document.addEventListener("fullscreenchange", function () {
        fsBtn.classList.toggle("is-on", inFullscreen());
        var fs = document.fullscreenElement;

        if (fs === v && host.requestFullscreen) {
          /* Swapped by requesting the host DIRECTLY, without exiting first.
             Exiting and then re-entering seems tidier and does not work: exitFullscreen()
             is asynchronous, and by the time its promise settles the user gesture that
             authorised fullscreen has expired, so the browser refuses the second request.
             The viewer is dropped out of fullscreen and nothing replaces it — the button
             simply appears broken. Requesting a different element while already fullscreen
             is allowed and swaps the target in one step, inside the same gesture.

             If it is refused anyway, the video stays fullscreen on its own, which is the
             plain browser behaviour and no worse than having never tried. */
          try { host.requestFullscreen().catch(function () {}); } catch (e) {}
          return;
        }

        if (fs === host) {
          lockLandscape();
          /* Re-synced, NOT replayed. An earlier version restarted the introduction on
             entering fullscreen, on the reasoning that this is a fresh and much larger
             look at the video. In practice that is one more caption arriving unbidden in
             the middle of a film, which is precisely the thing that made the overlay feel
             broken. The caption belongs to 0:03–0:09 and nowhere else; going fullscreen at
             0:40 shows the logo and no caption, which is what a broadcast would do. */
          if (ov) { ov.live(true); syncCaption(); }
        } else if (!fs) {
          unlockOrientation();
        }
      });

      /* A dead link looks exactly like a corrupt file from here, and after two hours the
         former is far more likely than the latter. Get a new one and resume in place. */
      /* Remembered as it plays rather than read when the error arrives. By the time a
         media error fires the element has already torn down its source and reset
         currentTime to zero, so asking it then returns 0 and the viewer is thrown back to
         the beginning — which is worse than the broken video it was meant to fix. */
      var lastTime = 0;
      v.addEventListener("timeupdate", function () {
        if (v.currentTime > 0) lastTime = v.currentTime;
      });

      var recovering = false;
      v.addEventListener("error", function () {
        if (recovering) return;
        recovering = true;
        var at = lastTime;
        fetchLink(key).then(function (again) {
          recovering = false;
          if (again.status !== 200) return;
          v.src = again.url;
          v.addEventListener("loadedmetadata", function () {
            try { v.currentTime = at; } catch (e) {}
            v.play().catch(function () {});
          }, { once: true });
        });
      });

      v.play().catch(function () {
        /* Autoplay refused — the poster is gone and the browser's own controls are there,
           so there is a visible play button either way. Nothing to repair. */
      });
      host.__vpBusy = false;
    });
  }

  function init() {
    var hosts = document.querySelectorAll("[data-video-key]");
    [].forEach.call(hosts, function (host) {
      var btn = host.querySelector(".play");
      if (btn) btn.addEventListener("click", function () { mount(host); });
      /* The poster is clickable too. People aim at the picture, not at the small circle. */
      host.addEventListener("click", function (e) {
        if (host.classList.contains("vp-playing")) return;
        if (e.target.closest("a")) return;
        mount(host);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else { init(); }
})();
