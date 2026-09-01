import {
  calculateDaysBetween,
  calculateDashboardStats,
  filterAndSortInventory,
  formatPrice,
  getNextSku,
  getStatusLabel,
  isDeletedStatus,
  isSoldStatus,
  restoreDeletedItem,
  softDeleteItem,
  sortItemsBySku,
  suggestReply,
  transitionItemStatus,
  validatePriceLimits
} from "./rules.js";
import {
  buildVintedSearchUrl,
  generateListingDraft,
  getListingWarnings,
  getMeasurementChecklist,
  normalizeVintedItemUrl
} from "./listing.js";
import { compressImageFile } from "./images.js";
import { loadItems, saveItems } from "./storage.js";
import { createWorkspace, formatPairCode, getWorkspace, initializeDeviceSession, joinWorkspace, normalizePairCode, purgePreReleaseWorkspaceData, syncItems } from "./cloud.js";

let items = [];
let selectedImages = [];
let imagesProcessing = false;
let imageProcessingToken = 0;
let currentWorkspace = null;
let cloudSyncPromise = null;
let cloudSyncQueued = false;
let periodicSyncTimer = null;

const PRODUCTIVE_RELEASE_CUTOFF = "2026-09-01T07:43:14Z";
const PRODUCTIVE_RESET_KEY = "kleiderpilot_1_0_productive_reset_v1";

function isProductiveResetComplete() {
  try {
    return localStorage.getItem(PRODUCTIVE_RESET_KEY) === "done";
  } catch {
    return false;
  }
}

function markProductiveResetComplete() {
  try {
    localStorage.setItem(PRODUCTIVE_RESET_KEY, "done");
  } catch {
    // Der Cloud-Bestand bleibt trotzdem korrekt; nur der lokale Marker kann dann nicht gespeichert werden.
  }
}

