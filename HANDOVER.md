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

### Motion layer (`motion/`)
Four effects in one file, no library: inertial scroll, parallax, scroll reveals, page
transitions. Inject with `node build/set-motion.js` (idempotent, path computed per page
depth). Two things must not be undone:

- **The scroll engine drives `window.scrollTo`, not a wrapper transform.** The usual
  wrapper approach would break `.site-header`, which is sticky *and* carries
  backdrop-filter — the same containing-block property that collapsed the mobile menu.
  Native scroll also keeps the scrollbar, Ctrl+F and anchor links working.
- **Inertial scroll is pointer-only.** A phone already has momentum in hardware;
  intercepting it makes the page feel laggy. `prefers-reduced-motion` disables all four.

The stylesheet declares **no colours at all** — pure opacity and transform — so the
palette is untouched by construction. Reveals are applied by JS, never in markup, so a
no-JS visitor is not left with a blank page. Page navigation uses a hard timeout rather
than `transitionend`: an interrupted fade would otherwise swallow the click entirely.

**Split text** (`[data-split]`) lifts headings word by word. **Words, not letters** —
letter-by-letter is the portfolio-site version and makes a heading unreadable while it
assembles, which is wrong for a page someone is scanning. The split walks TEXT NODES and
leaves element structure alone: rebuilding `innerHTML` from a word-joined string would
flatten the `<br>` and the `<span class="em">` that colours "assessor" in the hero. A
`<br>` contributes no characters to `textContent`, so the aria-label is built separately
with breaks read as spaces, or it announces "beforethe". Tested against a small DOM shim
in `tests/helpers/mini-dom.js` (no network here, so jsdom is not installable).

The **hero headline slides sideways out from behind the ring mark** rather than rising —
1250ms, long ease — while the mark scales in and its arc draws. Anything already in view
starts explicitly rather than waiting for an observer callback, which can land a frame
late and flash the finished heading.

**Scrollytelling is off below 1024px and on any coarse pointer** — phones and tablets
both. Pinning on a touch device fights the address bar resizing as you scroll, and a
tablet in portrait has too little height for a pinned card and its text. Touch is checked
as well as width so a small laptop window keeps the effect.

**Scroll pace:** `EASE = 0.22` and a 1.35 wheel multiplier in `motion.js`. The original
0.11 kept gliding after the wheel stopped, which reads as lag rather than smoothness.
These two values are the dial if it needs tuning again.

**Scroll-jacking was deliberately not built.** A quality manager is usually hunting one
element inside a long chapter, and snap panels fight that — the one effect that would
look modern and work worse.

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

### Standards export + SOP departments (`standards/`)
Each `✱ SOP required` element carries a **Which departments?** button showing every area
answerable for that SOP. The map is `standards/sop-depts.js`, built by **inverting**
`audit/scope-data.js` — the checklist publishes elements per department, so reversing it
is a fact, not a keyword guess. It rebuilds itself when the scope is regenerated. 180 of
the 188 asterisked elements resolve to a department; the other 8 are genuinely
organisation-wide and say so rather than name a wrong team.

The chapter filter row has a **Download Excel** control. On the SOP filter the workbook is
Cover / SOP Elements / Department Summary; on other filters, Cover / Elements.

**SOP Elements reads element, wording, departments** — the order a quality manager reads
in. All departments for an element sit in ONE comma-joined cell, so an element is always
exactly one row. An earlier By Department pivot led with the department and repeated each
element once per team, turning 188 SOPs into ~900 rows; Excel's filter on the Departments
column recovers that view without the row explosion. `standards/standards-excel.js` writes raw OOXML
through JSZip, matching `audit/audit-excel.js`.

The store accessor is **`AQStore.currentUser()` and it is async** — there is no `user()`.
Calling the wrong name threw into the catch, set `entitled=false`, and sent every press
including the owner's to the plans page, which looked like a UI bug rather than a failing
call. The catch now logs. Tests assert the name, the `await`, and run the real gate for
owner / dotless owner / complimentary / free / signed-out.

**The export is gated on `AQBilling.status().active`** — one question, so owner and
complimentary pass with no special case. Three things worth keeping: entitlement is
re-checked on every press (a subscription approved in another tab would otherwise tell a
paying customer they had not paid); the first check waits for `load`, because the billing
scripts are below this block and a null answer painted as unlocked; and unknown counts as
locked. **The department panel itself is free** — knowing who is accountable is part of
understanding the standard, and only the bulk export is paid. As with `page-gate.js` this
is presentation, not a security boundary: the standards data is already on the page.

### Calendar (`calendar/`, `workspace/calendar.html`)
Committee meetings and recurring NABH obligations, with a month grid, a committee
register and a task register. Three new tables: `committees`, `committee_meetings`,
`compliance_tasks` — all added to the generic RLS and org-stamping loops in `schema.sql`.

