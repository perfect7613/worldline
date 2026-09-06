/**
 * Vidhana Soudha — original isometric stylization for Worldline.
 *
 * Photo reference (CC0, Wilhelm Tell DCCXLVI):
 * https://commons.wikimedia.org/wiki/File:Vidhana_Soudha,_14_February_2022.jpg
 * local: public/landmarks/vidhana-soudha.jpg
 * Official architectural overview: https://kla.kar.nic.in/council/vds.htm
 *
 * Geometry is original procedural art, not a downloaded model or trace.
 * Illustrative Neo-Dravidian legislature massing — not a measured survey.
 *
 * Sprite placement (parent owns wiring):
 *   x = proj.x, y = proj.y + VIDHANA_ANCHOR_Y * VIDHANA_SCALE, origin (0.5, 1)
 * Reserved precinct world x 12..20, y 12..21; building centre ~16,15.
 * Front stairs stay within y+3.5 of that centre.
 */

import * as Phaser from "phaser";
import {
  createBaker,
  fillFace,
  strokeFace,
  shade,
  type Baker,
  type Point3,
} from "../claude-city/textures/core";

export const VIDHANA_KEY = "landmark:vidhana-soudha";

/** Texture scale. Parent places at projected centre + anchor * scale. */
export const VIDHANA_SCALE = 0.95;

/**
 * Pixels reserved below the projected ground centre (u=v=z=0).
 * originY = textureHeight - VIDHANA_ANCHOR_Y.
 */
export const VIDHANA_ANCHOR_Y = 210;

const TEX_W = 1000;
const TEX_H = 720;

const U0 = -4;
const U1 = 4;
const V0 = -1.7;
const V1 = 1.7;
const PORCH_V = 2.15;
const STAIR_V = 3.4;

const PLINTH = 16;
const S1 = 58;
const S2 = 100;
const S3 = 138;
const CORNICE = 148;
const PARAPET = 160;
const CENTER_TOP = 170;

const STONE = {
  lit: 0xf3e6cc,
  mid: 0xe4d2b0,
  warm: 0xd4be96,
  taupe: 0x9a8570,
  shade: 0x7d6b58,
  edge: 0x6a5848,
  plinth: 0xcfc0a2,
  step: 0xd8cbb0,
  riser: 0xb6a48a,
} as const;

const WINDOW = 0x243848;
const WINDOW_DEEP = 0x1a2834;
const PALE = 0xf7f0e2;
const GOLD = 0xd4a24a;
const GOLD_DARK = 0x8f6a28;
const FLAG_SAFFRON = 0xff9933;
const FLAG_WHITE = 0xf4f1ea;
const FLAG_GREEN = 0x138808;
const NAVY = 0x1c3a6e;

type FaceColors = { top: number; right: number; left: number };

const GRANITE: FaceColors = {
  top: STONE.lit,
  right: STONE.taupe,
  left: STONE.warm,
};

function ring(cu: number, cv: number, radius: number, z: number, segments: number): Point3[] {
  const points: Point3[] = [];
  for (let i = 0; i < segments; i += 1) {
    const a = (Math.PI * 2 * i) / segments;
    points.push([cu + Math.cos(a) * radius, cv + Math.sin(a) * radius, z]);
  }
  return points;
}

function octagon(cu: number, cv: number, half: number, chamfer: number, z: number): Point3[] {
  const h = half;
  const c = chamfer;
  return [
    [cu - h + c, cv - h, z],
    [cu + h - c, cv - h, z],
    [cu + h, cv - h + c, z],
    [cu + h, cv + h - c, z],
    [cu + h - c, cv + h, z],
    [cu - h + c, cv + h, z],
    [cu - h, cv + h - c, z],
    [cu - h, cv - h + c, z],
  ];
}

function prism(
  baker: Baker,
  ox: number,
  oy: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
  colors: FaceColors,
): void {
  fillFace(baker, colors.top, 1, [
    [u0, v0, z1],
    [u1, v0, z1],
    [u1, v1, z1],
    [u0, v1, z1],
  ], ox, oy);
  fillFace(baker, colors.right, 1, [
    [u1, v0, z1],
    [u1, v1, z1],
    [u1, v1, z0],
    [u1, v0, z0],
  ], ox, oy);
  fillFace(baker, colors.left, 1, [
    [u0, v1, z1],
    [u1, v1, z1],
    [u1, v1, z0],
    [u0, v1, z0],
  ], ox, oy);
}

