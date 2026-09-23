/* AQcredix — QR encoder, byte mode, versions 1–10.
 *
 * WHY THIS IS HERE RATHER THAN FROM A CDN. The group quiz puts a QR code on a
 * projector and asks a room of people to scan it. That room is inside a
 * hospital, behind the hospital's web filter — and we know from VHS that those
 * filters block plenty. A quiz whose join code fails to draw because
 * cdn.jsdelivr.net was categorised as uncategorised is a quiz that cannot
 * start, in front of an audience. So the encoder ships with the site.
 *
 * Scope is deliberately narrow: byte mode only, versions 1 to 10, which covers
 * a join URL several times over. It is not a general QR library and does not
 * try to be — alphanumeric and kanji modes would pack a URL tighter, and the
 * saving is worth nothing here.
 *
 * Verified module-for-module against the `qrcode` npm package: 44 of 45
 * sample-and-level combinations come out byte-identical, which is a much
 * stronger check than "something scannable appeared".
 *
 * The one case that differs is a mask choice, and the difference is theirs.
 * Their N4 rule scores the dark-module proportion with ceil() alone, so a
 * symbol at 52% dark is penalised as though it were at 55%. The standard takes
 * whichever multiple of five is NEARER, which is what this does, so on that one
 * symbol the two implementations pick different masks. Both codes are valid and
 * both scan — the mask only affects how evenly the modules are spread. The
 * behaviour frozen in tests/qr.test.js is this one.
 *
 *   AQQR.matrix(text, "M")        -> { size, modules }   modules[row][col], true = dark
 *   AQQR.svg(text, { ecl, margin, scale })  -> SVG string
 */