**All date logic lives in `calendar/schedule.js`, and nothing else does date arithmetic.**
Two things there are load-bearing:

- **Dates are plain `YYYY-MM-DD` strings.** `new Date("2026-03-01")` is UTC midnight,
  which is the *previous day* anywhere west of Greenwich. A due date is a calendar day,
  not an instant, so it must never round-trip through `Date`. Tests forbid it.
- **Month arithmetic clamps.** 31 Jan + 1 month is 28 Feb, not 3 March. The clamp then
  carries forward (28 Feb + 1 month = 28 Mar) rather than springing back to 31 — a real
  trade-off, pinned by test so it is not changed by accident.

`next_due` is derived, never stored: two sources of truth for "are we overdue" is exactly
the bug an assessor would find. **Never-met is its own state**, not "fine" — a committee
that has never sat is the most overdue thing in the building. "Due soon" scales with the
interval rather than a fixed 30 days, which would flag every yearly task for a month and
never flag a weekly one. Removing a committee is a **soft delete**, because minutes
recorded against it must survive it being stood down.

**Preferred weekday.** A committee may prefer Mondays while its interval lands mid-week.
Both dates are kept: `exact` is the compliance obligation an assessor measures against,
`preferred` is the nearest chosen weekday and is when the meeting is held and shown.
**The series always advances from the EXACT date** — advancing from the shifted one
compounds the drift every cycle, so a quarterly Monday committee would walk away from its
quarter over a year. Ties break FORWARD: meeting slightly late is defensible, pulling
early shortens the interval each cycle. Status is measured against the preferred date, or
a shifted committee reads as overdue for the shift window every single cycle.

**The modal classes must match `workspace.css`.** The first version invented
`ws-modal-box` / `ws-modal-foot` / `is-open`; none exist, so `.ws-modal` stayed
`display:none` and both "Add a committee" and "Add a task" were dead buttons with no
error. The real names are `.ws-modal.open`, `.ws-modal-in`, `.ws-form`, `.ws-f` (with a
`<label>` child, not a span), `.ws-modal-actions`. A test now checks every class the page
renders against the stylesheets that have to style it.

### Founder portfolio (`founder.html`, `profile/founder-*.js|css`)
Everything renders from `profile/founder-data.js` — adding a publication is one object,
no markup. Transcribed from his LinkedIn and from the certificate PDFs he supplied; posts and
reshares excluded at his instruction. Every credential number on a certificate is
recorded — a claim without one cannot be verified.

**He is a Fellow of ISQua (ID 1013000, 17 July 2026), not merely a member.** An earlier
draft had this wrong. Fellowship and the CAHO CPQIH (Basic) qualification are flagged
`top: true` and lead the credentials section at double width; nineteen certifications in
one flat grid would bury the two a hospital actually looks for. His name links there from `about.html` and `contact.html`.

**The page renders after DOMContentLoaded**, so the site-wide reveal/split/scrolly
observers never saw its markup and every section would sit at opacity 0 forever. It
dispatches `aq:content`; `motion.js` and `scrolly.js` both listen and re-scan. Both scans
are idempotent — the reveal skips anything already carrying `.aq-reveal`, and scrolly
marks wired sections with `data-scrolly-wired` — so a re-scan cannot blink the page or
double-observe.

**Portfolio motion** (`founder-motion.js`, `founder-watch.js`), modelled on the
reference portfolio he supplied: a **centre alternating timeline** — three columns (card | spine | card) with entries
alternating sides so the section fills the width, the glowing head travelling down the
middle, and each entry sliding in from its own side. **Sides are assigned in JS, not by
CSS `:nth-child`** — the education list restarts the sequence, so CSS counting would put
two entries on the same side where the two lists meet. Entries have **three** states, not
two: hidden, lit while in a band around the reading line, then dimmed to `is-seen` once
the light has passed — with only two, every earlier entry stays at full strength and the
one the light is on does not stand out. Below 900px it collapses to a single left rail,
since alternation needs width to read as alternation; publications as a pinned horizontal reel driven by scroll position; staggered card
entrances; magnetic buttons. **The reel measures its own overflow** rather than using a
guessed height, so adding a publication lengthens the scroll instead of cutting the last
card off. Nothing hijacks the wheel.

A cursor-watching ring mark was built and then **removed at his request** — it read as
gimmicky beside the rest of the page. A test forbids its return. The 3-D character from
the reference site is a modelled Blender/Spline asset, not code, and was not attempted.

3D tilt is pointer-only (no hover on touch), capped at 7°, and writes at most once per
frame. The cached rect is invalidated on scroll and resize or the card tilts around a
stale origin. A missing `assets/founder.jpg` falls back to an initials mark rather than a
broken-image icon.

