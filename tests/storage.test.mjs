import test from "node:test";
import assert from "node:assert/strict";

import { validateImport } from "../storage.js";

test("importiert alte Sicherungen ohne den entfernten Lagerplatz", () => {
  const [item] = validateImport({
    app: "KleiderPilot",
    version: 1,
    items: [
      {
        id: "item-1",
        sku: "A001",
        title: "Hoodie",
        location: "Box B2",
        comparablePrices: "20; 25",
        status: "available"
      }
    ]
  });

  assert.equal(item.location, undefined);
  assert.equal(item.comparablePrices, undefined);
  assert.equal(item.status, "draft");
  assert.equal(item.sku, "A001");
  assert.equal(item.itemType, "Hoodie");
  assert.equal(item.audience, "Herren");
  assert.deepEqual(item.images, []);
});

test("übernimmt gespeicherte Artikelbilder aus einer Sicherung", () => {
  const [item] = validateImport({
    app: "KleiderPilot",
    version: 4,
    items: [
      {
        id: "item-1",
        sku: "A001",
        title: "Hoodie",
        images: [{ id: "image-1", name: "hoodie.jpg", dataUrl: "data:image/jpeg;base64,SGVsbG8=" }]
      }
    ]
  });

  assert.equal(item.images.length, 1);
  assert.equal(item.images[0].name, "hoodie.jpg");
});

test("übernimmt den früheren Status Reserviert als auf Vinted gestellt", () => {
  const [item] = validateImport({
    app: "KleiderPilot",
    version: 6,
    items: [{ id: "item-1", sku: "A001", title: "Hoodie", status: "reserved", listedAt: "2026-08-01T10:00:00Z" }]
  });

  assert.equal(item.status, "listed");
  assert.equal(item.listedAt, "2026-08-01T10:00:00Z");
});

test("behält weich gelöschte Artikel und ihren vorherigen Status", () => {
  const [item] = validateImport({
    app: "KleiderPilot",
    version: 8,
    items: [{ id: "item-1", sku: "A001", title: "Hoodie", status: "deleted", statusBeforeDelete: "listed", deletedAt: "2026-08-20T10:00:00Z" }]
  });

  assert.equal(item.status, "deleted");
  assert.equal(item.statusBeforeDelete, "listed");
});

test("lehnt Sicherungen mit doppelten Artikelnummern ab", () => {
  assert.throws(
    () =>
      validateImport({
        app: "KleiderPilot",
        items: [
          { id: "item-1", sku: "A001", title: "Hoodie" },
          { id: "item-2", sku: "a001", title: "Shirt" }
        ]
      }),
    /doppelte Artikelnummern/
  );
});
