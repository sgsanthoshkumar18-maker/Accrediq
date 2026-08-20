/* AQcredix — rotate the homepage scrollytelling card through different NABH standards.
 *
 * One standard per visit. Which one is chosen by a time bucket, so the site shows
 * something different on a return visit an hour later, and every visitor sees the same
 * standard at the same moment — a hospital ringing to ask "which one is on the homepage
 * today" gets a coherent answer, and two people at the same desk are not looking at
 * different cards.
 *
 * The verbatim standard text is pulled from nabh-data.js at render time. It is never
 * copied into lens-rotation.js, so it cannot drift from the book when the data is
 * regenerated.
 */
(function () {
  "use strict";

  var D = window.NABH_DATA;
  var R = window.LENS_ROTATION;
  var host = document.getElementById("lensCard");
  if (!D || !R || !host) return;

  /* How long one standard stays up. Fifteen minutes: long enough that reloading the page
     while reading does not swap the card underneath you, short enough that coming back
     after lunch shows something new. Override with ?lens=CODE for a specific one, which
     is what to use when showing the site to someone. */
  var BUCKET_MS = 15 * 60 * 1000;

  function index() {
    var out = {};
    Object.keys(D.chapters).forEach(function (ch) {
      (D.chapters[ch].standards || []).forEach(function (std) {
        (std.elements || []).forEach(function (e) {
          out[std.code + "." + e.letter] = {
            chapter: ch,
            chapterName: D.chapters[ch].name,
            stdCode: std.code,
            stdText: std.text,
            text: e.text,
            category: e.category,
            sop: !!e.sop
          };
        });
      });
    });
    return out;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function pick(list) {
    /* An explicit request wins, so a specific standard can be linked to or demonstrated. */
    try {
      var q = new URLSearchParams(location.search).get("lens");
      if (q) {
        var want = list.filter(function (r) { return r.code.toLowerCase() === q.toLowerCase(); });
        if (want.length) return want[0];
      }
    } catch (e) {}

    /* Deterministic from the clock rather than Math.random(). Random would give a
       different card to every visitor and a different one on every refresh, which reads
       as instability rather than variety. */
    var bucket = Math.floor(Date.now() / BUCKET_MS);
    return list[bucket % list.length];
  }

  function render() {
    var idx = index();

    /* Drop anything whose code no longer resolves. A regenerated dataset could rename or
       remove an element, and showing the assessor guidance under an empty quotation would
       be worse than showing one fewer standard. */
    var usable = R.filter(function (r) { return !!idx[r.code]; });
    if (!usable.length) return;

    var r = pick(usable);
    var e = idx[r.code];

    document.getElementById("lensCode").textContent = r.code;
    var badge = document.getElementById("lensBadge");
    if (e.sop) {
      badge.textContent = "\u2726 SOP required";
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
    var cat = document.getElementById("lensCat");
    cat.textContent = e.category;
    cat.className = "lens-cat cat-" + e.category;

    host.innerHTML =
      '<div class="lens-face" data-face="0">' +
        "<h4>The standard</h4>" +
        /* Our own summary once reviewed, the stored wording until then. Quotation marks
           only when it is genuinely a quotation — presenting our paraphrase inside quotes
           would misrepresent it as the standard's own words. */
        (window.AQText && window.AQText.isOwn(r.code)
          ? '<p class="lens-verbatim">' + esc(window.AQText.element(r.code, e.text)) + "</p>"
          : '<p class="lens-verbatim">“' + esc(e.text) + "”</p>") +
        '<p class="lens-note">' + esc(e.chapter) + " · " + esc(e.chapterName) +
          " — " + esc(e.stdCode) + "</p>" +
        '<p class="lens-src">' +
          esc(window.AQText ? window.AQText.note(r.code)
                            : "Refer to the published NABH standard for the exact wording.") +
        "</p>" +
      "</div>" +

      '<div class="lens-face" data-face="1">' +
        "<h4>What the assessor looks for</h4>" +
        '<ul class="lens-list">' + r.looks.map(function (l) {
          return "<li>" + esc(l) + "</li>";
        }).join("") + "</ul>" +
      "</div>" +

      '<div class="lens-face" data-face="2">' +
        "<h4>The gap, before it's an NC</h4>" +
        '<p class="lens-gap">' + esc(r.gap) + "</p>" +
        '<p class="lens-fix"><b>The fix:</b> ' + esc(r.fix) + "</p>" +
      "</div>";

    // The topic names what this rotation is about, beside the step labels.
    var topic = document.getElementById("lensTopic");
    if (topic) topic.textContent = r.topic;

    var link = document.getElementById("lensLink");
    if (link) link.href = "standards.html?chapter=" + encodeURIComponent(e.chapter) +
                          "#" + encodeURIComponent(r.code);

    /* The card is rendered after the motion layer scanned the page, so the reveal and
       scrollytelling observers have to look again or this section stays invisible. */
    document.dispatchEvent(new Event("aq:content"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
