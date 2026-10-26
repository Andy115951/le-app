# Nasdaq Dashboard

English | [简体中文](./README.zh-CN.md)

A market dashboard for the Nasdaq-100, major technology stocks, price history, and public news. Built with vanilla JavaScript, HTML, and CSS, with optional Supabase sync and server-side collection on Vercel.

## Features

- A core market radar, quotes, and news aggregation independent of personal watchlists.
- NDX / QQQ daily prices, a trading calendar, earnings, and constituent changes.
- Source links, historical events, features, and similar-day research.
- Watchlists, groups, position context, price targets, and drawdown rules.
- Personal observations and decision logs, with optional account sync.
- PWA support, local persistence, and optional model-generated explanations.

The dashboard organizes public information and records personal decisions; it does not place orders. News clues, historical similarities, and model explanations do not establish why a price changed.

## Run locally

Full integration uses the Vercel CLI installed at the repository root. Use Node.js 22. From the repository root:

```sh
npm ci
cd stock-dashboard
node ../node_modules/vercel/dist/index.js dev
```

Follow the CLI prompts to link your own Vercel project, and use the URL printed in the terminal. Watchlists and basic browser state can remain local. Public archives, research APIs, and scheduled collection require additional server and database configuration.

For layout-only checks, run `python3 -m http.server 8080` from `stock-dashboard/` and open [http://localhost:8080](http://localhost:8080). A static server does not execute `api/` and cannot replace full quote-API integration.

## Configuration options

- Local use: no personal cloud account is required, but quotes still need network access and the corresponding server APIs.
- Personal sync: enter your own Supabase URL and public anon key in the app, then sign in by email.
- Public history and collection: configure database administration and Cron secrets on the server.
- Model explanations: enable as needed; research packets are not sent to a model by default.

See the [developer guide](./docs/public/DEVELOPMENT.md) for setup and environment variables.

## Documentation

- [Product roadmap](./docs/ROADMAP.md): current product direction, boundaries, and priorities.
- [Guided reading](./docs/guides/beginner-reading.md): how the beginner-facing market reading works and its limits.
- [NDX source check archive](./docs/research-sources/ndx-source-check-2026-09-15.md): a dated record of an official-source availability check.

## Validation

Run from `stock-dashboard/`:

```sh
npm test
```

Tests use Node.js's built-in test runner. Validate live market sources, cloud databases, scheduled tasks, and browser interactions separately.

## Project structure

| Path | Contents |
| --- | --- |
| `app.js`, `index.html`, `styles.css` | UI and interactions |
| `quotes.js`, `chart.js`, `storage.js`, `cloud.js` | Quotes, charts, local state, and cloud sync |
| `api/` | Quotes, research, calendar, and scheduled-task APIs |
| `lib/` | Collection, evidence, research, and validation rules |
| `scripts/` | Import, backfill, evaluation, and maintenance commands |
| `supabase/migrations/` | Schema and access migrations |
| `data/` | Sourced market data, candidates, and evaluation files |
| `test/` | Automated tests |

Personal positions, decision logs, and cloud exports are excluded from source distribution. Use fictional accounts and values in issue reports.
