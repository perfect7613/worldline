export type ScenarioMode = "founder" | "policy";
export type EvidenceKind = "example_material" | "computed" | "simulated" | "user_provided";
export type MemoryTag = "Fixture memory";

export interface ResidentMemory {
  id: string;
  text: string;
  tag: MemoryTag;
  provenance: string;
}

export interface ResidentEvidence {
  id: string;
  title: string;
  excerpt: string;
  kind: EvidenceKind;
  label: string;
  href?: string;
}

export interface ResidentRelation {
  otherId: string;
  label: string;
}

export interface ResidentFixture {
  id: string;
  name: string;
  role: string;
  goal: string;
  action: string;
  marker: string;
  color: number;
  memories: ResidentMemory[];
  evidence: ResidentEvidence[];
  relations: ResidentRelation[];
  incomeMonthly: number;
}

export interface StrategyPlan {
  id: "A" | "B";
  name: string;
  summary: string;
  paidPlacement: number;
  communityWorkshops: number;
  assumption: string;
}

export interface ScenarioBrief {
  mode: ScenarioMode;
  productName: string;
  description?: string;
  productUrl: string;
  decision: string;
  audience: string;
  constraint: string;
  source: "fixture" | "local_form" | "website_capture";
  capturedEvidence?: { title: string; url: string; capturedAt: string; markdown: string };
}

export interface ActivityItem {
  id: string;
  at: number;
  actorId: string | null;
  kind: "simulated" | "computed" | "user" | "fixture";
  text: string;
}

export interface WorldEvent {
  id: string;
  actorId?: string;
  text: string;
  kind: ActivityItem["kind"];
}

export const FIXTURE_SEED = "northstar-local-12";
export const LAUNCH_BUDGET = 20_000;
export const POLICY_BUDGET = 30_000;
export const VOUCHER_AMOUNT = 3_000;
export const TRANSPORT_NEED = 4_000;

export const NORTHSTAR_BRIEF: ScenarioBrief = {
  mode: "founder",
  productName: "Northstar",
  productUrl: "https://example.invalid/northstar",
  decision: "Should Northstar lead with a weekly planning ritual or a lightweight standup replacement?",
  audience: "Founder teams of 4–12 who already use chat and a shared doc.",
  constraint: "₹20,000 launch budget.",
  source: "fixture",
};

export const STRATEGY_A: StrategyPlan = {
  id: "A",
  name: "Baseline — paid placement first",
  summary: "Buy a small sponsored slot, then run one community workshop.",
  paidPlacement: 12_000,
  communityWorkshops: 8_000,
  assumption: "Assumed channel costs. Not a measured CAC or reach model.",
};

export const STRATEGY_B: StrategyPlan = {
  id: "B",
  name: "Alternative — community first",
  summary: "Spend most of the budget on workshops; keep a modest paid reminder.",
  paidPlacement: 6_000,
  communityWorkshops: 14_000,
  assumption: "Same ₹20,000 total. Allocation is an editable test assumption.",
};


const MARKERS = ["■", "●", "▲", "◆", "✚", "★", "○", "□", "▽", "◇", "✦", "▣"] as const;
const COLORS = [
  0xffcf70, 0x7ad4ff, 0xff8a7a, 0x9dffb0, 0xe0a6ff, 0xffd27a, 0x8ce0d0, 0xffb3d1,
  0xc2d4ff, 0xf6e27a, 0x9ad0ff, 0xffc4a8,
] as const;

function memory(id: string, text: string): ResidentMemory {
  return {
    id,
    text,
    tag: "Fixture memory",
    provenance: "Synthetic fixture · not a real person or scraped profile",
  };
}

function evidence(id: string, title: string, excerpt: string): ResidentEvidence {
  return {
    id,
    title,
    excerpt,
    kind: "example_material",
    label: "Example material",
  };
}

