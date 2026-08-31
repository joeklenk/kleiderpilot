import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://hxolfoevyfygqljmpqsq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uhyNX54ryMnLUMk9Ri0MmQ_1w2jFsgE";
const WORKSPACES_TABLE = "kleiderpilot_workspaces";
const MEMBERS_TABLE = "kleiderpilot_workspace_members";
const ITEMS_TABLE = "kleiderpilot_items_shared";
const IMAGE_BUCKET = "kleiderpilot-images-shared";

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
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

export function normalizePairCode(value = "") {
  return String(value).toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 16);
}

export function formatPairCode(value = "") {
  const code = normalizePairCode(value);
  return code.match(/.{1,4}/g)?.join("-") || "";
}

function getStoragePath(workspaceId, itemId, image = {}, index = 0) {
  const imageId = safeFileName(image.id || `image-${index + 1}`);
  return `${workspaceId}/${safeFileName(itemId)}/${imageId}.jpg`;
}

function stripImageData(item = {}, workspaceId) {
  return {
    ...item,
    images: Array.isArray(item.images)
      ? item.images.map((image, index) => ({
          id: image.id,
          name: image.name || `Artikelbild ${index + 1}`,
          width: image.width || null,
          height: image.height || null,
          size: image.size || null,
          storagePath: image.storagePath || getStoragePath(workspaceId, item.id, image, index)
        }))
      : []
  };
}

async function ensureSession() {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (data.session?.user) return data.session;

  const result = await client.auth.signInAnonymously();
  if (result.error) {
    const message = String(result.error.message || result.error);
    if (/anonymous|disabled|signups/i.test(message)) {
      throw new Error("Anonyme Geräte-Anmeldung ist in Supabase noch nicht aktiviert.");
    }
    throw result.error;
  }
  return result.data.session;
}

export async function initializeDeviceSession() {
  return ensureSession();
}

export async function getWorkspace() {
  await ensureSession();

  const { data: membership, error: membershipError } = await client
    .from(MEMBERS_TABLE)
    .select("workspace_id")
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.workspace_id) return null;

  const { data: workspace, error: workspaceError } = await client
    .from(WORKSPACES_TABLE)
    .select("id, pair_code")
    .eq("id", membership.workspace_id)
    .single();
  if (workspaceError) throw workspaceError;

  return {
    id: workspace.id,
    pairCode: formatPairCode(workspace.pair_code)
  };
}

export async function createWorkspace() {
  await ensureSession();
  const { data, error } = await client.rpc("kp_create_workspace");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.workspace_id) throw new Error("Gerätecode konnte nicht erstellt werden.");
  return {
    id: row.workspace_id,
    pairCode: formatPairCode(row.pair_code)
  };
}

export async function joinWorkspace(pairCode) {
  await ensureSession();
  const normalized = normalizePairCode(pairCode);
  if (normalized.length !== 16) throw new Error("Bitte den vollständigen 16-stelligen Gerätecode eingeben.");

  const { data, error } = await client.rpc("kp_join_workspace", { p_pair_code: normalized });
  if (error) {
    const message = String(error.message || error);
    if (/ungültig|invalid|not found|nicht gefunden/i.test(message)) {
      throw new Error("Gerätecode nicht gefunden. Bitte den Code auf einem bereits verbundenen Gerät prüfen.");
    }
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.workspace_id) throw new Error("Gerät konnte nicht verbunden werden.");
  return {
    id: row.workspace_id,
    pairCode: formatPairCode(row.pair_code)
  };
}

async function uploadItemImages(item, workspaceId, remotePayload = null) {
  const remotePaths = new Set(
    Array.isArray(remotePayload?.images)
      ? remotePayload.images.map((image) => image?.storagePath).filter(Boolean)
      : []
  );
  const desiredPaths = new Set();
  const cloudImages = [];

  for (let index = 0; index < (item.images || []).length; index += 1) {
    const image = item.images[index];
    const storagePath = image.storagePath || getStoragePath(workspaceId, item.id, image, index);
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

async function upsertCloudItem(item, workspaceId, remoteRow = null) {
  const cloudImages = await uploadItemImages(item, workspaceId, remoteRow?.payload || null);
  const payload = {
    ...stripImageData(item, workspaceId),
    images: cloudImages
  };
  const updatedAt = item.updatedAt || item.createdAt || new Date().toISOString();
  const row = {
    workspace_id: workspaceId,
    id: item.id,
    sku: item.sku,
    payload,
    updated_at: updatedAt
  };

  const { error } = await client
    .from(ITEMS_TABLE)
    .upsert(row, { onConflict: "workspace_id,id" });
  if (error) throw error;
  return row;
}

export async function syncItems(localItems = [], workspace = null) {
  const activeWorkspace = workspace || await getWorkspace();
  if (!activeWorkspace?.id) throw new Error("Dieses Gerät ist noch nicht mit einem KleiderPilot-Bestand verbunden.");
  const workspaceId = activeWorkspace.id;

  const { data: rows, error } = await client
    .from(ITEMS_TABLE)
    .select("id, sku, payload, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: true });
  if (error) throw error;

  const remoteRows = new Map((rows || []).map((row) => [row.id, row]));
  const localMap = new Map(localItems.map((item) => [item.id, item]));
  const merged = new Map();

  for (const localItem of localItems) {
    const remoteRow = remoteRows.get(localItem.id);
    if (!remoteRow || itemTimestamp(localItem) > rowTimestamp(remoteRow)) {
      await upsertCloudItem(localItem, workspaceId, remoteRow || null);
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
