import {createHash} from "node:crypto";
import {recordVisitor,visitorCount} from "@/lib/server/visitors";
import {ApiError,takeBudget} from "@/lib/server/simulation-store";
import {failure,readJson,success} from "@/lib/server/simulation-http";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(){
  try{return Response.json({count:await visitorCount()},{headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=60"}});}catch(error){return failure(error);}
}
export async function POST(request:Request){
  try{
    const url=new URL(request.url);
    if(request.headers.get("origin")!==url.origin)throw new ApiError(403,"Open this action from the app.");
    const body=await readJson(request);
    if(typeof body.visitorId!=="string"||!uuid.test(body.visitorId)||typeof body.eventId!=="string"||!uuid.test(body.eventId))throw new ApiError(400,"Invalid visit reference.");
    // Local development and preview deployments must not inflate the public total.
    const production=process.env.VERCEL_ENV==="production"&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if(production){
      const ip=request.headers.get("x-vercel-forwarded-for")??request.headers.get("x-real-ip")??"unknown";
      const scope=createHash("sha256").update(ip).digest("hex").slice(0,24);
      await takeBudget(`visitors:ip:${scope}`,120);
      await takeBudget("visitors:global",10000);
      await recordVisitor(body.visitorId,body.eventId);
    }
    return success({count:await visitorCount()});
  }catch(error){return failure(error);}
}
