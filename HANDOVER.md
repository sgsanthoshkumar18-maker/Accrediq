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
one the light is on does not stand out. **Alternation is preserved on every screen**, at his explicit request. Rather than
collapsing to a left rail below 900px, the year column is hidden on phones and folded
into the card via `content: attr(data-year)` — the renderer stamps `data-year` on the
card for exactly this. At 380px each card still gets ~165px, tight but legible with the
reduced type scale; publications as a pinned horizontal reel driven by scroll position; staggered card
entrances; magnetic buttons. **The reel measures its own overflow** rather than using a
guessed height, so adding a publication lengthens the scroll instead of cutting the last
card off. Nothing hijacks the wheel.

**The reel is gated on `(hover: hover) and (pointer: fine) and (min-width: 901px)`, not
on width.** Chrome's "Desktop site" toggle makes an Android phone report a ~1024px
viewport, so a `max-width` query sees a laptop and the reel returned on a phone that had
been told to stack. Width describes the window; hover and pointer describe what is holding
the device, and a touchscreen still reports coarse in desktop mode. **Stacked is the
default and the reel is opt-in**, so a browser reporting neither capability gets the
readable layout rather than a rail it cannot drive.

**The JS query must be the exact inverse of the CSS one** (`not all and (hover: hover)
and (pointer: fine) and (min-width: 901px)`). The script writes an inline `--fp-reel-h`
and a transform, and inline styles beat stylesheet rules — if the two drift, the section
grows tall and the rail sits offset over what CSS is rendering as a plain stack.

**The timeline light runs on touch.** They need scroll, not a pointer, and
gating them on pointer type meant a phone got a static list — the timeline light and the
reel are the two effects that carry this page. Only the mouse-linked ones (hero parallax,
magnetic buttons) still bail out on a coarse pointer. The reel's rail needs
`touch-action: pan-y` or it swallows the vertical gesture and appears frozen on a phone.

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

### Homepage "how it runs" (`home-flow.js`)
Four pinned screens showing the platform OPERATING — setup, what is due, evidence being
recorded, the assessment export — on the same scrollytelling engine as the lens strip.
It exists to close a positioning gap: the site explained standards beautifully and then
asked for a subscription, so a visitor concluded it was a book. Content can be
screenshotted; an overdue calendar and accumulated evidence cannot.

**The screens are labelled "Illustrative screens" and must stay labelled.** A homepage
cannot read a visitor's hospital, and figures that look real without saying they are
illustrative would be the kind of quiet dishonesty an accreditation product least affords.
Tests verify every element code shown exists in `nabh-data.js`, and that the dates on the
setup screen match what `calendar/schedule.js` actually computes — otherwise the homepage
would teach a rule the product does not follow.

The hero lead now names the system as well as the explanation. The headline is unchanged;
it is his brand line and it is strong.

### Command bar (`search/command.js`)
Ctrl+K / Cmd+K, or `/` when not already typing. Indexes ~700 items — elements, standards,
chapters, departments, committees, workspace pages — built **lazily on first open** from
datasets the page already loaded, so there is no index to maintain and no cost on first
paint. Inject with `node build/set-command.js`.

### Asset register (`workspace/register.html`, `workspace/register.js`)
**One engine, not ten department modules.** `assets` carries a `kind` — equipment,
licence, contract, credential, reagent, software — so biomedical, facilities, IT, HR,
pharmacy and the lab are all served by one table. Ten department tables would be ten
things to maintain and ten chances to get a hospital's local practice wrong.

Three tables: `assets` (the thing), `asset_schedules` (its calibration / PM / AMC /
renewal cycle), `asset_events` (each time one was performed, with the certificate number
and downtime). **Schedules hang off the asset, not off `compliance_tasks`** — an assessor
asks for the calibration history of a named machine, not of the lab in general.

All due-date maths comes from `calendar/schedule.js`; nothing here does date arithmetic,
so "overdue" is decided in exactly one place platform-wide. Removing an item is a soft
delete (`status='condemned'`) because records logged against a machine taken out of
service must still be produceable. Filters by department and cycle type, which is what
makes it usable by a department head rather than only the quality manager.

