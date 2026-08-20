/* Rasterise the Open Graph share card to assets/og.png.
 *
 *   node build/make-og.js
 *
 * WHY HEADLESS CHROME AND NOT A LIBRARY. This repo has no build step and no node_modules,
 * deliberately — it is static files that Vercel serves as-is. Adding playwright or sharp
 * to produce one image a quarter would mean an install step for anyone who clones it, so
 * the card is laid out in build/og-card.html and rendered by the Chrome that is already
 * on the machine. Nothing to install, nothing to keep in step.
 *
 * WHY A PNG AT ALL. WhatsApp will not render an SVG preview, and WhatsApp is where a
 * hospital link is actually forwarded — a quality manager sends it to the medical
 * director, who sends it to whoever signs off spending. A bare grey URL loses that
 * reader before the site is ever opened. 1200x630 is the size Facebook, LinkedIn,
 * WhatsApp and X all crop from cleanly.
 *
 * If Chrome is somewhere else, pass the path:
 *   node build/make-og.js "C:\\path\\to\\chrome.exe"
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CARD = path.join(__dirname, "og-card.html");
const OUT = path.join(ROOT, "assets", "og.png");

const CANDIDATES = [
  process.argv[2],
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA,
    "Google\\Chrome\\Application\\chrome.exe"),
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
].filter(Boolean);

const chrome = CANDIDATES.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });

if (!chrome) {
  console.error("No Chrome or Edge found. Pass the path:\n" +
                '  node build/make-og.js "C:\\path\\to\\chrome.exe"');
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });

/* --screenshot writes to the CURRENT WORKING DIRECTORY when given a bare name, and
   silently ignores some absolute paths on Windows, so the flag is given the full path in
   the =value form which it does honour. --hide-scrollbars matters: without it Chrome
   reserves scrollbar width and the card renders 1185px wide with a grey stripe. */
execFileSync(chrome, [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--default-background-color=00000000",
  "--window-size=1200,630",
  "--screenshot=" + OUT,
  "file:///" + CARD.replace(/\\/g, "/")
], { stdio: ["ignore", "ignore", "pipe"] });

if (!fs.existsSync(OUT)) {
  console.error("Chrome ran but produced no file at " + OUT);
  process.exit(1);
}

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log("Wrote assets/og.png (" + kb + " KB) using " + path.basename(chrome));
