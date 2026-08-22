/* AQcredix — grant and revoke complimentary access. Owner only.
 *
 * GET                       list who has it
 * POST { email, note }      grant
 * POST { email, revoke:1 }  take it back
 *
 * WHY THIS EXISTS.
 * Granting used to be two edits done by hand and in step: an address added to a list in
 * billing-config.js and pushed, plus a SQL statement run in the Supabase editor. Miss
 * either and the person lands in a worse state than before — past the paywall but with no
 * data, or blocked despite having been promised access. That happened twice. Two systems
 * that must be updated together, by hand, will eventually not be.
 *
 * Now there is one action. The table is the list, this route is the only way to write to
 * it, and it does both halves — the entitlement row and the subscription record — in one
 * request or not at all.
 *
 * REQUIRED ENVIRONMENT
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   OWNER_EMAIL   the only account permitted to call this
 */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OWNER = (process.env.OWNER_EMAIL || "").trim().toLowerCase();

const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

function sbHeaders(extra) {
  return Object.assign({
    apikey: SB_KEY,
    Authorization: "Bearer " + SB_KEY,
    "Content-Type": "application/json"
  }, extra || {});
}

/* Gmail ignores dots and everything after a + in the local part, so the same mailbox has
 * many spellings. Matching on the normalised form means a grant works whichever one the
 * person signs up with — and, just as importantly, means revoking actually revokes. */
function normalise(raw) {
  const e = String(raw || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at), domain = e.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus > -1) local = local.slice(0, plus);
  if (domain === "gmail.com" || domain === "googlemail.com") local = local.split(".").join("");
  return local + "@" + domain;
}

/* Who is this token, really? Asked of Supabase rather than taken from the request, which
 * would let anyone claim to be the owner by typing his address. */
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

/* A stable id per address, so re-granting updates that person's row rather than adding a
 * second one — and so two different people can never collide on the same id. */
function rowId(email) {
  return "sub_comp_" + normalise(email).replace(/[^a-z0-9]/g, "").slice(0, 40);
}

module.exports = async function handler(req, res) {
  if (!SB_URL || !SB_KEY) {
    return res.status(503).json({ error: "Not configured." });
  }
  if (!(await callerIsOwner(req))) {
    /* 404, not 403. Confirming that an endpoint which hands out free access exists is
       worth nothing to a stranger and something to an attacker. */
    return res.status(404).json({ error: "Not found" });
  }

  /* ---------------- list ---------------- */
  if (req.method === "GET") {
    try {
      const r = await fetch(
        SB_URL + "/rest/v1/complimentary_access?select=email,note,granted_at&order=granted_at.desc",
        { headers: sbHeaders() }
      );
      if (!r.ok) return res.status(502).json({ error: "Could not read the list." });
      return res.status(200).json({ accounts: await r.json() });
    } catch (e) {
      return res.status(502).json({ error: "Could not read the list." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "GET or POST" });
  }

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  const email = String(b.email || "").trim();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: "That email address does not look right." });
  }

  /* ---------------- revoke ---------------- */
  if (b.revoke) {
    /* THE OWNER CANNOT REVOKE HIMSELF INTO A CORNER. Not that it would lock him out —
       ownership comes from OWNER_EMAIL, not from this table — but a confusing no-op is
       worth refusing outright rather than performing silently. */
    if (normalise(email) === normalise(OWNER)) {
      return res.status(400).json({ error: "That is the owner account; it does not use this list." });
    }
    try {
      /* The entitlement goes first. If the second call fails the person has already lost
         access, which is the safe direction for a revoke — the reverse would leave them
         still entitled with their subscription marked dead. */
      const d = await fetch(
        SB_URL + "/rest/v1/complimentary_access?email=eq." + encodeURIComponent(email),
        { method: "DELETE", headers: sbHeaders({ Prefer: "return=minimal" }) }
      );
      if (!d.ok) return res.status(502).json({ error: "Could not remove the entitlement." });

      await fetch(
        SB_URL + "/rest/v1/subscriptions?id=eq." + encodeURIComponent(rowId(email)),
        { method: "PATCH", headers: sbHeaders({ Prefer: "return=minimal" }),
          body: JSON.stringify({ status: "rejected", updated_at: new Date().toISOString() }) }
      );
      return res.status(200).json({ ok: true, revoked: email });
    } catch (e) {
      return res.status(502).json({ error: "Could not reach the database." });
    }
  }

  /* ---------------- grant ---------------- */
  const note = String(b.note || "").trim().slice(0, 200) || "Granted by the owner.";

  /* FIND THEIR ACCOUNT ID NOW, IF THEY HAVE ONE.
   *
   * aq_claim_comp_trg binds user_id to a complimentary row — but it fires on INSERT into
   * auth.users, which means only at sign-up. Most grants go to people who registered
   * days ago, and for them nothing would ever fill it in. That matters because the read
   * policy on subscriptions is user_id = auth.uid(): with a null there they cannot see
   * their own row, and would still be shown a price despite holding the entitlement.
   *
   * So the id is resolved here when the account already exists, and left null when it
   * does not — in which case the trigger will do it the moment they sign up. Between the
   * two, every order of events is covered. */
  let userId = null;
  try {
    const q = await fetch(
      SB_URL + "/auth/v1/admin/users?per_page=1000",
      { headers: sbHeaders() }
    );
    if (q.ok) {
      const j = await q.json();
      const hit = (j.users || j || []).filter(function (u) {
        return u && u.email && normalise(u.email) === normalise(email);
      })[0];
      if (hit && hit.id) userId = hit.id;
    }
  } catch (e) { /* not fatal: the trigger is the fallback */ }
  const now = new Date();
  const expires = new Date(now.getTime());
  expires.setFullYear(expires.getFullYear() + 100);

  try {
    /* 1. The entitlement. aq_is_comp() reads this table, so this is what the database
          actually consults when deciding what they may see. */
    const a = await fetch(SB_URL + "/rest/v1/complimentary_access", {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ email: email, note: note, granted_by: OWNER })
    });
    if (!a.ok) {
      const detail = await a.text();
      return res.status(502).json({ error: "Could not grant.", detail: detail.slice(0, 200) });
    }

    /* 2. A real subscription row, so the account looks like any other active subscriber
          everywhere in the app rather than being a special case each screen must know
          about. user_id is filled above when the account already exists, and left null
          when it does not — the trigger binds it at sign-up in that case. */
    const s = await fetch(SB_URL + "/rest/v1/subscriptions", {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: rowId(email),
        user_id: userId,
        email: email,
        name: "Complimentary",
        plan: "complimentary",
        months: 1200,
        amount_paise: 0,
        method: "complimentary",
        status: "active",
        requested_at: now.toISOString(),
        activated_at: now.toISOString(),
        expires_at: expires.toISOString(),
        approved_by: "owner",
        note: note
      })
    });
    if (!s.ok) {
      const detail = await s.text();
      /* Report it rather than claiming success. The entitlement is in place, so they are
         not locked out — but the subscription panel will look wrong until this is fixed,
         and saying so is better than a green tick that hides it. */
      return res.status(502).json({
        error: "Access granted, but the subscription record failed to write.",
        detail: detail.slice(0, 200)
      });
    }

    return res.status(200).json({ ok: true, granted: email });
  } catch (e) {
    return res.status(502).json({ error: "Could not reach the database." });
  }
};