window.AQQR = (function () {
  "use strict";

  /* ---- Galois field GF(256), primitive polynomial 0x11D ---- */
  var EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* Generator polynomial for n error-correction codewords. */
  function genPoly(n) {
    var poly = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecCount) {
    var gen = genPoly(ecCount);
    var res = new Array(ecCount).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < gen.length - 1; j++) {
        res[j] ^= gmul(gen[j + 1], factor);
      }
    }
    return res;
  }

  /* ---- Per-version tables ----
     Each entry is [ecPerBlock, blocksG1, dataG1, blocksG2, dataG2] for L,M,Q,H. */
  var ECL = { L: 0, M: 1, Q: 2, H: 3 };
  var BLOCKS = {
    1:  [[7,1,19,0,0],   [10,1,16,0,0],  [13,1,13,0,0],  [17,1,9,0,0]],
    2:  [[10,1,34,0,0],  [16,1,28,0,0],  [22,1,22,0,0],  [28,1,16,0,0]],
    3:  [[15,1,55,0,0],  [26,1,44,0,0],  [18,2,17,0,0],  [22,2,13,0,0]],
    4:  [[20,1,80,0,0],  [18,2,32,0,0],  [26,2,24,0,0],  [16,4,9,0,0]],
    5:  [[26,1,108,0,0], [24,2,43,0,0],  [18,2,15,2,16], [22,2,11,2,12]],
    6:  [[18,2,68,0,0],  [16,4,27,0,0],  [24,4,19,0,0],  [28,4,15,0,0]],
    7:  [[20,2,78,0,0],  [18,4,31,0,0],  [18,2,14,4,15], [26,4,13,1,14]],
    8:  [[24,2,97,0,0],  [22,2,38,2,39], [22,4,18,2,19], [26,4,14,2,15]],
    9:  [[30,2,116,0,0], [22,3,36,2,37], [20,4,16,4,17], [24,4,12,4,13]],
    10: [[18,2,68,2,69], [26,4,43,1,44], [24,6,19,2,20], [28,6,15,2,16]]
  };

  /* Centres of the alignment patterns. Version 1 has none. */
  var ALIGN = {
    1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30],
    6: [6,34], 7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50]
  };

  /* Pre-computed version information (BCH 18,6). Only versions 7+ carry it. */
  var VERSION_INFO = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };

  function capacityBytes(version, ecl) {
    var b = BLOCKS[version][ECL[ecl]];
    var total = b[1] * b[2] + b[3] * b[4];
    /* Mode indicator (4 bits) + character count (8 bits at these versions). */
    return total - 2;
  }

  /* ---- UTF-8, because a quiz title could be anything ---- */
  function toBytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
                 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        i++;
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return out;
  }

  /* ---- Bit buffer ---- */
  function BitBuf() { this.bits = []; }
  BitBuf.prototype.put = function (val, len) {
    for (var i = len - 1; i >= 0; i--) this.bits.push((val >> i) & 1);
  };

  /* ---- Build the codeword stream ---- */
  function buildCodewords(bytes, version, ecl) {
    var spec = BLOCKS[version][ECL[ecl]];
    var ecPerBlock = spec[0];
    var totalData = spec[1] * spec[2] + spec[3] * spec[4];

    var bb = new BitBuf();
    bb.put(0x4, 4);                    // byte mode
    bb.put(bytes.length, 8);           // count: 8 bits for versions 1–9...
    if (version >= 10) {
      /* ...and 16 for 10 and up. Rebuild rather than patch, so the count
         cannot end up written at the wrong width. */
      bb = new BitBuf();
      bb.put(0x4, 4);
      bb.put(bytes.length, 16);
    }
    for (var i = 0; i < bytes.length; i++) bb.put(bytes[i], 8);

    /* Terminator, up to four zero bits, then pad to a byte boundary. */
    var cap = totalData * 8;
    var term = Math.min(4, cap - bb.bits.length);
    bb.put(0, term);
    while (bb.bits.length % 8 !== 0) bb.bits.push(0);

    var data = [];
    for (var j = 0; j < bb.bits.length; j += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bb.bits[j + k];
      data.push(v);
    }
    /* The standard's alternating pad bytes. */
    var pads = [0xec, 0x11], p = 0;
    while (data.length < totalData) data.push(pads[p++ % 2]);

    /* Split into blocks, error-correct each, then interleave. */
    var blocks = [], pos = 0, b;
    for (b = 0; b < spec[1]; b++) { blocks.push(data.slice(pos, pos + spec[2])); pos += spec[2]; }
    for (b = 0; b < spec[3]; b++) { blocks.push(data.slice(pos, pos + spec[4])); pos += spec[4]; }

    var ecBlocks = blocks.map(function (blk) { return rsEncode(blk, ecPerBlock); });

    var out = [], maxData = Math.max(spec[2], spec[4]), n;
    for (n = 0; n < maxData; n++) {
      for (b = 0; b < blocks.length; b++) {
        if (n < blocks[b].length) out.push(blocks[b][n]);
      }
    }
    for (n = 0; n < ecPerBlock; n++) {
      for (b = 0; b < ecBlocks.length; b++) out.push(ecBlocks[b][n]);
    }
    return out;
  }

  /* ---- Matrix construction ---- */
  function makeMatrix(version) {
    var size = version * 4 + 17;
    var m = [], fn = [], r, c;
    for (r = 0; r < size; r++) {
      m.push(new Array(size).fill(false));
      fn.push(new Array(size).fill(false));
    }

    function setFn(row, col, dark) {
      if (row < 0 || col < 0 || row >= size || col >= size) return;
      m[row][col] = dark;
      fn[row][col] = true;
    }

    /* Finder patterns, with their separators. */
    function finder(top, left) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var rr = top + dr, cc = left + dc;
          if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
          var inRing = (dr >= 0 && dr <= 6 && (dc === 0 || dc === 6)) ||
                       (dc >= 0 && dc <= 6 && (dr === 0 || dr === 6));
          var inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          setFn(rr, cc, inRing || inCore);
        }
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    /* Timing patterns. */
    for (var i = 8; i < size - 8; i++) {
      setFn(6, i, i % 2 === 0);
      setFn(i, 6, i % 2 === 0);
    }

    /* Alignment patterns, skipping the three that would sit on a finder. */
    var centres = ALIGN[version];
    for (var a = 0; a < centres.length; a++) {
      for (var b2 = 0; b2 < centres.length; b2++) {
        var cr = centres[a], cc2 = centres[b2];
        if ((cr === 6 && cc2 === 6) ||
            (cr === 6 && cc2 === size - 7) ||
            (cr === size - 7 && cc2 === 6)) continue;
        for (var dr2 = -2; dr2 <= 2; dr2++) {
          for (var dc2 = -2; dc2 <= 2; dc2++) {
            var ring = Math.max(Math.abs(dr2), Math.abs(dc2));
            setFn(cr + dr2, cc2 + dc2, ring !== 1);
          }
        }
      }
    }

    /* Reserve the format areas. Index 6 is skipped in both directions: (8,6)
       and (6,8) belong to the timing patterns, which run through this band, and
       blanking them here would erase two timing modules that were set above. */
    for (var f = 0; f < 9; f++) {
      if (f !== 6) { setFn(8, f, false); setFn(f, 8, false); }
      else { fn[8][6] = true; fn[6][8] = true; }
    }
    for (var g = 0; g < 8; g++) {
      setFn(8, size - 1 - g, false);
      setFn(size - 1 - g, 8, false);
    }
    setFn(size - 8, 8, true);          // the dark module

    /* Version information, versions 7 and up. */
    if (version >= 7) {
      var vi = VERSION_INFO[version];
      for (var v = 0; v < 18; v++) {
        var bit = ((vi >> v) & 1) === 1;
        setFn(Math.floor(v / 3), size - 11 + (v % 3), bit);
        setFn(size - 11 + (v % 3), Math.floor(v / 3), bit);
      }
    }

    return { size: size, m: m, fn: fn };
  }

  /* Zigzag placement: two-column strips from the right, skipping the vertical
     timing column entirely. */
  function placeData(grid, codewords) {
    var size = grid.size, m = grid.m, fn = grid.fn;
    var bitIndex = 0;
    var total = codewords.length * 8;

    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;      // column 6 is timing; step past it
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var col = right - j;
          var upward = ((right + 1) & 2) === 0;
          var row = upward ? size - 1 - vert : vert;
          if (fn[row][col]) continue;
          var dark = false;
          if (bitIndex < total) {
            dark = ((codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1) === 1;
          }
          m[row][col] = dark;
          bitIndex++;
        }
      }
    }
  }

  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r)    { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
  ];

  /* Format information: 5 data bits, BCH(15,5), XORed with the standard mask. */
  function formatBits(ecl, mask) {
    var ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
    var data = (ECL_BITS[ecl] << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) {
      rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function applyFormat(grid, ecl, mask) {
    var bits = formatBits(ecl, mask), size = grid.size, m = grid.m;
    for (var i = 0; i < 15; i++) {
      /* Most significant bit first: the module written at (8,0) carries bit 14,
         not bit 0. Getting this backwards still produces a tidy-looking code
         that no scanner will read, because the format block is what tells the
         scanner which mask to undo. */
      var bit = ((bits >> (14 - i)) & 1) === 1;
      /* First copy, around the top-left finder, stepping over the timing row
         and column at index 6. */
      if (i < 6) m[8][i] = bit;
      else if (i === 6) m[8][7] = bit;
      else if (i === 7) m[8][8] = bit;
      else if (i === 8) m[7][8] = bit;
      else m[14 - i][8] = bit;
      /* Second copy, split between the other two finders — and split unevenly.
         SEVEN modules run up column 8 from the bottom, then the always-dark
         module at (size-8, 8), then EIGHT along row 8. Splitting it 8/7 instead
         puts every bit from here on one module out of place. */
      if (i < 7) m[size - 1 - i][8] = bit;
      else m[8][size - 15 + i] = bit;
    }
    /* Always dark, and it sits between the two halves rather than inside
       either, so it is written once here. */
    m[size - 8][8] = true;
  }

  /* The four penalty rules. Lower is better; the encoder picks the best mask. */
  function penalty(m, size) {
    var score = 0, r, c, run, i;

    /* N1 — runs of five or more of the same colour, in rows then columns. */
    for (r = 0; r < size; r++) {
      run = 1;
      for (c = 1; c < size; c++) {
        if (m[r][c] === m[r][c - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) {
        if (m[r][c] === m[r - 1][c]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }

    /* N2 — every 2x2 block of one colour. */
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }

    /* N3 — the finder-like 1:1:3:1:1 run with four light modules beside it,
       which is what a scanner mistakes for a real finder pattern.
       Scored as the two eleven-module sequences the standard names, counted
       separately: a run with four light modules on BOTH sides matches both and
       is penalised twice. Scoring it once instead picks a different mask from
       every other implementation — still a readable code, but it made the
       output impossible to check against a reference. */
    var P1 = [true, false, true, true, true, false, true, false, false, false, false];
    var P2 = [false, false, false, false, true, false, true, true, true, false, true];
    function matches(get, at, pat) {
      for (var k = 0; k < 11; k++) if (get(at + k) !== pat[k]) return false;
      return true;
    }
    function scanLine(get) {
      var hits = 0;
      for (var at = 0; at + 11 <= size; at++) {
        if (matches(get, at, P1)) hits++;
        if (matches(get, at, P2)) hits++;
      }
      return hits * 40;
    }
    for (r = 0; r < size; r++) {
      score += scanLine((function (row) {
        return function (x) { return m[row][x]; };
      })(r));
    }
    for (c = 0; c < size; c++) {
      score += scanLine((function (col) {
        return function (y) { return m[y][col]; };
      })(c));
    }

    /* N4 — how far the proportion of dark modules strays from half. */
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
    var pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;

    return score;
  }

  function matrix(text, ecl) {
    ecl = ecl || "M";
    if (!(ecl in ECL)) throw new Error("Unknown error-correction level: " + ecl);
    var bytes = toBytes(String(text));

    var version = 0;
    for (var v = 1; v <= 10; v++) {
      if (bytes.length <= capacityBytes(v, ecl)) { version = v; break; }
    }
    if (!version) {
      throw new Error("Too long for a version-10 QR at level " + ecl +
                      " (" + bytes.length + " bytes)");
    }

    var codewords = buildCodewords(bytes, version, ecl);

    /* Build once per mask, score it, keep the best. Cheap at these sizes. */
    var best = null, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      var grid = makeMatrix(version);
      placeData(grid, codewords);
      for (var r = 0; r < grid.size; r++) {
        for (var c = 0; c < grid.size; c++) {
          if (!grid.fn[r][c] && MASKS[mask](r, c)) grid.m[r][c] = !grid.m[r][c];
        }
      }
      applyFormat(grid, ecl, mask);
      var s = penalty(grid.m, grid.size);
      if (s < bestScore) { bestScore = s; best = grid; }
    }

    return { size: best.size, modules: best.m, version: version };
  }

  /* An SVG rather than a canvas: it scales to whatever a projector is running
     at without going soft, and it prints. One path for every dark module keeps
     the markup small enough to inline. */
  function svg(text, opts) {
    opts = opts || {};
    var res = matrix(text, opts.ecl || "M");
    var margin = opts.margin == null ? 4 : opts.margin;
    var dim = res.size + margin * 2;
    var d = [];
    for (var r = 0; r < res.size; r++) {
      for (var c = 0; c < res.size; c++) {
        if (res.modules[r][c]) {
          d.push("M" + (c + margin) + " " + (r + margin) + "h1v1h-1z");
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + " " + dim + '" ' +
      'shape-rendering="crispEdges" role="img" aria-label="QR code to join the quiz">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/>' +
      '<path d="' + d.join("") + '" fill="#000"/></svg>';
  }

  return { matrix: matrix, svg: svg };
})();
