# Ledger visual draft — 02

English | [简体中文](./README.zh-CN.md)

Open [index.html](./index.html) to review the five pages, floating bottom navigation, operation sheets, and desktop composition. The single-screen view supports navigation; the board view shows all five pages together.

The background selector compares a white treatment (the current default) with the earlier light green treatment. White removes the large green overview surface, uses neutral text and navigation backgrounds, and retains green for actions and selected states. Font choices and the floating bar are preserved. Switching backgrounds also updates open sheets without resetting inputs. The optional `tone=white` or `tone=green` query selects the initial treatment.

White/green switching was checked with an entered amount and an open account picker: the value, selected typography and sheet state were preserved. The white sheet uses a white surface; all five pages remained free of horizontal overflow at a 375-pixel viewport. The current white preview is `previews/white-overview-details-entry.jpg`; earlier green previews are retained for comparison.

The typography toolbar compares three combinations: all sans-serif; Songti-style headings with sans-serif numbers; and Songti-style headings with Georgia numbers, closer to the earlier draft (the default for this review). Body text stays in the system sans-serif family. Switching updates pages and open operation sheets without resetting demo inputs or scroll. The optional `font=sans`, `font=mixed`, or `font=book` query selects an initial combination. These previews use platform font fallbacks; cross-platform font files have not been packaged.

This independent HTML/SVG study interprets the calm tonal hierarchy of [Gentler Streak](https://gentlerstories.com/gentlerstreak) and the uncluttered numerical/list layout of [Dime](https://apps.apple.com/us/app/dime-budget-expense-tracker/id1635280255). No reference-product artwork, branding, or source code is copied. Fonts use system fallbacks; no external assets or libraries are needed.

All accounts, amounts, entries and dates are fictional. Sample October income is 12,000.00, spending is 2,460.00, and surplus is 9,540.00. Assets are 49,480.00 and debt is 800.00, giving net assets of 48,680.00. The eight sample entries reconcile to the displayed monthly totals.

Search, filters, account selection, optional labels, renaming and valuation operate on temporary demonstration state. Save/export/import controls show their intended interaction without reading or writing a ledger, database, browser storage, files or network service. Reloading resets the demo. The approved white/book treatment is now being integrated into the production React Native client; this HTML remains an independent reference. See the [development guide](../../../docs/DEVELOPMENT.md) and [verification](../../../docs/VERIFICATION.md) for implementation status, bundled fonts and native checks.

This is a visual review artifact, not a production implementation or a complete accessibility specification. Account creation and transaction editing illustrate their panels without implementing ledger mutations. Real bookkeeping and font preferences live in the shared app rather than this demo.

Browser review covered the five-page board, desktop overview, and a 375-pixel mobile viewport. Salary search, income filtering, account-picker return, optional labels and the simulated save notice were checked. On the small-screen entry page, the save button remained above the floating bar without horizontal overflow. Static previews are in `previews/`.

Typography review checked all three combinations, including a live account-selection sheet. Switching preserved the entered amount and note, kept the sheet open, and updated its heading. All five pages retained their width at 375 pixels with the serif-number combination; the save button remained above navigation. `previews/typography-book.jpg` shows this combination.