### Pinned landing page (`workspace/pin.js`)
Stored in `user_prefs`, **keyed on `auth.uid()` only, never on org** — a landing page is a
personal choice and a colleague has no business reading it. localStorage is a cache, not
the record: the redirect has to fire before the network answers or sign-in feels broken.

Two things that are load-bearing:
- **The redirect runs on `workspace.html` only.** Anywhere else it would fight the
  person's own navigation — clicking Audit and being thrown to the register feels possessed.
- **`?stay=1` defeats it, and the Readiness nav link carries it.** Without an escape hatch
  a pinned page makes the landing page unreachable, because clicking Readiness bounces
  straight back to the pin.

A stored value is validated against `^[a-z0-9-]+\.html$` before being followed, so a
poisoned cache cannot redirect anyone off-site.

### Rounds & checklists (`workspace/rounds.html`, `workspace/rounds.js`)
The third department shape: a recurring check that produces a **score**. Hand hygiene,
cleaning audits, record review, crash cart checks. Distinct from the compliance calendar,
which only asks whether something was done — here the number is the point, because an
assessor asks what the compliance rate is and whether it moved after you found it low.

Scoring is one pure function (`window.AQRounds.score`) so the badge, the trend and the
stored value cannot disagree. Two rules in it are load-bearing:
- **N/A is excluded from the denominator, not counted as a pass.** A crash cart with no
  paediatric drawer should not score 100% for having nothing to check, and should not be
  punished for a drawer it is not required to have.
- **A critical item failing fails the round outright**, whatever the percentage. You
  cannot average away a missing resuscitation drug.

Questions are rows, not a JSON blob, so a round references the exact item it scored and
editing a checklist next quarter cannot rewrite what last quarter was measured against.
Removing a checklist soft-deletes; removing a **question** really deletes, because a
question is not evidence — the round is, and a round stores its own answers.

### Homepage tour (`home-tour.js`)
Eight frames covering every locked page, autoplaying with a progress bar. It exists
because the workspace is behind the paywall and a visitor cannot see what they are being
asked to pay for.

**Sketches, not screenshots, and labelled as such.** Screenshots would show either invented
hospital data as though it were real, or an empty demo account that makes the product look
unused. Autoplay stops permanently once the visitor takes control — resuming after a
manual choice yanks the frame away mid-read. Restarting the progress bar needs
`void bar.offsetWidth` between removing and re-adding the animation; setting the same
value again does nothing and the bar freezes on the second frame.

### Customer data export (`workspace/data-export.js`)
Every org-scoped table in one workbook, plus a JSON copy — Excel is what a quality manager
opens, JSON is what another system imports, and an "export" that only produces a
spreadsheet is not a real answer to a migration question.

A hospital that cannot get its own compliance records out is a hospital that cannot leave,
and an IT review asks this before it asks about features.

Three details worth keeping:
- **The sheet list is data (`SHEETS`), not eight near-identical functions.** A new table is
  one entry and appears automatically instead of being silently left out.
- **One failing table becomes an empty sheet with a note, not an error.** A hospital
  exporting because it is unhappy, or because IT asked, is when a half-failure is least
  forgivable.
- **Ids are resolved to names.** An export full of `chk_m8x2p1` is technically complete and
  practically useless.

Values are written as inline **strings**, including numbers: a reference like `2026-001`
is not a number, and letting Excel decide turns some into dates and others into scientific
notation, silently and differently per locale. Sheet names are trimmed to 31 characters
and stripped of `: \ / ? * [ ]` or the file will not open.

### Department dashboard (`workspace/dashboard.html`)
Everything already in the platform, filtered to ONE department: overdue items from all
three engines merged into one list sorted by lateness, open findings, recent incidents,
and the SOPs that department must hold (scoped from the assessor checklist, not guessed).

**No new tables — this is a view, not a feature**, which is why it was worth building
first. Every other page answers the quality manager's question, "how is the hospital
doing". A department head asks a different one: "what do I have to do". Until they can
answer it in one screen, the quality manager forwards PDFs and the platform has one user
instead of twenty.

