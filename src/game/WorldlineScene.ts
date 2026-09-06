import * as Phaser from "phaser";
import { nearbyConversationPair, sampleConversation, type ResidentConversation } from "./conversation-data";
import { daylightAt, blendColor } from "./daylight";

import { VIDHANA_KEY, VIDHANA_ANCHOR_Y, VIDHANA_SCALE, bakeVidhanaSoudha } from "@/game/landmarks/vidhana-soudha";
import { PARLIAMENT_KEY, PARLIAMENT_ANCHOR_Y, PARLIAMENT_SCALE, bakeParliament } from "@/game/landmarks/parliament";
import { applyCityPalette, CITY_THEMES } from "@/game/city-themes";
import { createBaker, TILE_ANCHOR_Y, TILE_HEIGHT, TILE_WIDTH } from "@/game/claude-city/textures/core";
import { bakeCityBuilding } from "@/game/city-buildings";
import {
  HIGHLIGHT_KEY,
  SELECT_KEY,
  bakeHighlight,
} from "@/game/claude-city/textures/effects";
import { createIsoProjection } from "@/game/claude-city/math/iso";
import {
  TERRAIN_ATLAS_KEY,
  bakeTerrainAtlas,
  roadTextureKey,
  terrainTextureKey,
  TERRAIN_VARIANT_COUNTS,
} from "@/game/claude-city/textures/terrain";
import {
  bakeBush,
  bakeFountain,
  bakeLamp,
  bakePine,
  bakeRock,
  bakeTree,
  propTextureKey,
} from "@/game/claude-city/textures/props";
import type { TerrainCell } from "@/game/claude-city/layouts/terrain";
import {
  buildCityLayout,
  CAPITOL_X,
  CAPITOL_Y,
  shortestRoadPath,
  WORLD_SIZE,
  type CityLayout,
} from "@/game/city-layout";
import { artForResident, type PeopleArtEntry } from "@/game/people-art";
import type { SceneBridge } from "@/game/scene-bridge";
import { RESIDENTS, type ScenarioMode, type WorldEvent } from "@/game/world-data";

const projection = createIsoProjection(TILE_WIDTH, TILE_HEIGHT);
const GROUND_DEPTH = -1_000_000;
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 1.85;
const PERSON_DISPLAY_H = 52;

interface Walker {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  bubble?: Phaser.GameObjects.Text;
  path: Array<{ x: number; y: number }>;
  pathIndex: number;
  u: number;
  v: number;
  heading: number;
  step: number;
}

export interface WorldlineSceneData {
  bridge: SceneBridge;
  peopleArt: PeopleArtEntry[];
  paused: boolean;
  selectedActorId: string | null;
  scenarioMode: ScenarioMode;
}

function tileKeyFor(cell: TerrainCell): string {
  if (cell.kind === "road") {
    return roadTextureKey(cell.roadMask, cell.roadClass ?? "street");
  }
  const variants = TERRAIN_VARIANT_COUNTS[cell.kind];
  return terrainTextureKey(cell.kind, Math.min(cell.variant, variants - 1));
}

