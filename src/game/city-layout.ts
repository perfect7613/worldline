/**
 * Worldline garden-city layout. Terrain cells use Claude City TerrainKind / road masks
 * for the reused terrain baker and Worldline city buildings.
 */
import {
  ROAD_EAST,
  ROAD_NORTH,
  ROAD_SOUTH,
  ROAD_WEST,
  type PropKind,
  type RoadClass,
  type TerrainCell,
  type TerrainGrid,
} from "@/game/claude-city/layouts/terrain";
import { hashCoords, pick, chance, pickIndex } from "@/game/claude-city/math/hash";

export const WORLD_SIZE = 32;
export const ISLAND = 24;
export const ISLAND_ORIGIN = 4;
export const CAPITOL_X = 16;
export const CAPITOL_Y = 16;

export interface BuildingPlot {
  x: number;
  y: number;
  tier: number;
}

export interface CityLayout {
  grid: TerrainGrid;
  buildings: BuildingPlot[];
  roads: Array<{ x: number; y: number }>;
}

function inIsland(x: number, y: number): boolean {
  const inBounds = (
    x >= ISLAND_ORIGIN &&
    y >= ISLAND_ORIGIN &&
    x < ISLAND_ORIGIN + ISLAND &&
    y < ISLAND_ORIGIN + ISLAND
  );
  if (!inBounds) return false;
  // Rounded park boundary frames the civic district.
  const nearestX = Math.max(8, Math.min(23, x));
  const nearestY = Math.max(8, Math.min(23, y));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= 24;
}

function isSand(x: number, y: number): boolean {
  if (!inIsland(x, y)) return false;
  return !inIsland(x - 2, y) || !inIsland(x + 2, y) || !inIsland(x, y - 2) || !inIsland(x, y + 2);
}

function isPlaza(x: number, y: number): boolean {
  return x >= 12 && x <= 20 && y >= 12 && y <= 21;
}

function isGardenWalk(x: number, y: number): boolean {
  return inIsland(x, y) && ((x === 25 && y >= 8 && y <= 23) || (y === 25 && x >= 8 && x <= 23));
}

function isPark(x: number, y: number): boolean {
  if (isPlaza(x, y) || isSand(x, y)) return false;
  return (
    (x >= 8 && x <= 10 && y >= 8 && y <= 10) ||
    (x >= 21 && x <= 23 && y >= 20 && y <= 22)
  );
}

function isRoadCoord(x: number, y: number): boolean {
  if (!inIsland(x, y) || isSand(x, y)) return false;
  if (isPlaza(x, y)) return false;
  const urban = x >= ISLAND_ORIGIN + 2 && x <= ISLAND_ORIGIN + ISLAND - 3 && y >= ISLAND_ORIGIN + 2 && y <= ISLAND_ORIGIN + ISLAND - 3;
  if (!urban) return false;
  const landmarkRing = ((x === 11 || x === 21) && y >= 11 && y <= 22) || ((y === 11 || y === 22) && x >= 11 && x <= 21);
  return landmarkRing || (x - ISLAND_ORIGIN) % 4 === 0 || (y - ISLAND_ORIGIN) % 4 === 0;
}

function roadClassAt(x: number, y: number): RoadClass {
  if (x === CAPITOL_X || y === CAPITOL_Y) return "boulevard";
  if ((x - ISLAND_ORIGIN) % 8 === 0 || (y - ISLAND_ORIGIN) % 8 === 0) return "street";
  return "lane";
}

function roadMask(x: number, y: number): number {
  let mask = 0;
  if (isRoadCoord(x, y - 1)) mask |= ROAD_NORTH;
  if (isRoadCoord(x + 1, y)) mask |= ROAD_EAST;
  if (isRoadCoord(x, y + 1)) mask |= ROAD_SOUTH;
  if (isRoadCoord(x - 1, y)) mask |= ROAD_WEST;
  return mask;
}

function propFor(x: number, y: number, kind: TerrainCell["kind"]): PropKind | undefined {
  if (isPlaza(x, y)) return undefined;
  if (isGardenWalk(x, y)) return (x + y) % 3 === 0 ? "tree" : (x + y) % 3 === 1 ? "lamp" : undefined;
  if (kind === "park") return pick(["tree", "pine", "bush", "fountain"] as const, hashCoords(x, y, 3));
  if (kind === "plaza" && (x + y) % 3 === 0) return "lamp";
  if (kind === "sand" && chance(hashCoords(x, y, 4), 0.24)) return (x + y) % 2 === 0 ? "tree" : "rock";
  if (kind === "grass" && chance(hashCoords(x, y, 5), 0.18)) {
    return pick(["tree", "pine", "bush"] as const, hashCoords(x, y, 6));
  }
  if (kind === "road" && (roadMask(x, y) === (ROAD_NORTH | ROAD_SOUTH | ROAD_EAST | ROAD_WEST))) {
    return undefined;
  }
  if (kind === "road" && chance(hashCoords(x, y, 7), 0.08)) return "lamp";
  return undefined;
}