Committees appear only in the whole-hospital view — showing every committee to the
pharmacy would bury the four things the pharmacy owns. The chosen department is remembered
per person in `user_prefs`, and a department that no longer exists (a renamed unit) falls
back to the whole hospital rather than showing an empty page that looks broken.

### Notifications (`workspace/bell.js`, `workspace/digest.js`, `api/digest.js`)
Everything else in the workspace waits for someone to open it. The bell is the one piece
that tells them, and it is the difference between owning a calendar and using one.

**`digest.js` is the single source of "what is overdue"**, shared by the bell, the weekly
email and the dashboard. Three implementations would eventually give three answers and the
hospital would act on whichever they opened. `calendar/schedule.js` is now **dual-mode**
(browser global *and* `require`-able) so the serverless function computes dates with the
app's own code.

**The bell works with no mail provider configured** — deliberate: a feature inert until an
API key is added is one nobody sees. The email needs `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY`, `RESEND_API_KEY`, optionally `CRON_SECRET`, and the cron entry
already in `vercel.json` (Mondays 03:00). Until then `/api/digest` reports
`configured:false` rather than failing obscurely.

Two rules that keep it from being switched off: **nobody is emailed to be told nothing is
wrong** (`digest.empty` skips), and `last_sent_on` caps it at one per day — without that
an hourly cron sends twenty-four identical emails. The unseen dot is keyed on *what is
outstanding*, not a timestamp, so dismissing means "seen this" and a new overdue item
brings it back on its own.

### Onboarding (`workspace/onboard.js`)
Six steps on the workspace landing page. **Steps complete by detecting real data**, never
by ticking a box — a checklist completable without doing the work teaches people the
checklist *is* the work, which is the habit this platform argues against. Stored per **org**
so it survives the person who started setup leaving. Disappears once finished or dismissed.

### Attachments (`workspace/attach.js`)
`AQAttach.mount(el, table, id)` on register, CAPA, incidents and rounds. Files live in a
**private** Supabase Storage bucket called `evidence` — **create it manually and keep it
private**. A public bucket would make every hospital's incident photographs and credential
scans readable by anyone who guessed a path.

**Storage RLS is separate from table RLS.** A private bucket stops the anonymous public;
it does NOT stop one signed-in hospital reading another's objects. So the path is
`{org_id}/{table}/{id}/{random}.{ext}` and the `evidence_*` policies in `schema.sql` check
`(storage.foldername(name))[1] = my_org()::text`. `aq_guard_attachment_path` refuses a
metadata row whose path is not in the writer's own org, so a client cannot upload
legitimately and then record a path pointing at another hospital's object.

Links are signed and expire in 120 seconds, requested only on click. The filename is never
the path (two "certificate.pdf" uploads would collide, and a name with a slash would escape
the folder); the original name is kept in the row for display. Accepts PDF, images and
Office documents only, 10 MB — executables and archives are excluded outright.

### Legal pages (`terms.html`, `privacy.html`)
Both already linked from the site footer — they were 404s until now. Drafted to describe
**what the software actually does**, so the claims are checkable: the patient-identifier
exclusion, database-level org isolation, signed short-lived file links, the hospital owning
and being able to export its own data, and the plain statement that AQcredix is not an
accrediting body.

**Unfilled fields are marked `.tofill` and rendered in warning colours**, and each page
carries a visible banner saying it needs review. A policy published with an invented
address is worse than one obviously unfinished. Both need a lawyer familiar with Indian
contract law and the DPDP Act 2023 before they are relied on.

### Material gate pass (`workspace/gatepass.html`, `workspace/gatepass.js`)
Security's own tracking mechanism, modelled directly on the VHS Material Gate Pass form
(VHS/QRF/MAT/01) from the uploaded photograph. Returnable and non-returnable are the two
real states: a non-returnable pass closes the moment it's issued, a returnable one stays
open until someone records it coming back. **No recurrence here** — unlike the calendar
and register, a gate pass is a single event, so status is a plain date comparison, not the
schedule engine.

