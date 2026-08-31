const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Das Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function createImageId() {
  return globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function estimateDataUrlBytes(dataUrl = "") {
  const base64 = String(dataUrl).split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export async function compressImageFile(file) {
  if (!file?.type?.startsWith("image/")) throw new Error("Bitte wähle ausschließlich Bilddateien aus.");

  const sourceUrl = await readFileAsDataUrl(file);
  const image = new Image();
  image.src = sourceUrl;
  await image.decode();

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return {
    id: createImageId(),
    name: String(file.name || "Artikelbild"),
    dataUrl,
    width,
    height,
    size: estimateDataUrlBytes(dataUrl)
  };
}
