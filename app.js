/* ============================================================
   SENNELIER STUDIO — app logic
   - Collection / Notes state      -> localStorage (tiny)
   - Art journal (photos)          -> IndexedDB  (big)
   - Export / Import               -> one JSON backup file
   ============================================================ */

"use strict";

/* ── Constants ─────────────────────────────────────────── */
var LS_KEY = "sennelier-studio:v1";
var DB_NAME = "sennelier-studio";
var DB_STORE = "journal";
var DB_VERSION = 1;
var MILESTONES = [25, 50, 75, 100];

/* ── State ─────────────────────────────────────────────── */
var state = {
  owned: {},     // { collectionId: [code, ...] }
  wishlist: {},  // { collectionId: [code, ...] }
  restock: {},   // { collectionId: [code, ...] }
  notes: []      // [{ id, text, createdAt, updatedAt }]
};

var journal = []; // from IndexedDB: [{ id, title, date, note, imageDataUrl, createdAt }]
var activeCollectionId = null;
var editingNoteId = null;
var editingJournalId = null;
var pendingImageDataUrl = null;
var celebrated = {}; // session milestone dedupe: "collId:tier" -> true

/* ── Small helpers ─────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function getCollectionById(id) {
  return (window.SENNELIER_COLLECTIONS || []).filter(function (c) { return c.id === id; })[0] || null;
}

/* The "Special Sets" collection holds collectible sets, not individual colours,
   so colour/stick stats and the Collection/Palette switchers skip it. */
var SETS_ID = "special-sets";
function isColourCollection(c) { return !!c && c.id !== SETS_ID; }
function colourCollections() {
  return (window.SENNELIER_COLLECTIONS || []).filter(isColourCollection);
}

function currentCollection() {
  var cols = window.SENNELIER_COLLECTIONS || [];
  return getCollectionById(activeCollectionId) || cols[0] || null;
}

/* ── localStorage (collection + notes) ─────────────────── */
function loadState() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      state.owned = parsed.owned || {};
      state.wishlist = parsed.wishlist || {};
      state.restock = parsed.restock || {};
      state.notes = parsed.notes || [];
    }
  } catch (e) {
    console.warn("Could not load saved data:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      owned: state.owned,
      wishlist: state.wishlist,
      restock: state.restock,
      notes: state.notes
    }));
  } catch (e) {
    console.error("Could not save:", e);
    alert("Could not save. Your browser storage might be full.");
  }
}

/* ── IndexedDB (art journal photos) ────────────────────── */
function openDB() {
  return new Promise(function (resolve, reject) {
    if (!window.indexedDB) { reject(new Error("IndexedDB not supported")); return; }
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function idbPut(entry) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(entry);
      tx.oncomplete = function () { db.close(); resolve(); };
      tx.onerror = function () { db.close(); reject(tx.error); };
    });
  });
}

function idbDelete(id) {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = function () { db.close(); resolve(); };
      tx.onerror = function () { db.close(); reject(tx.error); };
    });
  });
}

function idbGetAll() {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, "readonly");
      var req = tx.objectStore(DB_STORE).getAll();
      req.onsuccess = function () { db.close(); resolve(req.result || []); };
      req.onerror = function () { db.close(); reject(req.error); };
    });
  });
}

function idbClear() {
  return openDB().then(function (db) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).clear();
      tx.oncomplete = function () { db.close(); resolve(); };
      tx.onerror = function () { db.close(); reject(tx.error); };
    });
  });
}

/* ── Collection state helpers ──────────────────────────── */
function ownedList(collId) { return state.owned[collId] || []; }
function wishlistList(collId) { return state.wishlist[collId] || []; }
function restockList(collId) { return state.restock[collId] || []; }
function isOwned(collId, code) { return ownedList(collId).indexOf(code) !== -1; }
function isWishlisted(collId, code) { return wishlistList(collId).indexOf(code) !== -1; }
function isRestocked(collId, code) { return restockList(collId).indexOf(code) !== -1; }

function setOwnedState(collId, code, owned) {
  var list = ownedList(collId);
  var idx = list.indexOf(code);
  if (owned && idx === -1) {
    list.push(code);
    state.owned[collId] = list;
    celebrateOnAdd(collId, list.length);
  } else if (!owned && idx !== -1) {
    list.splice(idx, 1);
    state.owned[collId] = list;
  }
  saveState();
}

function setWishlistState(collId, code, on) {
  var list = wishlistList(collId);
  var idx = list.indexOf(code);
  if (on && idx === -1) { list.push(code); }
  else if (!on && idx !== -1) { list.splice(idx, 1); }
  state.wishlist[collId] = list;
  saveState();
}