function wallBand(
  baker: Baker,
  ox: number,
  oy: number,
  axis: "u" | "v",
  wall: number,
  along0: number,
  along1: number,
  z0: number,
  z1: number,
  color: number,
): void {
  const pts: Point3[] = axis === "v"
    ? [[along0, wall, z1], [along1, wall, z1], [along1, wall, z0], [along0, wall, z0]]
    : [[wall, along0, z1], [wall, along1, z1], [wall, along1, z0], [wall, along0, z0]];
  fillFace(baker, color, 1, pts, ox, oy);
}

/** Rectangular bay with a shallow scalloped (not pointed) arch head. */
function scallopedOpening(
  axis: "u" | "v",
  wall: number,
  centre: number,
  half: number,
  z0: number,
  z1: number,
): Point3[] {
  const spring = z0 + (z1 - z0) * 0.72;
  const samples = 6;
  const at = (along: number, z: number): Point3 =>
    axis === "u" ? [wall, along, z] : [along, wall, z];
  const pts: Point3[] = [at(centre - half, z0), at(centre - half, spring)];
  for (let i = 1; i < samples; i += 1) {
    const t = i / samples;
    const along = centre - half + 2 * half * t;
    const arch = Math.sin(t * Math.PI);
    pts.push(at(along, spring + (z1 - spring) * arch));
  }
  pts.push(at(centre + half, spring), at(centre + half, z0));
  return pts;
}

function facadeWindowBand(
  baker: Baker,
  ox: number,
  oy: number,
  axis: "u" | "v",
  wall: number,
  from: number,
  to: number,
  z0: number,
  z1: number,
  bays: number,
  deep: boolean,
): void {
  const span = to - from;
  const bay = span / bays;
  const pier = bay * 0.22;
  const face = axis === "v" ? STONE.mid : STONE.taupe;
  wallBand(baker, ox, oy, axis, wall, from, to, z0, z1, face);
  for (let i = 0; i < bays; i += 1) {
    const a = from + i * bay;
    const b = a + bay;
    wallBand(baker, ox, oy, axis, wall + 0.004, a, a + pier, z0, z1, STONE.lit);
    const c = a + pier + (bay - pier) * 0.5;
    const half = (bay - pier) * 0.36;
    const inset = axis === "v" ? wall - 0.012 : wall - 0.01;
    const outer = scallopedOpening(axis, wall + 0.006, c, half + 0.01, z0 + 5, z1 - 4);
    fillFace(baker, shade(STONE.warm, axis === "v" ? -4 : -12), 1, outer, ox, oy);
    const inner = scallopedOpening(axis, inset, c, half, z0 + 7, z1 - 7);
    fillFace(baker, deep ? WINDOW_DEEP : WINDOW, 1, inner, ox, oy);
    if (i > 0) {
      wallBand(baker, ox, oy, axis, wall + 0.01, a - 0.018, a + 0.018, z0, z1, STONE.lit);
    }
  }
}

function loggiaBand(
  baker: Baker,
  ox: number,
  oy: number,
  axis: "u" | "v",
  wall: number,
  from: number,
  to: number,
  z0: number,
  z1: number,
  bays: number,
): void {
  const recess = axis === "v" ? wall - 0.1 : wall - 0.08;
  wallBand(baker, ox, oy, axis, wall, from, to, z0, z1, shade(STONE.taupe, -8));
  wallBand(baker, ox, oy, axis, recess, from + 0.04, to - 0.04, z0 + 2, z1 - 3, WINDOW);
  const bay = (to - from) / bays;
  for (let i = 0; i <= bays; i += 1) {
    const along = from + i * bay;
    const hu = 0.018;
    if (axis === "v") {
      prism(baker, ox, oy, along - hu, along + hu, recess, wall + 0.02, z0 + 2, z1 - 2, {
        top: PALE,
        right: shade(PALE, -18),
        left: PALE,
      });
    } else {
      prism(baker, ox, oy, recess, wall + 0.02, along - hu, along + hu, z0 + 2, z1 - 2, {
        top: PALE,
        right: shade(PALE, -18),
        left: shade(PALE, -8),
      });
    }
  }
  wallBand(baker, ox, oy, axis, wall + 0.03, from, to, z1 - 5, z1, STONE.lit);
}

