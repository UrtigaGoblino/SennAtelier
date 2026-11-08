# 🎨 Art Studio

A small, private web app for keeping track of a personal **art supply collection** — across brands (Sennelier, Artist Gallery, and more to come) — with **titles, ranks, goals and confetti** to make collecting fun, plus notes and a little **art journal** of the pieces you make.

Everything runs in the browser. **Your data never leaves your device** — it's stored only in *your* browser (on *your* computer or phone), and nothing is uploaded anywhere.

**🔗 Live app:** https://urtigagoblino.github.io/SennAtelier/

---

## ✨ What it does

| Tab | What it's for |
| --- | --- |
| 🏠 **Home** | Your dashboard — progress ring, **collector rank**, stick counter, a **🎯 Goals** card, and a quick glance at each collection. |
| 🎨 **Collection** | Every range as a grid of colours, **grouped by brand** (Sennelier, Artist Gallery…). **Tap a colour** to mark it *owned* (✓). Tap **☆** for your *wishlist*, and **🔁** to flag something for *restock*. Search and filter to find things fast. |
| 🌈 **Palette** | Your *owned* colours laid out in rainbow order — like opening your actual pastel box. |
| ✨ **Sets** | The limited themed collector sets, grouped by brand. Collect a set to earn its **title**. |
| 🛍️ **Shopping** | Your wishlist + restock list in one place, ready for the art shop. |
| 📊 **Stats** | Totals, progress per collection, and your favourite colour families. |
| 🏅 **Titles** | Achievements you've earned — **collector ranks**, **collection masters**, **set titles** and **fun titles**. |
| 📓 **Notes** | A simple notebook. Write wishlist ideas, techniques, colour-mixing notes — anything. |
| 🖼️ **Art Journal** | Add a **photo** of your art, plus a **title**, **date**, and an optional **note**. |
| 📖 **Help** | Quick in-app instructions. |

---

## 🏅 Titles, ranks & goals (the fun part!)

Collecting unlocks **titles** — and a **confetti burst** 🎊 fires when you earn a new one.

- **Collector ranks** — level up as you own more colours: 🌱 Curious Beginner → 🖌️ First Brushstroke → 🎨 Colour Collector → 🌈 Palette Explorer → 💎 Hue Hero → 🏆 Colour Maestro → 👑 Legend of Colour.
- **Collection Masters** — complete a whole range (100%) to earn its Master title.
- **Set Titles** — each limited themed set grants its own title when collected (e.g. 🍂 Autumn Wanderer, ⛈️ Storm Chaser, 🎨 Impressionist).
- **Fun titles** — extras like 🎁 Set Collector, ✨ Iridescent Dreamer, 🌈 Rainbow Rider, 📝 Note Taker, 🖼️ Art Journalist.

The **Home** tab shows your current rank and a **"Goals" card** with the closest rewards to chase. See everything on the **🏅 Titles** tab.

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
   - `hex` — the on-screen swatch colour.
5. *(Optional)* To add a **collectible set** instead of colours, add `kind: "sets"` to the collection entry. Each set can also carry a `title` and `icon` (e.g. `"title": "Autumn Wanderer", "icon": "🍂"`) — collecting it then earns that title.

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
