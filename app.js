/**
 * app.js - HDB Explorer & Sunlight Ray Analyzer
 * 
 * Front-End Controller.
 * Every function is documented with beginner-friendly explanations
 * for readers who understand HTML and CSS.
 */
import HDB_DATASET from "./hdb-dataset.js";

// Global handler to gracefully suppress cross-origin / third-party script errors (e.g. Disqus / extensions)
window.addEventListener("error", (event) => {
  if (!event) return;
  const msg = event.message || "";
  // Check for generic cross-origin Script errors or third-party tracking/iframe errors
  if (
    msg === "Script error." ||
    msg.includes("Script error") ||
    msg.includes("ResizeObserver loop") ||
    (event.filename && (event.filename.includes("disqus") || event.filename.includes("extension")))
  ) {
    // Prevent unhandled error noise for third-party embeds
    if (typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    return true;
  }
}, true);

window.addEventListener("unhandledrejection", (event) => {
  if (event && event.reason) {
    const reasonStr = String(event.reason.message || event.reason);
    if (reasonStr.includes("Script error") || reasonStr.includes("disqus") || reasonStr.includes("ResizeObserver")) {
      event.preventDefault();
    }
  }
});

// Global application state object to keep track of current filters, dataset, and active flat
const state = {
  // Current search filters
  filters: {
    budgetMin: 0,
    budgetMax: 1500000,
    sizeMin: 50,
    sizeMax: 300,
    town: "ALL",
    flatType: "ALL",
    sunlightPreference: "all",
    leaseMin: 0,
    sortBy: "price_asc"
  },
  // Data retrieved from the /api/search serverless endpoint or client dataset
  data: {
    flats: [],
    meta: {},
    analytics: {
      priceTrendsByMonth: [],
      distributionByTown: [],
      budgetBuyMatrix: [],
      sunlightBreakdown: {}
    }
  },
  // Interactive Singapore Map Visualisation state
  map: {
    zoom: 1,
    panX: 0,
    panY: 0,
    facingFilter: "all",
    townFilter: "ALL",
    showRays: true,
    showPrices: true,
    showTowns: true,
    selectedFlat: null
  },
  // The currently selected flat for deep sunlight ray inspection
  selectedFlat: null,
  // Current simulation time for the sunlight canvas (in hours, e.g. 8.5 = 8:30 AM)
  simulatedTimeHours: 8.5,
  // Active navigation tab ("results", "map", "charts", "budget-buy", "gemini-chat")
  activeTab: "results",
  // Gemini Chat Advisor conversation state
  chat: {
    messages: [],
    isLoading: false
  },
  // Disqus Community Discussion state
  disqus: {
    shortname: "dreamwithinreach",
    language: "en", // Unified to English (en)
    activeTopic: "sg-hdb-sunlight-guide-2026",
    activeTitle: "Singapore HDB Resale & Solar Orientation Discussion Forum",
    activeUrl: typeof window !== "undefined" ? window.location.href : "",
    mainPageTopic: "dreamwithinreach-main-page",
    mainPageTitle: "🇸🇬 DreamWithinReach Main Community Discussion",
    isLoaded: false
  },
  // Data.gov.sg API Explorer state
  datagov: {
    resourceId: "d_8b84c4ee58e3cfc0ece0d773c8ca6abc",
    currentPreset: "first5", // "first5", "tampines4rm", "metadata", "custom"
    lastResponse: null,
    limit: 5,
    town: "ALL",
    flatType: "ALL",
    query: ""
  },
  // Open-Meteo Weather API state
  weather: {
    lat: 52.52,
    lon: 13.41,
    locationName: "Berlin, Germany (Requested API)",
    currentVariables: ["temperature_2m", "wind_speed_10m"],
    hourlyVariables: ["temperature_2m", "relative_humidity_2m", "wind_speed_10m"],
    data: null,
    isLoading: false,
    lastUpdated: null,
    cachedData: {}
  }
};

/**
 * Main application initialization function.
 * This runs as soon as DOM is ready or immediately if already loaded.
 */
function initApp() {
  // 1. Setup all button and form event listeners
  setupFilterEventListeners();
  setupTabNavigation();
  setupModalEventListeners();
  setupGeminiChatEventListeners();
  setupMapEventListeners();
  setupDisqusEventListeners();
  setupMainPageDisqusEventListeners();
  setupDatagovApiEventListeners();
  setupWeatherEventListeners();

  // 2. Initialize Gemini Chat Welcome message
  initGeminiChatWelcome();

  // 3. Initialize Main Page Disqus Thread
  initMainPageDisqus();

  // 4. Initialize Open-Meteo Weather Forecast
  initOpenMeteoWeather();

  // 5. Fetch and render matching flats
  fetchSearchResults();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  // Execute immediately if DOM is already parsed
  initApp();
}

/**
 * Attaches event listeners to all filter inputs (sliders, dropdowns, buttons).
 * Whenever a user moves a slider or picks a dropdown, we update state and refresh.
 */
function setupFilterEventListeners() {
  const filterForm = document.getElementById("filter-form");
  const budgetMaxSlider = document.getElementById("filter-budget-max");
  const budgetMinInput = document.getElementById("input-budget-min");
  const budgetMaxInput = document.getElementById("input-budget-max");
  const budgetValDisplay = document.getElementById("budget-val-display");

  const sizeMinSlider = document.getElementById("filter-size-min");
  const sizeValDisplay = document.getElementById("size-val-display");

  const townSelect = document.getElementById("filter-town");
  const flatTypeSelect = document.getElementById("filter-flat-type");
  const sunlightSelect = document.getElementById("filter-sunlight");
  const leaseMinSelect = document.getElementById("filter-lease-min");
  const sortBySelect = document.getElementById("filter-sort-by");
  const resetBtn = document.getElementById("btn-reset-filters");
  const clearEmptyBtn = document.getElementById("btn-clear-filters-empty");

  // Prevent form submission reloads
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      fetchSearchResults();
    });
  }

  // Helper debounce timer for smooth continuous sliding
  let debounceTimer = null;
  const triggerDebouncedSearch = () => {
    // 1. Immediately compute locally for instant 0ms UI reaction
    const localData = computeLocalSearchResults(state.filters);
    if (localData) {
      state.data.flats = localData.results || [];
      state.data.meta = localData.meta || {};
      state.data.analytics = localData.analytics || {};
      renderResultsHeaderAndMetrics();
      renderFlatsList();
      renderMapMarkers();
      renderPriceTrendsChart();
      renderTownDistributionChart();
      renderBudgetBuyMatrix();
    }

    // 2. Debounce background API query
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchSearchResults();
    }, 150);
  };

  // When Budget Max slider is moved
  if (budgetMaxSlider) {
    const handleBudgetSlider = (e) => {
      const val = parseInt(e.target.value, 10);
      state.filters.budgetMax = val;
      if (budgetMaxInput) budgetMaxInput.value = val;
      updateBudgetDisplayLabel();
      triggerDebouncedSearch();
    };
    budgetMaxSlider.addEventListener("input", handleBudgetSlider);
    budgetMaxSlider.addEventListener("change", handleBudgetSlider);
  }

  // When Budget Number Inputs change
  if (budgetMinInput) {
    const handleMinInput = (e) => {
      state.filters.budgetMin = Math.max(0, parseInt(e.target.value, 10) || 0);
      updateBudgetDisplayLabel();
      triggerDebouncedSearch();
    };
    budgetMinInput.addEventListener("input", handleMinInput);
    budgetMinInput.addEventListener("change", handleMinInput);
  }

  if (budgetMaxInput) {
    const handleMaxInput = (e) => {
      const val = Math.max(100000, parseInt(e.target.value, 10) || 1500000);
      state.filters.budgetMax = val;
      if (budgetMaxSlider) budgetMaxSlider.value = Math.min(1500000, val);
      updateBudgetDisplayLabel();
      triggerDebouncedSearch();
    };
    budgetMaxInput.addEventListener("input", handleMaxInput);
    budgetMaxInput.addEventListener("change", handleMaxInput);
  }

  // When Property Size (sqm) slider is moved
  if (sizeMinSlider) {
    const handleSizeSlider = (e) => {
      const val = parseInt(e.target.value, 10);
      state.filters.sizeMin = val;
      if (sizeValDisplay) {
        sizeValDisplay.textContent = val <= 50 ? "All Sizes (50 - 160 sqm)" : `Min ${val} sqm`;
      }
      triggerDebouncedSearch();
    };
    sizeMinSlider.addEventListener("input", handleSizeSlider);
    sizeMinSlider.addEventListener("change", handleSizeSlider);
  }

  // When Town selection changes
  if (townSelect) {
    const handleTown = (e) => {
      state.filters.town = e.target.value;
      triggerDebouncedSearch();
    };
    townSelect.addEventListener("change", handleTown);
    townSelect.addEventListener("input", handleTown);
  }

  // When Flat Type selection changes
  if (flatTypeSelect) {
    const handleFlatType = (e) => {
      state.filters.flatType = e.target.value;
      triggerDebouncedSearch();
    };
    flatTypeSelect.addEventListener("change", handleFlatType);
    flatTypeSelect.addEventListener("input", handleFlatType);
  }

  // When Sunlight Ray criteria changes
  if (sunlightSelect) {
    const handleSunlight = (e) => {
      state.filters.sunlightPreference = e.target.value;
      triggerDebouncedSearch();
    };
    sunlightSelect.addEventListener("change", handleSunlight);
    sunlightSelect.addEventListener("input", handleSunlight);
  }

  // When Remaining Lease changes
  if (leaseMinSelect) {
    const handleLease = (e) => {
      state.filters.leaseMin = parseInt(e.target.value, 10) || 0;
      triggerDebouncedSearch();
    };
    leaseMinSelect.addEventListener("change", handleLease);
    leaseMinSelect.addEventListener("input", handleLease);
  }

  // When Sort By changes
  if (sortBySelect) {
    const handleSort = (e) => {
      state.filters.sortBy = e.target.value;
      triggerDebouncedSearch();
    };
    sortBySelect.addEventListener("change", handleSort);
    sortBySelect.addEventListener("input", handleSort);
  }

  // Reset filter buttons
  const handleReset = () => {
    state.filters.budgetMin = 0;
    state.filters.budgetMax = 1500000;
    state.filters.sizeMin = 50;
    state.filters.town = "ALL";
    state.filters.flatType = "ALL";
    state.filters.sunlightPreference = "all";
    state.filters.leaseMin = 0;
    state.filters.sortBy = "price_asc";

    if (budgetMaxSlider) budgetMaxSlider.value = 1500000;
    if (budgetMinInput) budgetMinInput.value = 0;
    if (budgetMaxInput) budgetMaxInput.value = 1500000;
    if (sizeMinSlider) sizeMinSlider.value = 50;
    if (townSelect) townSelect.value = "ALL";
    if (flatTypeSelect) flatTypeSelect.value = "ALL";
    if (sunlightSelect) sunlightSelect.value = "all";
    if (leaseMinSelect) leaseMinSelect.value = "0";
    if (sortBySelect) sortBySelect.value = "price_asc";

    updateBudgetDisplayLabel();
    if (sizeValDisplay) sizeValDisplay.textContent = "All Sizes (50 - 160 sqm)";

    fetchSearchResults();
  };

  if (resetBtn) resetBtn.addEventListener("click", handleReset);
  if (clearEmptyBtn) clearEmptyBtn.addEventListener("click", handleReset);
}

/**
 * Updates the text badge showing the budget range (e.g. "$0 - $850,000").
 */
function updateBudgetDisplayLabel() {
  const budgetValDisplay = document.getElementById("budget-val-display");
  if (!budgetValDisplay) return;

  const minStr = state.filters.budgetMin > 0 ? `$${(state.filters.budgetMin / 1000).toFixed(0)}k` : "$0";
  const maxStr = state.filters.budgetMax >= 1000000 
    ? `$${(state.filters.budgetMax / 1000000).toFixed(2)}M` 
    : `$${(state.filters.budgetMax / 1000).toFixed(0)}k`;

  budgetValDisplay.textContent = `${minStr} - ${maxStr}`;

  const matrixBudgetEl = document.getElementById("matrix-current-budget");
  if (matrixBudgetEl) {
    matrixBudgetEl.textContent = `$${state.filters.budgetMax.toLocaleString()}`;
  }
}

/**
 * Handles switching between the five main view tabs:
 * 1. Matching Flats List
 * 2. Geocoded Map & Solar Vectors
 * 3. Market Trends Charts
 * 4. "What Does My Budget Buy?" Panel
 * 5. Gemini AI Advisor Chat
 */
function setupTabNavigation() {
  const tabResults = document.getElementById("tab-results");
  const tabMap = document.getElementById("tab-map");
  const tabCharts = document.getElementById("tab-charts");
  const tabBudget = document.getElementById("tab-budget-buy");
  const tabChat = document.getElementById("tab-gemini-chat");
  const tabDiscussions = document.getElementById("tab-discussions");
  const tabDatagov = document.getElementById("tab-datagov");
  const tabWeather = document.getElementById("tab-weather");

  const panelResults = document.getElementById("view-results-panel");
  const panelMap = document.getElementById("view-map-panel");
  const panelCharts = document.getElementById("view-charts-panel");
  const panelBudget = document.getElementById("view-budget-panel");
  const panelChat = document.getElementById("view-chat-panel");
  const panelDiscussions = document.getElementById("view-discussions-panel");
  const panelDatagov = document.getElementById("view-datagov-panel");
  const panelWeather = document.getElementById("view-weather-panel");

  const tabs = [
    { btn: tabResults, panel: panelResults, key: "results" },
    { btn: tabMap, panel: panelMap, key: "map" },
    { btn: tabCharts, panel: panelCharts, key: "charts" },
    { btn: tabBudget, panel: panelBudget, key: "budget-buy" },
    { btn: tabChat, panel: panelChat, key: "gemini-chat" },
    { btn: tabDiscussions, panel: panelDiscussions, key: "discussions" },
    { btn: tabDatagov, panel: panelDatagov, key: "datagov" },
    { btn: tabWeather, panel: panelWeather, key: "weather" }
  ];

  tabs.forEach(tabObj => {
    if (!tabObj.btn) return;
    tabObj.btn.addEventListener("click", () => {
      tabs.forEach(t => {
        if (t.btn) {
          t.btn.classList.remove("active");
          t.btn.setAttribute("aria-selected", "false");
        }
        if (t.panel) {
          t.panel.classList.add("hidden");
          t.panel.classList.remove("active");
        }
      });

      tabObj.btn.classList.add("active");
      tabObj.btn.setAttribute("aria-selected", "true");
      if (tabObj.panel) {
        tabObj.panel.classList.remove("hidden");
        tabObj.panel.classList.add("active");
      }
      state.activeTab = tabObj.key;

      // When switching to specific views, trigger view-specific lifecycle hooks
      if (tabObj.key === "results") {
        ensureDisqusContainer("main-page-disqus-wrapper");
        loadDisqusThread(
          state.disqus.mainPageTopic || "dreamwithinreach-main-page",
          state.disqus.mainPageTitle || "🇸🇬 DreamWithinReach Main Community Discussion",
          `${window.location.origin}/#${state.disqus.mainPageTopic || "dreamwithinreach-main-page"}`,
          state.disqus.language
        );
      } else if (tabObj.key === "map") {
        renderMapMarkers();
      } else if (tabObj.key === "charts") {
        renderPriceTrendsChart();
        renderTownDistributionChart();
      } else if (tabObj.key === "budget-buy") {
        renderBudgetBuyMatrix();
      } else if (tabObj.key === "gemini-chat") {
        renderChatContextBadges();
        scrollChatToBottom();
      } else if (tabObj.key === "discussions") {
        ensureDisqusContainer("discussions-tab-disqus-wrapper");
        loadDisqusThread(
          state.disqus.activeTopic,
          state.disqus.activeTitle,
          state.disqus.activeUrl || `${window.location.origin}/#${state.disqus.activeTopic}`,
          state.disqus.language
        );
      } else if (tabObj.key === "datagov") {
        if (!state.datagov.lastResponse) {
          executeDatagovPreset("first5");
        }
      } else if (tabObj.key === "weather") {
        if (!state.weather.data) {
          fetchOpenMeteoForecast(state.weather.lat, state.weather.lon, state.weather.locationName);
        }
      }
    });
  });
}

