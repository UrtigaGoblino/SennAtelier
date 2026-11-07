// ============================================================================
//  SENNELIER STUDIO — PASTEL COLLECTION DATA
// ============================================================================
//  This is the ONLY file you need to edit to add or change pastel collections.
//  Each entry below is one "collection" (one Sennelier range).
//
//  ┌─────────────────────────────────────────────────────────────────────┐
//  │  TEMPLATE — copy this to add a new collection:                      │
//  │                                                                     │
//  │  {                                                                  │
//  │    id: "my-new-collection",        // lowercase, no spaces, unique  │
//  │    name: "Extra Soft Pastels",     // shown in the app              │
//  │    blurb: "The newer soft line.",  // short description (optional)  │
//  │    colors: [                                                         │
//  │      { code: "001", name: "White", hex: "#f6f5f1" },               │
//  │      // ... one object per colour ...                                │
//  │    ]                                                                │
//  │  },                                                                 │
//  └─────────────────────────────────────────────────────────────────────┘
//
//  NOTES:
//   * `code`  = the colour's official number (use a string, e.g. "001").
//   * `name`  = the colour name.
//   * `hex`   = an APPROXIMATE swatch colour shown in the app. These are
//               only for on-screen preview and should be refined against
//               the real sticks.
//
//  OFFICIAL SOURCES to check against:
//   * Soft Pastels "à l'écu" (525 colours):
//     https://www.sennelier-colors.com/article/photo/dossier512/Colourchart_Pastel_Ecu.pdf
//   * Oil Pastels (120 colours):
//     https://artistpigments.org/brands/sennelier-artist-oil-pastel
// ============================================================================

window.SENNELIER_COLLECTIONS = [

  // ── Sennelier Oil Pastels ───────────────────────────────────────────────
  // Real data (numbers, names, pigments) from artistpigments.org.
  // hex values are approximate on-screen swatches.
  {
    id: "oil-pastels",
    name: "Oil Pastels",
    blurb: "The famous chunky sticks — 120 colours.",
    colors: [
      { code: "001", name: "White",                  hex: "#f6f5f1" },
      { code: "221", name: "Transparent Medium",     hex: "#e7e0d4" },
      { code: "021", name: "Naples Yellow",          hex: "#f3d27a" },
      { code: "201", name: "Nickel Yellow",          hex: "#e9d76a" },
      { code: "019", name: "Lemon Yellow",           hex: "#f4e04a" },
      { code: "022", name: "Gold Yellow",            hex: "#e5b82e" },
      { code: "074", name: "Yellow Lake",            hex: "#e8a920" },
      { code: "020", name: "Yellow Deep",            hex: "#e0a51e" },
      { code: "233", name: "Luminous Yellow",        hex: "#f6cf4c" },
      { code: "018", name: "Bright Yellow",          hex: "#f4c71f" },
      { code: "200", name: "Mandarin",               hex: "#ef8a1d" },
      { code: "090", name: "Chinese Orange",         hex: "#de521f" },
      { code: "038", name: "Vermillion",             hex: "#e3422c" },
      { code: "029", name: "Red Light",              hex: "#d52f3c" },
      { code: "220", name: "Permanent Intense Red",  hex: "#c02130" }
    ]
  },

  // ── Sennelier Soft Pastels "à l'écu" ────────────────────────────────────
  // SAMPLE DATA — the full range has 525 colours. Fill in the real list
  // using the official PDF chart linked above.
  {
    id: "soft-pastels",
    name: "Soft Pastels (à l'écu)",
    blurb: "The classic half-stick range — 525 colours. (Sample data — fill in the full list.)",
    sample: true,
    colors: [
      { code: "—", name: "Cadmium Yellow (sample)", hex: "#f5d02e" },
      { code: "—", name: "Vermilion (sample)",      hex: "#e0492f" },
      { code: "—", name: "Ultramarine (sample)",    hex: "#2b3fa0" },
      { code: "—", name: "Emerald Green (sample)",  hex: "#1f8a5b" },
      { code: "—", name: "Ivory Black (sample)",    hex: "#2a2a28" }
    ]
  }

];
