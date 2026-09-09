/* AQcredix — the founder figure as ONE real 3D model, for the whole of his journey.
 *
 * HE IS NOT SWAPPED ANY MORE, AND THAT IS THE POINT OF THIS FILE'S SECOND VERSION.
 * The section used to be a 420-frame render and only the fall used the model, so the man
 * visibly changed the moment he started falling. Two figures lit by two different engines
 * cannot be reconciled by tuning: white-balancing got the coat from a colour delta of 51
 * down to 9 and it was still a swap. The answer was to stop having two of him.
 *
 * WHAT MADE THAT POSSIBLE was finding the parts export. The merged model is a single mesh,
 * which is why the frames had to stay at first: only they carried the coat-alone, then a
 * body, then a head build-up that took three Blender passes. The parts export has nine
 * separate meshes, and sorting them by how far up the figure they sit — and how wide they
 * are — recovers exactly those three groups:
 *
 *   COAT  root000 (0.24-0.80 of his height, 0.49 wide) and root001 (0.03-0.45, 0.59 wide,
 *         the flare that sweeps to the floor). The two widest things in the file.
 *   BODY  root01 (0.00-0.78, 0.30 wide, which is a real shoulder-to-height ratio), with the
 *         shoes, the tie and the cord, all of which are worn ON the body.
 *   HEAD  root1, root2, root3 — hair, face and neck, everything above 0.72.
 *
 * So the model performs the assembly the renders used to, and then keeps going into what no
 * render can do: turning on any axis, tumbling, falling. One figure, one lighting rig, and
 * no seam anywhere on the page.
 *
 * AND IT IS SMALLER THAN WHAT IT REPLACES: 2.23 MB against 8.4 MB of WebP frames.
 *
 * IT MUST STILL FAIL SILENTLY. This is the only thing on the site needing WebGL and a
 * third-party CDN. If either is missing, `ready` never goes true and coat.js falls back to
 * the image sequence, which is still there and still works. Nothing here throws into the
 * page.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

var MODEL = "profile/coat-parts.glb";

/* Where each group starts existing, in sequence progress. These are the render's own
   handover points, kept so everything already keyed to them — the flare of light at each
   arrival, the head's fade — still lands on the same beat of the story. */
var BODY_AT = 90 / 420, BODY_FADE = 0.05;
var HEAD_AT = 180 / 420, HEAD_FADE = 0.075;

var renderer = null, scene = null, cam = null, pivot = null, modelH = 1;
var groups = { coat: [], body: [], head: [] };
var lastW = 0, lastH = 0;

var api = { ready: false, draw: function () { return false; }, hide: function () {} };
window.AQCoat3D = api;

