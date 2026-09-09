import {loadSession,loadArtifacts} from '@/lib/server/simulation-store';
import {publicComparison} from '@/lib/experiments/comparison';
import type {StoredComparison,CustomerOutcome} from '@/lib/experiments/types';
import {readOwner,failure} from '@/lib/server/simulation-http';
import {simulationJsonl} from '@/lib/agents/export';
export const runtime='nodejs';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const owner=await readOwner();const {id}=await context.params;const session=await loadSession(id,owner);
    const [comparisons,outcomes]=await Promise.all([loadArtifacts<StoredComparison>(id,owner,'comparison'),loadArtifacts<CustomerOutcome>(id,owner,'outcome')]);
    const extra=[...comparisons.map(item=>({type:'comparison',...publicComparison(item)})),...outcomes.map(item=>({type:'customer_response',...item}))].map(item=>JSON.stringify(item)).join('\n');
    return new Response(simulationJsonl(session)+(extra?extra+'\n':''),{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':`attachment; filename="log-kya-bolenge-${id}.jsonl"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch(error) {return failure(error);}
}
