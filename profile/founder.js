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
    /* The oversized name behind the portrait. Split so the LAST word is the solid half:
       the surname is what should carry at that size, and an outline ending is what stops the
       whole thing reading as a shout. Titles are dropped — "Dr." set 190px tall is noise. */
    (function paintStageName() {
      var a = el("fNameA"), b = el("fNameB");
      if (!a || !b) return;
      /* The FULL name, title included — it reads as the person's name rather than a brand
         mark, which is the point of putting it at the top of their own page. */
      var parts = String(F.name || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return;
      if (parts.length === 1) {
        /* One word: split it in half rather than leaving the outline empty. */
        var w = parts[0], cut = Math.ceil(w.length / 2);
        a.textContent = w.slice(0, cut);
        b.textContent = w.slice(cut);
      } else {
        b.textContent = parts.pop();
        a.textContent = parts.join(" ") + " ";   /* an ordinary space: nowrap holds the line on
                                               desktop, and this can break when it wraps */
      }
    })();

    /* AS LARGE AS FITS ON ONE LINE — measured, not guessed.
       A clamp() on vw is a guess about how wide the glyphs will be, and it is wrong for any
       name longer or shorter than the one it was tuned against. This asks the browser: it
       sets a size, reads the rendered width, and scales to the width actually available.

       Two passes rather than a loop: the first lands within a percent or two, the second
       corrects for rounding. A binary search would be more code for a difference nobody can
       see. */
    (function fitStageName() {
      var box = document.querySelector(".fp-stage-name");
      if (!box || !box.parentElement) return;

      /* MEASURE THE TEXT, NOT THE BOX. The name is full-bleed, so the element is as wide as
         the screen; scrollWidth on a block is floored at its own clientWidth and therefore
         reports the CONTAINER whenever the text is narrower than it. The fit could only ever
         shrink, never grow — which is why swapping the wide face for a condensed one left the
         name at exactly the old size instead of filling the extra room. A Range over the
         contents reports the glyphs themselves, at any width, on one line or several. */
      function textWidth() {
        try {
          var rng = document.createRange();
          rng.selectNodeContents(box);
          var w = rng.getBoundingClientRect().width;
          if (w) return w;
        } catch (e) { /* very old browsers: fall through */ }
        return box.scrollWidth;
      }

      function fit() {
        /* THE NAME IS FULL-BLEED, so it is fitted to the SCREEN, not to the padded container
           it happens to sit inside. Measuring the container capped it well short of the edges
           and was why it never looked as large as the reference.

           A small gutter is kept so the first and last letters are not flush against the
           glass, which reads as an overflow even when it is not. */
        var gutter = window.innerWidth < 600 ? 16 : 26;
        var avail = box.clientWidth - gutter * 2;
        if (avail <= 0) return;                    /* not laid out yet */
        /* Measure on one line first, whatever the previous state was. */
        box.style.whiteSpace = "nowrap";
        box.style.fontSize = "100px";
        var size = 100;
        for (var pass = 0; pass < 2; pass++) {
          var w = textWidth();
          if (!w) return;
          /* Leave a hair of room: scrollWidth rounds down, and a name touching both edges
             looks like it overflowed even when it has not. */
          size = size * (avail * 0.985) / w;
          box.style.fontSize = size + "px";
        }

        /* A CEILING, so the hero stays one screen. Without it a wide monitor sets the name
           from width alone and the block alone is taller than the viewport. */
        var MAX = 220;
        if (size > MAX) { size = MAX; box.style.fontSize = MAX + "px"; }

        /* ONE LINE, UNTIL ONE LINE STOPS BEING WORTH IT.
           A twenty-character name fitted to a phone lands around 24px — smaller than the
           body copy underneath it, which is the opposite of the point. Below this floor the
           name is allowed to wrap instead, so it stays the largest thing on the page. */
        /* One line still fits: correct against the real render, because growing can overshoot
           the same way shrinking can. */
        for (var g = 0; g < 3 && textWidth() > avail; g++) {
          var gf = parseFloat(box.style.fontSize) || size;
          box.style.fontSize = (gf * avail / textWidth() * 0.99) + "px";
        }

        var MIN = 40;
        if (size < MIN) {
          box.style.whiteSpace = "normal";

          /* Wrapping buys height, not width: the longest single word still has to fit on a
             line. Measure it at a known size and scale from that — this is the hard ceiling,
             and the MIN floor must yield to it or the name runs off the screen. */
          var longest = String(box.textContent || "").trim().split(/\s+/)
            .reduce(function (a, b) { return b.length > a.length ? b : a; }, "");
          var bs = getComputedStyle(box);
          var probe = document.createElement("span");
          probe.textContent = longest;
          probe.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;" +
            "white-space:nowrap;font-size:100px;font-family:" + bs.fontFamily +
            ";font-weight:" + bs.fontWeight + ";letter-spacing:" + bs.letterSpacing +
            ";text-transform:" + bs.textTransform;
          document.body.appendChild(probe);
          var wordW = probe.scrollWidth;
          probe.remove();

          var ceiling = wordW ? 100 * (avail * 0.98) / wordW : MIN;
          /* Prefer MIN, but never exceed what the longest word allows. */
          box.style.fontSize = Math.min(Math.max(size, MIN), ceiling) + "px";

          /* CORRECT AGAINST THE REAL RENDER. The probe cannot know about the text stroke or
             the exact shaping of the display face, so it lands a few percent optimistic.
             Measuring what actually rendered and scaling down is exact where a prediction is
             not. Only ever shrinks, so it cannot introduce an overflow of its own. */
          for (var fix = 0; fix < 3 && textWidth() > avail; fix++) {
            var f = parseFloat(box.style.fontSize) || MIN;
            box.style.fontSize = (f * avail / textWidth() * 0.99) + "px";
          }
        }
      }

      fit();
      /* Webfonts land after first paint and change every measurement. */
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(function () {});
      var t;
      window.addEventListener("resize", function () {
        clearTimeout(t);
        t = setTimeout(fit, 120);
      }, { passive: true });
    })();

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
    var year = e.current ? "NOW" : String(e.to || e.from).replace(/^\D+/, "");
    /* The year is stamped on the card as well as rendered in its own column. On a phone
       the column is hidden and the card shows it via attr(data-year) — folding it in
       rather than dropping the alternation, which is what he asked to keep. */
    return '<div class="fp-item ' + side + (e.current ? " is-now" : "") + '">' +
      '<div class="fp-item-card" data-year="' + esc(year) + '">' +
        '<div class="fp-when">' + esc(e.from) + " — " + esc(e.to) +
          (e.current ? ' <span class="fp-now">Current</span>' : "") + "</div>" +
        "<h4>" + esc(opts.title ? opts.title(e) : e.role) + "</h4>" +
        '<div class="fp-org">' + esc(opts.org ? opts.org(e) : e.org) + "</div>" +
        (e.type ? '<div class="fp-type">' + esc(e.type) + "</div>" : "") +
        (e.note ? "<p>" + esc(e.note) + "</p>" : "") +
      "</div>" +
      /* The marker sits ON the spine, in the centre column, not beside the card. */
      '<div class="fp-node"><span class="fp-dot"></span></div>' +
      '<div class="fp-item-year"><span>' + esc(year) + "</span></div>" +
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
        '<div class="fp-journal">' + esc(p.journal) + '<span class="fp-date"> · ' +
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
            (c.id ? ' · ID <span class="mono">' + esc(c.id) + "</span>" : "") + "</div>" +
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
              (c.id ? ' · <span class="mono">' + esc(c.id) + "</span>" : "") + "</div>" +
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
