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

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const upstream = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "WHO upstream error", status: upstream.status });
    }
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Could not reach the WHO API." });
  }
};
