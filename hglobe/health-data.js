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

  /* ---------------------------------------------------------------------------
   * LAST KNOWN GOOD — survives a WHO outage.
   *
   * WHO's API goes down. Not slowly: three separate endpoints answering nothing at all
   * for twenty-five seconds each, while every other host on the internet was fine. When
   * that happens every indicator for every country reads "Unavailable", and the panel a
   * hospital director is looking at goes blank through no fault of ours.
   *
   * So every figure WHO successfully returns is kept, with the date it was captured. If a
   * later request fails, the stored figure is shown instead of an empty row — labelled as
   * stored, and never presented as fresh.
   *
   * WHAT THIS DELIBERATELY DOES NOT DO: invent, interpolate or estimate anything. A
   * stored figure is a real number WHO published, being shown a second time. Nothing here
   * ever produces a number WHO did not give us — on a platform hospitals use to prepare
   * for assessment, a plausible-looking figure of unknown origin is worse than a blank.
   * ------------------------------------------------------------------------- */
  const STORE = "aq-who-lkg-v1";
  const STORE_MAX = 400;               // keys; roughly forty countries' worth

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || "{}"); }
    catch (e) { return {}; }
  }
  function remember(key, payload) {
    try {
      const db = readStore();
      db[key] = { v: payload.value, y: payload.year, at: Date.now() };
      const keys = Object.keys(db);
      if (keys.length > STORE_MAX) {
        keys.sort((a, b) => (db[a].at || 0) - (db[b].at || 0))
            .slice(0, keys.length - STORE_MAX)
            .forEach(k => delete db[k]);
      }
      localStorage.setItem(STORE, JSON.stringify(db));
    } catch (e) { /* private mode, or the quota is full; not worth failing over */ }
  }
  function recall(key) {
    const hit = readStore()[key];
    if (!hit || hit.v == null) return null;
    return { value: hit.v, year: hit.y, storedAt: hit.at,
             source: "WHO Global Health Observatory", stale: true };
  }

  /* A FAILURE MUST NOT BE CACHED AS THOUGH IT WERE AN ANSWER.
   *
   * A thrown request already un-caches itself, but { unavailable: true } RESOLVES — so it
   * was stored like any other value and returned for the rest of the visit. One slow
   * response on the first tap therefore turned into "Unavailable" against that indicator
   * permanently, no matter how many times the panel was reopened. Only a reload cleared
   * it, which is exactly why this looked like a device problem rather than a timing one:
   * whichever view happened to load first got the failure and kept it, and the other view
   * — opened afterwards, against a warm edge cache — worked.
   *
   * Now a failed result is dropped as soon as it is seen, so the next open genuinely
   * asks again. */
  function cached(key, producer) {
    if (cache.has(key)) return cache.get(key);
    const p = producer()
      .then(v => {
        /* Two shapes reach here and both can carry a failure: a single indicator, which
           is { unavailable: true }, and the assembled list for a country, which is an
           array whose entries each carry the flag. Checking only the first left the list
           cached with its gaps intact, so reopening the panel redisplayed the same
           "Unavailable" rows without asking again — the outer cache quietly undoing the
           inner one. */
        const failed = v && (v.unavailable ||
          (Array.isArray(v) && v.some(x => x && x.unavailable)));
        if (failed) cache.delete(key);
        return v;
      })
      .catch(err => { cache.delete(key); throw err; });
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
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* NEVER RETRY A TIMEOUT. This is the whole lesson of the change before this one.
   *
   * WHO's API is intermittently slow: the same indicator measured 504 after 10.7s, then
   * 200 in 1.2s, then 200 in 0.6s, minutes apart. A blanket retry therefore turned every
   * ten-second timeout into twenty — and with eleven indicators fired at once against a
   * browser that opens about six connections per host, the slow ones queue behind each
   * other. The panel took minutes to fill. The retry meant to rescue a flaky request
   * instead doubled the cost of the very case that was already the problem.
   *
   * A retry is only worth making when the first attempt failed FAST, which means a real
   * error — a blip, a cold function — rather than WHO taking its time. If it already
   * spent seconds and gave up, asking again immediately will spend those seconds again
   * and almost certainly give up again. */
  const FAST_FAILURE_MS = 2500;

  /** Newest value for one WHO indicator, for one country. */
  function whoValue(iso3, code) {
    return cached(`who:${iso3}:${code}`, async () => {
      const url = `/api/who?indicator=${encodeURIComponent(code)}&country=${encodeURIComponent(iso3)}`;
      const t0 = Date.now();
      let r = await fetch(url).catch(() => null);
      if ((!r || !r.ok) && (Date.now() - t0) < FAST_FAILURE_MS) {
        await sleep(600);
        r = await fetch(url).catch(() => null);
      }
      if (!r) return recall(`who:${iso3}:${code}`) || { unavailable: true };
      /* A FAILED REQUEST IS NOT THE SAME AS NO FIGURE, and the panel must not say it is.
         Both used to return null, so a WHO outage rendered as "No data" against every
         indicator — which reads as WHO publishing nothing for that country. On a platform
         hospitals use, stating that WHO has no maternal mortality figure for India when it
         does is exactly the kind of confident wrongness this file exists to avoid.
         `unavailable` travels through to the panel so it can say which happened. */
      if (!r.ok) return recall(`who:${iso3}:${code}`) || { unavailable: true };
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
      const fresh = { value: v, year: newest.TimeDim, source: "WHO Global Health Observatory" };
      remember(`who:${iso3}:${code}`, fresh);
      return fresh;
    });
  }

  /* PROGRESSIVE VERSION — the panel should never wait for the slowest of eleven.
   *
   * fetchIndicators() below uses Promise.all, which by definition finishes only when the
   * last request does. Nine indicators answering in half a second were held back by one
   * taking ten, so the panel showed "Loading WHO data…" for as long as the worst request
   * took. That is the wait being reported, and no amount of tuning the slow request fixes
   * a design that waits for all of them.
   *
   * This hands each row back the moment it lands. The panel draws the list immediately
   * and fills each line in as its answer arrives, so the fast figures — which is most of
   * them — are readable straight away and the slow ones catch up. Nothing is cached here
   * that whoValue() does not already cache, so a second visit is still instant.
   *
   * onRow(index, row) is called once per indicator, in whatever order they resolve.
   * Returns a promise that settles when they all have, for anyone who wants to know. */
  function fetchIndicatorsProgressive(iso3, onRow) {
    const namesP = indicatorNames();
    return Promise.all(WHO_INDICATORS.map((meta, n) =>
      Promise.all([namesP, whoValue(iso3, meta.code).catch(() => ({ unavailable: true }))])
        .then(([names, got]) => {
          const down = !!(got && got.unavailable);
          const row = {
            code: meta.code,
            label: (names && names[meta.code]) || meta.fallback,
            unit: meta.unit,
            decimals: meta.decimals,
            value: got && !down ? got.value : null,
            year: got && !down ? got.year : null,
            unavailable: down,
            stale: !!(got && got.stale),
            storedAt: (got && got.storedAt) || null,
            source: "WHO Global Health Observatory"
          };
          try { onRow(n, row); } catch (e) {}
          return row;
        })
    ));
  }

  /** All panel indicators for one country, with WHO's own labels. */
  function fetchIndicators(iso3) {
    return cached(`whoall:${iso3}`, async () => {
      const [names, ...vals] = await Promise.all([
        indicatorNames(),
        /* A thrown request is an outage too, not an absent figure. */
        ...WHO_INDICATORS.map(i => whoValue(iso3, i.code).catch(() => ({ unavailable: true })))
      ]);
      return WHO_INDICATORS.map((meta, n) => {
        const got = vals[n];
        const down = !!(got && got.unavailable);
        return {
          code: meta.code,
          label: names[meta.code] || meta.fallback,
          unit: meta.unit,
          decimals: meta.decimals,
          value: got && !down ? got.value : null,
          year: got && !down ? got.year : null,
          unavailable: down,
          stale: !!(got && got.stale),
          storedAt: (got && got.storedAt) || null,
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

  return { WHO_INDICATORS, fetchIndicators, fetchIndicatorsProgressive,
           fetchSeries, fetchHospitals, format, indicatorNames };
})();
