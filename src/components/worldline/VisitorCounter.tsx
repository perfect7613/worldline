"use client";
import {useEffect,useRef,useState} from "react";

export function VisitorCounter(){
  const [count,setCount]=useState<number|null>(null);
  const visit=useRef<{visitorId:string;eventId:string}|null>(null);
  useEffect(()=>{
    if(!visit.current){
      let visitorId=crypto.randomUUID();
      try{
        const saved=localStorage.getItem("lkb-visitor");
        if(saved&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved))visitorId=saved as `${string}-${string}-${string}-${string}-${string}`;
        else localStorage.setItem("lkb-visitor",visitorId);
      }catch{/* Storage-disabled browsers are counted for this page only. */}
      visit.current={visitorId,eventId:crypto.randomUUID()};
    }
    const controller=new AbortController();
    async function track(){
      try{
        let response=await fetch("/api/visitors",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(visit.current),signal:controller.signal});
        if(!response.ok)response=await fetch("/api/visitors",{signal:controller.signal});
        if(!response.ok)return;
        const data=await response.json();
        if(!controller.signal.aborted&&Number.isSafeInteger(data.count)&&data.count>=0)setCount(data.count);
      }catch{/* Analytics must never interrupt onboarding. */}
    }
    void track();return()=>controller.abort();
  },[]);
  return <span className="entry-visitor-count" title="Distinct browsers counted since tracking began. Clearing browser storage or changing devices may count again."><span aria-hidden="true">▪</span> <strong>{count===null?"—":count.toLocaleString("en-IN")}</strong> {count===1?"visitor":"visitors"}</span>;
}