const elements = {
  overviewView: document.querySelector("#overviewView"),
  itemView: document.querySelector("#itemView"),
  assistantView: document.querySelector("#assistantView"),
  openItemViewButton: document.querySelector("#openItemViewButton"),
  openAssistantViewButton: document.querySelector("#openAssistantViewButton"),
  homeMessage: document.querySelector("#homeMessage"),
  activeCount: document.querySelector("#activeCount"),
  soldCount: document.querySelector("#soldCount"),
  inventoryValue: document.querySelector("#inventoryValue"),
  revenueValue: document.querySelector("#revenueValue"),
  inventorySearch: document.querySelector("#inventorySearch"),
  inventoryStatusFilter: document.querySelector("#inventoryStatusFilter"),
  inventorySort: document.querySelector("#inventorySort"),
  itemForm: document.querySelector("#itemForm"),
  editingId: document.querySelector("#editingId"),
  sku: document.querySelector("#sku"),
  audience: document.querySelector("#audience"),
  itemType: document.querySelector("#itemType"),
  brand: document.querySelector("#brand"),
  size: document.querySelector("#size"),
  model: document.querySelector("#model"),
  condition: document.querySelector("#condition"),
  color: document.querySelector("#color"),
  material: document.querySelector("#material"),
  visualDetails: document.querySelector("#visualDetails"),
  listPrice: document.querySelector("#listPrice"),
  targetPrice: document.querySelector("#targetPrice"),
  floorPrice: document.querySelector("#floorPrice"),
  measurements: document.querySelector("#measurements"),
  flaws: document.querySelector("#flaws"),
  shipping: document.querySelector("#shipping"),
  vintedUrl: document.querySelector("#vintedUrl"),
  formMessage: document.querySelector("#formMessage"),
  itemFormHeading: document.querySelector("#itemFormHeading"),
  resetFormButton: document.querySelector("#resetFormButton"),
  refreshDraftButton: document.querySelector("#refreshDraftButton"),
  itemPhotos: document.querySelector("#itemPhotos"),
  photoPreview: document.querySelector("#photoPreview"),
  photoMessage: document.querySelector("#photoMessage"),
  vintedSearchLink: document.querySelector("#vintedSearchLink"),
  vintedTitle: document.querySelector("#vintedTitle"),
  vintedDescription: document.querySelector("#vintedDescription"),
  vintedCategory: document.querySelector("#vintedCategory"),
  vintedBrand: document.querySelector("#vintedBrand"),
  vintedSize: document.querySelector("#vintedSize"),
  vintedCondition: document.querySelector("#vintedCondition"),
  vintedColor: document.querySelector("#vintedColor"),
  vintedMaterial: document.querySelector("#vintedMaterial"),
  vintedPackageSize: document.querySelector("#vintedPackageSize"),
  vintedPrice: document.querySelector("#vintedPrice"),
  titleCounter: document.querySelector("#titleCounter"),
  measurementChecklist: document.querySelector("#measurementChecklist"),
  listingWarnings: document.querySelector("#listingWarnings"),
  copyListingButton: document.querySelector("#copyListingButton"),
  copyListingMessage: document.querySelector("#copyListingMessage"),
  resetAssistantButton: document.querySelector("#resetAssistantButton"),
  assistantForm: document.querySelector("#assistantForm"),
  assistantItem: document.querySelector("#assistantItem"),
  buyerMessage: document.querySelector("#buyerMessage"),
  explicitOffer: document.querySelector("#explicitOffer"),
  responseStyle: document.querySelector("#responseStyle"),
  counterOffers: document.querySelector("#counterOffers"),
  suggestionCard: document.querySelector("#suggestionCard"),
  suggestionLabel: document.querySelector("#suggestionLabel"),
  suggestionIntent: document.querySelector("#suggestionIntent"),
  suggestionReason: document.querySelector("#suggestionReason"),
  manualWarning: document.querySelector("#manualWarning"),
  replyContainer: document.querySelector("#replyContainer"),
  suggestedReply: document.querySelector("#suggestedReply"),
  copyReplyButton: document.querySelector("#copyReplyButton"),
  copyMessage: document.querySelector("#copyMessage"),
  inventoryBody: document.querySelector("#inventoryBody"),
  emptyState: document.querySelector("#emptyState"),
  assistantItemSummary: document.querySelector("#assistantItemSummary"),
  assistantSummaryImage: document.querySelector("#assistantSummaryImage"),
  assistantSummaryNoImage: document.querySelector("#assistantSummaryNoImage"),
  assistantSummarySku: document.querySelector("#assistantSummarySku"),
  assistantSummaryTitle: document.querySelector("#assistantSummaryTitle"),
  assistantSummaryMeta: document.querySelector("#assistantSummaryMeta"),
  assistantSummaryListPrice: document.querySelector("#assistantSummaryListPrice"),
  assistantSummaryTargetPrice: document.querySelector("#assistantSummaryTargetPrice"),
  assistantSummaryFloorPrice: document.querySelector("#assistantSummaryFloorPrice"),
  itemDetailsDialog: document.querySelector("#itemDetailsDialog"),
  closeDetailsDialog: document.querySelector("#closeDetailsDialog"),
  dialogSku: document.querySelector("#dialogSku"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogGallery: document.querySelector("#dialogGallery"),
  dialogMainImage: document.querySelector("#dialogMainImage"),
  dialogThumbnails: document.querySelector("#dialogThumbnails"),
  dialogNoImages: document.querySelector("#dialogNoImages"),
  dialogMeta: document.querySelector("#dialogMeta"),
  listedDateDialog: document.querySelector("#listedDateDialog"),
  listedDateForm: document.querySelector("#listedDateForm"),
  listedDateItemId: document.querySelector("#listedDateItemId"),
  listedDateInput: document.querySelector("#listedDateInput"),
  listedDateMessage: document.querySelector("#listedDateMessage"),
  closeListedDateDialog: document.querySelector("#closeListedDateDialog"),
  cancelListedDateButton: document.querySelector("#cancelListedDateButton"),
  deviceGate: document.querySelector("#deviceGate"),
  pageShell: document.querySelector("#pageShell"),
  createWorkspaceButton: document.querySelector("#createWorkspaceButton"),
  joinWorkspaceForm: document.querySelector("#joinWorkspaceForm"),
  joinWorkspaceButton: document.querySelector("#joinWorkspaceButton"),
  pairCodeInput: document.querySelector("#pairCodeInput"),
  deviceSetupMessage: document.querySelector("#deviceSetupMessage"),
  syncBadge: document.querySelector("#syncBadge"),
  cloudControls: document.querySelector("#cloudControls"),
  syncNowButton: document.querySelector("#syncNowButton"),
  pairDeviceButton: document.querySelector("#pairDeviceButton"),
  pairingDialog: document.querySelector("#pairingDialog"),
  pairCodeDisplay: document.querySelector("#pairCodeDisplay"),
  copyPairCodeButton: document.querySelector("#copyPairCodeButton"),
  pairCodeMessage: document.querySelector("#pairCodeMessage"),
  closePairingDialog: document.querySelector("#closePairingDialog")
};

function setSyncBadge(text, state = "") {
  elements.syncBadge.textContent = text;
  elements.syncBadge.classList.remove("sync-ok", "sync-working", "sync-error");
  if (state) elements.syncBadge.classList.add(`sync-${state}`);
}

function setConnectedUi(workspace) {
  currentWorkspace = workspace || null;
  const connected = Boolean(workspace?.id);
  elements.deviceGate.classList.toggle("hidden", connected);
  elements.pageShell.classList.toggle("hidden", !connected);
  elements.cloudControls.classList.toggle("hidden", !connected);
  if (connected) {
    setSyncBadge(navigator.onLine ? "☁ Bereit zur Synchronisierung" : "⚠ Offline – lokal gespeichert", navigator.onLine ? "working" : "error");
  } else {
    setSyncBadge("☁ Gerät noch nicht verbunden", "working");
  }
}

function showPairingCode() {
  if (!currentWorkspace?.pairCode) return;
  elements.pairCodeDisplay.textContent = currentWorkspace.pairCode;
  elements.pairCodeMessage.textContent = "";
  elements.pairingDialog.showModal();
}

async function runCloudSync({ announce = false } = {}) {
  if (!currentWorkspace?.id) return false;
  if (!navigator.onLine) {
    setSyncBadge("⚠ Offline – Änderungen bleiben lokal", "error");
    return false;
  }

  if (cloudSyncPromise) {
    cloudSyncQueued = true;
    return cloudSyncPromise;
  }

  cloudSyncPromise = (async () => {
    setSyncBadge("↻ Synchronisiere …", "working");
    try {
      items = await syncItems(items, currentWorkspace);
      await saveItems(items);
      renderInventory();
      if (!elements.editingId.value) elements.sku.value = getNextSku(items);
      const time = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date());
      setSyncBadge(`☁ Synchronisiert · ${time}`, "ok");
      if (announce) {
        elements.homeMessage.textContent = "Artikelbestand wurde mit der Cloud synchronisiert.";
        elements.homeMessage.style.color = "#087f5b";
      }
      return true;
    } catch (error) {
      console.error("KleiderPilot Cloud Sync:", error);
      setSyncBadge("⚠ Cloud-Sync fehlgeschlagen", "error");
      if (announce) {
        elements.homeMessage.textContent = `Synchronisierung fehlgeschlagen: ${error.message || error}`;
        elements.homeMessage.style.color = "#a33b2b";
      }
      return false;
    } finally {
      cloudSyncPromise = null;
      if (cloudSyncQueued) {
        cloudSyncQueued = false;
        queueMicrotask(() => runCloudSync());
      }
    }
  })();

  return cloudSyncPromise;
}

async function prepareProductiveWorkspace(workspace) {
  if (isProductiveResetComplete()) return;
  setSyncBadge("↻ Produktivstart wird vorbereitet …", "working");
  items = [];
  await saveItems(items);
  renderInventory();
  await purgePreReleaseWorkspaceData(workspace, PRODUCTIVE_RELEASE_CUTOFF);
  markProductiveResetComplete();
}

function startPeriodicSync() {
  if (periodicSyncTimer) clearInterval(periodicSyncTimer);
  periodicSyncTimer = setInterval(() => {
    if (document.visibilityState === "visible" && currentWorkspace?.id) runCloudSync();
  }, 30_000);
}

