/* AQcredix — the scroll-scrubbed founder sequence.
 *
 * THE TECHNIQUE, PLAINLY. A tall section pins its contents with position:sticky while the
 * page keeps scrolling past it. How far through that section you are, 0 to 1, drives three
 * things at once: which frame of a numbered image sequence is drawn, how far the "camera"
 * has pushed in, and which line of copy is on screen. Scroll down and it advances; scroll
 * back up and it reverses, because the position is read from the scrollbar rather than
 * played on a timer.
 *
 * THE PUSH-IN IS DONE HERE, NOT IN BLENDER, AND THAT IS DELIBERATE.
 * A camera move baked into the render costs a full re-render every time the framing is
 * judged wrong — and it is always judged wrong the first three times. Done at draw time it
 * is two numbers that can be changed and reloaded in a second. The constraint that keeps it
 * honest is that it must never magnify beyond the source: the sequence is rendered at
 * 1100px and the push ends at a scale that still fits inside that on any ordinary screen,
 * so this is a crop, never an upscale.
 *
 * BUILT ON position:sticky AND A rAF-THROTTLED MEASURE, exactly as motion/scrolly.js does
 * it, and for the same reasons: the browser does the pinning, so the scrollbar stays
 * honest, Ctrl+F still works, and the inertial scroller in motion.js needs no special case.
 * Intercepting the wheel to fake a pin is what earns this technique its bad name.
 *
 * NO LIBRARY. The reference implementation drives this with GSAP ScrollTrigger, which is
 * seventy kilobytes to do what one getBoundingClientRect and a division do here. This site
 * has no build step and no node_modules.
 *
 * IT MUST SURVIVE HAVING NO FRAMES AT ALL.
 * The renders are produced separately and may not be deployed yet. A canvas that stays
 * black in the middle of a portfolio is worse than no section, so nothing is revealed until
 * the first frame has actually decoded.
 */
