import type {AgentConversation, AgentPersona} from './types';
export const MAX_CONVERSATIONS = 66;
export const pairKey = (a: string, b: string) => JSON.stringify([a,b].sort());
/** Circle scheduling: everyone meets once per round before any resident starts the next round. */
export function conversationSchedule(ids: string[]): [string,string][] {
  const ring: (string|null)[] = [...ids];
  if (ring.length % 2) ring.push(null);
  const pairs: [string,string][] = [];
  for (let round=0; round<ring.length-1; round++) {
    for (let i=0;i<ring.length/2;i++) {
      const a=ring[i], b=ring[ring.length-1-i];
      if(a!==null && b!==null) pairs.push(round%2 ? [b,a] : [a,b]);
    }
    ring.splice(1,0,ring.pop()!);
  }
  return pairs;
}
export function coverage(population: Pick<AgentPersona,'id'>[], conversations: Pick<AgentConversation,'participantIds'>[]) {
  const schedule = conversationSchedule(population.map(p=>p.id));
  const done = new Set(conversations.map(c=>pairKey(...c.participantIds)));
  const remaining = schedule.filter(pair=>!done.has(pairKey(...pair)));
  return {completed:schedule.length-remaining.length,total:schedule.length,complete:remaining.length===0,nextPair:remaining[0]??null};
}
