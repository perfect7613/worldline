"use client";

import { useEffect, useRef } from "react";
import * as Phaser from "phaser";

import { WorldlineScene, type WorldlineSceneData } from "@/game/WorldlineScene";
import type { PeopleArtEntry } from "@/game/people-art";
import type { SceneBridge } from "@/game/scene-bridge";
import type { ScenarioMode } from "@/game/world-data";

export interface GameCanvasProps {
  bridge: SceneBridge;
  peopleArt: PeopleArtEntry[];
  paused: boolean;
  selectedActorId: string | null;
  scenarioMode: ScenarioMode;
}

export default function GameCanvas({
  bridge,
  peopleArt,
  paused,
  selectedActorId,
  scenarioMode,
}: GameCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const data: WorldlineSceneData = {
      bridge,
      peopleArt,
      paused,
      selectedActorId,
      scenarioMode,
    };

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host,
      banner: false,
      backgroundColor: "#205b65",
      width: host.clientWidth || window.innerWidth,
      height: host.clientHeight || window.innerHeight,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoRound: true,
      },
      render: {
        pixelArt: true,
        antialias: false,
        roundPixels: true,
      },
      callbacks: {
        postBoot: (booted) => {
          booted.scene.add("worldline", WorldlineScene, true, data);
        },
      },
    });

    return () => {
      game.destroy(true);
      host.replaceChildren();
    };
    // Phaser is created once per people-art catalog. UI changes travel through the bridge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, peopleArt]);

  return <div ref={hostRef} className="game-canvas" aria-label="Isometric city" />;
}