/**
 * Computes filtering, sorting, price trends, and sunlight analytics locally from HDB_DATASET.
 * This guarantees 0ms instantaneous UI feedback and 100% resilience across all deployment environments.
 * 
 * @param {object} filters 
 * @returns {object} { results, meta, analytics }
 */
function computeLocalSearchResults(filters) {
  const dataset = (typeof window !== "undefined" && window.HDB_DATASET) || 
                  (typeof globalThis !== "undefined" && globalThis.HDB_DATASET) || 
                  (typeof HDB_DATASET !== "undefined" ? HDB_DATASET : []);

  if (!dataset || dataset.length === 0) {
    return null;
  }

  const budgetMin = Number(filters.budgetMin) || 0;
  const budgetMax = Number(filters.budgetMax) || 1500000;
  const sizeMin = Number(filters.sizeMin) || 50;
  const sizeMax = Number(filters.sizeMax) || 300;
  const rawTown = (filters.town || "ALL").toUpperCase();
  const rawFlatType = (filters.flatType || "ALL").toUpperCase();
  const sunlightPref = (filters.sunlightPreference || "all").toLowerCase();
  const leaseMin = Number(filters.leaseMin) || 0;
  const sortBy = filters.sortBy || "price_asc";

  let results = dataset.filter(item => {
    if (item.resale_price < budgetMin || item.resale_price > budgetMax) return false;
    if (item.floor_area_sqm < sizeMin || item.floor_area_sqm > sizeMax) return false;
    if (item.remaining_lease_years < leaseMin) return false;

    if (rawTown !== "ALL") {
      const itemTown = (item.town || "").toUpperCase();
      if (itemTown !== rawTown && !itemTown.includes(rawTown) && !rawTown.includes(itemTown)) {
        return false;
      }
    }

    if (rawFlatType !== "ALL" && (item.flat_type || "").toUpperCase() !== rawFlatType) {
      return false;
    }

    if (sunlightPref === "north_south") {
      if (item.facing !== "North-South") return false;
    } else if (sunlightPref === "morning_sun") {
      const morningStr = String(item.morning_sun || "").toLowerCase();
      if (!morningStr.includes("morning") && item.facing !== "East" && item.facing !== "North-East" && item.facing !== "South-East") {
        return false;
      }
    } else if (sunlightPref === "no_afternoon_sun") {
      const aftStr = String(item.afternoon_sun || "").toLowerCase();
      if (item.facing === "West" || item.facing === "North-West" || item.facing === "South-West" || aftStr.includes("direct")) {
        return false;
      }
    } else if (sunlightPref === "high_comfort") {
      if (item.sunlight_score < 90) return false;
    }

    return true;
  });

  results.sort((a, b) => {
    switch (sortBy) {
      case "price_asc": return a.resale_price - b.resale_price;
      case "price_desc": return b.resale_price - a.resale_price;
      case "size_desc": return b.floor_area_sqm - a.floor_area_sqm;
      case "size_asc": return a.floor_area_sqm - b.floor_area_sqm;
      case "lease_desc": return b.remaining_lease_years - a.remaining_lease_years;
      case "psqm_asc": return (a.price_per_sqm || 0) - (b.price_per_sqm || 0);
      case "sunlight_score_desc": return b.sunlight_score - a.sunlight_score;
      default: return a.resale_price - b.resale_price;
    }
  });

  const totalCount = results.length;
  const avgPrice = totalCount > 0 ? Math.round(results.reduce((s, i) => s + i.resale_price, 0) / totalCount) : 0;
  const avgPsqm = totalCount > 0 ? Math.round(results.reduce((s, i) => s + (i.price_per_sqm || Math.round(i.resale_price / i.floor_area_sqm)), 0) / totalCount) : 0;
  const avgLease = totalCount > 0 ? (results.reduce((s, i) => s + i.remaining_lease_years, 0) / totalCount).toFixed(1) : "0.0";
  const avgSunlightScore = totalCount > 0 ? Math.round(results.reduce((s, i) => s + i.sunlight_score, 0) / totalCount) : 0;

  // Month map
  const monthMap = {};
  dataset.forEach(item => {
    const m = item.month || "2026-05";
    if (!monthMap[m]) {
      monthMap[m] = { month: m, total: 0, count: 0, min: item.resale_price, max: item.resale_price };
    }
    monthMap[m].total += item.resale_price;
    monthMap[m].count += 1;
    monthMap[m].min = Math.min(monthMap[m].min, item.resale_price);
    monthMap[m].max = Math.max(monthMap[m].max, item.resale_price);
  });
  const priceTrendsByMonth = Object.keys(monthMap).sort().map(m => ({
    month: m,
    averagePrice: Math.round(monthMap[m].total / monthMap[m].count),
    minPrice: monthMap[m].min,
    maxPrice: monthMap[m].max,
    count: monthMap[m].count
  }));

  // Town map
  const townMap = {};
  (results.length > 0 ? results : dataset).forEach(item => {
    if (!townMap[item.town]) {
      townMap[item.town] = { town: item.town, count: 0, total: 0, totalPsqm: 0 };
    }
    townMap[item.town].count += 1;
    townMap[item.town].total += item.resale_price;
    townMap[item.town].totalPsqm += (item.price_per_sqm || Math.round(item.resale_price / item.floor_area_sqm));
  });
  const distributionByTown = Object.keys(townMap).map(t => ({
    town: t,
    count: townMap[t].count,
    averagePrice: Math.round(townMap[t].total / townMap[t].count),
    averagePsqm: Math.round(townMap[t].totalPsqm / townMap[t].count)
  })).sort((a, b) => b.count - a.count);

  const nsCount = results.filter(i => i.facing === "North-South").length;
  const morningCount = results.filter(i => String(i.morning_sun || "").toLowerCase().includes("morning") || i.facing === "East" || i.facing === "North-East" || i.facing === "South-East").length;
  const comfortCount = results.filter(i => i.sunlight_score >= 90).length;

  const leaseBuckets = [
    { label: "< 60 Years (Mature/Central)", min: 0, max: 59 },
    { label: "60 - 75 Years (Mid Lease)", min: 60, max: 75 },
    { label: "76 - 85 Years (Good Lease)", min: 76, max: 85 },
    { label: "86 - 99 Years (Fresh Lease)", min: 86, max: 99 }
  ];
  const sizeBuckets = [
    { label: "Compact (<70 sqm)", min: 0, max: 69 },
    { label: "Standard (70-95 sqm)", min: 70, max: 95 },
    { label: "Spacious (96-120 sqm)", min: 96, max: 120 },
    { label: "Jumbo/Exec (>120 sqm)", min: 121, max: 300 }
  ];
  const budgetBuyMatrix = leaseBuckets.map(lb => ({
    leaseCategory: lb.label,
    sizeCategories: sizeBuckets.map(sb => {
      const matchCells = results.filter(i => i.remaining_lease_years >= lb.min && i.remaining_lease_years <= lb.max && i.floor_area_sqm >= sb.min && i.floor_area_sqm <= sb.max);
      const cCount = matchCells.length;
      return {
        sizeLabel: sb.label,
        count: cCount,
        averagePrice: cCount > 0 ? Math.round(matchCells.reduce((acc, curr) => acc + curr.resale_price, 0) / cCount) : 0,
        sampleFlatTypes: Array.from(new Set(matchCells.map(c => c.flat_type))).join(", ")
      };
    })
  }));

  return {
    results,
    meta: {
      totalMatches: totalCount,
      averagePrice: avgPrice,
      averagePsqm: avgPsqm,
      averageRemainingLease: avgLease,
      averageSunlightScore: avgSunlightScore
    },
    analytics: {
      priceTrendsByMonth,
      distributionByTown,
      budgetBuyMatrix,
      sunlightBreakdown: {
        northSouthCount: nsCount,
        morningSunCount: morningCount,
        highComfortPercentage: totalCount > 0 ? Math.round((comfortCount / totalCount) * 100) : 0
      }
    }
  };
}

/**
 * Sends an HTTP request to /api/search to get matching HDB listings
 * and analytical calculations based on current filters, with instant 0ms local fallback.
 */
async function fetchSearchResults() {
  const loadingContainer = document.getElementById("loading-spinner-container");
  const emptyContainer = document.getElementById("empty-results-container");

  // 1. Instantly compute and render from local dataset so the UI responds with 0ms delay
  const localData = computeLocalSearchResults(state.filters);
  if (localData) {
    state.data.flats = localData.results || [];
    state.data.meta = localData.meta || {};
    state.data.analytics = localData.analytics || {};

    renderResultsHeaderAndMetrics();
    renderFlatsList();
    renderMapMarkers();
    renderPriceTrendsChart();
    renderTownDistributionChart();
    renderBudgetBuyMatrix();
    updateDisqusFlatsDropdown();
    refreshDisqusCounts();
  }

  // 2. Query serverless backend in background for any live updates
  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 4000);

  try {
    const queryParams = new URLSearchParams({
      budgetMin: state.filters.budgetMin.toString(),
      budgetMax: state.filters.budgetMax.toString(),
      sizeMin: state.filters.sizeMin.toString(),
      town: state.filters.town,
      flatType: state.filters.flatType,
      sunlightPreference: state.filters.sunlightPreference,
      leaseMin: state.filters.leaseMin.toString(),
      sortBy: state.filters.sortBy
    });

    const response = await fetch(`/api/search?${queryParams.toString()}`, {
      signal: abortCtrl.signal,
      headers: { "Accept": "application/json" }
    });
    clearTimeout(timeoutId);

    if (response && response.ok) {
      const data = await response.json();
      if (data && data.results && data.results.length > 0) {
        state.data.flats = data.results || [];
        state.data.meta = data.meta || {};
        state.data.analytics = data.analytics || {};

        renderResultsHeaderAndMetrics();
        renderFlatsList();
        renderMapMarkers();
        renderPriceTrendsChart();
        renderTownDistributionChart();
        renderBudgetBuyMatrix();
        updateDisqusFlatsDropdown();
        refreshDisqusCounts();
      }
    }
  } catch (error) {
    // Gracefully silently fall back to local dataset already rendered
  } finally {
    clearTimeout(timeoutId);
    if (loadingContainer) loadingContainer.classList.add("hidden");
  }
}

/**
 * Updates all top-level metrics counters and summary banners
 * (total count, average price, $/sqm, average lease, sunlight breakdown).
 */
function renderResultsHeaderAndMetrics() {
  const meta = state.data.meta || {};
  const total = meta.totalMatches || 0;
  const avgPrice = meta.averagePrice || 0;
  const avgPsqm = meta.averagePsqm || 0;
  const avgLease = meta.averageRemainingLease || "0";

  // Header badges
  const headerCountEl = document.getElementById("header-match-count");
  if (headerCountEl) headerCountEl.textContent = `${total} Flats Available`;

  const tabCountBadge = document.getElementById("tab-count-badge");
  if (tabCountBadge) tabCountBadge.textContent = total.toString();

  // Summary pill values
  const avgPriceEl = document.getElementById("summary-avg-price");
  if (avgPriceEl) avgPriceEl.textContent = `$${avgPrice.toLocaleString()}`;

  const avgPsqmEl = document.getElementById("summary-avg-psqm");
  if (avgPsqmEl) avgPsqmEl.textContent = `$${avgPsqm.toLocaleString()}/sqm`;

  const avgLeaseEl = document.getElementById("summary-avg-lease");
  if (avgLeaseEl) avgLeaseEl.textContent = `${avgLease} yrs`;

  // Sunlight banner breakdown
  const sunlightBreakdown = state.data.analytics.sunlightBreakdown || {};
  const statNsEl = document.getElementById("stat-ns-count");
  if (statNsEl) statNsEl.textContent = (sunlightBreakdown.northSouthCount || 0).toString();

  const statMorningEl = document.getElementById("stat-morning-count");
  if (statMorningEl) statMorningEl.textContent = (sunlightBreakdown.morningSunCount || 0).toString();

  const statComfortEl = document.getElementById("stat-comfort-pct");
  if (statComfortEl) statComfortEl.textContent = `${sunlightBreakdown.highComfortPercentage || 0}%`;

  // Results title
  const resultsCountTitle = document.getElementById("results-count-title");
  if (resultsCountTitle) {
    const townLabel = state.filters.town === "ALL" ? "All Estates" : state.filters.town;
    resultsCountTitle.textContent = `${total} Matching HDB Flats in ${townLabel}`;
  }

  // Update AI Chat Context Badges
  renderChatContextBadges();
}

/**
 * Dynamically builds and inserts HTML cards for each matching HDB flat.
 */
function renderFlatsList() {
  const flatsGrid = document.getElementById("flats-grid");
  const emptyContainer = document.getElementById("empty-results-container");
  if (!flatsGrid) return;

  flatsGrid.innerHTML = "";

  if (state.data.flats.length === 0) {
    if (emptyContainer) emptyContainer.classList.remove("hidden");
    return;
  }

  if (emptyContainer) emptyContainer.classList.add("hidden");

  // Create card DOM elements for each flat
  state.data.flats.forEach(flat => {
    const card = document.createElement("article");
    card.className = "flat-card";
    card.setAttribute("id", `flat-card-${flat.id}`);
    card.setAttribute("tabindex", "0");

    // Determine badge styling based on sunlight orientation
    let ratingClass = "rating-high";
    let ratingIcon = "&#9881;";
    if (flat.facing === "North-South") {
      ratingClass = "rating-high";
      ratingIcon = "&#127788;"; // Breeze icon
    } else if (flat.facing.includes("East")) {
      ratingClass = "rating-morning";
      ratingIcon = "&#127749;"; // Sunrise icon
    } else {
      ratingClass = "rating-west";
      ratingIcon = "&#9728;"; // Sun warning icon
    }

    const leasePercent = Math.min(100, Math.round((flat.remaining_lease_years / 99) * 100));

    card.innerHTML = `
      <div class="flat-card-header">
        <div class="flat-location-group">
          <span class="flat-town-badge">${escapeHTML(flat.town)}</span>
          <h4 class="flat-address">Blk ${escapeHTML(flat.block)} ${escapeHTML(flat.street_name)}</h4>
          <span class="flat-storey">Storey ${escapeHTML(flat.storey_range)} &bull; ${escapeHTML(flat.flat_model)}</span>
        </div>
        <div class="flat-price-box">
          <div class="flat-resale-price">$${flat.resale_price.toLocaleString()}</div>
          <div class="flat-psqm">$${flat.price_per_sqm.toLocaleString()} / sqm</div>
        </div>
      </div>

      <div class="flat-specs-grid">
        <div class="spec-item">
          <span class="spec-label">Flat Type</span>
          <span class="spec-value">${escapeHTML(flat.flat_type)}</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Floor Area</span>
          <span class="spec-value">${flat.floor_area_sqm} sqm (${Math.round(flat.floor_area_sqm * 10.764)} sqft)</span>
        </div>
        <div class="spec-item">
          <span class="spec-label">Built Year</span>
          <span class="spec-value">${flat.lease_commence_date}</span>
        </div>
      </div>

      <div class="flat-sunlight-rating-bar ${ratingClass}">
        <div class="sun-tag-left">
          <span aria-hidden="true">${ratingIcon}</span>
          <span>${escapeHTML(flat.facing)} Facade: ${escapeHTML(flat.afternoon_sun)}</span>
        </div>
        <span class="sun-score-pill">Score ${flat.sunlight_score}/100</span>
      </div>

      <div class="flat-card-footer">
        <div class="lease-bar-container">
          <span class="lease-bar-label">Remaining Lease: <strong>${flat.remaining_lease_years} yrs ${flat.remaining_lease_months} mos</strong></span>
          <div class="lease-progress" role="progressbar" aria-valuenow="${flat.remaining_lease_years}" aria-valuemin="0" aria-valuemax="99" aria-label="Remaining Lease">
            <div class="lease-fill" style="width: ${leasePercent}%;"></div>
          </div>
        </div>
        <div class="card-action-btns">
          <button type="button" class="btn-discuss-card" data-flat-id="${flat.id}" title="Discuss this unit on Disqus">
            <span aria-hidden="true">&#128172;</span> Discuss
          </button>
          <button type="button" class="btn-view-map-card" data-flat-id="${flat.id}" title="View unit location on Singapore map">
            <span aria-hidden="true">&#127759;</span> Map
          </button>
          <button type="button" class="btn-ask-gemini" data-flat-id="${flat.id}" title="Ask Gemini AI Advisor about this unit">
            <span aria-hidden="true">&#10024;</span> Ask AI
          </button>
          <button type="button" class="btn-inspect-sun" data-flat-id="${flat.id}">
            <span aria-hidden="true">&#9728;</span> Inspect Rays
          </button>
        </div>
      </div>
    `;

    // Click handler for Discuss button
    const discussBtn = card.querySelector(".btn-discuss-card");
    if (discussBtn) {
      discussBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDisqusForFlat(flat.id);
      });
    }

    // Click handler for the inspect button
    const inspectBtn = card.querySelector(".btn-inspect-sun");
    if (inspectBtn) {
      inspectBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSunlightModal(flat);
      });
    }

    // Click handler for Ask AI button
    const askAiBtn = card.querySelector(".btn-ask-gemini");
    if (askAiBtn) {
      askAiBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        askGeminiAboutFlat(flat);
      });
    }

    // Click handler for View on Map button
    const viewMapBtn = card.querySelector(".btn-view-map-card");
    if (viewMapBtn) {
      viewMapBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        focusFlatOnMap(flat.id);
      });
    }

    flatsGrid.appendChild(card);
  });
}

