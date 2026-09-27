import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePeriod } from "./period.ts";

describe("resolvePeriod", () => {
  it("returns today for today period", () => {
    const range = resolvePeriod("today");
    assert.equal(range.from, range.to);
    assert.equal(range.label, "Today");
  });

  it("uses custom dates", () => {
    const range = resolvePeriod("custom", "2026-01-01", "2026-01-31");
    assert.equal(range.from, "2026-01-01");
    assert.equal(range.to, "2026-01-31");
    assert.ok(range.label.includes("2026-01-01"));
  });

  it("defaults to this month", () => {
    const range = resolvePeriod("this_month");
    assert.equal(range.label, "This month");
    assert.ok(range.from <= range.to);
  });
});
