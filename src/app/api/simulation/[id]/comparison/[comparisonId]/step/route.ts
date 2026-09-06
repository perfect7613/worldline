import { authorize, failure, readJson, success } from "@/lib/server/simulation-http";
import { ApiError, loadArtifacts, takeBudget, withArtifacts } from "@/lib/server/simulation-store";
import { assess, publicComparison, geminiModel } from "@/lib/experiments/comparison";
import type { StoredComparison } from "@/lib/experiments/types";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request, context: {params: Promise<{id:string;comparisonId:string}>}) {
  try {
    const owner = await authorize(request); const {id, comparisonId} = await context.params; const body = await readJson(request);
    if (typeof body.agentId !== "string") throw new ApiError(400, "Choose the resident to compare.");
    const comparison = await withArtifacts(id, owner, async (_session, save) => {
      const stored = (await loadArtifacts<StoredComparison>(id, owner, "comparison")).find(item => item.id === comparisonId);
      if (!stored) throw new ApiError(404, "Comparison not found.");
      const row = stored.results.find(item => item.agentId === body.agentId);
      if (!row) throw new ApiError(400, "Resident not found in this comparison.");
      if (row.baseline && row.changed) return publicComparison(stored);
      if (stored.model !== geminiModel()) throw new ApiError(409, "The model changed. Start a new comparison to keep both proposals consistent.");
      for (const variant of ["baseline", "changed"] as const) {
        if (row[variant]) continue;
        await takeBudget(`comparison-assessment:${id}`, 360, 86400);
        row[variant] = await assess(stored, row.agentId, variant);
        const progress = publicComparison(stored);
        stored.completed = progress.completed; stored.status = progress.status;
        // Persist each completed model call, so a failed second arm can resume safely.
        await save(stored.id, "comparison", stored);
      }
      return publicComparison(stored);
    });
    return success({comparison});
  } catch(error) { return failure(error); }
}
