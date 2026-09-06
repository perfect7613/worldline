import { generateConversation } from "@/lib/agents";
import { coverage, pairKey, MAX_CONVERSATIONS } from "@/lib/agents/coverage";
import { ApiError, takeBudget, withSession } from "@/lib/server/simulation-store";
import { authorize, failure, readJson, success } from "@/lib/server/simulation-http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await authorize(request); const { id } = await context.params;
    const body = await readJson(request); const requested = body.participantIds;
    if (requested !== undefined && (!Array.isArray(requested) || requested.length !== 2 || requested.some(id => typeof id !== "string") || requested[0] === requested[1])) throw new ApiError(400, "Choose two different residents.");
    const change = body.change;
    if (change !== undefined && (typeof change !== "string" || !change.trim() || change.length > 2000)) throw new ApiError(400, "Enter a change under 2,000 characters.");
    const announcement = typeof change === "string" ? `User change: ${change.trim()}` : null;
    const result = await withSession(id, owner, async session => {
      const progress = () => coverage(session.population, session.conversations);
      const priorChange = announcement ? session.conversations.find(c => c.memories.some(m => m.kind === "user_provided" && m.text === announcement)) : undefined;
      if (priorChange) return {conversation:priorChange,coverage:progress()};
      const ids = (requested ?? progress().nextPair) as [string,string] | null;
      if (!ids) {
        if (announcement) throw new ApiError(409, "All pairs have finished. Start a new scenario to explore another change.");
        return {conversation:null,coverage:progress()};
      }
      const first = session.population.find(p => p.id === ids[0]); const second = session.population.find(p => p.id === ids[1]);
      if (!first || !second) throw new ApiError(400, "Resident not found in this world.");
      const existing = session.conversations.find(c => pairKey(...c.participantIds) === pairKey(...ids));
      if (existing && announcement) throw new ApiError(409, "Choose a pair that has not spoken to discuss this change.");
      if (existing) return {conversation:existing,coverage:progress()};
      if (session.conversations.length >= MAX_CONVERSATIONS) throw new ApiError(429, "Every pair has finished. Open the report.");
      await takeBudget(`conversation:${id}`, 80, 86400);
      const publicChanges = [...new Set(session.conversations.flatMap(c => c.memories).filter(m=>m.kind === "user_provided" && m.text.startsWith("User change: ")).map(m=>m.text))];
      if (announcement) publicChanges.push(announcement);
      const conversation = await generateConversation({ publicChanges, brief: session.brief, participants: [first, second], memories: session.conversations.flatMap(c => c.memories).filter(m => ids.includes(m.agentId)), evidence: session.evidence, round: session.conversations.length + 1, signal: AbortSignal.timeout(150000) });
      if (announcement) for (const agentId of ids) conversation.memories.push({agentId,text:announcement,kind:"user_provided",sourceIds:[]});
      session.conversations.push(conversation); delete session.report;
      return {conversation,coverage:progress()};
    });
    return success(result);
  } catch (error) { return failure(error); }
}
