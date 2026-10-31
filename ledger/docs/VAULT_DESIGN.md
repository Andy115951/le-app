# Little vault

English | [简体中文](./VAULT_DESIGN.zh-CN.md)

Status: the accepted natural-light direction is integrated into the shared production client. The earlier isolated HTML studies remain design history and use fictional amounts only. Bundled fonts retain their SIL OFL notices.

## Production integration — 2026-10-29

Assets renders `LittleVault` from the current computed net-assets value. React Native SVG combines bundled cabinet artwork, the six-cell natural-light gold atlas, contact shadows and shelves; no network requests or additional financial storage are needed. Amounts remain integer cents. Cabinet thresholds are CNY 100,000 and CNY 1,000,000, followed in both directions. Zero and negative values show an empty small safe; negative values retain a signed numeric net amount and an explanatory note. Large inventories show bounded artwork plus the exact total count.

Settings → Appearance → Little vault is an independent, device-local switch, on by default when no preference is stored; an explicit saved off choice is preserved. Its key/value preference is separate from fonts, the ledger and JSON backups; save failure leaves the previous setting active and shows a retry message. Existing font preferences remain compatible. Concealment unmounts the amount-dependent scene, tier, descriptions and accessibility labels, replacing them with a fixed-size closed safe. The vault has its own eye button and session visibility, independent of numeric asset visibility. The vault starts concealed and resets on leaving Assets or backgrounding. Numeric asset visibility remembers its local choice across navigation and restart; background/blur concealment is temporary and does not erase that choice. Opening the vault alone reveals its inventory and tier while numeric asset fields remain masked.

TypeScript and 14 tests pass, including cent boundaries, tier changes, bounded large inventories and constant concealed presentation. Android/Hermes and desktop Web exports include all offline artwork; the regular Android test APK builds successfully. A read-only synthetic production-view preview passed wide and 390-pixel layout review, initial off state, enable/reload persistence, concealment without residual amounts or tier labels in the DOM, and leave/return concealment. Native Android rendering/touch/background acceptance and packaged desktop visual acceptance remain pending. The regular Android package was subsequently updated in place after explicit authorization; package/signature compatibility, retained installation/data-directory identity and app launch were checked without reading or writing financial records. Fine-grained aggregation and upgrade animations remain deferred.

## Agreed mapping

| Value                   | Representation                 |
| ----------------------- | ------------------------------ |
| CNY 10,000              | One gold bar                   |
| CNY 1,000               | One coin                       |
| CNY 100                 | One grain                      |
| Remainder below CNY 100 | A variable amount of gold dust |

These are fixed visual denominations, independent of gold prices. For example, a fictional CNY 12,345 becomes one bar, two coins, three grains and CNY 45 of dust. Calculate the decomposition in integer cents, including fractional yuan. Dust size and particle count vary with the remainder; exact numbers remain authoritative because tiny differences cannot all be visually distinct.

## Display and controls

- Use net assets as the visualization basis. Retain the exact net amount, total assets, liabilities and account list.
- An independent **Settings → Appearance → Little vault** switch is on by default in production unless explicitly disabled. The draft starts enabled for review. This setting changes presentation only.
- Numeric amounts and vault contents have separate eye controls. A concealed vault shows a fixed closed safe without denominations or value-dependent contents, regardless of numeric visibility. Amounts retain held-peek behavior. Only the vault resets on exit/background; numeric display restores its saved local choice when Assets is revisited.
- For larger values, draw a bounded stack of bars and show the full bar count. Do not imply a capacity limit or change the agreed denominations. The latest growth study shows at most 9, 30 or 48 bars depending on the cabinet, and explicitly discloses any omitted bars as stored inside.
- Show an empty vault for zero and negative net assets, with an explicit negative-state explanation. Preserve the signed numeric net amount.
- The draft supports amount entry, fictional presets, increases/decreases, denomination boundaries and the appearance switch. It performs no financial writes and saves no preferences.

## Motion and review

### Material study 05

