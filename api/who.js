/* AQcredix — WHO Global Health Observatory proxy.
 *
 * WHY THIS EXISTS: the WHO GHO OData API (https://ghoapi.azureedge.net/api) is
 * free and needs no key, but it sends no CORS headers, so a browser cannot call
 * it directly. This forwards the request server-side.
 *
 * DESIGN NOTES
 *  - Only an allowlist of known indicator codes is reachable, so this cannot be
 *    used as an open proxy to arbitrary URLs.
 *  - Indicator NAMES are fetched from WHO's own /Indicator endpoint rather than
 *    hardcoded here. Published sources disagree on what some codes mean, so the
 *    only trustworthy label is the one WHO itself returns.
 *  - Country filtering uses SpatialDim with an ISO3 code.
 */

const BASE = "https://ghoapi.azureedge.net/api";

// Verified against WHO GHO documentation and the public indicator catalogue.
const ALLOWED = new Set([
  "WHOSIS_000001",       // Life expectancy at birth (years)
  "WHOSIS_000002",       // Healthy life expectancy (HALE) at birth
  "WHOSIS_000015",       // Adult mortality rate
  "MDG_0000000001",      // Infant mortality rate
  "MDG_0000000007",      // Under-five mortality rate
  "MDG_0000000026",      // HIV prevalence
  "MDG_0000000025",      // Maternal mortality ratio
  "WHS4_100",            // (label resolved from WHO at runtime)
  "WHS4_544",            // (label resolved from WHO at runtime)
  "UHC_INDEX_REPORTED",  // UHC service coverage index
  "NCD_BMI_30C",         // Obesity prevalence
  "SDGPM25",             // Ambient PM2.5 air pollution
  "SA_0000001688",       // Alcohol consumption per capita
  "M_Est_cig_curr",      // Current cigarette smoking prevalence
  "WSH_SANITATION_SAFELY_MANAGED",
  "WSH_WATER_SAFELY_MANAGED"
]);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // GHO data changes infrequently; cache hard at the edge to stay a light client.
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { indicator, country, mode } = req.query || {};

  // --- metadata mode: return WHO's own names for the allowlisted indicators ---
  if (mode === "meta") {
    try {
      const r = await fetch(`${BASE}/Indicator`, { headers: { Accept: "application/json" } });
      if (!r.ok) return res.status(r.status).json({ error: "WHO metadata unavailable" });
      const j = await r.json();
      const names = {};
      (j.value || []).forEach(row => {
        if (ALLOWED.has(row.IndicatorCode)) names[row.IndicatorCode] = row.IndicatorName;
      });
      return res.status(200).json({ names });
    } catch (e) {
      return res.status(502).json({ error: "Could not reach the WHO API." });
    }
  }

  // --- data mode ---
  if (!indicator || !ALLOWED.has(indicator)) {
    return res.status(400).json({ error: "Unknown or missing indicator code." });
  }
  if (country && !/^[A-Za-z]{3}$/.test(country)) {
    return res.status(400).json({ error: "country must be a 3-letter ISO3 code." });
  }

  let url = `${BASE}/${encodeURIComponent(indicator)}`;
  if (country) url += `?$filter=SpatialDim eq '${country.toUpperCase()}'`;

  /* RETRY ONCE, AND WHY.
   *
   * WHO serves GHO through an Azure CDN with a very slow COLD path. A first request for
   * an indicator that is not in their edge cache can take well over eight seconds; every
   * request after it returns in about a fifth of a second. Measured against the live
   * endpoint: attempt 1 aborted at 8.6s, attempts 2-6 returned in 0.5-0.7s.
   *
   * The old single attempt with an 8s abort therefore failed exactly when it mattered —
   * a cold indicator — and the globe asks for nine indicators at once on load, so all
   * nine aborted together and every field read "No data". That looks like WHO having no
   * figures for India, which is the wrong conclusion entirely: the figures are there and
   * the request never completed.
   *
   * The failed first attempt is not wasted. It is what warms the CDN, which is why the
   * retry is fast rather than a second eight-second gamble.
   *
   * BUDGET: 6s + 6s = 12s worst case, inside the 15s maxDuration set for api/*.js in
   * vercel.json. If that maxDuration is ever lowered, lower these to match or the
   * function is killed mid-retry and returns nothing at all. */
  const ATTEMPT_MS = 6000;

  async function once() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ATTEMPT_MS);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
    } finally {
      clearTimeout(timer);
    }
  }

  let upstream = null, lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      upstream = await once();
      break;
    } catch (err) {
      lastErr = err;
      /* Only a timeout is worth retrying. A DNS or TLS failure will fail identically the
         second time and would just spend the caller's remaining budget. */
      if (err && err.name !== "AbortError") break;
    }
  }

  if (!upstream) {
    return res.status(504).json({
      error: "The WHO API did not respond in time.",
      detail: "This is usually a slow first request on WHO's side. Reloading normally " +
              "returns the data, because the attempt that timed out warms their cache.",
      retried: true,
      upstream: lastErr && lastErr.name === "AbortError" ? "timeout" : "unreachable"
    });
  }

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: "WHO upstream error", status: upstream.status });
  }

  try {
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "WHO returned a response that was not JSON." });
  }
};
