// Pure markup for the app shell. This module must stay importable from plain
// Node (scripts/prerender-plugin.mjs): no window, document, navigator or localStorage
// access at import time or while rendering.
import { DEFAULT_LOCALE, languageOptions, t as translate } from "./i18n.js";
import {
  categories as catalogCategories,
  collections as catalogCollections,
  drops,
  products,
} from "./data/catalog.generated.js";
import { productImageSrcset } from "./product-images.js";

export const ALL_ID = "all";
export const PRODUCT_BATCH_SIZE = 24;

const categories = [ALL_ID, ...catalogCategories];
const collectionEntries = catalogCollections.map((collection) =>
  typeof collection === "string" ? { id: collection } : collection,
);
const collectionLookup = Object.fromEntries(collectionEntries.map((collection) => [collection.id, collection]));
const collections = [ALL_ID, ...collectionEntries.map((collection) => collection.id)];
const currentDrop = drops[0];

const triggers = [
  "boredom",
  "stress",
  "sale",
  "social",
  "outfit",
  "reward",
  "unsure",
];

const profileIntentions = ["spend-less", "slow-down", "just-browse"];

// WebP renditions of public/assets/hero-editorial.png (1800x1200). The hero is
// object-fit: cover at 92svh (86svh at <= 820px), so on portrait screens it
// renders wider than the viewport: at 3:2 that is 138svh (129svh).
const HERO_IMAGE_BASE = "/assets/hero-editorial";
const HERO_IMAGE_WIDTHS = [960, 1440, 1800];
const HERO_IMAGE_HEIGHT = 1200;
const HERO_IMAGE_SIZES = "(max-width: 820px) max(100vw, 129svh), max(100vw, 138svh)";
const heroSrc = (width) => `${HERO_IMAGE_BASE}-${width}.webp`;

// Rendered widths of product images, mirroring the layouts in styles.css: the
// shop grid has 3, 2 or 1 columns inside the page gutters; rack and cart show
// fixed thumbs. The receipt haul strip is one column while the receipt content
// box is <= 520px, i.e. below a ~618px viewport once the modal and sheet
// padding are taken off, and at most (760 - 2 * 44 - 3 * 8) / 4 = 162px wide in
// its four-column layout.
const PRODUCT_CARD_SIZES = "(max-width: 560px) calc(100vw - 32px), (max-width: 820px) calc(50vw - 40px), calc(33vw - 40px)";
const HAUL_IMAGE_SIZES = "(max-width: 617px) calc(100vw - 84px), 162px";
const RACK_THUMB_SIZES = "96px";
const CART_THUMB_SIZES = "72px";

function productImageAttributes(src, sizes) {
  const srcset = productImageSrcset(src);
  return srcset ? `src="${src}" srcset="${srcset}" sizes="${sizes}"` : `src="${src}"`;
}

export function emptyProfile() {
  return { name: "", intention: "", skipped: false };
}

export function emptyStats() {
  return { saved: 0, orders: 0, items: 0, impact: 0 };
}

// The state a first-time visitor starts from (before localStorage is read).
export function createDefaultState(locale = DEFAULT_LOCALE) {
  return {
    locale,
    filter: ALL_ID,
    collection: ALL_ID,
    cart: [],
    profile: emptyProfile(),
    profileOpen: false,
    profilePromptCheckout: false,
    orders: [],
    rack: [],
    stats: emptyStats(),
    receipt: null,
    receiptCopyStatus: "",
    trackerReceipt: null,
    checkInOpen: false,
    selectedTrigger: "",
    languageOpen: false,
    profileIntentionOpen: false,
    profileDraftName: "",
    profileDraftIntention: "",
    visibleProductCount: PRODUCT_BATCH_SIZE,
  };
}

// Returns the HTML for #app for the given state.
export function renderAppHtml(state, options) {
  return createView(state, options).appHtml();
}

