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

  /* RETRY, AND WHAT IT CAN AND CANNOT FIX.
   *
   * WHO's data endpoints fail in two different ways, and only one of them is worth
   * retrying.
   *
   * A TRANSIENT BLIP — one CDN node stops responding while others are healthy. A second
   * attempt usually lands somewhere else and succeeds. Worth a retry.
   *
   * A WHO-SIDE OUTAGE — every data endpoint accepts the TCP connection, completes the TLS
   * handshake in under 200ms, and then never sends a byte, while their /Indicator
   * metadata endpoint keeps returning 413KB in 0.4s. Observed 2026-08-21: eight
   * consecutive attempts at MDG_0000000001 all hung, having returned 7.7MB in 2s an hour
   * earlier. No retry count fixes that, and a long timeout only makes the page hang
   * before showing the same nothing.
   *
   * So the budget is deliberately SHORT: two attempts of 4.5s, 9s worst case, inside the
   * 15s maxDuration set for api/*.js in vercel.json. Failing fast is the right behaviour
   * when the upstream is down, and the globe requests its nine indicators in parallel,
   * so 9s is the whole wait rather than 9s each.
   *
   * A CORRECTION WORTH RECORDING: an earlier version of this comment claimed the failed
   * first attempt "warms WHO's CDN", citing a 502 followed by fast 200s. That was wrong.
   * Those 200s were Vercel's own edge cache replaying an EARLIER successful response
   * (s-maxage=86400 above), not WHO warming up. Retrying is still worth doing for the
   * blip case, but not for that reason. */
  const ATTEMPT_MS = 4500;

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
      detail: "WHO's Global Health Observatory accepted the connection and then sent " +
              "nothing. This is a fault on their side, not a missing figure — the data " +
              "exists and cannot be reached right now. It usually clears within hours.",
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
