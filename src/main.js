import "./styles.css";
import { LOCALE_KEY, loadInitialLocale } from "./i18n.js";
import { products } from "./data/catalog.generated.js";
import {
  ALL_ID,
  PRODUCT_BATCH_SIZE,
  createDefaultState,
  createView,
  emptyProfile,
  emptyStats,
} from "./view.js";

const STORAGE_KEY = "weDontBuyStats:v1";
const CART_KEY = "weDontBuyCart:v1";
const PROFILE_KEY = "weDontBuyProfile:v1";
const ORDERS_KEY = "weDontBuyOrders:v1";
const RACK_KEY = "weDontBuyCoolingRack:v1";

let storageUnavailable = false;

// Assigned in initClient(); nothing reads browser APIs at import time.
let state;

let productLoaderObserver;

function loadClientState() {
  return {
    ...createDefaultState(loadLocale()),
    cart: loadCart(),
    profile: loadProfile(),
    orders: loadOrders(),
    rack: loadRack(),
    stats: loadStats(),
  };
}

function view() {
  return createView(state, { storageUnavailable });
}

function markStorageUnavailable() {
  storageUnavailable = true;
}

function loadLocale() {
  try {
    return loadInitialLocale(globalThis.localStorage);
  } catch {
    markStorageUnavailable();
    return loadInitialLocale(null);
  }
}

function readStoredJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    markStorageUnavailable();
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    markStorageUnavailable();
    return false;
  }
}

function loadProfile() {
  return { ...emptyProfile(), ...(readStoredJson(PROFILE_KEY, {}) || {}) };
}

function loadStats() {
  return {
    ...emptyStats(),
    ...(readStoredJson(STORAGE_KEY, {}) || {}),
  };
}

function loadCart() {
  const ids = readStoredJson(CART_KEY, []);
  return (Array.isArray(ids) ? ids : [])
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean);
}

function loadOrders() {
  const orders = readStoredJson(ORDERS_KEY, []);
  return Array.isArray(orders) ? orders : [];
}

function loadRack() {
  const rack = readStoredJson(RACK_KEY, []);
  return Array.isArray(rack) ? rack : [];
}

function persist() {
  writeStorage(STORAGE_KEY, JSON.stringify(state.stats));
  writeStorage(CART_KEY, JSON.stringify(state.cart.map((item) => item.id)));
  writeStorage(PROFILE_KEY, JSON.stringify(state.profile));
  writeStorage(ORDERS_KEY, JSON.stringify(state.orders));
  writeStorage(RACK_KEY, JSON.stringify(state.rack));
}

function render() {
  document.documentElement.lang = state.locale;

  const app = document.querySelector("#app");
  app.innerHTML = view().appHtml();
  // The build-time markup (scripts/prerender-plugin.mjs) is hidden from
  // JavaScript visitors; reveal #app now that it holds the client render.
  delete app.dataset.prerendered;

  bindEvents();
}

