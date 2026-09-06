import type * as Phaser from "phaser";
import { createBaker, fillFace, strokeFace, type Point3 } from "../claude-city/textures/core";

/**
 * Original isometric interpretation of India's current Parliament House (2023).
 * Architectural reference: Ministry of Parliamentary Affairs aerial photograph,
 * public/landmarks/parliament-new-delhi.jpg; this is the triangular building in
 * the foreground, not the historic circular Parliament behind it.
 * https://commons.wikimedia.org/wiki/File:Glimpse_of_the_new_Parliament_Building,_in_New_Delhi.jpg
 * https://centralvista.gov.in/know-central-vista-plan.php
 * Shapes are simplified for city scale; they are not an architectural survey.
 */
export const PARLIAMENT_KEY = "landmark:parliament-new-delhi";
export const PARLIAMENT_SCALE = 1;
/** Place origin(0.5,1) at projected centre + this offset * scale. */
export const PARLIAMENT_ANCHOR_Y = 220;

type UV = readonly [number, number];
const WIDTH = 700;
const HEIGHT = 560;
const OX = WIDTH / 2;
const OY = HEIGHT - PARLIAMENT_ANCHOR_Y;
const TRIANGLE: UV[] = [[-3.55, 0.05], [0.05, -3.55], [3.5, 3.5]];
const C = {
  sandstone: 0xe7c6a2, cream: 0xf2d8b4, shade: 0xc09475,
  red: 0xb67658, redDark: 0x925b49, redLight: 0xcb9470,
  roof: 0xb8bdb8, roofLight: 0xd8dcd4, roofShade: 0x9aaba9,
  edge: 0x737f79, window: 0x3e5857, court: 0xb9b097, green: 0x578064,
};

const mix = (a: UV, b: UV, t: number): UV => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function chamferedTriangle(scale = 1): UV[] {
  return TRIANGLE.flatMap((vertex, index) => [
    mix(vertex, TRIANGLE[(index + 2) % 3], 0.15),
    mix(vertex, TRIANGLE[(index + 1) % 3], 0.15),
  ]).map(([u, v]) => [u * scale, v * scale]);
}
const atHeight = (outline: readonly UV[], height: number): Point3[] => outline.map(([u, v]) => [u, v, height]);

