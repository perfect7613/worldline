import test from "node:test";
import assert from "node:assert/strict";
import { buildCityLayout, shortestRoadPath } from "../src/game/city-layout";

test("the city road network connects all resident destinations around the landmark", () => {
  const city = buildCityLayout();
  const roads = new Set(city.roads.map(p => `${p.x},${p.y}`));
  const start = city.roads[0];
  assert.ok(start);
  for (const destination of city.roads) {
    const path = shortestRoadPath(start, destination, roads);
    assert.deepEqual(path.at(-1), destination);
    for (let i = 1; i < path.length; i++) {
      assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y), 1);
    }
  }
  assert.equal(city.roads.some(p => p.x >= 12 && p.x <= 20 && p.y >= 12 && p.y <= 21), false);
});

test("occupied buildings do not overlap roads, trees, or landmark reservations", () => {
  const city = buildCityLayout();
  for (const building of city.buildings) {
    const cell = city.grid.cellAt(building.x, building.y);
    assert.ok(cell && ["grass", "ground"].includes(cell.kind));
    assert.equal(cell.prop, undefined);
    assert.equal(building.x >= 23 && building.y >= 23, false);
  }
});