function bindEvents() {
  document.querySelector(".language-toggle")?.addEventListener("click", () => {
    state.languageOpen = !state.languageOpen;
    state.profileIntentionOpen = false;
    render();
  });

  document.querySelectorAll("[data-locale]").forEach((button) => {
    button.addEventListener("click", () => {
      state.locale = button.dataset.locale;
      state.languageOpen = false;
      state.profileIntentionOpen = false;
      writeStorage(LOCALE_KEY, state.locale);
      render();
    });
  });

  document.querySelector(".intention-toggle")?.addEventListener("click", () => {
    state.profileDraftName = String(document.querySelector(".profile-sheet input[name='name']")?.value || "");
    state.profileIntentionOpen = !state.profileIntentionOpen;
    state.languageOpen = false;
    render();
  });

  document.querySelectorAll("[data-intention]").forEach((button) => {
    button.addEventListener("click", () => {
      state.profileDraftName = String(document.querySelector(".profile-sheet input[name='name']")?.value || "");
      state.profileDraftIntention = button.dataset.intention;
      state.profileIntentionOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      resetProductBatch();
      render();
      document.querySelector("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-collection]").forEach((button) => {
    button.addEventListener("click", () => {
      state.collection = button.dataset.collection;
      resetProductBatch();
      render();
      document.querySelector("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelector(".browse-drop")?.addEventListener("click", () => {
    state.collection = ALL_ID;
    state.filter = ALL_ID;
    resetProductBatch();
    render();
    document.querySelector("#shop").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.querySelector("[data-load-products]")?.addEventListener("click", loadMoreProducts);

  // Delegated so cards appended by loadMoreProducts keep working without rebinding.
  document.querySelector(".product-grid")?.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add]");
    if (addButton) {
      const item = products.find((product) => product.id === addButton.dataset.add);
      if (!item) return;
      state.cart.push(item);
      persist();
      render();
      openCart();
      return;
    }

    const coolButton = event.target.closest("[data-cool]");
    if (coolButton) {
      coolOffProduct(coolButton.dataset.cool);
      render();
      document.querySelector(".cooling-rack")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      state.cart.splice(Number(button.dataset.remove), 1);
      persist();
      render();
      openCart();
    });
  });

  document.querySelectorAll(".cart-toggle").forEach((button) => {
    button.addEventListener("click", openCart);
  });

  document.querySelectorAll(".cart-close, .scrim").forEach((button) => {
    button.addEventListener("click", closeCart);
  });

  document.querySelector(".checkout-button")?.addEventListener("click", checkout);

  document.querySelectorAll("[data-trigger]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTrigger = button.dataset.trigger;
      render();
    });
  });

  document.querySelector(".check-in-complete")?.addEventListener("click", () => {
    finalizeCheckout(state.selectedTrigger);
  });

  document.querySelector(".check-in-skip")?.addEventListener("click", () => {
    finalizeCheckout(null);
  });

  document.querySelector(".tracker-finish")?.addEventListener("click", () => {
    state.receipt = state.trackerReceipt;
    state.trackerReceipt = null;
    state.receiptCopyStatus = "";
    render();
  });

  document.querySelector(".copy-receipt")?.addEventListener("click", async () => {
    const text = receiptText(state.receipt);
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // The visible confirmation still gives users a fallback to select from future UI.
    }
    state.receiptCopyStatus = view().t("receipt.copied");
    render();
  });

  document.querySelector(".share-receipt")?.addEventListener("click", async () => {
    const { t } = view();
    const text = receiptShareText(state.receipt);
    const shareData = {
      title: t("receipt.shareTitle"),
      text,
      url: canonicalShareUrl(),
    };

    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        state.receiptCopyStatus = t("receipt.shared");
        render();
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard?.writeText(`${text}\n\n${canonicalShareUrl()}`);
    } catch {
      // The status message still explains the fallback action when clipboard access is blocked.
    }
    state.receiptCopyStatus = t("receipt.shareCopied");
    render();
  });

  document.querySelector(".download-receipt")?.addEventListener("click", () => {
    const blob = new Blob([receiptText(state.receipt)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "we-wont-buy-receipt.txt";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  document.querySelector(".clear-history")?.addEventListener("click", () => {
    state.orders = [];
    persist();
    render();
  });

  document.querySelector(".reset-local-data")?.addEventListener("click", () => {
    state.cart = [];
    state.profile = emptyProfile();
    state.orders = [];
    state.rack = [];
    state.stats = emptyStats();
    state.receipt = null;
    state.trackerReceipt = null;
    state.checkInOpen = false;
    state.selectedTrigger = "";
    resetProductBatch();
    persist();
    render();
  });

  document.querySelectorAll("[data-rack-release]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rack = state.rack.filter((entry) => entry.productId !== button.dataset.rackRelease);
      persist();
      render();
    });
  });

  document.querySelectorAll("[data-rack-again]").forEach((button) => {
    button.addEventListener("click", () => {
      coolOffProduct(button.dataset.rackAgain);
      render();
    });
  });

  document.querySelectorAll("[data-rack-move]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = products.find((product) => product.id === button.dataset.rackMove);
      if (!item) return;
      state.cart.push(item);
      state.rack = state.rack.filter((entry) => entry.productId !== item.id);
      persist();
      render();
    });
  });

  document.querySelector(".profile-toggle")?.addEventListener("click", () => {
    openProfile();
    render();
  });

  document.querySelector(".profile-close")?.addEventListener("click", () => {
    state.profileOpen = false;
    state.profilePromptCheckout = false;
    state.profileIntentionOpen = false;
    render();
  });

  document.querySelector(".profile-sheet input[name='name']")?.addEventListener("input", (event) => {
    state.profileDraftName = event.currentTarget.value;
  });

  document.querySelector(".profile-sheet")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.profile = {
      name: state.profileDraftName.trim(),
      intention: state.profileDraftIntention || String(form.get("intention") || ""),
      skipped: false,
    };
    state.profileOpen = false;
    const shouldContinueCheckout = state.profilePromptCheckout;
    state.profilePromptCheckout = false;
    state.profileIntentionOpen = false;
    persist();
    if (shouldContinueCheckout) {
      openCheckIn();
      return;
    }
    render();
  });

  document.querySelector(".profile-skip")?.addEventListener("click", () => {
    state.profile = { ...emptyProfile(), skipped: true };
    state.profileOpen = false;
    const shouldContinueCheckout = state.profilePromptCheckout;
    state.profilePromptCheckout = false;
    state.profileIntentionOpen = false;
    persist();
    if (shouldContinueCheckout) {
      openCheckIn();
      return;
    }
    render();
  });

  document.querySelector(".profile-clear")?.addEventListener("click", () => {
    state.profile = { ...emptyProfile(), skipped: true };
    state.profileOpen = false;
    const shouldContinueCheckout = state.profilePromptCheckout;
    state.profilePromptCheckout = false;
    state.profileIntentionOpen = false;
    persist();
    if (shouldContinueCheckout) {
      openCheckIn();
      return;
    }
    render();
  });

  document.querySelectorAll(".receipt-close").forEach((button) => {
    button.addEventListener("click", () => {
      state.receipt = null;
      state.receiptCopyStatus = "";
      render();
    });
  });

  syncHeader();
  setupProductLoader();
}

