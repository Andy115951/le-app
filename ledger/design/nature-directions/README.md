# Nature-inspired visual studies

English | [简体中文](./README.zh-CN.md)

The follow-up [fresh green draft — 02](./fresh/index.html) develops one cohesive direction inspired by Gentler Streak and Dime, with floating navigation, all five pages, and operation sheets. The three original directions below remain available for comparison.

Open [the interactive prototype](./index.html) in a browser. It compares three green directions across Overview, Entries, Add Entry, Assets, and Settings, with individual previews and a desktop layout. All financial content is synthetic. Inputs and navigation are temporary in-memory demos; nothing reads or writes the real ledger.

The toolbar can switch the mobile bottom navigation between docked and floating treatments. Floating navigation leaves space around the bar and keeps bottom content scrollable; desktop navigation stays in the sidebar.

- **Forest whitespace**: light green, sans-serif typography, a restrained landscape strip.
- **Misty oil painting**: ivory, moss green, serif headings and numbers, a painted overview landscape.
- **Woodland journal**: warm paper, olive ink, straight rules, a small landscape insert.

These are standalone design studies. The production React Native, database, and CLI code are unchanged. Chinese serif/handwriting-like headings currently use platform font fallbacks; final cross-platform font selection remains part of the selected direction's implementation.

The directions vary beyond the artwork: entry fields, amount surfaces, optional labels, numeric keypads, save buttons, list grouping, account presentation, settings rows, navigation, and operation panels all receive their own treatment. Try the account picker, account editor, valuation panel, label editor, or import preview. The account picker updates only the demonstration form; confirmation panels do not perform financial operations.

A separate editable Figma study contains three overview directions and the recommended direction's four inner pages plus account selection, valuation, account editing, and import-confirmation panels. Its text uses Noto Sans SC and Noto Serif SC; the HTML preview uses local platform fallbacks of the corresponding type category.

The original landscape in `assets/mist-lake.png` was generated with the built-in image generation tool. The supplied game screenshot served as a verbal mood reference only and was not copied into the project or uploaded to Figma. The painting is an image asset; all prototype text, icons, amounts, and controls remain HTML/SVG.

Generation prompt:

> Original panoramic oil/gouache landscape for a calm personal ledger: muted moss-green and fresh yellow-green trees framing a pale grey lake, distant shoreline dissolving into silver-white fog, tiny burnt-orange foliage accents. Airy autumn morning, layered painterly brush strokes and subtle canvas grain. Pale negative space through the centre; green foliage and white birch trunks at the outer edges. No text, UI, logos, watermarks, frames, fantasy or game objects.

Serve this folder using a local static server if preferred. No build step, external CDN, credentials, account, or network service is required by the prototype.
