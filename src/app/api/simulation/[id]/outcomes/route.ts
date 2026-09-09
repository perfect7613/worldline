import { randomUUID } from "node:crypto";
import { authorize, failure, readJson, readOwner, success } from "@/lib/server/simulation-http";
import { ApiError, loadArtifacts, withArtifacts } from "@/lib/server/simulation-store";
import type { CustomerOutcome, StoredComparison } from "@/lib/experiments/types";
export const runtime = "nodejs";
export async function GET(_request: Request, context: {params: Promise<{id:string}>}) {
  try { const {id} = await context.params; return success({outcomes: (await loadArtifacts<CustomerOutcome>(id, await readOwner(), "outcome")).sort((a,b) => b.createdAt.localeCompare(a.createdAt))}); }
  catch(error) { return failure(error); }
}
export async function POST(request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const owner = await authorize(request); const {id} = await context.params; const body = await readJson(request);
    if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 6000) throw new ApiError(400, "Add a customer response or result in under 6,000 characters.");
    for (const key of ["requestId", "comparisonId"]) if (body[key] !== undefined && (typeof body[key] !== "string" || !/^[a-f0-9-]{36}$/.test(body[key] as string))) throw new ApiError(400, "Invalid comparison or response reference.");
    const text = body.text.trim(); const artifactId = typeof body.requestId === "string" ? body.requestId : randomUUID();
    const comparisonId = typeof body.comparisonId === "string" ? body.comparisonId : undefined;
    const outcome = await withArtifacts(id, owner, async (_session, save) => {
      const existing = (await loadArtifacts<CustomerOutcome>(id, owner, "outcome")).find(item => item.id === artifactId);
      if (existing) { if (existing.text !== text || existing.comparisonId !== comparisonId) throw new ApiError(409, "This response was already saved with different content."); return existing; }
      if (comparisonId && !(await loadArtifacts<StoredComparison>(id, owner, "comparison")).some(item => item.id === comparisonId)) throw new ApiError(404, "Comparison not found.");
      const result: CustomerOutcome = {id: artifactId, text, createdAt: new Date().toISOString(), kind: "user_reported", ...(comparisonId ? {comparisonId} : {})};
      await save(result.id, "outcome", result); return result;
    });
    return success({outcome});
  } catch(error) { return failure(error); }
}
