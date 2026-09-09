import { schema, table, t, type ReducerCtx } from "spacetimedb/server";

const room = table({ name: "room" }, {
  id: t.string().primaryKey(), name: t.string(), owner: t.identity(),
  inviteCode: t.string(), kind: t.string(), createdAt: t.timestamp(),
});
const member = table({ name: "member" }, {
  id: t.string().primaryKey(), roomId: t.string().index("btree"), identity: t.identity().index("btree"),
  name: t.string(), joinedAt: t.timestamp(),
});
const branch = table({ name: "branch" }, {
  id: t.string().primaryKey(), roomId: t.string().index("btree"), name: t.string(), revision: t.u32(),
});
const resident = table({ name: "resident" }, {
  id: t.string().primaryKey(), roomId: t.string().index("btree"), branchId: t.string().index("btree"),
  name: t.string(), role: t.string(), appearanceId: t.u32(), x: t.f32(), y: t.f32(),
  state: t.string(), revision: t.u32(),
});
const source = table({ name: "source" }, {
  id: t.string().primaryKey(), roomId: t.string().index("btree"), branchId: t.string(),
  content: t.string(), kind: t.string(), createdAt: t.timestamp(),
});
const memory = table({ name: "memory" }, {
  id: t.string().primaryKey(), roomId: t.string().index("btree"), branchId: t.string(),
  residentId: t.string().index("btree"), sourceId: t.string(), content: t.string(),
  importance: t.f32(), kind: t.string(), observedAt: t.timestamp(),
});
const event = table({ name: "world_event" }, {
  id: t.u64().primaryKey().autoInc(), roomId: t.string().index("btree"), branchId: t.string(),
  kind: t.string(), detail: t.string(), at: t.timestamp(),
});
const worker = table({ name: "worker" }, {
  id: t.string().primaryKey(), roomId: t.string().index("btree"), identity: t.identity(),
});
const job = table({ name: "job" }, {
  id: t.string().primaryKey(), roomId: t.string().index("btree"), branchId: t.string(),
  residentId: t.string(), sourceId: t.string(), status: t.string(),
  assignedTo: t.option(t.identity()), leaseUntilMs: t.u64(), fence: t.u32(),
  expectedRevision: t.u32(),
});

// Server-only simulation storage. The publisher identity is captured by init;
// browser identities cannot read these private tables or call service reducers.
const serviceOwner = table({ name: "service_owner" }, { id: t.u8().primaryKey(), identity: t.identity() });
const simulationService = table({ name: "simulation_service" }, { identity: t.identity().primaryKey() });
const simulationSession = table({ name: "simulation_session" }, {
  id: t.string().primaryKey(), owner: t.string(), briefJson: t.string(), createdAt: t.string(),
  expiresAtMs: t.u64(), revision: t.u32(), leaseToken: t.string(), leaseUntilMs: t.u64(),
});
const simulationPersona = table({ name: "simulation_persona" }, {
  id: t.string().primaryKey(), sessionId: t.string().index("btree"), actorId: t.string(),
  name: t.string(), role: t.string(), goal: t.string(), background: t.string(),
  concernsJson: t.string(), sourceIdsJson: t.string(), assumptionsJson: t.string(),
});
const simulationSource = table({ name: "simulation_source" }, {
  id: t.string().primaryKey(), sessionId: t.string().index("btree"), sourceId: t.string(),
  title: t.string(), url: t.string(), excerpt: t.string(),
});
const simulationConversation = table({ name: "simulation_conversation" }, {
  id: t.string().primaryKey(), sessionId: t.string().index("btree"), conversationId: t.string(),
  title: t.string(), participantIdsJson: t.string(), round: t.u32(), model: t.string(), kind: t.string(),
});
const simulationMessage = table({ name: "simulation_message" }, {
  id: t.string().primaryKey(), sessionId: t.string().index("btree"), conversationId: t.string(),
  position: t.u32(), actorId: t.string(), text: t.string(), sourceIdsJson: t.string(),
});
const simulationMemory = table({ name: "simulation_memory" }, {
  id: t.string().primaryKey(), sessionId: t.string().index("btree"), conversationId: t.string(),
  position: t.u32(), agentId: t.string().index("btree"), text: t.string(), kind: t.string(),
  sourceIdsJson: t.string(), observedAtMs: t.u64(),
});
const simulationReport = table({ name: "simulation_report" }, {
  id: t.string().primaryKey(), sessionId: t.string().index("btree"), reportJson: t.string(),
});
const simulationArtifact = table({ name: "simulation_artifact" }, {
  id: t.string().primaryKey(), sessionId: t.string().index("btree"), kind: t.string(), payloadJson: t.string(),
});
const requestBudget = table({ name: "request_budget" }, {
  scope: t.string().primaryKey(), count: t.u32(), expiresAtMs: t.u64(),
});
// Contact details and browser identifiers never appear in public client tables.
const signupLead = table({ name: "signup_lead" }, {
  requestId: t.string().primaryKey(), owner: t.string(), email: t.string(), mode: t.string(),
  productUpdates: t.bool(), consentAtMs: t.u64(), source: t.string(), createdAtMs: t.u64(),
});
const siteVisitor = table({ name: "site_visitor" }, {
  visitorHash: t.string().primaryKey(), firstSeenMs: t.u64(), lastSeenMs: t.u64(), visits: t.u32(),
});
const siteVisitEvent = table({ name: "site_visit_event" }, {
  eventId: t.string().primaryKey(), visitorHash: t.string(), createdAtMs: t.u64(),
});
const visitorCounts = table({ name: "visitor_counts" }, {
  id: t.u8().primaryKey(), uniqueVisitors: t.u64(), pageViews: t.u64(),
});
const db = schema({ room, member, branch, resident, source, memory, event, worker, job,
  serviceOwner, simulationService, simulationSession, simulationPersona, simulationSource, simulationConversation,
  simulationMessage, simulationMemory, simulationReport, simulationArtifact, requestBudget, signupLead, siteVisitor, siteVisitEvent, visitorCounts });
