import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseCsv, toCsv } from "./csv.ts";

describe("csv", () => {
  it("round-trips simple rows", () => {
    const csv = toCsv(["name", "qty"], [
      ["Chanel", 2],
      ['Dior, "EDP"', 1],
    ]);
    const parsed = parseCsv(csv);
    assert.deepEqual(parsed.headers, ["name", "qty"]);
    assert.equal(parsed.rows.length, 2);
    assert.deepEqual(parsed.rows[0], { name: "Chanel", qty: "2" });
    assert.ok(parsed.rows[1]?.name.includes("Dior"));
  });

  it("skips blank lines", () => {
    const parsed = parseCsv("name\n\nA\n\n");
    assert.deepEqual(parsed.rows, [{ name: "A" }]);
  });
});
