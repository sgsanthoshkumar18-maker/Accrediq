/* AQcredix — video library instrumentation.
 *
 * The cards on videos.html are placeholders: there is no player and no media source yet,
 * so the play buttons had no handler at all. This wires them up so the profile page can
 * report "learning videos watched" instead of a permanent zero, and marks a card visibly
 * once it has been opened.
 *
 * HONEST LIMIT: with no player, a click is the only signal available, so this counts
 * videos STARTED, not watched to the end. When a real player lands, move the record()
 * call to the player's "ended" event and the profile figure becomes a true watch count
 * with no other change needed — the ledger and the profile page do not care where the
 * event comes from.
 *
 * Each card is identified by its heading rather than its index, so the count survives
 * cards being reordered or inserted. The profile counts distinct ids, so replaying a
 * video does not inflate the number.
 */
(function () {
  "use strict";

  function init() {
    var cards = document.querySelectorAll(".video-embed");
    if (!cards.length) return;

    var watched = {};
    if (window.AQActivity) {
      window.AQActivity.entries("video_watched").forEach(function (e) {
        if (e.meta && e.meta.id) watched[e.meta.id] = true;
      });
    }

    Array.prototype.forEach.call(cards, function (embed) {
      var btn = embed.querySelector(".play");
      if (!btn) return;

      /* The title sits in a sibling block for the grid cards and inside a .cap for the
         featured one. Falling back to the aria-label keeps an unlabelled card countable
         rather than silently dropping it. */
      var block = embed.parentNode;
      var h = (block && block.querySelector("h3")) || embed.querySelector(".cap b");
      var title = (h && h.textContent.trim()) || btn.getAttribute("aria-label") || "Video";

      if (watched[title]) embed.classList.add("is-watched");

      btn.addEventListener("click", function () {
        if (window.AQActivity) {
          window.AQActivity.record("video_watched", { id: title, title: title });
        }
        embed.classList.add("is-watched");
        // No player yet, so say what actually happened rather than implying playback.
        btn.setAttribute("aria-label", "Marked as watched — " + title);
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