export default db;
type Ctx = ReducerCtx<typeof db.schemaType>;

function clean(value: string, max: number, label: string) {
  const result = value.trim();
  if (!result || result.length > max) throw new Error(`${label} must be 1–${max} characters.`);
  return result;
}
function requireMember(ctx: Ctx, roomId: string) {
  if (!ctx.db.member.id.find(`${roomId}:${ctx.sender.toHexString()}`)) throw new Error("Room access denied.");
}
function requireOwner(ctx: Ctx, roomId: string) {
  const found = ctx.db.room.id.find(roomId);
  if (!found || !found.owner.isEqual(ctx.sender)) throw new Error("Only the room owner can do this.");
  return found;
}
function requireBranch(ctx: Ctx, roomId: string, branchId: string) {
  const found = ctx.db.branch.id.find(branchId);
  if (!found || found.roomId !== roomId) throw new Error("Branch not found in this room.");
  return found;
}
function appendEvent(ctx: Ctx, roomId: string, branchId: string, kind: string, detail: string) {
  ctx.db.event.insert({ id: 0n, roomId, branchId, kind, detail, at: ctx.timestamp });
}

export const createRoom = db.reducer({ roomId: t.string(), inviteCode: t.string(), name: t.string(), memberName: t.string(), kind: t.string() }, (ctx, args) => {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(args.roomId) || !/^[a-zA-Z0-9-]{24,128}$/.test(args.inviteCode))
    throw new Error("Use randomly generated room and invite identifiers.");
  if (args.kind !== "founder" && args.kind !== "policy") throw new Error("Unsupported scenario kind.");
  if (ctx.db.room.id.find(args.roomId)) throw new Error("Room already exists.");
  const name = clean(args.name, 100, "Room name");
  const memberName = clean(args.memberName, 40, "Your name");
  const branchId = `${args.roomId}:baseline`;
  ctx.db.room.insert({ id: args.roomId, inviteCode: args.inviteCode, owner: ctx.sender, name, kind: args.kind, createdAt: ctx.timestamp });
  ctx.db.member.insert({ id: `${args.roomId}:${ctx.sender.toHexString()}`, roomId: args.roomId, identity: ctx.sender, name: memberName, joinedAt: ctx.timestamp });
  ctx.db.branch.insert({ id: branchId, roomId: args.roomId, name: "Baseline", revision: 0 });
  const names = ["Maya", "Alex", "Priya", "James", "Sofia", "Leo", "Amara", "Noah", "Yuki", "Sam", "Zara", "Kai"];
  const roles = args.kind === "founder" ? ["Early adopter", "Small business owner", "Product lead"] : ["Resident", "Local business owner", "Commuter"];
  names.forEach((person, i) => ctx.db.resident.insert({ id: `${branchId}:resident-${i + 1}`, roomId: args.roomId, branchId,
    name: person, role: roles[i % roles.length], appearanceId: i, x: 4 + (i % 4) * 3, y: 4 + Math.floor(i / 4) * 3, state: "idle", revision: 0 }));
  appendEvent(ctx, args.roomId, branchId, "sample_population_created", "12 illustrative synthetic residents. No real customer research has run.");
});

