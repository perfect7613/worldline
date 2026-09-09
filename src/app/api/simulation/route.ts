import { randomUUID } from "node:crypto";
import { createPopulation, type SourceEvidence } from "@/lib/agents";
import { createSession } from "@/lib/server/simulation-store";
import { authorize, failure, parseBrief, readJson, success } from "@/lib/server/simulation-http";
import { researchProduct } from "@/server/research";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  try {
    const owner = await authorize(request, true);
    const brief = parseBrief((await readJson(request)).brief);
    const evidence: SourceEvidence[] = [];
    let researchStatus = "not_configured";
    if ((process.env.FIRECRAWL_API_KEY || (process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID)) && process.env.ENABLE_PRODUCT_INGESTION === "true") {
      try {
        const capture = await researchProduct(brief.productUrl);
        evidence.push({ id: "website-1", title: capture.source.title, url: capture.source.url, excerpt: capture.markdown.slice(0, 6000) });
        brief.source = "website_capture"; brief.capturedEvidence = { ...capture.source, markdown: capture.markdown.slice(0, 6000) };
        researchStatus = "captured";
      } catch { researchStatus = "unavailable"; }
    }
    const population = await createPopulation({ brief, evidence, count: 12, signal: AbortSignal.timeout(90000) });
    const sessionId = randomUUID();
    await createSession({ id: sessionId, owner, brief, population: population.agents, evidence, conversations: [], createdAt: new Date().toISOString() });
    return success({ sessionId, population: population.agents, assumptions: population.assumptions, brief, researchStatus }, owner);
  } catch (error) { return failure(error); }
}
