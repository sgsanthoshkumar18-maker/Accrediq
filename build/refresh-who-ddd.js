/* AQcredix — refresh WHO DDD values against the ATC/DDD Index.
 *
 * Run once a year (each January, after the WHO Collaborating Centre publishes
 * that year's update), or whenever a bulletin lists a change:
 *
 *     node build/refresh-who-ddd.js
 *
 * For every drug in workspace/amsp-drugs.js with an `atc` code, the script
 * fetches the corresponding page on https://atcddd.fhi.no/atc_ddd_index/,
 * parses the DDD table, and prints a coloured diff of the parenteral DDD it
 * found against the value currently stored in the catalogue. Nothing is
 * written to disk — the maintainer reads the diff, edits amsp-drugs.js by
 * hand where a value changed, and updates WHO_VERIFIED at the top of the same
 * file to today's date.
 *
 * Manual, on purpose. WHO's HTML is human-readable and the parser is a small
 * regex over a table; it will break every few years when the site design
 * changes. A quiet cron overwriting values with junk on the day that happens
 * would be worse than a page that stays a month out of date. Keeping the
 * final commit in a person's hands makes the fault mode a diff you can read,
 * not a value you cannot trace.
 *
 * Requires Node 18+ (built-in fetch). No install step.
 *
 * FLAGS:
 *   --drug=<id>   Refresh a single drug from the catalogue (by id).
 *   --slow=<ms>   Delay between requests (default 900 ms, kind to the server).
 *   --raw         Also print the raw fetched DDD row per drug, for debugging.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

/* --------------------------- args ---------------------------- */
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find(a => a.startsWith("--" + name + "=") || a === "--" + name);
  if (!hit) return fallback;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};
const ONE = flag("drug");
const SLOW_MS = Math.max(200, parseInt(flag("slow", "900"), 10) || 900);
const RAW = !!flag("raw");

/* --------------------------- load catalogue ---------------------------- */
const CATALOGUE_PATH = path.join(__dirname, "..", "workspace", "amsp-drugs.js");
const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(fs.readFileSync(CATALOGUE_PATH, "utf8"), sb);
const DRUGS = sb.window.AMSP_DRUGS || [];
const WHO_META = sb.window.AMSP_WHO || {};

if (!DRUGS.length) {
  console.error("No drugs loaded from " + CATALOGUE_PATH);
  process.exit(2);
}

/* --------------------------- ANSI helpers ---------------------------- */
const supportsColour = !!process.stdout.isTTY;
const ansi = (n, s) => (supportsColour ? "\x1b[" + n + "m" + s + "\x1b[0m" : s);
const GREEN  = s => ansi(32, s);
const RED    = s => ansi(31, s);
const YELLOW = s => ansi(33, s);
const DIM    = s => ansi(90, s);
const BOLD   = s => ansi(1,  s);

/* --------------------------- WHO scraper ---------------------------- */
const BASE = "https://atcddd.fhi.no/atc_ddd_index/";

function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}
/* Order matters: strip tags, decode entities (so &nbsp; becomes a space),
 * THEN collapse whitespace and trim. Doing the entity decode last leaves a
 * trailing space on cells like "J01DH02&nbsp;" and the equality check fails. */
function stripTags(s) {
  const noTags = String(s || "").replace(/<[^>]+>/g, "");
  return decodeEntities(noTags).replace(/\s+/g, " ").trim();
}

