/* AQcredix — the founder figure as a real 3D object, for the fall down the timeline.
 *
 * WHY THIS EXISTS AT ALL, since the rest of the section is a pre-rendered image sequence.
 * A turntable render can only turn about ONE axis. It is a carousel: you can look at the
 * subject from any side, but you can never see the top of his head or the soles of his
 * shoes, because no such frame was ever rendered. So a frame sequence cannot tumble, and
 * every 2D trick that pretends otherwise — the horizontal squash this replaced — reads as a
 * flat cutout being squeezed, because a squash is precisely the transform a solid object
 * never performs.
 *
 * Measured, to be sure rather than to be sorry: rotating the real model 90 degrees about its
 * pitch axis renders a 48x27 silhouette where the standing figure is 55x88 — he is lying
 * flat, seen from above. There is no frame in the 420 that contains that picture and there
 * never could be.
 *
 * THE COST TURNED OUT TO BE ALMOST NOTHING, WHICH IS WHY THIS IS WORTH IT. Rodin's export is
 * 18.57 MB, which would have settled the argument on its own. But the geometry is only
 * 19,389 vertices — the size is all texture. Resized to 1024 and re-encoded as WebP it comes
 * out at 876 KB, which is less than a tenth of the image sequence already on this page and
 * about forty of its frames. The model is CHEAPER than the fallback it improves on.
 *
 * IT MUST FAIL SILENTLY AND COMPLETELY. This is the one file on the site that depends on a
 * third-party CDN and on WebGL being available. If either is missing — a blocked CDN, an
 * old browser, a machine with no GPU — this module simply never sets `ready`, and coat.js
 * carries on with the 2D sprite it already had. Nothing here is allowed to throw into the
 * page: a portfolio that breaks because a graphics library did not load is worse than one
 * with a slightly flatter animation.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

var MODEL = "profile/coat-model.glb";

var renderer = null, scene = null, cam = null, pivot = null, modelH = 1;
var lastW = 0, lastH = 0;

/* The API coat.js drives. It owns the scroll maths and the path down the spine; this file
   owns nothing but the picture. Kept deliberately thin: two files sharing a notion of where
   he is would drift apart the first time either was edited. */
var api = {
  ready: false,
  draw: function () {},
  hide: function () {}
};
window.AQCoat3D = api;

function size(w, h) {
  if (w === lastW && h === lastH) return;
  lastW = w; lastH = h;
  renderer.setSize(w, h, false);
  /* A PERSPECTIVE CAMERA PLACED SO THAT ONE WORLD UNIT IS ONE CSS PIXEL at z = 0.
     Orthographic would have been simpler and wrong: with no perspective, a tumbling object
     has no near edge and no far edge, and it flattens into exactly the cutout this file
     exists to stop. The camera sits 1000 units back and the field of view is solved from
     the viewport height, so coat.js can keep working in screen coordinates and hand over a
     position in pixels without knowing anything about 3D. */
  var dist = 1000;
  cam.fov = 2 * Math.atan(h / 2 / dist) * (180 / Math.PI);
  cam.aspect = w / h;
  cam.position.set(0, 0, dist);
  cam.updateProjectionMatrix();
}

