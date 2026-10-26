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