Pass numbers are sequential and assigned once; `delete row.pass_no` on every edit path
guards against a save silently nulling it out, since a gate pass losing its number defeats
the one thing the paper register was good at. A returnable pass cannot be saved without an
expected return date.

### Document library (`workspace/library.html`, `workspace/library-data.js`)
114 real items — 26 checklists, 63 forms/consents, 25 registers — pulled from the
hospital's own uploaded inventory (`All_Forms_checklist_Registers.xlsx`) and tagged to a
department by keyword heuristics. Browsable by category, then filtered by department;
click through to what each document must contain, why it matters, and a downloadable blank
template.

**Field lists are written from general clinical documentation practice, not transcribed
from any NABH publication** — the same reasoning as `nabh-summary.js`. 10 items carry a
full specification (`detailed:true`); the rest use a generic template for their category
until someone writes the specific one — the same reviewed/unreviewed pattern as the
element summaries.

Downloads are `.xlsx`, generated client-side with the same raw-OOXML approach as
`data-export.js` — no new dependency. A stray header row from the source workbook ("Forms",
"Registers" as literal item names) was caught and stripped during build; a test guards
against it recurring.

### Apex (quality) manual (`workspace/apex.html`, `workspace/apex.js`, `workspace/simple-docx.js`)
Nine guided sections rather than a blank page. **Committees are pulled automatically from
the compliance calendar**, not retyped — typing the same thing twice is how a manual and
a calendar quietly drift apart. Answers autosave (debounced 900ms) to a single row per org
in `apex_manual`.

`simple-docx.js` is a minimal raw-OOXML `.docx` writer (headings, paragraphs, bullets,
2-column tables) built the same way as the xlsx writers — JSZip, no new dependency, and a
genuinely editable Word document rather than a flattened PDF. The download is built from
answers already in memory, never a fresh fetch, so it can never be older than what's on
screen. A multi-line textarea answer becomes a real line break in the document, not a
collapsed run of text.

### Bulk import (`workspace/import.html`, `workspace/import.js`)
The mirror of `data-export.js`, and the highest-value thing for onboarding a real hospital:
forty pieces of equipment entered one modal at a time is the single biggest reason a
platform gets abandoned in week one.

**Previews before it writes, always.** A bad import is worse than no import — a hospital
cannot easily tell which of two hundred rows are the duplicates, and "undo" across four
tables is not a promise to make casually. Every row is validated and shown with its errors;
nothing is written until the person presses Import.

The CSV parser is hand-written rather than pulled in because the one thing that actually
breaks hospital spreadsheets is **a comma inside a quoted description** — a naive split
corrupts exactly those rows, silently. Headers match case- and punctuation-insensitively.
An unknown frequency is rejected rather than accepted, because a row the schedule engine
cannot read would sit on the register and never appear on the calendar. Templates
round-trip: a test imports each generated template and asserts it validates.

### Global search (`workspace/wsearch.js`)
Ctrl/Cmd-K, on every workspace page. Covers standards, the 114-item library, equipment,
obligations, committees, checklists, findings, incidents, gate passes and documents.
Index built **lazily on first open** — nobody should pay nine requests for a search they
may never use. A failing table yields partial results rather than none.

**Element text goes through `AQText.element()`**, the same accessor the pages use, so
search cannot leak wording the site is deliberately withholding — otherwise the copyright
work is undone by the search index.

### Cross-linking rounds to findings
A round below target now offers to raise a CAPA, which stores `capa_id` on the round and
names the round in the finding's root cause — both directions, so the link survives either
being edited. **Offered, not created automatically:** a finding nobody chose to raise is a
finding nobody owns, and an auto-generated CAPA queue is the fastest way to teach a
hospital to ignore its own findings. A failed round with no finding against it says so on
the row, since that is exactly what an assessor looks for.

### Pricing — ₹500/month, ₹5,000/year (introductory)
**One price, no tiers.** Tiering by bed count was considered and dropped: a hospital
declares its own bed count and nothing in the platform can verify it, so a 300-bed hospital
could simply select the small tier. A tier that cannot be enforced does not price by size —
it charges the honest ones more, which is the wrong incentive to build into a compliance
product. If segmentation is wanted later, tier on something the platform can see
(departments configured, accounts in use), never on something the customer asserts.

