import test from "node:test";
import assert from "node:assert/strict";
import { retrieveMemories, type MemoryRecord } from "../src/server/memory";

const now = 1_000_000_000;
const base: MemoryRecord = { id: "a", roomId: "room", branchId: "baseline", residentId: "maya", sourceId: "pricing", content: "Annual pricing costs too much", importance: 0.5, observedAtMs: now };
const scope = { roomId: "room", branchId: "baseline", residentId: "maya", observedSourceIds: new Set(["pricing", "features"]) };

test("retrieval excludes other rooms, branches, actors, unseen sources and future/invalid memories", () => {
  const records = [base, { ...base, id: "room", roomId: "other" }, { ...base, id: "branch", branchId: "alternative" },
    { ...base, id: "actor", residentId: "kai" }, { ...base, id: "unseen", sourceId: "private" },
    { ...base, id: "future", observedAtMs: now + 1 }, { ...base, id: "invalid", importance: NaN }];
  assert.deepEqual(retrieveMemories(records, scope, "pricing", { nowMs: now }).map(m => m.id), ["a"]);
});

test("relevance, recency and importance rank memories deterministically without treating score as confidence", () => {
  const records = [{ ...base, id: "older", observedAtMs: now - 360_000_000 }, base,
    { ...base, id: "unrelated", sourceId: "features", content: "Beautiful blue sky", importance: 0 }];
  const results = retrieveMemories(records, scope, "annual pricing", { nowMs: now });
  assert.equal(results[0].id, "a");
  assert.equal(results[0].relevanceMethod, "lexical");
  assert.ok(results[0].score >= 0 && results[0].score <= 1);
  assert.deepEqual(results, retrieveMemories([...records].reverse(), scope, "annual pricing", { nowMs: now }));
});

test("copies deduplicate but distinct claims from the same source survive", () => {
  const records = [base, { ...base, id: "copy" }, { ...base, id: "other", content: "There is a free trial" }];
  const result = retrieveMemories(records, scope, "pricing", { nowMs: now });
  assert.equal(result.length, 2);
  assert.ok(result.some(m => m.id === "other"));
});

test("optional vectors use cosine similarity and malformed vectors fall back to lexical", () => {
  const vector = retrieveMemories([{ ...base, embedding: [1, 0] }], scope, "pricing", { nowMs: now, queryEmbedding: [1, 0] })[0];
  assert.equal(vector.scores.relevance, 1); assert.equal(vector.relevanceMethod, "embedding");
  const malformed = retrieveMemories([{ ...base, embedding: [NaN] }], scope, "pricing", { nowMs: now, queryEmbedding: [1] })[0];
  assert.equal(malformed.relevanceMethod, "lexical");
  assert.throws(() => retrieveMemories([base], scope, "pricing", { nowMs: now, limit: NaN }));
});
