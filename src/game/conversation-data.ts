import type { ScenarioMode } from "./world-data";

export interface ResidentConversation {
  id: string;
  mode: ScenarioMode;
  participantIds: [string, string];
  title: string;
  kind: "sample" | "generated" | "pending" | "error";
  messages: Array<{ actorId: string; text: string }>;
}

/** Authored examples explain the interaction; they are not model predictions. */
export function sampleConversation(mode: ScenarioMode, participantIds: [string, string], sequence: number): ResidentConversation {
  const [first, second] = participantIds;
  const lines = mode === "founder" ? [
    "A launch gets my attention. What would make this product useful enough to keep using a year from now?",
    "For me, it would need to solve a recurring problem. I would try it on one real task before changing my routine.",
    "And if the price or my needs change? We should check who still benefits, and who stops using it.",
    "That is a good question to take to real customers. This example cannot tell us what they will actually do.",
  ] : [
    "Before we judge the long-term effect of a policy, who benefits first, and who might be left out?",
    "I would look at access in practice: paperwork, travel, eligibility and whether people know the programme exists.",
    "We should also ask what changes over several years: costs, services and unintended effects.",
    "And compare those questions with real evidence. This example is a starting point, not a forecast of public opinion.",
  ];
  return { id: `sample-${mode}-${sequence}`, mode, participantIds, title: mode === "founder" ? "What makes a product last?" : "Who feels the change?", kind: "sample", messages: lines.map((text, index) => ({ actorId: index % 2 ? second : first, text })) };
}

export function nearbyConversationPair<T extends { id: string; u: number; v: number }>(people: T[], previous: string[] = []): [T, T] | undefined {
  let best: [T, T] | undefined;
  let bestDistance = 3.2;
  for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
    if (previous.includes(people[i].id) && previous.includes(people[j].id)) continue;
    const distance = Math.hypot(people[i].u - people[j].u, people[i].v - people[j].v);
    if (distance > 0.25 && distance < bestDistance) { best = [people[i], people[j]]; bestDistance = distance; }
  }
  return best;
}
