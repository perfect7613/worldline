import type * as Phaser from "phaser";
import {
  createBaker,
  fillFace,
  shade,
  strokeFace,
  TILE_ANCHOR_Y,
  TILE_WIDTH,
  type Point3,
} from "@/game/claude-city/textures/core";

/** Worldline neighborhood geometry using Claude City's shared isometric baker. */
export interface BakedCityBuilding {
  key: string;
  height: number;
  bodyHeight: number;
  floors: number;
  style: string;
}

const BASE_STYLES = [
  { name: "urban-apartment", wall: 0xeab09c, trim: 0xffecd0, shade: 0xb86f69, roof: 0xc19e87, awning: 0x487f72, floors: 3, round: 0.16 },
  { name: "mint-verandah", wall: 0xa9c5ad, trim: 0xf8e4bd, shade: 0x688e82, roof: 0xad9b7b, awning: 0xc47755, floors: 2, round: 0.05 },
  { name: "ochre-apartments", wall: 0xe6bd6f, trim: 0xffebbf, shade: 0xbc894a, roof: 0xaf9373, awning: 0x668e87, floors: 3, round: 0.04 },
  { name: "seafoam-midrise", wall: 0xd0ddd1, trim: 0xf8edd1, shade: 0x86aaa1, roof: 0x8dafa5, awning: 0xb77d5d, floors: 5, round: 0.08 },
  { name: "office-tower", wall: 0xafcbd0, trim: 0xe9eee0, shade: 0x6c929c, roof: 0x839da0, awning: 0x6c978b, floors: 6, round: 0.07 },
  { name: "terrace-apartment", wall: 0xeed5ac, trim: 0xffefd0, shade: 0xc09b75, roof: 0xb9a189, awning: 0xd98468, floors: 4, round: 0.18 },
  { name: "tile-roof-house", wall: 0xe7b588, trim: 0xffe6b9, shade: 0xb67d64, roof: 0xba6446, awning: 0x5b9086, floors: 1, round: 0 },
  { name: "yellow-corner-house", wall: 0xf1d293, trim: 0xffebcb, shade: 0xc8a069, roof: 0xb4a086, awning: 0xa76a62, floors: 2, round: 0.11 },
] as const;

/**
 * Fits one 96x48 tile. Place at projected centre + TILE_ANCHOR_Y with origin
 * (0.5, 1), exactly like the original Claude City building textures.
 * Variants repeat every eight; heightTier is an extra storey count, clamped 0..3.
 */
