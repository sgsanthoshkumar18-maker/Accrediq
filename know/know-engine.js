/* AQcredix — standard-level compliance analysis engine.
 *
 * HONEST SCOPE: this is a rules engine, not a language model. What it does
 * that naive keyword matching does not:
 *
 *  1. It classifies each Objective Element by the KIND of obligation it
 *     imposes (documented process, monitoring loop, training + competence,
 *     physical availability, defined criteria, escalation, verification).
 *  2. It then looks in your description for evidence of THAT obligation —
 *     not merely the topic words. Saying "we do hand hygiene" mentions the
 *     subject but shows no monitoring, so a monitoring element is not credited.
 *  3. It reports per element, with what the element is really asking for and a
 *     worked example, rather than a single opaque percentage.
 *
 * It still cannot judge whether your practice is GOOD. It judges whether your
 * description shows the ingredients the element asks for.
 */
window.KnowEngine = (function () {

  // ---- Obligation types: what an element actually demands ----
  const OBLIGATIONS = [
    { id: "sop", test: /\*|documented|written guidance|in writing|policy|procedure defined/i,
      name: "A written, implemented procedure",
      asks: "that this exists as a document your staff actually follow — not folklore, and not a file written the week before the audit",
      evidence: /\b(sop|policy|protocol|written|document|guideline|procedure|manual)\b/i,
      fix: "Write the SOP, have it approved and dated, and make sure the staff who do the work can find it and describe it." },

    { id: "monitor", test: /monitor|audit|surveillance|review|indicator|measur|track|analys|analyz|trend/i,
      name: "A measurement loop that drives action",
      asks: "that you measure this, look at the result, and do something when it moves the wrong way — measuring without acting is the single most common finding",
      evidence: /\b(audit|monitor|measur|track|indicator|review|surveillance|compliance rate|percentage|data|report|analys|analyz|trend)\b/i,
      fix: "Define the measure, who collects it, how often it is reviewed, the threshold that triggers action, and record what action followed." },

    { id: "train", test: /train|orient|educat|aware|competen|induction|skill/i,
      name: "Training with demonstrated competence",
      asks: "not just that training happened, but that the people can actually do it — assessors test this by asking a staff member, not by reading the attendance sheet",
      evidence: /\b(train|orient|educat|induction|competen|assess|test|drill|refresher|retrain)\b/i,
      fix: "Train the relevant staff and add a competency check — a verbal question, a scenario or an observed task — then record who passed." },

    { id: "available", test: /available|access|adequate|provide|facilit|equipment|infrastructur|maintain|stock/i,
      name: "Something genuinely available at the point of use",
      asks: "that it is there when needed, not merely purchased — an empty dispenser and a broken device both fail this",
      evidence: /\b(available|provided|installed|stocked|refill|maintain|check|replace|inspect|calibrat|present at|kept)\b/i,
      fix: "Name who is responsible for keeping it available, set a check round, and log the check so absence is visible before an assessor finds it." },

    { id: "criteria", test: /criteria|defin|identif|screen|assess|classif|categor|list of/i,
      name: "Defined criteria applied consistently",
      asks: "that there is a stated rule for this, not individual judgement varying by who is on shift",
      evidence: /\b(criteria|defined|list|identif|screen|assess|classif|categor|scale|score|threshold)\b/i,
      fix: "Write down the criteria, put them where the decision is made, and audit a sample to confirm they are applied the same way by everyone." },

    { id: "record", test: /record|register|log|documented and|captur|report/i,
      name: "A record created as the work happens",
      asks: "a contemporaneous record — completed at the time, not reconstructed afterwards",
      evidence: /\b(record|register|log|form|entry|sign|documented|captur|report|register)\b/i,
      fix: "Create the register or form, define who completes it and when, and spot-check that entries are made in real time." },

    { id: "escalate", test: /inform|notif|escalat|report to|communicat|committee|responsib/i,
      name: "A defined route for informing and escalating",
      asks: "that someone specific is told, within a stated time, and that this is traceable",
      evidence: /\b(inform|notif|escalat|report|communicat|committee|meeting|handover|intimat|alert)\b/i,
      fix: "State who must be informed, within what time frame, and how that notification is evidenced." }
  ];

  // Worked examples, deliberately outside healthcare so the principle lands.
  const EXAMPLES = {
    sop: "Like an airline's checklist: it exists in writing, every crew uses the same one, and it is revised when something changes — not carried in one senior pilot's head.",
    monitor: "Like a factory tracking defect rates: counting them is pointless unless a rise triggers someone to stop the line and investigate.",
    train: "Like a driving test: attending lessons proves nothing on its own — the test is whether you can actually drive, assessed by someone else.",
    available: "Like a fire extinguisher: mounting it on the wall is not the requirement. The requirement is that it is charged, in date and reachable on the day of the fire.",
    criteria: "Like a bank's lending rules: written thresholds mean two different officers reach the same decision on the same application.",
    record: "Like a delivery driver scanning each parcel at the door — captured at the moment it happens, not filled in back at the depot from memory.",
    escalate: "Like an escalation clause in a support contract: if it is not resolved in four hours it automatically goes to a named manager. Nobody has to remember to chase it."
  };

  function obligationsFor(el, stdText) {
    const hay = (el.text || "") + " " + (stdText || "") + (el.sop ? " * documented" : "");
    const found = OBLIGATIONS.filter(o => o.test.test(hay));
    if (el.sop && !found.some(o => o.id === "sop")) found.unshift(OBLIGATIONS[0]);
    return found.length ? found.slice(0, 3) : [OBLIGATIONS[5]]; // default: a record exists
  }

  const STOP = new Set(("we have has our the is are and or of to in on at for with that this it as by from there " +
    "their they do does done been be was were will shall can all any some every each also").split(" "));

  function subjectTerms(text) {
    return [...new Set(String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter(w => w.length > 4 && !STOP.has(w) &&
        !["organisation","organization","shall","which","where","those","these","other","appropriate","documented","includes","including"].includes(w)))];
  }

  /** Analyse one standard against the user's description. */
  function analyseStandard(chapterCode, stdCode, userText) {
    const ch = window.NABH_DATA.chapters[chapterCode];
    const std = ch.standards.find(s => s.code === stdCode);
    if (!std) return null;

    const uText = " " + String(userText).toLowerCase() + " ";
    const uTerms = subjectTerms(userText);

    const results = std.elements.map(el => {
      const subj = subjectTerms(el.text + " " + std.text);
      // Does the description touch the element's subject at all?
      let subjHits = 0;
      subj.forEach(t => {
        if (uTerms.some(u => u === t ||
            (u.length > 5 && t.startsWith(u.slice(0, 5))) ||
            (t.length > 5 && u.startsWith(t.slice(0, 5))))) subjHits++;
      });
      const subjCover = subj.length ? subjHits / subj.length : 0;

      // Does the description show the KIND of thing the element demands?
      const obs = obligationsFor(el, std.text);
      const obsMet = obs.map(o => ({ ...o, met: o.evidence.test(uText) }));
      const obsScore = obsMet.filter(o => o.met).length / obsMet.length;

      // Both matter: you must be talking about the right subject AND showing
      // the right kind of control. Subject alone is not compliance.
      let status;
      if (subjCover < 0.15) status = "notmentioned";
      else if (obsScore >= 0.6 && subjCover >= 0.25) status = "addressed";
      else status = "partial";

      return {
        code: `${std.code}.${el.letter}`, text: el.text, category: el.category, sop: !!el.sop,
        subjCover, obligations: obsMet, status,
        missing: obsMet.filter(o => !o.met)
      };
    });

    const w = r => (r.category === "CORE" ? 3 : r.category === "Commitment" ? 2 : 1);
    const total = results.reduce((s, r) => s + w(r), 0);
    const earned = results.reduce((s, r) => s + w(r) *
      (r.status === "addressed" ? 1 : r.status === "partial" ? 0.5 : 0), 0);

    return {
      standard: std, chapter: chapterCode,
      pct: total ? Math.round((earned / total) * 100) : 0,
      results,
      addressed: results.filter(r => r.status === "addressed"),
      partial: results.filter(r => r.status === "partial"),
      missing: results.filter(r => r.status === "notmentioned")
    };
  }

  return { analyseStandard, OBLIGATIONS, EXAMPLES };
})();
