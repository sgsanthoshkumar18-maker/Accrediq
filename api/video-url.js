/* AQcredix — hands a subscriber a temporary link to a video.
 *
 * GET /api/video-url?key=john-felix-web.mp4
 *   -> 200 { url, expiresIn }   a link that works for two hours and then stops
 *   -> 401                      not signed in
 *   -> 403                      signed in, but nobody at this hospital has paid
 *
 * WHY THE VIDEO IS NOT JUST A URL IN THE PAGE.
 * A login gate hides a PAGE. It does nothing for a FILE. If the video's address is sitting
 * in the HTML, anyone who gets past the gate once — or who opens developer tools — can copy
 * that address, and from then on it works for everybody they send it to, forever, with no
 * subscription and no way for us to take it back. The bucket is therefore private, has no
 * public address at all, and the only way in is a link signed here, after the subscription
 * has been checked, which expires on its own.
 *
 * THE SUBSCRIPTION CHECK IS has_access(), NOT A COPY OF IT.
 * The rule for who may see paid material lives in one place: the has_access() function in
 * the database, which the row-level security policies on all twenty-three tables also use.
 * This route calls that same function rather than re-implementing "active and not expired",
 * because two copies of an access rule stay in step right up until the day they do not, and
 * the day they do not is the day either a paying hospital is locked out or a lapsed one is
 * still being served.
 *
 * NO SDK.
 * This repo has no node_modules and no build step, on purpose. The AWS SDK would be the
 * obvious way to sign an S3 URL and would also be the first dependency, so the signature is
 * built here with node's own crypto. It is about sixty lines and it does not rot.
 *
 * REQUIRED ENVIRONMENT
 *   SUPABASE_URL, SUPABASE_ANON_KEY        to ask the database who the caller is
 *   R2_ACCOUNT_ID, R2_BUCKET               which bucket
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY the S3 credentials from the R2 token screen
 */

const crypto = require("crypto");

const SB_URL = process.env.SUPABASE_URL;
const SB_ANON = process.env.SUPABASE_ANON_KEY;

const R2_ACCOUNT = process.env.R2_ACCOUNT_ID;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.R2_SECRET_ACCESS_KEY;

/* Two hours: long enough that nobody watching a talk finds the picture dying half way
   through, short enough that a link which does escape is worthless by the evening. */
const EXPIRES_SECONDS = 2 * 60 * 60;

/* A key is a file inside our own bucket, so it may contain letters, digits, dash, dot,
   underscore and slash — and nothing else. The explicit ".." check is not redundant: it is
   the one shape that turns a file name into a way of walking somewhere it should not go. */
function safeKey(raw) {
  const k = String(raw || "").trim().replace(/^\/+/, "");
  if (!k || k.length > 200) return null;
  if (k.indexOf("..") > -1) return null;
  if (!/^[A-Za-z0-9._\-/]+$/.test(k)) return null;
  return k;
}

function hmac(key, data) {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}
function sha256Hex(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/* Every segment is encoded, but the slashes between them are not — they are the path's
   structure rather than part of any one name. encodeURIComponent also leaves !'()* alone,
   which S3 expects to see encoded, hence the second pass. */
function encodePath(key) {
  return key.split("/").map(function (seg) {
    return encodeURIComponent(seg).replace(/[!'()*]/g, function (c) {
      return "%" + c.charCodeAt(0).toString(16).toUpperCase();
    });
  }).join("/");
}

/* A presigned GET, AWS Signature Version 4. The signature covers the method, the path, the
   query and the host, so none of them can be altered after the fact — change the file name
   in the link and the signature stops matching. R2's region is always the literal "auto". */
function signedUrl(o) {
  const host = o.host;
  const region = o.region || "auto";
  const amzDate = (o.date || new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const scope = dateStamp + "/" + region + "/s3/aws4_request";

  const query = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": o.keyId + "/" + scope,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(o.expires),
    "X-Amz-SignedHeaders": "host"
  };
  const canonicalQuery = Object.keys(query).sort().map(function (k) {
    return encodeURIComponent(k) + "=" + encodeURIComponent(query[k]);
  }).join("&");

  const canonicalPath = (o.bucketInPath === false ? "" : "/" + encodePath(o.bucket)) +
                        "/" + encodePath(o.key);
  const canonicalRequest = [
    "GET",
    canonicalPath,
    canonicalQuery,
    "host:" + host + "\n",
    "host",
    "UNSIGNED-PAYLOAD"
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)
  ].join("\n");

  const signingKey = hmac(hmac(hmac(hmac("AWS4" + o.secret, dateStamp), region), "s3"),
                          "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey)
                          .update(stringToSign, "utf8").digest("hex");

  return "https://" + host + canonicalPath + "?" + canonicalQuery +
         "&X-Amz-Signature=" + signature;
}

/* The R2 case, with everything this deployment already knows filled in. */
function presign(bucket, key) {
  return signedUrl({
    host: R2_ACCOUNT + ".r2.cloudflarestorage.com",
    region: "auto", bucket: bucket, key: key,
    keyId: R2_KEY_ID, secret: R2_SECRET, expires: EXPIRES_SECONDS
  });
}

/* Asked of the database rather than taken from the request. has_access() reads the caller's
   identity from the token itself, so a browser cannot claim to have paid. */
async function callerHasAccess(token) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/has_access", {
    method: "POST",
    headers: {
      apikey: SB_ANON,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: "{}"
  });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!SB_URL || !SB_ANON || !R2_ACCOUNT || !R2_BUCKET || !R2_KEY_ID || !R2_SECRET) {
    /* Said plainly in the log and vaguely to the caller: a visitor cannot act on this, and
       naming the missing variable to the world tells an attacker how we are put together. */
    console.error("video-url: missing environment", {
      SUPABASE_URL: !!SB_URL, SUPABASE_ANON_KEY: !!SB_ANON,
      R2_ACCOUNT_ID: !!R2_ACCOUNT, R2_BUCKET: !!R2_BUCKET,
      R2_ACCESS_KEY_ID: !!R2_KEY_ID, R2_SECRET_ACCESS_KEY: !!R2_SECRET
    });
    return res.status(503).json({ error: "video is not configured yet" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "sign in to watch this" });

  const key = safeKey(req.query && req.query.key);
  if (!key) return res.status(400).json({ error: "bad video name" });

  let allowed = false;
  try {
    allowed = await callerHasAccess(token);
  } catch (e) {
    console.error("video-url: access check failed", e);
    return res.status(503).json({ error: "could not check your subscription" });
  }
  if (!allowed) return res.status(403).json({ error: "this needs a subscription" });

  /* Never cached by a proxy on the way back: the link inside is personal and timed, and a
     shared cache handing it to the next visitor would undo the whole arrangement. */
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ url: presign(R2_BUCKET, key), expiresIn: EXPIRES_SECONDS });
};

/* Exposed for tests/video-url.test.js, which checks the signature against Amazon's own
   published example. A signature that is wrong fails at playback as a bare 403 from R2,
   with nothing in our logs to say why — so it is worth proving here rather than there. */
module.exports.signedUrl = signedUrl;
module.exports.safeKey = safeKey;
