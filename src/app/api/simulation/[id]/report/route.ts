import { generateReport } from "@/lib/agents";
import { ApiError, loadArtifacts, takeBudget, withSession } from "@/lib/server/simulation-store";
import { publicComparison } from "@/lib/experiments/comparison";
import type { StoredComparison, CustomerOutcome } from "@/lib/experiments/types";
import { authorize, failure, success } from "@/lib/server/simulation-http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await authorize(request); const { id } = await context.params;
    const report = await withSession(id, owner, async session => {
      const [comparisons,outcomes] = await Promise.all([loadArtifacts<StoredComparison>(id,owner,"comparison"),loadArtifacts<CustomerOutcome>(id,owner,"outcome")]);
      const latest = comparisons.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
      const comparison = latest ? publicComparison(latest) : undefined;
      if (!session.conversations.length && !comparison?.completed) throw new ApiError(409, "Finish a conversation or compare at least one resident before creating a report.");
      if (!session.report?.conversationReferences || session.report.findings.some(f => !Array.isArray(f.comparisonAgentIds) || (f.kind === "source_supported" && !f.verification)) || session.report.comparison?.id !== comparison?.id || session.report.comparison?.completed !== comparison?.completed) {
        await takeBudget(`report:${id}`, 5, 86400);
        session.report = await generateReport({ brief: session.brief, population: session.population, conversations: session.conversations, comparison, evidence: session.evidence, signal: AbortSignal.timeout(120000) });
      }
      session.report = {...session.report, comparison, customerResponses: outcomes.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,10)};
      return session.report;
    });
    return success({ report });
  } catch (error) { return failure(error); }
}