function corniceSlab(
  baker: Baker,
  ox: number,
  oy: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
  over = 0.08,
): void {
  prism(baker, ox, oy, u0 - over, u1 + over, v0 - over * 0.4, v1 + over, z0, z1, {
    top: STONE.lit,
    right: STONE.shade,
    left: STONE.warm,
  });
}

function column(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  z0: number,
  z1: number,
  radius: number,
): void {
  const base = z0 + 7;
  const neck = z1 - 8;
  prism(baker, ox, oy, cu - radius * 1.55, cu + radius * 1.55, cv - radius * 1.55, cv + radius * 1.55, z0, base, {
    top: PALE,
    right: shade(PALE, -22),
    left: shade(STONE.mid, 6),
  });
  const segments = 10;
  const top = ring(cu, cv, radius, neck, segments);
  const bot = ring(cu, cv, radius * 1.05, base, segments);
  const slices: { depth: number; pts: Point3[]; color: number }[] = [];
  for (let i = 0; i < segments; i += 1) {
    const n = (i + 1) % segments;
    const a = top[i] as Point3;
    const b = top[n] as Point3;
    const mid = (Math.PI * 2 * (i + 0.5)) / segments;
    slices.push({
      depth: (a[0] + b[0] + a[1] + b[1]) / 2,
      pts: [a, b, bot[n] as Point3, bot[i] as Point3],
      color: shade(PALE, Math.round(8 * Math.sin(mid) - 20 * Math.cos(mid))),
    });
  }
  slices.sort((l, r) => l.depth - r.depth);
  for (const slice of slices) {
    fillFace(baker, slice.color, 1, slice.pts, ox, oy);
  }
  prism(baker, ox, oy, cu - radius * 1.7, cu + radius * 1.7, cv - radius * 1.45, cv + radius * 1.45, neck, z1, {
    top: STONE.lit,
    right: STONE.taupe,
    left: STONE.warm,
  });
  prism(baker, ox, oy, cu - radius * 1.15, cu + radius * 1.15, cv - radius * 1.15, cv + radius * 1.15, z1, z1 + 3, {
    top: PALE,
    right: shade(PALE, -16),
    left: PALE,
  });
}

/** Broad, fat, shallow cap — circular profile, no onion waist or pointed finial. */
function shallowDome(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  radius: number,
  z0: number,
  z1: number,
): void {
  const tiers = 10;
  const segments = 20;
  for (let tier = 0; tier < tiers; tier += 1) {
    const t0 = tier / tiers;
    const t1 = (tier + 1) / tiers;
    const rise = (t: number) => Math.cos((t * Math.PI) / 2);
    const r0 = radius * rise(t0);
    const r1 = radius * rise(t1);
    const h0 = z0 + (z1 - z0) * Math.sin((t0 * Math.PI) / 2);
    const h1 = z0 + (z1 - z0) * Math.sin((t1 * Math.PI) / 2);
    const top = ring(cu, cv, Math.max(r1, 0.02), h1, segments);
    const bot = ring(cu, cv, Math.max(r0, 0.02), h0, segments);
    const slices: { depth: number; pts: Point3[]; color: number }[] = [];
    for (let i = 0; i < segments; i += 1) {
      const n = (i + 1) % segments;
      const a = top[i] as Point3;
      const b = top[n] as Point3;
      const mid = (Math.PI * 2 * (i + 0.5)) / segments;
      slices.push({
        depth: (a[0] + b[0] + a[1] + b[1]) / 2,
        pts: [a, b, bot[n] as Point3, bot[i] as Point3],
        color: shade(STONE.mid, Math.round(10 * Math.sin(mid) - 22 * Math.cos(mid))),
      });
    }
    slices.sort((l, r) => l.depth - r.depth);
    for (const slice of slices) {
      fillFace(baker, slice.color, 1, slice.pts, ox, oy);
    }
  }
  fillFace(baker, shade(STONE.lit, 6), 1, ring(cu, cv, radius * 0.18, z1, 12), ox, oy);
}