export const joinRoom = db.reducer({ roomId: t.string(), inviteCode: t.string(), name: t.string() }, (ctx, args) => {
  const found = ctx.db.room.id.find(args.roomId);
  if (!found || found.inviteCode !== args.inviteCode) throw new Error("This room invitation is not valid.");
  const id = `${args.roomId}:${ctx.sender.toHexString()}`;
  if (ctx.db.member.id.find(id)) return;
  ctx.db.member.insert({ id, roomId: args.roomId, identity: ctx.sender, name: clean(args.name, 40, "Your name"), joinedAt: ctx.timestamp });
  appendEvent(ctx, args.roomId, `${args.roomId}:baseline`, "member_joined", "A teammate joined the room.");
});

// A human can submit an assumption, but cannot label it as a scraped or verified fact.
export const observeNote = db.reducer({ roomId: t.string(), branchId: t.string(), residentId: t.string(), sourceId: t.string(), content: t.string(), expectedRevision: t.u32() }, (ctx, args) => {
  requireMember(ctx, args.roomId); requireBranch(ctx, args.roomId, args.branchId);
  const actor = ctx.db.resident.id.find(args.residentId);
  if (!actor || actor.roomId !== args.roomId || actor.branchId !== args.branchId) throw new Error("Resident not found in this branch.");
  const content = clean(args.content, 2000, "Observation");
  clean(args.sourceId, 128, "Observation ID");
  const previous = ctx.db.source.id.find(args.sourceId);
  if (previous) {
    if (previous.roomId === args.roomId && previous.branchId === args.branchId && previous.content === content && ctx.db.memory.id.find(`${args.residentId}:${args.sourceId}`)) return;
    throw new Error("Observation ID already used.");
  }
  if (actor.revision !== args.expectedRevision) throw new Error("Resident changed. Reload their current state and retry.");
  ctx.db.source.insert({ id: args.sourceId, roomId: args.roomId, branchId: args.branchId, content, kind: "human_assumption", createdAt: ctx.timestamp });
  ctx.db.memory.insert({ id: `${args.residentId}:${args.sourceId}`, roomId: args.roomId, branchId: args.branchId,
    residentId: args.residentId, sourceId: args.sourceId, content, importance: 0.5, kind: "human_assumption", observedAt: ctx.timestamp });
  ctx.db.resident.id.update({ ...actor, revision: actor.revision + 1, state: "observing" });
  appendEvent(ctx, args.roomId, args.branchId, "observation_added", `${actor.name} received a human-supplied assumption.`);
});

export const authorizeWorker = db.reducer({ roomId: t.string(), identity: t.identity() }, (ctx, args) => {
  requireOwner(ctx, args.roomId);
  const id = `${args.roomId}:${args.identity.toHexString()}`;
  if (!ctx.db.worker.id.find(id)) ctx.db.worker.insert({ id, roomId: args.roomId, identity: args.identity });
});

export const requestReflection = db.reducer({ roomId: t.string(), branchId: t.string(), residentId: t.string(), sourceId: t.string(), jobId: t.string() }, (ctx, args) => {
  requireMember(ctx, args.roomId); requireBranch(ctx, args.roomId, args.branchId);
  clean(args.jobId, 128, "Job ID");
  const actor = ctx.db.resident.id.find(args.residentId);
  if (!actor || actor.roomId !== args.roomId || actor.branchId !== args.branchId ||
    !ctx.db.memory.id.find(`${args.residentId}:${args.sourceId}`)) throw new Error("A resident can reflect only on evidence they observed in this branch.");
  const previous = ctx.db.job.id.find(args.jobId);
  if (previous) {
    if (previous.roomId === args.roomId && previous.residentId === args.residentId && previous.sourceId === args.sourceId) return;
    throw new Error("Job ID already used.");
  }
  ctx.db.job.insert({ id: args.jobId, roomId: args.roomId, branchId: args.branchId, residentId: args.residentId, sourceId: args.sourceId,
    status: "queued", assignedTo: undefined, leaseUntilMs: 0n, fence: 0, expectedRevision: actor.revision });
  appendEvent(ctx, args.roomId, args.branchId, "reflection_requested", `Reflection for ${actor.name} queued; an authorized worker is required.`);
});