function showView(viewName) {
  const target = {
    overview: elements.overviewView,
    item: elements.itemView,
    assistant: elements.assistantView
  }[viewName] || elements.overviewView;

  for (const view of [elements.overviewView, elements.itemView, elements.assistantView]) {
    view.classList.toggle("hidden", view !== target);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDateInputValue(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatDuration(days, sameDayText = "am selben Tag") {
  if (days === null) return "";
  if (days === 0) return sameDayText;
  return days === 1 ? "nach 1 Tag" : `nach ${days} Tagen`;
}

function renderStatusOptions(item) {
  if (isDeletedStatus(item.status)) {
    return `<span class="status-badge status-deleted">${escapeHtml(getStatusLabel(item.status))}</span>`;
  }
  const options = ["draft", "listed", "sold", "shipped"]
    .map(
      (status) =>
        `<option value="${status}"${item.status === status ? " selected" : ""}>${escapeHtml(getStatusLabel(status))}</option>`
    )
    .join("");
  return `<select class="status-select status-${escapeHtml(item.status)}" data-action="status" data-id="${escapeHtml(item.id)}" aria-label="Status von ${escapeHtml(item.sku)} ändern">${options}</select>`;
}

function renderPriceSummary(item) {
  if (isSoldStatus(item.status)) {
    const saleDuration = item.soldAt ? calculateDaysBetween(item.listedAt, item.soldAt) : null;
    return `
      <strong>${item.salePrice ? `Verkauft für ${formatPrice(item.salePrice)}` : "Verkauft"}</strong>
      <span class="item-meta">${saleDuration === null ? "Verkaufsdauer unbekannt" : formatDuration(saleDuration)}</span>
    `;
  }

  return `
    <strong>${formatPrice(item.listPrice)} Listenpreis</strong>
    <span class="item-meta">Ziel ${formatPrice(item.targetPrice)} · Minimum ${formatPrice(item.floorPrice)}</span>
  `;
}

function renderListingDate(item) {
  if (isDeletedStatus(item.status)) {
    return `<span class="date-muted">${item.deletedAt ? `Gelöscht am ${formatDate(item.deletedAt)}` : "Gelöscht"}</span>`;
  }
  if (item.status === "draft") return '<span class="date-muted">Noch nicht eingestellt</span>';
  if (!item.listedAt) {
    return `
      <button class="date-button" data-action="edit-listed-date" data-id="${escapeHtml(item.id)}" type="button" title="Einstelldatum festlegen">
        <strong>Datum festlegen</strong>
        <span class="item-meta">Kalender öffnen</span>
      </button>
    `;
  }

  const daysOnline = calculateDaysBetween(item.listedAt);
  const detail = isSoldStatus(item.status)
    ? "Vinted-Einstellung"
    : daysOnline === null
      ? "Dauer unbekannt"
      : daysOnline === 0
      ? "seit heute"
      : daysOnline === 1
        ? "seit 1 Tag"
        : `seit ${daysOnline} Tagen`;
  return `
    <button class="date-button" data-action="edit-listed-date" data-id="${escapeHtml(item.id)}" type="button" title="Einstelldatum ändern">
      <strong>${formatDate(item.listedAt)}</strong>
      <span class="item-meta">${detail} · ändern</span>
    </button>
  `;
}

function renderThumbnail(item) {
  const image = item.images?.[0];
  if (!image) return '<span class="inventory-thumbnail empty-thumbnail" aria-label="Kein Bild">–</span>';
  return `
    <button class="inventory-thumbnail thumbnail-button" data-action="view" data-id="${escapeHtml(item.id)}" type="button" aria-label="Bilder von ${escapeHtml(item.title)} ansehen">
      <img src="${escapeHtml(image.dataUrl)}" alt="">
    </button>
  `;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDraftSource() {
  return {
    audience: elements.audience.value,
    itemType: elements.itemType.value.trim(),
    brand: elements.brand.value.trim(),
    size: elements.size.value.trim(),
    model: elements.model.value.trim(),
    condition: elements.condition.value,
    color: elements.color.value.trim(),
    material: elements.material.value.trim(),
    visualDetails: elements.visualDetails.value.trim(),
    measurements: elements.measurements.value.trim(),
    flaws: elements.flaws.value.trim(),
    shipping: elements.shipping.value.trim()
  };
}

function setDetail(element, value, fallback = "–") {
  element.textContent = String(value || "").trim() || fallback;
}

function updateSearchLink() {
  elements.vintedSearchLink.href = buildVintedSearchUrl(getDraftSource());
}

function renderDraft() {
  const source = getDraftSource();
  const hasDetails = [source.itemType, source.brand, source.size, source.model, source.color, source.visualDetails].some(Boolean);
  updateSearchLink();

  const measurementSuggestions = source.itemType ? getMeasurementChecklist(source) : [];
  elements.measurementChecklist.textContent = measurementSuggestions.length
    ? measurementSuggestions.join(" · ")
    : "Artikelart eingeben, um die passenden Maße zu sehen.";

  const warnings = getListingWarnings(source, selectedImages.length);
  elements.listingWarnings.textContent = warnings.length
    ? `Fehlt noch: ${warnings.join(" · ")}`
    : "Alle wichtigen Angaben sind vorhanden.";
  elements.listingWarnings.classList.toggle("complete", warnings.length === 0);

  if (!hasDetails) {
    elements.vintedTitle.value = "";
    elements.vintedDescription.value = "";
    elements.vintedCategory.value = "";
    elements.titleCounter.textContent = "0 / 100 Zeichen";
    for (const element of [
      elements.vintedBrand,
      elements.vintedSize,
      elements.vintedCondition,
      elements.vintedColor,
      elements.vintedMaterial,
      elements.vintedPackageSize,
      elements.vintedPrice
    ]) setDetail(element, "");
    return;
  }

  const draft = generateListingDraft(source);
  elements.vintedTitle.value = draft.title;
  elements.titleCounter.textContent = `${draft.title.length} / 100 Zeichen`;
  elements.vintedDescription.value = draft.description;
  elements.vintedCategory.value = draft.category;
  setDetail(elements.vintedBrand, source.brand, "Keine Marke");
  setDetail(elements.vintedSize, source.size);
  setDetail(elements.vintedCondition, source.condition);
  setDetail(elements.vintedColor, source.color);
  setDetail(elements.vintedMaterial, source.material);
  setDetail(elements.vintedPackageSize, draft.packageSize);
  setDetail(elements.vintedPrice, Number(elements.listPrice.value) > 0 ? formatPrice(Number(elements.listPrice.value)) : "");
  elements.copyListingMessage.textContent = "";
}

function getFormItem() {
  const now = new Date().toISOString();
  const existing = items.find((item) => item.id === elements.editingId.value);
  const source = getDraftSource();
  const generated = generateListingDraft(source);

  return {
    id: existing?.id || createId(),
    sku: elements.sku.value.trim(),
    images: selectedImages.map((image) => ({ ...image })),
    ...source,
    title: elements.vintedTitle.value.trim() || generated.title,
    description: elements.vintedDescription.value.trim() || generated.description,
    category: elements.vintedCategory.value.trim() || generated.category,
    packageSize:
      elements.vintedPackageSize.textContent === "–" ? generated.packageSize : elements.vintedPackageSize.textContent,
    listPrice: Number(elements.listPrice.value),
    targetPrice: Number(elements.targetPrice.value),
    floorPrice: Number(elements.floorPrice.value),
    vintedUrl: normalizeVintedItemUrl(elements.vintedUrl.value),
    status: existing?.status || "draft",
    ...(existing?.listedAt ? { listedAt: existing.listedAt } : {}),
    ...(existing?.salePrice ? { salePrice: existing.salePrice } : {}),
    ...(existing?.soldAt ? { soldAt: existing.soldAt } : {}),
    ...(existing?.shippedAt ? { shippedAt: existing.shippedAt } : {}),
    ...(existing?.deletedAt ? { deletedAt: existing.deletedAt } : {}),
    ...(existing?.statusBeforeDelete ? { statusBeforeDelete: existing.statusBeforeDelete } : {}),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function clearPhotoSelection() {
  imageProcessingToken += 1;
  imagesProcessing = false;
  selectedImages = [];
  elements.itemPhotos.disabled = false;
  elements.photoPreview.innerHTML = "";
  elements.photoPreview.classList.add("hidden");
  elements.photoMessage.textContent = "";
}

function renderPhotoPreview() {
  elements.photoPreview.innerHTML = "";
  elements.photoPreview.classList.toggle("hidden", selectedImages.length === 0);

  selectedImages.forEach((storedImage, index) => {
    const figure = document.createElement("figure");
    figure.className = "stored-photo";

    const image = document.createElement("img");
    image.src = storedImage.dataUrl;
    image.alt = storedImage.name || `Artikelbild ${index + 1}`;
    image.title = storedImage.name || `Artikelbild ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-photo";
    removeButton.dataset.removeImage = storedImage.id;
    removeButton.setAttribute("aria-label", `Bild ${index + 1} entfernen`);
    removeButton.textContent = "×";

    const badge = document.createElement("span");
    badge.className = "photo-index";
    badge.textContent = index === 0 ? "Hauptbild" : String(index + 1);

    const controls = document.createElement("div");
    controls.className = "photo-controls";
    const actions = [
      { action: "image-left", label: "←", title: "Bild nach links verschieben", disabled: index === 0 },
      { action: "image-main", label: "★", title: "Als Hauptbild festlegen", disabled: index === 0 },
      { action: "image-right", label: "→", title: "Bild nach rechts verschieben", disabled: index === selectedImages.length - 1 }
    ];
    for (const definition of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.imageAction = definition.action;
      button.dataset.imageId = storedImage.id;
      button.textContent = definition.label;
      button.title = definition.title;
      button.disabled = definition.disabled;
      controls.append(button);
    }

    figure.append(image, badge, removeButton, controls);
    elements.photoPreview.append(figure);
  });

  const totalBytes = selectedImages.reduce((sum, image) => sum + Number(image.size || 0), 0);
  const megabytes = totalBytes / (1024 * 1024);
  elements.photoMessage.textContent = selectedImages.length
    ? `${selectedImages.length} Bild${selectedImages.length === 1 ? "" : "er"} gespeichert · ca. ${megabytes.toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`
    : "Mindestens ein Bild ist erforderlich.";
  elements.photoMessage.style.color = selectedImages.length ? "#087f5b" : "#a33b2b";
}

function openItemDetails(item) {
  const images = Array.isArray(item.images) ? item.images : [];
  elements.dialogSku.textContent = item.sku;
  elements.dialogTitle.textContent = item.title;
  elements.dialogMeta.textContent = [
    item.brand,
    item.size ? `Größe ${item.size}` : "",
    item.condition,
    formatPrice(item.listPrice),
    getStatusLabel(item.status),
    item.listedAt ? `eingestellt am ${formatDate(item.listedAt)}` : "",
    item.soldAt ? `verkauft am ${formatDate(item.soldAt)}` : "",
    item.shippedAt ? `versendet am ${formatDate(item.shippedAt)}` : ""
  ].filter(Boolean).join(" · ");

  elements.dialogThumbnails.innerHTML = "";
  elements.dialogGallery.classList.toggle("hidden", images.length === 0);
  elements.dialogNoImages.classList.toggle("hidden", images.length > 0);

  if (images.length > 0) {
    elements.dialogMainImage.src = images[0].dataUrl;
    elements.dialogMainImage.alt = `${item.title} – Bild 1`;
    images.forEach((storedImage, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `dialog-thumbnail${index === 0 ? " active" : ""}`;
      button.dataset.imageIndex = String(index);
      const image = document.createElement("img");
      image.src = storedImage.dataUrl;
      image.alt = `${item.title} – Bild ${index + 1}`;
      button.append(image);
      elements.dialogThumbnails.append(button);
    });
  } else {
    elements.dialogMainImage.removeAttribute("src");
  }

  elements.itemDetailsDialog.showModal();
}

function openListedDateDialog(item) {
  elements.listedDateItemId.value = item.id;
  elements.listedDateInput.value = formatDateInputValue(item.listedAt);
  elements.listedDateInput.max = formatDateInputValue(new Date());
  elements.listedDateMessage.textContent = "";
  elements.listedDateDialog.showModal();
}

function resetForm() {
  clearPhotoSelection();
  elements.itemForm.reset();
  elements.editingId.value = "";
  elements.itemFormHeading.textContent = "Artikel anlegen";
  elements.sku.value = getNextSku(items);
  elements.audience.value = "Herren";
  elements.condition.value = "Sehr gut";
  elements.shipping.value = "Der Versand erfolgt über die bei Vinted auswählbaren Versandarten";
  elements.formMessage.textContent = "";
  elements.copyListingMessage.textContent = "";
  renderDraft();
}

function resetAssistant() {
  elements.assistantForm.reset();
  elements.responseStyle.value = "friendly";
  elements.counterOffers.value = "0";
  elements.suggestionCard.classList.add("hidden");
  elements.suggestedReply.value = "";
  elements.copyMessage.textContent = "";
  renderAssistantSummary();
}

function fillForm(item) {
  clearPhotoSelection();
  elements.itemPhotos.value = "";
  selectedImages = Array.isArray(item.images) ? item.images.map((image) => ({ ...image })) : [];
  renderPhotoPreview();
  const values = {
    audience: item.audience || "Herren",
    itemType: item.itemType || item.title || "",
    brand: item.brand || "",
    size: item.size || "",
    model: item.model || "",
    condition: item.condition || "Sehr gut",
    color: item.color || "",
    material: item.material || "",
    visualDetails: item.visualDetails || "",
    listPrice: item.listPrice ?? "",
    targetPrice: item.targetPrice ?? "",
    floorPrice: item.floorPrice ?? "",
    measurements: item.measurements || "",
    flaws: item.flaws || "",
    shipping: item.shipping || "Der Versand erfolgt über die bei Vinted auswählbaren Versandarten",
    vintedUrl: item.vintedUrl || ""
  };

  elements.editingId.value = item.id;
  elements.itemFormHeading.textContent = `Artikel bearbeiten · ${item.sku}`;
  elements.sku.value = item.sku;
  for (const [key, value] of Object.entries(values)) elements[key].value = value;

  renderDraft();
  elements.vintedTitle.value = item.title || elements.vintedTitle.value;
  elements.titleCounter.textContent = `${elements.vintedTitle.value.length} / 100 Zeichen`;
  elements.vintedDescription.value = item.description || elements.vintedDescription.value;
  elements.vintedCategory.value = item.category || elements.vintedCategory.value;
  setDetail(elements.vintedPackageSize, item.packageSize || elements.vintedPackageSize.textContent);
  showView("item");
}

function renderStats() {
  const stats = calculateDashboardStats(items);
  elements.activeCount.textContent = String(stats.availableCount);
  elements.inventoryValue.textContent = formatPrice(stats.wardrobeValue);
  elements.soldCount.textContent = String(stats.soldCount);
  elements.revenueValue.textContent = formatPrice(stats.revenue);
}

function renderAssistantItems() {
  const currentValue = elements.assistantItem.value;
  const selectableItems = items.filter((item) => !isDeletedStatus(item.status));
  const sortedItems = sortItemsBySku(selectableItems);
  elements.assistantItem.innerHTML = "";

  if (selectableItems.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Bitte zuerst einen Artikel anlegen";
    elements.assistantItem.append(option);
    renderAssistantSummary();
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Artikel auswählen";
  elements.assistantItem.append(placeholder);

  for (const item of sortedItems) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.sku} · ${item.title} · ${getStatusLabel(item.status)}`;
    elements.assistantItem.append(option);
  }

  if (selectableItems.some((item) => item.id === currentValue)) elements.assistantItem.value = currentValue;
  renderAssistantSummary();
}

function renderAssistantSummary() {
  const item = items.find((entry) => entry.id === elements.assistantItem.value);
  elements.assistantItemSummary.classList.toggle("hidden", !item);
  if (!item) {
    elements.assistantSummaryImage.removeAttribute("src");
    return;
  }

  const image = item.images?.[0];
  elements.assistantSummaryImage.classList.toggle("hidden", !image);
  elements.assistantSummaryNoImage.classList.toggle("hidden", Boolean(image));
  if (image) {
    elements.assistantSummaryImage.src = image.dataUrl;
    elements.assistantSummaryImage.alt = `${item.title} – Hauptbild`;
  } else {
    elements.assistantSummaryImage.removeAttribute("src");
  }

  elements.assistantSummarySku.textContent = `${item.sku} · ${getStatusLabel(item.status)}`;
  elements.assistantSummaryTitle.textContent = item.title;
  elements.assistantSummaryMeta.textContent = [item.brand, item.size ? `Größe ${item.size}` : "", item.condition]
    .filter(Boolean)
    .join(" · ");
  elements.assistantSummaryListPrice.textContent = formatPrice(item.listPrice);
  elements.assistantSummaryTargetPrice.textContent = formatPrice(item.targetPrice);
  elements.assistantSummaryFloorPrice.textContent = formatPrice(item.floorPrice);
}

function renderInventory() {
  const visibleItems = filterAndSortInventory(items, {
    query: elements.inventorySearch.value,
    status: elements.inventoryStatusFilter.value,
    sort: elements.inventorySort.value
  });
  elements.inventoryBody.innerHTML = visibleItems
    .map(
      (item) => `
        <tr class="${isDeletedStatus(item.status) ? "deleted-row" : ""}">
          <td>${renderThumbnail(item)}</td>
          <td><strong>${escapeHtml(item.sku)}</strong></td>
          <td>
            ${isDeletedStatus(item.status)
              ? `<span class="item-title">${escapeHtml(item.title)}</span>`
              : `<button class="item-title item-link" data-action="edit" data-id="${escapeHtml(item.id)}" type="button" title="Artikel bearbeiten">${escapeHtml(item.title)}</button>`}
            <span class="item-meta">${escapeHtml([item.brand, item.size].filter(Boolean).join(" · "))}</span>
          </td>
          <td>${renderStatusOptions(item)}</td>
          <td class="price-summary">${renderPriceSummary(item)}</td>
          <td class="date-summary">${renderListingDate(item)}</td>
          <td>
            <div class="row-actions">
              ${isDeletedStatus(item.status)
                ? `<button class="mini-button" data-action="restore" data-id="${escapeHtml(item.id)}">Wiederherstellen</button>`
                : `<button class="mini-button" data-action="edit" data-id="${escapeHtml(item.id)}">Bearbeiten</button>
                  ${normalizeVintedItemUrl(item.vintedUrl) ? `<a class="mini-button" href="${escapeHtml(normalizeVintedItemUrl(item.vintedUrl))}" target="_blank" rel="noreferrer">Auf Vinted öffnen</a>` : ""}
                  <button class="mini-button danger" data-action="delete" data-id="${escapeHtml(item.id)}">Löschen</button>`}
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  elements.emptyState.textContent = items.length === 0
    ? "Noch keine Artikel vorhanden. Lege deinen ersten Artikel an."
    : "Keine Artikel passen zu deiner Suche oder dem gewählten Filter.";
  elements.emptyState.classList.toggle("hidden", visibleItems.length > 0);
  renderStats();
  renderAssistantItems();
  if (!elements.editingId.value) elements.sku.value = getNextSku(items);
}

async function persistAndRender() {
  await saveItems(items);
  renderInventory();
  if (currentWorkspace?.id) await runCloudSync();
}

async function copyText(value, messageElement) {
  const text = String(value || "").trim();
  if (!text) {
    messageElement.textContent = "Es ist noch kein Text zum Kopieren vorhanden.";
    messageElement.style.color = "#a33b2b";
    return;
  }
  await navigator.clipboard.writeText(text);
  messageElement.textContent = "In die Zwischenablage kopiert.";
  messageElement.style.color = "#087f5b";
}

elements.itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (imagesProcessing) {
    elements.photoMessage.textContent = "Bitte warte, bis alle Bilder verarbeitet wurden.";
    elements.photoMessage.style.color = "#a33b2b";
    return;
  }

  if (selectedImages.length === 0) {
    elements.photoMessage.textContent = "Bitte lade mindestens ein Artikelbild hoch.";
    elements.photoMessage.style.color = "#a33b2b";
    elements.itemPhotos.focus();
    elements.itemPhotos.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!elements.itemType.value.trim()) {
    elements.formMessage.textContent = "Bitte gib die Artikelart ein.";
    elements.formMessage.style.color = "#a33b2b";
    elements.itemType.focus();
    return;
  }

  const emptyPriceField = [elements.listPrice, elements.targetPrice, elements.floorPrice].find(
    (element) => element.value === ""
  );
  if (emptyPriceField) {
    elements.formMessage.textContent = "Bitte trage Listenpreis, Zielpreis und Untergrenze ein.";
    elements.formMessage.style.color = "#a33b2b";
    emptyPriceField.focus();
    return;
  }

  const item = getFormItem();
  if (elements.vintedUrl.value.trim() && !normalizeVintedItemUrl(elements.vintedUrl.value)) {
    elements.formMessage.textContent = "Bitte gib einen gültigen Vinted-Link ein, der mit https://www.vinted.de/ beginnt.";
    elements.formMessage.style.color = "#a33b2b";
    elements.vintedUrl.focus();
    return;
  }
  const priceError = validatePriceLimits(item);
  if (priceError) {
    elements.formMessage.textContent = priceError;
    elements.formMessage.style.color = "#a33b2b";
    return;
  }

  const duplicateSku = items.find(
    (entry) => entry.sku.toLocaleLowerCase("de-DE") === item.sku.toLocaleLowerCase("de-DE") && entry.id !== item.id
  );
  if (duplicateSku) {
    elements.formMessage.textContent = "Diese Artikelnummer ist bereits vergeben.";
    elements.formMessage.style.color = "#a33b2b";
    return;
  }

  const index = items.findIndex((entry) => entry.id === item.id);
  if (index >= 0) items[index] = item;
  else items.unshift(item);

  await persistAndRender();
  resetForm();
  elements.homeMessage.textContent = index >= 0 ? "Artikel wurde aktualisiert." : "Artikel wurde gespeichert.";
  elements.homeMessage.style.color = "#087f5b";
  showView("overview");
});

elements.openItemViewButton.addEventListener("click", () => {
  elements.homeMessage.textContent = "";
  resetForm();
  showView("item");
});

elements.openAssistantViewButton.addEventListener("click", () => {
  elements.homeMessage.textContent = "";
  resetAssistant();
  showView("assistant");
});

for (const button of document.querySelectorAll("[data-show-view]")) {
  button.addEventListener("click", () => showView(button.dataset.showView));
}

elements.resetFormButton.addEventListener("click", resetForm);
elements.refreshDraftButton.addEventListener("click", renderDraft);
elements.resetAssistantButton.addEventListener("click", resetAssistant);
elements.assistantItem.addEventListener("change", renderAssistantSummary);

elements.itemForm.addEventListener("input", (event) => {
  if (event.target !== elements.itemPhotos) updateSearchLink();
  if (event.target === elements.vintedTitle) {
    elements.titleCounter.textContent = `${elements.vintedTitle.value.length} / 100 Zeichen`;
  }
  if (event.target === elements.listPrice) {
    setDetail(elements.vintedPrice, Number(elements.listPrice.value) > 0 ? formatPrice(Number(elements.listPrice.value)) : "");
  }
});

elements.itemForm.addEventListener("change", (event) => {
  if (event.target !== elements.itemPhotos) renderDraft();
});

elements.itemPhotos.addEventListener("change", async () => {
  const processingToken = ++imageProcessingToken;
  const availableSlots = Math.max(0, 20 - selectedImages.length);
  const files = Array.from(elements.itemPhotos.files || [])
    .filter((file) => file.type.startsWith("image/"))
    .slice(0, availableSlots);

  if (availableSlots === 0) {
    elements.photoMessage.textContent = "Es können maximal 20 Bilder gespeichert werden.";
    elements.photoMessage.style.color = "#a33b2b";
    elements.itemPhotos.value = "";
    return;
  }
  if (files.length === 0) return;

  elements.itemPhotos.disabled = true;
  imagesProcessing = true;
  elements.photoMessage.textContent = `${files.length} Bild${files.length === 1 ? " wird" : "er werden"} komprimiert und vorbereitet …`;
  elements.photoMessage.style.color = "#3f5149";
  const errors = [];

  for (const file of files) {
    try {
      const storedImage = await compressImageFile(file);
      if (processingToken !== imageProcessingToken) return;
      selectedImages.push(storedImage);
    } catch (error) {
      errors.push(`${file.name}: ${error.message || "konnte nicht verarbeitet werden"}`);
    }
  }

  if (processingToken !== imageProcessingToken) return;
  elements.itemPhotos.disabled = false;
  imagesProcessing = false;
  elements.itemPhotos.value = "";
  renderPhotoPreview();
  renderDraft();
  if (errors.length > 0) {
    elements.photoMessage.textContent = errors.join(" · ");
    elements.photoMessage.style.color = "#a33b2b";
  }
});

elements.photoPreview.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove-image]");
  if (button) {
    selectedImages = selectedImages.filter((image) => image.id !== button.dataset.removeImage);
    renderPhotoPreview();
    renderDraft();
    return;
  }

  const actionButton = event.target.closest("button[data-image-action]");
  if (!actionButton) return;
  const index = selectedImages.findIndex((image) => image.id === actionButton.dataset.imageId);
  if (index < 0) return;
  if (actionButton.dataset.imageAction === "image-main") {
    const [image] = selectedImages.splice(index, 1);
    selectedImages.unshift(image);
  } else {
    const direction = actionButton.dataset.imageAction === "image-left" ? -1 : 1;
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < selectedImages.length) {
      [selectedImages[index], selectedImages[targetIndex]] = [selectedImages[targetIndex], selectedImages[index]];
    }
  }
  renderPhotoPreview();
});

document.querySelector(".draft-panel").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-copy-target]");
  if (!button) return;
  const target = document.getElementById(button.dataset.copyTarget);
  if (target) await copyText("value" in target ? target.value : target.textContent, elements.copyListingMessage);
});

elements.copyListingButton.addEventListener("click", async () => {
  const listingText = [
    `TITEL\n${elements.vintedTitle.value.trim()}`,
    `BESCHREIBUNG\n${elements.vintedDescription.value.trim()}`,
    `KATEGORIE\n${elements.vintedCategory.value.trim()}`,
    `MARKE\n${elements.vintedBrand.textContent}`,
    `GRÖSSE\n${elements.vintedSize.textContent}`,
    `ZUSTAND\n${elements.vintedCondition.textContent}`,
    `FARBE\n${elements.vintedColor.textContent}`,
    `MATERIAL\n${elements.vintedMaterial.textContent}`,
    `SENDUNGSGRÖSSE\n${elements.vintedPackageSize.textContent}`,
    `PREIS\n${elements.vintedPrice.textContent}`
  ].join("\n\n");
  await copyText(listingText, elements.copyListingMessage);
});

function askForSalePrice(item) {
  const enteredPrice = prompt(
    `Zu welchem Preis wurde ${item.sku} verkauft?`,
    String(item.salePrice || item.targetPrice || item.listPrice || "").replace(".", ",")
  );
  if (enteredPrice === null) return null;

  const salePrice = Number(enteredPrice.trim().replace(",", "."));
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    alert("Bitte gib einen gültigen Verkaufspreis größer als 0 € ein.");
    return null;
  }
  return salePrice;
}

async function changeItemStatus(item, nextStatus) {
  if (isDeletedStatus(item.status)) return;
  const previousStatus = item.status;
  if (previousStatus === nextStatus) return;

  const movingBackToActive = isSoldStatus(previousStatus) && !isSoldStatus(nextStatus);
  if (movingBackToActive && !confirm("Verkaufsdaten entfernen und den Artikel wieder aktiv setzen?")) {
    renderInventory();
    return;
  }

  let salePrice = null;
  if (["sold", "shipped"].includes(nextStatus) && !isSoldStatus(previousStatus)) {
    salePrice = askForSalePrice(item);
    if (salePrice === null) {
      renderInventory();
      return;
    }
  }

  const index = items.findIndex((entry) => entry.id === item.id);
  items[index] = transitionItemStatus(item, nextStatus, { salePrice });
  await persistAndRender();
}

elements.inventorySearch.addEventListener("input", renderInventory);
elements.inventoryStatusFilter.addEventListener("change", renderInventory);
elements.inventorySort.addEventListener("change", renderInventory);

elements.inventoryBody.addEventListener("change", async (event) => {
  const select = event.target.closest('select[data-action="status"]');
  if (!select) return;
  const item = items.find((entry) => entry.id === select.dataset.id);
  if (item) await changeItemStatus(item, select.value);
});

elements.inventoryBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const item = items.find((entry) => entry.id === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === "view") {
    openItemDetails(item);
    return;
  }

  if (button.dataset.action === "edit-listed-date") {
    openListedDateDialog(item);
    return;
  }

  if (button.dataset.action === "edit") {
    fillForm(item);
    return;
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Artikel ${item.sku} als gelöscht markieren? Er bleibt durchgestrichen im Bestand und kann wiederhergestellt werden.`)) return;
    const index = items.findIndex((entry) => entry.id === item.id);
    items[index] = softDeleteItem(item);
    if (elements.editingId.value === item.id) resetForm();
    await persistAndRender();
    return;
  }

  if (button.dataset.action === "restore") {
    const index = items.findIndex((entry) => entry.id === item.id);
    items[index] = restoreDeletedItem(item);
    await persistAndRender();
    elements.homeMessage.textContent = `Artikel ${item.sku} wurde wiederhergestellt.`;
    elements.homeMessage.style.color = "#087f5b";
  }
});

elements.closeDetailsDialog.addEventListener("click", () => elements.itemDetailsDialog.close());

elements.dialogThumbnails.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-image-index]");
  if (!button) return;
  const item = items.find((entry) => entry.sku === elements.dialogSku.textContent);
  const image = item?.images?.[Number(button.dataset.imageIndex)];
  if (!image) return;
  elements.dialogMainImage.src = image.dataUrl;
  elements.dialogMainImage.alt = `${item.title} – Bild ${Number(button.dataset.imageIndex) + 1}`;
  for (const thumbnail of elements.dialogThumbnails.querySelectorAll(".dialog-thumbnail")) {
    thumbnail.classList.toggle("active", thumbnail === button);
  }
});

elements.itemDetailsDialog.addEventListener("click", (event) => {
  if (event.target === elements.itemDetailsDialog) elements.itemDetailsDialog.close();
});

elements.closeListedDateDialog.addEventListener("click", () => elements.listedDateDialog.close());
elements.cancelListedDateButton.addEventListener("click", () => elements.listedDateDialog.close());

elements.listedDateDialog.addEventListener("click", (event) => {
  if (event.target === elements.listedDateDialog) elements.listedDateDialog.close();
});

elements.listedDateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = items.find((entry) => entry.id === elements.listedDateItemId.value);
  const selectedDate = elements.listedDateInput.value;
  if (!item || !selectedDate) return;

  const today = formatDateInputValue(new Date());
  const soldDate = item.soldAt ? formatDateInputValue(item.soldAt) : "";
  if (selectedDate > today) {
    elements.listedDateMessage.textContent = "Das Einstelldatum darf nicht in der Zukunft liegen.";
    elements.listedDateMessage.style.color = "#a33b2b";
    return;
  }
  if (soldDate && selectedDate > soldDate) {
    elements.listedDateMessage.textContent = "Das Einstelldatum darf nicht nach dem Verkaufsdatum liegen.";
    elements.listedDateMessage.style.color = "#a33b2b";
    return;
  }

  item.listedAt = new Date(`${selectedDate}T12:00:00`).toISOString();
  item.updatedAt = new Date().toISOString();
  await persistAndRender();
  elements.listedDateDialog.close();
});

