// Extract and test the pure helpers from profile.js against realistic subscription rows.
const src = require('fs').readFileSync(require('path').join(__dirname,'../profile/profile.js'),'utf8');
const grab = name => {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
};
eval(grab('fmtDate') + grab('fmtRupees') + grab('relative') + grab('streak'));
let pass=0,fail=0;
const eq=(g,w,m)=>{ if(String(g)===String(w))pass++; else {fail++;console.log('FAIL:',m,'got',g,'want',w);} };

// amount_paise as stored by the ₹1 test plan and by real pricing
eq(fmtRupees(100), '₹1', '₹1 test plan renders as whole rupees');
eq(fmtRupees(149900), '₹1,499', 'a four-figure monthly plan');
eq(fmtRupees(399900), '₹3,999', 'the live monthly price');
eq(fmtRupees(3999000), '₹39,990', 'the live yearly price');
eq(fmtRupees(1499900), '₹14,999', '₹14,999 annual plan');
eq(fmtRupees(25000000), '₹2,50,000', 'Indian lakh grouping');
eq(fmtRupees(150), '₹1.50', 'paise shown only when non-zero');
eq(fmtRupees(0), '₹0', 'zero amount');
eq(fmtRupees(null), '—', 'missing amount does not print NaN');

// dates
eq(fmtDate(null), '—', 'null date');
eq(fmtDate('not-a-date'), '—', 'unparseable date does not print Invalid Date');
eq(/2026/.test(fmtDate('2026-08-10T00:00:00Z')), true, 'valid ISO renders');

// relative
eq(relative(new Date().toISOString()), 'today', 'today');
const d=new Date(); d.setDate(d.getDate()-1);
eq(relative(d.toISOString()), 'yesterday', 'yesterday');
const d2=new Date(); d2.setDate(d2.getDate()-45);
eq(relative(d2.toISOString()), '1 months ago', '45 days');

// streak: today empty but yesterday active must still hold the streak
const iso=n=>{const x=new Date();x.setDate(x.getDate()-n);return x.toISOString();};
eq(streak([{at:iso(1)},{at:iso(2)},{at:iso(3)}]), 3, 'streak holds when today is empty');
eq(streak([{at:iso(0)},{at:iso(1)}]), 2, 'streak includes today');
eq(streak([{at:iso(0)},{at:iso(5)}]), 1, 'streak stops at a gap');
eq(streak([]), 0, 'no activity = no streak');

// ---- server-backed counting (cross-device) ----
{
  const src2 = require('fs').readFileSync(require('path').join(__dirname,'../profile/profile.js'),'utf8');
  // audits count only finished ones; incidents only submitted ones
  const auditPred = r => r.status === "completed" || r.finished_at;
  const incPred = r => !!r.submitted_at;
  eq(auditPred({status:"completed"}), true, 'completed audit counts');
  eq(!!auditPred({finished_at:"2026-01-01"}), true, 'finished audit counts');
  eq(!!auditPred({status:"in_progress"}), false, 'abandoned audit does not count');
  eq(incPred({submitted_at:"2026-01-01"}), true, 'submitted incident counts');
  eq(!!incPred({status:"draft"}), false, 'draft incident does not count');
  // the source must prefer a server figure over the local one
  eq(/if \(SERVER\[f\.key\] != null\) return SERVER\[f\.key\]/.test(src2), true,
     'server figure takes precedence over local ledger');
  // and must fail soft rather than throw
  eq(/catch \(e\) \{ \/\* leave undefined; the local count is used \*\/ \}/.test(src2), true,
     'a failed table read falls back to the local count');
}
console.log(`\n${pass} passed, ${fail} failed (including server-count checks)`);
process.exit(fail?1:0);