### Scrollytelling (`motion/scrolly.js`)
`[data-scrolly]` pins `[data-scrolly-sticky]` while `[data-scrolly-step]` elements advance
it; the sticky element gets `data-stage="N"` and the section publishes `--scrolly-p`.
Built on **native `position:sticky`** — no transforms, no wheel interception, so the
scrollbar stays honest and the inertial engine needs no special case. Steps activate at
the **middle** of the viewport, not the top, so the paragraph being read drives the
visual. Phones and reduced-motion get `scrolly-off`: every stage stacked and fully
readable, since the content is the point and the pin is decoration.

Live on the homepage lens strip (READ / SEE / CLOSE), which now **rotates through 15
standards** across 8 chapters — `lens-rotation.js` holds the curated set,
`lens-rotate.js` picks one.

**Why curated and not all 640 elements.** Only the verbatim standard can be generated;
it is pulled from `nabh-data.js` at render time so it can never drift from the book. The
assessor-lens and the gap/fix are professional judgement, and inventing them for 640
elements would put confident unverified guidance in front of hospitals preparing for
assessment. Add entries when there is something true to say.

Selection is a **15-minute time bucket, not `Math.random()`** — random gives every
visitor a different card and a new one on every refresh, which reads as instability. A
full cycle is 3.75 hours. `?lens=CODE` forces one, for demos. Codes that no longer
resolve are dropped rather than rendered under an empty quotation.

Note `nabh-data.js` is now **eager** on the homepage for this card; `loadFaceScript()`
was refetching the same 124 KB for the hero and now reuses it via `loadFaceChain()`.
**Deliberately not used on standards or workspace pages** — holding the scroll fights
someone hunting for a specific element.

### Globe and the WHO proxy
**`vercel.json` must contain NO rewrites for `/api/*`.** Vercel maps `/api/who` to
`api/who.js` by file convention; the rewrites that used to sit there pointed at the
literal `/api/who.js` path, so Vercel served the **function source as a static file**
with a 200. `res.json()` then failed to parse it, `health-data.js` caught the error, and
every field rendered "No data" — which read as WHO having no figures rather than as the
proxy never being invoked. Re-adding a rewrite there will silently break the globe again.

**Opening rotation** is `START_ROT_Y = -0.611`, `START_ROT_X = 0.262`, applied with
`rig.rotation.set(...)` immediately after the rig is created — and that placement is the
whole point. `rotX`/`rotY` only drive the camera on the **manual fallback path**, taken
when OrbitControls fails to load. OrbitControls does load, so it owns the camera and the
render loop never calls `rig.rotation.set()`: setting those variables was correct-looking
code that could not possibly have an effect, and the globe kept opening on the Atlantic
after the "fix" shipped. Rotating the rig works on both paths. Reset must turn the rig
back too, or reset lands somewhere different from load.

The angle was scored against the 74 capitals counting how many land near the **centre**
of the disc (dot > 0.6), not merely on the near hemisphere — a capital on the limb is
visible but not invitingly clickable, which was the actual complaint. Scoring must use
three.js's **XYZ Euler order** (X before Y); composing the axes the other way suggested
-74°, a completely different view.

**`vercel.json` must be valid against Vercel's schema — it has no comment syntax.** A
`"comment"` key added to explain the removed rewrites failed two deployments outright.
Reasoning about that file belongs here, not in it.

### Command bar (`search/command.js`)
Ctrl+K / Cmd+K, or `/` when not already typing. Indexes ~700 items — elements, standards,
chapters, departments, committees, workspace pages — built **lazily on first open** from
datasets the page already loaded, so there is no index to maintain and no cost on first
paint. Inject with `node build/set-command.js`.

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

## Tests — 568 assertions, plain Node, no install

    node tests/activity.test.js    node tests/sync.test.js
    node tests/profile.test.js     node tests/palette.test.js
    node tests/framing.test.js     node tests/access.test.js
    node tests/auth-errors.test.js  node tests/standards-export.test.js
    node tests/motion.test.js  node tests/calendar.test.js
    node tests/founder.test.js  node tests/lens.test.js

`sync.test.js` is the important one: cross-device persistence against a fake Supabase, plus
direct assertions on the RLS rules. `framing.test.js` locks the camera maths that was got
wrong twice by guessing. The scoring maths and the scope generator still have **no tests**,
and both produce records a hospital may show an assessor.

## Deploy ritual

After any schema change, re-run `workspace/schema.sql` in the Supabase SQL editor — it is
fully idempotent and ~690 lines, starting `-- ====`. **Clear the editor with Ctrl+A then
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
5. **Data export** — the standards/SOP workbook is the first one. Audit, incident and
   CAPA exports for customers still do not exist.
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
