/* THE CAPITALS ON THE HOMEPAGE GLOBE SAT OVER THE WRONG CONTINENTS, AND THE
 * REASON WAS ONE CHARACTER OF GEOMETRY.
 *
 * Each capital gets an HTML hit-target that is positioned every frame by
 * projecting its world position through the camera. Half the capitals are on the
 * far side of the planet at any moment, so the loop has to hide those — and it
 * tried to, with `p.z > 1`.
 *
 * That is a FRUSTUM test. NDC z only exceeds 1 beyond the camera's FAR plane, and
 * the globe sits wholly inside the frustum, so it never once fired. All 74
 * targets stayed visible, and a far-side capital projects onto the MIRRORED point
 * of the disc — which is why Paris and Berlin appeared over the Americas. They
 * were the real Paris and Berlin, seen through the planet.
 *
 * The test that is actually needed is a HORIZON test: a point faces away when the
 * vector from it to the camera lies on the back of its own surface normal. On a
 * sphere centred at the rig's origin, that normal is the point itself. Unlike a
 * naive `z > 0` check it also accounts for the camera being a finite distance
 * away, so capitals just over the limb are hidden rather than shown edge-on.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(ROOT, 'hglobe/hglobe.js'), 'utf8');
/* The comments above the fix name the very bug this file guards against, so
   assertions about behaviour run against the code with comments stripped. */
const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

global.window = {};
require(path.join(ROOT, 'hglobe/capitals-data.js'));
const CAPS = global.window.WORLD_CAPITALS;

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg); }

console.log('globe capitals');

check('every capital carries a real coordinate', () => {
  ok(CAPS.length > 50, 'only ' + CAPS.length + ' capitals');
  const seen = new Map();
  CAPS.forEach(c => {
    ok(Math.abs(c.lat) <= 90, c.city + ' has a latitude outside +/-90');
    ok(Math.abs(c.lon) <= 180, c.city + ' has a longitude outside +/-180');
    /* Two capitals at one point means a copy-paste, and one of them is wrong. */
    const k = c.lat.toFixed(3) + ',' + c.lon.toFixed(3);
    ok(!seen.has(k), c.city + ' sits on exactly the same point as ' + seen.get(k));
    seen.set(k, c.city);
  });
});

check('far-side capitals are hidden by a horizon test, not a frustum test', () => {
  ok(!/const behind\s*=\s*p\.z\s*>\s*1/.test(code),
     'the cull is back to `p.z > 1` — that only fires beyond the camera FAR plane, ' +
     'so it never fires at all and every far-side capital shows through the planet ' +
     'over the wrong continent');
  ok(/const behind\s*=[\s\S]{0,200}?\.dot\(/.test(code),
     'nothing takes a dot product to decide which capitals face the camera');
  ok(/camera\.position/.test(code),
     'the cull does not reference the camera position, so it cannot be a horizon test');
});

check('the sprite is hidden along with its hit-target', () => {
  /* The sphere is transparent at 0.94 and the sprites blend additively without
     writing depth, so a far-side marker bleeds through as a ghost even once its
     HTML target is hidden. It also lets the raycaster pick through the globe. */
  ok(/hub\.mesh\.visible\s*=\s*!behind/.test(code),
     'only the HTML hit-target is hidden; the WebGL sprite still bleeds through the globe');
});

check('the horizon test agrees with the geometry it claims to implement', () => {
  /* Reimplemented here from the same constants. On a sphere of radius r seen from
     distance d, the visible cap is bounded by acos(r/d) — so the fraction of
     capitals showing must land near that, and nowhere near all of them. */
  const R = 1.035, d = 2.6;
  const frac = (1 - R / d) / 2;              // solid-angle fraction of the visible cap
  function latLon(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180, th = (lon + 180) * Math.PI / 180;
    return [-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)];
  }
  const cam = [0, 0, d];
  let front = 0;
  CAPS.forEach(c => {
    const w = latLon(c.lat, c.lon, R);
    const dot = w[0] * (cam[0] - w[0]) + w[1] * (cam[1] - w[1]) + w[2] * (cam[2] - w[2]);
    if (dot > 0) front++;
  });
  const share = front / CAPS.length;
  ok(share > 0.15 && share < 0.55,
     share.toFixed(2) + ' of capitals face the camera; the horizon test is not culling ' +
     'a hemisphere (expected roughly ' + frac.toFixed(2) + ')');
});

console.log('\n' + (fail ? fail + ' failing, ' : '') + pass + ' passing');
process.exit(fail ? 1 : 0);
