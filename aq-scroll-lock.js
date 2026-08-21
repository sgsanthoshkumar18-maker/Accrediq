/* AQcredix — hold the page still while an overlay is open.
 *
 * THE PROBLEM. Opening an element card, a department drill-down or the globe panel left
 * the page behind it fully scrollable. Scrolling over an open card moved the list
 * underneath it, so closing the card put you somewhere you never navigated to. On a phone
 * it is worse: the panel and the page compete for the same gesture, and the page usually
 * wins, which reads as the panel refusing to scroll.
 *
 * WHY A WATCHER RATHER THAN EDITING EVERY MODAL. There are a dozen overlays across this
 * site — element cards, the assessor lens, department detail, globe panels, tooltips,
 * the paywall, the auth gate — written at different times by different code. Adding a
 * lock/unlock call to each means a dozen places to keep in step, and the one that gets
 * missed is the one a customer finds. One observer watching for any of them appearing
 * cannot drift.
 *
 * WHY position:fixed AND NOT overflow:hidden. iOS Safari ignores overflow:hidden on the
 * body — the classic lock that works on every desktop and fails on the device most people
 * are actually holding. Fixing the body does work, but it collapses the scroll position
 * to zero, so the offset is stored and restored on close. Without that restore, closing a
 * card jumps you back to the top of a 639-element list.
 *
 * WHY IT COUNTS RATHER THAN TOGGLES. Two overlays can be open at once — a tooltip over a
 * modal, or the paywall over a preview. A boolean would unlock on the first close and let
 * the page move while the second is still open.
 */
(function () {
  "use strict";

  /* Selectors for things that cover the page. Kept in one list so a new overlay only has
     to add its class here — and matching the EXCLUDE_ANCESTOR list already in app.js, so
     the two agree about what counts as an overlay. */
  var OVERLAY = [
    ".modal", ".modal-back", ".globe-card", ".dept-detail", ".explorer",
    ".tdx", ".cdx", ".ddx", ".qg-panel",
    ".aq-gate", ".aq-gate-back", ".ws-auth", ".pw-modal", ".device-block",
    ".aqs-back", ".aqf-mount.is-full"
  ].join(",");

  var open = 0;
  var lockedY = 0;

  /* A CLASS NAME IS NOT ENOUGH, and trusting one broke the site.
   *
   * The first version locked whenever any element matching the list above was visible.
   * But .modal exists as STATIC MARKUP on twelve pages — empty containers that a script
   * fills in later — so the lock engaged on page load and the page could not be scrolled
   * at all before anything was even opened. The count then drifted, and closing a real
   * card sometimes left the page stuck.
   *
   * So the test is what the element is DOING, not what it is called: a genuine overlay is
   * position:fixed and covers most of the viewport. An empty container, an inline section
   * and a collapsed panel all fail that, whatever their class. */
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hasAttribute("hidden")) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    if (parseFloat(cs.opacity) < 0.05) return false;
    /* Only a fixed element can cover the page while it scrolls underneath. */
    if (cs.position !== "fixed") return false;
    var r = el.getBoundingClientRect();
    var vw = document.documentElement.clientWidth || 1;
    var vh = document.documentElement.clientHeight || 1;
    /* Half the viewport in both axes. A toast, a tooltip or a sticky bar is fixed too,
       and none of them should stop the page from scrolling. */
    return r.width >= vw * 0.5 && r.height >= vh * 0.5;
  }

  function lock() {
    if (open++ > 0) return;                       // already locked by another overlay
    lockedY = window.scrollY || window.pageYOffset || 0;
    document.body.style.setProperty("--aq-lock-y", -lockedY + "px");
    document.body.classList.add("aq-locked");
  }

  function unlock() {
    if (open === 0) return;
    if (--open > 0) return;                       // something else is still open
    document.body.classList.remove("aq-locked");
    document.body.style.removeProperty("--aq-lock-y");
    /* 'instant' so the restore is not animated by the site's smooth-scroll layer — a
       smooth scroll here looks like the page drifting away after the card closes. */
    try { window.scrollTo({ top: lockedY, behavior: "instant" }); }
    catch (e) { window.scrollTo(0, lockedY); }
  }

  /* Recount from scratch on every mutation rather than tracking individual nodes. The
     overlays here are created, destroyed, emptied and re-filled by different code paths;
     counting what is actually on screen right now cannot get out of step with reality. */
  /* setTimeout, NOT requestAnimationFrame. rAF does not run in a hidden tab, so an
     overlay opened while the page was in the background stayed unlocked until the tab
     was looked at again — and the same pause makes the behaviour untestable in a
     headless browser, which is how this was found. A 16ms timer coalesces bursts of
     mutations just as well and keeps running whatever the tab is doing. */
  var timer = null;
  var watchdog = null;

  function recount() {
    var n = 0, els = document.querySelectorAll(OVERLAY);
    for (var i = 0; i < els.length; i++) if (isVisible(els[i])) n++;
    if (n > 0 && open === 0) lock();
    else if (n === 0 && open > 0) { open = 1; unlock(); }
    else open = n;
    guard();
  }

  /* THE WATCHDOG, AND WHY IT EARNS ITS KEEP.
   *
   * Everything above depends on a mutation firing when an overlay closes. That is true
   * for every close path in the site today, but "the page will not scroll any more" is
   * the single worst way for this file to fail: the visitor cannot recover, cannot see a
   * cause, and will not report it — they will just leave. A lock that has outlived its
   * overlay must be able to notice on its own.
   *
   * So while — and ONLY while — the page is locked, recount every 400ms. If the overlay
   * has gone without telling us, scrolling comes back within half a second instead of
   * never. When nothing is open the timer is not running at all, so the cost on an
   * ordinary page is exactly zero. */
  function guard() {
    if (open > 0 && !watchdog) watchdog = setInterval(recount, 400);
    else if (open === 0 && watchdog) { clearInterval(watchdog); watchdog = null; }
  }

  function sync() {
    if (timer) return;
    timer = setTimeout(function () { timer = null; recount(); }, 16);
  }

  function start() {
    if (!document.body) return;
    var mo = new MutationObserver(sync);
    mo.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ["class", "style", "hidden"]
    });
    /* Some overlays are driven by a class on <html> rather than on the panel itself —
       the theme and gate scripts both do this. Observing only <body> misses those. */
    mo.observe(document.documentElement, {
      attributes: true, attributeFilter: ["class", "style"]
    });
    sync();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
