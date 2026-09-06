import { MAX_CONVERSATIONS } from "./coverage";
import { RESIDENTS } from "../../game/world-data";
import { AgentError, generateJSON, geminiModel, list, obj, str } from "./gemini";
import { selectConversationMemories } from "./memory-selection";
import type { AgentConversation, AgentMemory, AgentPersona, AgentPopulation, AgentReport, CommonInput, ConversationInput, PopulationInput, ReflectionInput, ReportFinding, ReportInput, SourceEvidence } from "./types";
export type * from "./types";
export { AgentError, DEFAULT_GEMINI_MODEL } from "./gemini";

const strings = (max = 8) => list(str(1000), max);
const ids = () => list(str(100), 12);
const personaSchema = obj({ name: str(80), role: str(160), goal: str(500), background: str(1000), concerns: strings(), sourceIds: ids(), assumptions: strings() });
const invalid = (message: string): never => { throw new AgentError("invalid_input", message, 400); };
function context(input: CommonInput) {
  const b = input.brief;
  if (!b || !["founder", "policy"].includes(b.mode)) invalid("Choose a valid scenario track.");
  for (const field of ["productName", "decision", "audience", "constraint"] as const) if (typeof b[field] !== "string" || !b[field].trim() || b[field].length > 5000) invalid(`Invalid scenario ${field}.`);
  const evidence = (input.evidence ?? []).slice(0, 12).map(source => {
    if (!source || typeof source.id !== "string" || source.id.length > 100 || !source.id.trim() || typeof source.title !== "string" || typeof source.excerpt !== "string") return invalid("Invalid source evidence.");
    let url: URL; try { url = new URL(source.url); } catch { return invalid("Invalid source URL."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) invalid("Invalid source URL.");
    return { id: source.id, title: source.title.slice(0, 300), url: url.href.slice(0, 2000), excerpt: source.excerpt.slice(0, 6000) };
  });
  if (new Set(evidence.map(s => s.id)).size !== evidence.length) invalid("Source IDs must be unique.");
  // Explicit allowlist prevents accidental credentials or arbitrary object properties reaching Gemini.
  return { brief: { mode: b.mode, productName: b.productName, description: b.description?.slice(0, 5000), productUrl: b.productUrl?.slice(0, 2000), decision: b.decision, audience: b.audience, constraint: b.constraint }, evidence, publicChanges: (input.publicChanges ?? []).slice(-16).map(text => text.slice(0, 2200)) };
}
function checkSources(sourceIds: string[], evidence: SourceEvidence[]) {
  const known = new Set(evidence.map(source => source.id));
  if (sourceIds.some(id => !known.has(id))) throw new AgentError("invalid_response", "The generated response referenced an unknown source.");
}
export async function createPopulation(input: PopulationInput): Promise<AgentPopulation> {
  const data = context(input);
  const count = input.count ?? 12;
  if (!Number.isInteger(count) || count < 2 || count > 12) invalid("Population must have 2–12 agents.");
  const result = await generateJSON<{ agents: Omit<AgentPersona, "id">[]; assumptions: string[] }>(
    `Create exactly ${count} fictional stakeholders for this scenario. Ground relevance in the supplied audience and evidence. Include varied needs, constraints, skeptical views and indirect effects; do not fabricate population proportions. Every invented attribute is a modelling assumption. Include assumptions explicitly. For founders include potential users, buyers and non-adopters. For policy include affected stakeholders and implementation constraints, not targeted persuasion. Source IDs refer only to evidence supporting context, not proof that these fictional people exist.`,
    data, obj({ agents: list(personaSchema, count, count), assumptions: list(str(1000), 12, 1) }), input.signal,
  );
  const agents = result.agents.map((agent, index) => { checkSources(agent.sourceIds, data.evidence); return { ...agent, id: RESIDENTS[index].id }; });
  return { ...result, agents, model: geminiModel(), kind: "simulated" };
}
export async function generateConversation(input: ConversationInput): Promise<AgentConversation> {
  const data = context(input);
  const round = input.round ?? 1;
  if (!Number.isInteger(round) || round < 1 || round > MAX_CONVERSATIONS) invalid("Conversation round must be between 1 and 66.");
  if (input.participants.length !== 2 || input.participants[0].id === input.participants[1].id) invalid("Choose two distinct agents.");
  const participantIds: [string, string] = [input.participants[0].id, input.participants[1].id];
  const messages: AgentConversation["messages"] = [];
  const memories: AgentMemory[] = [];
  const selectedMemories = await selectConversationMemories(input);
  // Each actor has a separate model call and only its own memory plus this public conversation.
  // Two bounded exchanges prevent runaway loops and fit ordinary server request budgets.
  for (const actor of input.participants) {
    const actorMemories = (selectedMemories.get(actor.id) ?? []).map(memory => ({ text: memory.text.slice(0, 1600), kind: memory.kind, sourceIds: memory.sourceIds.slice(0, 12) }));
    const result = await generateJSON<{ message: string; sourceIds: string[] }>(
      "Roleplay ONLY the fictional speaking actor, in first person, with a concise substantive contribution (2–4 sentences). React to the public conversation and your own memories without access to anyone else's private memories. Address the latest publicChanges supplied by the user when present; these are proposals or questions, not established facts. Discuss the user's long-term question, concrete tradeoffs and a possible contrary outcome. Do not force agreement. Your current opinion may differ from your initial persona. Use your latest opinion update and memories; do not reset to the original attitude. Cite only source IDs directly supporting factual context; citations do not validate simulated reactions.",
      { ...data, actor, otherParticipant: { id: input.participants.find(p => p.id !== actor.id)!.id, role: input.participants.find(p => p.id !== actor.id)!.role }, currentOpinion: input.memories.filter(m => m.agentId === actor.id && m.text.startsWith("Opinion update: ")).at(-1)?.text ?? "No prior opinion update; form an initial view from the persona.", ownMemories: actorMemories, publicConversation: messages, round },
      obj({ message: str(1600), sourceIds: ids() }), input.signal,
    );
    checkSources(result.sourceIds, data.evidence);
    messages.push({ actorId: actor.id, text: result.message, sourceIds: result.sourceIds });

  }
  // Both residents reflect after seeing the complete exchange, including the reply.
  const updates = await Promise.all(input.participants.map(async actor => {
    const prior = input.memories.filter(m => m.agentId === actor.id && m.text.startsWith("Opinion update: ")).at(-1)?.text;
    const result = await generateJSON<{before:string; after:string; reason:string; sourceIds:string[]}>(
      "Reflect privately as this fictional actor after reading both messages. Describe your opinion before and after, and the specific argument or evidence that changed it or why it stayed the same. Respect the supplied latest opinion as your starting point. Believers may become skeptical and skeptics may soften, but agreement or a change is NEVER mandatory. Another actor's assertion is not verified evidence. Preserve unresolved disagreement. Keep before/after under 350 characters each and reason under 500 characters.",
      {...data, actor, priorOpinion: prior ?? null, ownMemories: selectedMemories.get(actor.id) ?? [], publicConversation: messages},
      obj({before:str(350),after:str(350),reason:str(500),sourceIds:ids()}), input.signal,
    );
    checkSources(result.sourceIds, data.evidence);
    return {agentId:actor.id,text:`Opinion update: ${JSON.stringify({before:result.before,after:result.after,reason:result.reason})}`,kind:"reflection" as const,sourceIds:result.sourceIds};
  }));
  memories.push(...updates);
  return { id: crypto.randomUUID(), participantIds, title: `${input.participants[0].name} & ${input.participants[1].name}`, messages, memories, round, model: geminiModel(), kind: "simulated" };
}
export async function generateReport(input: ReportInput): Promise<AgentReport> {
  const data = context(input);
  const compared = new Set((input.comparison?.results ?? []).filter(result => result.baseline && result.changed).map(result => result.agentId));
  if ((!input.conversations.length && !compared.size) || input.conversations.length > MAX_CONVERSATIONS || input.population.length > 12) invalid("A report needs a conversation or a completed comparison pair and at most 12 agents.");
  const finding = obj({ title: str(200), detail: str(2000), kind: { ...str(), enum: ["source_supported", "simulation_hypothesis"] }, sourceIds: ids(), conversationIds: list(str(100), MAX_CONVERSATIONS), comparisonAgentIds: ids(), evidence: list(obj({ sourceId: str(100), quote: str(1000) }), 12) });
  const result = await generateJSON<Pick<AgentReport, "title" | "summary" | "findings" | "uncertainties" | "nextSteps">>(
    "Synthesize an actionable scenario exploration report, not a forecast. Separate source-supported contextual claims from simulation hypotheses. Every simulation finding must cite conversation IDs or comparisonAgentIds identifying completed original/changed assessment pairs. Comparison assessments are separate hypothetical decisions, not conversations or observed behavior. Leave inapplicable reference arrays empty; every source-supported finding must cite evidence IDs and include evidence entries with exact verbatim quote substrings from those source excerpts. Do not paraphrase quotes. Keep each source-supported finding to one factual claim. Evidence is an empty array when no source passage supports a claim. Preserve disagreements, who may be underserved, competing explanations, long-term risks and evidence gaps. No unsupported numeric predictions. Recommend real interviews, measurements or source verification that could disprove the hypotheses. Policy recommendations must remain transparent analysis of effects and tradeoffs. Explicitly state uncertainty due to synthetic personas and absence of real outcome validation.",
    { ...data, population: input.population, comparison: input.comparison ? { change: input.comparison.change, results: input.comparison.results.filter(result => result.baseline && result.changed), disclaimer: input.comparison.disclaimer } : null, conversations: input.conversations.map(c => ({ id: c.id, messages: c.messages, opinions: c.memories, round: c.round })) },
    obj({ title: str(200), summary: str(2500), findings: list(finding, 10, 1), uncertainties: list(str(1200), 10, 1), nextSteps: list(str(1200), 10, 1) }), input.signal,
  );
  const conversations = new Set(input.conversations.map(c => c.id));
  for (const item of result.findings) {
    checkSources(item.sourceIds, data.evidence);
    if (item.conversationIds.some(id => !conversations.has(id)) || (item.comparisonAgentIds ?? []).some(id => !compared.has(id)) || (item.kind === "source_supported" && !item.sourceIds.length) || (item.kind === "simulation_hypothesis" && !item.conversationIds.length && !item.comparisonAgentIds?.length)) throw new AgentError("invalid_response", "A report finding is missing valid supporting references.");
  }
  const findings = await verifyReportFindings(result.findings, data.evidence, input.signal);
  return { ...result, findings, ...(input.comparison ? { comparison: input.comparison } : {}), conversationReferences: input.conversations.map(c => ({ id: c.id, label: `${c.title} · Conversation ${c.round}` })), sources: data.evidence, model: geminiModel(), kind: "simulated", disclaimer: "AI-generated scenario exploration with fictional stakeholders. This is not measured customer research, public opinion, or a validated forecast. Check source claims and test hypotheses with real people and outcomes." };
}
/** Exact matching establishes provenance only. The separate model check assesses support,
 * not real-world truth or calibrated predictive accuracy. Provider failures fail closed. */
export async function verifyReportFindings(findings: ReportFinding[], sources: SourceEvidence[], signal?: AbortSignal): Promise<ReportFinding[]> {
  const clean = findings.map(finding => ({ ...finding, evidence: (finding.evidence ?? []).filter(item => {
    const source = sources.find(source => source.id === item.sourceId);
    return finding.sourceIds.includes(item.sourceId) && item.quote.trim().length > 0 && !!source?.excerpt.includes(item.quote);
  }) }));
  const factual = clean.map((finding, index) => ({ finding, index })).filter(({finding}) => finding.kind === "source_supported");
  if (!factual.length) return clean;
  const fallback = { status: "insufficient" as const, reason: "The evidence check could not establish support. Verify this claim against the linked source." };
  const checks = new Map<number, NonNullable<ReportFinding["verification"]>>();
  const eligible = factual.filter(({finding}) => finding.evidence.length > 0);
  if (eligible.length) {
    try {
      const result = await generateJSON<{ checks: { index: number; status: "supported" | "insufficient" | "contradicted"; reason: string }[] }>(
        "Independently audit each claim against ONLY the supplied source excerpts and exact quotes. Do not trust the report author's source_supported label. supported means the full claim follows from the source, including qualifications; contradicted means the source explicitly conflicts; insufficient means any material part is unsupported or ambiguous. A company website describes that company's claims, not independently verified facts. Simulation reactions never establish facts. Return exactly one check per supplied index. This is an evidence support check, not prediction confidence.",
        { claims: eligible.map(({finding, index}) => ({ index, claim: `${finding.title}: ${finding.detail}`, evidence: finding.evidence, sources: sources.filter(source => finding.sourceIds.includes(source.id)) })) },
        obj({ checks: list(obj({ index: { type: "number", minimum: 0, maximum: findings.length - 1 }, status: { ...str(), enum: ["supported", "insufficient", "contradicted"] }, reason: str(1000) }), eligible.length, eligible.length) }), signal,
      );
      for (const item of result.checks) {
        if (!Number.isInteger(item.index) || !eligible.some(entry => entry.index === item.index) || checks.has(item.index)) throw new Error("Invalid evidence check index");
        checks.set(item.index, { status: item.status, reason: item.reason });
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      checks.clear();
    }
  }
  return clean.map((finding, index) => finding.kind === "simulation_hypothesis" ? finding : ({ ...finding, verification: checks.get(index) ?? (finding.evidence.length ? fallback : { status: "insufficient" as const, reason: "No exact supporting passage was found in the captured sources." }) }));
}
export async function reflectMemory(input: ReflectionInput): Promise<{ content: string; importance: number }> {
  if (!input.residentId || !input.sourceId || !input.memories.length) invalid("Reflection requires a resident, source and memories.");
  return generateJSON<{ content: string; importance: number }>(
    "Reflect on the fictional resident's supplied memories only. Summarize a useful tension, concern or unresolved question for future conversations. Attribute observations as supplied; simulated observations are not real-world evidence. Do not invent events or add external facts. Importance is a heuristic retention priority between 0 and 1, not confidence or probability.",
    { residentId: input.residentId, sourceId: input.sourceId, memories: input.memories.slice(-20).map(m => ({ id: m.id, content: m.content.slice(0, 2000), kind: m.kind, importance: m.importance, observedAtMs: m.observedAtMs, sourceId: m.sourceId })) },
    obj({ content: str(2000), importance: { type: "number", minimum: 0, maximum: 1 } }), input.signal,
  );
}
