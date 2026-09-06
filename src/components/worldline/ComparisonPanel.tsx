"use client";
import { useEffect, useRef, useState } from "react";
import type { Comparison } from "@/lib/experiments/types";
import { HudButton } from "@/components/hud/HudButton";
import "./decision-evidence.css";

export function ComparisonPanel({sessionId,onPrepare,disabled=false,onUpdated}: {sessionId:string|null;onPrepare:()=>Promise<string>;disabled?:boolean;onUpdated?:()=>void}) {
  const [change,setChange]=useState("");
  const [comparison,setComparison]=useState<Comparison|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const request=useRef<AbortController|null>(null);
  const stop=useRef(false);
  const creation=useRef<{text:string;id:string}|null>(null);
  useEffect(()=>()=>{stop.current=true;request.current?.abort();},[]);
  useEffect(()=>{
    if(!sessionId || request.current)return;
    const controller=new AbortController();
    void fetch(`/api/simulation/${sessionId}/comparison`,{signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.message || "Could not load comparisons.");
      if(!controller.signal.aborted && !request.current){setComparison(data.comparison);if(data.comparison)setChange(data.comparison.change);}
    }).catch(cause=>{if(!controller.signal.aborted)setError(cause.message);});
    return()=>controller.abort();
  },[sessionId]);
  async function run(resume=false){
    if(request.current || disabled)return;
    const controller=new AbortController();request.current=controller;stop.current=false;setBusy(true);setError("");
    async function post(url:string,body:unknown){
      const response=await fetch(url,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
      const data=await response.json();if(!response.ok)throw new Error(data.message || "Could not complete this comparison.");return data.comparison as Comparison;
    }
    try{
      const id=await onPrepare();
      if(controller.signal.aborted)return;
      let current=comparison;
      if(!resume || !current){
        if(creation.current?.text!==change.trim())creation.current={text:change.trim(),id:crypto.randomUUID()};
        current=await post(`/api/simulation/${id}/comparison`,{change:change.trim(),requestId:creation.current.id});setComparison(current);onUpdated?.();
      }
      while(current.status!=="complete" && !stop.current){
        const next=current.results.find(result=>!result.baseline || !result.changed);
        if(!next)throw new Error("Comparison progress is incomplete. Refresh to reload it.");
        current=await post(`/api/simulation/${id}/comparison/${current.id}/step`,{agentId:next.agentId});
        if(!controller.signal.aborted){setComparison(current);onUpdated?.();}
      }
      if(current.status === "complete")creation.current=null;
    }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Could not finish the comparison.");}
    finally{if(request.current===controller)request.current=null;if(!controller.signal.aborted)setBusy(false);}
  }
  return <div className="decision-comparison">
    <label className="field-block"><span className="hud-label">What would you change?</span><textarea aria-label="Change to compare" maxLength={2000} disabled={busy} value={change} onChange={event=>{setChange(event.target.value);creation.current=null;}} placeholder="For example: offer a free first month, then ₹499 per month."/></label>
    <p className="decision-note">Compare two versions with the same residents, evidence and starting memories. Each resident assesses both independently. Your original discussion is preserved.</p>
    <div className="decision-actions"><HudButton variant="primary" disabled={disabled||busy||!change.trim()} onClick={()=>void run(false)}>{busy?"Comparing perspectives…":"Compare original & change"}</HudButton>
      {busy && <HudButton onClick={()=>{stop.current=true;}}>Pause after this resident</HudButton>}
      {!busy && comparison && comparison.status!=="complete" && <HudButton disabled={disabled} onClick={()=>void run(true)}>Resume saved comparison</HudButton>}
    </div>
    {error&&<p className="form-error" role="alert">{error}</p>}
    {comparison&&<ComparisonResults comparison={comparison}/>}
  </div>;
}

export function ComparisonResults({comparison}:{comparison:Comparison}) {
  return <div aria-live="polite"><p><strong>{comparison.completed} of {comparison.total}</strong> residents compared{comparison.status==="complete"?" · Complete":""}</p>
      <div className="decision-comparison__progress" aria-hidden="true"><span style={{width:`${comparison.total?comparison.completed/comparison.total*100:0}%`}}/></div>
      <p className="decision-note">Change: {comparison.change}</p>
      {comparison.results.filter(result=>result.baseline||result.changed).map(result=><details className="decision-pair" key={result.agentId}><summary><strong>{result.name}</strong> · {result.role}</summary><div className="decision-pair__columns">{([['Original',result.baseline],['With your change',result.changed]] as const).map(([label,assessment])=><div key={label}><small>{label}</small>{assessment?<><p><strong>{assessment.decision}</strong></p><p>{assessment.reason}</p><p className="decision-note">Trade-off: {assessment.tradeoff}</p></>:<p className="decision-note">Waiting for assessment…</p>}</div>)}</div></details>)}
      <p className="decision-note">{comparison.disclaimer}</p>
    </div>;
}
