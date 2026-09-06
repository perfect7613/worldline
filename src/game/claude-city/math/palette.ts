/**
 * Provenance: Claude City (claude-clan)
 * Source: https://github.com/mittal-parth/claude-clan/blob/17fde7cb7d78849ad02993f2b65fd47b6e4f420f/apps/web/src/game/math/palette.ts
 * Commit: 17fde7cb7d78849ad02993f2b65fd47b6e4f420f
 * Adapted for Worldline under src/game/claude-city. HUD/GitHub workflow omitted.
 */

export const TERRAIN_COLORS = {
  // Base palette, overridden per city by applyCityPalette.
  grass: [0x87a96a, 0x809e62, 0x91ae74],
  grassShade: 0x617d48,
  field: 0xa4b97d,
  park: 0x739658,
  sand: 0xe8cf9d,
  sandShade: 0xd8bc87,
  water: 0x397f88,
  waterDeep: 0x205b65,
  waterFoam: 0x9ed5cc,
  road: 0x757d7c,
  roadShade: 0x636e6e,
  roadLine: 0xf4e1b9,
  pavement: 0xe7d6b9,
  ground: 0x8eaa73,
  shadow: 0x344c35,
} as const;

export const PROP_COLORS = {
  trunk: 0x94734b,
  leaf: 0x376d51,
  leafLight: 0x6a975e,
  pine: 0x2c6650,
  bush: 0x658a4e,
  rock: 0x9c9c93,
  fountain: 0xd9d5c8,
  fountainWater: 0x54b7ea,
  lampPost: 0x2b3038,
  lampGlow: 0xffd166,
} as const;
