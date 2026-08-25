# AQcredix — handover

Paste this whole file into a new chat to pick up where the last one left off.

**Repo:** `C:\Users\sgsan\OneDrive\Desktop\SGS\AQcredix`
**Chain:** GitHub `sgsanthoshkumar18-maker/Accrediq` → Vercel → Supabase
**Owner:** Dr S. G. Santhoshkumar, sole proprietor, aqcredix.com

---

## House rules that keep being relearned

- **Static site. No framework, no build step, no `node_modules`.** Deliberate. Don't add a
  dependency to solve something sixty lines of vanilla JS can do — the AWS SDK was avoided
  this way in `api/video-url.js`.
- **Secrets go only into Vercel environment variables.** Never into the repo, never into
  chat. A live Resend key was once pasted into a conversation and had to be revoked.
- **Tests:** `node tests/<name>.test.js`, no framework. All 31 suites must pass.
  There is no `npm test` script.
- **`vercel.json` is `additionalProperties: false`** — no comments allowed in it.
- **Bulk email must use Bcc, never To.** A To-line leak is DPDP-reportable.
- **Owner-only API routes return 404, not 403**, so the route's existence stays hidden.

## Traps that have cost real time

- **`requestAnimationFrame` and CSS transitions are paused in a hidden tab.** Any browser
  measurement of an animated value will read the *start* value forever. Measure with
  `MutationObserver`, `setTimeout`, or by reading layout values (`offsetTop`).
- **A hidden pane returns STALE computed styles.** After changing `data-palette` on a live
  page, `getComputedStyle` on elements that already existed keeps handing back the OLD
  values — mixed, so `background-color` updates while `border-color` does not. This cost
  hours: it looked exactly like a cascade defect, and the tell that it was not is that an
  **inline style also failed to win with no `!important` anywhere**, which cannot happen in
  real CSS. To verify a palette, create a fresh element with the class, read it, remove it —
  a new node has no cached style. Or reload the page.
- **`transform` does not affect layout.** A scroll-reveal that hasn't run displaces an
  element visually by 26px while its layout box is already correct. Measure `offsetTop`,
  not `getBoundingClientRect()`, when checking alignment.
- **`Object.assign` copies `undefined` over a default** instead of skipping it. This shipped
  a caption that never appeared, twice, because the logo is a separate element and kept
  working — so the overlay *looked* alive. `tests/overlay.test.js` now guards it.
- **`exitFullscreen()` then `requestFullscreen()` does not work.** The first is async and the
  user gesture expires before the second runs. Request the new element directly.
- **Shell escaping mangles `\n`, `\d`, `\s` in heredocs.** Use the Edit tool or line-based
  node scripts for anything with regexes.
- **Windows: `path.join` gives backslashes**; a forward-slash root fails `startsWith`.
- **RUN `node build/set-version.js` AFTER ANY CSS OR JS CHANGE, BEFORE PUSHING.** Mobile
  browsers hold cached CSS far harder than desktop, so a fix looks like it never deployed —
  which is exactly what happened with the fullscreen frame. The stamp had been stuck at
  `20260824i` through a dozen changes. The default now continues the sequence; it used to
  reset to "a" and could hand back a URL a phone already had cached.
- **Vercel Hobby allows 12 Serverless Functions per deployment.** api/ is AT the limit. A
  thirteenth `.js` file there fails the BUILD — the site keeps serving the last good
  version and silently stops updating. Put new server logic in a module outside api/ and
  dispatch to it from an existing endpoint (`workspace/crashcart-alert.js` does this).
  Cron paths are not functions; 100 are allowed.
