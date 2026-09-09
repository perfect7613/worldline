"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSiteTools, emptyInput } from "@/lib/webmcp/use-site-tools";
import { reportMarkdown as agentMarkdown } from "@/lib/agents/report-markdown";
import type { AgentReport } from "@/lib/agents/types";
import { ReportEvidence, evidenceUrl, type ReportTranscript } from "./ReportEvidence";
import { CustomerFeedback } from "./CustomerFeedback";
import { ComparisonResults } from "./ComparisonPanel";
import { HudButton } from "@/components/hud/HudButton";
import { useFocusTrap } from "@/components/worldline/useFocusTrap";
import { OBJECTION_MAP, POLICY_BUDGET, RESIDENTS, VOUCHER_AMOUNT, policyEligibleCount, policyLiability, policyShortfall, type ScenarioBrief, type StrategyPlan } from "@/game/world-data";

export interface ReportDrawerProps {
  open: boolean; onClose: () => void; brief: ScenarioBrief; strategy: StrategyPlan;
  backendLive: boolean; policyThreshold: number; sessionId?: string | null; conversationCount?: number; onOpen?: () => void;
  conversations?: ReportTranscript[]; names?: Record<string,string>; comparisonRevision?:number;
}

export function buildMarkdown(brief: ScenarioBrief, strategy: StrategyPlan, threshold: number): string {
  const options = brief.mode === "founder" ? [
    `## Launch comparison`, `Active strategy ${strategy.id}: ${strategy.name}`, strategy.summary,
    `Paid placement ₹${strategy.paidPlacement.toLocaleString("en-IN")} · workshops ₹${strategy.communityWorkshops.toLocaleString("en-IN")}`,
    `Assumption: ${strategy.assumption}`, ``, `## Objection map (illustrative examples)`,
    ...OBJECTION_MAP.flatMap(row => [`### ${row.claim}`,`- Exposure: ${row.exposure}`,`- Interpretation: ${row.interpretation}`,`- Objection: ${row.objection}`,`- Lineage: ${row.lineage}`,``]),
    `## Next customer experiment`, `Interview three people in the stated audience using the current offer and an alternative. Record their own words and measure comprehension. These sample reactions do not establish demand.`,
  ] : [
    `## Example voucher proposal (deterministic fixture)`,
    `- Monthly income threshold: ₹${threshold.toLocaleString("en-IN")}`,
    `- Eligible households: ${policyEligibleCount(threshold)} of ${RESIDENTS.length}`,
    `- Voucher per household: ₹${VOUCHER_AMOUNT.toLocaleString("en-IN")}`,
    `- Proposed liability: ₹${policyLiability(threshold).toLocaleString("en-IN")}`,
    `- Available budget: ₹${POLICY_BUDGET.toLocaleString("en-IN")}`,
    `- Shortfall: ₹${policyShortfall(threshold).toLocaleString("en-IN")}`,
    `- Feasibility: ${policyShortfall(threshold) ? "Over budget; proposal needs revision." : "Within the fixture budget."}`,
    ``, `## Next investigation`, `Validate the household distribution and delivery costs with actual administrative data. Discuss exclusion and implementation questions with affected stakeholders. The twelve example households are not a population estimate.`,
  ];
  const source = brief.capturedEvidence ? [
    `## Captured website`, `[${brief.capturedEvidence.title}](${brief.capturedEvidence.url})`,
    `Captured: ${brief.capturedEvidence.capturedAt}. Review required; website claims are not independent validation.`,
    ``, brief.capturedEvidence.markdown,
  ] : [`## Evidence`, brief.source === "fixture" ? `Example material supplied with this local scenario. No website capture.` : `User-provided brief only. No website capture.`];
  return [`# Log kya bolenge decision snapshot`,``,`Local snapshot. Synthetic residents and sample behavior are illustrative; this report is not a saved shared-room report.`,``,`## Decision`,brief.decision,``,`- Description: ${brief.description ?? brief.constraint}`,`- Audience: ${brief.audience}`,`- Constraint: ${brief.constraint}`,`- Product or proposal: ${brief.productName} (${brief.productUrl})`,`- Mode: ${brief.mode}`,``,...options,``,...source,``,`## Limitations`,`- Example behavior is not model inference or a validated forecast.`,`- Shared-room notes are separate and are not included in this local report.`,`- This sample snapshot is download-only. Generate an AI report to email it to yourself.`,``].join("\n");
}


