/* Crop a transparent-background PNG to its actual silhouette, then downscale for the web.
 *
 * WHY CROP AT ALL. The layout reserves a BOX for the figure, but the visible body only fills
 * the middle of that box — the rest is transparent margin baked into the export. The text
 * column therefore stops at the edge of the margin, not at the shoulder, and the reader sees a
 * rectangular hole. Trimming the margin off makes the box edge and the silhouette edge the
 * same thing, which is the only way text can sit close to a cut-out without overlapping it.
 *
 * No node_modules in this project, so PNG is decoded and re-encoded here against zlib, which
 * ships with Node. 8-bit RGBA, non-interlaced only — that is what the export is.
 */
const fs = require('fs');
const zlib = require('zlib');

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decode(buf) {
  if (!buf.slice(0, 8).equals(SIG)) throw new Error('not a PNG');
  let o = 8, ihdr = null, idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8],
               color: data[9], interlace: data[12] };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (ihdr.depth !== 8 || ihdr.color !== 6 || ihdr.interlace !== 0) {
    throw new Error('expected 8-bit RGBA, non-interlaced; got ' + JSON.stringify(ihdr));
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr, bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, data: out };
}

function encode(img) {
  const { w, h, data } = img, bpp = 4, stride = w * bpp;
  const rows = Buffer.alloc(h * (stride + 1));
  const tryBuf = Buffer.alloc(stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const cur = data.slice(y * stride, (y + 1) * stride);
    const prev = y ? data.slice((y - 1) * stride, y * stride) : null;
    /* Pick the filter with the smallest sum of absolute differences — the standard heuristic,
       and worth the passes: it roughly halves the file against filter 0. */
    let best = 0, bestSum = Infinity, bestBuf = null;
    for (let f = 0; f <= 4; f++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? cur[x - bpp] : 0;
        const b = prev ? prev[x] : 0;
        const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
        let v;
        if (f === 0) v = cur[x];
        else if (f === 1) v = cur[x] - a;
        else if (f === 2) v = cur[x] - b;
        else if (f === 3) v = cur[x] - ((a + b) >> 1);
        else {
          const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = cur[x] - ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c));
        }
        v &= 0xff;
        tryBuf[x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; bestBuf = Buffer.from(tryBuf); }
    }
    rows[q++] = best;
    bestBuf.copy(rows, q); q += stride;
  }
  const idat = zlib.deflateSync(rows, { level: 9 });
  const chunk = (type, body) => {
    const b = Buffer.alloc(8 + body.length + 4);
    b.writeUInt32BE(body.length, 0);
    b.write(type, 4, 'ascii');
    body.copy(b, 8);
    b.writeInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), body])) | 0, 8 + body.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

let CRCar = null;
function crc(buf) {
  if (!CRCar) {
    CRCar = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      CRCar[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRCar[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

/* The silhouette's bounding box. A threshold rather than alpha>0, because a soft matte leaves
   a halo of 1–3 alpha that would defeat the whole point of trimming. */
function bbox(img, thresh) {
  const { w, h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= thresh) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

function crop(img, x0, y0, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.data.copy(out, y * w * 4, ((y0 + y) * img.w + x0) * 4, ((y0 + y) * img.w + x0 + w) * 4);
  }
  return { w, h, data: out };
}

/* Box-filter downscale, averaging in premultiplied alpha. Averaging straight RGBA would pull
   the transparent margin's colour into every edge pixel and fringe the silhouette. */
function resize(img, nw, nh) {
  const out = Buffer.alloc(nw * nh * 4);
  const sx = img.w / nw, sy = img.h / nh;
  for (let y = 0; y < nh; y++) {
    const yA = Math.floor(y * sy), yB = Math.max(yA + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < nw; x++) {
      const xA = Math.floor(x * sx), xB = Math.max(xA + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = yA; yy < yB && yy < img.h; yy++) {
        for (let xx = xA; xx < xB && xx < img.w; xx++) {
          const i = (yy * img.w + xx) * 4, al = img.data[i + 3] / 255;
          r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al;
          a += img.data[i + 3]; n++;
        }
      }
      const o = (y * nw + x) * 4, am = a / n;
      const un = am > 0 ? (n * 255) / a : 0;      /* back out of premultiplied */
      out[o] = Math.round(Math.min(255, (r / n) * un));
      out[o + 1] = Math.round(Math.min(255, (g / n) * un));
      out[o + 2] = Math.round(Math.min(255, (b / n) * un));
      out[o + 3] = Math.round(am);
    }
  }
  return { w: nw, h: nh, data: out };
}

const [, , src, dst, targetH] = process.argv;
const img = decode(fs.readFileSync(src));
const bb = bbox(img, 10);
console.log('source     ', img.w + 'x' + img.h);
console.log('silhouette ', 'x ' + bb.x0 + '..' + bb.x1 + '  y ' + bb.y0 + '..' + bb.y1);
const cw = bb.x1 - bb.x0 + 1, ch = bb.y1 - bb.y0 + 1;
console.log('trimmed    ', cw + 'x' + ch,
  '(' + Math.round((1 - (cw * ch) / (img.w * img.h)) * 100) + '% of the frame was empty margin)');
/* KEEP THE FRAME. Passing "keep" leaves the export exactly as it came: the silhouette runs
   to the left and right edges at the shoulders, so ANY horizontal trim cuts the arms off
   square — which is the one thing that makes a cut-out read as a rectangular photo. */
const KEEP = process.argv[6] === "keep";
let outImg = KEEP ? img : crop(img, bb.x0, bb.y0, cw, ch);
if (KEEP) console.log('keep-frame  no trim, no ratio crop — the body reaches the edges');

/* HOLD THE ESTABLISHED RATIO. The figure is sized by HEIGHT and its width follows from this
   ratio, so a wider frame means a wider figure and less room for the text columns. Trimming
   the dead space above the hair alone would have taken the frame from 0.95 to 1.14 — a fifth
   wider — which is the opposite of what this change is for. Centre-cropping back to the ratio
   the layout was built around clips a little off the outer shoulders, which reads as a poster
   crop rather than a loss. */
const ratio = parseFloat(process.argv[5]);
if (ratio > 0) {
  const want = Math.round(outImg.h * ratio);
  if (want < outImg.w) {
    const off = Math.round((outImg.w - want) / 2);
    outImg = crop(outImg, off, 0, want, outImg.h);
    console.log('ratio-crop ', outImg.w + 'x' + outImg.h, '(took ' + off + 'px off each shoulder)');
  }
}
const th = parseInt(targetH, 10);
if (th && th < outImg.h) {
  const nw = Math.round(outImg.w * (th / outImg.h));
  outImg = resize(outImg, nw, th);
  console.log('resized    ', nw + 'x' + th);
}
const png = encode(outImg);
fs.writeFileSync(dst, png);
console.log('written    ', dst, (png.length / 1024).toFixed(0) + ' KB');
console.log('RATIO      ', (outImg.w / outImg.h).toFixed(4), '(' + outImg.w + '/' + outImg.h + ')');