export const claimJob = db.reducer({ jobId: t.string() }, (ctx, { jobId }) => {
  const found = ctx.db.job.id.find(jobId);
  if (!found || !ctx.db.worker.id.find(`${found.roomId}:${ctx.sender.toHexString()}`)) throw new Error("Worker access denied.");
  const now = ctx.timestamp.microsSinceUnixEpoch / 1000n;
  if (found.status === "complete" || (found.status === "running" && found.leaseUntilMs > now)) throw new Error("Job is not available.");
  const actor = ctx.db.resident.id.find(found.residentId);
  if (!actor || actor.roomId !== found.roomId || actor.branchId !== found.branchId) throw new Error("Resident not found in this branch.");
  // A reclaimed job reasons over the current observation stream. Completion still
  // rejects changes made while the model is running, using this fresh revision.
  ctx.db.job.id.update({ ...found, status: "running", assignedTo: ctx.sender, leaseUntilMs: now + 120_000n,
    fence: found.fence + 1, expectedRevision: actor.revision });
});

export const completeReflection = db.reducer({ jobId: t.string(), fence: t.u32(), content: t.string(), importance: t.f32() }, (ctx, args) => {
  const found = ctx.db.job.id.find(args.jobId);
  if (!found || !found.assignedTo?.isEqual(ctx.sender) || !ctx.db.worker.id.find(`${found.roomId}:${ctx.sender.toHexString()}`)) throw new Error("Worker access denied.");
  if (found.status === "complete" && found.fence === args.fence) return;
  const now = ctx.timestamp.microsSinceUnixEpoch / 1000n;
  if (found.status !== "running" || found.fence !== args.fence || found.leaseUntilMs <= now) throw new Error("Worker lease expired or replaced.");
  const actor = ctx.db.resident.id.find(found.residentId);
  if (!actor || actor.revision !== found.expectedRevision) throw new Error("Resident changed; stale result rejected.");
  if (!Number.isFinite(args.importance) || args.importance < 0 || args.importance > 1) throw new Error("Importance must be between 0 and 1.");
  ctx.db.memory.insert({ id: `reflection:${found.id}`, roomId: found.roomId, branchId: found.branchId, residentId: found.residentId,
    sourceId: found.sourceId, content: clean(args.content, 2000, "Reflection"), importance: args.importance, kind: "simulated_reflection", observedAt: ctx.timestamp });
  ctx.db.resident.id.update({ ...actor, revision: actor.revision + 1, state: "idle" });
  ctx.db.job.id.update({ ...found, status: "complete" });
  appendEvent(ctx, found.roomId, found.branchId, "reflection_completed", `${actor.name} formed a simulated reflection linked to its source.`);
});

// Private tables + identity-scoped views are the authorization boundary.
// Invite codes are never exposed by a public view.
const roomSummary = t.row("RoomSummary", { id: t.string(), name: t.string(), kind: t.string() });
export const myRooms = db.view({ name: "my_rooms", public: true }, t.array(roomSummary), ctx =>
  Array.from(ctx.db.member.identity.filter(ctx.sender)).flatMap(m => {
    const r = ctx.db.room.id.find(m.roomId); return r ? [{ id: r.id, name: r.name, kind: r.kind }] : [];
  }));
export const roomResidents = db.view({ name: "room_residents", public: true }, t.array(resident.rowType), ctx =>
  Array.from(ctx.db.member.identity.filter(ctx.sender)).flatMap(m => Array.from(ctx.db.resident.roomId.filter(m.roomId))));
export const roomMemories = db.view({ name: "room_memories", public: true }, t.array(memory.rowType), ctx =>
  Array.from(ctx.db.member.identity.filter(ctx.sender)).flatMap(m => Array.from(ctx.db.memory.roomId.filter(m.roomId))));
