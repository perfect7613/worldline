import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DbConnection } from "../src/lib/spacetime/generated";

const enabled = process.env.RUN_SPACETIME_INTEGRATION === "1";
const uri = "ws://127.0.0.1:3000";
const database = process.env.SPACETIME_TEST_DATABASE ?? "worldline";

function connect(token?: string): Promise<{ connection: DbConnection; token: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Database connection timed out")), 10_000);
    DbConnection.builder().withUri(uri).withDatabaseName(database).withToken(token)
      .onConnect((connection, _identity, newToken) => {
        connection.subscriptionBuilder()
          .onApplied(() => { clearTimeout(timeout); resolve({ connection, token: newToken }); })
          .onError(ctx => { clearTimeout(timeout); reject(ctx.event); })
          .subscribe(["SELECT * FROM my_rooms", "SELECT * FROM room_residents",
            "SELECT * FROM room_memories", "SELECT * FROM room_events", "SELECT * FROM room_members"]);
      })
      .onConnectError((_ctx, error) => { clearTimeout(timeout); reject(error); }).build();
  });
}

async function until(predicate: () => boolean) {
  const deadline = Date.now() + 8000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Subscription did not receive expected committed state");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

test("ten clients share committed memories; outsiders and stale writes are rejected; reconnect persists", {
  skip: !enabled, timeout: 35_000,
}, async () => {
  const clients: DbConnection[] = [];
  try {
    const sessions = await Promise.all(Array.from({ length: 11 }, () => connect()));
    clients.push(...sessions.map(s => s.connection));
    const [owner, ...others] = clients;
    const teammates = others.slice(0, 9);
    const outsider = others[9];
    const roomId = randomUUID(), inviteCode = randomUUID();
    const branchId = `${roomId}:baseline`;
    const residentId = `${branchId}:resident-1`;
    await owner.reducers.createRoom({ roomId, inviteCode, name: "Integration town", memberName: "Owner", kind: "founder" });
    await Promise.all(teammates.map((c, i) => c.reducers.joinRoom({ roomId, inviteCode, name: `Teammate ${i + 1}` })));
    await until(() => [owner, ...teammates].every(c => [...c.db.roomResidents.iter()].filter(r => r.roomId === roomId).length === 12));
    assert.equal([...outsider.db.roomResidents.iter()].length, 0);
    assert.equal([...outsider.db.myRooms.iter()].length, 0);
    await assert.rejects(outsider.reducers.joinRoom({ roomId, inviteCode: "incorrect-invitation", name: "Outsider" }));
    await assert.rejects(outsider.reducers.observeNote({ roomId, branchId, residentId, sourceId: randomUUID(), content: "Unauthorized", expectedRevision: 0 }));
    const firstId = randomUUID();
    await owner.reducers.observeNote({ roomId, branchId, residentId, sourceId: firstId, content: "Customers need a clear price.", expectedRevision: 0 });
    await until(() => [owner, ...teammates].every(c => [...c.db.roomMemories.iter()].some(m => m.sourceId === firstId)));
    assert.equal([...outsider.db.roomMemories.iter()].length, 0);
    // Retrying the same operation must not duplicate the memory.
    await owner.reducers.observeNote({ roomId, branchId, residentId, sourceId: firstId, content: "Customers need a clear price.", expectedRevision: 0 });
    assert.equal([...owner.db.roomMemories.iter()].filter(m => m.sourceId === firstId).length, 1);
    // Two writers with the same revision cannot silently overwrite each other.
    const competing = await Promise.allSettled(teammates.slice(0, 2).map((c, i) => c.reducers.observeNote({
      roomId, branchId, residentId, sourceId: randomUUID(), content: `Concurrent assumption ${i}`, expectedRevision: 1,
    })));
    assert.equal(competing.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(competing.filter(r => r.status === "rejected").length, 1);
    owner.disconnect();
    const resumed = await connect(sessions[0].token); clients.push(resumed.connection);
    assert.equal([...resumed.connection.db.roomMemories.iter()].filter(m => m.roomId === roomId).length, 2);
    assert.equal([...resumed.connection.db.roomMemories.iter()].find(m => m.sourceId === firstId)?.kind, "human_assumption");
  } finally { clients.forEach(c => c.disconnect()); }
});
