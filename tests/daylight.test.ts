import test from "node:test";
import assert from "node:assert/strict";
import { daylightAt } from "../src/game/daylight";
const at = (hour: number, minute = 0, second = 0) => daylightAt(new Date(2026, 8, 5, hour, minute, second));

test("device-local lighting covers dawn, afternoon, sunset and night", () => {
  assert.equal(at(6).phase, "Sunrise");
  assert.equal(at(10).phase, "Morning");
  assert.equal(at(14).phase, "Afternoon");
  assert.equal(at(18).phase, "Sunset");
  assert.equal(at(23).phase, "Night");
  assert.equal(at(14).tint, 0xffffff);
  assert.notEqual(at(18).sky, at(14).sky);
  assert.notEqual(at(23).tint, at(14).tint);
});
test("lighting is continuous across midnight and phase boundaries", () => {
  assert.equal(at(23, 59, 59).sky, at(0).sky);
  for (const hour of [5, 8, 12, 17, 20]) {
    const before = at(hour - 1, 59, 59);
    const after = at(hour);
    for (const key of ["sky", "tint"] as const) {
      for (const shift of [0, 8, 16]) {
        assert.ok(Math.abs(((before[key] >> shift) & 255) - ((after[key] >> shift) & 255)) <= 1);
      }
    }
  }
});