elements.assistantForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const item = items.find((entry) => entry.id === elements.assistantItem.value);
  if (!item) return;

  const explicitOffer = elements.explicitOffer.value === "" ? null : Number(elements.explicitOffer.value);
  const suggestion = suggestReply(item, elements.buyerMessage.value, explicitOffer, {
    style: elements.responseStyle.value,
    counterOffers: Number(elements.counterOffers.value || 0),
    maxCounterOffers: 2
  });
  elements.suggestionLabel.textContent = suggestion.label;
  elements.suggestionIntent.textContent = suggestion.intent;
  elements.suggestionReason.textContent = suggestion.reason;
  elements.suggestedReply.value = suggestion.reply;
  elements.manualWarning.classList.toggle("hidden", !suggestion.needsHumanReview);
  elements.replyContainer.classList.toggle("hidden", suggestion.needsHumanReview && !suggestion.reply);
  elements.copyReplyButton.classList.toggle("hidden", !suggestion.reply);
  elements.copyMessage.textContent = "";
  elements.suggestionCard.classList.remove("hidden");
});

elements.copyReplyButton.addEventListener("click", async () => {
  await copyText(elements.suggestedReply.value, elements.copyMessage);
});

document.querySelector(".quick-messages").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-message]");
  if (!button) return;
  elements.buyerMessage.value = button.dataset.message;
  elements.explicitOffer.value = "";
  elements.buyerMessage.focus();
});