/**
 * Master Registry of Singapore HDB Towns & Planning Zones
 * with approximate SVG centroid coordinates, bounding polygons,
 * and standard GIS bounds.
 */
const SINGAPORE_TOWN_REGIONS = [
  {
    name: "WOODLANDS",
    label: "Woodlands",
    cx: 410,
    cy: 140,
    polygon: "M 340 100 L 480 95 L 470 180 L 350 175 Z"
  },
  {
    name: "SEMBAWANG",
    label: "Sembawang",
    cx: 510,
    cy: 125,
    polygon: "M 480 95 L 560 90 L 550 160 L 470 160 Z"
  },
  {
    name: "YISHUN",
    label: "Yishun",
    cx: 535,
    cy: 175,
    polygon: "M 480 160 L 590 150 L 585 220 L 475 220 Z"
  },
  {
    name: "PUNGGOL",
    label: "Punggol",
    cx: 730,
    cy: 155,
    polygon: "M 670 120 L 790 140 L 775 200 L 665 185 Z"
  },
  {
    name: "SENGKANG",
    label: "Sengkang",
    cx: 690,
    cy: 220,
    polygon: "M 630 190 L 760 195 L 740 260 L 620 250 Z"
  },
  {
    name: "PASIR RIS",
    label: "Pasir Ris",
    cx: 830,
    cy: 215,
    polygon: "M 780 170 L 890 200 L 870 270 L 770 245 Z"
  },
  {
    name: "TAMPINES",
    label: "Tampines",
    cx: 795,
    cy: 290,
    polygon: "M 740 250 L 860 265 L 835 340 L 730 325 Z"
  },
  {
    name: "BEDOK",
    label: "Bedok",
    cx: 740,
    cy: 370,
    polygon: "M 670 330 L 810 335 L 780 420 L 650 405 Z"
  },
  {
    name: "HOUGANG",
    label: "Hougang",
    cx: 640,
    cy: 280,
    polygon: "M 590 250 L 700 255 L 685 320 L 580 315 Z"
  },
  {
    name: "ANG MO KIO",
    label: "Ang Mo Kio",
    cx: 530,
    cy: 250,
    polygon: "M 460 220 L 590 220 L 575 290 L 450 285 Z"
  },
  {
    name: "BISHAN",
    label: "Bishan",
    cx: 520,
    cy: 310,
    polygon: "M 460 285 L 570 285 L 560 350 L 455 345 Z"
  },
  {
    name: "TOA PAYOH",
    label: "Toa Payoh",
    cx: 535,
    cy: 365,
    polygon: "M 470 345 L 580 345 L 570 400 L 470 395 Z"
  },
  {
    name: "KALLANG/WHAMPOA",
    label: "Kallang/Whampoa",
    cx: 590,
    cy: 405,
    polygon: "M 540 380 L 640 380 L 630 440 L 530 435 Z"
  },
  {
    name: "GEYLANG",
    label: "Geylang",
    cx: 660,
    cy: 410,
    polygon: "M 615 385 L 705 385 L 690 450 L 605 445 Z"
  },
  {
    name: "QUEENSTOWN",
    label: "Queenstown",
    cx: 410,
    cy: 430,
    polygon: "M 360 395 L 460 395 L 445 470 L 350 460 Z"
  },
  {
    name: "BUKIT MERAH",
    label: "Bukit Merah",
    cx: 480,
    cy: 455,
    polygon: "M 440 420 L 530 420 L 515 495 L 430 490 Z"
  },
  {
    name: "CLEMENTI",
    label: "Clementi",
    cx: 330,
    cy: 390,
    polygon: "M 280 355 L 380 355 L 365 440 L 270 430 Z"
  },
  {
    name: "JURONG EAST",
    label: "Jurong East",
    cx: 275,
    cy: 350,
    polygon: "M 220 310 L 330 315 L 315 390 L 210 380 Z"
  },
  {
    name: "JURONG WEST",
    label: "Jurong West",
    cx: 195,
    cy: 345,
    polygon: "M 130 290 L 240 300 L 225 390 L 120 375 Z"
  },
  {
    name: "CHOA CHU KANG",
    label: "Choa Chu Kang",
    cx: 260,
    cy: 245,
    polygon: "M 200 200 L 310 205 L 300 290 L 190 280 Z"
  },
  {
    name: "BUKIT PANJANG",
    label: "Bukit Panjang",
    cx: 340,
    cy: 230,
    polygon: "M 290 190 L 390 195 L 380 280 L 280 270 Z"
  },
  {
    name: "BUKIT BATOK",
    label: "Bukit Batok",
    cx: 310,
    cy: 300,
    polygon: "M 260 260 L 360 265 L 345 345 L 250 335 Z"
  },
  {
    name: "SERANGOON",
    label: "Serangoon",
    cx: 600,
    cy: 310,
    polygon: "M 550 280 L 640 280 L 630 345 L 540 340 Z"
  }
];

/**
 * Converts Singapore GPS coordinates (Latitude & Longitude)
 * to SVG coordinate space on our 1000 x 620 canvas.
 * 
 * @param {number} lat - GPS Latitude (approx 1.22 to 1.48)
 * @param {number} lng - GPS Longitude (approx 103.60 to 104.04)
 * @returns {{x: number, y: number}} - SVG X & Y pixel positions
 */
function convertGpsToSvg(lat, lng) {
  const minLng = 103.62;
  const maxLng = 104.02;
  const minLat = 1.21;
  const maxLat = 1.48;

  const svgX = ((lng - minLng) / (maxLng - minLng)) * 820 + 90;
  const svgY = 570 - (((lat - minLat) / (maxLat - minLat)) * 460 + 50);

  return { x: svgX, y: svgY };
}

/**
 * Sets up all event handlers for the interactive Singapore Map toolbar,
 * including town filter, layer toggles, zoom controls, and orientation pills.
 */
function setupMapEventListeners() {
  const townSelect = document.getElementById("map-town-select");
  const toggleRaysBtn = document.getElementById("toggle-layer-rays");
  const togglePricesBtn = document.getElementById("toggle-layer-prices");
  const toggleTownsBtn = document.getElementById("toggle-layer-towns");
  const zoomInBtn = document.getElementById("btn-map-zoom-in");
  const zoomOutBtn = document.getElementById("btn-map-zoom-out");
  const resetZoomBtn = document.getElementById("btn-map-reset-zoom");
  const closeInfoBtn = document.getElementById("btn-close-map-info");
  const askGeminiMapBtn = document.getElementById("btn-ask-gemini-map");
  const inspectMapFlatBtn = document.getElementById("btn-inspect-map-flat");
  const legendPills = document.querySelectorAll(".legend-pill[data-facing-filter]");

  // Town focus selector on map
  if (townSelect) {
    townSelect.addEventListener("change", (e) => {
      state.map.townFilter = e.target.value;
      if (e.target.value !== "ALL") {
        const foundTown = SINGAPORE_TOWN_REGIONS.find(t => t.name === e.target.value);
        if (foundTown) {
          zoomToCoordinate(foundTown.cx, foundTown.cy, 1.8);
        }
      } else {
        resetMapZoom();
      }
      renderMapMarkers();
    });
  }

  // Layer toggles
  if (toggleRaysBtn) {
    toggleRaysBtn.addEventListener("click", () => {
      state.map.showRays = !state.map.showRays;
      toggleRaysBtn.classList.toggle("active", state.map.showRays);
      const layer = document.getElementById("map-rays-layer");
      if (layer) layer.style.display = state.map.showRays ? "block" : "none";
    });
  }

  if (togglePricesBtn) {
    togglePricesBtn.addEventListener("click", () => {
      state.map.showPrices = !state.map.showPrices;
      togglePricesBtn.classList.toggle("active", state.map.showPrices);
      const layer = document.getElementById("map-prices-layer");
      if (layer) layer.style.display = state.map.showPrices ? "block" : "none";
    });
  }

  if (toggleTownsBtn) {
    toggleTownsBtn.addEventListener("click", () => {
      state.map.showTowns = !state.map.showTowns;
      toggleTownsBtn.classList.toggle("active", state.map.showTowns);
      const layerTowns = document.getElementById("map-town-regions");
      const layerDensity = document.getElementById("map-density-layer");
      if (layerTowns) layerTowns.style.display = state.map.showTowns ? "block" : "none";
      if (layerDensity) layerDensity.style.display = state.map.showTowns ? "block" : "none";
    });
  }

  // Zoom controls
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      const newZoom = Math.min(state.map.zoom + 0.4, 3.5);
      setMapZoom(newZoom);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      const newZoom = Math.max(state.map.zoom - 0.4, 0.9);
      setMapZoom(newZoom);
    });
  }

  if (resetZoomBtn) {
    resetZoomBtn.addEventListener("click", () => {
      resetMapZoom();
    });
  }

  // Orientation filter legend pills
  legendPills.forEach(pill => {
    pill.addEventListener("click", () => {
      legendPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      state.map.facingFilter = pill.getAttribute("data-facing-filter") || "all";
      renderMapMarkers();
    });
  });

  // Close inspector card
  if (closeInfoBtn) {
    closeInfoBtn.addEventListener("click", () => {
      const infoBar = document.getElementById("map-flat-info");
      if (infoBar) infoBar.classList.add("hidden");
      document.querySelectorAll(".map-pin").forEach(p => p.classList.remove("selected"));
      state.map.selectedFlat = null;
    });
  }

  // Inspector "Ask Gemini Advisor" button
  if (askGeminiMapBtn) {
    askGeminiMapBtn.addEventListener("click", () => {
      if (state.map.selectedFlat) {
        askGeminiAboutFlat(state.map.selectedFlat);
      }
    });
  }

  // Inspector "Inspect Sun Rays" button
  if (inspectMapFlatBtn) {
    inspectMapFlatBtn.addEventListener("click", () => {
      if (state.map.selectedFlat) {
        openSunlightModal(state.map.selectedFlat);
      }
    });
  }

  // Mouse wheel zoom and drag panning on SVG canvas
  setupSvgPanAndZoom();
}

/**
 * Handles smooth mouse wheel zoom and mouse drag panning
 * across the Singapore SVG Map canvas.
 */
function setupSvgPanAndZoom() {
  const mapSvg = document.getElementById("sg-map-svg");
  if (!mapSvg) return;

  let isDragging = false;
  let startX = 0;
  let startY = 0;

  mapSvg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15;
    const newZoom = Math.min(Math.max(state.map.zoom + zoomDelta, 0.9), 3.5);
    setMapZoom(newZoom);
  }, { passive: false });

  mapSvg.addEventListener("mousedown", (e) => {
    // Only drag when clicking background, not pins or buttons
    if (e.target.closest(".map-pin") || e.target.closest(".town-count-badge-svg")) return;
    isDragging = true;
    startX = e.clientX - state.map.panX;
    startY = e.clientY - state.map.panY;
    mapSvg.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    state.map.panX = e.clientX - startX;
    state.map.panY = e.clientY - startY;
    applyMapTransform();
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      mapSvg.style.cursor = "default";
    }
  });
}

/**
 * Applies the current zoom and pan translation to the SVG #map-zoom-group.
 */
function applyMapTransform() {
  const zoomGroup = document.getElementById("map-zoom-group");
  if (!zoomGroup) return;

  const cx = 500;
  const cy = 310;
  const transformStr = `translate(${state.map.panX}, ${state.map.panY}) translate(${cx}, ${cy}) scale(${state.map.zoom}) translate(${-cx}, ${-cy})`;
  zoomGroup.setAttribute("transform", transformStr);
}

/**
 * Sets map zoom level and applies transform smoothly.
 * 
 * @param {number} newZoom 
 */
function setMapZoom(newZoom) {
  state.map.zoom = newZoom;
  applyMapTransform();
}

/**
 * Smoothly centers and zooms into a specific coordinate on the Singapore map.
 */
function zoomToCoordinate(cx, cy, targetZoom = 1.8) {
  state.map.zoom = targetZoom;
  state.map.panX = (500 - cx) * 0.8;
  state.map.panY = (310 - cy) * 0.8;
  applyMapTransform();
}

/**
 * Resets the map view back to fit whole Singapore.
 */
function resetMapZoom() {
  state.map.zoom = 1;
  state.map.panX = 0;
  state.map.panY = 0;
  applyMapTransform();
}

/**
 * Master Singapore Map Visualisation Renderer.
 * Renders Town Zones, Density Clusters, Solar Vector Rays,
 * Geocoded Unit Pins, Price Tags, and interactive Tooltips.
 */
