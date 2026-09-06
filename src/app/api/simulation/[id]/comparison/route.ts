import { randomUUID } from "node:crypto";
import { authorize, failure, readJson, readOwner, success } from "@/lib/server/simulation-http";
import { ApiError, loadArtifacts, takeBudget, withArtifacts } from "@/lib/server/simulation-store";
import { publicComparison, geminiModel } from "@/lib/experiments/comparison";
import type { StoredComparison } from "@/lib/experiments/types";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function GET(_request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const {id} = await context.params;
    const all = await loadArtifacts<StoredComparison>(id, await readOwner(), "comparison");
    const latest = all.sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0];
    return success({comparison: latest ? publicComparison(latest) : null});
  } catch(error) { return failure(error); }
}
export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const owner = await authorize(request); const {id} = await context.params; const body = await readJson(request);
    if (typeof body.change !== "string" || !body.change.trim() || body.change.length > 2000) throw new ApiError(400, "Describe a change in under 2,000 characters.");
    if (body.requestId !== undefined && (typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(body.requestId))) throw new ApiError(400, "Invalid request reference.");
    const change = body.change.trim(); const artifactId = typeof body.requestId === "string" ? body.requestId : randomUUID();
    const comparison = await withArtifacts(id, owner, async (session, save) => {
      const existing = (await loadArtifacts<StoredComparison>(id, owner, "comparison")).find(item => item.id === artifactId);
      if (existing) { if (existing.change !== change) throw new ApiError(409, "This request already saved a different change."); return publicComparison(existing); }
      await takeBudget(`comparison-create:${id}`, 12, 86400);
      const memories = session.conversations.flatMap(conversation => conversation.memories);
      const stored: StoredComparison = {
        id: artifactId, change, createdAt: new Date().toISOString(), status: "pending", total: session.population.length, completed: 0,
        results: session.population.map(person => ({agentId: person.id, name: person.name, role: person.role})), model: geminiModel(),
        disclaimer: "Independent hypothetical decisions from the same saved starting state. Differences may include model variation; they are not measured conversion or proof of a causal effect.",
        snapshot: {brief: session.brief, population: session.population, evidence: session.evidence, memories, revision: session.revision ?? 0,
          publicChanges: [...new Set(memories.filter(memory => memory.kind === "user_provided" && memory.text.startsWith("User change: ")).map(memory => memory.text))]},
      };
      await save(stored.id, "comparison", stored); return publicComparison(stored);
    });
    return success({comparison});
  } catch(error) { return failure(error); }
}
