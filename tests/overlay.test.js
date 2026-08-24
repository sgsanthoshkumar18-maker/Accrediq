/* The video overlay: the speaker caption and the corner logo.
 *
 * THE BUG THIS EXISTS TO CATCH.
 * autoAttach built its options with `showAt: d.aqvShowAt ? +d.aqvShowAt : undefined` and
 * merged them over the defaults with Object.assign. That reads as "leave the default alone
 * when the markup says nothing", and it is not what happens: Object.assign copies an
 * undefined VALUE over the default rather than skipping the key. Both timings became
 * undefined, setTimeout treats undefined as zero, and the caption was added and removed in
 * the same instant — so it never appeared at all.
 *
 * It survived two rounds of testing because the LOGO is a separate class on a separate
 * element and kept working perfectly. The overlay looked alive. Only the words were gone.
 * So this evaluates the real option literal out of the file rather than trusting a reading
 * of it, and asserts the merged numbers.
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) pass++;
  else { fail++; console.log('FAIL:', m, '- got', g, 'want', w); } };

const src = fs.readFileSync(path.join(__dirname, '../videos/overlay.js'), 'utf8');

// --- the defaults, as written --------------------------------------------
const defMatch = /var DEFAULTS = (\{[^}]*\});/.exec(src);
eq(!!defMatch, true, 'DEFAULTS is present and parseable');
const DEFAULTS = vm.runInNewContext('(' + defMatch[1] + ')');
eq(DEFAULTS.showAt, 3000, 'caption is set to appear three seconds in');
eq(DEFAULTS.hideAt, 9000, 'caption is set to leave at nine seconds');

// --- the real option literal from autoAttach, evaluated ------------------
// Comments stripped first: the literal carries a block comment explaining the bug, and a
// lazy match through it lands mid-comment and will not parse.
const bare = src.replace(/\/\*[\s\S]*?\*\//g, '');
const optMatch = /attach\(host, (\{[\s\S]*?\n      \})\)/.exec(bare);
eq(!!optMatch, true, 'autoAttach passes an options object we can evaluate');

function merge(dataset) {
  const opts = vm.runInNewContext('(' + optMatch[1] + ')', { d: dataset, DEFAULTS: DEFAULTS });
  return Object.assign({}, DEFAULTS, opts);
}

// Markup with no timing attributes — by far the common case, and the one that broke.
const plain = merge({ aqvName: 'Dr. John Felix S.N.' });
eq(plain.showAt, 3000, 'with no timing in the markup the caption still appears at 3s');
eq(plain.hideAt, 9000, 'with no timing in the markup the caption still leaves at 9s');
eq(typeof plain.showAt, 'number', 'showAt is a number, never undefined');
eq(typeof plain.hideAt, 'number', 'hideAt is a number, never undefined');

// setTimeout(fn, undefined) runs immediately — this is why undefined was fatal rather
// than merely untidy, and why the assertions above are about the type as well as the value.
eq(Number(undefined) || 0, 0, 'undefined as a delay means zero, i.e. instantly');

// Markup that does carry timings must still win.
const custom = merge({ aqvName: 'X', aqvShowAt: '1500', aqvHideAt: '20000' });
eq(custom.showAt, 1500, 'an explicit show time in the markup is honoured');
eq(custom.hideAt, 20000, 'an explicit hide time in the markup is honoured');

// The literal itself must never hand undefined to the merge again.
// Against `bare`, not `src`: the file explains this bug in a comment that necessarily
// quotes the broken line, and a check that trips over its own documentation is useless.
eq(/showAt:[^,\n]*undefined/.test(bare), false, 'showAt is never passed as undefined');
eq(/hideAt:[^,\n]*undefined/.test(bare), false, 'hideAt is never passed as undefined');

// --- the caption must be able to shrink, not overflow --------------------
const css = fs.readFileSync(path.join(__dirname, '../videos/overlay.css'), 'utf8');
eq(/max-width:72cqw/.test(css), true, 'the caption is capped so a long name cannot span the frame');
eq(/box-sizing:border-box/.test(css), true, 'the cap counts padding, so 72% means 72%');
eq(/\.aqv-name\{[^}]*white-space:nowrap/.test(css), false,
   'the name wraps rather than pushing out of the picture');
eq(/font-size:max\(15px,3\.1cqw\)/.test(css), true, 'the name has a pixel floor AND scales');
eq(/font-size:max\(11px,1\.75cqw\)/.test(css), true, 'the role has a pixel floor AND scales');
// A breakpoint under a floor made the type SHRINK as the video grew, between 480 and 630
// wide. max() holds the floor until the proportional value genuinely overtakes it.
eq(/@container \(max-width: 480px\)\{[^}]*font-size/.test(css.replace(/\s+/g, ' ')), false,
   'no breakpoint re-sets the type and undercuts the floor');

// --- the caption must follow the VIDEO's clock, not a wall clock ---------
/* Third failure of this caption's timing, and the most visible: driven by setTimeout from
   the moment play was pressed, it kept counting while the video was PAUSED — sliding in
   over a frozen frame and leaving again — and dragging the scrubber resynced nothing, so
   it reappeared in the middle of the video with no relation to anything on screen. For a
   real <video> the element's own currentTime is the truth and there is no reason not to
   use it. The timer path stays for players we cannot see inside, like the film's bundle. */
