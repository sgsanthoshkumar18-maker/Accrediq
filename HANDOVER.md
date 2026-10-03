# AQcredix — handover

Written for a fresh Claude session with no history of this project. Everything below was
verified against the repo on 3 October 2026, not recalled.

---

## 1. What this is

**AQcredix** is a NABH hospital-accreditation platform at **aqcredix.com**, built and owned by
**Dr Santhoshkumar SG** (Pharm.D., RPh — founder, and the person you are working for).

| | |
|---|---|
| Working directory | `C:\Users\sgsan\Desktop\SGS\AQcredix` |
| Remote | `https://github.com/sgsanthoshkumar18-maker/Accrediq.git` |
| Branch | `main` — pushed straight to it, no PR flow |
| Host | Vercel, auto-deploys on push to `main` |
| Platform | Windows 11. PowerShell is primary; a Bash tool is also available |

**Stack: static HTML, CSS and JS. No framework, no bundler, no build step.** Pages are plain
`.html` files that link plain `.css` and `.js`. Do not introduce React, a bundler, or a
package manager step — nothing in the deploy pipeline would run it.

Data is **Supabase**, talked to over **raw `fetch` against PostgREST**. There is no Supabase
SDK and no npm dependency for it. Anonymous access goes through `security definer` Postgres
functions, never through table policies — see `workspace/schema.sql`.

---

## 2. Hard rules — these break the site, not just a feature

### 2.1 Twelve serverless functions, and not one more

`api/` currently holds **exactly 12 `.js` files, which is the Vercel Hobby plan's hard cap.**
The project is sitting at the limit right now.

A thirteenth file in `api/` does not fail that one route — **it fails the entire build**, so
the last good deployment stays live and the site silently stops receiving anything new. This
has already cost one broken deploy.

The fix is never to delete a feature. Put the logic in a module **outside** `api/` and dispatch
to it from an existing endpoint. `tests/deploy-limits.test.js` enforces this and will fail if
you add one.

### 2.2 Stamp the version before every commit

```bash
node build/set-version.js
```

Every local CSS and JS reference carries a `?v=` stamp, and **they must all share one stamp.**
Mobile browsers cache CSS and JS far more aggressively than desktop, so without a new stamp a
returning visitor keeps the old file and a CSS-only fix looks like it never deployed. That
exact thing happened once with `founder.css`.

The script re-stamps everything in place on each run. A test enforces that the stamps agree, so
forgetting it fails the suite.

### 2.3 Run the tests, and *read the result*, before pushing

```bash
node --test "tests/*.test.js"
```

**47 test files, all currently passing.** Plain Node, no framework, nothing to install.

Read the actual output. Do not chain the command onto a `grep` and treat a match as success —
I did that once, the grep matched regardless of the failure, and a red suite got pushed.

### 2.4 Actually push

Work is not delivered until `git push origin main` has run and you have seen the ref update.
Five commits once sat unpushed while the user looked at an unchanged site and reasonably
concluded nothing had been built.

---

## 3. House style

The user cares about this, so it is worth stating.

**Commit messages are prose, not changelogs.** They explain what was wrong, why the obvious fix
does not work, and what was done instead. Look at `git log` before writing one. Example subject
lines from this repo: *"He looks at whichever side you are reading, and waves when you click
him"*, *"Take the jerk out of the turn"*, *"Close the tab mid-quiz and your questions are still
there"*.

**Comments explain the trap, not the syntax.** The codebase is full of comments naming the
specific bug a line prevents. Preserve them — several tests deliberately strip comments before
matching, precisely because the comments mention the bug names the tests search for.

**Tests are written as guards against a specific regression**, with failure messages that say
what will visibly break. Match that style.

**Measure before concluding.** The user has been burned by confident guesses. On anything
visual or geometric, verify empirically — render the frames, measure the pixels, print the
numbers — rather than reasoning about which sign or direction is correct. Two separate bugs in
this project came from assuming a direction and being wrong.

Append this to commits:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## 4. Verifying in a browser

`.claude/launch.json` defines a dev server. Start it with the preview tool using the name
`aqcredix` (it runs `node build/serve.js 5599`). **Never start a dev server with a raw Bash
command.**

**Important gotcha:** the in-app browser pane often runs with a zero-height viewport and
frozen `requestAnimationFrame`. When that happens you will see a 1×1 canvas, paused videos and
`innerHeight: 0` — these are artifacts of the pane, not bugs. `ResizeObserver` callbacks do not
fire there at all. Work around it by setting an explicit viewport and dispatching a `resize`
event, then verify through `read_page` / JS evaluation rather than screenshots.