export const roomEvents = db.view({ name: "room_events", public: true }, t.array(event.rowType), ctx =>
  Array.from(ctx.db.member.identity.filter(ctx.sender)).flatMap(m => Array.from(ctx.db.event.roomId.filter(m.roomId))));
export const roomMembers = db.view({ name: "room_members", public: true }, t.array(member.rowType), ctx =>
  Array.from(ctx.db.member.identity.filter(ctx.sender)).flatMap(m => Array.from(ctx.db.member.roomId.filter(m.roomId))));

export const workerJobs = db.view({ name: "worker_jobs", public: true }, t.array(job.rowType), ctx =>
  Array.from(ctx.db.worker.iter()).filter(w => w.identity.isEqual(ctx.sender))
    .flatMap(w => Array.from(ctx.db.job.roomId.filter(w.roomId))));

export const workerMemories = db.view({ name: "worker_memories", public: true }, t.array(memory.rowType), ctx => {
  const selected = new Map<string, typeof memory.rowType.type>();
  for (const w of ctx.db.worker.iter()) {
    if (!w.identity.isEqual(ctx.sender)) continue;
    for (const j of ctx.db.job.roomId.filter(w.roomId)) {
      if (j.status !== "running" || !j.assignedTo?.isEqual(ctx.sender)) continue;
      for (const m of ctx.db.memory.residentId.filter(j.residentId)) {
        if (m.roomId === j.roomId && m.branchId === j.branchId) selected.set(m.id, m);
      }
    }
  }
  return Array.from(selected.values());
});

export const init = db.init(ctx => {
  ctx.db.serviceOwner.insert({ id: 0, identity: ctx.sender });
});
function isService(ctx: { sender: Ctx["sender"]; db: {
  serviceOwner: { id: { find(id: number): { identity: Ctx["sender"] } | undefined | null } };
  simulationService: { identity: { find(identity: Ctx["sender"]): unknown } };
} }) {
  return Boolean(ctx.db.serviceOwner.id.find(0)?.identity.isEqual(ctx.sender) || ctx.db.simulationService.identity.find(ctx.sender));
}
function requireService(ctx: Ctx) {
  if (!isService(ctx)) throw new Error("Simulation service access denied.");
}
export const authorizeSimulationService = db.reducer({ identity: t.identity() }, (ctx, { identity }) => {
  if (!ctx.db.serviceOwner.id.find(0)?.identity.isEqual(ctx.sender)) throw new Error("Only the publisher can authorize a service.");
  if (!ctx.db.simulationService.identity.find(identity)) ctx.db.simulationService.insert({ identity });
});
const nowMs = (ctx: Ctx) => ctx.timestamp.microsSinceUnixEpoch / 1000n;
function sessionFor(ctx: Ctx, id: string, owner: string) {
  requireService(ctx);
  const found = ctx.db.simulationSession.id.find(id);
  if (!found || found.owner !== owner || found.expiresAtMs <= nowMs(ctx)) throw new Error("World not found or expired.");
  return found;
}
function parseJson(value: string, limit: number): unknown {
  if (value.length > limit) throw new Error("Simulation payload too large.");
  return JSON.parse(value);
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}
function textField(value: unknown, max = 8000) {
  if (typeof value !== "string") throw new Error("Expected text.");
  return clean(value, max, "Text");
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new Error("Invalid list length.");
  return value;
}
function strings(value: unknown, max = 30) { return list(value, max).map(v => textField(v)); }
function references(value: unknown, known: Set<string>) {
  const ids = strings(value);
  if (ids.some(id => !known.has(id))) throw new Error("Unknown source reference.");
  return JSON.stringify(ids);
}