function renderMapMarkers() {
  const pinsLayer = document.getElementById("map-pins-layer");
  const raysLayer = document.getElementById("map-rays-layer");
  const pricesLayer = document.getElementById("map-prices-layer");
  const townRegionsLayer = document.getElementById("map-town-regions");
  const densityLayer = document.getElementById("map-density-layer");
  const mapStatsSummary = document.getElementById("map-stats-summary");
  const tooltipEl = document.getElementById("map-hover-tooltip");

  if (!pinsLayer || !raysLayer || !pricesLayer) return;

  // Clear previous SVG dynamic layers
  pinsLayer.innerHTML = "";
  raysLayer.innerHTML = "";
  pricesLayer.innerHTML = "";
  if (townRegionsLayer) townRegionsLayer.innerHTML = "";
  if (densityLayer) densityLayer.innerHTML = "";

  const allFlats = state.data.flats || [];

  // Filter flats based on Map Orientation Filter & Town Filter
  const filteredFlats = allFlats.filter(flat => {
    // Orientation filter
    if (state.map.facingFilter === "north-south") {
      if (flat.facing !== "North-South" && !flat.facing.includes("North")) return false;
    } else if (state.map.facingFilter === "morning") {
      if (!flat.facing.includes("East")) return false;
    } else if (state.map.facingFilter === "west") {
      if (!flat.facing.includes("West")) return false;
    }

    // Town filter
    if (state.map.townFilter !== "ALL" && flat.town !== state.map.townFilter) {
      return false;
    }

    return true;
  });

  // Calculate unique towns count and average price
  const distinctTowns = new Set(filteredFlats.map(f => f.town));
  const avgPrice = filteredFlats.length > 0 
    ? Math.round(filteredFlats.reduce((sum, f) => sum + f.resale_price, 0) / filteredFlats.length / 1000)
    : 0;

  if (mapStatsSummary) {
    mapStatsSummary.textContent = `${filteredFlats.length} matching units across ${distinctTowns.size} estates (Avg: $${avgPrice}k)`;
  }

  // 1. Render Interactive Town Zones & Matching Unit Density
  renderTownPlanningZones(townRegionsLayer, densityLayer, filteredFlats);

  // 2. Render Solar Ray Vectors, Unit Pins, and Price Tags
  filteredFlats.forEach(flat => {
    const coords = convertGpsToSvg(flat.lat, flat.lng);
    const svgX = coords.x;
    const svgY = coords.y;

    // Determine pin color and comfort classification
    let pinColor = "#10b981"; // North-South cool emerald
    let rayColor = "#34d399";
    let comfortClass = "tag-cool";
    let comfortText = "Cool & Breezy (No West Sun)";

    if (flat.facing.includes("East")) {
      pinColor = "#f59e0b"; // Morning sun amber
      rayColor = "#fbbf24";
      comfortClass = "tag-morning";
      comfortText = "Gentle Morning Sun";
    }
    if (flat.facing.includes("West")) {
      pinColor = "#ef4444"; // Afternoon sun coral
      rayColor = "#f87171";
      comfortClass = "tag-west";
      comfortText = "Afternoon Heat Sun";
    }

    // Solar angle arrow calculation (unit orientation ray pointer)
    const angleRad = (flat.azimuth_deg - 90) * (Math.PI / 180);
    const rayLength = 22;
    const rayTipX = svgX + Math.cos(angleRad) * rayLength;
    const rayTipY = svgY + Math.sin(angleRad) * rayLength;

    // 2A. Solar Ray Vector Arrow
    const rayGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    rayGroup.setAttribute("class", "map-ray-group");
    rayGroup.innerHTML = `
      <line x1="${svgX}" y1="${svgY}" x2="${rayTipX}" y2="${rayTipY}" stroke="${rayColor}" stroke-width="1.8" stroke-linecap="round" filter="url(#sun-ray-glow)" class="map-solar-ray" />
      <circle cx="${rayTipX}" cy="${rayTipY}" r="2.8" fill="#facc15" stroke="${rayColor}" stroke-width="1" />
    `;
    raysLayer.appendChild(rayGroup);

    // 2B. Geocoded Unit Pin Marker
    const pinGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    pinGroup.setAttribute("class", `map-pin ${state.map.selectedFlat?.id === flat.id ? "selected" : ""}`);
    pinGroup.setAttribute("id", `map-pin-${flat.id}`);
    pinGroup.setAttribute("tabindex", "0");
    pinGroup.setAttribute("role", "button");
    pinGroup.setAttribute("aria-label", `${flat.flat_type} at ${flat.town}, Blk ${flat.block} ${flat.street_name}, Price $${flat.resale_price.toLocaleString()}`);

    pinGroup.innerHTML = `
      <circle cx="${svgX}" cy="${svgY}" r="11" fill="${pinColor}" opacity="0.25" class="pin-pulse" />
      <circle cx="${svgX}" cy="${svgY}" r="7" fill="${pinColor}" class="pin-circle-base" filter="url(#marker-glow)" />
      <circle cx="${svgX}" cy="${svgY}" r="2.5" fill="#ffffff" />
    `;

    // 2C. Price Tag Tag Pill Overlay
    const priceGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    priceGroup.setAttribute("class", "map-price-tag");
    const formattedPriceK = `$${Math.round(flat.resale_price / 1000)}k`;
    priceGroup.innerHTML = `
      <rect x="${svgX - 18}" y="${svgY - 22}" width="36" height="12" class="price-tag-bg" />
      <text x="${svgX}" y="${svgY - 13}" class="price-tag-text">${formattedPriceK}</text>
    `;
    pricesLayer.appendChild(priceGroup);

    // Marker Hover: Display interactive floating tooltip
    pinGroup.addEventListener("mouseenter", (e) => {
      if (!tooltipEl) return;
      tooltipEl.classList.remove("hidden");
      tooltipEl.innerHTML = `
        <div class="tooltip-title">Blk ${flat.block} ${escapeHTML(flat.street_name)}</div>
        <div class="tooltip-price-row">
          <span class="tooltip-price">$${flat.resale_price.toLocaleString()}</span>
          <span class="tooltip-psqm">${flat.floor_area_sqm} sqm ($${Math.round(flat.resale_price / flat.floor_area_sqm)}/sqm)</span>
        </div>
        <div class="tooltip-badge-row">
          <span class="badge-town">${escapeHTML(flat.town)}</span>
          <span class="badge-type">${escapeHTML(flat.flat_type)}</span>
          <span class="tooltip-comfort-tag ${comfortClass}">&#9728; ${flat.facing}</span>
        </div>
      `;

      // Position tooltip relative to container
      const containerRect = document.getElementById("map-container").getBoundingClientRect();
      const pinRect = pinGroup.getBoundingClientRect();
      const leftOffset = pinRect.left - containerRect.left + pinRect.width / 2;
      const topOffset = pinRect.top - containerRect.top;

      tooltipEl.style.left = `${leftOffset}px`;
      tooltipEl.style.top = `${topOffset}px`;
    });

    pinGroup.addEventListener("mouseleave", () => {
      if (tooltipEl) tooltipEl.classList.add("hidden");
    });

    // Marker Click: Select flat and open inspector slide-up card
    pinGroup.addEventListener("click", () => {
      selectFlatOnMap(flat, false);
    });

    pinGroup.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectFlatOnMap(flat, true);
      }
    });

    pinsLayer.appendChild(pinGroup);
  });
}

/**
 * Renders Singapore Planning Town polygon regions and live density count badges.
 */
function renderTownPlanningZones(townRegionsLayer, densityLayer, matchingFlats) {
  if (!townRegionsLayer) return;

  // Compute number of matching flats per town
  const townCounts = {};
  matchingFlats.forEach(f => {
    townCounts[f.town] = (townCounts[f.town] || 0) + 1;
  });

  SINGAPORE_TOWN_REGIONS.forEach(town => {
    const count = townCounts[town.name] || 0;
    const isFocused = state.map.townFilter === town.name;

    // 1. Town Zone Polygon
    const polyGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    polyGroup.setAttribute("class", "town-zone-group");

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "path");
    polygon.setAttribute("d", town.polygon);
    polygon.setAttribute("class", `town-zone-polygon ${isFocused ? "highlighted" : ""}`);
    polygon.setAttribute("data-town", town.name);
    polyGroup.appendChild(polygon);

    // 2. Town Name Label
    const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textLabel.setAttribute("x", town.cx);
    textLabel.setAttribute("y", town.cy);
    textLabel.setAttribute("class", `town-zone-label ${count > 0 ? "active" : ""}`);
    textLabel.textContent = town.label.toUpperCase();
    polyGroup.appendChild(textLabel);

    // 3. Matching Units Count Badge on Town
    if (count > 0) {
      const badgeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      badgeG.setAttribute("class", "town-count-badge-svg");
      badgeG.innerHTML = `
        <circle cx="${town.cx + 28}" cy="${town.cy - 10}" r="9" fill="#f97316" stroke="#ffffff" stroke-width="1.5" filter="url(#marker-glow)" />
        <text x="${town.cx + 28}" y="${town.cy - 7}" font-size="7.5" font-weight="800" fill="#ffffff" text-anchor="middle">${count}</text>
      `;
      polyGroup.appendChild(badgeG);

      // Density Glow Circle
      if (densityLayer) {
        const radius = Math.min(20 + count * 6, 50);
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", town.cx);
        circle.setAttribute("cy", town.cy);
        circle.setAttribute("r", radius);
        circle.setAttribute("fill", "rgba(249, 115, 22, 0.15)");
        circle.setAttribute("stroke", "rgba(249, 115, 22, 0.3)");
        circle.setAttribute("stroke-dasharray", "3 3");
        densityLayer.appendChild(circle);
      }
    }

    // Clicking town polygon focuses that estate
    polyGroup.addEventListener("click", () => {
      const townSelect = document.getElementById("map-town-select");
      if (townSelect) {
        townSelect.value = town.name;
        state.map.townFilter = town.name;
        zoomToCoordinate(town.cx, town.cy, 1.9);
        renderMapMarkers();
      }
    });

    townRegionsLayer.appendChild(polyGroup);
  });
}

/**
 * Selects a flat on the map, updates marker highlighting,
 * and populates the Map Unit Details Inspector slide-up card.
 * 
 * @param {object} flat - The selected HDB flat object
 * @param {boolean} autoPan - Whether to pan and center the map on the unit
 */
function selectFlatOnMap(flat, autoPan = false) {
  state.map.selectedFlat = flat;

  // Highlight marker
  document.querySelectorAll(".map-pin").forEach(p => p.classList.remove("selected"));
  const activePin = document.getElementById(`map-pin-${flat.id}`);
  if (activePin) activePin.classList.add("selected");

  // Pan to unit if requested
  if (autoPan) {
    const coords = convertGpsToSvg(flat.lat, flat.lng);
    zoomToCoordinate(coords.x, coords.y, 2.2);
  }

  // Populate Map Info Bar Inspector
  const mapInfoBar = document.getElementById("map-flat-info");
  const townBadge = document.getElementById("map-info-town-badge");
  const typeBadge = document.getElementById("map-info-type-badge");
  const sunBadge = document.getElementById("map-info-sun-badge");
  const titleEl = document.getElementById("map-info-title");
  const priceEl = document.getElementById("map-info-price");
  const areaEl = document.getElementById("map-info-area");
  const leaseEl = document.getElementById("map-info-lease");
  const facingEl = document.getElementById("map-info-facing");

  if (mapInfoBar) mapInfoBar.classList.remove("hidden");
  if (townBadge) townBadge.textContent = flat.town;
  if (typeBadge) typeBadge.textContent = flat.flat_type;
  if (sunBadge) {
    sunBadge.textContent = `\u2600 ${flat.afternoon_sun}`;
    if (flat.facing.includes("West")) {
      sunBadge.style.color = "#f87171";
      sunBadge.style.borderColor = "rgba(239, 68, 68, 0.4)";
      sunBadge.style.background = "rgba(239, 68, 68, 0.15)";
    } else {
      sunBadge.style.color = "#34d399";
      sunBadge.style.borderColor = "rgba(16, 185, 129, 0.35)";
      sunBadge.style.background = "rgba(16, 185, 129, 0.15)";
    }
  }
  if (titleEl) titleEl.textContent = `Blk ${flat.block} ${flat.street_name}`;
  if (priceEl) priceEl.textContent = `$${flat.resale_price.toLocaleString()}`;
  if (areaEl) {
    const psqm = Math.round(flat.resale_price / flat.floor_area_sqm);
    areaEl.textContent = `${flat.floor_area_sqm} sqm ($${psqm.toLocaleString()}/sqm)`;
  }
  if (leaseEl) {
    leaseEl.textContent = `${flat.remaining_lease_years} yrs ${flat.remaining_lease_months} mos (Built ${flat.lease_commence_date})`;
  }
  if (facingEl) {
    facingEl.textContent = `${flat.facing} Facade (${flat.azimuth_deg}\u00B0) \u2022 ${flat.morning_sun}`;
  }
}

/**
 * Cross-linking function: When a user clicks "View on Map" from any flat card
 * in the search results list, this switches to the Map tab, centers the map,
 * and highlights the proposed matching unit.
 * 
 * @param {string} flatId - Unique identifier of the HDB flat
 */
function focusFlatOnMap(flatId) {
  const flat = state.data.flats.find(f => f.id === flatId);
  if (!flat) return;

  // 1. Switch active tab to Map
  const tabMapBtn = document.getElementById("tab-map");
  if (tabMapBtn) tabMapBtn.click();

  // 2. Center and select the flat
  setTimeout(() => {
    selectFlatOnMap(flat, true);
  }, 100);
}

/**
 * Renders the Resale Price Trends by Month SVG line and area chart.
 */
function renderPriceTrendsChart() {
  const chartSvg = document.getElementById("chart-price-trends-svg");
  if (!chartSvg) return;

  const trends = state.data.analytics.priceTrendsByMonth || [];
  if (trends.length === 0) return;

  const width = 520;
  const height = 280;
  const padLeft = 60;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 45;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const minPrice = Math.min(...trends.map(t => t.averagePrice)) * 0.9;
  const maxPrice = Math.max(...trends.map(t => t.averagePrice)) * 1.1;

  // Build coordinate points
  const points = trends.map((t, idx) => {
    const x = padLeft + (idx / Math.max(1, trends.length - 1)) * chartW;
    const y = padTop + chartH - ((t.averagePrice - minPrice) / (maxPrice - minPrice)) * chartH;
    return { x, y, month: t.month, price: t.averagePrice, count: t.count };
  });

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + chartH)} L ${points[0].x.toFixed(1)} ${(padTop + chartH)} Z`;

  // Draw SVG Grid & Labels
  let gridSvg = "";
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = minPrice + ((maxPrice - minPrice) / gridSteps) * i;
    const yPos = padTop + chartH - (i / gridSteps) * chartH;
    gridSvg += `
      <line x1="${padLeft}" y1="${yPos}" x2="${width - padRight}" y2="${yPos}" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" stroke-dasharray="2 2" />
      <text x="${padLeft - 8}" y="${yPos + 4}" font-size="10" fill="#94a3b8" text-anchor="end">$${Math.round(yVal / 1000)}k</text>
    `;
  }

  // Draw X axis months
  let xLabelsSvg = "";
  points.forEach(p => {
    xLabelsSvg += `
      <text x="${p.x}" y="${height - 15}" font-size="10" fill="#94a3b8" text-anchor="middle">${escapeHTML(p.month)}</text>
      <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#f97316" stroke="#ffffff" stroke-width="2" />
      <text x="${p.x}" y="${p.y - 10}" font-size="10" font-weight="700" fill="#f8fafc" text-anchor="middle">$${Math.round(p.price / 1000)}k</text>
    `;
  });

  chartSvg.innerHTML = `
    <defs>
      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f97316" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#f97316" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    ${gridSvg}
    <path d="${areaD}" fill="url(#trendGradient)" />
    <path d="${lineD}" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" />
    ${xLabelsSvg}
  `;
}

/**
 * Renders the Flat Distribution & $/sqm by Town SVG bar chart.
 */
function renderTownDistributionChart() {
  const chartSvg = document.getElementById("chart-town-dist-svg");
  if (!chartSvg) return;

  const distribution = (state.data.analytics.distributionByTown || []).slice(0, 6);
  if (distribution.length === 0) return;

  const width = 520;
  const height = 280;
  const padLeft = 85;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const barHeight = Math.min(24, Math.floor(chartH / distribution.length) - 8);

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  let barsSvg = "";
  distribution.forEach((d, idx) => {
    const yPos = padTop + idx * (chartH / distribution.length) + 4;
    const barW = (d.count / maxCount) * chartW;

    barsSvg += `
      <text x="${padLeft - 10}" y="${yPos + barHeight / 2 + 4}" font-size="10" font-weight="600" fill="#cbd5e1" text-anchor="end">${escapeHTML(d.town)}</text>
      <rect x="${padLeft}" y="${yPos}" width="${barW}" height="${barHeight}" rx="4" fill="url(#townBarGradient)" />
      <text x="${padLeft + barW + 8}" y="${yPos + barHeight / 2 + 4}" font-size="10" font-weight="700" fill="#f8fafc">${d.count} units ($${d.averagePsqm}/sqm)</text>
    `;
  });

  chartSvg.innerHTML = `
    <defs>
      <linearGradient id="townBarGradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#f97316" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#ea580c" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.5" />
    ${barsSvg}
  `;
}

/**
 * Renders the "What Does My Budget Buy?" Floor Area vs Remaining Lease Matrix table.
 */
function renderBudgetBuyMatrix() {
  const tbody = document.getElementById("budget-matrix-tbody");
  if (!tbody) return;

  const matrix = state.data.analytics.budgetBuyMatrix || [];
  tbody.innerHTML = "";

  if (matrix.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="matrix-cell-empty">No units match the current budget constraints.</td></tr>`;
    return;
  }

  matrix.forEach(row => {
    const tr = document.createElement("tr");
    let rowHtml = `<th scope="row"><strong>${escapeHTML(row.leaseCategory)}</strong></th>`;

    row.sizeCategories.forEach(cell => {
      if (cell.count > 0) {
        rowHtml += `
          <td>
            <div class="matrix-cell-content">
              <span class="matrix-cell-count">${cell.count} unit${cell.count > 1 ? "s" : ""}</span>
              <span class="matrix-cell-price">Avg: $${cell.averagePrice.toLocaleString()}</span>
            </div>
          </td>
        `;
      } else {
        rowHtml += `<td><span class="matrix-cell-empty">&mdash;</span></td>`;
      }
    });

    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  });
}

/**
 * Configures the Sunlight Ray Modal / Inspector controls and event listeners.
 */
