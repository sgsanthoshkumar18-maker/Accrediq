/* AQcredix — founder portfolio page.
 *
 * Renders everything from profile/founder-data.js. Adding a publication means adding one
 * object to that array; there is no markup here to keep in step.
 *
 * Three pieces of motion are local to this page. The site-wide layer (reveals, split
 * headings, inertial scroll, scrollytelling) does the rest and is not duplicated.
 */
(function () {
  "use strict";

  var F = window.FOUNDER;
  if (!F) return;

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(id) { return document.getElementById(id); }

  /* --------------------------------- header --------------------------------- */

  function initials() {
    return "SG";
  }

  function renderHead() {
    el("fName").innerHTML = esc(F.name) + ' <span class="fp-post">' + esc(F.post) + "</span>";
    el("fRole").textContent = F.roleLine;
    el("fLoc").textContent = F.location;
    if (F.affiliation) el("fAffil").textContent = F.affiliation;

    el("fTags").innerHTML = F.headline.map(function (h) {
      return '<span class="fp-tag">' + esc(h) + "</span>";
    }).join("");

    /* The portrait is optional. An <img> that 404s shows a broken-image icon, which looks
       like a fault rather than a choice, so the fallback is installed on error and the
       ring mark stands in until a file exists at the configured path. */
    var ph = el("fPhoto");
    var img = new Image();
    img.onload = function () {
      ph.innerHTML = '<img src="' + esc(F.photo) + '" alt="' + esc(F.name) + '">';
    };
    img.onerror = function () {
      ph.innerHTML = '<span class="fp-initials">' + initials() + "</span>";
      ph.classList.add("is-fallback");
    };
    img.src = F.photo;

    el("fLinks").innerHTML =
      '<a class="btn btn-accent btn-sm" href="' + esc(F.linkedin) +
        '" target="_blank" rel="noopener noreferrer">LinkedIn profile \u2197</a>' +
      '<a class="btn btn-ghost btn-sm" href="mailto:' + esc(F.email) + '">Email</a>';
  }

  /* --------------------------------- counters ---------------------------------
     Counted up when the band first enters view. Values are derived from the arrays
     wherever possible so a new publication changes the headline number automatically. */

  function renderStats() {
    var derived = {
      publications: F.publications.length,
      certifications: F.certifications.length
    };
    el("fStats").innerHTML = F.stats.map(function (s) {
      var v = s.value != null ? s.value : derived[s.key] || 0;
      return '<div class="fp-stat"><span class="n" data-to="' + v + '">' +
        (reduce ? v : "0") + '</span><span class="l">' + esc(s.label) + "</span></div>";
    }).join("");

    if (reduce || !("IntersectionObserver" in window)) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        countUp(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.4 });
    [].forEach.call(document.querySelectorAll(".fp-stat .n"), function (n) { io.observe(n); });
  }

  function countUp(node) {
    var to = Number(node.getAttribute("data-to")) || 0;
    var dur = 1100, start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      // Ease out: fast at first, settling at the end, which reads as counting rather than sliding.
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(to * eased);
      if (p < 1) requestAnimationFrame(frame);
      else node.textContent = to;
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------ scrolly lens ------------------------------ */

  function renderLens() {
    el("fLensCard").innerHTML = F.lens.map(function (l, i) {
      return '<div class="fp-face" data-face="' + i + '">' +
        "<h4>" + esc(l.heading) + "</h4>" +
        "<p>" + esc(l.body) + "</p>" +
        '<ul class="fp-face-list">' + l.points.map(function (p) {
          return "<li>" + esc(p) + "</li>";
        }).join("") + "</ul></div>";
    }).join("");

    el("fLensSteps").innerHTML = F.lens.map(function (l) {
      return '<div data-scrolly-step><div class="step">' + esc(l.step) + "</div>" +
        "<h3>" + esc(l.title) + "</h3><p>" + esc(l.body) + "</p></div>";
    }).join("");
  }

  /* ------------------------------- timeline ------------------------------- */

  /* Alternating centre timeline. Odd entries sit right of the spine, even ones left, so
     the section fills the full width instead of hugging one margin. The side is decided
     here rather than in CSS :nth-child because the education list restarts the sequence —
     letting CSS count would put two entries on the same side across the two lists. */
  function timelineItem(e, i, opts) {
    opts = opts || {};
    var side = i % 2 === 0 ? "is-right" : "is-left";
    return '<div class="fp-item ' + side + (e.current ? " is-now" : "") + '">' +
      '<div class="fp-item-card">' +
        '<div class="fp-when">' + esc(e.from) + " \u2014 " + esc(e.to) +
          (e.current ? ' <span class="fp-now">Current</span>' : "") + "</div>" +
        "<h4>" + esc(opts.title ? opts.title(e) : e.role) + "</h4>" +
        '<div class="fp-org">' + esc(opts.org ? opts.org(e) : e.org) + "</div>" +
        (e.type ? '<div class="fp-type">' + esc(e.type) + "</div>" : "") +
        (e.note ? "<p>" + esc(e.note) + "</p>" : "") +
      "</div>" +
      /* The marker sits ON the spine, in the centre column, not beside the card. */
      '<div class="fp-node"><span class="fp-dot"></span></div>' +
      '<div class="fp-item-year"><span>' +
        esc(e.current ? "NOW" : String(e.to || e.from).replace(/^\D+/, "")) +
      "</span></div>" +
    "</div>";
  }

  function renderExperience() {
    el("fExp").innerHTML = F.experience.map(function (e, i) {
      return timelineItem(e, i);
    }).join("");

    el("fEdu").innerHTML = F.education.map(function (e, i) {
      return timelineItem(e, i, {
        title: function (x) { return x.degree; },
        org: function (x) { return x.school; }
      });
    }).join("");
  }

  /* ----------------------------- publications ----------------------------- */

  function renderPublications() {
    el("fPubCount").textContent = F.publications.length;
    el("fPubs").innerHTML = F.publications.map(function (p, i) {
      return '<article class="fp-pub" data-tilt>' +
        '<div class="fp-pub-n">' + String(i + 1).padStart(2, "0") + "</div>" +
        "<h4>" + esc(p.title) + "</h4>" +
        '<div class="fp-journal">' + esc(p.journal) + '<span class="fp-date"> \u00b7 ' +
          esc(p.date) + "</span></div>" +
        (p.note ? "<p>" + esc(p.note) + "</p>" : "") +
        "</article>";
    }).join("");

    el("fProject").innerHTML =
      "<h4>" + esc(F.project.title) + "</h4><p>" + esc(F.project.body) + "</p>";
  }

  /* ---------------------------- certifications ---------------------------- */

  function renderCerts() {
    /* The two flagged credentials lead, at double width. A hospital reading this page is
       looking for exactly these — an ISQua Fellowship and a CAHO NABH qualification —
       and burying them in an alphabetical grid of nineteen would waste them. */
    el("fCertTop").innerHTML = F.certifications.filter(function (c) { return c.top; })
      .map(function (c) {
        return '<div class="fp-cert fp-cert-top" data-reveal data-tilt>' +
          '<div class="fp-cert-badge">Credential</div>' +
          "<h5>" + esc(c.name) + "</h5>" +
          '<div class="fp-issuer">' + esc(c.issuer) + "</div>" +
          (c.note ? "<p>" + esc(c.note) + "</p>" : "") +
          '<div class="fp-cert-meta">' + esc(c.date) +
            (c.id ? ' \u00b7 ID <span class="mono">' + esc(c.id) + "</span>" : "") + "</div>" +
          "</div>";
      }).join("");

    function group(g) {
      return F.certifications.filter(function (c) { return c.group === g && !c.top; })
        .map(function (c) {
          return '<div class="fp-cert" data-reveal data-tilt>' +
            "<h5>" + esc(c.name) + "</h5>" +
            '<div class="fp-issuer">' + esc(c.issuer) + "</div>" +
            (c.note ? '<p class="fp-cert-note">' + esc(c.note) + "</p>" : "") +
            '<div class="fp-cert-meta">' + esc(c.date) +
              (c.id ? ' \u00b7 <span class="mono">' + esc(c.id) + "</span>" : "") + "</div>" +
            "</div>";
        }).join("");
    }
    el("fCertQ").innerHTML = group("quality");
    el("fCertC").innerHTML = group("clinical");
    el("fSkills").innerHTML = F.skills.map(function (s) {
      return '<span class="fp-skill">' + esc(s) + "</span>";
    }).join("");
  }

  /* -------------------------------- 3D tilt --------------------------------
     Cards lean toward the pointer. Pointer-only and never on touch: a phone has no
     hover, and binding this to touch would fight scrolling. Capped at a few degrees —
     past that it stops reading as depth and starts making the text hard to follow. */

  var MAX = 7;

  function initTilt() {
    if (reduce) return;
    var coarse = false;
    try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch (e) {}
    if (coarse) return;

    document.documentElement.classList.add("fp-tilt-on");

    [].forEach.call(document.querySelectorAll("[data-tilt]"), function (card) {
      var raf = null, rect = null;

      function apply(e) {
        raf = null;
        if (!rect) rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          "perspective(900px) rotateX(" + (-y * MAX).toFixed(2) + "deg) rotateY(" +
          (x * MAX).toFixed(2) + "deg) translateZ(6px)";
        // Drives a light sheen that follows the pointer, in CSS rather than more JS.
        card.style.setProperty("--mx", ((x + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--my", ((y + 0.5) * 100).toFixed(1) + "%");
      }

      card.addEventListener("pointerenter", function () {
        rect = card.getBoundingClientRect();
        card.classList.add("is-tilting");
      });
      card.addEventListener("pointermove", function (e) {
        /* Measured once per frame. pointermove fires far faster than the screen
           refreshes, and writing a transform on every event is wasted work that shows up
           as jank on the low-end machines this site is used on. */
        if (raf) return;
        raf = requestAnimationFrame(function () { apply(e); });
      });
      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.transform = "";
        rect = null;
      });
      /* The cached rect goes stale when the page reflows or scrolls; clearing it forces a
         re-measure on the next enter rather than tilting around the wrong origin. */
      window.addEventListener("scroll", function () { rect = null; }, { passive: true });
      window.addEventListener("resize", function () { rect = null; }, { passive: true });
    });
  }

  /* --------------------------------- start --------------------------------- */

  function init() {
    renderHead();
    renderStats();
    renderLens();
    renderExperience();
    renderPublications();
    renderCerts();
    initTilt();

    /* The site-wide reveal observer already ran during DOMContentLoaded, before any of
       this existed. Re-running it picks up everything just rendered; without this the
       whole page would sit at opacity 0. */
    document.dispatchEvent(new Event("aq:content"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
