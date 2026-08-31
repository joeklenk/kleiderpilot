const PRICE_PATTERN = /(?:für\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro\b)/i;
const OFFER_PATTERN = /(?:angebot|preis|letzte[rs]?|machen|gebe|würde|nehme)\D{0,18}(\d+(?:[.,]\d{1,2})?)/i;
const CONTEXT_PRICE_PATTERN = /(?:für|um|bei|biete|geben|gebe|machst?|nimmst?|nehme|zahle|zahlen)\D{0,14}(\d+(?:[.,]\d{1,2})?)/i;
const SHIPPING_PRICE_PATTERN = /(\d+(?:[.,]\d{1,2})?)\s*(?:inkl\.?|inklusive|mit)\s*(?:versand|porto)/i;
const BARE_PRICE_PATTERN = /^(\d+(?:[.,]\d{1,2})?)\s*(?:,-)?\s*(?:€|euro)?\s*[?!]*$/i;

const STATUS_LABELS = {
  draft: "Entwurf",
  listed: "Auf Vinted gestellt",
  sold: "Verkauft",
  shipped: "Versendet",
  deleted: "Gelöscht"
};

const ACTIVE_STATUSES = new Set(["draft", "listed"]);
const SOLD_STATUSES = new Set(["sold", "shipped"]);

export function formatPrice(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 2
  }).format(Number(value));
}

export function getNextSku(items = []) {
  const usedNumbers = new Set(
    items
      .map((item) => String(item?.sku || "").trim().toUpperCase().match(/^A(\d+)$/))
      .filter(Boolean)
      .map((match) => Number(match[1]))
      .filter((value) => Number.isInteger(value) && value > 0)
  );

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber += 1;
  return `A${String(nextNumber).padStart(3, "0")}`;
}

export function sortItemsBySku(items = []) {
  return [...items].sort((left, right) => {
    const leftMatch = String(left?.sku || "").trim().toUpperCase().match(/^A(\d+)$/);
    const rightMatch = String(right?.sku || "").trim().toUpperCase().match(/^A(\d+)$/);

    if (leftMatch && rightMatch) return Number(leftMatch[1]) - Number(rightMatch[1]);
    if (leftMatch) return -1;
    if (rightMatch) return 1;
    return String(left?.sku || "").localeCompare(String(right?.sku || ""), "de-DE", { numeric: true });
  });
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.draft;
}

export function isSoldStatus(status) {
  return SOLD_STATUSES.has(status);
}

export function isDeletedStatus(status) {
  return status === "deleted";
}

export function softDeleteItem(item = {}, now = new Date().toISOString()) {
  if (item.status === "deleted") return { ...item };
  return {
    ...item,
    statusBeforeDelete: item.status || "draft",
    status: "deleted",
    deletedAt: now,
    updatedAt: now
  };
}

export function restoreDeletedItem(item = {}, now = new Date().toISOString()) {
  if (item.status !== "deleted") return { ...item };
  const restored = {
    ...item,
    status: Object.hasOwn(STATUS_LABELS, item.statusBeforeDelete) && item.statusBeforeDelete !== "deleted"
      ? item.statusBeforeDelete
      : "draft",
    updatedAt: now
  };
  delete restored.statusBeforeDelete;
  delete restored.deletedAt;
  return restored;
}

export function transitionItemStatus(item = {}, nextStatus, { now = new Date().toISOString(), salePrice = null } = {}) {
  if (!Object.hasOwn(STATUS_LABELS, nextStatus)) throw new Error("Unbekannter Artikelstatus.");

  const previousStatus = item.status || "draft";
  const updated = { ...item, status: nextStatus, updatedAt: now };

  if (nextStatus === "draft") {
    delete updated.listedAt;
    delete updated.salePrice;
    delete updated.soldAt;
    delete updated.shippedAt;
  }

  if (nextStatus === "listed") {
    if (previousStatus !== "listed") updated.listedAt = now;
    delete updated.salePrice;
    delete updated.soldAt;
    delete updated.shippedAt;
  }

  if (nextStatus === "sold") {
    if (!SOLD_STATUSES.has(previousStatus)) {
      const normalizedSalePrice = Number(salePrice);
      if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice <= 0) {
        throw new Error("Für den Status Verkauft wird ein gültiger Verkaufspreis benötigt.");
      }
      updated.salePrice = normalizedSalePrice;
      updated.soldAt = now;
    }
    delete updated.shippedAt;
  }

  if (nextStatus === "shipped") {
    if (!SOLD_STATUSES.has(previousStatus)) {
      const normalizedSalePrice = Number(salePrice);
      if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice <= 0) {
        throw new Error("Für den Status Versendet wird ein gültiger Verkaufspreis benötigt.");
      }
      updated.salePrice = normalizedSalePrice;
      updated.soldAt = now;
    }
    updated.shippedAt = now;
  }

  return updated;
}