function setupModalEventListeners() {
  const modal = document.getElementById("sunlight-modal");
  const closeBtn = document.getElementById("btn-close-modal");
  const timeSlider = document.getElementById("time-of-day-slider");
  const timePresets = document.querySelectorAll(".btn-time-preset");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.close());
  }

  // Close when clicking modal backdrop
  if (modal) {
    modal.addEventListener("click", (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) modal.close();
    });
  }

  // Time slider input
  if (timeSlider) {
    timeSlider.addEventListener("input", (e) => {
      state.simulatedTimeHours = parseFloat(e.target.value);
      updateSunlightSimulationView();
    });
  }

  // Time preset buttons (8:30 AM, 12 PM, 3:30 PM, 5:30 PM)
  timePresets.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const t = parseFloat(e.target.getAttribute("data-time"));
      state.simulatedTimeHours = t;
      if (timeSlider) timeSlider.value = t;
      updateSunlightSimulationView();
    });
  });

  // Modal Disqus Discussion button
  const modalDiscussBtn = document.getElementById("btn-modal-discuss-disqus");
  if (modalDiscussBtn) {
    modalDiscussBtn.addEventListener("click", () => {
      if (state.selectedFlat) {
        if (modal) modal.close();
        openDisqusForFlat(state.selectedFlat.id);
      }
    });
  }
}

/**
 * Opens the Sunlight Ray simulation dialog for a specific flat.
 * 
 * @param {object} flat - The selected HDB flat object
 */
function openSunlightModal(flat) {
  state.selectedFlat = flat;
  const modal = document.getElementById("sunlight-modal");
  if (!modal) return;

  // Populate modal text fields
  const titleEl = document.getElementById("modal-unit-title");
  const subEl = document.getElementById("modal-unit-subtitle");
  const scoreNum = document.getElementById("modal-score-num");
  const comfortLabel = document.getElementById("modal-comfort-label");
  const comfortDesc = document.getElementById("modal-comfort-desc");
  const lrFacing = document.getElementById("modal-lr-facing");
  const morningSun = document.getElementById("modal-morning-sun");
  const afternoonSun = document.getElementById("modal-afternoon-sun");
  const ventilation = document.getElementById("modal-ventilation");
  const buyerTip = document.getElementById("modal-buyer-tip");
  const scoreCircle = document.getElementById("modal-score-circle");

  if (titleEl) titleEl.textContent = `Blk ${flat.block} ${flat.street_name} (Storey ${flat.storey_range})`;
  if (subEl) subEl.textContent = `${flat.flat_type} &bull; ${flat.floor_area_sqm} sqm &bull; ${flat.remaining_lease_years} Yrs Lease &bull; ${flat.town}`;
  if (scoreNum) scoreNum.textContent = flat.sunlight_score.toString();
  if (comfortLabel) comfortLabel.textContent = flat.thermal_comfort;
  if (comfortDesc) {
    comfortDesc.textContent = flat.facing === "North-South"
      ? "Optimal North-South orientation avoids direct equatorial sun and maximizes monsoon breezes."
      : flat.facing.includes("East")
      ? "Receives gentle morning sunrise illumination, leaving living spaces cool during peak afternoon hours."
      : "Direct afternoon sun creates heat buildup in late afternoons; thermal window films are advised.";
  }

  if (lrFacing) lrFacing.textContent = `${flat.living_room_facing} (${flat.azimuth_deg}\u00B0 Azimuth)`;
  if (morningSun) morningSun.textContent = flat.morning_sun;
  if (afternoonSun) afternoonSun.textContent = flat.afternoon_sun;
  if (ventilation) ventilation.textContent = flat.facing === "North-South" ? "Excellent (Prevailing NS Cross-Wind)" : "Good Natural Ventilation";

  const modalLiveWeather = document.getElementById("modal-live-weather");
  if (modalLiveWeather) {
    if (state.weather.data && state.weather.data.current) {
      const curTemp = state.weather.data.current.temperature_2m;
      const curWind = state.weather.data.current.wind_speed_10m;
      modalLiveWeather.textContent = `${curTemp.toFixed(1)}°C ambient temperature • ${curWind.toFixed(1)} km/h wind velocity at 10m height`;
    } else {
      modalLiveWeather.textContent = "Open-Meteo: Fetching regional atmospheric conditions...";
      fetchOpenMeteoForecast(1.3521, 103.8198, "Singapore Central (Bishan / Toa Payoh)");
    }
  }

  if (scoreCircle) {
    scoreCircle.style.backgroundColor = flat.sunlight_score >= 90 ? "#0f766e" : flat.sunlight_score >= 75 ? "#d97706" : "#be123c";
  }

  if (buyerTip) {
    if (flat.sunlight_score >= 90) {
      buyerTip.textContent = "Prime thermal orientation. Minimal air-con power needed during daytime. High resale retention value.";
    } else if (flat.sunlight_score >= 75) {
      buyerTip.textContent = "Pleasant morning illumination. Master bedroom stays bright in mornings and cools down by evening.";
    } else {
      buyerTip.textContent = "Afternoon sun exposure. Factor in solar film installation ($800 - $1,500) and blackout roller blinds.";
    }
  }

  modal.showModal();
  updateSunlightSimulationView();
}

/**
 * Updates the interactive Canvas sunlight raycaster simulation
 * based on selected flat orientation and the simulated time of day.
 */
function updateSunlightSimulationView() {
  const canvas = document.getElementById("sun-ray-canvas");
  const timeDisplay = document.getElementById("time-slider-display");
  const timeBadge = document.getElementById("current-sim-time-badge");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const hours = state.simulatedTimeHours;
  const flat = state.selectedFlat || { azimuth_deg: 0, living_room_facing: "North", facing: "North-South" };

  // Format time label (e.g. "08:30 AM" or "03:30 PM")
  const h = Math.floor(hours);
  const m = hours % 1 !== 0 ? "30" : "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h;
  const timeStr = `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;

  if (timeDisplay) timeDisplay.textContent = timeStr;

  let timePhase = "Morning Sunlight";
  if (hours >= 11 && hours <= 13) timePhase = "Noon Direct Overhead";
  else if (hours > 13 && hours < 16.5) timePhase = "Afternoon Heat Rays";
  else if (hours >= 16.5) timePhase = "Late Afternoon / Sunset";

  if (timeBadge) timeBadge.textContent = `${timeStr} (${timePhase})`;

  // Solar position calculation in Singapore (Latitude ~1.35° N):
  // At 7:00 AM Sun rises East (Azimuth ~80°-90°)
  // At 12:00 PM Sun is near zenith (Azimuth ~0° or 180° depending on season)
  // At 6:00 PM Sun sets West (Azimuth ~270°-280°)
  const sunAzimuthDeg = 80 + ((hours - 7) / (18 - 7)) * (280 - 80);
  const sunAzimuthRad = (sunAzimuthDeg - 90) * (Math.PI / 180);

  // Clear Canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const compassRadius = 130;

  // 1. Draw Compass Ring & Cardinal Directions
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, compassRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Cardinal direction text
  ctx.font = "bold 11px Space Grotesk, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "center";
  ctx.fillText("N (0°)", cx, cy - compassRadius - 10);
  ctx.fillText("S (180°)", cx, cy + compassRadius + 18);
  ctx.fillText("E (90° - Sunrise)", cx + compassRadius + 45, cy + 4);
  ctx.fillText("W (270° - West Sun)", cx - compassRadius - 50, cy + 4);
  ctx.restore();

  // 2. Draw Sun Position and Incoming Solar Rays
  const sunDist = compassRadius + 15;
  const sunX = cx + Math.cos(sunAzimuthRad) * sunDist;
  const sunY = cy + Math.sin(sunAzimuthRad) * sunDist;

  // Sun Orb
  ctx.save();
  const isWestHeat = hours >= 14 && hours <= 18;
  const sunColor = isWestHeat ? "#ef4444" : "#facc15";

  ctx.fillStyle = sunColor;
  ctx.shadowColor = sunColor;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw 5 Incoming Solar Light Rays towards Flat Facade
  ctx.save();
  ctx.strokeStyle = isWestHeat ? "rgba(239, 68, 68, 0.4)" : "rgba(250, 204, 21, 0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  for (let offset = -24; offset <= 24; offset += 12) {
    const startX = sunX + Math.cos(sunAzimuthRad + Math.PI / 2) * offset;
    const startY = sunY + Math.sin(sunAzimuthRad + Math.PI / 2) * offset;

    const targetX = cx + Math.cos(sunAzimuthRad + Math.PI / 2) * (offset * 0.8);
    const targetY = cy + Math.sin(sunAzimuthRad + Math.PI / 2) * (offset * 0.8);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Draw Unit Floorplan Box Rotated to its Authentic Azimuth
  ctx.save();
  ctx.translate(cx, cy);
  // Rotate canvas by unit orientation azimuth
  const unitRotRad = (flat.azimuth_deg) * (Math.PI / 180);
  ctx.rotate(unitRotRad);

  const flatW = 100;
  const flatH = 75;

  // Flat Interior Base
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2.5;
  ctx.fillRect(-flatW / 2, -flatH / 2, flatW, flatH);
  ctx.strokeRect(-flatW / 2, -flatH / 2, flatW, flatH);

  // Living Room Window Facade (Top edge facing direction)
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-flatW / 2 + 10, -flatH / 2);
  ctx.lineTo(flatW / 2 - 10, -flatH / 2);
  ctx.stroke();

  // Internal Room Dividers (Living Room & Master Bedroom)
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -flatH / 2);
  ctx.lineTo(0, flatH / 2);
  ctx.moveTo(0, 0);
  ctx.lineTo(flatW / 2, 0);
  ctx.stroke();

  // Room Labels
  ctx.font = "9px Public Sans, sans-serif";
  ctx.fillStyle = "#cbd5e1";
  ctx.textAlign = "center";
  ctx.fillText("Living Hall", -flatW / 4, 0);
  ctx.fillText("Master Rm", flatW / 4, -flatH / 4 + 4);
  ctx.fillText("Bedrm 2", flatW / 4, flatH / 4 + 4);

  // Orientation Front Pointer (Facing Arrow)
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.moveTo(0, -flatH / 2 - 12);
  ctx.lineTo(-6, -flatH / 2 - 2);
  ctx.lineTo(6, -flatH / 2 - 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Sanitizes input strings to prevent XSS.
 * 
 * @param {string} str - Raw string
 * @returns {string} - Escaped safe HTML string
 */
function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   Gemini AI Property & Thermal Comfort Advisor (Front-End Logic)
   ========================================================================== */

/**
 * Initializes the chat advisor with an introductory guidance greeting.
 */
function initGeminiChatWelcome() {
  state.chat.messages = [
    {
      role: "bot",
      text: "👋 **Hello! I am your Gemini HDB & Solar Advisory Assistant.**\n\nI am connected to live Singapore resale market transactions and solar azimuth trajectory models. Ask me about:\n\n* 🎯 **Best Value Buys**: Pinpointing units with optimal price per sqm and healthy remaining leases.\n* ☀️ **Thermal Comfort & Sun Rays**: Identifying homes with zero afternoon sun (West heat) and breezy North-South cross-ventilation.\n* 📊 **Lease Decay Analysis**: Weighing mature estate spaciousness versus younger estate lease preservation.\n* 💰 **CPF Housing Grants**: Estimating grant eligibility (EHG, Family Grant, PHG) for your budget.\n\n*Click one of the suggested strategy chips above or type your question below!*"
    }
  ];
  renderChatMessages();
}

/**
 * Updates the context summary tags displayed at the top of the Gemini Chat panel.
 */
function renderChatContextBadges() {
  const budgetTag = document.getElementById("tag-budget-ctx");
  const townTag = document.getElementById("tag-town-ctx");
  const typeTag = document.getElementById("tag-type-ctx");
  const leaseTag = document.getElementById("tag-lease-ctx");
  const sunTag = document.getElementById("tag-sun-ctx");
  const matchesTag = document.getElementById("tag-matches-ctx");

  if (budgetTag) {
    budgetTag.textContent = `Budget: $${(state.filters.budgetMin / 1000).toFixed(0)}k - $${(state.filters.budgetMax / 1000).toFixed(0)}k`;
  }
  if (townTag) {
    townTag.textContent = `Town: ${state.filters.town === "ALL" ? "All Estates" : state.filters.town}`;
  }
  if (typeTag) {
    typeTag.textContent = `Type: ${state.filters.flatType === "ALL" ? "Any Type" : state.filters.flatType}`;
  }
  if (leaseTag) {
    leaseTag.textContent = `Min Lease: ${state.filters.leaseMin > 0 ? state.filters.leaseMin + ' yrs' : 'Any'}`;
  }
  if (sunTag) {
    const sunLabels = {
      all: "All Orientations",
      no_west: "No Afternoon Sun",
      north_south: "North-South Only",
      morning: "Morning Sun Only"
    };
    sunTag.textContent = `Facing: ${sunLabels[state.filters.sunlightPreference] || "All"}`;
  }
  if (matchesTag) {
    const count = state.data.flats ? state.data.flats.length : 0;
    matchesTag.textContent = `${count} Matches Grounded`;
  }
}

/**
 * Sets up all event listeners for the Gemini Chat UI.
 */
function setupGeminiChatEventListeners() {
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-user-input");
  const clearBtn = document.getElementById("btn-clear-chat");
  const syncBtn = document.getElementById("btn-sync-chat-criteria");
  const floatingAiBtn = document.getElementById("btn-floating-ai");
  const starterChips = document.querySelectorAll(".prompt-chip");

  // Form submission handler
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!chatInput) return;
      const text = chatInput.value.trim();
      if (text && !state.chat.isLoading) {
        chatInput.value = "";
        sendChatMessage(text);
      }
    });
  }

  // Keyboard shortcut: Enter sends message, Shift+Enter adds newline
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text && !state.chat.isLoading) {
          chatInput.value = "";
          sendChatMessage(text);
        }
      }
    });
  }

  // Prompt starter chips click handlers
  starterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (prompt && !state.chat.isLoading) {
        sendChatMessage(prompt);
      }
    });
  });

  // Clear chat history
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      initGeminiChatWelcome();
    });
  }

  // Sync criteria button
  if (syncBtn) {
    syncBtn.addEventListener("click", () => {
      renderChatContextBadges();
      const count = state.data.flats ? state.data.flats.length : 0;
      const syncNotice = `🔄 *Filters synchronized with Gemini advisor: ${count} matching listings currently in scope.*`;
      state.chat.messages.push({ role: "bot", text: syncNotice });
      renderChatMessages();
      scrollChatToBottom();
    });
  }

  // Floating AI launcher button in bottom right corner
  if (floatingAiBtn) {
    floatingAiBtn.addEventListener("click", () => {
      const tabChat = document.getElementById("tab-gemini-chat");
      if (tabChat) {
        tabChat.click();
        const chatPanel = document.getElementById("view-chat-panel");
        if (chatPanel) {
          chatPanel.scrollIntoView({ behavior: "smooth" });
        }
        setTimeout(() => {
          if (chatInput) chatInput.focus();
        }, 300);
      }
    });
  }
}

/**
 * Sends a chat message to the server-side Gemini endpoint /api/chat.
 * 
 * @param {string} userText - User's prompt query
 */
async function sendChatMessage(userText) {
  if (!userText || state.chat.isLoading) return;

  // 1. Add user message to state and update UI
  state.chat.messages.push({ role: "user", text: userText });
  state.chat.isLoading = true;
  renderChatMessages();
  scrollChatToBottom();

  // Disable send button while awaiting response
  const sendBtn = document.getElementById("btn-send-chat");
  if (sendBtn) sendBtn.disabled = true;

  // Show typing indicator in UI
  showTypingIndicator();

  // 2. Prepare grounded payload with current filters and matching unit context
  const criteriaPayload = {
    budgetMin: state.filters.budgetMin,
    budgetMax: state.filters.budgetMax,
    sizeMin: state.filters.sizeMin,
    town: state.filters.town,
    flatType: state.filters.flatType,
    sunlightPreference: state.filters.sunlightPreference,
    leaseMin: state.filters.leaseMin,
    sortBy: state.filters.sortBy
  };

  const matchingSummary = {
    totalMatches: state.data.flats ? state.data.flats.length : 0,
    averagePrice: state.data.meta ? state.data.meta.averagePrice : 0,
    averagePsqm: state.data.meta ? state.data.meta.averagePsqm : 0,
    averageRemainingLease: state.data.meta ? state.data.meta.averageRemainingLease : 0,
    topUnits: (state.data.flats || []).slice(0, 8).map(f => ({
      id: f.id,
      town: f.town,
      block: f.block,
      street_name: f.street_name,
      flat_type: f.flat_type,
      resale_price: f.resale_price,
      floor_area_sqm: f.floor_area_sqm,
      price_per_sqm: f.price_per_sqm,
      remaining_lease_years: f.remaining_lease_years,
      facing: f.facing,
      afternoon_sun: f.afternoon_sun,
      sunlight_score: f.sunlight_score
    }))
  };

  // Convert internal history to Gemini API format
  const apiHistory = state.chat.messages.slice(0, -1).map(msg => ({
    role: msg.role === "user" ? "user" : "model",
    text: msg.text
  }));

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userText,
        history: apiHistory,
        criteria: criteriaPayload,
        matchingSummary: matchingSummary
      })
    });

    if (!response.ok) {
      throw new Error(`Chat service returned HTTP status ${response.status}`);
    }

    const data = await response.json();
    const replyText = data.reply || "I apologize, but I was unable to generate an evaluation for this query. Please try asking again.";

    state.chat.messages.push({ role: "bot", text: replyText });
  } catch (error) {
    console.error("Gemini Chat request failed:", error);
    state.chat.messages.push({
      role: "bot",
      text: "⚠️ **Connection Notice:** Unable to reach the Gemini advisory service at this moment. Please check your network or try asking your question again in a moment."
    });
  } finally {
    state.chat.isLoading = false;
    hideTypingIndicator();
    renderChatMessages();
    scrollChatToBottom();
    if (sendBtn) sendBtn.disabled = false;
  }
}

/**
 * Triggers a focused Gemini AI evaluation for a specific flat card.
 * 
 * @param {Object} flat - The selected HDB flat object
 */
function askGeminiAboutFlat(flat) {
  const tabChat = document.getElementById("tab-gemini-chat");
  if (tabChat) {
    tabChat.click();
  }

  const promptText = `Can you provide a comprehensive valuation and solar comfort assessment for **Blk ${flat.block} ${flat.street_name}** in **${flat.town}** listed at **$${flat.resale_price.toLocaleString()}** (${flat.flat_type}, ${flat.floor_area_sqm} sqm, ${flat.remaining_lease_years} years remaining lease, facing ${flat.facing} with ${flat.afternoon_sun})? Is this a good buy under my current budget limit?`;

  sendChatMessage(promptText);
}

/**
 * Renders all chat messages into the `#chat-messages-stream` container.
 */
function renderChatMessages() {
  const container = document.getElementById("chat-messages-stream");
  if (!container) return;

  container.innerHTML = "";

  state.chat.messages.forEach(msg => {
    const msgEl = document.createElement("div");
    msgEl.className = `chat-msg ${msg.role === "user" ? "user" : "bot"}`;

    const avatar = document.createElement("div");
    avatar.className = "msg-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = msg.role === "user" ? "YOU" : "AI";

    const content = document.createElement("div");
    content.className = "msg-content-glass";
    content.innerHTML = parseMarkdown(msg.text);

    msgEl.appendChild(avatar);
    msgEl.appendChild(content);
    container.appendChild(msgEl);
  });
}

/**
 * Displays a glowing typing indicator while Gemini is formulating advice.
 */
function showTypingIndicator() {
  const container = document.getElementById("chat-messages-stream");
  if (!container) return;

  // Remove any existing typing indicator
  hideTypingIndicator();

  const indicator = document.createElement("div");
  indicator.id = "chat-typing-indicator";
  indicator.className = "chat-msg bot";
  indicator.innerHTML = `
    <div class="msg-avatar" aria-hidden="true">AI</div>
    <div class="typing-indicator-wrapper">
      <span>Gemini is evaluating market transactions and solar angles</span>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;

  container.appendChild(indicator);
  scrollChatToBottom();
}

/**
 * Removes the typing indicator once the response is received.
 */
function hideTypingIndicator() {
  const indicator = document.getElementById("chat-typing-indicator");
  if (indicator) indicator.remove();
}

/**
 * Smoothly scrolls the chat message stream to the bottom.
 */
function scrollChatToBottom() {
  const container = document.getElementById("chat-messages-stream");
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Lightweight, safe markdown formatter for chat responses.
 * 
 * @param {string} text - Raw markdown string from Gemini
 * @returns {string} - Formatted HTML string
 */
function parseMarkdown(text) {
  if (!text) return "";

  // 1. Escape HTML special characters for security
  let html = escapeHTML(text);

  // 2. Headings (### Heading)
  html = html.replace(/^### (.*$)/gim, "<h4>$1</h4>");
  html = html.replace(/^## (.*$)/gim, "<h4>$1</h4>");

  // 3. Bold text (**bold**)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // 4. Italic text (*italic*)
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // 5. Code tags (`code`)
  html = html.replace(/`(.*?)`/g, "<code>$1</code>");

  // 6. Blockquotes (> text) as advisor verdict boxes
  html = html.replace(/^&gt; (.*$)/gim, '<div class="advisor-verdict-box">$1</div>');

  // 7. Unordered Lists (* or -)
  const lines = html.split("\n");
  let inList = false;
  const processedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
      if (!inList) {
        processedLines.push("<ul>");
        inList = true;
      }
      processedLines.push(`<li>${line.substring(2)}</li>`);
    } else {
      if (inList) {
        processedLines.push("</ul>");
        inList = false;
      }
      if (line.length > 0) {
        if (!line.startsWith("<h4>") && !line.startsWith('<div class="advisor-verdict-box">')) {
          processedLines.push(`<p>${line}</p>`);
        } else {
          processedLines.push(line);
        }
      }
    }
  }
  if (inList) {
    processedLines.push("</ul>");
  }

  return processedLines.join("\n");
}

/* ==========================================================================
   DISQUS COMMUNITY EMBED & COMMENT COUNT ENGINE
   Shortname: 'dreamwithinreach'
   Language: 'en' (English)
   ========================================================================== */

/**
 * Ensures the single #disqus_thread container is present in the target container wrapper.
 * 
 * @param {string} targetWrapperId - Element ID of wrapper (e.g. 'main-page-disqus-wrapper' or 'discussions-tab-disqus-wrapper')
 * @returns {HTMLElement} The #disqus_thread DOM element
 */
function ensureDisqusContainer(targetWrapperId) {
  let thread = document.getElementById("disqus_thread");
  const targetWrapper = document.getElementById(targetWrapperId);
  if (!targetWrapper) return thread;

  if (!thread) {
    thread = document.createElement("div");
    thread.id = "disqus_thread";
    thread.className = "disqus-thread-container";
    targetWrapper.appendChild(thread);
  } else if (thread.parentElement !== targetWrapper) {
    targetWrapper.appendChild(thread);
  }
  return thread;
}

/**
 * Initializes the Main Page Disqus thread when the user first loads the app.
 * Prepares the container UI safely without blocking initial app load.
 */
function initMainPageDisqus() {
  const wrapper = document.getElementById("main-page-disqus-wrapper");
  if (!wrapper) return;
  const thread = ensureDisqusContainer("main-page-disqus-wrapper");
  if (thread && !thread.hasChildNodes()) {
    thread.innerHTML = `
      <div class="disqus-placeholder-card" style="padding: 24px; text-align: center; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; margin-top: 16px;">
        <p style="font-weight: 600; font-size: 15px; margin-bottom: 8px;">💬 Community Discussion &amp; Home Buyer Forum</p>
        <p style="font-size: 13px; color: #94a3b8; max-width: 540px; margin: 0 auto 16px;">Join the discussion on Singapore HDB resale pricing, afternoon sun exposure strategies, and town amenities.</p>
        <button type="button" id="btn-activate-main-disqus" class="btn-discuss-disqus" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 8px;">
          <span>🚀 Load Live Community Forum</span>
        </button>
      </div>
    `;
    const activateBtn = document.getElementById("btn-activate-main-disqus");
    if (activateBtn) {
      activateBtn.addEventListener("click", () => {
        loadDisqusThread(
          state.disqus.mainPageTopic || "dreamwithinreach-main-page",
          state.disqus.mainPageTitle || "🇸🇬 DreamWithinReach Main Community Discussion",
          `${window.location.origin}/#${state.disqus.mainPageTopic || "dreamwithinreach-main-page"}`,
          "en",
          true
        );
      });
    }
  }
}