export class WorldlineScene extends Phaser.Scene {
  private bridge!: SceneBridge;
  private peopleArt: PeopleArtEntry[] = [];
  private layout!: CityLayout;
  private walkers = new Map<string, Walker>();
  private roadSet = new Set<string>();
  private paused = false;
  private scenarioMode: ScenarioMode = "founder";
  private nextLightingUpdate = 0;
  private conversationWait = 3000;
  private agentMode = false;
  private conversationSequence = 0;
  private previousParticipants: string[] = [];
  private activeConversation?: { data: ResidentConversation; cloud: Phaser.GameObjects.Sprite; remaining: number };
  private environmentObjects: Phaser.GameObjects.GameObject[] = [];
  private selectedActorId: string | null = null;
  private drag: { x: number; y: number } | null = null;
  private zoomTarget = 0.72;
  private keys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    plus: Phaser.Input.Keyboard.Key;
    minus: Phaser.Input.Keyboard.Key;
    add: Phaser.Input.Keyboard.Key;
  };
  private detachBridge?: () => void;
  private selectRing?: Phaser.GameObjects.Sprite;

  constructor() {
    super({ key: "worldline" });
  }

  init(data: WorldlineSceneData): void {
    this.bridge = data.bridge;
    this.peopleArt = data.peopleArt;
    this.paused = data.paused;
    this.scenarioMode = data.scenarioMode;
    this.selectedActorId = data.selectedActorId;
    this.layout = buildCityLayout();
    this.roadSet = new Set(this.layout.roads.map((road) => `${road.x},${road.y}`));
  }

  preload(): void {
    for (const resident of RESIDENTS) {
      const art = artForResident(resident, this.peopleArt);
      this.load.spritesheet(`person:${resident.id}`, art.sheet, {
        frameWidth: art.frameWidth, frameHeight: art.frameHeight,
      });
    }
  }

  create(): void {
    try {
      const baker = createBaker(this);
      bakeHighlight(baker, HIGHLIGHT_KEY, 0xffcf70, 0.9);
      bakeHighlight(baker, SELECT_KEY, 0xffd166, 1);
      baker.destroy();
      this.drawEnvironment(this.scenarioMode);
      this.spawnPeople();
      this.bindCamera();
      this.bindBridge();
      this.paintSelection();
      this.fitIsland();
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.detachBridge?.();
        this.clearConversation();
      });
      this.bridge.ready();
    } catch (error) {
      const message = error instanceof Error ? error.message : "The city renderer failed to start.";
      this.bridge.error(message);
    }
  }

  shutdown(): void {
    this.detachBridge?.();
  }

  update(_time: number, delta: number): void {
    if (_time >= this.nextLightingUpdate) {
      this.applyDaylight();
      this.nextLightingUpdate = _time + 10000;
    }
    this.applyKeyboard(delta);
    const camera = this.cameras.main;
    camera.setZoom(Phaser.Math.Linear(camera.zoom, this.zoomTarget, 0.12));
    this.positionConversationCloud();
    if (this.paused) return;
    this.updateConversations(Math.min(delta, 100));
    for (const walker of this.walkers.values()) {
      if (!this.activeConversation?.data.participantIds.includes(walker.id)) this.stepWalker(walker, delta);
    }
  }

  private drawEnvironment(mode: ScenarioMode): void {
    for (const object of this.environmentObjects) object.destroy();
    this.scenarioMode = mode;
    applyCityPalette(mode);
    const before = new Set(this.children.list);
    this.bakeWorld();
    this.drawTerrain();
    this.drawBuildings();
    this.drawLandmark();
    this.environmentObjects = this.children.list.filter(object => !before.has(object));
    this.applyDaylight();
  }

  private applyDaylight(): void {
    const light = daylightAt(new Date());
    for (const object of this.environmentObjects) {
      if (object instanceof Phaser.GameObjects.Sprite) object.setTint(light.tint);
    }
    this.cameras.main.setBackgroundColor(blendColor(light.sky, CITY_THEMES[this.scenarioMode].background, 0.2));
  }

  private bakeWorld(): void {
    const baker = createBaker(this);
    bakeTerrainAtlas(this, baker);
    bakeTree(baker);
    bakePine(baker);
    bakeBush(baker);
    bakeRock(baker);
    bakeFountain(baker);
    bakeLamp(baker);
    baker.destroy();
    if (this.scenarioMode === "founder") bakeVidhanaSoudha(this);
    else bakeParliament(this);

    for (const [index, plot] of this.layout.buildings.entries()) {
      bakeCityBuilding(this, index % 8, Math.max(0, Math.min(1, plot.tier - 1)), this.scenarioMode);
    }
  }

  private drawTerrain(): void {
    for (const cell of this.layout.grid.cells) {
      if (cell.kind === "water") {
        const shore =
          this.layout.grid.cellAt(cell.x + 1, cell.y)?.kind !== "water" ||
          this.layout.grid.cellAt(cell.x - 1, cell.y)?.kind !== "water" ||
          this.layout.grid.cellAt(cell.x, cell.y + 1)?.kind !== "water" ||
          this.layout.grid.cellAt(cell.x, cell.y - 1)?.kind !== "water";
        const edge = cell.x <= 1 || cell.y <= 1 || cell.x >= WORLD_SIZE - 2 || cell.y >= WORLD_SIZE - 2;
        if (!shore && edge) continue;
      }
      const point = projection.project(cell.x, cell.y);
      this.add
        .sprite(point.x, point.y + TILE_ANCHOR_Y, TERRAIN_ATLAS_KEY, tileKeyFor(cell))
        .setOrigin(0.5, 1)
        .setDepth(GROUND_DEPTH);
      if (cell.prop) {
        this.add
          .sprite(point.x, point.y + TILE_ANCHOR_Y, propTextureKey(cell.prop))
          .setOrigin(0.5, 1)
          .setDepth(projection.depth(cell.x, cell.y));
      }
    }
  }

  private drawBuildings(): void {
    for (const [index, plot] of this.layout.buildings.entries()) {
      const baked = bakeCityBuilding(this, index % 8, Math.max(0, Math.min(1, plot.tier - 1)), this.scenarioMode);
      const point = projection.project(plot.x, plot.y);
      this.add
        .sprite(point.x, point.y + TILE_ANCHOR_Y, baked.key)
        .setOrigin(0.5, 1)
        .setDepth(projection.depth(plot.x, plot.y));
    }
  }

  private drawLandmark(): void {
    const founder = this.scenarioMode === "founder";
    const key = founder ? VIDHANA_KEY : PARLIAMENT_KEY;
    const anchor = founder ? VIDHANA_ANCHOR_Y : PARLIAMENT_ANCHOR_Y;
    const scale = founder ? VIDHANA_SCALE : PARLIAMENT_SCALE;
    const point = projection.project(CAPITOL_X, CAPITOL_Y - 1);
    this.add.sprite(point.x, point.y + anchor * scale, key)
      .setOrigin(0.5, 1).setScale(scale)
      .setDepth(projection.depth(CAPITOL_X, CAPITOL_Y + 1));
  }

  private bakeFallbackPerson(key: string, color: number): void {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(color, 1);
    graphics.fillCircle(16, 8, 6);
    graphics.fillRect(10, 14, 12, 18);
    graphics.generateTexture(key, 32, 40);
    graphics.destroy();
  }

  private spawnPeople(): void {
    const roads = this.layout.roads;
    RESIDENTS.forEach((resident, index) => {
      const start = roads[(Math.floor(index / 2) * 17 + index % 2) % roads.length] ?? roads[0];
      if (!start) return;
      const point = projection.project(start.x, start.y);
      const key = `person:${resident.id}`;
      if (!this.textures.exists(key)) {
        this.bakeFallbackPerson(key, resident.color);
      }
      const sprite = this.add
        .sprite(point.x, point.y, key, 7)
        .setOrigin(0.5, 1)
        .setDepth(projection.depth(start.x, start.y, 8));
      const frame = this.textures.get(key).get(7);
      const scale = PERSON_DISPLAY_H / Math.max(frame.height, 1);
      sprite.setScale(scale);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        pointer.event.stopPropagation();
        this.bridge.selectActor(resident.id);
      });

      const marker = this.add
        .circle(point.x, point.y - PERSON_DISPLAY_H - 4, 4, resident.color)
        .setStrokeStyle(1, 0x17222e)
        .setDepth(projection.depth(start.x, start.y, 12));

      const label = this.add
        .text(point.x, point.y - PERSON_DISPLAY_H - 10, resident.marker, {
          fontFamily: "ui-monospace, monospace",
          fontSize: "10px",
          color: "#f6efe0",
        })
        .setOrigin(0.5, 1)
        .setDepth(projection.depth(start.x, start.y, 13));

      const walker: Walker = {
        id: resident.id,
        sprite,
        marker,
        label,
        path: this.randomPath(start),
        pathIndex: 0,
        u: start.x,
        v: start.y,
        heading: 0,
        step: index * 0.4,
      };
      this.walkers.set(resident.id, walker);
    });

    this.selectRing = this.add
      .sprite(0, 0, SELECT_KEY)
      .setOrigin(0.5, 1)
      .setVisible(false)
      .setDepth(GROUND_DEPTH + 10);
  }

  private randomPath(from: { x: number; y: number }): Array<{ x: number; y: number }> {
    const roads = this.layout.roads;
    const dest = roads[Math.floor(Math.random() * roads.length)] ?? from;
    return shortestRoadPath(from, dest, this.roadSet);
  }

  private stepWalker(walker: Walker, delta: number): void {
    if (walker.pathIndex >= walker.path.length - 1) {
      const last = walker.path[walker.path.length - 1] ?? { x: walker.u, y: walker.v };
      walker.path = this.randomPath(last);
      walker.pathIndex = 0;
    }
    const target = walker.path[walker.pathIndex + 1];
    if (!target) return;
    const speed = 0.00115 * delta;
    const dx = target.x - walker.u;
    const dy = target.y - walker.v;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.02) {
      walker.u = target.x;
      walker.v = target.y;
      walker.pathIndex += 1;
      walker.heading = Math.atan2(dy, dx);
    } else {
      walker.u += (dx / dist) * Math.min(speed, dist);
      walker.v += (dy / dist) * Math.min(speed, dist);
    }
    walker.step += delta * 0.012;
    const bob = 0;
    // Cardinal sprite poses follow screen-space direction on the isometric plane.
    const screenDx = dx - dy;
    const screenDy = (dx + dy) * 0.5;
    const row = Math.abs(screenDx) > Math.abs(screenDy) ? (screenDx > 0 ? 1 : 3) : (screenDy > 0 ? 2 : 0);
    const phase = Math.floor(walker.step / 1.8) % 4;
    walker.sprite.setFrame(row * 3 + [0, 1, 2, 1][phase]);
    const point = projection.project(walker.u, walker.v);
    walker.sprite.setPosition(point.x, point.y + bob);
    walker.sprite.setDepth(projection.depth(walker.u, walker.v, 8));
    if (walker.id === this.selectedActorId) this.selectRing?.setPosition(point.x, point.y + 8);
    walker.marker.setPosition(point.x, point.y - PERSON_DISPLAY_H - 4 + bob);
    walker.marker.setDepth(projection.depth(walker.u, walker.v, 12));
    walker.label.setPosition(point.x, point.y - PERSON_DISPLAY_H - 10 + bob);
    walker.label.setDepth(projection.depth(walker.u, walker.v, 13));
    if (walker.bubble) {
      walker.bubble.setPosition(point.x, point.y - PERSON_DISPLAY_H - 22 + bob);
      walker.bubble.setDepth(projection.depth(walker.u, walker.v, 20));
    }
  }

  private clearConversation(): void {
    this.activeConversation?.cloud.destroy();
    this.activeConversation = undefined;
  }

  private positionConversationCloud(): void {
    const active = this.activeConversation;
    if (!active) return;
    const first = this.walkers.get(active.data.participantIds[0]);
    const second = this.walkers.get(active.data.participantIds[1]);
    if (!first || !second) return;
    // Keep the pixel cloud easy to tap even at the initial phone zoom.
    active.cloud.setScale(Math.max(1, 0.7 / this.cameras.main.zoom));
    active.cloud.setPosition((first.sprite.x + second.sprite.x) / 2,
      Math.min(first.sprite.y, second.sprite.y) - PERSON_DISPLAY_H - 35);
  }

  private updateConversations(delta: number): void {
    if (this.activeConversation) {
      if (this.activeConversation.data.kind === "pending") return;
      this.activeConversation.remaining -= delta;
      if (this.activeConversation.remaining <= 0) {
        this.clearConversation();
        this.conversationWait = 12000;
      }
      return;
    }
    if (this.agentMode) return;
    this.conversationWait -= delta;
    if (this.conversationWait > 0) return;
    const pair = nearbyConversationPair([...this.walkers.values()], this.previousParticipants);
    if (!pair) { this.conversationWait = 1500; return; }
    const participants: [string, string] = [pair[0].id, pair[1].id];
    const data = sampleConversation(this.scenarioMode, participants, ++this.conversationSequence);
    this.showConversation(data);
    this.bridge.conversationStarted(data);
  }

  private showConversation(data: ResidentConversation): void {
    this.clearConversation();
    const pair = data.participantIds.map(id => this.walkers.get(id));
    if (!pair[0] || !pair[1]) return;
    const participants = data.participantIds;
    const key = "worldline:conversation-cloud";
    if (!this.textures.exists(key)) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      // Stepped rectangles make a true pixel silhouette, including the tail.
      g.fillStyle(0x273d38);
      g.fillRect(12, 0, 80, 8); g.fillRect(4, 8, 96, 8); g.fillRect(0, 16, 104, 28);
      g.fillRect(8, 44, 88, 8); g.fillRect(28, 52, 20, 8); g.fillRect(28, 60, 8, 8);
      g.fillStyle(0xfff5dc);
      g.fillRect(12, 8, 80, 8); g.fillRect(8, 16, 88, 28); g.fillRect(16, 44, 72, 4);
      g.fillRect(32, 48, 12, 8);
      g.fillStyle(0x456859);
      for (const x of [28, 48, 68]) g.fillRect(x, 24, 8, 8);
      g.generateTexture(key, 104, 68); g.destroy();
    }
    const cloud = this.add.sprite(0, 0, key).setOrigin(0.5, 1).setDepth(1_000_000)
      .setInteractive({ useHandCursor: true });
    cloud.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      this.drag = null;
      this.bridge.conversation(this.activeConversation?.data ?? data);
    });
    pair.forEach((walker, index) => {
      const other = pair[1 - index];
      if (walker && other) walker.sprite.setFrame(other.sprite.x > walker.sprite.x ? 4 : 10);
    });
    this.activeConversation = { data, cloud, remaining: 10000 };
    this.previousParticipants = participants;
    this.positionConversationCloud();
  }

  private bindCamera(): void {
    const camera = this.cameras.main;
    const nw = projection.project(0, WORLD_SIZE - 1);
    const se = projection.project(WORLD_SIZE - 1, 0);
    const ne = projection.project(0, 0);
    const sw = projection.project(WORLD_SIZE - 1, WORLD_SIZE - 1);
    camera.setBounds(nw.x - 200, ne.y - 220, se.x - nw.x + 400, sw.y - ne.y + 420);

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      this.drag = { x: pointer.x, y: pointer.y };
    });
    this.input.on("pointerup", () => {
      this.drag = null;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.drag || !pointer.isDown) return;
      camera.scrollX -= (pointer.x - this.drag.x) / camera.zoom;
      camera.scrollY -= (pointer.y - this.drag.y) / camera.zoom;
      this.drag = { x: pointer.x, y: pointer.y };
    });
    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _over: Phaser.GameObjects.GameObject[],
        _dx: number,
        dy: number,
      ) => {
        this.adjustZoom(dy > 0 ? -0.08 : 0.08);
      },
    );

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.keys = {
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        plus: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS),
        minus: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS),
        add: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD),
      };
    }
  }

  private applyKeyboard(delta: number): void {
    if (!this.keys) return;
    if (document.activeElement instanceof HTMLElement && document.activeElement.matches("input, textarea, select, [contenteditable=true]")) return;
    const camera = this.cameras.main;
    const step = (0.28 * delta) / camera.zoom;
    if (this.keys.left.isDown) camera.scrollX -= step;
    if (this.keys.right.isDown) camera.scrollX += step;
    if (this.keys.up.isDown) camera.scrollY -= step;
    if (this.keys.down.isDown) camera.scrollY += step;
    if (Phaser.Input.Keyboard.JustDown(this.keys.plus) || Phaser.Input.Keyboard.JustDown(this.keys.add)) {
      this.adjustZoom(0.12);
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.minus)) {
      this.adjustZoom(-0.12);
    }
  }

  private adjustZoom(delta: number): void {
    this.zoomTarget = Phaser.Math.Clamp(this.zoomTarget + delta, MIN_ZOOM, MAX_ZOOM);
  }

  private fitIsland(): void {
    const center = projection.project(CAPITOL_X, CAPITOL_Y);
    this.cameras.main.centerOn(center.x, center.y + 40);
    const width = this.scale.width;
    this.zoomTarget = width < 600 ? 0.32 : width < 960 ? 0.48 : 0.68;
    this.cameras.main.setZoom(this.zoomTarget);
  }

  private bindBridge(): void {
    this.detachBridge = this.bridge.attach((command) => {
      if (command.type === "setAgentMode") {
        this.agentMode = command.enabled;
        this.clearConversation();
        this.conversationWait = 1500;
        return;
      }
      if (command.type === "showConversation") {
        this.showConversation(command.conversation);
        return;
      }
      if (command.type === "resolveConversation") {
        if (this.activeConversation?.data.id === command.conversation.id) {
          this.activeConversation.data = command.conversation;
          this.activeConversation.remaining = 16000;
        }
        return;
      }
      if (command.type === "setMode") {
        if (command.mode !== this.scenarioMode) {
          this.clearConversation();
          this.conversationWait = 3000;
          this.previousParticipants = [];
          this.drawEnvironment(command.mode);
        }
        return;
      }
      if (command.type === "setPaused") {
        this.paused = command.paused;
        return;
      }
      if (command.type === "selectActor") {
        this.selectedActorId = command.id;
        this.paintSelection();
        return;
      }
      if (command.type === "worldEvent") {
        this.showEvent(command.event);
        return;
      }
      if (command.type === "camera") {
        if (command.action === "zoomIn") this.adjustZoom(0.12);
        if (command.action === "zoomOut") this.adjustZoom(-0.12);
        if (command.action === "reset") this.fitIsland();
      }
    });
  }

  private paintSelection(): void {
    for (const walker of this.walkers.values()) {
      walker.sprite.setTint(walker.id === this.selectedActorId ? 0xfff4c2 : 0xffffff);
    }
    const selected = this.selectedActorId ? this.walkers.get(this.selectedActorId) : undefined;
    if (selected && this.selectRing) {
      this.selectRing.setVisible(true);
      this.selectRing.setPosition(selected.sprite.x, selected.sprite.y + 8);
    } else {
      this.selectRing?.setVisible(false);
    }
  }

  private showEvent(event: WorldEvent): void {
    if (!event.actorId) return;
    const walker = this.walkers.get(event.actorId);
    if (!walker) return;
    walker.bubble?.destroy();
    walker.bubble = this.add
      .text(walker.sprite.x, walker.sprite.y - PERSON_DISPLAY_H - 22, event.text.slice(0, 64), {
        fontFamily: "ui-monospace, Menlo, monospace",
        fontSize: "10px",
        color: "#1a2430",
        backgroundColor: "#f6efe0",
        padding: { x: 6, y: 4 },
        wordWrap: { width: 160 },
      })
      .setOrigin(0.5, 1)
      .setDepth(projection.depth(walker.u, walker.v, 20));
    const bubble = walker.bubble;
    this.time.delayedCall(4200, () => {
      bubble?.destroy();
      if (walker.bubble === bubble) walker.bubble = undefined;
    });
  }
}