export const createSimulation = db.reducer({ id: t.string(), owner: t.string(), briefJson: t.string(), populationJson: t.string(), evidenceJson: t.string(), createdAt: t.string() }, (ctx, args) => {
  requireService(ctx);
  if (!/^[a-f0-9-]{36}$/.test(args.id)) throw new Error("Invalid world ID.");
  textField(args.owner, 128); textField(args.createdAt, 64);
  object(parseJson(args.briefJson, 40_000));
  const population = list(parseJson(args.populationJson, 150_000), 30).map(object);
  const evidence = list(parseJson(args.evidenceJson, 200_000), 30).map(object);
  if (!population.length || ctx.db.simulationSession.id.find(args.id)) throw new Error("Invalid or duplicate world.");
  const sourceIds = new Set(evidence.map(e => textField(e.id, 128)));
  if (sourceIds.size !== evidence.length) throw new Error("Duplicate source IDs.");
  ctx.db.simulationSession.insert({ id: args.id, owner: args.owner, briefJson: args.briefJson, createdAt: args.createdAt,
    expiresAtMs: nowMs(ctx) + 86_400_000n, revision: 0, leaseToken: "", leaseUntilMs: 0n });
  for (const e of evidence) {
    const sourceId = textField(e.id, 128);
    ctx.db.simulationSource.insert({ id: `${args.id}:${sourceId}`, sessionId: args.id, sourceId,
      title: textField(e.title, 500), url: textField(e.url, 2048), excerpt: textField(e.excerpt, 20_000) });
  }
  for (const p of population) {
    const actorId = textField(p.id, 128);
    ctx.db.simulationPersona.insert({ id: `${args.id}:${actorId}`, sessionId: args.id, actorId,
      name: textField(p.name, 200), role: textField(p.role, 500), goal: textField(p.goal), background: textField(p.background),
      concernsJson: JSON.stringify(strings(p.concerns)), sourceIdsJson: references(p.sourceIds, sourceIds), assumptionsJson: JSON.stringify(strings(p.assumptions)) });
  }
});
export const claimSimulation = db.reducer({ id: t.string(), owner: t.string(), leaseToken: t.string() }, (ctx, args) => {
  const found = sessionFor(ctx, args.id, args.owner);
  textField(args.leaseToken, 128);
  if (found.leaseUntilMs > nowMs(ctx)) throw new Error("An agent is already working in this world.");
  ctx.db.simulationSession.id.update({ ...found, leaseToken: args.leaseToken, leaseUntilMs: nowMs(ctx) + 180_000n });
});
export const releaseSimulation = db.reducer({ id: t.string(), owner: t.string(), leaseToken: t.string() }, (ctx, args) => {
  const found = sessionFor(ctx, args.id, args.owner);
  if (found.leaseToken === args.leaseToken) ctx.db.simulationSession.id.update({ ...found, leaseToken: "", leaseUntilMs: 0n });
});
export const saveSimulation = db.reducer({ id: t.string(), owner: t.string(), leaseToken: t.string(), expectedRevision: t.u32(), conversationsJson: t.string(), reportJson: t.string() }, (ctx, args) => {
  const found = sessionFor(ctx, args.id, args.owner);
  if (found.leaseToken !== args.leaseToken || found.leaseUntilMs <= nowMs(ctx) || found.revision !== args.expectedRevision)
    throw new Error("The agent lease expired or the world changed; stale result rejected.");
  const conversations = list(parseJson(args.conversationsJson, 1_000_000), 66).map(object);
  const actorIds = new Set(Array.from(ctx.db.simulationPersona.sessionId.filter(args.id), p => p.actorId));
  const sourceIds = new Set(Array.from(ctx.db.simulationSource.sessionId.filter(args.id), s => s.sourceId));
  // Rewrite the bounded transcript atomically. Every message and memory remains
  // independently queryable; no serialized session blob is the source of truth.
  for (const row of ctx.db.simulationConversation.sessionId.filter(args.id)) ctx.db.simulationConversation.id.delete(row.id);
  for (const row of ctx.db.simulationMessage.sessionId.filter(args.id)) ctx.db.simulationMessage.id.delete(row.id);
  const memoryTimes = new Map(Array.from(ctx.db.simulationMemory.sessionId.filter(args.id), m => [m.id, m.observedAtMs]));
  for (const row of ctx.db.simulationMemory.sessionId.filter(args.id)) ctx.db.simulationMemory.id.delete(row.id);
  const conversationIds = new Set<string>();
  for (const c of conversations) {
    const conversationId = textField(c.id, 128);
    if (conversationIds.has(conversationId)) throw new Error("Duplicate conversation ID.");
    conversationIds.add(conversationId);
    const participants = strings(c.participantIds, 2);
    if (participants.length !== 2 || new Set(participants).size !== 2 || participants.some(p => !actorIds.has(p))) throw new Error("Unknown participants.");
    if (!Number.isInteger(c.round) || Number(c.round) < 0 || Number(c.round) > 1000 || c.kind !== "simulated") throw new Error("Invalid conversation metadata.");
    ctx.db.simulationConversation.insert({ id: `${args.id}:${conversationId}`, sessionId: args.id, conversationId,
      title: textField(c.title, 500), participantIdsJson: JSON.stringify(participants), round: Number(c.round), model: textField(c.model, 200), kind: "simulated" });
    list(c.messages, 30).map(object).forEach((m, position) => {
      const actorId = textField(m.actorId, 128);
      if (!participants.includes(actorId)) throw new Error("Message actor is not a participant.");
      ctx.db.simulationMessage.insert({ id: `${args.id}:${conversationId}:message:${position}`, sessionId: args.id,
        conversationId, position, actorId, text: textField(m.text), sourceIdsJson: references(m.sourceIds, sourceIds) });
    });
    list(c.memories, 30).map(object).forEach((m, position) => {
      const agentId = textField(m.agentId, 128);
      const kind = textField(m.kind, 40);
      if (!participants.includes(agentId) || !["observation", "reflection", "user_provided"].includes(kind)) throw new Error("Invalid memory owner or kind.");
      const id = `${args.id}:${conversationId}:memory:${position}`;
      ctx.db.simulationMemory.insert({ id, sessionId: args.id, conversationId, position, agentId,
        text: textField(m.text), kind, sourceIdsJson: references(m.sourceIds, sourceIds), observedAtMs: memoryTimes.get(id) ?? nowMs(ctx) });
    });
  }
  if (args.reportJson) {
    const report = object(parseJson(args.reportJson, 200_000));
    if (report.kind !== "simulated") throw new Error("Reports must disclose simulated origin.");
    for (const finding of list(report.findings, 40).map(object)) {
      references(finding.sourceIds, sourceIds);
      if (strings(finding.conversationIds, 66).some(id => !conversationIds.has(id))) throw new Error("Unknown conversation citation.");
      if (finding.comparisonAgentIds !== undefined && strings(finding.comparisonAgentIds, 12).some(id => !actorIds.has(id))) throw new Error("Unknown comparison resident.");
    }
    const row = { id: args.id, sessionId: args.id, reportJson: args.reportJson };
    if (ctx.db.simulationReport.id.find(args.id)) ctx.db.simulationReport.id.update(row); else ctx.db.simulationReport.insert(row);
  } else ctx.db.simulationReport.id.delete(args.id);
  ctx.db.simulationSession.id.update({ ...found, revision: found.revision + 1, expiresAtMs: nowMs(ctx) + 86_400_000n });
});
export const takeSimulationBudget = db.reducer({ scope: t.string(), limit: t.u32(), seconds: t.u32() }, (ctx, args) => {
  requireService(ctx); textField(args.scope, 256);
  if (!args.limit || args.limit > 10000 || !args.seconds || args.seconds > 86400) throw new Error("Invalid budget.");
  const now = nowMs(ctx);
  const found = ctx.db.requestBudget.scope.find(args.scope);
  if (found && found.expiresAtMs > now && found.count >= args.limit) throw new Error("Request budget exceeded. Please try later.");
  const row = { scope: args.scope, count: found && found.expiresAtMs > now ? found.count + 1 : 1,
    expiresAtMs: found && found.expiresAtMs > now ? found.expiresAtMs : now + BigInt(args.seconds) * 1000n };
  if (found) ctx.db.requestBudget.scope.update(row); else ctx.db.requestBudget.insert(row);
});