The next rendering study addresses the pasted-on appearance without changing denominations, thresholds or financial data. It uses a separate six-cell atlas: three similarly sized ingot surface variants, a flat coin, a leaning coin and a nugget. Localized contact shadows, consistent lighting, small deterministic placement variations and interior clipping connect the objects to the cabinet. Small inventories are grouped together; shelves have separate top/front faces. This remains a 2D composition, without physically simulated lighting or full 3D occlusion.

The preview provides **Original / Natural light** controls at the same amount and cabinet size, a side-by-side material view, and explicit CNY 45 / 135 presets. Browser checks confirmed that these display dust only versus one grain plus CNY 35 of dust, switching materials preserves CNY 135, and CNY 128,888.88 still renders 12 bars, 8 coins and 8 grains. Side-by-side screenshot review completed on 2026-10-29: the natural-light version has more subdued highlights, flatter coin stacks and better contact with the shelves; repeated bar silhouettes remain visible. This is a reviewed prototype, pending the user's visual acceptance. No production integration or record access occurred.

### Growth study 04 — current direction

The safe now faces straight toward the viewer. The cabinet and gold are separate layers, so the amount controls change the rendered object counts instead of keeping a fixed still life. Three provisional tiers are available for review:

| Net assets                         | Cabinet                                               |
| ---------------------------------- | ----------------------------------------------------- |
| Below CNY 100,000                  | Small, low ivory safe                                 |
| CNY 100,000 to below CNY 1,000,000 | Larger reinforced safe, brass inner frame and shelves |
| CNY 1,000,000 and above            | Sage-green steel vault with more storage shelves      |

The thresholds are draft choices. The prototype follows the current net value in both directions; it does not retain the highest tier ever reached. The fixed 330-unit scene uses the same 36-unit bar sprite, 24-unit coin and 14-unit grain at every tier. The cabinet grows gently within the first two tiers and changes structure at each threshold; bar size is not progressively reduced. The phone view crops unused space above smaller cabinets without changing the scene's horizontal scale. A fixed baseline in the comparison gallery makes the size differences visible.

Negative net assets show an empty small safe with a signed numeric amount. Zero is also empty. Hiding amounts removes the cabinet, tier, contents and counts and uses a constant placeholder size. The independent display switch and all amount controls are ephemeral, synthetic preview state. Large totals beyond the three visual tiers retain exact counts and an explicit partial-display note; this is not a financial capacity limit. Further tiers and the final threshold policy remain open design decisions.

Browser checks covered 99.99/100, 99,980 + 20 and 999,980 + 20, unchanged bar dimensions at tier transitions, explicit large-count disclosure, concealment, the independent switch and narrow-layout overflow. All results are prototype checks; no production integration, phone update or user-record access occurred. The short appearance transitions do not yet implement complete aggregation or cabinet-upgrade animations.

### Earlier studies

Visual study 03 used a painterly warm-ivory safe with a sage-grey interior, an open wheel-handle door and grouped gold contents. The earlier safe sketch was rejected for its execution; this did not rule out the safe form itself. Study 03 is static; the later growth study separates artwork into cabinet and gold layers.

The first literal safe illustration was rejected as visually unappealing. A second visual study compares AI-generated warm ivory ceramic and painterly pale-oak containers using the same asset-page layout, a smaller illustration area and a single-line denomination caption. Both variants are now available for side-by-side and individual viewing. This study is static: the fictional CNY 12,345 composition does not change with transactions. Production will need separate reusable pieces and container artwork before implementing amount-driven layouts and transitions. No generated study artwork has been added to the production app.

The original interaction draft briefly animates changed groups and dust. It does not yet implement physical particle aggregation or coin-to-bar morphing. It respects reduced-motion preferences. Review the illustration proportions, dust visibility, group placement, large-value stacking and space occupied on narrow screens before production integration.

Browser checks confirmed the CNY 99.99/100 boundary, CNY 9,990 + 20 boundary, million-yuan stacking, zero/negative states, concealment and independent settings controls. A narrow layout had no horizontal overflow. These are prototype checks, not Android or production acceptance.