function getInventoryDate(item = {}) {
  const value = item.listedAt || item.createdAt || item.updatedAt;
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function filterAndSortInventory(items = [], { query = "", status = "all", sort = "sku" } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase("de-DE");
  const filtered = items.filter((item) => {
    const searchable = [item.sku, item.title, item.itemType, item.brand, item.size]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("de-DE");
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
    const matchesStatus = status === "all" || item.status === status;
    return matchesQuery && matchesStatus;
  });

  if (sort === "sku") return sortItemsBySku(filtered);

  return [...filtered].sort((left, right) => {
    let difference = 0;
    if (sort === "price-asc" || sort === "price-desc") {
      difference = Number(left.listPrice || 0) - Number(right.listPrice || 0);
      if (sort === "price-desc") difference *= -1;
    } else if (sort === "date-newest" || sort === "date-oldest") {
      const leftDate = getInventoryDate(left);
      const rightDate = getInventoryDate(right);
      if (leftDate === null && rightDate !== null) return 1;
      if (leftDate !== null && rightDate === null) return -1;
      difference = (leftDate || 0) - (rightDate || 0);
      if (sort === "date-newest") difference *= -1;
    }

    if (difference !== 0) return difference;
    return sortItemsBySku([left, right])[0] === left ? -1 : 1;
  });
}

export function calculateDaysBetween(startValue, endValue = new Date()) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return null;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

export function calculateDashboardStats(items = []) {
  const availableItems = items.filter((item) => ACTIVE_STATUSES.has(item.status));
  const soldItems = items.filter((item) => SOLD_STATUSES.has(item.status));

  return {
    availableCount: availableItems.length,
    wardrobeValue: availableItems.reduce((sum, item) => sum + Number(item.listPrice || 0), 0),
    soldCount: soldItems.length,
    revenue: soldItems.reduce((sum, item) => sum + Number(item.salePrice || 0), 0)
  };
}

export function parseOfferFromMessage(message = "") {
  const text = String(message).trim();
  const match =
    text.match(PRICE_PATTERN) ||
    text.match(OFFER_PATTERN) ||
    text.match(CONTEXT_PRICE_PATTERN) ||
    text.match(SHIPPING_PRICE_PATTERN) ||
    text.match(BARE_PRICE_PATTERN);

  if (!match) return null;

  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function evaluateOffer(item, rawOffer) {
  const offer = Number(rawOffer);
  const listPrice = Number(item.listPrice);
  const targetPrice = Number(item.targetPrice);
  const floorPrice = Number(item.floorPrice);

  if (![offer, listPrice, targetPrice, floorPrice].every(Number.isFinite)) {
    return {
      action: "review",
      label: "Manuell prüfen",
      reason: "Mindestens eine Preisangabe fehlt oder ist ungültig.",
      recommendedPrice: null
    };
  }

  if (offer >= targetPrice) {
    return {
      action: "accept",
      label: "Annehmen",
      reason: `Das Angebot erreicht deinen Zielpreis von ${formatPrice(targetPrice)}.`,
      recommendedPrice: offer
    };
  }

  if (offer >= floorPrice) {
    return {
      action: "counter",
      label: "Gegenangebot",
      reason: `Das Angebot liegt über deiner Untergrenze, aber unter dem Zielpreis von ${formatPrice(targetPrice)}.`,
      recommendedPrice: targetPrice
    };
  }

  return {
    action: "counter-low",
    label: "Zu niedrig – Gegenangebot",
    reason: `Das Angebot unterschreitet deine absolute Untergrenze von ${formatPrice(floorPrice)}.`,
    recommendedPrice: targetPrice
  };
}

export function detectIntent(message = "", explicitOffer = null) {
  const text = String(message).toLocaleLowerCase("de-DE");
  const parsedOffer = explicitOffer ?? parseOfferFromMessage(text);

  if (Number.isFinite(Number(parsedOffer)) && Number(parsedOffer) > 0) return "offer";
  if (/maß|maße|masse|länge|breite|brust|schulter|ärmel|wie\s+(?:lang|breit)|pit\s*to\s*pit/.test(text)) return "measurements";
  if (/zustand|mangel|mängel|fleck|loch|beschäd|kratzer|getragen/.test(text)) return "condition";
  if (/reservier|zurücklegen|zuruecklegen/.test(text)) return "reservation";
  if (/paketrabatt|mengenrabatt|bundle|mehrere\s+artikel|zusammen\s+kaufen/.test(text)) return "bundle";
  if (/versand|verschicken|porto|paket|liefer/.test(text)) return "shipping";
  if (/rauch|raucher|haustier|tierfrei|katze|hund/.test(text)) return "household";
  if (/noch\s+da|verfügbar|verfuegbar|noch\s+zu\s+haben/.test(text)) return "availability";
  if (/material|stoff|woraus|baumwolle|polyester/.test(text)) return "material";
  if (/echt|original|fake|authent/.test(text)) return "authenticity";
  if (/paypal|überweisung|ueberweisung|außerhalb\s+von\s+vinted|ausserhalb\s+von\s+vinted/.test(text)) return "external-payment";
  if (/beschwer|enttäuscht|enttaeuscht|unzufrieden|betrug|problem|kaputt\s+angekommen/.test(text)) return "complaint";
  if (/letzte[rs]?\s*preis|was\s*geht|noch\s*was\s*am\s*preis|günstiger/.test(text)) return "price-question";
  return "general";
}

function styleReply({ friendly, short, detailed }, style = "friendly") {
  if (style === "short") return short || friendly;
  if (style === "detailed") return detailed || friendly;
  return friendly;
}

export function suggestReply(
  item,
  message = "",
  explicitOffer = null,
  { style = "friendly", counterOffers = 0, maxCounterOffers = 2 } = {}
) {
  const parsedOffer = explicitOffer ?? parseOfferFromMessage(message);
  const intent = detectIntent(message, parsedOffer);
  const title = item.title || "den Artikel";

  if (intent === "offer") {
    const decision = evaluateOffer(item, parsedOffer);

    if (decision.action === "accept") {
      return {
        ...decision,
        intent,
        needsHumanReview: false,
        reply: styleReply({
          friendly: `Hallo, danke für dein Angebot! ${formatPrice(parsedOffer)} passt für mich. Du kannst ${title} direkt über Vinted kaufen 😊`,
          short: `${formatPrice(parsedOffer)} passt für mich. Du kannst den Artikel gerne kaufen.`,
          detailed: `Hallo, vielen Dank für dein Angebot. ${formatPrice(parsedOffer)} erreicht meinen Zielpreis und passt daher für mich. Du kannst ${title} direkt und sicher über Vinted kaufen 😊`
        }, style)
      };
    }

    if (decision.action === "counter" || decision.action === "counter-low") {
      if (Number(counterOffers) >= Number(maxCounterOffers)) {
        return {
          ...decision,
          action: "review",
          label: "Verhandlungslimit erreicht",
          reason: `Es wurden bereits ${counterOffers} Gegenangebote gesendet. Bitte entscheide jetzt selbst.`,
          intent,
          needsHumanReview: true,
          reply: ""
        };
      }
      return {
        ...decision,
        intent,
        needsHumanReview: false,
        reply: styleReply({
          friendly: `Hallo, danke für dein Angebot! Für ${formatPrice(decision.recommendedPrice)} könnte ich dir ${title} anbieten 😊`,
          short: `Ich könnte dir den Artikel für ${formatPrice(decision.recommendedPrice)} anbieten.`,
          detailed: `Hallo, vielen Dank für dein Angebot. Der vorgeschlagene Preis ist mir noch etwas zu niedrig. Ich könnte dir ${title} für ${formatPrice(decision.recommendedPrice)} anbieten 😊`
        }, style)
      };
    }

    return {
      ...decision,
      intent,
      needsHumanReview: true,
      reply: ""
    };
  }

  if (intent === "measurements") {
    if (!item.measurements?.trim()) {
      return {
        action: "review",
        label: "Maße fehlen",
        reason: "Für diesen Artikel sind noch keine Maße hinterlegt.",
        recommendedPrice: null,
        intent,
        needsHumanReview: true,
        reply: ""
      };
    }

    return {
      action: "answer",
      label: "Maße beantworten",
      reason: "Die Antwort verwendet ausschließlich deine gespeicherten Maße.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: `Hallo! Die hinterlegten Maße für ${title} sind: ${item.measurements.trim()}. Ich hoffe, das hilft dir weiter 😊`,
        short: `Die Maße sind: ${item.measurements.trim()}.`,
        detailed: `Hallo! Ich habe ${title} ausgemessen. Die hinterlegten Maße sind: ${item.measurements.trim()}. Wenn du noch ein bestimmtes Maß benötigst, sag gerne Bescheid 😊`
      }, style)
    };
  }

  if (intent === "condition") {
    const condition = item.condition?.trim() || "nicht näher angegeben";
    const flaws = item.flaws?.trim() || "Keine bekannten Mängel hinterlegt";

    return {
      action: "answer",
      label: "Zustand beantworten",
      reason: "Die Antwort verwendet den dokumentierten Zustand und die gespeicherten Mängel.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: `Hallo! Der Zustand von ${title} ist „${condition}“. ${flaws}. Die Fotos zeigen den tatsächlichen Artikel 😊`,
        short: `Zustand: ${condition}. ${flaws}.`,
        detailed: `Hallo! Der gespeicherte Zustand von ${title} ist „${condition}“. Zu Mängeln und Besonderheiten ist hinterlegt: ${flaws}. Bitte beachte zusätzlich die Fotos, sie zeigen den tatsächlichen Artikel 😊`
      }, style)
    };
  }

  if (intent === "shipping") {
    const shipping = item.shipping?.trim() || "Der Versand erfolgt über die bei Vinted auswählbaren Versandarten";

    return {
      action: "answer",
      label: "Versand beantworten",
      reason: "Die Antwort verwendet deine gespeicherte Versandangabe.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: `Hallo! ${shipping}. Nach dem Kauf verschicke ich den Artikel so schnell wie möglich 😊`,
        short: `${shipping}.`,
        detailed: `Hallo! ${shipping}. Sobald der Kauf abgeschlossen ist und das Versandetikett bereitsteht, bereite ich das Paket schnellstmöglich vor 😊`
      }, style)
    };
  }

  if (intent === "price-question") {
    return {
      action: "counter",
      label: "Zielpreis anbieten",
      reason: `Als erster Nachlass wird dein Zielpreis von ${formatPrice(item.targetPrice)} vorgeschlagen.`,
      recommendedPrice: Number(item.targetPrice),
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: `Hallo! Ich könnte dir ${title} für ${formatPrice(item.targetPrice)} anbieten 😊`,
        short: `Ich könnte dir den Artikel für ${formatPrice(item.targetPrice)} anbieten.`,
        detailed: `Hallo, danke für dein Interesse! Mein aktueller Preisvorschlag für ${title} liegt bei ${formatPrice(item.targetPrice)} 😊`
      }, style)
    };
  }

  if (intent === "reservation") {
    return {
      action: "answer",
      label: "Zeitraum erfragen",
      reason: "Vor einer Reservierung sollte die gewünschte Dauer geklärt werden.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: "Hallo! Bis wann möchtest du den Artikel reserviert haben? Dann prüfe ich gerne, ob das möglich ist 😊",
        short: "Bis wann möchtest du den Artikel reserviert haben?",
        detailed: "Hallo! Eine Reservierung kann ich gerne prüfen. Schreib mir bitte kurz, bis zu welchem Datum du den Artikel reserviert haben möchtest 😊"
      }, style)
    };
  }

  if (intent === "bundle") {
    return {
      action: "answer",
      label: "Paket klären",
      reason: "Für einen möglichen Paketpreis müssen zuerst die gewünschten Artikel bekannt sein.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: "Hallo! Welche Artikel möchtest du zusammen kaufen? Dann schaue ich gerne, welcher Paketpreis möglich ist 😊",
        short: "Welche Artikel möchtest du zusammen kaufen? Dann prüfe ich einen Paketpreis.",
        detailed: "Hallo! Bei mehreren Artikeln kann ich gerne prüfen, ob ein Paketpreis möglich ist. Schreib mir bitte kurz, welche Artikel du zusammen kaufen möchtest 😊"
      }, style)
    };
  }

  if (intent === "household") {
    return {
      action: "answer",
      label: "Haushalt beantworten",
      reason: "Die Antwort verwendet den hinterlegten allgemeinen Haushaltshinweis.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: "Hallo! Der Artikel stammt aus einem tierfreien Nichtraucherhaushalt 😊",
        short: "Der Artikel stammt aus einem tierfreien Nichtraucherhaushalt.",
        detailed: "Hallo! Der Artikel wurde in einem tierfreien Nichtraucherhaushalt aufbewahrt. Bei weiteren Fragen kannst du dich gerne melden 😊"
      }, style)
    };
  }

  if (intent === "availability") {
    const available = ["draft", "listed"].includes(item.status);
    return {
      action: available ? "answer" : "review",
      label: available ? "Verfügbarkeit bestätigen" : "Status prüfen",
      reason: available ? "Der Artikel ist im Bestand noch nicht verkauft." : `Der Artikel hat bereits den Status „${getStatusLabel(item.status)}“.`,
      recommendedPrice: null,
      intent,
      needsHumanReview: !available,
      reply: available ? styleReply({
        friendly: `Hallo! Ja, ${title} ist noch verfügbar 😊`,
        short: "Ja, der Artikel ist noch verfügbar.",
        detailed: `Hallo! Ja, ${title} ist aktuell noch verfügbar. Du kannst den Artikel direkt über Vinted kaufen 😊`
      }, style) : ""
    };
  }

  if (intent === "material") {
    if (!item.material?.trim()) {
      return {
        action: "review",
        label: "Material fehlt",
        reason: "Für diesen Artikel ist noch kein Material hinterlegt.",
        recommendedPrice: null,
        intent,
        needsHumanReview: true,
        reply: ""
      };
    }
    return {
      action: "answer",
      label: "Material beantworten",
      reason: "Die Antwort verwendet ausschließlich das gespeicherte Material.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: styleReply({
        friendly: `Hallo! Als Material ist bei ${title} „${item.material.trim()}“ angegeben 😊`,
        short: `Material: ${item.material.trim()}.`,
        detailed: `Hallo! Laut den hinterlegten Artikeldaten besteht ${title} aus folgendem Material: ${item.material.trim()}. Bitte beachte ergänzend das Foto des Pflegeetiketts 😊`
      }, style)
    };
  }

  if (intent === "external-payment") {
    return {
      action: "answer",
      label: "Bei Vinted bleiben",
      reason: "Kauf und Zahlung sollten ausschließlich über Vinted abgewickelt werden.",
      recommendedPrice: null,
      intent,
      needsHumanReview: false,
      reply: "Hallo! Ich wickele Kauf, Zahlung und Versand ausschließlich sicher über Vinted ab. Danke für dein Verständnis."
    };
  }

  if (intent === "authenticity" || intent === "complaint") {
    return {
      action: "review",
      label: intent === "authenticity" ? "Echtheit manuell prüfen" : "Beschwerde manuell prüfen",
      reason: intent === "authenticity"
        ? "Aussagen zur Echtheit dürfen nicht automatisch aus unvollständigen Daten erzeugt werden."
        : "Beschwerden sollten immer persönlich anhand des vollständigen Gesprächs geprüft werden.",
      recommendedPrice: null,
      intent,
      needsHumanReview: true,
      reply: ""
    };
  }

  return {
    action: "review",
    label: "Manuell prüfen",
    reason: "Die Frage lässt sich nicht sicher aus den hinterlegten Artikeldaten beantworten.",
    recommendedPrice: null,
    intent,
    needsHumanReview: true,
    reply: ""
  };
}

export function validatePriceLimits({ listPrice, targetPrice, floorPrice }) {
  const list = Number(listPrice);
  const target = Number(targetPrice);
  const floor = Number(floorPrice);

  if (![list, target, floor].every((value) => Number.isFinite(value) && value > 0)) {
    return "Alle drei Preise müssen größer als 0 sein.";
  }
  if (floor > target) return "Die Untergrenze darf nicht über dem Zielpreis liegen.";
  if (target > list) return "Der Zielpreis darf nicht über dem Listenpreis liegen.";
  return null;
}
