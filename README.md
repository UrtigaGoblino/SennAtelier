# 🎨 Art Studio

A small, private web app for keeping track of a personal **art supply collection** — across brands (Sennelier, Artist Gallery, and more to come) — plus notes and a little **art journal** of the pieces you make.

Everything runs in the browser. **Your data never leaves your device** — it's stored only in *your* browser (on *your* computer or phone), and nothing is uploaded anywhere.

---

## ✨ What it does

| Tab | What it's for |
| --- | --- |
| 🏠 **Home** | Your dashboard — progress rings, stick counter, and a quick glance at each collection. |
| 🎨 **Collection** | Every range as a grid of colours, **grouped by brand**. **Tap a colour** to mark it *owned* (✓). Tap **☆** for your *wishlist*, and **🔁** to flag something for *restock*. Search and filter to find things fast. |
| 🌈 **Palette** | Your *owned* colours laid out in rainbow order — like opening your actual pastel box. |
| 🛍️ **Shopping** | Your wishlist + restock list in one place, ready for the art shop. |
| 📊 **Stats** | Totals, per-collection progress, and your favourite colour families. |
| 📓 **Notes** | A simple notebook. Write wishlist ideas, techniques, colour-mixing notes — anything. |
| 🖼️ **Art Journal** | Add a **photo** of your art, plus a **title**, **date**, and an optional **note**. |
| 📖 **Help** | Quick in-app instructions. |

---

## 💾 Saving & backing up (important!)

Your data is stored in the browser, so:

- It is **per device** and **per browser** — your phone and your laptop each have their own separate data.
- It **does not sync** across devices.
- If you clear this site's data (or "site data" in browser settings), everything is erased.

So use the two buttons at the top right:

- **⬇ Export backup** — downloads one file (`sennelier-studio-backup.json`) containing *everything*: collection, notes and photos. Keep it somewhere safe.
- **⬆ Import backup** — on a new computer/browser, choose that file to restore everything.

> Think of Export as "save" and Import as "open". That's all the technical knowledge you need.

---

## 🧱 How this app is organised

It's just four files plus a data file — no build step, no server:

```
sennelier-studio/
├── index.html            ← the page structure
├── styles.css            ← the look & feel
├── app.js                ← the behaviour (storage, rendering, export/import)
├── data/
│   └── collections.js    ← ★ the collection data (edit THIS to add collections)
└── README.md             ← this file
```

- Collection/notes state → saved in `localStorage` (tiny).
- Art journal photos → saved in `IndexedDB` (the browser's larger storage, so photos don't run out of room).

---

## ➕ Adding a new collection (or a whole new brand)

You only need to edit **one file**: `data/collections.js`.

1. Open `data/collections.js`.
2. Copy any collection entry.
3. Fill in:
   - `id` — a **unique** short id (lowercase, no spaces). ⚠️ Never reuse an id: saved "owned" data is keyed by it, so duplicate ids would share data.
   - `brand` — the maker (e.g. `"Sennelier"`, `"Artist Gallery"`). Collections with the same brand are grouped together.
   - `name`, a short `blurb`, and a `colors` list.
4. Each colour is `{ "code": "001", "name": "White", "hex": "#f6f5f1" }`:
   - `code` — the colour's official number (as text, e.g. `"001"`).
   - `name` — the colour name.
   - `hex` — an approximate on-screen swatch colour (refine against the real sticks).

Then save and re-deploy (see below). No other file needs to change.

> The data file currently holds **8 collections across 2 brands — 1,048 items**:
>
> - **Sennelier** — Oil Pastels (120), Oil Pastels Iridescent (10), Extra-Fine Oil Sticks (64), Soft Pastels "à l'écu" (499), Iridescent Soft Pastels (25), Special Sets (10 themed collector sets)
> - **Artist Gallery** — Oil Pastels (120), Extra Fine Soft Pastels (200, MPA Gallery Series)
>
> Colour names/numbers come from official charts and retailer listings; on-screen swatch colours come from retailer swatches (pontodasartes.com) or hand-picked values, so they're genuinely accurate.

---

## 🤖 Growing the app with your favorite AI

This project is deliberately simple so **any** AI assistant — ChatGPT, Claude, Gemini, Copilot, whatever you use — can help you change it. **Send this README to your AI** and describe what you want. Good prompts to try:

- *"Add a `deleteAll` / clear button to the Collection tab."*
- *"Let me reorder notes by dragging them."*
- *"Add a colour picker so I can edit an item's swatch colour."*
- *"Make the Export backup also download just the notes as a text file."*

Paste the relevant file(s) (usually `app.js`, or `data/collections.js` for data changes) into the chat and describe what you want. Always test afterward with a backup file exported first.

---

## 🚀 Hosting on GitHub Pages (free)

The app should be opened from a real web address, not a local file, so that browser storage is reliable. GitHub Pages is free:

1. Create a **new repository** on GitHub (it must be **public** on a free account).
2. Upload this whole folder's contents so `index.html` is at the top level.
3. In the repo, go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, select `main` and `/ (root)`, and **Save**.
5. GitHub gives you a link like `https://<your-username>.github.io/<repo-name>/`. Send that link.

For step-by-step Git commands, see the "Deploying" section of your chat with your assistant.

---

Made with 💛 for a very special artist.
