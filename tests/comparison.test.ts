import assert from "node:assert/strict";
import test from "node:test";
import { assessmentInput, publicComparison } from "../src/lib/experiments/comparison";
import type { StoredComparison } from "../src/lib/experiments/types";
const fixture = (): StoredComparison => ({
  id: "test", change: "Offer a free trial", createdAt: "2026-09-05", status: "pending", total: 2, completed: 0, model: "gemini-test", disclaimer: "Simulated",
  results: [{agentId:"a",name:"A",role:"Buyer"},{agentId:"b",name:"B",role:"Buyer"}],
  snapshot: {revision:4, brief:{mode:"founder",productName:"Example",productUrl:"https://example.com",description:"A tool",audience:"Teams",decision:"Pricing",constraint:"Budget",source:"local_form"},
    population:[{id:"a",name:"A",role:"Buyer",goal:"Save",background:"Team buyer",concerns:[],sourceIds:[],assumptions:[]}], evidence:[],
    memories:[{agentId:"a",text:"My own opinion",kind:"reflection",sourceIds:[]},{agentId:"b",text:"Private B memory",kind:"reflection",sourceIds:[]}],publicChanges:[]}
});
test("comparison arms differ only in amendment, isolate memories and never see opposite answers", () => {
  const stored = fixture();
  stored.results[0].baseline = {decision:"Reject",reason:"Private arm answer",tradeoff:"Cost",sourceIds:[]};
  const baseline = assessmentInput(stored,"a","baseline"); const changed = assessmentInput(stored,"a","changed");
  assert.deepEqual({...changed,proposalChange:null},baseline);
  assert.equal(changed.proposalChange,stored.change);
  assert.equal(baseline.memories.length,1);
  assert.doesNotMatch(JSON.stringify(changed), /Private arm answer|Private B memory/);
});
test("public comparison excludes snapshot and counts only complete pairs", () => {
  const stored = fixture();
  const answer = {decision:"Try",reason:"Useful",tradeoff:"Time",sourceIds:[]};
  stored.results[0].baseline = answer;
  assert.equal(publicComparison(stored).status,"running");
  assert.equal(publicComparison(stored).completed,0);
  stored.results[0].changed = answer;
  assert.equal(publicComparison(stored).completed,1);
  stored.results[1].baseline = answer; stored.results[1].changed = answer;
  const published = publicComparison(stored);
  assert.equal(published.status,"complete");
  assert.equal("snapshot" in published,false);
});
