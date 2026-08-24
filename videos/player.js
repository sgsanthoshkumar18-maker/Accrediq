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

  var MESSAGES = {
    401: ["Sign in to watch this.", "Sign in", "dashboard.html"],
    403: ["This video comes with a subscription.", "See what it costs", "plans.html"],
    503: ["This video is not ready yet.", "", ""],
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

      /* The overlay was attached at page load but has no video to listen to, because there
         was none until now. Drive it from here. */
      var ov = host.__aqv;
      if (ov) {
        v.addEventListener("play", ov.start);
        v.addEventListener("ended", ov.stop);
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
      document.addEventListener("fullscreenchange", function () {
        if (document.fullscreenElement !== v) return;
        if (!host.requestFullscreen) return;
        try {
          document.exitFullscreen().then(function () {
            host.requestFullscreen().catch(function () {});
          }).catch(function () {});
        } catch (e) {}
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