function resetProductBatch() {
  state.visibleProductCount = PRODUCT_BATCH_SIZE;
}

// Appends to the grid instead of re-rendering: a full innerHTML swap mid-scroll
// makes Safari (no scroll anchoring) reset the scroll position to the top.
function loadMoreProducts() {
  const filteredProducts = view().filteredCatalog();
  const nextCount = Math.min(state.visibleProductCount + PRODUCT_BATCH_SIZE, filteredProducts.length);
  if (nextCount <= state.visibleProductCount) return;
  const newProducts = filteredProducts.slice(state.visibleProductCount, nextCount);
  state.visibleProductCount = nextCount;
  appendProducts(newProducts, filteredProducts.length);
}

function appendProducts(newProducts, totalCount) {
  const grid = document.querySelector(".product-grid");
  const loader = document.querySelector(".product-loader");
  if (!grid || !loader) return;

  grid.insertAdjacentHTML("beforeend", newProducts.map(view().productCard).join(""));

  const countLine = loader.querySelector("p");
  if (countLine) {
    countLine.textContent = view().t("shop.visibleCount", { visible: state.visibleProductCount, total: totalCount });
  }

  if (state.visibleProductCount >= totalCount) {
    loader.querySelector("[data-load-products]")?.remove();
    loader.querySelector("[data-product-sentinel]")?.remove();
    productLoaderObserver?.disconnect();
    return;
  }

  // Re-observe so a sentinel still inside rootMargin fires again immediately.
  setupProductLoader();
}

function setupProductLoader() {
  productLoaderObserver?.disconnect();
  const sentinel = document.querySelector("[data-product-sentinel]");
  if (!sentinel || !("IntersectionObserver" in window)) return;

  productLoaderObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreProducts();
    },
    { rootMargin: "360px 0px" },
  );
  productLoaderObserver.observe(sentinel);
}