Launched **deliberately below what the platform is worth**, to find out whether hospitals
use it before finding out what they will pay. That trade has one real cost: raising a price
on someone who signed up early feels like a betrayal unless they were told at the time.

So `introductory: true` drives a notice **above the plans, not under them** — a notice
someone had to scroll past does not count as having been told while deciding. It states the
standard rate (`standardMonthlyInr`, ₹3,999) and that early subscribers keep the current
rate while their subscription runs unbroken. The forwardable approval email carries the
same fact, since that reader holds the budget. **Set `introductory: false` when the price
moves** and the notice disappears on its own rather than becoming a lie left on the page.

The year is priced at exactly ten months. Amounts are in **paise, integers only** — a
float here becomes a rounding error on an invoice. The fallback in `billing.js` matches the
live price, not ₹1: a missing config should never quietly sell a year for a rupee.

**The reader of the paywall is usually not the buyer.** A quality manager will not put
₹3,999/month on a personal card and should not be asked to. The paywall therefore offers a
drafted approval email to forward to whoever signs off spending — written around cost
against what it displaces, not a feature list, because the approver has never seen the
product. Uses `execCommand("copy")` deliberately: this runs on old hospital desktops, and a
copy button that silently fails is worse than a deprecated call that works everywhere.

### Account sharing — devices, not IP addresses
**IP locking was asked for and rejected, and the reason is recorded in `device.js` so it
is not re-attempted.** An Indian mobile carrier puts thousands of subscribers behind one
CGNAT address and rotates a handset's address several times an hour; hospital Wi-Fi
re-leases most mornings. Locking to an IP would throw out a nurse who walked from the ward
to the car park, while two people on the same hospital Wi-Fi would look like one user — it
fails in both directions at once. "PC" also cannot be told from "phone" by IP; that comes
from the user-agent string, which anyone can change in seconds.

`device_sessions` instead: **two active devices per person**, which is a computer and a
phone — the normal working pattern, so it does not obstruct real use. Second device warns
once; third is held with a screen that lists the existing devices and lets one be signed
out. Devices unused for 30 days stop counting, so a replaced laptop does not hold a slot
forever and force a support request.

Three decisions worth keeping:
- **It fails OPEN.** A failed lookup or blocked browser storage lets the customer in. That
  is correct for a licence control and wrong for a security boundary, which is why the file
  says plainly that this **protects revenue, not data**. RLS protects data.
- **A stored random id, not a fingerprint.** Fingerprinting is covert, brittle across
  browser updates, and collects more than a licence check needs.
- **`device_sessions` is keyed on `auth.uid()` only, never org-scoped.** Which devices a
  colleague signs in from is not their employer's business; exposing it would turn a
  licence control into surveillance.

The block screen leads with a remedy, not an accusation — the likeliest person to hit it is
an honest customer who changed laptops — and points at Team, since more accounts is the
real answer.

### Preview instead of a blank wall (`billing/preview.js`)
A locked page that shows nothing cannot sell itself. Gated workspace pages now render with
**sample data from a fictional hospital**, labelled continuously, with a CTA explaining
what changes on subscribing.

**This leaks nothing.** Someone who has not subscribed has no data — their workspace would
be empty even if opened. So the preview cannot expose a hospital's records; there are none.
RLS still protects real data; this changes only what an unsubscribed visitor *sees*.

Pages opt in with `data-preview="dashboard"` etc. on `<body>`. Both gates honour it —
`page-gate.js` for standalone pages, `shell.js` for the workspace, which renders the
preview *above* the paywall. **A pending payment gets no preview**: that person has paid
and is waiting, and a sales page would read as the payment having failed.

One sample hospital is used across every preview so the same defibrillator appears overdue
on the register, in the dashboard and in the finding. A preview where each page invents
unrelated numbers reads as a mock-up.

