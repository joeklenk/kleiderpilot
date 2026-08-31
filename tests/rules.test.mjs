import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateDaysBetween,
  calculateDashboardStats,
  detectIntent,
  evaluateOffer,
  filterAndSortInventory,
  getNextSku,
  getStatusLabel,
  isDeletedStatus,
  parseOfferFromMessage,
  restoreDeletedItem,
  softDeleteItem,
  sortItemsBySku,
  suggestReply,
  transitionItemStatus,
  validatePriceLimits
} from "../rules.js";

const item = {
  title: "Nike Hoodie schwarz",
  listPrice: 40,
  targetPrice: 35,
  floorPrice: 31,
  condition: "Sehr gut",
  flaws: "Keine Flecken oder Löcher",
  measurements: "Brustweite 55 cm, Länge 68 cm",
  shipping: "Der Versand erfolgt über Vinted"
};

test("erkennt Euro-Angebote in Nachrichten", () => {
  assert.equal(parseOfferFromMessage("Würdest du 30 € machen?"), 30);
  assert.equal(parseOfferFromMessage("Ich biete 32,50 Euro"), 32.5);
  assert.equal(parseOfferFromMessage("30€?"), 30);
});

test("interpretiert eine alleinstehende Zahl als Preisangebot", () => {
  assert.equal(parseOfferFromMessage("30"), 30);
  assert.equal(parseOfferFromMessage("30?"), 30);
  assert.equal(parseOfferFromMessage("30,-"), 30);
  assert.equal(suggestReply(item, "30").intent, "offer");
});

test("erkennt kurze Preisformulierungen ohne Eurozeichen", () => {
  assert.equal(parseOfferFromMessage("für 30?"), 30);
  assert.equal(parseOfferFromMessage("Machst du 28"), 28);
  assert.equal(parseOfferFromMessage("30 inkl. Versand"), 30);
});

test("nimmt Angebote ab dem Zielpreis an", () => {
  assert.equal(evaluateOffer(item, 35).action, "accept");
  assert.equal(evaluateOffer(item, 38).action, "accept");
});

test("erstellt zwischen Untergrenze und Zielpreis ein Gegenangebot", () => {
  const result = evaluateOffer(item, 33);
  assert.equal(result.action, "counter");
  assert.equal(result.recommendedPrice, 35);
});

test("unterschreitet ein Angebot die Untergrenze", () => {
  const result = evaluateOffer(item, 25);
  assert.equal(result.action, "counter-low");
  assert.equal(result.recommendedPrice, 35);
});

test("beantwortet Maßfragen nur mit hinterlegten Daten", () => {
  const result = suggestReply(item, "Wie lang ist der Hoodie?");
  assert.equal(result.intent, "measurements");
  assert.equal(result.needsHumanReview, false);
  assert.match(result.reply, /Brustweite 55 cm/);
});

test("leitet Maßfragen ohne Daten an den Menschen weiter", () => {
  const result = suggestReply({ ...item, measurements: "" }, "Welche Maße hat er?");
  assert.equal(result.needsHumanReview, true);
  assert.equal(result.reply, "");
});

test("erkennt Zustands- und Versandfragen", () => {
  assert.equal(detectIntent("Hat der Artikel Flecken?"), "condition");
  assert.equal(detectIntent("Wie verschickst du das Paket?"), "shipping");
});

test("schlägt bei allgemeiner Preisfrage den Zielpreis vor", () => {
  const result = suggestReply(item, "Was ist dein letzter Preis?");
  assert.equal(result.intent, "price-question");
  assert.equal(result.recommendedPrice, 35);
});

test("unbekannte Fragen werden nicht automatisch beantwortet", () => {
  const result = suggestReply(item, "Kannst du morgen noch ein Detailfoto machen?");
  assert.equal(result.intent, "general");
  assert.equal(result.needsHumanReview, true);
});

test("beantwortet häufige Standardfragen regelbasiert", () => {
  assert.equal(suggestReply(item, "Kannst du ihn reservieren?").intent, "reservation");
  assert.equal(suggestReply(item, "Gibt es Paketrabatt?").intent, "bundle");
  assert.equal(suggestReply(item, "Ist das noch verfügbar?").intent, "availability");
  assert.equal(suggestReply(item, "Kann ich per PayPal zahlen?").intent, "external-payment");
});

test("eskaliert Echtheitsfragen und begrenzt Gegenangebote", () => {
  assert.equal(suggestReply(item, "Ist das garantiert original?").needsHumanReview, true);
  assert.equal(suggestReply(item, "30", null, { counterOffers: 2, maxCounterOffers: 2 }).needsHumanReview, true);
});

test("unterstützt kurze und ausführliche Antwortstile", () => {
  const shortReply = suggestReply(item, "Welche Maße?", null, { style: "short" }).reply;
  const detailedReply = suggestReply(item, "Welche Maße?", null, { style: "detailed" }).reply;
  assert.ok(detailedReply.length > shortReply.length);
});

