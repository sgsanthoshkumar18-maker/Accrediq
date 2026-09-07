/* AQcredix — the maths behind the scroll-scrubbed image sequence.
 *
 * WHY THIS IS A SEPARATE FILE FROM THE THING THAT DRAWS.
 * A frame sequence is four hundred images pretending to be one object, and every way it
 * fails is arithmetic: the wrong frame for a scroll position, a blank canvas because the
 * frame we want has not arrived, or a loading order that leaves the end of the animation
 * empty for ten seconds. None of that is visible in a screenshot and none of it can be
 * tested through a canvas. Pulled out here, it is ordinary functions with ordinary
 * answers, and the tests can ask them directly.
 *
 * THE LOADING ORDER IS THE WHOLE TRICK, AND IT IS NOT 1..N.
 * Loading frames in order means the first second of the animation works and the rest is
 * blank, so a reader who scrolls quickly — which is everybody, the first time — sees the
 * coat freeze halfway and never come back. Instead the order subdivides: first frame,
 * last frame, middle, then quarters, then eighths. After twenty images of four hundred
 * the entire scroll already animates, coarsely, and every image after that only makes it
 * smoother. Nothing is ever blank after the first frame lands.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AQCoatFrames = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* Which frame belongs to a scroll position. Rounded, not floored: floor spends the last
     frame's entire share of the scroll on the second-to-last image, so the sequence never
     visibly reaches its final pose. */
  function frameAt(p, n) {
    if (!(n > 0)) return 0;
    if (typeof p !== "number" || !isFinite(p)) return 0;
    return clamp(Math.round(clamp(p, 0, 1) * (n - 1)), 0, n - 1);
  }

  /* THE FRAME WE WANT IS OFTEN NOT THE FRAME WE HAVE, and the answer to that is never a
     blank canvas — it is the closest one that has arrived. Holding the previous frame
     instead would stall the coat mid-scroll; drawing nothing would flash the background
     through it. The nearest loaded frame is wrong by a few degrees of rotation and right
     about everything a reader would notice. */
  function nearestLoaded(want, loaded) {
    if (!loaded || !loaded.length) return -1;
    if (loaded[want]) return want;
    for (var d = 1; d < loaded.length; d++) {
      if (want - d >= 0 && loaded[want - d]) return want - d;
      if (want + d < loaded.length && loaded[want + d]) return want + d;
    }
    return -1;
  }

  /* Subdivision order: ends first, then middles, then the gaps between them. Produced by
     repeatedly halving the interval rather than by a formula, so the result is exact for
     any count rather than only for powers of two. Every index appears exactly once. */
  function loadOrder(n) {
    if (!(n > 0)) return [];
    if (n === 1) return [0];
    var out = [0, n - 1], seen = {};
    seen[0] = 1; seen[n - 1] = 1;
    var ranges = [[0, n - 1]];
    while (ranges.length) {
      var next = [];
      for (var i = 0; i < ranges.length; i++) {
        var a = ranges[i][0], b = ranges[i][1];
        if (b - a < 2) continue;
        var mid = a + Math.floor((b - a) / 2);
        if (!seen[mid]) { seen[mid] = 1; out.push(mid); }
        next.push([a, mid], [mid, b]);
      }
      ranges = next;
    }
    /* Anything the halving never landed on — possible at small counts — is appended, so
       the order is always a complete permutation and no frame is silently never fetched. */
    for (var k = 0; k < n; k++) if (!seen[k]) out.push(k);
    return out;
  }

  /* A PHONE DOES NOT GET FOUR HUNDRED IMAGES. Ten megabytes on mobile data to watch a
     coat turn around is a hostile thing to do to somebody on a train, and the animation
     is barely distinguishable at a quarter of the frames on a screen that size. This
     picks an evenly spaced subset that always keeps the first and last frame, so the
     sequence still starts and ends on the poses it was composed for. */
  function subset(n, want) {
    if (!(n > 0)) return [];
    if (!(want > 0) || want >= n) {
      var all = [];
      for (var i = 0; i < n; i++) all.push(i);
      return all;
    }
    if (want === 1) return [0];
    var out = [];
    for (var k = 0; k < want; k++) {
      out.push(Math.round((k / (want - 1)) * (n - 1)));
    }
    /* Rounding can collide at the ends on small counts; duplicates would make the loader
       fetch the same file twice and report a total it never reaches. */
    return out.filter(function (v, idx) { return out.indexOf(v) === idx; });
  }

  /* The file name for a frame. Zero-padded because a directory that sorts 1, 10, 100, 2
     is a directory nobody can check by eye, and checking by eye is exactly what somebody
     does when four hundred renders finish overnight. */
  function fileFor(pattern, index, pad) {
    var s = String(index + 1);
    while (s.length < (pad || 4)) s = "0" + s;
    return String(pattern).replace("#", s);
  }

  return {
    frameAt: frameAt,
    nearestLoaded: nearestLoaded,
    loadOrder: loadOrder,
    subset: subset,
    fileFor: fileFor
  };
});
