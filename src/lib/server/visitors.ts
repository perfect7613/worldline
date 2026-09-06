import "server-only";
import {createHash} from "node:crypto";
import {ApiError} from "./simulation-store";

async function database(path:string,body:string,type:string){
  const uri=process.env.SPACETIMEDB_URI?.replace(/^ws:/,"http:").replace(/^wss:/,"https:").replace(/\/$/,"");
  const name=process.env.SPACETIMEDB_DATABASE,token=process.env.SPACETIMEDB_SERVICE_TOKEN;
  if(!uri||!name||!token)throw new ApiError(503,"Visitor count unavailable.");
  const response=await fetch(`${uri}/v1/database/${encodeURIComponent(name)}/${path}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":type},body,cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new ApiError(503,"Visitor count unavailable.");
  return response;
}
export async function visitorCount(){
  const response=await database("sql","SELECT unique_visitors FROM service_visitor_counts","text/plain");
  const result=await response.json() as {rows:unknown[][]}[];
  const count=Number(result[0]?.rows[0]?.[0]??0);
  if(!Number.isSafeInteger(count)||count<0)throw new ApiError(503,"Visitor count unavailable.");
  return count;
}
export async function recordVisitor(visitorId:string,eventId:string){
  const hash=createHash("sha256").update(`lkb-visitor:${visitorId}`).digest("hex");
  await database("call/record_visit",JSON.stringify([hash,eventId]),"application/json");
}
