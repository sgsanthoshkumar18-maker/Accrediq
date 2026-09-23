/* AQcredix Workspace — 5 Why Analyser.
   The analyser itself is tools/qt-interactive.js, unchanged and shared: the
   worksheet a hospital fills in here is the same one the public tools page
   offers, so duplicating it would only create two versions to keep in step.
   This file does the workspace part — gate, nav, notice — and the analyser
   self-initialises against the #fiveWhy div already in the page. */
(function () {
  "use strict";
  var W = window.AQWorkspace;

  async function init() {
    if (!(await W.gate())) return;
    document.getElementById("wsGate").style.display = "none";
    if (W.clearSkeleton) W.clearSkeleton();
    document.getElementById("wsBody").style.display = "";
    W.renderNav("rca");
    W.renderModeNotice();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
