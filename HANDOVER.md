# AQcredix — project handover

Paste this at the start of a new chat and upload `AQcredix-files.zip` alongside it.

---

## Who and what

Dr Santhoshkumar SG, Founder & Chief Quality Officer of **AQcredix** — a NABH
accreditation and quality-implementation platform.

- Live at `accrediq.vercel.app`, repo `github.com/sgsanthoshkumar18-maker/Accrediq`
- Local path: `C:\Users\sgsan\OneDrive\Desktop\SGS\AQcredix`
  (the folder was renamed from `AccrediQ`; nothing depends on the folder name any more —
  `build/build-scope.js` used to hardcode it and no longer does)
- **Stack:** static HTML + CSS + vanilla JS. No framework, no build step. Vercel
  serverless functions under `/api`. Supabase for auth and data.
- Windows. Repo lives inside OneDrive, which intermittently blocks git and file renames —
  pause OneDrive sync before git work or renaming.

## Working style that suits him

- **Deliver built implementations, not specifications.** A build plan was rejected early;
  the correct output is working code.
- **Workflow:** build → zip **without `.git`**, contents at archive root → a short
  copy-pasteable git block in chat, not in a file.
- Comfortable with `git add / commit / push`. Not familiar with rebases, Vim, or the
  browser console — those need step-by-step plain-language guidance.
- Keep git instructions short. Long numbered walkthroughs were explicitly unwelcome.
- He often has NOT yet pushed the previous zip. Ask before assuming the live site
  reflects recent work — several "it's still broken" reports were the old deploy.

---

## What exists

**Public site:** standards browser (10 NABH chapters), 25 department pages, clinical and
non-clinical area pages, committees, KPI library, quality tools, SOP generator with .docx
export, mock surveyor, ICD-11 search, daily quiz with certificate, learn/videos.

**Workspace (gated):** readiness scoring, internal audit, incident reporting, NC & CAPA,
document control, team, owner-only Access panel.

**Internal audit** (`audit/`, `workspace/audit.html`) — 45 departments scoped from the
NABH assessor checklist. Regenerate with `node build/build-scope.js`; never hand-edit
`audit/scope-data.js`.

**Incident reporting** (`incident/`) — **patient identifiers are deliberately absent from
the web form and the database**; the printed form has ruled blanks completed in pen. A
data-protection decision. Don't reintroduce them.

**Branding** — ring mark: three-quarter teal arc closing on a serif A. The A is an
**outlined path**, not a `<text>` glyph: it was positioned by Georgia's baseline metrics
and drifted off-centre on Android/iOS where Georgia is absent. Regenerate with
`build/serif-mark.js`. The counter needs `fill-rule="evenodd"` or the A fills solid.

---

## Built in the most recent sessions

### Profile / progress page (`profile.html`, `profile/`)
Header button beside the theme toggle. Shows quizzes, certificates, videos, gap analyses,
mock surveys, internal audits, SOPs, incidents, CAPAs; a feature-coverage bar; untouched
tools as next steps; a timeline; and the subscription panel (plan, amount, start, end,
days remaining).

Counting decisions worth preserving: **gap analyses count distinct days**, not element
presses (one afternoon would otherwise read as "247"); **certificates count distinct
serials**, so regenerating after a name fix doesn't double. Gated at `login` not `paid`,
so a lapsed subscriber can still see what to renew.

### Activity ledger (`profile/activity.js`) — server-backed
Permanent per-user history in the Supabase `activity` table. Survives sign-out, new
browsers, new devices. The browser copy is now a **cache and an outbox**, not the record:
an action taken offline shows immediately, queues, and lands on reconnect.

- `record()` is synchronous and cannot throw — it runs inside success paths (a submitted
  quiz, a saved incident) where an exception would surface as that feature failing.
- A duplicate-key error counts as **success**: the table has no UPDATE policy, so an
  upsert retry of a row that already landed is refused, and treating that as failure
  would retry forever. Retries are capped at 6.
- RLS is keyed on `auth.uid()` only — org membership is never consulted, so a colleague
  or hospital admin cannot read someone's learning history. `user_id` is stamped by
  trigger from the JWT, not trusted from the client. **No UPDATE or DELETE policy**:
  history is append-only.

