"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ScenarioBrief, ScenarioMode } from "@/game/world-data";
import WorldlineDesk from "./WorldlineDesk";
import { PixelTrackSelector } from "@/components/ui/PixelTrackSelector";
import { AsciiField } from "@/components/ui/AsciiField";
import "./worldline-entry.css";
import { useSiteTools, emptyInput } from "@/lib/webmcp/use-site-tools";
import { VisitorCounter } from "./VisitorCounter";

type Answers = { name: string; url: string; description: string; audience: string; question: string };
const emptyAnswers = (): Answers => ({ name: "", url: "", description: "", audience: "", question: "" });

function PixelPerson({ index, className = "" }: { index: number; className?: string }) {
  return <span aria-hidden="true" className={`entry-person ${className}`} style={{ backgroundImage: `url(/people/person-${String(index).padStart(2, "0")}.png)` }} />;
}

export default function WorldlineEntry() {
  const [mode, setMode] = useState<ScenarioMode>("founder");
  const [stage, setStage] = useState<"landing" | "details" | "questions" | "world">("landing");
  const [drafts, setDrafts] = useState<Record<ScenarioMode, Answers>>({ founder: emptyAnswers(), policy: emptyAnswers() });
  const [brief, setBrief] = useState<ScenarioBrief | null>(null);
  const [error, setError] = useState("");
  const [contactEmail,setContactEmail]=useState("");
  const [saving,setSaving]=useState(false);
  const [signupNotice,setSignupNotice]=useState<string|null>(null);
  const signupRequest=useRef<{email:string;mode:ScenarioMode;id:string}|null>(null);
  const submitting=useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const answers = drafts[mode];
  const policy = mode === "policy";
  function move(next: typeof stage) { setError(""); setStage(next); requestAnimationFrame(() => heading.current?.focus()); }
  function update(field: keyof Answers, value: string) { setDrafts(old => ({ ...old, [mode]: { ...old[mode], [field]: value } })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(submitting.current)return;
    if (stage === "details") {
      try {
        const url = new URL(answers.url.trim());
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
      } catch { setError("Add a full public link, starting with https://, without a username or password."); return; }
      if (!answers.name.trim()) { setError("Give your exploration a name."); return; }
      move("questions"); return;
    }
    if (![answers.description, answers.audience, answers.question].every(value => value.trim())) { setError("Answer all three questions to open your world."); return; }
    submitting.current=true;setSaving(true);setSignupNotice(null);
    if(contactEmail.trim()){
      const email=contactEmail.trim();
      if(signupRequest.current?.email!==email||signupRequest.current.mode!==mode)signupRequest.current={email,mode,id:crypto.randomUUID()};
      try{
        const response=await fetch("/api/signup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,mode,requestId:signupRequest.current.id}),signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error("Signup unavailable");
      }catch{setSignupNotice("Your world is ready, but we couldn't save your signup email.");}
    }
    setBrief({ mode, productName: answers.name.trim(), productUrl: answers.url.trim(), description: answers.description.trim(), constraint: "Long-term exploration; assumptions need review.", audience: answers.audience.trim(), decision: answers.question.trim(), source: "local_form" });
    setStage("world");setSaving(false);submitting.current=false;
  }
  useSiteTools([
    { name: "get_onboarding_state", description: "Read the current onboarding stage, chosen track, and entered answers. No external requests.", inputSchema: emptyInput, annotations: { readOnlyHint: true }, execute: () => ({ stage, mode, answers }) },
    { name: "complete_onboarding", description: "Create a local exploration and open its world after providing all five required answers. Founder means product/GTM; policy means an Indian bill, law or policy. Does not start paid AI calls. Cannot replace an active world; use its new_scenario tool first.", inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["founder", "policy"] }, name: { type: "string", minLength: 1, maxLength: 120 }, url: { type: "string", format: "uri" }, description: { type: "string", minLength: 1, maxLength: 2000 }, audience: { type: "string", minLength: 1, maxLength: 1200 }, question: { type: "string", minLength: 1, maxLength: 2000 } }, required: ["mode", "name", "url", "description", "audience", "question"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: input => {
      if (input.mode !== "founder" && input.mode !== "policy") throw new Error("Choose founder or policy.");
      const next = emptyAnswers();
      for (const [key, max] of [["name", 120], ["url", 2048], ["description", 2000], ["audience", 1200], ["question", 2000]] as const) {
        const value = input[key];
        if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${key} is required and must be at most ${max} characters.`);
        next[key] = value.trim();
      }
      const url = new URL(next.url);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Use an HTTP(S) public URL without credentials.");
      const nextBrief: ScenarioBrief = { mode: input.mode, productName: next.name, productUrl: next.url, description: next.description, audience: next.audience, decision: next.question, constraint: "Long-term exploration; assumptions need review.", source: "local_form" };
      setMode(input.mode); setDrafts(old => ({ ...old, [input.mode as ScenarioMode]: next })); setBrief(nextBrief); setStage("world");
      return { stage: "world", brief: nextBrief, next: "Call get_simulation_state, then start_agents when ready for paid Gemini inference." };
    } },
  ], stage !== "world");
  if (stage === "world" && brief) return <WorldlineDesk initialBrief={brief} onboardingNotice={signupNotice} onRestart={(nextMode) => { if (nextMode) setMode(nextMode); move(nextMode ? "details" : "landing"); }} />;

  return <main className={`worldline-entry ${policy ? "entry-policy" : ""}`}>
    <header className="entry-header">
      <button className="entry-brand" onClick={() => move("landing")} aria-label="Log kya bolenge home"><span className="entry-brand-mark" aria-hidden="true">L</span> Log kya bolenge<span className="entry-brand-dot" aria-hidden="true">✳</span></button>
      <span className="entry-header-note">Big questions. Little people.</span>
      <span className="entry-preview-tag">EARLY PREVIEW</span>
    </header>
    {stage === "landing" ? <>
      <section className="entry-hero">
        <div className="entry-copy">
          <p className="entry-eyebrow"><span /> A LITTLE WORLD FOR YOUR NEXT BIG DECISION</p>
          <h1 ref={heading} tabIndex={-1}>Before the leap,<br />meet the <em>ripple.</em></h1>
          <p className="entry-intro">{policy ? "For teams exploring Indian policy. Bring a hard question. See it through different people’s eyes." : "For founders facing a big decision. Bring a hard question. See it through different people’s eyes."}</p>
          <p className="entry-selector-label">CHOOSE YOUR WORLD <span>01 / 02</span></p>
          <PixelTrackSelector value={mode} onChange={setMode} />
          <button className="entry-primary" onClick={() => move("details")}>Explore {policy ? "a policy" : "your product"}<span aria-hidden="true">↗</span></button>
          <p className="entry-small-note">Your name for it, a link, three questions. No account needed.</p>
          <VisitorCounter />
        </div>
        <div className="entry-illustration" aria-label="Illustration of different people considering one decision">
          <AsciiField />
          <div className="entry-art-heading"><span>LOG KYA BOLENGE</span><span>DIFFERENT PEOPLE. DIFFERENT RIPPLE EFFECTS.</span></div>
          <div className="entry-orbit entry-orbit-one" /><div className="entry-orbit entry-orbit-two" /><span className="entry-art-coordinate" aria-hidden="true">WORLD_0{policy ? "2" : "1"}<br />+ PEOPLE<br />+ POSSIBILITIES</span>
          <div className="entry-decision-card"><span><i aria-hidden="true" /> YOUR BIG QUESTION</span><strong>{policy ? "Who feels the effect\n five years from now?" : "What happens\n after we launch?"}</strong><span className="entry-card-arrow">↗</span></div>
          <div className="entry-person-note entry-note-one"><PixelPerson index={1} /><span>“Would this work for me?”</span></div>
          <div className="entry-person-note entry-note-two"><PixelPerson index={4} /><span>“What changes over time?”</span></div>
          <div className="entry-person-note entry-note-three"><PixelPerson index={9} /><span>“Have you considered…”</span></div>
          <div className="entry-art-foot"><span className="entry-spark">✳</span> One decision. More perspectives.<small>Illustrated conversations, not real people.</small></div>
        </div>
      </section>
      <section className="entry-how" aria-label="How it works"><div><span><b aria-hidden="true">↗</b> 01 / SET THE SCENE</span><h2>Your question comes first.</h2><p>Tell us what you’re building or which policy you want to explore.</p></div><div><span><b aria-hidden="true">☷</b> 02 / MEET THE PEOPLE</span><h2>Follow the conversation.</h2><p>Open a conversation bubble to see what the residents are discussing.</p></div><div><span><b aria-hidden="true">▤</b> 03 / TAKE IT WITH YOU</span><h2>Leave with a clearer brief.</h2><p>Review your question, the example reactions and assumptions in a report.</p></div></section>
      <footer className="entry-footer"><span>Built for questions worth asking.</span><span>Preview: resident reactions are illustrative, not validated forecasts.</span></footer>
    </> : <section className="entry-onboarding">
      <aside className="entry-onboarding-aside"><p className="entry-eyebrow">{policy ? "PUBLIC POLICY" : "PRODUCT & GTM"}</p><h2>A world starts<br />with a <em>question.</em></h2><p>{policy ? "Choose an Indian bill, law or policy. Think beyond the announcement: whose lives could change, and how?" : "Not a perfect pitch. Just your product, the people it’s for, and the decision keeping you up at night."}</p><div className="entry-aside-people"><PixelPerson index={2} /><PixelPerson index={6} /><PixelPerson index={11} /></div><p className="entry-aside-note">Your answers set the context. This preview uses illustrative residents and example reactions, not a prediction of real outcomes.</p></aside>
      <div className="entry-form-area"><div className="entry-form-progress"><span>STEP {stage === "details" ? "1" : "2"} OF 2</span><div className={stage === "questions" ? "is-complete" : ""} /></div>
        <h1 ref={heading} tabIndex={-1}>{stage === "details" ? "First, set the scene." : "Three questions. Your world."}</h1><p className="entry-form-intro">{stage === "details" ? "Give your exploration a name and a source to refer to." : "A few sentences each is plenty. Be specific about what you want to understand."}</p>
        <form onSubmit={submit}>
          {stage === "details" ? <>
            <label className="entry-field">{policy ? "Policy or exploration name" : "Product name"}<input autoFocus required maxLength={120} value={answers.name} onChange={e => update("name", e.target.value)} placeholder={policy ? "e.g. A closer look at the Digital Personal Data Protection Act" : "e.g. My first product"} autoComplete="organization" /></label>
            <label className="entry-field">{policy ? "Official bill or policy link" : "Product URL"}<input required type="url" value={answers.url} onChange={e => update("url", e.target.value)} placeholder={policy ? "https://sansad.in/..." : "https://your-product.com"} autoCapitalize="none" autoCorrect="off" /><small>{policy ? "Use a Parliament, ministry or other official source where possible." : "Your website or a public page explaining your product."} Links are saved as context; this step does not automatically research them.</small></label>
            <label className="entry-field">Your email <small>Optional</small><input type="email" maxLength={254} autoComplete="email" autoCapitalize="none" autoCorrect="off" value={contactEmail} onChange={event=>setContactEmail(event.target.value)} placeholder="you@example.com"/><small>For signup tracking only. Your email stays private and is never shown on the site. This does not send emails.</small></label>
          </> : <>
            <label className="entry-field"><span className="entry-field-number">01</span>{policy ? "Which Indian bill, law or policy are you exploring?" : "What does your product do?"}<textarea autoFocus required maxLength={2000} rows={3} value={answers.description} onChange={e => update("description", e.target.value)} placeholder={policy ? "Describe the proposal or change. If it has passed, include the year and what it changes." : "What problem does it solve, and how does it help?"} /></label>
            <label className="entry-field"><span className="entry-field-number">02</span>{policy ? "Whose lives could it affect?" : "Who is it for?"}<textarea required maxLength={1200} rows={2} value={answers.audience} onChange={e => update("audience", e.target.value)} placeholder={policy ? "Name the groups, locations or communities you want to understand." : "Describe your first customers and the situation they’re in."} /></label>
            <label className="entry-field"><span className="entry-field-number">03</span>{policy ? "What long-term effect do you want to understand?" : "What is your hardest long-term product decision?"}<textarea required maxLength={2000} rows={3} value={answers.question} onChange={e => update("question", e.target.value)} placeholder={policy ? "What might change over the next 1, 5 or 10 years? Include the timeframe you care about." : "What are you unsure about over the next year or beyond — positioning, growth, pricing, or something else?"} /></label>
          </>}
          {error && <p className="entry-error" role="alert">{error}</p>}
          <div className="entry-form-actions"><button type="button" disabled={saving} className="entry-back" onClick={() => move(stage === "details" ? "landing" : "details")}>← Back</button><button type="submit" disabled={saving} className="entry-primary">{saving?"Opening your world…":stage === "details" ? "Three quick questions" : "Open my world"}<span aria-hidden="true">↗</span></button></div>
        </form>
      </div>
    </section>}
  </main>;
}
