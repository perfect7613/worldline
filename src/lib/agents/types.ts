import type { Comparison, CustomerOutcome } from "../experiments/types";
import type { ScenarioBrief } from "../../game/world-data";

export interface SourceEvidence { id: string; title: string; url: string; excerpt: string }
export interface AgentPersona {
  id: string; name: string; role: string; goal: string; background: string;
  concerns: string[]; sourceIds: string[]; assumptions: string[];
}
export interface AgentMemory {
  agentId: string; text: string; kind: "observation" | "reflection" | "user_provided"; sourceIds: string[];
}
export interface AgentPopulation { agents: AgentPersona[]; assumptions: string[]; model: string; kind: "simulated" }
export interface AgentMessage { actorId: string; text: string; sourceIds: string[] }
export interface AgentConversation {
  id: string; participantIds: [string, string]; title: string; messages: AgentMessage[];
  memories: AgentMemory[]; round: number; model: string; kind: "simulated";
}
export interface ReportFinding {
  title: string; detail: string; kind: "source_supported" | "simulation_hypothesis";
  sourceIds: string[]; conversationIds: string[];
  comparisonAgentIds?: string[];
  evidence?: { sourceId: string; quote: string }[];
  verification?: { status: "supported" | "insufficient" | "contradicted"; reason: string };
}
export interface AgentReport {
  comparison?: Comparison;
  customerResponses?: CustomerOutcome[];
  title: string; summary: string; findings: ReportFinding[]; uncertainties: string[];
  conversationReferences?: { id: string; label: string }[];
  nextSteps: string[]; sources: SourceEvidence[]; model: string; kind: "simulated"; disclaimer: string;
}
export interface CommonInput { brief: ScenarioBrief; evidence?: SourceEvidence[]; publicChanges?: string[]; signal?: AbortSignal }
export interface PopulationInput extends CommonInput { count?: number }
export interface ConversationInput extends CommonInput {
  participants: [AgentPersona, AgentPersona]; memories: AgentMemory[]; round?: number;
}
export interface ReportInput extends CommonInput { comparison?: Comparison; population: AgentPersona[]; conversations: AgentConversation[] }
export interface ReflectionInput {
  residentId: string; sourceId: string;
  memories: { id: string; content: string; kind: string; importance: number; observedAtMs: number; sourceId: string }[];
  signal?: AbortSignal;
}
