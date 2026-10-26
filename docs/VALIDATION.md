# Migration validation

English | [简体中文](./VALIDATION.zh-CN.md)

Validation snapshot: 2026-10-26. Checks used synthetic fixtures and local databases, without live model calls, cloud writes, or production deployment.

| Project | Result |
| --- | --- |
| Candle Taro | Draft, history, and model-configuration tests passed. Type checking and production build passed with `npm run build -- --webpack`. Changed configuration and smoke-script files passed ESLint. |
| Timing Lite | Four frontend statistics tests, eleven Rust tests, and the frontend production build passed. |
| Nasdaq Dashboard | All 278 tests passed. A test now supplies a fixed clock for its historical fixture. |
| Sugar Notes Web | 38 domain, account, and configuration tests, 100 local PostgreSQL assertions, type checking, and production build passed. |
| Sugar Notes Mobile | 41 tests, type checking, lint, and Web export passed. |

Public configuration download was checked with mocked requests, including target mismatch, private-key rejection, and preserving an existing file on failure. A deployment dry run accepted a custom project name and refused a mismatched binding without deploying.

## Known limitations

Candle Taro's full `npm run lint` reports eight inherited `react-hooks/set-state-in-effect` errors and one image warning. Those component and hook implementations are unchanged in this migration. The newly changed configuration and smoke-script files pass lint; this snapshot does not claim that the complete project has a clean lint baseline.

The default Turbopack build could not bind an internal worker port in the validation environment. The same source completed the Webpack production build. Initial font fetching also requires access to the app's existing Google Fonts resources.

Live Supabase integration, live model smoke calls, Android package rebuilding, physical-device acceptance, and production deployment were not repeated as part of migration preparation.

## Source review

The public tree was checked for local environment files, database exports, signing material, personal service identifiers, and exact locally configured secret values. Environment examples contain placeholders only. Dependencies and generated outputs are excluded from Git; the source repository's history is not imported.

All five package manifests (the root tooling and four npm-dependent apps) completed isolated lockfile installs with `npm ci --ignore-scripts --no-audit --no-fund`. The stock dashboard has no local npm dependencies. Installation lifecycle scripts were not executed during this check.

## Browser startup check

A follow-up browser check on 2026-10-26 started Candle Taro with the mock provider and no production environment files. The first launch found a missing macOS Lightning CSS optional package: npm had reported a successful install despite dropping that optional download. Re-running `npm install --include=optional` repaired the local installation, and both CSS native modules then loaded successfully. The earlier build check had used an existing dependency tree, so it did not cover this failure.

Verified in the browser: home rendering, scene-to-form navigation, advanced spread options, question and spread recovery after refresh, clearing the synthetic draft, the 78-card reference, English-name search, card detail, upright/reversed switching, and login/register form switching. No accounts or readings were submitted.

No Supabase configuration is present in this local checkout. The quota request fails, and the UI currently misrepresents that failure as an exhausted `0/0` allowance. Complete readings, persisted history, and account submission still require a separate configured test database and remain unverified by this browser check.

## Other application startup checks

On 2026-10-26, the remaining four projects were checked from this repository with its freshly installed dependencies. No production environment files, cloud accounts, or personal databases were loaded.

| Application | Observed browser behavior | Limits and findings |
| --- | --- | --- |
| Timing Lite | Vite starts; statistics and activity-list views render. | Browser-only use reports a missing Tauri `invoke` bridge and cannot read or capture activities. An existing desktop instance already occupies the shared single-instance port; it was left running. The migrated desktop app's capture, tray, and permissions were not exercised. |
| Nasdaq Dashboard | Quotes and public news load; adding a synthetic AMD watchlist item, searching, and restoring the item/filter after reload work. | A temporary HTTP adapter exercised the repository's actual read-only API handlers without linking Vercel. This does not validate Vercel routing or deployment. Database-backed calendar, earnings, snapshots, and research panels return unavailable states because Supabase is not configured. |
| Sugar Notes Web | Home, demo entry, synthetic glucose save, meal reuse/save, food details, history chart, and fasting filter work. | Demo changes disappear after a full reload as documented. Real registration, login, cloud persistence, and export were not exercised. No captured browser console errors during these checks. |
| Sugar Notes Mobile | Web export/preview, demo entry, synthetic glucose save, food search/detail/favorite, history/context filter, suggestion-to-meal save, and member switching work. Switching to the other demo member shows no records; switching back restores the synthetic records. | This verifies the Expo Web client. Android/iOS runtime, keyboard, permissions, SecureStore, and cloud persistence were not exercised. No captured browser console errors during these checks. |