function receiptText(receipt) {
  if (!receipt) return "";
  const { t, formatMoney } = view();
  const plural = receipt.count === 1 ? "" : "s";
  return [
    t("common.brand"),
    t("receipt.textTitle"),
    t("receipt.textItems", { count: receipt.count, plural }),
    `${formatMoney(receipt.total)} ${t("receipt.impulseCompleted").toLowerCase()}`,
    t("receipt.textRealCharge"),
    t("history.noRealOrder"),
  ].join("\n");
}

function receiptShareText(receipt) {
  if (!receipt) return "";
  const { t, formatMoney } = view();
  return [
    t("receipt.shareTextIntro", { total: formatMoney(receipt.total) }),
    "",
    t("receipt.textItems", { count: receipt.count, plural: receipt.count === 1 ? "" : "s" }),
    t("receipt.textRealCharge"),
    t("tracker.finalStatus"),
  ].join("\n");
}

function canonicalShareUrl() {
  return "https://wewontbuy.com/";
}

function syncHeader() {
  const header = document.querySelector(".site-header");
  const hero = document.querySelector(".hero");
  if (!header || !hero) return;
  const pastHero = hero.getBoundingClientRect().bottom <= header.offsetHeight;
  header.classList.toggle("is-stuck", pastHero);
}

function openCart() {
  setCartOpen(true);
}

function closeCart() {
  setCartOpen(false);
}

function setCartOpen(open) {
  const drawer = document.querySelector(".cart-drawer");
  drawer?.classList.toggle("is-open", open);
  drawer?.toggleAttribute("inert", !open);
  const scrim = document.querySelector(".scrim");
  if (scrim) scrim.hidden = !open;
}

function coolOffProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  const now = Date.now();
  const entry = {
    productId: product.id,
    addedAt: new Date(now).toISOString(),
    unlockAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
  };
  state.rack = [entry, ...state.rack.filter((item) => item.productId !== product.id)].slice(0, 50);
  persist();
}

function openProfile({ forCheckout = false } = {}) {
  state.profileOpen = true;
  state.profilePromptCheckout = forCheckout;
  state.profileIntentionOpen = false;
  state.profileDraftName = state.profile.name;
  state.profileDraftIntention = state.profile.intention;
}

function checkout() {
  if (!state.cart.length) return;
  if (!state.profile.name && !state.profile.skipped) {
    openProfile({ forCheckout: true });
    closeCart();
    render();
    return;
  }
  openCheckIn();
}

function openCheckIn() {
  state.checkInOpen = true;
  state.selectedTrigger = "";
  closeCart();
  render();
}

function finalizeCheckout(trigger) {
  if (!state.cart.length) return;
  const receipt = {
    items: [...state.cart],
    count: state.cart.length,
    total: view().cartTotal(),
    impact: view().cartImpact(),
    trigger,
  };
  const order = {
    id: `local-${Date.now()}`,
    createdAt: new Date().toISOString(),
    items: receipt.items.map(({ id, image, category, price, impact }) => ({
      id,
      image,
      category,
      price,
      impact,
    })),
    total: receipt.total,
    impact: receipt.impact,
    realCharge: 0,
    trigger,
    trackerStatus: view().t("tracker.finalStatus"),
  };

  state.stats.saved += receipt.total;
  state.stats.items += receipt.count;
  state.stats.impact += receipt.impact;
  state.stats.orders += 1;
  state.orders = [order, ...state.orders].slice(0, 100);
  state.cart = [];
  state.checkInOpen = false;
  state.selectedTrigger = "";
  state.trackerReceipt = receipt;
  state.receipt = null;
  persist();
  render();
}

// Bound once in initClient(): #app outlives every render, so binding it in
// bindEvents() would stack one more listener per render.
function closeLanguageMenuOnOutsideClick(event) {
  if (!state.languageOpen || event.target.closest(".language-control")) return;
  state.languageOpen = false;
  writeStorage(LOCALE_KEY, state.locale);
  render();
}

function initClient() {
  state = loadClientState();
  render();
  document.querySelector("#app").addEventListener("click", closeLanguageMenuOnOutsideClick);
  window.addEventListener("scroll", syncHeader, { passive: true });
  window.addEventListener("resize", syncHeader);
}

initClient();
