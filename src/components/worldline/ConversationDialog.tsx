"use client";
import { useCallback, useRef } from "react";
import type { ResidentConversation } from "@/game/conversation-data";
import { residentById } from "@/game/world-data";
import { ResidentPortrait } from "./ResidentPortrait";
import { useFocusTrap } from "./useFocusTrap";

export function ConversationDialog({ conversation, onClose, names = {} }: { conversation: ResidentConversation | null; onClose: () => void; names?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(onClose, [onClose]);
  useFocusTrap(Boolean(conversation), ref, close);
  if (!conversation) return null;
  return <div className="shared-modal-backdrop" onClick={close}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby="conversation-title" className="conversation-dialog hud-window" onClick={event => event.stopPropagation()}>
      <header><span className="hud-label">Overheard in the city</span><button className="hud-button hud-button--sm" onClick={close}>Close</button></header>
      <h2 id="conversation-title">{conversation.title}</h2>
      <p className="muted">{conversation.kind === "generated" ? "Gemini-generated discussion · synthetic perspectives, not measured public opinion." : conversation.kind === "pending" ? "The residents are considering your question. Their conversation will appear here." : conversation.kind === "error" ? "This conversation could not be generated. No sample dialogue has been substituted." : "Sample dialogue · a demonstration, not a prediction about your product or policy."}</p>
      <ol>{conversation.messages.map((message, index) => <li key={index}>
        <ResidentPortrait id={message.actorId} />
        <div><strong>{names[message.actorId] ?? residentById(message.actorId)?.name ?? "Resident"}</strong><p>{message.text}</p></div>
      </li>)}</ol>
    </section>
  </div>;
}