// Dedicated service token can query these views; other identities receive no rows.
export const serviceSessions = db.view({ name: "service_sessions", public: true }, t.array(simulationSession.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationSession.iter()) : []);
export const servicePersonas = db.view({ name: "service_personas", public: true }, t.array(simulationPersona.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationPersona.iter()) : []);
export const serviceSources = db.view({ name: "service_sources", public: true }, t.array(simulationSource.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationSource.iter()) : []);
export const serviceConversations = db.view({ name: "service_conversations", public: true }, t.array(simulationConversation.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationConversation.iter()) : []);
export const serviceMessages = db.view({ name: "service_messages", public: true }, t.array(simulationMessage.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationMessage.iter()) : []);
export const serviceMemories = db.view({ name: "service_memories", public: true }, t.array(simulationMemory.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationMemory.iter()) : []);
export const serviceReports = db.view({ name: "service_reports", public: true }, t.array(simulationReport.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationReport.iter()) : []);

/** Artifacts are private, service-authorized and serialized with the world's existing lease. */
export const saveSimulationArtifact = db.reducer({ id: t.string(), owner: t.string(), leaseToken: t.string(), artifactId: t.string(), kind: t.string(), payloadJson: t.string() }, (ctx, args) => {
  const found = sessionFor(ctx, args.id, args.owner);
  if (found.leaseToken !== args.leaseToken || found.leaseUntilMs <= nowMs(ctx)) throw new Error("Artifact lease expired.");
  if (!/^[a-f0-9-]{36}$/.test(args.artifactId) || !["comparison", "outcome"].includes(args.kind)) throw new Error("Invalid artifact.");
  object(parseJson(args.payloadJson, 1_000_000));
  const key = `${args.id}:${args.artifactId}`;
  const existing = ctx.db.simulationArtifact.id.find(key);
  if (existing && existing.kind !== args.kind) throw new Error("Artifact kind mismatch.");
  if (!existing && Array.from(ctx.db.simulationArtifact.sessionId.filter(args.id)).length >= 100) throw new Error("Artifact request limit reached.");
  const row = { id: key, sessionId: args.id, kind: args.kind, payloadJson: args.payloadJson };
  if (existing) ctx.db.simulationArtifact.id.update(row); else ctx.db.simulationArtifact.insert(row);
});
export const serviceArtifacts = db.view({ name: "service_artifacts", public: true }, t.array(simulationArtifact.rowType), ctx => isService(ctx) ? Array.from(ctx.db.simulationArtifact.iter()) : []);

