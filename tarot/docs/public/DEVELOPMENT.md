# Candle Taro developer guide

English | [简体中文](./DEVELOPMENT.zh-CN.md)

Run commands from `tarot/` unless stated otherwise.

## Environment and accounts

Install the dependencies pinned in `package-lock.json` with `npm ci`. The app uses its own `tarot_users` and `tarot_sessions` tables. Username and password login does not use Supabase Auth's user table; optional OAuth also creates an application session.

Keep local settings in the ignored `.env.local` file. Set the corresponding server environment variables when deploying.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database administration key |
| `SESSION_SECRET` | A separate random value for OAuth state signing and related session operations |
| `AI_PROVIDER` | Defaults to `mock`; use `deepseek` for a live model |
| `DEEPSEEK_API_KEY` | Server-side model-service key |
| `DEEPSEEK_API_URL` | Full HTTPS OpenAI-compatible chat-completions URL |
| `DEEPSEEK_MODEL` | A model name supported by your provider |

You can generate a random value locally with `openssl rand -hex 32`. Do not prefix administration, model, or session secrets with `NEXT_PUBLIC_`.

## Initialize the database

Review and apply these migrations in filename order to your own empty Supabase project:

1. [Base tables](../../supabase/migrations/20260910100000_candle_taro_init.sql).
2. [OAuth users](../../supabase/migrations/20260911170000_oauth_users.sql).
3. [Silent reveal](../../supabase/migrations/20260914090000_silent_reveal.sql).
4. [Public share tokens](../../supabase/migrations/20260915100000_public_share_token.sql).
5. **Required security boundary:** [Private Tarot tables](../../supabase/migrations/202610260001_private_tarot_tables.sql).
6. [Manual draw progress and atomic operations](../../supabase/migrations/202610270001_manual_draw.sql).

These files define the schema; they do not contain account, reading, or conversation exports. For an existing database, check which migrations have already been applied before adding the remaining ones.

The server accesses the database through an administration client. Server APIs enforce user and guest ownership boundaries. Preserve those checks when adding APIs, and never expose the administration client to the browser. API ownership checks alone do not protect a table exposed through Supabase's Data API.

All five `tarot_*` tables are server-only: enable RLS with no client policies, revoke table and independent column privileges from `PUBLIC`, `anon`, and `authenticated`, and retain CRUD for `service_role`. A Supabase-authenticated user of another app is not a Tarot application session. Public sharing is resolved by the server using an opaque token; it does not require anonymous database access.

The security migration is transactional and rerunnable. It changes no user rows and no other apps' tables, policies, schema grants, or default privileges. Apply it to an existing database even when the first four migrations are already installed. Review and execute that one file through the SQL Editor or an authenticated management connection; do not bulk-push unrelated pending migrations in a shared project. The change takes effect in the database immediately; a frontend redeploy is not the fix.

Metadata-only verification is available in [private-tables.sql](../../supabase/checks/private-tables.sql). Expect five tables with RLS enabled, no client policies or table/column privileges for `anon` / `authenticated`, and retained server CRUD. Compare its other-app security fingerprint before and after applying the migration. No user records are queried.

## Manual draw flow

The cut deck stays centered while its card layers roll under the pointer. Dragging right decreases the cut position toward the top; dragging left increases the position toward the bottom. Only valid cut positions are rendered: there are no extra backs before position 1 or after position 77. The visible stack is centered from its rotated and scaled bounds, including at either end. The range input retains standard left-to-right increasing values, with both controls synchronized. Vertical swipes remain available for page scrolling, and keyboard controls and reduced motion are supported.

New readings use a shuffle/cut ritual followed by a continuous, horizontally scrollable fan of all 78 cards, with no pagination. The fan indices and cut are visual interaction only: **cards are randomly sampled on selection**, not mapped to hidden positions in advance. The server saves only selected identities privately in `draw_state`. Confirmation reveals these already-sampled cards and removes their private intermediate representation. Refreshing or retrying confirmation does not redraw.

- `POST /api/readings` reserves one reading atomically and returns no card faces. A stable `Idempotency-Key` UUID makes a lost-response retry return the same reading without another charge. Unfinished readings remain in history and can be resumed; abandoning one does not refund its creation quota.
- `POST /api/readings/[id]/draw` accepts `cut`, `select`, and `confirm`, with an expected revision. Server-only, SECURITY INVOKER RPCs lock the reading row, recheck ownership, reject stale revisions, and preserve existing selected cards when adding another. A fresh cryptographic candidate order is used for new selections; candidates are never persisted as a deck layout or supplied by the browser.
- Before confirmation, DTOs expose only selected visual indices, position labels, cut progress, and a revision. They never expose `picked`, card IDs, or orientations. Interpretation and follow-up endpoints reject unfinished draws.
- The migration adds one nullable column and service-only functions, keeps RLS, and does not rewrite existing readings. Legacy readings retain their old reveal flow. UTC-day reading reservations and usage increments use atomic database operations.
- Apply migration 6 **before** deploying the new app. Do not publish this frontend/backend revision against a database that has only the first five migrations. No production migration is performed by ordinary tests.

Local verification, with no cloud or paid model calls:

```sh
npm run test:draw
# Terminal 1: disposable in-memory PostgreSQL, localhost only
node test/fixtures/manual-draw-server.mjs
# Terminal 2: override the local cloud settings explicitly
SUPABASE_URL=http://127.0.0.1:4127 SUPABASE_SERVICE_ROLE_KEY=manual-draw-local-fixture AI_PROVIDER=mock npm run dev -- --webpack -H 127.0.0.1 -p 3127
# Terminal 3: explicit localhost-only API regression
node scripts/check-manual-draw-local.mjs --run-local
```