### `plans.html` — free vs subscription
Free: standards, assessor lens, SOP-by-department, **daily quiz and certificate**, globe,
KPI library. Paid: the whole workspace, unlimited accounts. The annual saving is **computed
from `billing-config.js`**, never typed — a hardcoded figure goes stale the moment a price
changes and then quietly misleads.

### Subscription dates must be exact
`setMonth()` rolls past the end of a short month: **31 January + 1 month landed on 3 March**,
giving free days and displaying a date the subscriber was never charged for. `addMonths()`
in `api/verify-payment.js` clamps to the last valid day (31 Jan → 28 Feb, 31 Aug → 30 Sep).
A test pins all four cases.

Expiry warnings ride along with the weekly digest (3 days ahead) rather than getting their
own job, so they reach someone who never opens the site. An expiry counts against
`empty`, or a hospital with nothing overdue would never be told its access is ending.

### MOM chapter — authored explanations (`mom-explain.js`)
All **68 MOM elements** now carry an explanation written from Dr Santhoshkumar's own
working notes as an ID clinical pharmacist, edited here for grammar and register. This is
original commentary that happens to describe the same requirements — commentary on a
standard is his to write; the standard's own sentences are not.

`NABH_EXPLAIN.explainFor(code, text)` returns the authored version where one exists and
falls back to `simplify()` otherwise. **That fallback is a mechanical rewrite OF the NABH
wording, so it still derives from it** — a stopgap for the other nine chapters, not a
substitute for a professional's own account.

**The plagiarism check is automated** (`tests/mom-explain.test.js`): the build fails if any
explanation shares a seven-word run with the stored NABH text, or if two explanations are
near-copies of each other. Currently the longest overlap anywhere is 6 words. It is a test
rather than a careful read because a careful read is exactly what gets skipped under time
pressure.

### Preview everywhere, not just the workspace
All **paid-gated pages** now declare `data-preview="..."` and render sample content before
asking for money — quiz, KPI library, SOP-by-department, quality tools, videos, standards,
committees, plus the workspace pages. A test fails if any `data-access="paid"` page lacks a
preview, or if a declared preview has no renderer.

**Two bugs found by looking at a real screenshot** rather than trusting the tests:
Code Alerts showed a defibrillator calibration, because it had no preview of its own and
inherited the generic workspace sample — a preview describing a different page is worse
than none. And every preview outside the workspace rendered as bare unstyled text, because
preview markup borrowed `cal-row` from `calendar.css`, which only the workspace loads.
**Preview markup now depends on `styles.css` alone**, and tests enforce both: no gated page
may use the `generic` preview, and every class a preview renders must exist in `styles.css`.

**The quiz is now `data-access="login"`** — free with an account, no subscription. That is
the free tier: create an account, take the daily quiz, earn the certificate.

### The animated reel (`billing/reel.js`)
Each gated page opens with a short auto-playing presentation — three or four scenes with
real motion, showing the problem, the product working on it, and the outcome. It sits
**above** the sample data, because a visitor spends attention in the first seconds and
motion earns it where a table does not.

**Animated SVG and CSS, not video.** Eighteen video files would be a hundred megabytes to
host, unreadable on a slow hospital connection, impossible to correct without re-recording,
and unable to adapt to a phone. This is a few kilobytes, stays sharp at any size, and the
words can be changed in a text editor. The visitor cannot tell; you can, every time you
want to edit one.

Every reel ends on the payoff rather than the mechanism — the last scene is what a visitor
carries into the pricing decision, and a test enforces it. Autoplay stops permanently once
someone takes control, never runs under reduced motion, and pauses off-screen and in
background tabs.

### Free trial — 7 days, and why not 12 hours
A twelve-hour trial ending in an automatic debit **cannot legally be built in India**. The
RBI's *Digital Payments E-mandate Framework, 2026* requires a pre-transaction notification
at least 24 hours before any charge, with an opt-out. A sub-24-hour trial would mean warning
the customer before the trial had begun.

Seven days is also the shortest period in which a hospital can judge this product — a
quality manager has to enter committees, watch the calendar compute dates, and walk one
round before any of it means anything. A trial too short to evaluate does not raise
conversion; it produces cancellations, refund arguments and chargebacks.