export function buildCityLayout(): CityLayout {
  const map = new Map<string, TerrainCell>();
  const cells: TerrainCell[] = [];

  for (let y = 0; y < WORLD_SIZE; y += 1) {
    for (let x = 0; x < WORLD_SIZE; x += 1) {
      let kind: TerrainCell["kind"] = "park";
      let variant = pickIndex(hashCoords(x, y, 1), 3);
      if (inIsland(x, y)) {
        if (isGardenWalk(x, y)) {
          kind = "plaza";
          variant = 0;
        } else if (isSand(x, y)) {
          kind = "ground";
          variant = pickIndex(hashCoords(x, y, 2), 2);
        } else if (isPlaza(x, y) && !isRoadCoord(x, y)) {
          kind = "plaza";
          variant = 0;
        } else if (isPark(x, y) && !isRoadCoord(x, y)) {
          kind = "park";
          variant = pickIndex(hashCoords(x, y, 8), 2);
        } else if (isRoadCoord(x, y)) {
          kind = "road";
          variant = 0;
        } else {
          kind = "grass";
          variant = pickIndex(hashCoords(x, y, 9), 3);
        }
      } else {
        const dx = Math.min(x, WORLD_SIZE - 1 - x, y, WORLD_SIZE - 1 - y);
        variant = dx < 2 ? 2 : pickIndex(hashCoords(x, y, 1), 3);
      }

      const cell: TerrainCell = {
        x,
        y,
        kind,
        variant,
        roadMask: kind === "road" ? roadMask(x, y) : 0,
        roadClass: kind === "road" ? roadClassAt(x, y) : undefined,
        prop: !inIsland(x,y) ? (chance(hashCoords(x,y,43),.16) ? "tree" : undefined) : propFor(x, y, kind),
        keepProp: kind === "park" || kind === "plaza",
      };
      cells.push(cell);
      map.set(`${x},${y}`, cell);
    }
  }

  const grid: TerrainGrid = {
    bounds: { minX: 0, minY: 0, maxX: WORLD_SIZE - 1, maxY: WORLD_SIZE - 1 },
    cells,
    roads: cells.filter((cell) => cell.kind === "road"),
    cellAt(x, y) {
      return map.get(`${x},${y}`);
    },
  };

  const buildings: BuildingPlot[] = [];

  for (const cell of cells) {
    if (cell.kind !== "grass" && cell.kind !== "ground") continue;
    if (isPlaza(cell.x, cell.y) || isPark(cell.x, cell.y) || (cell.x >= 23 && cell.y >= 23)) continue;
    if (!chance(hashCoords(cell.x, cell.y, 21), 0.62)) continue;

    const nearRoad =
      isRoadCoord(cell.x + 1, cell.y) ||
      isRoadCoord(cell.x, cell.y + 1) ||
      isRoadCoord(cell.x - 1, cell.y) ||
      isRoadCoord(cell.x, cell.y - 1);
    if (!nearRoad && !chance(hashCoords(cell.x, cell.y, 22), 0.25)) continue;

    const tier = pickIndex(hashCoords(cell.x, cell.y, 25), 4);
    buildings.push({ x: cell.x, y: cell.y, tier });
  }

  if (buildings.length < 30) {
    for (const cell of cells) {
      if (buildings.length >= 36) break;
      if (cell.kind !== "grass") continue;
      if (buildings.some((plot) => plot.x === cell.x && plot.y === cell.y)) continue;
      if (isPlaza(cell.x, cell.y) || isPark(cell.x, cell.y) || (cell.x >= 23 && cell.y >= 23)) continue;
      buildings.push({
        x: cell.x,
        y: cell.y,
        tier: 2,
      });
    }
  }

  // Distribute buildings around the full island instead of keeping the first
  // northern rows from scan order. Clear props under occupied footprints.
  const chosen = buildings.sort((a, b) => hashCoords(a.x, a.y, 73) - hashCoords(b.x, b.y, 73)).slice(0, 64);
  for (const plot of chosen) {
    const cell = map.get(`${plot.x},${plot.y}`);
    if (cell) cell.prop = undefined;
  }
  return {
    grid,
    buildings: chosen,
    roads: grid.roads.map((cell) => ({ x: cell.x, y: cell.y })),
  };
}

export function neighborsOf(x: number, y: number, roads: Set<string>): Array<{ x: number; y: number }> {
  const next = [
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y },
  ];
  return next.filter((point) => roads.has(`${point.x},${point.y}`));
}

export function shortestRoadPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  roads: Set<string>,
): Array<{ x: number; y: number }> {
  const start = `${from.x},${from.y}`;
  const goal = `${to.x},${to.y}`;
  if (!roads.has(start) || !roads.has(goal)) return [from];
  const queue: Array<{ x: number; y: number }> = [from];
  const seen = new Map<string, string | null>([[start, null]]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const key = `${current.x},${current.y}`;
    if (key === goal) break;
    for (const next of neighborsOf(current.x, current.y, roads)) {
      const nextKey = `${next.x},${next.y}`;
      if (seen.has(nextKey)) continue;
      seen.set(nextKey, key);
      queue.push(next);
    }
  }
  if (!seen.has(goal)) return [from];
  const path: Array<{ x: number; y: number }> = [];
  let cursor: string | null = goal;
  while (cursor) {
    const [cx, cy] = cursor.split(",").map(Number);
    path.push({ x: cx, y: cy });
    cursor = seen.get(cursor) ?? null;
  }
  path.reverse();
  return path;
}