The fixture has a synthetic account `manual_preview` / `manual_preview_123` for local UI checks only. Closing the fixture process discards all its data. Do not reuse these credentials in any real deployment.

## Models and OAuth

Start with `AI_PROVIDER=mock`. For live calls, explicitly set `DEEPSEEK_API_URL` and `DEEPSEEK_MODEL`, and verify the destination. The default URL is the public DeepSeek chat-completions endpoint; override it to use another compatible provider. Failed model requests fall back to mock content.

OAuth is optional. Configure the providers you want to enable:

- `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET`.
- `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET`.
- `OAUTH_BASE_URL`: your application's origin, such as `https://your-app.example`.

Register `{OAUTH_BASE_URL}/api/auth/oauth/callback` with each OAuth application. For local development, use `http://localhost:3000/api/auth/oauth/callback`. Login buttons are hidden when the corresponding provider credentials are absent.

## Testing and debugging

```sh
npm run test:draft
npm run test:history
npm run test:config
npm run test:quota
npm run test:privacy
npm run test:database
npm run test:draw
npm run lint
npm run build
```

Draft tests use simulated localStorage; history tests use mocked requests. Neither requires a live cloud project. Configuration tests cover default and custom model targets and reject credential-bearing URLs.

`test:database` runs the actual migrations against in-memory PostgreSQL with synthetic data. It checks anonymous and authenticated denial, column grants, RLS defense in depth, server login/session/history/share/usage access, idempotence, and unrelated-table preservation. It makes no cloud calls.

For an explicitly authorized, read-only cloud check, load your local server configuration and supply the expected target. Optionally use the public configuration of another app that shares the database:

```sh
node --env-file=.env.local scripts/check-database-security.mjs \
  --run-live --expected-project-ref YOUR_PROJECT_REF \
  --public-env-file ../glucose-mobile/.env.local
```

Omit `--public-env-file` to use this app's local public-key configuration. The script sends only HEAD requests, expects public access to be denied and service access to succeed, and logs no keys, row contents, or record counts. Do not replace a public key with an administration key to make the anonymous test pass.

If Turbopack cannot bind its internal worker port in a restricted environment, use `npm run build -- --webpack`. See the [validation snapshot](../../../docs/VALIDATION.md) for the inherited full-lint findings.

The project's `scripts/smoke-deepseek.mts` is an additional live-model check, excluded from ordinary tests. Run `npm run test:ai:live` to explicitly enable it: the command loads `.env.local` and uses the pinned TypeScript runner. It sends a synthetic question and incurs model usage charges; output is limited to chunk and character counts.

## Deployment

Create your own Vercel application, set Root Directory to `tarot`, and use the Next.js build settings. Configure the server environment, then register production callbacks if enabling OAuth.

Before release, check registration and logout, guest readings, interpretation retry, history pagination, and enabling and revoking shares in your own test environment. Provide a sharing link only after the user enables sharing.

## Vercel environment variables

1. Open the Vercel project for this app. In **Settings → Environment Variables**, add each variable name and value separately. Use Root Directory `tarot` and apply the database migrations described above before testing accounts or readings.
2. For the database and account features, configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a separate random `SESSION_SECRET`. These values belong to your own backend.
3. To use a live model, set the following values. Replace the key and model placeholders; use the HTTPS chat-completions endpoint supplied by your provider if it differs from the example:

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=replace-with-your-model-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=your-supported-model
```

4. Choose **Production** for the live site, **Preview** for preview deployments, and **Development** for Vercel local development as needed. Prefer a separate test database and model key for Preview and Development. A variable selected only for Production is not available in Preview.
5. Save the variables and create a new deployment or redeploy. Changes do not update an already built deployment. If using OAuth, also configure the optional values and callback URLs listed above.

For ordinary local Next.js development, copy `.env.example` to `.env.local` on first setup, fill in the same variable names, and restart `npm run dev` after changing them. Keep an existing local file rather than replacing it with the template. Local files are ignored by Git; values saved in Vercel are managed separately and are not copied into a new Vercel project when you copy this repository.

Keep `DEEPSEEK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, and OAuth client secrets server-only, without a `NEXT_PUBLIC_` prefix. In Vercel, enter values in the value field, not a whole `NAME=value` line. This guide and the example file contain placeholders only.

With `AI_PROVIDER=mock`, no paid model is called, but account and reading storage still needs Supabase. The public source does not include the maintainer's model key; each deployment supplies its own. If you configure a live key for a public site, visitors' model calls use that key's allowance.

Vercel reference: [Environment variables](https://vercel.com/docs/environment-variables).

## Contributing

- Add relevant draft, history, or domain tests for changes to pure logic.
- Add a migration for schema changes and describe their effect on existing data.
- Use synthetic content in reproductions and screenshots. Do not commit real questions, conversations, sessions, or environment configuration.
- Consult the repository documentation matching the installed Next.js dependency when changing framework-specific code.

## Missing native CSS dependencies

If startup reports a missing Lightning CSS or Tailwind native module, an optional package download may have failed even when npm returned success. Retry the optional installation and check the modules before restarting the server:

```sh
npm install --include=optional
node -e "require('lightningcss'); require('@tailwindcss/oxide')"
```

The lockfile already includes supported platform packages; do not add a platform-specific package as a required dependency for all developers.
