import "server-only";
import { randomUUID } from "node:crypto";
import type { ScenarioBrief } from "@/game/world-data";
import type { AgentPersona, AgentConversation, AgentReport, SourceEvidence } from "@/lib/agents";

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export interface SimulationSession {
  id: string; owner: string; brief: ScenarioBrief; population: AgentPersona[];
  evidence: SourceEvidence[]; conversations: AgentConversation[]; report?: AgentReport;
  createdAt: string; revision?: number;
}
export function inferenceConfigured() {
  return process.env.ENABLE_AGENT_INFERENCE === "true" && Boolean(process.env.GEMINI_API_KEY && process.env.SPACETIMEDB_SERVICE_TOKEN && process.env.SPACETIMEDB_URI && process.env.SPACETIMEDB_DATABASE);
}
export function requireInference() {
  if (!inferenceConfigured()) throw new ApiError(503, "AI agents need GEMINI_API_KEY, SpacetimeDB Cloud connection settings and ENABLE_AGENT_INFERENCE=true on the server.");
}
async function request(path: string, body: string, contentType: string) {
  const uri = process.env.SPACETIMEDB_URI?.replace(/^ws:/, "http:").replace(/^wss:/, "https:").replace(/\/$/, "");
  const database = process.env.SPACETIMEDB_DATABASE;
  const token = process.env.SPACETIMEDB_SERVICE_TOKEN;
  if (!uri || !database || !token) throw new ApiError(503, "SpacetimeDB session storage is not configured.");
  const response = await fetch(`${uri}/v1/database/${encodeURIComponent(database)}/${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType }, body, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    const detail = await response.text();
    if (/budget|request limit/i.test(detail)) throw new ApiError(429, "This exploration has reached its request limit. Please try later.");
    if (/lease|already working|revision/i.test(detail)) throw new ApiError(409, "An agent is already working or its lease expired. Please retry shortly.");
    if (/not found|expired|owner mismatch/i.test(detail)) throw new ApiError(404, "World not found or expired. Start a new exploration.");
    throw new ApiError(503, "SpacetimeDB could not complete this request.");
  }
  return response;
}
async function call(name: string, args: unknown[]) {
  await request(`call/${name}`, JSON.stringify(args), "application/json");
}
function optionName(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return String(value[0] ?? "");
  if (value && typeof value === "object") return String((value as {some?: string}).some ?? "");
  return "";
}
async function rows(table: string, id: string): Promise<Record<string, unknown>[]> {
  // Table names are internal constants; ids are UUID-validated before interpolation.
  const column = table === "service_sessions" ? "id" : "session_id";
  const response = await request("sql", `SELECT * FROM ${table} WHERE ${column} = '${id}'`, "text/plain");
  const result = await response.json() as Array<{ schema: { elements: Array<{ name: unknown }> }; rows: unknown[][] }>;
  return (result[0]?.rows ?? []).map(row => Object.fromEntries(result[0].schema.elements.map((field, index) => [optionName(field.name).replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), row[index]])));
}
const parse = <T>(value: unknown): T => JSON.parse(String(value)) as T;
export async function loadSession(id: string, owner: string): Promise<SimulationSession> {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new ApiError(404, "World not found.");
  const entry = (await rows("service_sessions", id))[0];
  if (!entry || entry.owner !== owner || Number(entry.expiresAtMs) <= Date.now()) throw new ApiError(404, "World not found or expired.");
  const [people, evidence, conversations, messages, memories, reports] = await Promise.all([
    rows("service_personas", id), rows("service_sources", id), rows("service_conversations", id), rows("service_messages", id), rows("service_memories", id), rows("service_reports", id),
  ]);
  const population = people.map(p => ({ id: String(p.actorId), name: String(p.name), role: String(p.role), goal: String(p.goal), background: String(p.background), concerns: parse<string[]>(p.concernsJson), sourceIds: parse<string[]>(p.sourceIdsJson), assumptions: parse<string[]>(p.assumptionsJson) }));
  const transcript = conversations.sort((a,b) => Number(a.round)-Number(b.round)).map(c => ({
    id: String(c.conversationId), title: String(c.title), participantIds: parse<[string,string]>(c.participantIdsJson), round: Number(c.round), model: String(c.model), kind: "simulated" as const,
    messages: messages.filter(m => m.conversationId === c.conversationId).sort((a,b) => Number(a.position)-Number(b.position)).map(m => ({ actorId: String(m.actorId), text: String(m.text), sourceIds: parse<string[]>(m.sourceIdsJson) })),
    memories: memories.filter(m => m.conversationId === c.conversationId).sort((a,b) => Number(a.position)-Number(b.position)).map(m => ({ agentId: String(m.agentId), text: String(m.text), kind: String(m.kind) as AgentConversation["memories"][number]["kind"], sourceIds: parse<string[]>(m.sourceIdsJson) })),
  }));
  return { id, owner, brief: parse<ScenarioBrief>(entry.briefJson), population,
    evidence: evidence.map(e => ({ id: String(e.sourceId), title: String(e.title), url: String(e.url), excerpt: String(e.excerpt) })),
    conversations: transcript, report: reports[0] ? parse<AgentReport>(reports[0].reportJson) : undefined,
    createdAt: String(entry.createdAt), revision: Number(entry.revision) };
}
export async function createSession(session: SimulationSession) {
  await call("create_simulation", [session.id, session.owner, JSON.stringify(session.brief), JSON.stringify(session.population), JSON.stringify(session.evidence), session.createdAt]);
}
export async function takeBudget(scope: string, limit: number, seconds = 3600) {
  await call("take_simulation_budget", [scope, limit, seconds]);
}
export async function withSession<T>(id: string, owner: string, action: (session: SimulationSession) => Promise<T>): Promise<T> {
  await loadSession(id, owner);
  const lease = randomUUID();
  await call("claim_simulation", [id, owner, lease]);
  try {
    const session = await loadSession(id, owner);
    const result = await action(session);
    await call("save_simulation", [id, owner, lease, session.revision, JSON.stringify(session.conversations), session.report ? JSON.stringify(session.report) : ""]);
    return result;
  } finally {
    await call("release_simulation", [id, owner, lease]).catch(() => undefined);
  }
}

export async function loadArtifacts<T>(id: string, owner: string, kind: "comparison" | "outcome"): Promise<T[]> {
  await loadSession(id, owner);
  return (await rows("service_artifacts", id)).filter(row => row.kind === kind).map(row => parse<T>(row.payloadJson));
}
/** Unlike withSession, artifact work never rewrites conversations or report state. */
export async function withArtifacts<T>(id: string, owner: string, action: (session: SimulationSession, save: (artifactId: string, kind: "comparison" | "outcome", payload: unknown) => Promise<void>) => Promise<T>): Promise<T> {
  await loadSession(id, owner);
  const lease = randomUUID();
  await call("claim_simulation", [id, owner, lease]);
  try {
    return await action(await loadSession(id, owner), async (artifactId, kind, payload) => {
      await call("save_simulation_artifact", [id, owner, lease, artifactId, kind, JSON.stringify(payload)]);
    });
  } finally { await call("release_simulation", [id, owner, lease]).catch(() => undefined); }
}