export function bakeCityBuilding(
  scene: Phaser.Scene,
  variant: number,
  heightTier: number,
  mode: "founder" | "policy" = "founder",
): BakedCityBuilding {
  const finiteVariant = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  const index = ((finiteVariant % BASE_STYLES.length) + BASE_STYLES.length) % BASE_STYLES.length;
  const tier = Math.max(0, Math.min(3, Math.trunc(heightTier) || 0));
  const original = BASE_STYLES[index];
  const civic = mode === "policy";
  const walls = civic ? [0xcfaf88,0xe6c69c,0xc9997a,0xd4bfa5,0xcfb99d,0xe2c399,0xb57861,0xd2a781] : [0xd7b9a3,0xa3bca5,0xdfd3b2,0xaac4cd,0x97b8c5,0xc6cbb5,0xbd7a64,0xe7c7a2];
  const style = { ...original, wall: walls[index], trim: civic ? 0xf1ddbf : 0xe7e6d7,
    roof: civic ? 0xb68d70 : 0x91a99e, round: civic ? 0.025 : 0.05,
    floors: civic ? Math.min(original.floors,3) : original.floors };

  const tower = index === 3 || index === 4;
  const bungalow = index === 6;
  const floors = style.floors + (bungalow ? Math.min(tier, 1) : tier);
  const floorHeight = tower ? 20 : 22;
  const body = floors * floorHeight + 5;
  const height = body + 68;
  const key = `worldline:${mode}:building:${index}:${tier}`;
  const result = { key, height, bodyHeight: body, floors, style: style.name };
  if (scene.textures.exists(key)) return result;

  const baker = createBaker(scene);
  const ox = TILE_WIDTH / 2;
  const oy = height - TILE_ANCHOR_Y;
  const half = tower ? 0.35 : 0.39;
  const ink = 0x4d6560;
  const glass = 0x456f70;
  const face = (color: number, points: Point3[], alpha = 1) =>
    fillFace(baker, color, alpha, points, ox, oy);
  const stroke = (color: number, points: Point3[], alpha = 1, width = 1) =>
    strokeFace(baker, color, alpha, width, points, ox, oy);

  // Subtle chamfered corners keep the streets legible at the default isometric zoom.
  function outline(z: number, extent = half, radius: number = style.round): Point3[] {
    const r = Math.min(radius, extent * 0.8);
    const points: Point3[] = [[-extent, -extent, z], [extent, -extent, z]];
    if (r > 0) {
      for (let step = 0; step <= 5; step++) {
        const angle = step * Math.PI / 10;
        points.push([extent - r + Math.cos(angle) * r, extent - r + Math.sin(angle) * r, z]);
      }
    } else {
      points.push([extent, extent, z]);
    }
    points.push([-extent, extent, z]);
    return points;
  }

  function extrusion(bottom: number, top: number, extent: number, color: number, radius = style.round) {
    const lower = outline(bottom, extent, radius);
    const upper = outline(top, extent, radius);
    // Only the two camera-facing walls (and the curved corner) are visible.
    for (let edge = 1; edge < upper.length - 1; edge++) {
      const a = upper[edge];
      const b = upper[edge + 1];
      const lit = edge === upper.length - 2;
      const corner = !lit && edge > 1;
      face(lit ? color : shade(color, corner ? -8 : -20), [a, b, lower[edge + 1], lower[edge]]);
    }
    face(shade(color, 8), upper);
  }

  function wallPanel(side: "u" | "v", start: number, end: number, bottom: number, top: number, color: number, offset = 0) {
    const fixed = half + offset;
    face(color, side === "v"
      ? [[start, fixed, top], [end, fixed, top], [end, fixed, bottom], [start, fixed, bottom]]
      : [[fixed, start, top], [fixed, end, top], [fixed, end, bottom], [fixed, start, bottom]]);
  }

  function balcony(side: "u" | "v", z: number) {
    const start = -half + 0.035;
    const end = half - Math.max(style.round, 0.08);
    const reach = half + 0.075;
    const points: Point3[] = side === "v"
      ? [[start, half, z], [end, half, z], [end, reach, z], [start, reach, z]]
      : [[half, start, z], [half, end, z], [reach, end, z], [reach, start, z]];
    face(side === "v" ? style.trim : shade(style.trim, -12), points);
    wallPanel(side, start, end, z - 3, z, shade(style.trim, -24), 0.075);
    wallPanel(side, start, end, z + 3, z + 4, side === "v" ? style.trim : shade(style.trim, -12), 0.075);
    for (let n = 0; n < 5; n++) {
      const s = start + (end - start) * n / 4;
      wallPanel(side, s - 0.008, s + 0.008, z, z + 4, ink, 0.075);
    }
  }

  function awning(side: "u" | "v", start: number, end: number) {
    const reach = half + 0.085;
    for (let stripe = 0; stripe < 6; stripe++) {
      const a = start + (end - start) * stripe / 6;
      const b = start + (end - start) * (stripe + 1) / 6;
      const color = stripe % 2 ? style.trim : style.awning;
      face(side === "v" ? color : shade(color, -12), side === "v"
        ? [[a, half, 17], [b, half, 17], [b, reach, 13], [a, reach, 13]]
        : [[half, a, 17], [half, b, 17], [reach, b, 13], [reach, a, 13]]);
      wallPanel(side, a, b, 10, 13, shade(color, -12), 0.085);
    }
  }

  function roofBox(u: number, v: number, size: number, bottom: number, top: number, color: number) {
    face(shade(color, -20), [[u + size, v - size, top], [u + size, v + size, top], [u + size, v + size, bottom], [u + size, v - size, bottom]]);
    face(color, [[u - size, v + size, top], [u + size, v + size, top], [u + size, v + size, bottom], [u - size, v + size, bottom]]);
    face(shade(color, 14), [[u - size, v - size, top], [u + size, v - size, top], [u + size, v + size, top], [u - size, v + size, top]]);
  }

  // Sandstone plinth and a soft pavement contact shadow.
  face(0x344f4c, [[-0.40, -0.36, 0], [0.48, -0.36, 0], [0.48, 0.47, 0], [-0.40, 0.47, 0]], 0.20);
  extrusion(0, 4, half + 0.025, 0xc8b89a);
  extrusion(4, body, half, style.wall);

  // Shop shutters, doors and the deep shade beneath striped street canopies.
  for (const side of ["u", "v"] as const) {
    for (let bay = 0; bay < 2; bay++) {
      const start = -half + 0.06 + bay * 0.25;
      const end = start + 0.19;
      wallPanel(side, start - 0.015, end + 0.015, 3, 17, style.trim);
      wallPanel(side, start, end, 3, 16, side === "v" ? 0x385b59 : 0x2d4b4c);
      if ((bay + index) % 2 === 0) {
        for (let rail = 5; rail < 14; rail += 3) wallPanel(side, start, end, rail, rail + 0.7, 0x628078);
      } else {
        wallPanel(side, start + 0.085, start + 0.10, 3, 15, 0xbaaa85);
      }
      awning(side, start - 0.035, end + 0.035);
    }
  }

  // Every upper storey has recessed windows, pale lintels and projecting slabs.
  for (let floor = 1; floor < floors; floor++) {
    const base = floor * floorHeight + 4;
    for (const side of ["u", "v"] as const) {
      for (let bay = 0; bay < 3; bay++) {
        const start = -half + 0.055 + bay * (tower ? 0.18 : 0.19);
        const end = start + (tower ? 0.12 : 0.105);
        wallPanel(side, start - 0.02, end + 0.02, base + 4, base + 15, shade(style.shade, -5));
        const pane = (floor + bay + index) % 7 === 0 ? 0xdbbc77 : glass;
        wallPanel(side, start, end, base + 5, base + 14, side === "v" ? pane : shade(pane, -14));
        wallPanel(side, start - 0.02, end + 0.02, base + 14, base + 16, style.trim);
        wallPanel(side, start - 0.025, end + 0.025, base + 3, base + 5, style.trim);
        if (tower) wallPanel(side, start + 0.053, start + 0.064, base + 5, base + 14, 0xadc7bf);
      }
      if (!tower || floor % 2 === 1) balcony(side, base + 2);
    }
    if (style.round > 0.10) extrusion(base, base + 2, half + 0.015, style.trim);
  }

  if (bungalow) {
    // Four tiled roof planes; the warm pitch distinguishes low Bandra houses.
    const roofEdge = outline(body + 2, half + 0.055, 0);
    const peak: Point3 = [-0.055, -0.055, body + 17];
    for (let edge = 0; edge < roofEdge.length; edge++) {
      face(edge < 2 ? shade(style.roof, -15) : style.roof, [roofEdge[edge], roofEdge[(edge + 1) % roofEdge.length], peak]);
    }
    for (let line = 1; line < 5; line++) {
      const z = body + 2 + line * 2.5;
      const h = (half + 0.055) * (1 - line / 6);
      stroke(0xd28b60, outline(z, h, 0), 0.65, 0.65);
    }
  } else {
    // An inhabited terrace: low parapet, stair room and a black water tank.
    extrusion(body, body + 4, half + 0.025, style.trim);
    face(style.roof, outline(body + 4.5, half - 0.045));
    stroke(shade(style.trim, -15), outline(body + 5, half + 0.01), 0.85);
    roofBox(-0.13, -0.14, tower ? 0.15 : 0.105, body + 5, body + (tower ? 17 : 13), style.wall);
    const tank = baker.at([0.12, -0.10, body + 16], ox, oy);
    baker.graphics.fillStyle(0x38494c, 1);
    baker.graphics.fillRect(tank.x - 6, tank.y, 12, 8);
    baker.graphics.fillEllipse(tank.x, tank.y + 8, 12, 5);
    baker.graphics.fillStyle(0x566267, 1);
    baker.graphics.fillEllipse(tank.x, tank.y, 12, 5);
    baker.graphics.lineStyle(1, 0x73817e, 0.6);
    baker.graphics.lineBetween(tank.x - 5, tank.y + 4, tank.x + 5, tank.y + 4);
    const plant = baker.at([-0.23, 0.20, body + 7], ox, oy);
    baker.graphics.fillStyle(0xa86e50, 1);
    baker.graphics.fillRect(plant.x - 2, plant.y, 5, 4);
    baker.graphics.fillStyle(0x557c5c, 1);
    baker.graphics.fillCircle(plant.x, plant.y - 2, 3);
    baker.graphics.fillStyle(0x82a06a, 1);
    baker.graphics.fillCircle(plant.x + 2, plant.y - 3, 2);
  }

  baker.finish(key, TILE_WIDTH, height);
  baker.destroy();
  return result;
}
