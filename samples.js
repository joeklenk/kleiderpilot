import { getNextSku } from "./rules.js";

const SAMPLE_DEFINITIONS = [
  {
    itemType: "Hoodie",
    brand: "Nike",
    model: "Sportswear Club Fleece",
    size: "M",
    color: "Schwarz",
    material: "Baumwolle",
    condition: "Sehr gut",
    listPrice: 40,
    targetPrice: 35,
    floorPrice: 31,
    status: "draft",
    palette: ["#202a27", "#54c49a"],
    images: ["Vorderseite", "Rueckseite"]
  },
  {
    itemType: "T-Shirt",
    brand: "Adidas",
    size: "L",
    color: "Weiß",
    material: "Baumwolle",
    condition: "Gut",
    listPrice: 18,
    targetPrice: 15,
    floorPrice: 12,
    status: "draft",
    palette: ["#e7e8e4", "#6b7771"],
    images: ["Vorderseite"]
  },
  {
    itemType: "Jeans",
    brand: "Levi's",
    size: "W32/L32",
    color: "Blau",
    material: "Denim",
    condition: "Sehr gut",
    listPrice: 45,
    targetPrice: 39,
    floorPrice: 34,
    status: "listed",
    listedDaysAgo: 4,
    palette: ["#315b85", "#a9c6df"],
    images: ["Vorderseite", "Etikett", "Detail"]
  },
  {
    itemType: "Winterjacke",
    brand: "Zara",
    size: "M",
    color: "Beige",
    material: "Polyester",
    condition: "Sehr gut",
    listPrice: 55,
    targetPrice: 48,
    floorPrice: 42,
    status: "listed",
    listedDaysAgo: 17,
    palette: ["#b9a389", "#f1e8dc"],
    images: ["Vorderseite", "Rueckseite"]
  },
  {
    itemType: "Cap",
    brand: "New Era",
    model: "9Forty",
    size: "One Size",
    color: "Rot",
    material: "Baumwolle",
    condition: "Gut",
    listPrice: 22,
    targetPrice: 19,
    floorPrice: 16,
    status: "deleted",
    listedDaysAgo: 31,
    deletedDaysAgo: 2,
    palette: ["#9d2d35", "#efabb0"],
    images: ["Vorderseite"]
  },
  {
    itemType: "Hemd",
    brand: "Jack & Jones",
    size: "M",
    color: "Hellblau",
    material: "Baumwolle",
    condition: "Sehr gut",
    listPrice: 28,
    targetPrice: 24,
    floorPrice: 20,
    status: "sold",
    listedDaysAgo: 20,
    soldDaysAgo: 8,
    salePrice: 24,
    palette: ["#6fa9c7", "#d8eef8"],
    images: ["Vorderseite", "Manschette"]
  },
  {
    itemType: "Poloshirt",
    brand: "Tommy Hilfiger",
    size: "L",
    color: "Dunkelblau",
    material: "Baumwolle",
    condition: "Gut",
    listPrice: 32,
    targetPrice: 28,
    floorPrice: 24,
    status: "sold",
    listedDaysAgo: 42,
    soldDaysAgo: 15,
    salePrice: 27,
    palette: ["#243c65", "#8da6c9"],
    images: ["Vorderseite"]
  },
  {
    itemType: "Sneaker",
    brand: "Puma",
    size: "43",
    color: "Schwarz/Weiß",
    material: "Synthetik",
    condition: "Gut",
    listPrice: 38,
    targetPrice: 33,
    floorPrice: 29,
    status: "sold",
    listedDaysAgo: 25,
    soldDaysAgo: 10,
    salePrice: 31,
    palette: ["#252b29", "#d9dddb"],
    images: ["Paar", "Sohle", "Groesse"]
  },
  {
    itemType: "Jogginghose",
    brand: "Nike",
    size: "M",
    color: "Grau",
    material: "Baumwollmix",
    condition: "Sehr gut",
    listPrice: 30,
    targetPrice: 26,
    floorPrice: 22,
    status: "shipped",
    listedDaysAgo: 14,
    soldDaysAgo: 5,
    shippedDaysAgo: 3,
    salePrice: 26,
    palette: ["#747d79", "#d6dcda"],
    images: ["Vorderseite", "Logo"]
  },
  {
    itemType: "Fußballtrikot",
    brand: "Adidas",
    size: "L",
    color: "Grün",
    material: "Polyester",
    condition: "Sehr gut",
    listPrice: 48,
    targetPrice: 42,
    floorPrice: 37,
    status: "shipped",
    listedDaysAgo: 33,
    soldDaysAgo: 12,
    shippedDaysAgo: 9,
    salePrice: 41,
    palette: ["#087f5b", "#9dddc5"],
    images: ["Vorderseite", "Rueckseite", "Etikett"]
  }
];