Autoplay is also blocked in that context, so video-driven features need their state machines
verified by instrumenting `play()` calls rather than by watching.

---

## 5. What shipped most recently

Last five commits, newest first:

- `fe3cd9c` — the founder hero: head turns left/right by cursor side, wave on click
- `cf0a6ac` — stripped the failed cursor-tracking hero back to idle + click-to-wave
- `e53aba6` — fixed the globe's misplaced capitals, plus four founder-hero bugs
- `8527454`, `22916c1` — earlier iterations of the hero

Before that: sitewide glassmorphism, a Slido-style live group quiz, a 5 Why Analyser in the
workspace, multi-select delete across records, and homepage KPI graph editing.

### 5.1 The founder hero (`founder.html`, `profile/hero-video.js`)

The most intricate thing in the repo, and it took several failed attempts, so here is what was
learned.

**It is built from three AI-generated clips made from ONE reference image.** That shared
reference is the whole trick. Measured on the encoded files, a rest frame from one clip differs
from a rest frame of another by *about as much as two rest frames inside a single clip* — so
cutting between them costs no more than an ordinary cut. An earlier attempt used clips
generated independently; the room came out different (a wall picture was 281px wide in one and
536px in the other) and they could not be cut together at all.

**The turns are the returns, played backwards.** Each source clip runs
`rest → turn → hold → return → rest`. Cutting the turn out of the *front* does not work:
early in each clip he settles his hands into a different resting posture and stays there, so
the frame the turn starts from sits ~17 ordinary frame-steps from the idle pose — a visible
jump of his hands. The tail does not have that problem. So `turn-right.mp4` is the right clip's
return reversed, and `back-right.mp4` is that same run forwards. They are exact mirrors, so
coming back lands precisely where he started.

**The idle is a ping-pong** — the same frames forwards then backwards — so its loop cannot have
a seam. (A test asserts an odd frame count, which is the signature of that build.)

**Everything draws to one canvas.** Cross-fading stacked `<video>` opacity shows the page
through the middle of the blend, which reads as a black flash. Also never use
`getContext("2d", {alpha:false})` — it starts the canvas solid black.

**Known trap:** setting `video.currentTime = 0` starts a seek that drops `readyState` below 2.
Any code that then waits for `loadeddata` waits forever, because that event already fired during
preload and never fires twice. This made the greeting play through to the end with audio and no
picture. Switch unconditionally.

Assets live in `profile/hero/` — 7 files, 1.1MB total, with a 4MB ceiling enforced by test.
Source clips are in `portfolio videos/`.

**Cursor behaviour:** only which *side* of him the cursor falls on is read. Vertical position is
deliberately ignored — he looks at the column of copy on that side and holds. `clientY` must
never be read (a test enforces this). A dead band at his centre stops flip-flopping, and a
movement is never interrupted halfway.

### 5.2 The globe (`hglobe/`)

Capitals appeared on the wrong continents. The data and the projection were both correct; the
bug was one line of culling: `p.z > 1` is a *frustum* test, and the globe sits wholly inside the
frustum so it never fired once. All 74 hotspots stayed visible, and a far-side capital projects
onto the *mirrored* point of the disc. Replaced with a horizon test against the surface normal.
`tests/globe-capitals.test.js` guards it.

---

## 6. Outstanding

- **Dead code, offered several times, never answered:** `profile/founder.css` and
  `tests/founder-hero.test.js` cover the old cut-out hero and are no longer used. Ask before
  deleting.
- **Supabase custom domain** — needs the user's Pro plan plus DNS. Their call, not a code task.
- **Uncommitted right now, and not from the hero work:** `package.json` has gained a
  `docx: ^9.8.0` dependency, and `resume_build/` (a `build_resume.js` and a resume `.docx`) is
  untracked. This belongs to a separate resume-building effort. **Confirm with the user before
  committing or removing it** — adding an npm dependency to a repo with no build step deserves a
  question.

---

## 7. Separate work, unrelated to this repo

The user's memory directory records a second workstream: editing the **VHS Hospital Formulary**
`.docx`. It has its own established toolchain (notably: no Python and no zip utilities on this
machine). If that comes up, read those memory files first rather than improvising.

---

## 8. Quick start for the next session

```bash
cd /c/Users/sgsan/Desktop/SGS/AQcredix
git log --oneline -10
node --test "tests/*.test.js"
```

Then before any push:

```bash
node build/set-version.js
node --test "tests/*.test.js"
git add -A && git commit && git push origin main
```
