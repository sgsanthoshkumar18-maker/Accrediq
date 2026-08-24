/* AQcredix — does this person already have an AQcredix account?
 *
 * GET /api/account-exists?email=someone@hospital.org
 *   -> 200 { exists: true|false }
 *   -> 401 not signed in
 *   -> 403 signed in, but not someone who manages a team
 *   -> 503 we could not tell
 *
 * WHY.
 * A seat used to be created for any address typed into the Team form. The row saved, the
 * screen said "Saved", and nothing happened — because a seat is matched to a person when
 * they sign in with that address, and nobody had. The Quality Manager believed a colleague
 * had been given access; the colleague had been given nothing; and neither of them found
 * out until somebody asked why the ward was not filing anything. Checking first turns a
 * silent non-event into a sentence on screen.
 *
 * WHY THIS IS NOT AN OPEN ENDPOINT.
 * "Tell me whether this address has an account" is exactly the question a stranger asks
 * when working out who to send a phishing mail to. So the caller has to be signed in AND
 * hold a role that manages a team — the same people who can already see their colleagues'
 * addresses on the Team page, and who therefore learn nothing new.
 *
 * NO 404 DISGUISE HERE, UNLIKE THE OWNER-ONLY ROUTES.
 * Those hide their own existence because merely knowing the route exists is a clue. This
 * one is reached from a form the caller is looking at, so a 403 tells them nothing they
 * cannot see, and a 404 would send a Quality Manager hunting for a broken page.
 *
 * REQUIRED ENVIRONMENT
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const SB_URL = process.env.SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const OWNER = (process.env.OWNER_EMAIL || "").trim().toLowerCase();

/* The roles that may add somebody to a hospital. Kept in step with can_edit()/is_admin()
   in workspace/schema.sql — if a role is added there that can manage seats, add it here. */
const MANAGER_ROLES = ["owner", "admin", "quality_manager", "director"];

const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

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

function svcHeaders() {
  return { apikey: SB_SERVICE, Authorization: "Bearer " + SB_SERVICE };
}

async function callerFromToken(token) {
  try {
    const r = await fetch(SB_URL + "/auth/v1/user", {
      headers: { apikey: SB_SERVICE, Authorization: "Bearer " + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email || "" } : null;
  } catch (e) { return null; }
}

async function callerMayManage(caller) {
  if (OWNER && normalise(caller.email) === normalise(OWNER)) return true;
  try {
    const r = await fetch(SB_URL + "/rest/v1/members?select=role&user_id=eq." +
                          encodeURIComponent(caller.id), { headers: svcHeaders() });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows.some(function (m) {
      return MANAGER_ROLES.indexOf(String(m && m.role || "").toLowerCase()) > -1;
    });
  } catch (e) { return false; }
}

/* GoTrue has no "get user by email", so the list is walked. Capped rather than unbounded:
   at a few hundred accounts this is one request, and the cap means a runaway page count
   can never turn one form submission into a thousand calls. Returns null for "could not
   tell", which the caller must not confuse with "no". */
async function accountExists(email) {
  const want = normalise(email);
  const PER_PAGE = 200, MAX_PAGES = 15;
  for (let page = 1; page <= MAX_PAGES; page++) {
    let r;
    try {
      r = await fetch(SB_URL + "/auth/v1/admin/users?page=" + page + "&per_page=" + PER_PAGE,
                      { headers: svcHeaders() });
    } catch (e) { return null; }
    if (!r.ok) return null;
    let j;
    try { j = await r.json(); } catch (e) { return null; }
    const users = (j && (j.users || j)) || [];
    if (!Array.isArray(users)) return null;
    for (const u of users) {
      if (u && u.email && normalise(u.email) === want) return true;
    }
    if (users.length < PER_PAGE) return false;      // that was the last page
  }
  return null;                                       // more accounts than we agreed to walk
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!SB_URL || !SB_SERVICE) {
    console.error("account-exists: missing SUPABASE_URL or service key");
    return res.status(503).json({ error: "not configured" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "sign in first" });

  const caller = await callerFromToken(token);
  if (!caller) return res.status(401).json({ error: "sign in first" });
  if (!(await callerMayManage(caller))) {
    return res.status(403).json({ error: "only a Quality Manager or Director can do this" });
  }

  const email = String((req.query && req.query.email) || "").trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "that is not an email address" });

  const found = await accountExists(email);
  if (found === null) return res.status(503).json({ error: "could not check just now" });

  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ exists: found });
};

module.exports.normalise = normalise;