function drum(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  half: number,
  z0: number,
  z1: number,
): void {
  const chamfer = half * 0.28;
  const top = octagon(cu, cv, half, chamfer, z1);
  const bot = octagon(cu, cv, half, chamfer, z0);
  const walls: { depth: number; pts: Point3[]; color: number }[] = [];
  for (let i = 0; i < 8; i += 1) {
    const n = (i + 1) % 8;
    const a = top[i] as Point3;
    const b = top[n] as Point3;
    const midU = (a[0] + b[0]) / 2;
    const midV = (a[1] + b[1]) / 2;
    walls.push({
      depth: midU + midV,
      pts: [a, b, bot[n] as Point3, bot[i] as Point3],
      color: shade(STONE.mid, Math.round((-midU * 0.6 + midV * 0.4) * 16)),
    });
  }
  walls.sort((l, r) => l.depth - r.depth);
  for (const wall of walls) {
    fillFace(baker, wall.color, 1, wall.pts, ox, oy);
  }
  fillFace(baker, STONE.lit, 1, top, ox, oy);
  strokeFace(baker, STONE.edge, 0.4, 1, top, ox, oy);
  for (let i = 0; i < 8; i += 1) {
    const p = top[i] as Point3;
    const q = top[(i + 1) % 8] as Point3;
    const mu = (p[0] + q[0]) / 2;
    const mv = (p[1] + q[1]) / 2;
    if (mu + mv < cu + cv - 0.05) {
      continue;
    }
    const niche = scallopedOpening(
      Math.abs(p[0] - q[0]) > Math.abs(p[1] - q[1]) ? "v" : "u",
      Math.abs(p[0] - q[0]) > Math.abs(p[1] - q[1]) ? mv : mu,
      Math.abs(p[0] - q[0]) > Math.abs(p[1] - q[1]) ? mu : mv,
      half * 0.12,
      z0 + 8,
      z1 - 6,
    );
    fillFace(baker, WINDOW, 1, niche, ox, oy);
  }
}

function slopedEaves(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  inner: number,
  outer: number,
  zTop: number,
  zBot: number,
): void {
  const faces: Array<{ depth: number; pts: Point3[]; color: number }> = [
    {
      depth: cu + 1,
      color: STONE.taupe,
      pts: [
        [cu + inner, cv - inner, zTop],
        [cu + inner, cv + inner, zTop],
        [cu + outer, cv + outer, zBot],
        [cu + outer, cv - outer, zBot],
      ],
    },
    {
      depth: cv + 1,
      color: STONE.warm,
      pts: [
        [cu - inner, cv + inner, zTop],
        [cu + inner, cv + inner, zTop],
        [cu + outer, cv + outer, zBot],
        [cu - outer, cv + outer, zBot],
      ],
    },
  ];
  faces.sort((a, b) => a.depth - b.depth);
  for (const face of faces) {
    fillFace(baker, face.color, 1, face.pts, ox, oy);
  }
  fillFace(baker, STONE.lit, 1, [
    [cu - inner, cv - inner, zTop],
    [cu + inner, cv - inner, zTop],
    [cu + inner, cv + inner, zTop],
    [cu - inner, cv + inner, zTop],
  ], ox, oy);
}

function balustrade(
  baker: Baker,
  ox: number,
  oy: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  z: number,
  step: number,
): void {
  const beads: Array<readonly [number, number]> = [];
  for (let u = u0; u <= u1 + 0.001; u += step) {
    beads.push([u, v0], [u, v1]);
  }
  for (let v = v0 + step; v < v1; v += step) {
    beads.push([u0, v], [u1, v]);
  }
  beads.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [u, v] of beads) {
    const p = baker.at([u, v, z + 7], ox, oy);
    baker.graphics.fillStyle(STONE.lit, 1);
    baker.graphics.fillCircle(p.x, p.y, 1.7);
    const stem = baker.at([u, v, z], ox, oy);
    baker.graphics.lineStyle(1, STONE.edge, 0.65);
    baker.graphics.lineBetween(stem.x, stem.y, p.x, p.y);
  }
}

