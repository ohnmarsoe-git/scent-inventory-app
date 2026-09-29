import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MARKET_SCENTS } from "./market-prices.ts";
import {
  capExtraForSize,
  capExtrasFromConsumables,
  estimateMarketSell,
  fullBottleQuote,
  liveUnitCost,
  lookupMarketPrice,
  matchMarketScent,
  packagingCostForSize,
  packagingFromChoices,
  packagingFromConsumables,
  parseNormalBottles,
  quoteCogs,
  resolveFullSizePrice,
  resolveNormalBottles,
  resolveSellPrice,
} from "./pricing.ts";

describe("market sell prices", () => {
  it("matches every Pricing Strategy II scent to itself", () => {
    for (const scent of MARKET_SCENTS) {
      const match = matchMarketScent(scent.name);
      assert.equal(match?.name, scent.name, scent.name);
    }
  });

  it("quotes Armaf CDN EDP sizes from the sheet", () => {
    assert.equal(lookupMarketPrice("Armaf — CDN EDP", 3), 10000);
    assert.equal(lookupMarketPrice("Armaf — CDN EDP", 5), 14000);
    assert.equal(lookupMarketPrice("Armaf — CDN EDP", 10), 22000);
    assert.equal(lookupMarketPrice("Armaf — CDN EDP", 20), null);
    assert.equal(lookupMarketPrice("Armaf — CDN EDP", 30), 72000);
  });

  it("quotes a full bottle from the full-bottle sheet", () => {
    const quote = fullBottleQuote({
      label: "Armaf — CDN EDP",
      costPerMl: 180000 / 105,
      bottleSizeMl: 105,
    });
    assert.equal(quote.price, 275000);
    assert.equal(quote.sizeMl, 105);
    assert.ok(quote.margin != null && quote.margin > 0.3 && quote.margin < 0.4);
  });

  it("resolves full-size retail pack price with saved override", () => {
    const quoted = resolveFullSizePrice({
      label: "D&G — D&G L'Imperatrice EDT",
      costPerMl: 2360,
      bottleSizeMl: 100,
    });
    assert.equal(quoted.sizeMl, 100);
    assert.ok(quoted.price > 0);
    const saved = resolveFullSizePrice({
      label: "D&G — D&G L'Imperatrice EDT",
      costPerMl: 2360,
      bottleSizeMl: 100,
      saved: 200000,
    });
    assert.equal(saved.price, 200000);
    assert.equal(saved.source, "saved");
  });

  it("prices leftover ml between the sheet sizes", () => {
    const price = resolveSellPrice({
      label: "Armaf — CDN EDP",
      sizeMl: 15,
    }).price;
    assert.equal(price % 500, 0);
    assert.ok(price > 22000 && price < 72000);
  });

  it("does not mix sibling scents", () => {
    assert.equal(lookupMarketPrice("Armaf — CDN Untold", 10), 25000);
    assert.equal(lookupMarketPrice("YSL — Libre Berry Crush", 10), 96500);
    assert.equal(lookupMarketPrice("YSL — Libre Refill", 10), 65000);
    assert.equal(
      lookupMarketPrice("Dolce & Gabbana — L'Imperatrice", 3),
      15000,
    );
    assert.equal(
      lookupMarketPrice("D&G — L'Imperatrice Batch-02", 3),
      12000,
    );
  });

  it("matches common brand spellings", () => {
    assert.equal(lookupMarketPrice("Victoria's Secret — Bombshell", 3), 18000);
    assert.equal(lookupMarketPrice("Calvin Klein — In 2U", 3), 8000);
    assert.equal(lookupMarketPrice("Lancôme — Idôle", 5), 34000);
    assert.equal(
      lookupMarketPrice("Juliette Has a Gun — Not a Perfume", 10),
      47000,
    );
  });

  it("prefers a saved price, then the sheet, then a cost estimate", () => {
    assert.deepEqual(
      resolveSellPrice({
        label: "Armaf — CDN EDP",
        sizeMl: 10,
        saved: 21000,
        costPerMl: 1714,
      }),
      { price: 21000, source: "saved" },
    );
    assert.deepEqual(
      resolveSellPrice({
        label: "Armaf — CDN EDP",
        sizeMl: 10,
        costPerMl: 1714,
      }),
      { price: 22000, source: "market" },
    );
    const estimated = resolveSellPrice({
      label: "Brand — Unknown Scent",
      sizeMl: 10,
      costPerMl: 2000,
    });
    assert.equal(estimated.source, "cost");
    assert.equal(estimated.price, estimateMarketSell(2000, 10));
    assert.equal(estimated.price % 500, 0);
  });
});

