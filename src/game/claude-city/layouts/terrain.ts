/**
 * Provenance: Claude City (claude-clan)
 * Source: https://github.com/mittal-parth/claude-clan/blob/17fde7cb7d78849ad02993f2b65fd47b6e4f420f/apps/web/src/game/layouts/terrain.ts
 * Commit: 17fde7cb7d78849ad02993f2b65fd47b6e4f420f
 * Local adapter: domain types only. Protocol/district/airport/harbour layout is omitted.
 */

export type TerrainKind =
  | "water"
  | "sand"
  | "grass"
  | "ground"
  | "road"
  | "park"
  | "plaza";

export type PropKind = "tree" | "pine" | "bush" | "rock" | "fountain" | "lamp";

export type RoadClass = "boulevard" | "street" | "lane";

export type BuildingFacing = "u" | "v";

export const ROAD_NORTH = 1;
export const ROAD_EAST = 2;
export const ROAD_SOUTH = 4;
export const ROAD_WEST = 8;

export interface TerrainCell {
  x: number;
  y: number;
  kind: TerrainKind;
  variant: number;
  roadMask: number;
  roadClass?: RoadClass;
  prop?: PropKind;
  keepProp?: boolean;
}

export interface TerrainBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface TerrainGrid {
  bounds: TerrainBounds;
  cells: TerrainCell[];
  roads: TerrainCell[];
  cellAt(x: number, y: number): TerrainCell | undefined;
}
