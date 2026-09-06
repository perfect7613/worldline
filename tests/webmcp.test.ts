import test from "node:test";
import assert from "node:assert/strict";
import { registerSiteTools, emptyInput, type SiteTool } from "../src/lib/webmcp/register";

test("site tools use current UI handlers and cannot execute after cleanup", async () => {
  const registry = new Map<string, SiteTool>();
  let signal: AbortSignal | undefined;
  let state = "landing";
  let definitions: SiteTool[] = [{ name: "state", description: "Read state", inputSchema: emptyInput, annotations: {readOnlyHint: true}, execute: () => state }];
  const dispose = registerSiteTools({ registerTool(tool, options) { registry.set(tool.name, tool); signal = options?.signal; } }, () => definitions);
  const tool = registry.get("state")!;
  assert.deepEqual(await tool.execute({}), {ok: true, result: "landing"});
  state = "world";
  assert.deepEqual(await tool.execute({}), {ok: true, result: "world"});
  definitions = [{ ...definitions[0], execute: () => { throw new Error("Unavailable"); } }];
  assert.deepEqual(await tool.execute({}), {ok: false, error: "Unavailable"});
  dispose();
  assert.equal(signal?.aborted, true);
  assert.deepEqual(await tool.execute({}), {ok: false, error: "This page is no longer active."});
});

test("legacy cleanup unregisters only tools owned by the integration", () => {
  const removed: string[] = [];
  const dispose = registerSiteTools({ registerTool() {}, unregisterTool(name) { removed.push(name); } }, () => [{name: "owned", description: "Read", inputSchema: emptyInput, annotations: {readOnlyHint: true}, execute: () => null}]);
  dispose();
  assert.deepEqual(removed, ["owned"]);
});