function lionEmblem(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  z: number,
): void {
  prism(baker, ox, oy, cu - 0.07, cu + 0.07, cv - 0.07, cv + 0.07, z, z + 5, {
    top: GOLD,
    right: GOLD_DARK,
    left: GOLD,
  });
  const base = baker.at([cu, cv, z + 6], ox, oy);
  baker.graphics.fillStyle(GOLD, 1);
  baker.graphics.fillTriangle(base.x - 5, base.y, base.x - 2, base.y - 11, base.x + 1, base.y);
  baker.graphics.fillTriangle(base.x - 1, base.y, base.x + 1, base.y - 13, base.x + 4, base.y);
  baker.graphics.fillTriangle(base.x + 2, base.y, base.x + 6, base.y - 10, base.x + 7, base.y + 1);
  baker.graphics.fillStyle(GOLD_DARK, 1);
  baker.graphics.fillCircle(base.x + 1, base.y - 4, 1.6);
}

function clockRoundel(
  baker: Baker,
  ox: number,
  oy: number,
  u: number,
  v: number,
  z: number,
): void {
  const c = baker.at([u, v, z], ox, oy);
  baker.graphics.fillStyle(STONE.lit, 1);
  baker.graphics.fillCircle(c.x, c.y, 7);
  baker.graphics.lineStyle(1.5, STONE.edge, 0.85);
  baker.graphics.strokeCircle(c.x, c.y, 7);
  baker.graphics.lineStyle(1, GOLD_DARK, 0.9);
  for (let i = 0; i < 8; i += 1) {
    const a = (Math.PI * 2 * i) / 8;
    baker.graphics.lineBetween(
      c.x + Math.cos(a) * 2,
      c.y + Math.sin(a) * 2,
      c.x + Math.cos(a) * 5.5,
      c.y + Math.sin(a) * 5.5,
    );
  }
}

function flagpole(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  z0: number,
  z1: number,
): void {
  prism(baker, ox, oy, cu - 0.03, cu + 0.03, cv - 0.03, cv + 0.03, z0, z1, {
    top: 0xc9b48a,
    right: 0x6d5a44,
    left: 0x8a7458,
  });
  const top = baker.at([cu, cv, z1], ox, oy);
  const mid = baker.at([cu - 0.55, cv + 0.02, z1 - 18], ox, oy);
  const bot = baker.at([cu - 0.55, cv + 0.02, z1 - 36], ox, oy);
  const hang = baker.at([cu, cv, z1 - 4], ox, oy);
  const h = bot.y - hang.y;
  baker.graphics.fillStyle(FLAG_SAFFRON, 1);
  baker.graphics.fillTriangle(hang.x, hang.y, mid.x, mid.y, hang.x + 1, hang.y + h * 0.34);
  baker.graphics.fillStyle(FLAG_WHITE, 1);
  baker.graphics.fillRect(Math.min(hang.x, mid.x), hang.y + h * 0.28, Math.abs(mid.x - hang.x), h * 0.28);
  baker.graphics.fillStyle(FLAG_GREEN, 1);
  baker.graphics.fillTriangle(hang.x, hang.y + h * 0.55, mid.x, bot.y - 2, hang.x + 1, hang.y + h * 0.92);
  baker.graphics.fillStyle(NAVY, 1);
  baker.graphics.fillCircle((hang.x + mid.x) * 0.5, hang.y + h * 0.42, 1.4);
  baker.graphics.fillStyle(GOLD, 1);
  baker.graphics.fillCircle(top.x, top.y, 2);
}