elements.createWorkspaceButton.addEventListener("click", async () => {
  elements.deviceSetupMessage.textContent = "";
  elements.createWorkspaceButton.disabled = true;
  elements.createWorkspaceButton.textContent = "Einrichtung läuft …";
  try {
    const workspace = await createWorkspace();
    setConnectedUi(workspace);
    await prepareProductiveWorkspace(workspace);
    await runCloudSync({ announce: true });
    showView("overview");
    showPairingCode();
  } catch (error) {
    elements.deviceSetupMessage.textContent = `Einrichtung fehlgeschlagen: ${error.message || error}`;
    elements.deviceSetupMessage.style.color = "#a33b2b";
  } finally {
    elements.createWorkspaceButton.disabled = false;
    elements.createWorkspaceButton.textContent = "Dieses Gerät einrichten";
  }
});

elements.pairCodeInput.addEventListener("input", () => {
  const normalized = normalizePairCode(elements.pairCodeInput.value);
  elements.pairCodeInput.value = formatPairCode(normalized);
});

elements.joinWorkspaceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.deviceSetupMessage.textContent = "";
  elements.joinWorkspaceButton.disabled = true;
  elements.joinWorkspaceButton.textContent = "Verbinde …";
  try {
    const workspace = await joinWorkspace(elements.pairCodeInput.value);
    setConnectedUi(workspace);
    elements.pairCodeInput.value = "";
    await prepareProductiveWorkspace(workspace);
    await runCloudSync({ announce: true });
    showView("overview");
  } catch (error) {
    elements.deviceSetupMessage.textContent = `Verbindung fehlgeschlagen: ${error.message || error}`;
    elements.deviceSetupMessage.style.color = "#a33b2b";
  } finally {
    elements.joinWorkspaceButton.disabled = false;
    elements.joinWorkspaceButton.textContent = "Mit Bestand verbinden";
  }
});