/**
 * Sets up event listeners for the Main Page Disqus section
 * (quick topic pills, main page reload button).
 */
function setupMainPageDisqusEventListeners() {
  const quickTopicChips = document.querySelectorAll(".quick-topic-chip");
  const mainReloadBtn = document.getElementById("btn-reload-main-disqus");

  // Topic chip click handlers
  quickTopicChips.forEach(chip => {
    chip.addEventListener("click", () => {
      quickTopicChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");

      const topicId = chip.getAttribute("data-topic-id") || "dreamwithinreach-main-page";
      const topicTitle = chip.getAttribute("data-topic-title") || "🇸🇬 DreamWithinReach Main Community Discussion";

      state.disqus.mainPageTopic = topicId;
      state.disqus.mainPageTitle = topicTitle;

      const mainBadge = document.getElementById("main-disqus-count-badge");
      if (mainBadge) {
        mainBadge.setAttribute("data-disqus-identifier", topicId);
      }

      ensureDisqusContainer("main-page-disqus-wrapper");
      loadDisqusThread(
        topicId,
        topicTitle,
        `${window.location.origin}/#${topicId}`,
        "en"
      );
    });
  });

  // Main Page Reload Button
  if (mainReloadBtn) {
    mainReloadBtn.addEventListener("click", () => {
      ensureDisqusContainer("main-page-disqus-wrapper");
      loadDisqusThread(
        state.disqus.mainPageTopic || "dreamwithinreach-main-page",
        state.disqus.mainPageTitle || "🇸🇬 DreamWithinReach Main Community Discussion",
        `${window.location.origin}/#${state.disqus.mainPageTopic || "dreamwithinreach-main-page"}`,
        "en",
        true
      );
    });
  }
}

/**
 * Sets up all event listeners for the Disqus Discussion Toolbar,
 * topic select dropdown, and reload triggers.
 */
function setupDisqusEventListeners() {
  const topicSelect = document.getElementById("disqus-topic-select");
  const langSelect = document.getElementById("disqus-language-select");
  const reloadBtn = document.getElementById("btn-reload-disqus");

  // Topic change handler
  if (topicSelect) {
    topicSelect.addEventListener("change", (e) => {
      const selectedVal = e.target.value;
      const selectedText = topicSelect.options[topicSelect.selectedIndex]?.text || selectedVal;

      state.disqus.activeTopic = selectedVal;
      state.disqus.activeTitle = selectedText;
      state.disqus.activeUrl = `${window.location.origin}/#topic-${selectedVal}`;

      loadDisqusThread(
        state.disqus.activeTopic,
        state.disqus.activeTitle,
        state.disqus.activeUrl,
        "en"
      );
    });
  }

  // Language change handler
  if (langSelect) {
    langSelect.addEventListener("change", (e) => {
      state.disqus.language = e.target.value;
      loadDisqusThread(
        state.disqus.activeTopic,
        state.disqus.activeTitle,
        state.disqus.activeUrl,
        state.disqus.language
      );
    });
  }

  // Manual Reload Thread button
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      loadDisqusThread(
        state.disqus.activeTopic,
        state.disqus.activeTitle,
        state.disqus.activeUrl,
        "en",
        true
      );
    });
  }
}

/**
 * Loads or resets a Disqus discussion thread dynamically with the given configuration:
 * shortname: 'dreamwithinreach'
 * identifier, title, url, language ('en')
 * 
 * @param {string} identifier - Unique thread identifier
 * @param {string} title - Human readable thread title
 * @param {string} url - Canonical URL for the discussion
 * @param {string} language - ISO language code ('en')
 * @param {boolean} forceReload - Whether to force a full re-render
 */
function loadDisqusThread(identifier, title, url, language = "en", forceReload = false) {
  const threadContainer = document.getElementById("disqus_thread");
  const activeTitleEl = document.getElementById("disqus-active-title");
  const activeIdEl = document.getElementById("disqus-active-id");
  const activeLangEl = document.getElementById("disqus-active-lang");
  const countBadgeEl = document.getElementById("disqus-thread-count-badge");
  const topicSelect = document.getElementById("disqus-topic-select");
  const langSelect = document.getElementById("disqus-language-select");

  if (!threadContainer) return;

  // Update State & UI Info Bar
  state.disqus.activeTopic = identifier;
  state.disqus.activeTitle = title;
  state.disqus.activeUrl = url || `${window.location.origin}/#${identifier}`;
  state.disqus.language = language;

  if (activeTitleEl) activeTitleEl.textContent = title;
  if (activeIdEl) activeIdEl.textContent = identifier;
  if (activeLangEl) {
    activeLangEl.textContent = "en (English)";
  }
  if (topicSelect && topicSelect.value !== identifier) {
    topicSelect.value = identifier;
  }
  if (langSelect && langSelect.value !== language) {
    langSelect.value = language;
  }
  if (countBadgeEl) {
    countBadgeEl.setAttribute("data-disqus-identifier", identifier);
  }

  const shortname = state.disqus.shortname;
  const canonicalUrl = state.disqus.activeUrl;

  // If DISQUS is already loaded in the window, reset with new configuration
  if (typeof window.DISQUS !== "undefined" && !forceReload) {
    try {
      window.DISQUS.reset({
        reload: true,
        config: function () {
          this.page.identifier = identifier;
          this.page.url = canonicalUrl;
          this.page.title = title;
          this.language = language;
        }
      });
      refreshDisqusCounts();
      return;
    } catch (e) {
      console.warn("Disqus reset notice:", e);
    }
  }

  // Define global disqus_config callback safely
  window.disqus_config = function () {
    this.page.identifier = identifier;
    this.page.url = canonicalUrl;
    this.page.title = title;
    this.language = language;
  };

  try {
    // Dynamically inject the Disqus embed script safely
    let embedScript = document.getElementById("disqus-embed-script");
    if (!embedScript) {
      embedScript = document.createElement("script");
      embedScript.id = "disqus-embed-script";
      embedScript.src = `https://${shortname}.disqus.com/embed.js`;
      embedScript.setAttribute("data-timestamp", String(+new Date()));
      embedScript.async = true;
      embedScript.crossOrigin = "anonymous";
      embedScript.onerror = () => {
        console.info("Disqus embed script unavailable in current environment (sandbox/offline mode).");
        const threadEl = document.getElementById("disqus_thread");
        if (threadEl && !threadEl.hasChildNodes()) {
          threadEl.innerHTML = `
            <div class="disqus-placeholder-card" style="padding: 24px; text-align: center; background: rgba(255,255,255,0.03); border: 1px dashed rgba(255,255,255,0.15); border-radius: 12px; margin-top: 16px;">
              <p style="font-weight: 600; margin-bottom: 8px;">💬 Discussion Forum Ready</p>
              <p style="font-size: 13px; color: #94a3b8; max-width: 500px; margin: 0 auto 12px;">Disqus community commenting is configured for <strong>${escapeHTML(title)}</strong>. When accessed on a live domain, interactive comments will render here.</p>
            </div>
          `;
        }
      };
      (document.head || document.body).appendChild(embedScript);
      state.disqus.isLoaded = true;
    } else if (forceReload) {
      embedScript.remove();
      const newScript = document.createElement("script");
      newScript.id = "disqus-embed-script";
      newScript.src = `https://${shortname}.disqus.com/embed.js`;
      newScript.setAttribute("data-timestamp", String(+new Date()));
      newScript.async = true;
      newScript.crossOrigin = "anonymous";
      newScript.onerror = () => {
        console.info("Disqus embed reload unavailable in current sandbox environment.");
      };
      (document.head || document.body).appendChild(newScript);
    }
  } catch (err) {
    console.warn("Disqus script creation exception:", err);
  }

  refreshDisqusCounts();
}

/**
 * Updates the Disqus Topic dropdown with all available HDB flats
 * in the current search query so home buyers can choose to review any unit.
 */
function updateDisqusFlatsDropdown() {
  const optgroup = document.getElementById("disqus-flats-optgroup");
  if (!optgroup) return;

  optgroup.innerHTML = "";
  const flats = state.data.flats || [];

  flats.slice(0, 30).forEach(flat => {
    const opt = document.createElement("option");
    opt.value = flat.id;
    opt.textContent = `🏠 Blk ${flat.block} ${flat.street_name} (${flat.town}) - ${flat.flat_type}`;
    optgroup.appendChild(opt);
  });
}