function wingMass(
  baker: Baker,
  ox: number,
  oy: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  frontBays: number,
): void {
  prism(baker, ox, oy, u0, u1, v0, v1, 0, PLINTH, {
    top: STONE.plinth,
    right: STONE.shade,
    left: STONE.warm,
  });
  prism(baker, ox, oy, u0, u1, v0, v1, PLINTH, S3, GRANITE);
  corniceSlab(baker, ox, oy, u0, u1, v0, v1, S1 - 3, S1 + 2, 0.05);
  corniceSlab(baker, ox, oy, u0, u1, v0, v1, S2 - 3, S2 + 2, 0.05);
  facadeWindowBand(baker, ox, oy, "v", v1, u0 + 0.08, u1 - 0.08, PLINTH + 6, S1 - 6, frontBays, true);
  facadeWindowBand(baker, ox, oy, "v", v1, u0 + 0.08, u1 - 0.08, S1 + 6, S2 - 6, frontBays, true);
  loggiaBand(baker, ox, oy, "v", v1, u0 + 0.1, u1 - 0.1, S2 + 5, S3 - 4, frontBays);
  facadeWindowBand(baker, ox, oy, "u", u1, v0 + 0.1, v1 - 0.1, PLINTH + 8, S1 - 6, 4, true);
  facadeWindowBand(baker, ox, oy, "u", u1, v0 + 0.1, v1 - 0.1, S1 + 6, S2 - 6, 4, false);
  loggiaBand(baker, ox, oy, "u", u1, v0 + 0.12, v1 - 0.12, S2 + 5, S3 - 4, 4);
  corniceSlab(baker, ox, oy, u0, u1, v0, v1, S3, CORNICE, 0.1);
  prism(baker, ox, oy, u0 + 0.06, u1 - 0.06, v0 + 0.06, v1 - 0.06, CORNICE, PARAPET, {
    top: shade(STONE.lit, 4),
    right: STONE.taupe,
    left: STONE.warm,
  });
  balustrade(baker, ox, oy, u0 + 0.12, u1 - 0.12, v0 + 0.1, v1 - 0.08, PARAPET, 0.22);
}

function cornerTower(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  half: number,
  clock: boolean,
): void {
  const bodyTop = S3 + 18;
  prism(baker, ox, oy, cu - half, cu + half, cv - half, cv + half, 0, PLINTH, {
    top: STONE.plinth,
    right: STONE.shade,
    left: STONE.warm,
  });
  prism(baker, ox, oy, cu - half, cu + half, cv - half, cv + half, PLINTH, bodyTop, GRANITE);
  facadeWindowBand(baker, ox, oy, "v", cv + half, cu - half + 0.08, cu + half - 0.08, PLINTH + 8, S1 - 6, 2, true);
  facadeWindowBand(baker, ox, oy, "v", cv + half, cu - half + 0.08, cu + half - 0.08, S1 + 6, S2 - 6, 2, true);
  loggiaBand(baker, ox, oy, "v", cv + half, cu - half + 0.1, cu + half - 0.1, S2 + 4, S3 - 2, 3);
  facadeWindowBand(baker, ox, oy, "u", cu + half, cv - half + 0.08, cv + half - 0.08, PLINTH + 8, S1 - 6, 2, true);
  if (clock) {
    clockRoundel(baker, ox, oy, cu, cv + half + 0.01, S2 + 10);
  }
  const eaveTop = bodyTop + 10;
  slopedEaves(baker, ox, oy, cu, cv, half * 0.92, half + 0.16, eaveTop, bodyTop);
  drum(baker, ox, oy, cu, cv, half * 0.62, eaveTop, eaveTop + 16);
  shallowDome(baker, ox, oy, cu, cv, half * 0.7, eaveTop + 16, eaveTop + 40);
}

function roofPavilion(
  baker: Baker,
  ox: number,
  oy: number,
  cu: number,
  cv: number,
  half: number,
): void {
  const z0 = PARAPET - 2;
  prism(baker, ox, oy, cu - half, cu + half, cv - half, cv + half, z0, z0 + 22, GRANITE);
  wallBand(baker, ox, oy, "v", cv + half, cu - half + 0.06, cu + half - 0.06, z0 + 4, z0 + 16, WINDOW);
  slopedEaves(baker, ox, oy, cu, cv, half * 0.88, half + 0.14, z0 + 30, z0 + 20);
  drum(baker, ox, oy, cu, cv, half * 0.55, z0 + 30, z0 + 42);
  shallowDome(baker, ox, oy, cu, cv, half * 0.62, z0 + 42, z0 + 62);
}

