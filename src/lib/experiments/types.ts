import type { ScenarioBrief } from "../../game/world-data";
import type { AgentPersona, AgentMemory, SourceEvidence } from "../agents/types";
export interface DecisionAssessment { decision: string; reason: string; tradeoff: string; sourceIds: string[] }
export interface ComparisonResult { agentId: string; name: string; role: string; baseline?: DecisionAssessment; changed?: DecisionAssessment }
export interface Comparison {
  id: string; change: string; createdAt: string; status: "pending" | "running" | "complete";
  total: number; completed: number; results: ComparisonResult[]; model: string; disclaimer: string;
}
export interface StoredComparison extends Comparison {
  snapshot: { brief: ScenarioBrief; population: AgentPersona[]; evidence: SourceEvidence[]; memories: AgentMemory[]; publicChanges: string[]; revision: number };
}
export interface CustomerOutcome {
  id: string; text: string; createdAt: string; comparisonId?: string;
  kind: "user_reported";
}
