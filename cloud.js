import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://hxolfoevyfygqljmpqsq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uhyNX54ryMnLUMk9Ri0MmQ_1w2jFsgE";
const ITEMS_TABLE = "kleiderpilot_items";
const IMAGE_BUCKET = "kleiderpilot-images";

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

function itemTimestamp(item = {}) {
  const timestamp = Date.parse(item.updatedAt || item.createdAt || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function rowTimestamp(row = {}) {
  const payloadTimestamp = itemTimestamp(row.payload || {});
  const rowValue = Date.parse(row.updated_at || "");
  const rowTimestampValue = Number.isFinite(rowValue) ? rowValue : 0;
  return Math.max(payloadTimestamp, rowTimestampValue);
}

function dataUrlToBlob(dataUrl = "") {
  const [header, encoded = ""] = String(dataUrl).split(",");
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  const mimeType = mimeMatch?.[1] || "image/jpeg";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Cloud-Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

function safeFileName(value = "image") {
  return String(value)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "image";
}

function getStoragePath(userId, itemId, image = {}, index = 0) {
  const imageId = safeFileName(image.id || `image-${index + 1}`);
  return `${userId}/${safeFileName(itemId)}/${imageId}.jpg`;
}

function stripImageData(item = {}, userId) {
  return {
    ...item,
    images: Array.isArray(item.images)
      ? item.images.map((image, index) => ({
          id: image.id,
          name: image.name || `Artikelbild ${index + 1}`,
          width: image.width || null,
          height: image.height || null,
          size: image.size || null,
          storagePath: image.storagePath || getStoragePath(userId, item.id, image, index)
        }))
      : []
  };
}

async function uploadItemImages(item, userId, remotePayload = null) {
  const remotePaths = new Set(
    Array.isArray(remotePayload?.images)
      ? remotePayload.images.map((image) => image?.storagePath).filter(Boolean)
      : []
  );
  const desiredPaths = new Set();
  const cloudImages = [];

  for (let index = 0; index < (item.images || []).length; index += 1) {
    const image = item.images[index];
    const storagePath = image.storagePath || getStoragePath(userId, item.id, image, index);
    desiredPaths.add(storagePath);

    if (typeof image.dataUrl === "string" && image.dataUrl.startsWith("data:image/")) {
      const blob = dataUrlToBlob(image.dataUrl);
      const { error } = await client.storage.from(IMAGE_BUCKET).upload(storagePath, blob, {
        contentType: blob.type || "image/jpeg",
        cacheControl: "3600",
        upsert: true
      });
      if (error) throw error;
    }

    cloudImages.push({
      id: image.id,
      name: image.name || `Artikelbild ${index + 1}`,
      width: image.width || null,
      height: image.height || null,
      size: image.size || null,
      storagePath
    });
  }

  const stalePaths = [...remotePaths].filter((path) => !desiredPaths.has(path));
  if (stalePaths.length > 0) {
    const { error } = await client.storage.from(IMAGE_BUCKET).remove(stalePaths);
    if (error) throw error;
  }

  return cloudImages;
}

async function hydrateCloudItem(row, localItem = null) {
  const payload = row.payload || {};
  const localImages = new Map((localItem?.images || []).map((image) => [image.id, image]));
  const images = [];

  for (let index = 0; index < (payload.images || []).length; index += 1) {
    const cloudImage = payload.images[index];
    const localImage = localImages.get(cloudImage.id);
    if (localImage?.dataUrl) {
      images.push({ ...cloudImage, dataUrl: localImage.dataUrl });
      continue;
    }

    if (!cloudImage.storagePath) continue;
    const { data, error } = await client.storage.from(IMAGE_BUCKET).download(cloudImage.storagePath);
    if (error) throw error;
    images.push({ ...cloudImage, dataUrl: await blobToDataUrl(data) });
  }

  return {
    ...payload,
    id: row.id,
    sku: payload.sku || row.sku,
    images
  };
}

async function upsertCloudItem(item, userId, remoteRow = null) {
  const cloudImages = await uploadItemImages(item, userId, remoteRow?.payload || null);
  const payload = {
    ...stripImageData(item, userId),
    images: cloudImages
  };
  const updatedAt = item.updatedAt || item.createdAt || new Date().toISOString();
  const row = {
    user_id: userId,
    id: item.id,
    sku: item.sku,
    payload,
    updated_at: updatedAt
  };

  const { error } = await client
    .from(ITEMS_TABLE)
    .upsert(row, { onConflict: "user_id,id" });
  if (error) throw error;
  return row;
}

export async function getSession() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function signIn(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  return client.auth.onAuthStateChange((_event, session) => callback(session));
}

export async function syncItems(localItems = []) {
  const session = await getSession();
  if (!session?.user) throw new Error("Nicht bei KleiderPilot Cloud angemeldet.");
  const userId = session.user.id;

  const { data: rows, error } = await client
    .from(ITEMS_TABLE)
    .select("id, sku, payload, updated_at")
    .order("updated_at", { ascending: true });
  if (error) throw error;

  const remoteRows = new Map((rows || []).map((row) => [row.id, row]));
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const merged = new Map();

  for (const localItem of localItems) {
    const remoteRow = remoteRows.get(localItem.id);
    if (!remoteRow || itemTimestamp(localItem) > rowTimestamp(remoteRow)) {
      await upsertCloudItem(localItem, userId, remoteRow || null);
      merged.set(localItem.id, localItem);
      continue;
    }

    if (itemTimestamp(localItem) === rowTimestamp(remoteRow)) {
      merged.set(localItem.id, localItem);
      continue;
    }

    merged.set(localItem.id, await hydrateCloudItem(remoteRow, localItem));
  }

  for (const remoteRow of rows || []) {
    if (localMap.has(remoteRow.id)) continue;
    merged.set(remoteRow.id, await hydrateCloudItem(remoteRow));
  }

  return [...merged.values()];
}

export async function pingCloud() {
  const session = await getSession();
  if (!session?.user) return false;
  const { error } = await client.from(ITEMS_TABLE).select("id", { head: true, count: "exact" });
  if (error) throw error;
  return true;
}
