import test from "node:test";
import assert from "node:assert/strict";
import { LAUNCH_BUDGET, STRATEGY_A, STRATEGY_B, policyEligibleCount, policyLiability, policyShortfall } from "../src/game/world-data";

test("voucher proposals preserve coverage, liability and infeasible shortfall", () => {
  for (const [threshold, households, cost, shortfall] of [
    [20_000, 4, 12_000, 0], [30_000, 8, 24_000, 0], [45_000, 12, 36_000, 6000],
  ]) {
    assert.equal(policyEligibleCount(threshold), households);
    assert.equal(policyLiability(threshold), cost);
    assert.equal(policyShortfall(threshold), shortfall);
  }
  assert.equal(policyEligibleCount(14_999), 0);
  assert.equal(policyEligibleCount(15_000), 4);
  assert.equal(policyEligibleCount(24_999), 4);
  assert.equal(policyEligibleCount(25_000), 8);
});

test("founder alternatives compare allocations of the same total budget", () => {
  for (const strategy of [STRATEGY_A, STRATEGY_B]) {
    assert.equal(strategy.paidPlacement + strategy.communityWorkshops, LAUNCH_BUDGET);
  }
});
