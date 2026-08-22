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

/* Who is this token, really? Asks Supabase rather than trusting anything the browser
 * said about itself. Returns null for an absent, expired or invalid token. */
async function emailFromToken(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", {
      headers: { apikey: SB_KEY, Authorization: "Bearer " + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.email ? String(u.email).trim() : null;
  } catch (e) { return null; }
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
        SB_URL + "/rest/v1/class_interest?select=email,answer,organisation,created_at&order=created_at.desc",
        { headers: sbHeaders() }
      );
      if (!r.ok) return res.status(502).json({ error: "Could not read the responses." });
      const rows = await r.json();
      const yes = rows.filter(function (x) { return x.answer === true; }).length;
      const no = rows.length - yes;

      /* NAMES COME FROM TWO PLACES, BECAUSE ONE WAS NOT ENOUGH.
       *
       * The first version read public.members only — which is the ORGANISATION TEAM
       * table, not a list of everyone with an account. Anybody who signed up but was
       * never added to an org, complimentary accounts included, was missing from it, so
       * their row showed a dash and read as "this person has no account here" when they
       * plainly did. That is a misleading blank in a panel used to decide who to write
       * to.
       *
       * So the account records are consulted too, and whatever name was given at sign-up
       * is used when the team table has nothing. Members still wins where both exist:
       * that name was entered deliberately by a colleague, while the sign-up one is
       * whatever the person typed once.
       *
       * Still nothing is guessed. A respondent with no account anywhere shows a dash,
       * which is the honest answer — the poll sits on the public home page and needs no
       * sign-in, so plenty of answers will never have a name attached. */
      let names = {};

      try {
        const au = await fetch(SB_URL + "/auth/v1/admin/users?per_page=1000", { headers: sbHeaders() });
        if (au.ok) {
          const j = await au.json();
          (j.users || j || []).forEach(function (u) {
            if (!u || !u.email) return;
            const md = u.user_metadata || u.raw_user_meta_data || {};
            const n = md.full_name || md.name || md.display_name || null;
            if (n) names[String(u.email).trim().toLowerCase()] = n;
          });
        }
      } catch (e) { /* a missing name is not worth failing the whole panel over */ }

      try {
        const m = await fetch(SB_URL + "/rest/v1/members?select=email,name", { headers: sbHeaders() });
        if (m.ok) {
          (await m.json()).forEach(function (x) {
            if (x && x.email && x.name) names[String(x.email).trim().toLowerCase()] = x.name;
          });
        }
      } catch (e) { /* as above */ }

      return res.status(200).json({
        total: rows.length,
        yes: yes,
        no: no,
        yesPct: rows.length ? Math.round((yes / rows.length) * 100) : 0,
        /* The full list, owner only. Sent so the panel can show who said what and offer a
           reply — it is the whole point of having asked. */
        respondents: rows.map(function (x) {
          const e = String(x.email || "").trim();
          return {
            email: e,
            name: names[e.toLowerCase()] || null,
            answer: x.answer,
            organisation: x.organisation || null,
            at: x.created_at
          };
        }),
        yesEmails: rows.filter(function (x) { return x.answer === true; })
                       .map(function (x) { return String(x.email || "").trim(); })
                       .filter(Boolean)
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

  /* A SIGNED-IN PERSON IS NEVER ASKED FOR THEIR ADDRESS, AND NEVER TRUSTED FOR IT EITHER.
   *
   * The panel already knows who they are, so making them type an address the site holds
   * is friction for no reason — that is the change this supports. But the address is not
   * taken from what the browser sent: it is read back off the token by asking Supabase.
   * Otherwise anyone signed in could answer as somebody else's address, and since one
   * address gets one answer, that would let them spend a colleague's vote as well as
   * their own. A token cannot be pointed at an account it does not belong to. */
  const signedInAs = await emailFromToken(req);
  const email = signedInAs || String(b.email || "").trim();
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