function stairs(
  baker: Baker,
  ox: number,
  oy: number,
): void {
  const strips = 10;
  const u0 = -1.38;
  const u1 = 1.38;
  const vStart = V1 + 0.02;
  for (let s = 0; s < strips; s += 1) {
    const t0 = s / strips;
    const t1 = (s + 1) / strips;
    const va = vStart + (STAIR_V - vStart) * t0;
    const vb = vStart + (STAIR_V - vStart) * t1;
    const zTop = PLINTH * (1 - t0);
    const zNext = PLINTH * (1 - t1);
    fillFace(baker, s % 2 === 0 ? STONE.step : shade(STONE.step, -6), 1, [
      [u0, va, zTop],
      [u1, va, zTop],
      [u1, vb, zTop],
      [u0, vb, zTop],
    ], ox, oy);
    fillFace(baker, STONE.riser, 1, [
      [u0, vb, zTop],
      [u1, vb, zTop],
      [u1, vb, zNext],
      [u0, vb, zNext],
    ], ox, oy);
  }
  const railZ = 14;
  for (const side of [-1, 1] as const) {
    const u = side < 0 ? u0 - 0.1 : u1;
    prism(baker, ox, oy, u, u + 0.1, vStart, STAIR_V - 0.08, 0, railZ, {
      top: STONE.lit,
      right: STONE.shade,
      left: STONE.warm,
    });
    const pedU0 = side < 0 ? u0 - 0.22 : u1 + 0.02;
    prism(baker, ox, oy, pedU0, pedU0 + 0.2, STAIR_V - 0.22, STAIR_V - 0.02, 0, 22, {
      top: STONE.lit,
      right: STONE.taupe,
      left: STONE.warm,
    });
    const capU = pedU0 + 0.1;
    const cap = baker.at([capU, STAIR_V - 0.12, 26], ox, oy);
    baker.graphics.fillStyle(STONE.lit, 1);
    baker.graphics.fillCircle(cap.x, cap.y, 3);
  }
}

function portico(baker: Baker, ox: number, oy: number): void {
  const u0 = -1.32;
  const u1 = 1.32;
  const v0 = 1.35;
  prism(baker, ox, oy, u0, u1, v0, PORCH_V, 0, PLINTH, {
    top: STONE.plinth,
    right: STONE.shade,
    left: STONE.warm,
  });
  wallBand(baker, ox, oy, "v", v0 + 0.02, u0 + 0.08, u1 - 0.08, PLINTH, S2 + 4, WINDOW_DEEP);
  const doorU = 0.28;
  wallBand(baker, ox, oy, "v", v0 + 0.04, -doorU, doorU, PLINTH + 2, S1 - 4, 0x1a2230);
  const colV = 1.92;
  const xs = [-1.12, -0.67, -0.22, 0.22, 0.67, 1.12];
  const sorted = [...xs].sort((a, b) => a + colV - (b + colV));
  for (const u of sorted) {
    column(baker, ox, oy, u, colV, PLINTH, S2 + 6, 0.075);
  }
  corniceSlab(baker, ox, oy, u0, u1, v0, PORCH_V + 0.06, S2 + 8, S2 + 18, 0.14);
  wallBand(baker, ox, oy, "v", PORCH_V + 0.07, u0 + 0.05, u1 - 0.05, S2 + 12, S2 + 17, shade(STONE.warm, -8));
  baker.graphics.lineStyle(1, GOLD, 0.35);
  const mottoA = baker.at([u0 + 0.2, PORCH_V + 0.08, S2 + 15], ox, oy);
  const mottoB = baker.at([u1 - 0.2, PORCH_V + 0.08, S2 + 15], ox, oy);
  baker.graphics.lineBetween(mottoA.x, mottoA.y, mottoB.x, mottoB.y);
  prism(baker, ox, oy, u0 - 0.02, u1 + 0.02, v0, PORCH_V + 0.04, S2 + 18, S2 + 26, {
    top: STONE.lit,
    right: STONE.taupe,
    left: STONE.warm,
  });
  balustrade(baker, ox, oy, u0 + 0.08, u1 - 0.08, v0 + 0.08, PORCH_V - 0.04, S2 + 26, 0.16);
}