// Binds the template helpers to one state snapshot. The client creates a view
// per render; nothing here mutates state or touches the DOM.
export function createView(state, { storageUnavailable = false } = {}) {

  function t(key, params) {
    return translate(state.locale, key, params);
  }

  function translateWithFallback(key, fallback) {
    const translated = t(key);
    return translated === key ? fallback : translated;
  }

  function localizedText(value, fallback = "") {
    if (!value) return fallback;
    if (typeof value === "string") return value;
    return value[state.locale] || value.en || Object.values(value)[0] || fallback;
  }

  function titleCase(id) {
    return String(id)
      .split("-")
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(" ");
  }

  function productById(productOrId) {
    if (!productOrId) return null;
    if (typeof productOrId === "string") {
      return products.find((product) => product.id === productOrId) || null;
    }
    return productOrId;
  }

  function productName(productOrId) {
    const product = productById(productOrId);
    const id = product?.id || String(productOrId || "");
    const fallback = localizedText(product?.name, titleCase(id));
    return translateWithFallback(`products.${id}.name`, fallback);
  }

  function productNote(productOrId) {
    const product = productById(productOrId);
    const id = product?.id || String(productOrId || "");
    const fallback = localizedText(product?.note);
    return translateWithFallback(`products.${id}.note`, fallback);
  }

  function categoryLabel(category) {
    return translateWithFallback(`categories.${category}`, titleCase(category));
  }

  function collectionLabel(collection) {
    const fallback = localizedText(collectionLookup[collection]?.name, titleCase(collection));
    return translateWithFallback(`collectionNames.${collection}`, fallback);
  }

  function triggerLabel(trigger) {
    if (!trigger) return "";
    const key = englishTriggerToId(trigger);
    return t(`triggers.${key}`);
  }

  function englishTriggerToId(trigger) {
    const triggerMap = {
      Boredom: "boredom",
      Stress: "stress",
      "Sale pressure": "sale",
      "Social media": "social",
      "Outfit fantasy": "outfit",
      "Reward impulse": "reward",
      "Not sure": "unsure",
    };
    return triggerMap[trigger] || trigger;
  }

  function currentLanguage() {
    return languageOptions.find((language) => language.code === state.locale) || languageOptions[0];
  }

  function formatMoney(value) {
    return Math.round(value).toLocaleString(state.locale);
  }

  function cartTotal() {
    return state.cart.reduce((sum, item) => sum + item.price, 0);
  }

  function cartImpact() {
    return state.cart.reduce((sum, item) => sum + item.impact, 0);
  }

  function filteredCatalog() {
    return products
      .filter((product) => state.filter === ALL_ID || product.category === state.filter)
      .filter((product) => state.collection === ALL_ID || product.collections.includes(state.collection));
  }

  function appHtml() {
    const filteredProducts = filteredCatalog();
    const visibleProducts = filteredProducts.slice(0, state.visibleProductCount);
    const hasMoreProducts = visibleProducts.length < filteredProducts.length;

    return `
      <header class="site-header">
        <a class="brand" href="#top" aria-label="${t("nav.home")}">${t("common.brand")}</a>
        <nav class="header-actions" aria-label="${t("nav.main")}">
          <a href="#shop">${t("nav.shop")}</a>
          <a href="#receipt">${t("nav.saved")}</a>
          <a class="header-contact" href="mailto:info@wewontbuy.com">${t("nav.contact")}</a>
          <div class="language-control" data-current-locale="${state.locale}">
            <button
              class="language-toggle"
              type="button"
              aria-label="${t("language.label")}: ${currentLanguage().label}"
              aria-expanded="${state.languageOpen}"
            >
              <span>${currentLanguage().label}</span>
            </button>
            ${
              state.languageOpen
                ? `
                  <div class="language-menu" role="menu" aria-label="${t("language.label")}">
                    ${languageOptions
                      .map(
                        (language) => `
                          <button
                            class="${state.locale === language.code ? "is-active" : ""}"
                            type="button"
                            role="menuitemradio"
                            aria-checked="${state.locale === language.code}"
                            data-locale="${language.code}"
                          >
                            ${language.label}
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                `
                : ""
            }
          </div>
          <button class="profile-toggle" type="button" aria-label="${t("profile.open")}">
            ${profileLabel()}
          </button>
          <button class="icon-button cart-toggle" type="button">
            <span>${t("nav.cart")}</span>
            <strong>${state.cart.length}</strong>
          </button>
        </nav>
      </header>

      <main id="top">
        <section class="hero" aria-label="${t("hero.aria")}">
          <img
            src="${heroSrc(HERO_IMAGE_WIDTHS.at(-1))}"
            srcset="${HERO_IMAGE_WIDTHS.map((width) => `${heroSrc(width)} ${width}w`).join(", ")}"
            sizes="${HERO_IMAGE_SIZES}"
            width="${HERO_IMAGE_WIDTHS.at(-1)}"
            height="${HERO_IMAGE_HEIGHT}"
            fetchpriority="high"
            alt="${t("hero.imageAlt")}"
          />
          <div class="hero-copy">
            <p class="eyebrow">${t("hero.eyebrow")}</p>
            <h1>${t("hero.title")}</h1>
            <p>
              ${t("hero.body")}
            </p>
            <div class="hero-trust-list" aria-label="${t("hero.trustAria")}">
              <span>${t("hero.trustNoAccount")}</span>
              <span>${t("hero.trustNoCookies")}</span>
              <span>${t("hero.trustZeroCharge")}</span>
            </div>
            <a class="primary-link" href="#shop">${t("hero.cta")}</a>
          </div>
        </section>

        <section class="stats-band" id="receipt" aria-label="${t("stats.aria")}">
          <article>
            <span>${formatMoney(state.stats.saved)}</span>
            <p>${t("stats.totalNotSpent")}</p>
          </article>
          <article>
            <span>${state.stats.items}</span>
            <p>${t("stats.itemsImaginary")}</p>
          </article>
          <article>
            <span>${state.stats.impact.toFixed(1)} kg</span>
            <p>${t("stats.burdenAvoided")}</p>
          </article>
        </section>

        ${savedDashboardSection()}

        <section class="local-data-notice" aria-label="${t("notice.aria")}">
          <p class="eyebrow">${t("notice.eyebrow")}</p>
          <p>
            ${t("notice.body")}
          </p>
        </section>

        ${storageUnavailable ? storageUnavailableNotice() : ""}

        ${manifestoSection()}

        ${orderHistorySection()}

        ${coolingRackSection()}

        ${collectionsSection()}

        ${dropSection()}

        <section class="shop-section" id="shop">
          <div class="section-heading">
            <p class="eyebrow">${t("shop.eyebrow")}</p>
            <h2>${t("shop.title")}</h2>
          </div>
          <p class="catalog-context">${
            state.collection === ALL_ID
              ? t("shop.showingAll")
              : t("shop.showingCollection", { collection: collectionLabel(state.collection) })
          }</p>
          <div class="filters" role="tablist" aria-label="${t("shop.filters")}">
            ${categories
              .map(
                (category) => `
                  <button
                    class="${state.filter === category ? "is-active" : ""}"
                    type="button"
                    data-filter="${category}"
                    role="tab"
                    aria-selected="${state.filter === category}"
                  >
                    ${categoryLabel(category)}
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="product-grid">
            ${visibleProducts.map(productCard).join("")}
          </div>
          <div class="product-loader" aria-live="polite">
            <p>${t("shop.visibleCount", { visible: visibleProducts.length, total: filteredProducts.length })}</p>
            ${
              hasMoreProducts
                ? `
                  <button class="secondary-button product-load-button" type="button" data-load-products>
                    ${t("shop.loadMore")}
                  </button>
                  <div class="product-load-sentinel" data-product-sentinel aria-hidden="true"></div>
                `
                : ""
            }
          </div>
        </section>

        ${faqSection()}

        <section class="calm-panel" aria-label="${t("calm.aria")}">
          <div>
            <p class="eyebrow">${t("calm.eyebrow")}</p>
            <h2>${t("calm.title")}</h2>
          </div>
          <p>
            ${t("calm.body")}
          </p>
        </section>
      </main>

      <footer class="site-footer">
        <p>${t("footer.credits")}</p>
      </footer>

      ${cartDrawer()}
      ${state.profileOpen ? profileModal() : ""}
      ${state.checkInOpen ? checkInModal() : ""}
      ${state.trackerReceipt ? trackerModal() : ""}
      ${state.receipt ? receiptModal() : ""}
    `;
  }

  function storageUnavailableNotice() {
    return `
      <section class="storage-warning" role="status">
        <p>${t("profile.storageUnavailable")}</p>
      </section>
    `;
  }

  function manifestoSection() {
    return `
      <section class="manifesto-section" aria-label="${t("manifesto.aria")}">
        <div>
          <p class="eyebrow">${t("manifesto.eyebrow")}</p>
          <h2>${t("manifesto.title")}</h2>
        </div>
        <div class="manifesto-copy">
          <p>${t("manifesto.body")}</p>
          <p>${t("manifesto.local")}</p>
        </div>
      </section>
      <section class="seo-section" aria-label="${t("seo.aria")}">
        <div>
          <p class="eyebrow">${t("seo.eyebrow")}</p>
          <h2>${t("seo.title")}</h2>
        </div>
        <p>${t("seo.body")}</p>
      </section>
    `;
  }

  function faqSection() {
    return `
      <section class="faq-section" id="faq" aria-label="${t("faq.aria")}">
        <div>
          <p class="eyebrow">${t("faq.eyebrow")}</p>
          <h2>${t("faq.title")}</h2>
        </div>
        <div class="faq-list">
          ${t("faq.items")
            .map(
              (item) => `
                <article class="faq-item">
                  <h3>${item.question}</h3>
                  <p>${item.answer}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function collectionsSection() {
    return `
      <section class="collections-section" aria-label="${t("collections.aria")}">
        <div class="history-heading">
          <div>
            <p class="eyebrow">${t("collections.eyebrow")}</p>
            <h2>${t("collections.title")}</h2>
          </div>
          <p>${t("collections.body")}</p>
        </div>
        <div class="collection-list">
          ${collections
            .filter((collection) => collection !== ALL_ID)
            .map(
              (collection) => `
                <button
                  class="${state.collection === collection ? "is-active" : ""}"
                  type="button"
                  data-collection="${collection}"
                >
                  ${collectionLabel(collection)}
                </button>
              `,
            )
            .join("")}
          <button class="${state.collection === ALL_ID ? "is-active" : ""}" type="button" data-collection="${ALL_ID}">${t("collections.all")}</button>
        </div>
      </section>
    `;
  }

  function dropSection() {
    return `
      <section class="drop-section" aria-label="${t("drops.currentAria")}">
        <div>
          <p class="eyebrow">${t("drops.currentEyebrow")}</p>
          <h2>${dropName(currentDrop)}</h2>
          <p>${dropNote(currentDrop)}</p>
          <span>${t("drops.products", { count: currentDrop.productIds.length })}</span>
        </div>
        <button class="primary-button browse-drop" type="button">${t("drops.browse", { name: dropName(currentDrop) })}</button>
      </section>
      <section class="drop-archive" aria-label="${t("drops.archiveAria")}">
        <p class="eyebrow">${t("drops.archiveEyebrow")}</p>
        <div class="archive-list">
          ${drops
            .map(
              (drop) => `
                <article>
                  <h3>${dropName(drop)}</h3>
                  <p>${dropDate(drop)}</p>
                </article>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function savedDashboardSection() {
    const trigger = mostCommonTrigger();
    return `
      <section class="saved-dashboard" aria-label="${t("dashboard.aria")}">
        <div class="dashboard-heading">
          <div>
            <p class="eyebrow">${t("dashboard.eyebrow")}</p>
            <h2>${t("dashboard.title")}</h2>
            ${state.profile.name ? `<p class="dashboard-profile-note">${t("profile.dashboardFor", { name: profileName() })}</p>` : ""}
          </div>
          <button class="secondary-button reset-local-data" type="button">${t("dashboard.reset")}</button>
        </div>
        <div class="dashboard-grid">
          <article>
            <span>${formatMoney(state.stats.saved)}</span>
            <p>${t("stats.totalNotSpent")}</p>
          </article>
          <article>
            <span>${t("dashboard.ordersValue", { count: state.stats.orders })}</span>
            <p>${t("dashboard.completed")}</p>
          </article>
          <article>
            <span>${t("dashboard.itemsValue", { count: state.stats.items })}</span>
            <p>${t("dashboard.leftImaginary")}</p>
          </article>
          <article>
            <span>${state.stats.impact.toFixed(1)} kg</span>
            <p>${t("stats.burdenAvoidedShort")}</p>
          </article>
          <article>
            <span>${trigger ? triggerLabel(trigger) : t("dashboard.notEnoughData")}</span>
            <p>${t("dashboard.mostCommonTrigger")}</p>
          </article>
          <article>
            <span>${t("dashboard.rackValue", { count: state.rack.length })}</span>
            <p>${t("dashboard.waiting")}</p>
          </article>
        </div>
      </section>
    `;
  }

  function mostCommonTrigger() {
    const counts = state.orders.reduce((acc, order) => {
      if (!order.trigger) return acc;
      acc[order.trigger] = (acc[order.trigger] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  function orderHistorySection() {
    return `
      <section class="order-history" aria-label="${t("history.aria")}">
        <div class="history-heading">
          <div>
            <p class="eyebrow">${t("history.eyebrow")}</p>
            <h2>${t("history.title")}</h2>
          </div>
          <button class="secondary-button clear-history" type="button" ${state.orders.length ? "" : "disabled"}>
            ${t("history.clear")}
          </button>
        </div>
        ${
          state.orders.length
            ? `<div class="history-list">${state.orders.map(orderCard).join("")}</div>`
            : `<p class="empty-copy">${t("history.empty")}</p>`
        }
      </section>
    `;
  }

  function orderCard(order) {
    const itemNames = order.items.map(orderItemName).join(", ");
    const date = new Intl.DateTimeFormat(state.locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(order.createdAt));

    return `
      <article class="history-card">
        <div>
          <p>${date}</p>
          <h3>${itemNames}</h3>
          ${order.trigger ? `<span>${t("history.trigger", { trigger: triggerLabel(order.trigger) })}</span>` : ""}
          <span>${t("history.noRealOrder")}</span>
        </div>
        <strong>${formatMoney(order.total)}</strong>
      </article>
    `;
  }

  function productCard(product) {
    const name = productName(product);
    return `
      <article class="product-card">
        <div class="product-image">
          <img ${productImageAttributes(product.image, PRODUCT_CARD_SIZES)} alt="${name}" loading="lazy" decoding="async" />
        </div>
        <div class="product-meta">
          <div>
            <h3>${name}</h3>
            <p>${categoryLabel(product.category)}</p>
          </div>
          <strong>${formatMoney(product.price)}</strong>
        </div>
        <p class="product-note">${productNote(product)}</p>
        <div class="product-actions">
          <button class="add-button" type="button" data-add="${product.id}" aria-label="${t("productActions.addAria", { name })}">${t("productActions.add")}</button>
          <button class="secondary-button cool-button" type="button" data-cool="${product.id}" aria-label="${t("productActions.coolAria", { name })}">${t("productActions.cool")}</button>
        </div>
      </article>
    `;
  }

  function coolingRackSection() {
    return `
      <section class="cooling-rack" aria-label="${t("rack.aria")}">
        <div class="history-heading">
          <div>
            <p class="eyebrow">${t("rack.eyebrow")}</p>
            <h2>${t("rack.title")}</h2>
          </div>
          <p>${t("rack.body")}</p>
        </div>
        ${
          state.rack.length
            ? `<div class="rack-list">${state.rack.map(rackCard).join("")}</div>`
            : `<p class="empty-copy">${t("rack.empty")}</p>`
        }
      </section>
    `;
  }

  function rackCard(entry) {
    const product = products.find((item) => item.id === entry.productId);
    if (!product) return "";
    const ready = new Date(entry.unlockAt).getTime() <= Date.now();
    const name = productName(product);

    return `
      <article class="rack-card">
        <img ${productImageAttributes(product.image, RACK_THUMB_SIZES)} alt="" />
        <div>
          <h3>${name}</h3>
          <p>${ready ? t("rack.ready") : t("rack.waiting")}</p>
          <div class="rack-actions">
            ${
              ready
                ? `
                  <button class="secondary-button" type="button" data-rack-move="${product.id}" aria-label="${t("rack.moveAria", { name })}">${t("rack.move")}</button>
                  <button class="secondary-button" type="button" data-rack-release="${product.id}" aria-label="${t("rack.releaseAria", { name })}">${t("rack.release")}</button>
                  <button class="secondary-button" type="button" data-rack-again="${product.id}" aria-label="${t("rack.againAria", { name })}">${t("rack.again")}</button>
                `
                : `<button class="secondary-button" type="button" data-rack-release="${product.id}" aria-label="${t("rack.releaseAria", { name })}">${t("rack.release")}</button>`
            }
          </div>
        </div>
      </article>
    `;
  }

  // The display name is free text typed by the visitor.
  function profileName() {
    return escapeHtml(state.profile.name);
  }

  function profileLabel() {
    if (state.profile.name) return profileName();
    if (state.profile.skipped) return t("profile.anonymous");
    return t("profile.fallback");
  }

  function intentionLabel(intention) {
    const labels = {
      "spend-less": t("profile.spendLess"),
      "slow-down": t("profile.slowDown"),
      "just-browse": t("profile.justBrowse"),
    };
    return labels[intention] || t("profile.choose");
  }

  function profileModal() {
    return `
      <section class="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <form class="profile-sheet">
          <button class="icon-button profile-close" type="button" aria-label="${t("profile.close")}">${t("common.close")}</button>
          <p class="eyebrow">${t("profile.eyebrow")}</p>
          <h2 id="profile-title">${t("profile.title")}</h2>
          <p class="profile-warning">
            ${t("profile.warning")}
          </p>
          ${storageUnavailable ? `<p class="profile-warning storage-inline-warning">${t("profile.storageUnavailable")}</p>` : ""}
          <label>
            <span>${t("profile.displayName")}</span>
            <input name="name" value="${escapeHtml(state.profileDraftName)}" autocomplete="off" required />
          </label>
          <div class="profile-field">
            <span>${t("profile.intention")}</span>
            <input type="hidden" name="intention" value="${escapeHtml(state.profileDraftIntention)}" />
            <div class="custom-select">
              <button
                class="custom-select-toggle intention-toggle"
                type="button"
                aria-label="${t("profile.intention")}: ${intentionLabel(state.profileDraftIntention)}"
                aria-expanded="${state.profileIntentionOpen}"
              >
                <span>${intentionLabel(state.profileDraftIntention)}</span>
              </button>
              ${
                state.profileIntentionOpen
                  ? `
                    <div class="custom-select-menu" role="menu" aria-label="${t("profile.intention")}">
                      <button
                        class="${state.profileDraftIntention === "" ? "is-active" : ""}"
                        type="button"
                        role="menuitemradio"
                        aria-checked="${state.profileDraftIntention === ""}"
                        data-intention=""
                      >
                        ${t("profile.choose")}
                      </button>
                      ${profileIntentions
                        .map(
                          (intention) => `
                            <button
                              class="${state.profileDraftIntention === intention ? "is-active" : ""}"
                              type="button"
                              role="menuitemradio"
                              aria-checked="${state.profileDraftIntention === intention}"
                              data-intention="${intention}"
                            >
                              ${intentionLabel(intention)}
                            </button>
                          `,
                        )
                        .join("")}
                    </div>
                  `
                  : ""
              }
            </div>
          </div>
          <div class="profile-actions">
            <button class="primary-button" type="submit">${t("profile.save")}</button>
            <button class="secondary-button profile-skip" type="button">${t("profile.skip")}</button>
            <button class="secondary-button profile-clear" type="button">${t("profile.clear")}</button>
          </div>
        </form>
      </section>
    `;
  }

  function checkInModal() {
    return `
      <section class="check-in-modal" role="dialog" aria-modal="true" aria-labelledby="check-in-title">
        <div class="check-in-sheet">
          <p class="eyebrow">${t("checkIn.eyebrow")}</p>
          <h2 id="check-in-title">${t("checkIn.title")}</h2>
          <p>${t("checkIn.body")}</p>
          <div class="trigger-grid" role="group" aria-label="${t("checkIn.triggerGroup")}">
            ${triggers
              .map(
                (trigger) => `
                  <button
                    class="${state.selectedTrigger === trigger ? "is-active" : ""}"
                    type="button"
                    data-trigger="${trigger}"
                  >
                    ${triggerLabel(trigger)}
                  </button>
                `,
              )
              .join("")}
          </div>
          <div class="profile-actions">
            <button class="primary-button check-in-complete" type="button" ${state.selectedTrigger ? "" : "disabled"}>
              ${t("checkIn.complete")}
            </button>
            <button class="secondary-button check-in-skip" type="button">${t("checkIn.skip")}</button>
          </div>
        </div>
      </section>
    `;
  }

  function trackerModal() {
    return `
      <section class="tracker-modal" role="dialog" aria-modal="true" aria-labelledby="tracker-title">
        <div class="tracker-sheet">
          <p class="eyebrow">${t("tracker.eyebrow")}</p>
          <h2 id="tracker-title">${t("tracker.title")}</h2>
          <p>${t("tracker.body")}</p>
          <ol class="tracker-steps">
            ${t("tracker.steps").map((step) => `<li>${step}</li>`).join("")}
          </ol>
          <button class="primary-button tracker-finish" type="button">${t("tracker.finish")}</button>
        </div>
      </section>
    `;
  }

  function cartDrawer() {
    const total = cartTotal();
    const impact = cartImpact();

    return `
      <aside class="cart-drawer" aria-label="${t("cart.aria")}" inert>
        <div class="drawer-head">
          <div>
            <p class="eyebrow">${t("cart.eyebrow")}</p>
            <h2>${state.cart.length ? t("cart.quietChoices", { count: state.cart.length }) : t("cart.emptyTitle")}</h2>
          </div>
          <button class="icon-button cart-close" type="button" aria-label="${t("cart.close")}">${t("common.close")}</button>
        </div>
        <div class="cart-items">
          ${
            state.cart.length
              ? state.cart.map(cartItem).join("")
              : `<p class="empty-copy">${t("cart.empty")}</p>`
          }
        </div>
        <div class="cart-summary">
          ${state.profile.name ? `<p class="cart-profile-note">${t("profile.cartFor", { name: profileName() })}</p>` : ""}
          <div>
            <span>${t("cart.internalTotal")}</span>
            <strong>${formatMoney(total)}</strong>
          </div>
          <div>
            <span>${t("cart.realCharge")}</span>
            <strong>${t("common.realChargeValue")}</strong>
          </div>
          <div>
            <span>${t("stats.burdenAvoidedShort")}</span>
            <strong>${impact.toFixed(1)} kg</strong>
          </div>
          <button class="checkout-button" type="button" ${state.cart.length ? "" : "disabled"}>
            ${t("cart.checkout")}
          </button>
          <p class="cart-local-note">
            ${t("cart.localNote")}
          </p>
        </div>
      </aside>
      <div class="scrim" hidden></div>
    `;
  }

  function cartItem(item, index) {
    const name = productName(item);
    return `
      <article class="cart-item">
        <img ${productImageAttributes(item.image, CART_THUMB_SIZES)} alt="" />
        <div>
          <h3>${name}</h3>
          <p>${formatMoney(item.price)}</p>
        </div>
        <button type="button" data-remove="${index}" aria-label="${t("cart.removeAria", { name })}">${t("cart.remove")}</button>
      </article>
    `;
  }

  function receiptModal() {
    const receipt = state.receipt;
    const heading = state.profile.name
      ? t("receipt.headingNamed", { name: profileName() })
      : t("receipt.heading");

    return `
      <section class="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
        <div class="receipt-sheet">
          <button class="icon-button receipt-close" type="button" aria-label="${t("receipt.close")}">${t("common.close")}</button>
          <p class="eyebrow">${t("receipt.eyebrow")}</p>
          <h2 id="receipt-title">${heading}</h2>
          <p>
            ${t("receipt.body", { total: formatMoney(receipt.total) })}
          </p>
          <p class="receipt-local-note">
            ${t("receipt.localNote")}
          </p>
          <div class="receipt-grid">
            <article>
              <span>${receipt.count}</span>
              <p>${t("receipt.itemsNotOrdered")}</p>
            </article>
            <article>
              <span>${formatMoney(receipt.total)}</span>
              <p>${t("receipt.impulseCompleted")}</p>
            </article>
            <article>
              <span>${receipt.impact.toFixed(1)} kg</span>
              <p>${t("stats.burdenAvoidedShort")}</p>
            </article>
          </div>
          <div class="haul-strip" aria-label="${t("receipt.haulAria")}">
            ${receipt.items
              .map((item) => `<img ${productImageAttributes(item.image, HAUL_IMAGE_SIZES)} alt="${productName(item)}" />`)
              .join("")}
          </div>
          <div class="receipt-actions">
            <button class="primary-button share-receipt" type="button">${t("receipt.share")}</button>
            <button class="primary-button copy-receipt" type="button">${t("receipt.copy")}</button>
            <button class="secondary-button download-receipt" type="button">${t("receipt.download")}</button>
            <button class="secondary-button receipt-close" type="button">${t("receipt.return")}</button>
          </div>
          ${state.receiptCopyStatus ? `<p class="receipt-status">${state.receiptCopyStatus}</p>` : ""}
        </div>
      </section>
    `;
  }

  function dropName(drop) {
    return translateWithFallback(`dropNames.${drop.id}`, localizedText(drop.name, titleCase(drop.id)));
  }

  function dropDate(drop) {
    return translateWithFallback(`dropDates.${drop.id}`, localizedText(drop.date));
  }

  function dropNote(drop) {
    return translateWithFallback(`dropNotes.${drop.id}`, localizedText(drop.note));
  }

  function orderItemName(item) {
    if (item.id) return productName(item.id);
    return item.name || "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  return { appHtml, productCard, filteredCatalog, t, formatMoney, cartTotal, cartImpact };
}
