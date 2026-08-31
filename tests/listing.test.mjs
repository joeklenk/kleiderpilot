import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVintedSearchUrl,
  generateListingDescription,
  generateListingTitle,
  getListingWarnings,
  getMeasurementChecklist,
  normalizeVintedItemUrl,
  suggestCategory,
  suggestPackageSize
} from "../listing.js";

const hoodie = {
  audience: "Herren",
  itemType: "Hoodie",
  brand: "Nike",
  size: "M",
  condition: "Sehr gut",
  color: "Schwarz",
  material: "Baumwolle",
  measurements: "Brustweite 55 cm",
  flaws: "Leichte Waschspuren",
  shipping: "Versand über Vinted"
};

test("erstellt einen kompakten Vinted-Titel", () => {
  assert.equal(generateListingTitle(hoodie), "Nike Hoodie Schwarz Größe M");
});

test("erstellt eine Beschreibung nur aus vorhandenen Angaben", () => {
  const description = generateListingDescription(hoodie);
  assert.match(description, /Zustand: Sehr gut/);
  assert.match(description, /MAẞE \(flach gemessen\)/);
  assert.match(description, /Brustweite 55 cm/);
  assert.match(description, /Mängel\/Besonderheiten: Leichte Waschspuren\./);
  assert.match(description, /tierfreien Nichtraucherhaushalt/);
});

test("nutzt eine optionale Modellbezeichnung im Titel", () => {
  assert.equal(generateListingTitle({ ...hoodie, model: "Club Fleece" }), "Nike Hoodie Club Fleece Schwarz Größe M");
});

test("liefert passende Maßehinweise und eine Vollständigkeitsprüfung", () => {
  assert.deepEqual(getMeasurementChecklist(hoodie), ["Brustweite", "Gesamtlänge", "Ärmellänge"]);
  assert.deepEqual(getListingWarnings(hoodie, 1), []);
  assert.ok(getListingWarnings({ itemType: "Hoodie" }, 0).includes("mindestens ein Foto"));
});

test("schlägt Kategorie und Sendungsgröße vor", () => {
  assert.equal(suggestCategory(hoodie), "Herren > Kleidung > Pullover & Sweatshirts > Kapuzenpullover");
  assert.equal(suggestPackageSize(hoodie), "Mittel");
});

test("erstellt einen Vinted-Suchlink aus den Eckdaten", () => {
  const url = new URL(buildVintedSearchUrl(hoodie));
  assert.equal(url.hostname, "www.vinted.de");
  assert.equal(url.searchParams.get("search_text"), "Nike Hoodie M Schwarz");
});

test("akzeptiert ausschließlich sichere deutsche Vinted-Links", () => {
  assert.equal(
    normalizeVintedItemUrl("https://www.vinted.de/items/123-nike-hoodie"),
    "https://www.vinted.de/items/123-nike-hoodie"
  );
  assert.equal(normalizeVintedItemUrl("http://www.vinted.de/items/123"), "");
  assert.equal(normalizeVintedItemUrl("https://vinted.de.example.com/items/123"), "");
});
