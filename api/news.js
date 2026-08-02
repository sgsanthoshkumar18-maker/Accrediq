/* AQcredix — health news proxy.
 *
 * WHY A PROXY: RSS feeds do not send CORS headers, so a browser cannot read
 * them directly. This forwards the request server-side.
 *
 * DELIBERATELY LOW-RISK BY DESIGN:
 *  - Only a fixed allowlist of OFFICIAL regulator / public-health feeds is
 *    reachable. It cannot be used as an open proxy to arbitrary URLs.
 *  - We extract ONLY: headline, link, publication date, source name.
 *    Article bodies, descriptions and summaries are never read or returned,
 *    so no third-party prose is republished.
 *  - Headlines are truncated defensively and HTML-stripped.
 *  - Responses are cached hard at the edge to stay a light, polite client.
 */

const SOURCES = {
  who: {
    name: "WHO",
    label: "Disease Outbreak News",
    url: "https://www.who.int/feeds/entity/csr/don/en/rss.xml",
    home: "https://www.who.int/emergencies/disease-outbreak-news"
  },
  fda: {
    name: "US FDA",
    label: "Drug Safety & Availability",
    url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml",
    home: "https://www.fda.gov/drugs/drug-safety-and-availability"
  },
  ema: {
    name: "EMA",
    label: "European Medicines Agency",
    url: "https://www.ema.europa.eu/en/rss.xml",
    home: "https://www.ema.europa.eu/en/news-events"
  },
  cdc: {
    name: "US CDC",
    label: "Health Alert Network",
    url: "https://tools.cdc.gov/api/v2/resources/media/403372.rss",
    home: "https://emergency.cdc.gov/han/"
  }
};

// PvPI/IPC does not publish a stable public RSS feed. Rather than scrape their
// site (which their terms would not permit and which breaks whenever they
// redesign), we surface a standing link-out card instead. Honest and durable.
const STATIC_LINKS = [
  {
    source: "PvPI / IPC",
    label: "Pharmacovigilance Programme of India",
    title: "Report an Adverse Drug Reaction to PvPI",
    link: "https://www.ipc.gov.in/mandates/pvpi/pvpi-home.html",
    date: null,
    static: true
  }
];

function stripTags(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull ONLY title / link / date from each item. Descriptions are ignored. */
function parseFeed(xml, src) {
  const items = [];
  // handles both RSS <item> and Atom <entry>
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const tRaw = (b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    let link = (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1];
    if (!link) link = (b.match(/<link[^>]*href=["']([^"']+)["']/i) || [])[1]; // Atom
    const dRaw = (b.match(/<(pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2];

    const title = stripTags(tRaw);
    link = stripTags(link);
    if (!title || !link) continue;
    if (!/^https?:\/\//i.test(link)) continue;   // only absolute outbound links

    items.push({
      title: title.length > 160 ? title.slice(0, 157) + "…" : title,  // headline only
      link,
      date: dRaw ? new Date(stripTags(dRaw)).toISOString() : null,
      source: src.name,
      label: src.label
    });
    if (items.length >= 8) break;
  }
  return items;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // Cache hard: these feeds change slowly and we want to be a light client.
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
  if (req.method === "OPTIONS") return res.status(204).end();

  const wanted = Object.keys(SOURCES);
  const results = [];

  await Promise.all(wanted.map(async key => {
    const src = SOURCES[key];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const r = await fetch(src.url, {
        signal: controller.signal,
        headers: { "User-Agent": "AQcredix/1.0 (+https://accrediq.vercel.app)", "Accept": "application/rss+xml, application/xml, text/xml" }
      });
      clearTimeout(timer);
      if (!r.ok) return;
      const xml = await r.text();
      results.push(...parseFeed(xml, src));
    } catch (e) {
      // A dead or slow feed must never break the ticker — skip it silently.
    }
  }));

  results.sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));

  return res.status(200).json({
    items: results.slice(0, 24),
    links: STATIC_LINKS,
    notice: "Headlines are linked from official sources and are not reproduced beyond the title. AQcredix does not verify or endorse them.",
    fetched: new Date().toISOString()
  });
};
