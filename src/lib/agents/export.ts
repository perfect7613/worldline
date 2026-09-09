import type {AgentConversation,AgentPersona,AgentReport,SourceEvidence} from './types';
export function simulationJsonl(session:{id:string;brief:unknown;createdAt:string;population:AgentPersona[];evidence:SourceEvidence[];conversations:AgentConversation[];report?:AgentReport}) {
  const records:unknown[]=[{type:'simulation',sessionId:session.id,createdAt:session.createdAt,brief:session.brief,kind:'simulated'}];
  for(const persona of session.population) records.push({type:'persona',...persona});
  for(const source of session.evidence) records.push({type:'source',...source});
  for(const c of session.conversations) {
    records.push({type:'conversation',id:c.id,participantIds:c.participantIds,round:c.round,model:c.model,title:c.title});
    c.messages.forEach((m,position)=>records.push({type:'message',conversationId:c.id,position,...m}));
    c.memories.forEach((m,position)=>records.push({type:'memory',conversationId:c.id,position,...m}));
  }
  if(session.report) records.push({type:'report',...session.report});
  return records.map(record=>JSON.stringify(record)).join('\n')+'\n';
}
