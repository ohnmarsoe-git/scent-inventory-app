import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { moneyLeft, summarizePreorders } from "./preorder.ts";

describe("preorder deposits", () => {
  it("leaves the unpaid balance", () => {
    assert.equal(moneyLeft(205000, 100000), 105000);
    assert.equal(moneyLeft(205000, 205000), 0);
    assert.equal(moneyLeft(205000, 0), 205000);
  });

  it("treats paid-on-waiting as invested, and unpaid received as still due", () => {
    const summary = summarizePreorders([
      { status: "ordered", total_mmk: 205000, deposit_paid_mmk: 100000 },
      { status: "ordered", total_mmk: 438000, deposit_paid_mmk: 0 },
      { status: "received", total_mmk: 180000, deposit_paid_mmk: 0 },
      { status: "cancelled", total_mmk: 90000, deposit_paid_mmk: 90000 },
    ]);
    assert.equal(summary.invested, 100000);
    assert.equal(summary.left, 105000 + 438000 + 180000);
  });
});
