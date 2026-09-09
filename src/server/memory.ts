export type MemoryRecord = {
  id: string;
  roomId: string;
  branchId: string;
  residentId: string;
  sourceId: string;
  content: string;
  importance: number;
  observedAtMs: number;
  embedding?: readonly number[];
};

export type MemoryScope = {
  roomId: string;
  branchId: string;
  residentId: string;
  /** Derived from authorized observation rows, never supplied by an untrusted agent. */
  observedSourceIds: ReadonlySet<string>;
};

const tokens = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []);

function lexicalRelevance(query: string, content: string): number {
  const left = tokens(query);
  const right = tokens(content);
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common++;
  return common / Math.sqrt(left.size * right.size);
}

function cosine(left: readonly number[], right: readonly number[]): number | undefined {
  if (!left.length || left.length !== right.length) return undefined;
  let dot = 0, a = 0, b = 0;
  for (let i = 0; i < left.length; i++) {
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) return undefined;
    dot += left[i] * right[i]; a += left[i] ** 2; b += right[i] ** 2;
  }
  return a && b ? Math.max(0, Math.min(1, dot / Math.sqrt(a * b))) : undefined;
}

/** Rank only an actor's observed, branch-local evidence. This is a heuristic, not a confidence score. */
export function retrieveMemories(
  records: readonly MemoryRecord[],
  scope: MemoryScope,
  query: string,
  options: { nowMs: number; limit?: number; queryEmbedding?: readonly number[] },
) {
  if (!Number.isFinite(options.nowMs)) throw new Error("A valid retrieval timestamp is required.");
  if (options.limit !== undefined && !Number.isFinite(options.limit)) throw new Error("Memory limit must be finite.");
  const limit = Math.max(1, Math.min(32, Math.floor(options.limit ?? 8)));
  const ranked = records.filter(record =>
    record.roomId === scope.roomId && record.branchId === scope.branchId &&
    record.residentId === scope.residentId && scope.observedSourceIds.has(record.sourceId) &&
    Number.isFinite(record.observedAtMs) && record.observedAtMs <= options.nowMs &&
    Number.isFinite(record.importance) && record.importance >= 0 && record.importance <= 1,
  ).map(record => {
    const semantic = record.embedding && options.queryEmbedding
      ? cosine(record.embedding, options.queryEmbedding) : undefined;
    const relevance = semantic ?? lexicalRelevance(query, record.content);
    const recency = Math.pow(0.995, (options.nowMs - record.observedAtMs) / 3_600_000);
    return { ...record, score: (relevance + recency + record.importance) / 3,
      scores: { relevance, recency, importance: record.importance },
      relevanceMethod: semantic === undefined ? "lexical" as const : "embedding" as const };
  }).sort((a, b) => b.score - a.score || b.observedAtMs - a.observedAtMs || a.id.localeCompare(b.id));
  // Keep distinct observations of a source; suppress repeated copies of the same claim.
  const seenClaims = new Set<string>();
  return ranked.filter(record => {
    const claim = `${record.sourceId}:${record.content.toLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seenClaims.has(claim)) return false;
    seenClaims.add(claim); return true;
  }).slice(0, limit);
}
