const CATEGORY_RULES = [
  { pattern: /hoodie|kapuzen/, path: "Kleidung > Pullover & Sweatshirts > Kapuzenpullover" },
  { pattern: /sweatshirt/, path: "Kleidung > Pullover & Sweatshirts > Sweatshirts" },
  { pattern: /pullover|strick/, path: "Kleidung > Pullover & Sweatshirts > Pullover" },
  { pattern: /t[- ]?shirt/, path: "Kleidung > Oberteile & T-Shirts > T-Shirts" },
  { pattern: /polo/, path: "Kleidung > Oberteile & T-Shirts > Poloshirts" },
  { pattern: /hemd/, path: "Kleidung > Hemden" },
  { pattern: /bluse/, path: "Kleidung > Blusen" },
  { pattern: /jeans/, path: "Kleidung > Hosen & Jeans > Jeans" },
  { pattern: /jogging|jogger/, path: "Kleidung > Hosen & Jeans > Jogginghosen" },
  { pattern: /shorts|kurze hose/, path: "Kleidung > Hosen & Shorts > Shorts" },
  { pattern: /hose/, path: "Kleidung > Hosen & Jeans > Hosen" },
  { pattern: /winterjacke|parka/, path: "Kleidung > Jacken & Mäntel > Winterjacken" },
  { pattern: /jacke/, path: "Kleidung > Jacken & Mäntel > Jacken" },
  { pattern: /mantel/, path: "Kleidung > Jacken & Mäntel > Mäntel" },
  { pattern: /kleid/, path: "Kleidung > Kleider" },
  { pattern: /rock/, path: "Kleidung > Röcke" },
  { pattern: /trikot/, path: "Kleidung > Sportbekleidung > Trikots" },
  { pattern: /laufschuh/, path: "Schuhe > Sportschuhe > Laufschuhe" },
  { pattern: /fußballschuh|fussballschuh/, path: "Schuhe > Sportschuhe > Fußballschuhe" },
  { pattern: /sneaker/, path: "Schuhe > Sportschuhe & Sneaker > Sneaker" },
  { pattern: /stiefel|boots/, path: "Schuhe > Stiefel" },
  { pattern: /sandale/, path: "Schuhe > Sandalen" },
  { pattern: /schuh/, path: "Schuhe > Sonstige Schuhe" },
  { pattern: /mütze|muetze|beanie|cap|kappe/, path: "Accessoires > Mützen & Hüte" },
  { pattern: /gürtel|guertel/, path: "Accessoires > Gürtel" },
  { pattern: /tasche|rucksack/, path: "Taschen" }
];

function clean(value) {
  return String(value || "").trim();
}

function capitalize(value) {
  const text = clean(value);
  return text ? text.charAt(0).toLocaleUpperCase("de-DE") + text.slice(1) : "";
}

function sentence(value) {
  const text = clean(value);
  return text && !/[.!?]$/.test(text) ? `${text}.` : text;
}

export function suggestCategory(item = {}) {
  const audience = clean(item.audience) || "Herren";
  const itemType = clean(item.itemType).toLocaleLowerCase("de-DE");
  const match = CATEGORY_RULES.find((rule) => rule.pattern.test(itemType));
  return `${audience} > ${match?.path || "Kleidung > Sonstiges"}`;
}

export function suggestPackageSize(item = {}) {
  const itemType = clean(item.itemType).toLocaleLowerCase("de-DE");
  if (/stiefel|boots|winterjacke|mantel|parka/.test(itemType)) return "Groß";
  if (/schuh|sneaker|jacke|hoodie|pullover|jeans|hose/.test(itemType)) return "Mittel";
  return "Klein";
}

export function generateListingTitle(item = {}) {
  const parts = [
    clean(item.brand) && clean(item.brand).toLocaleLowerCase("de-DE") !== "keine marke" ? clean(item.brand) : "",
    clean(item.itemType),
    clean(item.model),
    clean(item.color),
    clean(item.size) ? `Größe ${clean(item.size)}` : ""
  ].filter(Boolean);

  return parts.map(capitalize).join(" ").replace(/\s+/g, " ").slice(0, 100);
}