export const RESIDENTS: ResidentFixture[] = [
  {
    id: "mira",
    name: "Mira Chen",
    role: "Early-stage founder",
    goal: "Find a weekly planning habit the team will actually keep.",
    action: "Reading the Northstar homepage fixture",
    marker: MARKERS[0],
    color: COLORS[0],
      incomeMonthly: 15_000,
    memories: [memory("mira-m1", "Tried three planning tools last year; two died after a sprint.")],
    evidence: [evidence("mira-e1", "Homepage hero (example)", "Northstar is described as a team planning ritual, not a chat app.")],
    relations: [{ otherId: "arjun", label: "Asks for product framing" }, { otherId: "leo", label: "Shares indie-tool notes" }],
  },
  {
    id: "arjun",
    name: "Arjun Rao",
    role: "Head of product",
    goal: "Protect mid-market teams from another unused ritual.",
    action: "Comparing offer language",
    marker: MARKERS[1],
    color: COLORS[1],
      incomeMonthly: 40_000,
    memories: [memory("arjun-m1", "Last tool promised standups and became a status dump.")],
    evidence: [evidence("arjun-e1", "Pricing page (example)", "Fixture copy lists a team plan without a free trial claim.")],
    relations: [{ otherId: "chris", label: "Budget checkpoint" }, { otherId: "mira", label: "Peer founder chat" }],
  },
  {
    id: "priya",
    name: "Priya Shah",
    role: "Community organizer",
    goal: "Host a workshop that is useful even if nobody buys.",
    action: "Drafting a workshop invite",
    marker: MARKERS[2],
    color: COLORS[2],
      incomeMonthly: 25_000,
    memories: [memory("priya-m1", "Workshop no-shows spike when the invite sounds like a pitch.")],
    evidence: [evidence("priya-e1", "Community FAQ (example)", "Example material: people ask who the session is for.")],
    relations: [{ otherId: "amina", label: "Co-hosts events" }, { otherId: "tess", label: "Channel admin" }],
  },
  {
    id: "leo",
    name: "Leo Hart",
    role: "Indie maker",
    goal: "See if Northstar replaces a messy Notion page.",
    action: "Idle on the plaza",
    marker: MARKERS[3],
    color: COLORS[3],
      incomeMonthly: 15_000,
    memories: [memory("leo-m1", "Pays for tools only after a week of daily use.")],
    evidence: [evidence("leo-e1", "Feature list (example)", "Mentions weekly ritual, not calendar sync.")],
    relations: [{ otherId: "jonah", label: "Maker-to-student" }, { otherId: "mira", label: "Tool swap" }],
  },
  {
    id: "nadia",
    name: "Nadia Okonkwo",
    role: "Agency project manager",
    goal: "Keep two client teams aligned without extra meetings.",
    action: "Walking the boulevard",
    marker: MARKERS[4],
    color: COLORS[4],
      incomeMonthly: 40_000,
    memories: [memory("nadia-m1", "Clients reject tools that require a new login ritual.")],
    evidence: [evidence("nadia-e1", "Onboarding steps (example)", "Example material lists four setup screens.")],
    relations: [{ otherId: "samir", label: "Ops pairing" }, { otherId: "elena", label: "Asks for research" }],
  },
  {
    id: "samir",
    name: "Samir Patel",
    role: "Operations lead",
    goal: "Know who owns the next decision by Friday.",
    action: "Checking the activity board",
    marker: MARKERS[5],
    color: COLORS[5],
      incomeMonthly: 25_000,
    memories: [memory("samir-m1", "Prefers a single owner field over a long thread.")],
    evidence: [evidence("samir-e1", "Task model (example)", "Fixture describes owners, not tickets.")],
    relations: [{ otherId: "rob", label: "Engineering skepticism" }, { otherId: "nadia", label: "Agency ops" }],
  },
  {
    id: "elena",
    name: "Elena Voss",
    role: "Researcher",
    goal: "Separate claimed outcomes from simulated ones.",
    action: "Annotating evidence labels",
    marker: MARKERS[6],
    color: COLORS[6],
      incomeMonthly: 40_000,
    memories: [memory("elena-m1", "Flags any conversion number that lacks a denominator.")],
    evidence: [evidence("elena-e1", "Methods note (example)", "This world is a fixture. Behaviors are simulated.")],
    relations: [{ otherId: "arjun", label: "Reviews claims" }, { otherId: "nadia", label: "Interview design" }],
  },
  {
    id: "jonah",
    name: "Jonah Kim",
    role: "Student founder",
    goal: "Learn how a small team plans without hiring a PM.",
    action: "Asking a peer about the offer",
    marker: MARKERS[7],
    color: COLORS[7],
      incomeMonthly: 15_000,
    memories: [memory("jonah-m1", "Heard about Northstar from Leo, not from an ad.")],
    evidence: [evidence("jonah-e1", "Peer message (example)", "Simulated second-hand description, not a browser visit.")],
    relations: [{ otherId: "leo", label: "Heard it from" }, { otherId: "tess", label: "Campus Slack" }],
  },
  {
    id: "tess",
    name: "Tess Alvarez",
    role: "Workspace champion",
    goal: "Introduce a tool without becoming the unpaid admin.",
    action: "Waiting near the storefront",
    marker: MARKERS[8],
    color: COLORS[8],
      incomeMonthly: 25_000,
    memories: [memory("tess-m1", "Will not install another bot without a kill switch.")],
    evidence: [evidence("tess-e1", "Permissions copy (example)", "Example material is silent on admin burden.")],
    relations: [{ otherId: "priya", label: "Community channel" }, { otherId: "jonah", label: "Student workspace" }],
  },
  {
    id: "chris",
    name: "Chris Ng",
    role: "Finance partner",
    goal: "Keep the launch spend inside ₹20,000.",
    action: "Reviewing the allocation",
    marker: MARKERS[9],
    color: COLORS[9],
      incomeMonthly: 40_000,
    memories: [memory("chris-m1", "Treats unpaid ads as unknown reach, not free reach.")],
    evidence: [evidence("chris-e1", "Budget sheet (example)", "A and B both total ₹20,000. Computed locally.")],
    relations: [{ otherId: "arjun", label: "Sign-off" }, { otherId: "mira", label: "Founder budget" }],
  },
  {
    id: "amina",
    name: "Amina Diallo",
    role: "Nonprofit coordinator",
    goal: "See if a planning ritual works with volunteers.",
    action: "Walking a side street",
    marker: MARKERS[10],
    color: COLORS[10],
      incomeMonthly: 15_000,
    memories: [memory("amina-m1", "Volunteer hours vanish when tools feel corporate.")],
    evidence: [evidence("amina-e1", "Tone sample (example)", "Hero copy uses 'team', not 'volunteers'.")],
    relations: [{ otherId: "priya", label: "Workshop ally" }, { otherId: "elena", label: "Asks for honesty" }],
  },
  {
    id: "rob",
    name: "Rob Hale",
    role: "Engineering manager",
    goal: "Avoid a tool that creates another source of truth.",
    action: "Objecting to the standup framing",
    marker: MARKERS[11],
    color: COLORS[11],
      incomeMonthly: 25_000,
    memories: [memory("rob-m1", "Will trial only if git and chat stay canonical.")],
    evidence: [evidence("rob-e1", "Objection (example)", "Simulated: 'standup replacement' sounds like status theatre.")],
    relations: [{ otherId: "samir", label: "Ops vs eng" }, { otherId: "mira", label: "Needs a clearer offer" }],
  },
];