(function () {
  "use strict";

  var F = window.AQCoatFrames;
  if (!F) return;

  var reduce = false, coarse = false;
  try {
    reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    coarse = window.matchMedia("(max-width: 1024px)").matches ||
             window.matchMedia("(pointer: coarse)").matches;
  } catch (e) {}

  /* THE LAYOUTS WHERE NOTHING TRAVELS. Under 900px the stylesheet unpins the stage and
     stacks the copy, and reduced motion does the same: in both, all three blocks are on
     screen at once and the figure stands still in the middle. The script has to agree with
     that or it will keep writing an inline opacity of 0 over copy the stylesheet has just
     made permanent, and a phone would show three invisible paragraphs. Read live rather
     than captured once, because a window can be resized across the breakpoint. */
  var flatMq = null;
  try { flatMq = window.matchMedia("(max-width: 900px)"); } catch (e) {}
  function flat() { return reduce || !!(flatMq && flatMq.matches); }

  /* THE CAMERA MOVE, as two numbers.
     Starts wide with air around the figure and ends closer on the upper body. ZOOM_TO is
     the one to be careful with: at 1.16 the drawn height on a 900px stage is about 1044px
     against an 1100px source, so it is still a crop rather than a magnification. Raising it
     much past 1.2 starts to soften the image on tall screens. */
  var ZOOM_FROM = 0.86, ZOOM_TO = 1.20;
  /* Where the frame settles vertically, as a fraction of the stage height. Positive moves
     the image down, so the push crops from the BOTTOM — the trousers, which the model cuts
     off at the shin anyway — and ends framed on the coat and the face. That is the crane
     half of the move, and what stops a straight zoom feeling like a slide projector. */
  var PAN_TO = 0.10;

  /* MEASURED FROM THE FRAMES THEMSELVES, not guessed.
     Sampling eight frames across the rotation: the figure fills 97.6% of the frame's HEIGHT
     — there is essentially no vertical margin to crop — and at its widest, face-on with the
     coat flared, spans 59.5% of the WIDTH. Across every frame the union of his extents runs
     from 15.8% to 77.6%, so he is centred at 46.7% rather than 50%.

     Both numbers earn their keep. The height figure says the image must be fitted to the
     stage height, never "contained": contain in a narrow column would fit to width and
     leave him small with air above and below. The width figure is what lets the push-in be
     clamped so the column can crop the empty margins away without ever clipping him. */
  var FIG_W = 0.62, FIG_CX = 0.467;

  /* AND A CEILING ON HOW WIDE HE MAY BE DRAWN, as a fraction of the stage width.
     He is fitted to the stage HEIGHT, which is right on every ordinary screen and wrong on
     a tall narrow one. Measured in a 1000x1200 window: the fit made him 74% of the page
     wide, his painted alpha reached 0.322 from the left, and the copy column — already
     pulled in by the stylesheet for exactly this shape — started at 0.330. Eight
     thousandths of a page between a headline and his shoulder.

     Narrowing the copy again would have been the wrong fix: it treats the symptom on one
     window size and leaves the next one to be found by a reader. The clamp belongs on the
     figure, where it holds at every aspect ratio at once. At 0.50 he never crosses the
     middle of the stage, so at either station there is always half a page of clear ground
     on the far side for the words. It costs nothing on ordinary screens: at 1440x900 the
     deepest push-in draws him 0.465 wide and never reaches this at all. */
  /* Narrowed from 0.50 when he moved to the centre. Standing in the middle he has copy on
     BOTH sides rather than one, so half the stage is no longer his to fill: at 0.40 he
     spans 30% to 70% of the width and the columns either side of him stay clear. Measured
     at 1440x900 there is a 36px gutter, and it only opens up on anything wider. */
  var FIG_MAX = 0.40;

  /* Ease-out. A linear push-in reads as mechanical: it arrives at the close-up at the same
     speed it left the wide, and the shot never appears to settle. */
  function ease(t) { return 1 - Math.pow(1 - t, 2.2); }

  /* ========================= THE TIMELINE =========================
   *
   * SIX PHASES: he arrives on the RIGHT, holds while you read, crosses to the LEFT, holds,
   * crosses back to the RIGHT, holds. Scroll position picks the phase; the phase drives
   * where he is, how fast he is turning, and which block of copy is on screen.
   *
   * THE FIRST VERSION HAD NO PHASES AND IT SHOWED. His position came from one path function
   * while the copy's opacity came from whichever block happened to be nearest the middle of
   * the window, so the two were only loosely related: he was still travelling while a
   * paragraph faded up over him, and the crossings went past far too fast to watch. Reading
   * and moving were competing for the same seconds.
   *
   * NOW THEY ARE SEPARATED IN TIME, WHICH IS THE ONLY WAY TO GUARANTEE IT. A hold shows one
   * block and he barely turns; a crossing shows NO copy at all and he travels. They cannot
   * overlap because there is no scroll position at which both are scheduled — see BLOCKS
   * below, whose windows sit strictly inside the holds.
   *
   * THE FRAME SEQUENCE IS REMAPPED, NOT LINEAR, and that remap is what makes the pacing
   * affordable. The renders have two fixed joins: a body appears at frame 90 and a head at
   * frame 180, which is 0.214 and 0.429 of the sequence. Advancing frames in step with
   * scroll would drop both of those inside a hold, where a limb appearing while he stands
   * still is exactly what a dropped frame looks like. Instead the sequence crawls through a
   * hold and runs through a crossing, so both joins land mid-flight where the movement
   * carries them — and the holds still cost real scrolling without costing rotation.
   */
  /* THE THIRD PAUSE USED TO RUN TO 0.29 OF THE RUNWAY — 157vh, nearly twice either of the
     others — and it read exactly as he described it: the section stopped rather than
     finished. The pauses are even now, and the last one ends promptly so the pinned layer
     releases and the page moves on to the next section. Against a 480vh travel that is
     about 82vh of scrolling for each of the first two pauses and 96vh for the closing one,
     which is where it was before for the first two — only the tail has been cut. */
  /* HE NO LONGER CROSSES THE PAGE. HE STANDS IN THE MIDDLE AND THE PAGE TURNS AROUND HIM.
     Travelling was the right answer for a while, but it was solving the wrong problem: it
     kept a mostly-static picture interesting by moving it. Standing him still and bringing
     the stages to him puts the attention on the one thing that should hold it — the man
     turning — and it is what every product page built this way does, for that reason.

     So the stations are all centre now, and what used to be a crossing is a TURN: he
     rotates, the page is quiet, and then the next stage arrives from the opposite side to
     the last. The rhythm is deliberately untouched — arrive, hold, turn, hold, turn, hold —
     because the pacing is the part that took three rounds to get right. Only the reason for
     the movement has changed. */
  var PHASES = [
    /* ends at   x (all centre)   sequence progress   turning?   what happens */
    { to: 0.10, x: 0.5, f: 0.06, turn: false },   // forms out of smoke, centre stage
    { to: 0.27, x: 0.5, f: 0.14, turn: false },   // HOLD — clinical practice
    { to: 0.45, x: 0.5, f: 0.30, turn: true },    // TURN: the body arrives mid-rotation
    { to: 0.62, x: 0.5, f: 0.40, turn: false },   // HOLD — research and peer review
    { to: 0.80, x: 0.5, f: 0.52, turn: true },    // TURN: the head arrives mid-rotation
    { to: 1.01, x: 0.5, f: 1.00, turn: false }    // HOLD — quality and accreditation
  ];
  /* Flagged now rather than derived. It used to be read off the x — a phase that ended
     somewhere else was a crossing — which was self-checking and neat, and stopped meaning
     anything the moment every station became the same place. */
  function isCrossing(i) { return i > 0 && !!PHASES[i].turn; }

  /* A SETTLE, NOT A DIP. It used to be the drop through the middle of a crossing, which is
     what made the travel read as diagonal rather than as sliding along a rail. There is no
     crossing to arc through any more, so it is now a small sink and lift through each turn —
     just enough weight that the rotation is something he does rather than something done to
     him. Take it to zero and he turns like a display model on a motor. */
  var DIP = 0.035;

  /* Ease in and out. A crossing that starts and stops abruptly reads as a jump cut; one
     that accelerates away and decelerates in reads as travel. */
  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* Everything the draw needs, from one walk of the table: where he is across the stage,
     how far he has dipped, and how far through the rendered sequence he has turned. */
  function stateAt(p) {
    var from = 0, prevX = PHASES[0].x, prevF = 0;
    for (var i = 0; i < PHASES.length; i++) {
      var ph = PHASES[i];
      if (p < ph.to) {
        var span = ph.to - from;
        var t = span > 0 ? (p - from) / span : 1;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var e = easeInOut(t);
        var moving = isCrossing(i);
        return {
          x: prevX + (ph.x - prevX) * e,
          /* Frames ease through a crossing and run plainly through a hold. Easing the
             rotation during a hold would make him visibly speed up and slow down while he
             is supposed to be standing still, which is the one thing a hold must not do. */
          f: prevF + (ph.f - prevF) * (moving ? e : t),
          dip: moving ? Math.sin(e * Math.PI) * DIP : 0,
          moving: moving
        };
      }
      from = ph.to; prevX = ph.x; prevF = ph.f;
    }
    return { x: prevX, f: 1, dip: 0, moving: false };
  }

  /* WHEN EACH BLOCK OF COPY IS ON SCREEN: in, hold, out, as four scroll positions.
     Every window sits strictly inside one of the holds above, so a block has finished
     fading out before he starts moving and the next one does not begin until he has
     stopped. That is the guarantee, and coat-scrub.test.js asserts it rather than trusting
     these numbers to stay right: no window may overlap any crossing.
     The gaps are deliberate. A beat of empty page between two statements is what stops the
     section reading as a slideshow on a timer. */
  var BLOCKS = [
    [0.115, 0.150, 0.235, 0.265],
    [0.465, 0.500, 0.585, 0.612],
    /* The last block never fades. Measured at the foot of the section it was down to 0.74
       with the runway spent, so a reader left the page on a half-dissolved paragraph. Held
       to the end instead, the stage simply unpins and the whole tableau — figure, words and
       all — scrolls away together, which is a far better exit than the words evaporating
       off a figure that stays. */
    [0.815, 0.850, 1.010, 1.020]
  ];
  /* WHERE EACH BLOCK IS ON ITS WAY ROUND HIM: -1 approaching, 0 facing the reader, +1
     leaving. He said the section did not feel like it was revolving, and he was right —
     the copy was only fading, and a fade on its own is a slideshow. Turning each block on
     its own vertical axis as it arrives and leaves is what makes the three stages read as
     panels on a carousel going round the man in the middle, rather than captions being
     swapped underneath him.
     Same windows as the opacity, so a block is never turning while it is legible: it
     arrives, squares up to the reader for the whole hold, and turns away again. */
  function blockRevolve(p, i) {
    var b = BLOCKS[i];
    if (!b || p <= b[0]) return -1;
    if (p < b[1]) return -1 + (p - b[0]) / (b[1] - b[0]);
    if (p <= b[2]) return 0;
    if (p < b[3]) return (p - b[2]) / (b[3] - b[2]);
    return 1;
  }

  function blockAlpha(p, i) {
    var b = BLOCKS[i];
    if (!b || p <= b[0] || p >= b[3]) return 0;
    if (p < b[1]) return (p - b[0]) / (b[1] - b[0]);
    if (p <= b[2]) return 1;
    return 1 - (p - b[2]) / (b[3] - b[2]);
  }

  /* Which side of the page each block takes: the side he is NOT on while it is up.
     Read from the table rather than written into the markup, so moving a station moves the
     words with it instead of leaving them stranded on top of him. */
  /* WHICH SIDE EACH STAGE ARRIVES ON. It used to be read off the station table — the side
     he was NOT standing on — which was the right answer while he crossed the page and is no
     answer at all now he is always in the middle. Alternating is the honest replacement,
     and it is a real property of the sequence rather than a fact about geometry that no
     longer exists: each stage arrives opposite the last, so the page reads as turning
     around him. */
  function blockSide(i) { return i % 2 === 0 ? "left" : "right"; }


  /* ===================== THE RIDER: HE BECOMES THE TIMELINE =====================
   *
   * When the section lets go, he does not simply scroll away. He shrinks, drops to the
   * middle of the page, comes to the FRONT of the whole site, and takes over the job the
   * glowing blue head was doing on the experience timeline: riding down the spine as you
   * read, spinning, and stopping exactly where the line stops.
   *
   * HE RIDES THE REAL LINE'S PATH, NOT A COPY OF IT. founder-motion.js fills the spine from
   * one measurement — a reading line 45% down the viewport — so the head sits at
   * timelineTop + p * timelineHeight, which in viewport terms means it PARKS at 45% of the
   * screen for the whole of the timeline and clamps at either end. That is the path
   * reproduced here from the same numbers, so the two cannot drift apart: change the 0.45
   * in founder-motion.js and both move together. He replaces the head; the drawn line stays
   * as the trail he leaves behind him.
   *
   * THE SPIN IS A TURNTABLE OF ONE FRAME, NOT THE RENDERED SEQUENCE, and that is measured
   * rather than chosen. The 420 renders are ONE 360-degree turn shared across three build
   * stages: frame 1 and frame 420 differ by 11 on a per-pixel silhouette compare where the
   * midpoint differs by 34, so the sequence closes the loop. But the complete figure only
   * exists from frame 181, which leaves 205 degrees — looping that range would jump 155
   * degrees every turn, and stepping outside it would show the empty coat again halfway
   * down the timeline. So the rider takes the frame the section itself ends on and spins it
   * about its own vertical axis with a horizontal squash, the standard way a coin is turned
   * in two dimensions. Unlimited turns, no seam, and because it is a pure function of
   * scroll it unwinds exactly like everything else here.
   */
  var RIDE_MIN = 96, RIDE_MAX = 150;   // how tall he is once he is riding, in CSS pixels

  /* HE TUMBLES; HE DOES NOT FLIP. The first version turned him with a horizontal squash —
     the standard two-dimensional coin flip — and it read exactly as what it was: a flat
     cutout being squeezed. A squash is the one transform that tells the eye there is no
     depth, because a solid object turning never loses width without also changing what you
     can see of it.

     Three things replace it, and they are all needed together:

       1. TUMBLE — the sprite rotates in the picture plane, head over heels, the way a chess
          piece knocked off a board actually falls. This is what makes it read as a falling
          OBJECT rather than a sliding image.
       2. A REAL TURN — the frame index moves through the rendered sequence while he falls,
          so the geometry the viewer sees genuinely changes: shoulders come round, the coat
          swings, the face leaves and returns. No transform can fake that, and it is the
          part that actually carries the three dimensions.
       3. DEPTH — he grows and shrinks slightly through the tumble, as something turning
          towards and away from you does.

     AND HE DOES NOT FALL STRAIGHT DOWN. A rigid vertical slide is the other half of what
     made it look like a sprite on rails, so he swings across the line as he descends and
     the fall reads as diagonal. */
  var TUMBLES = 3;         // head-over-heels turns across the ride. Whole, so he lands upright.
  var HANDOFF_TUMBLE = 1;  // and one more while he shrinks into place. Whole, for the same reason.
  var SWINGS = 2;          // crossings of the line on the way down. Whole, so he lands ON it.
  var SWING_AMP = 0.055;   // how far he swings either side, as a fraction of the viewport width
  var SPINS = 2;           // how many times the rendered turn sweeps out and back
  var DEPTH = 0.16;        // how much nearer and further he reads through a tumble

  /* THE RENDERED TURN ONLY EXISTS FROM FRAME 181, and that bound is the whole reason this
     is a sweep rather than a loop. The 420 renders are one 360-degree turn shared across
     three build stages — measured, frame 1 against frame 420 differs by 11 on a per-pixel
     silhouette compare where the midpoint differs by 34, so the sequence closes — but the
     complete figure covers only the last 205 degrees of it. Looping that range jumps 155
     degrees a turn; stepping below it puts the empty coat back on screen halfway down the
     timeline. So the frame index sweeps up and down inside the safe range on a cosine,
     which reverses smoothly and never leaves it. */
  var TURN_LO = 181 / 420;

  /* The three curves, as pure functions of the two progresses — how far through the
     handover (t) and how far down the line (p). Out here rather than inline in the draw so
     the end conditions can be exercised directly: that he leaves the handover upright, that
     he lands upright and on the line, and above all that the frame index never once leaves
     the range in which the complete figure exists. */
  function rideTumble(t, p) { return (HANDOFF_TUMBLE * t + TUMBLES * p) * Math.PI * 2; }

  /* THE REAL TUMBLE, ON THREE AXES, for the 3D renderer. A turntable render turns about
     ONE axis and can never do this: rotating the actual model 90 degrees in pitch gives a
     48x27 silhouette where the standing figure is 55x88 — he is lying flat, seen from
     above, and no frame in the 420 contains that picture. Pitch dominates, because that is
     how a piece knocked off a board falls; the yaw and roll are slower and coprime with it,
     so the tumble never repeats the same attitude twice on the way down.
     Whole numbers again, for the reason they are whole everywhere else here: at the end of
     the handover and at the foot of the line every axis is back at zero, so he leaves
     upright and lands upright rather than embedded in the page at an angle. */
  var TUMBLE_X = 3, TUMBLE_Y = 2, TUMBLE_Z = 1;
  function rideSpin(t, p) {
    var TAU = Math.PI * 2;
    return {
      rx: (HANDOFF_TUMBLE * t + TUMBLE_X * p) * TAU,
      ry: (t + TUMBLE_Y * p) * TAU,
      rz: (t + TUMBLE_Z * p) * TAU
    };
  }
  function rideSwing(t, p) { return Math.sin((t + SWINGS * p) * Math.PI * 2) * SWING_AMP; }
  function rideDepth(t, p) { return 1 + DEPTH * Math.sin((HANDOFF_TUMBLE * t + TUMBLES * p) * Math.PI); }
  function rideFrame(t, p) {
    var osc = 0.5 + 0.5 * Math.cos((t * 0.35 + p * SPINS) * Math.PI * 2);
    return TURN_LO + (1 - TURN_LO) * osc;
  }

  /* The reading line founder-motion.js measures the spine against. Duplicated deliberately
     and named, rather than read from the other file: they are one number in two places and
     this comment is the link between them. */
  var READ_LINE = 0.45;

  function rideHeight(vh) {
    return Math.max(RIDE_MIN, Math.min(RIDE_MAX, vh * 0.16));
  }

  /* Where he is drawn, at any point between letting go of the section (t = 0) and riding
     the spine (t = 1). t = 0 REPRODUCES THE SECTION'S OWN GEOMETRY EXACTLY — same scale,
     same centre — which is what makes the handover invisible: there is no crossfade, the
     fixed layer simply starts painting the identical picture the sticky one was painting,
     and then moves it. Everything is in CSS pixels. */
  function ridePlace(t, vw, vh, spineX, spineY) {
    /* The section at the foot of its runway: fitted to the stage height, pushed all the way
       in, clamped by his measured width, and standing at the last station. */
    var h0 = Math.min(vh * ZOOM_TO, (vw * FIG_MAX) / FIG_W);
    var x0 = (vw - h0) / 2 + (0.5 - FIG_CX) * h0 + (PHASES[PHASES.length - 1].x - 0.5) * vw;
    var cx0 = x0 + h0 * FIG_CX;
    var cy0 = (vh - h0) / 2 + vh * PAN_TO + h0 / 2;

    var h1 = rideHeight(vh);
    var e = easeInOut(t < 0 ? 0 : t > 1 ? 1 : t);
    return {
      h: h0 + (h1 - h0) * e,
      cx: cx0 + (spineX - cx0) * e,
      cy: cy0 + (spineY - cy0) * e
    };
  }

  /* ======================== THE ENERGY FIELD ========================
   *
   * WHY THE FIRST VERSION LOOKED CHEAP, since it is the whole reason this one is different.
   * It drew lightning as vector strokes over a photoreal render: hard-edged, evenly
   * coloured lines laid on top of a lit, textured, three-dimensional figure. Two visual
   * languages in one frame. Thinning the lines or dropping their opacity does not fix that,
   * because the mismatch is not weight — it is that DRAWN MARKS SIT ON A PICTURE while
   * light BELONGS TO IT.
   *
   * The single thing that sells energy near a person is that it lights them. So most of the
   * work here is not bolts at all:
   *
   *   1. A HALO taken from his own silhouette. His alpha is blurred and tinted, and painted
   *      behind him, so the glow hugs the real outline of his coat and hair rather than
   *      being a circle he happens to stand in. This is what makes it read as belonging to
   *      the scene, and it is the reason the figure now looks lit rather than pasted.
   *   2. SPILL painted back ONTO him with source-atop, so the colour lands on the fabric
   *      and falls off across his body. Light that never touches the subject is the tell
   *      that gives away every cheap overlay.
   *   3. DUST, last and least. Motes hanging in the air, turning as he turns. This replaced
   *      lightning for the same reason the halo exists: anything with a hard edge or a
   *      deliberate shape announces that it was added afterwards. Dust has no shape to get
   *      wrong, so a viewer reads it as air rather than as an effect.
   *
   * Everything is still a pure function of scroll position, so it all unwinds exactly.
   */
  /* THE HANDOVERS, AND WHY THE FIELD FLARES AT THEM.
     The sequence is three renders end to end: the empty coat turning alone (frames 1-90),
     the coat with a body inside it (91-180), and the whole man (181-420). Each join is one
     frame in which a body, and then a head, simply exists where it did not before.
     Un-marked, that reads as a dropped frame or a mistake in the render.
     Lit, it reads as the reason. So the energy peaks exactly there and falls away over
     about thirty frames either side — the light causes the arrival rather than merely
     coinciding with it, which is the difference between an effect and an accident.

     Expressed as SEQUENCE progress, not scroll progress, and that distinction now matters:
     the frames no longer advance in step with the scrollbar. A flare pinned to scroll would
     fire in the middle of a hold, tens of frames away from the join it is meant to be
     lighting. It is a function of how far he has TURNED, and never of time, so it still
     unwinds exactly. 90/420 and 180/420. */
  var HANDOVERS = [90 / 420, 180 / 420];
  var FLARE_W = 0.035;
  function flare(p) {
    var out = 0;
    for (var i = 0; i < HANDOVERS.length; i++) {
      var d = Math.abs(p - HANDOVERS[i]);
      if (d < FLARE_W) {
        /* Squared, so the peak is sharp and the tails are quiet. A linear ramp reads as a
           slow swell and loses the sense that something happened at a moment. */
        var t = 1 - d / FLARE_W;
        out = Math.max(out, t * t);
      }
    }
    return out;
  }
  var HALO = [
    /* blur, spread, alpha — three passes make a falloff; one makes a sticker */
    { blur: 1.00, alpha: 0.34 },
    { blur: 0.39, alpha: 0.26 },
    { blur: 0.15, alpha: 0.20 }
  ];

  /* Deterministic integer hash, -1..1. The same input always gives the same output, which
     is the entire reason the field can be scrubbed backwards.

     Math.imul IS THE POINT, AND LEAVING IT OUT PRODUCED A BUG WITH NO ERROR MESSAGE.
     The textbook version is written for C, where integer multiplication wraps. In
     JavaScript every number is a double, so at n around 2^31 the product reaches 2^76 —
     past the 2^53 a double holds exactly — and the low bits, where a hash keeps all its
     entropy, are rounded away before the mask sees them. Measured with the naive version:
     258 distinct values from 4000 inputs, every bolt handed the same coordinates, and the
     jitter returning exactly 1.000 every time. With Math.imul: 3606 from 4000. */
  function nz(n) {
    n = n | 0;
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    n = n ^ (n >>> 16);
    return ((n >>> 0) / 4294967295) * 2 - 1;
  }

  /* A point on the sphere around him, turned by the same angle the figure has turned. */
  function orbitPoint(u, v, rad, ang, cx, cy, R) {
    var theta = u * Math.PI, phi = v * Math.PI * 2 + ang;
    var sy = Math.cos(theta), sr = Math.sin(theta);
    return { x: cx + Math.sin(phi) * sr * rad * R,
             y: cy + sy * rad * R * 1.05,
             z: Math.cos(phi) * sr };
  }

  /* THE HALO. His own alpha, blurred and tinted, painted behind him.
     Rebuilt only when the FRAME changes, not on every scroll pixel: the blur is the one
     expensive operation here and the silhouette cannot have changed while the frame has
     not. */
  var lastP = 0;   // the progress of the frame being drawn, for the halo cache key
  var silh = null, silhCtx = null, silhKey = "";
  function haloFor(img, w, h, rgb) {
    /* THE SOURCE IS SOMETIMES A CANVAS, NOT AN IMAGE. While he is assembling, the halo has
       to hug the part of him that exists so far, so what arrives here is the masked canvas
       rather than the frame — and a canvas has no .src to key a cache on. Keying on the
       mask's own threshold instead is not just a guard against a crash: caching the halo
       across two different assembly steps would draw the glow of a body he has not grown
       yet, which is the exact thing the masking exists to prevent. */
    /* A canvas has no .src. While the head is arriving the source IS a canvas, and its
       contents change every scroll step, so the key must move with it — a cached halo here
       would glow around a head that has not finished appearing. */
    var id = img.src ? img.src.slice(-24) : "fade" + Math.round(headAlpha(lastP) * 100);
    var key = id + "|" + Math.round(w) + "x" + Math.round(h) + "|" + rgb;
    if (silhKey === key && silh) return silh;
    if (!silh) { silh = document.createElement("canvas"); silhCtx = silh.getContext("2d"); }
    silh.width = Math.max(1, Math.round(w));
    silh.height = Math.max(1, Math.round(h));
    var s = silhCtx;
    s.clearRect(0, 0, silh.width, silh.height);
    s.drawImage(img, 0, 0, silh.width, silh.height);
    /* Keep the shape, throw away the picture: everything inside his outline becomes one
       flat colour, which is what a light source shining from behind him would look like. */
    s.globalCompositeOperation = "source-in";
    s.fillStyle = "rgb(" + rgb + ")";
    s.fillRect(0, 0, silh.width, silh.height);
    s.globalCompositeOperation = "source-over";
    silhKey = key;
    return silh;
  }

  function drawField(ctx, img, x0, y0, w, h, cx, cy, R, ang, rgb, strength, p, phase) {
    if (strength <= 0) return;

    if (phase === "halo") {
      var sil = haloFor(img, w, h, rgb);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (var g = 0; g < HALO.length; g++) {
        /* A slow breathe rather than a flicker. It used to be keyed to the lightning's
           strike tick; with dust there is nothing to strike, and a stepped pulse under a
           drifting field would be the one hard edge in an effect built entirely out of
           soft ones. Smooth, driven by scroll position, so it still unwinds exactly. */
        var pulse = 0.87 + 0.13 * Math.sin(p * 17 + g * 2.1);
        ctx.globalAlpha = HALO[g].alpha * (skin.halo / 0.34) * strength * pulse;
        /* filter is not universal; without it the halo simply becomes a soft double of the
           silhouette, which still reads as glow rather than as nothing. */
        /* Blur radii are fractions of the theme's own radius, so one number in CSS moves the
           whole falloff from a wide soft glow to a tight readable outline. */
        var br = HALO[g].blur * skin.blur;
        try { ctx.filter = "blur(" + br.toFixed(1) + "px)"; } catch (e) {}
        var grow = br * 0.35;
        ctx.drawImage(sil, x0 - grow, y0 - grow, w + grow * 2, h + grow * 2);
        try { ctx.filter = "none"; } catch (e) {}
      }
      ctx.restore();
      return;
    }

    if (phase === "spill") {
      /* LIGHT LANDING ON HIM. source-atop paints only where the figure already is, so this
         is colour on fabric rather than a wash floating over the scene. Angled from the
         side the field is currently strongest on, so it travels as he turns. */
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      var lx = x0 + w * (0.5 + 0.42 * Math.cos(ang));
      var ly = y0 + h * 0.42;
      var gr = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * 0.78);
      gr.addColorStop(0, "rgba(" + rgb + "," + (skin.spill * strength).toFixed(3) + ")");
      gr.addColorStop(0.45, "rgba(" + rgb + "," + (skin.spill * 0.4 * strength).toFixed(3) + ")");
      gr.addColorStop(1, "rgba(" + rgb + ",0)");
      ctx.fillStyle = gr;
      ctx.fillRect(x0, y0, w, h);
      ctx.restore();
      return;
    }

    /* ---- the dust ---- */
    drawDust(ctx, cx, cy, R, ang, rgb, phase === "front", strength, p);
  }

  /* ---------------------------- THE DUST ----------------------------
   *
   * Motes hanging in the air around him, turning as he turns. This replaced lightning, and
   * the reason is the same one that made the lightning look cheap in the first place: drawn
   * marks sit on a picture, and anything with a hard edge or a deliberate shape announces
   * that it was added afterwards. Dust has no shape to get wrong. It is soft, it is out of
   * focus, and a viewer reads it as air rather than as an effect — which is exactly why the
   * reference site uses it.
   *
   * IT DOES NOT FLICKER, AND THAT IS THE POINT.
   * Lightning had to re-strike, which meant indexing strikes to scroll ticks. Dust simply
   * drifts. Every mote has a fixed home in the volume around him and moves only because he
   * turns and because it rises slowly with the scroll. Nothing is random per frame, so
   * scrolling back does not merely reverse it — it retraces it exactly.
   *
   * DRAWN FROM A SPRITE, NOT A GRADIENT PER MOTE.
   * A hundred and sixty radial gradients built every scroll frame is real work for no
   * benefit; every mote is the same soft disc at a different size and opacity. So one disc
   * is rendered once into a small offscreen canvas and stamped, which is a fraction of the
   * cost and lets the count go high enough to read as air rather than as confetti.
   *
   * Split front and back around the figure like everything else on this stage, so motes
   * pass behind his shoulder and drift back across the coat.
   */
  var MOTES = 160;

  var moteCv = null, moteKey = "";
  function moteSprite(rgb) {
    if (moteCv && moteKey === rgb) return moteCv;
    var S = 32;
    moteCv = document.createElement("canvas");
    moteCv.width = moteCv.height = S;
    var c = moteCv.getContext("2d");
    var g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    /* A hot-ish core and a long tail. Dust catching light is bright in the middle and
       fades to nothing well before its edge; a disc with a defined rim reads as a dot. */
    g.addColorStop(0, "rgba(" + rgb + ",1)");
    g.addColorStop(0.25, "rgba(" + rgb + ",0.42)");
    g.addColorStop(1, "rgba(" + rgb + ",0)");
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    moteKey = rgb;
    return moteCv;
  }

  function drawDust(ctx, cx, cy, R, ang, rgb, front, strength, p) {
    if (strength <= 0) return;
    var sp = moteSprite(rgb);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < MOTES; i++) {
      var s = i * 7919;
      /* A fixed home in a column of air around him: height, angle, distance from the axis.
         Distance is biased outward so the volume does not crowd against his body, where
         motes would read as marks ON the coat rather than as air in front of it. */
      var hgt = nz(s) * 1.15;
      var rad = 0.42 + Math.abs(nz(s + 2)) * 0.92;
      /* Parallax: nearer motes swing further than distant ones as he turns. Locking them
         all to exactly his rotation makes the air look welded to him. */
      var lag = 0.80 + Math.abs(nz(s + 3)) * 0.35;
      var phi = (nz(s + 1) * 0.5 + 0.5) * Math.PI * 2 + ang * lag;
      /* And a slow rise with the scroll, at each mote's own rate, so the field breathes
         instead of turning as one rigid shell. */
      var rise = p * (0.05 + Math.abs(nz(s + 4)) * 0.22) * (nz(s + 5) > 0 ? 1 : -1);

      var z = Math.cos(phi) * rad;
      if ((z >= 0) !== front) continue;

      var x = cx + Math.sin(phi) * rad * R;
      var y = cy + (hgt + rise) * R;
      /* Depth drives size and brightness together, which is what sells a flat canvas as a
         volume of air rather than a sheet of dots. */
      var d = (z / 1.34 + 1) / 2;
      var size = (1.4 + 5.2 * d) * (R / 300) * (0.55 + Math.abs(nz(s + 6)) * 0.9);
      var a = (0.05 + 0.30 * d) * (0.45 + Math.abs(nz(s + 7)) * 0.55) * strength * skin.dust;

      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sp, x - size, y - size, size * 2, size * 2);
    }
    ctx.restore();
  }

  /* "#7C9CFF" -> "124,156,255". Canvas gradients need channels, and the colour is authored
     in CSS so it can be changed without touching this file. */
  function toRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return "124,156,255";
    var n = parseInt(m[1], 16);
    return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
  }

  /* ====================== THE ARRIVAL ======================
   *
   * The coat comes out of a puff of smoke, small and far away, and grows towards the reader
   * while it turns. Then the smoke thins, the body arrives, then the head.
   *
   * WHY THIS REPLACED A DISSOLVE MASK, since the failure is worth remembering.
   * The first attempt revealed him through a per-pixel threshold — a noise field, cheaply
   * computed at 132x198 and scaled up. Scaled up is the problem: a hard threshold has no
   * intermediate values to interpolate, so the browser enlarged it into CHUNKY SQUARE
   * BLOCKS. It did not read as formation, it read as a corrupted JPEG. No amount of tuning
   * the noise would have fixed that, because the artefact came from the hard edge itself.
   *
   * Smoke has no hard edge anywhere. The figure simply fades up through it while big soft
   * puffs expand and thin out. Nothing is masked, nothing is thresholded, and there is
   * nothing to pixelate — the only values in play are opacity and scale, both continuous.
   *
   * AND IT TURNS THE WHOLE TIME. The rotation is not paused for the arrival: the frame
   * index runs from the very first pixel of scroll, so the coat is already turning as it
   * forms, which is what stops the opening looking like a still image being faded in.
   */
  /* THE ARRIVAL IS MEASURED IN SCROLL, NOT IN FRAMES, and it ends exactly where the first
     phase does. The sequence progress now runs at its own pace, so a fixed 0.15 here would
     have left the last of the smoke drifting off him halfway into the first hold — with a
     block of copy already up beside it. Tied to the table, the page cannot drift apart. */
  var ARRIVE = PHASES[0].to;
  var ZOOM_TINY = 0.22; // how small it starts — a speck at the back of the stage
  var PUFFS = 44;

  /* Zoom in two stages. The first is the arrival, fast and eased, from a speck up to the
     wide shot. The second is the slow cinematic push that runs the rest of the section.
     One continuous range could not do both: a single ease from 0.22 to 1.20 spends the
     whole scroll growing and never settles into a shot. */
  function zoomAt(p) {
    if (p < ARRIVE) return ZOOM_TINY + (ZOOM_FROM - ZOOM_TINY) * ease(p / ARRIVE);
    return ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * ease((p - ARRIVE) / (1 - ARRIVE));
  }

  /* How solid the figure is. Nothing at all for the first breath, then up through the
     smoke. Kept clear of 0 and 1 at the ends so there is no visible step. */
  function figureAlpha(p) {
    if (p >= ARRIVE) return 1;
    var t = p / ARRIVE;
    return t <= 0.10 ? 0 : Math.min(1, (t - 0.10) / 0.62);
  }

  /* How much smoke is left. Densest at the very start, gone shortly after he has arrived —
     a little later than the figure finishes fading up, so the last wisps are still drifting
     off him rather than stopping the instant he is solid. */
  function smokeAt(p) {
    var end = ARRIVE * 1.5;
    if (p >= end) return 0;
    var t = 1 - p / end;
    return t * t;          // squared: thick at first, then thins away quickly
  }

  function drawSmoke(ctx, cx, cy, R, ang, rgb, front, strength, p) {
    if (strength <= 0) return;
    var sp = moteSprite(rgb);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < PUFFS; i++) {
      var s = i * 5147 + 31;
      /* Each puff starts near his middle and travels outward as the scroll advances, which
         is what makes it read as a puff dispersing rather than a fog sitting still. */
      var spread = 0.20 + (1 - strength) * (0.55 + Math.abs(nz(s + 3)) * 0.85);
      var phi = (nz(s) * 0.5 + 0.5) * Math.PI * 2 + ang * 0.55;
      var rad = spread * (0.5 + Math.abs(nz(s + 1)) * 1.1);
      var z = Math.cos(phi) * rad;
      if ((z >= 0) !== front) continue;

      var x = cx + Math.sin(phi) * rad * R;
      var y = cy + (nz(s + 2) * 0.85 + (1 - strength) * nz(s + 4) * 0.5) * R;
      /* Puffs GROW as they fade. A cloud that shrinks reads as being sucked away; one that
         expands while thinning is what dispersal actually looks like. */
      var size = (0.26 + 0.40 * (1 - strength) + Math.abs(nz(s + 5)) * 0.22) * R;
      var a = strength * (0.10 + Math.abs(nz(s + 6)) * 0.16);

      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sp, x - size, y - size, size * 2, size * 2);
    }
    ctx.restore();
  }

  /* ---------------------- THE HEAD FADES IN ----------------------
   *
   * Frame 180 has no head and frame 181 does, so without help the head arrives in a single
   * frame. The flare covered the moment but not the fact: it still read as a pop.
   *
   * THE OBVIOUS FIX WOULD HAVE COST A RE-RENDER and this one does not. Cross-fading frame
   * 180 into 181 would fade the head in, but the figure is also turning, so it would ghost
   * two different rotations over each other. Rendering an overlapping headless run would
   * work and means going back to Blender.
   *
   * Instead the frame is drawn TWICE from the same image: once masked to everything below
   * the neck at full opacity, once masked to everything above it at a rising opacity. Same
   * rotation in both halves, because it is the same frame — so the head fades up over the
   * shoulders with nothing ghosting behind it.
   *
   * The mask is a LINEAR GRADIENT, not a threshold. That distinction is the whole reason
   * the earlier dissolve failed: a hard cut has no intermediate values and turns into
   * blocks when scaled. A gradient has nothing but intermediate values.
   */
  var HEAD_AT = 180 / 420;   // the frame where the head first exists
  var HEAD_FADE = 0.075;     // and how much scroll it takes to arrive

  function headAlpha(p) {
    if (p <= HEAD_AT) return 1;              // no head in these frames anyway
    if (p >= HEAD_AT + HEAD_FADE) return 1;  // fully arrived; draw normally
    return (p - HEAD_AT) / HEAD_FADE;
  }

  var splitCv = null, splitCtx = null;
  function splitCanvas(w, h) {
    if (!splitCv) { splitCv = document.createElement("canvas"); splitCtx = splitCv.getContext("2d"); }
    var W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
    if (splitCv.width !== W || splitCv.height !== H) { splitCv.width = W; splitCv.height = H; }
    return splitCv;
  }

  /* Keeps the part of the frame on one side of the neck and throws the rest away, with a
     soft band across the join so there is no visible seam at the collar. */
  function maskHalf(c, cv, img, keepTop) {
    c.clearRect(0, 0, cv.width, cv.height);
    c.drawImage(img, 0, 0, cv.width, cv.height);
    c.globalCompositeOperation = "destination-in";
    /* The neck sits at about a quarter of the way down the frame — measured from the
       renders, where the head spans the top 22% and the collar meets it just below. */
    var neck = cv.height * 0.26, soft = cv.height * 0.055;
    var g = c.createLinearGradient(0, neck - soft, 0, neck + soft);
    g.addColorStop(0, keepTop ? "rgba(0,0,0,1)" : "rgba(0,0,0,0)");
    g.addColorStop(1, keepTop ? "rgba(0,0,0,0)" : "rgba(0,0,0,1)");
    c.fillStyle = g;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = "source-over";
    return cv;
  }

  /* THE FADED FIGURE AS A SINGLE IMAGE, and it has to be a single image.
     The first attempt drew the two halves straight onto the stage at different opacities.
     The head still popped, and the reason was upstream: the HALO is built by blurring the
     figure silhouette, and it was being built from the raw frame — head included, at full
     strength — and painted BEHIND the figure. So a head-shaped glow arrived in one frame
     however gently the head itself faded up over it.

     Composing here instead means the halo, the light spill and the figure all read from
     the same picture, and none of them can know about a head that has not arrived. */
  var outCv = null, outCtx = null;
  function figureFor(img, w, h, p) {
    var ha = reduce ? 1 : headAlpha(p);
    if (ha >= 1) return img;          // the common case: no offscreen work at all
    var cv = splitCanvas(w, h), c = splitCtx;
    var W = cv.width, H = cv.height;
    if (!outCv) { outCv = document.createElement("canvas"); outCtx = outCv.getContext("2d"); }
    if (outCv.width !== W || outCv.height !== H) { outCv.width = W; outCv.height = H; }
    var o = outCtx;
    o.clearRect(0, 0, W, H);
    o.globalAlpha = 1;
    o.drawImage(maskHalf(c, cv, img, false), 0, 0);   // shoulders down, solid
    o.globalAlpha = ha;
    o.drawImage(maskHalf(c, cv, img, true), 0, 0);    // head, rising
    o.globalAlpha = 1;
    return outCv;
  }

  /* THE PALETTE IS READ FROM CSS, AND RE-READ WHEN THE THEME CHANGES.
     A white coat on the light theme's white page measures 1.04:1 — the rim is the only
     thing drawing the silhouette, so it has to be tighter and stronger there than on dark.
     Those four numbers are design decisions and they live in the stylesheet; a design
     decision inside a script is one nobody can change without a deploy. */
  var skin = { rgb: "39,67,201", blur: 22, halo: 0.55, dust: 0.42, spill: 0.10 };
  function readSkin(host) {
    var cs = getComputedStyle(host);
    function n(name, dflt) {
      var v = parseFloat(cs.getPropertyValue(name));
      return isFinite(v) ? v : dflt;
    }
    skin.rgb = toRgb((cs.getPropertyValue("--coat-aura") || "").trim() || "#2743C9");
    skin.blur = n("--coat-halo-blur", 22);
    skin.halo = n("--coat-halo-alpha", 0.55);
    skin.dust = n("--coat-dust-alpha", 0.42);
    skin.spill = n("--coat-spill", 0.10);
  }

  function init() {
    var host = document.querySelector("[data-coat]");
    if (!host || host.getAttribute("data-coat-on") === "1") return;

    /* THE COPY IS BUILT FROM founder-data.js, NOT TYPED INTO THE PAGE, so on the first pass
       at DOMContentLoaded there may be no blocks here yet. Bail WITHOUT latching: claiming
       the section now would shut the door on the aq:content pass that brings the words, and
       the figure would travel the whole page past three empty holds. */
    if (!host.querySelector("[data-beat]")) return;
    host.setAttribute("data-coat-on", "1");

    var total = parseInt(host.getAttribute("data-frames"), 10);
    var pattern = host.getAttribute("data-src");
    if (!(total > 0) || !pattern) return;

    var canvas = host.querySelector("canvas");
    var stage = host.querySelector("[data-coat-stage]");
    if (!canvas || !stage) return;
    var ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    var beats = [].slice.call(host.querySelectorAll("[data-beat]"));
    /* WHICH SIDE EACH BLOCK TAKES IS DECIDED HERE, NOT IN THE MARKUP OR BY nth-child.
       PHASES is the only thing that knows which side he is standing on while a given block
       is up, and he no longer simply alternates — he ends the section back where he began,
       so blocks one and three share a side. Counting elements in CSS would put the last
       paragraph directly on top of him. */
    for (var bi = 0; bi < beats.length; bi++) {
      if (BLOCKS[bi]) beats[bi].setAttribute("data-side", blockSide(bi));
    }

    /* AUTHORED IN CSS, NOT HERE. The aura colour is a design decision that will be
       argued about, and a design decision that lives in a script is one nobody can change
       without a deploy. Read once at start-up from --coat-aura, with the accent as the
       fallback if the variable is ever removed. */
    readSkin(host);
    /* The theme can change while the page is open, and the rim must change with it or a
       light-theme reader gets the pale glow that measures 2.45:1 on white. */
    try {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) mq.addEventListener("change", function () { readSkin(host); drawn = -1; onScroll(); });
    } catch (e) {}
    new MutationObserver(function () { readSkin(host); drawn = -1; onScroll(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    /* On a phone the sequence is thinned rather than dropped: the figure still turns all
       the way round, in fewer steps nobody can pick out on a 390px screen, for a quarter of
       the bytes. Reduced motion takes one frame — the pose, and none of the movement. */
    var indices = reduce ? [0] : F.subset(total, coarse ? Math.min(total, 96) : total);
    var n = indices.length;

    var imgs = new Array(n), ready = new Array(n), got = 0;
    var want = 0, drawn = -1, drawnAt = -1, prog = 0, ticking = false, revealed = false;


    /* ---- the rider layer ----
       A fixed, full-viewport canvas ABOVE the page. z-index sits over the sticky header so
       he genuinely passes in front of the site, and under the search overlay and modals so
       he can never end up on top of something a reader is trying to use. It never takes a
       click: pointer-events are off, so the timeline underneath stays as interactive as it
       was. Created here rather than in the markup because it only exists when the frames
       do — a page without renders should not carry an empty fixed layer. */
    var ride = document.getElementById("fExp") || document.querySelector(".fp-timeline");
    var riderEl = null, riderCv = null, riderCtx = null, riderOn = false, gl = null;

    function riderLayer() {
      if (riderEl) return riderEl;
      riderEl = document.createElement("div");
      riderEl.className = "coat-rider";
      riderEl.setAttribute("aria-hidden", "true");
      riderCv = document.createElement("canvas");
      riderEl.appendChild(riderCv);
      /* TWO CANVASES, STACKED. The 2D one keeps the pool of light — a glow is trivial in
         2D and a nuisance in WebGL — and draws the sprite when there is no 3D. The WebGL
         one sits over it and carries the model. When 3D is running the 2D canvas holds
         only the glow, so the figure is never drawn twice. */
      gl = document.createElement("canvas");
      gl.className = "coat-rider-gl";
      riderEl.appendChild(gl);
      document.body.appendChild(riderEl);
      riderCtx = riderCv.getContext("2d", { alpha: true });
      if (window.AQCoat3D && window.AQCoat3D.mount) window.AQCoat3D.mount(gl);
      return riderEl;
    }

    /* THE SECTION DRAWS THE MODEL TOO, WHICH IS WHAT ENDS THE SWAP.
       It used to render the image sequence and hand over to the model only for the fall, so
       the man visibly changed the moment he started falling. He could see it, and no amount
       of colour matching fixes two figures lit by two different engines. Now one model does
       the whole journey — the coat-alone/body/head assembly included, because the parts
       export can perform it — and the frames are only the fallback for a browser that
       cannot run any of this.

       BEHIND THE COPY HERE, IN FRONT OF THE PAGE LATER. The same fixed layer serves both,
       switched by z-index: in the section he belongs behind the words, and for the fall he
       is meant to be over the whole site. */
    function sectionModel(st, p, cw, ch, dpr) {
      if (flat() || reduce) return false;
      /* MOUNT FIRST, ASK AFTER. The renderer is created inside riderLayer(), so gating on
         ready before calling it is a deadlock: the model can never load because the canvas
         it loads into is never made. Build the layer, then report whether there was
         anything to draw yet — the aq:coat3d event repaints once the model lands. */
      riderLayer();
      var three = window.AQCoat3D;
      if (!three || !three.ready) return false;
      var vw = cw / dpr, vh = ch / dpr;
      var here = stateAt(p);
      /* The same fit the sprite used: to the stage height, clamped by his measured width so
         the copy columns either side of him stay clear. */
      var h = Math.min(vh * zoomAt(p), (vw * FIG_MAX) / FIG_W);
      riderEl.setAttribute("data-on", "1");
      riderEl.setAttribute("data-front", "0");
      if (gl) gl.style.display = "block";
      var ok = three.draw({
        vw: vw, vh: vh,
        cx: here.x * vw,
        cy: vh * (0.5 + PAN_TO * ease(p) + here.dip),
        h: h,
        /* One continuous turn across the section, which is what the 420 frames encoded and
           what the copy now revolves around. */
        rx: 0, ry: st.f * Math.PI * 2, rz: 0,
        f: st.f
      });
      return ok;
    }

    function riderHide() {
      if (!riderOn) return;
      riderOn = false;
      if (riderEl) riderEl.removeAttribute("data-on");
      if (ride) ride.removeAttribute("data-ridden");
      drawn = -1;              // the section owns the figure again, so let it repaint
    }

    /* Returns true while the rider is the one drawing him, so measure() knows to leave the
       section's canvas empty rather than painting a second copy of the same man. */
    function riderUpdate() {
      if (flat() || reduce || !ride) { riderHide(); return false; }

      var vh = window.innerHeight, vw = window.innerWidth;
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var cr = host.getBoundingClientRect();
      var tr = ride.getBoundingClientRect();
      if (!vh || !vw || !cr.height || !tr.height) { riderHide(); return false; }

      var coatTop = cr.top + y;
      /* The scroll position at which the pinned layer lets go — the section's own progress
         1, and the moment he stops belonging to it. */
      var release = coatTop + cr.height - vh;
      if (y < release) { riderHide(); return false; }

      var tTop = tr.top + y, tH = tr.height;
      var read = vh * READ_LINE;
      /* p = 0 when the reading line first touches the top of the timeline, 1 at its foot.
         Exactly founder-motion.js's measurement, rearranged into document coordinates. */
      var rideStart = tTop - read;
      var rideEnd = rideStart + tH;

      var t, p, cy;
      if (y < rideStart) {
        /* Handing over: shrinking and falling towards the head of the spine. */
        t = rideStart > release ? (y - release) / (rideStart - release) : 1;
        p = 0;
        cy = null;             // ridePlace interpolates towards the spine head for us
      } else if (y < rideEnd) {
        t = 1;
        p = (y - rideStart) / tH;
        cy = read;             // riding: he holds the reading line while the page moves
      } else {
        t = 1;
        p = 1;
        cy = (tTop + tH) - y;  // stopped where the line stops, scrolling away with it
      }

      /* Off the top of the screen: nothing to draw, and the layer goes away so it cannot
         sit over the rest of the page as an invisible sheet. */
      var hNow = rideHeight(vh);
      if (cy !== null && cy < -hNow) { riderHide(); return false; }

      var spineX = tr.left + tr.width / 2;
      var spineY = cy === null ? (tTop - y) : cy;
      var place = ridePlace(t, vw, vh, spineX, spineY);

      /* A cosine sweep inside the safe range. At the handover instant (t=0, p=0) it sits at
         exactly 1 — the frame the section itself ends on — so the fixed layer picks up the
         very picture the sticky one put down, and the handover stays invisible. */
      var img = imgs[F.nearestLoaded(F.frameAt(rideFrame(t, p), n), ready)];
      if (!img) { riderHide(); return false; }

      riderLayer();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var cw = Math.round(vw * dpr), chh = Math.round(vh * dpr);
      if (riderCv.width !== cw || riderCv.height !== chh) { riderCv.width = cw; riderCv.height = chh; }

      var c = riderCtx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, vw, vh);

      /* EVERY WHOLE-NUMBER CONSTANT EARNS ITS KEEP AT THE ENDS. Because the turns and the
         swings are whole, the tumble is back to zero and the swing is back on the line at
         both t=1 and p=1 — so he leaves the handover upright and lands upright, standing
         exactly on the point where the line stops rather than frozen mid-topple beside it. */
      var swing = rideSwing(t, p) * vw;

      var w = place.h;                       // the renders are square
      var gx = place.cx + swing * (t < 1 ? t : 1), gy = place.cy;

      /* A pool of light under him, so a small figure still reads as lit rather than pasted
         on. Same aura the section uses, from the same CSS variables. */
      var R = place.h * 0.62;
      var g = c.createRadialGradient(gx, gy, 0, gx, gy, R);
      g.addColorStop(0, "rgba(" + skin.rgb + "," + (0.42 * skin.halo).toFixed(3) + ")");
      g.addColorStop(0.55, "rgba(" + skin.rgb + "," + (0.16 * skin.halo).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + skin.rgb + ",0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(gx, gy, R, 0, Math.PI * 2);
      c.fill();

      /* THE MODEL IF IT IS THERE, THE SPRITE IF IT IS NOT, and the fallback is not a
         formality: this is the only thing on the site that needs WebGL and a third-party
         CDN. A blocked script, an old browser or a machine with no GPU leaves AQCoat3D
         unready, and what a reader gets is the flatter version rather than a hole in the
         page. Both are driven from the same position, so neither can drift off the line. */
      var spin = rideSpin(t, p);
      var three = window.AQCoat3D;
      var drew3d = three && three.ready && three.draw({
        vw: vw, vh: vh, cx: gx, cy: gy, h: place.h * 1.35,
        rx: spin.rx, ry: spin.ry, rz: spin.rz,
        f: 1   // whole, always: he finished assembling a long way up the page
      });
      if (gl) gl.style.display = drew3d ? "block" : "none";

      if (!drew3d) {
        c.save();
        c.translate(gx, gy);
        c.rotate(rideTumble(t, p));
        var depth = rideDepth(t, p);
        c.scale(depth, depth);
        /* Rotated about the figure, not about the frame. The renders put him at 46.7% of a
           square canvas, so turning about the canvas centre would swing him round a point
           off to his side — an orbit, not a tumble. */
        c.drawImage(img, -w * FIG_CX, -place.h / 2, w, place.h);
        c.restore();
      }

      riderEl.setAttribute("data-on", "1");
      riderEl.removeAttribute("data-front");   // over the whole site for the fall
      /* The blue head is his job now. The drawn line stays — it is the trail behind him. */
      ride.setAttribute("data-ridden", "1");
      riderOn = true;
      return true;
    }

    function size() {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      /* Capped at 2: a phone reporting devicePixelRatio 3 would allocate a canvas nine
         times the CSS area for a difference nobody can see, on the device least able to
         afford the memory. */
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        drawn = -1;
      }
      return true;
    }

    /* FITTED TO HEIGHT AND CLAMPED BY THE FIGURE, not "contained".
       Contain fits to whichever side is tighter, which in a half-width column is the width
       — and that would draw him small with empty air above and below, in a column whose
       whole purpose is to make him bigger. Fitting to height fills the stage and lets the
       column crop the frame's empty side margins, which the measurements say are 38% of its
       width and contain nothing.

       The clamp is what makes that safe. He is never wider than FIG_W of the frame, so the
       largest scale at which he still fits the column is cw / (iw * FIG_W). The push-in
       grows towards that and stops, so a narrow window crops empty pixels and never his
       shoulders. */
    /* TWO DIFFERENT PROGRESSES, AND KEEPING THEM STRAIGHT IS THE WHOLE TRICK.
       `p` is how far down the section the reader has scrolled: it drives the camera push,
       the arrival and the smoke, all of which should feel continuous however long a hold
       lasts. `st.f` is how far through the rendered sequence he has turned, which crawls
       during a hold and runs during a crossing. Anything about the RENDER — the frame, his
       angle, the two joins where a body and then a head appear — reads st.f. Anything about
       the SHOT reads p. Swapping the two is silent and looks like a bug in the render. */
    function draw(i, p, st) {
      var img = imgs[i];
      if (!img) return;
      if (drawn === i && Math.abs(drawnAt - p) < 0.0015) return;
      if (!size()) return;

      var cw = canvas.width, ch = canvas.height;
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;

      var k = reduce ? 1 : zoomAt(p);
      var s = (ch / ih) * k;
      var fits = (cw * FIG_MAX) / (iw * FIG_W);
      if (s > fits) s = fits;

      var w = iw * s, h = ih * s;
      /* He sits left of the frame's centre, so centring the IMAGE would leave him visibly
         off-centre in the column. Shifted by the measured difference instead. */
      /* Unpinned layouts have nowhere to travel to: a figure crossing a 390px page covers
         about two of his own shoulder widths and just looks unsteady. */
      var here = flat() ? { x: 0.5, dip: 0 } : st;
      /* Centre the figure on the journey position rather than on the canvas. */
      var dx = (0.5 - FIG_CX) * w + (here.x - 0.5) * cw;
      var dy = reduce ? 0 : ch * (PAN_TO * ease(p) + here.dip);
      var x0 = (cw - w) / 2 + dx, y0 = (ch - h) / 2 + dy;

      ctx.clearRect(0, 0, cw, ch);

      /* The orbit is centred on his CHEST, not on the canvas: measured, he fills 97.6% of
         the frame from the top down, so the middle of his torso sits at roughly 45% of the
         drawn height. Centring on the canvas would hang the ring around his knees. */
      var acx = x0 + w * FIG_CX, acy = y0 + h * 0.45;
      var aR = h * 0.30;
      /* The same angle the figure has turned through, so the ring and the man are locked
         together — and both unwind when the reader scrolls back up. */
      var ang = st.f * Math.PI * 2;
      /* Faded up over the first tenth of the section rather than snapping on at the top
         edge, which reads as a glitch on the first pixel of scroll. */
      /* Faded up over the first tenth so the field arrives rather than snapping on, then
         driven hard at each handover. Capped at 1.9 rather than left to run: past about
         twice the base level the halo starts to bloom over his shoulders and the flare
         stops reading as light and starts reading as a white flash. */
      var lift = reduce ? 0
        : Math.min(1.9, Math.min(1, p / 0.10) + flare(st.f) * 1.15);


      /* Arcs behind, then the halo hugging his outline, then the man, then the light
         landing on him, then the arcs that pass in front. The halo takes its shape from
         `shown`, so while he is forming the glow hugs only the part of him that is
         there — a halo around the finished silhouette would give the whole thing away. */
      /* Composed once, then used by everything. While the head is arriving this is a
         canvas with the head at partial opacity; the rest of the time it is the frame
         itself and costs nothing. */
      /* ONE MODEL FOR THE WHOLE JOURNEY. If it is running, it draws him and the canvas below
         keeps only the atmosphere — the smoke he forms out of, the dust, the pool of light.
         Those are cheap in 2D and a nuisance in WebGL, and they sit behind him either way. */
      if (sectionModel(st, p, cw, ch, 1)) {
        var fa2 = reduce ? 1 : figureAlpha(p);
        var smk2 = reduce ? 0 : smokeAt(p);
        drawSmoke(ctx, acx, acy, aR, ang, skin.rgb, false, smk2, p);
        drawField(ctx, img, x0, y0, w, h, acx, acy, aR, ang, skin.rgb, lift * fa2, p, "back");
        drawField(ctx, img, x0, y0, w, h, acx, acy, aR, ang, skin.rgb, lift, p, "front");
        drawSmoke(ctx, acx, acy, aR, ang, skin.rgb, true, smk2, p);
        drawn = i; drawnAt = p;
        return;
      }
      if (riderEl) riderEl.removeAttribute("data-front");

      lastP = st.f;
      var shown = figureFor(img, w, h, st.f);
      var fa = reduce ? 1 : figureAlpha(p);
      var smk = reduce ? 0 : smokeAt(p);

      drawField(ctx, img, x0, y0, w, h, acx, acy, aR, ang, skin.rgb, lift, p, "back");
      /* Scaled by how solid he is: a halo at full strength around a coat that has not
         arrived yet would be a glow hanging in empty air. */
      drawField(ctx, shown, x0, y0, w, h, acx, acy, aR, ang, skin.rgb, lift * fa, p, "halo");
      drawSmoke(ctx, acx, acy, aR, ang, skin.rgb, false, smk, p);
      /* The figure fades up through the smoke. globalAlpha rather than a mask: there is
         no threshold anywhere, so there is nothing to pixelate when it is scaled. */
      if (fa > 0) {
        ctx.save();
        ctx.globalAlpha = fa;
        ctx.drawImage(shown, x0, y0, w, h);
        ctx.restore();
      }
      drawField(ctx, shown, x0, y0, w, h, acx, acy, aR, ang, skin.rgb, lift * fa, p, "spill");
      drawField(ctx, img, x0, y0, w, h, acx, acy, aR, ang, skin.rgb, lift, p, "front");
      drawSmoke(ctx, acx, acy, aR, ang, skin.rgb, true, smk, p);

      drawn = i; drawnAt = p;
    }

    /* THE REVEAL CANNOT WAIT FOR THE FIRST PAINT, AND FINDING THAT OUT COST A DEADLOCK.
       The section is display:none until it has something to show, so the stage measures
       zero by zero, so size() refuses, so nothing is drawn, so it is never revealed. A
       decoded image is proof enough that there is something to show. */
    function reveal() {
      if (revealed) return;
      revealed = true;
      host.setAttribute("data-coat-ready", "1");
    }

    function paint(st) {
      var i = F.nearestLoaded(want, ready);
      if (i >= 0) draw(i, prog, st || stateAt(prog));
    }

    /* LOAD DECIDES, DECODE ONLY OPTIMISES — and getting that backwards hid the whole
       section once already.

       decode() is worth calling: without it the first paint of a large image happens inside
       drawImage on the scroll handler, which is exactly where a dropped frame is most
       visible. But a decode() REJECTION does not mean the image is unusable. It rejects in
       backgrounded and hidden documents, and on some browsers for reasons that have nothing
       to do with the bytes. Treating that as failure meant the first frame "failed", the
       section was never revealed, and a portfolio silently lost a section on any browser
       that happened to reject — with a 200 OK sitting in the network panel saying the image
       was fine all along.

       So the load event is the authority on whether we have an image, and decode is an
       optimisation attempted afterwards whose outcome is ignored. */
    function load(slot) {
      return new Promise(function (done) {
        var img = new Image();
        img.decoding = "async";
        var settled = false;
        function ok() {
          if (settled) return;
          settled = true;
          imgs[slot] = img; ready[slot] = true; got++;
          done(true);
        }
        img.onload = function () {
          /* MARK IT READY FIRST, THEN WARM THE DECODE — never the other way round.
             decode() does not merely reject in a hidden or backgrounded document: its
             promise NEVER SETTLES. It does not resolve and it does not reject, so anything
             awaiting it waits forever. Gating readiness on it meant that a visitor whose
             tab was in the background while the page loaded lost this section
             permanently — the frames arrived 200 OK and were never drawn, and no error
             was logged anywhere because nothing had failed. It was found by watching the
             network panel show success while the section stayed hidden.

             The load event is the authority: it means we have the bytes and drawImage will
             work. decode() is only an optimisation that moves rasterisation off the scroll
             handler, so it is fired and forgotten. */
          ok();
          if (img.decode) { try { img.decode().catch(function () {}); } catch (e) {} }
        };
        img.onerror = function () {
          if (settled) return;
          settled = true;
          done(false);
        };
        img.src = F.fileFor(pattern, indices[slot]);
      });
    }

    async function run() {
      var first = await load(0);
      if (!first) return;
      reveal();
      measure();
      if (n === 1) return;

      /* Subdivision order: ends, then middles. Twenty images in, the whole scroll already
         animates coarsely and nothing is ever blank. Sequential rather than parallel so the
         coarse pass arrives fast and never competes with the rest of the page for sockets. */
      var order = F.loadOrder(n);
      for (var k = 0; k < order.length; k++) {
        var slot = order[k];
        if (ready[slot]) continue;
        await load(slot);
        if (slot === want || !ready[want]) paint();
        host.setAttribute("data-coat-progress", Math.round((got / n) * 100));
      }
    }

    function measure() {
      ticking = false;
      var r = host.getBoundingClientRect();
      var span = r.height - window.innerHeight;
      if (span <= 0) { prog = 0; }
      else prog = Math.min(1, Math.max(0, -r.top / span));

      /* Published for CSS as well, so the vignette and the progress rail move against the
         same measurement that picks the frame rather than a second, slightly different one. */
      var st = stateAt(prog);
      host.style.setProperty("--coat-p", prog.toFixed(4));
      host.style.setProperty("--coat-x", (flat() ? 0.5 : st.x).toFixed(4));
      /* The FRAME comes from the sequence progress, never from the scroll. This one line is
         what buys the holds: two thirds of the section is spent standing still, and he is
         still turning all the way round by the end of it. */
      want = F.frameAt(st.f, n);

      /* A class, with the fade in CSS — not an inline opacity written every scroll frame.
         The transition then belongs to the stylesheet like every other state on the site,
         and the handler is not touching style on three elements sixty times a second. */
      /* THE COPY IS DRIVEN BY THE SAME NUMBER AS THE FIGURE, which is what turns the
         non-overlap from a hope into a fact. It used to be decided by which block sat
         nearest the middle of the window — a second, independent notion of "where we are"
         that drifted from the first the moment either was touched, and let a paragraph fade
         up while he was still crossing underneath it.

         INLINE OPACITY, NOT A CLASS AND A CSS TRANSITION. A transition plays on a clock, so
         scrubbing back up the page would unwind the figure exactly and leave the words
         catching up behind him. Everything on this stage is a pure function of scroll
         position or none of it reverses. */
      if (beats.length) {
        for (var i = 0; i < beats.length; i++) {
          if (flat()) {
            beats[i].style.opacity = "";
            beats[i].style.transform = "";
            beats[i].style.pointerEvents = "";
            continue;
          }
          var a = blockAlpha(prog, i);
          beats[i].style.opacity = a.toFixed(3);
          /* THE REVOLVE. Each block swings in on its own axis, squares up while it is being
             read, and turns away as it goes — so the three stages read as panels going round
             the man rather than captions swapped under him. The sign flips with the side, or
             the two columns would rotate the same way and it would read as a shear.
             Written as a transform rather than a CSS animation for the same reason the
             opacity is: everything here is a function of scroll position, so scrubbing back
             up retraces it exactly instead of replaying on a clock. */
          var rev = blockRevolve(prog, i);
          var dir = beats[i].getAttribute("data-side") === "left" ? -1 : 1;
          beats[i].style.transform =
            "translateY(-50%) translate3d(" + (rev * 34 * dir).toFixed(1) + "px,0," +
            (-Math.abs(rev) * 110).toFixed(0) + "px) rotateY(" + (rev * 32 * dir).toFixed(1) + "deg)";
          /* Invisible words must not be selectable, or dragging across the page picks up
             three paragraphs nobody can see. */
          beats[i].style.pointerEvents = a > 0.5 ? "auto" : "none";
        }
      }
      /* ONE OF THEM DRAWS HIM, NEVER BOTH. Once the rider has him, the section canvas is
         cleared: at the handover they occupy the same pixels, so painting both would show
         two men for the screen it takes the section to scroll away. */
      if (riderUpdate()) {
        if (drawn !== -2 && size()) { ctx.clearRect(0, 0, canvas.width, canvas.height); drawn = -2; }
      } else {
        paint(st);
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    }

    /* The model arrives after the first paint, so the frame on screen at that moment was
       drawn with the sprite. Without this the reader keeps the flat one until they next
       move the page. */
    window.addEventListener("aq:coat3d", function () { drawn = -1; onScroll(); });
    if (!reduce) window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { drawn = -1; onScroll(); }, { passive: true });

    measure();
    run();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  /* The founder page builds most of itself from data, so anything rendering markup late
     fires this. data-coat-on stops a second pass starting a second loader. */
  document.addEventListener("aq:content", init);
})();
