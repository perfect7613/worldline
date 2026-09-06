import {loadSession} from '@/lib/server/simulation-store';
import {readOwner,failure,success} from '@/lib/server/simulation-http';
import {coverage} from '@/lib/agents/coverage';
export const runtime='nodejs';
export async function GET(_request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const owner=await readOwner();const {id}=await context.params;const session=await loadSession(id,owner);
    return success({sessionId:id,brief:session.brief,population:session.population,conversations:session.conversations,coverage:coverage(session.population,session.conversations)});
  } catch(error) {return failure(error);}
}