function start(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  /* Filmic tone mapping, because the alternative is what he already hit once in Blender:
     a white coat rendering as grey mud. */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(35, 1, 1, 4000);

  /* AN ENVIRONMENT, NOT JUST LIGHTS, AND THIS IS THE WHOLE LIGHTING FIX.
     A physically based material shows you what it REFLECTS. Given nothing to reflect it
     renders dark however many lamps are pointed at it — which is exactly the "why is there
     no colour in my 3D model" problem from the Blender pass. Measured here: with lights
     alone the figure's median luminance was 61 and the white coat read as slate. With a room
     to reflect it is 207, and the coat peaks at 248. */
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  /* TURNED DOWN, because the room is where the blue was coming from. With the rim light at
     zero the coat still read 26 points bluer in blue than in red — a reflected environment
     is a light source like any other, and this one is a cool room. */
  scene.environmentIntensity = 0.55;

  /* LIT TO MATCH THE RENDERS, AND THAT IS A MEASUREMENT RATHER THAN A TASTE.
     The model and the image sequence are the same man, and the page shows one turning into
     the other — so if they are not lit alike, the handover is a character change. Sampled
     front-on against frame 419 in three bands of the figure own height, the first attempt
     came out head [131,102,107] against [132,107,93] — the hair and skin already agreed,
     confirming it is the same character — but the torso read [109,131,174] against
     [188,190,191]. The white coat was going blue-grey, because a rim light at 1.4 is a
     lot of blue to put on white fabric and the fill underneath it was too low to answer.
     So: more ambient, a brighter key, and the rim pulled right back to a suggestion. */
  scene.add(new THREE.AmbientLight(0xfff1e4, 1.05));
  var key = new THREE.DirectionalLight(0xfff6ec, 1.9);
  key.position.set(2, 3, 4);
  scene.add(key);
  /* The blue rim from the section still carries down the page — it is the same aura that
     made a white coat readable on a white background — but as a rim now, not a wash. */
  var rim = new THREE.DirectionalLight(0x9ab4ff, 0.14);
  rim.position.set(-3, 1.5, -2);
  scene.add(rim);

  new GLTFLoader().load(MODEL, function (gltf) {
    var root = gltf.scene;
    var box = new THREE.Box3().setFromObject(root);
    var dim = box.getSize(new THREE.Vector3());
    modelH = dim.y || 1;
    /* Centred on its own bounding box before anything rotates it. Rotating a model about
       the origin its exporter happened to use swings it round a point off to one side — an
       orbit, not a tumble. The 2D rider had to solve the same problem with FIG_CX. */
    root.position.sub(box.getCenter(new THREE.Vector3()));

    /* WHITE-BALANCED ONTO THE RENDERS, because he could see the difference and said so.
       The page shows one turn into the other, so any mismatch reads as the man changing
       costume mid-fall.

       Measured properly this time. The first attempt compared a fixed band of the figure's
       height against frame 419 and was nonsense: the model was at yaw 0 and the frame was
       not, so it was comparing his chest against his shoulder. Isolating the COAT instead —
       the brightest quarter of the figure's own pixels, which is robust to pose and framing —
       gives a target of [205,205,205] averaged over five renders. The model came out
       [228,233,241]: too bright, and cool, the opposite of what the bad measurement said.

       Exposure and a quieter room fixed the brightness. What survived was a 21-point blue
       cast that stayed put with every lamp turned off, which puts it in the texture rather
       than the lighting — so it is corrected where it lives. material.color multiplies the
       map, so this is a white balance on the fabric and nothing else. */
    root.traverse(function (o) {
      if (!o.isMesh || !o.material) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (m) { if (m.color) m.color.setRGB(1.10, 1.0, 0.87); });
    });
    pivot = new THREE.Group();
    pivot.add(root);
    scene.add(pivot);
    api.ready = true;
    /* Nothing repaints on its own here — the next scroll draws it. Firing a redraw is
       coat.js's business, and it is listening. */
    try { window.dispatchEvent(new Event("aq:coat3d")); } catch (e) {}
  }, undefined, function () {
    /* A model that will not load leaves ready false, and the sprite carries on. */
    api.ready = false;
  });
}

api.draw = function (s) {
  if (!api.ready || !pivot) return false;
  size(s.vw, s.vh);
  pivot.position.set(s.cx - s.vw / 2, s.vh / 2 - s.cy, 0);
  var k = s.h / modelH;
  pivot.scale.set(k, k, k);
  pivot.rotation.set(s.rx, s.ry, s.rz);
  renderer.render(scene, cam);
  return true;
};

api.hide = function () {
  if (renderer && lastW) renderer.clear();
};

/* coat.js creates the layer and hands the canvas over, so there is exactly one place that
   decides whether the rider exists at all. */
api.mount = function (canvas) {
  if (renderer) return;
  try { start(canvas); } catch (e) { api.ready = false; }
};

try { window.dispatchEvent(new Event("aq:coat3d-loaded")); } catch (e) {}