Issues observed in the initial check (see the follow-up fixes below):

- Nasdaq watchlist rows show missing cost and share values as `0.00`. Reproduce by adding an observation item with both fields blank. `stock-dashboard/app.js` uses `Number(null)` in holding metadata checks; absence should remain distinct from an actual zero. No account or real position is needed to reproduce.
- MAGS remains without a quote in the primary market panel during repeated refreshes, even though other quotes and the public-news handler return data. Quote-source coverage/fallback still needs investigation; the overall refresh-success label does not indicate this partial result.
- Timing's browser-only preview exposes a raw bridge error. A clearer instruction to launch the Tauri host would improve the first-run experience; this is not evidence that desktop capture itself failed.

Fresh checks in this directory passed: Timing frontend 4 tests and Rust 11 tests; Nasdaq 278 tests; Sugar Notes Web typecheck, 38 tests, and 100 temporary PostgreSQL assertions; Sugar Notes Mobile 41 tests, typecheck, lint, and Web export. Source code was not changed in this startup-check round. These results do not certify complete production functionality.

## Startup fixes and credential review

Follow-up on 2026-10-26:

- Missing watchlist cost/share values are now omitted rather than displayed as zero. MAGS was absent from the primary public quote response. An independent public Yahoo chart fallback now supplies missing US quotes through `/api/global-stock/quote`, with validation and timeouts; if both sources fail, missing prices remain missing and the page reports partial results. Live read-only HTTP and browser checks confirmed MAGS price and chart data, and rows no longer show blank holdings as zero. The PWA shell cache version was advanced for the changed client modules.
- Tarot distinguishes quota-service failure from a successful exhausted-quota response. Home and new-reading pages show an unavailable state and retry action; creating readings and sending follow-ups remain blocked until quota can be checked. The actual unconfigured API returns a safe `503` JSON response; browser retry preserves the unavailable state instead of showing `0/0` or login upsells.
- Tarot catches return generic operational errors; authentication preserves only explicitly allowed validation messages. NDJSON stream errors no longer echo provider exceptions. AI and OAuth logs omit raw exceptions, and model/database entry points have server-only boundaries. Stock model failure auditing also stores fixed failure codes instead of raw exception text. Synthetic provider-error regression tests cover credentials in error text without calling a live model.

Checks passed: Nasdaq 287 tests; Tarot draft 7, history 11, configuration 3, quota 2, and error-privacy 2 tests; Tarot typecheck and Webpack production build. Targeted lint passes. Full Tarot lint remains at the original 8 errors and 1 warning. The standalone model smoke script still refuses to call a provider without `--run-live`.

Credential review compared six distinct existing local credential values against this repository's publishable files, all Git history blobs, and 123 generated browser artifacts: no matches. A credential-shape scan found only the explicit placeholder in `.env.example`. The only tracked environment files are the four example templates. A separate production build with a synthetic server-key canary found no canary in 83 browser JavaScript files. No real credential values were printed or written into this report.

Basic quotes use public Eastmoney/Yahoo endpoints without a personal API key; the browser's Eastmoney trend token is a public request parameter, not a personal account secret. Tarot and optional stock AI read `DEEPSEEK_API_KEY` on the server. Supabase anon/publishable client keys are intended to be public; service-role keys, model keys, OAuth secrets, and session secrets must remain server-only. Publishing source does not include local environment values; a deployed app configured with an operator's model key still spends that operator's model allowance when visitors use it.

This review covers the local public snapshot and artifacts, not the existing production deployment. Database-backed flows and native-device acceptance remain unverified as listed above. The original repository was left unchanged.
