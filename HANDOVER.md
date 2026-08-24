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
- **Tests:** `node tests/<name>.test.js`, no framework. All 29 suites must pass.
  There is no `npm test` script.
- **`vercel.json` is `additionalProperties: false`** — no comments allowed in it.
- **Bulk email must use Bcc, never To.** A To-line leak is DPDP-reportable.
- **Owner-only API routes return 404, not 403**, so the route's existence stays hidden.

## Traps that have cost real time

- **`requestAnimationFrame` and CSS transitions are paused in a hidden tab.** Any browser
  measurement of an animated value will read the *start* value forever. Measure with
  `MutationObserver`, `setTimeout`, or by reading layout values (`offsetTop`).
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

### Caption text currently on screen

> **Dr. John Felix S.N. Pharm D., RPh. (AMSP Certified)**
> Ex - Clinical Pharmacologist, Aster DM Healthcare and MIOT Hospital
> Currently a PhD Scholar, JSS AHER

Appears at 3s, leaves at 9s. Below a 480px frame the two role lines hide and only the name
shows, because at thumbnail size the caption was covering 52% of the picture.

---

## Open items

1. **Never tested against live R2.** Nobody has pressed play on the deployed site with the
   real keys. This is the first thing to check.
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
7. **A real ₹500 Razorpay payment from a non-owner email has never been completed.**
8. **0 of 639 NABH summaries written** — the owner is writing these.
9. **Untick Preview** on `RAZORPAY_KEY_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.

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
