import test from "node:test";
import assert from "node:assert/strict";
import { openWorldConnection, type WorldSnapshot } from "../src/lib/spacetime/client";

test("client snapshots observe view delete/insert updates and retain the current write revision", {
  skip: process.env.RUN_SPACETIME_INTEGRATION !== "1", timeout: 15_000,
}, async () => {
  let live = false;
  let snapshot: WorldSnapshot = { rooms: [], residents: [], memories: [], events: [], members: [] };
  let connectionError = "";
  const adapter = openWorldConnection({ uri: "ws://127.0.0.1:3000", database: process.env.SPACETIME_TEST_DATABASE ?? "worldline",
    onSnapshot: value => { snapshot = value; },
    onStatus: (status, message) => { live = status === "live"; if (status === "error") connectionError = message ?? "Connection failed"; },
  });
  const until = async (predicate: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      if (connectionError) throw new Error(connectionError);
      if (Date.now() > deadline) throw new Error("Snapshot update timed out.");
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  };
  try {
    await until(() => live);
    const room = await adapter.createWorld({ name: "Adapter test", memberName: "Tester", kind: "founder" });
    await until(() => snapshot.residents.some(r => r.roomId === room.roomId));
    let resident = snapshot.residents.find(r => r.roomId === room.roomId)!;
    await adapter.observeWorldNote({ resident, content: "A first assumption." });
    await until(() => snapshot.residents.find(r => r.id === resident.id)?.revision === 1);
    resident = snapshot.residents.find(r => r.id === resident.id)!;
    await adapter.observeWorldNote({ resident, content: "A second assumption." });
    await until(() => snapshot.memories.filter(m => m.residentId === resident.id).length === 2);
    assert.equal(snapshot.residents.find(r => r.id === resident.id)?.revision, 2);
  } finally { adapter.disconnect(); }
});
