/* ============================================================
   SENNELIER STUDIO — app logic
   - Collection / Notes state  -> localStorage (tiny)
   - Art journal (photos)      -> IndexedDB  (big)
   - Export / Import           -> one JSON backup file
   ============================================================ */

"use strict";

/* ── Constants ─────────────────────────────────────────── */
var LS_KEY = "sennelier-studio:v1";
var DB_NAME = "sennelier-studio";
var DB_STORE = "journal";
var DB_VERSION = 1;

/* ── State ─────────────────────────────────────────────── */
var state = {
  owned: {},     // { collectionId: [code, ...] }
  wishlist: {},  // { collectionId: [code, ...] }
  notes: []      // [{ id, text, createdAt, updatedAt }]
};

var journal = []; // loaded from IndexedDB: [{ id, title, date, note, imageDataUrl, createdAt }]
var activeCollectionId = null;
var editingNoteId = null;
var editingJournalId = null;
var pendingImageDataUrl = null;

/* ── Small helpers ─────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ── localStorage (collection + notes) ─────────────────── */
function loadState() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      state.owned = parsed.owned || {};
      state.wishlist = parsed.wishlist || {};
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

/* ── Collection helpers ────────────────────────────────── */
function ownedList(collId) { return state.owned[collId] || []; }
function wishlistList(collId) { return state.wishlist[collId] || []; }
function isOwned(collId, code) { return ownedList(collId).indexOf(code) !== -1; }
function isWishlisted(collId, code) { return wishlistList(collId).indexOf(code) !== -1; }

function toggleOwned(collId, code) {
  var list = ownedList(collId);
  var i = list.indexOf(code);
  if (i !== -1) { list.splice(i, 1); } else { list.push(code); }
  state.owned[collId] = list;
  saveState();
}

function toggleWishlist(collId, code) {
  var list = wishlistList(collId);
  var i = list.indexOf(code);
  if (i !== -1) { list.splice(i, 1); } else { list.push(code); }
  state.wishlist[collId] = list;
  saveState();
}

/* ── Collection rendering ──────────────────────────────── */
function currentCollection() {
  var cols = window.SENNELIER_COLLECTIONS || [];
  return cols.filter(function (c) { return c.id === activeCollectionId; })[0] || cols[0] || null;
}

function renderCollectionTabs() {
  var nav = $("#collection-tabs");
  nav.innerHTML = "";
  (window.SENNELIER_COLLECTIONS || []).forEach(function (coll) {
    var btn = document.createElement("button");
    btn.className = "coll-tab" + (coll.id === activeCollectionId ? " active" : "");
    btn.textContent = coll.name;
    btn.onclick = function () {
      activeCollectionId = coll.id;
      renderCollectionTabs();
      renderCollection();
    };
    nav.appendChild(btn);
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

  var owned = ownedList(coll.id);
  var wish = wishlistList(coll.id);
  var total = (coll.colors || []).length;
  $("#collection-count").textContent = owned.length + " owned · " + wish.length + " on wishlist · " + total + " total";

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
    var matchesFilter = true;
    if (filter === "owned") { matchesFilter = o; }
    else if (filter === "wishlist") { matchesFilter = w; }
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

  var card = document.createElement("button");
  card.className = "swatch" + (owned ? " owned" : "") + (wish ? " wish" : "");
  card.type = "button";
  card.title = color.name + (owned ? " (owned)" : "");

  card.innerHTML =
    '<span class="swatch-chip" style="background:' + (color.hex || "#eee") + '"></span>' +
    '<span class="swatch-info">' +
      '<span class="swatch-code">' + escapeHtml(color.code || "—") + '</span>' +
      '<span class="swatch-name">' + escapeHtml(color.name) + '</span>' +
    '</span>' +
    '<span class="swatch-owned">✓</span>' +
    '<span class="swatch-star" title="Wishlist">' + (wish ? "★" : "☆") + '</span>';

  card.addEventListener("click", function (e) {
    var star = e.target && e.target.closest ? e.target.closest(".swatch-star") : null;
    if (star) {
      toggleWishlist(coll.id, color.code);
    } else {
      toggleOwned(coll.id, color.code);
    }
    renderCollection();
  });

  return card;
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

/* ── Journal rendering ─────────────────────────────────── */
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
  return loadJournal().then(function () {
    var grid = $("#journal-grid");
    grid.innerHTML = "";
    if (journal.length === 0) {
      grid.innerHTML = '<div class="empty">No art entries yet. Click "＋ Add art" to add your first piece.</div>';
    }
    journal.forEach(function (entry) {
      grid.appendChild(renderJournalCard(entry));
    });
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
      idbDelete(entry.id).then(renderJournal).catch(function () {});
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
    renderJournal();
  }).catch(function () {
    alert("Could not save the entry.");
  });
}

/* ── Image resize (keeps backups/storage small) ────────── */
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
      version: 1,
      exportedAt: new Date().toISOString(),
      owned: state.owned,
      wishlist: state.wishlist,
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
  if (tabId === "collection") { renderCollection(); }
  if (tabId === "notes") { renderNotes(); }
  if (tabId === "journal") { renderJournal(); }
}

function refreshAll() {
  renderCollectionTabs();
  renderCollection();
  renderNotes();
  return renderJournal();
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
  var cols = window.SENNELIER_COLLECTIONS || [];
  activeCollectionId = cols[0] ? cols[0].id : null;
  bindEvents();
  refreshAll();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