/** Retry-safe capture only: saving a lead never sends email or starts inference. */
export const captureSignup = db.reducer({ requestId: t.string(), owner: t.string(), email: t.string(), mode: t.string(), productUpdates: t.bool() }, (ctx, args) => {
  requireService(ctx);
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  if (!uuid.test(args.requestId) || !uuid.test(args.owner) || args.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(args.email) || !["founder", "policy"].includes(args.mode)) throw new Error("Invalid signup.");
  const existing = ctx.db.signupLead.requestId.find(args.requestId);
  if (existing) {
    if (existing.owner !== args.owner || existing.email !== args.email || existing.mode !== args.mode || existing.productUpdates !== args.productUpdates) throw new Error("Signup request conflict.");
    return;
  }
  const now = nowMs(ctx);
  ctx.db.signupLead.insert({ ...args, consentAtMs: args.productUpdates ? now : 0n, source: "onboarding", createdAtMs: now });
});
export const adminSignups = db.view({ name: "admin_signups", public: true }, t.array(signupLead.rowType), ctx => isService(ctx) ? Array.from(ctx.db.signupLead.iter()) : []);

/** An anonymous browser is counted once; retries of a page event do not increase totals. */
export const recordVisit = db.reducer({ visitorHash: t.string(), eventId: t.string() }, (ctx, args) => {
  requireService(ctx);
  if (!/^[a-f0-9]{64}$/.test(args.visitorHash) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(args.eventId)) throw new Error("Invalid visit.");
  const previous = ctx.db.siteVisitEvent.eventId.find(args.eventId);
  if (previous) {
    if (previous.visitorHash !== args.visitorHash) throw new Error("Visit request conflict.");
    return;
  }
  const now = nowMs(ctx);
  const visitor = ctx.db.siteVisitor.visitorHash.find(args.visitorHash);
  if (visitor) ctx.db.siteVisitor.visitorHash.update({ ...visitor, lastSeenMs: now, visits: visitor.visits + 1 });
  else ctx.db.siteVisitor.insert({ visitorHash: args.visitorHash, firstSeenMs: now, lastSeenMs: now, visits: 1 });
  ctx.db.siteVisitEvent.insert({ ...args, createdAtMs: now });
  const counts = ctx.db.visitorCounts.id.find(0);
  const row = { id: 0, uniqueVisitors: (counts?.uniqueVisitors ?? 0n) + (visitor ? 0n : 1n), pageViews: (counts?.pageViews ?? 0n) + 1n };
  if (counts) ctx.db.visitorCounts.id.update(row); else ctx.db.visitorCounts.insert(row);
});
export const serviceVisitorCounts = db.view({ name: "service_visitor_counts", public: true }, t.array(visitorCounts.rowType), ctx => isService(ctx) ? Array.from(ctx.db.visitorCounts.iter()) : []);