function centralBlock(baker: Baker, ox: number, oy: number): void {
  const u0 = -1.42;
  const u1 = 1.42;
  const v0 = -1.15;
  prism(baker, ox, oy, u0, u1, v0, V1, 0, PLINTH, {
    top: STONE.plinth,
    right: STONE.shade,
    left: STONE.warm,
  });
  prism(baker, ox, oy, u0, u1, v0, V1, PLINTH, CENTER_TOP, GRANITE);
  corniceSlab(baker, ox, oy, u0, u1, v0, V1, S1 - 3, S1 + 2, 0.06);
  corniceSlab(baker, ox, oy, u0, u1, v0, V1, S2 - 3, S2 + 2, 0.06);
  facadeWindowBand(baker, ox, oy, "u", u1, v0 + 0.12, 1.2, PLINTH + 8, S1 - 6, 3, true);
  facadeWindowBand(baker, ox, oy, "u", u1, v0 + 0.12, 1.2, S1 + 6, S2 - 6, 3, false);
  loggiaBand(baker, ox, oy, "u", u1, v0 + 0.14, 1.15, S2 + 5, S3 - 2, 3);
  corniceSlab(baker, ox, oy, u0, u1, v0, V1, S3, CORNICE + 4, 0.1);
  prism(baker, ox, oy, u0 + 0.1, u1 - 0.1, v0 + 0.1, V1 - 0.08, CORNICE + 4, CENTER_TOP, {
    top: STONE.lit,
    right: STONE.taupe,
    left: STONE.warm,
  });
}

function modestRear(baker: Baker, ox: number, oy: number): void {
  prism(baker, ox, oy, U0 + 0.15, U1 - 0.15, V0, V0 + 0.55, 0, S3 - 8, {
    top: shade(STONE.mid, -4),
    right: shade(STONE.taupe, -6),
    left: shade(STONE.warm, -10),
  });
  facadeWindowBand(baker, ox, oy, "u", U1 - 0.15, V0 + 0.08, V0 + 0.5, PLINTH + 8, S2 - 8, 2, true);
}

export function bakeVidhanaSoudha(scene: Phaser.Scene): void {
  if (scene.textures.exists(VIDHANA_KEY)) {
    return;
  }

  const baker = createBaker(scene);
  const ox = TEX_W / 2;
  const oy = TEX_H - VIDHANA_ANCHOR_Y;

  fillFace(baker, 0x1a2430, 0.18, [
    [U0 + 0.15, V0 + 0.2, 0],
    [U1 + 0.2, V0 + 0.15, 0],
    [U1 + 0.15, V1 + 0.15, 0],
    [U0 + 0.1, V1 + 0.2, 0],
  ], ox, oy);

  modestRear(baker, ox, oy);

  const leftU1 = -1.48;
  const rightU0 = 1.48;
  wingMass(baker, ox, oy, U0, leftU1, V0 + 0.15, V1, 9);
  wingMass(baker, ox, oy, rightU0, U1, V0 + 0.15, V1, 9);

  centralBlock(baker, ox, oy);

  const towers: Array<{ u: number; v: number; half: number; clock: boolean; depth: number }> = [
    { u: -3.58, v: 1.18, half: 0.42, clock: true, depth: -3.58 + 1.18 },
    { u: 3.58, v: 1.18, half: 0.42, clock: false, depth: 3.58 + 1.18 },
  ];
  towers.sort((a, b) => a.depth - b.depth);
  for (const tower of towers) {
    cornerTower(baker, ox, oy, tower.u, tower.v, tower.half, tower.clock);
  }

  const pavilions: Array<readonly [number, number]> = [
    [-1.58, 0.28],
    [1.58, 0.28],
  ];
  pavilions.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  for (const [u, v] of pavilions) {
    roofPavilion(baker, ox, oy, u, v, 0.34);
  }

  drum(baker, ox, oy, 0, 0.05, 0.92, CENTER_TOP - 4, CENTER_TOP + 22);
  corniceSlab(baker, ox, oy, -0.78, 0.78, -0.7, 0.78, CENTER_TOP + 20, CENTER_TOP + 26, 0.04);
  drum(baker, ox, oy, 0, 0.05, 0.78, CENTER_TOP + 26, CENTER_TOP + 40);
  shallowDome(baker, ox, oy, 0, 0.05, 0.88, CENTER_TOP + 40, CENTER_TOP + 96);
  lionEmblem(baker, ox, oy, 0, 0.05, CENTER_TOP + 96);

  portico(baker, ox, oy);
  stairs(baker, ox, oy);
  flagpole(baker, ox, oy, -0.62, 1.72, S2 + 26, CENTER_TOP + 118);

  baker.finish(VIDHANA_KEY, TEX_W, TEX_H);
  baker.destroy();
}
