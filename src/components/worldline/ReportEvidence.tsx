import type { AgentReport, ReportFinding } from "@/lib/agents/types";
import "./decision-evidence.css";

export type ReportTranscript = { id: string; title: string; messages: {actorId: string; text: string}[] };
export function evidenceUrl(value: string, quote?: string): string | undefined {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return;
    if (quote) url.hash = `:~:text=${encodeURIComponent(quote)}`;
    return url.href;
  } catch { return; }
}
export function ReportEvidence({finding,report,conversations,names,index}: {finding:ReportFinding;report:AgentReport;conversations:ReportTranscript[];names:Record<string,string>;index:number}) {
  const verified = finding.verification?.status === "supported";
  const label = finding.kind === "simulation_hypothesis" ? "Simulated perspective" : verified ? "Source checked" : "Needs evidence";
  return <section className="decision-finding">
    <div className="decision-finding__eyebrow"><span>{String(index+1).padStart(2,"0")}</span><span className={`decision-badge ${verified ? "is-supported" : ""}`}>{label}</span></div>
    <h3>{finding.title}</h3><p>{finding.detail}</p>
    {finding.verification && <p className="decision-note">{finding.verification.status === "contradicted" ? "Source conflict: " : "Evidence check: "}{finding.verification.reason}</p>}
    {finding.sourceIds.map(id => {
      const source = report.sources.find(s=>s.id===id);
      if (!source) return null;
      const quotes = (finding.evidence ?? []).filter(item=>item.sourceId===id && source.excerpt.includes(item.quote) && item.quote.trim());
      const href = evidenceUrl(source.url,quotes[0]?.quote);
      return <div className="decision-source" key={id}>
        {href ? <a href={href} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a> : <strong>{source.title}</strong>}
        {quotes.map((item,i)=><blockquote key={i}>{item.quote}</blockquote>)}
        {!quotes.length && <p className="decision-note">Referenced source; no exact supporting passage confirmed.</p>}
      </div>;
    })}
    {!!finding.conversationIds.length && <div className="decision-discussions"><p className="hud-label">Inside the discussion</p>{finding.conversationIds.map((id,i)=>{
      const conversation = conversations.find(c=>c.id===id);
      const label = report.conversationReferences?.find(c=>c.id===id)?.label || conversation?.title || `Conversation ${i+1}`;
      return <details key={id} className="decision-transcript"><summary>{label}</summary>{conversation ? conversation.messages.map((message,j)=><div className="decision-message" key={j}><strong>{names[message.actorId] || "Resident"}</strong><p>{message.text}</p></div>) : <p className="decision-note">This conversation is not available in the current view.</p>}</details>;
    })}</div>}
    {!!finding.comparisonAgentIds?.length && <div className="decision-discussions"><p className="hud-label">Compared perspectives</p>{finding.comparisonAgentIds.map(id=>{
      const result=report.comparison?.results.find(row=>row.agentId===id);
      if(!result)return null;
      return <details key={id} className="decision-transcript"><summary>{result.name} · Original & change</summary><div className="decision-pair__columns">{([['Original',result.baseline],['With your change',result.changed]] as const).map(([label,assessment])=><div key={label}><small>{label}</small>{assessment&&<><p><strong>{assessment.decision}</strong></p><p>{assessment.reason}</p><p className="decision-note">Trade-off: {assessment.tradeoff}</p></>}</div>)}</div></details>;
    })}</div>}
  </section>;
}
