# Little vault artwork

English | [简体中文](./README.zh-CN.md)

Five transparent PNGs generated with OpenAI imagegen for this project and visually reviewed before import. They contain no customer records, inscriptions or screenshots. Generated provenance metadata is retained. Files are bundled for offline Android and desktop rendering.

- `safe-small.png`, `safe-reinforced.png`, `safe-vault.png`: empty, front-facing ivory/sage cabinets, with the open door visible at the right edge; painterly gouache/oil direction.
- `gold-natural-atlas.png`: 1536 × 1024 atlas of six 512-pixel cells. Three subtle ingot variants occupy the first row; a flat coin, leaning coin and nugget occupy the second row. Matte honey gold, upper-left light and sage reflected shadows.
- `gold-cylinder-natural.png`: 2061 × 763 transparent horizontal cylindrical gold rod for the CNY 1,000 denomination. Generated with the built-in imagegen tool from the existing cylinder material reference. Final prompt: one solid gold cylinder lying on its curved side with its axis running left to right, a prominent round left end and a continuous convex side, roughly 2.7 times as wide as tall; match matte honey gold, upper-left natural light and painterly texture, with a transparent background and no repeated rings, text, markings, base, glow or cast shadow. The imported sprite is clipped to its visible object bounds at render time.

`little-vault.tsx` positions and clips atlas cells directly in the parent SVG scene, with contact shadows, deterministic placement and cabinet-interior clipping. Avoid nested SVG viewports for sprite positioning because Android does not apply their x/y origins like browsers. Do not replace these assets with financial screenshots. See [vault design](../../../../docs/VAULT_DESIGN.md) for denominations and privacy behavior.
