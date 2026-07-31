/* AQcredix — Quality Tools dataset. Each tool has an explanation and a diagram spec
   rendered by a shared SVG renderer in tools.html (no external images). */
window.TOOLS_DATA = [

{id:"rca", name:"Root Cause Analysis (5 Whys)", cat:"Investigation",
 summary:"Dig past the symptom to the real cause by asking 'why' repeatedly — before a sentinel event repeats.",
 explain:"Root Cause Analysis is a structured way of refusing to stop at the first, obvious explanation. The 5 Whys technique keeps asking 'why did that happen?' — typically five times — until the trail leads to a system failure, not a person. The discipline is asking one more 'why' exactly when it feels like you already have an answer.",
 example:"A patient got the wrong medication dose. Why? The label was misread. Why? Two strengths look almost identical. Why? They're stored side by side. Why? No high-alert separation rule exists. Why? The SOP never required it. Root cause: fix the SOP, not the nurse.",
 diagram:{type:"steps", steps:["Why #1","Why #2","Why #3","Why #4","Why #5 → Root cause"]}
},

{id:"pdca", name:"PDCA / PDSA Cycle", cat:"Improvement cycle",
 summary:"Plan–Do–Check/Study–Act — the engine every NABH quality-improvement programme is built on.",
 explain:"A continuous, four-step loop for testing a change safely before scaling it. Plan the change and predict the result. Do it on a small scale. Check/Study whether reality matched the prediction. Act — adopt, adjust, or abandon — then the loop starts again with the next improvement. It never truly 'finishes'; that's the point.",
 example:"Plan: shorten discharge-summary turnaround to 24 hours. Do: pilot on one ward for two weeks. Study: turnaround improved but weekend coverage lagged. Act: add a weekend rota, then re-run the cycle hospital-wide.",
 diagram:{type:"cycle", steps:["Plan","Do","Check / Study","Act"]}
},

{id:"fishbone", name:"Fishbone (Ishikawa) Diagram", cat:"Root-cause mapping",
 summary:"Map every contributing cause — People, Process, Equipment, Environment — for a stubborn, recurring problem.",
 explain:"Also called a cause-and-effect diagram. The problem sits at the head of the 'fish'; each major bone is a category of possible cause (commonly People, Process, Equipment, Materials, Environment, Management). Under each bone, list every specific factor that could contribute — it turns a vague complaint into a structured map of everything worth investigating.",
 example:"Problem: rising patient falls on Ward 4. People — new staff, short-staffed nights. Process — no fall-risk re-screening after a status change. Equipment — bed alarms not consistently used. Environment — poor night lighting near the nursing station.",
 diagram:{type:"fishbone", steps:["People","Process","Equipment","Environment"]}
},

{id:"fmea", name:"FMEA — Failure Mode & Effects Analysis", cat:"Risk scoring",
 summary:"Score risks by severity, occurrence and detection — before a failure ever reaches a patient.",
 explain:"A proactive risk tool used before something goes wrong, not after. For every step in a process, ask what could fail, then score it on three scales (usually 1–10): Severity (how bad if it happens), Occurrence (how likely), Detection (how likely you'd catch it first). Multiply the three for a Risk Priority Number (RPN) — the highest RPNs get fixed first.",
 example:"Process step: preparing IV chemotherapy. Failure mode: wrong concentration mixed. Severity 9 (potentially fatal), Occurrence 3 (rare with double-check), Detection 4 (caught at second verification). RPN = 9×3×4 = 108 — high enough to redesign the verification step.",
 diagram:{type:"formula", label:"Risk Priority Number", formula:"RPN = Severity × Occurrence × Detection"}
},

{id:"capa", name:"CAPA — Corrective & Preventive Action", cat:"Closing the loop",
 summary:"The closed loop that turns a Non-Conformity into evidence you actually fixed it — for good.",
 explain:"Corrective action fixes the immediate problem in front of you. Preventive action stops the same class of problem from happening again anywhere else. A real CAPA record documents both, with evidence the fix actually worked — not just that something was proposed and forgotten.",
 example:"NC: an expired drug found on the ward shelf. Corrective: remove and destroy the expired stock immediately. Preventive: install a monthly near-expiry audit checklist across all wards, re-checked three months later to confirm it's holding.",
 diagram:{type:"steps", steps:["Identify","Contain","Root cause","Corrective action","Preventive action","Verify it held"]}
},

{id:"mms", name:"MMS — Measurement & Management of Safety", cat:"Safety framework",
 summary:"A structured way to measure how safe an organisation actually is, not just how it feels.",
 explain:"MMS treats safety as something you can define, measure, track, and manage like any other operational metric — rather than an abstract culture you can't quantify. It pairs safety indicators with a management response, so a measurement that moves the wrong way automatically triggers a review, not just a report nobody reads.",
 example:"A hospital tracks 'unsafe condition reports closed within 30 days' as an MMS indicator — measured monthly, reviewed by leadership, and escalated if the closure rate drops below target.",
 diagram:{type:"steps", steps:["Define safety measure","Collect data","Analyse trend","Management response","Re-measure"]}
},

{id:"vsm", name:"Value Stream Mapping (VSM) & VAR", cat:"Process flow",
 summary:"Map every step a patient or item goes through, and separate what adds value from what's just waiting.",
 explain:"A Value Stream Map draws out every single step of a process, end to end, with the time each step actually takes. The Value-Added Ratio (VAR) compares time spent on steps that genuinely help the patient against total time in the process, including all the waiting — VAR = Value-Added Time ÷ Total Lead Time. A shockingly low VAR is common, and it's usually the waiting, not the work, that's the problem.",
 example:"A discharge process takes 6 hours total, but the actual value-added steps (final review, medication reconciliation, discharge counselling) add up to 45 minutes. VAR = 45 ÷ 360 = 12.5% — most of the 6 hours is waiting, not working.",
 diagram:{type:"formula", label:"Value-Added Ratio", formula:"VAR = Value-Added Time ÷ Total Lead Time"}
},

{id:"5s", name:"5S", cat:"Workplace organisation",
 summary:"Sort, Set in Order, Shine, Standardize, Sustain — the discipline behind a workspace where nothing is ever 'lost'.",
 explain:"A five-step method for organising any physical workspace so that anything out of place is immediately obvious. Sort removes what's not needed. Set in Order gives everything a fixed home. Shine is cleaning as inspection. Standardize locks the new normal in with visual cues. Sustain is the habit that keeps it from sliding back.",
 example:"A pharmacy shelf sorted by drug class, each bin labelled with a shadow outline so a missing item is visually obvious at a glance, with a weekly 5S audit to sustain it.",
 diagram:{type:"cycle", steps:["Sort","Set in Order","Shine","Standardize","Sustain"]}
},

{id:"6s", name:"6S", cat:"Workplace organisation",
 summary:"5S plus Safety — because in a hospital, an organised space and a safe one have to be the same thing.",
 explain:"An extension of 5S that adds Safety as an explicit, standalone pillar rather than assuming an organised space is automatically a safe one. It forces a direct question at every step: does this arrangement also reduce injury, contamination, or hazard risk?",
 example:"Sharps bins positioned so staff never reach across another surface to dispose of a needle — organisation and injury-prevention solved by the same layout decision.",
 diagram:{type:"cycle", steps:["Sort","Straighten","Shine","Standardize","Sustain","Safety"]}
},

{id:"lean", name:"Lean Principles", cat:"Improvement philosophy",
 summary:"Cut waste, keep what the patient actually values — the five ideas underneath every Lean initiative.",
 explain:"Lean starts by defining Value strictly from the customer's (patient's) point of view. It maps the Value Stream to see the whole journey. It works to create Continuous Flow, removing stops and batching. It moves to a Pull system, where work is triggered by real demand, not pushed ahead of need. And it treats Continuous Improvement (Kaizen) as never finished.",
 example:"An outpatient pharmacy stops batching prescriptions by hour and instead fills them one at a time as they arrive (pull), cutting average wait time even though total staff hours didn't change.",
 diagram:{type:"steps", steps:["Value","Value Stream","Flow","Pull","Continuous Improvement"]}
},

{id:"ssm", name:"Soft Systems Methodology (SSM)", cat:"Problem structuring",
 summary:"For messy, human problems with no clean technical fix — structure the mess before trying to solve it.",
 explain:"SSM is built for 'soft', people-heavy problems where the issue itself is disputed, not just the solution. It works through seven stages: (1–2) picture the messy real-world situation as it is, (3) write a Root Definition of an ideal system using CATWOE, (4) build a conceptual model of how that ideal system would work, (5) compare the model against the real mess to find gaps, (6) agree on changes that are both desirable and realistic, (7) take action.",
 example:"Problem: chaotic outpatient appointments and poor doctor-patient communication. Root definition: 'a patient-centred appointment system, run by clinic staff, that reduces wait time and improves communication.' Comparing the ideal model to reality reveals the missing piece: no digital file retrieval — leading to a concrete, fundable IT project instead of a vague 'communicate better' instruction.",
 diagram:{type:"steps", steps:["Picture the mess","Root definition (CATWOE)","Conceptual model","Compare to reality","Agree changes","Take action"]}
},

{id:"catwoe", name:"CATWOE Analysis", cat:"Problem structuring",
 summary:"The six-lens checklist inside SSM for making sure a Root Definition hasn't missed anyone.",
 explain:"CATWOE forces you to name six elements before declaring you understand a system: Customers (who's affected), Actors (who does the work), Transformation (what input becomes what output), Worldview (why this matters at all), Owners (who could shut it down), and Environmental constraints (the rules you can't change).",
 example:"Customers: patients. Actors: receptionists, doctors. Transformation: disorganised process → organised process. Worldview: a timely system improves care. Owners: hospital management. Environment: budget and legal regulations.",
 diagram:{type:"legend", steps:[["C","Customers","Who is affected"],["A","Actors","Who does the work"],["T","Transformation","Input → output"],["W","Worldview","Why it matters"],["O","Owners","Who could stop it"],["E","Environment","Constraints you can't change"]]}
},

{id:"pqr", name:"The PQR Formula", cat:"Problem structuring",
 summary:"Three questions for writing a clear Root Definition: what, how, and why.",
 explain:"A compact formula for defining any system or intervention: P — what should be done, Q — how it should be done, R — why it should be done. Answering all three, in order, prevents a root definition that's technically true but practically useless.",
 example:"P: reduce medication errors. Q: through a double-verification step at dispensing. R: to protect patients from preventable harm and meet the organisation's safety commitment.",
 diagram:{type:"legend", steps:[["P","What","What should be done"],["Q","How","How it should be done"],["R","Why","Why it should be done"]]}
},

{id:"fivees", name:"The Five E's", cat:"Outcome evaluation",
 summary:"Five questions for judging whether an improvement actually worked, and worked the right way.",
 explain:"A checklist for evaluating any completed intervention beyond just 'did it work'. Efficacy — did it produce the intended outcome? Efficiency — with a reasonable use of resources? Effectiveness — does it serve a bigger, longer-term aim? Ethicality — is it morally sound? Elegance — is the solution well-designed, not just functional?",
 example:"A new triage app reduces wait times (Efficacy) using existing hardware (Efficiency), supports the hospital's long-term access goals (Effectiveness), doesn't disadvantage patients without smartphones (Ethicality), and is genuinely pleasant for staff to use (Elegance).",
 diagram:{type:"legend", steps:[["E1","Efficacy","Did it work?"],["E2","Efficiency","Minimum resources?"],["E3","Effectiveness","Serves the bigger aim?"],["E4","Ethicality","Morally sound?"],["E5","Elegance","Well-designed?"]]}
},

{id:"sixsigma", name:"Six Sigma & DMAIC", cat:"Process capability",
 summary:"Define, Measure, Analyse, Improve, Control — a data-driven method for cutting variation to near-zero defects.",
 explain:"Six Sigma is about reducing variation until a process is statistically near-perfect. DMAIC is its five-phase engine: Define the problem and goal, Measure current performance with real data, Analyse the data to find root causes, Improve by testing and implementing a fix, Control by locking the gain in with ongoing monitoring so it doesn't quietly drift back.",
 example:"Define: cut lab report turnaround variation. Measure: current average 4.2 hrs, but ranging 1–9 hrs. Analyse: the variation traces to batch-processing at one analyser. Improve: switch to continuous processing. Control: a weekly turnaround-variance chart flags any drift.",
 diagram:{type:"funnel", steps:["Define","Measure","Analyse","Improve","Control"]}
},

{id:"donabedian", name:"Donabedian Model", cat:"Quality framework",
 summary:"Structure, Process, Outcome — the simplest, most enduring way to think about healthcare quality.",
 explain:"A foundational healthcare quality model: Structure is the setting — facilities, staff, equipment. Process is what's actually done — the care delivered. Outcome is the result — did the patient get better. The insight is that good Structure makes good Process more likely, and good Process makes good Outcomes more likely — but none of the three guarantees the next.",
 example:"Structure: an ICU with adequate nurse-to-patient ratios. Process: bundle compliance is high. Outcome: ventilator-associated events stay low — three linked layers, each worth measuring on its own.",
 diagram:{type:"legend", steps:[["S","Structure","Setting, staff, equipment"],["P","Process","What's actually done"],["O","Outcome","The result for the patient"]]}
},

{id:"tqm", name:"Total Quality Management (TQM)", cat:"Quality framework",
 summary:"Quality as everyone's job, all the time — not a department, a checkpoint at the end.",
 explain:"TQM is a philosophy more than a tool: quality is built into every step by every person, continuously, rather than inspected for at the end of a process. It relies on customer focus, total staff involvement, process-centred thinking, and continuous improvement as permanent organisational habits.",
 example:"Instead of a final discharge audit catching errors, every department — pharmacy, nursing, records — owns and checks its own piece of the discharge process as it happens.",
 diagram:{type:"steps", steps:["Customer focus","Total involvement","Process thinking","Continuous improvement"]}
},

{id:"bsc", name:"Balanced Scorecard", cat:"Performance framework",
 summary:"Financial, Customer, Internal Process, and Learning & Growth — four lenses so no single metric dominates.",
 explain:"A performance-management framework that deliberately balances four perspectives so an organisation doesn't over-optimise for money at the expense of everything else. Financial (are we sustainable), Customer (are patients satisfied), Internal Process (are our processes efficient), Learning & Growth (are our people and systems improving).",
 example:"A hospital's scorecard tracks operating margin (Financial), patient satisfaction scores (Customer), average length of stay (Internal Process), and staff training-hours completed (Learning & Growth) — reviewed together, not separately.",
 diagram:{type:"quadrant", steps:["Financial","Customer","Internal Process","Learning & Growth"]}
},

{id:"toc", name:"Theory of Constraints", cat:"Bottleneck management",
 summary:"Every system has exactly one bottleneck at a time — find it, and fix the system around it.",
 explain:"The Theory of Constraints argues that a chain is only as strong as its weakest link, so improving anything except the actual bottleneck is often wasted effort. Its five focusing steps: Identify the constraint, Exploit it (get the most out of it as-is), Subordinate everything else to that decision, Elevate the constraint (invest to remove it), and Avoid inertia — because once it's fixed, the bottleneck moves somewhere else.",
 example:"A single CT scanner is the bottleneck for imaging turnaround. Exploit: reschedule to eliminate scanner idle time. Subordinate: other steps adjust around the scanner's schedule. Elevate: add scanning capacity. Avoid inertia: re-identify the new bottleneck once this one clears.",
 diagram:{type:"steps", steps:["Identify","Exploit","Subordinate","Elevate","Avoid inertia"]}
},

{id:"iso9001", name:"ISO 9001:2015", cat:"Quality framework",
 summary:"The internationally recognised backbone of a quality management system — six themes, one standard.",
 explain:"ISO 9001:2015 is a globally used quality-management-system standard many healthcare organisations run alongside clinical accreditation. Its core themes: Leadership commitment, Planning (risk-based thinking), Support (resources, competence), Operation (process control), Performance Evaluation (monitoring and audit), and Improvement (correcting and advancing continuously).",
 example:"A hospital's central sterile supply department runs an ISO 9001-certified quality system alongside its NABH accreditation, giving it an externally audited process-control layer on top of the clinical standard.",
 diagram:{type:"steps", steps:["Leadership","Planning","Support","Operation","Performance evaluation","Improvement"]}
},

{id:"procmap", name:"Process Mapping", cat:"Visual documentation",
 summary:"The universal symbol language for drawing out how a process actually flows, step by step.",
 explain:"Process maps use a small, standard set of shapes so anyone can read them at a glance: an oval marks the start or stop, a rectangle is a process step, a diamond is a decision/question point, and an arrow shows the direction of flow. The value is forcing a team to agree, visually, on what actually happens — which is often not what the policy document says happens.",
 example:"Mapping the actual patient-admission process often reveals an undocumented workaround — a decision diamond nobody had written down — that turns out to be where most delays start.",
 diagram:{type:"legend", steps:[["◯","Oval","Start / Stop"],["▭","Rectangle","Process step"],["◇","Diamond","Decision / question"],["→","Arrow","Direction of flow"]]}
},

{id:"pokayoke", name:"Poka-Yoke (Mistake-Proofing)", cat:"Error prevention",
 summary:"Design the mistake out of the process entirely, rather than relying on someone remembering not to make it.",
 explain:"Poka-Yoke means designing a process or device so that the error simply can't happen, or is caught the instant it does — rather than depending on training, memory, or vigilance alone. The best fixes make the wrong action physically impossible or immediately obvious.",
 example:"An oxygen connector that physically cannot be plugged into a nitrogen outlet, because the fittings are shaped differently — the error is prevented by design, not by a warning label.",
 diagram:{type:"legend", steps:[["1","Prevent","Make the wrong action impossible"],["2","Detect","Catch the error the instant it happens"],["3","Warn","Alert before the error causes harm"]]}
},

{id:"downtime", name:"DOWNTIME — The 8 Wastes of Lean", cat:"Waste identification",
 summary:"Defects, Overproduction, Waiting, Non-utilised talent, Transportation, Inventory, Motion, Extra processing.",
 explain:"A memorable checklist of the eight categories of waste Lean tries to eliminate. Used in a 'waste walk' — physically observing a process and classifying everything that doesn't add value into one of these eight buckets, which turns a vague sense of inefficiency into specific, fixable categories.",
 example:"A waste walk through a ward finds: Defects (rework on mislabeled samples), Waiting (patients queued for discharge paperwork), Motion (nurses walking long distances to a poorly placed supply room), and Extra processing (duplicate data entry in two systems).",
 diagram:{type:"listgrid", steps:["Defects","Overproduction","Waiting","Non-utilised talent","Transportation","Inventory","Motion","Extra processing"]}
},

{id:"hoshin", name:"Hoshin Kanri", cat:"Strategy deployment",
 summary:"Policy deployment — turning a top-level strategic goal into aligned action at every level, with 'catchball' agreement.",
 explain:"Hoshin (policy/target) Kanri (deployment/management) is a strategic-planning method for cascading a small number of critical goals from leadership down to frontline action, with everyone genuinely aligned rather than just informed. 'Catchball' is the back-and-forth negotiation where frontline teams and management agree on a target together before it's finalised — not handed down as an order.",
 example:"Leadership sets a strategic goal to cut readmissions 15% this year. Through catchball, each department negotiates its specific contribution and method — nursing owns discharge education, pharmacy owns medication reconciliation — rather than being told a number with no input.",
 diagram:{type:"steps", steps:["Set strategic goal","Cascade to departments","Catchball (negotiate)","Deploy aligned actions","Review & adjust"]}
},

{id:"pick", name:"PICK Chart", cat:"Prioritisation",
 summary:"A 2×2 matrix sorting improvement ideas by payoff versus ease of implementation.",
 explain:"PICK stands for the four quadrants an idea can land in: Possible (easy to implement, low payoff), Implement (easy to implement, high payoff — do these first), Challenge (hard to implement, high payoff — worth the effort), Kill (hard to implement, low payoff — don't bother). It's a fast way to stop a long brainstormed list from turning into an unprioritised mess.",
 example:"After a brainstorm on reducing wait times, 'add a second reception screen' lands in Implement (cheap, high impact), while 'build a new wing' lands in Kill for this cycle (expensive, marginal impact right now).",
 diagram:{type:"matrix2x2", steps:["Possible","Implement","Challenge","Kill"]}
},

{id:"logicmodel", name:"Logic Models", cat:"Programme planning",
 summary:"Rationale, Inputs, Activities, Output, Outcomes, Impacts — the full chain from resource to result.",
 explain:"A logic model lays out, in one line, the entire causal chain of a programme: the Rationale (why it exists), Inputs (resources put in), Activities (what's actually done), Outputs (immediate, countable results), Outcomes (medium-term changes), and Impacts (the ultimate, long-term goal). It exposes gaps — like an activity with no plausible link to the stated impact.",
 example:"Rationale: reduce infection risk. Inputs: hand-hygiene training budget. Activities: staff training sessions. Output: 95% staff trained. Outcome: hand hygiene compliance rises to 86%. Impact: hospital-acquired infection rate falls.",
 diagram:{type:"steps", steps:["Rationale","Inputs","Activities","Outputs","Outcomes","Impacts"]}
},

{id:"procindicators", name:"Process Indicator Criteria", cat:"Indicator design",
 summary:"Research, Accuracy, Proximity, No adverse effects, Specificity — five tests for whether a metric is actually worth tracking.",
 explain:"Before adopting any quality indicator, these five criteria test whether it's actually worth the effort to collect: is it grounded in Research/evidence, is it Accurate, is it Proximate (close enough to the real outcome to be meaningful), does measuring it avoid causing Adverse effects (gaming, distraction from care), and is it Specific enough to point to a clear action.",
 example:"'Number of patient complaints' is easy to collect but low on Specificity (doesn't say what to fix); 'time-to-antibiotic in sepsis' scores well on all five — evidence-based, accurate, close to outcome, safe to measure, and specific.",
 diagram:{type:"legend", steps:[["R","Research","Grounded in evidence"],["A","Accuracy","Measures what it claims"],["P","Proximity","Close to the real outcome"],["N","No adverse effects","Doesn't distort behaviour"],["S","Specificity","Points to a clear action"]]}
},

{id:"gtt", name:"Global Trigger Tool (GTT)", cat:"Harm detection",
 summary:"A retrospective record review that hunts for 'triggers' — clues that harm happened, even if it was never reported.",
 explain:"Voluntary incident reporting typically catches only a fraction of actual patient harm. The Global Trigger Tool takes a structured, retrospective look at a sample of medical records for specific 'triggers' — like a sudden drug stopped, a rapid-response call, or an unplanned return to theatre — that flag a strong chance an adverse event occurred, even if nobody filed a report for it.",
 example:"A reviewer spots naloxone administered on a record with no documented opioid overdose reported — a trigger prompting a deeper look that uncovers an unreported over-sedation event.",
 diagram:{type:"steps", steps:["Sample records","Screen for triggers","Confirm harm","Classify severity","Feed back to safety programme"]}
},

{id:"psfh", name:"Patient Safety Friendly Hospital (PSFH)", cat:"Safety culture framework",
 summary:"A whole-organisation framework and self-assessment for building a genuine patient-safety culture, not just a checklist.",
 explain:"PSFH is a broader organisational framework (associated with WHO's regional patient-safety work) that assesses a hospital across multiple safety-culture domains — leadership commitment, patient involvement, and safe systems of care — rather than any single indicator. It's used as a structured self-assessment to see how deeply safety is embedded, not just documented.",
 example:"A hospital scoring high on paper compliance but low on staff psychological safety (fear of reporting errors) would show that gap clearly under a PSFH-style assessment, prompting a culture intervention rather than another policy document.",
 diagram:{type:"legend", steps:[["1","Leadership","Visible commitment to safety"],["2","Patient involvement","Patients as safety partners"],["3","Safe systems","Systems designed to prevent harm"]]}
},

];
