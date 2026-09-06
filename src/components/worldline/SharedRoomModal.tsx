"use client";
import { useRef } from "react";
import { SharedRoomPanel } from "@/components/worldline/SharedRoomPanel";
import { useFocusTrap } from "@/components/worldline/useFocusTrap";
import { HudButton } from "@/components/hud/HudButton";
import type { ConnectionStatus } from "@/lib/spacetime/client";

export function SharedRoomModal({open,onClose,onStatus}:{open:boolean;onClose:()=>void;onStatus:(status:ConnectionStatus)=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  useFocusTrap(open,ref,onClose);
  return <div className="shared-modal-backdrop" hidden={!open}>
    <div ref={ref} className="shared-modal" role="dialog" aria-modal="true" aria-label="Shared team memory">
      <HudButton className="shared-modal-close" size="sm" variant="outline" onClick={onClose}>Back to world</HudButton>
      <SharedRoomPanel onConnectionChange={onStatus}/>
    </div>
  </div>;
}