**Length lives in `billing-config.js` as `trialDays`** — one edit, and a test asserts the
terms page states the same number the code uses. It has a hard floor: with the notice at
48 hours, a 3-day trial warns about payment on day one, which reads worse than no trial.
Five days is the practical minimum.

`billing/trial.js` sends the notice at **48 hours**, not 24: the legal minimum is a floor,
and 48 survives a weekend or a failed send. `noticeText()` is shared by the banner and the
email so the two cannot disagree about what the customer was told.

### Legal pages — filled
Sole proprietorship, Thoraipakkam Chennai, Chennai jurisdiction, 90-day retention,
**Tokyo region — stated honestly as a cross-border transfer.** Supabase cannot change a
project's region in place; it requires creating a new project and migrating. With two
accounts and almost no data this is the cheapest it will ever be, so it should happen
before any hospital signs up. `privacy.html` says plainly that data is currently outside
India and that migration is planned — updating that sentence is part of the migration, not
something to do in advance. **No refunds once taken**, with an explicit carve-out where
the fault is ours — a blanket refusal that ignores our own failures would not be fair and
would not stand. A test fails if any placeholder returns.

Footer now asserts `© 2026 AQcredix. All rights reserved.` and distinguishes our
commentary from the standards themselves.

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

## Tests — 2322 assertions, plain Node, no install

    node tests/activity.test.js    node tests/sync.test.js
    node tests/profile.test.js     node tests/palette.test.js
    node tests/framing.test.js     node tests/access.test.js
    node tests/auth-errors.test.js  node tests/standards-export.test.js
    node tests/motion.test.js  node tests/calendar.test.js
    node tests/founder.test.js  node tests/lens.test.js
    node tests/home-flow.test.js  node tests/sod.test.js
    node tests/register.test.js  node tests/rounds.test.js
    node tests/export-dash.test.js  node tests/notify.test.js
    node tests/summary.test.js
    node tests/gatepass-library-apex.test.js
    node tests/import-search.test.js
    node tests/mom-explain.test.js

`sync.test.js` is the important one: cross-device persistence against a fake Supabase, plus
direct assertions on the RLS rules. `framing.test.js` locks the camera maths that was got
wrong twice by guessing. The scoring maths and the scope generator still have **no tests**,
and both produce records a hospital may show an assessor.

## Buttons
`.btn` on its own is a complete, themed button — it carries `background:var(--bg-elevated)`
and `color:var(--fg)`. It previously set **no background at all**, so a button written
without a variant rendered as the browser's default white pill: unreadable on a dark
panel, which is what shipped on the 5 Why analyser's Clear button and on eight more across
the workspace. Variants (`btn-accent`, `btn-primary`, `btn-ghost`, `btn-ghost-dark`)
override it. A test fails on any `class="btn"` with no variant.

Convention: `btn-accent` for the primary action, `btn-ghost` for the secondary beside it.

## Cache busting — `node build/set-version.js`
**Every local CSS and JS reference must carry `?v=...`.** Mobile browsers cache these far
longer than desktop, so a returning visitor keeps the old file and a CSS-only fix looks
like it never deployed: the HTML is new, the stylesheet is hours old, the page is
unchanged. That is exactly what happened when the publication reel would not stack on a
phone — `founder.css` was the only file that needed to change and was the one file with
no version on it, while the rest of the site had carried `?v=20260805c` since launch.

`build/set-version.js` stamps every reference in place (803 across 49 pages) and
re-stamps on each run, so this cannot drift again. Run it after any CSS or JS change.
A test in `palette.test.js` fails if any page ships an unversioned local asset.

## Segregation of duties
**A CAPA cannot be verified or closed by the person who raised it.** Enforced by
`aq_guard_capa_closure` in the database, not in the browser — `page-gate.js` controls what
a page displays, so a rule an assessor cares about cannot live there. Authorship is
stamped by trigger from `auth.uid()` on `capa`, `incidents` and `audits`, never trusted
from the client.

