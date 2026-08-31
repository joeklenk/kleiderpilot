const STORAGE_KEY = "kleiderpilot_items_v1";
const DB_NAME = "kleiderpilot";
const DB_VERSION = 1;
const STORE_NAME = "app";

function normalizeStatus(status) {
  if (status === "available") return "draft";
  if (status === "reserved") return "listed";
  if (["draft", "listed", "sold", "shipped", "deleted"].includes(status)) return status;
  return "draft";
}

function normalizeItem(rawItem) {
  const {
    location: _removedLocation,
    comparablePrices: _removedComparablePrices,
    ...item
  } = rawItem;
  return {
    ...item,
    audience: item.audience || "Herren",
    itemType: item.itemType || item.title || "",
    model: item.model || "",
    description: item.description || "",
    category: item.category || "",
    color: item.color || "",
    material: item.material || "",
    visualDetails: item.visualDetails || "",
    vintedUrl: item.vintedUrl || "",
    status: normalizeStatus(item.status),
    images: Array.isArray(item.images)
      ? item.images
          .filter((image) => image && typeof image.dataUrl === "string" && image.dataUrl.startsWith("data:image/"))
          .slice(0, 20)
          .map((image, index) => ({
            ...image,
            id: image.id || `imported-image-${index + 1}`,
            name: image.name || `Artikelbild ${index + 1}`
          }))
      : []
  };
}

function hasChromeStorage() {
  return typeof globalThis.chrome !== "undefined" && Boolean(globalThis.chrome?.storage?.local);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Lokaler Speicher konnte nicht geöffnet werden."));
  });
}

async function readFromIndexedDb() {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(STORAGE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Artikeldaten konnten nicht gelesen werden."));
    });
  } finally {
    db.close();
  }
}

async function writeToIndexedDb(items) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(items, STORAGE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Artikeldaten konnten nicht gespeichert werden."));
      transaction.onabort = () => reject(transaction.error || new Error("Speichern wurde abgebrochen."));
    });
  } finally {
    db.close();
  }
}

export async function loadItems() {
  let stored;
  if (hasChromeStorage()) {
    const result = await globalThis.chrome.storage.local.get(STORAGE_KEY);
    stored = result[STORAGE_KEY];
  } else {
    stored = await readFromIndexedDb();
  }
  return Array.isArray(stored) ? stored.map(normalizeItem) : [];
}

export async function saveItems(items) {
  if (hasChromeStorage()) {
    await globalThis.chrome.storage.local.set({ [STORAGE_KEY]: items });
    return;
  }
  await writeToIndexedDb(items);
}

export async function exportData(items) {
  return JSON.stringify(
    {
      app: "KleiderPilot",
      version: 9,
      exportedAt: new Date().toISOString(),
      items
    },
    null,
    2
  );
}

export function validateImport(payload) {
  if (!payload || payload.app !== "KleiderPilot" || !Array.isArray(payload.items)) {
    throw new Error("Die Datei ist kein gültiger KleiderPilot-Export.");
  }

  const items = payload.items.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== "object") {
      throw new Error(`Artikel ${index + 1} in der Sicherung ist ungültig.`);
    }

    const item = normalizeItem(rawItem);
    if (!item.id || !item.sku || !item.title) {
      throw new Error(`Bei Artikel ${index + 1} fehlen ID, Artikelnummer oder Bezeichnung.`);
    }

    return item;
  });

  const normalizedSkus = items.map((item) => String(item.sku).trim().toLocaleLowerCase("de-DE"));
  if (new Set(normalizedSkus).size !== normalizedSkus.length) {
    throw new Error("Die Sicherung enthält doppelte Artikelnummern.");
  }

  return items;
}
