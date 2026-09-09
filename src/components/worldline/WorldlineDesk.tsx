"use client";

import dynamic from "next/dynamic";
import { useSiteTools, emptyInput } from "@/lib/webmcp/use-site-tools";
import {
  FileDown,
  HelpCircle,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  Share2,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LandmarkReference } from "./LandmarkReference";
import { HudButton } from "@/components/hud/HudButton";
import { HudMeter } from "@/components/hud/HudMeter";
import { HudWindow } from "@/components/hud/HudWindow";
import { GameErrorBoundary } from "@/components/worldline/GameErrorBoundary";
import { ConversationDialog } from "./ConversationDialog";
import type { AgentPersona, AgentConversation, AgentMemory, AgentPopulation } from "@/lib/agents/types";
import type { ResidentConversation } from "@/game/conversation-data";
import { SharedRoomModal } from "@/components/worldline/SharedRoomModal";
import type { ConnectionStatus } from "@/lib/spacetime/client";
import { ResidentPortrait } from "@/components/worldline/ResidentPortrait";
import { ReportDrawer } from "@/components/worldline/ReportDrawer";
import { ComparisonPanel } from "@/components/worldline/ComparisonPanel";
import { loadPeopleArt, type PeopleArtEntry } from "@/game/people-art";
import { createSceneBridge, type SceneBridge } from "@/game/scene-bridge";
import {
  LAUNCH_BUDGET,
  POLICY_BUDGET,
  POLICY_THRESHOLDS,
  RESIDENTS,
  STRATEGY_A,
  STRATEGY_B,
  VOUCHER_AMOUNT,
  policyEligibleCount,
  policyLiability,
  policyShortfall,
  residentById,
  type ActivityItem,
  type ScenarioBrief,
  type ScenarioMode,
  type StrategyPlan,
} from "@/game/world-data";

const GameCanvas = dynamic(() => import("@/components/game/GameCanvas"), {
  ssr: false,
  loading: () => <div className="game-loading retro">Preparing city textures…</div>,
});

type MobileTab = "world" | "overview" | "people" | "actions" | "report";
type Coverage = { completed: number; total: number; complete: boolean };

type InspectorTab = "memories" | "evidence" | "relations";

function MemoryText({ text }: { text: string }) {
  if (text.startsWith("Opinion update: ")) {
    try {
      const opinion: unknown = JSON.parse(text.slice("Opinion update: ".length));
      if (opinion && typeof opinion === "object" && "before" in opinion && "after" in opinion && "reason" in opinion
        && typeof opinion.before === "string" && typeof opinion.after === "string" && typeof opinion.reason === "string") {
        return <><p><strong>Before:</strong> {opinion.before}</p><p><strong>Now:</strong> {opinion.after}</p><p><strong>Why:</strong> {opinion.reason}</p></>;
      }
    } catch { /* Older free-text reflections remain readable. */ }
  }
  return <>{text}</>;
}