function dateDaysAgo(referenceDate, days) {
  return new Date(referenceDate.getTime() - days * 86_400_000).toISOString();
}

function createSampleImage(label, detail, palette, index) {
  const [background, accent] = palette;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" rx="48" fill="${background}"/><circle cx="650" cy="145" r="105" fill="${accent}" opacity=".55"/><rect x="95" y="115" width="610" height="570" rx="38" fill="#fff" opacity=".12"/><text x="400" y="345" fill="#fff" font-family="Arial,sans-serif" font-size="58" font-weight="700" text-anchor="middle">${label}</text><text x="400" y="420" fill="#fff" font-family="Arial,sans-serif" font-size="34" text-anchor="middle">${detail}</text><text x="400" y="610" fill="#fff" opacity=".72" font-family="Arial,sans-serif" font-size="24" text-anchor="middle">KleiderPilot Testbild ${index + 1}</text></svg>`;
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return {
    id: `sample-image-${label.toLocaleLowerCase("de-DE").replace(/[^a-z0-9]+/g, "-")}-${index + 1}`,
    name: `${label}-${detail}.svg`,
    dataUrl,
    width: 800,
    height: 800,
    size: dataUrl.length
  };
}

export function createSampleItems(existingItems = [], referenceValue = new Date()) {
  const referenceDate = new Date(referenceValue);
  const usedItems = [...existingItems];

  return SAMPLE_DEFINITIONS.map((definition, index) => {
    const sku = getNextSku(usedItems);
    const listedAt = Number.isFinite(definition.listedDaysAgo)
      ? dateDaysAgo(referenceDate, definition.listedDaysAgo)
      : null;
    const soldAt = Number.isFinite(definition.soldDaysAgo)
      ? dateDaysAgo(referenceDate, definition.soldDaysAgo)
      : null;
    const shippedAt = Number.isFinite(definition.shippedDaysAgo)
      ? dateDaysAgo(referenceDate, definition.shippedDaysAgo)
      : null;
    const deletedAt = Number.isFinite(definition.deletedDaysAgo)
      ? dateDaysAgo(referenceDate, definition.deletedDaysAgo)
      : null;
    const title = `${definition.brand} ${definition.itemType} ${definition.color} Größe ${definition.size}`;
    const createdAt = dateDaysAgo(referenceDate, Math.max(definition.listedDaysAgo || 0, 3) + 2);
    const item = {
      id: `kleiderpilot-sample-${index + 1}`,
      sampleData: true,
      sampleVersion: 1,
      sku,
      images: definition.images.map((detail, imageIndex) =>
        createSampleImage(`${definition.brand} ${definition.itemType}`, detail, definition.palette, imageIndex)
      ),
      audience: "Herren",
      itemType: definition.itemType,
      model: definition.model || "",
      brand: definition.brand,
      size: definition.size,
      condition: definition.condition,
      color: definition.color,
      material: definition.material,
      visualDetails: "Beispielartikel zum Testen der KleiderPilot-Funktionen",
      measurements: "Beispielmaße sind im Testdatensatz hinterlegt",
      flaws: definition.condition === "Gut" ? "Leichte, übliche Gebrauchsspuren" : "Keine bekannten Mängel",
      shipping: "Der Versand erfolgt über die bei Vinted auswählbaren Versandarten",
      title,
      description: `${title}. Beispielbeschreibung für den Funktionstest.`,
      category: `Herren > Kleidung > ${definition.itemType}`,
      packageSize: ["Winterjacke"].includes(definition.itemType)
        ? "Groß"
        : ["Hoodie", "Jeans", "Sneaker", "Jogginghose"].includes(definition.itemType)
          ? "Mittel"
          : "Klein",
      listPrice: definition.listPrice,
      targetPrice: definition.targetPrice,
      floorPrice: definition.floorPrice,
      vintedUrl: index === 2 ? "https://www.vinted.de/catalog?search_text=levis%20jeans" : "",
      status: definition.status,
      ...(listedAt ? { listedAt } : {}),
      ...(definition.salePrice ? { salePrice: definition.salePrice } : {}),
      ...(soldAt ? { soldAt } : {}),
      ...(shippedAt ? { shippedAt } : {}),
      ...(deletedAt ? { deletedAt, statusBeforeDelete: "listed" } : {}),
      createdAt,
      updatedAt: deletedAt || shippedAt || soldAt || listedAt || createdAt
    };
    usedItems.push(item);
    return item;
  });
}