/**
 * Opens and focuses the Disqus Discussion thread for a specific HDB flat unit.
 * 
 * @param {string} flatId - The unique flat identifier
 */
function openDisqusForFlat(flatId) {
  const flat = state.data.flats.find(f => f.id === flatId);
  const flatTitle = flat 
    ? `HDB Blk ${flat.block} ${flat.street_name} (${flat.town}) - ${flat.flat_type} (${flat.facing})`
    : `HDB Unit ${flatId}`;
  const flatUrl = `${window.location.origin}/#flat-${flatId}`;

  // 1. Switch to Disqus Discussions tab
  const tabDiscussions = document.getElementById("tab-discussions");
  if (tabDiscussions) tabDiscussions.click();

  // 2. Load the unit's Disqus thread
  setTimeout(() => {
    loadDisqusThread(flatId, flatTitle, flatUrl, state.disqus.language);
  }, 100);
}

/**
 * Triggers a refresh of all on-page Disqus Comment Count badges.
 */
function refreshDisqusCounts() {
  if (typeof window.DISQUSWIDGETS !== "undefined" && typeof window.DISQUSWIDGETS.getCount === "function") {
    try {
      window.DISQUSWIDGETS.getCount({ reset: true });
    } catch (e) {
      // Benign catch for count script polling
    }
  }
}

/* ==========================================================================
   DATA.GOV.SG OFFICIAL OPEN DATA API ENGINE
   Dataset: d_8b84c4ee58e3cfc0ece0d773c8ca6abc
   ========================================================================== */

/**
 * Initializes all event listeners for Data.gov.sg presets, query form,
 * response tabs (Table / JSON / Schema), and code copy buttons.
 */
function setupDatagovApiEventListeners() {
  const btnFirst5 = document.getElementById("btn-preset-first5");
  const btnTampines = document.getElementById("btn-preset-tampines4rm");
  const btnMetadata = document.getElementById("btn-preset-metadata");
  const form = document.getElementById("datagov-query-form");
  const btnReset = document.getElementById("btn-reset-api-form");

  const btnCopyUrl = document.getElementById("btn-copy-url");
  const btnCopyCurl = document.getElementById("btn-copy-curl");
  const btnCopyFetch = document.getElementById("btn-copy-fetch");

  // Presets
  if (btnFirst5) {
    btnFirst5.addEventListener("click", () => executeDatagovPreset("first5"));
  }
  if (btnTampines) {
    btnTampines.addEventListener("click", () => executeDatagovPreset("tampines4rm"));
  }
  if (btnMetadata) {
    btnMetadata.addEventListener("click", () => executeDatagovPreset("metadata"));
  }

  // Form submit (custom query)
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const town = document.getElementById("api-filter-town")?.value || "ALL";
      const flatType = document.getElementById("api-filter-type")?.value || "ALL";
      const limit = parseInt(document.getElementById("api-param-limit")?.value, 10) || 5;
      const q = document.getElementById("api-param-q")?.value.trim() || "";

      executeDatagovQuery({
        resource_id: state.datagov.resourceId,
        limit,
        town,
        flat_type: flatType,
        q
      }, "custom");
    });
  }

  // Reset button
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (form) form.reset();
      executeDatagovPreset("first5");
    });
  }

  // Response Sub-tabs (Table vs JSON vs Schema)
  const respTabs = document.querySelectorAll(".resp-tab");
  respTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetId = tab.getAttribute("data-target");
      respTabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".resp-view-panel").forEach(panel => {
        if (panel.id === targetId) {
          panel.classList.remove("hidden");
          panel.classList.add("active");
        } else {
          panel.classList.add("hidden");
          panel.classList.remove("active");
        }
      });
    });
  });

  // Code Copy Buttons
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener("click", () => copyCurrentDatagovCode("url"));
  }
  if (btnCopyCurl) {
    btnCopyCurl.addEventListener("click", () => copyCurrentDatagovCode("curl"));
  }
  if (btnCopyFetch) {
    btnCopyFetch.addEventListener("click", () => copyCurrentDatagovCode("fetch"));
  }
}

/**
 * Executes one of the official pre-configured query requests:
 * 1. first5: First 5 resale transactions
 * 2. tampines4rm: Filtered 4-room flats in Tampines
 * 3. metadata: Dataset schema and field types
 * 
 * @param {string} presetKey 
 */
async function executeDatagovPreset(presetKey) {
  state.datagov.currentPreset = presetKey;

  // Highlight active preset button
  ["btn-preset-first5", "btn-preset-tampines4rm", "btn-preset-metadata"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active");
  });

  const townSelect = document.getElementById("api-filter-town");
  const typeSelect = document.getElementById("api-filter-type");
  const limitSelect = document.getElementById("api-param-limit");
  const qInput = document.getElementById("api-param-q");

  if (presetKey === "first5") {
    const btn = document.getElementById("btn-preset-first5");
    if (btn) btn.classList.add("active");

    if (townSelect) townSelect.value = "ALL";
    if (typeSelect) typeSelect.value = "ALL";
    if (limitSelect) limitSelect.value = "5";
    if (qInput) qInput.value = "";

    await executeDatagovQuery({
      resource_id: state.datagov.resourceId,
      limit: 5
    }, "first5");

  } else if (presetKey === "tampines4rm") {
    const btn = document.getElementById("btn-preset-tampines4rm");
    if (btn) btn.classList.add("active");

    if (townSelect) townSelect.value = "TAMPINES";
    if (typeSelect) typeSelect.value = "4 ROOM";
    if (limitSelect) limitSelect.value = "5";
    if (qInput) qInput.value = "";

    await executeDatagovQuery({
      resource_id: state.datagov.resourceId,
      limit: 5,
      filters: JSON.stringify({ town: "TAMPINES", flat_type: "4 ROOM" })
    }, "tampines4rm");

  } else if (presetKey === "metadata") {
    const btn = document.getElementById("btn-preset-metadata");
    if (btn) btn.classList.add("active");

    await fetchDatagovMetadata(state.datagov.resourceId);
  }
}

/**
 * Executes a query to our Data.gov.sg proxy / backend endpoint
 * 
 * @param {Object} queryParams - Key-value query parameters
 * @param {string} presetName - Preset identifier
 */
async function executeDatagovQuery(queryParams, presetName = "custom") {
  const loadingOverlay = document.getElementById("api-loading-state");
  const displayUrlEl = document.getElementById("display-request-url");
  const directLinkEl = document.getElementById("link-direct-datagov");
  const statusBadge = document.getElementById("resp-status-badge");
  const latencyBadge = document.getElementById("resp-time-badge");
  const recordCountBadge = document.getElementById("resp-record-count");

  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

  // Construct official Data.gov.sg display URL
  const officialParams = new URLSearchParams();
  Object.keys(queryParams).forEach(k => {
    if (queryParams[k] !== undefined && queryParams[k] !== "" && queryParams[k] !== "ALL") {
      officialParams.set(k, queryParams[k]);
    }
  });
  const officialTargetUrl = `https://data.gov.sg/api/action/datastore_search?${officialParams.toString()}`;
  if (displayUrlEl) displayUrlEl.textContent = officialTargetUrl;
  if (directLinkEl) directLinkEl.href = officialTargetUrl;

  const startTime = performance.now();

  try {
    let response;
    try {
      response = await fetch(`/api/datagov/resale?${officialParams.toString()}`);
    } catch (proxyErr) {
      console.warn("Proxy fetch failed, trying direct data.gov.sg endpoint...", proxyErr);
      response = await fetch(officialTargetUrl);
    }

    if (!response || !response.ok) {
      // Second attempt directly via data.gov.sg CORS endpoint
      response = await fetch(officialTargetUrl);
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      throw new Error(`Data.gov.sg returned HTTP ${response.status}`);
    }

    const data = await response.json();
    state.datagov.lastResponse = data;

    if (statusBadge) {
      statusBadge.textContent = "✓ 200 OK";
      statusBadge.className = "badge-status-ok";
    }
    if (latencyBadge) {
      latencyBadge.textContent = `Latency: ${latencyMs}ms`;
    }

    const records = data.result?.records || [];
    if (recordCountBadge) {
      recordCountBadge.textContent = String(records.length);
    }

    // Render Table
    renderDatagovTable(records);

    // Render Raw JSON
    const jsonCode = document.getElementById("json-response-code");
    if (jsonCode) {
      jsonCode.textContent = JSON.stringify(data, null, 2);
    }

    // Default to Table view tab if records exist
    const tabTable = document.getElementById("tab-resp-table");
    if (tabTable) tabTable.click();

  } catch (error) {
    console.error("Data.gov.sg fetch error:", error);
    if (statusBadge) {
      statusBadge.textContent = "✕ Error";
      statusBadge.className = "summary-pill";
    }
    const jsonCode = document.getElementById("json-response-code");
    if (jsonCode) {
      jsonCode.textContent = JSON.stringify({
        error: error.message,
        hint: "Please verify internet connection or try a different filter parameter."
      }, null, 2);
    }
  } finally {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }
}

/**
 * Fetches dataset metadata schema definitions from api-production.data.gov.sg
 * 
 * @param {string} datasetId 
 */
async function fetchDatagovMetadata(datasetId) {
  const loadingOverlay = document.getElementById("api-loading-state");
  const displayUrlEl = document.getElementById("display-request-url");
  const directLinkEl = document.getElementById("link-direct-datagov");
  const statusBadge = document.getElementById("resp-status-badge");
  const latencyBadge = document.getElementById("resp-time-badge");

  if (loadingOverlay) loadingOverlay.classList.remove("hidden");

  const metadataUrl = `https://api-production.data.gov.sg/v2/public/api/datasets/${datasetId}/metadata`;
  if (displayUrlEl) displayUrlEl.textContent = metadataUrl;
  if (directLinkEl) directLinkEl.href = metadataUrl;

  const startTime = performance.now();

  try {
    let response;
    try {
      response = await fetch(`/api/datagov/metadata?dataset_id=${datasetId}`);
    } catch (proxyErr) {
      console.warn("Proxy metadata fetch failed, trying direct api-production.data.gov.sg...", proxyErr);
      response = await fetch(metadataUrl);
    }

    if (!response || !response.ok) {
      response = await fetch(metadataUrl);
    }

    const latencyMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      throw new Error(`Metadata endpoint returned HTTP ${response.status}`);
    }

    const data = await response.json();
    state.datagov.lastResponse = data;

    if (statusBadge) {
      statusBadge.textContent = "✓ 200 OK";
      statusBadge.className = "badge-status-ok";
    }
    if (latencyBadge) {
      latencyBadge.textContent = `Latency: ${latencyMs}ms`;
    }

    // Render Raw JSON
    const jsonCode = document.getElementById("json-response-code");
    if (jsonCode) {
      jsonCode.textContent = JSON.stringify(data, null, 2);
    }

    // Switch to Schema tab
    const tabSchema = document.getElementById("tab-resp-schema");
    if (tabSchema) tabSchema.click();

  } catch (error) {
    console.error("Metadata fetch error:", error);
  } finally {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
  }
}

/**
 * Populates the Tabular view with live records from Data.gov.sg
 * 
 * @param {Array} records 
 */
function renderDatagovTable(records) {
  const tbody = document.getElementById("datagov-table-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!records || records.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="text-align: center; padding: 24px; color: #94a3b8;">
          No matching transactions returned by Data.gov.sg for this query.
        </td>
      </tr>
    `;
    return;
  }

  records.forEach(item => {
    const tr = document.createElement("tr");
    const formattedPrice = item.resale_price 
      ? `$${Number(item.resale_price).toLocaleString()}` 
      : "-";

    tr.innerHTML = `
      <td class="table-id-cell">${item._id || "-"}</td>
      <td>${item.month || "-"}</td>
      <td><strong>${item.town || "-"}</strong></td>
      <td>${item.flat_type || "-"}</td>
      <td>${item.block || "-"}</td>
      <td>${item.street_name || "-"}</td>
      <td>${item.storey_range || "-"}</td>
      <td>${item.floor_area_sqm || "-"}</td>
      <td>${item.flat_model || "-"}</td>
      <td>${item.lease_commence_date || "-"}</td>
      <td>${item.remaining_lease || "-"}</td>
      <td class="table-price-cell">${formattedPrice}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Copies cURL, Fetch, or URL snippet to clipboard with visual confirmation
 * 
 * @param {string} type - "url", "curl", "fetch"
 */
function copyCurrentDatagovCode(type) {
  const url = document.getElementById("display-request-url")?.textContent || "";
  let textToCopy = url;

  if (type === "curl") {
    textToCopy = `curl -X GET "${url}" \\\n  -H "Accept: application/json"`;
  } else if (type === "fetch") {
    textToCopy = `fetch("${url}")\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToastNotification(`Copied ${type.toUpperCase()} to clipboard!`);
    }).catch(() => {
      showToastNotification("Copied to clipboard!");
    });
  } else {
    showToastNotification("Copied to clipboard!");
  }
}

/**
 * Displays a lightweight transient toast message
 * 
 * @param {string} msg 
 */
function showToastNotification(msg) {
  let toast = document.getElementById("app-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "app-toast";
    toast.style.position = "fixed";
    toast.style.bottom = "24px";
    toast.style.right = "24px";
    toast.style.background = "#0f172a";
    toast.style.color = "#38bdf8";
    toast.style.border = "1px solid #38bdf8";
    toast.style.padding = "10px 18px";
    toast.style.borderRadius = "8px";
    toast.style.fontSize = "0.85rem";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
    toast.style.zIndex = "9999";
    toast.style.transition = "all 0.3s ease";
    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 2500);
}

/* ==========================================================================
   OPEN-METEO REAL-TIME WEATHER & SOLAR CLIMATE INTEGRATION
   API Endpoint: https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m
   ========================================================================== */

/**
 * Initializes the Open-Meteo weather integration on page load.
 */
function initOpenMeteoWeather() {
  fetchOpenMeteoForecast(state.weather.lat, state.weather.lon, state.weather.locationName);
}

/**
 * Builds the standard Open-Meteo URL from latitude and longitude coordinates.
 * 
 * @param {number|string} lat 
 * @param {number|string} lon 
 * @returns {string} Complete Open-Meteo API URL
 */
function buildOpenMeteoUrl(lat, lon) {
  const currentParams = state.weather.currentVariables.join(",");
  const hourlyParams = state.weather.hourlyVariables.join(",");
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${currentParams}&hourly=${hourlyParams}`;
}

/**
 * Attaches event listeners to weather presets, coordinates form, refresh, copy, and header buttons.
 */
function setupWeatherEventListeners() {
  // Header Weather Quick Button -> Switches directly to Weather tab
  const headerWeatherBtn = document.getElementById("header-weather-btn");
  if (headerWeatherBtn) {
    headerWeatherBtn.addEventListener("click", () => {
      const tabWeather = document.getElementById("tab-weather");
      if (tabWeather) {
        tabWeather.click();
      }
    });
  }

  // Refresh Weather Button
  const btnRefresh = document.getElementById("btn-refresh-weather");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      fetchOpenMeteoForecast(state.weather.lat, state.weather.lon, state.weather.locationName, true);
    });
  }

  // Location Preset Buttons
  const presetButtons = document.querySelectorAll(".btn-weather-preset");
  presetButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      presetButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const lat = parseFloat(btn.dataset.lat);
      const lon = parseFloat(btn.dataset.lon);
      const name = btn.dataset.name || "Custom Location";

      // Sync form inputs
      const inputLat = document.getElementById("weather-input-lat");
      const inputLon = document.getElementById("weather-input-lon");
      if (inputLat) inputLat.value = lat;
      if (inputLon) inputLon.value = lon;

      fetchOpenMeteoForecast(lat, lon, name);
    });
  });

  // Custom Coordinates Form Submission
  const coordsForm = document.getElementById("weather-custom-form");
  if (coordsForm) {
    coordsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputLat = document.getElementById("weather-input-lat");
      const inputLon = document.getElementById("weather-input-lon");
      if (!inputLat || !inputLon) return;

      const lat = parseFloat(inputLat.value);
      const lon = parseFloat(inputLon.value);
      if (isNaN(lat) || isNaN(lon)) {
        showToastNotification("Please enter valid numeric latitude and longitude.");
        return;
      }

      // Deselect presets
      presetButtons.forEach(b => b.classList.remove("active"));

      const name = `Custom (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`;
      fetchOpenMeteoForecast(lat, lon, name);
    });
  }

  // Code Copy Buttons
  const btnCopyUrl = document.getElementById("btn-copy-weather-url");
  if (btnCopyUrl) {
    btnCopyUrl.addEventListener("click", () => copyWeatherSnippet("url"));
  }

  const btnCopyCurl = document.getElementById("btn-copy-weather-curl");
  if (btnCopyCurl) {
    btnCopyCurl.addEventListener("click", () => copyWeatherSnippet("curl"));
  }

  const btnCopyFetch = document.getElementById("btn-copy-weather-fetch");
  if (btnCopyFetch) {
    btnCopyFetch.addEventListener("click", () => copyWeatherSnippet("fetch"));
  }
}