export default function WorldlineDesk({ initialBrief, onRestart, onboardingNotice=null }: { initialBrief: ScenarioBrief; onRestart: (mode?: ScenarioMode) => void; onboardingNotice?:string|null }) {
  const [bridge] = useState<SceneBridge>(() => createSceneBridge());
  const [peopleArt, setPeopleArt] = useState<PeopleArtEntry[] | null>(null);
  const [cityReady, setCityReady] = useState(false);
  const [cityError, setCityError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [hidePanels, setHidePanels] = useState(false);
  const [mode] = useState<ScenarioMode>(initialBrief.mode);
  const [brief, setBrief] = useState<ScenarioBrief>(initialBrief);
  const [strategy, setStrategy] = useState<StrategyPlan>(STRATEGY_A);
  const [selectedId, setSelectedId] = useState<string | null>(RESIDENTS[0]?.id ?? null);
  const [activity, setActivity] = useState<ActivityItem[]>([{ id: "welcome", at: Date.now(), actorId: null, kind: "user", text: `Your question is ready: ${initialBrief.decision}` }]);
  const [windows, setWindows] = useState({ brief: true, stream: true, inspector: true, composer: false });
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("memories");
  const [conversation, setConversation] = useState<ResidentConversation | null>(null);
  const [conversations, setConversations] = useState<ResidentConversation[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [comparisonRevision, setComparisonRevision] = useState(0);
  const [toast, setToast] = useState<string | null>(onboardingNotice);
  const [mobileTab, setMobileTab] = useState<MobileTab>("world");
  const [policyThreshold, setPolicyThreshold] = useState<number>(POLICY_THRESHOLDS.amendment);
  const [helpOpen, setHelpOpen] = useState(true);
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [roomOpen, setRoomOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const sessionStorageKey = `lkb-session:${JSON.stringify(initialBrief)}`;
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentError, setAgentError] = useState("");
  const [population, setPopulation] = useState<AgentPersona[]>([]);
  const [agentMemories, setAgentMemories] = useState<AgentMemory[]>([]);
  const [coverage, setCoverage] = useState<Coverage>({ completed: 0, total: 66, complete: false });
  const [runningAll, setRunningAll] = useState(false);
  const [conversationBusy, setConversationBusy] = useState(false);
  const conversationInFlight = useRef(false);
  const requests = useRef(new Set<AbortController>());
  const conversationCache = useRef(new Map<string, ResidentConversation>());
  const starting = useRef(false);
  const names = useMemo(() => Object.fromEntries(population.map(person => [person.id, person.name])), [population]);
  const baseSelected = residentById(selectedId ?? "") ?? RESIDENTS[0];
  const persona = population.find(person => person.id === baseSelected?.id);
  const selected = persona && baseSelected ? { ...baseSelected, ...persona,
    action: "Considering your question with other synthetic residents",
    memories: agentMemories.filter(memory => memory.agentId === persona.id).map((memory, index) => ({ id: String(index), text: memory.text, tag: memory.kind === "reflection" ? "Opinion reflection" : "Generated memory", provenance: memory.sourceIds.length ? `Sources: ${memory.sourceIds.join(", ")}` : "Simulation hypothesis" })),
    evidence: persona.assumptions.map((text, index) => ({id: String(index), label: "Persona assumption", title: "Assumption", excerpt: text})), relations: [],
  } : baseSelected;

  useEffect(() => () => { for (const controller of requests.current) controller.abort(); }, []);

  useEffect(() => {
    const controller = new AbortController(); requests.current.add(controller);
    let saved: string | null = null;
    try { saved = window.sessionStorage.getItem(sessionStorageKey); } catch { /* Browser storage may be disabled. */ }
    if (!saved) { setRestoring(false); requests.current.delete(controller); return; }
    void (async () => {
      try {
        const response = await fetch(`/api/simulation/${encodeURIComponent(saved)}`, { credentials: "same-origin", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Could not restore this simulation.");
        if (controller.signal.aborted) return;
        const history = data.conversations as AgentConversation[];
        setSessionId(data.sessionId); setPopulation(data.population);
        if (data.brief) setBrief(data.brief);
        setCoverage(data.coverage);
        const restored = history.map(item => ({ ...item, mode, kind: "generated" as const }));
        conversationCache.current.clear();
        restored.forEach(item => conversationCache.current.set(item.id, item));
        setConversations(restored.reverse());
        setAgentMemories(history.flatMap(item => item.memories));
        // Restoration never resumes a paid sequence without an explicit click.
        setRunningAll(false);
      } catch (error) {
        if (!controller.signal.aborted) setAgentError(error instanceof Error ? error.message : "Could not restore this simulation.");
      } finally { requests.current.delete(controller); if (!controller.signal.aborted) setRestoring(false); }
    })();
    return () => controller.abort();
  }, [mode, sessionStorageKey]);

  async function startAgents() {
    if (restoring) throw new Error("Checking for an existing simulation. Try again shortly.");
    if (starting.current) throw new Error("Agent creation is already running.");
    if (sessionId) return { sessionId, population };
    starting.current = true;
    setAgentBusy(true); setAgentError("");
    const controller = new AbortController(); requests.current.add(controller);
    try {
      const response = await fetch("/api/simulation", {method: "POST", credentials: "same-origin", headers: {"Content-Type": "application/json"}, body: JSON.stringify({brief}), signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not start Gemini agents.");
      if (controller.signal.aborted) return;
      const people = data.population as AgentPopulation | AgentPersona[];
      setPopulation(Array.isArray(people) ? people : people.agents);
      setSessionId(data.sessionId);
      try { window.sessionStorage.setItem(sessionStorageKey, data.sessionId); } catch { /* The live session still works without browser storage. */ }
      const count = Array.isArray(people) ? people.length : people.agents.length;
      setCoverage({ completed: 0, total: count * (count - 1) / 2, complete: false });
      setAgentMemories([]); setRunningAll(true);
      if (data.brief) setBrief(data.brief);
      setConversations([]); setConversation(null); conversationCache.current.clear();
      setActivity(current => [{id: `agents-${Date.now()}`, at: Date.now(), actorId: null, kind: "simulated", text: "Gemini residents are ready. Run conversations to let every pair discuss your question, remembering earlier discussions."}, ...current]);
      return { sessionId: data.sessionId, population: Array.isArray(people) ? people : people.agents, researchStatus: data.researchStatus };
    } catch (error) { if (!controller.signal.aborted) setAgentError(error instanceof Error ? error.message : "Could not start agents."); throw error; }
    finally { requests.current.delete(controller); starting.current = false; if (!controller.signal.aborted) setAgentBusy(false); }
  }

  const runConversation = useCallback(async (participantIds?: [string, string]) => {
    if (!sessionId) throw new Error("Start Gemini agents first.");
    if (conversationInFlight.current) throw new Error("A conversation is already running.");
    conversationInFlight.current = true; setConversationBusy(true); setAgentError("");
    const controller = new AbortController(); requests.current.add(controller);
    try {
      const response = await fetch(`/api/simulation/${encodeURIComponent(sessionId)}/conversation`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(participantIds ? { participantIds } : {}) }), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not generate this conversation.");
      if (controller.signal.aborted) return;
      if (data.coverage) setCoverage(data.coverage);
      const generated = data.conversation as AgentConversation | null;
      if (!generated) { setRunningAll(false); return { conversation: null, coverage: data.coverage }; }
      const result: ResidentConversation = { ...generated, mode, kind: "generated" };
      const alreadyStored = conversationCache.current.has(result.id);
      conversationCache.current.set(result.id, result);
      setConversations(current => [result, ...current.filter(entry => entry.id !== result.id)]);
      if (!alreadyStored) setAgentMemories(current => [...current, ...generated.memories]);
      setConversation(current => current?.id === result.id ? result : current);
      bridge.send({ type: "showConversation", conversation: result });
      return { conversation: result, coverage: data.coverage };
    } catch (error) {
      if (!controller.signal.aborted) { setAgentError(error instanceof Error ? error.message : "Conversation unavailable"); setRunningAll(false); }
      throw error;
    } finally {
      requests.current.delete(controller); conversationInFlight.current = false;
      if (!controller.signal.aborted) setConversationBusy(false);
    }
  }, [bridge, mode, sessionId]);

  useEffect(() => {
    if (!runningAll || paused || conversationBusy || agentBusy || coverage.complete || !sessionId) return;
    // Yield between pairs so pause takes effect before the next paid request.
    const timer = window.setTimeout(() => { void runConversation().catch(() => {}); }, 500);
    return () => window.clearTimeout(timer);
  }, [runningAll, paused, conversationBusy, agentBusy, coverage.complete, sessionId, runConversation]);


  const beginConversation = useCallback((item: ResidentConversation) => {
    if (!sessionId) setConversations(current => [item, ...current]);
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    void loadPeopleArt().then((art) => {
      if (!cancelled) setPeopleArt(art);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bridge.setListeners({
      onConversation: (item) => setConversation(conversationCache.current.get(item.id) ?? item),
      onConversationStarted: beginConversation,
      onSelectActor: (id) => setSelectedId(id),
      onReady: () => setCityReady(true),
      onError: (message) => setCityError(message),
    });
    return () => bridge.setListeners({});
  }, [bridge, beginConversation]);

  useEffect(() => { bridge.send({type: "setAgentMode", enabled: Boolean(sessionId)}); }, [bridge, sessionId]);

  useEffect(() => {
    bridge.send({ type: "setPaused", paused });
  }, [bridge, paused]);

  useEffect(() => {
    bridge.send({ type: "selectActor", id: selectedId });
  }, [bridge, selectedId]);

  useEffect(() => {
    bridge.send({ type: "setMode", mode });
  }, [bridge, mode]);

  const backendLive = connectionStatus === "live";

  const pushActivity = useCallback((item: Omit<ActivityItem, "id" | "at">) => {
    const next: ActivityItem = { ...item, id: `act-${Date.now()}`, at: Date.now() };
    setActivity((current) => [next, ...current].slice(0, 24));
    bridge.send({
      type: "worldEvent",
      event: { id: next.id, actorId: next.actorId ?? undefined, text: next.text, kind: next.kind },
    });
  }, [bridge]);

  function switchMode(next: ScenarioMode): void {
    if (next !== mode) onRestart(next);
  }

  async function prepareComparison(): Promise<string> {
    if (conversationInFlight.current) throw new Error("Let the current conversation finish, then compare your change.");
    setRunningAll(false); setPaused(true);
    const active = sessionId ? {sessionId} : await startAgents();
    setRunningAll(false);
    if (!active) throw new Error("Could not start the comparison.");
    return active.sessionId;
  }

  async function readWebsite() {
    if (researchBusy) throw new Error("Website capture is already running.");
    if (sessionId) throw new Error("Start a new scenario to change sources after agents have started.");
    setResearchBusy(true); setResearchError("");
    try {
      const response = await fetch("/api/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: brief.productUrl }) });
      const result = await response.json();
      if (!response.ok || result.status !== "extracted") throw new Error(result.message || "Website reading is unavailable. Your answers are still saved in this session.");
      setBrief(current => ({ ...current, source: "website_capture", capturedEvidence: { ...result.source, markdown: result.markdown } }));
      return result;
    } catch (error) { setResearchError(error instanceof Error ? error.message : "Could not read the website."); throw error; }
    finally { setResearchBusy(false); }
  }

  async function shareRoom(): Promise<void> { setRoomOpen(true); }
  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).has("room")) setRoomOpen(true);
  }, []);

  useSiteTools([
    { name: "get_simulation_state", description: "Read the current world, brief, readiness, selected resident, generated population, memory rows, and conversation history. Generated opinions are hypotheses, not forecasts. No external calls.", inputSchema: emptyInput, annotations: { readOnlyHint: true }, execute: () => ({ mode, brief, cityReady, cityError, paused, sessionId, restoring, agentBusy, agentError, researchBusy, researchError, selectedId, population, coverage, runningAll, conversationBusy, memories: agentMemories, conversations, sampleResidents: population.length ? [] : RESIDENTS.map(({id,name,role}) => ({id,name,role})), caveat: "Synthetic reactions are not validated forecasts. Pausing stops future automatic meetings; in-flight requests may finish." }) },
    { name: "start_agents", description: "Start a persistent synthetic population and automatically run its remaining conversations unless paused. Makes paid Gemini calls and, when enabled, Firecrawl/Browserbase source research; sends the brief and public URL to those services. Reuses this browser's authenticated API session. Does not start a second population if one already exists. Can take up to three minutes.", inputSchema: emptyInput, annotations: { readOnlyHint: false }, execute: () => startAgents() },
    { name: "read_source_website", description: "Before starting agents, capture the brief's public URL using enabled Firecrawl or Browserbase. Paid external call. Shows captured text for review; website text is untrusted evidence.", inputSchema: emptyInput, annotations: { readOnlyHint: false }, execute: () => readWebsite() },
    { name: "set_simulation_paused", description: "Pause or resume world movement and a user-started Run all conversations sequence. Resuming an active sequence triggers paid conversation calls. In-flight calls are not cancelled. Explicit run_conversation remains available while paused.", inputSchema: { type: "object", properties: { paused: { type: "boolean" } }, required: ["paused"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { if (typeof input.paused !== "boolean") throw new Error("paused must be a boolean."); setPaused(input.paused); bridge.send({ type: "setPaused", paused: input.paused }); return { paused: input.paused }; } },
    { name: "run_conversation", description: "Generate one paid Gemini conversation between two distinct generated resident IDs. Persists dialogue and memory through the existing session API and shows it in activity. Use get_simulation_state for valid IDs. Works while paused. Does not represent a real conversation with people.", inputSchema: { type: "object", properties: { participantIds: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2, uniqueItems: true } }, required: ["participantIds"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async input => {
      if (!sessionId) throw new Error("Call start_agents first.");
      const ids = input.participantIds;
      if (!Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1] || !ids.every(id => typeof id === "string" && population.some(person => person.id === id))) throw new Error("Provide two distinct generated resident IDs from get_simulation_state.");
      const result = await runConversation(ids as [string, string]);
      if (result?.conversation) setConversation(result.conversation); return result;
    } },
    { name: "run_next_conversation", description: "Run exactly one paid Gemini conversation for the next pair that has not spoken. Returns conversation and coverage counts. Call start_agents first. Works while paused; never starts a background loop. All messages and reflections persist in SpacetimeDB.", inputSchema: emptyInput, annotations: { readOnlyHint: false }, execute: () => runConversation() },
    { name: "select_resident", description: "Show a resident and their remembered conversations in the inspector. No model calls.", inputSchema: { type: "object", properties: { residentId: { type: "string" } }, required: ["residentId"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => { if (typeof input.residentId !== "string" || !RESIDENTS.some(person => person.id === input.residentId)) throw new Error("Unknown resident ID."); setSelectedId(input.residentId); setMobileTab("people"); return { selectedId: input.residentId }; } },
    { name: "new_scenario", description: "Return to onboarding and discard this tab's current local view. The existing server simulation is not deleted. Requires five new onboarding answers before opening another world.", inputSchema: emptyInput, annotations: { readOnlyHint: false }, execute: () => { onRestart(); return { stage: "landing" }; } },
  ]);

  const remaining = LAUNCH_BUDGET - strategy.paidPlacement - strategy.communityWorkshops;
  const eligible = policyEligibleCount(policyThreshold);
  const liability = policyLiability(policyThreshold);
  const shortfall = policyShortfall(policyThreshold);

  const city = peopleArt ? (
    <GameErrorBoundary>
      <GameCanvas
        bridge={bridge}
        peopleArt={peopleArt}
        paused={paused}
        selectedActorId={selectedId}
        scenarioMode={mode}
      />
    </GameErrorBoundary>
  ) : (
    <div className="game-loading retro">Loading resident art…</div>
  );

  return (
    <div className={`hud-root ${cityReady ? "hud-root--reveal-complete" : "hud-root--initializing"}`}>
      {city}
      <div className="hud-vignette" aria-hidden="true" />

      {!cityReady && !cityError ? (
        <div className="boot-cover" role="status">
          <p className="hud-masthead__name retro">Log kya bolenge</p>
          <p className="hud-label">Baking isometric textures…</p>
          <div className="hud-scanline" />
        </div>
      ) : null}
      {cityError ? (
        <div className="boot-cover" role="alert">
          <p className="hud-label">City failed</p>
          <p>{cityError}</p>
        </div>
      ) : null}

      <div className={`hud-layer worldline-desk ${hidePanels ? "is-city-only" : ""} ${mobileTab}`}>
        <header className="desk-top">
          <div className="wordmark">
            <p className="hud-masthead__name retro">Log kya bolenge</p>
            <p className="hud-masthead__sub">Decisions have consequences.</p>
            <div className="segmented" role="tablist" aria-label="Scenario mode">
              <button type="button" role="tab" aria-selected={mode === "founder"} className="hud-button hud-button--sm retro" onClick={() => switchMode("founder")}>
                Founder / GTM
              </button>
              <button type="button" role="tab" aria-selected={mode === "policy"} className="hud-button hud-button--sm retro" onClick={() => switchMode("policy")}>
                Policy
              </button>
            </div>
          </div>
          <div className="sim-lamp">
            <p className="hud-label">
              <span className="hud-dot hud-dot--live" /> {sessionId ? "Gemini agents" : backendLive ? "Database connected · sample world" : "Local sample"}
            </p>
            <p className="retro sim-lamp__seed">
              {sessionId ? "Synthetic population" : "Illustrative world"} · {RESIDENTS.length} residents
            </p>
          </div>
          <div className="desk-top__actions">
            <HudButton variant="outline" size="sm" onClick={() => onRestart(mode)}>
              New scenario
            </HudButton>
            <HudButton variant="outline" size="sm" onClick={() => void shareRoom()}>
              <Share2 className="size-3" aria-hidden="true" /> Shared room
            </HudButton>
          </div>
        </header>

        <LandmarkReference key={mode} mode={mode} />
        <div className="desk-columns">
          <div className={`hud-column desk-left ${mobileTab === "overview" ? "is-active-pane" : ""}`}>
            <HudWindow
              id="case-brief"
              title="Your question"
              hint={brief.source === "fixture" ? "fixture" : "local"}
              expanded={windows.brief}
              onToggle={() => setWindows((current) => ({ ...current, brief: !current.brief }))}
            >
              <p className="hud-masthead__detail">{brief.productName}</p>
              <p className="muted">{sessionId ? "Residents discuss your question automatically, one pair at a time. Pause at any point. These are hypotheses to investigate, not validated forecasts." : "You’re viewing sample dialogue. Start Gemini agents to explore your own question."}</p>
              {!sessionId && <HudButton variant="primary" size="sm" disabled={restoring || agentBusy || !cityReady} onClick={() => void startAgents().catch(() => {})}>{restoring ? "Restoring your simulation…" : agentBusy ? "Creating your residents…" : "Start Gemini agents"}</HudButton>}
              {sessionId && <div className="sample-options">
                <p className="hud-label" role="status">{coverage.completed} / {coverage.total} unique pairs have talked</p>
                <p className="muted">Every resident meets everyone else once. Conversations run one at a time and use earlier memories. This makes paid Gemini calls.</p>
                <HudButton variant="primary" size="sm" disabled={coverage.complete} onClick={() => {
                  if (runningAll && !paused) setPaused(true);
                  else { setRunningAll(true); setPaused(false); }
                }}>{coverage.complete ? "Everyone has talked" : runningAll && !paused ? "Pause conversations" : runningAll ? "Resume conversations" : "Run all conversations"}</HudButton>
                {conversationBusy && <p className="muted" role="status">Two residents are discussing your question…</p>}
                {paused && runningAll && <p className="muted">Paused. The current conversation may finish; the next pair will wait.</p>}
                <a className="linkish" href={`/api/simulation/${encodeURIComponent(sessionId)}/export`} download>Download all messages (JSONL)</a>
              </div>}
              {agentError && <p className="form-error" role="alert">{agentError}</p>}
              <p>{brief.decision}</p>
              {brief.description && <p className="muted">About · {brief.description}</p>}
              <p className="muted">Audience · {brief.audience}</p>
              <p className="muted">Scope · {brief.constraint}</p>
              <p className="evidence-tag">Evidence type: {brief.source === "fixture" ? "Example material" : brief.source === "website_capture" ? "Captured website · review required" : "User-provided brief"}</p>
              {!brief.capturedEvidence && !sessionId && <HudButton size="sm" onClick={() => void readWebsite().catch(() => {})} disabled={researchBusy}>{researchBusy ? "Reading website…" : "Read source website"}</HudButton>}
              {researchError && <p className="form-error" role="alert">{researchError}</p>}
              {brief.capturedEvidence ? <details className="captured-evidence"><summary>Review captured source</summary><a href={brief.capturedEvidence.url} target="_blank" rel="noreferrer">{brief.capturedEvidence.title}</a><p className="muted">Captured {new Date(brief.capturedEvidence.capturedAt).toLocaleString()}</p><pre>{brief.capturedEvidence.markdown}</pre></details> : null}
              <details className="sample-options"><summary>Explore example decisions</summary><p className="muted">These sample numbers show how comparisons work. They are not results for your question.</p>
              {mode === "founder" ? <div className="compare-grid">
                <button type="button" className={`strategy-card ${strategy.id === "A" ? "is-active" : ""}`} onClick={() => setStrategy(STRATEGY_A)}>
                  <span className="hud-label">A baseline</span>
                  <p>{STRATEGY_A.summary}</p>
                  <p className="muted">₹{STRATEGY_A.paidPlacement.toLocaleString("en-IN")} paid · ₹{STRATEGY_A.communityWorkshops.toLocaleString("en-IN")} workshops</p>
                  <p className="assumption">{STRATEGY_A.assumption}</p>
                </button>
                <button type="button" className={`strategy-card ${strategy.id === "B" ? "is-active" : ""}`} onClick={() => setStrategy(STRATEGY_B)}>
                  <span className="hud-label">B alternative</span>
                  <p>{STRATEGY_B.summary}</p>
                  <p className="muted">₹{STRATEGY_B.paidPlacement.toLocaleString("en-IN")} paid · ₹{STRATEGY_B.communityWorkshops.toLocaleString("en-IN")} workshops</p>
                  <p className="assumption">{STRATEGY_B.assumption}</p>
                </button>
              </div> : null}
              {mode === "policy" ? (
                <div className="policy-box">
                  <p className="hud-label">Voucher fixture · computed</p>
                  <p>Budget ₹{POLICY_BUDGET.toLocaleString("en-IN")} · benefit ₹{VOUCHER_AMOUNT.toLocaleString("en-IN")}</p>
                  <div className="segmented">
                    {([
                      ["4 / ≤20k", POLICY_THRESHOLDS.baseline],
                      ["8 / ≤30k", POLICY_THRESHOLDS.amendment],
                      ["12 / ≤45k", POLICY_THRESHOLDS.universal],
                    ] as const).map(([label, value]) => (
                      <HudButton key={value} size="sm" variant={policyThreshold === value ? "primary" : "outline"} onClick={() => setPolicyThreshold(value)}>
                        {label}
                      </HudButton>
                    ))}
                  </div>
                  <p>
                    Eligible {eligible} of {RESIDENTS.length}. Liability ₹{liability.toLocaleString("en-IN")}.
                    {shortfall > 0 ? ` Shortfall ₹${shortfall.toLocaleString("en-IN")} at 12 × ${VOUCHER_AMOUNT}.` : " Feasible under the labeled budget."}
                  </p>
                </div>
              ) : (
                <HudMeter
                  label="Launch budget (assumption)"
                  readout={`₹${remaining.toLocaleString("en-IN")} left of ₹${LAUNCH_BUDGET.toLocaleString("en-IN")}`}
                  value={(remaining / LAUNCH_BUDGET) * 100}
                />
              )}
              </details>
            </HudWindow>

            <HudWindow
              id="stream"
              title="What’s happening"
              hint="activity"
              fill
              expanded={windows.stream}
              onToggle={() => setWindows((current) => ({ ...current, stream: !current.stream }))}
            >
              <p className="muted">Residents pause to chat. Tap a speech cloud in the city, or open a conversation here.</p>
              {conversations.length === 0 && <p className="muted">{sessionId ? "Choose Run all conversations to begin, or run one pair through Codex." : "The first sample conversation will appear shortly."}</p>}
              <ul className="stream-list">
                {conversations.map(item => <li key={item.id}><button className="stream-item" onClick={() => setConversation(item)}><span className="hud-label">{item.kind === "generated" ? "Gemini conversation" : item.kind === "pending" ? "Thinking" : item.kind === "error" ? "Unavailable" : "Sample conversation"}</span><span>{item.title} ↗</span></button></li>)}
                {activity.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="stream-item" onClick={() => item.actorId && setSelectedId(item.actorId)}>
                      <span className="hud-label">{item.kind}</span>
                      <span>{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </HudWindow>
          </div>

          <div className="desk-center" aria-hidden="true" />

          <div className={`hud-column desk-right ${mobileTab === "people" ? "is-active-pane" : ""}`}>
            {selected ? (
              <HudWindow
                id="inspector"
                title="Resident"
                hint={selected.role}
                fill
                expanded={windows.inspector}
                onToggle={() => setWindows((current) => ({ ...current, inspector: !current.inspector }))}
              >
                <div className="hud-masthead">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <ResidentPortrait id={selected.id} large />
                  <div>
                    <p className="hud-masthead__name">{selected.name}</p>
                    <p className="hud-masthead__detail">{selected.role} · {selected.marker}</p>
                  </div>
                </div>
                <p className="hud-label">Goal</p>
                <p>{selected.goal}</p>
                <p className="hud-label">Current action</p>
                <p>{selected.action}</p>
                <div className="segmented" role="tablist" aria-label="Resident records">
                  {(["memories", "evidence", "relations"] as const).map((tab) => (
                    <button key={tab} type="button" role="tab" aria-selected={inspectorTab === tab} className="hud-button hud-button--sm retro" onClick={() => setInspectorTab(tab)}>
                      {tab}
                    </button>
                  ))}
                </div>
                {inspectorTab === "memories" ? (
                  <ul className="plain-list">
                    {selected.memories.map((memory) => (
                      <li key={memory.id}>
                        <span className="evidence-tag">{memory.tag}</span> <MemoryText text={memory.text} />
                        <p className="muted">{memory.provenance}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {inspectorTab === "evidence" ? (
                  <ul className="plain-list">
                    {selected.evidence.map((item) => (
                      <li key={item.id}>
                        <span className="evidence-tag">{item.label}</span> {item.title}: {item.excerpt}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {inspectorTab === "relations" ? (
                  <ul className="plain-list">
                    {selected.relations.map((relation) => (
                      <li key={relation.otherId}>
                        <button type="button" className="linkish" onClick={() => setSelectedId(relation.otherId)}>
                          {residentById(relation.otherId)?.name ?? relation.otherId}
                        </button>
                        {" — "}
                        {relation.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="roster">
                  {RESIDENTS.map((resident) => (
                    <button
                      key={resident.id}
                      type="button"
                      className={`roster-avatar ${selectedId === resident.id ? "is-active" : ""}`}
                      onClick={() => setSelectedId(resident.id)}
                      aria-label={`Select ${names[resident.id] ?? resident.name}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <ResidentPortrait id={resident.id} />
                      <span aria-hidden="true" style={{ color: `#${resident.color.toString(16).padStart(6, "0")}` }}>
                        {resident.marker}
                      </span>
                    </button>
                  ))}
                </div>
              </HudWindow>
            ) : null}
          </div>
        </div>

        <footer className={`desk-bottom ${mobileTab === "report" ? "is-active-pane" : ""}`}>
          <HudWindow
            id="composer"
            title="Try a change"
            hint="side by side"
            expanded={windows.composer}
            onToggle={() => setWindows((current) => ({ ...current, composer: !current.composer }))}
            className="composer-window"
          >
            <ComparisonPanel sessionId={sessionId} onPrepare={prepareComparison} disabled={agentBusy || restoring || conversationBusy} onUpdated={()=>setComparisonRevision(value=>value+1)}/>
            {conversationBusy && <p className="decision-note">Pause the discussion and let the current pair finish before comparing.</p>}
            {agentError && <p role="alert" className="form-error">{agentError}</p>}
          </HudWindow>

          <div className="world-controls">
            <HudButton variant="outline" size="sm" onClick={() => setReportOpen(true)}>
              <FileDown className="size-3" aria-hidden="true" /> Report
            </HudButton>
            <HudButton variant="outline" size="sm" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
              {paused ? <Play className="size-3" aria-hidden="true" /> : <Pause className="size-3" aria-hidden="true" />}
              {paused ? "Resume" : "Pause"}
            </HudButton>
            <HudButton variant="outline" size="sm" aria-pressed={hidePanels} onClick={() => setHidePanels((value) => !value)}>
              {hidePanels ? "Show panels" : "City view"}
            </HudButton>
            <HudButton variant="ghost" size="sm" onClick={() => bridge.send({ type: "camera", action: "zoomOut" })} aria-label="Zoom out">
              <ZoomOut className="size-3" />
            </HudButton>
            <HudButton variant="ghost" size="sm" onClick={() => bridge.send({ type: "camera", action: "zoomIn" })} aria-label="Zoom in">
              <ZoomIn className="size-3" />
            </HudButton>
            <HudButton variant="ghost" size="sm" onClick={() => bridge.send({ type: "camera", action: "reset" })} aria-label="Reset camera">
              <RotateCcw className="size-3" />
            </HudButton>
          </div>
        </footer>

        {helpOpen ? (
          <aside className="help-note hud-caption">
            <HelpCircle className="size-3" aria-hidden="true" />
            Drag to explore · tap a person to meet them · tap a speech cloud to read their conversation.
            <button type="button" className="hud-icon-button" aria-label="Dismiss help" onClick={() => setHelpOpen(false)}>
              ×
            </button>
          </aside>
        ) : null}
      </div>

      <a className="art-credits" href="/people/credits.txt" target="_blank" rel="noreferrer">Art credits</a>
      <nav className="mobile-tabs" aria-label="Panels">
        <HudButton size="sm" variant={mobileTab === "world" ? "primary" : "outline"} onClick={() => {setMobileTab("world");setHidePanels(false);}}>World</HudButton>
        <HudButton size="sm" variant={mobileTab === "overview" ? "primary" : "outline"} onClick={() => setMobileTab("overview")}>
          <MapIcon className="size-3" aria-hidden="true" /> Overview
        </HudButton>
        <HudButton size="sm" variant={mobileTab === "people" ? "primary" : "outline"} onClick={() => setMobileTab("people")}>
          <Users className="size-3" aria-hidden="true" /> People
        </HudButton>
        <HudButton size="sm" variant={mobileTab === "actions" ? "primary" : "outline"} onClick={() => {setMobileTab("actions");setWindows(current=>({...current,composer:true}));}}>Act</HudButton>
        <HudButton size="sm" variant={mobileTab === "report" ? "primary" : "outline"} onClick={() => { setMobileTab("report"); setReportOpen(true); }}>
          Report
        </HudButton>
      </nav>

      {toast ? (
        <div className="toast retro" role="status">
          {toast}
          <HudButton variant="ghost" size="sm" onClick={() => setToast(null)}>
            Dismiss
          </HudButton>
        </div>
      ) : null}

      <SharedRoomModal open={roomOpen} onClose={() => setRoomOpen(false)} onStatus={setConnectionStatus}/>
      <ConversationDialog names={names} conversation={conversation} onClose={() => setConversation(null)} />
      <ReportDrawer
        onOpen={() => setReportOpen(true)}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        brief={brief}
        strategy={strategy}
        backendLive={backendLive}
        policyThreshold={policyThreshold}
        sessionId={sessionId}
        conversationCount={coverage.completed}
        comparisonRevision={comparisonRevision}
        conversations={conversations}
        names={names}
      />

    </div>
  );
}
