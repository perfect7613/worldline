import type { ScenarioMode, WorldEvent } from "@/game/world-data";

import type { ResidentConversation } from "./conversation-data";

export type CameraAction = "zoomIn" | "zoomOut" | "reset";

export type SceneCommand =
  | { type: "setPaused"; paused: boolean }
  | { type: "setAgentMode"; enabled: boolean }
  | { type: "showConversation"; conversation: ResidentConversation }
  | { type: "resolveConversation"; conversation: ResidentConversation }
  | { type: "selectActor"; id: string | null }
  | { type: "setMode"; mode: ScenarioMode }
  | { type: "worldEvent"; event: WorldEvent }
  | { type: "camera"; action: CameraAction };

export type SceneListener = {
  onSelectActor?: (id: string | null) => void;
  onReady?: () => void;
  onConversation?: (conversation: ResidentConversation) => void;
  onConversationStarted?: (conversation: ResidentConversation) => void;
  onError?: (message: string) => void;
};

export class SceneBridge {
  private commands: Array<(command: SceneCommand) => void> = [];
  private mode: ScenarioMode | undefined;
  private listeners: SceneListener = {};

  attach(handler: (command: SceneCommand) => void): () => void {
    this.commands.push(handler);
    if (this.mode) handler({ type: "setMode", mode: this.mode });
    return () => {
      this.commands = this.commands.filter((item) => item !== handler);
    };
  }

  setListeners(listeners: SceneListener): void {
    this.listeners = listeners;
  }

  send(command: SceneCommand): void {
    if (command.type === "setMode") this.mode = command.mode;
    for (const handler of this.commands) handler(command);
  }

  selectActor(id: string | null): void {
    this.listeners.onSelectActor?.(id);
  }

  conversation(conversation: ResidentConversation): void {
    this.listeners.onConversation?.(conversation);
  }

  conversationStarted(conversation: ResidentConversation): void {
    this.listeners.onConversationStarted?.(conversation);
  }

  ready(): void {
    this.listeners.onReady?.();
  }

  error(message: string): void {
    this.listeners.onError?.(message);
  }
}

export function createSceneBridge(): SceneBridge {
  return new SceneBridge();
}
