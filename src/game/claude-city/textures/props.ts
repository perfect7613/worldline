/**
 * Provenance: Claude City (claude-clan)
 * Source: https://github.com/mittal-parth/claude-clan/blob/17fde7cb7d78849ad02993f2b65fd47b6e4f420f/apps/web/src/game/textures/props.ts
 * Commit: 17fde7cb7d78849ad02993f2b65fd47b6e4f420f
 * Adapted for Worldline under src/game/claude-city. HUD/GitHub workflow omitted.
 */

import { PropKind } from "../layouts/terrain";
import { TILE_ANCHOR_Y, Baker, fillFace, diamond, HALF_W, TILE_WIDTH, shade } from "./core";
import { TERRAIN_COLORS, PROP_COLORS } from "../math/palette";

export function propTextureKey(prop: PropKind): string {
  return `prop:${prop}`;
}


// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export const PROP_HEIGHT = 112;

export const PROP_ORIGIN_Y = PROP_HEIGHT - TILE_ANCHOR_Y;


export function propShadow(baker: Baker, half: number): void {
  fillFace(baker, TERRAIN_COLORS.shadow, 0.22, diamond(half), HALF_W, PROP_ORIGIN_Y);
}


/** Broad shade trees for Bengaluru's gardens and Delhi's avenues. */
function bakeShadeTree(baker: Baker, key: "tree" | "pine", lean: number): void {
  propShadow(baker, 0.33);
  const base = baker.at([0, 0, 0], HALF_W, PROP_ORIGIN_Y);
  const g = baker.graphics;
  g.lineStyle(6, PROP_COLORS.trunk);
  g.lineBetween(base.x, base.y, base.x + lean, base.y - 48);
  g.lineStyle(3, PROP_COLORS.trunk);
  g.lineBetween(base.x, base.y - 26, base.x - 20, base.y - 49);
  g.lineBetween(base.x, base.y - 32, base.x + 24, base.y - 56);
  g.fillStyle(key === "pine" ? PROP_COLORS.pine : PROP_COLORS.leaf);
  g.fillEllipse(base.x + lean, base.y - 55, 76, 38);
  g.fillEllipse(base.x - 16, base.y - 65, 39, 30);
  g.fillEllipse(base.x + 15, base.y - 68, 43, 32);
  g.fillStyle(PROP_COLORS.leafLight, .85);
  g.fillEllipse(base.x - 10, base.y - 72, 34, 16);
  g.fillEllipse(base.x + 22, base.y - 61, 26, 14);
  baker.finish(propTextureKey(key), TILE_WIDTH, PROP_HEIGHT);
}
export function bakeTree(baker: Baker): void { bakeShadeTree(baker, "tree", 4); }
export function bakePine(baker: Baker): void { bakeShadeTree(baker, "pine", -4); }

export function bakeBush(baker: Baker): void {
  propShadow(baker, 0.14);
  const base = baker.at([0, 0, 0], HALF_W, PROP_ORIGIN_Y);
  baker.graphics.fillStyle(PROP_COLORS.bush, 1);
  baker.graphics.fillCircle(base.x - 5, base.y - 5, 7);
  baker.graphics.fillCircle(base.x + 5, base.y - 4, 6);
  baker.graphics.fillStyle(shade(PROP_COLORS.bush, 12), 1);
  baker.graphics.fillCircle(base.x, base.y - 9, 7);

  baker.finish(propTextureKey("bush"), TILE_WIDTH, PROP_HEIGHT);
}


export function bakeRock(baker: Baker): void {
  propShadow(baker, 0.13);
  const base = baker.at([0, 0, 0], HALF_W, PROP_ORIGIN_Y);
  baker.graphics.fillStyle(PROP_COLORS.rock, 1);
  baker.graphics.fillTriangle(
    base.x - 9,
    base.y,
    base.x + 9,
    base.y,
    base.x - 1,
    base.y - 11,
  );
  baker.graphics.fillStyle(shade(PROP_COLORS.rock, 12), 1);
  baker.graphics.fillTriangle(
    base.x - 1,
    base.y - 11,
    base.x + 9,
    base.y,
    base.x + 3,
    base.y - 6,
  );

  baker.finish(propTextureKey("rock"), TILE_WIDTH, PROP_HEIGHT);
}


/**
 * A boulevard lamp, standing on a road cell at a junction. A slender dark
 * post so it reads as ironwork rather than a mast, and the accent colour
 * kept to the small lamp head at the top -- a whole gold post would read as
 * an orange lump, per the same lesson the harbour's own lamp learned.
 *
 * Sized to fit PROP_HEIGHT's existing headroom (PROP_ORIGIN_Y = 32px above
 * the tile point): post to -20, head centre at -23, outer halo radius 6, so
 * the highest point drawn is at 32 - 23 - 6 = 3px -- inside the canvas with
 * margin, not clipped against its top edge.
 */
export function bakeLamp(baker: Baker): void {
  propShadow(baker, 0.1);
  const base = baker.at([0, 0, 0], HALF_W, PROP_ORIGIN_Y);
  const postTop = base.y - 20;
  const headY = base.y - 23;

  baker.graphics.fillStyle(PROP_COLORS.lampPost, 1);
  baker.graphics.fillRect(base.x - 1, postTop, 3, 20);

  // Two short crossarms just under the head -- what separates a lamp from a flagpole.
  baker.graphics.fillRect(base.x - 5, postTop, 4, 2);
  baker.graphics.fillRect(base.x + 1, postTop, 4, 2);

  baker.graphics.fillStyle(shade(PROP_COLORS.lampGlow, -20), 1);
  baker.graphics.fillCircle(base.x, headY, 4);
  baker.graphics.fillStyle(PROP_COLORS.lampGlow, 0.9);
  baker.graphics.fillCircle(base.x, headY, 2.5);
  // A soft halo, the same trick the harbour's beacon uses to read as lit
  // rather than as a coloured disc.
  baker.graphics.fillStyle(PROP_COLORS.lampGlow, 0.18);
  baker.graphics.fillCircle(base.x, headY, 6);

  baker.finish(propTextureKey("lamp"), TILE_WIDTH, PROP_HEIGHT);
}


export function bakeFountain(baker: Baker): void {
  propShadow(baker, 0.24);
  fillFace(
    baker,
    PROP_COLORS.fountain,
    1,
    diamond(0.26),
    HALF_W,
    PROP_ORIGIN_Y,
  );
  fillFace(
    baker,
    PROP_COLORS.fountainWater,
    1,
    diamond(0.18),
    HALF_W,
    PROP_ORIGIN_Y,
  );
  const base = baker.at([0, 0, 0], HALF_W, PROP_ORIGIN_Y);
  baker.graphics.fillStyle(PROP_COLORS.fountain, 1);
  baker.graphics.fillRect(base.x - 2, base.y - 14, 4, 14);
  baker.graphics.fillStyle(PROP_COLORS.fountainWater, 0.8);
  baker.graphics.fillCircle(base.x, base.y - 17, 5);

  baker.finish(propTextureKey("fountain"), TILE_WIDTH, PROP_HEIGHT);
}
