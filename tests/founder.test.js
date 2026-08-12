/* AQcredix — founder portfolio page.
 * Run: node tests/founder.test.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
let pass = 0, fail = 0;
function eq(g, w, m) {
  if (g === w) pass++;
  else { fail++; console.log('FAIL: ' + m + ' - got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
}
function ok(c, m) { eq(!!c, true, m); }

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const sb = { window: {}, console };
vm.createContext(sb);
vm.runInContext(read('profile/founder-data.js'), sb);
const F = sb.window.FOUNDER;

const js = read('profile/founder.js');
const css = read('profile/founder.css');
const html = read('founder.html');

/* --------------------------- the data is complete --------------------------- */

eq(F.name, 'Dr. Santhoshkumar SG', 'the name is right');
eq(F.post, 'Pharm.D., RPh.', 'with the post-nominals from the profile');
eq(F.publications.length, 9, 'every publication is captured');
eq(F.experience.length, 8, 'every role is captured');
eq(F.education.length, 2, 'both qualifications are captured');
eq(F.certifications.length, 19, 'every certification is captured');
ok(F.skills.length >= 12, 'the skills list is populated');

/* The two journals, named exactly as he specified — one is a Springer Nature Q1 title and
   saying so is the point of the section. */
const springer = F.experience.find(e => e.org === 'Springer Nature');
ok(springer, 'the Springer Nature role is present');
ok(/Antimicrobial Resistance and Infection Control/.test(springer.note),
   'and names the journal it is for');
ok(/Q1/.test(springer.note), 'and records that it is Q1');
ok(F.experience.some(e => /International Journal of Infectious Diseases and Therapy/.test(e.org)),
   'IJIDT is present in full, not just as an acronym');
ok(/Springer Nature/.test(html), 'the page names Springer Nature');
ok(/Antimicrobial Resistance and Infection Control/.test(html), 'and the ARIC journal');

// Current roles must be flagged, or the timeline reads as entirely historical.
eq(F.experience.filter(e => e.current).length, 4, 'four roles are marked current');

// Every publication needs a journal and a date — a bare title is not a citation.
let bad = 0;
F.publications.forEach(p => { if (!p.title || !p.journal || !p.date) bad++; });
eq(bad, 0, 'every publication carries a journal and a date');

// Certifications are grouped so quality credentials lead, which is what a hospital reads for.
ok(F.certifications.some(c => c.group === 'quality'), 'quality credentials are grouped');
ok(F.certifications.some(c => c.group === 'clinical'), 'clinical ones too');
/* ISQua FELLOWSHIP, not merely membership — the earlier draft had this wrong and the
   distinction is the single most senior credential on the page. */
const fellow = F.certifications.find(c => /Fellowship/.test(c.name));
ok(fellow, 'the ISQua Fellowship is listed');
eq(fellow.id, '1013000', 'with its credential number from the certificate');
ok(/ISQua/.test(fellow.issuer), 'and its issuer');
eq(fellow.top, true, 'and it is flagged to lead the section');

const cpqih = F.certifications.find(c => /CPQIH/.test(c.name));
ok(cpqih, 'the CAHO CPQIH qualification is listed');
eq(cpqih.id, 'CPQIH-31-025', 'with its certificate number');
ok(/NABH Entry Level Standards/.test(cpqih.note), 'and what it certified');
eq(cpqih.top, true, 'and it leads too');

// Both flagged credentials get their own row, or they are lost among nineteen.
eq(F.certifications.filter(c => c.top).length, 2, 'exactly two credentials are featured');
ok(/id="fCertTop"/.test(html), 'the page has a slot for them');
ok(/fp-cert-top/.test(js) && /fp-cert-top/.test(css), 'and styling that sets them apart');

/* Credential numbers are the point of a certificate — a claim without one cannot be
   checked. Nine of the certificates carry one and all nine are recorded. */
eq(F.certifications.filter(c => c.id).length, 9, 'every credential number is captured');

ok(F.certifications.some(c => /Antimicrobial Stewardship/.test(c.name)),
   'the CAHO antimicrobial stewardship course is listed');
