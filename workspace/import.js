/* AQcredix Workspace — bulk import.
 *
 * The mirror of data-export.js. Onboarding a real hospital means entering forty pieces of
 * equipment or a hundred recurring obligations, and doing that one modal at a time is the
 * single biggest reason a platform gets abandoned in week one.
 *
 * DESIGN DECISION THAT MATTERS: this previews before it writes. A bad import is far worse
 * than no import — a hospital cannot easily tell which of two hundred rows are the
 * duplicates, and "undo" across four tables is not something to promise casually. So every
 * row is validated, shown with its errors, and nothing is written until the person has
 * seen what will happen.
 */
window.AQImport = (function () {
  "use strict";

  var S = window.AQStore, W = window.AQWorkspace, K = window.AQSchedule;

  /* Each importable type declares its columns. `required` is what makes a row usable at
     all; everything else is optional. Header matching is case- and space-insensitive
     because a hospital's spreadsheet will not match our capitalisation and refusing it on
     that basis would be pedantry. */
  var TYPES = {
    assets: {
      label: "Equipment & licences",
      table: "assets",
      help: "One row per item. A cycle can be attached in the same row — leave the cycle " +
            "columns blank for items you only want on the register.",
      cols: [
        ["name", "Name", true],
        ["kind", "Type", false, "equipment"],
        ["identifier", "Serial / number", false],
        ["department", "Department", false],
        ["location", "Location", false],
        ["manufacturer", "Manufacturer", false],
        ["model", "Model", false],
        ["owner", "Responsible person", false],
        ["element_code", "NABH element", false],
        ["cycle_kind", "Cycle type", false],
        ["cycle_frequency", "Cycle frequency", false],
        ["cycle_last_done", "Last done (YYYY-MM-DD)", false],
        ["cycle_vendor", "Vendor", false]
      ]
    },
    compliance_tasks: {
      label: "Recurring obligations",
      table: "compliance_tasks",
      help: "Drills, audits, training, surveillance — anything on a cycle.",
      cols: [
        ["title", "Task", true],
        ["frequency", "Frequency", true],
        ["category", "Category", false],
        ["department", "Department", false],
        ["owner", "Owner", false],
        ["last_done_on", "Last done (YYYY-MM-DD)", false],
        ["element_code", "NABH element", false]
      ]
    },
    committees: {
      label: "Committees",
      table: "committees",
      cols: [
        ["name", "Committee", true],
        ["frequency", "Frequency", true],
        ["short_name", "Short name", false],
        ["chairperson", "Chairperson", false],
        ["secretary", "Convener", false],
        ["last_met_on", "Last met (YYYY-MM-DD)", false]
      ]
    },
    members: {
      label: "Team members",
      table: "members",
      help: "Invites are not sent by import — this creates the seat and the person signs " +
            "in with the same email.",
      cols: [
        ["email", "Email", true],
        ["name", "Name", false],
        ["role", "Role", false, "viewer"],
        ["department", "Department", false]
      ]
    }
  };

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /* --------------------------------- parsing --------------------------------- */

  /* CSV with quoted fields. Written out rather than pulled in because the one thing that
     actually breaks hospital spreadsheets is a comma inside a quoted description, and a
     naive split on "," corrupts exactly those rows silently. */
  function parseCSV(text) {
    var rows = [], row = [], cur = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }

  async function parseFile(file) {
    var name = String(file.name || "").toLowerCase();
    if (/\.csv$/.test(name)) {
      return parseCSV(await file.text());
    }
    if (!window.XLSX) {
      throw new Error("The spreadsheet reader is still loading — wait a moment and try again.");
    }
    var buf = await file.arrayBuffer();
    var wb = window.XLSX.read(buf, { type: "array" });
    var sheet = wb.Sheets[wb.SheetNames[0]];
    return window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" })
      .filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }

  /* ------------------------------- validating ------------------------------- */

  function mapHeaders(spec, header) {
    var map = {};
    header.forEach(function (h, i) {
      var n = norm(h);
      spec.cols.forEach(function (c) {
        if (norm(c[1]) === n || norm(c[0]) === n) map[c[0]] = i;
      });
    });
    return map;
  }

  function validate(typeKey, rows) {
    var spec = TYPES[typeKey];
    if (!rows.length) return { error: "That file has no rows." };

    var header = rows[0];
    var map = mapHeaders(spec, header);

    var missing = spec.cols.filter(function (c) { return c[2] && map[c[0]] === undefined; });
    if (missing.length) {
      return { error: "Missing required column" + (missing.length > 1 ? "s" : "") + ": " +
                      missing.map(function (c) { return c[1]; }).join(", ") +
                      ". Download the template to see the expected headers." };
    }

    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var raw = rows[r];
      var rec = {}, errs = [];

      spec.cols.forEach(function (c) {
        var idx = map[c[0]];
        var v = idx === undefined ? "" : String(raw[idx] == null ? "" : raw[idx]).trim();
        if (!v && c[3]) v = c[3];
        if (!v && c[2]) errs.push(c[1] + " is required");
        rec[c[0]] = v;
      });

      /* A frequency the schedule engine does not know would create a row that never
         appears on the calendar — present on the register, invisible where it matters.
         Better to refuse it at the door. */
      ["frequency", "cycle_frequency"].forEach(function (f) {
        if (rec[f] && K && K.all && K.all().indexOf(rec[f]) < 0) {
          var guess = K.all().filter(function (x) { return norm(x) === norm(rec[f]); })[0];
          if (guess) rec[f] = guess;
          else errs.push('"' + rec[f] + '" is not a frequency we recognise (' +
                         K.all().slice(0, 4).join(", ") + "…)");
        }
      });

      ["last_done_on", "cycle_last_done", "last_met_on"].forEach(function (f) {
        if (rec[f] && !/^\d{4}-\d{2}-\d{2}$/.test(rec[f])) {
          errs.push(c2label(spec, f) + " must be YYYY-MM-DD");
        }
      });

      if (rec.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) {
        errs.push("Email does not look valid");
      }

      out.push({ line: r + 1, rec: rec, errs: errs });
    }
    return { rows: out, spec: spec };
  }

  function c2label(spec, key) {
    var c = spec.cols.filter(function (x) { return x[0] === key; })[0];
    return c ? c[1] : key;
  }

  /* -------------------------------- writing -------------------------------- */

  function id(p) {
    return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function commit(typeKey, rows, onProgress) {
    var spec = TYPES[typeKey];
    var good = rows.filter(function (r) { return !r.errs.length; });
    var written = 0, failed = 0;

    for (var i = 0; i < good.length; i++) {
      var rec = good[i].rec;
      try {
        if (typeKey === "assets") {
          var assetId = id("asset");
          await S.adapter.upsert("assets", {
            id: assetId, name: rec.name, kind: rec.kind || "equipment",
            identifier: rec.identifier || null, department: rec.department || null,
            location: rec.location || null, manufacturer: rec.manufacturer || null,
            model: rec.model || null, owner: rec.owner || null,
            element_code: rec.element_code || null, status: "active",
            updated_at: new Date().toISOString()
          });
          /* The cycle is only created when the row actually describes one. Writing an
             empty schedule would put the item on the calendar with no due date, which
             reads as a bug rather than as "no cycle yet". */
          if (rec.cycle_frequency) {
            await S.adapter.upsert("asset_schedules", {
              id: id("sched"), asset_id: assetId,
              kind: rec.cycle_kind || "calibration",
              frequency: rec.cycle_frequency,
              last_done_on: rec.cycle_last_done || null,
              vendor: rec.cycle_vendor || null, active: true,
              updated_at: new Date().toISOString()
            });
          }
        } else if (typeKey === "members") {
          await S.adapter.upsert("members", {
            id: id("mem"), email: rec.email.toLowerCase(), name: rec.name || null,
            role: rec.role || "viewer", department: rec.department || null,
            status: "active", updated_at: new Date().toISOString()
          });
        } else {
          var row = { id: id(typeKey.slice(0, 4)), updated_at: new Date().toISOString() };
          spec.cols.forEach(function (c) {
            if (c[0].indexOf("cycle_") === 0) return;
            row[c[0]] = rec[c[0]] || null;
          });
          if (typeKey === "compliance_tasks" || typeKey === "committees") row.active = true;
          await S.adapter.upsert(spec.table, row);
        }
        written++;
      } catch (e) {
        failed++;
      }
      if (onProgress) onProgress(i + 1, good.length);
    }
    return { written: written, failed: failed, skipped: rows.length - good.length };
  }

  /* ------------------------------- template ------------------------------- */

  function templateCSV(typeKey) {
    var spec = TYPES[typeKey];
    var header = spec.cols.map(function (c) { return c[1]; }).join(",");
    var example = spec.cols.map(function (c) {
      if (c[0] === "name") return "Defibrillator — ICU bed 4";
      if (c[0] === "title") return "Fire drill / mock evacuation";
      if (c[0] === "email") return "name@hospital.org";
      if (c[0] === "frequency" || c[0] === "cycle_frequency") return "yearly";
      if (c[0] === "kind") return "equipment";
      if (c[0] === "cycle_kind") return "calibration";
      if (c[0] === "department") return "Biomedical";
      if (/last_done|last_met/.test(c[0])) return "2025-06-15";
      if (c[0] === "identifier") return "ZOLL-R-88213";
      if (c[0] === "element_code") return "FMS.4.a";
      return "";
    }).join(",");
    return header + "\n" + example + "\n";
  }

  function downloadTemplate(typeKey) {
    var blob = new Blob([templateCSV(typeKey)], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "AQcredix_" + typeKey + "_template.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }

  return {
    TYPES: TYPES,
    parseFile: parseFile,
    parseCSV: parseCSV,
    validate: validate,
    commit: commit,
    templateCSV: templateCSV,
    downloadTemplate: downloadTemplate,
    mapHeaders: mapHeaders
  };
})();
