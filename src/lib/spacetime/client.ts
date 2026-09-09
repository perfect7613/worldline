"use client";

import { DbConnection } from "./generated";
import type { Resident } from "./generated/types";

export type WorldSnapshot = {
  rooms: { id: string; name: string; kind: string }[];
  residents: Resident[];
  memories: { id: string; roomId: string; branchId: string; residentId: string; sourceId: string; content: string; kind: string; importance: number; observedAtMs: number }[];
  events: { id: string; roomId: string; branchId: string; kind: string; detail: string; atMs: number }[];
  members: { id: string; roomId: string; name: string }[];
};
export type ConnectionStatus = "connecting" | "live" | "disconnected" | "error";

export function openWorldConnection(options: {
  uri: string;
  database: string;
  onSnapshot: (snapshot: WorldSnapshot) => void;
  onStatus: (status: ConnectionStatus, message?: string) => void;
}) {
  const tokenKey = `worldline:identity:${options.uri}:${options.database}`;
  let token: string | undefined;
  try { token = localStorage.getItem(tokenKey) ?? undefined; } catch { /* Private browsing can deny storage. */ }
  let closed = false;
  let scheduled = false;
  let ready = false;
  options.onStatus("connecting");
  const publish = (connection: DbConnection) => {
    if (closed || scheduled || !ready) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (closed) return;
      options.onSnapshot({
        rooms: Array.from(connection.db.myRooms.iter()),
        residents: Array.from(connection.db.roomResidents.iter()),
        memories: Array.from(connection.db.roomMemories.iter()).map(m => ({ ...m, observedAtMs: Number(m.observedAt.microsSinceUnixEpoch / 1000n) })),
        events: Array.from(connection.db.roomEvents.iter()).map(e => ({ ...e, id: e.id.toString(), atMs: Number(e.at.microsSinceUnixEpoch / 1000n) })),
        members: Array.from(connection.db.roomMembers.iter()).map(m => ({ id: m.id, roomId: m.roomId, name: m.name })),
      });
    });
  };
  const connection = DbConnection.builder().withUri(options.uri).withDatabaseName(options.database).withToken(token)
    .onConnect((conn, _identity, issuedToken) => {
      if (closed) { conn.disconnect(); return; }
      try { localStorage.setItem(tokenKey, issuedToken); } catch { /* Keep this session usable. */ }
      const update = () => publish(conn);
      for (const table of [conn.db.myRooms, conn.db.roomResidents, conn.db.roomMemories, conn.db.roomEvents, conn.db.roomMembers]) {
        table.onInsert(update); table.onDelete(update);
      }
      conn.subscriptionBuilder().onApplied(() => {
        ready = true; options.onStatus("live"); publish(conn);
      }).onError(ctx => options.onStatus("error", ctx.event?.message ?? "Subscription failed.")).subscribe([
        "SELECT * FROM my_rooms", "SELECT * FROM room_residents", "SELECT * FROM room_memories",
        "SELECT * FROM room_events", "SELECT * FROM room_members",
      ]);
    })
    .onConnectError((_ctx, error) => { if (!closed) options.onStatus("error", error.message); })
    .onDisconnect((_ctx, error) => { if (!closed) options.onStatus("disconnected", error?.message); })
    .build();
  return {
    connection,
    disconnect() { closed = true; ready = false; connection.disconnect(); },
    async createWorld(input: { name: string; memberName: string; kind: "founder" | "policy" }) {
      if (!ready) throw new Error("Connect to the world database first.");
      const roomId = crypto.randomUUID();
      const inviteCode = crypto.randomUUID();
      await connection.reducers.createRoom({ ...input, roomId, inviteCode });
      return { roomId, inviteCode, branchId: `${roomId}:baseline` };
    },
    async joinWorld(input: { roomId: string; inviteCode: string; name: string }) {
      if (!ready) throw new Error("Connect to the world database first.");
      await connection.reducers.joinRoom(input);
    },
    async observeWorldNote(input: { resident: Resident; content: string }) {
      if (!ready) throw new Error("Connect to the world database first.");
      await connection.reducers.observeNote({ roomId: input.resident.roomId, branchId: input.resident.branchId,
        residentId: input.resident.id, sourceId: crypto.randomUUID(), content: input.content, expectedRevision: input.resident.revision });
    },
  };
}

export type WorldConnection = ReturnType<typeof openWorldConnection>;
