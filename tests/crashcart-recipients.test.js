/* WHO THE CRASH CART ALERT IS ALLOWED TO REACH.
 *
 * A crash cart's contents are clinical stock data, and the hospital's position is that only
 * the people assigned to restocking should receive it — not every editor on the account. So
 * this file is really about the blast radius of one email, and the two ways it can be wrong:
 * reaching somebody who was never assigned, or silently reaching NOBODY because a hospital
 * narrowed the list and locked themselves out.
 *
 * The rule is exercised against the real helpers lifted out of the module, so a change to
 * how addresses are parsed or de-duplicated is caught here rather than in production. */
const path = require('path');
const src = require('fs').readFileSync(
  path.join(__dirname, '../workspace/crashcart-alert.js'), 'utf8');

/* Pull the two pure helpers out of the module without needing env vars or a database. */
const addresses = new Function('return ' +
  src.match(/function addresses\(raw\) \{[\s\S]*?\n\}/)[0])();
const normalise = new Function('return ' +
  src.match(/function normalise\(raw\) \{[\s\S]*?\n\}/)[0])();

const RESTOCK_ROLES = ["owner", "admin", "quality_manager", "director", "editor"];

function recipientsFor(alert_email, members, org) {
  const assigned = addresses(alert_email);
  const owners = members.filter(m => m.org_id === org && m.email &&
    String(m.role || "").toLowerCase() === "owner").map(m => m.email);
  const atTheHospital = (assigned.length ? assigned
    : members.filter(m => m.org_id === org && m.email &&
        RESTOCK_ROLES.indexOf(String(m.role || "").toLowerCase()) > -1).map(m => m.email)
  ).concat(owners);
  const seen = {};
  return atTheHospital.filter(e => {
    const k = normalise(e);
    if (!k || seen[k]) return false;
    seen[k] = true; return true;
  });
}

const members = [
  { org_id: 'o1', email: 'owner@vhs.org',      role: 'owner' },
  { org_id: 'o1', email: 'qm@vhs.org',         role: 'quality_manager' },
  { org_id: 'o1', email: 'pharmacist@vhs.org', role: 'editor' },
  { org_id: 'o1', email: 'sister.icu@vhs.org', role: 'editor' },
  { org_id: 'o1', email: 'supplychain@vhs.org', role: 'viewer' },
  { org_id: 'o2', email: 'other@hospital.org', role: 'owner' }
];

let pass = 0, fail = 0;
const eq = (g, w, m) => { if (JSON.stringify(g) === JSON.stringify(w)) { pass++; console.log('  ok  ' + m); }
  else { fail++; console.log('FAIL  ' + m + '\n      got  ' + JSON.stringify(g) + '\n      want ' + JSON.stringify(w)); } };

console.log('who receives the Monday crash cart alert\n');

eq(recipientsFor('pharmacist@vhs.org', members, 'o1'),
   ['pharmacist@vhs.org', 'owner@vhs.org'],
   'one named person — plus the owner, never instead of them');

eq(recipientsFor('pharmacist@vhs.org, sister.icu@vhs.org', members, 'o1'),
   ['pharmacist@vhs.org', 'sister.icu@vhs.org', 'owner@vhs.org'],
   'several named, comma separated');

eq(recipientsFor('pharmacist@vhs.org\nsister.icu@vhs.org', members, 'o1'),
   ['pharmacist@vhs.org', 'sister.icu@vhs.org', 'owner@vhs.org'],
   'and newline separated, which is how people paste them');

eq(recipientsFor('', members, 'o1'),
   ['owner@vhs.org', 'qm@vhs.org', 'pharmacist@vhs.org', 'sister.icu@vhs.org'],
   'nobody named: falls back to everyone who could restock, so a hospital that never opened ' +
   'the setting keeps being told');

eq(recipientsFor('', members, 'o1').indexOf('supplychain@vhs.org'), -1,
   'a viewer is never written to, named or not');

eq(recipientsFor('supplychain@vhs.org', members, 'o1'),
   ['supplychain@vhs.org', 'owner@vhs.org'],
   'but naming someone explicitly does reach them — assignment is the decision, not the role');

eq(recipientsFor('owner@vhs.org', members, 'o1'), ['owner@vhs.org'],
   'the owner named once is written to once, not twice');

eq(recipientsFor('owner+carts@vhs.org', members, 'o1'), ['owner+carts@vhs.org'],
   'and a plus-alias of the owner is recognised as the same mailbox');

eq(recipientsFor('pharmacist@vhs.org', members, 'o2'), ['pharmacist@vhs.org', 'other@hospital.org'],
   'another hospital gets its own owner, never o1\u2019s members');

eq(recipientsFor('not-an-email, pharmacist@vhs.org', members, 'o1'),
   ['pharmacist@vhs.org', 'owner@vhs.org'],
   'rubbish in the box is dropped rather than sent to the mail API, which would reject the ' +
   'whole batch and silently lose the valid recipients');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
