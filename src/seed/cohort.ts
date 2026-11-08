// Every name, company and email in this file is invented for the demo.

export const PROGRAM = {
  key: "northwind",
  name: "Northwind Climate Accelerator",
  cohort: 2,
  week: 5,
  totalWeeks: 10,
};

export const PROGRAM_START = new Date("2026-10-05T09:00:00Z");

type Status = "on_track" | "drifting" | "at_risk";

export const STARTUPS: {
  key: string;
  name: string;
  oneLiner: string;
  status: Status;
  riskLevel: number;
  demoDaySlot: number;
  founder: string;
}[] = [
  { key: "tidewatt", name: "Tidewatt", oneLiner: "Tidal micro-turbines for island grids", status: "on_track", riskLevel: 0, demoDaySlot: 1, founder: "Lena Okafor" },
  { key: "soilmind", name: "Soilmind", oneLiner: "Soil-carbon sensing for regenerative farms", status: "drifting", riskLevel: 1, demoDaySlot: 2, founder: "Mateo Ruiz" },
  { key: "kelpforge", name: "Kelpforge", oneLiner: "Kelp-based packaging that composts in weeks", status: "on_track", riskLevel: 1, demoDaySlot: 3, founder: "Priya Natarajan" },
  { key: "gridlet", name: "Gridlet", oneLiner: "Peer-to-peer solar trading for apartment blocks", status: "at_risk", riskLevel: 2, demoDaySlot: 4, founder: "Tomas Lindqvist" },
  { key: "brinewell", name: "Brinewell", oneLiner: "Low-energy desalination for small towns", status: "drifting", riskLevel: 1, demoDaySlot: 5, founder: "Amara Diallo" },
  { key: "coolpath", name: "Coolpath", oneLiner: "Cold-chain monitoring for vaccine delivery", status: "on_track", riskLevel: 0, demoDaySlot: 6, founder: "Hana Sato" },
  { key: "rewild", name: "Rewild Labs", oneLiner: "Drone seeding for burned forest land", status: "on_track", riskLevel: 0, demoDaySlot: 7, founder: "Owen Blake" },
  { key: "voltcycle", name: "Voltcycle", oneLiner: "Second-life batteries from e-bikes", status: "on_track", riskLevel: 0, demoDaySlot: 8, founder: "Sofia Marin" },
  { key: "aqualedger", name: "Aqualedger", oneLiner: "Water-use tracking for textile mills", status: "on_track", riskLevel: 0, demoDaySlot: 9, founder: "Ravi Menon" },
  { key: "heatloop", name: "Heatloop", oneLiner: "Waste-heat recovery for data centers", status: "on_track", riskLevel: 0, demoDaySlot: 10, founder: "Clara Weiss" },
];

export const MENTORS: { key: string; name: string; focus: string }[] = [
  { key: "dana", name: "Dana Whitfield", focus: "founder dynamics" },
  { key: "marcus", name: "Marcus Bell", focus: "go-to-market" },
  { key: "ines", name: "Ines Carvalho", focus: "hardware manufacturing" },
  { key: "kenji", name: "Kenji Mori", focus: "energy markets" },
  { key: "ruth", name: "Ruth Adeyemi", focus: "fundraising" },
  { key: "paolo", name: "Paolo Ferri", focus: "regulation and permits" },
  { key: "grace", name: "Grace Lin", focus: "product" },
  { key: "omar", name: "Omar Haddad", focus: "pilots with utilities" },
];

export const INVESTORS: { key: string; name: string; firm: string; confirmed: boolean }[] = [
  { key: "elise", name: "Elise Varga", firm: "Fjord Climate Ventures", confirmed: true },
  { key: "noah", name: "Noah Brennan", firm: "Greenline Capital", confirmed: true },
  { key: "yuki", name: "Yuki Tanaka", firm: "Harbor Seed", confirmed: true },
  { key: "felix", name: "Felix Ortega", firm: "Catalyst Earth Fund", confirmed: false },
  { key: "maren", name: "Maren Holt", firm: "Northern Lights Angels", confirmed: false },
  { key: "isaac", name: "Isaac Mensah", firm: "Equator Impact", confirmed: false },
];

