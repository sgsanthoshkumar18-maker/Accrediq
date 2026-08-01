/* AQcredix — WHO Global Health Observatory proxy.
 *
 * Why this exists: the WHO GHO OData API is free and needs no key, but it does
 * not send CORS headers, so a browser cannot call it directly. This tiny Vercel
 * serverless function forwards the request server-side and returns the JSON with
 * CORS enabled. No API key, no secrets — nothing sensitive lives here.
 *
 * Deploys automatically on Vercel from /api/who.js  ->  https://<site>/api/who
 *
 * Usage:  /api/who?indicator=WHS4_100&country=IND
 */

const WHO_BASE = "https://ghoapi.azureedge.net/api";

// Only allow known-good indicator codes through, so this can't be used as an
// open proxy to arbitrary URLs.
const ALLOWED_INDICATORS = new Set([
  "WHS4_100",        // DTP3 immunization coverage among 1-year-olds (%)
  "WHS4_544",        // Measles (MCV) immunization coverage among 1-year-olds (%)
  "WHS8_110",        // Life expectancy at birth
  "MDG_0000000001",  // Infant mortality rate
  "UHC_INDEX_REPORTED", // UHC service coverage index
  "SDGHRHNURSMID",   // Nursing and midwifery personnel density
  "HWF_0001"         // Medical doctors density
]);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // WHO data updates infrequently; cache hard at the edge to stay well within limits.
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");

  if (req.method === "OPTIONS") return res.status(204).end();

  const { indicator, country } = req.query || {};

  if (!indicator || !ALLOWED_INDICATORS.has(indicator)) {
    return res.status(400).json({ error: "Unknown or missing indicator code." });
  }
  // ISO3 country codes only — three letters, nothing else.
  if (country && !/^[A-Za-z]{3}$/.test(country)) {
    return res.status(400).json({ error: "country must be a 3-letter ISO3 code." });
  }

  let url = `${WHO_BASE}/${encodeURIComponent(indicator)}`;
  if (country) url += `?$filter=SpatialDim eq '${country.toUpperCase()}'`;

  try {
    const upstream = await fetch(url, { headers: { Accept: "application/json" } });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "WHO upstream error", status: upstream.status });
    }
    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: "Could not reach the WHO API." });
  }
};
