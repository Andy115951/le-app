# Little vault artwork

English | [简体中文](./README.zh-CN.md)

Four transparent PNGs generated with OpenAI imagegen for this project and visually reviewed before import. They contain no customer records, inscriptions or screenshots. Generated provenance metadata is retained. Files are bundled for offline Android and desktop rendering.

- `safe-small.png`, `safe-reinforced.png`, `safe-vault.png`: empty, front-facing ivory/sage cabinets, with the open door visible at the right edge; painterly gouache/oil direction.
- `gold-natural-atlas.png`: 1536 × 1024 atlas of six 512-pixel cells. Three subtle ingot variants occupy the first row; a flat coin, leaning coin and nugget occupy the second row. Matte honey gold, upper-left light and sage reflected shadows.

`little-vault.tsx` positions and clips atlas cells directly in the parent SVG scene, with contact shadows, deterministic placement and cabinet-interior clipping. Avoid nested SVG viewports for sprite positioning because Android does not apply their x/y origins like browsers. Do not replace these assets with financial screenshots. See [vault design](../../../../docs/VAULT_DESIGN.md) for denominations and privacy behavior.