export const STAFF = { key: "sam", name: "Sam Rivera", role: "Program manager" };

// The demo's "today" (week 5) and the program manager's open call slots over the next few days.
export const DEMO_TODAY = "Tuesday, Nov 3 2026";
export const PM_OPEN_SLOTS = [
  "Wed Nov 4, 16:30-17:00",
  "Thu Nov 5, 10:00-10:30",
  "Thu Nov 5, 16:30-17:00",
  "Mon Nov 9, 11:00-11:30",
];

export const EVENTS = [
  { key: "investor-panel", name: "Investor panel", kind: "investor_panel", startsAt: new Date("2026-11-19T16:00:00Z") },
  { key: "demo-day", name: "Demo day", kind: "demo_day", startsAt: new Date("2026-12-10T15:00:00Z") },
];

// Weeks 1-4 of mentor sessions. Kelpforge's week-2 note is the first co-founder-tension flag,
// so the scripted mentor notes on day 1 are "the second flag in 3 weeks".
export const SESSIONS: { startup: string; mentor: string; week: number; notes: string }[] = [
  { startup: "tidewatt", mentor: "kenji", week: 1, notes: "Mapped the three island utilities worth piloting with. Lena will draft the pilot one-pager." },
  { startup: "tidewatt", mentor: "omar", week: 3, notes: "Two utilities replied. Pilot LOI template shared. Strong momentum." },
  { startup: "soilmind", mentor: "grace", week: 1, notes: "Too many customer segments. Agreed to focus on cooperatives first." },
  { startup: "soilmind", mentor: "marcus", week: 3, notes: "Mateo missed the follow-up deadline on the co-op interviews. Nudge needed." },
  { startup: "kelpforge", mentor: "ines", week: 1, notes: "Reviewed the pilot line. Supplier for food-grade binder still open." },
  { startup: "kelpforge", mentor: "dana", week: 2, notes: "Some co-founder tension: Priya wants to raise now, her co-founder wants six more months of revenue. Worth watching." },
  { startup: "gridlet", mentor: "paolo", week: 2, notes: "Regulator says peer-to-peer trading needs a supply licence. This blocks the pilot." },
  { startup: "gridlet", mentor: "kenji", week: 4, notes: "Explored a licensed-partner model. Tomas is discouraged; check in personally." },
  { startup: "brinewell", mentor: "ines", week: 2, notes: "Membrane cost estimate is 40% over plan. Needs a second supplier quote." },
  { startup: "brinewell", mentor: "ruth", week: 4, notes: "Amara is unsure whether to raise or apply for a grant. No decision yet." },
  { startup: "coolpath", mentor: "grace", week: 1, notes: "Dashboard prototype tested with two clinics. Clear next steps." },
  { startup: "coolpath", mentor: "omar", week: 3, notes: "Signed a paid pilot with a regional distributor." },
  { startup: "rewild", mentor: "paolo", week: 2, notes: "Drone permit application filed. Seed supply contract in progress." },
  { startup: "rewild", mentor: "marcus", week: 4, notes: "Pricing model per hectare agreed. First municipal lead." },
  { startup: "voltcycle", mentor: "ines", week: 1, notes: "Battery testing protocol drafted. Safety certification path mapped." },
  { startup: "voltcycle", mentor: "ruth", week: 3, notes: "Pre-seed deck reviewed. Ready for the investor panel." },
  { startup: "aqualedger", mentor: "marcus", week: 2, notes: "Three mills in the pipeline. Sales cycle longer than expected." },
  { startup: "aqualedger", mentor: "grace", week: 4, notes: "Onboarding flow cut from 5 steps to 2." },
  { startup: "heatloop", mentor: "kenji", week: 1, notes: "Data-center operator intro made. Heat buyer still needed." },
  { startup: "heatloop", mentor: "omar", week: 3, notes: "Municipal heating network interested. LOI expected next week." },
];

export const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
