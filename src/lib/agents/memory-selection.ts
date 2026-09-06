import type { AgentMemory, ConversationInput } from "./types";

const SELECTED = 12;
const CANDIDATES_PER_ACTOR = 16;
const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);

function similarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("Invalid embedding dimensions");
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; aa += a[i] ** 2; bb += b[i] ** 2; }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

/** Request-scoped retrieval; never mix one actor's private memory into another's prompt. */
export async function selectConversationMemories(input: ConversationInput): Promise<Map<string, AgentMemory[]>> {
  const groups = input.participants.map(actor => {
    const query = [input.brief.productName, input.brief.decision, input.brief.audience, actor.goal, ...actor.concerns].join("\n").slice(0, 3000);
    // Array order is the supplied chronological order. Keep provider inputs bounded.
    const candidates = input.memories.filter(memory => memory.agentId === actor.id && memory.text.trim()).slice(-CANDIDATES_PER_ACTOR);
    return { actorId: actor.id, query, candidates };
  });
  const selected = new Map<string, AgentMemory[]>();
  for (const group of groups) {
    const queryWords = words(group.query);
    const ranked = group.candidates.map((memory, index) => {
      const tokens = words(memory.text);
      const overlap = [...queryWords].filter(word => tokens.has(word)).length / Math.max(1, queryWords.size);
      return { memory, index, score: overlap + 0.15 * (index + 1) / group.candidates.length };
    });
    selected.set(group.actorId, ranked.sort((a, b) => b.score - a.score).slice(0, SELECTED).sort((a, b) => a.index - b.index).map(item => item.memory));
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  const retrievalGroups = groups.filter(group => group.candidates.length > SELECTED);
  if (!key || !retrievalGroups.length || input.signal?.aborted) return selected;

  // One batch (at most 32 memories + 2 actor-specific queries); no extra LLM call.
  // Do not retain private text/vectors in a shared process cache across rooms.
  const texts = retrievalGroups.flatMap(group => [group.query, ...group.candidates.map(memory => memory.text.slice(0, 1600))]);
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 6000);
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small", input: texts, encoding_format: "float" }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return selected;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("data" in body) || !Array.isArray(body.data) || body.data.length !== texts.length) return selected;
    const vectors = new Map<number, number[]>();
    for (const row of body.data) {
      if (!row || !Number.isInteger(row.index) || row.index < 0 || row.index >= texts.length || vectors.has(row.index) || !Array.isArray(row.embedding) || !row.embedding.length || row.embedding.length > 8192 || !row.embedding.every((value: unknown) => typeof value === "number" && Number.isFinite(value))) return selected;
      vectors.set(row.index, row.embedding);
    }
    const semantic = new Map(selected);
    let offset = 0;
    for (const group of retrievalGroups) {
      const query = vectors.get(offset)!;
      const ranked = group.candidates.map((memory, index) => ({ memory, index, score: similarity(query, vectors.get(offset + index + 1)!) + 0.05 * (index + 1) / group.candidates.length }));
      semantic.set(group.actorId, ranked.sort((a, b) => b.score - a.score).slice(0, SELECTED).sort((a, b) => a.index - b.index).map(item => item.memory));
      offset += group.candidates.length + 1;
    }
    return semantic;
  } catch {
    // Retrieval is optional. Never surface provider bodies, keys or memory text in errors.
    return selected;
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abort);
  }
}