export function residentById(id: string): ResidentFixture | undefined {
  return RESIDENTS.find((resident) => resident.id === id);
}

export function policyEligibleCount(threshold: number): number {
  return RESIDENTS.filter((resident) => resident.incomeMonthly <= threshold).length;
}

export function policyLiability(threshold: number, amount = VOUCHER_AMOUNT): number {
  return policyEligibleCount(threshold) * amount;
}

export function policyShortfall(threshold: number, budget = POLICY_BUDGET): number {
  return Math.max(0, policyLiability(threshold) - budget);
}

export const POLICY_THRESHOLDS = {
  baseline: 20_000,
  amendment: 30_000,
  universal: 45_000,
} as const;

export const INITIAL_ACTIVITY: ActivityItem[] = [
  {
    id: "act-0",
    at: Date.now() - 40_000,
    actorId: "mira",
    kind: "fixture",
    text: "Mira opened the Northstar fixture brief. Source: local example, not a live scrape.",
  },
  {
    id: "act-1",
    at: Date.now() - 28_000,
    actorId: "rob",
    kind: "simulated",
    text: "Rob: “Standup replacement sounds like status theatre.” Simulated response.",
  },
  {
    id: "act-2",
    at: Date.now() - 12_000,
    actorId: "chris",
    kind: "computed",
    text: "Chris checked that plans A and B both sum to ₹20,000.",
  },
];

export const OBJECTION_MAP = [
  {
    claim: "Northstar replaces noisy standups.",
    exposure: "Example homepage hero (not observed live).",
    interpretation: "Rob reads it as more status collection.",
    objection: "Will not add a third source of truth.",
    lineage: "Direct fixture exposure · not peer-only.",
  },
  {
    claim: "A weekly ritual is enough.",
    exposure: "Example feature list.",
    interpretation: "Nadia hears extra meeting load.",
    objection: "Clients will not adopt a new login.",
    lineage: "Direct fixture exposure.",
  },
  {
    claim: "Community workshops will teach the offer.",
    exposure: "Strategy B assumption.",
    interpretation: "Priya hears a pitch disguised as a class.",
    objection: "Invite must be useful even if nobody buys.",
    lineage: "Simulated · assumption labeled.",
  },
] as const;

export function defaultBriefFor(mode: ScenarioMode): ScenarioBrief {
  if (mode === "policy") {
    return {
      mode: "policy",
      productName: "Transit voucher template",
      productUrl: "https://example.invalid/voucher-brief",
      decision: "Raise the income threshold for a ₹3,000 monthly transport voucher?",
      audience: "12 equally weighted fixture households.",
      constraint: "₹30,000 public budget. Full-redemption arithmetic only.",
      source: "fixture",
    };
  }
  return { ...NORTHSTAR_BRIEF };
}
