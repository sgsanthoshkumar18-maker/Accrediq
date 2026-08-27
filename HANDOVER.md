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

## Three themes: Clinical Light, blue (dark), neon

These are the only three, and the list is deliberately closed.

`data-theme` carries light/dark. `data-palette` carries neon; absent means the plain blue
dark theme. The owner publishes the palette for **everyone** via `site_settings`;
subscribers only ever choose light or dark for themselves.

| What the owner calls it | How it is expressed |
|---|---|
| **Light** | `data-theme` absent |
| **Blue** | `data-theme="dark"`, no `data-palette` — indigo `#4F46E5` on `#0A0D1E` |
| **Neon** | `data-theme="dark"` + `data-palette="neon"` — teal `#5EEAD4` |

- **Type the word** to switch: `neon` or `dark`. Typing the palette already showing turns
  it off back to default. It SETS rather than cycles.
- `?neon=1` / `?neon=0` also work, owner only.
- The shipped default is **neon**. Falling back to "default" made the site open blue on a
  cold load and only turn neon once `site_settings` had been fetched, which looked like
  needing two or three refreshes.

### Phantom CSS tokens — the bug class that hid the quiz question

A component stylesheet can be written against token names this site does not define. The
undefined ones silently fall back to their hardcoded literal while the defined ones follow
the theme, so the component ends up half-themed — and nothing errors.

`quiz/quiz.css` used `--card` and `--muted`, which exist nowhere, alongside `--fg` and
`--bg`, which do. The card stayed frozen at its dark fallback while the text went black:
**the question stem was invisible on the light theme.** Same fault in three other files.
Fixed by mapping every one onto a real token:

    --card -> --bg-elevated    --muted -> --fg-muted
    --accent-tint -> --accent-bright-tint    --bg-deep-1 -> --deep-1   (a typo)

**To find them again:** list the names `styles.css` defines, then scan every `.css` file
for `var(--name)` not in that set. Most survivors are legitimate — set at runtime by JS
(`--pct`, `--vp-arn`, `--aq-delay`) or defined locally in their own file (`--aud-*`).

**Check the inline copy too.** `quiz.html` inlines a duplicate of its critical CSS on
purpose (external stylesheets have failed from cache twice). It carried the same faults,
and being inline it won — fixing only the stylesheet would have changed nothing on screen.

### The dark ("blue") theme was missing every semantic COLOUR

Separate, worse, and it predates the Clinical Light work. `:root[data-theme="dark"]`
defined `--ok-tint`, `--warn-tint`, `--nc-tint` and `--info-tint` but never `--ok`,
`--warn`, `--nc` or `--info` — so all four fell through to the LIGHT values and rendered
dark green, brown, dark red and indigo on a near-black ground:

    --ok 2.96:1    --warn 3.13:1    --nc 2.67:1    --info 2.63:1

Every status chip, KPI figure and toast in that theme was effectively unreadable. Now
`#34D399 / #FBBF24 / #FF6B8A / #A5B4FC`, all above 6.5:1. **Never add a tint without its
colour** — the tint being present is what made this look handled.

### Clinical Light — the light theme, and why the 3D scenes sit on dark panels

The light theme is **Clinical Light**: cool paper `#F5F8FA`, ink `#0E1621`, two blues
(`--brand-2 #0F3E68` for primary actions, `--accent-bright #17558C` for accents and links).
It replaced a warm-paper/teal scheme in August 2026. Neon is the dark theme.

**The accent is blue because the other colours are spoken for.** Green means compliant,
amber partial, red non-conformity. Spend green on the brand and a compliant chip stops
reading as a status. Blue/indigo/violet/slate is what remains, and the accent deliberately
carries no semantic weight.

**Three tokens exist because "the accent is bright" stopped being true.**
`--on-accent`, `--on-brand` and `--deep-accent`. Light's accent is DARK, so filled buttons
take white text; neon's is bright teal, so they take near-black. The old code hardcoded
`#04241F` on `var(--accent-bright)`, which measured **2.13:1** against the new blue — a real
regression, found by probing computed values, not by looking. `--deep-accent` exists
because `--accent-bright` is tuned against PAPER and is far too dark to glow on a navy
surface, so deep surfaces get a lifted member of the same hue family.

Glows now derive with `color-mix(in srgb, var(--token) N%, transparent)` instead of literal
rgba. That is deliberate: "a rule re-tinted for one theme and forgotten for another" is the
most repeated bug in this stylesheet, and a derived value cannot have it.

#### The 3D scenes: dark stages, not light scenes

All twelve WebGL scenes draw with `THREE.AdditiveBlending`. Additive blending ADDS to what
is behind it, so **over white it saturates to white and the artwork disappears entirely** —
not dimmed, gone. Making them genuinely light-mode means switching every material to
`NormalBlending` AND regenerating the glow sprite textures, whose colour is baked in at
creation: twelve files of high-risk change for something no test can verify.

So in the light theme every canvas wrapper gets a **dark stage** — see
`3D SCENES IN THE LIGHT THEME` in styles.css. This is not a workaround; the light theme
already rendered its hero as a deep panel through `--deep-1`/`--deep-2` with the organ
scene on it. The rule extends that established pattern to the other nine canvases.

