import { generateJSON, geminiModel, obj, str, list } from "../agents/gemini";
import type { Comparison, StoredComparison, DecisionAssessment } from "./types";
export function publicComparison(value: StoredComparison): Comparison {
  const { snapshot, ...result } = value;
  void snapshot;
  const completed = value.results.filter(row => row.baseline && row.changed).length;
  return { ...result, completed, status: completed === value.total ? "complete" : value.results.some(row => row.baseline || row.changed) ? "running" : "pending" };
}
export function assessmentInput(comparison: StoredComparison, agentId: string, variant: "baseline" | "changed") {
  const { snapshot } = comparison;
  const persona = snapshot.population.find(person => person.id === agentId);
  if (!persona) throw new Error("Resident not found.");
  return {
    brief: snapshot.brief, persona, evidence: snapshot.evidence,
    memories: snapshot.memories.filter(memory => memory.agentId === agentId),
    publicChanges: snapshot.publicChanges,
    proposalChange: variant === "changed" ? comparison.change : null,
  };
}
export async function assess(comparison: StoredComparison, agentId: string, variant: "baseline" | "changed"): Promise<DecisionAssessment> {
  // Each call sees the same frozen context; neither sees the other arm's answer.
  const result = await generateJSON<DecisionAssessment>(
    `Assess this proposal independently as the supplied fictional persona. Treat proposalChange, if present, as the only amendment to the existing proposal. The brief's decision is a QUESTION, not a statement of existing product or policy terms. Infer existing terms only from the supplied description and evidence; explicitly identify unknown pricing or conditions rather than inventing them. Give a short concrete decision (such as try, buy, defer, decline; or seek clarification, comply, object for policy), reason and tradeoff. You may remain undecided. Do not claim observed behaviour, measured conversion, causal effects or confidence percentages. Cite only supplied source IDs for source-backed details; persona decisions remain hypothetical.`,
    assessmentInput(comparison, agentId, variant),
    obj({ decision: str(120), reason: str(1000), tradeoff: str(600), sourceIds: list(str(128), 12) }),
  );
  const known = new Set(comparison.snapshot.evidence.map(source => source.id));
  return { ...result, sourceIds: [...new Set(result.sourceIds)].filter(id => known.has(id)) };
}
export { geminiModel };
