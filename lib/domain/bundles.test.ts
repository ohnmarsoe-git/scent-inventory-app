import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allocateBundleUnitPrices, quoteBundleSet } from "./bundles.ts";

describe("allocateBundleUnitPrices", () => {
  it("splits evenly when weights are missing", () => {
    assert.deepEqual(allocateBundleUnitPrices(85000, [0, 0, 0, 0]), [
      21250, 21250, 21250, 21250,
    ]);
  });

  it("splits by weight and puts remainder on the last line", () => {
    assert.deepEqual(allocateBundleUnitPrices(10000, [1, 1, 1]), [
      3333, 3333, 3334,
    ]);
  });

  it("returns empty for no lines", () => {
    assert.deepEqual(allocateBundleUnitPrices(1000, []), []);
  });

  it("keeps a single line equal to the total", () => {
    assert.deepEqual(allocateBundleUnitPrices(88000, [1]), [88000]);
  });
});

describe("quoteBundleSet", () => {
  it("reports price per ml and margin from liquid cost", () => {
    const quote = quoteBundleSet({
      sizeMl: 2,
      salePriceMmk: 80000,
      items: [
        { quantity: 4, costPerMl: 1000 },
        { quantity: 4, costPerMl: 1500 },
      ],
      packagingCostPerUnit: 0,
    });
    assert.equal(quote.units, 8);
    assert.equal(quote.totalMl, 16);
    assert.equal(quote.pricePerMl, 5000);
    assert.equal(quote.cogs, 20000);
    assert.equal(quote.profit, 60000);
    assert.ok(quote.margin != null && Math.abs(quote.margin - 0.75) < 0.001);
  });

  it("leaves margin blank when a scent has no cost yet", () => {
    const quote = quoteBundleSet({
      sizeMl: 2,
      salePriceMmk: 80000,
      items: [
        { quantity: 1, costPerMl: 1000 },
        { quantity: 1, costPerMl: null },
      ],
    });
    assert.equal(quote.cogs, null);
    assert.equal(quote.margin, null);
    assert.equal(quote.pricePerMl, 20000);
  });
});
