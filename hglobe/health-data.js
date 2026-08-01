/* AQcredix — Live health data loader
 * ---------------------------------------------------------------
 * Tier 1  World Bank Indicators API  — free, no key, CORS-enabled, called directly.
 * Tier 2  WHO Global Health Observatory — free, no key, but NOT CORS-enabled, so it
 *         goes through our own /api/who serverless proxy (see api/who.js).
 * Tier 3  OpenStreetMap via Overpass — free, no key. Gives hospital NAMES and
 *         LOCATIONS only. OSM has no ratings, and bed counts are present on only a
 *         small minority of entries, so those fields render only when actually tagged.
 *
 * Every value returned carries its own source + year so the UI can cite it.
 * Nothing here estimates, interpolates or invents a figure: if an API has no
 * value, the field stays null and the UI shows "No data".
 * --------------------------------------------------------------- */
window.HealthData = (function () {

  // ---- World Bank indicator codes (all from the WDI database) ----
  const WB_INDICATORS = {
    lifeExpectancy:  { code: "SP.DYN.LE00.IN",    label: "Life expectancy at birth", unit: "years",        decimals: 1 },
    infantMortality: { code: "SP.DYN.IMRT.IN",    label: "Infant mortality rate",    unit: "per 1,000 live births", decimals: 1 },
    physicians:      { code: "SH.MED.PHYS.ZS",    label: "Physicians",               unit: "per 1,000 people",      decimals: 2 },
    hospitalBeds:    { code: "SH.MED.BEDS.ZS",    label: "Hospital beds",            unit: "per 1,000 people",      decimals: 2 },
    healthSpendGdp:  { code: "SH.XPD.CHEX.GD.ZS", label: "Health expenditure",       unit: "% of GDP",              decimals: 2 },
    healthSpendPc:   { code: "SH.XPD.CHEX.PC.CD", label: "Health expenditure",       unit: "US$ per capita",        decimals: 0 },
    oopSpend:        { code: "SH.XPD.OOPC.CH.ZS", label: "Out-of-pocket spending",   unit: "% of health spending",  decimals: 1 },
    population:      { code: "SP.POP.TOTL",       label: "Population",               unit: "",                      decimals: 0 }
  };

  const WB_BASE = "https://api.worldbank.org/v2";
  const cache = new Map();

  function cached(key, producer) {
    if (cache.has(key)) return cache.get(key);
    const p = producer().catch(err => { cache.delete(key); throw err; });
    cache.set(key, p);
    return p;
  }

  /** Most recent non-empty value for every indicator, for one country. */
  function fetchIndicators(iso3) {
    return cached("wb:" + iso3, async () => {
      const codes = Object.values(WB_INDICATORS).map(i => i.code).join(";");
      // mrnev=1 -> most recent NON-EMPTY value, which avoids returning a run of nulls
      const url = `${WB_BASE}/country/${iso3}/indicator/${codes}?format=json&mrnev=1&per_page=200&source=2`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("World Bank request failed: " + res.status);
      const json = await res.json();
      const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];

      const byCode = {};
      rows.forEach(r => {
        if (!r || r.value == null || !r.indicator) return;
        const code = r.indicator.id;
        // keep the newest year if several come back
        if (!byCode[code] || Number(r.date) > Number(byCode[code].date)) byCode[code] = r;
      });

      const out = {};
      Object.entries(WB_INDICATORS).forEach(([key, meta]) => {
        const row = byCode[meta.code];
        out[key] = row ? {
          value: Number(row.value),
          year: row.date,
          label: meta.label,
          unit: meta.unit,
          decimals: meta.decimals,
          source: "World Bank (WDI)"
        } : null;
      });
      return out;
    });
  }

  /** Time series for one indicator — powers the trend chart / time slider. */
  function fetchSeries(iso3, key, from = 2000, to = 2024) {
    const meta = WB_INDICATORS[key];
    if (!meta) return Promise.resolve([]);
    return cached(`wbs:${iso3}:${key}:${from}:${to}`, async () => {
      const url = `${WB_BASE}/country/${iso3}/indicator/${meta.code}?format=json&date=${from}:${to}&per_page=200&source=2`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("World Bank series failed: " + res.status);
      const json = await res.json();
      const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
      return rows
        .filter(r => r && r.value != null)
        .map(r => ({ year: Number(r.date), value: Number(r.value) }))
        .sort((a, b) => a.year - b.year);
    });
  }

  /** WHO GHO indicator via our proxy. Returns null (not an error) if unavailable. */
  function fetchWho(iso3, indicator) {
    return cached(`who:${iso3}:${indicator}`, async () => {
      try {
        const res = await fetch(`/api/who?indicator=${encodeURIComponent(indicator)}&country=${encodeURIComponent(iso3)}`);
        if (!res.ok) return null;
        const json = await res.json();
        const rows = (json && json.value) || [];
        if (!rows.length) return null;
        // newest year wins
        const newest = rows.reduce((a, b) => (Number(b.TimeDim) > Number(a.TimeDim) ? b : a));
        return {
          value: Number(newest.NumericValue),
          year: newest.TimeDim,
          source: "WHO Global Health Observatory"
        };
      } catch (e) {
        return null; // proxy not deployed, offline, etc. — caller shows "No data"
      }
    });
  }

  /** Vaccination coverage (DTP3, % of 1-year-olds) — a widely used WHO indicator. */
  function fetchVaccination(iso3) {
    return fetchWho(iso3, "WHS4_100");
  }

  /**
   * Hospitals near a point, from OpenStreetMap via Overpass.
   * NAMES + LOCATIONS are reliable. `beds` appears only when the OSM entry is
   * actually tagged with it. OSM has no ratings at all, so none are returned.
   */
  function fetchHospitals(lat, lon, radiusMeters = 25000, limit = 8) {
    return cached(`osm:${lat}:${lon}:${radiusMeters}`, async () => {
      const query = `
        [out:json][timeout:20];
        (
          node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
          way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
        );
        out center ${limit};`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      if (!res.ok) throw new Error("Overpass request failed: " + res.status);
      const json = await res.json();
      return (json.elements || [])
        .filter(el => el.tags && el.tags.name)
        .slice(0, limit)
        .map(el => ({
          name: el.tags.name,
          beds: el.tags["beds"] ? Number(el.tags["beds"]) : null,
          operator: el.tags["operator"] || null,
          // OSM's operator:type distinguishes public/private where tagged
          type: el.tags["operator:type"] || el.tags["healthcare"] || null,
          source: "OpenStreetMap contributors (ODbL)"
        }));
    });
  }

  /** Format an indicator object for display, with its unit. */
  function format(ind) {
    if (!ind || ind.value == null || isNaN(ind.value)) return null;
    const v = ind.decimals === 0
      ? Math.round(ind.value).toLocaleString()
      : ind.value.toFixed(ind.decimals);
    return ind.unit ? `${v} ${ind.unit}` : v;
  }

  return { WB_INDICATORS, fetchIndicators, fetchSeries, fetchWho, fetchVaccination, fetchHospitals, format };
})();
