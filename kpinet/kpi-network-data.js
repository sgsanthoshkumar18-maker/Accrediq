/* AQcredix — KPI network data
 *
 * IMPORTANT, PLEASE READ BEFORE CHANGING THESE NUMBERS
 * ----------------------------------------------------
 * The NABH standards book does NOT publish numeric benchmark values for
 * quality indicators. NABH requires each organisation to DEFINE its own
 * indicators and SET its own benchmarks and targets (see PSQ.3), and to show
 * that breaches trigger action. So nothing below is an "official NABH number".
 *
 * The `target` field is a COMMONLY USED REFERENCE VALUE drawn from widely
 * cited hospital-quality practice, provided as a starting point for a team
 * that has not yet set its own. Every card says so in the UI.
 *
 * `ref` is a real NABH 6th-edition Objective Element code that makes the
 * indicator relevant — those are verified against nabh-data.js.
 */
window.KPI_NETWORK = [
  // --- Infection control (teal) ---
  { id:"hh",    name:"Hand Hygiene Compliance Rate", dept:"Infection Control", domain:"infection",
    formula:"compliant moments ÷ observed moments × 100", unit:"%", target:"≥ 80%", dir:"higher", ref:"IPC.3.b" },
  { id:"cauti", name:"Catheter-Associated UTI Rate", dept:"Infection Control", domain:"infection",
    formula:"CAUTI cases ÷ urinary-catheter days × 1000", unit:"per 1,000 cath-days", target:"< 2.0", dir:"lower", ref:"IPC.5.a" },
  { id:"clabsi",name:"Central Line Associated Bloodstream Infection Rate", dept:"ICU", domain:"infection",
    formula:"CLABSI cases ÷ central-line days × 1000", unit:"per 1,000 line-days", target:"< 1.0", dir:"lower", ref:"IPC.5.a" },
  { id:"vae",   name:"Ventilator-Associated Event Rate", dept:"ICU", domain:"infection",
    formula:"VAE cases ÷ ventilator days × 1000", unit:"per 1,000 vent-days", target:"< 1.5", dir:"lower", ref:"IPC.5.a" },
  { id:"ssi",   name:"Surgical Site Infection Rate", dept:"Operation Theatre", domain:"infection",
    formula:"SSI cases ÷ surgeries performed × 100", unit:"%", target:"< 1.5%", dir:"lower", ref:"IPC.5.a" },
  { id:"bmw",   name:"BMW Segregation Accuracy", dept:"Housekeeping", domain:"infection",
    formula:"correctly segregated bins ÷ bins audited × 100", unit:"%", target:"≥ 95%", dir:"higher", ref:"IPC.4.d" },
  { id:"bi",    name:"Biological Indicator Pass Rate", dept:"CSSD", domain:"infection",
    formula:"passed BI tests ÷ total BI tests × 100", unit:"%", target:"100%", dir:"higher", ref:"IPC.7.b" },
  { id:"hai",   name:"Overall Healthcare-Associated Infection Rate", dept:"Infection Control", domain:"infection",
    formula:"HAI cases ÷ patient days × 1000", unit:"per 1,000 pt-days", target:"Track trend", dir:"lower", ref:"IPC.6.a" },

  // --- Medication safety (red) ---
  { id:"mederr", name:"Medication Error Rate", dept:"Pharmacy", domain:"medication",
    formula:"medication errors ÷ medication orders × 1000", unit:"per 1,000 orders", target:"< 3.0", dir:"lower", ref:"MOM.8.c" },
  { id:"adr",    name:"Adverse Drug Reaction Rate", dept:"Pharmacy", domain:"medication",
    formula:"reported ADRs ÷ patients on medication × 1000", unit:"per 1,000 patients", target:"Track trend", dir:"lower", ref:"MOM.8.c" },
  { id:"nearmiss",name:"Medication Near-Miss Reporting Rate", dept:"Pharmacy", domain:"medication",
    formula:"near misses reported ÷ 1,000 orders", unit:"per 1,000 orders", target:"Trend upward", dir:"higher", ref:"MOM.8.d" },
  { id:"lasa",   name:"High-Alert / LASA Storage Compliance", dept:"Pharmacy", domain:"medication",
    formula:"compliant storage points ÷ points audited × 100", unit:"%", target:"100%", dir:"higher", ref:"MOM.3.b" },
  { id:"coldchain",name:"Cold-Chain Excursion Count", dept:"Pharmacy", domain:"medication",
    formula:"count of temperature excursions per month", unit:"per month", target:"0", dir:"lower", ref:"MOM.3.c" },
  { id:"tat_rx", name:"Prescription Turnaround Time", dept:"Pharmacy", domain:"medication",
    formula:"mean minutes from receipt to dispensing", unit:"minutes", target:"< 10 min", dir:"lower", ref:"MOM.6.a" },

  // --- Patient safety (green) ---
  { id:"falls",  name:"Patient Fall Rate", dept:"Nursing", domain:"safety",
    formula:"falls ÷ patient days × 1000", unit:"per 1,000 pt-days", target:"< 1.0", dir:"lower", ref:"PSQ.7.a" },
  { id:"pu",     name:"Hospital-Acquired Pressure Ulcer Rate", dept:"Nursing", domain:"safety",
    formula:"new pressure ulcers ÷ patient days × 1000", unit:"per 1,000 pt-days", target:"< 1.0", dir:"lower", ref:"COP.6.b" },
  { id:"wrongsite",name:"Wrong-Site / Wrong-Patient Event Count", dept:"Operation Theatre", domain:"safety",
    formula:"count of never-events per period", unit:"count", target:"0", dir:"lower", ref:"COP.14.d" },
  { id:"checklist",name:"Surgical Safety Checklist Compliance", dept:"Operation Theatre", domain:"safety",
    formula:"cases with full checklist ÷ total cases × 100", unit:"%", target:"100%", dir:"higher", ref:"COP.14.c" },
  { id:"incident",name:"Incident Reporting Rate", dept:"Quality Department", domain:"safety",
    formula:"incidents reported ÷ patient days × 1000", unit:"per 1,000 pt-days", target:"Trend upward", dir:"higher", ref:"PSQ.7.a" },
  { id:"capa",   name:"CAPA Closure Within Committed Timeline", dept:"Quality Department", domain:"safety",
    formula:"CAPAs closed on time ÷ CAPAs raised × 100", unit:"%", target:"≥ 90%", dir:"higher", ref:"PSQ.7.c" },
  { id:"sentinel",name:"Sentinel Event Count", dept:"Quality Department", domain:"safety",
    formula:"count of sentinel events per period", unit:"count", target:"0", dir:"lower", ref:"PSQ.7.b" },
  { id:"transfusion",name:"Transfusion Reaction Rate", dept:"Blood Bank", domain:"safety",
    formula:"reactions ÷ units transfused × 100", unit:"%", target:"< 0.05%", dir:"lower", ref:"COP.8.d" },

  // --- Operational / access (blue) ---
  { id:"triage", name:"Triage Time Compliance", dept:"Emergency", domain:"operational",
    formula:"patients triaged within target ÷ total arrivals × 100", unit:"%", target:"≥ 95%", dir:"higher", ref:"AAC.2.e" },
  { id:"d2d",    name:"Door-to-Doctor Time", dept:"Emergency", domain:"operational",
    formula:"mean minutes from arrival to clinician contact", unit:"minutes", target:"< 15 min", dir:"lower", ref:"AAC.2.e" },
  { id:"lwbs",   name:"Left Without Being Seen Rate", dept:"Emergency", domain:"operational",
    formula:"patients leaving before review ÷ total arrivals × 100", unit:"%", target:"< 2%", dir:"lower", ref:"AAC.2.d" },
  { id:"icureadmit",name:"ICU Readmission Within 48 Hours", dept:"ICU", domain:"operational",
    formula:"unplanned ICU returns ÷ ICU discharges × 100", unit:"%", target:"< 2%", dir:"lower", ref:"COP.9.c" },
  { id:"los",    name:"Average Length of Stay", dept:"Administration", domain:"operational",
    formula:"total inpatient days ÷ discharges", unit:"days", target:"Benchmark by case-mix", dir:"lower", ref:"AAC.12.g" },
  { id:"dischargetat",name:"Discharge Turnaround Time", dept:"Administration", domain:"operational",
    formula:"mean minutes from discharge order to exit", unit:"minutes", target:"< 120 min", dir:"lower", ref:"AAC.12.g" },
  { id:"labtat",  name:"Laboratory Report Turnaround Time", dept:"Laboratory", domain:"operational",
    formula:"mean hours from collection to report", unit:"hours", target:"Define per test", dir:"lower", ref:"AAC.6.e" },
  { id:"critval", name:"Critical Value Reporting Time", dept:"Laboratory", domain:"operational",
    formula:"mean minutes from result to clinician notification", unit:"minutes", target:"< 30 min", dir:"lower", ref:"AAC.6.f" },
  { id:"reject",  name:"Sample Rejection Rate", dept:"Laboratory", domain:"operational",
    formula:"rejected samples ÷ samples received × 100", unit:"%", target:"< 2%", dir:"lower", ref:"AAC.6.d" },
  { id:"redoimg", name:"Repeat Imaging Rate", dept:"Radiology", domain:"operational",
    formula:"repeated studies ÷ total studies × 100", unit:"%", target:"< 5%", dir:"lower", ref:"AAC.9.c" },
  { id:"ppm",     name:"Preventive Maintenance Adherence", dept:"Biomedical Engineering", domain:"operational",
    formula:"PPM completed on schedule ÷ PPM due × 100", unit:"%", target:"≥ 95%", dir:"higher", ref:"FMS.5.c" },
  { id:"mrd24",   name:"Discharge Summary Completion Within 24 Hours", dept:"Medical Records", domain:"operational",
    formula:"summaries complete in 24h ÷ discharges × 100", unit:"%", target:"≥ 90%", dir:"higher", ref:"IMS.4.b" },
  { id:"training",name:"Mandatory Training Completion", dept:"Human Resources", domain:"operational",
    formula:"staff completing training ÷ staff due × 100", unit:"%", target:"≥ 90%", dir:"higher", ref:"HRM.6.a" },
  { id:"credential",name:"Credentialing Verification Compliance", dept:"Human Resources", domain:"operational",
    formula:"verified practitioners ÷ practitioners appointed × 100", unit:"%", target:"100%", dir:"higher", ref:"HRM.11.a" },
  { id:"satisfaction",name:"Patient Satisfaction Score", dept:"Front Office", domain:"operational",
    formula:"mean of validated satisfaction survey", unit:"score", target:"Set and trend", dir:"higher", ref:"PRE.7.a" },
  { id:"grievance",name:"Grievance Closure Time", dept:"Front Office", domain:"operational",
    formula:"mean days from complaint to closure", unit:"days", target:"< 7 days", dir:"lower", ref:"PRE.7.c" }
];