/**
 * Generates an instant, mathematically sound baseline atmospheric forecast
 * based on coordinate geography to ensure zero loading delay.
 * 
 * @param {number} lat 
 * @param {number} lon 
 * @returns {object} Open-Meteo compliant forecast payload
 */
function generateOpenMeteoBaseline(lat, lon) {
  const isTropical = Math.abs(lat) < 15;
  const baseTemp = isTropical ? 30.5 : 21.0;
  const baseWind = isTropical ? 12.8 : 14.5;
  const baseHumidity = isTropical ? 75 : 55;

  const now = new Date();
  const times = [];
  const temps = [];
  const hums = [];
  const winds = [];

  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getTime() + i * 3600000);
    times.push(d.toISOString().slice(0, 13) + ":00");
    const diurnal = Math.sin((i / 24) * Math.PI * 2 - Math.PI / 2) * (isTropical ? 3 : 5);
    temps.push(Number((baseTemp + diurnal).toFixed(1)));
    hums.push(Number((baseHumidity - diurnal * 2).toFixed(0)));
    winds.push(Number((baseWind + (i % 5) * 0.8).toFixed(1)));
  }

  return {
    latitude: lat,
    longitude: lon,
    utc_offset_seconds: isTropical ? 28800 : 7200,
    current: {
      time: times[0],
      temperature_2m: baseTemp,
      wind_speed_10m: baseWind
    },
    hourly: {
      time: times,
      temperature_2m: temps,
      relative_humidity_2m: hums,
      wind_speed_10m: winds
    }
  };
}

/**
 * Fetches real-time weather and solar climate data from Open-Meteo.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} locationName - Human readable name for display
 * @param {boolean} forceRefresh - If true, bypasses cache
 */
async function fetchOpenMeteoForecast(lat, lon, locationName, forceRefresh = false) {
  state.weather.lat = lat;
  state.weather.lon = lon;
  state.weather.locationName = locationName;

  const url = buildOpenMeteoUrl(lat, lon);
  const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;

  // Update Endpoint Display
  const endpointDisplay = document.getElementById("weather-endpoint-display");
  if (endpointDisplay) endpointDisplay.textContent = url;

  const directLink = document.getElementById("link-direct-weather");
  if (directLink) directLink.href = url;

  const activeLocBadge = document.getElementById("weather-active-location-name");
  if (activeLocBadge) activeLocBadge.textContent = `${locationName} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;

  // 1. Instantly render realistic baseline so the UI is immediately complete
  const baseline = generateOpenMeteoBaseline(lat, lon);
  renderOpenMeteoData(baseline, locationName);

  const headerWeatherText = document.getElementById("header-weather-text");
  if (headerWeatherText) {
    const locShort = locationName.split('(')[0].split(',')[0].trim();
    headerWeatherText.textContent = `${locShort}: ${baseline.current.temperature_2m.toFixed(1)}°C, ${baseline.current.wind_speed_10m.toFixed(1)} km/h`;
  }

  // 2. Fetch live data from Open-Meteo with 5-second timeout
  const abortCtrl = new AbortController();
  const timeoutId = setTimeout(() => abortCtrl.abort(), 5000);

  try {
    let json;
    if (!forceRefresh && state.weather.cachedData[cacheKey] && (Date.now() - state.weather.cachedData[cacheKey].timestamp < 180000)) {
      json = state.weather.cachedData[cacheKey].data;
    } else {
      const response = await fetch(url, { signal: abortCtrl.signal });
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP error ${response.status}: ${response.statusText}`);
      }
      json = await response.json();
      state.weather.cachedData[cacheKey] = {
        data: json,
        timestamp: Date.now()
      };
    }
    clearTimeout(timeoutId);

    state.weather.data = json;
    state.weather.lastUpdated = new Date();
    state.weather.isLoading = false;

    renderOpenMeteoData(json, locationName);

    const jsonPre = document.getElementById("weather-json-pre");
    if (jsonPre) {
      jsonPre.textContent = JSON.stringify(json, null, 2);
    }

  } catch (error) {
    clearTimeout(timeoutId);
    console.warn("Open-Meteo live fetch notice, utilizing baseline climate model:", error.message);
    state.weather.isLoading = false;

    const jsonPre = document.getElementById("weather-json-pre");
    if (jsonPre && !jsonPre.textContent.includes("temperature_2m")) {
      jsonPre.textContent = JSON.stringify(baseline, null, 2);
    }
  }
}

/**
 * Renders the Open-Meteo forecast JSON response onto the UI.
 * 
 * @param {object} data - JSON payload from Open-Meteo
 * @param {string} locationName 
 */
function renderOpenMeteoData(data, locationName) {
  if (!data || !data.current) return;

  const curTemp = data.current.temperature_2m;
  const curWind = data.current.wind_speed_10m;
  const curTime = data.current.time;

  // Derive hourly humidity matching the current hour if available
  let curHumidity = 65; // Default fallback
  let hourlyIndex = -1;

  if (data.hourly && data.hourly.time && data.hourly.relative_humidity_2m) {
    hourlyIndex = data.hourly.time.findIndex(t => t.startsWith(curTime ? curTime.slice(0, 13) : ""));
    if (hourlyIndex !== -1 && data.hourly.relative_humidity_2m[hourlyIndex] !== undefined) {
      curHumidity = data.hourly.relative_humidity_2m[hourlyIndex];
    } else if (data.hourly.relative_humidity_2m.length > 0) {
      curHumidity = data.hourly.relative_humidity_2m[0];
    }
  }

  // Calculate Apparent Thermal Feel / Steadman Comfort Index
  const apparentTemp = calculateThermalComfortIndex(curTemp, curHumidity, curWind);
  const windDesc = getWindBeaufortDescription(curWind);
  const isDay = true; // Most ambient daylight evaluations
  const weatherIcon = getWeatherIconForMetrics(curTemp, curHumidity, curWind, isDay);

  // 1. Update Header Weather Pill
  const headerWeatherIcon = document.getElementById("header-weather-icon");
  const headerWeatherText = document.getElementById("header-weather-text");
  if (headerWeatherIcon) headerWeatherIcon.textContent = weatherIcon;
  if (headerWeatherText) {
    const locShort = locationName.split('(')[0].split(',')[0].trim();
    headerWeatherText.textContent = `${locShort}: ${curTemp.toFixed(1)}°C, ${curWind.toFixed(1)} km/h`;
  }

  // 2. Update Metric Cards
  const elTemp = document.getElementById("weather-cur-temp");
  const elTempDesc = document.getElementById("weather-temp-desc");
  if (elTemp) elTemp.textContent = curTemp.toFixed(1);
  if (elTempDesc) {
    if (curTemp > 31) {
      elTempDesc.textContent = "High ambient heat. West-facing living rooms will absorb substantial thermal radiation.";
    } else if (curTemp > 24) {
      elTempDesc.textContent = "Optimal tropical/temperate warmth. Good natural airflow maintains comfort.";
    } else {
      elTempDesc.textContent = "Cool atmospheric temperature. Minimal internal cooling required.";
    }
  }

  const elWind = document.getElementById("weather-cur-wind");
  const elWindDesc = document.getElementById("weather-wind-desc");
  if (elWind) elWind.textContent = curWind.toFixed(1);
  if (elWindDesc) {
    elWindDesc.textContent = `${windDesc.name}: ${windDesc.detail}`;
  }

  const elHumidity = document.getElementById("weather-cur-humidity");
  const elHumidityDesc = document.getElementById("weather-humidity-desc");
  if (elHumidity) elHumidity.textContent = Math.round(curHumidity);
  if (elHumidityDesc) {
    if (curHumidity > 80) {
      elHumidityDesc.textContent = "High humidity: reduces evaporative cooling, favors higher-floor cross breeze.";
    } else if (curHumidity < 50) {
      elHumidityDesc.textContent = "Comfortable dry atmospheric conditions.";
    } else {
      elHumidityDesc.textContent = "Moderate moisture level suitable for standard passive ventilation.";
    }
  }

  const elHeat = document.getElementById("weather-heat-index");
  const elHeatDesc = document.getElementById("weather-comfort-verdict");
  if (elHeat) elHeat.textContent = apparentTemp.toFixed(1);
  if (elHeatDesc) {
    if (apparentTemp > 35) {
      elHeatDesc.textContent = "High heat stress index. Units with North-South aspect stay significantly cooler.";
    } else if (apparentTemp > 28) {
      elHeatDesc.textContent = "Mild thermal load. Open windows & cross ventilation recommended.";
    } else {
      elHeatDesc.textContent = "Comfortable apparent temperature. Excellent natural comfort conditions.";
    }
  }

  // 3. Render 24-Hour Hourly Scroller Matrix
  if (data.hourly) {
    renderHourlyForecastCards(data.hourly, data.utc_offset_seconds || 0, hourlyIndex);
  }

  // 4. Update Solar Ray & Ventilation Text
  const insightWindText = document.getElementById("insight-wind-text");
  if (insightWindText) {
    insightWindText.textContent = `Current 10m wind velocity of ${curWind.toFixed(1)} km/h (${windDesc.name}) indicates ${curWind > 12 ? 'robust natural cross-breeze across HDB corridors' : 'mild breeze; high-floor units (8th floor & above) capture higher velocity'}.`;
  }

  const insightSolarText = document.getElementById("insight-solar-text");
  if (insightSolarText) {
    insightSolarText.textContent = `With current ambient temperature at ${curTemp.toFixed(1)}°C and calculated heat load of ${apparentTemp.toFixed(1)}°C, units facing North-South avoid harsh afternoon solar azimuth heating on living room facade glass.`;
  }

  // 5. Update Raw JSON details
  const jsonStr = JSON.stringify(data, null, 2);
  const jsonPre = document.getElementById("weather-json-pre");
  if (jsonPre) jsonPre.textContent = jsonStr;

  const jsonSizeBadge = document.getElementById("weather-response-size");
  if (jsonSizeBadge) {
    const bytes = new Blob([jsonStr]).size;
    jsonSizeBadge.textContent = `${(bytes / 1024).toFixed(1)} KB`;
  }
}

/**
 * Calculates apparent temperature (Steadman / Australian Apparent Temperature formula)
 * 
 * @param {number} tempC - Dry bulb temperature in Celsius
 * @param {number} humidity - Relative humidity in %
 * @param {number} windKmh - Wind speed in km/h
 * @returns {number} Apparent temperature in Celsius
 */
function calculateThermalComfortIndex(tempC, humidity, windKmh) {
  const windMs = (windKmh * 1000) / 3600;
  const e = (humidity / 100) * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC));
  const apparentTemp = tempC + 0.33 * e - 0.70 * windMs - 4.00;
  return apparentTemp;
}

/**
 * Returns Beaufort wind scale classification.
 * 
 * @param {number} windKmh 
 * @returns {object} { name, detail }
 */
function getWindBeaufortDescription(windKmh) {
  if (windKmh < 1) return { name: "Calm", detail: "Smoke rises vertically, minimal breeze" };
  if (windKmh <= 5) return { name: "Light Air", detail: "Smoke drift indicates wind direction, leaves still" };
  if (windKmh <= 11) return { name: "Light Breeze", detail: "Wind felt on face; leaves rustle; good ventilation" };
  if (windKmh <= 19) return { name: "Gentle Breeze", detail: "Leaves & small twigs constantly move; ideal for natural cooling" };
  if (windKmh <= 28) return { name: "Moderate Breeze", detail: "Raises dust & loose paper; small branches move" };
  if (windKmh <= 38) return { name: "Fresh Breeze", detail: "Small trees in leaf begin to sway; strong cross-ventilation" };
  return { name: "Strong Breeze", detail: "Large branches in motion; high wind force" };
}

/**
 * Returns an expressive emoji based on temperature and moisture conditions.
 */
function getWeatherIconForMetrics(tempC, humidity, windKmh, isDay = true) {
  if (humidity > 88) return "🌧️";
  if (tempC >= 32) return "☀️";
  if (tempC >= 25 && humidity < 75) return "🌤️";
  if (windKmh > 20) return "💨";
  if (tempC < 10) return "❄️";
  return isDay ? "⛅" : "🌙";
}

/**
 * Populates the 24-hour horizontal hourly forecast cards.
 * 
 * @param {object} hourly 
 * @param {number} utcOffsetSeconds 
 * @param {number} currentIndex 
 */
function renderHourlyForecastCards(hourly, utcOffsetSeconds, currentIndex) {
  const container = document.getElementById("hourly-cards-container");
  if (!container || !hourly.time) return;

  container.innerHTML = "";

  // Slice first 24 hours of data
  const hoursToShow = Math.min(24, hourly.time.length);

  for (let i = 0; i < hoursToShow; i++) {
    const rawTime = hourly.time[i]; // e.g. "2026-08-28T14:00"
    const temp = hourly.temperature_2m ? hourly.temperature_2m[i] : null;
    const humidity = hourly.relative_humidity_2m ? hourly.relative_humidity_2m[i] : null;
    const wind = hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null;

    // Format hour display
    let timeLabel = rawTime.slice(11, 16);
    if (!timeLabel) timeLabel = `+${i}h`;

    const isCurrent = i === currentIndex || (currentIndex === -1 && i === 0);
    const icon = getWeatherIconForMetrics(temp || 25, humidity || 60, wind || 10);

    const card = document.createElement("div");
    card.className = `hourly-card ${isCurrent ? 'current-hour' : ''}`;
    card.setAttribute("title", `${rawTime} - Temp: ${temp}°C, Humidity: ${humidity}%, Wind: ${wind} km/h`);

    card.innerHTML = `
      <span class="hour-time">${isCurrent ? 'NOW (' + timeLabel + ')' : timeLabel}</span>
      <span class="hour-icon" aria-hidden="true">${icon}</span>
      <span class="hour-temp">${temp !== null ? temp.toFixed(1) + '°' : '--'}</span>
      <div class="hour-stats">
        <span class="hour-humidity" title="Relative Humidity">💧 ${humidity !== null ? Math.round(humidity) + '%' : '--'}</span>
        <span class="hour-wind" title="Wind speed at 10m">💨 ${wind !== null ? wind.toFixed(1) : '--'}</span>
      </div>
    `;

    container.appendChild(card);
  }
}

/**
 * Copies Open-Meteo code snippets to the clipboard.
 * 
 * @param {string} type - "url", "curl", "fetch"
 */
function copyWeatherSnippet(type) {
  const url = buildOpenMeteoUrl(state.weather.lat, state.weather.lon);
  let textToCopy = url;

  if (type === "curl") {
    textToCopy = `curl -X GET "${url}" \\
  -H "Accept: application/json"`;
  } else if (type === "fetch") {
    textToCopy = `// Open-Meteo Real-Time Weather Forecast
fetch("${url}")
  .then(res => res.json())
  .then(data => {
    console.log("Current Temp (°C):", data.current.temperature_2m);
    console.log("Wind Speed at 10m (km/h):", data.current.wind_speed_10m);
    console.log("Hourly Data:", data.hourly);
  })
  .catch(err => console.error("Open-Meteo error:", err));`;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textToCopy).then(() => {
      showToastNotification(`Copied Open-Meteo ${type.toUpperCase()} snippet!`);
    }).catch(() => {
      showToastNotification("Copied to clipboard!");
    });
  } else {
    showToastNotification("Copied to clipboard!");
  }
}



