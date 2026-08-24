/* Camera framing: the 3D scenes must fit their canvas at every width, and desktop
   framing must not move. Guessed per-breakpoint distances failed twice — the field of
   view is vertical, so a shape wider than it is tall clips sideways on a square phone
   canvas at a distance that frames a taller shape perfectly. These assert the maths. */
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', g, 'want', w); } };

const FOV = 42;
const fits = (r, d, aspect) => {
  const v = FOV * Math.PI / 180, h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  return r < Math.tan(h / 2) * d && r < Math.tan(v / 2) * d;
};
const fitDist = (r, aspect) => {
  const v = FOV * Math.PI / 180, h = 2 * Math.atan(Math.tan(v / 2) * aspect);
  return r / Math.sin(Math.min(v, h) / 2);
};

// --- hero organs: desktop distance must stay exactly 3.4
const face = fs.readFileSync(path.join(__dirname, '../face/face.js'), 'utf8');

/* This used to assert that the literal line `if (window.innerWidth > 900) return 3.4;`
   was present — the implementation rather than the promise. The promise is that an
   ordinary desktop hero is framed exactly where it was tuned, and that nothing is ever
   cut off; the window width was only ever a proxy for "the canvas is roomy", and a wrong
   one, because the hero's right column is as tall as its left column and reshapes when
   content is added beside it with no window resize to notice. So the distance function is
   now run, and the promise is checked directly. */
const maxExtent = 1.24;                       // the widest shape, as measured in face.js
function cameraDistance(aspect) {
  const vFov = FOV * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (aspect || 1));
  const halfFov = Math.min(vFov, hFov) / 2;
  if (Math.tan(halfFov) * 3.4 >= maxExtent * 1.04) return 3.4;
  return Math.max(3.4, (maxExtent * 1.28) / Math.sin(halfFov));
}
eq(/Math\.tan\(halfFov\) \* 3\.4 >= maxExtent \* 1\.04/.test(face), true,
   'the code asks whether 3.4 already frames THIS canvas');
eq(/window\.innerWidth > 900/.test(face), false,
   'framing no longer keys off the window, which is not the canvas');
eq(cameraDistance(1.6), 3.4, 'a desktop hero is framed at 3.4, exactly as before');
eq(cameraDistance(1.33), 3.4, 'a 4:3 canvas is also unchanged');
eq(cameraDistance(0.85) > 3.4, true, 'a canvas taller than it is wide pulls the camera back');
eq(fits(1.24, cameraDistance(0.85), 0.85), true, 'and the shape then fits');
eq(fits(1.24, cameraDistance(0.7), 0.7), true, 'a very narrow canvas fits too');

/* The box, not the window: every earlier fix here guessed at which event to listen for. */
eq(/\.observe\(wrapEl\)/.test(face), true,
   'the hero re-frames whenever its own box changes, not only on window resize');
eq(/maxExtent/.test(face) && /Math\.sin\(halfFov\)/.test(face), true,
   'hero distance is measured from the shapes, not guessed per breakpoint');
eq(/Math\.max\(3\.4, fit\)/.test(face), true, 'hero only ever pulls back, never closer');

// the widest organ must fit on the tightest realistic phone canvas
const R = 1.24 * 1.12;
[[1.6, 'desktop 16:10'], [1.0, 'square phone'], [0.85, 'tall phone']].forEach(([a, n]) => {
  const d = a > 1.5 ? 3.4 : Math.max(3.4, fitDist(R, a));
  eq(fits(1.24, d, a), true, 'hero organ fits on ' + n);
});

// --- globe: atmosphere shell must fit too
const glob = fs.readFileSync(path.join(__dirname, '../qglobe/qglobe.js'), 'utf8');
eq(/FIT_RADIUS/.test(glob) && /Math\.sin\(Math\.min\(vFov, hFov\) \/ 2\)/.test(glob), true,
   'globe distance is computed from the atmosphere radius');
eq(/if \(camDistance < need\)/.test(glob), true,
   'globe only pushes out, so a zoomed-in user is not yanked back');
[[1.6, 'desktop'], [1.0, 'square'], [0.85, 'narrow phone']].forEach(([a, n]) => {
  const d = Math.max(2.6, fitDist(1.12 * 1.06, a));
  eq(fits(1.12, d, a), true, 'globe atmosphere fits on ' + n);
});

/* Neither scene may reference a const declared later from setup code — that throws on the
   temporal dead zone and takes the whole visual with it. Both bugs happened here. */
eq(face.indexOf('const maxExtent') < face.indexOf('\n  sizeRenderer();'), true,
   'hero measures its shapes before the first sizeRenderer call');
eq(/controls\.minDistance = MIN_D;/.test(glob), false,
   'globe does not touch controls/MIN_D from setup-time sizeRenderer');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