describe("decant packaging cost", () => {
  it("uses the current bottle, not a fixed sheet amount", () => {
    const packaging = packagingFromConsumables([
      {
        name: "10ml bottle",
        category: "Bottle",
        unitCost: 1250,
        updatedAt: "2026-01-01",
      },
      {
        name: "10 ml bottle",
        category: "Bottle",
        unitCost: 1800,
        updatedAt: "2026-06-01",
      },
      { name: "5ml bottle", category: "Bottle", unitCost: 2200 },
      { name: "100ml bottle", category: "Bottle", unitCost: 9000 },
      { name: "Syringe", category: "Other", unitCost: 700 },
      { name: "10ml box", category: "Box", unitCost: 800 },
      {
        name: "Old syringe",
        category: "Other",
        unitCost: 500,
        isActive: false,
      },
    ]);

    assert.equal(packaging.bottleBySize[10], 1800);
    assert.equal(packaging.bottleBySize[5], 2200);
    assert.equal(packaging.bottleBySize[3], undefined);
    assert.equal(packaging.extraBySize[10], 800);
    assert.equal(packaging.shared, 700);
    assert.equal(packagingCostForSize(packaging, 10), 3300);
    assert.equal(packagingCostForSize(packaging, 5), 2900);
    assert.equal(packagingCostForSize(packaging, 3), null);
    assert.equal(quoteCogs(1000, 10, false, 3300), 13300);
    assert.equal(quoteCogs(1000, 8, true, 3300), 8000);
    assert.equal(liveUnitCost(1250, 1800), 1800);
    assert.equal(liveUnitCost(1250, null), 1250);
  });

  it("uses only ticked tools and the normal bottle price for that ml", () => {
    const tools = [
      { id: "paper", name: "Tester paper", unitCost: 4000 },
      { id: "bag", name: "Aluminum bag", unitCost: 500 },
      { id: "syringe", name: "Syringe", unitCost: 700 },
    ];
    const packaging = packagingFromChoices({
      bottleBySize: { 3: 1200, 5: 2200, 10: 1250 },
      tools,
      selectedToolIds: ["syringe"],
    });
    assert.equal(packaging.shared, 700);
    assert.equal(packaging.bottleBySize[10], 1250);
    assert.equal(packagingCostForSize(packaging, 10), 1950);
    assert.equal(packagingCostForSize(packaging, 30), null);

    const untouched = parseNormalBottles(null);
    assert.equal(untouched.configured, false);
    assert.deepEqual(
      resolveNormalBottles({
        configured: false,
        saved: {},
        stock: { 10: 2825 },
      }),
      { 10: 2825 },
    );
    const saved = parseNormalBottles({ 10: 1250, 3: 0 });
    assert.equal(saved.configured, true);
    assert.deepEqual(
      resolveNormalBottles({
        configured: true,
        saved: saved.bottles,
        stock: { 10: 2825, 3: 800 },
      }),
      { 10: 1250 },
    );
  });

  it("does not put a cap into the price list; a sale can add it", () => {
    const rows = [
      { name: "10ml bottle", category: "Bottle", unitCost: 1250 },
      { name: "10 ml (cap) bottle", category: "Cap", unitCost: 800 },
      { name: "Cap", category: "Cap", unitCost: 200 },
    ];
    const packaging = packagingFromConsumables(rows);
    assert.equal(packaging.bottleBySize[10], 1250);
    assert.equal(packaging.extraBySize[10], undefined);
    assert.equal(packaging.shared, 0);
    const caps = capExtrasFromConsumables(rows);
    assert.equal(capExtraForSize(caps, 10), 1000);
    assert.equal(capExtraForSize(caps, 5), 200);
  });
});
