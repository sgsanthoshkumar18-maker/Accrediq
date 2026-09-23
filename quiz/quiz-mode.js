/* AQcredix — "on your own, or running this for a room?"
 *
 * Today's Quiz used to open straight into ten questions, which is right for the
 * person practising alone and wrong for the quality manager standing in front
 * of a training session. Both arrive at the same link, so the page asks once.
 *
 * The answer is remembered for the browser session only. Remembering it
 * permanently would mean somebody who once hosted a quiz never sees the daily
 * one again, and a preference set in passing is a poor reason to hide the main
 * content of a page for good. Session scope makes the question cheap: it costs
 * one tap today and nothing for the rest of the visit.
 */
(function () {
  "use strict";

  var KEY = "aq_quiz_mode_v1";

  function remembered() {
    try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
  }
  function remember(v) {
    try { sessionStorage.setItem(KEY, v); } catch (e) {}
  }

  function base() {
    return (document.body && document.body.getAttribute("data-base")) || "";
  }

  function init() {
    var root = document.getElementById("aqQuizRoot");
    if (!root) return;

    var chooser = document.createElement("div");
    chooser.className = "aq-mode-choose";
    chooser.innerHTML =
      '<h2 class="aq-mode-h">How are you taking this?</h2>' +
      '<p class="aq-mode-sub">The questions are the same. What changes is whether you are ' +
      'answering them or running them.</p>' +
      '<div class="aq-mode-grid">' +
        '<button type="button" class="aq-mode-card" data-mode="solo">' +
          '<span class="aq-mode-ico" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>' +
            "</svg></span>" +
          "<span class=\"aq-mode-t\">On my own</span>" +
          '<span class="aq-mode-d">Today’s ten scenario questions, answers and ' +
          "explanations at the end. A perfect score earns a certificate.</span>" +
        "</button>" +
        '<button type="button" class="aq-mode-card" data-mode="group">' +
          '<span class="aq-mode-ico" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="9" cy="8" r="3.2"/><circle cx="17.5" cy="9.5" r="2.4"/>' +
            '<path d="M2.5 20v-1a5.5 5.5 0 0 1 5.5-5.5h2A5.5 5.5 0 0 1 15.5 19v1"/>' +
            '<path d="M17 14h.5a4 4 0 0 1 4 4v2"/>' +
            "</svg></span>" +
          '<span class="aq-mode-t">I’m running one for a group</span>' +
          '<span class="aq-mode-d">Write your own questions, put a join code on the screen ' +
          "and everyone answers on their phones. Live leaderboard, certificates for the top three.</span>" +
        "</button>" +
      "</div>" +
      '<p class="aq-mode-join">Somebody sent you a code? <a href="' + base() +
        'quiz/join">Join a quiz</a></p>';

    root.parentNode.insertBefore(chooser, root);

    function pick(mode, persist) {
      if (persist) remember(mode);
      if (mode === "group") {
        location.href = base() + "quiz/host";
        return;
      }
      chooser.style.display = "none";
      root.style.display = "";
    }

    chooser.querySelectorAll("[data-mode]").forEach(function (b) {
      b.addEventListener("click", function () { pick(b.getAttribute("data-mode"), true); });
    });

    /* Asked already this visit — go straight there. A remembered "group" is
       deliberately NOT auto-followed: silently redirecting someone off a page
       they navigated to is disorienting, and the reason they came back may well
       be to take the quiz themselves. */
    if (remembered() === "solo") pick("solo", false);
    else root.style.display = "none";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