test("validiert die Reihenfolge der Preisgrenzen", () => {
  assert.equal(validatePriceLimits(item), null);
  assert.match(validatePriceLimits({ listPrice: 40, targetPrice: 30, floorPrice: 35 }), /Untergrenze/);
  assert.match(validatePriceLimits({ listPrice: 40, targetPrice: 45, floorPrice: 30 }), /Zielpreis/);
});

test("vergibt automatisch die kleinste freie Artikelnummer", () => {
  assert.equal(getNextSku([]), "A001");
  assert.equal(getNextSku([{ sku: "A001" }, { sku: "A003" }]), "A002");
  assert.equal(getNextSku([{ sku: "A001" }, { sku: "A002" }, { sku: "Sonder-ID" }]), "A003");
});

test("sortiert Artikelnummern aufsteigend", () => {
  const sorted = sortItemsBySku([{ sku: "A010" }, { sku: "A002" }, { sku: "Sonder-ID" }, { sku: "A001" }]);
  assert.deepEqual(sorted.map((entry) => entry.sku), ["A001", "A002", "A010", "Sonder-ID"]);
});

test("berechnet die Dashboard-Kennzahlen", () => {
  const stats = calculateDashboardStats([
    { status: "draft", listPrice: 40 },
    { status: "listed", listPrice: 25 },
    { status: "sold", listPrice: 30, salePrice: 24 },
    { status: "shipped", listPrice: 20, salePrice: 18 }
  ]);

  assert.deepEqual(stats, {
    availableCount: 2,
    wardrobeValue: 65,
    soldCount: 2,
    revenue: 42
  });
});

test("filtert und sortiert den Artikelbestand", () => {
  const inventory = [
    { sku: "A003", title: "Nike Hoodie", brand: "Nike", status: "listed", listPrice: 40, listedAt: "2026-08-01" },
    { sku: "A001", title: "Adidas Shirt", brand: "Adidas", status: "draft", listPrice: 20, createdAt: "2026-08-03" },
    { sku: "A002", title: "Puma Hose", brand: "Puma", status: "shipped", listPrice: 30, listedAt: "2026-08-02" }
  ];

  assert.deepEqual(filterAndSortInventory(inventory, { query: "nike" }).map((entry) => entry.sku), ["A003"]);
  assert.deepEqual(filterAndSortInventory(inventory, { status: "sold" }).map((entry) => entry.sku), []);
  assert.deepEqual(filterAndSortInventory(inventory, { status: "shipped" }).map((entry) => entry.sku), ["A002"]);
  assert.deepEqual(filterAndSortInventory(inventory, { sort: "price-desc" }).map((entry) => entry.sku), ["A003", "A002", "A001"]);
  assert.deepEqual(filterAndSortInventory(inventory, { sort: "date-newest" }).map((entry) => entry.sku), ["A001", "A002", "A003"]);
});

test("berechnet Verkaufsdauer und Statusbezeichnungen", () => {
  assert.equal(calculateDaysBetween("2026-08-01T10:00:00Z", "2026-08-13T10:00:00Z"), 12);
  assert.equal(calculateDaysBetween("ungültig", "2026-08-13T10:00:00Z"), null);
  assert.equal(getStatusLabel("listed"), "Auf Vinted gestellt");
  assert.equal(getStatusLabel("shipped"), "Versendet");
  assert.equal(getStatusLabel("deleted"), "Gelöscht");
});

test("markiert Artikel als gelöscht und stellt den vorherigen Status wieder her", () => {
  const deleted = softDeleteItem({ id: "item-1", status: "listed", listedAt: "2026-08-01T10:00:00Z" }, "2026-08-20T10:00:00Z");
  assert.equal(isDeletedStatus(deleted.status), true);
  assert.equal(deleted.statusBeforeDelete, "listed");
  assert.equal(deleted.listedAt, "2026-08-01T10:00:00Z");

  const restored = restoreDeletedItem(deleted, "2026-08-21T10:00:00Z");
  assert.equal(restored.status, "listed");
  assert.equal(restored.deletedAt, undefined);
  assert.equal(restored.statusBeforeDelete, undefined);
});

test("setzt Status, Preise und Zeitpunkte nachvollziehbar", () => {
  const listed = transitionItemStatus(
    { id: "item-1", status: "draft", listPrice: 40 },
    "listed",
    { now: "2026-08-01T10:00:00Z" }
  );
  assert.equal(listed.listedAt, "2026-08-01T10:00:00Z");

  const sold = transitionItemStatus(listed, "sold", {
    now: "2026-08-13T10:00:00Z",
    salePrice: 34
  });
  assert.equal(sold.salePrice, 34);
  assert.equal(sold.soldAt, "2026-08-13T10:00:00Z");

  const shipped = transitionItemStatus(sold, "shipped", { now: "2026-08-14T10:00:00Z" });
  assert.equal(shipped.shippedAt, "2026-08-14T10:00:00Z");
  assert.equal(shipped.salePrice, 34);

  const draft = transitionItemStatus(shipped, "draft", { now: "2026-08-15T10:00:00Z" });
  assert.equal(draft.listedAt, undefined);
  assert.equal(draft.salePrice, undefined);
  assert.equal(draft.soldAt, undefined);
  assert.equal(draft.shippedAt, undefined);
});