- **Cron jobs do not follow redirects.** The catch-all that sends accrediq.vercel.app to
  aqcredix.com used to match /api/* too, so a cron would get a 308, finish having done
  nothing, and show a green tick. The redirect now excludes /api/ via
  `/:path((?!api/).*)`. Note the destination token must exist as a named group in the
  source, or the path is dropped.
- **Vercel invokes crons with GET, not POST.** `api/digest.js` was POST-only, so every
  scheduled digest since the cron was added answered 405 and no email was ever sent — while
  testing it by hand with POST worked perfectly. `tests/deploy-limits.test.js` guards both.

---

## Where the video work got to

The John Felix video plays on `videos.html`, in the **Documentation / "Show me the record"**
card — *not* the featured slot.

- Source `JOHN FELIX.MOV` is 263MB **HEVC 4K**, which Chrome on Windows and Firefox cannot
  play. Converted with ffmpeg to `videos/media/john-felix-web.mp4` — H.264, 1080p, 41MB,
  `faststart`. **`videos/media/` is git-ignored**; a video must never enter the repo.
- Hosted in **Cloudflare R2**, private bucket `aqcredix-videos`. Zero egress fees, 10GB free.
- `api/video-url.js` checks access then signs a URL that expires in two hours. SigV4 is
  hand-rolled with `node:crypto` and **verified against Amazon's published test vector** in
  `tests/video-url.test.js`.
- Access order: owner (`OWNER_EMAIL`) → `complimentary_access` table → `has_access()` RPC.
  A *failed* check returns 503, never 403 — telling a paying customer to pay again is the
  worst possible failure mode, and the first version did exactly that.
- `videos/overlay.js` + `overlay.css` draw the logo bug and the speaker lower-third.
  `videos/player.js` + `player.css` fetch the link, mount the video, and own fullscreen.

**Vercel env vars required:** `R2_ACCOUNT_ID` (`29abccd656b29b5cd5edc1074992b6d3`),
`R2_BUCKET` (`aqcredix-videos`), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`SUPABASE_ANON_KEY`, plus the existing `SUPABASE_URL`, service key, `OWNER_EMAIL`.
All **Production only**.

### Speakers currently captioned

Featured slot — `john-felix-web.mp4`:
> **Dr. John Felix S.N. Pharm D., RPh. (AMSP Certified)**
> Ex - Clinical Pharmacologist, Aster DM Healthcare and MIOT Hospital
> Currently a PhD Scholar, JSS AHER

Medication card — `high-alert-drugs.mp4` ("High alert drugs: the look-alike, sound-alike trap"):
> **Dr. Bala Krishnan Pharm D., RPh.**
> Ex - Clinical Pharmacologist, Madras Medical Mission and Rela Hospital
> Currently a PhD Scholar, JSS AHER

Both say **Clinical Pharmacologist** at the owner's instruction, though LinkedIn shows
"Clinical Pharmacist" for some of these posts. The generic role references in
`department-data.js`, `mom-explain.js` and the value pages were deliberately NOT changed —
those describe the hospital role, and the two are different professions.

Shown between **0:03 and 0:09 of the video itself**, not on a timer — it holds while paused,
vanishes if you scrub past, returns if you scrub back. Below a 480px frame the two role
lines hide and only the name shows, because at thumbnail size the caption covered 52% of
the picture. Non-breaking spaces bind "Pharm D." and "AMSP Certified" so a line never
breaks mid-qualification.

Going fullscreen **re-syncs but does not replay** the caption. An earlier build restarted it
on entering fullscreen and that read as yet another caption arriving unbidden. If you want
the credentials visible at any point in the video, the answer is burning them into the file
with ffmpeg — which is also the only fix for iPhone fullscreen.

---

## Three palettes: default, neon, blood

`data-palette` on `<html>`. Absent = default. The owner publishes one for **everyone** via
`site_settings`; subscribers only ever choose light or dark.

- **Type the word** to set it: `neon`, `blood`, `dark`. Typing the palette already showing
  turns it off back to default. It SETS rather than cycles — with three palettes a toggle
  means the word you type no longer tells you what you get.
- `?neon=1` / `?blood=1` / `?blood=0` also work, owner only.
- **BLOOD** is now the bioluminescent medical-tech theme (the name is kept because it is the
  word the owner types and the value every test and the `site_settings` row already holds —
  renaming it would churn the plumbing for nothing). Neon cyan `#36CFDB` on a near-black
  `#10110E`, with blue, violet, orange, red and gold in a fixed 70/15/7/5/3 budget.
- **The glow IS the theme.** Flat bright colour on dark is precisely what this is not. Every
  accent carries a layered bloom from the `--glow-*` / `--text-glow-*` tokens; a single
  box-shadow is not a bloom. Surfaces are glass — `rgba(28,25,32,.72)` over a
  `backdrop-filter` — not solid cards, and the body is three radial light sources over the
  black rather than a flat fill.
- **Four spec colours fail AA as small text** — red 3.9:1, violet 3.9, magenta 4.3, muted 4.3.
  Each has a lifted `*-text` sibling (`--red-text:#D56D63`, `--violet-text:#9B81BF`,
  `--magenta-text:#C37588`, `--blue-text:#3E97B8`, `--fg-faint:#878C95`) bound to text,
  while the raw spec value still does the work in fills, borders, glows and charts. On a
  platform where red means NON-CONFORMITY, the most important label must not be the least
  readable thing on the page. `tests/palette.test.js` fails if these are "tidied" back.
- **Red stays reserved.** `--nc` means non-conformity and is never the decorative accent,
  which is why the accent is cyan and not red.

### The cascade trap — read this before adding a fourth palette

`:root[data-theme="dark"]:not([data-palette="neon"])` is **(0,3,0)**;
`:root[data-palette="blood"]` is **(0,2,0)**. Naming neon there let the dark block outrank
blood wherever it sat in the file — blood's backgrounds applied while its accents silently
stayed indigo. The half-applied look, from the same cause, one palette later; the file's own
comment had warned about it. It is now `:not([data-palette])` — any palette, so a fourth
cannot repeat it. `tests/palette.test.js` asserts both halves.

### Scene colours

`theme/scene-palette.js`, loaded immediately before `app.js` on all 61 pages. A canvas cannot
inherit a CSS variable, so the palette is handed to it. Every lookup takes the scene's
original value as a fallback — `P.accent(0x5eead4)` — so a page without the module renders
exactly as it always did. Wired into face, brain, dna, galaxy, helix, radar and qglobe.
`app.js` fires an `aq:palette` event on change so a scene can re-tint without a reload.

### Adding a surface

Every `:root[data-palette="neon"]` rule has a `blood` twin, so blood starts from a complete
set and the blood block at the end of styles.css overrides only what carries a literal teal
or navy. If you add a neon rule, add its blood twin, or the test's coverage check fails.

---

## Short expiry calendar (crash carts)

`workspace/crashcart.html` + `crashcart.js`, rule in `workspace/shortexpiry.js`, alert in
`workspace/crashcart-alert.js` reached via `/api/digest?scope=crashcart`, a **weekly** cron, Mondays 02:00 UTC (07:30 IST). It is a module rather than its own api/ route because of the 12-function
limit above.

- The rule module is **shared by the screen and the email** — required by both, never copied,
  so they cannot disagree about which ampoules are short.
- The window is **"at most N months of shelf life left"**, not "expiring in the Nth month".
  Asked for as "in August, alert me about November"; read literally that skips a September
  expiry, which is nearer and worse. The report is grouped by month so the N-months-out
  cohort still appears under its own heading. **If the narrow reading was actually wanted,
  it is one line in `classify()`.**
- **Expired is a separate state from short**, and is said first. An expired drug in a resus
  trolley is an incident, not a reorder.
- A pack printed `11/2026` is usable to **30 November**, not the 1st.
- Policy is 3 or 6 months, per hospital. Anything else falls back to 3 — never quietly laxer.
- After a code blue: pick the cart, tick the items used, give the replacement expiry. The
  item row is updated in place and the event is logged with both dates, because "why did
  this expiry change" is a question an assessor asks.
- A copy of every alert goes to `CRASH_ALERT_TO` / `SUPPORT_TO` / support.aqcredix@gmail.com,
  alongside the hospital's own contacts, de-duplicated on the normalised address. Set
  `CRASH_ALERT_TO=off` to stop it — **revisit this once there are real subscribers**, as it
  puts every hospital's crash cart contents in one shared inbox.
- **One row per BATCH.** Several rows sharing name+strength are one item; shortexpiry.js
  judges each batch separately, which is what short expiry means to a pharmacist.
- **"Was the crash cart opened?"** replaces the code-blue-only flow. Reason is Code Blue or
  Other; Other asks for the reason and whether anything was used. A drill that takes nothing
  is still recorded and the stock is untouched.
- **The restock is a real stock adjustment**: the used quantity comes off its batch (the row
  is removed if the batch is finished), the replacement is added as its own batch, merged if
  that exact batch+expiry is already there. The register is therefore always what is in the
  trolley now, and the export never needs reconciling against the log.
- **Tag/seal numbers** are optional on the cart, pre-filled as "tag broken" when a cart is
  opened, and the new seal becomes the cart tag.
- **Excel export** (`workspace/crashcart-excel.js`, raw OOXML through JSZip, same approach as
  `audit/audit-excel.js`): two sheets per cart — contents, then openings — in that order, for
  all carts or a chosen subset. Sheet names are de-duplicated, capped at 31 characters and
  stripped of the characters Excel refuses; the cart name is shortened BEFORE " openings" is
  appended so the word always survives on a long ward name.
- Tables: `crash_carts`, `crash_cart_items`, `crash_cart_settings`, `code_blue_events` —
  all with `set_org_id()` triggers and the standard my_org() + has_access() policies.
  **The schema block must be run in Supabase before the page will save anything** — and there
  is now a SECOND block further down the file adding `tag_number`, `reason`, `other_reason`,
  `items_used_flag`, `tag_before` and `tag_after`. Both are needed.

## Open items

1. **Never tested against live R2.** Nobody has pressed play on the deployed site with the
   real keys. This is the first thing to check.
   *(Both videos are now uploaded to the bucket; only playback remains unverified.)*
2. **Real fullscreen and phone rotation are unverified.** The code paths are tested; no
   device has run them.
3. **iPhone cannot show the overlay in fullscreen.** Safari hands fullscreen to the OS
   player. The only real fix is burning the caption into the file with ffmpeg — see below.
4. **The card's title is fictional.** *"Show me the record" / Documentation* was placeholder
   copy for an imaginary video. Nobody has said what this video is actually about.
5. **Five placeholder cards remain** on `videos.html` with play buttons that do nothing.
6. **Schema may not be fully applied.** If `has_access()` is missing from the database, the
   subscription path 503s (owner and complimentary still work). Run the block from
   `-- ONE HOSPITAL, FIFTEEN ACCOUNTS` to the end of `workspace/schema.sql`.
7. ~~A real Razorpay payment has never been completed.~~ **DONE — 22 Aug 2026, first paying
   subscriber. Payment captured, subscription written, access granted. The whole chain
   (Razorpay → api/verify-payment.js → Supabase → paywall) is proven in production.**
8. **0 of 639 NABH summaries written** — the owner is writing these.
9. **The crash cart schema has not been run in Supabase.** Until it is, the page loads but saves nothing.
10. **Untick Preview** on `RAZORPAY_KEY_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.

## Recent decisions worth not re-litigating

- **Pricing:** ₹500/month or ₹5,000/year per hospital, up to **15 accounts**. Exactly two
  master roles (Quality Manager, Director) see every department; enforced by unique partial
  indexes, not by the browser.
- **Cross-hospital isolation** is enforced by 39 RLS policies keyed on `my_org()`. This was
  called a legal risk by the owner and must not be weakened.
- **A team seat can only be created for an email that already has an account**
  (`api/account-exists.js`). Creating one for a stranger saved a row, said "Saved", and did
  nothing — the colleague was never let in and nobody found out for weeks.
- **"Enter your hospital"** was removed from the main nav: three words in a full bar wrapped
  onto three lines. It is now a hero button on the home page, a header button above 1360px
  (measured: it needs a 1319px viewport or the page scrolls sideways), and a menu item below
  980px.
- **The hero 3D canvas is held to a square above 900px.** It used to stretch to the text
  column's height, so adding one button changed its aspect to 0.87 and the tuned camera
  distance of 3.4 started cutting the organs. Framing is computed from the canvas, never
  from `window.innerWidth`, and a `ResizeObserver` re-frames on any box change.
