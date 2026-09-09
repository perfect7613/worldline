"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import type {CustomerOutcome} from "@/lib/experiments/types";
import {HudButton} from "@/components/hud/HudButton";

export function CustomerFeedback({sessionId,comparisonId,onSaved}:{sessionId:string;comparisonId?:string;onSaved?:()=>void}){
  const [text,setText]=useState("");const [outcomes,setOutcomes]=useState<CustomerOutcome[]>([]);
  const [busy,setBusy]=useState(false);const [status,setStatus]=useState("");const [error,setError]=useState("");
  const pending=useRef<AbortController|null>(null);const requestId=useRef<string|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch(`/api/simulation/${sessionId}/outcomes`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message||"Could not load customer responses.");if(!controller.signal.aborted)setOutcomes(current=>[...current,...(data.outcomes as CustomerOutcome[]).filter(item=>!current.some(saved=>saved.id===item.id))]);}).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});
    return()=>{controller.abort();pending.current?.abort();};
  },[sessionId]);
  async function save(event:FormEvent){
    event.preventDefault();if(pending.current||!text.trim())return;
    const controller=new AbortController();pending.current=controller;requestId.current??=crypto.randomUUID();setBusy(true);setError("");setStatus("");
    try{
      const response=await fetch(`/api/simulation/${sessionId}/outcomes`,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:text.trim(),requestId:requestId.current,...(comparisonId?{comparisonId}:{})}),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.message||"Could not save the response.");
      if(!controller.signal.aborted){setOutcomes(current=>[data.outcome,...current.filter(item=>item.id!==data.outcome.id)]);setText("");requestId.current=null;setStatus("Saved alongside this exploration. Your original predictions are unchanged.");onSaved?.();}
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Could not save the response.");}
    finally{if(pending.current===controller)pending.current=null;if(!controller.signal.aborted)setBusy(false);}
  }
  return <details className="decision-feedback"><summary><strong>What did real customers say?</strong> · Optional</summary><p className="decision-note">Add a response or experiment result whenever you have one. You can generate, download and email your report without this.</p>
    <form onSubmit={save}><label className="field-block">Customer response or observed result<textarea maxLength={4000} value={text} disabled={busy} onChange={event=>{setText(event.target.value);requestId.current=null;setStatus("");}} placeholder="For example: three customers tried the new offer; one subscribed and two said the price was too high."/></label><HudButton disabled={busy||!text.trim()} type="submit">{busy?"Saving…":"Save response"}</HudButton></form>
    {status&&<p role="status" className="decision-note">{status}</p>}{error&&<p role="alert" className="form-error">{error}</p>}
    {outcomes.map(item=><div className="decision-outcome" key={item.id}><span className="decision-note">Added by you · {new Date(item.createdAt).toLocaleDateString()}</span><p>{item.text}</p></div>)}
    <p className="decision-note">These are user-reported observations, not independently verified results or a calibrated accuracy score.</p>
  </details>;
}
