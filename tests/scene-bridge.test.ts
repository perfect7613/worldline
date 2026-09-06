import test from "node:test";
import assert from "node:assert/strict";
import { SceneBridge, type SceneCommand } from "../src/game/scene-bridge";

test("the latest track survives scene loading and detaching does not leak updates", () => {
  const bridge = new SceneBridge();
  bridge.send({ type: "setMode", mode: "founder" });
  bridge.send({ type: "setMode", mode: "policy" });
  const received: SceneCommand[] = [];
  const detach = bridge.attach(command => received.push(command));
  assert.deepEqual(received, [{ type: "setMode", mode: "policy" }]);
  bridge.send({ type: "setMode", mode: "founder" });
  assert.equal(received.length, 2);
  detach();
  bridge.send({ type: "setMode", mode: "policy" });
  assert.equal(received.length, 2);
});