Audits, incidents and CAPAs are counted from their existing org-scoped tables instead,
so those cards are **hospital totals** and are labelled "Hospital total · synced".

### Palette
- Neon is the **teal** family (`#5EEAD4`, the brain's colour). It was cyan-blue
  (`#38BDF8`), which is why bars stayed blue while the hero glowed teal.
- Deep decorative surfaces are tokens (`--deep-1`, `--deep-2`, `--border-strong`,
  `--on-deep`) so neon re-tints automatically. Hardcoded indigo per component was the
  original cause of patchy coverage.
- **The home hero is a deliberate exception** and keeps its original cyan-on-navy tone,
  scoped by overriding variables on `.hero`. It matches the cyan particle canvas behind
  it. Tests exclude `.hero` from the no-blue rule rather than dropping the rule.
- Neon is **published site-wide** from `site_settings` (owner writes, everyone reads), so
  the owner's choice reaches subscribers. Only the owner can change it; everyone applies
  it. The header button switches dark/light only.
- `var DEF="neon"` in the boot snippet is the shipped default — a `"default"` fallback
  made the site open blue and only turn neon after `site_settings` was fetched and cached,
  which looked like needing two or three refreshes.
- All 47 pages share one inline boot snippet; regenerate with
  `node build/set-default-theme.js`.
- **The site opened blue on a phone** despite `DEF="neon"`. Cause: `workspace/shell.js`
  wrote `aq-palette="default"` and stripped the attribute for every non-owner — and that
  branch is also taken when there is *no* user, so one signed-out visit to any workspace
  page poisoned the cache permanently, for every page, on that device. `page-gate.js` had
  already been fixed; the workspace gate had not. **Neither gate may write the palette.**
  Three further guards now: boot treats anything other than a literal `"default"` as neon;
  an absent `site_settings` row means neon rather than the stale cache; and
  `aq-palette-v` clears the poisoned value once per device (bump it if this ever recurs).
  The header dark/light button also restores the published palette for *everyone* — the
  restore used to be owner-gated, so a subscriber who tried light once stayed blue.
- Public pages carry no store, so they rely on the boot default and the shared cache
  rather than reading `site_settings` directly.

### Mobile
- Mobile menu was collapsing to zero height: `.site-header` has `backdrop-filter`, which
  makes it the containing block for `position:fixed` descendants. The panel is now
  `position:absolute; top:100%`. **Don't reintroduce `fixed` there.**
- Hero organs and the dashboard globe now **measure their content** and solve
  `r / sin(halfFov)` against the narrower field of view. Guessed per-breakpoint distances
  failed twice: the FOV is vertical, so the kidneys (wider than tall) clip sideways on a
  square phone canvas at a distance that frames the brain perfectly.
  **Desktop hero distance is exactly 3.4 and must not change.** Both scenes only ever
  pull back, never closer.
- Both files previously threw on a `const` temporal dead zone by referencing a value
  declared later from setup code — that blanks the whole visual. Covered by tests.

### Globe labels
Every hub carries its department name, but **only hubs facing the viewer** (dot product of
the hub's own position — its outward normal — with the direction to the camera, above
0.62, roughly 40°). Names fade in and out as the globe turns. Hovered/selected keeps its
label. Long names shortened by acronym, then head noun, then truncation.

### Billing / access
- `billing/billing-config.js` is the only file to edit for pricing, UPI and email lists.
- UPI ID: check `upiVpa` — the config has a `-1` suffix the handover didn't; unverified.
- Both plans still **₹1** for testing.
- Static UPI QR cannot verify payment: user pays → submits reference → owner approves from
  `workspace/access.html`.
- Razorpay path built and dormant.
- **Owner** (`ownerEmails`): `s.g.santhoshkumar18@gmail.com`. Bypasses billing, owns the
  Access panel and the palette control.
- **Complimentary** (`complimentaryEmails`): `mavissneha@gmail.com` (double s) — lifetime free access,
  never shown the payment page, but `owner: false`. Guests of the platform, not operators.
  Mirrored in SQL as `aq_is_comp()` plus a real `sub_comp_mavisneha` subscription row
  dated 100 years out, with a trigger binding `user_id` on first sign-in.
  **Keep the JS and SQL lists in step — the SQL one is what actually grants data.**
- The Access panel shows a server-truth banner from `aq_whoami()`. The Supabase SQL editor
  carries no JWT, so `aq_is_owner()` is always false there — that already sent one
  debugging session down a blind alley.

### Sign-in
Errors were printed as raw truncated JSON. Now translated to plain language with inline
**Reset password** / **Resend confirmation** (`/auth/v1/recover`, `/auth/v1/resend`).
Before this there was no way back into an account from a second device.

**Confirmation and reset links now carry an explicit `redirect_to`, derived from
`location.origin`.** Supabase otherwise builds them from the project's Site URL, which
defaults to `http://localhost:3000` — so every new user's confirmation link went nowhere,
the account never confirmed, and sign-in was refused. The developer's own laptop kept
working off a saved session, which is why the site appeared fine to the one person who
could not see the fault. **The code half is done; the Supabase dashboard half is not
optional** — the live URL must be listed under Authentication -> URL Configuration ->
Redirect URLs, or Supabase ignores the parameter and falls back to Site URL.

---

## Tests — 145 assertions, plain Node, no install

    node tests/activity.test.js    node tests/sync.test.js
    node tests/profile.test.js     node tests/palette.test.js
    node tests/framing.test.js     node tests/access.test.js
    node tests/auth-errors.test.js

`sync.test.js` is the important one: cross-device persistence against a fake Supabase, plus
direct assertions on the RLS rules. `framing.test.js` locks the camera maths that was got
wrong twice by guessing. The scoring maths and the scope generator still have **no tests**,
and both produce records a hospital may show an assessor.

## Deploy ritual

After any schema change, re-run `workspace/schema.sql` in the Supabase SQL editor — it is
fully idempotent and ~618 lines, starting `-- ====`. **Clear the editor with Ctrl+A then
Delete first**: a paste on top of existing content produced a "syntax error at line 3070"
in a 618-line file. Open it with Notepad, not Word — smart quotes break it.

## Open items

1. **Sign-in on a second device** — the complimentary address was recorded with one `s`
   throughout (`mavisneha@`) when the real mailbox is `mavissneha@`. Corrected in
   `billing-config.js`, `aq_is_comp()` and the subscription row; the upsert now rewrites a
   stored address and releases `user_id` so the trigger rebinds. A test forbids the old
   spelling in either file. Note this was never the sign-in fault itself — a wrong address
   in these lists denies *entitlement*, not authentication. It
   works on his device because a saved session bypasses the password check. Likely
   unconfirmed email, wrong password, or the account not existing on this project. The new
   error messages will name which; check Supabase → Authentication → Users.
2. **End-to-end paywall test from a second account** on a non-owner email.
3. **Real pricing.** Both plans ₹1. Suggested ₹1,499/month or ₹14,999/year per hospital.
4. **Tax/KYC** — business income to a personal UPI; Razorpay needs KYC.
5. **No data export** for customers.
6. **Repo cleanup** — ten abandoned hero experiments (`galaxy`, `galaxy2`, `brain`, `dna`,
   `helix`, `radar`, `globe`, `hglobe`, `qglobe`, `kpinet`). Only `face/` and `qglobe/`
   are live.
7. **Role enforcement is thin** — a department head can currently close their own NC.
8. **Videos have no player**; the count records videos *started*. When a player lands,
   move the `record()` call to its `ended` event.

**Honest limitation he has been told:** `page-gate.js` runs in the browser, so it controls
what a page *displays*, not what a determined person can retrieve. The real protection is
Supabase row-level security. Same for the owner-only palette — it's presentation, not a
security boundary.

## Style notes for the code

Comments explain *why*, not *what*, and several encode hard-won debugging: the
`backdrop-filter` containing block; the vertical-FOV clipping; the upsert/RLS interaction;
Gmail dot normalisation; the SQL editor having no JWT; temporal dead zones blanking a
visual. Keep that convention. All CSS uses theme tokens so light/dark/neon follow
automatically — **never hardcode colours**, and never put a hardcoded colour inside a media
query (a test enforces this, so mobile always inherits palette fixes).