ok(F.certifications.some(c => /CAHOCON/.test(c.name)), 'CAHOCON 2026 attendance is listed');
ok(F.certifications.some(c => /Artificial Intelligence/.test(c.name)),
   'the ISQua AI and machine learning course is listed');
ok(F.certifications.some(c => /Johns Hopkins/.test(c.issuer)),
   'Coursera courses name the awarding university, not just Coursera');
ok(F.certifications.some(c => /Imperial College London/.test(c.issuer)), 'both of them');

// The IJIDT reviewer role carries the certificate detail.
const ijidt = F.experience.find(e => /IJIDT/.test(e.org));
ok(/Certificate of Reviewing/.test(ijidt.note), 'the reviewing certificate is recorded');
ok(/co-amoxiclav/.test(ijidt.note), 'with the paper it was awarded for');

ok(/Voluntary Health Services Multispecialty Hospital/.test(F.affiliation),
   'the hospital affiliation from the reviewing certificate is shown');
ok(/id="fAffil"/.test(html), 'and the page renders it');
ok(F.certifications.some(c => /Lean Six Sigma/.test(c.name)), 'Lean Six Sigma is listed');

/* ------------------------------- the rendering ------------------------------- */

// Everything comes from the data file, so adding a publication needs no markup change.
['fName', 'fRole', 'fTags', 'fStats', 'fExp', 'fEdu', 'fPubs', 'fCertQ', 'fCertC', 'fSkills']
  .forEach(id => ok(new RegExp('id="' + id + '"').test(html), 'the page has a #' + id + ' slot'));
ok(/founder-data\.js/.test(html) && /founder\.js/.test(html), 'both scripts are loaded');
ok(/profile\/founder\.css/.test(html), 'and the stylesheet');
eq((html.match(/<body/g) || []).length, 1, 'the page has one body tag');
eq((html.match(/<\/head>/g) || []).length, 1, 'and one head');

// Everything user-supplied is escaped. A journal title contains an ampersand and a colon;
// unescaped it would break the markup, and the pattern is what stops injection generally.
ok(/function esc/.test(js), 'the renderer escapes its input');
eq(/innerHTML = [^;]*\+ (p|e|c)\.(title|name|role)(?!\s*\))/.test(js), false,
   'no field is interpolated without escaping');

/* --------------------------- the animation wiring --------------------------- */

// The page renders after DOMContentLoaded, so the site-wide observers never saw its
// markup. Without a re-scan every section stays at opacity 0 — the reveal class is what
// hides them in the first place.
ok(/aq:content/.test(js), 'the page announces when its content exists');
ok(/aq:content/.test(read('motion/motion.js')), 'the motion layer listens for it');
ok(/aq:content/.test(read('motion/scrolly.js')), 'and so does the scrollytelling');
ok(/if \(el\.classList\.contains\("aq-reveal"\)\) return/.test(read('motion/motion.js')),
   're-scanning never re-hides something already revealed');
ok(/data-scrolly-wired/.test(read('motion/scrolly.js')),
   'and never double-observes the same steps');

ok(/data-scrolly\b/.test(html), 'the portfolio has a scrollytelling section');
eq(F.lens.length, 3, 'with three stages');
ok(/data-scrolly-sticky/.test(html), 'and a pinned card');
eq((html.match(/data-split/g) || []).length >= 5, true, 'headings use the split animation');

/* --------------------------------- 3D tilt --------------------------------- */

ok(/pointer: coarse/.test(js), 'tilt is skipped on touch, which has no hover');
ok(/prefers-reduced-motion/.test(js), 'and on reduced motion');
ok(/requestAnimationFrame/.test(js), 'tilt writes at most once per frame');
ok(/rect = null/.test(js), 'the cached rect is invalidated on scroll and resize');
ok(/MAX = 7/.test(js), 'the tilt is capped at a few degrees, so text stays readable');
ok(/--mx/.test(js) && /--mx/.test(css), 'the sheen follows the pointer through CSS vars');