elements.pairDeviceButton.addEventListener("click", () => {
  showPairingCode();
});

elements.closePairingDialog.addEventListener("click", () => {
  elements.pairingDialog.close();
});

elements.copyPairCodeButton.addEventListener("click", async () => {
  if (!currentWorkspace?.pairCode) return;
  try {
    await navigator.clipboard.writeText(currentWorkspace.pairCode);
    elements.pairCodeMessage.textContent = "Gerätecode kopiert.";
    elements.pairCodeMessage.style.color = "#087f5b";
  } catch {
    elements.pairCodeMessage.textContent = "Code konnte nicht automatisch kopiert werden. Bitte markieren und manuell kopieren.";
    elements.pairCodeMessage.style.color = "#a33b2b";
  }
});

elements.syncNowButton.addEventListener("click", async () => {
  await runCloudSync({ announce: true });
});

window.addEventListener("online", () => {
  if (currentWorkspace?.id) runCloudSync();
});

window.addEventListener("offline", () => {
  if (currentWorkspace?.id) setSyncBadge("⚠ Offline – Änderungen bleiben lokal", "error");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentWorkspace?.id) runCloudSync();
});

items = await loadItems();
// Sicherheitsbereinigung für sehr alte Beispieldaten aus Vorversionen.
const itemsWithoutLegacySamples = items.filter((item) => item?.sampleData !== true && !String(item?.id || "").startsWith("kleiderpilot-sample-"));
if (itemsWithoutLegacySamples.length !== items.length) {
  items = itemsWithoutLegacySamples;
  await saveItems(items);
}
renderInventory();
resetForm();
showView("overview");

try {
  await initializeDeviceSession();
  const workspace = await getWorkspace();
  setConnectedUi(workspace);
  if (workspace?.id) {
    await prepareProductiveWorkspace(workspace);
    await runCloudSync();
  }
} catch (error) {
  setConnectedUi(null);
  elements.deviceGate.classList.remove("hidden");
  elements.deviceSetupMessage.textContent = `Cloud-Verbindung konnte nicht initialisiert werden: ${error.message || error}`;
  elements.deviceSetupMessage.style.color = "#a33b2b";
  setSyncBadge("⚠ Cloud-Einrichtung erforderlich", "error");
}

startPeriodicSync();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}
