"use client";

import { useEffect, useRef, useState } from "react";
import { HudButton } from "@/components/hud/HudButton";
import { HudWindow } from "@/components/hud/HudWindow";
import { openWorldConnection, type WorldConnection, type WorldSnapshot, type ConnectionStatus } from "@/lib/spacetime/client";
import type { Resident } from "@/lib/spacetime/generated/types";

const EMPTY: WorldSnapshot = { rooms: [], residents: [], memories: [], events: [], members: [] };

export function SharedRoomPanel({ onSelectResident, onConnectionChange }: {
  onSelectResident?: (resident: Resident) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldSnapshot>(EMPTY);
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("Our decision room");
  const [roomId, setRoomId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [invitation, setInvitation] = useState<{ roomId: string; inviteCode: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const client = useRef<WorldConnection | null>(null);
  const statusCallback = useRef(onConnectionChange);
  useEffect(() => { statusCallback.current = onConnectionChange; }, [onConnectionChange]);
  const uri = process.env.NEXT_PUBLIC_SPACETIMEDB_URI;
  const database = process.env.NEXT_PUBLIC_SPACETIMEDB_DATABASE;

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const invitedRoom = hash.get("room");
    const inviteCode = hash.get("invite");
    if (invitedRoom && inviteCode) {
      setInvitation({ roomId: invitedRoom, inviteCode });
      setRoomId(invitedRoom);
    }
    if (!uri || !database) return;
    const connection = openWorldConnection({ uri, database, onSnapshot: setSnapshot,
      onStatus: (next, detail) => { setStatus(next); statusCallback.current?.(next); if (detail) setError(detail); },
    });
    client.current = connection;
    return () => { connection.disconnect(); client.current = null; };
  }, [uri, database, connectionAttempt]);

  const activeRoom = snapshot.rooms.find(room => room.id === roomId) ?? (roomId ? undefined : snapshot.rooms[0]);
  const residents = snapshot.residents.filter(actor => actor.roomId === activeRoom?.id);
  const selected = residents.find(actor => actor.id === selectedId) ?? residents[0];
  const memories = snapshot.memories.filter(memory => memory.residentId === selected?.id).sort((a, b) => b.observedAtMs - a.observedAtMs);
  const members = snapshot.members.filter(member => member.roomId === activeRoom?.id);
  const connected = status === "live";

  async function act(task: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "The change could not be saved."); }
    finally { setBusy(false); }
  }

  return <HudWindow id="shared-room" title="Shared memory" hint={connected ? "connected" : status}
    expanded={expanded} onToggle={() => setExpanded(value => !value)} className="shared-room-panel">
    <div style={{ display: "grid", gap: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>A persistent room for your team. Notes save to a resident&apos;s memory and appear for everyone in the room.</p>
      {!uri || !database ? <p className="muted">Shared rooms need a database connection. The sample city remains available.</p> : null}
      {uri && database && (status === "error" || status === "disconnected") && <HudButton variant="outline" size="sm" onClick={() => {
        setError(""); setMessage(""); setConnectionAttempt(attempt => attempt + 1);
      }}>Reconnect room</HudButton>}
      {!activeRoom ? <>
        <label className="hud-field"><span className="hud-label">Your name</span>
          <input className="hud-field__input" value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="How teammates see you" autoComplete="nickname" />
        </label>
        {!invitation && <label className="hud-field"><span className="hud-label">Room name</span>
          <input className="hud-field__input" value={roomName} onChange={e => setRoomName(e.target.value)} maxLength={100} />
        </label>}
        <HudButton disabled={!connected || busy || !name.trim() || (!invitation && !roomName.trim())} onClick={() => void act(async () => {
          const connection = client.current;
          if (!connection) throw new Error("The room connection is unavailable. Reconnect and try again.");
          if (invitation) {
            await connection.joinWorld({ ...invitation, name: name.trim() }); setRoomId(invitation.roomId);
          } else {
            const created = await connection.createWorld({ name: roomName.trim(), memberName: name.trim(), kind: "founder" });
            setRoomId(created.roomId); setInvitation(created);
            // Fragments survive reload without placing the invitation in server request logs.
            const link = new URL(window.location.href);
            link.hash = new URLSearchParams({ room: created.roomId, invite: created.inviteCode }).toString();
            window.history.replaceState(null, "", link);
          }
        })}>{busy ? "Opening room…" : invitation ? "Join invited room" : "Create shared room"}</HudButton>
      </> : <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div><strong>{activeRoom.name}</strong><p className="muted" style={{ margin: "4px 0 0", fontSize: 11 }}>{members.length} joined member{members.length === 1 ? "" : "s"} · {residents.length} synthetic residents</p></div>
          {invitation?.roomId === activeRoom.id && <HudButton variant="outline" size="sm" onClick={() => void act(async () => {
            const link = new URL(window.location.href); link.hash = new URLSearchParams({ room: invitation.roomId, invite: invitation.inviteCode }).toString();
            await navigator.clipboard.writeText(link.toString()); setMessage("Invite copied. Open it in another browser to join.");
          })}>Invite</HudButton>}
        </div>
        <label className="hud-field"><span className="hud-label">Resident memory</span>
          <select className="hud-field__input" value={selected?.id ?? ""} onChange={event => {
            setSelectedId(event.target.value); const actor = residents.find(r => r.id === event.target.value); if (actor) onSelectResident?.(actor);
          }}>{residents.map(actor => <option key={actor.id} value={actor.id}>{actor.name} · {actor.role}</option>)}</select>
        </label>
        <div style={{ maxHeight: 180, overflowY: "auto", display: "grid", gap: 8 }} aria-live="polite" aria-label="Saved resident memories">
          {memories.length ? memories.map(memory => <article key={memory.id} style={{ padding: 10, border: "1px solid var(--border)", background: "rgba(0,0,0,.12)" }}>
            <span className="hud-label">{memory.kind === "human_assumption" ? "Human-supplied assumption" : "Simulated reflection"}</span>
            <p style={{ margin: "5px 0", fontSize: 12, lineHeight: 1.5 }}>{memory.content}</p>
            <span className="muted" style={{ fontSize: 10 }}>Source {memory.sourceId.slice(0, 8)} · saved in this branch</span>
          </article>) : <p className="muted" style={{ fontSize: 12 }}>No observations yet. Give {selected?.name ?? "a resident"} a note to remember.</p>}
        </div>
        <form onSubmit={event => { event.preventDefault(); if (!selected) return; void act(async () => {
          const connection = client.current;
          if (!connection) throw new Error("The room connection is unavailable. Reconnect and try again.");
          await connection.observeWorldNote({ resident: selected, content: note.trim() });
          setNote(""); setMessage("Observation saved. Other room members can see it now.");
        }); }} style={{ display: "grid", gap: 8 }}>
          <label className="hud-field"><span className="hud-label">Give {selected?.name ?? "resident"} an observation</span>
            <textarea className="hud-field__input" rows={3} value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder="For example: the proposed monthly price is ₹499." />
          </label>
          <HudButton type="submit" disabled={!connected || busy || !selected || !note.trim()}>{busy ? "Saving…" : "Save to memory"}</HudButton>
        </form>
        <p className="muted" style={{ margin: 0, fontSize: 10 }}>These are team assumptions, not verified website claims. Joined members are not a live presence count. The city above remains an illustrative preview.</p>
      </>}
      {message && <p role="status" style={{ margin: 0, color: "var(--primary)", fontSize: 12 }}>{message}</p>}
      {error && <p role="alert" style={{ margin: 0, color: "#ffb29b", fontSize: 12 }}>{error}</p>}
    </div>
  </HudWindow>;
}