function setRestockState(collId, code, on) {
  var list = restockList(collId);
  var idx = list.indexOf(code);
  if (on && idx === -1) { list.push(code); }
  else if (!on && idx !== -1) { list.splice(idx, 1); }
  state.restock[collId] = list;
  saveState();
}

function toggleOwned(collId, code) { setOwnedState(collId, code, !isOwned(collId, code)); }
function toggleWishlist(collId, code) { setWishlistState(collId, code, !isWishlisted(collId, code)); }
function toggleRestock(collId, code) { setRestockState(collId, code, !isRestocked(collId, code)); }

/* ── Milestones & toasts ───────────────────────────────── */
function milestoneTier(pct) {
  var t = 0;
  MILESTONES.forEach(function (m) { if (pct >= m) { t = m; } });
  return t;
}

function celebrateOnAdd(collId, count) {
  var coll = getCollectionById(collId);
  if (!coll) { return; }
  var total = (coll.colors || []).length;
  if (!total) { return; }
  var tier = milestoneTier((count / total) * 100);
  if (tier > 0) {
    var key = collId + ":" + tier;
    if (!celebrated[key]) {
      celebrated[key] = true;
      if (tier === 100) {
        toast("🏆 You've collected the ENTIRE " + coll.name + " range!");
      } else {
        toast("🎉 You've collected " + tier + "% of " + coll.name + "!");
      }
    }
  }
}

function toast(msg) {
  var wrap = $("#toasts");
  var t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(function () {
    t.classList.add("out");
    setTimeout(function () { t.remove(); }, 400);
  }, 3200);
}

/* ── Colour helpers (hex -> HSL -> family, hue sort) ───── */
function hexToHsl(hex) {
  hex = String(hex || "").replace("#", "");
  if (hex.length === 3) { hex = hex.split("").map(function (c) { return c + c; }).join(""); }
  var r = parseInt(hex.slice(0, 2), 16) / 255;
  var g = parseInt(hex.slice(2, 4), 16) / 255;
  var b = parseInt(hex.slice(4, 6), 16) / 255;
  if (isNaN(r)) { r = 0.5; g = 0.5; b = 0.5; }
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var l = (max + min) / 2;
  var d = max - min;
  var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  var h = 0;
  if (d) {
    if (max === r) { h = ((g - b) / d) % 6; }
    else if (max === g) { h = (b - r) / d + 2; }
    else { h = (r - g) / d + 4; }
    h *= 60;
    if (h < 0) { h += 360; }
  }
  return { h: h, s: s, l: l };
}

function colorFamily(hex) {
  var c = hexToHsl(hex);
  if (c.s < 0.12 || c.l < 0.12 || c.l > 0.9) { return "Neutral"; }
  if (c.h < 15 || c.h >= 345) { return "Red"; }
  if (c.h < 40) { return "Orange"; }
  if (c.h < 70) { return "Yellow"; }
  if (c.h < 165) { return "Green"; }
  if (c.h < 260) { return "Blue"; }
  if (c.h < 300) { return "Purple"; }
  return "Pink";
}

function sortByHue(colors) {
  return colors.slice().sort(function (a, b) {
    var ca = hexToHsl(a.hex), cb = hexToHsl(b.hex);
    var na = ca.s < 0.12 ? -1 : ca.h;
    var nb = cb.s < 0.12 ? -1 : cb.h;
    if (na === -1 && nb !== -1) { return 1; }
    if (nb === -1 && na !== -1) { return -1; }
    return na - nb;
  });
}

/* ── Progress ring ─────────────────────────────────────── */
function ringHTML(pct, size) {
  pct = Math.max(0, Math.min(100, pct || 0));
  var stroke = Math.max(6, Math.round(size * 0.09));
  var r = (size - stroke) / 2;
  var c = 2 * Math.PI * r;
  var off = c * (1 - pct / 100);
  var font = Math.round(size * 0.22);
  return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
    '<circle class="ring-bg" cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke-width="' + stroke + '"/>' +
    '<circle class="ring-fg" cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + r + '" fill="none" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 ' + (size / 2) + ' ' + (size / 2) + ')"/>' +
    '<text class="ring-label" x="' + (size / 2) + '" y="' + (size / 2) + '" dominant-baseline="central" text-anchor="middle" font-size="' + font + '">' + Math.round(pct) + '%</text>' +
    '</svg>';
}

