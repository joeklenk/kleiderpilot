const VALID_AUDIENCES = new Set(["Herren", "Damen", "Kinder"]);
const VALID_CONDITIONS = new Set([
  "Neu mit Etikett",
  "Neu ohne Etikett",
  "Sehr gut",
  "Gut",
  "Zufriedenstellend"
]);

const MAX_BATCH_ITEMS = 100;

function cleanString(value, maxLength = 4000) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLength);
}

function optionalPositiveNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  return number;
}

function normalizeImages(images, itemLabel = "Artikel") {
  if (!Array.isArray(images)) return [];
  return images.slice(0, 20).map((image, index) => {
    if (!image || typeof image !== "object") {
      throw new Error(`${itemLabel}: Bild ${index + 1} ist ungültig.`);
    }

    const dataUrl = cleanString(image.dataUrl, 20_000_000);
    if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(dataUrl)) {
      throw new Error(`${itemLabel}: Bild ${index + 1} hat kein unterstütztes Bildformat. Erlaubt sind JPEG, PNG und WebP.`);
    }

    return {
      id: cleanString(image.id, 120),
      name: cleanString(image.name, 180) || `Artikelbild ${index + 1}`,
      dataUrl,
      width: Number.isFinite(Number(image.width)) ? Number(image.width) : null,
      height: Number.isFinite(Number(image.height)) ? Number(image.height) : null,
      size: Number.isFinite(Number(image.size)) ? Number(image.size) : null
    };
  });
}

function normalizeItem(raw, index = 0) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Artikel ${index + 1}: Die Artikeldaten sind ungültig.`);
  }

  const itemType = cleanString(raw.itemType, 160);

  const audience = VALID_AUDIENCES.has(raw.audience) ? raw.audience : "Herren";
  const condition = VALID_CONDITIONS.has(raw.condition) ? raw.condition : "Sehr gut";

  return {
    audience,
    itemType,
    brand: cleanString(raw.brand, 160),
    size: cleanString(raw.size, 80),
    model: cleanString(raw.model, 240),
    condition,
    color: cleanString(raw.color, 160),
    material: cleanString(raw.material, 240),
    visualDetails: cleanString(raw.visualDetails, 800),
    personalNote: cleanString(raw.personalNote, 800),
    listPrice: optionalPositiveNumber(raw.listPrice),
    targetPrice: optionalPositiveNumber(raw.targetPrice),
    floorPrice: optionalPositiveNumber(raw.floorPrice),
    measurements: cleanString(raw.measurements, 2000),
    flaws: cleanString(raw.flaws, 2000),
    shipping: cleanString(raw.shipping, 600) || "Der Versand erfolgt über die bei Vinted auswählbaren Versandarten",
    images: normalizeImages(raw.images, `Artikel ${index + 1}`)
  };
}

export function parseArticleImport(text) {
  const result = parseArticleImportFile(text);
  if (result.items.length !== 1) {
    throw new Error("Diese Datei enthält mehrere Artikel. Bitte den Sammelimport verwenden.");
  }
  return result.items[0];
}

export function parseArticleImportFile(text) {
  let payload;
  try {
    payload = JSON.parse(String(text || ""));
  } catch {
    throw new Error("Die ausgewählte Datei enthält kein gültiges JSON.");
  }

  if (!payload || payload.app !== "KleiderPilot") {
    throw new Error("Die Datei ist keine gültige KleiderPilot-Importdatei.");
  }

  if (payload.type === "article-import" && payload.item) {
    return {
      mode: "single",
      items: [normalizeItem(payload.item, 0)]
    };
  }

  if (payload.type === "article-batch-import" && Array.isArray(payload.items)) {
    if (payload.items.length === 0) {
      throw new Error("Die Sammelimport-Datei enthält keine Artikel.");
    }
    if (payload.items.length > MAX_BATCH_ITEMS) {
      throw new Error(`Eine Sammelimport-Datei darf höchstens ${MAX_BATCH_ITEMS} Artikel enthalten.`);
    }

    return {
      mode: "batch",
      items: payload.items.map((item, index) => normalizeItem(item, index))
    };
  }

  throw new Error("Die Datei ist weder eine gültige Einzel- noch Sammelimport-Datei für KleiderPilot.");
}
