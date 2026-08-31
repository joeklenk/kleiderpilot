import test from "node:test";
import assert from "node:assert/strict";

import { createSampleItems } from "../samples.js";

test("erstellt zehn unterschiedliche Testartikel mit Bildern und Statusdaten", () => {
  const samples = createSampleItems([], new Date("2026-08-31T12:00:00Z"));

  assert.equal(samples.length, 10);
  assert.equal(new Set(samples.map((item) => item.sku)).size, 10);
  assert.equal(new Set(samples.map((item) => item.title)).size, 10);
  assert.ok(samples.every((item) => item.sampleData && item.images.length >= 1));
  assert.deepEqual(
    samples.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {}),
    { draft: 2, listed: 2, deleted: 1, sold: 3, shipped: 2 }
  );
  assert.ok(samples.find((item) => item.status === "deleted")?.deletedAt);
  assert.ok(samples.filter((item) => ["sold", "shipped"].includes(item.status)).every((item) => item.salePrice && item.soldAt));
  assert.ok(samples.filter((item) => item.status === "shipped").every((item) => item.shippedAt));
});

test("vergibt für Testartikel nur freie Artikelnummern", () => {
  const samples = createSampleItems(
    [{ id: "existing", sku: "A001", title: "Eigener Artikel" }],
    new Date("2026-08-31T12:00:00Z")
  );

  assert.equal(samples[0].sku, "A002");
  assert.equal(samples.at(-1).sku, "A011");
});
