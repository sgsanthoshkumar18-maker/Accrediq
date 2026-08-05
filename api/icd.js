/* AQcredix — WHO ICD-11 API proxy.
 *
 * SECURITY: the ICD client secret is a real credential and must never appear in
 * the repository or in browser code. It is read from Vercel environment
 * variables (ICD_CLIENT_ID / ICD_CLIENT_SECRET) at runtime only.
 *
 * The ICD API needs OAuth2 client-credentials auth and issues tokens valid for
 * about an hour. This caches the token in module scope so a warm function
 * reuses it instead of re-authenticating on every request.
 *
 * Endpoints proxied (all under https://id.who.int):
 *   ?action=search    &q=...            -> ICD-11 MMS search
 *   ?action=autocomplete&q=...          -> fast type-ahead
 *   ?action=entity    &id=...           -> full entity detail
 *   ?action=map10to11 &code=...         -> ICD-10 code -> ICD-11
 *   ?action=map11to10 &code=...         -> ICD-11 code -> ICD-10
 *   ?action=icd10     &code=...         -> ICD-10 entity detail
 */

const TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token";
const BASE = "https://id.who.int";
const RELEASE = "2024-01";           // pinned so results stay stable
const LINEARIZATION = "mms";         // Mortality & Morbidity Statistics

let cachedToken = null;
let tokenExpiry = 0;

async function getToken() {
  const id = process.env.ICD_CLIENT_ID;
  const secret = process.env.ICD_CLIENT_SECRET;
  if (!id || !secret) throw new Error("ICD credentials are not configured on the server.");

  // reuse while valid, with a 60s safety margin
  if (cachedToken && Date.now() < tokenExpiry - 60000) return cachedToken;

  const body = new URLSearchParams({
    client_id: id, client_secret: secret,
    scope: "icdapi_access", grant_type: "client_credentials"
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!r.ok) throw new Error("ICD token request failed: " + r.status);
  const j = await r.json();
  cachedToken = j.access_token;
  tokenExpiry = Date.now() + (Number(j.expires_in || 3600) * 1000);
  return cachedToken;
}

async function icdGet(path, token) {
  const r = await fetch(BASE + path, {
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "Accept-Language": "en",
      "API-Version": "v2"
    }
  });
  if (!r.ok) {
    const e = new Error("ICD upstream " + r.status);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // ICD releases change rarely — cache hard at the edge.
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { action, q, id, code } = req.query || {};

  try {
    const token = await getToken();
    let path;

    switch (action) {
      case "search": {
        if (!q || q.length < 2) return res.status(400).json({ error: "Query too short." });
        path = `/icd/release/11/${RELEASE}/${LINEARIZATION}/search`
             + `?q=${encodeURIComponent(q)}&useFlexisearch=true&flatResults=true`;
        break;
      }
      case "autocomplete": {
        if (!q || q.length < 2) return res.status(400).json({ error: "Query too short." });
        path = `/icd/release/11/${RELEASE}/${LINEARIZATION}/autocode?searchText=${encodeURIComponent(q)}`;
        break;
      }
      case "entity": {
        if (!id || !/^[0-9]+$/.test(String(id))) return res.status(400).json({ error: "Invalid entity id." });
        path = `/icd/release/11/${RELEASE}/${LINEARIZATION}/${id}`;
        break;
      }
      case "map10to11": {
        if (!code) return res.status(400).json({ error: "Missing ICD-10 code." });
        path = `/icd/release/10/${encodeURIComponent(code)}`;
        // resolved client-side against an ICD-11 search of the returned title
        break;
      }
      case "icd10": {
        if (!code) return res.status(400).json({ error: "Missing ICD-10 code." });
        path = `/icd/release/10/${encodeURIComponent(code)}`;
        break;
      }
      case "lookup11": {
        // resolve an ICD-11 code (e.g. "5A11") to its entity
        if (!code) return res.status(400).json({ error: "Missing ICD-11 code." });
        path = `/icd/release/11/${RELEASE}/${LINEARIZATION}/codeinfo/${encodeURIComponent(code)}`;
        break;
      }
      default:
        return res.status(400).json({ error: "Unknown action." });
    }

    const data = await icdGet(path, token);
    return res.status(200).json(data);

  } catch (err) {
    const status = err.status === 404 ? 404 : 502;
    return res.status(status).json({
      error: err.status === 404 ? "Not found in the ICD release." : "Could not reach the ICD API.",
      detail: String(err.message || "")
    });
  }
};
