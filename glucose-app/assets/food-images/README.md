# Food photography assets

The website uses a coordinated set of AI-generated food photographs. Each
catalog food or separately illustrated recipe ingredient has its own WebP in
`public/images/foods/`. The images are bundled locally with the application;
the website does not depend on external image hosts.

Each adjacent `<food-id>.json` records the full generation prompt, date, output
path and use of the built-in `image_gen` tool. The common direction is a single
recognizable food on a warm off-white background, natural texture, soft daylight
and no text or branding. Recipes keep their actual ingredient names, with
separate images for corn kernels and whole corn, and for different sweet potato
preparations.

`scripts/prepare-food-image.mjs` preserves the composition while resizing each
selected image to 640 × 640 and compressing it to WebP. The original generation
outputs remain in the image tool's original location. The WebP files are the
final application assets.

Image generation does not change the food database's GI values, sources,
portions or preparation descriptions.
