# Nasdaq Dashboard developer guide

English | [简体中文](./DEVELOPMENT.zh-CN.md)

Run commands from `stock-dashboard/` unless stated otherwise. This is not an npm workspace: root dependencies provide the Vercel CLI, while the project defines its own test and maintenance commands.

## Environment and runtime

Use Node.js 22. Run `npm ci` at the repository root to install the Vercel CLI, then enter the project and run:

```sh
node ../node_modules/vercel/dist/index.js dev
```

Node.js tests and most maintenance scripts do not require a frontend build. When changing static modules, check that the PWA shell cache includes any new local modules.

## Data and configuration

Personal watchlists, preferences, and logs are stored in the browser by default. The app accepts the Supabase URL and public key for sync and also persists the login session in the browser. Server secrets are used only by APIs and maintenance tasks.

Copy `.env.example` to `.env.local` and configure the features you need:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Server-side Supabase URL |
| `SUPABASE_SECRET_KEY` | Server-only database Secret Key |
| `CRON_SECRET` | Authentication for scheduled collection and protected maintenance APIs |
| `SEC_USER_AGENT` | Optional SEC collector identification; use your own app name and contact email |
| `FRED_API_KEY` | Optional macroeconomic data collection key |
| `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL`, `DEEPSEEK_MODEL` | Optional model-service configuration |

Use a separate random value for `CRON_SECRET`. Supply variables through your local environment or Vercel Development settings. Keep real values out of terminal output, screenshots, and source code.

### Optional model features

The switches in `.env.example` control separate capabilities:

- `DEEPSEEK_RESEARCH_ENABLED` and `DEEPSEEK_RESEARCH_DATA_APPROVED`: research narrative requests and permission to send research packets.
- `DEEPSEEK_MAX_DAILY_REQUESTS`: the daily request limit for research narratives.
- `DEEPSEEK_GATEWAY_COMPATIBILITY_ENABLED`: a gateway compatibility check using a fixed probe.
- `DEEPSEEK_BEGINNER_READING_ENABLED`: explanations triggered manually from the page; these do not use the research narrative daily allowance above.

Explicitly verify the model URL, model name, and enabled features for an independent deployment. Leave these switches off by default, and validate basic quotes separately from model services.

## Initialize the database

The complete schema lives in [supabase/migrations/](../../supabase/migrations/), covering personal state, public prices, collection runs, events, and research archives.

For a fresh installation, review and apply migrations in filename timestamp order to your own empty Supabase project. For an existing database, check its migration history and apply only missing files. Do not use another environment's table data, accounts, or collection logs as initialization seeds.

- Personal state tables isolate users through `auth.uid()`.
- Server-side price, collection, and research tables use the grants defined in the migrations.
- Cloud sync uses Supabase Auth email login; allow your application's redirect URL in your own Auth settings.

Observations, decision logs, and other fields are introduced by later migrations. Creating only the initial state table does not cover every feature.

## Tests and maintenance commands

```sh
npm test
```

The following commands are optional maintenance workflows. Check the target environment and input scope before running them:

| Command | Purpose |
| --- | --- |
| `npm run backfill:qqq`, `npm run backfill:ndx` | Fetch and backfill historical prices |
| `npm run fred:macro`, `npm run sec:filings` | Collect macroeconomic data and public filings |
| `npm run research:rebuild-derived` | Preview derived-data rebuilding; writes require explicit arguments |
| `npm run ndx:discover`, `npm run ndx:source-check` | Discover constituent candidates and check sources |
| `npm run ndx:review` | Review constituent changes |
| `npm run ndx:import`, `npm run earnings:import` | Import reviewed data |

These commands are not required to start the app. Backfills, collection, and imports may contact external sources or write to the database. Read the corresponding `scripts/` implementation and arguments first; do not run every npm script in a batch.

Retain original sources and review status for constituent and earnings candidates. Keep missing values missing, and do not treat unconfirmed events as reported facts.

## Deployment

Set Root Directory to `stock-dashboard` in your own Vercel project. Retain the function and Cron configuration in the project's `vercel.json`.

The current Cron expression is `0 22 * * 1-5`, scheduled in UTC. Account for trading days and daylight-saving changes when adapting it to a market-close workflow. Read-only coverage and collection-run queries are available for checking results.

Run local tests before deployment, then validate public prices, personal sync, and protected collection APIs separately. Deploying code does not backfill history or import candidates.

## Contributing

- Add tests that distinguish the old and new behavior, and specify market dates and time zones.
- Retain news, filing, and constituent sources. Do not use collection time as publication time.
- Keep real positions, emails, personal logs, and keys out of tests, screenshots, and exports.
- Update the PWA shell cache and related tests when adding client modules.
