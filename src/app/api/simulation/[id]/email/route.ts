import {createHash} from 'node:crypto';
import {readOwner,readJson,failure,success} from '@/lib/server/simulation-http';
import {loadSession,takeBudget,ApiError} from '@/lib/server/simulation-store';
import {recipientEmail} from '@/lib/agents/report-markdown';
import {emailReport} from '@/lib/server/report-email';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin) throw new ApiError(403,'Open this action from the app.');
    const owner=await readOwner();const {id}=await context.params;
    const body=await readJson(request);let email:string;
    try {email=recipientEmail(body.email);} catch {throw new ApiError(400,'Enter one valid email address.');}
    const session=await loadSession(id,owner);
    if(!session.report) throw new ApiError(409,'Generate the latest report before emailing it.');
    const recipientHash=createHash('sha256').update(email.toLowerCase()).digest('hex');
    await takeBudget('email:global',100);
    await takeBudget(`email:owner:${owner}`,10);
    await takeBudget(`email:session:${id}`,5,86400);
    await takeBudget(`email:recipient:${recipientHash}`,5,86400);
    return success(await emailReport(id,email,session.report));
  } catch(error) {return failure(error);}
}
