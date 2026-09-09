import type {AgentReport} from './types';
const label = (value: string) => value.replace(/[\[\]\\]/g, "");
function sourceLink(source: AgentReport["sources"][number]): string {
  try {
    const url = new URL(source.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return label(source.title);
    return `[${label(source.title)}](<${url.href.replace(/>/g, "%3E")}>)`;
  } catch { return label(source.title); }
}
export function reportMarkdown(report: AgentReport): string {
  return [`# ${report.title}`, "", report.summary, "", ...report.findings.flatMap(finding => {
    const sources = finding.sourceIds.map(id => report.sources.find(source => source.id === id)).filter((source): source is AgentReport["sources"][number] => !!source);
    const conversations = finding.conversationIds.map(id => report.conversationReferences?.find(reference => reference.id === id)?.label ?? "Agent discussion");
    return [`## ${finding.title}`, finding.detail,
      `Evidence: ${finding.kind === "simulation_hypothesis" ? "Simulated reaction — not observed behavior" : finding.verification?.status === "supported" ? "Supported by the cited source" : finding.verification?.status === "contradicted" ? "Conflicts with the cited source" : "Insufficient evidence"}`,
      ...(finding.verification ? [finding.verification.reason] : []),
      ...((finding.evidence ?? []).flatMap(item => {
        const source = report.sources.find(source => source.id === item.sourceId);
        return source && source.excerpt.includes(item.quote) ? [`> ${item.quote.replace(/\n/g, "\n> ")}`, sourceLink(source)] : [];
      })),
      `Sources: ${sources.map(sourceLink).join(", ") || "None"}`,
      `Conversations: ${conversations.join(", ") || "None"}`, ...((finding.comparisonAgentIds?.length) ? [`Comparison perspectives: ${finding.comparisonAgentIds.map(id => report.comparison?.results.find(result => result.agentId === id)?.name ?? "Resident assessment").join(", ")}`] : []), ""];
  }), ...(report.comparison ? ["## Original vs. change", `Proposed change: ${report.comparison.change}`, `Status: ${report.comparison.status} (${report.comparison.completed} of ${report.comparison.total} perspectives assessed)`, ...report.comparison.results.flatMap(result => [
    `### ${result.name} — ${result.role}`,
    ...(result.baseline ? [`Original: ${result.baseline.decision}`, `Reason: ${result.baseline.reason}`, `Trade-off: ${result.baseline.tradeoff}`] : ["Original: Assessment pending"]),
    ...(result.changed ? [`With the change: ${result.changed.decision}`, `Reason: ${result.changed.reason}`, `Trade-off: ${result.changed.tradeoff}`] : ["With the change: Assessment pending"]), "",
  ]), report.comparison.disclaimer, ""] : []),
  ...(report.customerResponses?.length ? ["## Customer responses (optional)", "Added by the user; not independently verified. These notes do not establish predictive accuracy.", ...report.customerResponses.map(response => `- ${response.text}`), ""] : []),
  "## Open questions", ...report.uncertainties.map(text => `- ${text}`), "", "## Next steps", ...report.nextSteps.map(text => `- ${text}`), "", "## Sources", ...report.sources.map(source => `- ${sourceLink(source)} — ${source.excerpt}`), "", report.disclaimer, `Model: ${report.model}`].join("\n");
}
export function recipientEmail(input:unknown): string {
  if(typeof input !== 'string') throw new Error('Enter one valid email address.');
  const email=input.trim();
  if(email.length>254 || !/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email) || email.split('@')[0].length>64 || email.startsWith('.') || email.includes('..') || email.includes('.@')) throw new Error('Enter one valid email address.');
  return email;
}