function size(w, h) {
  if (w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  /* A PERSPECTIVE CAMERA PLACED SO ONE WORLD UNIT IS ONE CSS PIXEL at z = 0. Orthographic
     would be simpler and wrong: with no perspective a turning object has no near edge, and
     it flattens back into the cutout this whole approach exists to avoid. The field of view
     is solved from the viewport height, so coat.js keeps working in screen coordinates and
     never has to know any 3D. */
  var dist = 1000;
  cam.fov = 2 * Math.atan(h / 2 / dist) * (180 / Math.PI);
  cam.aspect = w / h;
  cam.position.set(0, 0, dist);
  cam.updateProjectionMatrix();
}

/* Sorted by geometry, not by name, because the exporter's names carry no meaning —
   root000, root01, root1. What IS meaningful is where a piece sits on the figure and how
   wide it is: the coat is the widest thing on a person, the head is everything above the
   collar, and what remains is the body. */
function classify(root, base, H) {
  root.traverse(function (o) {
    if (!o.isMesh) return;
    var b = new THREE.Box3().setFromObject(o);
    var bottom = (b.min.y - base) / H;
    var width = (b.max.x - b.min.x) / H;
    if (bottom > 0.70) groups.head.push(o);
    else if (width > 0.40) groups.coat.push(o);
    else groups.body.push(o);
  });
}

/* Fading a group means making its materials transparent, and transparency costs correct
   depth sorting — so it is switched on only while a group is mid-fade and switched off the
   moment it is solid. A coat left permanently transparent sorts against itself and shows
   its own lining through its front. */
function setGroup(list, a) {
  var wantTransparent = a < 0.999;
  for (var i = 0; i < list.length; i++) {
    var o = list[i];
    o.visible = a > 0.001;
    var mats = Array.isArray(o.material) ? o.material : [o.material];
    for (var j = 0; j < mats.length; j++) {
      var m = mats[j];
      if (!m) continue;
      /* TOGGLING transparent NEEDS needsUpdate, AND WITHOUT IT YOU SEE HIS FACE THROUGH
         THE BACK OF HIS HEAD. Whether a material blends is compiled INTO its shader
         program, so flipping the flag alone changes nothing that renders: the head
         finished fading in, was set opaque, and went on being drawn by the blending
         program it had been given while it was arriving. Turned away from the camera you
         then saw the eyes and mouth straight through the skull.

         Only flagged when the value actually CHANGES. Recompiling a shader is expensive
         and this runs on every scroll frame — setting needsUpdate unconditionally would
         trade a rendering bug for a stutter. */
      if (m.transparent !== wantTransparent) {
        m.transparent = wantTransparent;
        m.needsUpdate = true;
      }
      m.opacity = wantTransparent ? a : 1;
      /* And depth is written only when solid: a half-faded head that writes depth hides
         the shoulders behind it, which is the same artefact seen from the other side. */
      m.depthWrite = !wantTransparent;
    }
  }
}

function ramp(f, at, over) {
  if (f <= at) return 0;
  if (f >= at + over) return 1;
  return (f - at) / over;
}

function start(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(35, 1, 1, 4000);

  /* AN ENVIRONMENT, NOT JUST LAMPS. A physically based material shows you what it REFLECTS,
     so given nothing to reflect it renders as dark mud however many lights are aimed at
     it — exactly the "why is there no colour in my 3D model" problem from the Blender pass.
     Turned down to 0.55 because the room is also where a blue cast came from: with every
     lamp at zero the coat still read 26 points bluer in blue than in red. */
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  scene.add(new THREE.AmbientLight(0xfff1e4, 1.05));
  var key = new THREE.DirectionalLight(0xfff6ec, 1.9);
  key.position.set(2, 3, 4);
  scene.add(key);
  /* The site's own blue, as a rim rather than a wash. */
  var rim = new THREE.DirectionalLight(0x9ab4ff, 0.14);
  rim.position.set(-3, 1.5, -2);
  scene.add(rim);

  new GLTFLoader().load(MODEL, function (gltf) {
    var root = gltf.scene;
    var box = new THREE.Box3().setFromObject(root);
    modelH = box.getSize(new THREE.Vector3()).y || 1;

    /* EVERY MESH GETS ITS OWN MATERIAL, AND WITHOUT THIS THE ASSEMBLY SILENTLY FAILS.
       The optimiser runs a dedup pass that merges identical materials, so several of the
       nine meshes come back sharing one instance — which is correct and efficient right up
       to the moment something fades a group by writing opacity onto it. Fading the body to
       zero was also fading the COAT to zero, because they were the same material object:
       measured, the model drew nothing at all until the last group arrived, and then
       everything appeared at once. Cloning is nine objects and costs nothing. */
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      o.material = Array.isArray(o.material)
        ? o.material.map(function (m) { return m.clone(); })
        : o.material.clone();
      /* FRONT FACES ONLY. Exporters routinely mark a head double-sided, which means the
         inside of the skull is drawn as well as the outside — and the inside of the face
         is what you are looking at when the back of the head goes see-through. A closed
         solid has no inside worth drawing, so culling it is both correct and cheaper. */
      var mm = Array.isArray(o.material) ? o.material : [o.material];
      mm.forEach(function (m) { m.side = THREE.FrontSide; });
    });

    classify(root, box.min.y, modelH);
    /* Centred on its own bounding box before anything rotates it. Rotating about whatever
       origin the exporter happened to use swings him round a point off to one side — an
       orbit, not a turn. */
    root.position.sub(box.getCenter(new THREE.Vector3()));

    /* WHITE-BALANCED, and this is a measurement rather than a taste. Isolating the coat —
       the brightest quarter of the figure's own pixels, which does not care about pose or
       framing — the renders average [205,205,205]; untouched, the model came out cool.
       material.color multiplies the map, so this corrects the fabric and nothing else. */
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (m) { if (m.color) m.color.setRGB(1.10, 1.0, 0.87); });
    });

    pivot = new THREE.Group();
    pivot.add(root);
    scene.add(pivot);
    api.parts = { coat: groups.coat.length, body: groups.body.length, head: groups.head.length };
    api.ready = true;
    /* Nothing repaints on its own here — coat.js owns the scroll and is listening. */
    try { window.dispatchEvent(new Event("aq:coat3d")); } catch (e) {}
  }, undefined, function () { api.ready = false; });
}

api.draw = function (s) {
  if (!api.ready || !pivot) return false;
  size(s.vw, s.vh);

  /* THE ASSEMBLY, which is the whole reason the parts export was worth hunting for. The
     coat is always present; the body arrives at frame 90 and the head at 180 — the same two
     moments the renders handed over at, so the burst of light already keyed to each one
     still lands on it. Omit f and he is simply whole, which is what the fall wants. */
  var f = s.f == null ? 1 : s.f;
  setGroup(groups.coat, 1);
  setGroup(groups.body, ramp(f, BODY_AT, BODY_FADE));
  setGroup(groups.head, ramp(f, HEAD_AT, HEAD_FADE));

  pivot.position.set(s.cx - s.vw / 2, s.vh / 2 - s.cy, 0);
  var k = s.h / modelH;
  pivot.scale.set(k, k, k);
  pivot.rotation.set(s.rx || 0, s.ry || 0, s.rz || 0);
  renderer.render(scene, cam);
  return true;
};

api.hide = function () {
  /* setClearAlpha(0) then clear(), rather than clear() alone: the renderer is created with
     alpha:true and clearing without setting the alpha leaves the previous frame sitting in
     the buffer, which is exactly the stale-frame flash this is called to prevent. */
  if (!renderer || !lastW) return;
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
};

/* coat.js creates the layer and hands the canvas over, so exactly one place decides whether
   any of this exists at all. */
api.mount = function (canvas) {
  if (renderer) return;
  try { start(canvas); } catch (e) { api.ready = false; }
};