export function generateListingDescription(item = {}) {
  const title = generateListingTitle(item) || "Second-Hand-Artikel";
  const detailLines = [
    clean(item.brand) ? `• Marke: ${clean(item.brand)}` : "",
    clean(item.itemType) ? `• Artikelart: ${clean(item.itemType)}` : "",
    clean(item.model) ? `• Modell/Besonderheit: ${clean(item.model)}` : "",
    clean(item.size) ? `• Größe: ${clean(item.size)}` : "",
    clean(item.color) ? `• Farbe: ${clean(item.color)}` : "",
    clean(item.material) ? `• Material: ${clean(item.material)}` : ""
  ].filter(Boolean);
  const conditionLines = [
    clean(item.condition) ? `• Zustand: ${clean(item.condition)}` : "",
    clean(item.flaws) ? `• Mängel/Besonderheiten: ${sentence(item.flaws)}` : "",
    clean(item.visualDetails) ? `• Weitere Details: ${sentence(item.visualDetails)}` : ""
  ].filter(Boolean);
  const sections = [
    title,
    detailLines.length ? `ARTIKELDETAILS\n${detailLines.join("\n")}` : "",
    conditionLines.length ? `ZUSTAND\n${conditionLines.join("\n")}` : "",
    clean(item.measurements) ? `MAẞE (flach gemessen)\n${sentence(item.measurements)}` : "",
    [
      "Bitte beachte die Fotos – sie sind Bestandteil der Artikelbeschreibung.",
      "Der Artikel stammt aus einem tierfreien Nichtraucherhaushalt.",
      sentence(clean(item.shipping) || "Der Versand erfolgt über die bei Vinted auswählbaren Versandarten")
    ].join("\n")
  ].filter(Boolean);

  return sections.join("\n\n").trim();
}

export function getMeasurementChecklist(item = {}) {
  const itemType = clean(item.itemType).toLocaleLowerCase("de-DE");
  if (/hose|jeans|shorts|rock/.test(itemType)) return ["Bundweite", "Innenbeinlänge", "Gesamtlänge"];
  if (/schuh|sneaker|stiefel|boots|sandale/.test(itemType)) return ["Innensohlenlänge"];
  if (/jacke|mantel|parka|hoodie|pullover|sweatshirt|shirt|hemd|bluse|trikot|polo/.test(itemType)) {
    return ["Brustweite", "Gesamtlänge", "Ärmellänge"];
  }
  if (/tasche|rucksack/.test(itemType)) return ["Höhe", "Breite", "Tiefe"];
  return ["Breite", "Höhe/Länge"];
}

export function getListingWarnings(item = {}, imageCount = 0) {
  const warnings = [];
  if (imageCount < 1) warnings.push("mindestens ein Foto");
  if (!clean(item.brand)) warnings.push("Marke oder „Keine Marke“");
  if (!clean(item.size)) warnings.push("Größe");
  if (!clean(item.color)) warnings.push("Farbe");
  if (!clean(item.material)) warnings.push("Material");
  if (!clean(item.measurements)) warnings.push("Maße");
  if (!clean(item.flaws)) warnings.push("Mängel-Angabe");
  return warnings;
}

export function generateListingDraft(item = {}) {
  return {
    title: generateListingTitle(item),
    description: generateListingDescription(item),
    category: suggestCategory(item),
    packageSize: suggestPackageSize(item)
  };
}

export function buildVintedSearchQuery(item = {}) {
  return [clean(item.brand), clean(item.itemType), clean(item.size), clean(item.color)]
    .filter(Boolean)
    .join(" ");
}

export function buildVintedSearchUrl(item = {}) {
  const query = buildVintedSearchQuery(item);
  return query ? `https://www.vinted.de/catalog?search_text=${encodeURIComponent(query)}` : "https://www.vinted.de/catalog";
}

export function normalizeVintedItemUrl(value = "") {
  try {
    const url = new URL(clean(value));
    const hostname = url.hostname.toLocaleLowerCase("de-DE");
    if (url.protocol !== "https:" || (hostname !== "vinted.de" && !hostname.endsWith(".vinted.de"))) return "";
    return url.href;
  } catch {
    return "";
  }
}
