/* AQcredix — health headlines bar.
 * Shows headline + source + date, each linking out to the publisher.
 * No article text is fetched or shown. Fails silently if the feed is down.
 */
(function () {
  const bar = document.getElementById("aqNews");
  if (!bar) return;
  const track = bar.querySelector(".aq-news-track");
  const base = document.body.getAttribute("data-base") || "";

  const esc = s => String(s == null ? "" : s)
    .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function when(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + "d ago";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function card(it) {
    return `<a class="aq-news-item${it.static ? " is-static" : ""}" href="${esc(it.link)}"
              target="_blank" rel="noopener noreferrer nofollow">
        <span class="aq-news-src">${esc(it.source)}</span>
        <span class="aq-news-title">${esc(it.title)}</span>
        ${it.date ? `<span class="aq-news-date">${esc(when(it.date))}</span>` : ""}
      </a>`;
  }

  fetch(base + "api/news")
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(data => {
      const items = (data.items || []).concat(data.links || []);
      if (!items.length) { bar.remove(); return; }   // nothing to show: remove rather than show an empty bar
      // duplicate the run so the marquee can loop seamlessly
      const html = items.map(card).join("");
      track.innerHTML = html + html;
      track.style.setProperty("--aq-news-count", items.length);
      bar.classList.add("is-ready");
    })
    .catch(() => { bar.remove(); });   // feed down / proxy missing: hide entirely
})();
