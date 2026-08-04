/* AQcredix — health data loader, WHO Global Health Observatory first.
 * -------------------------------------------------------------------
 * PRIMARY SOURCE: WHO GHO OData API (https://ghoapi.azureedge.net/api),
 * reached through our own /api/who serverless proxy because WHO sends no
 * CORS headers. Free, no key, authoritative.
 *
 * Indicator LABELS are not hardcoded — they are fetched from WHO's own
 * /Indicator catalogue, so what the panel says an indicator means is what
 * WHO says it means.
 *
 * Also available: OpenStreetMap hospitals (names and locations only; OSM has
 * no ratings, and bed counts appear only where contributors tagged them).
 *
 * Nothing here estimates or interpolates. If WHO has no value for a country,
 * the field stays null and the UI shows "No data".
 */
window.HealthData = (function () {

  // Indicators shown on the capital panel, in display order.
  const WHO_INDICATORS = [
    { code: "WHOSIS_000001",      fallback: "Life expectancy at birth",        unit: "years",  decimals: 1 },
    { code: "WHOSIS_000002",      fallback: "Healthy life expectancy (HALE)",  unit: "years",  decimals: 1 },
    { code: "MDG_0000000001",     fallback: "Infant mortality rate",           unit: "per 1,000 live births", decimals: 1 },
    { code: "MDG_0000000007",     fallback: "Under-five mortality rate",       unit: "per 1,000 live births", decimals: 1 },
    { code: "MDG_0000000025",     fallback: "Maternal mortality ratio",        unit: "per 100,000 live births", decimals: 0 },
    { code: "UHC_INDEX_REPORTED", fallback: "UHC service coverage index",      unit: "index",  decimals: 0 },
    { code: "WHS4_100",           fallback: "WHO indicator WHS4_100",          unit: "",       decimals: 1 },
    { code: "NCD_BMI_30C",        fallback: "Obesity prevalence",              unit: "%",      decimals: 1 },
    { code: "SDGPM25",            fallback: "Ambient PM2.5 air pollution",     unit: "µg/m³",  decimals: 1 }
  ];

  const cache = new Map();
  let namesPromise = null;

  function cached(key, producer) {
    if (cache.has(key)) return cache.get(key);
    const p = producer().catch(err => { cache.delete(key); throw err; });
    cache.set(key, p);
    return p;
  }

  /** WHO's own indicator names, so labels are authoritative rather than assumed. */
  function indicatorNames() {
    if (namesPromise) return namesPromise;
    namesPromise = fetch("/api/who?mode=meta")
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => j.names || {})
      .catch(() => ({}));           // fall back to our own labels if unreachable
    return namesPromise;
  }

  /** Newest value for one WHO indicator, for one country. */
  function whoValue(iso3, code) {
    return cached(`who:${iso3}:${code}`, async () => {
      const r = await fetch(`/api/who?indicator=${encodeURIComponent(code)}&country=${encodeURIComponent(iso3)}`);
      if (!r.ok) return null;
      const j = await r.json();
      const rows = (j && j.value) || [];
      if (!rows.length) return null;
      // Prefer rows with no sex/age disaggregation, so we get the headline figure
      // rather than a single subgroup. Fall back to any row if none are plain.
      const plain = rows.filter(x => !x.Dim1 || x.Dim1 === "SEX_BTSX" || x.Dim1 === "BTSX");
      const pool = plain.length ? plain : rows;
      const newest = pool.reduce((a, b) => (Number(b.TimeDim || 0) > Number(a.TimeDim || 0) ? b : a));
      const v = newest.NumericValue != null ? Number(newest.NumericValue) : null;
      if (v == null || isNaN(v)) return null;
      return { value: v, year: newest.TimeDim, source: "WHO Global Health Observatory" };
    });
  }

  /** All panel indicators for one country, with WHO's own labels. */
  function fetchIndicators(iso3) {
    return cached(`whoall:${iso3}`, async () => {
      const [names, ...vals] = await Promise.all([
        indicatorNames(),
        ...WHO_INDICATORS.map(i => whoValue(iso3, i.code).catch(() => null))
      ]);
      return WHO_INDICATORS.map((meta, n) => {
        const got = vals[n];
        return {
          code: meta.code,
          label: names[meta.code] || meta.fallback,
          unit: meta.unit,
          decimals: meta.decimals,
          value: got ? got.value : null,
          year: got ? got.year : null,
          source: "WHO Global Health Observatory"
        };
      });
    });
  }

  /** Time series for one indicator — powers the trend sparkline. */
  function fetchSeries(iso3, code, from = 2000, to = 2024) {
    return cached(`whoseries:${iso3}:${code}`, async () => {
      const r = await fetch(`/api/who?indicator=${encodeURIComponent(code)}&country=${encodeURIComponent(iso3)}`);
      if (!r.ok) return [];
      const j = await r.json();
      const rows = (j && j.value) || [];
      const plain = rows.filter(x => !x.Dim1 || x.Dim1 === "SEX_BTSX" || x.Dim1 === "BTSX");
      const pool = plain.length ? plain : rows;
      const byYear = {};
      pool.forEach(x => {
        const y = Number(x.TimeDim);
        const v = x.NumericValue != null ? Number(x.NumericValue) : null;
        if (!y || y < from || y > to || v == null || isNaN(v)) return;
        byYear[y] = v;
      });
      return Object.keys(byYear).map(Number).sort((a, b) => a - b)
        .map(y => ({ year: y, value: byYear[y] }));
    });
  }

  /** Hospitals near a point from OpenStreetMap — names and locations only. */
  function fetchHospitals(lat, lon, radiusMeters = 25000, limit = 8) {
    return cached(`osm:${lat}:${lon}`, async () => {
      const query = `[out:json][timeout:20];(node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});way["amenity"="hospital"](around:${radiusMeters},${lat},${lon}););out center ${limit};`;
      const r = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST", body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      if (!r.ok) throw new Error("Overpass " + r.status);
      const j = await r.json();
      return (j.elements || []).filter(el => el.tags && el.tags.name).slice(0, limit).map(el => ({
        name: el.tags.name,
        beds: el.tags.beds ? Number(el.tags.beds) : null,
        operator: el.tags.operator || null,
        type: el.tags["operator:type"] || el.tags.healthcare || null,
        source: "OpenStreetMap contributors (ODbL)"
      }));
    });
  }

  function format(ind) {
    if (!ind || ind.value == null || isNaN(ind.value)) return null;
    const v = ind.decimals === 0 ? Math.round(ind.value).toLocaleString() : ind.value.toFixed(ind.decimals);
    return ind.unit ? `${v} ${ind.unit}` : v;
  }

  return { WHO_INDICATORS, fetchIndicators, fetchSeries, fetchHospitals, format, indicatorNames };
})();