// Counters must derive from the arrays, or a new publication leaves a stale headline.
ok(/publications: F\.publications\.length/.test(js), 'the publication count is derived');
ok(/certifications: F\.certifications\.length/.test(js), 'and the certification count');
ok(/tabular-nums/.test(css), 'counters use tabular figures so the width does not jitter');

// A missing portrait must not render a broken-image icon.
ok(/img\.onerror/.test(js), 'a missing portrait falls back rather than breaking');
ok(/fp-initials/.test(js) && /fp-initials/.test(css), 'the fallback is the initials mark');

/* ------------------------------- the name link ------------------------------- */

ok(/fp-namelink/.test(read('about.html')), 'his name links from the about page');
ok(/fp-namelink/.test(read('contact.html')), 'and from contact');
ok(/founder\.html/.test(read('about.html')), 'to the portfolio page');
ok(/\.fp-namelink/.test(read('styles.css')), 'and the link has its own styling');

/* ------------------------------ palette + mobile ------------------------------ */

let hard = 0;
for (let i = css.indexOf('@media'); i >= 0; i = css.indexOf('@media', i + 1)) {
  const o = css.indexOf('{', i);
  if (o < 0) break;
  let depth = 0, j = o;
  for (; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}') { depth--; if (!depth) break; }
  }
  if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(css.slice(o, j + 1))) hard++;
}
eq(hard, 0, 'no hardcoded colour inside a media query');
ok(/@media \(max-width: 760px\)/.test(css), 'there is a phone layout');

