# Bundled typefaces

English | [简体中文](./README.zh-CN.md)

`LedgerSongti.ttf` is a renamed, static weight-600 subset of Noto Serif SC, covering the fixed GB2312 repertoire and common UI punctuation. `LedgerNumbers.ttf` is a renamed, static weight-600 Latin subset of Libre Baskerville. Both are distributed under their included SIL Open Font License 1.1 texts. These open typefaces retain the prototype's serif style with stronger strokes for reading; they do not redistribute proprietary system fonts.

Each file is registered as a separate, single-face family. Client styles and Web FontFace descriptors use normal family matching to select its real weight-600 outlines, rather than requesting synthetic bold from a regular face. The original weight-400 assets were replaced during the readability pass; saved font-choice IDs remain unchanged.

Source URLs, SHA-256 hashes, subset sizes and licenses are recorded in `sources.json`. Run `scripts/prepare-fonts.py` with a directory containing the named original font and license files to reproduce the assets (requires fontTools). No font requests are made by the running app. Body text and uncommon Chinese characters use platform font fallback. Font choice is a device preference, separate from ledger backups.
