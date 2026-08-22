/* AQcredix — the class-interest poll.
 *
 * POST { email, answer, organisation? }   records one answer
 * GET  ?stats=1  with a bearer token      returns the totals, OWNER ONLY
 *
 * WHY BOTH HALVES LIVE BEHIND A FUNCTION RATHER THAN GOING STRAIGHT TO SUPABASE.
 * The browser could insert directly — the table's RLS allows it. Reading is the problem.
 * The totals are a fact about the business, not about the visitor: if most people answer
 * no, that is not something a competitor, or a hospital deciding whether to buy, should
 * be able to query. The table therefore grants no select to anybody, and the only way to
 * read it is through this file, which uses the service key and first proves the caller is
 * the owner. Doing the write here too keeps one place to reason about.
 *
 * REQUIRED ENVIRONMENT
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (already set for payment verification)
 *   OWNER_EMAIL                               who may read the totals
 */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OWNER = (process.env.OWNER_EMAIL || "").trim().toLowerCase();

const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

function sbHeaders() {
  return {
    apikey: SB_KEY,
    Authorization: "Bearer " + SB_KEY,
    "Content-Type": "application/json"
  };
}

/* Confirms the bearer token really belongs to the owner, by asking Supabase who it is.
 * The email is never taken from the request body — that would let anyone claim to be the
 * owner by typing his address. */
async function callerIsOwner(req) {
  if (!OWNER) return false;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return false;
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", {
      headers: { apikey: SB_KEY, Authorization: "Bearer " + token }
    });
    if (!r.ok) return false;
    const u = await r.json();
    return !!(u && u.email && String(u.email).trim().toLowerCase() === OWNER);
  } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  if (!SB_URL || !SB_KEY) {
    return res.status(503).json({ error: "The poll is not configured yet." });
  }

  /* ---------------- owner: read the totals ---------------- */
  if (req.method === "GET") {
    if (!(await callerIsOwner(req))) {
      /* 404, not 403. A 403 confirms the endpoint exists and is worth attacking; there
         is nothing to be gained by telling an anonymous caller that. */
      return res.status(404).json({ error: "Not found" });
    }
    try {
      const r = await fetch(
        SB_URL + "/rest/v1/class_interest?select=answer,organisation,created_at&order=created_at.desc",
        { headers: sbHeaders() }
      );
      if (!r.ok) return res.status(502).json({ error: "Could not read the responses." });
      const rows = await r.json();
      const yes = rows.filter(function (x) { return x.answer === true; }).length;
      const no = rows.length - yes;
      return res.status(200).json({
        total: rows.length,
        yes: yes,
        no: no,
        yesPct: rows.length ? Math.round((yes / rows.length) * 100) : 0,
        recent: rows.slice(0, 20).map(function (x) {
          return { answer: x.answer, organisation: x.organisation || null, at: x.created_at };
        })
      });
    } catch (e) {
      return res.status(502).json({ error: "Could not read the responses." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "POST only" });
  }

  /* ---------------- visitor: record one answer ---------------- */
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  /* The honeypot, as on the support form: a field no human ever sees. Answered 200 so a
     bot learns nothing from the response. */
  if (b.company) return res.status(200).json({ ok: true });

  const email = String(b.email || "").trim();
  const org = String(b.organisation || "").trim().slice(0, 160) || null;
  const answer = b.answer === true || b.answer === "yes";

  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: "That email address does not look right." });
  }
  if (b.answer !== true && b.answer !== false && b.answer !== "yes" && b.answer !== "no") {
    return res.status(400).json({ error: "Please choose yes or no." });
  }

  try {
    const r = await fetch(SB_URL + "/rest/v1/class_interest", {
      method: "POST",
      headers: Object.assign(sbHeaders(), { Prefer: "return=minimal" }),
      body: JSON.stringify({ email: email, answer: answer, organisation: org })
    });

    if (r.status === 409) {
      /* The unique index refused a second answer from this address. Not an error from
         the visitor's point of view — they have already been counted, and saying so
         plainly is friendlier than a failure. */
      return res.status(200).json({ ok: true, already: true });
    }
    if (!r.ok) {
      const detail = await r.text();
      if (/duplicate key|class_interest_email_uniq/i.test(detail)) {
        return res.status(200).json({ ok: true, already: true });
      }
      return res.status(502).json({ error: "We could not record that just now." });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: "We could not reach the database." });
  }
};