/* ── Aggregates ────────────────────────────────────────── */
function totalCounts() {
  var totalColors = 0, totalOwned = 0, totalWish = 0, totalRestock = 0;
  colourCollections().forEach(function (c) {
    totalColors += (c.colors || []).length;
    totalOwned += ownedList(c.id).length;
    totalWish += wishlistList(c.id).length;
    totalRestock += restockList(c.id).length;
  });
  return { colors: totalColors, owned: totalOwned, wish: totalWish, restock: totalRestock };
}

function ownedColorsAcrossAll() {
  var result = [];
  colourCollections().forEach(function (c) {
    ownedList(c.id).forEach(function (code) {
      var color = (c.colors || []).filter(function (x) { return x.code === code; })[0];
      if (color) { result.push({ collection: c, color: color }); }
    });
  });
  return result;
}

/* ── Collection rendering ──────────────────────────────── */
function renderCollectionTabs() {
  ["#collection-tabs", "#palette-tabs"].forEach(function (sel) {
    var nav = $(sel);
    if (!nav) { return; }
    nav.innerHTML = "";
    colourCollections().forEach(function (coll) {
      var btn = document.createElement("button");
      btn.className = "coll-tab" + (coll.id === activeCollectionId ? " active" : "");
      btn.textContent = coll.name;
      btn.onclick = function () {
        activeCollectionId = coll.id;
        renderCollectionTabs();
        renderCollection();
        renderPalette();
      };
      nav.appendChild(btn);
    });
  });
}

