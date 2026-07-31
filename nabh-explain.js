/* AQcredix — plain-English simplifier + real-life (non-healthcare) analogy generator
   Runs entirely client-side against the parsed NABH element text (window.NABH_DATA).
   This is a transparent, rule-based rewrite of the actual clause — not a fabricated summary. */

window.NABH_EXPLAIN = (function () {

  const WORD_SWAPS = [
    [/\borganisation('s)?\b/gi, "hospital$1"],
    [/\bpersonnel\b/gi, "staff"],
    [/\bshall\b/gi, "must"],
    [/\bin consonance with\b/gi, "in line with"],
    [/\bcommensurate (to|with)\b/gi, "matching"],
    [/\bprioritised\b/gi, "ordered by urgency"],
    [/\bdisseminated\b/gi, "shared"],
    [/\bfacilitates?\b/gi, "makes it possible"],
    [/\butilised?\b/gi, "used"],
    [/\bmitigate[sd]?\b/gi, "reduce"],
    [/\bimplemented\b/gi, "put into practice"],
    [/\bstipulated\b/gi, "spelled out"],
    [/\bwritten guidance\b/gi, "a documented, written procedure"],
    [/\bmulti-disciplinary\b/gi, "cross-department"],
    [/\bcompetent\b/gi, "properly trained and qualified"],
    [/\bperiodic(ally)?\b/gi, "on a regular schedule"],
    [/\bappropriate(ly)?\b/gi, "suitable"],
  ];

  function simplify(text) {
    let t = text;
    WORD_SWAPS.forEach(([re, rep]) => { t = t.replace(re, rep); });
    // gentle sentence-level softening
    t = t.replace(/\.\s*$/, "");
    return "In plain terms: " + t.charAt(0).toLowerCase() + t.slice(1) + ".";
  }

  // Keyword -> non-healthcare real-life analogy. First match wins; ordered most-specific first.
  const ANALOGIES = [
    [/hazardous mat|spill|MSDS|chemical/i,
      "Think of a school chemistry lab: every bottle on the shelf has a safety data sheet taped nearby, spill kits sit within arm's reach, and there's a rehearsed drill for 'if this tips over.' Nobody waits until something spills to figure out the plan."],
    [/fire|evacuat|extinguisher/i,
      "Like a cinema's fire-exit plan: exits are marked, extinguishers are inspected on a sticker-dated schedule, and staff run an unannounced evacuation drill every so often — not just once when the building opened."],
    [/consent|explain.*(procedure|treatment)|informed/i,
      "Similar to a mechanic who walks you through what's wrong with your car, what the repair involves, the cost, and the risk of not doing it — before touching a single bolt, and getting your sign-off."],
    [/credential|qualif|competenc|licence|license/i,
      "Like an airline checking a pilot's licence and simulator hours are current before they're allowed anywhere near a cockpit — not just once at hiring, but on a renewal cycle."],
    [/training|induction|orientation/i,
      "Similar to a new barista who shadows a shift, passes a checklist on the espresso machine, and only then works the counter alone — the training is structured, not just 'figure it out.'"],
    [/maintenance|calibrat|inspect.*(equipment|device)|preventive/i,
      "Like an airline's schedule of engine checks — done on a fixed calendar whether or not anything seems wrong, with a signed logbook proving each check happened."],
    [/incident|report.*(adverse|error)|near.?miss/i,
      "Think of an airline's near-miss reporting culture: a pilot who reports a close call isn't punished — the goal is fixing the system before a real accident happens."],
    [/access control|restricted|authoris|authoriz|confidential|privacy/i,
      "Like a bank vault: only specific staff have the code, every entry is logged with a timestamp, and the list of who's authorised is reviewed, not just set once and forgotten."],
    [/backup|redundan|downtime|business continuity/i,
      "Similar to a data centre that keeps a backup generator and tests it monthly — not stored away and hoped to work the one time the power actually fails."],
    [/label|segregat|colour.?cod|color.?cod/i,
      "Like a recycling station with clearly separate, clearly labelled bins for glass, plastic, and paper — so anyone, even a first-time visitor, sorts correctly without asking."],
    [/traceability|batch|lot number|track/i,
      "Similar to a car-parts factory that stamps every component with a batch number, so if one part fails, they can trace exactly which shipment it came from and pull the rest."],
    [/review.*(annual|year|periodic)|update.*(polic|SOP|procedure)/i,
      "Like a company that revisits its employee handbook every year — not because it's required busywork, but because rules that don't get revisited quietly go stale."],
    [/feedback|survey|satisfaction/i,
      "Similar to a restaurant that actually reads its comment cards and changes the menu based on them — not just collecting feedback to display it unread."],
    [/escalat|chain of command|reporting relationship/i,
      "Like a customer-support ticket that automatically escalates to a manager if it isn't resolved within a set time — nobody has to remember to chase it manually."],
    [/inventory|stock|supply chain|procurement/i,
      "Similar to a well-run warehouse that never runs out of a critical part because stock levels trigger an automatic reorder well before they hit zero."],
    [/timeframe|within.*(hour|minute|day)|turnaround/i,
      "Like a pizza chain that promises delivery within 30 minutes — the target is specific and measured, not a vague 'as soon as possible.'"],
    [/sign(ed|age)|display|prominently/i,
      "Similar to an airport that posts gate information on large, visible screens rather than only telling the one person who happens to ask at the counter."],
    [/audit|inspection round|walkthrough/i,
      "Like a restaurant health inspector who shows up unannounced and checks the kitchen against a real checklist — not a self-graded form filled out from memory."],
    [/committee|multi-disciplinary team|guides the formulation/i,
      "Similar to a product-safety committee at a car company that includes engineers, legal, and customer support — not just one department deciding alone."],
    [/emergency|disaster|drill|mock/i,
      "Like an office building that runs a surprise fire drill once a quarter — everyone's supposed to know the plan, but a drill is the only way to prove they actually do."],
    [/document.*(control|version)|obsolete/i,
      "Similar to a software company making sure only the current version of a manual is on the shelf — old, outdated printouts get pulled so nobody follows expired instructions."],
    [/waste|disposal/i,
      "Like a construction site with separate, clearly marked skips for wood, metal, and general waste, collected on a fixed schedule instead of piling up indefinitely."],
  ];

  const GENERIC_ANALOGY =
    "Think of any well-run operation — an airline, a bank, a professional kitchen — that turns a good intention into an actual habit: someone is named responsible, there's a written way of doing it, and someone checks that it really happened, not just that it was written down.";

  function analogyFor(text) {
    for (const [re, ex] of ANALOGIES) {
      if (re.test(text)) return ex;
    }
    return GENERIC_ANALOGY;
  }

  return { simplify, analogyFor };
})();
