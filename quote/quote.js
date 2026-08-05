/* AQcredix — Quote of the Day ticker.
   Picks by day-of-year so the quote is stable for a whole day and changes at local midnight,
   independently in each language. Language choice persists in localStorage. */
(function () {
  "use strict";

  var KEY = "aq-quote-lang";
  var DEFAULT_LANG = "en";

  function dayOfYear(d) {
    var start = new Date(d.getFullYear(), 0, 0);
    return Math.floor((d - start) / 86400000);
  }

  // Stable per-day index. The year is folded in so the same quote doesn't land on the same
  // date every year, and each language is offset so the three don't move in lockstep.
  function pickIndex(len, offset) {
    var now = new Date();
    return (dayOfYear(now) + now.getFullYear() * 7 + offset) % len;
  }

  function getLang() {
    try {
      var v = localStorage.getItem(KEY);
      if (v && window.QUOTE_DATA[v]) return v;
    } catch (e) {}
    return DEFAULT_LANG;
  }

  function setLang(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function init() {
    var bar = document.getElementById("aqQuote");
    if (!bar || !window.QUOTE_DATA) return;

    var track = bar.querySelector(".aq-quote-track");
    var picker = bar.querySelector(".aq-quote-langs");
    if (!track || !picker) return;

    var langs = Object.keys(window.QUOTE_DATA);

    picker.innerHTML = langs.map(function (k, i) {
      return '<button type="button" class="aq-quote-lang" data-lang="' + esc(k) + '">' +
        esc(window.QUOTE_DATA[k].label) + "</button>";
    }).join("");

    function render(lang) {
      var pack = window.QUOTE_DATA[lang];
      if (!pack || !pack.quotes.length) return;
      var offset = langs.indexOf(lang) * 11;
      var q = pack.quotes[pickIndex(pack.quotes.length, offset)];

      // Duplicated once so the CSS marquee (translateX -50%) loops seamlessly.
      var item = '<span class="aq-quote-item" lang="' + esc(lang) + '">' +
        '<span class="aq-quote-text">' + esc(q.t) + "</span>" +
        '<span class="aq-quote-attr">— ' + esc(q.a) + "</span></span>";
      track.innerHTML = item + item;
      track.setAttribute("dir", pack.dir || "ltr");

      Array.prototype.forEach.call(picker.querySelectorAll(".aq-quote-lang"), function (b) {
        var on = b.getAttribute("data-lang") === lang;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      bar.classList.add("is-ready");
    }

    picker.addEventListener("click", function (e) {
      var b = e.target.closest(".aq-quote-lang");
      if (!b) return;
      var lang = b.getAttribute("data-lang");
      setLang(lang);
      render(lang);
    });

    render(getLang());

    // If the tab is left open across midnight, refresh the quote when it regains focus.
    var renderedDay = new Date().toDateString();
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      var today = new Date().toDateString();
      if (today !== renderedDay) { renderedDay = today; render(getLang()); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