const player = fs.readFileSync(path.join(__dirname, '../videos/player.js'), 'utf8');
const pbare = player.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

eq(/addEventListener\("timeupdate", syncCaption\)/.test(pbare), true,
   'the caption is resynced as the video plays');
eq(/addEventListener\("seeked", syncCaption\)/.test(pbare), true,
   'and immediately after the scrubber is dragged');
eq(/v\.currentTime/.test(pbare) && /SHOW_AT/.test(pbare) && /HIDE_AT/.test(pbare), true,
   'visibility is decided by where we are in the video');
eq(/setTimeout\([^)]*showCaption/.test(pbare), false,
   'no timer decides when the caption appears');
eq(/ov\.start\b/.test(pbare), false,
   'the player never starts the wall-clock sequence for a real video element');
eq(/showCaption:\s*showCaption/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), true,
   'the overlay exposes showCaption for a caller that has a real clock');

// --- space pauses the video, and nothing else ----------------------------
/* Space is the page-down key AND the key that activates a focused button or link. A
   handler that takes it unconditionally breaks every form and every control on the site,
   which is a far worse bug than the convenience it adds. The guards are the feature. */
eq(/e\.key !== " " && e\.key !== "Spacebar" && e\.code !== "Space"/.test(pbare), true,
   'space is recognised by key and by code');
eq(/INPUT\|TEXTAREA\|SELECT\|BUTTON\|A/.test(pbare), true,
   'space is left alone on inputs, selects, buttons and links');
eq(/isContentEditable/.test(pbare), true, 'and inside anything contenteditable');
eq(/vp-playing/.test(pbare) && /r\.top < innerHeight/.test(pbare), true,
   'only taken while this player is mounted and actually on screen');
eq(/e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey/.test(pbare), true,
   'a modifier combination is left to the browser');
eq(/e\.preventDefault\(\);\s*\n\s*if \(v\.paused\)/.test(pbare), true,
   'the page is stopped from scrolling only when we actually handle the key');

// --- credentials must not break mid-qualification ------------------------
/* "Pharm D." split across two lines as "Pharm" / "D., RPh." — text-wrap:balance found the
   most even break, which is not the most meaningful one. Non-breaking spaces bind each
   qualification into a single unbreakable unit. */
const videosHtml = fs.readFileSync(path.join(__dirname, '../videos.html'), 'utf8');
const nameAttr = /data-aqv-name="([^"]*)"/.exec(videosHtml);
eq(!!nameAttr, true, 'the speaker name is on the video block');
eq(/Pharm&nbsp;D\./.test(nameAttr[1]), true, '"Pharm D." cannot break across lines');
eq(/AMSP&nbsp;Certified/.test(nameAttr[1]), true, '"AMSP Certified" cannot break either');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