function renderCollection() {
  var coll = currentCollection();
  if (!coll) {
    $("#collection-grid").innerHTML = '<div class="empty">No collections defined. Add one in <code>data/collections.js</code>.</div>';
    return;
  }
  activeCollectionId = coll.id;

  $("#collection-title").textContent = coll.name;
  $("#collection-blurb").textContent = coll.blurb || "";
  $("#collection-badge").style.display = coll.sample ? "inline-block" : "none";

  var owned = ownedList(coll.id).length;
  var wish = wishlistList(coll.id).length;
  var restock = restockList(coll.id).length;
  var total = (coll.colors || []).length;
  $("#collection-count").textContent =
    owned + " owned · " + wish + " wishlist · " + restock + " restock · " + total + " total";

  var query = ($("#collection-search").value || "").trim().toLowerCase();
  var filter = $("#collection-filter").value;

  var grid = $("#collection-grid");
  grid.innerHTML = "";

  var filtered = (coll.colors || []).filter(function (c) {
    var matchesQuery = !query ||
      (c.name || "").toLowerCase().indexOf(query) !== -1 ||
      String(c.code || "").toLowerCase().indexOf(query) !== -1;
    var o = isOwned(coll.id, c.code);
    var w = isWishlisted(coll.id, c.code);
    var r = isRestocked(coll.id, c.code);
    var matchesFilter = true;
    if (filter === "owned") { matchesFilter = o; }
    else if (filter === "wishlist") { matchesFilter = w; }
    else if (filter === "restock") { matchesFilter = r; }
    else if (filter === "missing") { matchesFilter = !o; }
    return matchesQuery && matchesFilter;
  });

  filtered.forEach(function (c) {
    grid.appendChild(renderSwatch(coll, c));
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty">No colours match.</div>';
  }
}

function renderSwatch(coll, color) {
  var owned = isOwned(coll.id, color.code);
  var wish = isWishlisted(coll.id, color.code);
  var restock = isRestocked(coll.id, color.code);

  var card = document.createElement("div");
  card.className = "swatch" + (owned ? " owned" : "");
  card.setAttribute("data-code", color.code);

  var main = document.createElement("button");
  main.type = "button";
  main.className = "swatch-main";
  main.setAttribute("aria-pressed", owned ? "true" : "false");
  main.title = color.name + (owned ? " (owned)" : "");
  main.innerHTML =
    '<span class="swatch-chip" style="background:' + (color.hex || "#eee") + '"></span>' +
    '<span class="swatch-info">' +
      '<span class="swatch-code">' + escapeHtml(color.code || "—") + '</span>' +
      '<span class="swatch-name">' + escapeHtml(color.name) + '</span>' +
    '</span>' +
    '<span class="swatch-owned">✓</span>';
  main.addEventListener("click", function () {
    toggleOwned(coll.id, color.code);
    renderCollection();
    pulseByCode(color.code, ".swatch-main");
  });

  var actions = document.createElement("div");
  actions.className = "swatch-actions";

  var star = document.createElement("button");
  star.type = "button";
  star.className = "act act-star" + (wish ? " on" : "");
  star.setAttribute("aria-pressed", wish ? "true" : "false");
  star.title = "Favorite (wishlist)";
  star.textContent = wish ? "★" : "☆";
  star.addEventListener("click", function () {
    toggleWishlist(coll.id, color.code);
    renderCollection();
    pulseByCode(color.code, ".act-star");
  });

  var rebuy = document.createElement("button");
  rebuy.type = "button";
  rebuy.className = "act act-restock" + (restock ? " on" : "");
  rebuy.setAttribute("aria-pressed", restock ? "true" : "false");
  rebuy.title = "Rebuy (restock)";
  rebuy.textContent = "🔁";
  rebuy.addEventListener("click", function () {
    toggleRestock(coll.id, color.code);
    renderCollection();
    pulseByCode(color.code, ".act-restock");
  });

  actions.appendChild(star);
  actions.appendChild(rebuy);
  card.appendChild(main);
  card.appendChild(actions);
  return card;
}

/* flash a card/button after a re-render so the change is obvious */
function pulseByCode(code, sel) {
  var cardEl = document.querySelector('.swatch[data-code="' + code + '"], .set-card[data-code="' + code + '"]');
  if (!cardEl) { return; }
  var target = sel ? cardEl.querySelector(sel) : cardEl;
  if (!target) { target = cardEl; }
  target.classList.remove("pulse");
  void target.offsetWidth;
  target.classList.add("pulse");
  setTimeout(function () { target.classList.remove("pulse"); }, 500);
}

/* ── Palette rendering ─────────────────────────────────── */
function renderPalette() {
  var coll = currentCollection();
  var box = $("#palette-box");
  if (!box) { return; }
  if (!coll) {
    box.innerHTML = '<div class="empty">No collection.</div>';
    return;
  }
  var owned = (coll.colors || []).filter(function (c) { return isOwned(coll.id, c.code); });
  $("#palette-count").textContent = owned.length + " colours in your palette";
  if (owned.length === 0) {
    box.innerHTML = '<div class="empty">Your palette is empty. Tap colours in the Collection tab to fill it.</div>';
    return;
  }
  box.innerHTML = "";
  sortByHue(owned).forEach(function (c) {
    var chip = document.createElement("div");
    chip.className = "palette-chip";
    chip.title = (c.code || "—") + " · " + c.name;
    chip.innerHTML =
      '<span class="palette-dot" style="background:' + (c.hex || "#eee") + '"></span>' +
      '<span class="palette-name">' + escapeHtml(c.name) + '</span>';
    box.appendChild(chip);
  });
}

/* ── Special Sets rendering ────────────────────────────── */
function renderSetsView() {
  var coll = getCollectionById("special-sets");
  var grid = $("#sets-grid");
  if (!grid) { return; }
  if (!coll) { grid.innerHTML = '<div class="empty">No special sets defined.</div>'; return; }
  var owned = ownedList(coll.id).length;
  var wish = wishlistList(coll.id).length;
  var restock = restockList(coll.id).length;
  var countEl = $("#sets-count");
  if (countEl) {
    countEl.textContent = owned + " of " + coll.colors.length + " collected" +
      (wish ? " · " + wish + " wishlist" : "") +
      (restock ? " · " + restock + " restock" : "");
  }
  grid.innerHTML = "";
  coll.colors.forEach(function (color) { grid.appendChild(renderSetCard(coll, color)); });
}

function renderSetCard(coll, color) {
  var owned = isOwned(coll.id, color.code);
  var wish = isWishlisted(coll.id, color.code);
  var restock = isRestocked(coll.id, color.code);

  var card = document.createElement("div");
  card.className = "set-card" + (owned ? " owned" : "");
  card.setAttribute("data-code", color.code);

  var main = document.createElement("button");
  main.type = "button";
  main.className = "set-main";
  main.setAttribute("aria-pressed", owned ? "true" : "false");
  main.innerHTML =
    '<span class="set-top"><span class="set-dot" style="background:' + (color.hex || "#eee") + '"></span><span class="set-check">✓</span></span>' +
    '<span class="set-name">' + escapeHtml(color.name) + '</span>' +
    '<span class="set-ref">#' + escapeHtml(color.code) + '</span>';
  main.addEventListener("click", function () {
    toggleOwned(coll.id, color.code);
    renderSetsView();
    pulseByCode(color.code, ".set-main");
  });

  var actions = document.createElement("div");
  actions.className = "set-actions";

  var star = document.createElement("button");
  star.type = "button";
  star.className = "act act-star" + (wish ? " on" : "");
  star.setAttribute("aria-pressed", wish ? "true" : "false");
  star.title = "Favorite (wishlist)";
  star.textContent = wish ? "★" : "☆";
  star.addEventListener("click", function () {
    toggleWishlist(coll.id, color.code);
    renderSetsView();
    pulseByCode(color.code, ".act-star");
  });

  var rebuy = document.createElement("button");
  rebuy.type = "button";
  rebuy.className = "act act-restock" + (restock ? " on" : "");
  rebuy.setAttribute("aria-pressed", restock ? "true" : "false");
  rebuy.title = "Rebuy (restock)";
  rebuy.textContent = "🔁";
  rebuy.addEventListener("click", function () {
    toggleRestock(coll.id, color.code);
    renderSetsView();
    pulseByCode(color.code, ".act-restock");
  });

  actions.appendChild(star);
  actions.appendChild(rebuy);
  card.appendChild(main);
  card.appendChild(actions);
  return card;
}

/* ── Shopping list rendering ───────────────────────────── */
function renderShopping() {
  var list = $("#shopping-list");
  var items = [];
  (window.SENNELIER_COLLECTIONS || []).forEach(function (coll) {
    (coll.colors || []).forEach(function (color) {
      var w = isWishlisted(coll.id, color.code);
      var r = isRestocked(coll.id, color.code);
      if (w || r) { items.push({ coll: coll, color: color, wish: w, restock: r }); }
    });
  });

  $("#shopping-count").textContent = items.length + (items.length === 1 ? " item" : " items") + " on your list";
  list.innerHTML = "";

  if (items.length === 0) {
    list.innerHTML = '<div class="empty">Your shopping list is empty.<br>In the <strong>Collection</strong> tab, tap <strong>☆</strong> to wishlist a colour, or <strong>🔁</strong> to flag one for restock — they will show up here.</div>';
    return;
  }

  var byColl = {};
  items.forEach(function (it) {
    (byColl[it.coll.id] = byColl[it.coll.id] || { coll: it.coll, items: [] }).items.push(it);
  });

  Object.keys(byColl).forEach(function (key) {
    var group = byColl[key];
    var h = document.createElement("h3");
    h.textContent = group.coll.name;
    list.appendChild(h);
    group.items.forEach(function (it) { list.appendChild(shoppingRow(it)); });
  });
}

function shoppingRow(it) {
  var row = document.createElement("div");
  row.className = "shop-row";
  row.innerHTML =
    '<span class="swatch-chip" style="background:' + (it.color.hex || "#eee") + '"></span>' +
    '<div class="shop-info">' +
      '<span class="shop-name">' + escapeHtml(it.color.name) + '</span>' +
      '<span class="shop-code">' + escapeHtml(it.color.code || "—") + '</span>' +
    '</div>' +
    (it.wish ? '<span class="shop-badge wish">☆ want</span>' : "") +
    (it.restock ? '<span class="shop-badge restock">🔁 restock</span>' : "") +
    '<button class="btn btn-small" data-act="got">✓ Got it</button>' +
    '<button class="btn btn-small btn-danger" data-act="clear">✕</button>';

  row.querySelector('[data-act="got"]').onclick = function () {
    setOwnedState(it.coll.id, it.color.code, true);
    setWishlistState(it.coll.id, it.color.code, false);
    setRestockState(it.coll.id, it.color.code, false);
    refreshAll();
  };
  row.querySelector('[data-act="clear"]').onclick = function () {
    setWishlistState(it.coll.id, it.color.code, false);
    setRestockState(it.coll.id, it.color.code, false);
    refreshAll();
  };
  return row;
}

/* ── Home dashboard rendering ──────────────────────────── */
function renderHome() {
  var t = totalCounts();
  var overallPct = t.colors ? Math.round((t.owned / t.colors) * 100) : 0;

  $("#home-hero").innerHTML =
    ringHTML(overallPct, 130) +
    '<div class="home-hero-text">' +
      '<h2>' + t.owned + ' of ' + t.colors + ' sticks collected</h2>' +
      '<p class="muted">' + overallPct + '% of your full collection</p>' +
    '</div>';

  $("#home-stats").innerHTML =
    '<div class="stat-tiles">' +
      statTile(t.owned, "sticks owned") +
      statTile(t.wish, "wishlist") +
      statTile(t.restock, "to restock") +
      statTile(journal.length, "art pieces") +
    '</div>';

  var colsHTML = "";
  colourCollections().forEach(function (c) {
    var owned = ownedList(c.id).length;
    var total = (c.colors || []).length;
    var pct = total ? Math.round((owned / total) * 100) : 0;
    colsHTML +=
      '<div class="coll-card">' +
        ringHTML(pct, 60) +
        '<div>' +
          '<div class="cc-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="cc-sub">' + owned + ' / ' + total + ' · ' + pct + '%</div>' +
        '</div>' +
      '</div>';
  });
  $("#home-collections").innerHTML = colsHTML || '<div class="empty">No collections yet.</div>';

  var shop = t.wish + t.restock;
  $("#home-shopping").innerHTML = shop > 0
    ? '<h3>🛍️ Shopping</h3><p class="muted">You have <strong>' + shop + '</strong> item' + (shop === 1 ? "" : "s") + ' on your list.</p><button class="btn btn-primary home-shopping-btn" data-goto="shopping">Open shopping list →</button>'
    : '<h3>🛍️ Shopping</h3><p class="muted">Your shopping list is empty.</p>';

  var setsColl = getCollectionById("special-sets");
  if (setsColl && $("#home-special")) {
    var setsOwned = ownedList("special-sets").length;
    $("#home-special").innerHTML =
      '<div class="special-head"><h3>✨ Special Sets</h3><span class="special-badge">Collectible</span></div>' +
      '<p class="muted">Themed sets of 6 half-pastels — <strong>' + setsOwned + ' of ' + setsColl.colors.length + '</strong> collected.</p>' +
      '<button class="btn btn-special" data-goto="sets">Open Special Sets →</button>';
    var gotoSpecial = $("#home-special").querySelector("[data-goto]");
    if (gotoSpecial) { gotoSpecial.onclick = function () { switchTab("sets"); }; }
  }

  var goto = $("#home-shopping").querySelector("[data-goto]");
  if (goto) { goto.onclick = function () { switchTab("shopping"); }; }
}

function statTile(num, label) {
  return '<div class="stat-tile"><div class="num">' + num + '</div><div class="lbl">' + label + '</div></div>';
}

/* ── Stats rendering ───────────────────────────────────── */
function renderStats() {
  var t = totalCounts();
  var overallPct = t.colors ? Math.round((t.owned / t.colors) * 100) : 0;

  var setsColl = getCollectionById(SETS_ID);
  var setsOwned = ownedList(SETS_ID).length;
  var setsTotal = setsColl ? (setsColl.colors || []).length : 0;

  $("#stats-overview").innerHTML =
    '<div class="stats-overview">' +
      '<div class="ov"><div class="num">' + t.owned + '</div><div class="lbl">sticks owned</div></div>' +
      '<div class="ov"><div class="num">' + t.colors + '</div><div class="lbl">colours available</div></div>' +
      '<div class="ov"><div class="num">' + overallPct + '%</div><div class="lbl">overall collected</div></div>' +
      '<div class="ov"><div class="num">' + t.wish + '</div><div class="lbl">wishlist</div></div>' +
      '<div class="ov"><div class="num">' + t.restock + '</div><div class="lbl">to restock</div></div>' +
      '<div class="ov"><div class="num">' + setsOwned + ' / ' + setsTotal + '</div><div class="lbl">special sets</div></div>' +
    '</div>';

  var families = {};
  ownedColorsAcrossAll().forEach(function (item) {
    var f = colorFamily(item.color.hex);
    families[f] = (families[f] || 0) + 1;
  });

  var entries = Object.keys(families).map(function (k) { return { name: k, count: families[k] }; })
    .filter(function (e) { return e.count > 0; })
    .sort(function (a, b) { return b.count - a.count; });

  var box = $("#stats-families");
  if (entries.length === 0) {
    box.innerHTML = '<div class="empty">Collect some colours to see your favourite families.</div>';
  } else {
    var max = entries[0].count;
    box.innerHTML = '<div class="bars">' + entries.map(function (e) {
      var w = Math.round((e.count / max) * 100);
      return '<div class="bar-row">' +
        '<span class="bar-name">' + e.name + '</span>' +
        '<div class="bar"><div class="bar-fill" style="width:' + w + '%"></div></div>' +
        '<span class="bar-count">' + e.count + '</span>' +
      '</div>';
    }).join("") + '</div>';
  }
}

/* ── Notes rendering ───────────────────────────────────── */
function renderNotes() {
  var list = $("#notes-list");
  list.innerHTML = "";
  var notes = state.notes.slice().sort(function (a, b) {
    return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
  });
  if (notes.length === 0) {
    list.innerHTML = '<div class="empty">No notes yet. Write your first note above.</div>';
  }
  notes.forEach(function (n) {
    var el = document.createElement("div");
    el.className = "note";
    var date = new Date(n.updatedAt || n.createdAt).toLocaleString();
    el.innerHTML =
      '<div class="note-text">' + escapeHtml(n.text) + '</div>' +
      '<div class="note-meta">' + date + '</div>' +
      '<div class="note-actions">' +
        '<button class="btn btn-small" data-act="edit">Edit</button>' +
        '<button class="btn btn-small btn-danger" data-act="del">Delete</button>' +
      '</div>';
    el.querySelector('[data-act="edit"]').onclick = function () { beginEditNote(n); };
    el.querySelector('[data-act="del"]').onclick = function () { deleteNote(n.id); };
    list.appendChild(el);
  });
}

function saveNoteFromComposer() {
  var input = $("#note-input");
  var text = input.value.trim();
  if (!text) { return; }
  var now = Date.now();
  if (editingNoteId) {
    var n = state.notes.filter(function (x) { return x.id === editingNoteId; })[0];
    if (n) { n.text = text; n.updatedAt = now; }
    editingNoteId = null;
    $("#note-save").textContent = "Add note";
  } else {
    state.notes.push({ id: uid(), text: text, createdAt: now, updatedAt: now });
  }
  input.value = "";
  saveState();
  renderNotes();
}

function beginEditNote(n) {
  editingNoteId = n.id;
  $("#note-input").value = n.text;
  $("#note-save").textContent = "Save changes";
  $("#note-input").focus();
}

function deleteNote(id) {
  state.notes = state.notes.filter(function (n) { return n.id !== id; });
  saveState();
  renderNotes();
}

/* ── Journal ───────────────────────────────────────────── */
function loadJournal() {
  return idbGetAll().then(function (rows) {
    journal = rows.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }).catch(function (e) {
    console.warn("Could not load journal:", e);
    journal = [];
  });
}

function renderJournal() {
  var grid = $("#journal-grid");
  grid.innerHTML = "";
  if (journal.length === 0) {
    grid.innerHTML = '<div class="empty">No art entries yet. Click "＋ Add art" to add your first piece.</div>';
  }
  journal.forEach(function (entry) {
    grid.appendChild(renderJournalCard(entry));
  });
}

function renderJournalCard(entry) {
  var el = document.createElement("div");
  el.className = "journal-card";
  var date = entry.date ? new Date(entry.date + "T00:00:00").toLocaleDateString() : "";

  el.innerHTML =
    (entry.imageDataUrl
      ? '<img class="journal-img" src="' + entry.imageDataUrl + '" alt="">'
      : '<div class="journal-img journal-img-empty">No image</div>') +
    '<div class="journal-body">' +
      '<h3 class="journal-title">' + escapeHtml(entry.title || "Untitled") + '</h3>' +
      (date ? '<div class="journal-date">' + date + '</div>' : "") +
      (entry.note ? '<div class="journal-note">' + escapeHtml(entry.note) + '</div>' : "") +
    '</div>' +
    '<div class="journal-actions">' +
      '<button class="btn btn-small" data-act="edit">Edit</button>' +
      '<button class="btn btn-small btn-danger" data-act="del">Delete</button>' +
    '</div>';

  el.querySelector('[data-act="edit"]').onclick = function () { openJournalForm(entry); };
  el.querySelector('[data-act="del"]').onclick = function () {
    if (confirm("Delete this entry?")) {
      idbDelete(entry.id).then(loadJournal).then(renderJournal).catch(function () {});
    }
  };
  return el;
}

/* ── Journal form (modal) ──────────────────────────────── */
function openJournalForm(entry) {
  editingJournalId = entry ? entry.id : null;
  pendingImageDataUrl = entry ? entry.imageDataUrl : null;
  $("#journal-modal-title").textContent = entry ? "Edit art" : "Add art";
  $("#j-title").value = entry ? entry.title : "";
  $("#j-date").value = entry ? entry.date : new Date().toISOString().slice(0, 10);
  $("#j-note").value = entry ? entry.note : "";
  $("#j-file").value = "";
  updateJournalPreview();
  $("#journal-modal").classList.add("open");
}

function closeJournalForm() {
  $("#journal-modal").classList.remove("open");
}

function updateJournalPreview() {
  var img = $("#j-preview");
  if (pendingImageDataUrl) {
    img.src = pendingImageDataUrl;
    img.style.display = "block";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }
}

function handleJournalFile(file) {
  if (!file) { return; }
  resizeImage(file, 1400, 0.82).then(function (dataUrl) {
    pendingImageDataUrl = dataUrl;
    updateJournalPreview();
  }).catch(function () {
    alert("Sorry, that image could not be read.");
  });
}

function saveJournalEntry() {
  var title = $("#j-title").value.trim() || "Untitled";
  var date = $("#j-date").value;
  var note = $("#j-note").value.trim();
  var existing = editingJournalId ? journal.filter(function (e) { return e.id === editingJournalId; })[0] : null;

  var entry = {
    id: editingJournalId || uid(),
    title: title,
    date: date,
    note: note,
    imageDataUrl: pendingImageDataUrl || null,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now()
  };

  idbPut(entry).then(function () {
    closeJournalForm();
    return loadJournal();
  }).then(renderJournal).catch(function () {
    alert("Could not save the entry.");
  });
}

/* ── Image resize ──────────────────────────────────────── */
function resizeImage(file, maxDim, quality) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var width = img.width;
        var height = img.height;
        var scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Export / Import ───────────────────────────────────── */
function exportData() {
  loadJournal().then(function () {
    var payload = {
      app: "sennelier-studio",
      version: 2,
      exportedAt: new Date().toISOString(),
      owned: state.owned,
      wishlist: state.wishlist,
      restock: state.restock,
      notes: state.notes,
      journal: journal
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, "sennelier-studio-backup.json");
  });
}

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

function importData(file) {
  file.text().then(function (text) {
    var payload;
    try { payload = JSON.parse(text); }
    catch (e) { alert("That file isn't a valid backup."); return; }

    if (!payload || payload.app !== "sennelier-studio") {
      alert("This doesn't look like a Sennelier Studio backup.");
      return;
    }
    if (!confirm("Import will REPLACE your current data. Continue?")) { return; }

    state.owned = payload.owned || {};
    state.wishlist = payload.wishlist || {};
    state.restock = payload.restock || {};
    state.notes = payload.notes || [];
    saveState();

    idbClear().then(function () {
      var entries = payload.journal || [];
      var chain = Promise.resolve();
      entries.forEach(function (entry) {
        chain = chain.then(function () { return idbPut(entry); });
      });
      return chain;
    }).then(function () {
      refreshAll().then(function () {
        alert("Backup imported successfully.");
      });
    }).catch(function () {
      alert("Could not import the journal. Some photos may be missing.");
    });
  });
}

/* ── Tabs & refresh ────────────────────────────────────── */
function switchTab(tabId) {
  $$(".tab").forEach(function (t) {
    t.classList.toggle("active", t.getAttribute("data-tab") === tabId);
  });
  $$(".view").forEach(function (v) {
    v.classList.toggle("active", v.id === "view-" + tabId);
  });
  if (tabId === "home") { renderHome(); }
  if (tabId === "collection") { renderCollection(); }
  if (tabId === "palette") { renderCollectionTabs(); renderPalette(); }
  if (tabId === "sets") { renderSetsView(); }
  if (tabId === "shopping") { renderShopping(); }
  if (tabId === "stats") { renderStats(); }
  if (tabId === "notes") { renderNotes(); }
  if (tabId === "journal") { renderJournal(); }
}

function refreshAll() {
  return loadJournal().then(function () {
    renderCollectionTabs();
    renderHome();
    renderCollection();
    renderPalette();
    renderSetsView();
    renderShopping();
    renderStats();
    renderNotes();
    renderJournal();
  });
}

/* ── Wire up events ────────────────────────────────────── */
function bindEvents() {
  $$(".tab").forEach(function (t) {
    t.addEventListener("click", function () { switchTab(t.getAttribute("data-tab")); });
  });

  $("#collection-search").addEventListener("input", renderCollection);
  $("#collection-filter").addEventListener("change", renderCollection);

  $("#note-save").addEventListener("click", saveNoteFromComposer);

  $("#journal-add").addEventListener("click", function () { openJournalForm(null); });
  $("#j-cancel").addEventListener("click", closeJournalForm);
  $("#j-save").addEventListener("click", saveJournalEntry);
  $("#j-file").addEventListener("change", function (e) {
    handleJournalFile(e.target.files && e.target.files[0]);
  });

  $("#export-btn").addEventListener("click", exportData);
  $("#import-btn").addEventListener("click", function () { $("#import-file").click(); });
  $("#import-file").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) { importData(e.target.files[0]); }
    e.target.value = "";
  });
}

/* ── Init ──────────────────────────────────────────────── */
function init() {
  loadState();
  var cols = colourCollections();
  activeCollectionId = cols[0] ? cols[0].id : null;
  bindEvents();
  refreshAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