export function bakeParliament(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARLIAMENT_KEY)) return;
  const baker = createBaker(scene);
  const g = baker.graphics;
  const face = (color: number, points: readonly Point3[], alpha = 1) => fillFace(baker, color, alpha, points, OX, OY);
  const line = (color: number, points: readonly Point3[], alpha = 1, width = 1) => strokeFace(baker, color, alpha, width, points, OX, OY);
  const ground = chamferedTriangle(1.1);
  const outer = chamferedTriangle();
  const inner = chamferedTriangle(0.74);

  function prism(outline: readonly UV[], bottom: number, top: number, color: number, roof: number, allWalls = false) {
    const faces = outline.map((a, index) => {
      const b = outline[(index + 1) % outline.length];
      const facing = (b[1] - a[1]) - (b[0] - a[0]);
      return { depth: a[0] + b[0] + a[1] + b[1], facing, points: [[a[0], a[1], bottom], [b[0], b[1], bottom], [b[0], b[1], top], [a[0], a[1], top]] as Point3[],
        color: a[0] + b[0] > a[1] + b[1] ? color : color === C.sandstone ? C.cream : color };
    }).filter(wall => allWalls || wall.facing > 0).sort((a, b) => a.depth - b.depth);
    for (const wall of faces) face(wall.color, wall.points);
    face(roof, atHeight(outline, top));
  }

  // A shallow, broad terrace reinforces the low horizontal proportions.
  face(0x294c44, atHeight(ground.map(([u, v]) => [u + 0.17, v + 0.24] as UV), 0), 0.22);
  prism(ground, 0, 5, 0xb9a58b, 0xd8c7a9);
  line(0xf0ddbc, atHeight(ground, 5), 0.85);
  prism(chamferedTriangle(1.035), 5, 12, C.redDark, C.redLight);
  prism(outer, 12, 34, C.redDark, C.red);
  prism(outer, 34, 119, C.sandstone, C.roof);

  // Repeated slim recesses and stone fins wrap the visible long facades.
  for (let edge = 0; edge < outer.length; edge++) {
    const a = outer[edge], b = outer[(edge + 1) % outer.length];
    const du = b[0] - a[0], dv = b[1] - a[1];
    if (dv - du <= 0) continue;
    const length = Math.hypot(du, dv);
    const bays = Math.max(2, Math.round(length / 0.29));
    const wall = (t0: number, t1: number, bottom: number, top: number, color: number) => {
      const p = mix(a, b, t0), q = mix(a, b, t1);
      face(color, [[p[0], p[1], bottom], [q[0], q[1], bottom], [q[0], q[1], top], [p[0], p[1], top]]);
    };
    for (let bay = 0; bay < bays; bay++) {
      const start = (bay + 0.22) / bays, end = (bay + 0.76) / bays;
      wall(start, end, 43, 108, C.shade);
      wall(start + 0.08 / bays, end - 0.06 / bays, 46, 106, C.window);
      wall(start, end, 76, 80, C.redLight);
      wall(start, end, 43, 47, C.red);
      // Tall cream-colored piers are the defining exterior rhythm.
      wall((bay + 0.82) / bays, (bay + 0.99) / bays, 36, 113, C.cream);
      wall(start + 0.08 / bays, start + 0.12 / bays, 48, 105, 0xc6bca1);
      wall(start, end, 19, 29, C.window);
    }
    wall(0, 1, 113, 119, C.redLight);
    wall(0, 1, 34, 38, 0xd7ad88);
    wall(0, 1, 10, 14, C.red);
  }

  // Roof terraces remain flat. A recessed inner ring exposes the courtyard.
  face(0x5e6961, atHeight(inner, 119));
  face(C.court, atHeight(inner, 36));
  for (let edge = 0; edge < inner.length; edge++) {
    const a = inner[edge], b = inner[(edge + 1) % inner.length];
    // The rear courtyard walls face the camera; the front walls are occluded by their roof.
    if ((b[1] - a[1]) - (b[0] - a[0]) > 0) continue;
    face(C.redLight, [[a[0], a[1], 119], [b[0], b[1], 119], [b[0], b[1], 36], [a[0], a[1], 36]]);
  }
  for (let edge = 0; edge < outer.length; edge++) {
    const next = (edge + 1) % outer.length;
    face(edge % 2 ? C.roof : C.roofLight, [
      [outer[edge][0], outer[edge][1], 119], [outer[next][0], outer[next][1], 119],
      [inner[next][0], inner[next][1], 119], [inner[edge][0], inner[edge][1], 119],
    ]);
  }

  // Thin sandstone parapets, roof coping, and small service housings.
  for (const [index, outline] of [outer, inner].entries()) {
    const expanded = outline.map(([u, v]) => [u * (index ? 1.025 : 0.982), v * (index ? 1.025 : 0.982)] as UV);
    for (let edge = 0; edge < outline.length; edge++) {
      const next = (edge + 1) % outline.length;
      const a = outline[edge], b = outline[next];
      face(index ? C.red : C.redLight, [[a[0], a[1], 119], [b[0], b[1], 119], [b[0], b[1], 126], [a[0], a[1], 126]]);
      face(C.sandstone, [[a[0], a[1], 126], [b[0], b[1], 126], [expanded[next][0], expanded[next][1], 126], [expanded[edge][0], expanded[edge][1], 126]]);
    }
  }

  // Two large chamber volumes have faceted light-gray roofs, visible in the aerial reference.
  const chamber: UV[] = [[-2.43, -0.1], [-1.8, -1.0], [-0.9, -1.25], [-0.25, -0.8], [-0.32, 0.28], [-0.8, 0.99], [-1.62, 0.77]];
  for (const outline of [chamber, chamber.map(([u, v]) => [v, u] as UV).reverse()]) {
    prism(outline, 67, 130, C.red, C.roofLight, true);
    const center: Point3 = [outline.reduce((sum, p) => sum + p[0], 0) / outline.length,
      outline.reduce((sum, p) => sum + p[1], 0) / outline.length, 141];
    for (let edge = 0; edge < outline.length; edge++) {
      const a = outline[edge], b = outline[(edge + 1) % outline.length];
      const panel: Point3[] = [[a[0], a[1], 130], [b[0], b[1], 130], center];
      face(edge % 2 ? C.roofLight : 0xc9d0cb, panel);
      line(0x899e9c, panel, 0.55, 0.9);
    }
  }

  // Open polygonal front courtyard: a small planted floor, deep arcaded walls.
  const court: UV[] = [[0.30, 1.28], [0.66, 0.65], [1.28, 0.30], [1.88, 0.79], [2.25, 1.61], [1.61, 2.25], [0.79, 1.88]];
  face(0x607565, atHeight(court, 44));
  const courtLip = court.map(([u, v]) => [1.25 + (u - 1.25) * 1.11, 1.25 + (v - 1.25) * 1.11] as UV);
  for (let edge = 0; edge < court.length; edge++) {
    const next = (edge + 1) % court.length;
    const a = court[edge], b = court[next];
    if ((b[1] - a[1]) - (b[0] - a[0]) < 0) {
      face(0xdac6aa, [[a[0], a[1], 44], [b[0], b[1], 44], [b[0], b[1], 96], [a[0], a[1], 96]]);
      for (let bay = 0; bay < 3; bay++) {
        const p = mix(a, b, (bay + 0.2) / 3), q = mix(a, b, (bay + 0.73) / 3);
        face(C.window, [[p[0], p[1], 47], [q[0], q[1], 47], [q[0], q[1], 69], [p[0], p[1], 69]]);
      }
    }
    face(C.roofLight, [[a[0], a[1], 96], [b[0], b[1], 96], [courtLip[next][0], courtLip[next][1], 96], [courtLip[edge][0], courtLip[edge][1], 96]]);
  }
  const tree = baker.at([1.25, 1.25, 53], OX, OY);
  g.fillStyle(0x355e43, 1); g.fillEllipse(tree.x, tree.y, 36, 15);
  g.fillStyle(C.green, 1); g.fillEllipse(tree.x - 3, tree.y - 5, 29, 16);

  // Raised Constitution Hall and the small roof emblem. No historic white dome.
  const hall: UV[] = [[-0.57, -0.57], [0.35, -0.57], [0.35, 0.35], [-0.57, 0.35]];
  prism(hall, 105, 162, C.redLight, 0xd4b48e, true);
  for (const side of ["u", "v"] as const) for (let bay = 0; bay < 3; bay++) {
    const a = -0.4 + bay * 0.26, b = a + 0.095;
    face(0x3d6660, side === "u" ? [[0.351, a, 117], [0.351, b, 117], [0.351, b, 153], [0.351, a, 153]]
      : [[a, 0.351, 117], [b, 0.351, 117], [b, 0.351, 153], [a, 0.351, 153]]);
  }
  const emblem = baker.at([-0.11, -0.11, 166], OX, OY);
  g.fillStyle(0xb8954f); g.fillRect(emblem.x - 6, emblem.y - 4, 12, 4);
  g.fillStyle(0xd4b36a); g.fillRect(emblem.x - 3.5, emblem.y - 15, 7, 11);
  for (const dx of [-4, 0, 4]) { g.fillEllipse(emblem.x + dx, emblem.y - 18, 5, 7); }

  // The wide clipped front vertex is the entrance, with a recessed doorway and steps.
  const frontEdge = outer.map((a, index) => ({ a, b: outer[(index + 1) % outer.length] }))
    .sort((a, b) => b.a[0] + b.a[1] + b.b[0] + b.b[1] - a.a[0] - a.a[1] - a.b[0] - a.b[1])[0];
  const p = mix(frontEdge.a, frontEdge.b, 0.32), q = mix(frontEdge.a, frontEdge.b, 0.68);
  face(C.redLight, [[p[0], p[1], 12], [q[0], q[1], 12], [q[0], q[1], 70], [p[0], p[1], 70]]);
  const dp = mix(frontEdge.a, frontEdge.b, 0.41), dq = mix(frontEdge.a, frontEdge.b, 0.59);
  face(C.window, [[dp[0], dp[1], 12], [dq[0], dq[1], 12], [dq[0], dq[1], 42], [dp[0], dp[1], 42]]);
  for (let step = 0; step < 4; step++) {
    const offset = 0.035 + step * 0.07;
    face(step % 2 ? C.sandstone : C.cream, [[p[0] + offset, p[1] + offset, 10 - step * 2], [q[0] + offset, q[1] + offset, 10 - step * 2],
      [q[0] + offset + 0.075, q[1] + offset + 0.075, 10 - step * 2], [p[0] + offset + 0.075, p[1] + offset + 0.075, 10 - step * 2]]);
  }

  // Flag is deliberately a tiny flat silhouette, readable at the city camera scale.
  const mastBase = baker.at([2.0, 2.0, 121], OX, OY);
  g.lineStyle(1.5, 0xe2d4ab); g.lineBetween(mastBase.x, mastBase.y, mastBase.x, mastBase.y - 66);
  for (const [index, color] of [0xed8f44, 0xfff8e5, 0x299461].entries()) {
    g.fillStyle(color); g.beginPath();
    g.moveTo(mastBase.x + 1, mastBase.y - 64 + index * 4);
    g.lineTo(mastBase.x + 24, mastBase.y - 61 + index * 4);
    g.lineTo(mastBase.x + 24, mastBase.y - 57 + index * 4);
    g.lineTo(mastBase.x + 1, mastBase.y - 60 + index * 4);
    g.closePath(); g.fillPath();
  }
  g.lineStyle(0.8, 0x305c81); g.strokeCircle(mastBase.x + 12, mastBase.y - 56.5, 1.5);
  baker.finish(PARLIAMENT_KEY, WIDTH, HEIGHT);
  baker.destroy();
}