Two things make it read as designed rather than pasted on: the ground comes from the
theme's own deep tokens (navy, not a foreign black), and the border, radius and shadow are
the same card treatment used everywhere else. Navy is also the hue that bridges the teal
artwork and the blue UI.

**A second reason it is right:** the overlay UI inside those wrappers — `.hg-loading`,
`.gx-tooltip`, `.hg-zoom-controls` — is hardcoded for a dark canvas (white text, `#5eead4`
spinners). On the *old* light theme those already rendered badly. The stage fixed a bug
that predates the change.

The nine staged wrappers are `.gx-wrap .hg-globe-wrap .qg-globe-wrap .kn-wrap .dna-wrap
.brain-wrap .radar-canvas-wrap .helix-canvas-wrap .ent-globe-wrap`. Four of those are
injected by JS and never appear in the static HTML — find them via `stage.querySelector`
in the scene files, not by grepping the pages. `.face-wrap` is deliberately absent: it
lives inside `.hero`, which is already a deep panel.

**Known limitation.** Scenes read their colours once at construction and none subscribe to
`onChange`, so toggling the theme re-tints the CSS instantly but the 3D artwork keeps its
colours **until the next page load**. Acceptable because almost nobody toggles — visitors
land in whatever is published. Fixing it means giving each scene a re-tint path, which
differs per scene.

### A fourth palette was built and then removed — read this before adding another

Three colour schemes were built on `data-palette="blood"` over one week (a circulatory
red/gold, a bioluminescent cyan, an arterial red, then a black-and-purple) and the whole
thing was removed on 25 August 2026. **The site is back to light / blue / neon and should
stay there unless there is a real reason.**

What the removal cost, so the next person can price it honestly:

- **251 rules in `styles.css`**, but almost none of them were standalone. 91 of the 92
  references were *twinned* — the palette shared a selector list with neon, e.g.
  `:root[data-palette="neon"] .tile,\n:root[data-palette="blood"] .tile{...}`. Unpicking
  those means editing the selector list and keeping the neon half; deleting the rule
  removes a neon surface with it. **Zero rules were blood-only.**
- A first pass at this quietly did nothing to 65 of them, because it matched only lines
  *ending* in `{` and every one-liner is `selector{decls}`. Check the count, not the exit
  code.
- `app.js` (5 places), `theme/scene-palette.js` (a whole families block), the boot snippet
  in **all 65 HTML files**, and 54 test assertions.
- **Migration is free and already done.** The boot snippet now reads
  `if(q!=="default"){q="neon";}`, so a device whose `localStorage` still holds the old
  value resolves to neon by itself, and `loadSitePalette` coerces a `site_settings` row
  still naming it to neon too. No cleanup step, no stranded phones.
- The `site_settings` row may still literally say the old palette name. It is inert.

**`blood` also means blood.** `grep -ri blood` hits Blood Transfusion Committee, Blood
Bank, blood gas analyser and blood component wastage across `committee-data.js`,
`area-data.js`, `department-data.js`, `dashboard.html` and the audit engine. That is real
NABH content. Never remove a palette with an untargeted grep.

### The cascade trap — read this before adding a palette

`:root[data-theme="dark"]:not([data-palette="neon"])` is **(0,3,0)**;
`:root[data-palette="x"]` is **(0,2,0)**. Naming neon there let the dark block outrank any
other palette wherever it sat in the file — its backgrounds applied while its accents
silently stayed indigo. It is now `:not([data-palette])` — any palette. That selector is
kept even though neon is alone again, because it costs nothing and it is what stops the
next one repeating this. `tests/palette.test.js` asserts both halves.

### Verifying a palette when you cannot see it

This pane does not composite, so screenshots are unavailable, and `getComputedStyle`
returns **stale** values for elements that existed before `data-palette` changed — readings
can lag a full step behind, which looks exactly like a cascade bug. Two reliable methods:

- **Fresh element**: create a node with the class, read it, remove it. A new node has no
  cached style.
- **CSSOM walk**: iterate `document.styleSheets` and inspect `selectorText`. Not subject to
  computed-style staleness — this is what proved the removal was complete.

Check the rule count is non-zero before trusting either. A walk that runs before the sheets
are reachable returns a confident, meaningless zero.

### Scene colours

`theme/scene-palette.js`, loaded immediately before `app.js` on all 65 pages. A canvas cannot
inherit a CSS variable, so the palette is handed to it. Every lookup takes the scene's
original as a fallback, so a scene on a page without the module still works.

Nothing overrides the chapter, category or cycle colours any more — the removed palette was
the only thing that did — so those three hand the fallback straight back. They are kept
rather than deleted because every scene calls them, and because that is where a future
palette would hook in. `app.js` fires an `aq:palette` event on change so a scene can
re-tint without a reload.

### Adding a surface

Add the `:root[data-palette="neon"]` rule and the `:root[data-theme="dark"]` one. Both, or
the surface is right in one theme and wrong in the other — which is exactly how the site
ended up with indigo patches under neon.


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