export function ReportDrawer({open,onClose,brief,strategy,backendLive,policyThreshold,sessionId,conversationCount=0,onOpen,conversations=[],names={},comparisonRevision=0}:ReportDrawerProps) {
  const panelRef=useRef<HTMLDivElement>(null);
  const close=useCallback(()=>onClose(),[onClose]);
  useFocusTrap(open,panelRef,close);
  const [agentReport, setAgentReport] = useState<AgentReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailTesting, setEmailTesting] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/status", {signal:controller.signal}).then(r=>r.json()).then(data=>setEmailTesting(data.emailMode === "testing")).catch(()=>{});
    return ()=>controller.abort();
  }, []);
  const [email, setEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const [emailError, setEmailError] = useState("");
  const emailRequest = useRef<AbortController | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    emailRequest.current?.abort(); emailRequest.current = null;
    setEmailBusy(false); setEmailStatus(""); setEmailError("");
    return () => emailRequest.current?.abort();
  }, [sessionId, agentReport]);
  useEffect(() => {
    request.current?.abort(); request.current = null;
    setAgentReport(null); setBusy(false); setError("");
    return () => request.current?.abort();
  }, [sessionId, conversationCount, comparisonRevision]);
  async function emailReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionId || !agentReport || emailRequest.current) return;
    const controller = new AbortController(); emailRequest.current = controller;
    setEmailBusy(true); setEmailStatus(""); setEmailError("");
    try {
      const response = await fetch(`/api/simulation/${encodeURIComponent(sessionId)}/email`, {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not email your report. Please try again.");
      if (data.status !== "accepted") throw new Error("The email request could not be confirmed. Please try again.");
      if (!controller.signal.aborted) setEmailStatus("Report email accepted for sending. Check your inbox and spam folder.");
    } catch (cause) {
      if (!controller.signal.aborted) setEmailError(cause instanceof Error ? cause.message : "Could not email your report. Please try again.");
    } finally {
      if (emailRequest.current === controller) emailRequest.current = null;
      if (!controller.signal.aborted) setEmailBusy(false);
    }
  }
  async function generateReport() {
    if (!sessionId) throw new Error("Start agents and generate conversations first.");
    if (request.current) throw new Error("Report generation is already running.");
    setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch(`/api/simulation/${encodeURIComponent(sessionId)}/report`, {method: "POST", credentials: "same-origin", signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create your report.");
      if (!controller.signal.aborted) setAgentReport(data.report);
      return data.report as AgentReport;
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not create your report."); throw cause; }
    finally { if (request.current === controller) request.current = null; if (!controller.signal.aborted) setBusy(false); }
  }
  useSiteTools([
    { name: "get_decision_report", description: "Read the most recently generated report and its Markdown in this tab, or the labeled sample snapshot if agents have not started. Does not make a paid call.", inputSchema: emptyInput, annotations: { readOnlyHint: true }, execute: () => ({ report: agentReport, markdown: agentReport ? agentMarkdown(agentReport) : sessionId ? null : buildMarkdown(brief, strategy, policyThreshold), busy, error }) },
    { name: "generate_decision_report", description: "Make a paid Gemini synthesis of the current simulation's conversations and sources, persist the report, and open it for review. Findings remain synthetic hypotheses unless backed by cited sources. Start agents and run conversations first.", inputSchema: emptyInput, annotations: { readOnlyHint: false }, execute: async () => { onOpen?.(); const report = await generateReport(); return { report, markdown: agentMarkdown(report) }; } },
  ]);
  if(!open)return null;
  function download(){
    const href=URL.createObjectURL(new Blob([agentReport ? agentMarkdown(agentReport) : buildMarkdown(brief,strategy,policyThreshold)],{type:"text/markdown;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=href;anchor.download="log-kya-bolenge-report.md";anchor.click();URL.revokeObjectURL(href);
  }
  if (sessionId) return <div className="modal-backdrop" role="presentation"><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="agent-report-title" className="hud-window hud-window--modal report-drawer">
    <header className="hud-window__bar"><h2 id="agent-report-title" className="hud-window__title retro">Decision report</h2><HudButton size="sm" onClick={onClose}>Close</HudButton></header>
    <div className="hud-window__body report-drawer__body">
      <p className="hud-label">Gemini synthesis</p><p>{brief.decision}</p>
      <p className="muted">Summarize the generated conversations and separate source-backed findings from hypotheses.</p>
      <HudButton variant="primary" disabled={busy} onClick={() => void generateReport().catch(() => {})}>{busy ? "Writing your report…" : agentReport ? "Update report" : "Generate report"}</HudButton>
      {error && <p className="form-error" role="alert">{error}</p>}
      {agentReport && <><h3>{agentReport.title}</h3><p>{agentReport.summary}</p>
        {agentReport.comparison && <section className="decision-finding"><h3>Original & your change</h3><ComparisonResults comparison={agentReport.comparison}/></section>}
        {agentReport.findings.map((finding, index) => <ReportEvidence key={index} finding={finding} report={agentReport} conversations={conversations} names={names} index={index}/>)}
        <h3>Still uncertain</h3><ul>{agentReport.uncertainties.map((text, index) => <li key={index}>{text}</li>)}</ul>
        <h3>What to do next</h3><ul>{agentReport.nextSteps.map((text, index) => <li key={index}>{text}</li>)}</ul>
        <h3>Sources</h3>{agentReport.sources.map(source => <details className="decision-transcript" key={source.id}><summary>{source.title}</summary>{evidenceUrl(source.url)&&<a href={evidenceUrl(source.url)} target="_blank" rel="noreferrer">Open original source ↗</a>}<p>{source.excerpt}</p></details>)}
        <p className="muted">{agentReport.disclaimer}</p><HudButton variant="primary" onClick={download}>Download report</HudButton>
        <form onSubmit={emailReport} aria-label="Email your decision report" aria-busy={emailBusy}>
          <h3>Keep a copy in your inbox</h3>
          <label className="entry-field">Email address<input type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" autoCorrect="off" value={email} disabled={emailBusy} onChange={event => { setEmail(event.target.value); setEmailStatus(""); setEmailError(""); }} placeholder="you@example.com" /></label>
          <p className="muted">{emailTesting ? "Email is in test mode. Use the email address associated with the Resend account." : "Send this report to your email address."}</p>
          <HudButton type="submit" variant="primary" disabled={emailBusy || busy}>{emailBusy ? "Sending report…" : "Email report"}</HudButton>
          {emailStatus && <p role="status">{emailStatus}</p>}
          {emailError && <p className="form-error" role="alert">{emailError}</p>}
        </form></>}
      {brief.mode === "founder" && <CustomerFeedback key={sessionId} sessionId={sessionId} comparisonId={agentReport?.comparison?.id} onSaved={()=>{if(agentReport)void generateReport().catch(()=>{});}}/>}
    </div></div></div>;
  return <div className="modal-backdrop" role="presentation"><div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="report-title" className="hud-window hud-window--modal report-drawer">
    <span aria-hidden="true" className="hud-window__frame"/>
    <header className="hud-window__bar"><span aria-hidden="true" className="hud-window__tick"/><h2 id="report-title" className="hud-window__title retro">Decision report</h2><span className="hud-window__hint">local snapshot</span><span className="hud-window__leader"/><HudButton variant="ghost" size="sm" onClick={onClose} aria-label="Close report">Close</HudButton></header>
    <div className="hud-window__body report-drawer__body">
      <p className="hud-label">Decision</p><p>{brief.decision}</p>
      {brief.mode==="founder" ? <><p className="hud-label">Example launch comparison</p><p>{strategy.name}. {strategy.summary}</p><p className="muted">{strategy.assumption}</p><p className="hud-label">Example objection map</p><ul className="plain-list">{OBJECTION_MAP.map(row=><li key={row.claim}><strong>{row.claim}</strong><p>{row.objection}</p><p className="muted">{row.lineage}</p></li>)}</ul><p className="hud-label">Next customer experiment</p><p>Compare the two offer sentences with three people in your audience. Record their words and check what they understood.</p></> : <><p className="hud-label">Example voucher proposal</p><p>Income threshold ₹{policyThreshold.toLocaleString("en-IN")} · {policyEligibleCount(policyThreshold)} eligible households</p><p>₹{policyLiability(policyThreshold).toLocaleString("en-IN")} liability against ₹{POLICY_BUDGET.toLocaleString("en-IN")} available.</p><p className={policyShortfall(policyThreshold)?"form-error":"muted"}>{policyShortfall(policyThreshold)?`₹${policyShortfall(policyThreshold).toLocaleString("en-IN")} shortfall. Revise this proposal before implementation.`:"Within the example budget."}</p><p className="hud-label">Next investigation</p><p>Validate household distribution and delivery costs using actual data. Discuss exclusion and implementation questions with affected stakeholders.</p></>}
      <p className="hud-label">Evidence</p>{brief.capturedEvidence?<><a href={brief.capturedEvidence.url} target="_blank" rel="noreferrer">{brief.capturedEvidence.title}</a><p className="muted">Website captured {new Date(brief.capturedEvidence.capturedAt).toLocaleString()}; review required. Full capture is included in the download.</p></>:<p>{brief.source==="fixture"?"Illustrative example material.":"Your supplied brief."} No website capture in this snapshot.</p>}
      <p className="hud-label">Scope</p><p>{RESIDENTS.length} synthetic residents. Sample reactions are not a validated prediction.{backendLive?" Your database is connected; shared-room notes remain separate from this local report.":" Shared-room notes are not included."}</p>
      <HudButton variant="primary" onClick={download}>Download report</HudButton><p className="muted">Start AI agents and generate a report to email it to yourself.</p>
    </div>
  </div></div>;
}