async function fetchAtc(atc) {
  const url = BASE + "?code=" + encodeURIComponent(atc) + "&showdescription=no";
  const res = await fetch(url, {
    headers: {
      "user-agent": "AQcredix-refresh-who-ddd/1.0 (+contact via github.com/sgsanthoshkumar18-maker/Accrediq)",
      "accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const html = await res.text();
  return { url, html };
}

/* Locate the DDD table on the returned page. WHO's markup uses <table> with
 * one row per (substance, route) whose cells are:
 *   ATC | Name | DDD | U (unit) | Adm.R (route) | Note
 * The script hunts for a row containing the target ATC code and extracts the
 * DDD / unit / route from that row. If more than one route is listed
 * (parenteral + oral, say), the maintainer's `whoRoute` preference wins. */
function findDddRow(html, atc, wantRoute) {
  /* Grab every <tr> block for tolerance across small tag-attribute changes. */
  const rows = [];
  const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const inner = m[0];
    if (!inner.toUpperCase().includes(atc.toUpperCase())) continue;
    const cells = [];
    const tdRe = /<t[dh]\b[\s\S]*?<\/t[dh]>/gi;
    let c;
    while ((c = tdRe.exec(inner)) !== null) cells.push(stripTags(c[0]));
    /* Expected shape: [ATC, Name, DDD, U, Adm.R, ...] with the ATC in cell 0. */
    if (cells.length >= 5 && cells[0].toUpperCase() === atc.toUpperCase()) {
      const ddd = parseFloat(cells[2]);
      if (isFinite(ddd)) {
        rows.push({
          atc: cells[0], name: cells[1], ddd: ddd, unit: cells[3], route: cells[4],
          raw: cells,
        });
      }
    }
  }
  if (!rows.length) return null;
  /* Route preference: caller passes "P", "O", "R", etc. — the letters WHO
   * uses (P = parenteral, O = oral, R = rectal, N = nasal, SL = sublingual). */
  if (wantRoute) {
    const match = rows.filter(r => (r.route || "").toUpperCase().startsWith(wantRoute.toUpperCase()));
    if (match.length) return match[0];
  }
  return rows[0];
}

/* --------------------------- run ---------------------------- */
function normaliseUnit(u) {
  const t = String(u || "").trim().toUpperCase();
  if (t === "G") return "g";
  if (t === "MG") return "mg";
  if (t === "MIU" || t === "MU" || t === "IU") return u.trim();
  return u.trim();
}
/* Reduce (value, unit) to a canonical (grams, "g") pair when both sides are
 * mass-based so a WHO "50 mg" and a local "0.05 g" register as unchanged
 * rather than as a mismatch. Volume-based / activity-based units (MIU, MU)
 * pass through untouched. */
function toGrams(value, unit) {
  const u = String(unit || "").trim().toLowerCase();
  if (u === "g")  return { value: +value, unit: "g" };
  if (u === "mg") return { value: +value / 1000, unit: "g" };
  return { value: +value, unit: unit };
}

async function main() {
  const target = ONE
    ? DRUGS.filter(d => d.id === ONE)
    : DRUGS.filter(d => d.atc);
  if (!target.length) {
    console.error("No drugs to check" + (ONE ? " (unknown id: " + ONE + ")" : "") + ".");
    process.exit(2);
  }
  console.log(BOLD("WHO ATC/DDD refresh") + "  ·  " + target.length + " drug"
    + (target.length === 1 ? "" : "s") + "  ·  catalogue verified: "
    + (WHO_META.verified || "—"));
  console.log(DIM("Fetching each drug from " + BASE + " with a " + SLOW_MS + " ms delay."));
  console.log();

  const changes = [];
  const errors = [];

  for (let i = 0; i < target.length; i++) {
    const d = target[i];
    const tag = ("[" + (i + 1) + "/" + target.length + "] ").padStart(9, " ");
    process.stdout.write(tag + BOLD(d.name.padEnd(30, " ")) + "  " + DIM("ATC " + d.atc));
    try {
      const { html } = await fetchAtc(d.atc);
      const found = findDddRow(html, d.atc, d.whoRoute || "P");
      if (!found) {
        console.log("  " + YELLOW("no matching row"));
        errors.push({ drug: d, error: "no matching row on WHO page" });
      } else {
        /* Compare after unit-normalising: 50 mg from WHO and 0.05 g in the
         * catalogue are the same reference and should not read as a change. */
        const whoG = toGrams(found.ddd, found.unit);
        const localG = toGrams(d.whoDdd, d.unit);
        const same = whoG.unit === localG.unit
          && Math.abs(whoG.value - localG.value) < 1e-9;
        if (same) {
          console.log("  " + GREEN("unchanged (" + d.whoDdd + " " + d.unit + ")"));
        } else {
          console.log("  " + RED("CHANGE") + "  local " + d.whoDdd + " " + d.unit +
            "  →  WHO " + found.ddd + " " + normaliseUnit(found.unit) +
            "  " + DIM("[" + found.route + "]"));
          changes.push({ drug: d, whoDdd: found.ddd, whoUnit: normaliseUnit(found.unit), whoRoute: found.route });
        }
        if (RAW) console.log(DIM("        raw: " + JSON.stringify(found.raw)));
      }
    } catch (err) {
      console.log("  " + RED("fetch failed: " + err.message));
      errors.push({ drug: d, error: err.message });
    }
    if (i < target.length - 1) await new Promise(r => setTimeout(r, SLOW_MS));
  }

  console.log();
  if (!changes.length && !errors.length) {
    console.log(GREEN(BOLD("All " + target.length + " drugs match the WHO ATC/DDD Index.")));
    console.log("If today's your annual review, update WHO_VERIFIED in workspace/amsp-drugs.js to today's date and commit.");
    return;
  }
  if (changes.length) {
    console.log(BOLD("Suggested edits") + "  ·  " + changes.length + " drug" + (changes.length === 1 ? "" : "s") + " differ from WHO:");
    changes.forEach(c => {
      console.log("  " + BOLD(c.drug.name) + "  (id: " + c.drug.id + ", ATC " + c.drug.atc + ")");
      console.log("    whoDdd: " + RED(String(c.drug.whoDdd)) + "  →  " + GREEN(String(c.whoDdd)) +
        "     unit: " + c.whoUnit + "     route: " + c.whoRoute);
    });
    console.log();
    console.log("Edit workspace/amsp-drugs.js by hand — the script does not write. Update WHO_VERIFIED once every drug has been reviewed.");
  }
  if (errors.length) {
    console.log();
    console.log(YELLOW(BOLD("Could not verify " + errors.length + " drug" + (errors.length === 1 ? "" : "s") + ":")));
    errors.forEach(e => {
      console.log("  " + e.drug.name + "  —  " + e.error);
      console.log("    Check manually: " + BASE + "?code=" + e.drug.atc);
    });
  }
}

main().catch(err => {
  console.error("Fatal:", err && err.stack || err);
  process.exit(2);
});
