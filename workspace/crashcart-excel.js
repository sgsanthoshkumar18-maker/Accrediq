/* AQcredix — the crash cart register as a real Excel workbook.
 *
 * TWO SHEETS PER TROLLEY, IN ORDER: the cart, then what happened to it.
 * A hospital hands this to an assessor who reads one trolley at a time: what is in it, then
 * every time it was opened and what changed. Putting all carts on one sheet and all events
 * on another would be tidier to build and useless to read — the assessor would be scrolling
 * between two places to answer a question about one trolley.
 *
 * RAW OOXML THROUGH JSZip, the same approach as audit/audit-excel.js and standards-excel.js.
 * No spreadsheet library: the page already loads JSZip, and a genuine .xlsx a pharmacist can
 * sort and filter is worth more than a flattened PDF they would have to retype.
 *
 * THE STOCK SHOWN IS THE STOCK NOW.
 * After a cart is opened and restocked, the item rows already carry the replacement batches
 * — the used ones were decremented or removed at the time. So this sheet is never a history
 * that needs reconciling against the events sheet; it is what is in the trolley today, and
 * the events sheet says how it got that way.
 */
window.AQCrashCartExcel = (function () {
  "use strict";

  var E = window.AQShortExpiry;

  function xmlEsc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }

  function colName(n) {
    var s = "";
    while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
    return s;
  }

  /* ---------------- styling ----------------
     Deliberately few: a title, a column header, a section band, an ordinary cell, and three
     states. A workbook where everything is coloured tells the reader nothing about where to
     look, which is the whole point of colouring anything. */
  var FILLS = [
    { key: "title",   bg: "FF0B4F45", fg: "FFFFFFFF", bold: true,  size: 14 },
    { key: "head",    bg: "FF0E7C6B", fg: "FFFFFFFF", bold: true },
    { key: "band",    bg: "FFDCEBE6", fg: "FF0B4F45", bold: true },
    { key: "expired", bg: "FFFEE4E2", fg: "FFB42318", bold: true },
    { key: "short",   bg: "FFFEF0C7", fg: "FF93370D", bold: false },
    { key: "ok",      bg: "FFECFDF3", fg: "FF027A48", bold: false },
    { key: "muted",   bg: "FFF7F8FA", fg: "FF667085", bold: false }
  ];
  var XF = { plain: 0 };
  FILLS.forEach(function (f, i) { XF[f.key] = i + 1; });
  XF.wrap = FILLS.length + 1;

  function buildStyles() {
    var fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'];
    var fills = ['<fill><patternFill patternType="none"/></fill>',
                 '<fill><patternFill patternType="gray125"/></fill>'];
    FILLS.forEach(function (f) {
      fonts.push('<font><sz val="' + (f.size || 11) + '"/><name val="Calibri"/>' +
        (f.bold ? "<b/>" : "") + '<color rgb="' + f.fg + '"/></font>');
      fills.push('<fill><patternFill patternType="solid"><fgColor rgb="' + f.bg +
        '"/><bgColor indexed="64"/></patternFill></fill>');
    });
    var xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1">' +
               '<alignment vertical="top" wrapText="1"/></xf>'];
    FILLS.forEach(function (f, i) {
      xfs.push('<xf numFmtId="0" fontId="' + (i + 1) + '" fillId="' + (i + 2) +
        '" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
        '<alignment vertical="center" wrapText="1"/></xf>');
    });
    xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" ' +
             'applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + fonts.length + '">' + fonts.join("") + "</fonts>" +
      '<fills count="' + fills.length + '">' + fills.join("") + "</fills>" +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left style="thin"><color rgb="FFD8E0E6"/></left>' +
      '<right style="thin"><color rgb="FFD8E0E6"/></right>' +
      '<top style="thin"><color rgb="FFD8E0E6"/></top>' +
      '<bottom style="thin"><color rgb="FFD8E0E6"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join("") + "</cellXfs>" +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>";
  }

  function cell(col, row, v, style, isNum) {
    var ref = colName(col) + row;
    var s = style ? ' s="' + style + '"' : "";
    if (v == null || v === "") return '<c r="' + ref + '"' + s + "/>";
    if (isNum && isFinite(v)) return '<c r="' + ref + '"' + s + "><v>" + v + "</v></c>";
    return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' +
           xmlEsc(v) + "</t></is></c>";
  }

  function sheetXml(rows, opts) {
    opts = opts || {};
    var body = rows.map(function (r, i) {
      var n = i + 1;
      var cells = r.map(function (c, j) {
        if (c && typeof c === "object") return cell(j + 1, n, c.v, c.s, c.n);
        return cell(j + 1, n, c, XF.plain);
      }).join("");
      return '<row r="' + n + '">' + cells + "</row>";
    }).join("");
    var cols = "";
    if (opts.widths) {
      cols = "<cols>" + opts.widths.map(function (w, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      }).join("") + "</cols>";
    }
    /* The header row is frozen so a long register still says what each column is when the
       reader is forty rows down. */
    var freeze = opts.freeze
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + opts.freeze +
        '" topLeftCell="A' + (opts.freeze + 1) + '" activePane="bottomLeft" state="frozen"/>' +
        "</sheetView></sheetViews>"
      : "";
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      freeze + cols + "<sheetData>" + body + "</sheetData></worksheet>";
  }

  function T(v) { return { v: v, s: XF.title }; }
  function H(v) { return { v: v, s: XF.head }; }
  function B(v) { return { v: v, s: XF.band }; }
  function M(v) { return { v: v, s: XF.muted }; }
  function N(v) { return { v: v, s: XF.plain, n: true }; }

  function dmy(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : String(iso || "");
  }

  /* Excel refuses these characters in a sheet name and truncates past 31. Names are also
     de-duplicated: two wards can genuinely be called "ICU", and a workbook with two sheets
     of the same name will not open at all. */
  function safeName(name, used) {
    var s = String(name || "Sheet").replace(/[\[\]\*\?\/\\:]/g, " ").trim().slice(0, 28) || "Sheet";
    var out = s, n = 2;
    while (used[out.toLowerCase()]) { out = s.slice(0, 28 - String(n).length - 1) + " " + n; n++; }
    used[out.toLowerCase()] = true;
    return out;
  }

  /* ---------------- the cart sheet ---------------- */
  function cartSheet(cart, items, months, today) {
    var rows = [];
    rows.push([T("CRASH CART REGISTER"), T(""), T(""), T(""), T(""), T("")]);
    rows.push([B("Crash cart"), cart.name || "", B("Department"), cart.department || "",
               B("Tag number"), cart.tag_number || "—"]);
    rows.push([B("Short expiry policy"), months + " months",
               B("Report date"), dmy(today), B("Items"), String(items.length)]);
    rows.push([]);

    rows.push([H("Item"), H("Strength / form"), H("Batch"), H("Quantity"),
               H("Expiry"), H("Status")]);

    /* Grouped by item, batches beneath it, soonest expiry first — the order somebody
       standing at the trolley works in. */
    var groups = {}, order = [];
    items.forEach(function (i) {
      var k = (i.name || "") + "|" + (i.strength || "");
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(i);
    });
    order.sort();
    order.forEach(function (k) {
      var batches = groups[k].slice().sort(function (a, b) {
        return String(a.expires_on) < String(b.expires_on) ? -1 : 1;
      });
      batches.forEach(function (i, n) {
        var c = E.classify(i, { today: today, months: months });
        var style = c.state === "expired" ? XF.expired : c.state === "short" ? XF.short : XF.ok;
        var label = c.state === "expired" ? "EXPIRED" : c.state === "short" ? "Short expiry"
                  : c.state === "unknown" ? "No expiry recorded" : "In date";
        rows.push([
          n === 0 ? (i.name || "") : { v: "", s: XF.plain },   // name once per item
          n === 0 ? (i.strength || "") : "",
          i.batch || "—",
          N(Number(i.quantity) || 0),
          dmy(c.expiry || i.expires_on),
          { v: label, s: style }
        ]);
      });
    });
    if (!items.length) rows.push([M("No items recorded in this cart."), "", "", "", "", ""]);

    return sheetXml(rows, { widths: [30, 20, 18, 11, 14, 18], freeze: 5 });
  }

  /* ---------------- the events sheet ---------------- */
  function eventSheet(cart, events) {
    var rows = [];
    rows.push([T("CART OPENING RECORD"), T(""), T(""), T(""), T(""), T(""), T(""), T("")]);
    rows.push([B("Crash cart"), cart.name || "", B("Department"), cart.department || "",
               B("Current tag"), cart.tag_number || "—", B("Openings"), String(events.length)]);
    rows.push([]);

    rows.push([H("Date"), H("Reason"), H("Tag broken"), H("Tag replaced"),
               H("Item used"), H("Batch used"), H("Qty used"), H("Replaced with")]);

    events.slice().sort(function (a, b) {
      return String(a.happened_on) < String(b.happened_on) ? 1 : -1;   // newest first
    }).forEach(function (ev) {
      var reason = ev.reason === "other"
        ? "Other — " + (ev.other_reason || "not stated")
        : "Code Blue event";
      var used = Array.isArray(ev.items_used) ? ev.items_used : [];

      if (!used.length) {
        rows.push([dmy(ev.happened_on), reason, ev.tag_before || "—", ev.tag_after || "—",
                   M("No items taken"), "", "", ""]);
      } else {
        used.forEach(function (u, n) {
          var repl = u.new_batch
            ? "Batch " + u.new_batch + ", expires " + dmy(u.new_expiry) +
              (u.new_qty ? " (" + u.new_qty + ")" : "")
            : "not replaced";
          rows.push([
            n === 0 ? dmy(ev.happened_on) : "",
            n === 0 ? reason : "",
            n === 0 ? (ev.tag_before || "—") : "",
            n === 0 ? (ev.tag_after || "—") : "",
            u.name || "",
            (u.old_batch || "—") + (u.old_expiry ? " · exp " + dmy(u.old_expiry) : ""),
            N(Number(u.qty) || 0),
            repl
          ]);
        });
      }
      if (ev.notes) rows.push(["", M("Note: " + ev.notes), "", "", "", "", "", ""]);
    });

    if (!events.length) {
      rows.push([M("This cart has not been recorded as opened."), "", "", "", "", "", "", ""]);
    }
    return sheetXml(rows, { widths: [13, 30, 14, 14, 26, 26, 10, 32], freeze: 4 });
  }

  /* ---------------- package ---------------- */
  async function build(carts, items, events, opts) {
    if (!window.JSZip) {
      throw new Error("The spreadsheet library has not finished loading — wait a moment and try again.");
    }
    var o = opts || {};
    var today = o.today || new Date().toISOString().slice(0, 10);
    var months = E.normaliseMonths(o.months);

    var used = {};
    var sheets = [];
    carts.forEach(function (c) {
      var mine = items.filter(function (i) { return i.cart_id === c.id; });
      var evs = events.filter(function (e) { return e.cart_id === c.id; });
      sheets.push({ name: safeName(c.name, used), xml: cartSheet(c, mine, months, today) });
      /* The cart name is shortened BEFORE " openings" is added, not after. Appending first
         and truncating to 31 afterwards ate the word itself on a long ward name — leaving
         two nearly identical tabs with no way to tell which was the register and which was
         the log. The word survives; the name is what gives. */
      var stem = String(c.name || "Cart").slice(0, 18).trim();
      sheets.push({ name: safeName(stem + " openings", used), xml: eventSheet(c, evs) });
    });

    var zip = new window.JSZip();
    zip.file("[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map(function (s, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join("") +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      "</Types>");

    zip.folder("_rels").file(".rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>");

    var xl = zip.folder("xl");
    xl.file("workbook.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (s, i) {
        return '<sheet name="' + xmlEsc(s.name) + '" sheetId="' + (i + 1) +
               '" r:id="rId' + (i + 1) + '"/>';
      }).join("") + "</sheets></workbook>");

    xl.folder("_rels").file("workbook.xml.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) {
        return '<Relationship Id="rId' + (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
          'Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      }).join("") +
      '<Relationship Id="rId' + (sheets.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>");

    xl.file("styles.xml", buildStyles());
    var ws = xl.folder("worksheets");
    sheets.forEach(function (s, i) { ws.file("sheet" + (i + 1) + ".xml", s.xml); });

    return await zip.generateAsync({ type: "blob" });
  }

  async function download(carts, items, events, opts) {
    var blob = await build(carts, items, events, opts);
    var stamp = (opts && opts.today) || new Date().toISOString().slice(0, 10);
    var name = carts.length === 1
      ? "Crash_cart_" + String(carts[0].name || "cart").replace(/[^\w]+/g, "_") + "_" + stamp + ".xlsx"
      : "Crash_carts_" + carts.length + "_" + stamp + ".xlsx";
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return name;
  }

  return { build: build, download: download, safeName: safeName, _styles: buildStyles };
})();