// The wireframe network was removed at his request; no trace should remain.
eq(/fp-net|fpNet/.test(css), false, 'no leftover network styles');
eq(/fp-net|fpNet|network\.js/.test(html), false, 'no leftover network markup or script');
eq(fs.existsSync(path.join(ROOT, 'profile/network.js')), false, 'the network file is gone');
ok(/fp-statband \{ grid-template-columns: repeat\(2, 1fr\)/.test(css),
   'four counters become two columns on a phone');


/* ===================== portfolio motion ===================== */
{
  const mo = read('profile/founder-motion.js');

  /* All of this renders from data AFTER DOMContentLoaded, so binding on the DOM event
     would attach to an empty page. Both files wait for founder.js's signal. */
  ok(/aq:content/.test(mo), 'motion binds after the content is rendered');

  /* The cursor-watching mark was removed at his request — it read as gimmicky against
     the rest of the page. Nothing should remain of it. */
  eq(/fpWatch|fpw-|fp-watch/.test(html), false, 'no watching-mark markup remains');
  eq(/fpw-|fp-watch/.test(css), false, 'and no styles for it');
  eq(fs.existsSync(path.join(ROOT, 'profile/founder-watch.js')), false, 'the file is gone');
  eq(/founder-watch/.test(html), false, 'and it is not loaded');

  // Scroll-linked spine, measured at the reading line rather than the viewport top.
  ok(/fp-spine/.test(mo) && /fp-spine/.test(css), 'the timeline has a travelling light');
  ok(/vh \* 0\.45/.test(mo), 'it fills at the reading line, not the top edge');
  ok(/is-lit/.test(mo) && /is-lit/.test(css), 'entries light as the head passes them');

  // Horizontal reel: scroll position drives translateX directly.
  ok(/data-reel/.test(html), 'publications render as a reel');
  ok(/rail\.scrollWidth - sec\.clientWidth/.test(mo),
     'the scroll length is measured from real overflow, not guessed');
  ok(/position: sticky/.test(css), 'the rail is pinned while it travels');
  eq(/addEventListener\("wheel"/.test(mo), false, 'the reel never hijacks the wheel');

  // Throttling: pointermove and scroll fire far faster than the screen refreshes.
  ok(/function throttled/.test(mo), 'handlers are throttled to one frame');
  ok(/requestAnimationFrame/.test(mo), 'writes happen once per frame, not per event');

  // Gating.
  ok(/pointer: coarse/.test(mo) && /prefers-reduced-motion/.test(mo),
     'pointer-linked effects are gated');
  ok(/if \(!reduce\) stagger\(\)/.test(mo),
     'stagger still runs on a phone — it costs a CSS transition and nothing else');
  ok(/\.fp-reel \{ height: auto !important/.test(css),
     'the reel unpins on a phone and becomes a normal swipe');
}


/* The hero is centred, not a two-column split. A max-width on the text keeps the measure
   readable — centred prose running the full page width is hard to track because the eye
   loses the start of each line. */
ok(/\.fp-hero-grid \{[\s\S]{0,220}align-items: center/.test(css), 'the hero stacks centred');
ok(/\.fp-hero-grid \{[\s\S]{0,220}text-align: center/.test(css), 'and its text is centred');
eq(/\.fp-hero-grid \{[\s\S]{0,220}grid-template-columns: 190px/.test(css), false,
   'the old two-column split is gone');
/* The block must centre ITSELF, not only its lines. As a flex child it is sized to
   content, so text-align alone left the box flush left — the lines were centred inside a
   left-hanging box, which is what the screenshot showed. */
ok(/\.fp-hero-text \{[\s\S]{0,140}max-width: 62ch/.test(css), 'the measure is capped for readability');
ok(/\.fp-hero-text \{[\s\S]{0,140}margin-inline: auto/.test(css), 'and the block centres itself');
ok(/\.fp-hero-text \{[\s\S]{0,140}width: 100%/.test(css), 'stretching so the auto margins have room to work');
ok(/\.fp-hero-text \.eyebrow \{[^}]*justify-content: center/.test(css),
   'the inline-flex eyebrow is centred as a box, not just as text');
ok(/\.fp-tags \{[^}]*justify-content: center/.test(css), 'the role chips centre');
ok(/\.fp-links \{[^}]*justify-content: center/.test(css), 'and so do the buttons');

/* ===================== centre alternating timeline ===================== */
{
  const mo = read('profile/founder-motion.js');
  const fj = read('profile/founder.js');

  /* Sides are assigned in JS, not by CSS :nth-child. The education list restarts the
     sequence, so letting CSS count would put two entries on the same side across the
     two lists — a bug that only shows up where the lists meet. */
  ok(/i % 2 === 0 \? "is-right" : "is-left"/.test(fj), 'sides alternate from the index');
  eq(/nth-child\([^)]*\)[^{]*\{[^}]*grid-column/.test(css), false,
     'sides are not decided by CSS counting');
  ok(/\.fp-item\.is-right \.fp-item-card \{ grid-column: 3/.test(css), 'odd entries sit right');
  ok(/\.fp-item\.is-left  \.fp-item-card \{ grid-column: 1/.test(css), 'even entries sit left');

  // Three columns: card, spine, card — so the section fills the width.
  ok(/grid-template-columns: 1fr 64px 1fr/.test(css), 'the spine runs down a centre column');
  ok(/\.fp-timeline::before \{[\s\S]{0,200}left: 50%/.test(css), 'the track is centred');
  ok(/\.fp-spine \{ position: absolute; left: 50%/.test(css), 'and so is the travelling light');

  /* Three states. Two would leave every earlier entry at full strength, so the one the
     light is actually on would not stand out. */
  ok(/is-seen/.test(mo) && /is-seen/.test(css), 'passed entries dim rather than staying bright');
  ok(/Math\.abs\(mid - read\) < vh \* 0\.34/.test(mo), 'entries light in a band around the reading line');
  ok(/\.fp-item\.is-lit \.fp-item-card/.test(css), 'the lit entry is emphasised');
  ok(/\.fp-item\.is-lit \.fp-dot/.test(css), 'and its marker on the spine lights too');

  // Cards slide in from their own side, which is what makes the alternation read.
  ok(/\.fp-item\.is-right \.fp-item-card \{ transform: translate\(26px/.test(css),
     'right-hand cards enter from the right');
  ok(/\.fp-item\.is-left  \.fp-item-card \{ transform: translate\(-26px/.test(css),
     'and left-hand ones from the left');

  // Mobile collapses to one rail: alternating needs width to read as alternating.
  ok(/max-width: 900px\)[\s\S]{0,400}\.fp-spine \{ left: 12px/.test(css),
     'the spine moves to the edge on a narrow screen');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