Three decisions worth keeping:
- **Only the transition INTO verified/closed is guarded.** Guarding every update would
  make a closed CAPA uneditable by anyone, including to fix a typo.
- **Admins and owners are exempt.** In a small hospital the quality manager who raised the
  finding is sometimes the only person able to verify it, and a rule that cannot be
  satisfied gets worked around rather than followed. The action is still attributed via
  `verified_by` / `closed_by`.
- **The UI shows the control disabled with the reason in its tooltip**, rather than hiding
  it. A missing button reads as a bug; a disabled one teaches the rule before a form is
  filled in. The page check must agree with the database or the user is refused on save.

## Schema ORDER matters
`schema.sql` runs top to bottom in one pass. **Attaching a trigger requires the table to
exist; defining the function does not.** Adding `assets` to the authorship loop while
creating that table further down failed the entire script with
`ERROR: relation "public.assets" does not exist` — and because the file is idempotent and
re-run every session, that breaks *every* migration, not just the new part.

The authorship trigger loop therefore lives at the **end of the file**, after all tables.
A test in `register.test.js` checks every `do`-block loop and every `create trigger`
against the position of its table, so this cannot recur silently.

## Element wording — copyright and accuracy
`nabh-data.js` holds wording close to the published NABH standard. Two problems, and the
second matters more:

1. **Copyright.** It was free to READ on nabh.co, which was never permission to reproduce
   it commercially. NABH has since moved the Hospital, SHCO and Digital Health standards
   behind a paywall (₹6,000 / ₹3,000 / ₹1,000), so the exposure is larger and more likely
   to be enforced. Emails to NABH went unanswered — **silence is not consent.**
2. **Accuracy.** Where that text came from is uncertain. Wording reproduced from memory can
   be subtly wrong — a "shall" for a "should", a dropped clause — and in a product
   hospitals prepare with, wrong standard text is worse than copied standard text.

**A concrete accuracy defect already found.** The published 6th-Edition foreword states
**639** Objective Elements (105 Core, 457 Commitment, 60 Achievement, 17 Excellence). The
stored data has **640** — one extra Commitment element, and the chapter totals place it in
**IPC** (stored 50, published 49). Core, Achievement and Excellence all match exactly.
That single wrong element is precisely the failure mode this section is about: a hospital
could prepare against something that is not in the book. `summary.test.js` records the
discrepancy on every run until IPC is checked against a legitimate copy.

**The fix.** `nabh-summary.js` holds our own plain-English summary per element, and
`window.AQText.element(code, fallback)` returns it **only when `reviewed: true`**,
otherwise the stored wording. That lets migration proceed element by element without the
site breaking, and means an unreviewed draft can never reach a hospital.

**Nothing ships marked reviewed.** That flag is Dr Santhoshkumar's professional judgement
against a copy of the standard he has legitimate access to — a test enforces that the repo
contains no reviewed entries it did not get from him.

`tools/summary-review.html` is the authoring tool: filter by chapter and status, write,
tick reviewed, export a new `nabh-summary.js`. It flags any summary sharing a six-word run
with the stored wording, because a shuffled sentence keeps the exposure and loses the
readability gain. **It is deliberately not linked from any public page** — it shows the
stored wording side by side, which is what we are trying to stop publishing.

Element **codes** (`IPC.2.c`), chapter names and the ten-chapter structure are references
and facts, not protected expression. The assessor-lens, gap and fix content is original
work and unaffected.

## Deploy ritual

After any schema change, re-run `workspace/schema.sql` in the Supabase SQL editor — it is
fully idempotent and ~1144 lines, starting `-- ====`. **Clear the editor with Ctrl+A then
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
5. ~~**No data export**~~ — **done.** `workspace/data-export.js` exports every
   org-scoped table to one workbook, plus a JSON copy.
6. **Repo cleanup** — ten abandoned hero experiments (`galaxy`, `galaxy2`, `brain`, `dna`,
   `helix`, `radar`, `globe`, `hglobe`, `qglobe`, `kpinet`). Only `face/` and `qglobe/`
   are live.
7. ~~**Role enforcement is thin**~~ — **fixed.** See "Segregation of duties" below.
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
